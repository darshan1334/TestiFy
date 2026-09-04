"""
Isolated Admin authentication helper.
Provides verify_admin() for .env-based admin credential verification.
Does NOT touch the existing User authentication system.
Credentials and hashes are NEVER logged or returned to the frontend.
"""
from passlib.context import CryptContext
from admin_settings import admin_settings

_bcrypt_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_admin(username: str, password: str) -> bool:
    """
    Returns True only when BOTH conditions are met:
      1. username matches ADMIN_USERNAME from .env (case-sensitive)
      2. password verifies against ADMIN_PASSWORD_HASH from .env (bcrypt)
    Returns False in all other cases — including on any exception.
    """
    try:
        username_ok = username == admin_settings.admin_username
        password_ok = _bcrypt_ctx.verify(password, admin_settings.admin_password_hash)
        return username_ok and password_ok
    except Exception:
        # Never surface internal errors; just deny
        return False
