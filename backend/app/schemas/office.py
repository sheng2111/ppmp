from pydantic import BaseModel, BeforeValidator
from typing import Annotated, Optional
from datetime import datetime
from bson import ObjectId


def _convert_id(v):
    if isinstance(v, ObjectId):
        return str(v)
    return v


class OfficeCreate(BaseModel):
    name: str
    head_name: Optional[str] = None
    designation: Optional[str] = None
    fund_source: Optional[str] = None
    parent_office_id: Optional[str] = None


class OfficeUpdate(BaseModel):
    name: Optional[str] = None
    head_name: Optional[str] = None
    designation: Optional[str] = None
    fund_source: Optional[str] = None
    parent_office_id: Optional[str] = None


class OfficeOut(BaseModel):
    id: Annotated[str, BeforeValidator(_convert_id)]
    name: str
    fee_category_id: Annotated[Optional[str], BeforeValidator(_convert_id)] = None
    head_name: Optional[str] = None
    designation: Optional[str] = None
    fund_source: Optional[str] = None
    parent_office_id: Annotated[Optional[str], BeforeValidator(_convert_id)] = None
    created_at: datetime

    model_config = {"from_attributes": True}