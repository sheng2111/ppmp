from fastapi import APIRouter, HTTPException
from beanie import PydanticObjectId
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.models.ppmp import PPMP
from app.models.pr import PurchaseRequest, PRItem
from app.models.user import User
from app.models.fee_category_office import FeeCategoryOffice
from app.services.sequence import generate_pr_number, generate_stock_property_numbers
from app.services.signatory import resolve_signatories, SIGNATORY_THRESHOLD

router = APIRouter(prefix="/prs", tags=["purchase-requests"])

QUARTER_FIELD = {1: "q1_qty", 2: "q2_qty", 3: "q3_qty", 4: "q4_qty"}
FUND_CLUSTER_OPTIONS = {"GAA", "STF"}


class PRItemCreate(BaseModel):
    ppmp_entry_id: str
    ppmp_item_id: str
    requested_quantity: float
    assigned_lot: str


class PRCreate(BaseModel):
    ppmp_id: str
    purpose: Optional[str] = None

    # Optional so this schema stays valid for callers that don't send it
    # yet (e.g. EditPRPage, until it's ported to the redesigned flow).
    # When provided, it MUST be 1-4 (validated below) and drives
    # quarter-aware remaining-balance checks; when omitted, validation
    # falls back to the original aggregate behavior against item.quantity.
    quarter: Optional[int] = None

    # "GAA" or "STF" — validated in the router (not here) so the error
    # message can be specific; None only for legacy compatibility, same
    # reasoning as quarter above.
    fund_cluster: Optional[str] = None

    end_user_name: Optional[str] = None
    end_user_designation: Optional[str] = None

    items: List[PRItemCreate]


PRUpdate = PRCreate


async def _resolve_requester(requester_uid: Optional[str]):
    """Returns (my_id, is_admin) for a Supabase requester_uid.

    Mirrors _resolve_requester in app/routers/ppmps.py. `my_id` is the
    Mongo id (string) of the User row, which is what PurchaseRequest.
    created_by actually stores; `is_admin` is whether that row is an
    admin. Both are falsy/None when requester_uid is missing or doesn't
    resolve to a real User — callers must treat that as "not a valid
    authenticated user" and refuse to act.
    """
    if not requester_uid:
        return None, False
    user = await User.find_one(User.supabase_uid == requester_uid)
    if not user:
        return None, False
    return str(user.id), user.role == "admin"


def _require_owner(pr: PurchaseRequest, my_id: Optional[str], is_admin: bool) -> None:
    """Gate for arrival confirmation.

    ONLY the user who created a PR may mark its items as arrived. Admins
    get no special override here: the requirement is explicit that an
    admin must not be able to falsely mark another user's items as
    arrived. my_id must match the PR's creator exactly.
    """
    if not my_id or str(pr.created_by) != my_id:
        raise HTTPException(
            status_code=403,
            detail="Only the user who created this Purchase Request can update item arrival status.",
        )


def _flatten_ppmp_items(ppmp: PPMP) -> dict:
    flat = {}
    for project in ppmp.projects:
        for entry in project.entries:
            for item in entry.items:
                flat[item.id] = item
    return flat


def _ppmp_items_by_entry(ppmp: PPMP) -> dict:
    """Index a PPMP's items by their entry id.

    Entry ids are stable across PPMP edits; individual item ids are not
    (an edit rebuilds the item objects). PR items store the item id that
    existed when the PR was created, so lookups keyed on that id alone
    miss after the PPMP has been edited. Grouping by the entry id gives
    the fallback chain in _resolve_current_item a small candidate set.
    """
    by_entry: dict = {}
    for project in ppmp.projects:
        for entry in project.entries:
            for item in entry.items:
                by_entry.setdefault(entry.id, []).append(item)
    return by_entry


