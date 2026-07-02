from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from app.database import get_db
from app.models.user import User, UserOffice
from app.models.office import Office
from app.schemas.user import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/auth", tags=["auth"])


def require_admin(requester_uid: str, db: Session) -> User:
    requester = db.query(User).filter(User.supabase_uid == requester_uid).first()
    if not requester or requester.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return requester


# ── Public / self endpoints ──────────────────────────────────────────────────

@router.post("/register", response_model=UserOut)
def register_user(payload: UserCreate, db: Session = Depends(get_db)):
    """Called by frontend after Google sign-in. Creates User row if not exists."""
    existing = db.query(User).filter(User.supabase_uid == payload.supabase_uid).first()
    if existing:
        return existing
    user = User(
        supabase_uid=payload.supabase_uid,
        full_name=payload.full_name,
        email=payload.email,
        role="user",           # always start as user, admin promotes manually
        designation=payload.designation,
        is_approved=False,     # always start unapproved, admin approves manually
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/me/{supabase_uid}", response_model=UserOut)
def get_me(supabase_uid: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.supabase_uid == supabase_uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ── Admin endpoints ──────────────────────────────────────────────────────────

@router.get("/users", response_model=List[UserOut])
def list_users(
    requester_uid: str,
    is_approved: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    """List all users. Filter by is_approved=false for pending queue."""
    require_admin(requester_uid, db)
    query = db.query(User)
    if is_approved is not None:
        query = query.filter(User.is_approved == is_approved)
    return query.all()


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    requester_uid: str,
    db: Session = Depends(get_db),
):
    """
    Admin action: update designation, role, is_approved, and/or office assignments.
    Sending office_ids replaces all current office assignments for that user.
    """
    require_admin(requester_uid, db)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.designation is not None:
        user.designation = payload.designation
    if payload.role is not None:
        user.role = payload.role
    if payload.is_approved is not None:
        user.is_approved = payload.is_approved

    # Replace office assignments if provided
    if payload.office_ids is not None:
        # Delete existing assignments
        db.query(UserOffice).filter(UserOffice.user_id == user_id).delete()
        # Insert new ones
        for office_id in payload.office_ids:
            office = db.query(Office).filter(Office.id == office_id).first()
            if not office:
                raise HTTPException(
                    status_code=404, detail=f"Office id={office_id} not found"
                )
            db.add(UserOffice(user_id=user_id, office_id=office_id))

    db.commit()
    db.refresh(user)
    return user