"""
backend_python/models/report_models.py
========================================
Pydantic v2 models for incident report endpoints.

  POST /api/v1/analyze-report  →  ReportRequest / ReportResponse
  GET  /api/v1/reports         →  ReportsListResponse
"""

from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field, field_validator


# ── Request ───────────────────────────────────────────────────────────────────

class ReportRequest(BaseModel):
    """
    Request body for POST /api/v1/analyze-report.

    *report_id* is optional — one will be auto-generated if absent.
    *location_id* is preferred over raw lat/lng for TigerGraph zone lookup;
    if only lat/lng are provided, a zone_id will be derived automatically.
    """

    text: str = Field(
        ...,
        min_length=10,
        max_length=4000,
        description="Free-text incident description (minimum 10 characters)",
        examples=["I felt unsafe near the bus stop on main road at 11pm."],
    )
    location_id: Optional[str] = Field(
        default=None,
        max_length=128,
        description="Zone or intersection identifier (preferred over lat/lng)",
        examples=["zone_42"],
    )
    report_id: Optional[str] = Field(
        default=None,
        max_length=64,
        description="Client-supplied report ID; auto-generated if omitted",
    )
    reporter_id: Optional[str] = Field(
        default=None,
        max_length=64,
        description="Anonymous session token or user ID of the reporter",
    )
    lat: Optional[float] = Field(
        default=None,
        ge=-90.0,
        le=90.0,
        description="Latitude of the incident location",
    )
    lng: Optional[float] = Field(
        default=None,
        ge=-180.0,
        le=180.0,
        description="Longitude of the incident location",
    )

    @field_validator("text")
    @classmethod
    def text_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Report text must not be blank or whitespace only")
        return v.strip()

    model_config = {"json_schema_extra": {
        "example": {
            "text": "I was followed by a man near the bus stop at 10pm.",
            "location_id": "zone_42",
            "lat": 30.7333,
            "lng": 76.7794,
        }
    }}


# ── Response ──────────────────────────────────────────────────────────────────

class ReportResponse(BaseModel):
    """
    Response for POST /api/v1/analyze-report.

    Contains the full NLP analysis result.  graph_payload is excluded from
    the response (it's an internal field used by graph_service).
    """

    report_id: str
    timestamp: str

    # NLP outputs
    sentiment: str = Field(..., description="'positive' | 'neutral' | 'negative'")
    sentiment_score: float = Field(..., ge=0.0, le=1.0)
    emotion: str = Field(..., description="Primary detected emotion")
    emotion_scores: dict[str, Any] = Field(
        default_factory=dict,
        description="All detected emotion scores keyed by emotion name",
    )

    severity: str = Field(
        ...,
        pattern=r"^(low|medium|high|critical)$",
        description="Classified severity level",
    )
    severity_score: float = Field(..., ge=0.0, le=1.0)
    credibility_score: float = Field(..., ge=0.0, le=1.0)
    entities: dict[str, Any] = Field(
        default_factory=dict,
        description="Extracted named entities (locations, times, persons, etc.)",
    )

    # Deduplication
    is_duplicate: bool
    duplicate_of: Optional[str] = Field(
        default=None,
        description="Report ID of the original if this is a duplicate",
    )

    # Action
    auto_response: str = Field(
        ...,
        description="Auto-generated acknowledgement message to show the reporter",
    )
    location_id: Optional[str] = None


class ReportsListResponse(BaseModel):
    """Response for GET /api/v1/reports."""

    reports: list[dict[str, Any]]
    total: int
    filtered_by: dict[str, Any] = Field(default_factory=dict)
