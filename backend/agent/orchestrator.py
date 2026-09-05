"""
Agent Orchestrator — coordinates the full testing pipeline.
Streams real-time progress to the WebSocket connection.
Pipeline: Explore → Analyze → AI Enrich → Persist → Report
"""
import asyncio
import json
import logging
from datetime import datetime
from typing import Callable, Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database.models import TestSession, TestIssue, TestReport
from database.db import get_db_context
from browser.crawler import PlaywrightCrawler, CrawlResult
from agent.analyzer import build_raw_findings, pre_classify_issues
from ai.gemini_client import gemini_client
from reports.generator import ReportGenerator
from config import settings

logger = logging.getLogger(__name__)


class TestOrchestrator:
    """
    Runs the full AI testing pipeline for a given URL and session.
    Progress updates are streamed via the send_update callback.
    """

    PHASES = [
        "initialising",
        "exploring",
        "analysing",
        "ai_analysis",
        "generating_report",
        "completed",
    ]

    def __init__(self, send_update: Callable[[dict], Any]):
        self._send = send_update

    async def run(self, session_id: str, url: str):
        """Execute the full pipeline asynchronously."""
        await self._update("initialising", "Starting autonomous test agent…", 5)

        try:
            # ─── Phase 1: Explore ────────────────────────────────────────────
            await self._set_session_status(session_id, "running")

            async def crawl_progress(msg: str, pct: int):
                await self._update("exploring", msg, pct)

            crawler = PlaywrightCrawler(progress_callback=crawl_progress)

            crawl_result: CrawlResult = await crawler.crawl(
                start_url=url,
                session_id=session_id,
                max_pages=settings.max_crawl_pages,
            )

            pages = len(crawl_result.pages_visited)
            await self._update(
                "exploring",
                f"Crawl complete. Visited {pages} page(s). Collecting findings…",
                50,
            )

            # ─── Phase 2: Pre-classify ────────────────────────────────────────
            await self._update("analysing", "Analyzing DOM elements and accessibility violations…", 60)
            pre_classified = pre_classify_issues(crawl_result)
            raw_findings = build_raw_findings(crawl_result)

            await self._update(
                "analysing",
                f"Detected {len(pre_classified)} findings. Synthesizing AI analysis…",
                70,
            )

            # ─── Phase 3: AI Analysis ─────────────────────────────────────────
            await self._update("ai_analysis", "AI Agent is classifying severity and generating fixes…", 80)

            ai_issues = []
            overall_health = "Good"
            ai_summary = ""
            performance_score = None
            accessibility_score = None

            # Calculate deterministic baseline scores from crawl data
            total_violations = len(crawl_result.accessibility_violations)
            accessibility_score = max(0.0, min(100.0, round(100.0 - (total_violations * 8.5), 1)))

            if crawl_result.load_times:
                avg_load = sum(crawl_result.load_times.values()) / len(crawl_result.load_times)
                # 1.0s or faster = 100, 5.0s+ = 40
                performance_score = max(10.0, min(100.0, round(100.0 - max(0.0, (avg_load - 1.0) * 15.0), 1)))

            try:
                ai_result = await gemini_client.classify_issues(raw_findings)
                if ai_result and isinstance(ai_result, dict):
                    ai_issues = ai_result.get("issues", [])
                    if ai_result.get("overall_health"):
                        overall_health = ai_result.get("overall_health")
                    if ai_result.get("ai_summary"):
                        ai_summary = ai_result.get("ai_summary")
                    if ai_result.get("performance_score") is not None:
                        performance_score = float(ai_result.get("performance_score"))
                    if ai_result.get("accessibility_score") is not None:
                        accessibility_score = float(ai_result.get("accessibility_score"))
            except Exception as e:
                logger.info(f"Gemini enrichment notice: {e}. Utilizing synthesized rules engine analysis.")

            # Fallback overall health computation if not provided by Gemini
            if ai_issues:
                for idx, ai_issue in enumerate(ai_issues):
                    if not ai_issue.get("screenshot_path"):
                        matched = next(
                            (p for p in pre_classified if p.get("screenshot_path") and (
                                (p.get("element_selector") and p.get("element_selector") == ai_issue.get("element_selector")) or
                                (p.get("page_url") == ai_issue.get("page_url") and p.get("category") == ai_issue.get("category"))
                            )),
                            None
                        )
                        if not matched and idx < len(pre_classified):
                            matched = pre_classified[idx] if pre_classified[idx].get("screenshot_path") else None
                        if matched and matched.get("screenshot_path"):
                            ai_issue["screenshot_path"] = matched["screenshot_path"]

            all_issues = ai_issues if ai_issues else pre_classified
            crit_count = sum(1 for i in all_issues if i.get("severity") == "critical")
            high_count = sum(1 for i in all_issues if i.get("severity") == "high")
            med_count  = sum(1 for i in all_issues if i.get("severity") == "medium")

            if not ai_summary:
                if crit_count > 0:
                    overall_health = "Critical"
                    ai_summary = f"Test completed with {crit_count} critical and {high_count} high severity issues detected. Immediate remediation recommended."
                elif high_count > 0:
                    overall_health = "Poor"
                    ai_summary = f"Identified {high_count} high-priority issues across {pages} page(s). Review accessibility and console errors."
                elif med_count > 0:
                    overall_health = "Fair"
                    ai_summary = f"Website is functional with {med_count} moderate findings. Minor accessibility or performance enhancements suggested."
                else:
                    overall_health = "Good"
                    ai_summary = f"All automated tests passed successfully across {pages} page(s). No breaking errors detected."

            await self._update(
                "ai_analysis",
                f"Analysis complete. {len(all_issues)} total issues evaluated.",
                88,
            )

            # ─── Phase 4: Persist to DB ──────────────────────────────────────
            severity_counts = await self._persist_results(
                session_id=session_id,
                target_label=url,
                all_issues=all_issues,
                units_analysed=pages,
                ai_summary=ai_summary,
                overall_health=overall_health,
                performance_score=performance_score,
                accessibility_score=accessibility_score,
            )

            await self._update(
                "completed",
                f"Testing complete! {len(all_issues)} issues found across {pages} page(s).",
                100,
                extra={
                    "total_issues": len(all_issues),
                    "pages_crawled": pages,
                    "overall_health": overall_health,
                    "severity_counts": severity_counts,
                },
            )

        except Exception as e:
            logger.exception(f"Orchestrator error for session {session_id}: {e}")
            await self._set_session_status(session_id, "failed")
            await self._update("failed", f"Testing failed: {str(e)}", 100)

    async def _persist_results(
        self,
        session_id: str,
        target_label: str,
        all_issues: list[dict],
        units_analysed: int,
        ai_summary: str,
        overall_health: str,
        performance_score: Optional[float],
        accessibility_score: Optional[float],
    ) -> dict[str, int]:
        """
        Write the finished analysis to the database and generate the report files.

        Shared by the URL flow and the source flow (GitHub repo / ZIP upload) so
        both produce identical session rows, issue rows and downloadable reports.
        `units_analysed` is pages for a crawl and files for a codebase.
        """
        await self._update("generating_report", "Saving test session results and generating reports…", 92)

        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        for issue in all_issues:
            sev = issue.get("severity", "low")
            if sev in severity_counts:
                severity_counts[sev] += 1
            else:
                severity_counts["info"] += 1

        async with get_db_context() as db:
            # Update session
            stmt = select(TestSession).where(TestSession.id == session_id)
            session_obj = (await db.execute(stmt)).scalar_one_or_none()
            if session_obj:
                session_obj.status = "completed"
                session_obj.completed_at = datetime.utcnow()
                session_obj.pages_crawled = units_analysed
                session_obj.total_issues = len(all_issues)
                session_obj.critical_issues = severity_counts["critical"]
                session_obj.high_issues = severity_counts["high"]
                session_obj.medium_issues = severity_counts["medium"]
                session_obj.low_issues = severity_counts["low"]
                session_obj.ai_summary = ai_summary
                session_obj.overall_health = overall_health
                session_obj.performance_score = performance_score
                session_obj.accessibility_score = accessibility_score

            # Insert issues
            for issue_data in all_issues:
                issue = TestIssue(
                    session_id=session_id,
                    category=issue_data.get("category", "other"),
                    severity=issue_data.get("severity", "low"),
                    title=issue_data.get("title", "Untitled Issue"),
                    description=issue_data.get("description", ""),
                    recommendation=issue_data.get("recommendation"),
                    page_url=issue_data.get("page_url"),
                    element_selector=issue_data.get("element_selector"),
                    screenshot_path=issue_data.get("screenshot_path"),
                    raw_data=issue_data.get("raw_data"),
                )
                db.add(issue)

            await db.flush()

            # Generate reports
            html_path, json_path, pdf_path = "", "", ""
            try:
                generator = ReportGenerator()
                html_path, json_path, pdf_path = await generator.generate(
                    session_id=session_id,
                    session_url=target_label,
                    issues=all_issues,
                    summary={
                        "overall_health": overall_health,
                        "ai_summary": ai_summary,
                        "pages_crawled": units_analysed,
                        "total_issues": len(all_issues),
                        "severity_counts": severity_counts,
                        "performance_score": performance_score,
                        "accessibility_score": accessibility_score,
                    },
                )
            except Exception as rep_err:
                logger.warning(f"Report generation notice: {rep_err}")

            report = TestReport(
                session_id=session_id,
                html_path=html_path,
                json_path=json_path,
                pdf_path=pdf_path,
            )
            db.add(report)

        return severity_counts

    async def _update(self, phase: str, message: str, progress: int, extra: dict = None):
        """Send a progress update over the WebSocket."""
        payload = {
            "type": "progress",
            "phase": phase,
            "message": message,
            "progress": progress,
        }
        if extra:
            payload.update(extra)
        try:
            res = self._send(payload)
            if asyncio.iscoroutine(res):
                await res
        except Exception as e:
            logger.debug(f"Update send notice: {e}")

    async def _set_session_status(self, session_id: str, status: str):
        async with get_db_context() as db:
            stmt = select(TestSession).where(TestSession.id == session_id)
            session_obj = (await db.execute(stmt)).scalar_one_or_none()
            if session_obj:
                session_obj.status = status
