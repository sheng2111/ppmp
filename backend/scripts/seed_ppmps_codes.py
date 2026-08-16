"""
Seed script for PPMP procurement item classification list (plain descriptions,
no codes, no grouping).

Run from the `backend/` folder (same level as `app/`):
    python scripts/seed_ppmp_codes.py

Reuses the app's own init_db() from app/services/database.py, so it connects
using the same MONGO_URL / DB_NAME as the rest of the system.
"""

import asyncio
from hashlib import scrypt
import json
import os
import sys

# Allow running this script from backend/ while it lives in backend/scripts/
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.database import init_db
from app.models.expense_category import ExpenseCategory


async def seed():
    await init_db()

    json_path = os.path.join(os.path.dirname(__file__), "ppmp_codes_list.json")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Clear existing entries before reseeding (comment out if you want to append instead)
    await ExpenseCategory.delete_all()

    docs = [ExpenseCategory(description=desc) for desc in data["descriptions"]]

    if docs:
        await ExpenseCategory.insert_many(docs)

    print(f"Seeded {len(docs)} expense category descriptions.")


if __name__ == "__main__":
    asyncio.run(seed())