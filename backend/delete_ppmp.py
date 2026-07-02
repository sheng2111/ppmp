import sys
from app.database import SessionLocal
from app.models.ppmp import PPMP

if len(sys.argv) < 2:
    print("Usage: python delete_ppmp.py <ppmp_id>")
    sys.exit(1)

ppmp_id = int(sys.argv[1])

db = SessionLocal()
ppmp = db.query(PPMP).filter(PPMP.id == ppmp_id).first()

if not ppmp:
    print(f"No PPMP found with id={ppmp_id}")
else:
    db.delete(ppmp)
    db.commit()
    print(f"Deleted PPMP id={ppmp_id}")

db.close()