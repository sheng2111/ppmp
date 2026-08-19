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

MONGO_URL = os.getenv("MONGO_URL") or os.getenv("MONGODB_URI")
DB_NAME = os.getenv("DB_NAME")

# Offices directly under "Tuition Fees" (formerly labeled "STF")
TUITION_FEES_OFFICES = [
    "DGTT/CTE", "DOBM/BSBA", "BSHM", "CITE/BSCS", "CAF/BSA",
    "Physical Plant & Facilities (PPF)", "Production", "Research & Innovation",
    "Extension Services", "Administration", "Curriculum Development",
    "Quality Assurance Office", "Office of Student Welfare & Development",
    "Priority Projects",
]

# Flat offices directly under "Other School Fees"
OTHER_SCHOOL_FEES_FLAT_OFFICES = [
    "Sports & Development Office", "Computer Fees", "Office of Culture & Arts",
    "Registrar Office(Admission Fund)", "Registrar Office(Registration Fund)",
    "Guidance Fee", "Student Handbook", "University Library",
    "Office of Medical Services", "Student ID", "Entrance Fee", "NSTP",
    "Office of University Student Government", "Office of the Student Publication",
    "Graduation Fees",
]

# Offices under "Other School Fees" that themselves have sub-offices
OTHER_SCHOOL_FEES_PARENT_OFFICES = ["Laboratory Fees", "Development Fees", "OJT Fees"]

LABORATORY_FEES_SUB_OFFICES = [
    "Speech Laboratory", "Science Laboratory", "HRM Laboratory",
    "Computer Laboratory", "Agriculture Laboratory",
]

PROGRAMS = ["CAF/BSA", "DGTT/CTE", "DOBM/BSBA", "BSHM", "CITE/BSCS"]

# Ordered so display_order on both categories and offices follows this
# listing. Each category maps to its direct offices, plus an optional
# sub_offices dict of {parent_office_name: [sub_office_names]} for offices
# that themselves have children (Laboratory Fees, Development Fees, OJT Fees).
#
# Only 4 top-level fee categories exist: Tuition Fees, Other School Fees,
# Auxiliary, and IGP. Auxiliary and IGP have no offices of their own — they
# are directly selectable as the "office" when chosen as the fee category.
FEE_CATEGORIES = {
    "Tuition Fees": {
        "offices": TUITION_FEES_OFFICES,
        "sub_offices": {},
    },
    "Other School Fees": {
        "offices": OTHER_SCHOOL_FEES_FLAT_OFFICES + OTHER_SCHOOL_FEES_PARENT_OFFICES,
        "sub_offices": {
            "Laboratory Fees": LABORATORY_FEES_SUB_OFFICES,
            "Development Fees": PROGRAMS,
            "OJT Fees": PROGRAMS,
        },
    },
    "Auxiliary": {
        "offices": ["Auxiliary"],
        "sub_offices": {},
    },
    "IGP": {
        "offices": ["IGP"],
        "sub_offices": {},
    },
}


async def get_or_create_category(name: str, order: int) -> FeeCategory:
    existing = await FeeCategory.find_one(FeeCategory.name == name)
    if existing:
        return existing
    category = FeeCategory(name=name, display_order=order)
    await category.insert()
    print(f"Inserted Fee Category: {name}")
    return category


async def get_or_create_office(
    fee_category_id, name: str, order: int, parent_office_id=None
) -> FeeCategoryOffice:
    existing = await FeeCategoryOffice.find_one(
        FeeCategoryOffice.fee_category_id == fee_category_id,
        FeeCategoryOffice.name == name,
        FeeCategoryOffice.parent_office_id == parent_office_id,
    )
    if existing:
        return existing
    office = FeeCategoryOffice(
        fee_category_id=fee_category_id,
        name=name,
        display_order=order,
        parent_office_id=parent_office_id,
    )
    await office.insert()
    label = f"  Inserted Office: {name}" if parent_office_id is None else f"    Inserted Sub-office: {name}"
    print(label)
    return office


async def seed_fee_categories():
    if not MONGO_URL or not DB_NAME:
        raise RuntimeError("MONGO_URL and DB_NAME must be set in your .env file.")

    client = AsyncIOMotorClient(MONGO_URL)
    await init_beanie(database=client[DB_NAME], document_models=[FeeCategory, FeeCategoryOffice])

    for cat_order, (cat_name, cfg) in enumerate(FEE_CATEGORIES.items()):
        category = await get_or_create_category(cat_name, cat_order)

        office_id_by_name = {}
        for office_order, office_name in enumerate(cfg["offices"]):
            office = await get_or_create_office(category.id, office_name, office_order)
            office_id_by_name[office_name] = office.id

        for parent_name, sub_names in cfg["sub_offices"].items():
            parent_id = office_id_by_name.get(parent_name)
            if parent_id is None:
                continue
            for sub_order, sub_name in enumerate(sub_names):
                await get_or_create_office(
                    category.id, sub_name, sub_order, parent_office_id=parent_id
                )

    print("Done seeding fee categories.")


if __name__ == "__main__":
    asyncio.run(seed_fee_categories())