from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel
from ..database import get_ppmp_db
from ..models.ppmp import PPMPModel, PPMPProject, PPMPLot
from ..models.app import APPModel, APPLineItem
from ..models.user import User
from ..routers.auth import get_current_user
from app.models.office import Office

router = APIRouter()

# General Requirements threshold under RA No. 12009 — only PPMP lots with
# an estimated budget at or above this amount are pulled into the APP.
GENERAL_REQUIREMENTS_THRESHOLD = 200000.0


# ----- Pydantic Schemas -----

class LineItemSchema(BaseModel):
    id: Optional[int] = None
    source_lot_id: Optional[int] = None
    pap_code: str = ""
    object_code: str = ""
    project_title: str = ""
    end_user_unit: str = ""
    general_description: str = ""
    mode_of_procurement: str = ""
    early_procurement_activity: str = ""
    bid_evaluation_criteria: str = ""
    start_of_procurement: str = ""
    end_of_procurement: str = ""
    source_of_funds: str = ""
    estimated_budget: float = 0
    procurement_strategy: str = ""
    remarks: str = ""

    class Config:
        from_attributes = True


class AppHeaderSchema(BaseModel):
    fiscal_year: str = ""
    status: str = "Indicative"
    version_no: str = ""
    prepared_by_name: str = ""
    prepared_by_designation: str = ""
    recommended_by_1_name: str = ""
    recommended_by_1_designation: str = ""
    recommended_by_2_name: str = ""
    recommended_by_2_designation: str = ""
    approved_by_name: str = ""
    approved_by_designation: str = ""

    class Config:
        from_attributes = True


class AppSchema(BaseModel):
    id: Optional[int] = None
    header: AppHeaderSchema
    line_items: List[LineItemSchema] = []
    source_ppmp_id: Optional[int] = None

    class Config:
        from_attributes = True


# ----- Serialization -----

def app_to_schema(app: APPModel) -> dict:
    return {
        "id": app.id,
        "header": {
            "fiscal_year": app.fiscal_year,
            "status": app.status,
            "version_no": app.version_no,
            "prepared_by_name": app.prepared_by_name,
            "prepared_by_designation": app.prepared_by_designation,
            "recommended_by_1_name": app.recommended_by_1_name,
            "recommended_by_1_designation": app.recommended_by_1_designation,
            "recommended_by_2_name": app.recommended_by_2_name,
            "recommended_by_2_designation": app.recommended_by_2_designation,
            "approved_by_name": app.approved_by_name,
            "approved_by_designation": app.approved_by_designation,
        },
        "source_ppmp_id": app.source_ppmp_id,
        "line_items": [
            {
                "id": li.id,
                "source_lot_id": li.source_lot_id,
                "pap_code": li.pap_code,
                "object_code": li.object_code,
                "project_title": li.project_title,
                "end_user_unit": li.end_user_unit,
                "general_description": li.general_description,
                "mode_of_procurement": li.mode_of_procurement,
                "early_procurement_activity": li.early_procurement_activity,
                "bid_evaluation_criteria": li.bid_evaluation_criteria,
                "start_of_procurement": li.start_of_procurement,
                "end_of_procurement": li.end_of_procurement,
                "source_of_funds": li.source_of_funds,
                "estimated_budget": li.estimated_budget,
                "procurement_strategy": li.procurement_strategy,
                "remarks": li.remarks,
            }
            for li in app.line_items
        ],
    }


def _lot_budget(lot: PPMPLot) -> float:
    if lot.spec_items:
        return sum((si.quantity or 0) * (si.unit_price or 0) for si in lot.spec_items)
    return lot.estimated_budget or 0


def _get_app_with_relations(db: Session, app_id: int, owner_id: int) -> Optional[APPModel]:
    return (
        db.query(APPModel)
        .options(joinedload(APPModel.line_items))
        .filter(APPModel.id == app_id, APPModel.owner_id == owner_id)
        .first()
    )


# ----- Generate APP from a PPMP -----

