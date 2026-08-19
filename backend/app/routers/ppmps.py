import json
import os
import uuid
import traceback
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request, UploadFile
from beanie import PydanticObjectId

from app.models.ppmp import PPMP, PPMPProject, PPMPEntry, PPMPEntryItem, Signatory
from app.models.fee_category_office import FeeCategoryOffice
from app.models.fee_category import FeeCategory
from app.models.expense_category import ExpenseCategory
from app.models.pr import PurchaseRequest
from app.models.user import User
from app.schemas.ppmp import PPMPCreate, PPMPUpdate, PPMPOut
from app.services.notifications import create_ppmp_submitted_notification

router = APIRouter(prefix="/ppmps", tags=["ppmps"])

QUARTER_FIELD = {1: "q1_qty", 2: "q2_qty", 3: "q3_qty", 4: "q4_qty"}

# Entries whose category has no Lot Priority configured yet (or has no
# category at all) sort last rather than crashing the PR's lot ordering.
DEFAULT_LOT_PRIORITY = 999


async def _lot_priority_for(category_id: Optional[str], cache: dict) -> int:
    """Looks up ExpenseCategory.lot_priority for an entry's category_id,
    cached per-request since many entries across a PPMP often share the
    same category. NOTE: this is the per-ENTRY "PPMP Code" category
    (app.models.expense_category.ExpenseCategory) — a different model
    from FeeCategory/FeeCategoryOffice above, which is the office/org
    hierarchy used elsewhere in this file.
    """
    if not category_id:
        return DEFAULT_LOT_PRIORITY
    if category_id not in cache:
        priority = DEFAULT_LOT_PRIORITY
        try:
            category = await ExpenseCategory.get(category_id)
            if category and category.lot_priority is not None:
                priority = category.lot_priority
        except Exception:
            pass
        cache[category_id] = priority
    return cache[category_id]


# ── Draft visibility ─────────────────────────────────────────────────────────
# A PPMP with status "draft" is only visible to the user who created it, or
# to an admin. Once status moves past draft (submitted/approved), it's
# visible normally (e.g. so it can appear in the Admin Consolidated view).
# This mirrors the existing requester_uid pattern in auth.py's
# require_admin -- requester_uid is the Supabase uid, resolved here to the
# User's Mongo id (which is what PPMP.created_by actually stores) and role.

async def _resolve_requester(requester_uid: Optional[str]):
    """Returns (my_id, is_admin) for a requester_uid. Both are falsy/None
    if requester_uid is missing or doesn't match a real user -- callers
    should then treat the caller as anonymous (no draft access)."""
    if not requester_uid:
        return None, False
    user = await User.find_one(User.supabase_uid == requester_uid)
    if not user:
        return None, False
    return str(user.id), user.role == "admin"


def _can_view_ppmp(ppmp: PPMP, my_id: Optional[str], is_admin: bool) -> bool:
    if ppmp.status != "draft":
        return True
    if is_admin:
        return True
    return my_id is not None and ppmp.created_by == my_id

# ── File storage ────────────────────────────────────────────────────────────
# UPLOAD_DIR = Path("uploads") / "ppmp_attachments"
# UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR = Path("/tmp/ppmp_attachments") if os.getenv("VERCEL") else Path("uploads/ppmp_attachments")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_ATTACHMENT_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".png", ".jpg", ".jpeg", ".gif", ".webp",
}
MAX_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB per file


async def _save_attachment(file: UploadFile) -> str:
    """Persists one uploaded file to disk and returns the stored filename."""
    original_name = file.filename or "attachment"
    ext = Path(original_name).suffix.lower()
    if ext not in ALLOWED_ATTACHMENT_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported attachment type: {ext or 'unknown'}",
        )

    contents = await file.read()
    if len(contents) > MAX_ATTACHMENT_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"'{original_name}' exceeds the 15MB attachment size limit.",
        )

    stored_name = f"{uuid.uuid4().hex}_{original_name}"
    dest = UPLOAD_DIR / stored_name
    with open(dest, "wb") as f:
        f.write(contents)

    return stored_name


def _build_quantity_size(items: list) -> str:
    if not items:
        return ""
    return "\n".join(
        f"{i.item_name} - {i.quantity} {i.unit} x {i.unit_price:,.2f} = {i.total_cost:,.2f}"
        for i in items
    )


