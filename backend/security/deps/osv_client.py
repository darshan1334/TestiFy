"""
Real vulnerability lookups against the OSV.dev public database
(https://osv.dev/docs/#tag/api). This calls the actual OSV API - it is not
a mock. In sandboxed/offline environments without egress to osv.dev, calls
fail gracefully and the dependency is reported as "lookup_unavailable"
rather than fabricating a CVE result.
"""
from __future__ import annotations
import asyncio
import httpx
from dataclasses import dataclass, asdict

OSV_BATCH_URL = "https://api.osv.dev/v1/querybatch"
OSV_VULN_URL = "https://api.osv.dev/v1/vulns/{id}"


@dataclass
class VulnMatch:
    id: str
    summary: str
    severity: str  # critical|high|medium|low|unknown
    cvss: float | None
    fixed_version: str | None
    aliases: list[str]
    url: str


def _severity_from_cvss(score: float | None) -> str:
    if score is None:
        return "unknown"
    if score >= 9.0:
        return "critical"
    if score >= 7.0:
        return "high"
    if score >= 4.0:
        return "medium"
    return "low"


def _extract_cvss(vuln: dict) -> float | None:
    for sev in vuln.get("severity", []) or []:
        if sev.get("type", "").startswith("CVSS"):
            score_str = sev.get("score", "")
            m = None
            try:
                # CVSS vector strings don't carry a bare score; some OSV entries embed score directly
                return float(score_str)
            except (TypeError, ValueError):
                continue
    # Some entries put a numeric score under database_specific
    ds = vuln.get("database_specific", {}) or {}
    val = ds.get("cvss_score") or ds.get("severity")
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _extract_fixed_version(vuln: dict) -> str | None:
    for affected in vuln.get("affected", []) or []:
        for rng in affected.get("ranges", []) or []:
            for event in rng.get("events", []) or []:
                if "fixed" in event:
                    return event["fixed"]
    return None


async def query_osv_batch(deps: list) -> dict[str, list[VulnMatch]]:
    """deps: list of Dependency (name, version, ecosystem). Returns dep-key -> matches.
    Real network call to OSV.dev; on any network failure returns {} and the
    caller marks lookup as unavailable rather than inventing results."""
    if not deps:
        return {}
    queries = [{"package": {"name": d.name, "ecosystem": d.ecosystem}, "version": d.version}
               for d in deps if d.version and d.version != "unpinned"]
    if not queries:
        return {}
    results: dict[str, list[VulnMatch]] = {}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(OSV_BATCH_URL, json={"queries": queries})
            resp.raise_for_status()
            data = resp.json()
            batch_results = data.get("results", [])
            # batch endpoint returns minimal vuln IDs; hydrate details concurrently
            id_to_key = {}
            for dep, res in zip([d for d in deps if d.version and d.version != "unpinned"], batch_results):
                key = f"{dep.ecosystem}:{dep.name}:{dep.version}"
                vuln_ids = [v["id"] for v in (res.get("vulns") or [])]
                if vuln_ids:
                    id_to_key[key] = vuln_ids

            all_ids = {vid for ids in id_to_key.values() for vid in ids}
            hydrated: dict[str, dict] = {}

            async def fetch_one(vid: str):
                try:
                    r = await client.get(OSV_VULN_URL.format(id=vid))
                    if r.status_code == 200:
                        hydrated[vid] = r.json()
                except httpx.HTTPError:
                    pass

            await asyncio.gather(*(fetch_one(vid) for vid in all_ids))

            for key, ids in id_to_key.items():
                matches = []
                for vid in ids:
                    v = hydrated.get(vid)
                    if not v:
                        matches.append(VulnMatch(vid, "Details unavailable", "unknown", None, None, [],
                                                  f"https://osv.dev/vulnerability/{vid}"))
                        continue
                    cvss = _extract_cvss(v)
                    matches.append(VulnMatch(
                        id=vid,
                        summary=(v.get("summary") or v.get("details", ""))[:300],
                        severity=_severity_from_cvss(cvss),
                        cvss=cvss,
                        fixed_version=_extract_fixed_version(v),
                        aliases=v.get("aliases", []),
                        url=f"https://osv.dev/vulnerability/{vid}",
                    ))
                results[key] = matches
        return results
    except (httpx.HTTPError, httpx.TimeoutException, Exception):
        return {}
