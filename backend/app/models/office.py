from beanie import Document, PydanticObjectId
from pydantic import Field
from typing import Optional
from datetime import datetime


class Office(Document):
    name: str
    head_name: Optional[str] = None
    designation: Optional[str] = None
    fund_source: Optional[str] = None  # "STF" or "Other School Fees"
    parent_office_id: Optional[PydanticObjectId] = None  # set only for sub-offices
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "offices"