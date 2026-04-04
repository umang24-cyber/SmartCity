"""
backend_python/routers/anomaly.py
===================================
POST /anomaly/detect

Accepts a flat list of recent numeric readings (e.g. incident counts per hour)
and returns a z-score anomaly detection result via the anomaly service.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status ,Request
from pydantic import BaseModel, Field, field_validator

from services.anomaly_service import detect_anomaly

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/anomaly", tags=["Anomaly Detection"])


# ── Request / Response models ─────────────────────────────────────────────────

class AnomalyRequest(BaseModel):
    zone_id: str = Field(
        default="UNKNOWN",
        description="Zone or intersection identifier for labelling the result.",
    )
    values: list[float] = Field(
        ...,
        min_length=3,
        description=(
            "Time-series of recent numeric readings (e.g. incident counts per hour). "
            "Minimum 3 values required for z-score computation. "
            "Recommended: 24 values (one per hour)."
        ),
    )

    @field_validator("values")
    @classmethod
    def validate_values(cls, v: list[float]) -> list[float]:
        if len(v) < 3:
            raise ValueError("At least 3 values are required for anomaly detection.")
        if any(val < 0 for val in v):
            raise ValueError("All values must be non-negative.")
        return v


class AnomalyDetailsModel(BaseModel):
    incident_zscore: float | None = None
    crowd_zscore: float | None = None
    incident_mean: float | None = None
    incident_std: float | None = None
    threshold_used: float | None = None
    window_size: int | None = None
    reason: str | None = None


class AnomalyResponse(BaseModel):
    zone_id: str
    anomaly_score: float = Field(..., description="Normalized anomaly intensity [0.0–1.0]")
    anomaly_detected: bool
    anomaly_type: str | None = Field(
        default=None,
        description="'incident_spike' | 'crowd_surge' | 'combined' | None",
    )
    zscore: float | None = Field(
        default=None,
        description="Z-score of the most anomalous reading.",
    )
    method: str = Field(..., description="'zscore' or 'model'")
    details: dict
    loader_status: str


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post(
    "/detect",
    response_model=AnomalyResponse,
    summary="Detect anomaly in a time-series of zone readings",
    description=(
        "Uses z-score statistical analysis (or a trained model if available) to "
        "identify unusual spikes in incident counts or crowd density. "
        "Returns a normalized anomaly_score in [0.0, 1.0]."
    ),
)
async def detect_zone_anomaly(req: AnomalyRequest, request: Request) -> AnomalyResponse:
    logger.info(
        "Anomaly request zone=%s values_len=%d",
        req.zone_id,
        len(req.values),
    )
    models = request.app.state.models
    anomaly_bundle = models["anomaly"]
    try:
        result = detect_anomaly(zone_id=req.zone_id, values=req.values, bundle=anomaly_bundle)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error("Anomaly detection failed for zone %s: %s", req.zone_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Anomaly detection failed: {exc}",
        )

    response = AnomalyResponse(
        zone_id=result["zone_id"],
        anomaly_score=float(result["anomaly_score"]),
        anomaly_detected=bool(result["is_anomaly"]),
        anomaly_type=result.get("anomaly_type"),
        zscore=result.get("zscore"),
        method=result["method"],
        details=result.get("details", {}),
        loader_status=result.get("loader_status", "unknown"),
    )
    logger.info(
        "Anomaly response zone=%s detected=%s score=%.4f method=%s",
        response.zone_id,
        response.anomaly_detected,
        response.anomaly_score,
        response.method,
    )
    return response
