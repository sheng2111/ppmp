"""
Admin Consolidated PPMP router.

GET  /api/admin/ppmp-consolidation           -> JSON tree for the page
GET  /api/admin/ppmp-consolidation/export/excel
GET  /api/admin/ppmp-consolidation/export/pdf

All endpoints are read-only. Editing continues to happen on the
individual office's PPMP pages, never here.

Auth note: this project's require_admin (app/routers/auth.py) is a plain
async function taking requester_uid directly — not a FastAPI Depends()
dependency wired to a Request/token. So it's called manually inside each
route body, same as the other admin routes in auth.py, with requester_uid
passed in as a query parameter by the frontend.
"""
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from app.schemas.consolidation import ConsolidatedPPMPResponse
from app.services.consolidation_service import build_consolidated_view, get_categories
from app.utils.export_consolidated import export_to_excel, export_to_pdf
from app.routers.auth import require_admin

router = APIRouter(
    prefix="/admin/ppmp-consolidation",
    tags=["Admin - PPMP Consolidation"],
)


@router.get("/categories")
async def get_categories_route(requester_uid: str):
    """
    Returns the real Fee Category list (FeeCategory.name) — the same
    categories shown in the Fee Categories admin tab (STF, OJT Fees,
    Laboratory Fees, etc.), NOT anything derived from PPMP entry text.
    """
    await require_admin(requester_uid)
    return await get_categories()


@router.get("", response_model=ConsolidatedPPMPResponse)
async def get_consolidated_ppmp(
    requester_uid: str,
    fee_category: str = Query(..., description="e.g. 'OJT Fees'"),
    fiscal_year: int = Query(...),
    ppmp_type: str = Query(..., description="'indicative' or 'final'"),
):
    await require_admin(requester_uid)
    return await build_consolidated_view(fee_category, fiscal_year, ppmp_type)


@router.get("/export/excel")
async def export_excel(
    requester_uid: str,
    fee_category: str = Query(...),
    fiscal_year: int = Query(...),
    ppmp_type: str = Query(...),
):
    await require_admin(requester_uid)
    data = await build_consolidated_view(fee_category, fiscal_year, ppmp_type)
    buffer = export_to_excel(data)
    filename = f"PPMP_Consolidation_{fee_category}_{fiscal_year}_{ppmp_type}.xlsx".replace(" ", "_")
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/pdf")
async def export_pdf(
    requester_uid: str,
    fee_category: str = Query(...),
    fiscal_year: int = Query(...),
    ppmp_type: str = Query(...),
):
    await require_admin(requester_uid)
    data = await build_consolidated_view(fee_category, fiscal_year, ppmp_type)
    buffer = export_to_pdf(data)
    filename = f"PPMP_Consolidation_{fee_category}_{fiscal_year}_{ppmp_type}.pdf".replace(" ", "_")
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )