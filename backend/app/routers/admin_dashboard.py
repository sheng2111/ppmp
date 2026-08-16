from datetime import datetime
from typing import Optional

from fastapi import APIRouter

from app.models.fee_category_office import FeeCategoryOffice
from app.models.item import Item
from app.models.app_meta import AppMeta
from app.models.ppmp import PPMP
from app.routers.auth import require_admin

router = APIRouter(prefix="/admin/dashboard", tags=["admin-dashboard"])


def _count_items(ppmp: PPMP) -> int:
    """Number of individual procurement line items on a PPMP (one per
    PPMPEntryItem), summed across every project and entry."""
    total = 0
    for project in (ppmp.projects or []):
        for entry in (project.entries or []):
            total += len(entry.items or [])
    return total


def _office_display_name(office, offices_by_id: dict) -> str:
    if office.parent_office_id:
        parent = offices_by_id.get(str(office.parent_office_id))
        if parent:
            return f"{parent.name} / {office.name}"
    return office.name


@router.get("/summary")
async def get_dashboard_summary(
    requester_uid: str,
    fiscal_year: Optional[int] = None,
    office_id: Optional[str] = None,
):
    """Admin-only summary backing the Admin Dashboard.

    Everything PPMP-derived is scoped to the selected fiscal year and, when
    given, a single office. "Total Offices" is deliberately global (the
    registry of all managed offices). Each PPMP row carries its own office
    so a submitted PPMP is never shown under a different office's banner.
    """
    await require_admin(requester_uid)

    offices = await FeeCategoryOffice.find_all().to_list()
    offices_by_id = {str(o.id): o for o in offices}

    all_ppmps = await PPMP.find({"status": {"$ne": "archived"}}).to_list()
    fiscal_years = sorted({p.year for p in all_ppmps if p.year}, reverse=True)

    default_year = fiscal_years[0] if fiscal_years else datetime.now().year
    fy = fiscal_year or default_year

    scoped = [p for p in all_ppmps if p.year == fy]
    if office_id:
        scoped = [p for p in scoped if p.office_id == office_id]

    submitted = [p for p in scoped if p.status == "submitted"]
    final = [p for p in scoped if p.ppmp_type == "final"]
    pending = submitted  # no separate consolidation flag exists in the data model

    total_items = sum(_count_items(p) for p in scoped)

    submitted_office_ids = {p.office_id for p in submitted if p.office_id}

    # ── Recent submissions (newest first) ───────────────────────────────
    recent_submissions = sorted(
        submitted,
        key=lambda p: p.submitted_at or datetime.min,
        reverse=True,
    )[:8]
    recent_rows = []
    for p in recent_submissions:
        office = offices_by_id.get(p.office_id)
        recent_rows.append(
            {
                "id": str(p.id),
                "ppmp_no": p.ppmp_no,
                "year": p.year,
                "ppmp_type": p.ppmp_type,
                "status": p.status,
                "office_id": p.office_id,
                "office_name": _office_display_name(office, offices_by_id) if office else p.office_id,
                "prepared_by": p.prepared_by,
                "submitted_by": p.submitted_by,
                "submitted_at": p.submitted_at,
            }
        )

    # ── Office overview (all offices for the FY) ────────────────────────
    fy_offices = {p.office_id for p in all_ppmps if p.year == fy}
    if office_id:
        fy_offices = {office_id} if office_id in fy_offices else set()

    office_overview = []
    for oid in fy_offices:
        office = offices_by_id.get(oid)
        office_ppmps = [p for p in all_ppmps if p.year == fy and p.office_id == oid]
        office_overview.append(
            {
                "office_id": oid,
                "office_name": _office_display_name(office, offices_by_id) if office else oid,
                "total_ppmps": len(office_ppmps),
                "submitted": sum(1 for p in office_ppmps if p.status == "submitted"),
                "draft": sum(1 for p in office_ppmps if p.status == "draft"),
                "final": sum(1 for p in office_ppmps if p.ppmp_type == "final"),
                "items": sum(_count_items(p) for p in office_ppmps),
            }
        )
    office_overview.sort(key=lambda r: r["office_name"].lower())

    # ── Itemized breakdown (per office, same FY) ────────────────────────
    itemized_offices = []
    for r in office_overview:
        itemized_offices.append(
            {"office_id": r["office_id"], "office_name": r["office_name"], "items": r["items"]}
        )

    # ── APP overview ────────────────────────────────────────────────────
    submitted_ids = [str(p.id) for p in submitted]
    app_settings_count = 0
    if submitted_ids:
        app_settings_count = await AppMeta.find(
            {"ppmp_id": {"$in": submitted_ids}}
        ).count()
    last_submission = max(
        (p.submitted_at for p in submitted if p.submitted_at),
        default=None,
    )

    # ── Item management (catalog) ───────────────────────────────────────
    catalog_items = await Item.find({"is_active": True}).count()
    recently_added_items = (
        await Item.find({"is_active": True})
        .sort("-updated_at")
        .limit(5)
        .to_list()
    )

    return {
        "fiscal_years": fiscal_years,
        "current_fiscal_year": fy,
        "generated_at": datetime.utcnow(),
        "cards": {
            "total_offices": len(offices),
            "offices_with_submissions": len(submitted_office_ids),
            "total_ppmps": len(scoped),
            "submitted_ppmps": len(submitted),
            "final_ppmps": len(final),
            "pending_ppmps": len(pending),
            "total_items": total_items,
        },
        "recent_submissions": recent_rows,
        "office_overview": office_overview,
        "consolidation": {
            "fiscal_year": fy,
            "total_ppmps": len(scoped),
            "submitted_ppmps": len(submitted),
            "indicative_ppmps": sum(1 for p in scoped if p.ppmp_type == "indicative"),
            "final_ppmps": len(final),
        },
        "app_overview": {
            "fiscal_year": fy,
            "submitted_ppmps": len(submitted),
            "app_settings_count": app_settings_count,
            "last_submission": last_submission,
        },
        "item_management": {
            "catalog_items": catalog_items,
            "recently_added": [
                {
                    "id": str(i.id),
                    "name": i.name,
                    "unit": i.unit,
                    "unit_price": i.unit_price,
                    "category": i.category,
                    "updated_at": i.updated_at,
                }
                for i in recently_added_items
            ],
        },
        "itemized": {
            "fiscal_year": fy,
            "total_items": total_items,
            "offices": itemized_offices,
        },
    }
