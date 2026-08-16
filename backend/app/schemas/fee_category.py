from pydantic import BaseModel
from typing import Optional


class FeeCategoryCreate(BaseModel):
    name: str
    position: Optional[int] = None


class FeeCategoryUpdate(BaseModel):
    name: str


class FeeCategoryOfficeCreate(BaseModel):
    name: str
    parent_office_id: Optional[str] = None


class FeeCategoryOfficeUpdate(BaseModel):
    name: Optional[str] = None
    parent_office_id: Optional[str] = None