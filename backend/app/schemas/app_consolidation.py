"""
Pydantic schemas for the Admin Consolidated APP view.

Pure READ/response models — nothing here is persisted.

Mirrors the Consolidated PPMP architecture: items from all offices under
a Fee Category are merged and grouped by APP category band (General
Requirements, Miscellaneous Items, CSE) — no office identification.
"""
from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field


class ConsolidatedAPPRowOut(BaseModel):
    row_key: str
    category: str
    project_title: str = ""
    general_description: str = ""
    procurement_mode: str = ""
    early_procurement: str = ""
    bid_evaluation: str = ""
    start_activity: str = ""
    end_activity: str = ""
    source_of_funds: str = ""
    estimated_budget: float = 0.0
    procurement_strategy: list[str] = []
    remarks: str = ""


class ConsolidatedAPPCategoryOut(BaseModel):
    name: str                        # internal key, e.g. "General Requirements"
    label: str                       # display label with RA reference etc.
    rows: list[ConsolidatedAPPRowOut]
    subtotal: float


class ConsolidatedAPPResponse(BaseModel):
    fee_category: str
    fiscal_year: int
    app_version_type: str            # "indicative" | "final" | "updated"
    categories: list[ConsolidatedAPPCategoryOut]
    grand_total: float
    ppmp_count: int                  # how many PPMPs contributed data
    generated_at: str
