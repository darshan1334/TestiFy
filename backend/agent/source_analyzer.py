"""
Source analyzer — the code-intake counterpart of browser/crawler.py + analyzer.py.

A GitHub repository or an uploaded ZIP has no live URL to drive with Playwright,
so instead of crawling pages this module walks the checked-out project, reads its
source files and derives the same kind of QA findings the browser flow produces:
accessibility defects, broken references, form problems, error-handling gaps,
performance risks and — the thing only source access can tell us — test coverage.

Everything downstream (Gemini enrichment, DB rows, reports, the results UI) is
shared with the URL flow, so findings are emitted in the exact issue shape that
agent/analyzer.py returns, with `page_url` holding the repo-relative file path.

This is QA analysis only. Vulnerability scanning, secrets detection and SBOM
work belong to the separate security module and are deliberately not repeated
here.
"""
from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger(__name__)

# ── Walk limits — a repo can be arbitrarily large; the analysis must not be ────
MAX_FILES = 1500          # source files read
MAX_FILE_BYTES = 400_000  # skip generated bundles / minified blobs
MAX_LINES_PER_FILE = 6000

SKIP_DIRS = {
    ".git", ".hg", ".svn", "node_modules", "bower_components", "vendor",
    "dist", "build", "out", ".next", ".nuxt", ".output", ".parcel-cache",
    "venv", ".venv", "env", "__pycache__", ".pytest_cache", ".mypy_cache",
    ".tox", "site-packages", "coverage", ".nyc_output", ".cache", ".gradle",
    "target", "bin", "obj", ".idea", ".vscode", ".terraform", "Pods",
}

LANGUAGES = {
    ".js": "JavaScript", ".jsx": "JavaScript", ".mjs": "JavaScript", ".cjs": "JavaScript",
    ".ts": "TypeScript", ".tsx": "TypeScript",
    ".py": "Python", ".rb": "Ruby", ".php": "PHP", ".go": "Go", ".rs": "Rust",
    ".java": "Java", ".kt": "Kotlin", ".cs": "C#", ".swift": "Swift",
    ".c": "C", ".h": "C", ".cpp": "C++", ".hpp": "C++",
    ".html": "HTML", ".htm": "HTML", ".vue": "Vue", ".svelte": "Svelte",
    ".css": "CSS", ".scss": "CSS", ".sass": "CSS", ".less": "CSS",
}

MARKUP_EXT = {".html", ".htm", ".jsx", ".tsx", ".vue", ".svelte"}
JS_EXT = {".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".vue", ".svelte"}
PY_EXT = {".py"}

ASSET_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".mp4", ".webm", ".woff", ".woff2", ".ttf"}
LARGE_ASSET_BYTES = 500_000

TEST_DIR_NAMES = {"test", "tests", "__tests__", "spec", "specs", "e2e", "cypress", "testing"}
TEST_FILE_RE = re.compile(r"(^|[._-])(test|tests|spec|e2e)([._-]|$)", re.IGNORECASE)

CI_PATHS = (".github/workflows", ".gitlab-ci.yml", "azure-pipelines.yml", ".circleci", "Jenkinsfile", ".travis.yml")

TEST_DEP_HINTS = (
    "jest", "vitest", "mocha", "jasmine", "karma", "ava", "tape", "cypress",
    "playwright", "@testing-library", "testing-library", "pytest", "unittest",
    "nose", "tox", "rspec", "minitest", "phpunit", "junit", "testng",
)


@dataclass
class SourceFile:
    path: str          # repo-relative, forward slashes
    ext: str
    language: str
    lines: int
    size: int
    is_test: bool


