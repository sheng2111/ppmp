from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from beanie import PydanticObjectId

from app.models.ppmp import PPMP
from app.models.fee_category_office import FeeCategoryOffice
from app.models.app_entry_detail import AppEntryDetail, AppEntryDetailPatch
from app.models.app_meta import AppMeta, AppSignatory
from app.models.signatory_settings import SignatorySettings
from app.services.signatory import get_signatory_settings

router = APIRouter(prefix="/app", tags=["app"])

DEFAULT_CATEGORY = "General Requirements"


def _items_by_category(entry) -> dict:
    """
    Groups an entry's items by their Category. An entry with items all in
    one category yields a single group (unchanged behavior); an entry with
    items spread across categories (e.g. some General Requirements, some
    CSE) yields one group per category actually used, so each gets its own
    row banded under the right section instead of the whole entry's budget
    being silently absorbed into whichever category its first item happens
    to have.

    An entry with no items at all still yields one empty group under the
    default category, so it still produces a (zero-budget) row rather than
    vanishing entirely.
    """
    groups: dict = {}
    for item in entry.items:
        # The APP lists procurable items only. Non-procurable items stay
        # visible in the PPMP and in PRs, but are excluded here — see
        # PPMPEntryItem.is_procurable. getattr() (rather than direct
        # attribute access) also tolerates dict-shaped items safely.
        if not getattr(item, "is_procurable", True):
            continue
        cat = item.category or DEFAULT_CATEGORY
        groups.setdefault(cat, []).append(item)
    if not groups and not entry.items:
        # Entry had no items at all (vs. items that were all non-procurable,
        # which should produce no APP row).
        groups[DEFAULT_CATEGORY] = []
    return groups


def _general_description(entry) -> str:
    """
    Column 3 (General Description of the Project) -- combines the entry's
    own General Description and Type of Project (Goods / Infrastructure
    Projects / Consulting Services), both already stored on PPMPEntry, into
    "<General Description> - (<Type of Project>)".

    - Missing Type of Project: falls back to just the General Description.
    - Missing General Description: blank, regardless of Type of Project --
      there's nothing meaningful to show without it.
    """
    description = (entry.description or "").strip()
    project_type = (entry.project_type or "").strip()

    if not description:
        return ""
    if not project_type:
        return description
    return f"{description} - ({project_type})"


