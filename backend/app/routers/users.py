from typing import Optional

from fastapi import APIRouter, HTTPException, Form
from beanie import PydanticObjectId

from app.models.user import User
from app.schemas.user import UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.patch("/{user_id}", response_model=UserOut)
async def update_own_profile(
    user_id: str,
    requester_uid: str,
    full_name: Optional[str] = Form(None),
):
    """
    Self-service profile update (User Profile -> Full Name).

    Only the account owner may change their own profile. This updates the
    User document's `full_name` only — it deliberately does NOT touch any
    historical PPMP/APP/PR records, so those keep the name they were
    created with. New records read `full_name` at creation time and will
    therefore use the updated name.
    """
    try:
        oid = PydanticObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=404, detail="User not found")

    user = await User.get(oid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    requester = await User.find_one(User.supabase_uid == requester_uid)
    if not requester:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if str(requester.id) != user_id:
        raise HTTPException(
            status_code=403,
            detail="You can only update your own profile.",
        )

    if full_name is not None:
        full_name = full_name.strip()
        if not full_name:
            raise HTTPException(status_code=400, detail="Name can't be empty")
        user.full_name = full_name

    await user.save()
    return user
