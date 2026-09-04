"""
FastAPI router for test session management.
POST /api/sessions        — create and start a new test session from a URL
POST /api/sessions/github — create and start a session from a GitHub repository
POST /api/sessions/upload — create and start a session from an uploaded ZIP
GET  /api/sessions        — list all sessions
GET  /api/sessions/{id}   — get session details with issues
"""
import asyncio
import io
import logging
import os
import re
import shutil
import subprocess
import tempfile
import zipfile
from typing import Optional
from fastapi import (
    APIRouter, Depends, HTTPException, BackgroundTasks, WebSocket,
    WebSocketDisconnect, UploadFile, File,
)
from pydantic import BaseModel, HttpUrl
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from database.db import get_db, get_db_context
from database.models import TestSession, TestIssue
from agent.orchestrator import TestOrchestrator
from agent.source_orchestrator import SourceTestOrchestrator, _remove_checkout
from security import router as security_router

import uuid
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/sessions", tags=["sessions"])

# Cloned repos and extracted archives live here and are deleted as soon as the
# session that owns them finishes.
SOURCE_ROOT = os.path.join(tempfile.gettempdir(), "testify_source_projects")

# Uploaded archives are streamed into memory, so cap them.
MAX_UPLOAD_BYTES = 200 * 1024 * 1024  # 200 MB

_GIT_URL_RE = re.compile(
    r"^https?://(www\.)?(github|gitlab|bitbucket)\.(com|org)/[\w.\-]+/[\w.\-]+/?$",
    re.IGNORECASE,
)

# ── Active WebSocket connections and progress state cache ─────────────────────
active_connections: dict[str, list[WebSocket]] = {}
session_progress_cache: dict[str, dict] = {}


class StartSessionRequest(BaseModel):
    url: str
    max_pages: Optional[int] = 5


class StartGithubSessionRequest(BaseModel):
    repo_url: str


class SessionResponse(BaseModel):
    id: str
    url: str
    source_type: Optional[str] = "url"
    status: str
    created_at: datetime
    pages_crawled: int
    total_issues: int
    critical_issues: int
    high_issues: int
    medium_issues: int
    low_issues: int
    ai_summary: Optional[str]
    overall_health: Optional[str]
    performance_score: Optional[float]
    accessibility_score: Optional[float]

    class Config:
        from_attributes = True


# ── WebSocket endpoint ────────────────────────────────────────────────────────
@router.websocket("/ws/{session_id}")
async def websocket_progress(websocket: WebSocket, session_id: str):
    """WebSocket endpoint that streams real-time progress for a session."""
    await websocket.accept()
    active_connections.setdefault(session_id, []).append(websocket)
    
    # Send current cached state immediately on connect if available
    try:
        if session_id in session_progress_cache:
            await websocket.send_json(session_progress_cache[session_id])
        else:
            async with get_db_context() as db:
                stmt = select(TestSession).where(TestSession.id == session_id)
                sess = (await db.execute(stmt)).scalar_one_or_none()
                if sess:
                    if sess.status == "completed":
                        await websocket.send_json({
                            "type": "progress",
                            "phase": "completed",
                            "message": f"Testing complete! {sess.total_issues} issues found.",
                            "progress": 100
                        })
                    elif sess.status == "failed":
                        await websocket.send_json({
                            "type": "progress",
                            "phase": "failed",
                            "message": "Testing session failed",
                            "progress": 100
                        })
                    elif sess.status == "running":
                        await websocket.send_json({
                            "type": "progress",
                            "phase": "exploring",
                            "message": "Testing in progress…",
                            "progress": 25
                        })
    except Exception as e:
        logger.debug(f"Initial ws handshake notice: {e}")

    try:
        while True:
            # Keep connection alive; receive pings/messages from client
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        conns = active_connections.get(session_id, [])
        if websocket in conns:
            conns.remove(websocket)


async def broadcast(session_id: str, message: dict):
    """Send a message to all active WebSocket listeners for this session."""
    session_progress_cache[session_id] = message
    dead = []
    for ws in list(active_connections.get(session_id, [])):
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(ws)
    for d in dead:
        if d in active_connections.get(session_id, []):
            active_connections[session_id].remove(d)


