from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class OfficeInfo(BaseModel):
    id: str
    name: str
    code: str


class OfficeAssignment(BaseModel):
    office_id: str
    office_name: str = ""
    office_code: str = ""
    designation: Optional[str] = None


class User(Document):
    supabase_uid: str
    full_name: str
    email: str
    role: str = "user"
    designation: Optional[str] = None
    # Accounts are active as soon as setup (name + password) is complete —
    # no admin review step anymore.
    is_approved: bool = True
    # Legacy fields — no longer populated during onboarding. Left in place
    # so old documents (created under the previous approval-based flow)
    # still deserialize cleanly. Safe to remove entirely once you've
    # confirmed no user document still relies on them.
    offices: List[OfficeInfo] = []
    office_ids: List[str] = []
    office_assignments: List[OfficeAssignment] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "users"
        indexes = [
            "supabase_uid",
            "email",
        ]