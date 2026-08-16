from typing import List, Literal, Optional

from beanie import Document
from pydantic import BaseModel, Field


class AppSignatory(BaseModel):
    order_no: int = 1
    sign_off: str
    name: str
    position: str


class AppMeta(Document):
    """
    Per-PPMP settings for the generated APP that have no home on the PPMP
    itself: the Indicative/Final/Updated version state, and the APP's own
    signature block (which can differ from the PPMP's signatories — e.g.
    APP signatories are typically BAC roles like Chairperson/Head of the
    Procuring Entity, not the PPMP's Prepared/Submitted By).

    One record per ppmp_id — edited only via EditAppMetaPage.tsx /
    PUT /app/meta/{ppmp_id}. APPPage.tsx (view/print/export) only ever
    reads this, merged in by generate_app_from_ppmp.
    """

    ppmp_id: str
    version_type: Literal["indicative", "final", "updated"] = "indicative"
    # Only meaningful when version_type == "updated".
    version_no: Optional[str] = None
    signatories: List[AppSignatory] = Field(default_factory=list)

    class Settings:
        name = "app_meta"
        indexes = ["ppmp_id"]