# ── REST endpoints ────────────────────────────────────────────────────────────
@router.post("", status_code=201)
async def create_session(
    body: StartSessionRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Create a new test session and kick off the agent pipeline in the background."""
    session_id = str(uuid.uuid4())

    session = TestSession(
        id=session_id,
        url=body.url,
        source_type="url",
        status="pending",
    )
    db.add(session)
    # Commit before scheduling the background task: flush alone leaves a write
    # transaction open on this connection, and the pipeline runs on a different
    # pooled connection — the two would then deadlock on the SQLite file.
    await db.commit()

    # Initial state
    session_progress_cache[session_id] = {
        "type": "progress",
        "phase": "initialising",
        "message": "Session initialized. Launching browser…",
        "progress": 5,
    }

    # Kick off pipeline in background
    background_tasks.add_task(_run_pipeline, session_id, body.url, body.max_pages or 5)

    return {"id": session_id, "status": "pending", "url": body.url, "source_type": "url"}


async def _run_pipeline(session_id: str, url: str, max_pages: int):
    """Background task that runs the full test orchestrator."""
    async def send_update(message: dict):
        await broadcast(session_id, message)

    orchestrator = TestOrchestrator(send_update=send_update)
    await orchestrator.run(session_id=session_id, url=url)


# ── Codebase intake: GitHub repository and ZIP upload ─────────────────────────
async def _create_source_session(session_id: str, label: str, source_type: str):
    """Insert the session row before its background pipeline is scheduled."""
    async with get_db_context() as db:
        db.add(TestSession(
            id=session_id,
            url=label,
            source_type=source_type,
            status="pending",
        ))

    session_progress_cache[session_id] = {
        "type": "progress",
        "phase": "initialising",
        "message": "Session initialized. Reading project files…",
        "progress": 5,
    }


async def _run_source_pipeline(
    session_id: str, project_dir: str, label: str, source_type: str, cleanup_dir: str,
    archive_bytes: int | None = None,
):
    """
    Background task that runs the codebase orchestrator.

    Any codebase that arrives through New Test (a ZIP upload or a cloned repo)
    is also swept by the SecureCode scanner, so it turns up in Scan History and
    its findings can be reopened there. Both pipelines only read the checkout,
    so they run concurrently; this task owns the cleanup and deletes the
    directory once *both* are finished, instead of letting the test orchestrator
    pull the files out from under a scan that is still walking them.
    """
    async def send_update(message: dict):
        await broadcast(session_id, message)

    orchestrator = SourceTestOrchestrator(send_update=send_update)
    security_task = asyncio.create_task(
        security_router.scan_session_source(
            session_id=session_id,
            project_dir=project_dir,
            project_name=_project_name_from_label(label, source_type),
            source=source_type,
            origin=label,
            size_bytes=archive_bytes,
        )
    )

    try:
        await orchestrator.run_source(
            session_id=session_id,
            project_dir=project_dir,
            target_label=label,
            source_type=source_type,
            cleanup_dir=cleanup_dir,
            cleanup=False,
        )
    finally:
        try:
            await security_task
        except Exception:
            # A failed security sweep is recorded on its own scan row and must
            # never take the test session down with it.
            logger.exception(f"Linked security scan failed for session {session_id}")
        # Not a plain rmtree: a shallow clone leaves read-only files under .git,
        # which Windows refuses to delete, and ignore_errors would leak the whole
        # checkout silently.
        await asyncio.to_thread(_remove_checkout, cleanup_dir or project_dir)


def _project_name_from_label(label: str, source_type: str) -> str:
    """Turn 'my-app.zip' / 'https://github.com/org/repo' into 'my-app' / 'repo'."""
    if source_type == "github":
        return label.rstrip("/").rsplit("/", 1)[-1].removesuffix(".git") or label
    return label.rsplit(".", 1)[0] if label.lower().endswith(".zip") else label


@router.post("/github", status_code=201)
async def create_github_session(
    body: StartGithubSessionRequest,
    background_tasks: BackgroundTasks,
):
    """Shallow-clone a public repository and run the test pipeline against it."""
    repo_url = body.repo_url.strip().rstrip("/")
    if repo_url.endswith(".git"):
        repo_url = repo_url[:-4]
    if not _GIT_URL_RE.match(repo_url):
        raise HTTPException(
            status_code=400,
            detail="Enter a public repository URL, e.g. https://github.com/owner/repo",
        )

    session_id = str(uuid.uuid4())
    project_dir = os.path.join(SOURCE_ROOT, session_id)
    os.makedirs(SOURCE_ROOT, exist_ok=True)

    try:
        proc = await asyncio.create_subprocess_exec(
            "git", "clone", "--depth", "1", f"{repo_url}.git", project_dir,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=180)
    except asyncio.TimeoutError:
        shutil.rmtree(project_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail="Cloning the repository timed out after 3 minutes.")
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="git is not installed on the server.")

    if proc.returncode != 0:
        shutil.rmtree(project_dir, ignore_errors=True)
        detail = stderr.decode(errors="ignore").strip().splitlines()
        raise HTTPException(
            status_code=400,
            detail=f"Could not clone repository: {detail[-1] if detail else 'unknown error'}"[:300],
        )

    await _create_source_session(session_id, repo_url, "github")
    background_tasks.add_task(
        _run_source_pipeline, session_id, project_dir, repo_url, "github", project_dir
    )

    return {"id": session_id, "status": "pending", "url": repo_url, "source_type": "github"}


@router.post("/upload", status_code=201)
async def create_upload_session(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """Extract an uploaded project archive and run the test pipeline against it."""
    filename = file.filename or "project.zip"
    if not filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip archives are supported.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Archive is larger than the 200 MB limit.")

    session_id = str(uuid.uuid4())
    project_dir = os.path.join(SOURCE_ROOT, session_id)
    os.makedirs(project_dir, exist_ok=True)

    try:
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            # zip-slip protection: refuse archives that escape the target dir
            root = os.path.normpath(project_dir)
            for member in zf.namelist():
                target = os.path.normpath(os.path.join(project_dir, member))
                if not target.startswith(root):
                    raise HTTPException(status_code=400, detail="Unsafe archive contents detected.")
            zf.extractall(project_dir)
    except zipfile.BadZipFile:
        shutil.rmtree(project_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid ZIP archive.")
    except HTTPException:
        shutil.rmtree(project_dir, ignore_errors=True)
        raise

    # A zip of a project folder usually nests everything one level down; analyse
    # that folder so relative paths in findings stay meaningful.
    entries = os.listdir(project_dir)
    if len(entries) == 1 and os.path.isdir(os.path.join(project_dir, entries[0])):
        analysis_dir = os.path.join(project_dir, entries[0])
    else:
        analysis_dir = project_dir

    label = filename
    await _create_source_session(session_id, label, "zip")
    background_tasks.add_task(
        _run_source_pipeline, session_id, analysis_dir, label, "zip", project_dir, len(content)
    )

    return {"id": session_id, "status": "pending", "url": label, "source_type": "zip"}


@router.get("", response_model=list[SessionResponse])
async def list_sessions(db: AsyncSession = Depends(get_db)):
    """Return all test sessions, newest first."""
    result = await db.execute(
        select(TestSession).order_by(desc(TestSession.created_at))
    )
    return result.scalars().all()


@router.get("/{session_id}")
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)):
    """Return a session with all its issues."""
    result = await db.execute(
        select(TestSession)
        .options(selectinload(TestSession.issues))
        .where(TestSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    issues = [
        {
            "id": i.id,
            "category": i.category,
            "severity": i.severity,
            "title": i.title,
            "description": i.description,
            "recommendation": i.recommendation,
            "page_url": i.page_url,
            "element_selector": i.element_selector,
        }
        for i in session.issues
    ]

    return {
        "id": session.id,
        "url": session.url,
        "source_type": session.source_type or "url",
        "status": session.status,
        "created_at": session.created_at,
        "completed_at": session.completed_at,
        "pages_crawled": session.pages_crawled,
        "total_issues": session.total_issues,
        "critical_issues": session.critical_issues,
        "high_issues": session.high_issues,
        "medium_issues": session.medium_issues,
        "low_issues": session.low_issues,
        "ai_summary": session.ai_summary,
        "overall_health": session.overall_health,
        "performance_score": session.performance_score,
        "accessibility_score": session.accessibility_score,
        "issues": issues,
    }
