"""
Issue analyzer — transforms raw CrawlResult into structured findings
ready for Gemini AI enrichment.
"""
import logging
from typing import Any
from browser.crawler import CrawlResult

logger = logging.getLogger(__name__)

SEVERITY_MAP = {
    "critical": "critical",
    "serious": "high",
    "moderate": "medium",
    "minor": "low",
}


def build_raw_findings(result: CrawlResult) -> dict[str, Any]:
    """
    Convert a CrawlResult into a structured dict of raw findings
    that will be sent to Gemini for analysis.
    """
    findings: dict[str, Any] = {
        "start_url": result.start_url,
        "pages_visited": result.pages_visited,
        "page_count": len(result.pages_visited),
        "console_errors": result.console_errors[:50],
        "network_failures": result.network_failures[:30],
        "http_errors": result.http_errors[:30],
        "broken_links": result.broken_links[:30],
        "accessibility_violations": result.accessibility_violations[:50],
        "form_issues": result.form_issues[:30],
        "performance_metrics": result.performance_metrics,
        "load_times": result.load_times,
    }

    # Add performance analysis
    if result.load_times:
        avg_load = sum(result.load_times.values()) / len(result.load_times)
        slow_pages = [
            {"url": url, "load_time_s": round(t, 2)}
            for url, t in result.load_times.items()
            if t > 3.0
        ]
        findings["performance_summary"] = {
            "avg_load_time_s": round(avg_load, 2),
            "slow_pages": slow_pages,
        }

    return findings


def pre_classify_issues(result: CrawlResult) -> list[dict]:
    """
    Pre-classify obvious issues without AI for faster initial display.
    These are supplemented by Gemini's deeper analysis.
    """
    issues = []

    # Console errors → JS errors
    for err in result.console_errors:
        if err.get("type") == "error":
            issues.append({
                "category": "js_error",
                "severity": "high",
                "title": "JavaScript Console Error",
                "description": err.get("text", "Unknown error"),
                "recommendation": "Review browser console for stack trace and fix the underlying JavaScript error.",
                "page_url": err.get("url"),
                "element_selector": None,
                "raw_data": err,
            })

    # Network failures
    for fail in result.network_failures:
        issues.append({
            "category": "api",
            "severity": "high",
            "title": f"Network Request Failed",
            "description": f"Request to {fail.get('url', 'unknown')} failed: {fail.get('failure', 'unknown')}",
            "recommendation": "Check the network request URL and server availability.",
            "page_url": None,
            "element_selector": None,
            "raw_data": fail,
        })

    # HTTP errors
    for err in result.http_errors:
        severity = "critical" if err["status"] >= 500 else "high"
        issues.append({
            "category": "api",
            "severity": severity,
            "title": f"HTTP {err['status']} Error",
            "description": f"Resource returned HTTP {err['status']}: {err.get('url')}",
            "recommendation": "Fix the server-side error or update the resource URL.",
            "page_url": err.get("url"),
            "element_selector": None,
            "raw_data": err,
        })

    # Broken links
    for link in result.broken_links:
        issues.append({
            "category": "broken_link",
            "severity": "high",
            "title": f"Broken Link ({link.get('status')})",
            "description": f"Link '{link.get('link_text', '')}' pointing to {link.get('url')} returned {link.get('status')}",
            "recommendation": "Update or remove the broken link.",
            "page_url": link.get("source_page"),
            "element_selector": None,
            "raw_data": link,
        })

    # Form issues
    for fi in result.form_issues:
        sev = "medium"
        if fi.get("type") == "form_no_submit":
            sev = "high"
        issues.append({
            "category": "form",
            "severity": sev,
            "title": f"Form Issue: {fi.get('type', 'unknown').replace('_', ' ').title()}",
            "description": fi.get("detail", ""),
            "recommendation": "Fix the form element to follow accessibility and usability best practices.",
            "page_url": fi.get("url"),
            "element_selector": fi.get("selector"),
            "raw_data": fi,
        })

    # Accessibility violations
    for viol in result.accessibility_violations:
        severity = SEVERITY_MAP.get(viol.get("impact", "minor"), "low")
        issues.append({
            "category": "accessibility",
            "severity": severity,
            "title": f"Accessibility: {viol.get('help', viol.get('id', 'Unknown'))}",
            "description": viol.get("description", ""),
            "recommendation": f"See: {viol.get('helpUrl', 'https://dequeuniversity.com')}",
            "page_url": viol.get("url"),
            "element_selector": viol.get("nodes", [{}])[0].get("html", "") if viol.get("nodes") else None,
            "raw_data": viol,
        })

    # Performance issues
    for page_url, load_time in result.load_times.items():
        if load_time > 5.0:
            issues.append({
                "category": "performance",
                "severity": "high",
                "title": f"Very Slow Page Load ({load_time:.1f}s)",
                "description": f"Page {page_url} took {load_time:.1f} seconds to load (threshold: 5s)",
                "recommendation": "Optimise assets, enable caching, and reduce server response time.",
                "page_url": page_url,
                "element_selector": None,
                "raw_data": {"load_time_s": load_time},
            })
        elif load_time > 3.0:
            issues.append({
                "category": "performance",
                "severity": "medium",
                "title": f"Slow Page Load ({load_time:.1f}s)",
                "description": f"Page {page_url} took {load_time:.1f} seconds to load (threshold: 3s)",
                "recommendation": "Consider lazy loading, image optimisation, and code splitting.",
                "page_url": page_url,
                "element_selector": None,
                "raw_data": {"load_time_s": load_time},
            })

    return issues
