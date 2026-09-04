"""
FastAPI router for user-submitted issue reports.

POST /api/issues              — create a new user issue report (multipart, optional screenshot)
GET  /api/issues              — list all user-submitted issues
GET  /api/issues/{issue_id}   — get one user-submitted issue by ID
"""
import logging
import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from database.db import get_db
from database.models import IssueReport, User
from routers.auth import get_optional_user
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/issues", tags=["issues"])

# ── Constants ─────────────────────────────────────────────────────────────────
VALID_LOCATIONS = {
    "Dashboard", "New Test", "Test History", "Test Results",
    "Bugs", "Analytics", "Reports", "Security Scan", "Settings", "Other"
}
VALID_SEVERITIES = {"Critical", "High", "Medium", "Low"}
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"}
ALLOWED_IMAGE_MIMETYPES = {
    "image/jpeg", "image/png", "image/gif",
    "image/webp", "image/bmp", "image/svg+xml"
}

# Screenshot directory for user-uploaded evidence (separate from AI screenshots)
USER_UPLOADS_DIR = os.path.join(settings.screenshot_dir, "user_uploads")


def _ensure_uploads_dir():
    os.makedirs(USER_UPLOADS_DIR, exist_ok=True)


# ── Pydantic-like response dict helper ────────────────────────────────────────
def _serialize(report: IssueReport) -> dict:
    return {
        "id": report.id,
        "title": report.title,
        "description": report.description,
        "location": report.location,
        "severity": report.severity,
        "screenshot_path": report.screenshot_path,
        "screenshot_url": (
            f"/screenshots/user_uploads/{os.path.basename(report.screenshot_path)}"
            if report.screenshot_path else None
        ),
        "status": report.status,
        "source": "User Report",
        "created_at": report.created_at.isoformat() if report.created_at else None,
        "updated_at": report.updated_at.isoformat() if report.updated_at else None,
    }


# ── POST /api/issues ──────────────────────────────────────────────────────────
@router.post("", status_code=201)
async def create_issue(
    title: str = Form(...),
    description: str = Form(...),
    location: str = Form(...),
    severity: str = Form(...),
    screenshot: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Create a new user-submitted issue report."""

    # ── Validate required fields ──────────────────────────────────────────────
    errors = {}

    title = title.strip() if title else ""
    description = description.strip() if description else ""
    location = location.strip() if location else ""
    severity = severity.strip() if severity else ""

    if not title:
        errors["title"] = "Issue title is required."
    elif len(title) > 500:
        errors["title"] = "Issue title must be 500 characters or fewer."

    if not description:
        errors["description"] = "Issue description is required."

    if not location:
        errors["location"] = "Location is required."
    elif location not in VALID_LOCATIONS:
        errors["location"] = f"Location must be one of: {', '.join(sorted(VALID_LOCATIONS))}"

    if not severity:
        errors["severity"] = "Severity is required."
    elif severity not in VALID_SEVERITIES:
        errors["severity"] = f"Severity must be one of: {', '.join(sorted(VALID_SEVERITIES))}"

    if errors:
        raise HTTPException(status_code=422, detail=errors)

    # ── Handle screenshot upload ───────────────────────────────────────────────
    screenshot_path = None
    if screenshot and screenshot.filename:
        _ensure_uploads_dir()

        # Validate MIME type
        if screenshot.content_type not in ALLOWED_IMAGE_MIMETYPES:
            raise HTTPException(
                status_code=422,
                detail={"screenshot": f"Invalid file type '{screenshot.content_type}'. Only image files are allowed."}
            )

        # Validate extension
        ext = os.path.splitext(screenshot.filename)[1].lower()
        if ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(
                status_code=422,
                detail={"screenshot": f"Invalid file extension '{ext}'. Allowed: {', '.join(sorted(ALLOWED_IMAGE_EXTENSIONS))}"}
            )

        # Save with a safe random filename (no path traversal risk)
        safe_filename = f"{uuid.uuid4().hex}{ext}"
        save_path = os.path.join(USER_UPLOADS_DIR, safe_filename)

        try:
            contents = await screenshot.read()
            # 10 MB limit per screenshot
            if len(contents) > 10 * 1024 * 1024:
                raise HTTPException(
                    status_code=422,
                    detail={"screenshot": "Screenshot must be 10 MB or smaller."}
                )
            with open(save_path, "wb") as f:
                f.write(contents)
            screenshot_path = save_path
            logger.info(f"Screenshot saved: {save_path}")
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to save screenshot: {e}")
            raise HTTPException(status_code=500, detail="Failed to save screenshot. Please try again.")

    # ── Persist to database ───────────────────────────────────────────────────
    try:
        report = IssueReport(
            user_id=current_user.id if current_user else None,
            title=title,
            description=description,
            location=location,
            severity=severity,
            screenshot_path=screenshot_path,
            status="Open",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(report)
        await db.flush()
        await db.refresh(report)
        result = _serialize(report)
        logger.info(f"User issue report created: {report.id}")
        return JSONResponse(status_code=201, content=result)
    except Exception as e:
        logger.error(f"Database error creating issue report: {e}")
        raise HTTPException(status_code=500, detail="Failed to save issue report. Please try again.")


# ── GET /api/issues ───────────────────────────────────────────────────────────
@router.get("")
async def list_issues(db: AsyncSession = Depends(get_db)):
    """Return all user-submitted issue reports, newest first."""
    try:
        result = await db.execute(
            select(IssueReport).order_by(desc(IssueReport.created_at))
        )
        reports = result.scalars().all()
        return [_serialize(r) for r in reports]
    except Exception as e:
        logger.error(f"Database error listing issues: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve issues.")


# ── GET /api/issues/{issue_id} ────────────────────────────────────────────────
@router.get("/{issue_id}")
async def get_issue(issue_id: str, db: AsyncSession = Depends(get_db)):
    """Return a single user-submitted issue report by ID."""
    try:
        result = await db.execute(
            select(IssueReport).where(IssueReport.id == issue_id)
        )
        report = result.scalar_one_or_none()
        if not report:
            raise HTTPException(status_code=404, detail="Issue report not found.")
        return _serialize(report)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Database error fetching issue {issue_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve issue.")
