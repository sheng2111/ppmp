import os
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from dotenv import load_dotenv
import certifi
load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("DB_NAME", "ppmp_system")
if not MONGODB_URI:
    raise RuntimeError("MONGODB_URI environment variable is not configured")
client: AsyncIOMotorClient = None
db = None


async def init_db():
    global client, db

    client = AsyncIOMotorClient(
        MONGODB_URI,
        serverSelectionTimeoutMS=10000,
    )

    print("Testing MongoDB connection...")
    await client.admin.command("ping")
    print("MongoDB connection successful!")

    db = client[DB_NAME]

    from app.models.user import User
    from app.models.office import Office
    from app.models.item import Item
    from app.models.ppmp import PPMP
    from app.models.pr import PurchaseRequest
    from app.models.app_model import APP
    from app.models.expense_category import ExpenseCategory
    from app.models.fee_category import FeeCategory
    from app.models.fee_category_office import FeeCategoryOffice
    from app.models.app_entry_detail import AppEntryDetail
    from app.models.app_meta import AppMeta
    from app.models.sequence_counter import SequenceCounter
    from app.models.signatory_settings import SignatorySettings
    from app.models.notification import AdminNotification

    await init_beanie(
        database=db,
        document_models=[
            User,
            Office,
            Item,
            PPMP,
            PurchaseRequest,
            APP,
            ExpenseCategory,
            FeeCategory,
            FeeCategoryOffice,
            AppEntryDetail,
            AppMeta,
            SequenceCounter,
            SignatorySettings,
            AdminNotification,
        ],
    )


def get_db():
    return db