def _build_projects(projects_data: list, attachments_by_project: Optional[dict] = None) -> list:
    attachments_by_project = attachments_by_project or {}
    projects = []
    for p_idx, proj_data in enumerate(projects_data):
        entries = []
        for e_idx, entry_data in enumerate(proj_data.entries):
            entry_items = []
            estimated_budget = 0.0
            for item_data in entry_data.items:
                total = round(item_data.quantity * item_data.unit_price, 2)
                estimated_budget += total
                entry_items.append(PPMPEntryItem(
                    id=item_data.id or str(uuid.uuid4()),
                    item_name=item_data.item_name,
                    quantity=item_data.quantity,
                    unit=item_data.unit,
                    unit_price=item_data.unit_price,
                    total_cost=total,
                    q1_qty=item_data.q1_qty,
                    q2_qty=item_data.q2_qty,
                    q3_qty=item_data.q3_qty,
                    q4_qty=item_data.q4_qty,
                    category=item_data.category,
                    is_procurable=item_data.is_procurable,
                ))

            quantity_size = _build_quantity_size(entry_items)

            entries.append(PPMPEntry(
                id=entry_data.id or str(uuid.uuid4()),
                order_no=e_idx + 1,
                category_id=entry_data.category_id,
                category_description=entry_data.category_description,
                # ADDED — feeds Column 1 (Project Title) on the generated APP.
                project_title=entry_data.project_title,
                description=entry_data.description,
                project_type=entry_data.project_type,
                procurement_mode=entry_data.procurement_mode,
                pre_proc_conference=entry_data.pre_proc_conference,
                start_activity=entry_data.start_activity,
                end_activity=entry_data.end_activity,
                delivery_period=entry_data.delivery_period,
                source_of_funds=entry_data.source_of_funds,
                quantity_size=quantity_size,
                estimated_budget=round(estimated_budget, 2),
                items=entry_items,
            ))

        total_budget = round(sum(e.estimated_budget for e in entries), 2)

        stored_files = attachments_by_project.get(p_idx, [])
        supporting_docs = proj_data.supporting_docs or ""
        if stored_files:
            joined = ", ".join(stored_files)
            supporting_docs = f"{supporting_docs}, {joined}".strip(", ") if supporting_docs else joined

        projects.append(PPMPProject(
            order_no=p_idx + 1,
            remarks=proj_data.remarks,
            # ADDED — title of the supporting document for this project
            # (Purchase Request, BAC Resolution, Canvass, etc.). Title only.
            attached_document_title=proj_data.attached_document_title,
            supporting_docs=supporting_docs,
            total_budget=total_budget,
            entries=entries,
        ))
    return projects


async def _parse_create_request(request: Request):
    content_type = request.headers.get("content-type", "")

    if content_type.startswith("multipart/form-data"):
        form = await request.form()

        raw_payload = form.get("payload")
        if raw_payload is None:
            raise HTTPException(status_code=400, detail="Missing 'payload' field in form data.")
        try:
            payload = PPMPCreate(**json.loads(raw_payload))
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="'payload' was not valid JSON.")

        attachments_by_project: dict[int, list] = {}
        for key, value in form.multi_items():
            if not isinstance(value, UploadFile):
                continue
            parts = key.split("_")
            if len(parts) >= 2 and parts[0] == "project":
                try:
                    p_idx = int(parts[1])
                except ValueError:
                    continue
                stored_name = await _save_attachment(value)
                attachments_by_project.setdefault(p_idx, []).append(stored_name)

        return payload, attachments_by_project

    body = await request.json()
    return PPMPCreate(**body), {}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[PPMPOut])
async def get_ppmps(
    office_id: Optional[str] = None,
    created_by: Optional[str] = None,
    year: Optional[int] = None,
    status: Optional[str] = None,
    include_archived: bool = False,
    requester_uid: Optional[str] = None,
):
    query = {}
    if office_id:
        query["office_id"] = office_id
    if created_by:
        query["created_by"] = created_by
    if year:
        query["year"] = year
    if status:
        query["status"] = status
    if not include_archived:
        query["status"] = {"$ne": "archived"}

    ppmps = await PPMP.find(query).to_list()

    my_id, is_admin = await _resolve_requester(requester_uid)
    ppmps = [p for p in ppmps if _can_view_ppmp(p, my_id, is_admin)]

    # Enrich each PPMP with office_name and fee_category
    office_cache: dict[str, Optional[str]] = {}
    fee_category_cache: dict[str, Optional[str]] = {}

    result = []
    for p in ppmps:
        office_name = None
        fee_category = None
        if p.office_id:
            # Get office name from FeeCategoryOffice
            if p.office_id in office_cache:
                office_name = office_cache[p.office_id]
            else:
                try:
                    office = await FeeCategoryOffice.get(PydanticObjectId(p.office_id))
                    office_name = office.name if office else None
                except Exception as e:
                    print(f"[get_ppmps] Failed to fetch office for office_id={p.office_id}: {e}")
                    office_name = None
                office_cache[p.office_id] = office_name

            # Get fee category name
            fee_category = await _fee_category_name_for_office(
                p.office_id, fee_category_cache
            )

        ppmp_dict = p.model_dump()
        ppmp_dict["office_name"] = office_name
        ppmp_dict["fee_category"] = fee_category
        result.append(ppmp_dict)

    return result