@dataclass
class ProjectScan:
    """Everything the walk learned about the project."""
    root: str
    project_name: str
    files: list[SourceFile] = field(default_factory=list)
    asset_files: list[dict] = field(default_factory=list)
    language_counts: dict[str, int] = field(default_factory=dict)
    total_lines: int = 0
    truncated: bool = False

    # Project configuration
    manifests: list[str] = field(default_factory=list)
    package_json: Optional[dict] = None
    has_test_script: bool = False
    test_frameworks: list[str] = field(default_factory=list)
    has_ci: bool = False
    ci_files: list[str] = field(default_factory=list)

    # Raw detections: {"rule", "category", "severity", "file", "line", "detail", "snippet"}
    detections: list[dict] = field(default_factory=list)

    @property
    def source_files(self) -> list[SourceFile]:
        return [f for f in self.files if not f.is_test]

    @property
    def test_files(self) -> list[SourceFile]:
        return [f for f in self.files if f.is_test]


# ── Rule patterns ─────────────────────────────────────────────────────────────
_IMG_TAG_RE       = re.compile(r"<img\b[^>]*>", re.IGNORECASE)
_A_TAG_RE         = re.compile(r"<a\b[^>]*>", re.IGNORECASE)
_BUTTON_OPEN_RE   = re.compile(r"<button\b[^>]*>", re.IGNORECASE)
_INPUT_TAG_RE     = re.compile(r"<input\b[^>]*>", re.IGNORECASE)
_IFRAME_TAG_RE    = re.compile(r"<iframe\b[^>]*>", re.IGNORECASE)
_HTML_TAG_RE      = re.compile(r"<html\b[^>]*>", re.IGNORECASE)
_FORM_TAG_RE      = re.compile(r"<form\b[^>]*>", re.IGNORECASE)
_CLICK_DIV_RE     = re.compile(r"<(?:div|span)\b[^>]*\bonClick\b[^>]*>", re.IGNORECASE)
_HREF_VALUE_RE    = re.compile(r"href\s*=\s*[\"']([^\"']*)[\"']", re.IGNORECASE)
_REF_RE           = re.compile(r"\b(?:src|href)\s*=\s*[\"']([^\"'{}\s>]+)[\"']", re.IGNORECASE)

_EMPTY_CATCH_RE   = re.compile(r"catch\s*(?:\([^)]*\))?\s*\{\s*\}")
_BARE_EXCEPT_RE   = re.compile(r"^\s*except\s*:\s*$")
_EXCEPT_PASS_RE   = re.compile(r"^\s*except\b[^:]*:\s*pass\s*$")
_DEBUGGER_RE      = re.compile(r"^\s*debugger\s*;?\s*$")
_ALERT_RE         = re.compile(r"\balert\s*\(")
_CONSOLE_RE       = re.compile(r"\bconsole\.(?:log|debug|info)\s*\(")
_PRINT_RE         = re.compile(r"^\s*print\s*\(")
_TODO_RE          = re.compile(r"\b(?:TODO|FIXME|HACK|XXX)\b")
_LOCALHOST_RE     = re.compile(r"https?://(?:localhost|127\.0\.0\.1)(?::\d+)?", re.IGNORECASE)
_FETCH_RE         = re.compile(r"\b(?:fetch\s*\(|axios\s*\.\s*(?:get|post|put|delete|patch)\s*\(|axios\s*\()")
_SETTIMEOUT_STR_RE = re.compile(r"setTimeout\s*\(\s*[\"']")
_SYNC_FS_RE       = re.compile(r"\bfs\.(?:readFileSync|writeFileSync|existsSync)\s*\(")

# One issue per rule at most this many times, so a repo-wide pattern reports as
# a handful of examples plus a rollup rather than thousands of duplicates.
MAX_ISSUES_PER_RULE = 20


def _rel(root: str, path: str) -> str:
    return os.path.relpath(path, root).replace(os.sep, "/")


def _is_test_path(rel_path: str) -> bool:
    parts = rel_path.lower().split("/")
    if any(p in TEST_DIR_NAMES for p in parts[:-1]):
        return True
    stem = os.path.splitext(parts[-1])[0]
    return bool(TEST_FILE_RE.search(stem))


