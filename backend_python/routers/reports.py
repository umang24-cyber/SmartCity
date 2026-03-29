"""
backend_python/routers/reports.py
===================================
POST /reports/analyze

Accepts a free-form incident report string and returns the full NLP
analysis (sentiment, emotion, severity, credibility, entities, etc.)
produced by nlp_service → ai/nlp/inference.py.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from services.nlp_service import analyze_report

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reports", tags=["Incident Reports"])


# ── Request / Response models ─────────────────────────────────────────────────

class ReportRequest(BaseModel):
    text: str = Field(
        ...,
        min_length=5,
        max_length=5000,
        description="Raw incident report text submitted by the user.",
    )
    report_id: str | None = Field(
        default=None,
        description="Optional client-side report ID for tracking.",
    )
    zone_id: str | None = Field(
        default=None,
        description="Zone where the incident occurred (used for duplicate detection context).",
    )


class EntityResult(BaseModel):
    time: list[str]
    location: list[str]
    people: list[str]
    clothing: list[str]
    vehicles: list[str]
    physical_description: list[str]


class ReportAnalysisResponse(BaseModel):
    report_id: str | None
    # Sentiment
    sentiment: str
    sentiment_score: float
    # Emotion
    distress_level: str
    emotion: str
    emotion_confidence: float
    emotion_all_scores: dict[str, float]
    # Emergency
    emergency_level: str               # "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    is_emergency: bool
    matched_keywords: list[str]
    # Severity + credibility
    severity: float                    # 1.0 – 5.0
    credibility_score: int             # 0 – 100
    credibility_label: str
    credibility_flags: list[str]
    # Entities
    entities: dict[str, list[str]]
    # Deduplication
    duplicate_score: float
    is_duplicate: bool
    duplicate_matched_index: int | None
    # Response
    auto_response: str
    recommended_actions: list[str]
    # Meta
    word_count: int
    processing_ms: float
    loader_status: str


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post(
    "/analyze",
    response_model=ReportAnalysisResponse,
    summary="Analyze an incident report with NLP",
    description=(
        "Runs the full NLP pipeline (DistilBERT sentiment + RoBERTa emotion + "
        "spaCy NER) on the submitted text. Returns severity, credibility, "
        "extracted entities, and an auto-generated response message."
    ),
)
async def analyze_incident_report(req: ReportRequest) -> ReportAnalysisResponse:
    if not req.text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Report text must not be blank.",
        )

    try:
        result = analyze_report(req.text)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error("NLP analysis failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"NLP analysis failed: {exc}",
        )

    return ReportAnalysisResponse(
        report_id=req.report_id,
        sentiment=result.get("sentiment", "neutral"),
        sentiment_score=float(result.get("sentiment_score", 0.0)),
        distress_level=result.get("distress_level", "LOW"),
        emotion=result.get("emotion", "neutral"),
        emotion_confidence=float(result.get("emotion_confidence", 0.0)),
        emotion_all_scores=result.get("emotion_all_scores", {}),
        emergency_level=result.get("emergency_level", "LOW"),
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
