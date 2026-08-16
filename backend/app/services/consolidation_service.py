"""
Consolidation service.

REAL architecture (confirmed via mongosh against live data):

- FeeCategory (e.g. "OJT Fees", "Laboratory Fees") has zero or more
  FeeCategoryOffice records under it — these ARE the offices a PPMP
  can belong to for that category, each with its own _id.
- PPMP.office_id stores that FeeCategoryOffice._id directly — NOT an
  id from the separate `Office` collection. The two collections have
  overlapping-looking names (e.g. both have a "CITE/BSCS") but are
  otherwise unrelated; PPMPs never reference `Office` at all.
- PPMPEntry.category_description is a completely different, unrelated
  concept — a free-text expense classification on an individual entry
  (e.g. "Office Supplies"). It has nothing to do with Fee Category.

So "consolidate by Fee Category" means:
  1. Look up which FeeCategoryOffice documents belong to the selected
     FeeCategory (includes sub-offices, since a PPMP-creating office
     could be either a top-level or a child office).
  2. Match those FeeCategoryOffice._id values directly against
     PPMP.office_id — a plain id-to-id lookup, no name matching, no
     second collection involved.
  3. Pull every PPMP with a matching office_id for the given
     year/ppmp_type.
  4. Show ALL of each PPMP's projects/entries/items, with the same
     field set PPMPDetailPage.tsx renders (timeline, funding, mode of
     procurement, etc.) — no entry-level category filtering, since
     category_description is unrelated to Fee Category.

PPMP versioning: when an office has multiple PPMPs (e.g. PPMP No. 1
and PPMP No. 2 due to versioning), each PPMP is kept as a separate
consolidated record. They are identified by their ppmp_no and are
NOT merged even if they share the same office, year, and type.

Signatories / description note: these live on the PPMP document itself,
not on the office. Each PPMP carries its own description/signatories.
"""
from __future__ import annotations

from datetime import datetime, timezone

from beanie.operators import In
from app.models.ppmp import PPMP
from app.models.fee_category import FeeCategory
from app.models.fee_category_office import FeeCategoryOffice

from app.schemas.consolidation import (
    ConsolidatedItemOut,
    ConsolidatedEntryOut,
    ConsolidatedProjectOut,
    ConsolidatedSignatoryOut,
    ConsolidatedOfficeOut,
    ConsolidatedPPMPResponse,
)


async def get_categories() -> list[str]:
    """The real Fee Category list — same names shown in the Fee Categories
    admin tab (STF, Other School Fees, Laboratory Fees, OJT Fees, etc.)."""
    categories = await FeeCategory.find_all().sort("+display_order").to_list()
    return [c.name for c in categories]


