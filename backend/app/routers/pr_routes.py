from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.database import get_db
from app.models.pr import PurchaseRequest, PRItem
from app.models.office import Office
from app.models.user import User
from datetime import datetime

router = APIRouter(prefix="/prs", tags=["purchase_requests"])

class PRItemCreate(BaseModel):
    lot_label: Optional[str] = None
    stock_property_no: Optional[str] = None
    unit: Optional[str] = None
    item_description: str
    quantity: float = 0
    unit_price: float = 0

class PRCreate(BaseModel):
    pr_number: Optional[str] = None
    fund_cluster: Optional[str] = None
    responsibility_center_code: Optional[str] = None
    purpose: Optional[str] = None
    requested_date: Optional[str] = None
    requested_by_name: Optional[str] = None
    requested_by_designation: Optional[str] = None
    approved_by_name: Optional[str] = None
    approved_by_designation: Optional[str] = None
    items: List[PRItemCreate] = []

class PRItemOut(BaseModel):
    id: int
    lot_label: Optional[str]
    stock_property_no: Optional[str]
    unit: Optional[str]
    item_description: str
    quantity: float
    unit_price: float
    total_cost: float

    class Config:
        from_attributes = True

class PROut(BaseModel):
    id: int
    office_id: int
    created_by: int
    pr_number: Optional[str]
    fund_cluster: Optional[str]
    responsibility_center_code: Optional[str]
    purpose: Optional[str]
    requested_date: Optional[str]
    requested_by_name: Optional[str]
    requested_by_designation: Optional[str]
    approved_by_name: Optional[str]
    approved_by_designation: Optional[str]
    status: str
    created_at: str
    items: List[PRItemOut] = []

    class Config:
        from_attributes = True

@router.get("/", response_model=List[PROut])
def get_prs(
    office_id: Optional[int] = None,
    created_by: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(PurchaseRequest)
    if office_id:
        query = query.filter(PurchaseRequest.office_id == office_id)
    if created_by:
        query = query.filter(PurchaseRequest.created_by == created_by)
    return query.all()

@router.get("/{pr_id}", response_model=PROut)
def get_pr(pr_id: int, db: Session = Depends(get_db)):
    pr = db.query(PurchaseRequest).filter(PurchaseRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="PR not found")
    return pr

@router.post("/", response_model=PROut)
def create_pr(payload: PRCreate, office_id: int, created_by: int, db: Session = Depends(get_db)):
    pr = PurchaseRequest(
        office_id=office_id,
        created_by=created_by,
        pr_number=payload.pr_number,
        fund_cluster=payload.fund_cluster,
        responsibility_center_code=payload.responsibility_center_code,
        purpose=payload.purpose,
        requested_date=payload.requested_date,
        requested_by_name=payload.requested_by_name,
        requested_by_designation=payload.requested_by_designation,
        approved_by_name=payload.approved_by_name,
        approved_by_designation=payload.approved_by_designation,
        status='draft'
    )
    db.add(pr)
    db.flush()

    for item_data in payload.items:
        item = PRItem(
            pr_id=pr.id,
            lot_label=item_data.lot_label,
            stock_property_no=item_data.stock_property_no,
            unit=item_data.unit,
            item_description=item_data.item_description,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
        )
        db.add(item)

    db.commit()
    db.refresh(pr)
    return pr

@router.delete("/{pr_id}")
def delete_pr(pr_id: int, db: Session = Depends(get_db)):
    pr = db.query(PurchaseRequest).filter(PurchaseRequest.id == pr_id).first()
    if not pr:
        raise HTTPException(status_code=404, detail="PR not found")
    db.delete(pr)
    db.commit()
    return {"message": "PR deleted"}
