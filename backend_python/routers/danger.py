"""
backend_python/routers/danger.py
==================================
POST /danger-score

Aggregates LSTM + CV + anomaly + graph signals into a single zone danger
score. All heavy work is delegated to the services layer.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, status, Request
from pydantic import BaseModel, Field, field_validator

from services.danger_aggregator import aggregate_danger
from services.lstm_service import predict_danger
from utils.cache import TTLCache
from config import DANGER_SCORE_CACHE_TTL

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/danger", tags=["Danger Scoring"])

_cache = TTLCache(ttl=DANGER_SCORE_CACHE_TTL, namespace="danger")


# ── Request / Response models ─────────────────────────────────────────────────

class DangerRequest(BaseModel):
    location_id: str = Field(..., min_length=1, description="Zone or intersection ID, e.g. 'INT007'")
    lat: float = Field(..., ge=-90.0, le=90.0)
    lng: float = Field(..., ge=-180.0, le=180.0)
    # Optional history rows for LSTM (24 hourly dicts). Omit for aggregator-only mode.
    history: list[dict] | None = Field(
        default=None,
        description="24 hourly observation dicts required for LSTM component.",
    )
    # Optional flat time-series for z-score anomaly component
    zone_values: list[float] | None = Field(
        default=None,
        description="Recent numeric readings (incident counts) for anomaly detection.",
    )
    # Optional historical graph danger score
    graph_score: float | None = Field(
        default=None, ge=0.0, le=1.0,
        description="Pre-computed graph-based danger score [0.0–1.0].",
    )


class ComponentBreakdown(BaseModel):
    score: float | None
    weight: float
    status: str
    detail: dict[str, Any]


class DangerResponse(BaseModel):
    zone_id: str
    final_score: float = Field(..., description="Aggregated danger score [0.0–1.0]")
    danger_100: int = Field(..., description="Danger score scaled to 0–100")
    risk_level: str = Field(..., description="'safe' | 'moderate' | 'unsafe' | 'critical'")
    alert: bool
    recommendation: str
    breakdown: dict[str, ComponentBreakdown]
    computed_at: str
    cached: bool = False


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post(
    "/score",
    response_model=DangerResponse,
    summary="Aggregate danger score for a zone",
    description=(
        "Combines LSTM time-series forecast, CV crowd analysis, anomaly z-score, "
        "and optional graph density into a single [0.0–1.0] danger score."
    ),
)
async def get_danger_score(req: DangerRequest, request: Request):
    logger.info(
        "Danger request zone=%s has_history=%s history_len=%d zone_values_len=%d",
        req.location_id,
        bool(req.history),
        len(req.history or []),
        len(req.zone_values or []),
    )
    history_len = len(req.history or [])
    zone_values_len = len(req.zone_values or [])
    zone_tail = ",".join(f"{v:.2f}" for v in (req.zone_values or [])[-3:])
    graph_key = "none" if req.graph_score is None else f"{req.graph_score:.3f}"
    cache_key = (
        f"{req.location_id}:{req.lat:.4f}:{req.lng:.4f}"
        f":h{history_len}:z{zone_values_len}:zt{zone_tail}:g{graph_key}"
    )
    cached = _cache.get(cache_key)
    if cached is not None:
        logger.debug("Danger score cache hit: %s", req.location_id)
        cached["cached"] = True
        return DangerResponse(**cached)

    try:
        models = request.app.state.models
        lstm_bundle = models["lstm"]
        # ── LSTM component ────────────────────────────────────────────────
        lstm_result = None
        if req.history and len(req.history) >= 24:
            lstm_result = predict_danger(
                intersection_id=req.location_id,
                history=req.history,
                bundle=lstm_bundle
            )

        # ── Anomaly component ─────────────────────────────────────────────
        zone_history = None
        if req.zone_values and len(req.zone_values) >= 3:
            zone_history = [
                {"hour": i, "incident_count": float(v), "crowd": float(v) / 100.0}
                for i, v in enumerate(req.zone_values)
            ]

        # ── Aggregate ─────────────────────────────────────────────────────
        agg = aggregate_danger(
            zone_id=req.location_id,
            lstm_result=lstm_result,
            graph_score=req.graph_score,
            zone_history=zone_history,
        )

    except Exception as exc:
        logger.error("Danger aggregation failed for %s: %s", req.location_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Danger scoring failed: {exc}",
        )

    payload = {
        "zone_id":        agg["zone_id"],
        "final_score":    agg["danger_score"],
        "danger_100":     agg["danger_100"],
        "risk_level":     agg["danger_level"],
        "alert":          agg["alert"],
        "recommendation": agg["recommendation"],
        "breakdown":      agg["components"],
        "computed_at":    agg["computed_at"],
        "cached":         False,
    }

    _cache.set(cache_key, payload)
    logger.info(
        "Danger response zone=%s score=%.4f risk=%s alert=%s",
        payload["zone_id"],
        payload["final_score"],
        payload["risk_level"],
        payload["alert"],
    )
    return DangerResponse(**payload)
