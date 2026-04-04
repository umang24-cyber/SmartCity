"""
backend_python/routers/reports.py
===================================
GET  /reports          — list submitted incident reports (filterable)
POST /reports          — UNIFIED: submit + NLP analyze + store enriched result
POST /reports/analyze  — [INTERNAL] NLP-only analysis (no storage, for testing)

The POST /reports endpoint is the canonical submission path:
  1. Accepts text + optional lat/lng + metadata
  2. Runs full NLP pipeline (analyze_report)
  3. Stores enriched result in _report_store
  4. Returns full analysis response + report_id + timestamp
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from services.nlp_service import analyze_report

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reports", tags=["Incident Reports"])

# ── In-memory incident store ──────────────────────────────────────────────────
# Each entry is a fully enriched report (NLP output + submission metadata).
_report_store: List[dict] = []


# ── Pydantic Models ───────────────────────────────────────────────────────────

class ReportRequest(BaseModel):
    """Unified submit + analyze request (primary endpoint)."""
    text: str = Field(
        ...,
        min_length=5,
        max_length=5000,
        description="Free-text incident description — will be run through NLP pipeline.",
    )
    lat: Optional[float] = Field(
        default=None,
        description="Latitude of the incident location.",
    )
    lng: Optional[float] = Field(
        default=None,
        description="Longitude of the incident location.",
    )
    report_id: Optional[str] = Field(
        default=None,
        description="Optional client-supplied ID. Auto-generated if omitted.",
    )
    incident_type: Optional[str] = Field(
        default=None,
        description="Category e.g. 'felt_followed', 'suspicious_activity'.",
    )
    zone_id: Optional[str] = Field(
        default=None,
        description="Zone context for duplicate detection.",
    )
    source: str = Field(
        default="user_report",
        description="Origin of the report.",
    )


class NlpOnlyRequest(BaseModel):
    """Request model for /analyze (internal testing only)."""
    text: str = Field(..., min_length=1, max_length=5000)
    report_id: Optional[str] = None
    zone_id: Optional[str] = None


class EntityResult(BaseModel):
    time: list[str]
    location: list[str]
    people: list[str]
    clothing: list[str]
    vehicles: list[str]
    physical_description: list[str]


class EnrichedReportResponse(BaseModel):
    """Full enriched report (NLP + submission metadata)."""
    # Submission metadata
    report_id: str
    timestamp: str
    lat: Optional[float]
    lng: Optional[float]
    incident_type: Optional[str]
    source: str

    # Sentiment
    sentiment: str
    sentiment_score: float
    distress_level: str

    # Emotion
    emotion: str
    emotion_confidence: float
    emotion_all_scores: dict[str, float]

    # Emergency
    emergency_level: str
    is_emergency: bool
    matched_keywords: list[str]

    # Severity + credibility
    severity: float
    credibility_score: int
    credibility_label: str
    credibility_flags: list[str]

    # Entities
    entities: dict[str, list[str]]

    # Deduplication
    duplicate_score: float
    is_duplicate: bool
    duplicate_matched_index: Optional[int]

    # Response
    auto_response: str
    recommended_actions: list[str]

    # Meta
    word_count: int
    processing_ms: float
    loader_status: str


class ReportAnalysisResponse(BaseModel):
    """NLP-only response (for /analyze endpoint)."""
    report_id: Optional[str]
    sentiment: str
    sentiment_score: float
    distress_level: str
    emotion: str
    emotion_confidence: float
    emotion_all_scores: dict[str, float]
    emergency_level: str
    is_emergency: bool
    matched_keywords: list[str]
    severity: float
    credibility_score: int
    credibility_label: str
    credibility_flags: list[str]
    entities: dict[str, list[str]]
    duplicate_score: float
    is_duplicate: bool
    duplicate_matched_index: Optional[int]
    auto_response: str
    recommended_actions: list[str]
    word_count: int
    processing_ms: float
    loader_status: str


# ── GET /reports ──────────────────────────────────────────────────────────────

@router.get(
    "/",
    summary="List all submitted incident reports",
    description=(
        "Returns all enriched incident reports. "
        "Filterable by min_severity (float 1–5) and emergency_level string."
    ),
)
async def list_reports(
    min_severity: Optional[float] = Query(
        default=None,
        ge=1.0, le=5.0,
        description="Only return reports with severity >= this value.",
    ),
    emergency_level: Optional[str] = Query(
        default=None,
        description="Filter by emergency level: CRITICAL, HIGH, MEDIUM, LOW, NORMAL",
    ),
    limit: int = Query(default=200, ge=1, le=1000, description="Max results to return."),
) -> list:
    results = list(_report_store)

    if min_severity is not None:
        results = [r for r in results if r.get("severity", 0) >= min_severity]

    if emergency_level is not None:
        lvl = emergency_level.upper()
        results = [r for r in results if r.get("emergency_level", "").upper() == lvl]

    return results[-limit:]  # newest last


# ── POST /reports  (UNIFIED submit + analyze) ─────────────────────────────────

@router.post(
    "/",
    response_model=EnrichedReportResponse,
    status_code=201,
    summary="Submit + analyze an incident report (unified)",
    description=(
        "Primary submission endpoint. Runs full NLP pipeline on the text, "
        "stores the enriched result, and returns the full analysis. "
        "Supply lat/lng if available so the map can display the marker."
    ),
)
async def submit_and_analyze_report(
    body: ReportRequest,
    request: Request,
) -> EnrichedReportResponse:
    if not body.text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Report text must not be blank.",
        )

    # Auto-generate report_id if not supplied
    report_id = body.report_id or f"RPT_{uuid.uuid4().hex[:10].upper()}"
    timestamp = datetime.now(timezone.utc).isoformat()

    logger.info(
        "Unified report submit: id=%s chars=%d lat=%s lng=%s",
        report_id, len(body.text), body.lat, body.lng,
    )

    # ── Run NLP ──────────────────────────────────────────────────
    nlp_bundle = request.app.state.models.get("nlp")
    if nlp_bundle is None:
        raise HTTPException(status_code=503, detail="NLP model not loaded yet — retry in a few seconds.")

    try:
        nlp_result = analyze_report(body.text, bundle=nlp_bundle)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:
        logger.error("NLP analysis failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"NLP analysis failed: {exc}")

    # ── Assemble enriched report ──────────────────────────────────
    enriched: dict[str, Any] = {
        # Submission metadata
        "report_id":     report_id,
        "timestamp":     timestamp,
        "text":          body.text,
        "lat":           body.lat,
        "lng":           body.lng,
        "incident_type": body.incident_type,
        "source":        body.source,
        # Full NLP output
        **nlp_result,
    }

    _report_store.append(enriched)

    logger.info(
        "Report stored: id=%s emergency=%s severity=%.2f credibility=%d",
        report_id,
        nlp_result.get("emergency_level", "?"),
        float(nlp_result.get("severity", 0)),
        int(nlp_result.get("credibility_score", 0)),
    )

    return EnrichedReportResponse(
        report_id=report_id,
        timestamp=timestamp,
        lat=body.lat,
        lng=body.lng,
        incident_type=body.incident_type,
        source=body.source,
        # NLP fields
        sentiment=nlp_result.get("sentiment", "neutral"),
        sentiment_score=float(nlp_result.get("sentiment_score", 0.0)),
        distress_level=nlp_result.get("distress_level", "LOW"),
        emotion=nlp_result.get("emotion", "neutral"),
        emotion_confidence=float(nlp_result.get("emotion_confidence", 0.0)),
        emotion_all_scores=nlp_result.get("emotion_all_scores", {}),
        emergency_level=nlp_result.get("emergency_level", "NORMAL"),
        is_emergency=bool(nlp_result.get("is_emergency", False)),
        matched_keywords=nlp_result.get("matched_keywords", []),
        severity=float(nlp_result.get("severity", 1.0)),
        credibility_score=int(nlp_result.get("credibility_score", 50)),
        credibility_label=nlp_result.get("credibility_label", "SUSPICIOUS"),
        credibility_flags=nlp_result.get("credibility_flags", []),
        entities=nlp_result.get("entities", {}),
        duplicate_score=float(nlp_result.get("duplicate_score", 0.0)),
        is_duplicate=bool(nlp_result.get("is_duplicate", False)),
        duplicate_matched_index=nlp_result.get("duplicate_matched_index"),
        auto_response=nlp_result.get("auto_response", ""),
        recommended_actions=nlp_result.get("recommended_actions", []),
        word_count=int(nlp_result.get("word_count", 0)),
        processing_ms=float(nlp_result.get("processing_ms", 0.0)),
        loader_status=nlp_result.get("loader_status", "unknown"),
    )


# ── POST /reports/analyze  [INTERNAL — testing only] ─────────────────────────

@router.post(
    "/analyze",
    response_model=ReportAnalysisResponse,
    summary="[INTERNAL] NLP-only analysis (no storage)",
    description=(
        "Runs NLP on text without storing the result. "
        "Use POST /reports for the production flow."
    ),
    tags=["Incident Reports", "Internal"],
)
async def analyze_incident_report(
    req: NlpOnlyRequest,
    request: Request,
) -> ReportAnalysisResponse:
    if not req.text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Report text must not be blank.",
        )

    logger.info("NLP-only analyze: report_id=%s chars=%d", req.report_id, len(req.text))

    nlp_bundle = request.app.state.models.get("nlp")
    if nlp_bundle is None:
        raise HTTPException(status_code=503, detail="NLP model not loaded yet.")

    try:
        result = analyze_report(req.text, bundle=nlp_bundle)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:
        logger.error("NLP analysis failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"NLP analysis failed: {exc}")

    logger.info(
        "NLP result: id=%s sentiment=%s severity=%.2f emergency=%s loader=%s",
        req.report_id,
        result.get("sentiment"),
        float(result.get("severity", 0)),
        result.get("emergency_level"),
        result.get("loader_status"),
    )

    return ReportAnalysisResponse(
        report_id=req.report_id,
        sentiment=result.get("sentiment", "neutral"),
        sentiment_score=float(result.get("sentiment_score", 0.0)),
        distress_level=result.get("distress_level", "LOW"),
        emotion=result.get("emotion", "neutral"),
        emotion_confidence=float(result.get("emotion_confidence", 0.0)),
        emotion_all_scores=result.get("emotion_all_scores", {}),
        emergency_level=result.get("emergency_level", "NORMAL"),
        is_emergency=bool(result.get("is_emergency", False)),
        matched_keywords=result.get("matched_keywords", []),
        severity=float(result.get("severity", 1.0)),
        credibility_score=int(result.get("credibility_score", 0)),
        credibility_label=result.get("credibility_label", "UNKNOWN"),
        credibility_flags=result.get("credibility_flags", []),
        entities=result.get("entities", {}),
        duplicate_score=float(result.get("duplicate_score", 0.0)),
        is_duplicate=bool(result.get("is_duplicate", False)),
        duplicate_matched_index=result.get("duplicate_matched_index"),
        auto_response=result.get("auto_response", ""),
        recommended_actions=result.get("recommended_actions", []),
        word_count=int(result.get("word_count", 0)),
        processing_ms=float(result.get("processing_ms", 0.0)),
        loader_status=result.get("loader_status", "unknown"),
    )
