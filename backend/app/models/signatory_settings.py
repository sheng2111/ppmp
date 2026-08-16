from beanie import Document
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class PPMPBudgetSignatory(BaseModel):
    """A signatory entry for PPMP budget-based structures."""
    sign_off: str
    name: str = ""
    position: str
    order_no: int


class APPSignatoryConfig(BaseModel):
    """A signatory entry for APP configuration."""
    sign_off: str
    name: str = ""
    position: str
    order_no: int
    enabled: bool = True


class SignatorySettings(Document):

    key: str = "current"  # fixed, singleton lookup key — never anything else

    # ── PR Signatories (existing) ─────────────────────────────────────────
    campus_director_name: str = "Ariston O. Ronquillo, DM"
    campus_director_designation: str = "Campus Director"

    suc_president_name: str = "Nemesio G. Loayon, PhD"
    suc_president_designation: str = "SUC President III"

    bac_secretariat_chairman_name: str = "Nestle R. Amuray"
    bac_secretariat_chairman_designation: str = "BAC Secretariat Chairman"

    budget_officer_name: str = "Darlene Abigail T. Dabalos"
    budget_officer_designation: str = "Designate, Budget Officer"

    # ── PPMP Signatories (budget-based) ───────────────────────────────────
    # NOTE: "Prepared by" is NOT admin-configured. It is dynamically
    # populated from the current user's name and is always order_no=1.
    # Only the following admin-configured signatories are stored here.

    # Budget <= ₱100,000 signatories (admin-configured only, excludes Prepared by)
    ppmp_low_budget_signatories: List[PPMPBudgetSignatory] = [
        PPMPBudgetSignatory(sign_off="Checked & Reviewed by", position="Budget Officer", order_no=1),
        PPMPBudgetSignatory(sign_off="Approved by", position="Campus Director", order_no=2),
    ]
    # Budget >= ₱100,001 signatories (admin-configured only, excludes Prepared by)
    ppmp_high_budget_signatories: List[PPMPBudgetSignatory] = [
        PPMPBudgetSignatory(sign_off="Checked & Reviewed by", position="Budget Officer", order_no=1),
        PPMPBudgetSignatory(sign_off="Noted by", position="Campus Director", order_no=2),
        PPMPBudgetSignatory(sign_off="Approved by", position="University President III", order_no=3),
    ]

    # ── APP Signatories ───────────────────────────────────────────────────
    # NOTE: "Prepared by" is NOT admin-configured for APP. It is dynamically
    # populated from the source PPMP's Prepared By signatory when generating
    # the APP. Only the following admin-configured signatories are stored here.
    app_signatories: List[APPSignatoryConfig] = [
        APPSignatoryConfig(sign_off="Checked & Reviewed by", position="BAC Secretariat", order_no=1, enabled=True),
        APPSignatoryConfig(sign_off="Recommending Approval", position="BAC Chairperson", order_no=2, enabled=True),
        APPSignatoryConfig(sign_off="Recommending Approval", position="Campus Director", order_no=3, enabled=True),
        APPSignatoryConfig(sign_off="Approved by", position="University President III", order_no=4, enabled=True),
    ]

    updated_by: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "signatory_settings"