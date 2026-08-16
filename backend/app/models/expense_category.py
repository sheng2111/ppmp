from beanie import Document
from typing import Optional


class ExpenseCategory(Document):
    description: str
    # ADDED — determines LOT A/B/C ordering when a Purchase Request groups
    # selected items by PPMP Code. Lower number = earlier lot. None means
    # "not configured yet" — such categories sort last (see
    # DEFAULT_LOT_PRIORITY in ppmps.py).
    lot_priority: Optional[int] = None

    class Settings:
        name = "expense_categories"