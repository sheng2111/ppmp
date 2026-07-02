from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.office import Office
from app.schemas.office import OfficeCreate, OfficeUpdate, OfficeOut

router = APIRouter(prefix="/offices", tags=["offices"])

@router.get("/", response_model=List[OfficeOut])
def get_offices(db: Session = Depends(get_db)):
    return db.query(Office).all()

@router.post("/", response_model=OfficeOut)
def create_office(payload: OfficeCreate, db: Session = Depends(get_db)):
    existing = db.query(Office).filter(Office.code == payload.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Office code already exists")
    office = Office(**payload.model_dump())
    db.add(office)
    db.commit()
    db.refresh(office)
    return office

@router.put("/{office_id}", response_model=OfficeOut)
def update_office(office_id: int, payload: OfficeUpdate, db: Session = Depends(get_db)):
    office = db.query(Office).filter(Office.id == office_id).first()
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(office, key, value)
    db.commit()
    db.refresh(office)
    return office

@router.delete("/{office_id}")
def delete_office(office_id: int, db: Session = Depends(get_db)):
    office = db.query(Office).filter(Office.id == office_id).first()
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")
    db.delete(office)
    db.commit()
    return {"message": "Office deleted"}

@router.get("/summary/stats")
def get_office_stats(db: Session = Depends(get_db)):
    from app.models.item import Item
    total_offices = db.query(Office).count()
    total_items = db.query(Item).filter(Item.is_active == True).count()
    return {
        "total_offices": total_offices,
        "total_items": total_items,
    }
    
@router.get("/{office_id}", response_model=OfficeOut)
def get_office(office_id: int, db: Session = Depends(get_db)):
    office = db.query(Office).filter(Office.id == office_id).first()
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")
    return office