@router.get("/summary/stats")
async def get_stats(
    office_id: Optional[str] = None,
    created_by: Optional[str] = None,
):
    query = {}
    if office_id:
        query["office_id"] = office_id
    if created_by:
        query["created_by"] = created_by

    ppmps = await PPMP.find(query).to_list()
    total_budget = 0
    draft = 0
    submitted = 0
    approved = 0
    archived = 0
    indicative = 0
    final = 0

    for p in ppmps:
        if p.status == "archived":
            archived += 1
        else:
            draft += 1 if p.status == "draft" else 0
            submitted += 1 if p.status == "submitted" else 0
            approved += 1 if p.status == "approved" else 0
            if p.ppmp_type == "indicative":
                indicative += 1
            elif p.ppmp_type == "final":
                final += 1
            for proj in p.projects:
                for entry in proj.entries:
                    total_budget += entry.estimated_budget or 0

    return {
        "total_ppmps": draft + submitted + approved,
        "draft": draft,
        "submitted": submitted,
        "approved": approved,
        "archived": archived,
        "indicative": indicative,
        "final": final,
        "total_budget": total_budget,
    }


# ── PR-generation support ────────────────────────────────────────────────────
# IMPORTANT: these routes must stay ABOVE the "/{ppmp_id}" catch-all below.

async def _fee_category_name_for_office(
    office_id: Optional[str], cache: dict
) -> Optional[str]:
    """Looks up the Fee Category name for a PPMP's office_id, via
    office_id -> FeeCategoryOffice -> FeeCategory. PPMP itself has no
    fee-category field, so this is a join done here rather than a stored
    column — cached per-request since many PPMPs share the same office.
    """
    if not office_id:
        return None
    if office_id in cache:
        return cache[office_id]

    name = None
    try:
        office = await FeeCategoryOffice.get(PydanticObjectId(office_id))
        if office:
            category = await FeeCategory.get(office.fee_category_id)
            name = category.name if category else None
    except Exception:
        name = None

    cache[office_id] = name
    return name


@router.get("/eligible-for-pr")
async def get_eligible_ppmps(
    office_id: Optional[str] = None,
    requester_uid: Optional[str] = None,
):
    """List of PPMPs a PR can be generated from. `office_id` narrows this
    to one office's PPMPs (Step 1 of the redesigned Create PR flow) —
    omitted entirely, it behaves exactly as before (every PPMP), so this
    stays backward compatible for any caller that doesn't pass it.

    Ownership: when requester_uid is supplied and the caller is not an
    admin, only PPMPs the caller created are returned. Without this, an
    office selector would surface PPMPs other users created under the
    same office (each FeeCategoryOffice id is shared across users), which
    is exactly the "2 PPMPs for my 1 PPMP office" bug this guard fixes.

    FINAL-ONLY rule: only PPMPs with ppmp_type == "final" can be used
    to create a Purchase Request. Indicative PPMPs are excluded.
    """
    query = {
        "status": {"$ne": "archived"},
        "ppmp_type": "final",
    }
    if office_id:
        query["office_id"] = office_id

    my_id, is_admin = await _resolve_requester(requester_uid)
    if my_id and not is_admin:
        # PPMP.created_by is stored as a plain string id (see _can_view_ppmp),
        # unlike PurchaseRequest.created_by which is an ObjectId.
        query["created_by"] = my_id

    ppmps = await PPMP.find(query).to_list()

    fee_category_cache: dict[str, Optional[str]] = {}
    result = []
    for p in ppmps:
        result.append(
            {
                "id": str(p.id),
                "ppmp_no": p.ppmp_no,
                "ppmp_type": p.ppmp_type,
                "year": p.year,
                "office_id": p.office_id,
                "fee_category": await _fee_category_name_for_office(
                    p.office_id, fee_category_cache
                ),
                "status": p.status,
                "created_at": p.created_at,
            }
        )
    return result


