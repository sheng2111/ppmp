from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class PPMP(Base):
    __tablename__ = "ppmps"

    id           = Column(Integer, primary_key=True, index=True)
    office_id    = Column(Integer, ForeignKey("offices.id"), nullable=False)
    created_by   = Column(Integer, ForeignKey("users.id"), nullable=False)
    year         = Column(Integer, nullable=False)
    ppmp_no      = Column(String)                    # e.g. "1", "2"
    ppmp_type    = Column(String, default="indicative")  # indicative | final
    status       = Column(String, default="draft")   # draft | submitted | approved | rejected
    remarks      = Column(String)
    submitted_at = Column(DateTime(timezone=True))
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    office          = relationship("Office", back_populates="ppmps")
    created_by_user = relationship("User", back_populates="ppmps")
    projects        = relationship("PPMPProject", back_populates="ppmp", cascade="all, delete")



class PPMPProject(Base):
    """
    One procurement project row in the PPMP.
    A project can have multiple lots (PPMPLot).
    Column 1 = description, Col 2 = project_type, etc.
    """
    __tablename__ = "ppmp_projects"

    id                  = Column(Integer, primary_key=True, index=True)
    ppmp_id             = Column(Integer, ForeignKey("ppmps.id"), nullable=False)
    order_no            = Column(Integer, default=1)
    description         = Column(Text, nullable=False)   # Col 1
    project_type        = Column(String, default="Goods") # Col 2: Goods | Infrastructure | Consulting
    procurement_mode    = Column(String)                  # Col 4
    pre_proc_conference = Column(String, default="No")    # Col 5: Yes | No | N/A
    start_activity      = Column(String)                  # Col 6: MM/YYYY
    end_activity        = Column(String)                  # Col 7: MM/YYYY
    delivery_period     = Column(String)                  # Col 8: MM/YYYY or range
    source_of_funds     = Column(String, default="GoP")   # Col 9
    supporting_docs     = Column(Text)                    # Col 11
    remarks             = Column(Text)                    # Col 12

    ppmp = relationship("PPMP", back_populates="projects")
    lots = relationship("PPMPLot", back_populates="project", cascade="all, delete")

class PPMPLot(Base):
    """
    Each lot under a project. Col 3 = quantity_size + estimated_budget (Col 10).
    Multiple lots share the same Col 1 description (shown merged in print).
    """
    __tablename__ = "ppmp_lots"

    id               = Column(Integer, primary_key=True, index=True)
    project_id       = Column(Integer, ForeignKey("ppmp_projects.id"), nullable=False)
    lot_no           = Column(String)      # e.g. "Lot 1", "Lot 2"
    quantity_size    = Column(Text)        # Col 3: full text description of qty and size
    estimated_budget = Column(Float, default=0)  # Col 10

    project = relationship("PPMPProject", back_populates="lots")
