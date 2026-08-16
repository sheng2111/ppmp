import re
from fastapi import APIRouter, HTTPException, Query
from beanie import PydanticObjectId
from typing import List

from app.models.expense_category import ExpenseCategory
from app.schemas.expense_category import ExpenseCategoryOut, ExpenseCategoryUpdate

router = APIRouter(prefix="/api/expense-categories", tags=["Expense Categories"])


@router.get("/", response_model=List[ExpenseCategoryOut])
async def list_expense_categories():
    """Return all expense categories (used for initial dropdown load if needed)."""
    categories = await ExpenseCategory.find_all().to_list()
    return categories


@router.get("/search", response_model=List[ExpenseCategoryOut])
async def search_expense_categories(q: str = Query(default="", min_length=0)):
    """
    Case-insensitive partial match on description.
    Matches even a single typed letter, per the searchable-dropdown requirement.
    """
    if not q:
        categories = await ExpenseCategory.find_all().to_list()
        return categories

    pattern = re.escape(q)
    categories = await ExpenseCategory.find(
        {"description": {"$regex": pattern, "$options": "i"}}
    ).to_list()
    return categories


# ── Lot Priority management ──────────────────────────────────────────────
# ADDED — lets an admin set the Lot Priority used to order LOT A/B/C
# groupings on a generated PR (lower number = earlier lot). Description
# can be edited here too, but either field may be omitted.

@router.put("/{category_id}", response_model=ExpenseCategoryOut)
async def update_expense_category(category_id: str, payload: ExpenseCategoryUpdate):
    try:
        cid = PydanticObjectId(category_id)
    except Exception:
        raise HTTPException(
            status_code=404, detail=f"Expense category not found: {category_id!r}"
        )

    category = await ExpenseCategory.get(cid)
    if not category:
        raise HTTPException(status_code=404, detail="Expense category not found")

    update_data = payload.model_dump(exclude_unset=True)
    if update_data:
        await category.update({"$set": update_data})
        category = await ExpenseCategory.get(cid)
    return category