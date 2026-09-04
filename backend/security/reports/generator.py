"""Report generation in JSON, SARIF 2.1.0, HTML, and PDF - all standard,
real formats consumed by real tooling (GitHub code scanning accepts SARIF
directly). Built entirely from the scan_result dict produced by the engine."""
from __future__ import annotations
import json
import datetime as dt

SEV_TO_SARIF_LEVEL = {"critical": "error", "high": "error", "medium": "warning", "low": "note"}


def to_sarif(scan_result: dict, project_name: str) -> dict:
    rules_seen = {}
    results = []
    for f in scan_result["findings"]:
        rules_seen[f["rule_id"]] = {
            "id": f["rule_id"],
            "name": f["title"],
            "shortDescription": {"text": f["title"]},
            "fullDescription": {"text": f["description"]},
            "help": {"text": f["recommendation"]},
            "properties": {"cwe": f["cwe"], "category": f["category"], "tags": ["security", f["severity"]]},
        }
        results.append({
            "ruleId": f["rule_id"],
            "level": SEV_TO_SARIF_LEVEL.get(f["severity"], "warning"),
            "message": {"text": f"{f['description']} (CWE: {f['cwe']})"},
            "locations": [{
                "physicalLocation": {
                    "artifactLocation": {"uri": f["file"]},
                    "region": {"startLine": f["line"], "startColumn": f["column"] + 1},
                }
            }],
        })
    return {
        "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
        "version": "2.1.0",
        "runs": [{
            "tool": {"driver": {
                "name": "TestiFy Security",
                "informationUri": "https://github.com/testify/testify",
                "version": "1.0.0",
                "rules": list(rules_seen.values()),
            }},
            "results": results,
            "properties": {"projectName": project_name, "riskScore": scan_result["risk_score"]},
        }],
    }


def to_json_report(scan_result: dict, secrets_result: dict, deps_result: dict, project_name: str) -> dict:
    return {
        "tool": "TestiFy Security",
        "version": "1.0.0",
        "generated": dt.datetime.utcnow().isoformat() + "Z",
        "project": project_name,
        "summary": {
            "risk_score": scan_result["risk_score"],
            "files_scanned": scan_result["files_scanned"],
            "severity_counts": scan_result["severity_counts"],
            "secrets_found": secrets_result["total_secrets"] if secrets_result else 0,
            "dependencies_scanned": deps_result.get("total_dependencies", 0) if deps_result else 0,
            "vulnerable_dependencies": deps_result.get("vulnerable_count", 0) if deps_result else 0,
        },
        "code_findings": scan_result["findings"],
        "secrets": secrets_result["findings"] if secrets_result else [],
        "dependencies": deps_result.get("dependencies", []) if deps_result else [],
    }


def to_html_report(scan_result: dict, secrets_result: dict, deps_result: dict, project_name: str) -> str:
    sev = scan_result["severity_counts"]
    rows = "".join(
        f"""<tr class="sev-{f['severity']}">
              <td>{f['severity'].upper()}</td><td>{f['title']}</td><td>{f['cwe']}</td>
              <td><code>{f['file']}:{f['line']}</code></td>
              <td><code>{(f['snippet'] or '')[:120]}</code></td>
            </tr>"""
        for f in scan_result["findings"]
    )
    secret_rows = "".join(
        f"""<tr><td>{s['severity'].upper()}</td><td>{s['type']}</td>
              <td><code>{s['file']}:{s['line']}</code></td><td><code>{s['masked_value']}</code></td></tr>"""
        for s in (secrets_result["findings"] if secrets_result else [])
    )
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>TestiFy Security Report — {project_name}</title>
<style>
:root{{--bg:#0a0612;--panel:#150b24;--gold:#c6a15b;--vib:#8a63f0;--crit:#e63946;--high:#f4a261;--med:#e9c46a;--low:#2a9d8f;}}
body{{background:var(--bg);color:#eee;font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:40px;}}
h1{{color:var(--gold);border-bottom:2px solid var(--vib);padding-bottom:12px;}}
h2{{color:var(--vib);margin-top:40px;}}
table{{width:100%;border-collapse:collapse;margin-top:16px;background:var(--panel);}}
th,td{{padding:8px 12px;text-align:left;border-bottom:1px solid #2a1d40;font-size:13px;}}
th{{color:var(--gold);text-transform:uppercase;font-size:11px;letter-spacing:1px;}}
.sev-critical td:first-child{{color:var(--crit);font-weight:700;}}
.sev-high td:first-child{{color:var(--high);font-weight:700;}}
.sev-medium td:first-child{{color:var(--med);font-weight:700;}}
.sev-low td:first-child{{color:var(--low);font-weight:700;}}
.summary{{display:flex;gap:20px;margin-top:20px;}}
.card{{background:var(--panel);padding:20px;border-radius:10px;border:1px solid #2a1d40;flex:1;text-align:center;}}
.card .num{{font-size:32px;font-weight:800;}}
code{{color:#c9b8ff;}}
</style></head>
<body>
<h1>TestiFy Security — Scan Report</h1>
<p>Project: <strong>{project_name}</strong> &nbsp;|&nbsp; Generated: {dt.datetime.utcnow().isoformat()}Z</p>
<div class="summary">
  <div class="card"><div class="num" style="color:var(--gold)">{scan_result['risk_score']}</div>Risk Score</div>
  <div class="card"><div class="num" style="color:var(--crit)">{sev['critical']}</div>Critical</div>
  <div class="card"><div class="num" style="color:var(--high)">{sev['high']}</div>High</div>
  <div class="card"><div class="num" style="color:var(--med)">{sev['medium']}</div>Medium</div>
  <div class="card"><div class="num" style="color:var(--low)">{sev['low']}</div>Low</div>
</div>
<h2>Code Vulnerabilities ({len(scan_result['findings'])})</h2>
<table><tr><th>Severity</th><th>Title</th><th>CWE</th><th>Location</th><th>Snippet</th></tr>{rows}</table>
<h2>Secrets Detected ({secrets_result['total_secrets'] if secrets_result else 0})</h2>
<table><tr><th>Severity</th><th>Type</th><th>Location</th><th>Masked Value</th></tr>{secret_rows}</table>
</body></html>"""
