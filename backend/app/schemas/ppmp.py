from pydantic import BaseModel, BeforeValidator
from typing import Annotated, Optional, List
from datetime import datetime
from bson import ObjectId


def _convert_id(v):
    if isinstance(v, ObjectId):
        return str(v)
    return v


# ── Signatories ───────────────────────────────────────────────────────────
#    Dynamic, ordered list of signature-block entries (e.g. "Prepared by:",
#    "Submitted by:", "Approved by:"). Rendered in order_no order on the
#    PPMP detail page / print view.

class SignatoryCreate(BaseModel):
    order_no: int = 1
    sign_off: str
    name: str
    position: str


class SignatoryOut(BaseModel):
    order_no: int
    sign_off: str
    name: str
    position: str

    model_config = {"from_attributes": True}


# ── Entry Items (formerly "Lot Items") ───────────────────────────────────────

class PPMPEntryItemCreate(BaseModel):
    # Optional: present when this item already exists on the server (an
    # edit), absent for a newly-added item during this session. Read by
    # _build_projects in ppmps.py to keep the same id across saves instead
    # of minting a fresh one every time — required for AppEntryDetail
    # (Early Procurement Activity / Procurement Strategy) to stay attached
    # to the right item/entry across edits.
    id: Optional[str] = None
    item_name: str
    quantity: float = 0
    unit: str
    unit_price: float = 0
    q1_qty: float = 0
    q2_qty: float = 0
    q3_qty: float = 0
    q4_qty: float = 0
    # ADDED — the item's Category as selected in Create/EditPPMPPage
    # (General Requirements / Miscellaneous Items / Common Use Supplies and
    # Equipment (CSE)). Mirrors PPMPEntryItem.category on the Beanie model;
    # without this field here, _build_projects's `item_data.category` read
    # raises AttributeError since this Create schema is what actually gets
    # constructed from the request body.
    category: Optional[str] = None
    # ADDED — mirrors PPMPEntryItem.is_procurable on the Beanie model.
    # Defaults True so existing frontend payloads that don't send this yet
    # keep behaving exactly as before.
    is_procurable: bool = True


class PPMPEntryItemOut(BaseModel):
    # Previously missing — meant every GET /ppmps/{id} silently stripped
    # the persisted item id, even though the underlying Beanie document
    # has one. Without this, no consumer of this schema could ever see it.
    id: Optional[str] = None
    item_name: str
    quantity: float
    unit: str
    unit_price: float
    q1_qty: float = 0
    q2_qty: float = 0
    q3_qty: float = 0
    q4_qty: float = 0
    total_cost: float
    # ADDED — mirrors PPMPEntryItemCreate.category so it round-trips back
    # out on GET /ppmps and GET /ppmps/{id} instead of being stripped.
    category: Optional[str] = None
    # ADDED — mirrors PPMPEntryItemCreate.is_procurable so non-procurable
    # status round-trips back out on read instead of being stripped.
    is_procurable: bool = True

    model_config = {"from_attributes": True}


# ── Procurement Entries (formerly "Lots") ────────────────────────────────────
#    Each entry carries its own Code/Category, description, type, mode,
#    timeline, and funding — these used to live on the project itself.

class PPMPEntryCreate(BaseModel):
    # See PPMPEntryItemCreate.id above — same reasoning, one level up.
    id: Optional[str] = None
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
    order_no: int = 1
    items: List[PPMPEntryItemCreate] = []


class PPMPEntryOut(BaseModel):
    # See PPMPEntryItemOut.id above — same reasoning, one level up.
    id: Optional[str] = None
    category_id: Optional[str] = None
    category_description: Optional[str] = None
    # ADDED — mirrors PPMPEntryCreate.project_title so it round-trips back
    # out on read instead of being stripped.
    project_title: Optional[str] = None
    description: str
    project_type: str
    procurement_mode: Optional[str] = None
    pre_proc_conference: str
    start_activity: Optional[str] = None
    end_activity: Optional[str] = None
    delivery_period: Optional[str] = None
    source_of_funds: str
    order_no: int
    estimated_budget: float = 0
    items: List[PPMPEntryItemOut] = []

    model_config = {"from_attributes": True}


# ── Projects ─────────────────────────────────────────────────────────────────
#    Projects are now just a grouping of entries, plus remarks and
#    attachments — description/type/mode/timeline moved down to each entry.

class PPMPProjectCreate(BaseModel):
    order_no: int = 1
    remarks: Optional[str] = None
    # ADDED — title of the supporting document for this project (e.g.
    # "Purchase Request", "BAC Resolution", "Canvass", "Letter Request").
    # This stores only the document's TITLE, not an uploaded file —
    # file uploads still go through supporting_docs below.
    attached_document_title: Optional[str] = None
    supporting_docs: Optional[str] = None
    entries: List[PPMPEntryCreate] = []


class PPMPProjectOut(BaseModel):
    order_no: int
    remarks: Optional[str] = None
    # ADDED — mirrors PPMPProjectCreate.attached_document_title so it
    # round-trips back out on read instead of being stripped.
    attached_document_title: Optional[str] = None
    supporting_docs: Optional[str] = None
    total_budget: float = 0
    entries: List[PPMPEntryOut] = []

    model_config = {"from_attributes": True}


# ── PPMP ─────────────────────────────────────────────────────────────────────

class PPMPCreate(BaseModel):
    year: int
    ppmp_no: Optional[str] = "1"
    ppmp_type: str = "indicative"
    # ADDED — supports the Save as Draft / Submit buttons on Create PPMP.
    # Only "draft" or "submitted" are valid here; a PPMP can never be
    # created directly as "approved" (that's an admin-only action taken
    # after review) or "archived".
    status: str = "draft"
    allocated_budget: float = 0
    description: Optional[str] = None
    additional_description: Optional[str] = None
    signatories: List[SignatoryCreate] = []
    prepared_by: Optional[str] = None
    prepared_by_position: Optional[str] = None
    submitted_by: Optional[str] = None
    submitted_by_position: Optional[str] = None
    projects: List[PPMPProjectCreate] = []


class PPMPUpdate(BaseModel):
    year: Optional[int] = None
    ppmp_no: Optional[str] = None
    ppmp_type: Optional[str] = None
    status: Optional[str] = None
    remarks: Optional[str] = None
    allocated_budget: Optional[float] = None
    description: Optional[str] = None
    additional_description: Optional[str] = None
    signatories: Optional[List[SignatoryCreate]] = None
    prepared_by: Optional[str] = None
    prepared_by_position: Optional[str] = None
    submitted_by: Optional[str] = None
    submitted_by_position: Optional[str] = None
    projects: Optional[List[PPMPProjectCreate]] = None


class PPMPOut(BaseModel):
    id: Annotated[str, BeforeValidator(_convert_id)]
    office_id: str
    created_by: str
    year: int
    ppmp_no: Optional[str] = None
    ppmp_type: str
    status: str
    remarks: Optional[str] = None
    allocated_budget: float = 0
    description: Optional[str] = None
    additional_description: Optional[str] = None
    signatories: List[SignatoryOut] = []
    prepared_by: Optional[str] = None
    prepared_by_position: Optional[str] = None
    submitted_by: Optional[str] = None
    submitted_by_position: Optional[str] = None
    submitted_at: Optional[datetime] = None
    created_at: datetime
    projects: List[PPMPProjectOut] = []
    parent_ppmp_id: Optional[str] = None
    # Enriched fields from FeeCategoryOffice / FeeCategory joins
    office_name: Optional[str] = None
    fee_category: Optional[str] = None

    model_config = {"from_attributes": True}