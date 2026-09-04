"""
Isolated Admin login route — POST /api/auth/admin-login

Authenticates against environment-based admin credentials (ADMIN_USERNAME /
ADMIN_PASSWORD_HASH in .env) using verify_admin().

This route is completely separate from the existing POST /api/auth/login
which authenticates regular users via the database. That route is untouched.
"""
from fastapi import APIRouter, HTTPException, status, Response
from pydantic import BaseModel
from datetime import timedelta
import os

from admin_auth import verify_admin

router = APIRouter(prefix="/api/auth", tags=["admin-auth"])

# Reuse the same JWT constants as auth.py for token compatibility
_SECRET_KEY = os.getenv("SECRET_KEY", "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7")
_ALGORITHM = "HS256"
_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days


class AdminLoginRequest(BaseModel):
    username: str
    password: str


@router.post("/admin-login")
async def admin_login(credentials: AdminLoginRequest, response: Response):
    """
    Authenticate an admin using .env-based credentials.
    Returns an HTTP-only JWT cookie on success, exactly like /api/auth/login.
    Credentials and hashes are never logged or returned.
    """
    if not verify_admin(credentials.username, credentials.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials",
        )

    # Issue a JWT token with ADMIN role embedded
    from jose import jwt
    from datetime import datetime

    expire = datetime.utcnow() + timedelta(minutes=_TOKEN_EXPIRE_MINUTES)
    token_data = {
        "sub": "env-admin",          # fixed subject for env-based admin
        "role": "ADMIN",
        "username": credentials.username,
        "exp": expire,
    }
    access_token = jwt.encode(token_data, _SECRET_KEY, algorithm=_ALGORITHM)

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=_TOKEN_EXPIRE_MINUTES * 60,
        expires=_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
    )

    return {
        "user": {
            "id": "env-admin",
            "name": "Administrator",
            "email": credentials.username,
            "role": "ADMIN",
        }
    }
