import asyncio
import sqlite3
from datetime import datetime
from app.database import init_db
from app.models.user import User, OfficeAssignment, OfficeInfo
from app.models.office import Office
from app.models.item import Item
from app.models.ppmp import PPMP, PPMPProject, PPMPLot, PPMPLotItem


async def migrate():
    await init_db()

    conn = sqlite3.connect("epms.db")
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    await User.delete_all()
    await Office.delete_all()
    await Item.delete_all()
    await PPMP.delete_all()
    print("Cleared existing MongoDB data")

    office_id_map = {}
    user_id_map = {}
    ppmp_id_map = {}

    c.execute("SELECT * FROM offices")
    offices_raw = c.fetchall()
    for row in offices_raw:
        office = Office(
            name=row["name"],
            code=row["code"],
            head_name=row["head_name"],
            designation=row["designation"],
            created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else datetime.utcnow(),
        )
        await office.insert()
        office_id_map[row["id"]] = str(office.id)
        print(f"  Office: {row['name']} ({row['id']} -> {office.id})")

    c.execute("SELECT * FROM users")
    users_raw = c.fetchall()

    c.execute("SELECT * FROM user_offices")
    user_offices = {}
    for uo in c.fetchall():
        uid = uo["user_id"]
        if uid not in user_offices:
            user_offices[uid] = []
        user_offices[uid].append({
            "office_id": uo["office_id"],
            "designation": uo["designation"],
        })

    for row in users_raw:
        assignments = []
        offices_info = []
        office_ids = []
        for uo in user_offices.get(row["id"], []):
            mapped_office_id = office_id_map.get(uo["office_id"], "")
            office_name = ""
            office_code = ""
            for o in c.execute("SELECT name, code FROM offices WHERE id = ?", (uo["office_id"],)):
                office_name = o["name"]
                office_code = o["code"]
            assignments.append(OfficeAssignment(
                office_id=mapped_office_id,
                office_name=office_name,
                office_code=office_code,
                designation=uo["designation"],
            ))
            offices_info.append(OfficeInfo(
                id=mapped_office_id,
                name=office_name,
                code=office_code,
            ))
            office_ids.append(mapped_office_id)

        user = User(
            supabase_uid=row["supabase_uid"],
            full_name=row["full_name"],
            email=row["email"],
            role=row["role"],
            designation=row["designation"],
            is_approved=bool(row["is_approved"]),
            offices=offices_info,
            office_ids=office_ids,
            office_assignments=assignments,
            created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else datetime.utcnow(),
        )
        await user.insert()
        user_id_map[row["id"]] = str(user.id)
        print(f"  User: {row['email']} ({row['id']} -> {user.id})")

    c.execute("SELECT * FROM items")
    for row in c.fetchall():
        item = Item(
            name=row["name"],
            unit=row["unit"],
            unit_price=row["unit_price"],
            category=row["category"],
            is_active=bool(row["is_active"]),
            updated_at=datetime.fromisoformat(row["updated_at"]) if row["updated_at"] else datetime.utcnow(),
        )
        await item.insert()
        print(f"  Item: {row['name']} ({row['id']} -> {item.id})")

    c.execute("SELECT * FROM ppmps")
    ppmps_raw = c.fetchall()
    c.execute("SELECT * FROM ppmp_projects")
    projects_raw = c.fetchall()
    c.execute("SELECT * FROM ppmp_lots")
    lots_raw = c.fetchall()
    c.execute("SELECT * FROM ppmp_lot_items")
    lot_items_raw = c.fetchall()

    lot_items_by_lot = {}
    for li in lot_items_raw:
        lid = li["lot_id"]
        if lid not in lot_items_by_lot:
            lot_items_by_lot[lid] = []
        lot_items_by_lot[lid].append(li)

    lots_by_project = {}
    for lot in lots_raw:
        pid = lot["project_id"]
        if pid not in lots_by_project:
            lots_by_project[pid] = []
        lots_by_project[pid].append(lot)

    projects_by_ppmp = {}
    for proj in projects_raw:
        ppid = proj["ppmp_id"]
        if ppid not in projects_by_ppmp:
            projects_by_ppmp[ppid] = []
        projects_by_ppmp[ppid].append(proj)

    for row in ppmps_raw:
        ppmp_projects = []
        for proj in projects_by_ppmp.get(row["id"], []):
            proj_lots = []
            for lot in lots_by_project.get(proj["id"], []):
                items = []
                for li in lot_items_by_lot.get(lot["id"], []):
                    items.append(PPMPLotItem(
                        item_name=li["item_name"],
                        quantity=li["quantity"],
                        unit=li["unit"],
                        unit_price=li["unit_price"],
                        total_cost=li["total_cost"],
                    ))
                proj_lots.append(PPMPLot(
                    lot_no=lot["lot_no"],
                    quantity_size=lot["quantity_size"],
                    estimated_budget=lot["estimated_budget"],
                    items=items,
                ))
            ppmp_projects.append(PPMPProject(
                order_no=proj["order_no"],
                description=proj["description"],
                project_type=proj["project_type"],
                procurement_mode=proj["procurement_mode"],
                pre_proc_conference=proj["pre_proc_conference"],
                start_activity=proj["start_activity"],
                end_activity=proj["end_activity"],
                delivery_period=proj["delivery_period"],
                source_of_funds=proj["source_of_funds"],
                supporting_docs=proj["supporting_docs"],
                remarks=proj["remarks"],
                lots=proj_lots,
            ))

        ppmp = PPMP(
            office_id=office_id_map.get(row["office_id"], ""),
            created_by=user_id_map.get(row["created_by"], ""),
            year=row["year"],
            ppmp_no=row["ppmp_no"],
            ppmp_type=row["ppmp_type"],
            status=row["status"],
            remarks=row["remarks"],
            submitted_at=datetime.fromisoformat(row["submitted_at"]) if row["submitted_at"] else None,
            created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else datetime.utcnow(),
            projects=ppmp_projects,
        )
        await ppmp.insert()
        ppmp_id_map[row["id"]] = str(ppmp.id)
        print(f"  PPMP: {row['ppmp_no']} year={row['year']} ({row['id']} -> {ppmp.id})")

    conn.close()
    print("\nMigration complete!")


if __name__ == "__main__":
    asyncio.run(migrate())
