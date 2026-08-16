
from collections import defaultdict, OrderedDict
from typing import List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.models.ppmp import PPMP  # noqa: E402
from app.models.pr import PurchaseRequest  # noqa: E402
from beanie.operators import In

try:
    from app.services.offices import get_office_display_name  # type: ignore
except ImportError:  # pragma: no cover - fallback while wiring this in
    async def get_office_display_name(office_id: Optional[str]) -> Optional[str]:
        return office_id


router = APIRouter(prefix="/reports", tags=["reports"])


# ── Response schemas ─────────────────────────────────────────────────────────

class ItemizedItemOut(BaseModel):
    item_name: str
    unit: str
    unit_price: float

    q1_qty: float
    q2_qty: float
    q3_qty: float
    q4_qty: float
    total_quantity: float

    q1_amount: float
    q2_amount: float
    q3_amount: float
    q4_amount: float
    total_cost: float

  
    requested_quantity: float = 0.0  # total quantity already covered by any PR
    is_pr_requested: bool = False    # True as soon as any quantity has been PR'd

    ppmp_id: str
    ppmp_no: str
    entry_description: Optional[str] = None


class ProcurementCodeGroupOut(BaseModel):
    code: str
    items: List[ItemizedItemOut]

    subtotal_quantity: float
    subtotal_cost: float
    q1_subtotal_qty: float
    q2_subtotal_qty: float
    q3_subtotal_qty: float
    q4_subtotal_qty: float
    q1_subtotal_amount: float
    q2_subtotal_amount: float
    q3_subtotal_amount: float
    q4_subtotal_amount: float


class ItemizedListReportOut(BaseModel):
    fiscal_year: int
    office_id: Optional[str] = None
    office: Optional[str] = None
    ppmp_type: Optional[str] = None
    status: Optional[str] = None  # None means "all statuses"

    groups: List[ProcurementCodeGroupOut]

    grand_total_quantity: float
    grand_total_cost: float
    q1_grand_qty: float
    q2_grand_qty: float
    q3_grand_qty: float
    q4_grand_qty: float
    q1_grand_amount: float
    q2_grand_amount: float
    q3_grand_amount: float
    q4_grand_amount: float


# ── Helpers ──────────────────────────────────────────────────────────────────