def _read_text(path: str) -> Optional[str]:
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as fh:
            return fh.read()
    except Exception:
        return None


def _has_attr(tag: str, *names: str) -> bool:
    """True when the tag carries any of the given attributes with a value."""
    low = tag.lower()
    for n in names:
        if re.search(re.escape(n) + r"\s*=", low):
            return True
    return False


def _detect(scan: ProjectScan, rule: str, category: str, severity: str,
            file: str, line: int, detail: str, snippet: str = "") -> None:
    scan.detections.append({
        "rule": rule,
        "category": category,
        "severity": severity,
        "file": file,
        "line": line,
        "detail": detail,
        "snippet": snippet.strip()[:200],
    })


# ── Project configuration discovery ───────────────────────────────────────────
def _load_project_config(scan: ProjectScan) -> None:
    root = scan.root

    pkg_path = os.path.join(root, "package.json")
    if os.path.isfile(pkg_path):
        scan.manifests.append("package.json")
        raw = _read_text(pkg_path)
        try:
            pkg = json.loads(raw) if raw else None
        except Exception:
            pkg = None
        if isinstance(pkg, dict):
            scan.package_json = pkg
            scripts = pkg.get("scripts") or {}
            test_cmd = str(scripts.get("test", "")).strip().lower()
            scan.has_test_script = bool(test_cmd) and "no test specified" not in test_cmd
            deps = {}
            for key in ("dependencies", "devDependencies", "peerDependencies"):
                if isinstance(pkg.get(key), dict):
                    deps.update(pkg[key])
            for dep in deps:
                low = dep.lower()
                for hint in TEST_DEP_HINTS:
                    if hint in low and dep not in scan.test_frameworks:
                        scan.test_frameworks.append(dep)

    for name in ("requirements.txt", "pyproject.toml", "setup.py", "Pipfile",
                 "pytest.ini", "tox.ini", "go.mod", "Gemfile", "composer.json", "pom.xml"):
        if os.path.isfile(os.path.join(root, name)):
            scan.manifests.append(name)
            raw = (_read_text(os.path.join(root, name)) or "").lower()
            if name in ("pytest.ini", "tox.ini"):
                scan.has_test_script = True
            known = {f.lower() for f in scan.test_frameworks}
            for hint in TEST_DEP_HINTS:
                if hint in raw and hint not in known:
                    scan.test_frameworks.append(hint)
                    known.add(hint)

    for ci in CI_PATHS:
        target = os.path.join(root, ci.replace("/", os.sep))
        if os.path.exists(target):
            scan.has_ci = True
            scan.ci_files.append(ci)


# ── The file walk ─────────────────────────────────────────────────────────────
def walk_project(root: str, project_name: str) -> ProjectScan:
    """Walk the checked-out project and collect its source inventory + findings."""
    scan = ProjectScan(root=root, project_name=project_name)
    _load_project_config(scan)

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in sorted(dirnames) if d not in SKIP_DIRS and not d.endswith(".egg-info")]

        for fname in sorted(filenames):
            full = os.path.join(dirpath, fname)
            ext = os.path.splitext(fname)[1].lower()
            rel = _rel(root, full)

            try:
                size = os.path.getsize(full)
            except OSError:
                continue

            if ext in ASSET_EXT:
                if size > LARGE_ASSET_BYTES:
                    scan.asset_files.append({"path": rel, "size": size})
                continue

            if ext not in LANGUAGES:
                continue
            if size > MAX_FILE_BYTES:
                continue
            if len(scan.files) >= MAX_FILES:
                scan.truncated = True
                continue

            text = _read_text(full)
            if text is None:
                continue
            lines = text.count("\n") + 1
            if lines > MAX_LINES_PER_FILE:
                continue

            is_test = _is_test_path(rel)
            scan.files.append(SourceFile(
                path=rel, ext=ext, language=LANGUAGES[ext],
                lines=lines, size=size, is_test=is_test,
            ))
            scan.language_counts[LANGUAGES[ext]] = scan.language_counts.get(LANGUAGES[ext], 0) + 1
            scan.total_lines += lines

            _scan_file(scan, rel, ext, text, lines, is_test)

    _scan_project_level(scan)
    return scan


