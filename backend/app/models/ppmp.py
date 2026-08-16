from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import uuid4


class PPMPEntryItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))  # stable id so a PR can reference this exact item
    item_name: str
    quantity: float = 0
    unit: str
    unit_price: float = 0
    total_cost: float = 0
    q1_qty: float = 0
    q2_qty: float = 0
    q3_qty: float = 0
    q4_qty: float = 0
    # ADDED — the item's Category as selected in Create/EditPPMPPage
    # (General Requirements / Miscellaneous Items / Common Use Supplies and
    # Equipment (CSE)). Previously collected on the frontend but never
    # persisted anywhere; needed so the generated APP can band rows under
    # the official category headers.
    category: Optional[str] = None
    # ADDED — client requirement: an item can be "non-procurable" (e.g. an
    # item already covered elsewhere, or informational-only). Non-procurable
    # items must still show up in the PPMP itself and in a PR, but must be
    # excluded from the generated APP. Defaults to True so every existing
    # item in the database (which predates this field) is read as
    # procurable with no backfill needed.
    is_procurable: bool = True


class PPMPEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))  # stable id so a PR can reference this exact entry/"Project"
    order_no: int = 1
    category_id: Optional[str] = None
    category_description: Optional[str] = None
    # ADDED — feeds Column 1 (Project Title) when the APP is generated.
    project_title: Optional[str] = None
    description: str
    project_type: str = "Goods"
    procurement_mode: Optional[str] = None
    pre_proc_conference: str = "No"
    start_activity: Optional[str] = None
    end_activity: Optional[str] = None
    delivery_period: Optional[str] = None
    source_of_funds: str = "GoP"
    quantity_size: Optional[str] = None
    estimated_budget: float = 0
    items: List[PPMPEntryItem] = []


class PPMPProject(BaseModel):
    order_no: int = 1
    remarks: Optional[str] = None
    # ADDED — title of the supporting document for this project (e.g.
    # "Purchase Request", "BAC Resolution", "Canvass", "Letter Request").
    # This is a title only — the actual uploaded file (if any) still goes
    # through supporting_docs below.
    attached_document_title: Optional[str] = None
    supporting_docs: Optional[str] = None
    total_budget: float = 0
    entries: List[PPMPEntry] = []

class Signatory(BaseModel):
    sign_off: str
    name: str
    position: str
    order_no: int
    
class PPMP(Document):
    office_id: str
    created_by: str
    year: int
    ppmp_no: Optional[str] = None
    ppmp_type: str = "indicative"
    status: str = "draft"
    remarks: Optional[str] = None
    allocated_budget: float = 0
    # Short/Additional description describe the whole PPMP (filled in once
    # on the frontend's Step 2), not any individual project.
    description: Optional[str] = None
    additional_description: Optional[str] = None
    signatories: list[Signatory] = []
    prepared_by: Optional[str] = None
    prepared_by_position: Optional[str] = None
    submitted_by: Optional[str] = None
    submitted_by_position: Optional[str] = None
    submitted_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    projects: List[PPMPProject] = []
    # PPMP versioning: when a PPMP is edited and its ppmp_no changes, a new
    # PPMP record is created. This field links the new record back to the
    # original for audit/history purposes.
    parent_ppmp_id: Optional[str] = None

    class Settings:
        name = "ppmps"
        indexes = [
            "office_id",
            "created_by",
            "year",
            "status",
        ]