from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class APP(Base):
    __tablename__ = "app"

    id           = Column(Integer, primary_key=True, index=True)
    year         = Column(Integer, nullable=False, unique=True)
    status       = Column(String, default="draft")
    generated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    approved_at  = Column(DateTime(timezone=True))

    items = relationship("APPItem", back_populates="app", cascade="all, delete")


class APPItem(Base):
    __tablename__ = "app_items"

    id               = Column(Integer, primary_key=True, index=True)
    app_id           = Column(Integer, ForeignKey("app.id"), nullable=False)
    ppmp_project_id  = Column(Integer, ForeignKey("ppmp_projects.id"), nullable=False)
    lot_id           = Column(Integer, ForeignKey("ppmp_lots.id"), nullable=False)
    office_id        = Column(Integer, ForeignKey("offices.id"), nullable=False)
    estimated_budget = Column(Float, default=0)

    app         = relationship("APP", back_populates="items")
    office      = relationship("Office")