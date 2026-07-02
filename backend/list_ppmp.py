from app.database import SessionLocal
from app.models.ppmp import PPMP
from app.models.office import Office
from app.models.user import User

db = SessionLocal()
ppmps = db.query(PPMP).all()

if not ppmps:
    print("No PPMPs found in the database at all.")
else:
    print(f"Found {len(ppmps)} PPMP(s):\n")
    for p in ppmps:
        office = db.query(Office).filter(Office.id == p.office_id).first()
        creator = db.query(User).filter(User.id == p.created_by).first()
        print(
            f"id={p.id} | year={p.year} | type={p.ppmp_type} | "
            f"office={office.name if office else '???'} (office_id={p.office_id}) | "
            f"created_by={creator.email if creator else '???'} (user_id={p.created_by})"
        )

db.close()