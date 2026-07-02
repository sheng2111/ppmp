from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class UserOffice(Base):
    """Many-to-many: one user can belong to multiple offices."""
    __tablename__ = "user_offices"

    user_id   = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    office_id = Column(Integer, ForeignKey("offices.id", ondelete="CASCADE"), primary_key=True)


class User(Base):
    __tablename__ = "users"

    id           = Column(Integer, primary_key=True, index=True)
    supabase_uid = Column(String, nullable=False, unique=True, index=True)
    full_name    = Column(String, nullable=False)
    email        = Column(String, nullable=False, unique=True)
    role         = Column(String, nullable=False, default="user")
    designation  = Column(String, nullable=True)
    is_approved  = Column(Boolean, nullable=False, default=False)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    offices = relationship(
        "Office",
        secondary="user_offices",
        back_populates="users",
    )
    ppmps = relationship("PPMP", back_populates="created_by_user")