def _scan_file(scan: ProjectScan, rel: str, ext: str, text: str, lines: int, is_test: bool) -> None:
    """Run the per-line rule set over one source file."""
    debug_output_count = 0
    todo_count = 0
    first_debug_line = 0
    first_todo_line = 0
    has_error_handling = ("catch" in text) or ("except" in text)
    uses_network = bool(_FETCH_RE.search(text)) if ext in JS_EXT else False

    for idx, line in enumerate(text.splitlines(), start=1):
        stripped = line.strip()
        if not stripped:
            continue

        # ── Markup: accessibility, navigation, forms, broken references ───────
        if ext in MARKUP_EXT:
            for tag in _IMG_TAG_RE.findall(line):
                if not _has_attr(tag, "alt"):
                    _detect(scan, "img_missing_alt", "accessibility", "medium", rel, idx,
                            "Image element has no alt attribute, so screen readers cannot describe it.", tag)

            for tag in _A_TAG_RE.findall(line):
                if not _has_attr(tag, "href", "to"):
                    _detect(scan, "anchor_missing_href", "navigation", "medium", rel, idx,
                            "Anchor tag has no href, making it unreachable by keyboard navigation.", tag)
                else:
                    href = _HREF_VALUE_RE.search(tag)
                    if href and href.group(1).strip() in ("#", ""):
                        _detect(scan, "anchor_placeholder_href", "navigation", "medium", rel, idx,
                                "Anchor points at a placeholder href, which navigates nowhere.", tag)

            for tag in _INPUT_TAG_RE.findall(line):
                low = tag.lower()
                if "hidden" in low and "type" in low:
                    continue
                if not _has_attr(tag, "id", "aria-label", "aria-labelledby", "name", "title"):
                    _detect(scan, "input_unlabelled", "accessibility", "medium", rel, idx,
                            "Input has no id, name or aria-label, so it cannot be tied to a label.", tag)

            for tag in _IFRAME_TAG_RE.findall(line):
                if not _has_attr(tag, "title"):
                    _detect(scan, "iframe_missing_title", "accessibility", "medium", rel, idx,
                            "Iframe has no title attribute describing its embedded content.", tag)

            for tag in _HTML_TAG_RE.findall(line):
                if not _has_attr(tag, "lang"):
                    _detect(scan, "html_missing_lang", "accessibility", "medium", rel, idx,
                            "Root html element declares no lang attribute.", tag)

            for tag in _CLICK_DIV_RE.findall(line):
                if not _has_attr(tag, "role", "tabindex", "onkeydown", "onkeypress", "onkeyup"):
                    _detect(scan, "clickable_nonsemantic", "accessibility", "medium", rel, idx,
                            "Click handler on a non-interactive element without role or keyboard support.", tag)

            for tag in _BUTTON_OPEN_RE.findall(line):
                after = line.split(tag, 1)[1] if tag in line else ""
                # Only judge buttons that open and close on one line — a JSX
                # button whose label sits on the next line is not evidence of a
                # missing accessible name.
                if "</button>" not in after.lower():
                    continue
                visible = re.sub(r"<[^>]*>", "", after.split("</button>")[0]).strip()
                if not visible and not _has_attr(tag, "aria-label", "title"):
                    _detect(scan, "button_no_label", "accessibility", "medium", rel, idx,
                            "Button has no visible text and no aria-label.", tag)

            for tag in _FORM_TAG_RE.findall(line):
                if not _has_attr(tag, "onsubmit", "action", "@submit", "v-on:submit"):
                    _detect(scan, "form_no_submit_handler", "form", "high", rel, idx,
                            "Form declares neither an action nor a submit handler, so submissions go nowhere.", tag)

            for ref in _REF_RE.findall(line):
                _check_local_ref(scan, rel, idx, ref, stripped)

        # ── JavaScript / TypeScript error handling and runtime hazards ────────
        if ext in JS_EXT:
            if _EMPTY_CATCH_RE.search(line):
                _detect(scan, "empty_catch", "js_error", "high", rel, idx,
                        "Empty catch block swallows the error, hiding failures from users and logs.", stripped)
            if _DEBUGGER_RE.match(line):
                _detect(scan, "debugger_statement", "js_error", "high", rel, idx,
                        "A debugger statement left in source halts execution wherever devtools are open.", stripped)
            if _SETTIMEOUT_STR_RE.search(line):
                _detect(scan, "settimeout_string", "js_error", "medium", rel, idx,
                        "setTimeout called with a string is eval'd at runtime and cannot be optimised or debugged.", stripped)
            if _SYNC_FS_RE.search(line) and not is_test:
                _detect(scan, "sync_fs", "performance", "medium", rel, idx,
                        "Synchronous filesystem call blocks the event loop.", stripped)
            if _ALERT_RE.search(line) and not is_test:
                _detect(scan, "alert_call", "ui", "low", rel, idx,
                        "Blocking alert() call used for user feedback.", stripped)
            if _CONSOLE_RE.search(line) and not is_test:
                debug_output_count += 1
                first_debug_line = first_debug_line or idx

        # ── Python error handling ─────────────────────────────────────────────
        if ext in PY_EXT:
            if _BARE_EXCEPT_RE.match(line):
                _detect(scan, "bare_except", "js_error", "high", rel, idx,
                        "Bare except catches everything, including KeyboardInterrupt and SystemExit.", stripped)
            elif _EXCEPT_PASS_RE.match(line):
                _detect(scan, "except_pass", "js_error", "high", rel, idx,
                        "Exception is caught and silently discarded, hiding real failures.", stripped)
            if _PRINT_RE.match(line) and not is_test:
                debug_output_count += 1
                first_debug_line = first_debug_line or idx

        # ── Cross-language ────────────────────────────────────────────────────
        if _LOCALHOST_RE.search(line) and not is_test:
            _detect(scan, "hardcoded_localhost", "api", "medium", rel, idx,
                    "Hardcoded localhost endpoint will break anywhere but a developer machine.", stripped)
        if _TODO_RE.search(line):
            todo_count += 1
            first_todo_line = first_todo_line or idx

    # ── Per-file aggregates ───────────────────────────────────────────────────
    if debug_output_count >= 5:
        label = "console statements" if ext in JS_EXT else "print statements"
        _detect(scan, "debug_output", "ui", "low", rel, first_debug_line,
                f"{debug_output_count} leftover {label} in shipped code.")
    if todo_count >= 3:
        _detect(scan, "todo_backlog", "other", "low", rel, first_todo_line,
                f"{todo_count} unresolved TODO/FIXME markers.")
    if uses_network and not has_error_handling and not is_test:
        _detect(scan, "network_no_error_handling", "api", "medium", rel, 1,
                "File performs network requests but contains no error handling for failed responses.")
    if lines > 800 and not is_test:
        _detect(scan, "oversized_module", "performance", "medium", rel, 1,
                f"Module is {lines} lines long, which makes it hard to test and slow to load.")


