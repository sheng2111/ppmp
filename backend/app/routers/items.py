from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.item import Item
from app.schemas.item import ItemCreate, ItemUpdate, ItemOut

router = APIRouter(prefix="/items", tags=["items"])

@router.get("/", response_model=List[ItemOut])
def get_items(category: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Item).filter(Item.is_active == True)
    if category:
        query = query.filter(Item.category == category)
    return query.all()

@router.post("/", response_model=ItemOut)
def create_item(payload: ItemCreate, db: Session = Depends(get_db)):
    item = Item(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.put("/{item_id}", response_model=ItemOut)
def update_item(item_id: int, payload: ItemUpdate, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item

@router.delete("/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.is_active = False
    db.commit()
    return {"message": "Item deactivated"}