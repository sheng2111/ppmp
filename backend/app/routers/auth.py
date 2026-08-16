from fastapi import APIRouter, HTTPException
from beanie import PydanticObjectId
from beanie.operators import In
from typing import List, Optional

from app.models.user import User
from app.schemas.user import UserCreate, UserOut, UserUpdate, OnboardRequest

router = APIRouter(prefix="/auth", tags=["auth"])


async def require_admin(requester_uid: str) -> User:
    requester = await User.find_one(User.supabase_uid == requester_uid)
    if not requester or requester.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return requester


# ── Public / self endpoints ──────────────────────────────────────────────────

@router.post("/register", response_model=UserOut)
async def register_user(payload: UserCreate):
    """Legacy endpoint — creates a bare User. Kept for backward compatibility."""
    existing = await User.find_one(User.supabase_uid == payload.supabase_uid)
    if existing:
        return existing
    user = User(
        supabase_uid=payload.supabase_uid,
        full_name=payload.full_name,
        email=payload.email,
        role="user",
        designation=payload.designation,
        is_approved=True,
    )
    await user.insert()
    return user


@router.post("/onboard", response_model=UserOut)
async def onboard_user(payload: OnboardRequest):
    """
    Called right after Google sign-in, once the user has set their name and
    password. Creates the account and activates it immediately — office
    selection now happens when the user creates a PPMP, not here.
    """
    existing = await User.find_one(User.supabase_uid == payload.supabase_uid)
    if existing:
        raise HTTPException(status_code=400, detail="An account already exists for this sign-in")

    user = User(
        supabase_uid=payload.supabase_uid,
        full_name=payload.full_name,
        email=payload.email,
        role="user",
        is_approved=True,
    )
    await user.insert()
    return user


@router.get("/me/{supabase_uid}", response_model=UserOut)
async def get_me(supabase_uid: str):
    user = await User.find_one(User.supabase_uid == supabase_uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/me-by-id/{user_id}", response_model=UserOut)
async def get_me_by_id(user_id: str):
    """Fetch a user by internal Mongo id (used to resolve PPMP/APP/PR creators)."""
    try:
        oid = PydanticObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=404, detail="User not found")
    user = await User.get(oid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ── Admin endpoints ──────────────────────────────────────────────────────────
# Approval concept is gone, but role management / cleanup is still useful.

@router.get("/users", response_model=List[UserOut])
async def list_users(requester_uid: str, is_approved: Optional[bool] = None):
    await require_admin(requester_uid)
    if is_approved is not None:
        return await User.find(User.is_approved == is_approved).to_list()
    return await User.find_all().to_list()


@router.put("/users/{user_id}", response_model=UserOut)
async def update_user(user_id: str, payload: UserUpdate, requester_uid: str):
    """Admin action: change role or make a correction. No approval gate anymore."""
    await require_admin(requester_uid)

    try:
        oid = PydanticObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=404, detail="User not found")
    user = await User.get(oid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.designation is not None:
        user.designation = payload.designation
    if payload.role is not None:
        user.role = payload.role
    if payload.is_approved is not None:
        user.is_approved = payload.is_approved

    await user.save()
    return user


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, requester_uid: str):
    """
    Admin action: permanently delete a user account. Does NOT touch their
    Supabase Auth account, so they can sign in and set up a new account.
    """
    requester = await require_admin(requester_uid)

    if str(requester.id) == user_id:
        raise HTTPException(status_code=400, detail="You can't delete your own account")

    try:
        oid = PydanticObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=404, detail="User not found")
    user = await User.get(oid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await user.delete()
    return {"message": f"User {user.email} deleted"}