def _empty_response(fee_category: str, fiscal_year: int, ppmp_type: str) -> ConsolidatedPPMPResponse:
    return ConsolidatedPPMPResponse(
        fee_category=fee_category,
        fiscal_year=fiscal_year,
        ppmp_type=ppmp_type,
        offices=[],
        grand_total=0.0,
        office_count=0,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


def _item_amount(item) -> float:
    if item.total_cost:
        return item.total_cost
    return (item.quantity or 0) * (item.unit_price or 0)


def _build_signatories(ppmp: PPMP) -> list[ConsolidatedSignatoryOut]:
    sigs = sorted(ppmp.signatories or [], key=lambda s: s.order_no or 0)
    return [
        ConsolidatedSignatoryOut(
            sign_off=s.sign_off or "",
            name=s.name or "",
            position=s.position or "",
            order_no=s.order_no or 0,
        )
        for s in sigs
    ]


async def build_consolidated_view(
    fee_category: str,
    fiscal_year: int,
    ppmp_type: str,
) -> ConsolidatedPPMPResponse:
    category = await FeeCategory.find_one(FeeCategory.name == fee_category)
    if not category:
        return _empty_response(fee_category, fiscal_year, ppmp_type)

    # 1. Every FeeCategoryOffice under this category — top-level and
    #    sub-offices — since PPMP.office_id can point at either level.
    fc_offices = await FeeCategoryOffice.find(
        FeeCategoryOffice.fee_category_id == category.id
    ).to_list()

    office_by_id = {str(o.id): o for o in fc_offices}
    office_ids = list(office_by_id.keys())

    if not office_ids:
        return _empty_response(fee_category, fiscal_year, ppmp_type)

    # 2 & 3. Direct id-to-id match — no cross-collection name matching.
    # Only include submitted PPMPs in the consolidated view.
    ppmps: list[PPMP] = await PPMP.find(
        In(PPMP.office_id, office_ids),
        PPMP.year == fiscal_year,
        PPMP.ppmp_type == ppmp_type,
        PPMP.status == "submitted",
    ).to_list()

    if not ppmps:
        return _empty_response(fee_category, fiscal_year, ppmp_type)

    ppmps_by_office: dict[str, list[PPMP]] = {}
    for p in ppmps:
        ppmps_by_office.setdefault(p.office_id, []).append(p)

    grand_total = 0.0
    consolidated_offices: list[ConsolidatedOfficeOut] = []

    for office_id, office_ppmps in ppmps_by_office.items():
        office_doc = office_by_id.get(office_id)
        office_name = office_doc.name if office_doc else "Unknown Office"

        # Each PPMP for this office is kept as a separate consolidated
        # record — they are independent PPMPs identified by ppmp_no, not
        # merged even if they share the same office, year, and type.
        for ppmp in office_ppmps:
            office_projects: list[ConsolidatedProjectOut] = []
            office_total = 0.0

            for project in (ppmp.projects or []):
                if not (project.entries or []):
                    continue

                consolidated_entries: list[ConsolidatedEntryOut] = []
                project_subtotal = 0.0

                for entry in project.entries:
                    consolidated_items = [
                        ConsolidatedItemOut(
                            item_name=item.item_name,
                            quantity=item.quantity or 0,
                            unit=item.unit or "",
                            unit_price=item.unit_price or 0,
                            total_cost=_item_amount(item),
                        )
                        for item in (entry.items or [])
                    ]

                    entry_subtotal = sum(i.total_cost for i in consolidated_items)
                    project_subtotal += entry_subtotal

                    consolidated_entries.append(
                        ConsolidatedEntryOut(
                            entry_id=entry.id,
                            category_description=entry.category_description or "",
                            description=entry.description or "",
                            project_type=entry.project_type or "",
                            procurement_mode=entry.procurement_mode or "",
                            pre_proc_conference=entry.pre_proc_conference or "",
                            start_activity=entry.start_activity or "",
                            end_activity=entry.end_activity or "",
                            delivery_period=entry.delivery_period or "",
                            source_of_funds=entry.source_of_funds or "",
                            items=consolidated_items,
                            entry_subtotal=entry_subtotal,
                        )
                    )

                office_total += project_subtotal

                office_projects.append(
                    ConsolidatedProjectOut(
                        project_id=f"{ppmp.id}-{project.order_no}",
                        project_label=project.remarks.strip() if project.remarks and project.remarks.strip() else f"Project {project.order_no}",
                        remarks=project.remarks,
                        attached_document_title=project.attached_document_title or "",
                        entries=consolidated_entries,
                        project_subtotal=project_subtotal,
                    )
                )

            if not office_projects:
                continue  # this PPMP had no projects/entries at all

            grand_total += office_total

            consolidated_offices.append(
                ConsolidatedOfficeOut(
                    office_id=office_id,
                    office_name=office_name,
                    ppmp_id=str(ppmp.id),
                    ppmp_no=ppmp.ppmp_no,
                    ppmp_type=ppmp_type,
                    fiscal_year=fiscal_year,
                    description=ppmp.description or "",
                    additional_description=ppmp.additional_description or "",
                    signatories=_build_signatories(ppmp),
                    projects=office_projects,
                    office_total=office_total,
                )
            )

    consolidated_offices.sort(key=lambda o: o.office_name)

    return ConsolidatedPPMPResponse(
        fee_category=fee_category,
        fiscal_year=fiscal_year,
        ppmp_type=ppmp_type,
        offices=consolidated_offices,
        grand_total=grand_total,
        office_count=len(consolidated_offices),
        generated_at=datetime.now(timezone.utc).isoformat(),
    )