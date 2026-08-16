from typing import Optional

from app.models.notification import AdminNotification
from app.models.ppmp import PPMP
from app.services.offices import get_office_display_name


def _prepared_by_name(ppmp: PPMP) -> Optional[str]:
    """The PPMP's "Prepared By" is captured as a dynamic signatory
    (sign_off == "Prepared By"); the prepared_by field on the model is a
    fallback for records that predate the signatory list.
    """
    for sig in (ppmp.signatories or []):
        if (sig.sign_off or "").strip().lower() == "prepared by":
            return sig.name or None
    return ppmp.prepared_by or None


async def create_ppmp_submitted_notification(ppmp: PPMP) -> AdminNotification:
    """Create a single persistent notification for a PPMP that was just
    actually submitted (transitioned to status == "submitted").

    Called only from the PPMP create/update routes on a real submission
    event, so a draft save / plain edit never produces one. The record is
    denormalized (office name, prepared by, submitted by, timestamp) so it
    survives later edits to the PPMP itself.
    """
    office_name = await get_office_display_name(ppmp.office_id)

    title = f"New PPMP Submitted"
    message = (
        f"PPMP No. {ppmp.ppmp_no or ''} for {office_name or 'Unknown Office'} "
        f"FY {ppmp.year} has been submitted."
    )

    notification = AdminNotification(
        type="ppmp_submitted",
        title=title,
        message=message,
        ppmp_id=str(ppmp.id),
        office_id=ppmp.office_id,
        office_name=office_name,
        ppmp_no=ppmp.ppmp_no,
        year=ppmp.year,
        ppmp_type=ppmp.ppmp_type,
        prepared_by=_prepared_by_name(ppmp),
        submitted_by=ppmp.submitted_by,
        submitted_at=ppmp.submitted_at,
        status=ppmp.status,
        read=False,
    )
    await notification.insert()
    return notification
