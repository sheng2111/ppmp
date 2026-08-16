warning: in the working copy of 'backend/app/routers/pr_routes.py', LF will be replaced by CRLF the next time Git touches it
[1mdiff --git a/backend/app/routers/pr_routes.py b/backend/app/routers/pr_routes.py[m
[1mindex 92d17d8..c56399a 100644[m
[1m--- a/backend/app/routers/pr_routes.py[m
[1m+++ b/backend/app/routers/pr_routes.py[m
[36m@@ -1,128 +1,268 @@[m
[31m-from fastapi import APIRouter, Depends, HTTPException[m
[31m-from sqlalchemy.orm import Session[m
[31m-from typing import List, Optional[m
[32m+[m[32mfrom typing import Optional[m
[32m+[m
[32m+[m[32mfrom fastapi import APIRouter, HTTPException[m
 from pydantic import BaseModel[m
[31m-from app.database import get_db[m
[31m-from app.models.pr import PurchaseRequest, PRItem[m
[31m-from app.models.office import Office[m
[31m-from app.models.user import User[m
[31m-from datetime import datetime[m
[31m-[m
[31m-router = APIRouter(prefix="/prs", tags=["purchase_requests"])[m
[31m-[m
[31m-class PRItemCreate(BaseModel):[m
[31m-    lot_label: Optional[str] = None[m
[31m-    stock_property_no: Optional[str] = None[m
[31m-    unit: Optional[str] = None[m
[31m-    item_description: str[m
[31m-    quantity: float = 0[m
[31m-    unit_price: float = 0[m
[31m-[m
[31m-class PRCreate(BaseModel):[m
[31m-    pr_number: Optional[str] = None[m
[31m-    fund_cluster: Optional[str] = None[m
[31m-    responsibility_center_code: Optional[str] = None[m
[31m-    purpose: Optional[str] = None[m
[31m-    requested_date: Optional[str] = None[m
[31m-    requested_by_name: Optional[str] = None[m
[31m-    requested_by_designation: Optional[str] = None[m
[31m-    approved_by_name: Optional[str] = None[m
[31m-    approved_by_designation: Optional[str] = None[m
[31m-    items: List[PRItemCreate] = [][m
[31m-[m
[31m-class PRItemOut(BaseModel):[m
[31m-    id: int[m
[31m-    lot_label: Optional[str][m
[31m-    stock_property_no: Optional[str][m
[31m-    unit: Optional[str][m
[31m-    item_description: str[m
[31m-    quantity: float[m
[31m-    unit_price: float[m
[31m-    total_cost: float[m
[31m-[m
[31m-    class Config:[m
[31m-        from_attributes = True[m
[31m-[m
[31m-class PROut(BaseModel):[m
[31m-    id: int[m
[31m-    office_id: int[m
[31m-    created_by: int[m
[31m-    pr_number: Optional[str][m
[31m-    fund_cluster: Optional[str][m
[31m-    responsibility_center_code: Optional[str][m
[31m-    purpose: Optional[str][m
[31m-    requested_date: Optional[str][m
[31m-    requested_by_name: Optional[str][m
[31m-    requested_by_designation: Optional[str][m
[31m-    approved_by_name: Optional[str][m
[31m-    approved_by_designation: Optional[str][m
[31m-    status: str[m
[31m-    created_at: str[m
[31m-    items: List[PRItemOut] = [][m
[31m-[m
[31m-    class Config:[m
[31m-        from_attributes = True[m
[31m-[m
[31m-@router.get("/", response_model=List[PROut])[m
[31m-def get_prs([m
[31m-    office_id: Optional[int] = None,[m
[31m-    created_by: Optional[int] = None,[m
[31m-    db: Session = Depends(get_db),[m
[32m+[m[32mfrom beanie import PydanticObjectId[m
[32m+[m
[32m+[m[32mfrom app.models.ppmp import PPMP[m
[32m+[m[32mfrom app.models.fee_category_office import FeeCategoryOffice[m
[32m+[m[32mfrom app.models.app_entry_detail import AppEntryDetail, AppEntryDetailPatch[m
[32m+[m[32mfrom app.models.app_meta import AppMeta, AppSignatory[m
[32m+[m
[32m+[m[32mrouter = APIRouter(prefix="/app", tags=["app"])[m
[32m+[m
[32m+[m[32mDEFAULT_CATEGORY = "General Requirements"[m
[32m+[m
[32m+[m
[32m+[m[32mdef _items_by_category(entry) -> dict:[m
[32m+[m[32m    """[m
[32m+[m[32m    Groups an entry's PROCURABLE items by their Category. An entry with[m
[32m+[m[32m    items all in one category yields a single group (unchanged behavior);[m
[32m+[m[32m    an entry with items spread across categories (e.g. some General[m
[32m+[m[32m    Requirements, some CSE) yields one group per category actually used,[m
[32m+[m[32m    so each gets its own row banded under the right section instead of the[m
[32m+[m[32m    whole entry's budget being silently absorbed into whichever category[m
[32m+[m[32m    its first item happens to have.[m
[32m+[m
[32m+[m[32m    Non-procurable items (item.is_procurable == False) are excluded here —[m
[32m+[m[32m    the client requirement is that non-procurable items still show up in[m
[32m+[m[32m    the PPMP and in a PR, but must NOT appear in the generated APP, and[m
[32m+[m[32m    their cost must not be counted toward any APP subtotal or the grand[m
[32m+[m[32m    total.[m
[32m+[m
[32m+[m[32m    An entry with no items at all still yields one empty group under the[m
[32m+[m[32m    default category, so it still produces a (zero-budget) row rather than[m
[32m+[m[32m    vanishing entirely. An entry that HAS items but none of them are[m
[32m+[m[32m    procurable yields NO groups at all — that entry simply doesn't appear[m
[32m+[m[32m    in the APP, same as if it were empty of procurable content.[m
[32m+[m[32m    """[m
[32m+[m[32m    procurable_items = [it for it in entry.items if it.is_procurable][m
[32m+[m
[32m+[m[32m    groups: dict = {}[m
[32m+[m[32m    for item in procurable_items:[m
[32m+[m[32m        cat = item.category or DEFAULT_CATEGORY[m
[32m+[m[32m        groups.setdefault(cat, []).append(item)[m
[32m+[m[32m    if not groups and not entry.items:[m
[32m+[m[32m        groups[DEFAULT_CATEGORY] = [][m
[32m+[m[32m    return groups[m
[32m+[m
[32m+[m
[32m+[m[32mdef _general_description(entry) -> str:[m
[32m+[m[32m    """[m
[32m+[m[32m    Column 3 (General Description of the Project) -- combines the entry's[m
[32m+[m[32m    own General Description and Type of Project (Goods / Infrastructure[m
[32m+[m[32m    Projects / Consulting Services), both already stored on PPMPEntry, into[m
[32m+[m[32m    "<General Description> - (<Type of Project>)".[m
[32m+[m
[32m+[m[32m    - Missing Type of Project: falls back to just the General Description.[m
[32m+[m[32m    - Missing General Description: blank, regardless of Type of Project --[m
[32m+[m[32m      there's nothing meaningful to show without it.[m
[32m+[m[32m    """[m
[32m+[m[32m    description = (entry.description or "").strip()[m
[32m+[m[32m    project_type = (entry.project_type or "").strip()[m
[32m+[m
[32m+[m[32m    if not description:[m
[32m+[m[32m        return ""[m
[32m+[m[32m    if not project_type:[m
[32m+[m[32m        return description[m
[32m+[m[32m    return f"{description} - ({project_type})"[m
[32m+[m
[32m+[m
[32m+[m[32m@router.get("/generate/from-ppmp/{ppmp_id}")[m
[32m+[m[32masync def generate_app_from_ppmp(ppmp_id: str):[m
[32m+[m[32m    ppmp = await PPMP.get(ppmp_id)[m
[32m+[m[32m    if not ppmp:[m
[32m+[m[32m        raise HTTPException(status_code=404, detail="PPMP not found")[m
[32m+[m
[32m+[m[32m    # ppmp.office_id refers to a FeeCategoryOffice document (that's what[m
[32m+[m[32m    # CreatePPMPPage.tsx's OfficeCategoryPicker/create_ppmp validate[m
[32m+[m[32m    # against) -- NOT the separate/unrelated `Office` collection. Querying[m
[32m+[m[32m    # the wrong one silently returned None, which is why Column 2 was[m
[32m+[m[32m    # always blank.[m
[32m+[m[32m    office = None[m
[32m+[m[32m    try:[m
[32m+[m[32m        office = await FeeCategoryOffice.get(PydanticObjectId(ppmp.office_id))[m
[32m+[m[32m    except Exception:[m
[32m+[m[32m        office = None[m
[32m+[m
[32m+[m[32m    # Left-join: every entry that already has an Early Procurement Activity[m
[32m+[m[32m    # / Procurement Strategy answer saved against it.[m
[32m+[m[32m    details = {[m
[32m+[m[32m        d.entry_id: d[m
[32m+[m[32m        for d in await AppEntryDetail.find([m
[32m+[m[32m            AppEntryDetail.ppmp_id == ppmp_id[m
[32m+[m[32m        ).to_list()[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[