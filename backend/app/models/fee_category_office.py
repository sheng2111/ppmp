from beanie import Document, PydanticObjectId
from pydantic import Field
from typing import Optional
from datetime import datetime


class FeeCategoryOffice(Document):
    fee_category_id: PydanticObjectId
    name: str
    display_order: int = 0
    # Set only for sub-offices (one level of nesting, enforced in the router).
    parent_office_id: Optional[PydanticObjectId] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "fee_category_offices"