@router.get("/generate/from-ppmp/{ppmp_id}")
async def generate_app_from_ppmp(ppmp_id: str):
    ppmp = await PPMP.get(ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")

    # ppmp.office_id refers to a FeeCategoryOffice document (that's what
    # CreatePPMPPage.tsx's OfficeCategoryPicker/create_ppmp validate
    # against) -- NOT the separate/unrelated `Office` collection. Querying
    # the wrong one silently returned None, which is why Column 2 was
    # always blank.
    office = None
    try:
        office = await FeeCategoryOffice.get(PydanticObjectId(ppmp.office_id))
    except Exception:
        office = None

    # Left-join: every entry that already has an Early Procurement Activity
    # / Procurement Strategy answer saved against it.
    details = {
        d.entry_id: d
        for d in await AppEntryDetail.find(
            AppEntryDetail.ppmp_id == ppmp_id
        ).to_list()
    }

    # AppMeta holds the APP's own version state and signature block --
    # separate from the PPMP's. Not every PPMP has one yet (created before
    # this feature, or never edited via EditAppMetaPage), so fall back to
    # sensible defaults rather than erroring.
    meta = await AppMeta.find_one(AppMeta.ppmp_id == ppmp_id)

    # Build APP signatories:
    # Check if existing signatories are complete (should have at least Prepared By
    # plus admin-configured signatories). If incomplete, rebuild from PPMP + Admin.
    existing_signatories = [s.model_dump() for s in meta.signatories] if meta and meta.signatories else []
    has_prepared_by = any(s.get("sign_off", "").lower() == "prepared by" for s in existing_signatories)
    
    # Rebuild if: no signatories, or missing Prepared By, or less than 2 signatories
    if existing_signatories and has_prepared_by and len(existing_signatories) >= 2:
        app_signatories = existing_signatories
    else:
        # Get Prepared By from PPMP's signatories
        ppmp_signatories = getattr(ppmp, "signatories", []) or []
        prepared_by = None
        for sig in ppmp_signatories:
            if getattr(sig, "sign_off", "").lower() == "prepared by":
                prepared_by = {
                    "sign_off": "Prepared By",
                    "name": getattr(sig, "name", ""),
                    "position": getattr(sig, "position", "Fund Coordinator"),
                    "order_no": 1,
                }
                break
        
        # Get admin-configured APP signatories (excluding Prepared By)
        settings = await get_signatory_settings()
        admin_app_signatories = []
        order_no = 2  # Start after Prepared By
        for sig in settings.app_signatories:
            if not sig.enabled:
                continue
            if sig.sign_off.lower() == "prepared by":
                continue
            admin_app_signatories.append({
                "sign_off": sig.sign_off,
                "name": sig.name,
                "position": sig.position,
                "order_no": order_no,
            })
            order_no += 1
        
        # Combine: Prepared By from PPMP + Admin APP signatories
        app_signatories = []
        if prepared_by:
            app_signatories.append(prepared_by)
        app_signatories.extend(admin_app_signatories)

    rows = []
    grand_total = 0

    for project in ppmp.projects:
        entries = project.entries if project.entries else []

        for entry in entries:
            entry_id = getattr(entry, "id", None) or ""
            # Early Procurement Activity / Procurement Strategy are answers
            # about the ENTRY, not about any one category split of it -- so
            # every row produced from this entry shares the same detail.
            detail = details.get(entry_id) if entry_id else None

            for category, items in _items_by_category(entry).items():
                category_budget = round(
                    sum((it.total_cost or 0) for it in items), 2
                )
                grand_total += category_budget

                rows.append(
                    {
                        "entry_id": entry_id,
                        # Distinguishes this category-split row for the
                        # frontend's React key -- entry_id alone would
                        # collide when one entry produces multiple rows.
                        "row_key": f"{entry_id}:{category}",
                        "category": category,
                        "project_title": entry.project_title or "",
                        "end_user": office.name if office else "",
                        "general_description": _general_description(entry),
                        "procurement_mode": entry.procurement_mode or "",
                        "early_procurement": detail.early_procurement
                        if detail
                        else "",
                        "bid_evaluation": "LCRB"
                        if entry.procurement_mode == "Competitive Public Bidding"
                        else "N/A",
                        "start_activity": entry.start_activity or "",
                        "end_activity": entry.end_activity or "",
                        "source_of_funds": entry.source_of_funds or "",
                        "estimated_budget": category_budget,
                        "procurement_strategy": detail.procurement_strategy
                        if detail
                        else [],
                        "remarks": project.remarks or "",
                    }
                )

    return {
        "ppmp_id": str(ppmp.id),
        "ppmp_no": ppmp.ppmp_no,
        "year": ppmp.year,
        "office_name": office.name if office else "",
        # Legacy PPMP-level fields -- kept for back-compat with anything
        # still reading them, but APPPage.tsx should prefer meta.signatories
        # below once AppMeta exists for this PPMP.
        "prepared_by": ppmp.prepared_by,
        "submitted_by": ppmp.submitted_by,
        # APP-specific settings from AppMeta, defaulted when none exists yet.
        "version_type": meta.version_type if meta else "indicative",
        "version_no": meta.version_no if meta else None,
        "signatories": app_signatories,
        "total_rows": len(rows),
        "grand_total": grand_total,
        "rows": rows,
    }


@router.patch("/entry-details/{ppmp_id}/{entry_id}")
async def upsert_entry_detail(
    ppmp_id: str, entry_id: str, patch: AppEntryDetailPatch
):
    ppmp = await PPMP.get(ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")

    if patch.procurement_strategy is not None:
        from app.models.app_entry_detail import PROCUREMENT_STRATEGIES

        unknown = set(patch.procurement_strategy) - set(PROCUREMENT_STRATEGIES)
        if unknown:
            raise HTTPException(
                status_code=422,
                detail=f"Unknown procurement strategy value(s): {sorted(unknown)}",
            )

    existing = await AppEntryDetail.find_one(
        AppEntryDetail.ppmp_id == ppmp_id,
        AppEntryDetail.entry_id == entry_id,
    )
    if existing:
        if patch.early_procurement is not None:
            existing.early_procurement = patch.early_procurement
        if patch.procurement_strategy is not None:
            existing.procurement_strategy = patch.procurement_strategy
        await existing.save()
        return existing

    new_detail = AppEntryDetail(
        ppmp_id=ppmp_id,
        entry_id=entry_id,
        early_procurement=patch.early_procurement,
        procurement_strategy=patch.procurement_strategy or [],
    )
    await new_detail.insert()
    return new_detail


# -- AppMeta -- version state + APP-specific signatories --------------------
# Edited only via EditAppMetaPage.tsx. APPPage.tsx reads this merged into
# the /generate/from-ppmp/{ppmp_id} response above; these two endpoints are
# for the edit page itself.

class AppMetaPayload(BaseModel):
    version_type: str = "indicative"
    version_no: Optional[str] = None
    signatories: list[AppSignatory] = []


@router.get("/meta/{ppmp_id}")
async def get_app_meta(ppmp_id: str):
    ppmp = await PPMP.get(ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")

    meta = await AppMeta.find_one(AppMeta.ppmp_id == ppmp_id)
    if meta:
        return meta
    # No AppMeta saved yet for this PPMP -- return sensible defaults rather
    # than 404ing, so the edit page can render an empty form to fill in.
    return {
        "ppmp_id": ppmp_id,
        "version_type": "indicative",
        "version_no": None,
        "signatories": [],
    }


@router.put("/meta/{ppmp_id}")
async def upsert_app_meta(ppmp_id: str, payload: AppMetaPayload):
    ppmp = await PPMP.get(ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")

    if payload.version_type not in ("indicative", "final", "updated"):
        raise HTTPException(
            status_code=422,
            detail="version_type must be 'indicative', 'final', or 'updated'.",
        )

    existing = await AppMeta.find_one(AppMeta.ppmp_id == ppmp_id)
    if existing:
        existing.version_type = payload.version_type
        existing.version_no = payload.version_no
        existing.signatories = payload.signatories
        await existing.save()
        return existing

    new_meta = AppMeta(
        ppmp_id=ppmp_id,
        version_type=payload.version_type,
        version_no=payload.version_no,
        signatories=payload.signatories,
    )
    await new_meta.insert()
    return new_meta