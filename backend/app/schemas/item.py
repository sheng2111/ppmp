from pydantic import BaseModel
from typing import Optional
from datetime import datetime

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
    id: int
    name: str
    unit: str
    unit_price: float
    category: Optional[str]
    is_active: bool
    updated_at: datetime

    class Config:
        from_attributes = True