def _check_local_ref(scan: ProjectScan, rel: str, idx: int, ref: str, line: str) -> None:
    """Flag relative src/href references that do not resolve to a file on disk."""
    ref = ref.strip()
    if not ref:
        return
    if ref.startswith(("http://", "https://", "//", "#", "data:", "mailto:", "tel:", "javascript:", "{", "$", "?", "@")):
        return
    # Leading-slash paths are resolved by a router or a static mount, not by the
    # file layout of the repo, so they are not checkable here.
    if ref.startswith("/"):
        return
    target = ref.split("?", 1)[0].split("#", 1)[0]
    if not target or not os.path.splitext(target)[1]:
        return
    base_dir = os.path.dirname(os.path.join(scan.root, rel.replace("/", os.sep)))
    resolved = os.path.normpath(os.path.join(base_dir, target.replace("/", os.sep)))
    if not resolved.startswith(os.path.normpath(scan.root)):
        return
    if not os.path.exists(resolved):
        _detect(scan, "broken_local_reference", "broken_link", "high", rel, idx,
                f"Reference to '{ref}' does not resolve to any file in the project.", line)


def _scan_project_level(scan: ProjectScan) -> None:
    """Checks that need the whole inventory rather than a single file."""
    src = scan.source_files
    tests = scan.test_files
    if not src:
        return

    anchor = scan.manifests[0] if scan.manifests else "/"

    if not tests:
        _detect(scan, "no_tests", "other", "critical", anchor, 1,
                f"The project contains {len(src)} source files and no automated tests at all.")
    else:
        ratio = len(tests) / len(src)
        if ratio < 0.1:
            _detect(scan, "low_test_ratio", "other", "high", anchor, 1,
                    f"Only {len(tests)} test file(s) cover {len(src)} source files ({ratio:.0%} ratio).")
        elif ratio < 0.3:
            _detect(scan, "low_test_ratio", "other", "medium", anchor, 1,
                    f"{len(tests)} test file(s) for {len(src)} source files ({ratio:.0%} ratio) leaves most modules unverified.")

    if scan.package_json is not None and not scan.has_test_script:
        _detect(scan, "no_test_script", "other", "high", "package.json", 1,
                "package.json defines no runnable `test` script, so CI has nothing to execute.")

    if tests and not scan.test_frameworks:
        _detect(scan, "no_test_framework", "other", "medium", anchor, 1,
                "Test files exist but no test framework is declared in the project manifests.")

    if scan.manifests and not scan.has_ci:
        _detect(scan, "no_ci", "other", "low", anchor, 1,
                "No CI pipeline configuration found, so tests are never run automatically on push.")

    # Largest untested modules — the coverage gaps worth naming explicitly.
    covered = set()
    for t in tests:
        stem = os.path.splitext(os.path.basename(t.path))[0].lower()
        covered.add(stem)
        covered.add(re.sub(r"[._-]?(?:test|tests|spec|e2e)[._-]?", "", stem))

    untested = [
        f for f in sorted(src, key=lambda x: -x.lines)
        if f.lines >= 80
        and os.path.splitext(os.path.basename(f.path))[0].lower() not in covered
    ]
    for f in untested[:10]:
        _detect(scan, "untested_module", "other", "medium", f.path, 1,
                f"{f.lines}-line module has no matching test file.")

    for asset in sorted(scan.asset_files, key=lambda a: -a["size"])[:10]:
        _detect(scan, "oversized_asset", "performance", "medium", asset["path"], 1,
                f"Asset is {asset['size'] / 1_000_000:.1f} MB, which will slow first paint if served unoptimised.")


