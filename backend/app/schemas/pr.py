from pydantic import BaseModel, BeforeValidator
from typing import Annotated, Optional, List
from datetime import datetime
from bson import ObjectId


def _convert_id(v):
    if isinstance(v, ObjectId):
        return str(v)
    return v


class PRItemCreate(BaseModel):
    lot_label: Optional[str] = None
    stock_property_no: Optional[str] = None
    unit: Optional[str] = None
    item_description: str
    quantity: float = 0
    unit_price: float = 0


class PRCreate(BaseModel):
    pr_number: Optional[str] = None
    fund_cluster: Optional[str] = None
    responsibility_center_code: Optional[str] = None
    purpose: Optional[str] = None
    requested_date: Optional[str] = None
    requested_by_name: Optional[str] = None
    requested_by_designation: Optional[str] = None
    approved_by_name: Optional[str] = None
    approved_by_designation: Optional[str] = None
    items: List[PRItemCreate] = []


class PRItemOut(BaseModel):
    lot_label: Optional[str] = None
    stock_property_no: Optional[str] = None
    unit: Optional[str] = None
    item_description: str
    quantity: float
    unit_price: float
    total_cost: float

    model_config = {"from_attributes": True}


class PROut(BaseModel):
    id: Annotated[str, BeforeValidator(_convert_id)]
    office_id: str
    created_by: str
    pr_number: Optional[str] = None
    fund_cluster: Optional[str] = None
    responsibility_center_code: Optional[str] = None
    purpose: Optional[str] = None
    requested_date: Optional[str] = None
    requested_by_name: Optional[str] = None
    requested_by_designation: Optional[str] = None
    approved_by_name: Optional[str] = None
    approved_by_designation: Optional[str] = None
    status: str
    created_at: datetime
    items: List[PRItemOut] = []

    model_config = {"from_attributes": True}
