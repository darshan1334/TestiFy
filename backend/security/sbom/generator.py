"""Real CycloneDX 1.5 SBOM generation from parsed dependencies."""
from __future__ import annotations
import uuid
import datetime as dt


def generate_cyclonedx(project_name: str, deps: list, vuln_map: dict) -> dict:
    components = []
    for d in deps:
        purl_type = {"npm": "npm", "PyPI": "pypi", "Packagist": "composer",
                     "Go": "golang", "crates.io": "cargo", "RubyGems": "gem"}.get(d.ecosystem, "generic")
        components.append({
            "type": "library",
            "bom-ref": f"{purl_type}:{d.name}@{d.version}",
            "name": d.name,
            "version": d.version or "unknown",
            "purl": f"pkg:{purl_type}/{d.name}@{d.version}",
            "scope": "required" if d.direct else "optional",
            "properties": [{"name": "manifest", "value": d.manifest_file}],
        })
    return {
        "bomFormat": "CycloneDX",
        "specVersion": "1.5",
        "serialNumber": f"urn:uuid:{uuid.uuid4()}",
        "version": 1,
        "metadata": {
            "timestamp": dt.datetime.utcnow().isoformat() + "Z",
            "tools": [{"vendor": "TestiFy", "name": "TestiFy Security SBOM Generator", "version": "1.0.0"}],
            "component": {"type": "application", "name": project_name},
        },
        "components": components,
    }


def generate_spdx(project_name: str, deps: list) -> dict:
    packages = []
    for i, d in enumerate(deps):
        packages.append({
            "SPDXID": f"SPDXRef-Package-{i}",
            "name": d.name,
            "versionInfo": d.version or "unknown",
            "downloadLocation": "NOASSERTION",
            "licenseConcluded": "NOASSERTION",
            "licenseDeclared": "NOASSERTION",
            "copyrightText": "NOASSERTION",
            "externalRefs": [{
                "referenceCategory": "PACKAGE-MANAGER",
                "referenceType": "purl",
                "referenceLocator": f"pkg:{d.ecosystem}/{d.name}@{d.version}",
            }],
        })
    return {
        "spdxVersion": "SPDX-2.3",
        "dataLicense": "CC0-1.0",
        "SPDXID": "SPDXRef-DOCUMENT",
        "name": project_name,
        "documentNamespace": f"https://testify.local/spdx/{uuid.uuid4()}",
        "creationInfo": {
            "created": dt.datetime.utcnow().isoformat() + "Z",
            "creators": ["Tool: TestiFy Security SBOM Generator-1.0.0"],
        },
        "packages": packages,
    }