@router.post("/generate/{ppmp_id}")
def generate_app_from_ppmp(
    ppmp_id: int,
    db: Session = Depends(get_ppmp_db),
    current_user: User = Depends(get_current_user),
):
    """
    Builds a new APP from the given PPMP: walks every project/lot, keeps
    only lots whose estimated budget is >= PHP 200,000 (General
    Requirements threshold), and creates one APPLineItem per qualifying
    lot with whatever fields can be auto-filled from the PPMP. Fields that
    don't exist on the PPMP (PAP Code, Object Code, Early Procurement
    Activity, Bid Evaluation Criteria, Procurement Strategy) are left
    blank for the user to fill in directly on the APP.
    """
    ppmp = (
        db.query(PPMPModel)
        .options(
            joinedload(PPMPModel.projects)
            .joinedload(PPMPProject.lots)
            .joinedload(PPMPLot.spec_items)
        )
        .filter(PPMPModel.id == ppmp_id, PPMPModel.owner_id == current_user.id)
        .first()
    )
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")

    app = APPModel(
        fiscal_year=ppmp.fiscal_year,
        status="Indicative",
        source_ppmp_id=ppmp.id,
        owner_id=current_user.id,
    )
    db.add(app)
    db.flush()

    qualifying_count = 0
    for project in ppmp.projects:
        for lot in project.lots:
            budget = _lot_budget(lot)
            if budget < GENERAL_REQUIREMENTS_THRESHOLD:
                continue  # below the General Requirements threshold — excluded from APP entirely

            qualifying_count += 1
            line_item = APPLineItem(
                app_id=app.id,
                source_lot_id=lot.id,
                pap_code="",
                object_code="",
                # Project Title = PPMP project's general_description;
                # General Description of the Project repeats the same
                # text, since the PPMP only has one description field
                # covering both APP columns.
                project_title=project.general_description or "",
                end_user_unit=ppmp.end_user_unit or "",
                general_description=project.general_description or "",
                mode_of_procurement=lot.mode_of_procurement or "",
                early_procurement_activity="",
                bid_evaluation_criteria="",
                start_of_procurement=lot.start_of_procurement or "",
                end_of_procurement=lot.end_of_procurement or "",
                source_of_funds=lot.source_of_funds or "",
                estimated_budget=budget,
                procurement_strategy="",
                remarks=lot.remarks or "",
            )
            db.add(line_item)

    db.commit()
    db.refresh(app)

    app = _get_app_with_relations(db, app.id, current_user.id)
    result = app_to_schema(app)
    result["qualifying_lot_count"] = qualifying_count
    return result


# ----- Standard CRUD for editing/saving the APP independently -----

@router.get("")
def get_apps(db: Session = Depends(get_ppmp_db), current_user: User = Depends(get_current_user)):
    apps = (
        db.query(APPModel)
        .options(joinedload(APPModel.line_items))
        .filter(APPModel.owner_id == current_user.id)
        .all()
    )
    return [app_to_schema(a) for a in apps]


@router.get("/{app_id}")
def get_app(app_id: int, db: Session = Depends(get_ppmp_db), current_user: User = Depends(get_current_user)):
    app = _get_app_with_relations(db, app_id, current_user.id)
    if not app:
        raise HTTPException(status_code=404, detail="APP not found")
    return app_to_schema(app)


@router.put("/{app_id}")
def update_app(
    app_id: int,
    data: AppSchema,
    db: Session = Depends(get_ppmp_db),
    current_user: User = Depends(get_current_user),
):
    app = db.query(APPModel).filter(
        APPModel.id == app_id, APPModel.owner_id == current_user.id
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="APP not found")

    app.fiscal_year = data.header.fiscal_year
    app.status = data.header.status or "Indicative"
    app.version_no = data.header.version_no
    app.prepared_by_name = data.header.prepared_by_name
    app.prepared_by_designation = data.header.prepared_by_designation
    app.recommended_by_1_name = data.header.recommended_by_1_name
    app.recommended_by_1_designation = data.header.recommended_by_1_designation
    app.recommended_by_2_name = data.header.recommended_by_2_name
    app.recommended_by_2_designation = data.header.recommended_by_2_designation
    app.approved_by_name = data.header.approved_by_name
    app.approved_by_designation = data.header.approved_by_designation

    # Replace line items wholesale, same pattern as PPMP lots/projects —
    # the APP edit screen always submits its full current state.
    for old_item in list(app.line_items):
        db.delete(old_item)
    db.flush()

    for item_data in data.line_items:
        line_item = APPLineItem(
            app_id=app.id,
            source_lot_id=item_data.source_lot_id,
            pap_code=item_data.pap_code,
            object_code=item_data.object_code,
            project_title=item_data.project_title,
            end_user_unit=item_data.end_user_unit,
            general_description=item_data.general_description,
            mode_of_procurement=item_data.mode_of_procurement,
            early_procurement_activity=item_data.early_procurement_activity,
            bid_evaluation_criteria=item_data.bid_evaluation_criteria,
            start_of_procurement=item_data.start_of_procurement,
            end_of_procurement=item_data.end_of_procurement,
            source_of_funds=item_data.source_of_funds,
            estimated_budget=item_data.estimated_budget,
            procurement_strategy=item_data.procurement_strategy,
            remarks=item_data.remarks,
        )
        db.add(line_item)

    db.commit()
    db.refresh(app)

    app = _get_app_with_relations(db, app.id, current_user.id)
    return app_to_schema(app)


@router.delete("/{app_id}")
def delete_app(app_id: int, db: Session = Depends(get_ppmp_db), current_user: User = Depends(get_current_user)):
    app = db.query(APPModel).filter(
        APPModel.id == app_id, APPModel.owner_id == current_user.id
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="APP not found")
    db.delete(app)
    db.commit()
    return {"message": "APP deleted"}