def _num(val) -> float:
    """Coerce None/missing quantities to 0 without blowing up on bad data."""
    try:
        return float(val) if val is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def _round2(val: float) -> float:
    return round(val + 1e-9, 2)


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.get("/itemized-list", response_model=ItemizedListReportOut)
async def get_itemized_list_report(
    year: int = Query(..., description="Fiscal Year to report on"),
    office_id: Optional[str] = Query(
        None, description="Restrict to a single office. Omit for all offices."
    ),
    office_ids: Optional[str] = Query(
        None,
        description="Comma-separated office ids to aggregate together — e.g. "
        "every office a particular non-admin user has created PPMPs under. "
        "Takes precedence over office_id if both are given.",
    ),
    ppmp_type: Optional[str] = Query(
        None, description="'indicative' or 'final'. Omit for both."
    ),
    status: Optional[str] = Query(
        None,
        description="Optionally restrict to a single status (e.g. 'draft', "
        "'archived') if your PPMP model tracks one. Left as None by "
        "default so the report reflects every PPMP for the Fiscal Year — "
        "there's no separate approval step in this system, so filtering "
        "on status isn't required to see data.",
    ),
):
  
    query = PPMP.find(PPMP.year == year)
    if status:
        query = query.find(PPMP.status == status)
    office_id_list: List[str] = []
    if office_ids:
        office_id_list = [oid.strip() for oid in office_ids.split(",") if oid.strip()]
    if office_id_list:
        query = query.find(In(PPMP.office_id, office_id_list))
    elif office_id:
        query = query.find(PPMP.office_id == office_id)
    if ppmp_type:
        query = query.find(PPMP.ppmp_type == ppmp_type)

    ppmps = await query.to_list()

    # Procurement Code -> list of computed item rows.
    groups: "OrderedDict[str, list]" = defaultdict(list)

    for ppmp in ppmps:
        # Same join as GET /ppmps/{id}/procurement-items: sum every PR's
        # requested_quantity for this PPMP, keyed by the PPMPEntryItem id it
        # references, regardless of PR status.
        existing_prs = await PurchaseRequest.find(
            PurchaseRequest.ppmp_id == ppmp.id
        ).to_list()
        already_requested: dict = {}
        for pr in existing_prs:
            for pr_item in pr.items:
                already_requested[pr_item.ppmp_item_id] = (
                    already_requested.get(pr_item.ppmp_item_id, 0)
                    + pr_item.requested_quantity
                )

        for project in ppmp.projects:
            for entry in project.entries:
                code = (
                    getattr(entry, "category_description", None)
                    or getattr(entry, "category_id", None)
                    or "Uncategorized"
                )
                for item in entry.items:
                    q1 = _num(item.q1_qty)
                    q2 = _num(item.q2_qty)
                    q3 = _num(item.q3_qty)
                    q4 = _num(item.q4_qty)
                    unit_price = _num(item.unit_price)

                    total_quantity = q1 + q2 + q3 + q4
                    q1_amount = q1 * unit_price
                    q2_amount = q2 * unit_price
                    q3_amount = q3 * unit_price
                    q4_amount = q4 * unit_price
                    # Two equivalent ways to reach the same total, exactly
                    # as required: sum of quarterly amounts, and
                    # total_quantity * unit_price. Assert they match (up to
                    # floating point rounding) instead of silently trusting
                    # one of them.
                    total_cost_from_quarters = q1_amount + q2_amount + q3_amount + q4_amount
                    total_cost_from_total_qty = total_quantity * unit_price
                    total_cost = _round2(total_cost_from_total_qty)
                    assert abs(total_cost_from_quarters - total_cost_from_total_qty) < 0.01

                    requested_qty = _num(already_requested.get(item.id, 0))

                    groups[code].append(
                        ItemizedItemOut(
                            item_name=item.item_name,
                            unit=item.unit,
                            unit_price=_round2(unit_price),
                            q1_qty=q1,
                            q2_qty=q2,
                            q3_qty=q3,
                            q4_qty=q4,
                            total_quantity=total_quantity,
                            q1_amount=_round2(q1_amount),
                            q2_amount=_round2(q2_amount),
                            q3_amount=_round2(q3_amount),
                            q4_amount=_round2(q4_amount),
                            total_cost=total_cost,
                            requested_quantity=requested_qty,
                            is_pr_requested=requested_qty > 0,
                            ppmp_id=str(ppmp.id),
                            ppmp_no=ppmp.ppmp_no,
                            entry_description=getattr(entry, "description", None),
                        )
                    )

    group_outs: List[ProcurementCodeGroupOut] = []
    grand_total_quantity = 0.0
    grand_total_cost = 0.0
    q_grand_qty = [0.0, 0.0, 0.0, 0.0]
    q_grand_amount = [0.0, 0.0, 0.0, 0.0]

    for code in sorted(groups.keys()):
        items = groups[code]
        subtotal_quantity = sum(i.total_quantity for i in items)
        subtotal_cost = sum(i.total_cost for i in items)
        q_sub_qty = [
            sum(i.q1_qty for i in items),
            sum(i.q2_qty for i in items),
            sum(i.q3_qty for i in items),
            sum(i.q4_qty for i in items),
        ]
        q_sub_amount = [
            sum(i.q1_amount for i in items),
            sum(i.q2_amount for i in items),
            sum(i.q3_amount for i in items),
            sum(i.q4_amount for i in items),
        ]

        group_outs.append(
            ProcurementCodeGroupOut(
                code=code,
                items=items,
                subtotal_quantity=subtotal_quantity,
                subtotal_cost=_round2(subtotal_cost),
                q1_subtotal_qty=q_sub_qty[0],
                q2_subtotal_qty=q_sub_qty[1],
                q3_subtotal_qty=q_sub_qty[2],
                q4_subtotal_qty=q_sub_qty[3],
                q1_subtotal_amount=_round2(q_sub_amount[0]),
                q2_subtotal_amount=_round2(q_sub_amount[1]),
                q3_subtotal_amount=_round2(q_sub_amount[2]),
                q4_subtotal_amount=_round2(q_sub_amount[3]),
            )
        )

        grand_total_quantity += subtotal_quantity
        grand_total_cost += subtotal_cost
        for i in range(4):
            q_grand_qty[i] += q_sub_qty[i]
            q_grand_amount[i] += q_sub_amount[i]

    if office_id_list:
        names = [
            await get_office_display_name(oid) or oid for oid in office_id_list
        ]
        office_label = ", ".join(names)
    elif office_id:
        office_label = await get_office_display_name(office_id)
    else:
        office_label = None

    return ItemizedListReportOut(
        fiscal_year=year,
        office_id=office_id,
        office=office_label,
        ppmp_type=ppmp_type,
        status=status,
        groups=group_outs,
        grand_total_quantity=grand_total_quantity,
        grand_total_cost=_round2(grand_total_cost),
        q1_grand_qty=q_grand_qty[0],
        q2_grand_qty=q_grand_qty[1],
        q3_grand_qty=q_grand_qty[2],
        q4_grand_qty=q_grand_qty[3],
        q1_grand_amount=_round2(q_grand_amount[0]),
        q2_grand_amount=_round2(q_grand_amount[1]),
        q3_grand_amount=_round2(q_grand_amount[2]),
        q4_grand_amount=_round2(q_grand_amount[3]),
    )