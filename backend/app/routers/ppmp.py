from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from ..database import get_ppmp_db, get_users_db
from ..models.ppmp import PPMPModel, PPMPItem
from ..models.user import User
from ..routers.auth import get_current_user
import json
import io

router = APIRouter()

# ----- Pydantic Schemas -----

class ItemSchema(BaseModel):
    id: Optional[int] = None
    code: str = ""
    general_description: str
    unit_of_issue: str
    quantity: float
    unit_cost: float
    total_cost: float
    mode_of_procurement: str
    pap_category: Optional[str] = ""  # Aligned perfectly to match PPMPForm.tsx
    schedule: dict = {}
    class Config:
        from_attributes = True

class HeaderSchema(BaseModel):
    end_user_unit: str = ""
    charged_to: str = ""
    pap: str = ""
    date: str = ""
    revision: str = ""
    prepared_by: str | None = None
    designation: str | None = None
    remarks: str | None = None

    class Config:
        from_attributes = True

class PPMPSchema(BaseModel): 
    id: Optional[int] = None
    header: HeaderSchema
    items: List[ItemSchema] = []
    year: str=""
    total_estimated_budget: float=0
    created_at: Optional[str] = None
    class Config:
        from_attributes = True

def ppmp_to_schema(ppmp: PPMPModel) -> dict:
    items_list = []
    for item in ppmp.items:
        schedule_dict = {
            "jan_qty": item.jan_qty, "jan_amt": item.jan_amt,
            "feb_qty": item.feb_qty, "feb_amt": item.feb_amt,
            "mar_qty": item.mar_qty, "mar_amt": item.mar_amt,
            "apr_qty": item.apr_qty, "apr_amt": item.apr_amt,
            "may_qty": item.may_qty, "may_amt": item.may_amt,
            "jun_qty": item.jun_qty, "jun_amt": item.jun_amt,
            "jul_qty": item.jul_qty, "jul_amt": item.jul_amt,
            "aug_qty": item.aug_qty, "aug_amt": item.aug_amt,
            "sep_qty": item.sep_qty, "sep_amt": item.sep_amt,
            "oct_qty": item.oct_qty, "oct_amt": item.oct_amt,
            "nov_qty": item.nov_qty, "nov_amt": item.nov_amt,
            "dec_qty": item.dec_qty, "dec_amt": item.dec_amt,
        }
        
        items_list.append({
            "id": item.id,
            "ppmp_id": item.ppmp_id,
            "code": item.code,
            "general_description": item.general_description,
            "unit_of_issue": item.unit_of_issue,
            "quantity": item.quantity,
            "unit_cost": item.unit_cost,
            "total_cost": item.total_cost,
            "mode_of_procurement": item.mode_of_procurement,
            "pap_category": item.pap_category,  
            "schedule": schedule_dict,
        })

    return {
        "id": ppmp.id,
        "header": {
            "end_user_unit": ppmp.end_user_unit,
            "charged_to": ppmp.charged_to,
            "pap": ppmp.pap,
            "date": ppmp.date,
            "revision": ppmp.revision,
        },
        "items": items_list,
        "year": ppmp.year if hasattr(ppmp, 'year') else "2026",
        "prepared_by": ppmp.prepared_by if hasattr(ppmp, 'prepared_by') else "",
        "designation": ppmp.designation if hasattr(ppmp, 'designation') else "",
        "remarks": ppmp.remarks if hasattr(ppmp, 'remarks') else "",
        "created_at": str(ppmp.created_at) if hasattr(ppmp, 'created_at') and ppmp.created_at else None,
    }


# ----- CRUD Endpoints -----

@router.get("")
def get_ppmps(db: Session = Depends(get_ppmp_db), current_user: User = Depends(get_current_user)):
    ppmps = db.query(PPMPModel).filter(PPMPModel.owner_id == current_user.id).all()
    return [ppmp_to_schema(p) for p in ppmps]


@router.get("/{ppmp_id}")
def get_ppmp(ppmp_id: int, db: Session = Depends(get_ppmp_db), current_user: User = Depends(get_current_user)):
    ppmp = db.query(PPMPModel).filter(PPMPModel.id == ppmp_id, PPMPModel.owner_id == current_user.id).first()
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")
    return ppmp_to_schema(ppmp)


# @router.post("/")
# def create_ppmp(data: PPMPSchema, db: Session = Depends(get_ppmp_db), current_user: User = Depends(get_current_user)):
#     fallback_year = data.header.date.split("-")[0] if "-" in data.header.date else "2026"
    
