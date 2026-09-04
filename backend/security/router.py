"""
TestiFy Security — SAST add-on router.

Mounted by main.py under the /api/security prefix so it lives alongside the
existing TestiFy testing pipeline without sharing routes, database tables, or
application state.

Orchestrates: upload -> real static analysis -> real secrets detection ->
real dependency parsing + OSV.dev CVE lookup -> SBOM -> reports, with live
progress pushed over a WebSocket. Every number returned to the frontend is
computed from the actual uploaded project; nothing is hardcoded/randomized.
"""
from __future__ import annotations
import asyncio
import io
import logging
import os
import shutil
import subprocess
import tempfile
import uuid
import zipfile

from fastapi import APIRouter, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, StreamingResponse, PlainTextResponse
from pydantic import BaseModel

from .scanner.engine import scan_directory
from .scanner.rules import RULES
from .secrets_detect.engine import scan_secrets
from .deps.parser import find_and_parse_manifests
from .deps.osv_client import query_osv_batch
from .sbom.generator import generate_cyclonedx, generate_spdx
from .reports.generator import to_sarif, to_json_report, to_html_report
from .ai.recommendations import generate_fix
from .core import db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/security", tags=["security"])

# Uploaded projects are extracted here and removed as soon as their scan ends.
UPLOAD_ROOT = os.path.join(tempfile.gettempdir(), "testify_securecode_projects")

ws_connections: dict[str, list[WebSocket]] = {}


def init_security_module():
    """Called from the TestiFy lifespan handler on startup."""
    os.makedirs(UPLOAD_ROOT, exist_ok=True)
    db.init_db()
    logger.info(f"TestiFy Security module ready - {len(RULES)} detection rules loaded")


async def _push_progress(scan_id: str, stage: str, pct: int, message: str):
    conns = ws_connections.get(scan_id, [])
    dead = []
    for ws in conns:
        try:
            await ws.send_json({"stage": stage, "pct": pct, "message": message})
        except Exception:
            dead.append(ws)
    for d in dead:
        if d in conns:
            conns.remove(d)


@router.websocket("/ws/scan/{scan_id}")
async def scan_progress_ws(websocket: WebSocket, scan_id: str):
    await websocket.accept()
    ws_connections.setdefault(scan_id, []).append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        conns = ws_connections.get(scan_id, [])
        if websocket in conns:
            conns.remove(websocket)


async def run_full_scan(scan_id: str, project_dir: str, project_name: str, cleanup: bool = True):
    """
    Full scan pipeline. The scan/secrets/manifest stages are synchronous and
    CPU-bound (they walk and regex every source file), so they run via
    asyncio.to_thread — otherwise a large upload would block the shared event
    loop and stall TestiFy's Playwright crawler and its live progress sockets.

    `cleanup=False` leaves project_dir alone: used when the directory belongs to
    a TestiFy test session that is still analysing it and will delete it itself.
    """
    try:
        await _push_progress(scan_id, "code_scan", 10, "Parsing source files and applying rule set...")
        code_result = await asyncio.to_thread(scan_directory, project_dir, scan_id)

        await _push_progress(scan_id, "secrets", 45, "Scanning for hardcoded credentials...")
        secrets_result = await asyncio.to_thread(scan_secrets, project_dir)

        await _push_progress(scan_id, "dependencies", 65, "Parsing dependency manifests...")
        deps = await asyncio.to_thread(find_and_parse_manifests, project_dir)

        await _push_progress(scan_id, "cve_lookup", 75, "Querying OSV.dev for known CVEs...")
        vuln_map = await query_osv_batch(deps)
        lookup_available = bool(vuln_map) or not deps

        dep_list = []
        vulnerable_count = 0
        for d in deps:
            key = f"{d.ecosystem}:{d.name}:{d.version}"
            matches = vuln_map.get(key, [])
            if matches:
                vulnerable_count += 1
            dep_list.append({
                "name": d.name, "version": d.version, "ecosystem": d.ecosystem,
                "manifest_file": d.manifest_file, "direct": d.direct,
                "vulnerabilities": [{"id": v.id, "summary": v.summary, "severity": v.severity,
                                      "cvss": v.cvss, "fixed_version": v.fixed_version, "url": v.url}
                                     for v in matches],
            })

        deps_result = {
            "total_dependencies": len(deps),
            "vulnerable_count": vulnerable_count,
            "lookup_available": lookup_available,
            "dependencies": dep_list,
        }

        await _push_progress(scan_id, "sbom", 88, "Generating SBOM (CycloneDX + SPDX)...")
        sbom_cdx = generate_cyclonedx(project_name, deps, vuln_map)
        sbom_spdx = generate_spdx(project_name, deps)

        await _push_progress(scan_id, "finalizing", 96, "Compiling risk report...")
        result = {
            "scan_id": scan_id,
            "project_name": project_name,
            "code": code_result,
            "secrets": secrets_result,
            "dependencies": deps_result,
            "sbom_cyclonedx": sbom_cdx,
            "sbom_spdx": sbom_spdx,
        }
        db.complete_scan(scan_id, result)
        await _push_progress(scan_id, "done", 100, "Scan complete.")
    except Exception as e:
        logger.exception(f"Security scan {scan_id} failed")
        db.fail_scan(scan_id, str(e))
        await _push_progress(scan_id, "error", 100, f"Scan failed: {e}")
    finally:
        if cleanup:
            shutil.rmtree(project_dir, ignore_errors=True)


