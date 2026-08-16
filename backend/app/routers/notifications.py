from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.models.notification import AdminNotification
from app.routers.auth import require_admin

router = APIRouter(prefix="/notifications", tags=["notifications"])


class AdminNotificationOut(BaseModel):
    id: str
    type: str
    title: str
    message: str
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
    read: bool
    created_at: datetime


def _serialize(n: AdminNotification) -> AdminNotificationOut:
    return AdminNotificationOut(
        id=str(n.id),
        type=n.type,
        title=n.title,
        message=n.message,
        ppmp_id=n.ppmp_id,
        office_id=n.office_id,
        office_name=n.office_name,
        ppmp_no=n.ppmp_no,
        year=n.year,
        ppmp_type=n.ppmp_type,
        prepared_by=n.prepared_by,
        submitted_by=n.submitted_by,
        submitted_at=n.submitted_at,
        status=n.status,
        read=n.read,
        created_at=n.created_at,
    )


@router.get("/", response_model=List[AdminNotificationOut])
async def list_notifications(
    requester_uid: str,
    limit: int = 50,
    unread_only: bool = False,
):
    """Admin-only. Newest-first list of persistent notifications."""
    await require_admin(requester_uid)

    query = {}
    if unread_only:
        query["read"] = False

    notifications = (
        await AdminNotification.find(query)
        .sort("-created_at")
        .limit(max(1, min(limit, 200)))
        .to_list()
    )
    return [_serialize(n) for n in notifications]


@router.get("/unread-count")
async def unread_count(requester_uid: str):
    """Admin-only. Number of unread notifications (bell badge)."""
    await require_admin(requester_uid)
    count = await AdminNotification.find({"read": False}).count()
    return {"count": count}


@router.put("/read-all")
async def read_all(requester_uid: str):
    """Admin-only. Mark every notification as read."""
    await require_admin(requester_uid)
    await AdminNotification.find({"read": False}).update(
        {"$set": {"read": True}}
    )
    return {"ok": True}


@router.put("/{notification_id}/read", response_model=AdminNotificationOut)
async def mark_read(notification_id: str, requester_uid: str):
    """Admin-only. Mark a single notification as read."""
    await require_admin(requester_uid)

    notification = await AdminNotification.get(notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    if not notification.read:
        await notification.update({"$set": {"read": True}})
        notification = await AdminNotification.get(notification_id)

    return _serialize(notification)
