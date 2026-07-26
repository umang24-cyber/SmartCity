"""
backend_python/routers/export.py
==================================
GET /reports/export — download incident reports as CSV or PDF.

Requires supervisor role authentication.
Supports filters: format, date range, severity threshold, emergency level.
Optional: include_zones appends a zone danger summary.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from middleware.auth import require_role
from services.export_service import generate_csv, generate_pdf

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reports", tags=["Report Export"])


def _get_report_store() -> list:
    """
    Import the shared in-memory report store from the reports router.
    Isolated in a function to avoid circular-import issues at module level.
    """
    from routers.reports import _report_store
    return _report_store


def _get_zones() -> list:
    """Fetch zone data for the optional danger summary."""
    from custom_db.mock_db import get_all_mock_zones
    return get_all_mock_zones()


def _parse_report_timestamp(report: dict) -> datetime | None:
    """Safely parse the ISO timestamp from a report dict."""
    ts = report.get("timestamp")
    if not ts:
        return None
    try:
        # Handle both offset-aware and naive ISO strings
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return dt
    except (ValueError, TypeError):
        return None


@router.get(
    "/export",
    summary="Export incident reports as CSV or PDF",
    description=(
        "Download filtered incident reports as a CSV or PDF file. "
        "Requires supervisor role. Supports date range, severity, "
        "and emergency level filters."
    ),
)
async def export_reports(
    current_user: dict = Depends(require_role(["supervisor"])),
    format: str = Query(
        default="csv",
        description="Export format: 'csv' or 'pdf'.",
        pattern="^(csv|pdf)$",
    ),
    from_date: Optional[date] = Query(
        default=None,
        description="Inclusive start date (ISO format, e.g. 2026-01-01).",
    ),
    to_date: Optional[date] = Query(
        default=None,
        description="Inclusive end date (ISO format, e.g. 2026-12-31).",
    ),
    min_severity: Optional[float] = Query(
        default=None,
        ge=1.0, le=5.0,
        description="Minimum severity threshold (1.0–5.0).",
    ),
    emergency_level: Optional[str] = Query(
        default=None,
        description="Filter by emergency level: CRITICAL, HIGH, MEDIUM, LOW.",
    ),
    include_zones: bool = Query(
        default=False,
        description="If true, append a zone danger summary section.",
    ),
):
    """
    Export incident reports with optional filters.

    Returns a downloadable file (CSV or PDF).
    Empty filtered results produce a valid file with headers only.
    """
    reports = list(_get_report_store())  # shallow copy for safe filtering

    # ── Apply filters ─────────────────────────────────────────────────────────

    if from_date is not None:
        from_dt = datetime(from_date.year, from_date.month, from_date.day, tzinfo=timezone.utc)
        reports = [
            r for r in reports
            if (ts := _parse_report_timestamp(r)) is not None and ts >= from_dt
        ]

    if to_date is not None:
        # End of day inclusive
        to_dt = datetime(to_date.year, to_date.month, to_date.day, 23, 59, 59, tzinfo=timezone.utc)
        reports = [
            r for r in reports
            if (ts := _parse_report_timestamp(r)) is not None and ts <= to_dt
        ]

    if min_severity is not None:
        reports = [r for r in reports if float(r.get("severity", 0)) >= min_severity]

    if emergency_level is not None:
        lvl = emergency_level.strip().upper()
        reports = [
            r for r in reports
            if (r.get("emergency_level") or "").upper() == lvl
        ]

    # ── Zone data (if requested) ──────────────────────────────────────────────

    zones = _get_zones() if include_zones else None

    # ── Generate file ─────────────────────────────────────────────────────────

    logger.info(
        "Export requested by %s: format=%s, reports=%d, include_zones=%s",
        current_user.get("email"),
        format,
        len(reports),
        include_zones,
    )

    timestamp_slug = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    if format == "pdf":
        pdf_bytes = generate_pdf(reports, include_zones=include_zones, zones=zones)
        filename = f"incident_report_{timestamp_slug}.pdf"
        return Response(
            content=bytes(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    else:
        csv_str = generate_csv(reports, include_zones=include_zones, zones=zones)
        filename = f"incident_report_{timestamp_slug}.csv"
        return Response(
            content=csv_str,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
