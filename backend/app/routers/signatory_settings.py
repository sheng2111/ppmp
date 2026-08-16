from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.signatory_settings import SignatorySettings, PPMPBudgetSignatory, APPSignatoryConfig
from app.models.user import User
from app.services.signatory import get_signatory_settings, resolve_ppmp_signatories, resolve_app_signatories


router = APIRouter(prefix="/settings/signatories", tags=["signatory-settings"])


class SignatorySettingsOut(BaseModel):
    campus_director_name: str
    campus_director_designation: str
    suc_president_name: str
    suc_president_designation: str
    bac_secretariat_chairman_name: str
    bac_secretariat_chairman_designation: str
    budget_officer_name: str
    budget_officer_designation: str
    updated_at: datetime


class SignatorySettingsUpdate(BaseModel):
    campus_director_name: str
    campus_director_designation: str
    suc_president_name: str
    suc_president_designation: str
    bac_secretariat_chairman_name: str
    bac_secretariat_chairman_designation: str
    budget_officer_name: str
    budget_officer_designation: str


class PPMPSignatoriesOut(BaseModel):
    low_budget: List[dict]
    high_budget: List[dict]


class PPMPSignatoriesUpdate(BaseModel):
    low_budget: List[PPMPBudgetSignatory]
    high_budget: List[PPMPBudgetSignatory]


class APPSignatoriesOut(BaseModel):
    signatories: List[dict]


class APPSignatoriesUpdate(BaseModel):
    signatories: List[APPSignatoryConfig]


def _to_out(settings: SignatorySettings) -> SignatorySettingsOut:
    return SignatorySettingsOut(
        campus_director_name=settings.campus_director_name,
        campus_director_designation=settings.campus_director_designation,
        suc_president_name=settings.suc_president_name,
        suc_president_designation=settings.suc_president_designation,
        bac_secretariat_chairman_name=settings.bac_secretariat_chairman_name,
        bac_secretariat_chairman_designation=settings.bac_secretariat_chairman_designation,
        budget_officer_name=settings.budget_officer_name,
        budget_officer_designation=settings.budget_officer_designation,
        updated_at=settings.updated_at,
    )


async def _require_admin(user_id: Optional[str]) -> User:
    """Confirms the acting user exists and has the admin role before
    allowing a signatory change. Matches the same check Layout.tsx uses
    on the frontend (`dbUser?.role === "admin"`) — both sides read a
    `role` field on the user record, not a boolean flag.
    """
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated.")

    user = await User.get(user_id)
    if not user or getattr(user, "role", None) != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only an admin can view or change signatory settings.",
        )
    return user


@router.get("/", response_model=SignatorySettingsOut)
async def get_signatories():
    """Read-only, available to any signed-in user — the Create/Edit PR
    pages call this to preview the CURRENT signatory names live, so what
    the person sees while filling out a PR always matches what the
    backend will actually persist on save (see app/services/signatory.py).
    """
    settings = await get_signatory_settings()
    return _to_out(settings)


@router.put("/", response_model=SignatorySettingsOut)
async def update_signatories(
    payload: SignatorySettingsUpdate, updated_by: Optional[str] = None
):
    """Admin-only. Updates the Campus Director / SUC President /
    BAC Secretariat Chairman / Budget Officer names used by every PR
    going forward — e.g. when any of them retires and is replaced.

    This never touches existing PRs: resolve_signatories persists all of
    these onto each PurchaseRequest document at the moment it's created
    or edited (see app/routers/pr.py), so a name change here only affects
    PRs saved AFTER the change — history isn't silently rewritten.
    """
    await _require_admin(updated_by)

    for field in (
        "campus_director_name",
        "campus_director_designation",
        "suc_president_name",
        "suc_president_designation",
        "bac_secretariat_chairman_name",
        "bac_secretariat_chairman_designation",
        "budget_officer_name",
        "budget_officer_designation",
    ):
        if not getattr(payload, field).strip():
            raise HTTPException(status_code=400, detail=f"{field.replace('_', ' ')} cannot be blank.")

    settings = await get_signatory_settings()
    settings.campus_director_name = payload.campus_director_name.strip()
    settings.campus_director_designation = payload.campus_director_designation.strip()
    settings.suc_president_name = payload.suc_president_name.strip()
    settings.suc_president_designation = payload.suc_president_designation.strip()
    settings.bac_secretariat_chairman_name = payload.bac_secretariat_chairman_name.strip()
    settings.bac_secretariat_chairman_designation = payload.bac_secretariat_chairman_designation.strip()
    settings.budget_officer_name = payload.budget_officer_name.strip()
    settings.budget_officer_designation = payload.budget_officer_designation.strip()
    settings.updated_by = updated_by
    settings.updated_at = datetime.utcnow()
    await settings.save()

    return _to_out(settings)


