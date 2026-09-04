"""
Secrets Detection Engine.
Real regex signatures for common credential formats, PLUS a genuine Shannon
entropy check on candidate strings to catch generic high-entropy secrets
that don't match a known vendor format. No fabricated matches.
"""
from __future__ import annotations
import hashlib
import math
import os
import re
from dataclasses import dataclass, asdict

from ..scanner.engine import _iter_source_files, _read_text, SKIP_DIRS  # reuse walker

SECRET_SIGNATURES = [
    ("AWS Access Key ID", "aws-access-key", re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "critical"),
    ("AWS Secret Access Key", "aws-secret-key",
     re.compile(r"(?i)aws_secret_access_key\s*[:=]\s*['\"]?([A-Za-z0-9/+=]{40})['\"]?"), "critical"),
    ("Azure Storage Key", "azure-storage-key",
     re.compile(r"(?i)AccountKey=([A-Za-z0-9+/=]{88})"), "critical"),
    ("Azure Client Secret", "azure-client-secret",
     re.compile(r"(?i)client_secret\s*[:=]\s*['\"]?([A-Za-z0-9~._\-]{34,40})['\"]?"), "high"),
    ("Google API Key", "gcp-api-key", re.compile(r"\bAIza[0-9A-Za-z\-_]{35}\b"), "critical"),
    ("Google OAuth Client Secret", "gcp-oauth-secret",
     re.compile(r"\bGOCSPX-[0-9A-Za-z\-_]{28}\b"), "critical"),
    ("GitHub Personal Access Token", "github-pat", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36,255}\b"), "critical"),
    ("GitHub Fine-grained Token", "github-fine-grained", re.compile(r"\bgithub_pat_[A-Za-z0-9_]{22,}\b"), "critical"),
    ("Slack Token", "slack-token", re.compile(r"\bxox[baprs]-[0-9A-Za-z-]{10,72}\b"), "high"),
    ("Slack Webhook", "slack-webhook", re.compile(r"https://hooks\.slack\.com/services/[A-Za-z0-9/]{20,}"), "medium"),
    ("Stripe Secret Key", "stripe-secret", re.compile(r"\bsk_(?:live|test)_[0-9A-Za-z]{24,}\b"), "critical"),
    ("Stripe Restricted Key", "stripe-restricted", re.compile(r"\brk_(?:live|test)_[0-9A-Za-z]{24,}\b"), "high"),
    ("JWT Token", "jwt-token", re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"), "medium"),
    ("Generic API Key Assignment", "generic-api-key",
     re.compile(r"(?i)\b(?:api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*['\"]([A-Za-z0-9_\-]{20,})['\"]"), "high"),
    ("Hardcoded Password Assignment", "hardcoded-password",
     re.compile(r"(?i)\bpassword\s*[:=]\s*['\"]([^'\"]{6,})['\"]"), "high"),
    ("Private Key Block", "private-key-block",
     re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----"), "critical"),
    ("SSH Public Key (in unexpected location)", "ssh-public-key",
     re.compile(r"\bssh-(?:rsa|ed25519|dss) AAAA[0-9A-Za-z+/]{20,}"), "low"),
    ("NPM Token", "npm-token", re.compile(r"\bnpm_[A-Za-z0-9]{36}\b"), "high"),
    ("Database Connection String w/ credentials", "db-conn-string",
     re.compile(r"(?i)\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis)://[^:\s]+:[^@\s]+@[^\s'\"]+"), "critical"),
    ("Twilio API Key", "twilio-key", re.compile(r"\bSK[0-9a-fA-F]{32}\b"), "high"),
    ("Firebase Server Key", "firebase-key", re.compile(r"\bAAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}\b"), "critical"),
]

# File types we intentionally never flag to keep signal high (lockfiles, minified, images already skipped)
IGNORE_BASENAMES = {"package-lock.json", "yarn.lock", "poetry.lock", "Pipfile.lock"}


def shannon_entropy(s: str) -> float:
    if not s:
        return 0.0
    freq = {}
    for c in s:
        freq[c] = freq.get(c, 0) + 1
    ent = 0.0
    for count in freq.values():
        p = count / len(s)
        ent -= p * math.log2(p)
    return ent


GENERIC_TOKEN_RE = re.compile(r"""['"]([A-Za-z0-9_\-+/=]{28,})['"]""")
ASSIGNMENT_HINT_RE = re.compile(r"(?i)(token|secret|key|auth|credential)")


@dataclass
class SecretFinding:
    id: str
    type: str
    signature: str
    severity: str
    file: str
    line: int
    masked_value: str
    method: str  # "signature" | "entropy"

    def to_dict(self):
        return asdict(self)


def _mask(value: str) -> str:
    if len(value) <= 8:
        return "*" * len(value)
    return value[:4] + "*" * (len(value) - 8) + value[-4:]


def scan_secrets(root: str) -> dict:
    findings: list[SecretFinding] = []
    files_scanned = 0

    for path in _iter_source_files(root):
        if os.path.basename(path) in IGNORE_BASENAMES:
            continue
        text = _read_text(path)
        if text is None:
            continue
        files_scanned += 1
        rel = os.path.relpath(path, root).replace(os.sep, "/")
        lines = text.splitlines()

        matched_spans = []
        for label, sig_id, pattern, severity in SECRET_SIGNATURES:
            for m in pattern.finditer(text):
                value = m.group(1) if m.groups() else m.group(0)
                line_no = text.count("\n", 0, m.start()) + 1
                fid = hashlib.sha1(f"{rel}:{line_no}:{sig_id}:{value[:6]}".encode()).hexdigest()[:12]
                findings.append(SecretFinding(
                    id=fid, type=label, signature=sig_id, severity=severity,
                    file=rel, line=line_no, masked_value=_mask(value), method="signature",
                ))
                matched_spans.append((m.start(), m.end()))

        # Entropy pass: only on lines that hint at a secret assignment and weren't already
        # caught by a signature above (keeps false-positive rate sane).
        for i, line in enumerate(lines, start=1):
            if not ASSIGNMENT_HINT_RE.search(line):
                continue
            for m in GENERIC_TOKEN_RE.finditer(line):
                span_start = sum(len(l) + 1 for l in lines[:i - 1]) + m.start()
                if any(s <= span_start <= e for s, e in matched_spans):
                    continue
                value = m.group(1)
                ent = shannon_entropy(value)
                if ent >= 4.0 and len(set(value)) > 8:
                    fid = hashlib.sha1(f"{rel}:{i}:entropy:{value[:6]}".encode()).hexdigest()[:12]
                    findings.append(SecretFinding(
                        id=fid, type="High-entropy string (possible secret)", signature="generic-entropy",
                        severity="medium", file=rel, line=i, masked_value=_mask(value), method="entropy",
                    ))

    by_type: dict[str, int] = {}
    for f in findings:
        by_type[f.type] = by_type.get(f.type, 0) + 1

    return {
        "files_scanned": files_scanned,
        "total_secrets": len(findings),
        "by_type": by_type,
        "findings": [f.to_dict() for f in findings],
    }