def _resolve_current_item(by_entry: dict, pr: PurchaseRequest, pr_item: PRItem):
    """Re-link a PR item to the PPMP item it currently points at.

    Mirror of the resolution in /ppmps/{ppmp_id}/pr-item-ids and the
    edit-PPMP guard: exact id first, then entry + PR-quarter quantity,
    then entry + any-quarter quantity, then the first item in the entry.
    Returns None only when the item's entry no longer exists at all.
    """
    candidates = by_entry.get(pr_item.ppmp_entry_id, [])
    for ppmp_item in candidates:
        if ppmp_item.id == pr_item.ppmp_item_id:
            return ppmp_item
    q_field = QUARTER_FIELD.get(pr.quarter, "q1_qty")
    for ppmp_item in candidates:
        q_val = float(getattr(ppmp_item, q_field, 0) or 0)
        if abs(q_val - float(pr_item.requested_quantity)) < 0.001:
            return ppmp_item
    for ppmp_item in candidates:
        q_vals = [
            float(getattr(ppmp_item, f, 0) or 0)
            for f in ("q1_qty", "q2_qty", "q3_qty", "q4_qty")
        ]
        if any(abs(qv - float(pr_item.requested_quantity)) < 0.001 for qv in q_vals):
            return ppmp_item
    return candidates[0] if candidates else None


def _ensure_ppmp_usable_for_pr(ppmp: PPMP) -> None:
    """
    Guards against creating/editing a PR against a PPMP that shouldn't be
    used for one anymore — most importantly, one that has been archived,
    or one that is not yet FINAL.

    Only FINAL PPMPs can be used for PR creation. Indicative PPMPs are
    excluded from PR eligibility.
    """
    is_archived = getattr(ppmp, "status", None) == "archived"
    if is_archived:
        raise HTTPException(
            status_code=400,
            detail="This PPMP has been archived and can no longer be used to create or edit a Purchase Request.",
        )

    ppmp_type = getattr(ppmp, "ppmp_type", None)
    if ppmp_type != "final":
        raise HTTPException(
            status_code=400,
            detail="Only FINAL PPMPs can be used to create a Purchase Request. This PPMP is currently INDICATIVE.",
        )


def _compute_grand_total(ppmp: PPMP, items: List[PRItemCreate]) -> float:
    ppmp_items = _flatten_ppmp_items(ppmp)
    total = 0.0
    for item in items:
        source = ppmp_items.get(item.ppmp_item_id)
        unit_price = source.unit_price if source else 0
        total += item.requested_quantity * unit_price
    return total


def _require_end_user_when_below_threshold(
    grand_total: float, end_user_name: Optional[str]
) -> None:
    if grand_total < SIGNATORY_THRESHOLD and not (end_user_name and end_user_name.strip()):
        raise HTTPException(
            status_code=400,
            detail="Requested By name is required for purchase requests below ₱50,000.00.",
        )


def _enrich_pr(pr: PurchaseRequest, ppmp: Optional[PPMP]) -> dict:
    ppmp_items_by_entry = _ppmp_items_by_entry(ppmp) if ppmp else {}

    enriched_items = []
    for pr_item in pr.items:
        # Same re-link as get_my_prd_items: the id stored on the PR can be
        # stale after a PPMP edit, so resolve against the CURRENT PPMP.
        source = _resolve_current_item(ppmp_items_by_entry, pr, pr_item)
        enriched_items.append(
            {
                "ppmp_entry_id": pr_item.ppmp_entry_id,
                "ppmp_item_id": (
                    source.id if source else pr_item.ppmp_item_id
                ),
                "stored_ppmp_item_id": pr_item.ppmp_item_id,
                "stock_property_no": pr_item.stock_property_no,
                "item_name": source.item_name if source else "(item no longer in PPMP)",
                "unit": source.unit if source else "",
                "unit_price": source.unit_price if source else 0,
                "requested_quantity": pr_item.requested_quantity,
                "assigned_lot": pr_item.assigned_lot,
                "total_cost": pr_item.requested_quantity * (source.unit_price if source else 0),
                # ── Item arrival confirmation (see PRItem model) ──
                "is_arrived": bool(pr_item.is_arrived),
                "arrival_date": pr_item.arrival_date,
            }
        )

    lots: dict = {}
    for item in enriched_items:
        lots.setdefault(item["assigned_lot"], []).append(item)

    grand_total = sum(i["total_cost"] for i in enriched_items)

    return {
        "id": str(pr.id),
        "ppmp_id": str(pr.ppmp_id),
        "ppmp_no": ppmp.ppmp_no if ppmp else None,
        "office_id": str(ppmp.office_id) if ppmp and ppmp.office_id else None,
        "pr_number": pr.pr_number,
        "quarter": pr.quarter,
        "fund_cluster": pr.fund_cluster,
        "date": pr.date,
        "status": pr.status,
        "purpose": pr.purpose,
        "end_user_name": pr.end_user_name,
        "end_user_designation": pr.end_user_designation,
        "requested_by_name": pr.requested_by_name,
        "requested_by_designation": pr.requested_by_designation,
        "approved_by_name": pr.approved_by_name,
        "approved_by_designation": pr.approved_by_designation,
        "bac_secretariat_chairman_name": pr.bac_secretariat_chairman_name,
        "bac_secretariat_chairman_designation": pr.bac_secretariat_chairman_designation,
        "budget_officer_name": pr.budget_officer_name,
        "budget_officer_designation": pr.budget_officer_designation,
        "items": enriched_items,
        "lots": [{"label": label, "items": items} for label, items in lots.items()],
        "grand_total": grand_total,
        "created_at": pr.created_at,
        "updated_at": pr.updated_at,
    }


