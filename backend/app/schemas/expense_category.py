from pydantic import BaseModel, BeforeValidator
from typing import Annotated, Optional
from bson import ObjectId


def _convert_id(v):
    if isinstance(v, ObjectId):
        return str(v)
    return v


# NOTE: I don't have your original app/schemas/expense_category.py, so
# ExpenseCategoryOut below is reconstructed to match how it's used in
# expense_categories.py (response_model=List[ExpenseCategoryOut] over
# ExpenseCategory documents). If your real file differs, just add the
# `lot_priority` field shown below to your existing ExpenseCategoryOut —
# that's the only change that matters here.

class ExpenseCategoryOut(BaseModel):
    id: Annotated[str, BeforeValidator(_convert_id)]
    description: str
    # ADDED — round-trips ExpenseCategory.lot_priority back out on
    # GET /api/expense-categories/, GET /api/expense-categories/search,
    # and PUT /api/expense-categories/{id}.
    lot_priority: Optional[int] = None

    model_config = {"from_attributes": True}


# ADDED — request body for the new PUT /api/expense-categories/{id}
# endpoint, so an admin can set/change a category's description and/or
# Lot Priority independently (either field may be omitted).
class ExpenseCategoryUpdate(BaseModel):
    description: Optional[str] = None
    lot_priority: Optional[int] = None