from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class PRItem(BaseModel):
    ppmp_entry_id: str
    ppmp_item_id: str
    requested_quantity: float
    assigned_lot: str

    # System-generated via services.sequence.generate_stock_property_numbers.
    stock_property_no: Optional[str] = None

    # ── Item arrival confirmation ──────────────────────────────────────────
    # Set ONLY by the user who created the PR (ownership enforced in
    # app/routers/pr_routes.py's PATCH .../items/{id}/arrival). `is_arrived`
    # is a simple boolean — there is deliberately NO procurement-progress
    # status here; the existing "Procurement Progress" donut is a separate
    # concept and stays untouched. `arrival_date` is recorded automatically
    # the moment the owner confirms arrival and cleared when un-confirmed.
    is_arrived: bool = False
    arrival_date: Optional[datetime] = None


class PurchaseRequest(Document):
    ppmp_id: PydanticObjectId
    pr_number: str

    # Which quarter (1-4) this PR's items were drawn from — set once per
    # PR at Step 2 of the redesigned Create flow, and applies to every
    # item in the PR (a PR is always "for" one quarter; requesting from a
    # different quarter for the same PPMP item is a SEPARATE PR). This is
    # what makes per-quarter remaining-balance tracking possible: see
    # _validate_items in app/routers/pr.py and get_ppmp_procurement_items
    # in app/routers/ppmps.py.
    #
    # Optional/nullable ONLY for backward compatibility with PRs created
    # before this field existed, and with any caller (e.g. an
    # not-yet-updated Edit page) that doesn't send it — those fall back to
    # the original aggregate (non-quarter-aware) validation behavior
    # rather than being rejected outright.
    quarter: Optional[int] = None

    # "GAA" or "STF" — chosen by the user in the wizard, printed on the
    # form's "Fund Cluster" line (see PRDetailPage.tsx). Optional/nullable
    # for the same reason quarter is: backward compatibility with PRs
    # created before this field existed.
    fund_cluster: Optional[str] = None

    date: datetime = Field(default_factory=datetime.utcnow)
    status: str = "draft"

    purpose: Optional[str] = None

    items: List[PRItem] = []

    end_user_name: Optional[str] = None
    end_user_designation: Optional[str] = None

    requested_by_name: Optional[str] = None
    requested_by_designation: Optional[str] = None
    approved_by_name: Optional[str] = None
    approved_by_designation: Optional[str] = None

    # Snapshotted at create/edit time from SignatorySettings, exactly like
    # requested_by_name/approved_by_name above — but with NO threshold
    # branch (see app/services/signatory.py): always the same two current
    # people, regardless of this PR's Grand Total. Rendered below the
    # item table, outside it, on the print view, on-screen detail page,
    # and Excel export.
    bac_secretariat_chairman_name: Optional[str] = None
    bac_secretariat_chairman_designation: Optional[str] = None
    budget_officer_name: Optional[str] = None
    budget_officer_designation: Optional[str] = None

    created_by: Optional[PydanticObjectId] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: Optional[PydanticObjectId] = None
    updated_at: Optional[datetime] = None

    class Settings:
        name = "purchase_requests"

    def items_by_lot(self) -> dict:
        grouped: dict = {}
        for item in self.items:
            grouped.setdefault(item.assigned_lot, []).append(item)
        return grouped