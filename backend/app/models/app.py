from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import PPMPBase


class APPModel(PPMPBase):
    """
    Annual Procurement Plan (APP) — a separate document from the PPMP,
    generated FROM one or more PPMPs but edited and saved independently.
    Only includes line items (APPLineItem) whose estimated budget is
    >= PHP 200,000 (the "General Requirements" threshold under RA No.
    12009), pulled from the source PPMP(s) at generation time.
    """
    __tablename__ = "apps"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer)  # plain int, matches existing PPMP pattern

    fiscal_year = Column(String, nullable=True)
    status = Column(String, default="Indicative")  # "Indicative" / "Final" / "Updated"
    version_no = Column(String, nullable=True)  # only meaningful when status == "Updated"

    # Source PPMP this APP was generated from (nullable — an APP can be
    # edited/saved independently afterward and doesn't have to stay linked).
    source_ppmp_id = Column(Integer, ForeignKey("ppmps.id"), nullable=True)

    # Signatories — Prepared by / Recommended by (x2) / Approved by.
    # All free-text, no hardcoded names, matching the PPMP signatory pattern.
    prepared_by_name = Column(String, nullable=True)
    prepared_by_designation = Column(String, nullable=True)
    recommended_by_1_name = Column(String, nullable=True)
    recommended_by_1_designation = Column(String, nullable=True)
    recommended_by_2_name = Column(String, nullable=True)
    recommended_by_2_designation = Column(String, nullable=True)
    approved_by_name = Column(String, nullable=True)
    approved_by_designation = Column(String, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    line_items = relationship(
        "APPLineItem", back_populates="app", cascade="all, delete-orphan"
    )


class APPLineItem(PPMPBase):
    """
    One row of the APP's 12-column "General Requirements" table.
    Generated from a PPMP lot whose estimated budget is >= PHP 200,000;
    fields not present on the PPMP (PAP Code, Object Code, Early
    Procurement Activity, Bid Evaluation Criteria, Procurement Strategy)
    start blank and are filled in directly on the APP.
    """
    __tablename__ = "app_line_items"
    id = Column(Integer, primary_key=True, index=True)
    app_id = Column(Integer, ForeignKey("apps.id"))

    # Traceability back to the PPMP lot this row was generated from
    # (nullable — rows can also be added manually on the APP itself).
    source_lot_id = Column(Integer, ForeignKey("ppmp_lots.id"), nullable=True)

    pap_code = Column(String, nullable=True)  # Column 0 — not numbered in the official form, precedes Column 1
    object_code = Column(String, nullable=True)  # also precedes Column 1 in the official layout

    project_title = Column(Text, nullable=True)  # Column 1
    end_user_unit = Column(String, nullable=True)  # Column 2
    general_description = Column(Text, nullable=True)  # Column 3
    mode_of_procurement = Column(String, nullable=True)  # Column 4
    early_procurement_activity = Column(String, nullable=True)  # Column 5 — "Yes"/"No"
    bid_evaluation_criteria = Column(String, nullable=True)  # Column 6
    start_of_procurement = Column(Text, nullable=True)  # Column 7
    end_of_procurement = Column(Text, nullable=True)  # Column 8
    source_of_funds = Column(String, nullable=True)  # Column 9
    estimated_budget = Column(Float, default=0)  # Column 10
    procurement_strategy = Column(Text, nullable=True)  # Column 11
    remarks = Column(Text, nullable=True)  # Column 12

    app = relationship("APPModel", back_populates="line_items")
