from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# --- Users Database ---
USERS_DATABASE_URL = "sqlite:///./users.db"
users_engine = create_engine(USERS_DATABASE_URL, connect_args={"check_same_thread": False})
UsersSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=users_engine)
UsersBase = declarative_base()

# --- PPMP Database ---
PPMP_DATABASE_URL = "sqlite:///./ppmp.db"
ppmp_engine = create_engine(PPMP_DATABASE_URL, connect_args={"check_same_thread": False})
PPMPSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ppmp_engine)
PPMPBase = declarative_base()

# --- Dependency: Users DB session ---
def get_users_db():
    db = UsersSessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Dependency: PPMP DB session ---
def get_ppmp_db():
    db = PPMPSessionLocal()
    try:
        yield db
    finally:
        db.close()