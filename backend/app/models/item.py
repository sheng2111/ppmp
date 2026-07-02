from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from sqlalchemy.sql import func
from app.database import Base

class Item(Base):
    __tablename__ = "items"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String, nullable=False)
    unit       = Column(String, nullable=False)
    unit_price = Column(Float, nullable=False, default=0)
    category   = Column(String)
    is_active  = Column(Boolean, default=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())