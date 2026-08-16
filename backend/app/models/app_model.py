from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class APPItem(BaseModel):
    ppmp_project_id: Optional[str] = None
    lot_id: Optional[str] = None
    office_id: Optional[str] = None
    estimated_budget: float = 0
    project_title: Optional[str] = None
    end_user: Optional[str] = None
    general_description: Optional[str] = None
    procurement_mode: Optional[str] = None
    early_procurement: str = "No"
    bid_evaluation: str = "N/A"
    start_activity: Optional[str] = None
    end_activity: Optional[str] = None
    source_of_funds: str = "GoP"
    procurement_strategy: Optional[str] = None
    remarks: Optional[str] = None


class APP(Document):
    year: int
    status: str = "draft"
    generated_by: Optional[str] = None
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    approved_at: Optional[datetime] = None
    items: List[APPItem] = []

    class Settings:
        name = "apps"
        indexes = [
            "year",
        ]
