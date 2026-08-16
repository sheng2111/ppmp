"""
Admin Consolidated APP router.

GET  /api/admin/app-consolidation/categories  -> Fee Category names
GET  /api/admin/app-consolidation              -> consolidated APP JSON
GET  /api/admin/app-consolidation/export/excel
GET  /api/admin/app-consolidation/export/pdf

Follows the same architecture as the Consolidated PPMP
(app/routers/ppmp_consolidation.py + app/services/consolidation_service.py):
  1. Look up FeeCategoryOffice ids for the selected Fee Category
  2. Match those against submitted PPMPs for the given year
  3. Filter by AppMeta.version_type (indicative/final/updated)
  4. Generate APP rows per PPMP (same logic as app_routes.py)
  5. Group ALL rows by category band (General Requirements, Misc, CSE)
     — no office identification shown.

Auth note: uses require_admin same as the PPMP consolidation router.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse
from beanie.operators import In

from app.models.ppmp import PPMP
from app.models.fee_category import FeeCategory
from app.models.fee_category_office import FeeCategoryOffice
from app.models.app_meta import AppMeta
from app.models.app_entry_detail import AppEntryDetail
from app.services.signatory import get_signatory_settings

from app.schemas.app_consolidation import (
    ConsolidatedAPPRowOut,
    ConsolidatedAPPCategoryOut,
    ConsolidatedAPPResponse,
)
from app.routers.auth import require_admin

router = APIRouter(
    prefix="/admin/app-consolidation",
    tags=["Admin - APP Consolidation"],
)

DEFAULT_CATEGORY = "General Requirements"

CATEGORY_BANDS = [
    {
        "name": "General Requirements",
        "label": "General Requirements",
    },
    {
        "name": "Miscellaneous Items",
        "label": "Miscellaneous Items (for Direct Acquisition only) Sec 32.2 of RA No. 12009",
    },
    {
        "name": "Common Use Supplies and Equipment (CSE)",
        "label": "Common Use Supplies and Equipment (CSE) to be purchased from PS-DBM (kindly indicate the summary/total amounts only)",
    },
]


# ---------------------------------------------------------------------------
# Helpers — reuse the same logic from app_routes.py
# ---------------------------------------------------------------------------

def _items_by_category(entry) -> dict:
    """Group an entry's items by their category. Mirrors app_routes.py."""
    groups: dict = {}
    for item in entry.items:
        if not getattr(item, "is_procurable", True):
            continue
        cat = item.category or DEFAULT_CATEGORY
        groups.setdefault(cat, []).append(item)
    if not groups and not entry.items:
        groups[DEFAULT_CATEGORY] = []
    return groups


def _general_description(entry) -> str:
    """Column 3 — mirrors app_routes.py."""
    description = (entry.description or "").strip()
    project_type = (entry.project_type or "").strip()
    if not description:
        return ""
    if not project_type:
        return description
    return f"{description} - ({project_type})"


def _build_ppmp_rows(ppmp: PPMP, entry_details: dict) -> list[ConsolidatedAPPRowOut]:
    """Generate APP rows for a single PPMP — same logic as
    app_routes.generate_app_from_ppmp but returns schema objects."""
    rows: list[ConsolidatedAPPRowOut] = []
    for project in ppmp.projects or []:
        for entry in project.entries or []:
            entry_id = getattr(entry, "id", None) or ""
            detail = entry_details.get(entry_id) if entry_id else None

            for category, items in _items_by_category(entry).items():
                category_budget = round(
                    sum((it.total_cost or 0) for it in items), 2
                )
                rows.append(
                    ConsolidatedAPPRowOut(
                        row_key=f"{ppmp.id}:{entry_id}:{category}",
                        category=category,
                        project_title=getattr(entry, "project_title", "") or "",
                        general_description=_general_description(entry),
                        procurement_mode=entry.procurement_mode or "",
                        early_procurement=detail.early_procurement if detail else "",
                        bid_evaluation=(
                            "LCRB"
                            if entry.procurement_mode == "Competitive Public Bidding"
                            else "N/A"
                        ),
                        start_activity=entry.start_activity or "",
                        end_activity=entry.end_activity or "",
                        source_of_funds=entry.source_of_funds or "",
                        estimated_budget=category_budget,
                        procurement_strategy=detail.procurement_strategy if detail else [],
                        remarks=project.remarks or "",
                    )
                )
    return rows


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/categories")
async def get_categories(requester_uid: str):
    """Return the Fee Category list — same as PPMP consolidation."""
    await require_admin(requester_uid)
    categories = await FeeCategory.find_all().sort("+display_order").to_list()
    return [c.name for c in categories]


