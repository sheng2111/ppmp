from app.database import SessionLocal
from app.models.user import User

db = SessionLocal()
users = db.query(User).all()

if not users:
    print("No users found in the database.")
else:
    print(f"Found {len(users)} user(s):\n")
    for u in users:
        office_names = ", ".join([o.name for o in u.offices]) if u.offices else "None"
        print(
            f"id={u.id} | email={u.email} | role={u.role} | "
            f"approved={u.is_approved} | offices=[{office_names}] | "
            f"supabase_uid={u.supabase_uid}"
        )

db.close()