"""
One-time migration: ensures every PPMPEntry and PPMPEntryItem across every
existing PPMP has a persisted `id`, then re-saves the document.

Why this is needed: `id` was added to these models with a Pydantic
default_factory. For PPMPs saved BEFORE that field existed, the stored
MongoDB document has no `id` key on its items/entries at all — so Beanie
generates a fresh random id every single time the document is loaded,
since nothing was ever written back to the database. That means a PR
referencing an item's id from one fetch won't match the id generated on
the NEXT fetch, causing "Item does not belong to the selected PPMP" 400
errors even though the item is clearly there.

Running this script once loads each PPMP, lets Pydantic fill in ids for
anything missing them, and re-saves — so those ids become permanent and
stable across every future request.

Run from your backend folder:
    python -m scripts.backfill_ppmp_ids
(or `python scripts/backfill_ppmp_ids.py` with the sys.path fix — see the
seed_offices.py pattern from earlier if you need that instead)
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from dotenv import load_dotenv
from app.models.ppmp import PPMP

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME")


async def backfill():
    if not MONGO_URL or not DB_NAME:
        raise RuntimeError("MONGO_URL and DB_NAME must be set in your .env file.")

    client = AsyncIOMotorClient(MONGO_URL)
    await init_beanie(database=client[DB_NAME], document_models=[PPMP])

    ppmps = await PPMP.find_all().to_list()
    updated_count = 0

    for ppmp in ppmps:
        # Just accessing .id on each entry/item is enough to trigger
        # Pydantic's default_factory for anything missing it — the values
        # are already sitting in memory on this loaded object. Re-saving
        # persists those freshly-generated ids permanently.
        has_any_items = any(
            entry.items for project in ppmp.projects for entry in project.entries
        )
        if not has_any_items:
            continue

        await ppmp.save()
        updated_count += 1
        print(f"Backfilled ids for PPMP {ppmp.ppmp_no or ppmp.id}")

    print(f"Done. Re-saved {updated_count} PPMP(s).")


if __name__ == "__main__":
    asyncio.run(backfill())