# ── Presentation metadata ─────────────────────────────────────────────────────
RULE_TITLES = {
    "img_missing_alt": "Image Missing Alt Text",
    "anchor_missing_href": "Link Without Destination",
    "anchor_placeholder_href": "Placeholder Link Href",
    "input_unlabelled": "Unlabelled Form Input",
    "iframe_missing_title": "Iframe Missing Title",
    "html_missing_lang": "Document Language Not Declared",
    "clickable_nonsemantic": "Click Handler on Non-Interactive Element",
    "button_no_label": "Button Without Accessible Name",
    "form_no_submit_handler": "Form Has No Submit Handler",
    "broken_local_reference": "Broken Local Reference",
    "empty_catch": "Empty Catch Block",
    "bare_except": "Bare Except Clause",
    "except_pass": "Silently Discarded Exception",
    "debugger_statement": "Debugger Statement in Source",
    "settimeout_string": "setTimeout Called With a String",
    "sync_fs": "Blocking Filesystem Call",
    "alert_call": "Blocking alert() Dialog",
    "debug_output": "Leftover Debug Output",
    "todo_backlog": "Unresolved TODO Markers",
    "hardcoded_localhost": "Hardcoded Localhost Endpoint",
    "network_no_error_handling": "Network Calls Without Error Handling",
    "oversized_module": "Oversized Module",
    "oversized_asset": "Oversized Asset",
    "no_tests": "No Automated Tests",
    "low_test_ratio": "Insufficient Test Coverage",
    "no_test_script": "No Test Script Configured",
    "no_test_framework": "No Test Framework Declared",
    "no_ci": "No CI Pipeline",
    "untested_module": "Module Without Tests",
}

