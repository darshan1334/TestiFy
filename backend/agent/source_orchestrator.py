"""
Source Orchestrator — runs the TestiFy pipeline against a codebase instead of a
live website.

It emits the same phases, the same progress percentages and the same issue rows
as agent/orchestrator.py, so the WebSocket stream, the results pages, the bug
list and the generated reports behave identically no matter whether the session
was started from a URL, a GitHub repository or an uploaded ZIP.

Pipeline: Walk source → Pre-classify → AI Enrich → Persist → Report
"""
import asyncio
import logging
import os
import shutil
import stat
import time

from agent.orchestrator import TestOrchestrator
from agent.source_analyzer import (
    walk_project,
    pre_classify_source_issues,
    build_source_raw_findings,
    compute_source_scores,
)
from ai.gemini_client import gemini_client

logger = logging.getLogger(__name__)


def _remove_checkout(path: str) -> None:
    """
    Delete a temporary checkout.

    Two Windows-specific hazards make a plain rmtree unreliable here: a shallow
    git clone leaves read-only files under .git, and the pack files it just
    wrote can still be held briefly after the clone process exits. So this
    clears the read-only bit and retries a few times before giving up.
    """
    if not path or not os.path.isdir(path):
        return

    for attempt in range(4):
        try:
            shutil.rmtree(path)
            return
        except OSError as e:
            last_error = e

        for root, dirs, files in os.walk(path):
            for name in dirs + files:
                try:
                    os.chmod(os.path.join(root, name), stat.S_IWRITE)
                except OSError:
                    pass

        if attempt < 3:
            time.sleep(0.5 * (attempt + 1))

    if os.path.isdir(path):
        logger.warning(f"Could not remove temporary checkout {path}: {last_error}")


class SourceTestOrchestrator(TestOrchestrator):
    """Codebase equivalent of TestOrchestrator, reusing its persistence stage."""

    async def run_source(
        self,
        session_id: str,
        project_dir: str,
        target_label: str,
        source_type: str = "zip",
        cleanup_dir: str = None,
        cleanup: bool = True,
    ):
        """
        Analyse an extracted/cloned project directory.

        `target_label` is what the UI shows as the target (repo URL or archive
        name). `cleanup_dir` is the temporary checkout root to delete once the
        run ends — it defaults to `project_dir`, but a ZIP that nests its project
        one level down passes the outer directory so nothing is left behind.
        Pass `cleanup=False` when the caller runs another pipeline (the security
        scan) over the same files and will delete the directory itself.
        """
        origin = "repository" if source_type == "github" else "project archive"
        await self._update("initialising", f"Starting autonomous test agent on the {origin}…", 5)

        try:
            await self._set_session_status(session_id, "running")

            # ─── Phase 1: Walk the codebase ──────────────────────────────────
            await self._update("exploring", "Indexing project files and manifests…", 20)

            project_name = target_label.rstrip("/").rsplit("/", 1)[-1] or target_label
            # The walk is synchronous and CPU-bound — it reads and regexes every
            # source file — so it runs off the event loop to avoid stalling the
            # live progress sockets and any concurrent browser session.
            scan = await asyncio.to_thread(walk_project, project_dir, project_name)

            files_analysed = len(scan.files)
            await self._update(
                "exploring",
                f"Indexed {files_analysed} source file(s) across "
                f"{len(scan.language_counts)} language(s). Collecting findings…",
                50,
            )

            if files_analysed == 0:
                raise ValueError(
                    "No analysable source files were found in this project. "
                    "Check that the repository or archive contains source code."
                )

            # ─── Phase 2: Pre-classify ───────────────────────────────────────
            await self._update("analysing", "Analysing accessibility, error handling and test coverage…", 60)
            pre_classified = pre_classify_source_issues(scan)
            raw_findings = build_source_raw_findings(scan)

            await self._update(
                "analysing",
                f"Detected {len(pre_classified)} findings. Synthesizing AI analysis…",
                70,
            )

            # ─── Phase 3: AI Analysis ────────────────────────────────────────
            await self._update("ai_analysis", "AI Agent is classifying severity and generating fixes…", 80)

            ai_issues = []
            overall_health = "Good"
            ai_summary = ""
            performance_score, accessibility_score = compute_source_scores(scan)

            try:
                ai_result = await gemini_client.classify_source_issues(raw_findings)
                if ai_result and isinstance(ai_result, dict):
                    ai_issues = ai_result.get("issues", [])
                    if ai_result.get("overall_health"):
                        overall_health = ai_result["overall_health"]
                    if ai_result.get("ai_summary"):
                        ai_summary = ai_result["ai_summary"]
                    if ai_result.get("performance_score") is not None:
                        performance_score = float(ai_result["performance_score"])
                    if ai_result.get("accessibility_score") is not None:
                        accessibility_score = float(ai_result["accessibility_score"])
            except Exception as e:
                logger.info(f"Gemini enrichment notice: {e}. Utilizing synthesized rules engine analysis.")

            all_issues = ai_issues if ai_issues else pre_classified
            crit_count = sum(1 for i in all_issues if i.get("severity") == "critical")
            high_count = sum(1 for i in all_issues if i.get("severity") == "high")
            med_count = sum(1 for i in all_issues if i.get("severity") == "medium")

            if not ai_summary:
                tests = len(scan.test_files)
                if crit_count > 0:
                    overall_health = "Critical"
                    ai_summary = (
                        f"Analysis of {files_analysed} file(s) found {crit_count} critical and "
                        f"{high_count} high severity issues. Immediate remediation recommended."
                    )
                elif high_count > 0:
                    overall_health = "Poor"
                    ai_summary = (
                        f"Identified {high_count} high-priority issues across {files_analysed} file(s). "
                        f"The project ships {tests} test file(s); review error handling and coverage."
                    )
                elif med_count > 0:
                    overall_health = "Fair"
                    ai_summary = (
                        f"Codebase is sound with {med_count} moderate findings across {files_analysed} file(s). "
                        "Minor accessibility, coverage or performance improvements suggested."
                    )
                else:
                    overall_health = "Good"
                    ai_summary = (
                        f"All automated checks passed across {files_analysed} file(s). "
                        "No breaking defects detected in the source."
                    )

            await self._update(
                "ai_analysis",
                f"Analysis complete. {len(all_issues)} total issues evaluated.",
                88,
            )

            # ─── Phase 4: Persist + report (shared with the URL flow) ────────
            severity_counts = await self._persist_results(
                session_id=session_id,
                target_label=target_label,
                all_issues=all_issues,
                units_analysed=files_analysed,
                ai_summary=ai_summary,
                overall_health=overall_health,
                performance_score=performance_score,
                accessibility_score=accessibility_score,
            )

            await self._update(
                "completed",
                f"Testing complete! {len(all_issues)} issues found across {files_analysed} file(s).",
                100,
                extra={
                    "total_issues": len(all_issues),
                    "pages_crawled": files_analysed,
                    "files_analysed": files_analysed,
                    "overall_health": overall_health,
                    "severity_counts": severity_counts,
                },
            )

        except Exception as e:
            logger.exception(f"Source orchestrator error for session {session_id}: {e}")
            await self._set_session_status(session_id, "failed")
            await self._update("failed", f"Testing failed: {str(e)}", 100)
        finally:
            if cleanup:
                # Off the event loop: the retry backoff in _remove_checkout must
                # not stall the progress sockets of a session running alongside
                # this one.
                await asyncio.to_thread(_remove_checkout, cleanup_dir or project_dir)
