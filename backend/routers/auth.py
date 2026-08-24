"""Auth router — /api/auth/*"""
import uuid
from fastapi import APIRouter, HTTPException, Form, Depends
from ..database import create_user, get_user_by_email, get_user_by_id
from ..auth import hash_password, verify_password, create_token
from ..dependencies import get_current_user, public_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register")
def register(
    email: str = Form(...),
    password: str = Form(...),
    display_name: str = Form(None),
):
    email = (email or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="A valid email is required")
    if not password or len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if get_user_by_email(email):
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user_id = str(uuid.uuid4())
    ok = create_user(user_id, email, hash_password(password), display_name)
    if not ok:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = get_user_by_id(user_id)
    return {"token": create_token(user_id), "user": public_user(user)}


@router.post("/login")
def login(email: str = Form(...), password: str = Form(...)):
    email = (email or "").strip().lower()
    user = get_user_by_email(email) if email else None
    if not user or not verify_password(password or "", user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"token": create_token(user["id"]), "user": public_user(user)}


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    return {"user": public_user(user)}