# ── PPMP Signatories ──────────────────────────────────────────────────────

@router.get("/ppmp", response_model=PPMPSignatoriesOut)
async def get_ppmp_signatories():
    """Read-only endpoint to get PPMP signatory configurations for both
    budget thresholds. Available to any signed-in user for preview.

    IMPORTANT: Any "Prepared By" records (which are user-controlled, not
    admin-configured) are filtered out to prevent duplicates when the
    frontend adds the user's Prepared By signatory.
    """
    settings = await get_signatory_settings()
    # Filter out any "Prepared By" records from admin signatories
    # to prevent duplicates when frontend adds user-controlled Prepared By
    low_budget_filtered = [
        s.model_dump() for s in settings.ppmp_low_budget_signatories
        if s.sign_off.lower() != "prepared by"
    ]
    high_budget_filtered = [
        s.model_dump() for s in settings.ppmp_high_budget_signatories
        if s.sign_off.lower() != "prepared by"
    ]
    return PPMPSignatoriesOut(
        low_budget=low_budget_filtered,
        high_budget=high_budget_filtered,
    )


@router.put("/ppmp", response_model=PPMPSignatoriesOut)
async def update_ppmp_signatories(
    payload: PPMPSignatoriesUpdate, updated_by: Optional[str] = None
):
    """Admin-only. Updates the PPMP signatory configurations for both
    budget thresholds (<=₱100,000 and >=₱100,001).

    Note: 'Prepared by' signatory names are NOT configured here — they
    are dynamically populated from the current user. Only positions and
    order are configurable.
    """
    await _require_admin(updated_by)

    settings = await get_signatory_settings()
    settings.ppmp_low_budget_signatories = payload.low_budget
    settings.ppmp_high_budget_signatories = payload.high_budget
    settings.updated_by = updated_by
    settings.updated_at = datetime.utcnow()
    await settings.save()

    return PPMPSignatoriesOut(
        low_budget=[s.model_dump() for s in settings.ppmp_low_budget_signatories],
        high_budget=[s.model_dump() for s in settings.ppmp_high_budget_signatories],
    )


# ── APP Signatories ───────────────────────────────────────────────────────

@router.get("/app", response_model=APPSignatoriesOut)
async def get_app_signatories():
    """Read-only endpoint to get APP signatory configuration. Available
    to any signed-in user for preview.

    IMPORTANT: Any "Prepared By" records (which come from the source PPMP,
    not admin configuration) are filtered out to prevent duplicates.
    """
    settings = await get_signatory_settings()
    # Filter out any "Prepared By" records from admin APP signatories
    filtered_signatories = [
        s.model_dump() for s in settings.app_signatories
        if s.sign_off.lower() != "prepared by"
    ]
    return APPSignatoriesOut(
        signatories=filtered_signatories
    )


# ── Dynamic Resolution Endpoints ──────────────────────────────────────────

class PPMPResolveRequest(BaseModel):
    grand_total: float
    prepared_by_name: Optional[str] = None


class APPResolveRequest(BaseModel):
    prepared_by_name: Optional[str] = None


@router.post("/ppmp/resolve")
async def resolve_ppmp_signatories_endpoint(payload: PPMPResolveRequest):
    """Dynamically resolve PPMP signatories based on the total budget.
    Returns the appropriate signatory structure with names populated from
    admin settings (except 'Prepared by' which uses the provided name).
    """
    signatories = await resolve_ppmp_signatories(
        grand_total=payload.grand_total,
        prepared_by_name=payload.prepared_by_name,
    )
    return {"signatories": signatories}


@router.post("/app/resolve")
async def resolve_app_signatories_endpoint(payload: APPResolveRequest):
    """Dynamically resolve APP signatories from admin settings.
    Returns the signatory list with names populated from admin settings
    (except 'Prepared by' which uses the provided name).
    """
    signatories = await resolve_app_signatories(
        prepared_by_name=payload.prepared_by_name,
    )
    return {"signatories": signatories}


@router.put("/app", response_model=APPSignatoriesOut)
async def update_app_signatories(
    payload: APPSignatoriesUpdate, updated_by: Optional[str] = None
):
    """Admin-only. Updates the APP signatory configuration.

    Note: 'Prepared by' signatory names are NOT configured here — they
    are dynamically populated from the current user. Only positions,
    order, and enabled state are configurable.
    """
    await _require_admin(updated_by)

    settings = await get_signatory_settings()
    settings.app_signatories = payload.signatories
    settings.updated_by = updated_by
    settings.updated_at = datetime.utcnow()
    await settings.save()

    return APPSignatoriesOut(
        signatories=[s.model_dump() for s in settings.app_signatories]
    )