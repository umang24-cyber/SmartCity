"""
backend_python/services/export_service.py
==========================================
CSV and PDF generation for incident report exports.

CSV — lightweight, machine-readable, suitable for spreadsheet tools.
PDF — formatted document for official submissions and offline briefings.

Both functions accept a pre-filtered list of enriched report dicts
and an optional zone danger summary flag.
"""

from __future__ import annotations

import csv
import io
import logging
from datetime import datetime, timezone
from typing import Any, List

logger = logging.getLogger(__name__)

# ── CSV column spec ───────────────────────────────────────────────────────────

CSV_COLUMNS = [
    "Report ID",
    "Timestamp",
    "Incident Type",
    "Severity",
    "Emergency Level",
    "Sentiment",
    "Distress Level",
    "Credibility",
    "Latitude",
    "Longitude",
    "Source",
    "Text",
]


def _report_to_row(report: dict) -> list:
    """Extract a flat row from an enriched report dict."""
    return [
        report.get("report_id", ""),
        report.get("timestamp", ""),
        (report.get("incident_type") or "general").replace("_", " ").title(),
        report.get("severity", ""),
        report.get("emergency_level", ""),
        report.get("sentiment", ""),
        report.get("distress_level", ""),
        report.get("credibility_label", ""),
        report.get("lat", ""),
        report.get("lng", ""),
        report.get("source", ""),
        (report.get("text") or "")[:500],  # truncate very long text
    ]


# ── CSV Generation ────────────────────────────────────────────────────────────

def generate_csv(
    reports: List[dict],
    include_zones: bool = False,
    zones: List[dict] | None = None,
) -> str:
    """
    Generate a CSV string from a list of enriched report dicts.

    Returns a UTF-8 string suitable for writing to a StreamingResponse.
    Empty report list → valid CSV with headers only.
    """
    buf = io.StringIO()
    writer = csv.writer(buf)

    # ── Incident data ──
    writer.writerow(CSV_COLUMNS)
    for report in reports:
        writer.writerow(_report_to_row(report))

    # ── Optional zone danger summary ──
    if include_zones and zones:
        writer.writerow([])  # blank separator
        writer.writerow(["--- ZONE DANGER SUMMARY ---"])
        writer.writerow(["Zone ID", "Zone Name", "Danger Score", "Incidents 24h", "Lighting Score"])
        for z in zones:
            writer.writerow([
                z.get("zone_id", ""),
                z.get("name", z.get("intersection_name", "")),
                z.get("danger_score", ""),
                z.get("incident_count_24h", ""),
                z.get("lighting_score", ""),
            ])

    return buf.getvalue()


# ── PDF Generation ────────────────────────────────────────────────────────────

def generate_pdf(
    reports: List[dict],
    include_zones: bool = False,
    zones: List[dict] | None = None,
) -> bytes:
    """
    Generate a formatted PDF byte-string from enriched report dicts.

    Uses fpdf2 for lightweight PDF creation without heavy dependencies.
    Empty report list → valid PDF with header and "No reports" message.
    """
    from fpdf import FPDF

    pdf = FPDF(orientation="L", format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # ── Title ──
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(30, 30, 30)
    pdf.cell(0, 12, "Smart City - Incident Report", new_x="LMARGIN", new_y="NEXT", align="C")

    # ── Metadata line ──
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(100, 100, 100)
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    pdf.cell(0, 6, f"Generated: {generated_at}  |  Total Records: {len(reports)}", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.ln(4)

    # ── Incident table ──
    col_widths = [28, 36, 30, 16, 22, 20, 18, 18, 22, 22, 20, 45]
    headers = [
        "Report ID", "Timestamp", "Type", "Sev", "Emergency",
        "Sentiment", "Distress", "Credibility", "Lat", "Lng", "Source", "Text"
    ]

    # Header row
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_fill_color(40, 55, 71)
    pdf.set_text_color(255, 255, 255)
    for i, header in enumerate(headers):
        pdf.cell(col_widths[i], 7, header, border=1, fill=True, align="C")
    pdf.ln()

    if not reports:
        pdf.set_font("Helvetica", "I", 10)
        pdf.set_text_color(150, 150, 150)
        pdf.cell(sum(col_widths), 10, "No incident reports match the selected filters.", border=1, align="C")
        pdf.ln()
    else:
        pdf.set_font("Helvetica", "", 6.5)
        pdf.set_text_color(30, 30, 30)
        for idx, report in enumerate(reports):
            # Alternate row shading
            if idx % 2 == 0:
                pdf.set_fill_color(245, 247, 250)
            else:
                pdf.set_fill_color(255, 255, 255)

            row = _report_to_row(report)
            # Truncate text further for PDF cell width
            row[-1] = (row[-1] or "")[:80]
            # Format timestamp to shorter form
            ts = row[1]
            if ts and len(ts) > 16:
                row[1] = ts[:16].replace("T", " ")

            for i, val in enumerate(row):
                # fpdf2 with default fonts only supports latin-1. Strip emojis/unicode to avoid crashes.
                safe_text = str(val)[:40].encode('latin-1', 'replace').decode('latin-1')
                pdf.cell(col_widths[i], 6, safe_text, border=1, fill=True, align="L")
            pdf.ln()

    # ── Optional zone danger summary ──
    if include_zones and zones:
        pdf.ln(6)
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(30, 30, 30)
        pdf.cell(0, 8, "Zone Danger Summary", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)

        zone_widths = [30, 70, 30, 30, 30]
        zone_headers = ["Zone ID", "Zone Name", "Danger Score", "Incidents 24h", "Lighting"]

        pdf.set_font("Helvetica", "B", 7)
        pdf.set_fill_color(40, 55, 71)
        pdf.set_text_color(255, 255, 255)
        for i, h in enumerate(zone_headers):
            pdf.cell(zone_widths[i], 7, h, border=1, fill=True, align="C")
        pdf.ln()

        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(30, 30, 30)
        for idx, z in enumerate(zones):
            if idx % 2 == 0:
                pdf.set_fill_color(245, 247, 250)
            else:
                pdf.set_fill_color(255, 255, 255)

            danger = z.get("danger_score", 0)
            # Color-code danger score text
            if danger >= 0.7:
                pdf.set_text_color(220, 38, 38)
            elif danger >= 0.5:
                pdf.set_text_color(217, 119, 6)
            else:
                pdf.set_text_color(30, 30, 30)

            safe_zone_id = str(z.get("zone_id", "")).encode('latin-1', 'replace').decode('latin-1')
            safe_zone_name = str(z.get("name", z.get("intersection_name", "")))[:50].encode('latin-1', 'replace').decode('latin-1')
            
            pdf.cell(zone_widths[0], 6, safe_zone_id, border=1, fill=True)
            pdf.cell(zone_widths[1], 6, safe_zone_name, border=1, fill=True)
            pdf.cell(zone_widths[2], 6, f"{danger:.2f}", border=1, fill=True, align="C")
            pdf.cell(zone_widths[3], 6, str(z.get("incident_count_24h", "")), border=1, fill=True, align="C")
            pdf.cell(zone_widths[4], 6, str(z.get("lighting_score", "")), border=1, fill=True, align="C")
            pdf.ln()
            pdf.set_text_color(30, 30, 30)  # reset

    # ── Footer ──
    pdf.ln(6)
    pdf.set_font("Helvetica", "I", 7)
    pdf.set_text_color(150, 150, 150)
    pdf.cell(0, 5, "This report was auto-generated by the Smart City AI Safety Platform (Oraya OS).", align="C")

    return pdf.output()
