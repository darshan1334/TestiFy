"""
Report generator — creates HTML and JSON reports from test session data.
"""
import json
import logging
import os
from datetime import datetime
from typing import Any

from jinja2 import Environment, BaseLoader

logger = logging.getLogger(__name__)

REPORTS_DIR = "generated_reports"

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TestiFy Report — {{ session_url }}</title>
<style>
  :root {
    --bg: #0f1117; --surface: #1a1d27; --border: #2d3048;
    --text: #e2e8f0; --muted: #8892a4;
    --critical: #ef4444; --high: #f97316; --medium: #eab308; --low: #22c55e; --info: #60a5fa;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: 'Segoe UI', system-ui, sans-serif; padding: 2rem; }
  h1 { font-size: 2rem; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: .25rem; }
  .meta { color: var(--muted); font-size: .85rem; margin-bottom: 2rem; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .stat { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; text-align: center; }
  .stat .value { font-size: 2rem; font-weight: 700; }
  .stat .label { font-size: .75rem; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; margin-top: .25rem; }
  .summary { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem; }
  .summary h2 { font-size: 1.1rem; margin-bottom: .75rem; color: #a78bfa; }
  .issues-section h2 { font-size: 1.25rem; margin-bottom: 1rem; }
  .issue { background: var(--surface); border: 1px solid var(--border); border-left: 4px solid; border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: .75rem; }
  .issue.critical { border-left-color: var(--critical); }
  .issue.high { border-left-color: var(--high); }
  .issue.medium { border-left-color: var(--medium); }
  .issue.low { border-left-color: var(--low); }
  .issue.info { border-left-color: var(--info); }
  .issue-header { display: flex; align-items: center; gap: .75rem; margin-bottom: .5rem; }
  .badge { font-size: .7rem; font-weight: 600; padding: .2em .6em; border-radius: 4px; text-transform: uppercase; }
  .badge.critical { background: #ef444420; color: var(--critical); }
  .badge.high { background: #f9731620; color: var(--high); }
  .badge.medium { background: #eab30820; color: var(--medium); }
  .badge.low { background: #22c55e20; color: var(--low); }
  .badge.info { background: #60a5fa20; color: var(--info); }
  .badge.cat { background: #6366f120; color: #818cf8; }
  .issue-title { font-weight: 600; font-size: .95rem; }
  .issue-desc { color: var(--muted); font-size: .85rem; margin-bottom: .5rem; }
  .issue-rec { font-size: .83rem; background: #1e293b; border-radius: 6px; padding: .6rem .8rem; }
  .issue-url { font-size: .75rem; color: #60a5fa; margin-top: .4rem; word-break: break-all; }
  .health { font-size: 1.5rem; font-weight: 700; }
  .health.Good { color: var(--low); }
  .health.Fair { color: var(--medium); }
  .health.Poor { color: var(--high); }
  .health.Critical { color: var(--critical); }
  .health.Unknown { color: var(--muted); }
  footer { margin-top: 3rem; text-align: center; color: var(--muted); font-size: .8rem; }
</style>
</head>
<body>
<h1>🧪 TestiFy Report</h1>
<p class="meta">Target: <strong>{{ session_url }}</strong> &nbsp;·&nbsp; Generated: {{ generated_at }} &nbsp;·&nbsp; Session: {{ session_id }}</p>

<div class="stats">
  <div class="stat"><div class="value" style="color:#a78bfa">{{ summary.pages_crawled }}</div><div class="label">Pages Crawled</div></div>
  <div class="stat"><div class="value" style="color:#f1f5f9">{{ summary.total_issues }}</div><div class="label">Total Issues</div></div>
  <div class="stat"><div class="value" style="color:#ef4444">{{ summary.severity_counts.critical }}</div><div class="label">Critical</div></div>
  <div class="stat"><div class="value" style="color:#f97316">{{ summary.severity_counts.high }}</div><div class="label">High</div></div>
  <div class="stat"><div class="value" style="color:#eab308">{{ summary.severity_counts.medium }}</div><div class="label">Medium</div></div>
  <div class="stat"><div class="value" style="color:#22c55e">{{ summary.severity_counts.low }}</div><div class="label">Low</div></div>
</div>

<div class="summary">
  <h2>🤖 AI Analysis Summary</h2>
  <p style="margin-bottom:.75rem">Overall Health: <span class="health {{ summary.overall_health }}">{{ summary.overall_health }}</span></p>
  <p style="line-height:1.6; color:#cbd5e1">{{ summary.ai_summary }}</p>
  {% if summary.performance_score is not none %}
  <p style="margin-top:.75rem; color:#94a3b8; font-size:.85rem">Performance Score: <strong>{{ summary.performance_score }}/100</strong></p>
  {% endif %}
  {% if summary.accessibility_score is not none %}
  <p style="color:#94a3b8; font-size:.85rem">Accessibility Score: <strong>{{ summary.accessibility_score }}/100</strong></p>
  {% endif %}
</div>

<div class="issues-section">
  <h2>📋 Issues ({{ issues|length }})</h2>
  {% for issue in issues %}
  <div class="issue {{ issue.severity }}">
    <div class="issue-header">
      <span class="badge {{ issue.severity }}">{{ issue.severity }}</span>
      <span class="badge cat">{{ issue.category }}</span>
      <span class="issue-title">{{ issue.title }}</span>
    </div>
    <p class="issue-desc">{{ issue.description }}</p>
    {% if issue.recommendation %}
    <div class="issue-rec">💡 {{ issue.recommendation }}</div>
    {% endif %}
    {% if issue.page_url %}
    <div class="issue-url">📍 {{ issue.page_url }}</div>
    {% endif %}
  </div>
  {% endfor %}
  {% if not issues %}
  <p style="color:#22c55e; padding: 1.5rem; text-align:center;">✅ No issues found!</p>
  {% endif %}
</div>

<footer>Generated by TestiFy AI Testing Agent &nbsp;·&nbsp; Powered by Google Gemini &amp; Playwright</footer>
</body>
</html>
"""


from playwright.async_api import async_playwright

class ReportGenerator:
    def __init__(self):
        self._env = Environment(loader=BaseLoader())
        os.makedirs(REPORTS_DIR, exist_ok=True)

    async def generate(
        self,
        session_id: str,
        session_url: str,
        issues: list[dict],
        summary: dict[str, Any],
    ) -> tuple[str, str, str]:
        """
        Generate HTML, JSON, and PDF reports. Returns (html_path, json_path, pdf_path).
        """
        generated_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

        # Sort issues: critical first
        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
        sorted_issues = sorted(issues, key=lambda i: severity_order.get(i.get("severity", "info"), 5))

        # HTML report
        template = self._env.from_string(HTML_TEMPLATE)
        html_content = template.render(
            session_id=session_id,
            session_url=session_url,
            issues=sorted_issues,
            summary=summary,
            generated_at=generated_at,
        )

        html_path = os.path.join(REPORTS_DIR, f"{session_id}.html")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html_content)

        # JSON report
        json_data = {
            "session_id": session_id,
            "url": session_url,
            "generated_at": generated_at,
            "summary": summary,
            "issues": sorted_issues,
        }
        json_path = os.path.join(REPORTS_DIR, f"{session_id}.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(json_data, f, indent=2, default=str)

        # PDF report via Playwright
        pdf_path = os.path.join(REPORTS_DIR, f"{session_id}.pdf")
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                await page.set_content(html_content, wait_until="load")
                await page.pdf(
                    path=pdf_path,
                    format="A4",
                    print_background=True,
                    margin={"top": "1cm", "bottom": "1cm", "left": "1cm", "right": "1cm"},
                )
                await browser.close()
            logger.info(f"PDF report generated: {pdf_path}")
        except Exception as e:
            logger.warning(f"Could not generate PDF report: {e}")
            pdf_path = ""

        logger.info(f"Reports generated: {html_path}, {json_path}, {pdf_path}")
        return html_path, json_path, pdf_path
