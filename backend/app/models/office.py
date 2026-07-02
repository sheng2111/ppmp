from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Office(Base):
    __tablename__ = "offices"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String, nullable=False)
    code        = Column(String, nullable=False, unique=True)
    head_name   = Column(String)
    designation = Column(String)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    users = relationship(
        "User",
        secondary="user_offices",
        back_populates="offices",
    )
    ppmps = relationship("PPMP", back_populates="office")