def _validate_items(
    ppmp: PPMP,
    items: List[PRItemCreate],
    existing_prs: list,
    exclude_pr_id: Optional[PydanticObjectId] = None,
    quarter: Optional[int] = None,
) -> None:
    """Shared validation for create and update.

    When `quarter` is given (1-4): each item's cap is that quarter's
    PPMP quantity (q1_qty..q4_qty), and "already requested" only counts
    OTHER PRs made for the SAME quarter — a PR against Q1 never reduces
    what's available in Q2 for the same item, since they're independent
    allocations. This is what makes the redesigned Create flow's
    "Available: X" balance accurate per quarter.

    When `quarter` is None (legacy path — e.g. a caller that hasn't been
    updated to send it yet): behaves exactly as before this feature
    existed — cap is the item's aggregate `quantity`, and "already
    requested" sums across ALL existing PRs for this PPMP regardless of
    quarter. This keeps any not-yet-updated caller working unchanged.
    """
    if not items:
        raise HTTPException(status_code=400, detail="Select at least one item.")

    seen_ids = set()
    for item in items:
        if item.ppmp_item_id in seen_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Item {item.ppmp_item_id} was selected more than once.",
            )
        seen_ids.add(item.ppmp_item_id)

    for item in items:
        if not item.assigned_lot.strip():
            raise HTTPException(
                status_code=400,
                detail="Every selected item must be assigned to a lot.",
            )

    ppmp_items = _flatten_ppmp_items(ppmp)
    already_requested: dict = {}
    for other_pr in existing_prs:
        if exclude_pr_id and other_pr.id == exclude_pr_id:
            continue
        if quarter is not None and other_pr.quarter != quarter:
            # Different quarter's allocation — doesn't compete with this
            # request's balance.
            continue
        for it in other_pr.items:
            already_requested[it.ppmp_item_id] = (
                already_requested.get(it.ppmp_item_id, 0) + it.requested_quantity
            )

    quarter_field = QUARTER_FIELD.get(quarter) if quarter is not None else None

    for item in items:
        source_item = ppmp_items.get(item.ppmp_item_id)
        if not source_item:
            raise HTTPException(
                status_code=400,
                detail=f"Item {item.ppmp_item_id} does not belong to the selected PPMP.",
            )
        if item.requested_quantity <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"Requested quantity for {source_item.item_name} must be greater than 0.",
            )

        cap = (
            getattr(source_item, quarter_field, 0)
            if quarter_field
            else source_item.quantity
        )
        remaining = cap - already_requested.get(item.ppmp_item_id, 0)
        if item.requested_quantity > remaining:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Requested quantity for {source_item.item_name} "
                    f"({item.requested_quantity}) exceeds what's remaining "
                    f"{'for Q' + str(quarter) + ' ' if quarter else ''}"
                    f"in the PPMP ({remaining})."
                ),
            )


