from pydantic import BaseModel, BeforeValidator
from typing import Annotated, Optional, List
from datetime import datetime
from bson import ObjectId


def _convert_id(v):
    if isinstance(v, ObjectId):
        return str(v)
    return v


class OfficeBasic(BaseModel):
    id: Annotated[str, BeforeValidator(_convert_id)]
    name: str
    code: str

    model_config = {"from_attributes": True}


class OfficeAssignmentOut(BaseModel):
    office_id: str
    office_name: str
    office_code: str
    designation: Optional[str] = None

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    supabase_uid: str
    full_name: str
    email: str
    role: str = "user"
    designation: Optional[str] = None


class UserOut(BaseModel):
    id: Annotated[str, BeforeValidator(_convert_id)]
    supabase_uid: str
    full_name: str
    email: str
    role: str
    designation: Optional[str] = None
    is_approved: bool
    # Kept for backward compatibility with any existing documents that still
    # carry office assignments from the old onboarding flow. New accounts
    # will always have these as empty lists — office selection now happens
    # per-PPMP at creation time instead.
    offices: List[OfficeBasic] = []
    office_ids: List[str] = []
    office_assignments: List[OfficeAssignmentOut] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    designation: Optional[str] = None
    role: Optional[str] = None
    is_approved: Optional[bool] = None
    office_ids: Optional[List[str]] = None


class OnboardRequest(BaseModel):
    """
    Called right after Google sign-in to finish setting up the account.
    Office assignment no longer happens here — users pick the office
    when they create a PPMP instead.
    """
    supabase_uid: str
    email: str
    full_name: str