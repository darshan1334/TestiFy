"""
FastAPI router for report downloads.
GET /api/reports/{session_id}/html   — download HTML report
GET /api/reports/{session_id}/json   — download JSON report
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database.db import get_db
from database.models import TestReport, TestSession
import json, os

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/{session_id}/html")
async def get_html_report(session_id: str, db: AsyncSession = Depends(get_db)):
    """Download the HTML report for a completed test session."""
    report = await _get_report(session_id, db)
    if not report.html_path or not os.path.exists(report.html_path):
        raise HTTPException(status_code=404, detail="HTML report not yet generated")
    return FileResponse(
        path=report.html_path,
        media_type="text/html",
        filename=f"testify-report-{session_id[:8]}.html",
    )


@router.get("/{session_id}/json")
async def get_json_report(session_id: str, db: AsyncSession = Depends(get_db)):
    """Download the JSON report for a completed test session."""
    report = await _get_report(session_id, db)
    if not report.json_path or not os.path.exists(report.json_path):
        raise HTTPException(status_code=404, detail="JSON report not yet generated")
    with open(report.json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return JSONResponse(content=data)


@router.get("/{session_id}/pdf")
async def get_pdf_report(session_id: str, db: AsyncSession = Depends(get_db)):
    """Download the PDF report for a completed test session."""
    report = await _get_report(session_id, db)
    if not report.pdf_path or not os.path.exists(report.pdf_path):
        raise HTTPException(status_code=404, detail="PDF report not available")
    return FileResponse(
        path=report.pdf_path,
        media_type="application/pdf",
        filename=f"testify-report-{session_id[:8]}.pdf",
    )


async def _get_report(session_id: str, db: AsyncSession) -> TestReport:
    result = await db.execute(
        select(TestReport).where(TestReport.session_id == session_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found. Session may still be running.")
    return report