RULE_RECOMMENDATIONS = {
    "img_missing_alt": "Add a descriptive alt attribute, or alt=\"\" if the image is purely decorative.",
    "anchor_missing_href": "Give the anchor a real href, or use a <button> if it triggers an action.",
    "anchor_placeholder_href": "Point the link at its real destination, or replace it with a button.",
    "input_unlabelled": "Add an id tied to a <label for>, or an aria-label describing the field.",
    "iframe_missing_title": "Add a title attribute summarising the embedded content.",
    "html_missing_lang": "Set lang on the <html> element so assistive tech uses the right pronunciation.",
    "clickable_nonsemantic": "Use a <button>, or add role, tabIndex and a keyboard handler.",
    "button_no_label": "Add visible text or an aria-label so the control has an accessible name.",
    "form_no_submit_handler": "Wire the form to a submit handler or a server action, and validate its input.",
    "broken_local_reference": "Fix the path or add the missing file to the repository.",
    "empty_catch": "Log the error and surface a useful message instead of swallowing it.",
    "bare_except": "Catch the specific exception types you expect and re-raise the rest.",
    "except_pass": "Log or handle the exception; silent failures make bugs untraceable.",
    "debugger_statement": "Remove the debugger statement before shipping.",
    "settimeout_string": "Pass a function reference to setTimeout instead of a string.",
    "sync_fs": "Switch to the async fs API so the event loop stays responsive.",
    "alert_call": "Replace alert() with an in-app notification component.",
    "debug_output": "Remove the leftover debug output or route it through a logger with levels.",
    "todo_backlog": "Convert the TODO markers into tracked issues, then resolve or delete them.",
    "hardcoded_localhost": "Move the endpoint into an environment variable.",
    "network_no_error_handling": "Wrap the requests in try/catch and handle non-2xx responses explicitly.",
    "oversized_module": "Split the module into focused units that can be tested in isolation.",
    "oversized_asset": "Compress the asset, convert it to a modern format, or load it lazily.",
    "no_tests": "Add a test framework and start with smoke tests over the critical paths.",
    "low_test_ratio": "Grow the suite so each significant module has at least one test.",
    "no_test_script": "Add a \"test\" script to package.json so the suite is runnable in CI.",
    "no_test_framework": "Declare the test runner in the project manifest so the suite is reproducible.",
    "no_ci": "Add a CI workflow that installs dependencies and runs the test suite on every push.",
    "untested_module": "Add unit tests covering this module's public behaviour.",
}


