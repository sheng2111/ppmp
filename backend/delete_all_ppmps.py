import asyncio
from app.services.database import init_db
from app.models.ppmp import PPMP
from app.models.pr import PurchaseRequest
from app.models.notification import AdminNotification
from app.models.app_meta import AppMeta


async def main():
    await init_db()

    ppmp_count = await PPMP.find_all().count()
    pr_count = await PurchaseRequest.find_all().count()
    notif_count = await AdminNotification.find_all().count()
    app_count = await AppMeta.find_all().count()

    print(f"Found: {ppmp_count} PPMP(s), {pr_count} PR(s), {notif_count} notification(s), {app_count} APP(s)")

    await PPMP.delete_all()
    await PurchaseRequest.delete_all()
    await AdminNotification.delete_all()
    await AppMeta.delete_all()

    print("All deleted.")


if __name__ == "__main__":
    asyncio.run(main())
