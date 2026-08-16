

from typing import Optional, TypedDict, List
from app.models.signatory_settings import SignatorySettings, PPMPBudgetSignatory, APPSignatoryConfig

# ₱50,000.00 — the cutover point itself belongs to Rule 2 ("Grand Total is
# ₱50,000.00 OR GREATER"), so the comparison below is a plain `>=`. This
# threshold is a fixed business rule, not admin-editable — only the NAMES
# that fill each role are. It applies ONLY to Requested By/Approved By —
# BAC Secretariat Chairman and Budget Officer never branch on it.
SIGNATORY_THRESHOLD = 50000.00

# ₱100,000.00 — PPMP budget threshold for signatory structure selection
PPMP_BUDGET_THRESHOLD = 100000.00

DEFAULT_END_USER_DESIGNATION = "End User"


class Signatories(TypedDict):
    requested_by_name: str
    requested_by_designation: str
    approved_by_name: str
    approved_by_designation: str
    bac_secretariat_chairman_name: str
    bac_secretariat_chairman_designation: str
    budget_officer_name: str
    budget_officer_designation: str


async def get_signatory_settings() -> SignatorySettings:
    """Fetches the single signatory-settings document, creating it with
    today's names as defaults on first-ever use (so there's no separate
    migration step required before this feature works). This is the ONLY
    place these names are read from — nothing in this module hardcodes
    them — so an admin's update via PUT /settings/signatories takes
    effect on the very next PR, with no deploy.
    """
    settings = await SignatorySettings.find_one(SignatorySettings.key == "current")
    if not settings:
        settings = SignatorySettings(key="current")
        await settings.insert()
    return settings


async def resolve_signatories(
    grand_total: float,
    end_user_name: Optional[str],
    end_user_designation: Optional[str] = None,
) -> Signatories:
  
    settings = await get_signatory_settings()

    fixed = {
        "bac_secretariat_chairman_name": settings.bac_secretariat_chairman_name,
        "bac_secretariat_chairman_designation": settings.bac_secretariat_chairman_designation,
        "budget_officer_name": settings.budget_officer_name,
        "budget_officer_designation": settings.budget_officer_designation,
    }

    if grand_total < SIGNATORY_THRESHOLD:
        return {
            "requested_by_name": end_user_name or DEFAULT_END_USER_DESIGNATION,
            "requested_by_designation": end_user_designation or DEFAULT_END_USER_DESIGNATION,
            "approved_by_name": settings.campus_director_name,
            "approved_by_designation": settings.campus_director_designation,
            **fixed,
        }

    return {
        "requested_by_name": settings.campus_director_name,
        "requested_by_designation": settings.campus_director_designation,
        "approved_by_name": settings.suc_president_name,
        "approved_by_designation": settings.suc_president_designation,
        **fixed,
    }


async def resolve_ppmp_signatories(
    grand_total: float,
    prepared_by_name: Optional[str] = None,
) -> List[dict]:
    """Resolve PPMP signatories based on the total budget.

    - Budget <= ₱100,000: 3 signatories (Prepared by, Checked & Reviewed by, Approved by)
    - Budget >= ₱100,001: 4 signatories (Prepared by, Checked & Reviewed by, Noted by, Approved by)

    The 'Prepared by' signatory is always prepended with order_no=1 and
    uses the current user's name (which remains editable by the user).
    Other signatory names come from admin settings.
    """
    settings = await get_signatory_settings()

    if grand_total <= PPMP_BUDGET_THRESHOLD:
        admin_signatories = settings.ppmp_low_budget_signatories
    else:
        admin_signatories = settings.ppmp_high_budget_signatories

    # Always prepend "Prepared by" as the first signatory with order_no=1
    result = [{
        "sign_off": "Prepared By",
        "name": prepared_by_name or "",
        "position": "Fund Coordinator",
        "order_no": 1,
    }]

    # Add admin-configured signatories, renumbering order_no starting from 2
    for idx, sig in enumerate(admin_signatories):
        result.append({
            "sign_off": sig.sign_off,
            "name": sig.name,
            "position": sig.position,
            "order_no": idx + 2,
        })

    return result


async def get_ppmp_signatory_previews() -> dict:
    """Return both low and high budget PPMP signatory structures for preview.

    IMPORTANT: Any "Prepared By" records (which are user-controlled, not
    admin-configured) are filtered out to prevent duplicates.
    """
    settings = await get_signatory_settings()
    return {
        "low_budget": [
            s.model_dump() for s in settings.ppmp_low_budget_signatories
            if s.sign_off.lower() != "prepared by"
        ],
        "high_budget": [
            s.model_dump() for s in settings.ppmp_high_budget_signatories
            if s.sign_off.lower() != "prepared by"
        ],
    }


async def resolve_app_signatories(
    prepared_by_name: Optional[str] = None,
) -> List[dict]:
    """Resolve APP signatories from admin-configured settings.

    IMPORTANT: "Prepared by" is NOT included here. It comes from the source
    PPMP's Prepared By signatory when generating the APP. This function
    only returns the admin-configured signatories (Checked & Reviewed by,
    Recommending Approval, Approved by).
    """
    settings = await get_signatory_settings()

    result = []
    order_no = 1
    for sig in settings.app_signatories:
        if not sig.enabled:
            continue
        # Skip "Prepared by" - it comes from the PPMP, not admin settings
        if sig.sign_off.lower() == "prepared by":
            continue
        result.append({
            "sign_off": sig.sign_off,
            "name": sig.name,
            "position": sig.position,
            "order_no": order_no,
        })
        order_no += 1

    return result


async def get_app_signatory_preview() -> List[dict]:
    """Return APP signatory configuration for preview.

    IMPORTANT: Any "Prepared By" records (which come from the source PPMP,
    not admin configuration) are filtered out to prevent duplicates.
    """
    settings = await get_signatory_settings()
    return [
        s.model_dump() for s in settings.app_signatories
        if s.sign_off.lower() != "prepared by"
    ]