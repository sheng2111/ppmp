from fastapi import APIRouter, HTTPException
from beanie import PydanticObjectId
from typing import List
from app.models.fee_category_office import FeeCategoryOffice
from app.models.item import Item
from app.schemas.office import OfficeCreate, OfficeUpdate, OfficeOut

router = APIRouter(prefix="/offices", tags=["offices"])


def _parse_office_id(office_id: str) -> PydanticObjectId:
    """Raises a clean 404 instead of letting a bad id crash the request."""
    try:
        return PydanticObjectId(office_id)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Office not found: {office_id!r}")


def _prepare_office_data(data: dict) -> dict:
    """Converts parent_office_id from string to PydanticObjectId if present."""
    if data.get("parent_office_id"):
        data["parent_office_id"] = _parse_office_id(data["parent_office_id"])
    return data


@router.get("/", response_model=List[OfficeOut])
async def get_offices():
    return await FeeCategoryOffice.find_all().to_list()


@router.post("/", response_model=OfficeOut)
async def create_office(payload: OfficeCreate):
    data = _prepare_office_data(payload.model_dump())
    office = FeeCategoryOffice(**data)
    await office.insert()
    return office


@router.put("/{office_id}", response_model=OfficeOut)
async def update_office(office_id: str, payload: OfficeUpdate):
    oid = _parse_office_id(office_id)
    office = await FeeCategoryOffice.get(oid)
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")

    update_data = payload.model_dump(exclude_unset=True)
    update_data = _prepare_office_data(update_data)
    if update_data:
        await office.update({"$set": update_data})
    office = await FeeCategoryOffice.get(oid)
    return office


@router.delete("/{office_id}")
async def delete_office(office_id: str):
    oid = _parse_office_id(office_id)
    office = await FeeCategoryOffice.get(oid)
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")

    children = await FeeCategoryOffice.find(FeeCategoryOffice.parent_office_id == oid).to_list()
    if children:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete: {len(children)} sub-office(s) still reference this office. Delete or reassign them first.",
        )

    await office.delete()
    return {"message": "Office deleted"}


@router.get("/summary/stats")
async def get_office_stats():
    total_offices = await FeeCategoryOffice.count()
    total_items = await Item.find(Item.is_active == True).count()
    return {
        "total_offices": total_offices,
        "total_items": total_items,
    }


@router.get("/{office_id}", response_model=OfficeOut)
async def get_office(office_id: str):
    oid = _parse_office_id(office_id)
    office = await FeeCategoryOffice.get(oid)
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")
    return office