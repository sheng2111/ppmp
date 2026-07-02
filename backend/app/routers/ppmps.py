from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.ppmp import PPMP, PPMPProject, PPMPLot
from app.schemas.ppmp import PPMPCreate, PPMPUpdate, PPMPOut
import traceback

router = APIRouter(prefix="/ppmps", tags=["ppmps"])


@router.get("/", response_model=List[PPMPOut])
def get_ppmps(
    office_id: Optional[int] = None,
    created_by: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(PPMP)
    if office_id:
        query = query.filter(PPMP.office_id == office_id)
    if created_by:
        query = query.filter(PPMP.created_by == created_by)
    if year:
        query = query.filter(PPMP.year == year)
    return query.all()


@router.get("/summary/stats")
def get_stats(
    office_id: Optional[int] = None,
    created_by: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(PPMP)
    if office_id:
        query = query.filter(PPMP.office_id == office_id)
    if created_by:
        query = query.filter(PPMP.created_by == created_by)

    ppmps = query.all()

    total_ppmps = len(ppmps)
    draft = len([p for p in ppmps if p.status == 'draft'])
    submitted = len([p for p in ppmps if p.status == 'submitted'])
    approved = len([p for p in ppmps if p.status == 'approved'])

    total_budget = 0
    for ppmp in ppmps:
        for project in ppmp.projects:
            for lot in project.lots:
                total_budget += lot.estimated_budget or 0

    return {
        "total_ppmps": total_ppmps,
        "draft": draft,
        "submitted": submitted,
        "approved": approved,
        "total_budget": total_budget,
    }


@router.get("/{ppmp_id}", response_model=PPMPOut)
def get_ppmp(ppmp_id: int, db: Session = Depends(get_db)):
    ppmp = db.query(PPMP).filter(PPMP.id == ppmp_id).first()
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")
    return ppmp


@router.post("/", response_model=PPMPOut)
def create_ppmp(
    payload: PPMPCreate,
    office_id: int,
    created_by: int,
    db: Session = Depends(get_db)
):
    try:
        existing = db.query(PPMP).filter(
            PPMP.office_id == office_id,
            PPMP.year == payload.year,
            PPMP.ppmp_type == payload.ppmp_type
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"A {payload.ppmp_type} PPMP for this office and year already exists"
            )

        ppmp = PPMP(
            office_id=office_id,
            created_by=created_by,
            year=payload.year,
            ppmp_no=payload.ppmp_no,
            ppmp_type=payload.ppmp_type
        )
        db.add(ppmp)
        db.flush()

        for i, proj_data in enumerate(payload.projects):
            project = PPMPProject(
                ppmp_id=ppmp.id,
                order_no=i + 1,
                description=proj_data.description,
                project_type=proj_data.project_type,
                procurement_mode=proj_data.procurement_mode,
                pre_proc_conference=proj_data.pre_proc_conference,
                start_activity=proj_data.start_activity,
                end_activity=proj_data.end_activity,
                delivery_period=proj_data.delivery_period,
                source_of_funds=proj_data.source_of_funds,
                supporting_docs=proj_data.supporting_docs,
                remarks=proj_data.remarks,
            )
            db.add(project)
            db.flush()

            for lot_data in proj_data.lots:
                lot = PPMPLot(
                    project_id=project.id,
                    lot_no=lot_data.lot_no,
                    quantity_size=lot_data.quantity_size,
                    estimated_budget=lot_data.estimated_budget,
                )
                db.add(lot)

        db.commit()
        db.refresh(ppmp)
        return ppmp
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{ppmp_id}", response_model=PPMPOut)
def update_ppmp(ppmp_id: int, payload: PPMPUpdate, db: Session = Depends(get_db)):
    ppmp = db.query(PPMP).filter(PPMP.id == ppmp_id).first()
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(ppmp, key, value)
    db.commit()
    db.refresh(ppmp)
    return ppmp


@router.delete("/{ppmp_id}")
def delete_ppmp(ppmp_id: int, db: Session = Depends(get_db)):
    ppmp = db.query(PPMP).filter(PPMP.id == ppmp_id).first()
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")
    db.delete(ppmp)
    db.commit()
    return {"message": "PPMP deleted"}
