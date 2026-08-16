from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.models.item import Item
from app.schemas.item import ItemCreate, ItemUpdate, ItemOut

router = APIRouter(prefix="/items", tags=["items"])


@router.get("/", response_model=List[ItemOut])
async def get_items(category: Optional[str] = None):
    if category:
        items = await Item.find(Item.is_active == True, Item.category == category).to_list()
    else:
        items = await Item.find(Item.is_active == True).to_list()
    return items


@router.post("/", response_model=ItemOut)
async def create_item(payload: ItemCreate):
    item = Item(**payload.model_dump())
    await item.insert()
    return item


@router.put("/{item_id}", response_model=ItemOut)
async def update_item(item_id: str, payload: ItemUpdate):
    item = await Item.get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    update_data = payload.model_dump(exclude_unset=True)
    if update_data:
        await item.update({"$set": update_data})
    item = await Item.get(item_id)
    return item


@router.delete("/{item_id}")
async def delete_item(item_id: str):
    item = await Item.get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    await item.update({"$set": {"is_active": False}})
    return {"message": "Item deactivated"}