# ── Public API used by the orchestrator ───────────────────────────────────────
def pre_classify_source_issues(scan: ProjectScan) -> list[dict]:
    """
    Turn raw detections into the same issue shape agent/analyzer.py produces,
    capping each rule so a repo-wide pattern reports as examples plus a rollup.
    """
    issues: list[dict] = []
    per_rule: dict[str, int] = {}
    overflow: dict[str, int] = {}
    rule_category: dict[str, str] = {}

    for det in scan.detections:
        rule = det["rule"]
        rule_category.setdefault(rule, det["category"])
        seen = per_rule.get(rule, 0)
        if seen >= MAX_ISSUES_PER_RULE:
            overflow[rule] = overflow.get(rule, 0) + 1
            continue
        per_rule[rule] = seen + 1

        location = det["file"] if det["file"] != "/" else scan.project_name
        issues.append({
            "category": det["category"],
            "severity": det["severity"],
            "title": RULE_TITLES.get(rule, rule.replace("_", " ").title()),
            "description": det["detail"],
            "recommendation": RULE_RECOMMENDATIONS.get(rule, "Review and remediate this finding."),
            "page_url": f"{location}:{det['line']}" if det["line"] > 1 else location,
            "element_selector": det["snippet"] or None,
            "raw_data": {"rule": rule, "file": det["file"], "line": det["line"]},
        })

    for rule, extra in overflow.items():
        issues.append({
            "category": rule_category.get(rule, "other"),
            "severity": "low",
            "title": f"{RULE_TITLES.get(rule, rule)} — {extra} More Occurrence(s)",
            "description": (
                f"The same pattern was detected {extra} additional time(s) beyond the "
                f"{MAX_ISSUES_PER_RULE} listed individually."
            ),
            "recommendation": RULE_RECOMMENDATIONS.get(rule, "Apply the same fix to the remaining occurrences."),
            "page_url": scan.project_name,
            "element_selector": None,
            "raw_data": {"rule": rule, "additional_occurrences": extra},
        })

    return issues


def build_source_raw_findings(scan: ProjectScan) -> dict[str, Any]:
    """Structured summary handed to Gemini for enrichment."""
    by_rule: dict[str, int] = {}
    for det in scan.detections:
        by_rule[det["rule"]] = by_rule.get(det["rule"], 0) + 1

    src, tests = scan.source_files, scan.test_files
    return {
        "source_type": "codebase",
        "project_name": scan.project_name,
        "file_count": len(scan.files),
        "source_file_count": len(src),
        "test_file_count": len(tests),
        "test_ratio": round(len(tests) / len(src), 3) if src else 0,
        "total_lines": scan.total_lines,
        "languages": scan.language_counts,
        "manifests": scan.manifests,
        "test_frameworks": scan.test_frameworks,
        "has_test_script": scan.has_test_script,
        "has_ci": scan.has_ci,
        "ci_files": scan.ci_files,
        "inventory_truncated": scan.truncated,
        "largest_files": [
            {"path": f.path, "lines": f.lines}
            for f in sorted(src, key=lambda x: -x.lines)[:15]
        ],
        "detection_counts": by_rule,
        "detections_sample": scan.detections[:120],
        "large_assets": sorted(scan.asset_files, key=lambda a: -a["size"])[:10],
    }


def compute_source_scores(scan: ProjectScan) -> tuple[Optional[float], Optional[float]]:
    """
    Deterministic baseline scores, mirroring how the URL flow derives them from
    crawl data. Gemini may override these during enrichment.

    Returns (performance_score, accessibility_score).
    """
    src_count = max(1, len(scan.source_files))

    a11y_hits = sum(1 for d in scan.detections if d["category"] == "accessibility")
    markup_files = max(1, sum(1 for f in scan.files if f.ext in MARKUP_EXT and not f.is_test))
    accessibility_score = max(0.0, min(100.0, round(100.0 - (a11y_hits / markup_files) * 12.0, 1)))

    perf_hits = sum(1 for d in scan.detections if d["category"] == "performance")
    performance_score = max(
        10.0,
        min(100.0, round(100.0 - (perf_hits / src_count) * 60.0 - len(scan.asset_files) * 2.0, 1)),
    )

    return performance_score, accessibility_score
