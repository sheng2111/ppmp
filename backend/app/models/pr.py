from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class PurchaseRequest(Base):
    __tablename__ = "purchase_requests"

    id                        = Column(Integer, primary_key=True, index=True)
    office_id                 = Column(Integer, ForeignKey("offices.id"), nullable=False)
    created_by                = Column(Integer, ForeignKey("users.id"), nullable=False)
    pr_number                 = Column(String, unique=True)
    fund_cluster              = Column(String)
    responsibility_center_code = Column(String)
    purpose                   = Column(Text)
    requested_date            = Column(String)
    requested_by_name         = Column(String)
    requested_by_designation  = Column(String)
    approved_by_name          = Column(String)
    approved_by_designation   = Column(String)
    status                    = Column(String, default="draft")
    created_at                = Column(DateTime, server_default=func.now())

    items = relationship("PRItem", back_populates="pr", cascade="all, delete")


class PRItem(Base):
    __tablename__ = "pr_items"

    id                = Column(Integer, primary_key=True, index=True)
    pr_id             = Column(Integer, ForeignKey("purchase_requests.id"), nullable=False)
    lot_id            = Column(Integer, ForeignKey("ppmp_lots.id"), nullable=True)
    lot_label         = Column(String)
    stock_property_no = Column(String)
    unit              = Column(String)
    item_description  = Column(Text)
    quantity          = Column(Float, default=0)
    unit_price        = Column(Float, default=0)

    @property
    def total_cost(self):
        return self.quantity * self.unit_price

    pr = relationship("PurchaseRequest", back_populates="items")