@router.get("/")
async def get_prs(
    created_by: Optional[str] = None,
    requester_uid: Optional[str] = None,
):
    query = {}
    if created_by:
        query["created_by"] = PydanticObjectId(created_by)

    prs = await PurchaseRequest.find(query).to_list()

    # Ownership hardening for "my PRs" style listing: when the caller is
    # identified (requester_uid), never return another user's PRs. This
    # keeps the endpoint safe even if a caller stops passing created_by.
    if requester_uid:
        my_id, is_admin = await _resolve_requester(requester_uid)
        if not my_id:
            raise HTTPException(status_code=401, detail="Invalid authenticated user.")
        if not is_admin:
            prs = [pr for pr in prs if str(pr.created_by) == my_id]

    ppmp_cache: dict = {}
    result = []
    for pr in prs:
        if pr.ppmp_id not in ppmp_cache:
            ppmp_cache[pr.ppmp_id] = await PPMP.get(pr.ppmp_id)
        result.append(_enrich_pr(pr, ppmp_cache[pr.ppmp_id]))

    return result


# ── "My PR'd Items" — flattened, owner-scoped item list ──────────────────────
# NOTE: this route MUST stay above the "/{pr_id}" catch-all below.
@router.get("/my-items")
async def get_my_prd_items(requester_uid: Optional[str] = None):
    """Every PR item belonging to purchase requests created by the caller,
    flattened into one list so the frontend can render/search/filter it
    without re-walking nested PR structures.

    Ownership is enforced here, not on the frontend: my_id comes from
    resolving requester_uid against the users collection, and only PRs
    whose created_by == my_id are considered. Another user's PR items are
    never exposed.
    """
    my_id, is_admin = await _resolve_requester(requester_uid)
    if not my_id:
        raise HTTPException(status_code=401, detail="Invalid authenticated user.")

    prs = await PurchaseRequest.find(
        PurchaseRequest.created_by == PydanticObjectId(my_id)
    ).to_list()
    prs.sort(key=lambda p: p.created_at, reverse=True)

    ppmp_cache: dict = {}
    office_cache: dict = {}
    result: list = []
    for pr in prs:
        ppmp = ppmp_cache.get(str(pr.ppmp_id))
        if ppmp is None:
            ppmp = await PPMP.get(pr.ppmp_id)
            ppmp_cache[str(pr.ppmp_id)] = ppmp
        ppmp_items_by_entry = _ppmp_items_by_entry(ppmp) if ppmp else {}

        # End-User / Unit for THIS PR's PPMP, resolved once per PPMP from
        # the FeeCategoryOffice record its office_id points at (the same
        # relationship PPMP Edit and the dashboard's officeMap use) — never
        # a global value.
        office_name = None
        if ppmp and ppmp.office_id:
            office_key = str(ppmp.office_id)
            if office_key not in office_cache:
                try:
                    office = await FeeCategoryOffice.get(
                        PydanticObjectId(ppmp.office_id)
                    )
                except Exception:
                    office = None
                office_cache[office_key] = office.name if office else None
            office_name = office_cache[office_key]

        for pr_item in pr.items:
            # Re-resolve against the CURRENT PPMP: the id stored on the PR
            # may be stale if the PPMP was edited after the PR was created.
            source = _resolve_current_item(ppmp_items_by_entry, pr, pr_item)
            resolved_id = source.id if source else pr_item.ppmp_item_id
            result.append(
                {
                    "id": f"{str(pr.id)}::{pr_item.ppmp_item_id}",
                    "pr_id": str(pr.id),
                    # The exact PPMP this PR item came from — used by the
                    # dashboard's per-PPMP drill-down filter.
                    "ppmp_id": str(pr.ppmp_id),
                    # The id the item has in the PPMP RIGHT NOW, so the
                    # dashboard donut can link PR'd/arrived items back to
                    # the PPMP items it renders. Falls back to the stored
                    # id when the item's entry no longer exists.
                    "ppmp_item_id": resolved_id,
                    # The id the PR originally stored — arrival updates must
                    # address the PR item by THIS, since it's what the
                    # arrival PATCH matches against.
                    "stored_ppmp_item_id": pr_item.ppmp_item_id,
                    "ppmp_entry_id": pr_item.ppmp_entry_id,
                    "ppmp_no": ppmp.ppmp_no if ppmp else None,
                    "office_id": (
                        str(ppmp.office_id) if ppmp and ppmp.office_id else None
                    ),
                    "end_user_unit": office_name,
                    "pr_number": pr.pr_number,
                    "pr_date": pr.date,
                    "item_name": (
                        source.item_name if source else "(item no longer in PPMP)"
                    ),
                    "unit": source.unit if source else "",
                    "unit_price": source.unit_price if source else 0,
                    "category": source.category if source else None,
                    "stock_property_no": pr_item.stock_property_no,
                    "requested_quantity": pr_item.requested_quantity,
                    "amount": pr_item.requested_quantity
                    * (source.unit_price if source else 0),
                    # ── Arrival confirmation ──
                    "is_arrived": bool(pr_item.is_arrived),
                    "arrival_date": pr_item.arrival_date,
                }
            )

    return result


