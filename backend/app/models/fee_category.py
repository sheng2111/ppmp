from beanie import Document
from pydantic import Field
from datetime import datetime


class FeeCategory(Document):
    name: str
    display_order: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "fee_categories"