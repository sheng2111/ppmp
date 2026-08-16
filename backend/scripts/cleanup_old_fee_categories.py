import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from dotenv import load_dotenv

from app.models.fee_category import FeeCategory
from app.models.fee_category_office import FeeCategoryOffice

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME")

# Old top-level category names that should NOT exist anymore — they're
# either renamed ("STF" -> "Tuition Fees") or folded into "Other School
# Fees" as offices (Laboratory/Development/OJT/Student Government/
# Student Publication Fees).
OLD_CATEGORY_NAMES = [
    "STF",
    "Laboratory Fees",
    "Development Fees",
    "OJT Fees",
    "Student Government Fees",
    "Student Publication Fees",
]


async def cleanup():
    if not MONGO_URL or not DB_NAME:
        raise RuntimeError("MONGO_URL and DB_NAME must be set in your .env file.")

    client = AsyncIOMotorClient(MONGO_URL)
    await init_beanie(database=client[DB_NAME], document_models=[FeeCategory, FeeCategoryOffice])

    for name in OLD_CATEGORY_NAMES:
        category = await FeeCategory.find_one(FeeCategory.name == name)
        if category is None:
            print(f"Skip (not found): {name}")
            continue

        offices = await FeeCategoryOffice.find(
            FeeCategoryOffice.fee_category_id == category.id
        ).to_list()
        office_count = len(offices)
        for office in offices:
            await office.delete()

        await category.delete()
        print(f"Deleted category '{name}' and {office_count} office(s) under it.")

    print("Cleanup done. Now run the corrected seed script.")


if __name__ == "__main__":
    confirm = input(
        "This will permanently delete the old fee categories listed above "
        "and their offices. Type 'yes' to continue: "
    )
    if confirm.strip().lower() != "yes":
        print("Aborted.")
        sys.exit(0)
    asyncio.run(cleanup())