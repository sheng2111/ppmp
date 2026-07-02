from app.database import SessionLocal
from app.models.user import User
from app.models.office import Office

db = SessionLocal()

office = db.query(Office).filter(Office.code == 'NGPA').first()
print('Office id:', office.id)

user = db.query(User).filter(User.email == 'sheilamea2004@gmail.com').first()
user.office_id = office.id
user.role = 'admin'
db.commit()
print('Done — office_id:', user.office_id, '| role:', user.role)
db.close()