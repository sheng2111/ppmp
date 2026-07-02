from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class OfficeCreate(BaseModel):
    name: str
    code: str
    head_name: Optional[str] = None
    designation: Optional[str] = None

class OfficeUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    head_name: Optional[str] = None
    designation: Optional[str] = None

class OfficeOut(BaseModel):
    id: int
    name: str
    code: str
    head_name: Optional[str]
    designation: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True