# ── Item arrival confirmation ────────────────────────────────────────────────
class ArrivalUpdate(BaseModel):
    is_arrived: bool


@router.patch("/{pr_id}/items/{ppmp_item_id}/arrival")
async def update_item_arrival(
    pr_id: str,
    ppmp_item_id: str,
    payload: ArrivalUpdate,
    requester_uid: Optional[str] = None,
):
    """Mark a single item of a PR as arrived (or undo that).

    CRITICAL: ownership is enforced server-side via _require_owner — only
    the user whose Mongo id == pr.created_by can change arrival status.
    Nobody else (including admins) can touch it.
    """
    my_id, is_admin = await _resolve_requester(requester_uid)
    if not my_id:
        raise HTTPException(status_code=401, detail="Invalid authenticated user.")

    try:
        pr_oid = PydanticObjectId(pr_id)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Purchase Request not found: {pr_id!r}")

    pr = await PurchaseRequest.get(pr_oid)
    if not pr:
        raise HTTPException(status_code=404, detail="Purchase Request not found")

    _require_owner(pr, my_id, is_admin)

    target = next((it for it in pr.items if it.ppmp_item_id == ppmp_item_id), None)
    if not target:
        raise HTTPException(
            status_code=404,
            detail="Item not found in this Purchase Request.",
        )

    target.is_arrived = payload.is_arrived
    target.arrival_date = datetime.utcnow() if payload.is_arrived else None

    await pr.save()

    return {
        "pr_id": str(pr.id),
        "pr_number": pr.pr_number,
        "ppmp_item_id": ppmp_item_id,
        "is_arrived": bool(target.is_arrived),
        "arrival_date": target.arrival_date,
    }


@router.get("/{pr_id}")
async def get_pr(pr_id: str):
    try:
        oid = PydanticObjectId(pr_id)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Purchase Request not found: {pr_id!r}")

    pr = await PurchaseRequest.get(oid)
    if not pr:
        raise HTTPException(status_code=404, detail="Purchase Request not found")

    ppmp = await PPMP.get(pr.ppmp_id)
    return _enrich_pr(pr, ppmp)


