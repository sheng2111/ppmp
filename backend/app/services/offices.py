from typing import Optional

from beanie import PydanticObjectId

from app.models.fee_category_office import FeeCategoryOffice


async def get_office_display_name(office_id: Optional[str]) -> Optional[str]:
    """Resolve an office id into a display name, e.g. 'CITE / BSCS' for a
    child office, or just 'CITE' for a top-level one.

    Mirrors the same "ParentName / ChildName" format the frontend's
    OfficeSearchPicker already uses, so the report header, Excel export,
    and PDF export all agree with what admins see in the filter dropdown.

    Returns the raw office_id string (instead of raising) if the id is
    malformed or no longer exists, so a stale/deleted office_id on an old
    PPMP doesn't crash the whole report.
    """
    if not office_id:
        return None

    try:
        oid = PydanticObjectId(office_id)
    except Exception:
        return office_id

    office = await FeeCategoryOffice.get(oid)
    if not office:
        return office_id

    if office.parent_office_id:
        parent = await FeeCategoryOffice.get(office.parent_office_id)
        if parent:
            return f"{parent.name} / {office.name}"

    return office.name