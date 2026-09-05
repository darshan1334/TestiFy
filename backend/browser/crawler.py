"""
Playwright-based web crawler.
Collects DOM data, screenshots, console errors, broken links,
network failures, and accessibility results via axe-core.
"""
import asyncio
import logging
import os
import re
import time
import uuid
from typing import Callable, Optional, Any
from urllib.parse import urlparse, urljoin, urldefrag

from playwright.async_api import async_playwright, Page, Browser, ConsoleMessage, Request, Response

from config import settings

logger = logging.getLogger(__name__)

# axe-core CDN for accessibility testing
AXE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.0/axe.min.js"


class CrawlResult:
    """Container for all data collected during a crawl."""
    def __init__(self, url: str):
        self.start_url = url
        self.pages_visited: list[str] = []
        self.console_errors: list[dict] = []
        self.network_failures: list[dict] = []
        self.broken_links: list[dict] = []
        self.accessibility_violations: list[dict] = []
        self.performance_metrics: list[dict] = []
        self.screenshots: list[str] = []
        self.form_issues: list[dict] = []
        self.js_errors: list[dict] = []
        self.page_titles: dict[str, str] = {}
        self.load_times: dict[str, float] = {}
        self.http_errors: list[dict] = []


class PlaywrightCrawler:
    """
    Autonomous web crawler that collects test data for AI analysis.
    Emits progress via an optional callback.
    """

    def __init__(
        self,
        progress_callback: Optional[Callable[[str, int], Any]] = None,
    ):
        self._progress = progress_callback
        self._screenshot_dir = settings.screenshot_dir
        os.makedirs(self._screenshot_dir, exist_ok=True)

    async def _emit_progress(self, msg: str, pct: int):
        if self._progress:
            try:
                res = self._progress(msg, pct)
                if asyncio.iscoroutine(res):
                    await res
            except Exception as e:
                logger.debug(f"Progress emit notice: {e}")

    async def crawl(self, start_url: str, session_id: str, max_pages: int = None) -> CrawlResult:
        """
        Main entry point. Crawls the target URL and returns a CrawlResult.
        """
        max_pages = max_pages or settings.max_crawl_pages
        result = CrawlResult(start_url)
        visited: set[str] = set()
        to_visit: list[str] = [start_url]
        base_domain = urlparse(start_url).netloc

        await self._emit_progress(f"Launching browser to test {start_url}…", 15)

        async with async_playwright() as pw:
            browser: Browser = await pw.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={"width": 1280, "height": 800},
                user_agent="TestiFy-Bot/1.0 (AI Testing Agent)",
                ignore_https_errors=True,
            )

            # Track network failures
            async def on_request_failed(request: Request):
                result.network_failures.append({
                    "url": request.url,
                    "failure": request.failure,
                    "resource_type": request.resource_type,
                })

            async def on_response(response: Response):
                if response.status >= 400:
                    result.http_errors.append({
                        "url": response.url,
                        "status": response.status,
                        "resource_type": response.request.resource_type,
                    })

            context.on("requestfailed", on_request_failed)
            context.on("response", on_response)

            page_count = 0
            while to_visit and page_count < max_pages:
                url = to_visit.pop(0)
                url, _ = urldefrag(url)  # strip fragments

                if url in visited:
                    continue
                if urlparse(url).netloc != base_domain:
                    continue

                visited.add(url)
                page_count += 1

                # Calculate progress from 15% to 45% during crawl
                pct = 15 + int((page_count / max_pages) * 30)
                await self._emit_progress(f"Exploring page {page_count}/{max_pages}: {url}", pct)
                logger.info(f"Crawling: {url}")

                page: Page = await context.new_page()

                # Collect console messages
                console_msgs: list[dict] = []
                def on_console(msg: ConsoleMessage):
                    if msg.type in ("error", "warning"):
                        console_msgs.append({
                            "type": msg.type,
                            "text": msg.text,
                            "url": url,
                        })
                page.on("console", on_console)

                try:
                    start_time = time.time()
                    response = await page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    load_time = time.time() - start_time

                    result.load_times[url] = load_time
                    result.pages_visited.append(url)
                    result.console_errors.extend(console_msgs)

                    async def capture_bug_screenshot(prefix: str = "bug") -> Optional[str]:
                        try:
                            ss_name = f"{session_id}_{prefix}_{uuid.uuid4().hex[:8]}.png"
                            ss_path = os.path.join(self._screenshot_dir, ss_name)
                            await page.screenshot(path=ss_path)
                            result.screenshots.append(ss_path)
                            return ss_name
                        except Exception as ss_e:
                            logger.debug(f"Bug screenshot notice: {ss_e}")
                            return None

                    for c_err in console_msgs:
                        if c_err.get("type") == "error":
                            c_err["screenshot_path"] = await capture_bug_screenshot("js")

                    if response:
                        result.page_titles[url] = await page.title()

                    # Performance metrics
                    try:
                        perf = await page.evaluate("""() => {
                            const t = performance.timing;
                            return {
                                domContentLoaded: t.domContentLoadedEventEnd - t.navigationStart,
                                loadComplete: t.loadEventEnd - t.navigationStart,
                                ttfb: t.responseStart - t.requestStart,
                            };
                        }""")
                        result.performance_metrics.append({"url": url, **perf})
                    except Exception:
                        pass

                    # Screenshot
                    try:
                        screenshot_path = os.path.join(
                            self._screenshot_dir,
                            f"{session_id}_{page_count}.png"
                        )
                        await page.screenshot(path=screenshot_path, full_page=True)
                        result.screenshots.append(screenshot_path)
                    except Exception as ss_err:
                        logger.debug(f"Screenshot notice: {ss_err}")

                    # Collect all links on page
                    try:
                        links = await page.evaluate("""() => {
                            return Array.from(document.querySelectorAll('a[href]'))
                                .map(a => ({ href: a.href, text: a.textContent.trim(), visible: a.offsetParent !== null }));
                        }""")

                        for link in links:
                            href = link.get("href", "")
                            if not href or href.startswith("javascript:") or href.startswith("mailto:"):
                                continue
                            abs_url, _ = urldefrag(urljoin(url, href))
                            if urlparse(abs_url).netloc == base_domain and abs_url not in visited:
                                to_visit.append(abs_url)
                    except Exception:
                        links = []

                    # Check for broken/empty buttons & forms
                    try:
                        form_issues = await page.evaluate("""() => {
                            const issues = [];
                            // Buttons without accessible text
                            document.querySelectorAll('button, [role="button"]').forEach(btn => {
                                const text = (btn.textContent || '').trim();
                                const aria = btn.getAttribute('aria-label') || '';
                                if (!text && !aria) {
                                    issues.push({
                                        type: 'empty_button',
                                        selector: btn.tagName.toLowerCase() + (btn.id ? '#'+btn.id : ''),
                                        detail: 'Button has no accessible text'
                                    });
                                }
                            });
                            // Forms without submit
                            document.querySelectorAll('form').forEach((form, i) => {
                                const hasSubmit = form.querySelector('[type="submit"], button:not([type="button"])');
                                if (!hasSubmit) {
                                    issues.push({
                                        type: 'form_no_submit',
                                        selector: 'form:nth-of-type(' + (i+1) + ')',
                                        detail: 'Form has no submit button'
                                    });
                                }
                            });
                            // Inputs without labels
                            document.querySelectorAll('input:not([type="hidden"]):not([type="submit"])').forEach(input => {
                                const id = input.id;
                                const label = id ? document.querySelector('label[for="'+id+'"]') : null;
                                const ariaLabel = input.getAttribute('aria-label');
                                if (!label && !ariaLabel) {
                                    issues.push({
                                        type: 'input_no_label',
                                        selector: 'input' + (id ? '#'+id : '[type="'+input.type+'"]'),
                                        detail: 'Input missing associated label'
                                    });
                                }
                            });
                            return issues;
                        }""")

                        for issue in form_issues:
                            issue["url"] = url
                            issue["screenshot_path"] = await capture_bug_screenshot("form")
                            result.form_issues.append(issue)
                    except Exception:
                        pass

                    # Accessibility via axe-core
                    try:
                        await page.add_script_tag(url=AXE_CDN)
                        await page.wait_for_function("typeof axe !== 'undefined'", timeout=4000)
                        axe_results = await page.evaluate("""async () => {
                            const result = await axe.run();
                            return result.violations.map(v => ({
                                id: v.id,
                                impact: v.impact,
                                description: v.description,
                                help: v.help,
                                helpUrl: v.helpUrl,
                                nodes: v.nodes.slice(0, 3).map(n => ({
                                    html: n.html.slice(0, 200),
                                    failureSummary: n.failureSummary
                                }))
                            }));
                        }""")
                        for violation in axe_results:
                            violation["url"] = url
                            violation["screenshot_path"] = await capture_bug_screenshot("a11y")
                            result.accessibility_violations.append(violation)
                    except Exception as e:
                        logger.debug(f"axe-core notice on {url}: {e}")

                    # Check for broken external links (HEAD request)
                    external_links = [
                        link for link in links
                        if link.get("href", "").startswith("http")
                        and urlparse(link.get("href", "")).netloc != base_domain
                    ]
                    for ext_link in external_links[:5]:
                        try:
                            check_response = await context.request.head(
                                ext_link["href"], timeout=6000
                            )
                            if check_response.status >= 400:
                                result.broken_links.append({
                                    "url": ext_link["href"],
                                    "status": check_response.status,
                                    "source_page": url,
                                    "link_text": ext_link.get("text", ""),
                                })
                        except Exception:
                            result.broken_links.append({
                                "url": ext_link["href"],
                                "status": "timeout/error",
                                "source_page": url,
                                "link_text": ext_link.get("text", ""),
                            })

                except Exception as e:
                    logger.error(f"Error crawling {url}: {e}")
                    result.broken_links.append({
                        "url": url,
                        "status": "crawl_error",
                        "error": str(e),
                        "source_page": start_url,
                        "link_text": "",
                    })
                finally:
                    await page.close()

            await browser.close()

        await self._emit_progress(f"Crawl complete. Visited {len(result.pages_visited)} page(s).", 45)
        return result