@router.post("/", response_model=None)
async def create_purchase_request(payload: PRCreate, created_by: Optional[str] = None):
    try:
        ppmp_oid = PydanticObjectId(payload.ppmp_id)
    except Exception:
        raise HTTPException(status_code=404, detail="PPMP not found")

    ppmp = await PPMP.get(ppmp_oid)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")

    # Reject up front if this PPMP is archived (or otherwise not usable) —
    # see _ensure_ppmp_usable_for_pr for why this can't be left to the
    # frontend alone.
    _ensure_ppmp_usable_for_pr(ppmp)

    if payload.quarter is not None and payload.quarter not in QUARTER_FIELD:
        raise HTTPException(status_code=400, detail="quarter must be 1, 2, 3, or 4.")

    fund_cluster = payload.fund_cluster.strip().upper() if payload.fund_cluster else None
    if fund_cluster is not None and fund_cluster not in FUND_CLUSTER_OPTIONS:
        raise HTTPException(status_code=400, detail="fund_cluster must be GAA or STF.")

    existing_prs = await PurchaseRequest.find(PurchaseRequest.ppmp_id == ppmp_oid).to_list()
    _validate_items(ppmp, payload.items, existing_prs, quarter=payload.quarter)

    grand_total = _compute_grand_total(ppmp, payload.items)
    end_user_name = payload.end_user_name.strip() if payload.end_user_name else None
    end_user_designation = (
        payload.end_user_designation.strip() if payload.end_user_designation else None
    )
    _require_end_user_when_below_threshold(grand_total, end_user_name)
    signatories = await resolve_signatories(grand_total, end_user_name, end_user_designation)

    pr_number = await generate_pr_number()
    stock_numbers = await generate_stock_property_numbers(len(payload.items))

    pr = PurchaseRequest(
        ppmp_id=ppmp_oid,
        pr_number=pr_number,
        quarter=payload.quarter,
        fund_cluster=fund_cluster,
        purpose=payload.purpose.strip() if payload.purpose and payload.purpose.strip() else None,
        end_user_name=end_user_name,
        end_user_designation=end_user_designation,
        requested_by_name=signatories["requested_by_name"],
        requested_by_designation=signatories["requested_by_designation"],
        approved_by_name=signatories["approved_by_name"],
        approved_by_designation=signatories["approved_by_designation"],
        bac_secretariat_chairman_name=signatories["bac_secretariat_chairman_name"],
        bac_secretariat_chairman_designation=signatories["bac_secretariat_chairman_designation"],
        budget_officer_name=signatories["budget_officer_name"],
        budget_officer_designation=signatories["budget_officer_designation"],
        items=[
            PRItem(
                ppmp_entry_id=i.ppmp_entry_id,
                ppmp_item_id=i.ppmp_item_id,
                requested_quantity=i.requested_quantity,
                assigned_lot=i.assigned_lot,
                stock_property_no=stock_no,
            )
            for i, stock_no in zip(payload.items, stock_numbers)
        ],
        created_by=PydanticObjectId(created_by) if created_by else None,
    )
    await pr.insert()
    return {"id": str(pr.id), "pr_number": pr.pr_number}


