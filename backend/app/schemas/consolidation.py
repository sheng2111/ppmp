"""
Pydantic schemas for the Admin Consolidated PPMP view.

Pure READ/response models — nothing here is persisted.

Matches the REAL app.models.ppmp shape (confirmed via mongosh against
live data):
- PPMP.office_id stores a FeeCategoryOffice._id directly (see
  consolidation_service.py for the full explanation).
- PPMPProject has no title field — only order_no, remarks,
  attached_document_title, supporting_docs, total_budget. Projects are
  labeled using order_no (or remarks, if present).
- PPMPEntry carries the full procurement detail set (project_type,
  procurement_mode, timeline fields, source_of_funds, etc.) — these are
  now passed through so the consolidated view can render the same table
  layout as PPMPDetailPage.tsx, not just a flattened item list.
- Each PPMP has its own description/additional_description/signatories.
  When an office has more than one matching PPMP for a given
  year/type, the FIRST one's meta fields (description, signatories,
  ppmp_no) are used to represent the office — consistent with the
  existing convention already used for ppmp_id/ppmp_no below.
"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class ConsolidationFilters(BaseModel):
    fee_category: str = Field(..., description="e.g. 'OJT Fees' — matched via FeeCategoryOffice, not entry text")
    fiscal_year: int = Field(..., description="Matched against PPMP.year")
    ppmp_type: str = Field(..., description="'indicative' or 'final'")
    search: Optional[str] = None


class ConsolidatedItemOut(BaseModel):
    item_name: str
    quantity: float
    unit: str
    unit_price: float
    total_cost: float


class ConsolidatedEntryOut(BaseModel):
    entry_id: str
    category_description: str        # e.g. "Spare Parts" — entry-level code, unrelated to Fee Category
    description: str                 # the entry's own specific description
    project_type: str = ""
    procurement_mode: str = ""
    pre_proc_conference: str = ""
    start_activity: str = ""
    end_activity: str = ""
    delivery_period: str = ""
    source_of_funds: str = ""
    items: list[ConsolidatedItemOut]
    entry_subtotal: float


class ConsolidatedProjectOut(BaseModel):
    project_id: str                   # synthesized as f"{ppmp_id}-{order_no}" — PPMPProject has no id of its own
    project_label: str                # e.g. "Project 1", or project.remarks if present
    remarks: Optional[str] = None
    attached_document_title: str = ""
    entries: list[ConsolidatedEntryOut]
    project_subtotal: float


class ConsolidatedSignatoryOut(BaseModel):
    sign_off: str
    name: str
    position: str
    order_no: int


class ConsolidatedOfficeOut(BaseModel):
    office_id: str
    office_name: str
    ppmp_id: str
    ppmp_no: Optional[str] = None
    ppmp_type: str
    fiscal_year: int
    description: str = ""
    additional_description: str = ""
    signatories: list[ConsolidatedSignatoryOut] = []
    projects: list[ConsolidatedProjectOut]
    office_total: float


class ConsolidatedPPMPResponse(BaseModel):
    fee_category: str
    fiscal_year: int
    ppmp_type: str
    offices: list[ConsolidatedOfficeOut]
    grand_total: float
    office_count: int
    generated_at: str