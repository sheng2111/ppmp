from fastapi import APIRouter, HTTPException
from beanie import PydanticObjectId

from app.models.fee_category import FeeCategory
from app.models.fee_category_office import FeeCategoryOffice
from app.schemas.fee_category import (
    FeeCategoryCreate,
    FeeCategoryUpdate,
    FeeCategoryOfficeCreate,
    FeeCategoryOfficeUpdate,
)

router = APIRouter(prefix="/fee-categories", tags=["fee-categories"])


def _parse_id(id_str: str, label: str = "resource") -> PydanticObjectId:
    """Raises a clean 404 instead of letting a bad id crash the request."""
    try:
        return PydanticObjectId(id_str)
    except Exception:
        raise HTTPException(status_code=404, detail=f"{label} not found: {id_str!r}")


# ── Tree ─────────────────────────────────────────────────────────────────
# Powers the whole Fee Categories tab in one call: every category, with its
# top-level offices, with each office's sub-offices nested inside it.

@router.get("/tree")
async def get_fee_category_tree():
    categories = await FeeCategory.find_all().sort("+display_order").to_list()
    all_offices = await FeeCategoryOffice.find_all().sort("+display_order").to_list()

    offices_by_category: dict = {}
    for o in all_offices:
        offices_by_category.setdefault(str(o.fee_category_id), []).append(o)

    def serialize_office(office: FeeCategoryOffice, offices_in_category: list) -> dict:
        children = [
            serialize_office(child, offices_in_category)
            for child in offices_in_category
            if child.parent_office_id == office.id
        ]
        return {
            "id": str(office.id),
            "name": office.name,
            "fee_category_id": str(office.fee_category_id),
            "parent_office_id": str(office.parent_office_id) if office.parent_office_id else None,
            "children": children,
        }

    tree = []
    for cat in categories:
        cat_offices = offices_by_category.get(str(cat.id), [])
        top_level = [o for o in cat_offices if o.parent_office_id is None]
        tree.append({
            "id": str(cat.id),
            "name": cat.name,
            "offices": [serialize_office(o, cat_offices) for o in top_level],
        })

    return tree


# ── Flat office list (for dropdowns, e.g. Create PPMP) ──────────────────
# Unlike /tree, this is a flat list — every office AND sub-office in one
# array, each tagged with its fee category name, so a searchable dropdown
# can show "CITE/BSCS — STF" without the caller having to walk the tree.

@router.get("/offices/flat")
async def get_flat_fee_category_offices():
    categories = await FeeCategory.find_all().to_list()
    category_name_by_id = {str(c.id): c.name for c in categories}

    offices = await FeeCategoryOffice.find_all().sort("+display_order").to_list()
    return [
        {
            "id": str(o.id),
            "name": o.name,
            "fee_category_id": str(o.fee_category_id),
            "fee_category_name": category_name_by_id.get(str(o.fee_category_id), ""),
            "parent_office_id": str(o.parent_office_id) if o.parent_office_id else None,
        }
        for o in offices
    ]


# ── Fee Category CRUD ────────────────────────────────────────────────────

@router.get("/{category_id}")
async def get_fee_category(category_id: str):
    cid = _parse_id(category_id, "Fee category")
    category = await FeeCategory.get(cid)
    if not category:
        raise HTTPException(status_code=404, detail="Fee category not found")
    return {"id": str(category.id), "name": category.name}


@router.post("/")
async def create_fee_category(payload: FeeCategoryCreate):
    display_order = (
        payload.position if payload.position is not None else await FeeCategory.count()
    )
    category = FeeCategory(name=payload.name, display_order=display_order)
    await category.insert()
    return {"id": str(category.id), "name": category.name}


@router.put("/{category_id}")
async def update_fee_category(category_id: str, payload: FeeCategoryUpdate):
    cid = _parse_id(category_id, "Fee category")
    category = await FeeCategory.get(cid)
    if not category:
        raise HTTPException(status_code=404, detail="Fee category not found")
    await category.update({"$set": {"name": payload.name}})
    return {"id": str(cid), "name": payload.name}


@router.delete("/{category_id}")
async def delete_fee_category(category_id: str):
    cid = _parse_id(category_id, "Fee category")
    category = await FeeCategory.get(cid)
    if not category:
        raise HTTPException(status_code=404, detail="Fee category not found")

    offices = await FeeCategoryOffice.find(
        FeeCategoryOffice.fee_category_id == cid
    ).to_list()
    if offices:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot delete: {len(offices)} office(s) still belong to this "
                "category. Delete them first."
            ),
        )

    await category.delete()
    return {"message": "Fee category deleted"}


# ── Offices nested under a Fee Category ─────────────────────────────────
# NOTE: these are FeeCategoryOffice records, a DIFFERENT collection from
# the PPMP system's Office model (app/models/office.py, /offices router).
# The frontend's updateOffice/deleteOffice helpers must point here
# (/fee-categories/offices/{id}), not at /offices/{id} — see chat.

@router.post("/{category_id}/offices")
async def create_fee_category_office(category_id: str, payload: FeeCategoryOfficeCreate):
    cid = _parse_id(category_id, "Fee category")
    category = await FeeCategory.get(cid)
    if not category:
        raise HTTPException(status_code=404, detail="Fee category not found")

    parent_office_id = None
    if payload.parent_office_id:
        parent_office_id = _parse_id(payload.parent_office_id, "Parent office")
        parent = await FeeCategoryOffice.get(parent_office_id)
        if not parent or parent.fee_category_id != cid:
            raise HTTPException(
                status_code=400, detail="Parent office not found in this category"
            )

    display_order = await FeeCategoryOffice.find(
        FeeCategoryOffice.fee_category_id == cid
    ).count()

    office = FeeCategoryOffice(
        fee_category_id=cid,
        name=payload.name,
        display_order=display_order,
        parent_office_id=parent_office_id,
    )
    await office.insert()
    return {"id": str(office.id), "name": office.name}


@router.put("/offices/{office_id}")
async def update_fee_category_office(office_id: str, payload: FeeCategoryOfficeUpdate):
    oid = _parse_id(office_id, "Office")
    office = await FeeCategoryOffice.get(oid)
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")

    update_data = {}
    if payload.name is not None:
        update_data["name"] = payload.name

    if "parent_office_id" in payload.model_fields_set:
        if payload.parent_office_id:
            parent_oid = _parse_id(payload.parent_office_id, "Parent office")
            if parent_oid == oid:
                raise HTTPException(
                    status_code=400, detail="An office cannot be its own parent"
                )
            parent = await FeeCategoryOffice.get(parent_oid)
            if not parent or parent.fee_category_id != office.fee_category_id:
                raise HTTPException(
                    status_code=400, detail="Parent office not found in this category"
                )
            update_data["parent_office_id"] = parent_oid
        else:
            update_data["parent_office_id"] = None

    if update_data:
        await office.update({"$set": update_data})

    office = await FeeCategoryOffice.get(oid)
    return {"id": str(office.id), "name": office.name}


@router.delete("/offices/{office_id}")
async def delete_fee_category_office(office_id: str):
    oid = _parse_id(office_id, "Office")
    office = await FeeCategoryOffice.get(oid)
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")

    children = await FeeCategoryOffice.find(
        FeeCategoryOffice.parent_office_id == oid
    ).to_list()
    if children:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot delete: {len(children)} sub-office(s) still reference "
                "this office. Delete them first."
            ),
        )

    await office.delete()
    return {"message": "Office deleted"}