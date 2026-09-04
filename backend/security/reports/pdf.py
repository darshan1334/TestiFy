"""Real PDF report generation via reportlab."""
from __future__ import annotations
import io
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

GOLD = colors.HexColor("#C6A15B")
VIB = colors.HexColor("#5B2A86")
CRIT = colors.HexColor("#E63946")
HIGH = colors.HexColor("#F4A261")
MED = colors.HexColor("#E9C46A")
LOW = colors.HexColor("#2A9D8F")
DARK = colors.HexColor("#0A0612")


def build_pdf(result: dict, project_name: str) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20 * mm, bottomMargin=20 * mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("TitleGold", parent=styles["Title"], textColor=VIB)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], textColor=VIB)
    body = styles["BodyText"]

    code = result["code"]
    secrets = result["secrets"]
    deps = result["dependencies"]
    sev = code["severity_counts"]

    story = [
        Paragraph("TestiFy Security — Assessment Report", title_style),
        Paragraph(f"Project: <b>{project_name}</b>", body),
        Spacer(1, 12),
        Paragraph("Executive Summary", h2),
        Table([
            ["Risk Score", "Critical", "High", "Medium", "Low", "Files Scanned"],
            [str(code["risk_score"]), sev["critical"], sev["high"], sev["medium"], sev["low"], code["files_scanned"]],
        ], style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), VIB), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey), ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ])),
        Spacer(1, 16),
        Paragraph(f"Secrets Detected: {secrets['total_secrets']}", body),
        Paragraph(f"Dependencies Scanned: {deps['total_dependencies']} "
                   f"({deps['vulnerable_count']} with known CVEs)", body),
        Spacer(1, 16),
        Paragraph("Vulnerability Findings", h2),
    ]

    rows = [["Severity", "Title", "CWE", "Location"]]
    for f in code["findings"][:200]:
        rows.append([f["severity"].upper(), f["title"][:40], f["cwe"], f"{f['file']}:{f['line']}"])
    if len(rows) == 1:
        rows.append(["-", "No findings", "-", "-"])

    tbl = Table(rows, colWidths=[60, 200, 60, 160], repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), DARK), ("TEXTCOLOR", (0, 0), (-1, 0), GOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 8), ("GRID", (0, 0), (-1, -1), 0.4, colors.lightgrey),
    ]
    color_map = {"CRITICAL": CRIT, "HIGH": HIGH, "MEDIUM": MED, "LOW": LOW}
    for i, row in enumerate(rows[1:], start=1):
        c = color_map.get(row[0])
        if c:
            style_cmds.append(("TEXTCOLOR", (0, i), (0, i), c))
    tbl.setStyle(TableStyle(style_cmds))
    story.append(tbl)

    doc.build(story)
    return buf.getvalue()
