"""
backend_python/models/graph_models.py
========================================
Pydantic v2 models for TigerGraph-facing endpoints.

  GET /api/v1/graph/heatmap          → list[HeatmapPoint]
  GET /api/v1/graph/zone-summary/{zone_id} → ZoneSummaryResponse
"""

from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field


class HeatmapPoint(BaseModel):
    """
    A single data point for the frontend MapLibre heatmap layer.

    *weight* in [0, 1] controls heat intensity — derived from danger_score.
    """

    zone_id: str
    lat: float = Field(..., ge=-90.0, le=90.0)
    lng: float = Field(..., ge=-180.0, le=180.0)
    danger_score: float = Field(..., ge=0.0, le=1.0)
    weight: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Heatmap intensity weight (same as danger_score, kept separate for clarity)",
    )


class ZoneSummaryResponse(BaseModel):
    """
    Full zone detail returned by GET /api/v1/graph/zone-summary/{zone_id}.

    Aggregates zone vertex attributes, recent incidents, connected cameras,
    and the latest composite danger score.
    """

    zone_id: str
    name: Optional[str] = None
    lat: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    lng: Optional[float] = Field(default=None, ge=-180.0, le=180.0)

    danger_score: float = Field(..., ge=0.0, le=1.0)
    historical_danger_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    danger_level: str = Field(
        ...,
        pattern=r"^(safe|moderate|unsafe|critical)$",
    )
    incident_count_24h: int = Field(..., ge=0)
    recent_incidents: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Up to 5 most recent incidents linked to this zone",
    )
    connected_cameras: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Cameras with active feeds in this zone",
    )
    recommendations: list[str] = Field(
        default_factory=list,
        description="Safety improvement recommendations for this zone",
    )


class AnomalyDetectRequest(BaseModel):
    """
    Request body for POST /api/v1/detect-anomaly.
    """

    zone_id: str = Field(..., min_length=1, max_length=128)
    recent_data: list[dict[str, Any]] = Field(
        ...,
        min_length=1,
        description=(
            "List of hourly observation dicts, each with 'incident_count' and 'crowd' keys. "
            "Recommended length: 24 (past 24 hours)."
        ),
    )

    model_config = {"json_schema_extra": {
        "example": {
            "zone_id": "zone_42",
            "recent_data": [
                {"hour": h, "incident_count": 1, "crowd": 0.4}
                for h in range(24)
            ],
        }
    }}


class AnomalyDetectResponse(BaseModel):
    """
    Response for POST /api/v1/detect-anomaly.
    """

    zone_id: str
    anomaly_score: float = Field(..., ge=0.0, le=1.0)
    is_anomaly: bool
    anomaly_type: Optional[str] = Field(
        default=None,
        description="'incident_spike' | 'crowd_surge' | 'combined' | None",
    )
    zscore: Optional[float] = Field(
        default=None,
        description="Z-score of the most anomalous observation (statistical fallback mode)",
    )
    method: str = Field(
        ...,
        description="'model' (neural) or 'zscore' (statistical fallback)",
    )
    details: dict[str, Any] = Field(default_factory=dict)
