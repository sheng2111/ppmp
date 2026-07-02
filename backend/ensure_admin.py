from app.database import SessionLocal, engine, Base
from app.models import User, UserOffice, Office, Item, PPMP, PPMPProject, PPMPLot, APP, APPItem, PurchaseRequest, PRItem

# Always create tables if they don't exist
Base.metadata.create_all(bind=engine)

db = SessionLocal()

# Ensure office exists
office = db.query(Office).filter(Office.code == 'NGPA').first()
if not office:
    office = Office(
        name='NEMSU Tagbina Campus',
        code='NGPA',
        head_name='Ariston O. Ronquillo, DM',
        designation='Campus Director'
    )
    db.add(office)
    db.flush()
    print(f'Office created: {office.name}')
else:
    print(f'Office exists: {office.name} (id: {office.id})')

# Ensure admin account is promoted and assigned to NGPA
user = db.query(User).filter(User.email == 'sheilamea2004@gmail.com').first()
if user:
    user.role = 'admin'
    user.is_approved = True

    # Assign to NGPA if not already
    existing_link = db.query(UserOffice).filter(
        UserOffice.user_id == user.id,
        UserOffice.office_id == office.id
    ).first()
    if not existing_link:
        db.add(UserOffice(user_id=user.id, office_id=office.id))

    db.commit()
    print(f'Admin set: {user.email} | approved: {user.is_approved} | role: {user.role}')
else:
    print('User not found — sign in first then run this again')

db.close()