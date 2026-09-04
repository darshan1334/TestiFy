"""
Configuration settings loaded from environment variables.
"""
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List
import os


class Settings(BaseSettings):
    # Gemini AI (primary provider)
    gemini_api_key: str = Field(..., env="GEMINI_API_KEY")
    gemini_model: str = Field("gemini-3.6-flash", env="GEMINI_MODEL")

    # Groq (automatic fallback when Gemini is rate-limited / quota-exhausted)
    groq_api_key: str = Field("", env="GROQ_API_KEY")
    groq_model: str = Field("openai/gpt-oss-120b", env="GROQ_MODEL")

    # Database
    database_url: str = Field(
        "sqlite+aiosqlite:///./testify.db", env="DATABASE_URL"
    )

    # CORS
    cors_origins: str = Field(
        "http://localhost:5173,http://127.0.0.1:5173", env="CORS_ORIGINS"
    )

    # Crawler
    max_crawl_pages: int = Field(10, env="MAX_CRAWL_PAGES")
    screenshot_dir: str = Field("screenshots", env="SCREENSHOT_DIR")

    # Logging
    log_level: str = Field("INFO", env="LOG_LEVEL")

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