@router.get("/offices-by-user")
async def get_offices_by_user(requester_uid: Optional[str] = None):
    my_id, is_admin = await _resolve_requester(requester_uid)

    query: dict = {"status": {"$ne": "archived"}}
    if my_id and not is_admin:
        query["created_by"] = my_id

    ppmps = await PPMP.find(query).to_list()

    seen_office_ids: dict[str, set] = {}
    result: dict[str, list] = {}
    office_cache: dict[str, Optional[FeeCategoryOffice]] = {}

    for p in ppmps:
        if not p.created_by or not p.office_id:
            continue

        user_offices = seen_office_ids.setdefault(p.created_by, set())
        if p.office_id in user_offices:
            continue
        user_offices.add(p.office_id)

        if p.office_id not in office_cache:
            try:
                oid = PydanticObjectId(p.office_id)
                office_cache[p.office_id] = await FeeCategoryOffice.get(oid)
            except Exception:
                office_cache[p.office_id] = None

        office = office_cache[p.office_id]
        if office is None:
            continue

        result.setdefault(p.created_by, []).append(
            {"id": str(office.id), "name": office.name}
        )

    return result


@router.get("/{ppmp_id}/procurement-items")
async def get_ppmp_procurement_items(ppmp_id: str, quarter: Optional[int] = None):
    """Items available to request from this PPMP.

    `quarter` (1-4) is OPTIONAL and additive:
      - Omitted: exact original behavior — item.quantity is the cap,
        "remaining" is computed against ALL existing PRs for this PPMP
        regardless of quarter, and the response uses "quantity". This is
        what any not-yet-updated caller (e.g. the current EditPRPage)
        keeps getting, unchanged.
      - Provided: quarter-aware — the cap is that quarter's q{N}_qty,
        "remaining" only counts existing PRs made for the SAME quarter
        (see PurchaseRequest.quarter), items with a zero quantity for
        that quarter are left out entirely (per spec), and the response
        uses "quarter_quantity" instead of "quantity".
    """
    if quarter is not None and quarter not in QUARTER_FIELD:
        raise HTTPException(status_code=400, detail="quarter must be 1, 2, 3, or 4.")

    ppmp = await PPMP.get(ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")

    oid = PydanticObjectId(ppmp_id)

    existing_prs = await PurchaseRequest.find(PurchaseRequest.ppmp_id == oid).to_list()
    if quarter is not None:
        existing_prs = [pr for pr in existing_prs if pr.quarter == quarter]

    already_requested: dict = {}
    for pr in existing_prs:
        for item in pr.items:
            already_requested[item.ppmp_item_id] = (
                already_requested.get(item.ppmp_item_id, 0) + item.requested_quantity
            )

    quarter_field = QUARTER_FIELD.get(quarter) if quarter is not None else None

    category_priority_cache: dict[str, int] = {}

    result = []
    for project in ppmp.projects:
        for entry in project.entries:
            entry_items = []
            for item in entry.items:
                if quarter_field:
                    cap = getattr(item, quarter_field, 0) or 0
                    if cap <= 0:
                        # Spec: only show items with quantity > 0 for the
                        # selected quarter.
                        continue
                else:
                    cap = item.quantity

                requested_so_far = already_requested.get(item.id, 0)
                remaining = max(0, cap - requested_so_far)

                row = {
                    "id": item.id,
                    "item_name": item.item_name,
                    "unit": item.unit,
                    "unit_price": item.unit_price,
                    "remaining_quantity": remaining,
                    # Item-level category — more granular than the entry's
                    # category_description below. Both are included since
                    # the frontend's Category filter currently groups by
                    # entry; switch it to this field if per-item category
                    # turns out to be the more useful grouping.
                    "category": item.category,
                    # Informational only — PR intentionally shows both
                    # procurable and non-procurable items, unlike the APP.
                    "is_procurable": item.is_procurable,
                }
                if quarter_field:
                    row["quarter_quantity"] = cap
                else:
                    row["quantity"] = cap
                entry_items.append(row)

            if not entry_items:
                continue

            result.append(
                {
                    "entry_id": entry.id,
                    "label": entry.category_description or entry.description,
                    "category": entry.category_description,
                    # ADDED — drives dynamic LOT A/B/C ordering on the PR
                    # creation page. See _lot_priority_for above.
                    "lot_priority": await _lot_priority_for(
                        entry.category_id, category_priority_cache
                    ),
                    "allocated_budget": entry.estimated_budget,
                    "item_count": len(entry_items),
                    "items": entry_items,
                }
            )

    return {
        "ppmp_id": str(ppmp.id),
        "ppmp_no": ppmp.ppmp_no,
        "quarter": quarter,
        "projects": result,
    }


@router.get("/{ppmp_id}", response_model=PPMPOut)
async def get_ppmp(ppmp_id: str, requester_uid: Optional[str] = None):
    ppmp = await PPMP.get(ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")

    my_id, is_admin = await _resolve_requester(requester_uid)
    if not _can_view_ppmp(ppmp, my_id, is_admin):
        raise HTTPException(
            status_code=403,
            detail="This PPMP is still a draft and is only visible to its creator or an admin.",
        )
    return ppmp


@router.get("/{ppmp_id}/has-prs")
async def ppmp_has_prs(ppmp_id: str):
    ppmp = await PPMP.get(ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")
    oid = PydanticObjectId(ppmp_id)
    pr_count = await PurchaseRequest.find(PurchaseRequest.ppmp_id == oid).count()
    return {"has_prs": pr_count > 0, "pr_count": pr_count}


@router.get("/{ppmp_id}/pr-item-ids")
async def ppmp_pr_item_ids(ppmp_id: str):
    try:
        ppmp = await PPMP.get(ppmp_id)
        if not ppmp:
            raise HTTPException(status_code=404, detail="PPMP not found")
        oid = PydanticObjectId(ppmp_id)
        prs = await PurchaseRequest.find(PurchaseRequest.ppmp_id == oid).to_list()

        ppmp_items_by_entry: dict = {}
        for proj in (ppmp.projects or []):
            for entry in (proj.entries or []):
                for item in (entry.items or []):
                    ppmp_items_by_entry.setdefault(entry.id, []).append(item)

        locked_ids = set()
        locked_entries = set()
        locked_quarters: dict = {}

        for pr in prs:
            pr_q = f"Q{pr.quarter}" if pr.quarter else "Q1"
            pr_q_field = f"q{pr.quarter or 1}_qty" if pr.quarter else "q1_qty"
            for pr_item in pr.items:
                locked_entries.add(pr_item.ppmp_entry_id)
                resolved_id = None
                candidates = ppmp_items_by_entry.get(pr_item.ppmp_entry_id, [])
                for ppmp_item in candidates:
                    if ppmp_item.id == pr_item.ppmp_item_id:
                        resolved_id = ppmp_item.id
                        break
                if not resolved_id:
                    for ppmp_item in candidates:
                        pr_q_val = float(getattr(ppmp_item, pr_q_field, 0) or 0)
                        if abs(pr_q_val - float(pr_item.requested_quantity)) < 0.001:
                            resolved_id = ppmp_item.id
                            break
                if not resolved_id:
                    for ppmp_item in candidates:
                        q_vals = [float(getattr(ppmp_item, f, 0) or 0) for f in ("q1_qty", "q2_qty", "q3_qty", "q4_qty")]
                        if any(abs(qv - float(pr_item.requested_quantity)) < 0.001 for qv in q_vals):
                            resolved_id = ppmp_item.id
                            break
                if not resolved_id and candidates:
                    resolved_id = candidates[0].id
                if resolved_id:
                    locked_ids.add(resolved_id)
                    locked_quarters.setdefault(resolved_id, set()).add(pr_q)

        return {
            "locked_item_ids": sorted(locked_ids),
            "locked_entry_ids": sorted(locked_entries),
            "locked_quarters": {k: sorted(v) for k, v in locked_quarters.items()},
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=PPMPOut)
async def create_ppmp(
    request: Request,
    office_id: str,
    created_by: str,
):
    try:
        oid = PydanticObjectId(office_id)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid office_id: {office_id!r}")
    office = await FeeCategoryOffice.get(oid)
    if not office:
        raise HTTPException(status_code=404, detail="Office not found")

    payload, attachments_by_project = await _parse_create_request(request)

    if payload.status not in ("draft", "submitted"):
        raise HTTPException(
            status_code=400,
            detail="status must be 'draft' or 'submitted' when creating a PPMP.",
        )

    try:
        existing = await PPMP.find_one({
            "office_id": office_id,
            "year": payload.year,
            "ppmp_type": payload.ppmp_type,
            "status": {"$ne": "archived"},
        })
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"A {payload.ppmp_type} PPMP for this office and year already exists",
            )

        projects = (
            _build_projects(payload.projects, attachments_by_project)
            if payload.projects
            else []
        )

        ppmp = PPMP(
            office_id=office_id,
            created_by=created_by,
            year=payload.year,
            ppmp_no=payload.ppmp_no,
            ppmp_type=payload.ppmp_type,
            status=payload.status,
            allocated_budget=payload.allocated_budget,
            description=payload.description,
            additional_description=payload.additional_description,
            prepared_by=payload.prepared_by,
            prepared_by_position=payload.prepared_by_position,
            submitted_by=payload.submitted_by,
            submitted_by_position=payload.submitted_by_position,
            submitted_at=datetime.utcnow() if payload.status == "submitted" else None,
            signatories=[Signatory(**s.model_dump()) for s in (payload.signatories or [])],
            projects=projects,
        )
        await ppmp.insert()

        # Persistent notification for admins — fired only on an actual
        # submission (status "submitted"), never on a draft save.
        if payload.status == "submitted":
            await create_ppmp_submitted_notification(ppmp)

        return ppmp

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


def _deep_copy_projects_with_new_ids(projects_data: list, attachments_by_project: Optional[dict] = None) -> list:
    """Build projects from the payload and assign entirely fresh UUIDs to
    every project, entry, and item.  Used when creating a new PPMP version
    (ppmp_no changed) so the new record has completely independent child
    IDs — no PR from the old PPMP can accidentally reference the new one.
    """
    attachments_by_project = attachments_by_project or {}
    projects = []
    for p_idx, proj_data in enumerate(projects_data):
        new_project_id = str(uuid.uuid4())
        entries = []
        for e_idx, entry_data in enumerate(proj_data.entries):
            new_entry_id = str(uuid.uuid4())
            entry_items = []
            estimated_budget = 0.0
            for item_data in entry_data.items:
                new_item_id = str(uuid.uuid4())
                total = round(item_data.quantity * item_data.unit_price, 2)
                estimated_budget += total
                entry_items.append(PPMPEntryItem(
                    id=new_item_id,
                    item_name=item_data.item_name,
                    quantity=item_data.quantity,
                    unit=item_data.unit,
                    unit_price=item_data.unit_price,
                    total_cost=total,
                    q1_qty=item_data.q1_qty,
                    q2_qty=item_data.q2_qty,
                    q3_qty=item_data.q3_qty,
                    q4_qty=item_data.q4_qty,
                    category=item_data.category,
                    is_procurable=item_data.is_procurable,
                ))

            quantity_size = _build_quantity_size(entry_items)

            entries.append(PPMPEntry(
                id=new_entry_id,
                order_no=e_idx + 1,
                category_id=entry_data.category_id,
                category_description=entry_data.category_description,
                project_title=entry_data.project_title,
                description=entry_data.description,
                project_type=entry_data.project_type,
                procurement_mode=entry_data.procurement_mode,
                pre_proc_conference=entry_data.pre_proc_conference,
                start_activity=entry_data.start_activity,
                end_activity=entry_data.end_activity,
                delivery_period=entry_data.delivery_period,
                source_of_funds=entry_data.source_of_funds,
                quantity_size=quantity_size,
                estimated_budget=round(estimated_budget, 2),
                items=entry_items,
            ))

        total_budget = round(sum(e.estimated_budget for e in entries), 2)

        stored_files = attachments_by_project.get(p_idx, [])
        supporting_docs = proj_data.supporting_docs or ""
        if stored_files:
            joined = ", ".join(stored_files)
            supporting_docs = f"{supporting_docs}, {joined}".strip(", ") if supporting_docs else joined

        projects.append(PPMPProject(
            order_no=p_idx + 1,
            remarks=proj_data.remarks,
            attached_document_title=proj_data.attached_document_title,
            supporting_docs=supporting_docs,
            total_budget=total_budget,
            entries=entries,
        ))
    return projects


@router.put("/{ppmp_id}", response_model=PPMPOut)
async def update_ppmp(
    ppmp_id: str,
    request: Request,
):
    ppmp = await PPMP.get(ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")

    content_type = request.headers.get("content-type", "")
    attachments_by_project: dict = {}

    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        raw_payload = form.get("payload")
        if raw_payload is None:
            raise HTTPException(status_code=400, detail="Missing 'payload' field in form data.")
        try:
            payload = PPMPUpdate(**json.loads(raw_payload))
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="'payload' was not valid JSON.")

        for key, value in form.multi_items():
            if not isinstance(value, UploadFile):
                continue
            parts = key.split("_")
            if len(parts) >= 2 and parts[0] == "project":
                try:
                    p_idx = int(parts[1])
                except ValueError:
                    continue
                stored_name = await _save_attachment(value)
                attachments_by_project.setdefault(p_idx, []).append(stored_name)
    else:
        body = await request.json()
        payload = PPMPUpdate(**body)

    try:
        if payload.status is not None and payload.status not in (
            "draft", "submitted", "approved", "archived",
        ):
            raise HTTPException(
                status_code=400,
                detail="status must be one of: draft, submitted, approved, archived.",
            )

        # ── PPMP Versioning ──────────────────────────────────────────────
        # When the user changes the PPMP Number during an edit, we create
        # a brand-new PPMP record instead of overwriting the original.
        # The original remains untouched with its own items and PR links.
        new_ppmp_no = payload.ppmp_no if payload.ppmp_no is not None else ppmp.ppmp_no
        ppmp_no_changed = (
            payload.ppmp_no is not None
            and payload.ppmp_no.strip() != (ppmp.ppmp_no or "").strip()
        )

        if ppmp_no_changed:
            # ── Create new PPMP version ──────────────────────────────────
            if payload.projects is None:
                raise HTTPException(
                    status_code=400,
                    detail="Projects data is required when creating a new PPMP version.",
                )

            # Build projects with entirely new UUIDs so no child records
            # are shared between old and new PPMP.
            new_projects = _deep_copy_projects_with_new_ids(
                payload.projects, attachments_by_project
            )

            # Determine status: inherit from the new payload or the original
            new_status = payload.status if payload.status else ppmp.status
            if new_status not in ("draft", "submitted"):
                new_status = "draft"

            new_ppmp = PPMP(
                office_id=ppmp.office_id,
                created_by=ppmp.created_by,
                year=payload.year if payload.year is not None else ppmp.year,
                ppmp_no=payload.ppmp_no.strip(),
                ppmp_type=payload.ppmp_type if payload.ppmp_type else ppmp.ppmp_type,
                status=new_status,
                allocated_budget=payload.allocated_budget if payload.allocated_budget is not None else ppmp.allocated_budget,
                description=payload.description if payload.description is not None else ppmp.description,
                additional_description=payload.additional_description if payload.additional_description is not None else ppmp.additional_description,
                prepared_by=payload.prepared_by if payload.prepared_by is not None else ppmp.prepared_by,
                prepared_by_position=payload.prepared_by_position if payload.prepared_by_position is not None else ppmp.prepared_by_position,
                submitted_by=payload.submitted_by if payload.submitted_by is not None else ppmp.submitted_by,
                submitted_by_position=payload.submitted_by_position if payload.submitted_by_position is not None else ppmp.submitted_by_position,
                submitted_at=datetime.utcnow() if new_status == "submitted" else None,
                signatories=[Signatory(**s.model_dump()) for s in (payload.signatories or ppmp.signatories or [])],
                projects=new_projects,
                parent_ppmp_id=str(ppmp.id),
            )
            await new_ppmp.insert()

            # New record created as a submission — notify admins (same rule
            # as a fresh create; a new version is a new submission event).
            if new_status == "submitted":
                await create_ppmp_submitted_notification(new_ppmp)

            return new_ppmp

        # ── Standard edit (PPMP Number unchanged) ────────────────────────
        was_submitted = ppmp.status == "submitted"
        update_data = {}
        for field in (
            "year", "ppmp_no", "ppmp_type", "status", "remarks",
            "allocated_budget", "description", "additional_description",
            "prepared_by", "prepared_by_position",
            "submitted_by", "submitted_by_position",
        ):
            value = getattr(payload, field, None)
            if value is not None:
                update_data[field] = value

        # Stamp submitted_at the moment a PPMP moves to "submitted" via the
        # Edit page's Submit button (feeds the Admin Consolidated view).
        if payload.status == "submitted" and ppmp.status != "submitted":
            update_data["submitted_at"] = datetime.utcnow()

        if payload.signatories is not None:
            update_data["signatories"] = [
                Signatory(**s.model_dump()) for s in payload.signatories
            ]

        if payload.projects is not None:
            oid = PydanticObjectId(ppmp_id)
            prs = await PurchaseRequest.find(PurchaseRequest.ppmp_id == oid).to_list()

            ppmp_items_by_entry: dict = {}
            for proj in (ppmp.projects or []):
                for entry in (proj.entries or []):
                    for item in (entry.items or []):
                        ppmp_items_by_entry.setdefault(entry.id, []).append(item)

            resolved_locked: dict = {}
            for pr in prs:
                pr_q = f"Q{pr.quarter}" if pr.quarter else "Q1"
                pr_q_field = f"q{pr.quarter or 1}_qty" if pr.quarter else "q1_qty"
                for pr_item in pr.items:
                    resolved_id = None
                    candidates = ppmp_items_by_entry.get(pr_item.ppmp_entry_id, [])
                    for ppmp_item in candidates:
                        if ppmp_item.id == pr_item.ppmp_item_id:
                            resolved_id = ppmp_item.id
                            break
                    if not resolved_id:
                        for ppmp_item in candidates:
                            pr_q_val = float(getattr(ppmp_item, pr_q_field, 0) or 0)
                            if abs(pr_q_val - float(pr_item.requested_quantity)) < 0.001:
                                resolved_id = ppmp_item.id
                                break
                    if not resolved_id:
                        for ppmp_item in candidates:
                            q_vals = [float(getattr(ppmp_item, f, 0) or 0) for f in ("q1_qty", "q2_qty", "q3_qty", "q4_qty")]
                            if any(abs(qv - float(pr_item.requested_quantity)) < 0.001 for qv in q_vals):
                                resolved_id = ppmp_item.id
                                break
                    if not resolved_id and candidates:
                        resolved_id = candidates[0].id
                    if resolved_id:
                        resolved_locked.setdefault(resolved_id, set()).add(pr_q)

            if resolved_locked:
                for proj in (payload.projects or []):
                    for entry in (proj.entries or []):
                        for item in (entry.items or []):
                            if item.id in resolved_locked:
                                locked_qs = resolved_locked[item.id]
                                q_map = {"Q1": "q1_qty", "Q2": "q2_qty", "Q3": "q3_qty", "Q4": "q4_qty"}
                                for q_label, q_field in q_map.items():
                                    if q_label in locked_qs:
                                        incoming_val = float(getattr(item, q_field, 0) or 0)
                                        db_item = next(
                                            (it for proj2 in ppmp.projects for ent in proj2.entries for it in ent.items if it.id == item.id),
                                            None,
                                        )
                                        if db_item:
                                            db_val = float(getattr(db_item, q_field, 0) or 0)
                                            if abs(incoming_val - db_val) > 0.001:
                                                raise HTTPException(
                                                    status_code=403,
                                                    detail=f"Quarter {q_label} of '{item.item_name}' is linked to a Purchase Request and cannot be changed.",
                                                )

            update_data["projects"] = _build_projects(payload.projects, attachments_by_project)

        if update_data:
            await ppmp.update({"$set": update_data})

        ppmp = await PPMP.get(ppmp_id)

        # A draft was actually submitted through the Edit page — notify
        # admins. Re-saving an already-submitted PPMP does NOT re-notify.
        if payload.status == "submitted" and not was_submitted:
            await create_ppmp_submitted_notification(ppmp)

        return ppmp

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{ppmp_id}/archive", response_model=PPMPOut)
async def archive_ppmp(ppmp_id: str):
    ppmp = await PPMP.get(ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")
    await ppmp.update({"$set": {"status": "archived"}})
    ppmp = await PPMP.get(ppmp_id)
    return ppmp


@router.put("/{ppmp_id}/unarchive", response_model=PPMPOut)
async def unarchive_ppmp(ppmp_id: str):
    ppmp = await PPMP.get(ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")
    if ppmp.status != "archived":
        raise HTTPException(status_code=400, detail="PPMP is not archived")
    await ppmp.update({"$set": {"status": "draft"}})
    ppmp = await PPMP.get(ppmp_id)
    return ppmp


@router.put("/{ppmp_id}/unsubmit", response_model=PPMPOut)
async def unsubmit_ppmp(ppmp_id: str, requester_uid: str):
    """Revert a submitted PPMP back to draft status.

    Only the PPMP's creator may unsubmit. The PPMP must currently be in
    "submitted" status. This removes the PPMP from the consolidated
    PPMP and APP views, but does not affect any linked Purchase Requests.
    """
    ppmp = await PPMP.get(ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")
    if ppmp.status != "submitted":
        raise HTTPException(
            status_code=400,
            detail="Only submitted PPMPs can be reverted to draft.",
        )
    # Verify the requester is the creator
    my_id, is_admin = await _resolve_requester(requester_uid)
    if my_id != ppmp.created_by:
        raise HTTPException(
            status_code=403,
            detail="Only the PPMP creator can revert it to draft.",
        )
    await ppmp.update({"$set": {"status": "draft", "submitted_at": None}})
    ppmp = await PPMP.get(ppmp_id)
    return ppmp


@router.delete("/{ppmp_id}")
async def delete_ppmp(ppmp_id: str):
    ppmp = await PPMP.get(ppmp_id)
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")
    await ppmp.delete()
    return {"message": "PPMP deleted"}