@router.get("", response_model=ConsolidatedAPPResponse)
async def get_consolidated_app(
    requester_uid: str,
    fee_category: str = Query(...),
    fiscal_year: int = Query(...),
    app_version_type: str = Query(..., description="'indicative', 'final', or 'updated'"),
):
    await require_admin(requester_uid)

    if app_version_type not in ("indicative", "final", "updated"):
        raise HTTPException(
            status_code=422,
            detail="app_version_type must be 'indicative', 'final', or 'updated'.",
        )

    # 1. Look up FeeCategory
    category = await FeeCategory.find_one(FeeCategory.name == fee_category)
    if not category:
        return _empty_response(fee_category, fiscal_year, app_version_type)

    # 2. All FeeCategoryOffice ids under this category
    fc_offices = await FeeCategoryOffice.find(
        FeeCategoryOffice.fee_category_id == category.id
    ).to_list()
    office_ids = [str(o.id) for o in fc_offices]
    if not office_ids:
        return _empty_response(fee_category, fiscal_year, app_version_type)

    # 3. Submitted PPMPs matching office + year
    ppmps: list[PPMP] = await PPMP.find(
        In(PPMP.office_id, office_ids),
        PPMP.year == fiscal_year,
        PPMP.status == "submitted",
    ).to_list()
    if not ppmps:
        return _empty_response(fee_category, fiscal_year, app_version_type)

    # 4. Filter by AppMeta.version_type
    # PPMPs without an AppMeta record are included regardless of the
    # version filter — their APP defaults to "indicative" (matching
    # app_routes.py behavior). This ensures submitted PPMPs that
    # haven't visited APP Settings still appear in the consolidated view.
    ppmp_ids = [str(p.id) for p in ppmps]
    metas = await AppMeta.find(
        In(AppMeta.ppmp_id, ppmp_ids),
    ).to_list()
    meta_by_ppmp = {m.ppmp_id: m for m in metas}

    matched_ppmps = []
    for p in ppmps:
        meta = meta_by_ppmp.get(str(p.id))
        if meta:
            # Has AppMeta — include only if version_type matches
            if meta.version_type == app_version_type:
                matched_ppmps.append(p)
        else:
            # No AppMeta — default version is "indicative".
            # Include if the filter is "indicative" or if using the
            # PPMP's own ppmp_type as fallback.
            if app_version_type == "indicative":
                matched_ppmps.append(p)
            elif app_version_type == getattr(p, "ppmp_type", "indicative"):
                matched_ppmps.append(p)
    if not matched_ppmps:
        return _empty_response(fee_category, fiscal_year, app_version_type)

    # 5. Fetch entry details for all matched PPMPs (EPA / procurement strategy)
    all_details = await AppEntryDetail.find(
        In(AppEntryDetail.ppmp_id, ppmp_ids)
    ).to_list()
    details_by_ppmp: dict[str, dict] = {}
    for d in all_details:
        details_by_ppmp.setdefault(d.ppmp_id, {})[d.entry_id] = d

    # 6. Generate APP rows for each PPMP and collect them
    all_rows: list[ConsolidatedAPPRowOut] = []
    for ppmp in matched_ppmps:
        entry_details = details_by_ppmp.get(str(ppmp.id), {})
        all_rows.extend(_build_ppmp_rows(ppmp, entry_details))

    if not all_rows:
        return _empty_response(fee_category, fiscal_year, app_version_type)

    # 7. Group by category band
    band_map: dict[str, list[ConsolidatedAPPRowOut]] = {b["name"]: [] for b in CATEGORY_BANDS}
    for row in all_rows:
        key = row.category if row.category in band_map else DEFAULT_CATEGORY
        band_map.setdefault(key, []).append(row)

    categories_out: list[ConsolidatedAPPCategoryOut] = []
    grand_total = 0.0
    for band in CATEGORY_BANDS:
        rows = band_map.get(band["name"], [])
        if not rows:
            continue
        subtotal = round(sum(r.estimated_budget for r in rows), 2)
        grand_total += subtotal
        categories_out.append(
            ConsolidatedAPPCategoryOut(
                name=band["name"],
                label=band["label"],
                rows=rows,
                subtotal=subtotal,
            )
        )

    return ConsolidatedAPPResponse(
        fee_category=fee_category,
        fiscal_year=fiscal_year,
        app_version_type=app_version_type,
        categories=categories_out,
        grand_total=round(grand_total, 2),
        ppmp_count=len(matched_ppmps),
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


def _empty_response(fee_category: str, fiscal_year: int, app_version_type: str) -> ConsolidatedAPPResponse:
    return ConsolidatedAPPResponse(
        fee_category=fee_category,
        fiscal_year=fiscal_year,
        app_version_type=app_version_type,
        categories=[],
        grand_total=0.0,
        ppmp_count=0,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


# ---------------------------------------------------------------------------
# Export — Excel
# ---------------------------------------------------------------------------

@router.get("/export/excel")
async def export_excel(
    requester_uid: str,
    fee_category: str = Query(...),
    fiscal_year: int = Query(...),
    app_version_type: str = Query(...),
):
    await require_admin(requester_uid)
    from app.utils.export_consolidated_app import export_to_excel

    data = await get_consolidated_app(
        requester_uid=requester_uid,
        fee_category=fee_category,
        fiscal_year=fiscal_year,
        app_version_type=app_version_type,
    )
    buffer = export_to_excel(data)
    filename = f"Consolidated_APP_{fee_category}_{fiscal_year}_{app_version_type}.xlsx".replace(" ", "_")
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# Export — PDF
# ---------------------------------------------------------------------------

@router.get("/export/pdf")
async def export_pdf(
    requester_uid: str,
    fee_category: str = Query(...),
    fiscal_year: int = Query(...),
    app_version_type: str = Query(...),
):
    await require_admin(requester_uid)
    from app.utils.export_consolidated_app import export_to_pdf

    data = await get_consolidated_app(
        requester_uid=requester_uid,
        fee_category=fee_category,
        fiscal_year=fiscal_year,
        app_version_type=app_version_type,
    )
    buffer = export_to_pdf(data)
    filename = f"Consolidated_APP_{fee_category}_{fiscal_year}_{app_version_type}.pdf".replace(" ", "_")
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
