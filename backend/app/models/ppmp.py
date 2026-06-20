from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import PPMPBase

class PPMPModel(PPMPBase):
    __tablename__ = "ppmps"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer)  # ✅ no ForeignKey — just store the user's id as a plain int

    year = Column(String)
    end_user_unit = Column(String)
    charged_to = Column(String)
    revision = Column(String, default="0")
    pap = Column(Text, nullable=True)
    date = Column(String)
    remarks = Column(Text, nullable=True)
    approving_officer = Column(String, nullable=True)
    designation = Column(String, nullable=True)
    total_estimated_budget = Column(Float, default=0)
    prepared_by = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    items = relationship("PPMPItem", back_populates="ppmp", cascade="all, delete-orphan")


class PPMPItem(PPMPBase):
    __tablename__ = "ppmp_items"
    id = Column(Integer, primary_key=True, index=True)
    ppmp_id = Column(Integer, ForeignKey("ppmps.id"))

    code = Column(String, nullable=True)
    general_description = Column(String)
    unit_of_issue = Column(String)
    quantity = Column(Float, default=0)
    unit_cost = Column(Float, default=0)
    total_cost = Column(Float, default=0)
    mode_of_procurement = Column(String, nullable=True)
    pap_category = Column(String, nullable=True)

    jan_qty = Column(Float, default=0); jan_amt = Column(Float, default=0)
    feb_qty = Column(Float, default=0); feb_amt = Column(Float, default=0)
    mar_qty = Column(Float, default=0); mar_amt = Column(Float, default=0)
    apr_qty = Column(Float, default=0); apr_amt = Column(Float, default=0)
    may_qty = Column(Float, default=0); may_amt = Column(Float, default=0)
    jun_qty = Column(Float, default=0); jun_amt = Column(Float, default=0)
    jul_qty = Column(Float, default=0); jul_amt = Column(Float, default=0)
    aug_qty = Column(Float, default=0); aug_amt = Column(Float, default=0)
    sep_qty = Column(Float, default=0); sep_amt = Column(Float, default=0)
    oct_qty = Column(Float, default=0); oct_amt = Column(Float, default=0)
    nov_qty = Column(Float, default=0); nov_amt = Column(Float, default=0)
    dec_qty = Column(Float, default=0); dec_amt = Column(Float, default=0)

    ppmp = relationship("PPMPModel", back_populates="items")