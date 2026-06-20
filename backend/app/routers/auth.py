from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from pydantic import BaseModel
from ..database import get_users_db
from ..models.user import User
from ..core.config import settings

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


class RegisterRequest(BaseModel):
    username: str
    password: str


def verify_password(plain, hashed):
    return pwd_context.verify(plain[:72], hashed)


def hash_password(password):
    return pwd_context.hash(password[:72])


def create_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_users_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

@router.get("/check-profile")
def check_profile(email: str, db: Session = Depends(get_users_db)):
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_profile_complete:
        return {"is_complete": False}
    
    token = create_token({"sub": user.username})
    return {
        "is_complete": True,
        "access_token": token,
        "username": user.username,
        "full_name": user.full_name
    }
    
@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_users_db)):
    if len(req.password) > 72:
        raise HTTPException(
            status_code=400,
            detail="Password must be 72 characters or fewer."
        )
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    user = User(username=req.username, hashed_password=hash_password(req.password))
    db.add(user)
    db.commit()
    return {"message": "User registered successfully"}

@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_users_db)):
    user = db.query(User).filter(User.username == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    token = create_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}

class CompleteProfileRequest(BaseModel):
    full_name: str
    username: str
    password: str
    email: str
    google_id: str

@router.post("/complete-profile")
def complete_profile(req: CompleteProfileRequest, db: Session = Depends(get_users_db)):
    # Check if username already taken
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Find user by email or create new
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        user = User(email=req.email)
        db.add(user)
    
    # Update profile
    user.full_name = req.full_name
    user.username = req.username
    user.hashed_password = hash_password(req.password[:72])
    user.google_id = req.google_id
    user.is_profile_complete = True
    db.commit()
    
    # Return JWT token
    token = create_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}

class ResetPasswordRequest(BaseModel):
    email: str
    new_password: str

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_users_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if len(req.new_password) > 72:
        raise HTTPException(status_code=400, detail="Password must be 72 characters or fewer.")
    user.hashed_password = hash_password(req.new_password)
    db.commit()
    return {"message": "Password reset successfully."}