async def scan_session_source(session_id: str, project_dir: str, project_name: str,
                              source: str, origin: str, size_bytes: int | None = None) -> str:
    """
    Run a security scan over a codebase that a TestiFy test session already
    downloaded (a ZIP upload or a cloned repo on the New Test page), so the same
    intake shows up in Scan History alongside directly-uploaded projects.

    Reads only - the caller owns project_dir and deletes it when both pipelines
    are done, so this never cleans up behind itself.
    """
    scan_id = uuid.uuid4().hex[:16]
    db.create_scan(scan_id, project_name, source=source, origin=origin,
                   size_bytes=size_bytes, session_id=session_id)
    logger.info(f"Security scan {scan_id} linked to test session {session_id}")
    await run_full_scan(scan_id, project_dir, project_name, cleanup=False)
    return scan_id


@router.post("/scan/upload")
async def upload_and_scan(file: UploadFile = File(...)):
    scan_id = uuid.uuid4().hex[:16]
    project_name = file.filename.rsplit(".", 1)[0] if file.filename else scan_id
    project_dir = os.path.join(UPLOAD_ROOT, scan_id)
    os.makedirs(project_dir, exist_ok=True)

    content = await file.read()
    if not (file.filename or "").lower().endswith(".zip"):
        raise HTTPException(400, "Only .zip uploads are supported in this endpoint.")
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as zf:
            # zip-slip protection
            for member in zf.namelist():
                target = os.path.normpath(os.path.join(project_dir, member))
                if not target.startswith(os.path.normpath(project_dir)):
                    raise HTTPException(400, "Unsafe archive contents detected.")
            zf.extractall(project_dir)
    except zipfile.BadZipFile:
        raise HTTPException(400, "Uploaded file is not a valid ZIP archive.")

    db.create_scan(scan_id, project_name, source="upload",
                   origin=file.filename, size_bytes=len(content))
    asyncio.create_task(run_full_scan(scan_id, project_dir, project_name))
    return {"scan_id": scan_id, "project_name": project_name, "status": "running"}


class GitScanRequest(BaseModel):
    repo_url: str


