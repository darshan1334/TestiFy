"""
Dependency manifest parsers. Real parsing of actual manifest file formats -
no synthetic dependency lists.
"""
from __future__ import annotations
import json
import os
import re
from dataclasses import dataclass


@dataclass
class Dependency:
    name: str
    version: str
    ecosystem: str  # matches OSV.dev ecosystem names
    manifest_file: str
    direct: bool = True


def _clean_semver(v: str) -> str:
    return re.sub(r"^[~^>=<\s]+", "", v).strip().strip('"').strip("'")


def parse_package_json(path: str, rel: str) -> list[Dependency]:
    try:
        data = json.load(open(path, encoding="utf-8"))
    except Exception:
        return []
    deps = []
    for section, direct in (("dependencies", True), ("devDependencies", False)):
        for name, ver in (data.get(section) or {}).items():
            deps.append(Dependency(name, _clean_semver(str(ver)), "npm", rel, direct))
    return deps


def parse_requirements_txt(path: str, rel: str) -> list[Dependency]:
    deps = []
    try:
        with open(path, encoding="utf-8", errors="ignore") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or line.startswith("-"):
                    continue
                m = re.match(r"^([A-Za-z0-9_.\-]+)\s*(==|>=|<=|~=|>|<)?\s*([A-Za-z0-9_.\-]*)", line)
                if m and m.group(1):
                    deps.append(Dependency(m.group(1), m.group(3) or "unpinned", "PyPI", rel))
    except OSError:
        return []
    return deps


def parse_pyproject_toml(path: str, rel: str) -> list[Dependency]:
    deps = []
    try:
        text = open(path, encoding="utf-8", errors="ignore").read()
    except OSError:
        return []
    # lightweight extraction without a toml lib dependency requirement
    in_deps = False
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("[tool.poetry.dependencies]") or s.startswith("[project.dependencies]"):
            in_deps = True
            continue
        if s.startswith("[") and in_deps:
            in_deps = False
        if in_deps and "=" in s:
            m = re.match(r'^"?([A-Za-z0-9_.\-]+)"?\s*=\s*"?\^?([A-Za-z0-9_.\-]*)"?', s)
            if m and m.group(1).lower() != "python":
                deps.append(Dependency(m.group(1), m.group(2) or "unpinned", "PyPI", rel))
    return deps


def parse_composer_json(path: str, rel: str) -> list[Dependency]:
    try:
        data = json.load(open(path, encoding="utf-8"))
    except Exception:
        return []
    deps = []
    for name, ver in (data.get("require") or {}).items():
        if name == "php":
            continue
        deps.append(Dependency(name, _clean_semver(str(ver)), "Packagist", rel))
    return deps


def parse_go_mod(path: str, rel: str) -> list[Dependency]:
    deps = []
    try:
        with open(path, encoding="utf-8", errors="ignore") as f:
            in_block = False
            for line in f:
                s = line.strip()
                if s.startswith("require ("):
                    in_block = True
                    continue
                if s == ")":
                    in_block = False
                    continue
                if s.startswith("require ") or in_block:
                    m = re.match(r"^(?:require\s+)?([^\s]+)\s+(v[0-9][^\s]*)", s)
                    if m:
                        deps.append(Dependency(m.group(1), m.group(2), "Go", rel))
    except OSError:
        return []
    return deps


def parse_cargo_toml(path: str, rel: str) -> list[Dependency]:
    deps = []
    try:
        text = open(path, encoding="utf-8", errors="ignore").read()
    except OSError:
        return []
    in_deps = False
    for line in text.splitlines():
        s = line.strip()
        if s == "[dependencies]":
            in_deps = True
            continue
        if s.startswith("[") and in_deps:
            in_deps = False
        if in_deps and "=" in s:
            m = re.match(r'^"?([A-Za-z0-9_.\-]+)"?\s*=\s*"?([0-9][A-Za-z0-9_.\-]*)"?', s)
            if m:
                deps.append(Dependency(m.group(1), m.group(2), "crates.io", rel))
    return deps


def parse_gemfile(path: str, rel: str) -> list[Dependency]:
    deps = []
    try:
        with open(path, encoding="utf-8", errors="ignore") as f:
            for line in f:
                m = re.match(r"""^\s*gem\s+['"]([A-Za-z0-9_\-]+)['"](?:\s*,\s*['"]([^'"]+)['"])?""", line)
                if m:
                    deps.append(Dependency(m.group(1), m.group(2) or "unpinned", "RubyGems", rel))
    except OSError:
        return []
    return deps


MANIFEST_PARSERS = {
    "package.json": parse_package_json,
    "requirements.txt": parse_requirements_txt,
    "pyproject.toml": parse_pyproject_toml,
    "composer.json": parse_composer_json,
    "go.mod": parse_go_mod,
    "Cargo.toml": parse_cargo_toml,
    "Gemfile": parse_gemfile,
}


def find_and_parse_manifests(root: str) -> list[Dependency]:
    from ..scanner.engine import SKIP_DIRS
    all_deps: list[Dependency] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for fn in filenames:
            parser = MANIFEST_PARSERS.get(fn)
            if parser:
                full = os.path.join(dirpath, fn)
                rel = os.path.relpath(full, root).replace(os.sep, "/")
                all_deps.extend(parser(full, rel))
    # de-dupe identical (name, version, ecosystem)
    seen = set()
    uniq = []
    for d in all_deps:
        key = (d.name.lower(), d.version, d.ecosystem)
        if key in seen:
            continue
        seen.add(key)
        uniq.append(d)
    return uniq
