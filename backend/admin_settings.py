"""
Isolated Admin settings loader.
Reads ADMIN_USERNAME and ADMIN_PASSWORD_HASH from the backend .env file.
Does NOT modify or replace the existing Settings class in config.py.
"""
from pydantic_settings import BaseSettings
from pydantic import Field


class AdminSettings(BaseSettings):
    admin_username: str = Field(..., env="ADMIN_USERNAME")
    admin_password_hash: str = Field(..., env="ADMIN_PASSWORD_HASH")

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


admin_settings = AdminSettings()