@router.put("/{pr_id}", response_model=None)
async def update_purchase_request(
    pr_id: str, payload: PRUpdate, updated_by: Optional[str] = None
):
    try:
        pr_oid = PydanticObjectId(pr_id)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Purchase Request not found: {pr_id!r}")

    pr = await PurchaseRequest.get(pr_oid)
    if not pr:
        raise HTTPException(status_code=404, detail="Purchase Request not found")

    try:
        ppmp_oid = PydanticObjectId(payload.ppmp_id)
    except Exception:
        raise HTTPException(status_code=404, detail="PPMP not found")

    ppmp = await PPMP.get(ppmp_oid)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")

    # Same guard as create — editing a PR to point at (or leave it
    # pointed at) an archived PPMP is just as invalid as creating one
    # against it in the first place.
    _ensure_ppmp_usable_for_pr(ppmp)

    if payload.quarter is not None and payload.quarter not in QUARTER_FIELD:
        raise HTTPException(status_code=400, detail="quarter must be 1, 2, 3, or 4.")

    payload_fund_cluster = (
        payload.fund_cluster.strip().upper() if payload.fund_cluster else None
    )
    if payload_fund_cluster is not None and payload_fund_cluster not in FUND_CLUSTER_OPTIONS:
        raise HTTPException(status_code=400, detail="fund_cluster must be GAA or STF.")
    # Same "omitted keeps what's already there" rule as quarter/end_user —
    # a caller that doesn't send fund_cluster doesn't accidentally clear it.
    effective_fund_cluster = payload_fund_cluster or pr.fund_cluster

    # A caller that doesn't send quarter at all (legacy Edit flow) keeps
    # whatever quarter this PR already had, rather than silently clearing
    # it — only an explicit quarter in the payload changes it.
    effective_quarter = payload.quarter if payload.quarter is not None else pr.quarter

    existing_prs = await PurchaseRequest.find(PurchaseRequest.ppmp_id == ppmp_oid).to_list()
    _validate_items(
        ppmp, payload.items, existing_prs, exclude_pr_id=pr_oid, quarter=effective_quarter
    )

    payload_end_user_name = payload.end_user_name.strip() if payload.end_user_name else None
    payload_end_user_designation = (
        payload.end_user_designation.strip() if payload.end_user_designation else None
    )
    effective_end_user_name = payload_end_user_name or pr.end_user_name
    effective_end_user_designation = payload_end_user_designation or pr.end_user_designation
    grand_total = _compute_grand_total(ppmp, payload.items)

    _require_end_user_when_below_threshold(grand_total, effective_end_user_name)
    signatories = await resolve_signatories(
        grand_total, effective_end_user_name, effective_end_user_designation
    )

    existing_stock_numbers = {
        item.ppmp_item_id: item.stock_property_no
        for item in pr.items
        if item.stock_property_no
    }
    existing_arrival = {
        item.ppmp_item_id: {
            "is_arrived": bool(item.is_arrived),
            "arrival_date": item.arrival_date,
        }
        for item in pr.items
    }
    needed = sum(1 for i in payload.items if i.ppmp_item_id not in existing_stock_numbers)
    fresh_numbers = iter(await generate_stock_property_numbers(needed) if needed else [])

    pr.ppmp_id = ppmp_oid
    pr.quarter = effective_quarter
    pr.fund_cluster = effective_fund_cluster
    pr.purpose = payload.purpose.strip() if payload.purpose and payload.purpose.strip() else None
    pr.end_user_name = effective_end_user_name
    pr.end_user_designation = effective_end_user_designation
    pr.requested_by_name = signatories["requested_by_name"]
    pr.requested_by_designation = signatories["requested_by_designation"]
    pr.approved_by_name = signatories["approved_by_name"]
    pr.approved_by_designation = signatories["approved_by_designation"]
    pr.bac_secretariat_chairman_name = signatories["bac_secretariat_chairman_name"]
    pr.bac_secretariat_chairman_designation = signatories["bac_secretariat_chairman_designation"]
    pr.budget_officer_name = signatories["budget_officer_name"]
    pr.budget_officer_designation = signatories["budget_officer_designation"]
    pr.items = [
        PRItem(
            ppmp_entry_id=i.ppmp_entry_id,
            ppmp_item_id=i.ppmp_item_id,
            requested_quantity=i.requested_quantity,
            assigned_lot=i.assigned_lot,
            stock_property_no=existing_stock_numbers.get(i.ppmp_item_id) or next(fresh_numbers),
            # Editing a PR must not wipe existing arrival confirmations for
            # items that stay in it.
            is_arrived=existing_arrival.get(i.ppmp_item_id, {}).get("is_arrived", False),
            arrival_date=existing_arrival.get(i.ppmp_item_id, {}).get("arrival_date", None),
        )
        for i in payload.items
    ]
    pr.updated_by = PydanticObjectId(updated_by) if updated_by else None
    pr.updated_at = datetime.utcnow()

    await pr.save()
    return {"id": str(pr.id), "pr_number": pr.pr_number}


@router.delete("/{pr_id}")
async def delete_purchase_request(pr_id: str):
    try:
        oid = PydanticObjectId(pr_id)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Purchase Request not found: {pr_id!r}")

    pr = await PurchaseRequest.get(oid)
    if not pr:
        raise HTTPException(status_code=404, detail="Purchase Request not found")

    await pr.delete()
    return {"id": pr_id, "deleted": True}