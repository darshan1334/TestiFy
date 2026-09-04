"""
Core scan engine. Walks a project directory, applies the rule set from
rules.py against real file contents, and returns concrete Finding objects
with real file paths, real line numbers, and a real code snippet - nothing
here is randomly generated.
"""
from __future__ import annotations
import hashlib
import os
import time
from dataclasses import dataclass, asdict
from typing import Iterable

from .rules import rules_for_file, RULES, EXT_TO_LANG

SKIP_DIRS = {
    ".git", "node_modules", "vendor", "dist", "build", "__pycache__",
    ".venv", "venv", ".next", "target", ".idea", ".vscode", "coverage",
}
MAX_FILE_BYTES = 2_000_000  # skip pathological / binary-ish files
BINARY_EXT = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".zip", ".woff",
              ".woff2", ".ttf", ".eot", ".mp4", ".mp3", ".exe", ".dll", ".so", ".class"}


@dataclass
class Finding:
    id: str
    rule_id: str
    title: str
    category: str
    cwe: str
    severity: str
    confidence: str
    file: str
    line: int
    column: int
    snippet: str
    context: str
    description: str
    recommendation: str
    language: str

    def to_dict(self):
        return asdict(self)


def _iter_source_files(root: str) -> Iterable[str]:
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for fn in filenames:
            ext = "." + fn.rsplit(".", 1)[-1].lower() if "." in fn else ""
            if ext in BINARY_EXT:
                continue
            full = os.path.join(dirpath, fn)
            try:
                if os.path.getsize(full) > MAX_FILE_BYTES:
                    continue
            except OSError:
                continue
            yield full


def _read_text(path: str) -> str | None:
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except (OSError, UnicodeDecodeError):
        return None


def scan_directory(root: str, project_id: str) -> dict:
    """Run the full static analysis pass. Returns a result dict with real
    findings, per-language file coverage counts, and timing - all computed
    from the actual files under `root`."""
    started = time.time()
    findings: list[Finding] = []
    files_scanned = 0
    lang_files: dict[str, int] = {}
    total_lines = 0

    for path in _iter_source_files(root):
        rel = os.path.relpath(path, root)
        ext = "." + path.rsplit(".", 1)[-1].lower() if "." in path else ""
        lang = EXT_TO_LANG.get(ext)
        applicable = rules_for_file(path)
        text = _read_text(path)
        if text is None:
            continue
        files_scanned += 1
        if lang:
            lang_files[lang] = lang_files.get(lang, 0) + 1
        lines = text.splitlines()
        total_lines += len(lines)
        if not applicable:
            continue

        for rule in applicable:
            for m in rule.pattern.finditer(text):
                if rule.negative_pattern and rule.negative_pattern.search(text):
                    continue
                start = m.start()
                line_no = text.count("\n", 0, start) + 1
                line_text = lines[line_no - 1] if 0 <= line_no - 1 < len(lines) else ""
                col = start - (text.rfind("\n", 0, start) + 1)
                fid = hashlib.sha1(f"{rel}:{line_no}:{rule.id}".encode()).hexdigest()[:12]
                ctx_start = max(0, line_no - 6)
                ctx_end = min(len(lines), line_no + 5)
                context_lines = lines[ctx_start:ctx_end]
                findings.append(Finding(
                    id=fid,
                    rule_id=rule.id,
                    title=rule.title,
                    category=rule.category,
                    cwe=rule.cwe,
                    severity=rule.severity,
                    confidence=rule.confidence,
                    file=rel.replace(os.sep, "/"),
                    line=line_no,
                    column=max(col, 0),
                    snippet=line_text.strip()[:240],
                    context="\n".join(context_lines)[:4000],
                    description=rule.description,
                    recommendation=rule.recommendation,
                    language=lang or "unknown",
                ))

    elapsed = time.time() - started
    sev_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for f in findings:
        sev_counts[f.severity] = sev_counts.get(f.severity, 0) + 1

    # Risk score: weighted severity density, bounded 0-100 (deterministic formula, not random)
    weight = {"critical": 10, "high": 6, "medium": 3, "low": 1}
    raw = sum(weight[f.severity] for f in findings)
    denom = max(files_scanned, 1)
    density = raw / denom
    risk_score = round(min(100, density * 18), 1)

    return {
        "project_id": project_id,
        "files_scanned": files_scanned,
        "total_lines": total_lines,
        "languages": lang_files,
        "findings": [f.to_dict() for f in findings],
        "severity_counts": sev_counts,
        "risk_score": risk_score,
        "rules_evaluated": len(RULES),
        "scan_duration_seconds": round(elapsed, 3),
        "coverage_pct": round(100 * sum(lang_files.values()) / max(files_scanned, 1), 1),
    }
