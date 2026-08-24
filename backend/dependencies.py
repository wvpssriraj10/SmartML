"""
Shared FastAPI dependencies.

Extracted from main.py so every router can import them without
creating circular imports.
"""
from fastapi import Header, HTTPException
from .auth import verify_token
from .database import get_user_by_id


def get_current_user(authorization: str = Header(None)) -> dict:
    """FastAPI dependency: resolve the bearer token to a user record."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1].strip()
    user_id = verify_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return user


def public_user(user: dict) -> dict:
    """Return only safe-to-expose user fields."""
    return {
        "id": user["id"],
        "email": user["email"],
        "display_name": user.get("display_name"),
        "created_at": user.get("created_at"),
    }