#     ppmp = PPMPModel(
#         end_user_unit=data.header.end_user_unit,
#         charged_to=data.header.charged_to,
#         pap=data.header.pap,
#         date=data.header.date,
#         year=fallback_year,
#         revision=data.header.revision or "0",
#         prepared_by=data.header.prepared_by or "",
#         designation=data.header.designation or "",
#         remarks=data.header.remarks or "",
#         total_estimated_budget=sum(item.total_cost for item in data.items),
#         owner_id=current_user.id,
#     )
#     db.add(ppmp)
#     db.flush()

#     for item_data in data.items:
#         sched = item_data.schedule or {}
#         item = PPMPItem(
#             ppmp_id=ppmp.id,
#             code=item_data.code,
#             general_description=item_data.general_description,
#             unit_of_issue=item_data.unit_of_issue,
#             quantity=item_data.quantity,
#             unit_cost=item_data.unit_cost,
#             total_cost=item_data.total_cost,
#             mode_of_procurement=item_data.mode_of_procurement,
#             pap_category=item_data.pap_category,  # Matches the updated input parameter field
            
#             jan_qty=float(sched.get("jan_qty", 0) or 0), jan_amt=float(sched.get("jan_amt", 0) or 0),
#             feb_qty=float(sched.get("feb_qty", 0) or 0), feb_amt=float(sched.get("feb_amt", 0) or 0),
#             mar_qty=float(sched.get("mar_qty", 0) or 0), mar_amt=float(sched.get("mar_amt", 0) or 0),
#             apr_qty=float(sched.get("apr_qty", 0) or 0), apr_amt=float(sched.get("apr_amt", 0) or 0),
#             may_qty=float(sched.get("may_qty", 0) or 0), may_amt=float(sched.get("may_amt", 0) or 0),
#             jun_qty=float(sched.get("jun_qty", 0) or 0), jun_amt=float(sched.get("jun_amt", 0) or 0),
#             jul_qty=float(sched.get("jul_qty", 0) or 0), jul_amt=float(sched.get("jul_amt", 0) or 0),
#             aug_qty=float(sched.get("aug_qty", 0) or 0), aug_amt=float(sched.get("aug_amt", 0) or 0),
#             sep_qty=float(sched.get("sep_qty", 0) or 0), sep_amt=float(sched.get("sep_amt", 0) or 0),
#             oct_qty=float(sched.get("oct_qty", 0) or 0), oct_amt=float(sched.get("oct_amt", 0) or 0),
#             nov_qty=float(sched.get("nov_qty", 0) or 0), nov_amt=float(sched.get("nov_amt", 0) or 0),
#             dec_qty=float(sched.get("dec_qty", 0) or 0), dec_amt=float(sched.get("dec_amt", 0) or 0),
#         )
#         db.add(item)
        
#     db.commit()
#     db.refresh(ppmp)
#     return ppmp_to_schema(ppmp)

@router.post("/")
def create_ppmp(
    data: PPMPSchema,
    db: Session = Depends(get_ppmp_db),
    current_user: User = Depends(get_current_user)
):
    print("DATA:", data)
    print("USER:", current_user)

    fallback_year = (
        data.header.date.split("-")[0]
        if data.header.date and "-" in data.header.date
        else "2026"
    )

    total_budget = sum((item.total_cost or 0) for item in data.items)

    ppmp = PPMPModel(
        end_user_unit=data.header.end_user_unit,
        charged_to=data.header.charged_to,
        pap=data.header.pap,
        date=data.header.date,
        year=data.year or fallback_year,
        revision=data.header.revision or "0",
        prepared_by=data.header.prepared_by or "",
        designation=data.header.designation or "",
        remarks=data.header.remarks or "",
        total_estimated_budget=data.total_estimated_budget or 0,
        owner_id=current_user.id if current_user else None,
    )

    db.add(ppmp)
    db.flush()

    for item_data in data.items:
        sched = item_data.schedule if isinstance(item_data.schedule, dict) else {}

        item = PPMPItem(
            ppmp_id=ppmp.id,
            code=item_data.code,
            general_description=item_data.general_description,
            unit_of_issue=item_data.unit_of_issue,
            quantity=item_data.quantity,
            unit_cost=item_data.unit_cost,
            total_cost=item_data.total_cost or 0,
            mode_of_procurement=item_data.mode_of_procurement,
            pap_category=item_data.pap_category,

            jan_qty=float(sched.get("jan_qty", 0) or 0),
            jan_amt=float(sched.get("jan_amt", 0) or 0),
            # ... keep rest same
        )

        db.add(item)

    db.commit()
    db.refresh(ppmp)

    return ppmp_to_schema(ppmp)

