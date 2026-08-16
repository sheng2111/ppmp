import asyncio
from app.database import init_db
from app.models.user import User, OfficeAssignment
from app.models.office import Office


async def main():
    await init_db()

    # Ensure office exists
    office = await Office.find_one(Office.code == "NGPA")
    if not office:
        office = Office(
            name="NEMSU Tagbina Campus",
            code="NGPA",
            head_name="Ariston O. Ronquillo, DM",
            designation="Campus Director",
        )
        await office.insert()
        print(f"Office created: {office.name}")
    else:
        print(f"Office exists: {office.name} (id: {office.id})")

    # Ensure admin account is promoted and assigned to NGPA
    user = await User.find_one(User.email == "sheilamea2004@gmail.com")
    if user:
        update_data = {
            "role": "admin",
            "is_approved": True,
        }

        # Assign to NGPA if not already
        if str(office.id) not in (user.office_ids or []):
            assignment = OfficeAssignment(
                office_id=str(office.id),
                office_name=office.name,
                office_code=office.code,
            )
            update_data["office_ids"] = list(set((user.office_ids or []) + [str(office.id)]))
            update_data["office_assignments"] = list(
                (user.office_assignments or []) + [assignment]
            )

        await user.update({"$set": update_data})
        print(f"Admin set: {user.email} | approved: True | role: admin")
    else:
        print("User not found — sign in first then run this again")


if __name__ == "__main__":
    asyncio.run(main())
