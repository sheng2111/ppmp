from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.ppmp import PPMP
from app.models.office import Office

router = APIRouter(prefix="/app", tags=["app"])

@router.get("/generate/from-ppmp/{ppmp_id}")
def generate_app_from_ppmp(ppmp_id: int, db: Session = Depends(get_db)):
    ppmp = db.query(PPMP).filter(PPMP.id == ppmp_id).first()
    if not ppmp:
        raise HTTPException(status_code=404, detail="PPMP not found")

    office = db.query(Office).filter(Office.id == ppmp.office_id).first()

    rows = []
    grand_total = 0

    for project in ppmp.projects:
        lots = project.lots if project.lots else []
        for lot in lots:
            grand_total += lot.estimated_budget or 0
            rows.append({
                "project_title": f"{project.description} — {lot.lot_no}" if len(project.lots) > 1 else project.description,
                "end_user": office.name if office else "",
                "general_description": project.description,
                "procurement_mode": project.procurement_mode or "",
                "early_procurement": "No",
                "bid_evaluation": "LCRB" if project.procurement_mode == "Competitive Public Bidding" else "N/A",
                "start_activity": project.start_activity or "",
                "end_activity": project.end_activity or "",
                "source_of_funds": project.source_of_funds or "GoP",
                "estimated_budget": lot.estimated_budget or 0,
                "procurement_strategy": project.supporting_docs or "",
                "remarks": project.remarks or "",
            })

    return {
        "ppmp_id": ppmp.id,
        "ppmp_no": ppmp.ppmp_no,
        "year": ppmp.year,
        "office_name": office.name if office else "",
        "total_rows": len(rows),
        "grand_total": grand_total,
        "rows": rows
    }