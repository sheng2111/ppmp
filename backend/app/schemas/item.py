from pydantic import BaseModel, BeforeValidator
from typing import Annotated, Optional
from datetime import datetime
from bson import ObjectId


def _convert_id(v):
    if isinstance(v, ObjectId):
        return str(v)
    return v


class ItemCreate(BaseModel):
    name: str
    unit: str
    unit_price: float
    category: Optional[str] = None


class ItemUpdate(BaseModel):
    name: Optional[str] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None


class ItemOut(BaseModel):
    id: Annotated[str, BeforeValidator(_convert_id)]
    name: str
    unit: str
    unit_price: float
    category: Optional[str] = None
    is_active: bool
    updated_at: datetime

    model_config = {"from_attributes": True}
