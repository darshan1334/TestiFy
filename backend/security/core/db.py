"""Lightweight SQLite persistence - real DB, no in-memory mock state that
vanishes; scan history survives restarts."""
from __future__ import annotations
import json
import sqlite3
import time
import os

DB_PATH = os.environ.get("SECURECODE_DB", os.path.join(os.path.dirname(__file__), "..", "securecode.db"))

# Columns added after the first release. Existing securecode.db files were
# created without them, so init_db() back-fills via ALTER TABLE instead of
# forcing users to delete their scan history.
_LATER_COLUMNS = {
    "source": "TEXT",          # 'upload' | 'git'
    "origin": "TEXT",          # original .zip filename, or the repo URL
    "size_bytes": "INTEGER",   # uploaded archive size; NULL for git scans
    "summary_json": "TEXT",    # denormalised headline numbers for the history list
    "session_id": "TEXT",      # TestiFy test session this scan was spawned from, if any
}


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS scans (
            id TEXT PRIMARY KEY,
            project_name TEXT,
            status TEXT,
            created_at REAL,
            completed_at REAL,
            result_json TEXT,
            source TEXT,
            origin TEXT,
            size_bytes INTEGER,
            summary_json TEXT,
            session_id TEXT
        )
    """)
    existing = {r["name"] for r in conn.execute("PRAGMA table_info(scans)").fetchall()}
    for col, coltype in _LATER_COLUMNS.items():
        if col not in existing:
            conn.execute(f"ALTER TABLE scans ADD COLUMN {col} {coltype}")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_scans_created ON scans(created_at DESC)")
    conn.commit()

    # Back-fill summaries for scans stored before summary_json existed, so old
    # history rows show their findings instead of a blank row.
    stale = conn.execute("SELECT id, result_json FROM scans WHERE status='completed' "
                         "AND summary_json IS NULL AND result_json IS NOT NULL").fetchall()
    for row in stale:
        try:
            summary = build_summary(json.loads(row["result_json"]))
        except (ValueError, TypeError):
            continue
        conn.execute("UPDATE scans SET summary_json=? WHERE id=?", (json.dumps(summary), row["id"]))
    if stale:
        conn.commit()
    conn.close()


def build_summary(result: dict) -> dict:
    """Headline numbers pulled out of the full result so the history list can
    show what a scan actually found without loading every finding."""
    code = result.get("code") or {}
    secrets = result.get("secrets") or {}
    deps = result.get("dependencies") or {}
    sev = code.get("severity_counts") or {}
    return {
        "risk_score": code.get("risk_score"),
        "total_findings": len(code.get("findings") or []),
        "critical": sev.get("critical", 0),
        "high": sev.get("high", 0),
        "medium": sev.get("medium", 0),
        "low": sev.get("low", 0),
        "files_scanned": code.get("files_scanned", 0),
        "total_lines": code.get("total_lines", 0),
        "languages": list((code.get("languages") or {}).keys()),
        "total_secrets": secrets.get("total_secrets", 0),
        "total_dependencies": deps.get("total_dependencies", 0),
        "vulnerable_dependencies": deps.get("vulnerable_count", 0),
        "scan_duration_seconds": code.get("scan_duration_seconds"),
    }


def create_scan(scan_id: str, project_name: str, source: str = "upload",
                origin: str | None = None, size_bytes: int | None = None,
                session_id: str | None = None):
    conn = get_conn()
    conn.execute(
        "INSERT INTO scans (id, project_name, status, created_at, source, origin, size_bytes, session_id) "
        "VALUES (?,?,?,?,?,?,?,?)",
        (scan_id, project_name, "running", time.time(), source, origin, size_bytes, session_id))
    conn.commit()
    conn.close()


def complete_scan(scan_id: str, result: dict):
    conn = get_conn()
    conn.execute("UPDATE scans SET status=?, completed_at=?, result_json=?, summary_json=? WHERE id=?",
                 ("completed", time.time(), json.dumps(result), json.dumps(build_summary(result)), scan_id))
    conn.commit()
    conn.close()


def fail_scan(scan_id: str, error: str):
    conn = get_conn()
    conn.execute("UPDATE scans SET status=?, completed_at=?, result_json=? WHERE id=?",
                 ("failed", time.time(), json.dumps({"error": error}), scan_id))
    conn.commit()
    conn.close()


def get_scan(scan_id: str) -> dict | None:
    conn = get_conn()
    row = conn.execute("SELECT * FROM scans WHERE id=?", (scan_id,)).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    if d.get("result_json"):
        d["result"] = json.loads(d["result_json"])
    if d.get("summary_json"):
        d["summary"] = json.loads(d["summary_json"])
    elif d.get("result") and d.get("status") == "completed":
        # scan stored before summaries existed - derive it on read
        d["summary"] = build_summary(d["result"])
    return d


def list_scans(limit: int = 100) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, project_name, status, created_at, completed_at, source, origin, "
        "size_bytes, session_id, summary_json FROM scans ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    conn.close()
    out = []
    for r in rows:
        d = dict(r)
        raw = d.pop("summary_json", None)
        d["summary"] = json.loads(raw) if raw else None
        out.append(d)
    return out


def delete_scan(scan_id: str) -> bool:
    conn = get_conn()
    cur = conn.execute("DELETE FROM scans WHERE id=?", (scan_id,))
    conn.commit()
    deleted = cur.rowcount > 0
    conn.close()
    return deleted


def get_scan_by_session(session_id: str) -> dict | None:
    """The security scan spawned by a TestiFy test session, if one ran."""
    conn = get_conn()
    row = conn.execute("SELECT id, project_name, status, created_at, completed_at, source, origin, "
                       "size_bytes, session_id, summary_json FROM scans WHERE session_id=? "
                       "ORDER BY created_at DESC LIMIT 1", (session_id,)).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    raw = d.pop("summary_json", None)
    d["summary"] = json.loads(raw) if raw else None
    return d
