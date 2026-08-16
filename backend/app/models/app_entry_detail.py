"""
SCAFFOLD — adapt to your actual project structure before using.

This is NOT wired into your real app; I don't have your actual FastAPI
routers or Beanie models for PPMP / APP generation, so I can't guarantee
field names, import paths, or auth dependency patterns match. Treat this
as a starting point to merge into your existing app.py / ppmps.py.

Purpose
-------
Stores the two APP-only fields that have no source in the PPMP:
  - Column 5:  Early Procurement Activity (Yes/No)
  - Column 11: Procurement Strategy or Tools (0+ of a fixed official list)

These are keyed per (ppmp_id, entry_id) — NOT stored on the PPMP document
itself — so the PPMP creation/edit flow stays untouched, and re-generating
the APP (indicative -> final, or regenerating after a PPMP edit) still
picks up whatever was already answered for that entry.

What you need to change to make this real
-------------------------------------------
1. Confirm each procurement entry actually has a STABLE id once saved to
   MongoDB (the frontend's client-side `makeId()` value is only used before
   save — check whether your PPMP save endpoint preserves that id as the
   subdocument's `id`/`_id`, or assigns its own). This router assumes
   entries have a stable `id` string. If your PPMP model doesn't currently
   give entries a persisted id, that's a prerequisite change before this
   works.
2. Point `from ..models.ppmp import PPMP` (below) at wherever your real
   PPMP Beanie document lives.
3. Merge `AppEntryDetail` into whatever file registers your Beanie
   document models with `init_beanie(...)`.
4. Merge the router into your existing app/APP router (probably
   `app.py` or `app_router.py`), reusing whatever auth dependency
   (`get_current_user`, etc.) your other routes use — I've stubbed a
   placeholder below.
5. In your `/app/generate/from-ppmp/{ppmp_id}` endpoint, after building
   each row from the PPMP, left-join AppEntryDetail by (ppmp_id, entry_id)
   and populate `early_procurement` / `procurement_strategy` on the row
   (default to "" / [] when no AppEntryDetail exists yet) — plus include
   `entry_id` on every row, which the frontend now depends on.
"""

from typing import List, Literal, Optional

from beanie import Document
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

# ── Official GPPB Procurement Strategy / Tools list — keep this in sync
# with PROCUREMENT_STRATEGIES in APPPage.tsx. Consider moving both to a
# single shared source of truth (e.g. a constants module imported by the
# frontend build, or an endpoint that serves the list) so they never drift.
PROCUREMENT_STRATEGIES = [
    "Life Cycle Assessment (LCA) and Life Cycle Cost Analysis (LCCA)",
    "Subcontracting",
    "Multi-Year Contracting",
    "Design-and-Build Scheme for Infrastructure Projects",
    "Engagement of a Procurement Agent",
    "Use of Framework Agreement",
    "Pooled Procurement",
    "Renewal of Regular and Recurring Services",
    "Warehousing and Inventory Activities",
]


# ── Beanie document ──────────────────────────────────────────────────────
class AppEntryDetail(Document):
    ppmp_id: str
    entry_id: str
    early_procurement: Optional[Literal["Yes", "No"]] = None
    procurement_strategy: List[str] = Field(default_factory=list)

    class Settings:
        name = "app_entry_details"
        # One record per (ppmp_id, entry_id) — upsert on that pair rather
        # than ever inserting duplicates.
        indexes = ["ppmp_id", "entry_id"]


# ── Request schema for the PATCH endpoint ───────────────────────────────
class AppEntryDetailPatch(BaseModel):
    early_procurement: Optional[Literal["Yes", "No"]] = None
    procurement_strategy: Optional[List[str]] = None


router = APIRouter(prefix="/app", tags=["app-entry-details"])


# Replace with your project's real auth dependency (e.g. get_current_user)
async def get_current_user_placeholder():
    raise NotImplementedError("Wire this to your real auth dependency")


@router.patch("/entry-details/{ppmp_id}/{entry_id}")
async def upsert_entry_detail(
    ppmp_id: str,
    entry_id: str,
    patch: AppEntryDetailPatch,
    # current_user=Depends(get_current_user_placeholder),
):
    """
    Upserts the Early Procurement Activity / Procurement Strategy answer
    for one procurement entry. Only the fields present in the patch body
    are updated — sending just `early_procurement` leaves any existing
    `procurement_strategy` value untouched, and vice versa.
    """
    if patch.procurement_strategy is not None:
        unknown = set(patch.procurement_strategy) - set(PROCUREMENT_STRATEGIES)
        if unknown:
            raise HTTPException(
                status_code=422,
                detail=f"Unknown procurement strategy value(s): {sorted(unknown)}",
            )

    # TODO: verify ppmp_id exists and current_user has permission to edit
    # it (mirror whatever check your existing PPMP edit endpoint does).

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
    else:
        new_detail = AppEntryDetail(
            ppmp_id=ppmp_id,
            entry_id=entry_id,
            early_procurement=patch.early_procurement,
            procurement_strategy=patch.procurement_strategy or [],
        )
        await new_detail.insert()
        return new_detail


# ── Helper for your real /app/generate/from-ppmp/{ppmp_id} endpoint ─────
async def fetch_entry_details_map(ppmp_id: str) -> dict:
    """
    Returns {entry_id: AppEntryDetail} for every entry that already has an
    answer saved for this PPMP. Use this inside your generation endpoint to
    left-join onto the rows you build from the PPMP itself, e.g.:

        details = await fetch_entry_details_map(ppmp_id)
        for entry in ppmp_entries:
            d = details.get(entry.id)
            row.entry_id = entry.id
            row.early_procurement = d.early_procurement if d else ""
            row.procurement_strategy = d.procurement_strategy if d else []
    """
    docs = await AppEntryDetail.find(AppEntryDetail.ppmp_id == ppmp_id).to_list()
    return {d.entry_id: d for d in docs}