@router.post("/scan/git")
async def scan_git_repo(body: GitScanRequest):
    scan_id = uuid.uuid4().hex[:16]
    project_name = body.repo_url.rstrip("/").rsplit("/", 1)[-1].replace(".git", "")
    project_dir = os.path.join(UPLOAD_ROOT, scan_id)

    proc = await asyncio.create_subprocess_exec(
        "git", "clone", "--depth", "1", body.repo_url, project_dir,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise HTTPException(400, f"git clone failed: {stderr.decode(errors='ignore')[:300]}")

    db.create_scan(scan_id, project_name, source="git", origin=body.repo_url)
    asyncio.create_task(run_full_scan(scan_id, project_dir, project_name))
    return {"scan_id": scan_id, "project_name": project_name, "status": "running"}


@router.get("/scans")
async def list_all_scans(limit: int = 100):
    """History list - one row per upload/clone, newest first, each carrying the
    headline numbers so the UI can render the table without fetching results."""
    return db.list_scans(limit)


@router.get("/scan-for-session/{session_id}")
async def scan_for_session(session_id: str):
    """Lets a TestiFy test session link through to its security scan."""
    row = db.get_scan_by_session(session_id)
    if not row:
        raise HTTPException(404, "No security scan for this session.")
    return row


@router.delete("/scan/{scan_id}")
async def delete_scan(scan_id: str):
    if not db.delete_scan(scan_id):
        raise HTTPException(404, "Scan not found.")
    return {"deleted": scan_id}


@router.get("/scan/{scan_id}")
async def get_scan_result(scan_id: str):
    row = db.get_scan(scan_id)
    if not row:
        raise HTTPException(404, "Scan not found.")
    return row


@router.get("/scan/{scan_id}/report/{fmt}")
async def download_report(scan_id: str, fmt: str):
    row = db.get_scan(scan_id)
    if not row or row["status"] != "completed":
        raise HTTPException(404, "Completed scan not found.")
    result = row["result"]
    project_name = row["project_name"]

    if fmt == "json":
        payload = to_json_report(result["code"], result["secrets"], result["dependencies"], project_name)
        return JSONResponse(payload)
    if fmt == "sarif":
        payload = to_sarif(result["code"], project_name)
        return JSONResponse(payload)
    if fmt == "html":
        html = to_html_report(result["code"], result["secrets"], result["dependencies"], project_name)
        return PlainTextResponse(html, media_type="text/html")
    if fmt == "cyclonedx":
        return JSONResponse(result["sbom_cyclonedx"])
    if fmt == "spdx":
        return JSONResponse(result["sbom_spdx"])
    if fmt == "pdf":
        from .reports.pdf import build_pdf
        pdf_bytes = await asyncio.to_thread(build_pdf, result, project_name)
        disposition = f'attachment; filename="{project_name}-report.pdf"'
        return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf",
                                 headers={"Content-Disposition": disposition})
    raise HTTPException(400, "Unsupported format. Use json|sarif|html|cyclonedx|spdx|pdf.")


class FixRequest(BaseModel):
    finding: dict


@router.post("/ai/fix")
async def ai_fix(body: FixRequest):
    return await generate_fix(body.finding)


@router.get("/health")
async def security_health():
    return {
        "status": "ok",
        "service": "TestiFy Security",
        "version": "1.0.0",
        "rules_loaded": len(RULES),
    }


OWASP_TOP10 = [
    {"id": "A01:2021", "name": "Broken Access Control"},
    {"id": "A02:2021", "name": "Cryptographic Failures"},
    {"id": "A03:2021", "name": "Injection"},
    {"id": "A04:2021", "name": "Insecure Design"},
    {"id": "A05:2021", "name": "Security Misconfiguration"},
    {"id": "A06:2021", "name": "Vulnerable and Outdated Components"},
    {"id": "A07:2021", "name": "Identification and Authentication Failures"},
    {"id": "A08:2021", "name": "Software and Data Integrity Failures"},
    {"id": "A09:2021", "name": "Security Logging and Monitoring Failures"},
    {"id": "A10:2021", "name": "Server-Side Request Forgery"},
]


@router.get("/owasp-top10")
async def owasp_top10():
    return OWASP_TOP10
