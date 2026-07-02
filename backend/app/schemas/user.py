from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class OfficeBasic(BaseModel):
    id: int
    name: str
    code: str

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    supabase_uid: str
    full_name: str
    email: str
    role: str = "user"
    designation: Optional[str] = None


class UserOut(BaseModel):
    id: int
    supabase_uid: str
    full_name: str
    email: str
    role: str
    designation: Optional[str]
    is_approved: bool
    offices: List[OfficeBasic] = []
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    designation: Optional[str] = None
    role: Optional[str] = None
    is_approved: Optional[bool] = None
    office_ids: Optional[List[int]] = None