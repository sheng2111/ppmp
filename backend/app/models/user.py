from sqlalchemy import Column, Integer, String, Boolean
from ..database import UsersBase

class User(UsersBase):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=True)
    full_name = Column(String, nullable=True)
    email = Column(String, unique=True, nullable=True)
    is_profile_complete = Column(Boolean, default=False)
    google_id = Column(String, nullable=True)
    # ❌ No relationship to PPMPModel anymore — separate DBs can't do FK joins