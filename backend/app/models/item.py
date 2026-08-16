from beanie import Document
from pydantic import Field
from typing import Optional
from datetime import datetime


class Item(Document):
    name: str
    unit: str
    unit_price: float = 0
    category: Optional[str] = None
    is_active: bool = True
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "items"
