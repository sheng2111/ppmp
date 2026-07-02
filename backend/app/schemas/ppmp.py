from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class PPMPLotCreate(BaseModel):
    lot_no: str = "Lot 1"
    quantity_size: str
    estimated_budget: float = 0

class PPMPLotOut(BaseModel):
    id: int
    lot_no: str
    quantity_size: str
    estimated_budget: float

    class Config:
        from_attributes = True

class PPMPProjectCreate(BaseModel):
    description: str
    project_type: str = "Goods"
    procurement_mode: Optional[str] = None
    pre_proc_conference: str = "No"
    start_activity: Optional[str] = None
    end_activity: Optional[str] = None
    delivery_period: Optional[str] = None
    source_of_funds: str = "GoP"
    supporting_docs: Optional[str] = None
    remarks: Optional[str] = None
    order_no: int = 1
    lots: List[PPMPLotCreate] = []

class PPMPProjectOut(BaseModel):
    id: int
    order_no: int
    description: str
    project_type: str
    procurement_mode: Optional[str]
    pre_proc_conference: str
    start_activity: Optional[str]
    end_activity: Optional[str]
    delivery_period: Optional[str]
    source_of_funds: str
    supporting_docs: Optional[str]
    remarks: Optional[str]
    total_budget: float=0
    lots: List[PPMPLotOut] = []

    model_config = {"from_attributes": True}


class PPMPCreate(BaseModel):
    year: int
    ppmp_no: Optional[str] = "1"
    ppmp_type: str = "indicative"
    projects: List[PPMPProjectCreate] = []

class PPMPUpdate(BaseModel):
    status: Optional[str] = None
    remarks: Optional[str] = None
    ppmp_type: Optional[str] = None
    ppmp_no: Optional[str] = None

class PPMPOut(BaseModel):
    id: int
    office_id: int
    created_by: int
    year: int
    ppmp_no: Optional[str]
    ppmp_type: str
    status: str
    remarks: Optional[str]
    submitted_at: Optional[datetime]
    created_at: datetime
    projects: List[PPMPProjectOut] = []
    
    model_config = {"from_attributes": True}