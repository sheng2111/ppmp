from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import datetime


class AdminNotification(Document):
    # Which event produced this notification. Currently only
    # "ppmp_submitted" is emitted (a Prepared By user actually submitting
    # a PPMP). The type stays on the record so future notification types
    # can be added without restructuring.
    type: str
    title: str
    message: str
    # Snapshot of the source PPMP at submission time. Stored denormalized
    # so the notification stays accurate even if the PPMP is later edited.
    ppmp_id: str
    office_id: Optional[str] = None
    office_name: Optional[str] = None
    ppmp_no: Optional[str] = None
    year: Optional[int] = None
    ppmp_type: Optional[str] = None
    prepared_by: Optional[str] = None
    submitted_by: Optional[str] = None
    submitted_at: Optional[datetime] = None
    status: Optional[str] = None
    read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "admin_notifications"
        indexes = [
            "read",
            "created_at",
            "ppmp_id",
        ]