@router.put("/{ppmp_id}")
def update_ppmp(ppmp_id: int, data: PPMPSchema, db: Session = Depends(get_ppmp_db), current_user: User = Depends(get_current_user)):
    ppmp = db.query(PPMPModel).filter(PPMPModel.id == ppmp_id, PPMPModel.owner_id == current_user.id).first()
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")
        
    ppmp.end_user_unit = data.header.end_user_unit
    ppmp.charged_to = data.header.charged_to
    ppmp.pap = data.header.pap
    ppmp.date = data.header.date
    ppmp.revision = data.header.revision
    ppmp.prepared_by = data.header.prepared_by
    ppmp.designation = data.header.designation
    ppmp.remarks = data.header.remarks
    ppmp.total_estimated_budget = data.total_estimated_budget or 0
    ppmp.year = data.year or ppmp.year
    if "-" in data.header.date:
        ppmp.year = data.header.date.split("-")[0]

    for old_item in ppmp.items:
        db.delete(old_item)
    db.flush()

    for item_data in data.items:
        sched = item_data.schedule or {}
        item = PPMPItem(
            ppmp_id=ppmp.id,
            code=item_data.code,
            general_description=item_data.general_description,
            unit_of_issue=item_data.unit_of_issue,
            quantity=item_data.quantity,
            unit_cost=item_data.unit_cost,
            total_cost=item_data.total_cost,
            mode_of_procurement=item_data.mode_of_procurement,
            pap_category=item_data.pap_category,
            
            jan_qty=float(sched.get("jan_qty", 0) or 0), jan_amt=float(sched.get("jan_amt", 0) or 0),
            feb_qty=float(sched.get("feb_qty", 0) or 0), feb_amt=float(sched.get("feb_amt", 0) or 0),
            mar_qty=float(sched.get("mar_qty", 0) or 0), mar_amt=float(sched.get("mar_amt", 0) or 0),
            apr_qty=float(sched.get("apr_qty", 0) or 0), apr_amt=float(sched.get("apr_amt", 0) or 0),
            may_qty=float(sched.get("may_qty", 0) or 0), may_amt=float(sched.get("may_amt", 0) or 0),
            jun_qty=float(sched.get("jun_qty", 0) or 0), jun_amt=float(sched.get("jun_amt", 0) or 0),
            jul_qty=float(sched.get("jul_qty", 0) or 0), jul_amt=float(sched.get("jul_amt", 0) or 0),
            aug_qty=float(sched.get("aug_qty", 0) or 0), aug_amt=float(sched.get("aug_amt", 0) or 0),
            sep_qty=float(sched.get("sep_qty", 0) or 0), sep_amt=float(sched.get("sep_amt", 0) or 0),
            oct_qty=float(sched.get("oct_qty", 0) or 0), oct_amt=float(sched.get("oct_amt", 0) or 0),
            nov_qty=float(sched.get("nov_qty", 0) or 0), nov_amt=float(sched.get("nov_amt", 0) or 0),
            dec_qty=float(sched.get("dec_qty", 0) or 0), dec_amt=float(sched.get("dec_amt", 0) or 0),
        )
        db.add(item)
        
    db.commit()
    db.refresh(ppmp)
    return ppmp_to_schema(ppmp)


@router.delete("/{ppmp_id}")
def delete_ppmp(ppmp_id: int, db: Session = Depends(get_ppmp_db), current_user: User = Depends(get_current_user)):
    ppmp = db.query(PPMPModel).filter(PPMPModel.id == ppmp_id, PPMPModel.owner_id == current_user.id).first()
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")
    db.delete(ppmp)
    db.commit()
    return {"message": "PPMP deleted"}


@router.get("/{ppmp_id}/export/excel")
def export_excel(ppmp_id: int, db: Session = Depends(get_ppmp_db), current_user: User = Depends(get_current_user)):
    from ..exports.excel_export import generate_ppmp_excel
    ppmp = db.query(PPMPModel).filter(PPMPModel.id == ppmp_id, PPMPModel.owner_id == current_user.id).first()
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")
    output = generate_ppmp_excel(ppmp_to_schema(ppmp))
    filename = f"PPMP_{ppmp.pap or ppmp_id}.xlsx".replace(" ", "_")
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )