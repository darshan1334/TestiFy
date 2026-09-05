"""
TestiFy — FastAPI Backend Entry Point

Architecture:
  React Frontend (port 5173)
    ↓ REST + WebSocket
  FastAPI (port 8000)
    ↓
  Agent Orchestrator → Playwright Crawler → Gemini AI → SQLite → Reports
"""
import sys
import asyncio
import logging
import os
from contextlib import asynccontextmanager

# ── Windows fix: Playwright requires ProactorEventLoop for subprocess pipes ───
# This MUST run before uvicorn creates its event loop.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import settings
from database.db import init_db
from routers import sessions, reports, issues as issues_router, auth, admin, admin_login as admin_login_router
from security import router as security_router

logging.basicConfig(
    level=getattr(logging, settings.log_level, logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    logger.info("🚀 TestiFy backend starting…")
    await init_db()
    os.makedirs(settings.screenshot_dir, exist_ok=True)
    os.makedirs("generated_reports", exist_ok=True)
    security_router.init_security_module()
    logger.info("✅ Database and directories ready")
    yield
    logger.info("👋 TestiFy backend shutting down")


app = FastAPI(
    title="TestiFy API",
    description="AI Autonomous Software Testing Agent — Backend",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(sessions.router)
app.include_router(reports.router)
app.include_router(issues_router.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(admin_login_router.router)
# TestiFy Security add-on — all routes live under /api/security
app.include_router(security_router.router)

# ── Static files ──────────────────────────────────────────────────────────────
os.makedirs(settings.screenshot_dir, exist_ok=True)
app.mount("/screenshots", StaticFiles(directory=settings.screenshot_dir), name="screenshots")
app.mount("/api/screenshots", StaticFiles(directory=settings.screenshot_dir), name="api_screenshots")


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "service": "TestiFy API",
        "version": "1.0.0",
        "gemini_model": settings.gemini_model,
        "platform": sys.platform,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, loop="asyncio")
