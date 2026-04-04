"""
backend_python/models/danger_models.py
========================================
Pydantic v2 request and response models for the danger-score endpoints.

  POST /api/v1/predict-danger  →  DangerPredictRequest / DangerPredictResponse
  GET  /api/v1/danger-score    →  DangerScoreResponse
"""

from __future__ import annotations

from typing import Annotated, Any, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


# ── Feature vector type alias ─────────────────────────────────────────────────
# Each feature vector is a row of floats:
#   [hour(0–23), day_of_week(0–6), crime_count, crowd_density, lighting_score, report_density]
FeatureRow = list[float]


# ── Request ───────────────────────────────────────────────────────────────────

class DangerPredictRequest(BaseModel):
    """
    Request body for POST /api/v1/predict-danger.

    *historical_features* must contain **at least 24** feature rows —
    one per hour — matching the LSTM's sequence length.  Extra rows are
    silently truncated to the last 24.
    """

    location_id: str = Field(
        ...,
        min_length=1,
        max_length=128,
        examples=["zone_42"],
        description="Unique identifier for the zone or intersection",
    )
    date_hour: Optional[str] = Field(
        default=None,
        examples=["2024-01-15T22:00"],
        description="ISO-8601 datetime string for the forecast anchor (optional)",
    )
    historical_features: Annotated[
        list[FeatureRow],
        Field(
            ...,
            min_length=24,
            description=(
                "24+ rows of feature vectors: "
                "[hour, day_of_week, crime_count, crowd_density, lighting_score, report_density]"
            ),
        ),
    ]

    @field_validator("historical_features")
    @classmethod
    def validate_feature_rows(cls, rows: list[FeatureRow]) -> list[FeatureRow]:
        """Each row must have at least 2 numeric elements."""
        for i, row in enumerate(rows):
            if not isinstance(row, list) or len(row) < 2:
                raise ValueError(
                    f"Row {i} must be a list of at least 2 floats; got {row!r}"
                )
            for j, val in enumerate(row):
                if not isinstance(val, (int, float)):
                    raise ValueError(
                        f"Row {i}, element {j} must be numeric; got {type(val).__name__}"
                    )
        return rows

    model_config = {"json_schema_extra": {
        "example": {
            "location_id": "zone_42",
            "historical_features": [
                [h, 2, 2.0, 0.4, 0.6, 0.3] for h in range(24)
            ],
        }
    }}


# ── Responses ─────────────────────────────────────────────────────────────────

class DangerPredictResponse(BaseModel):
    """
    Response for POST /api/v1/predict-danger.

    *predictions* and *uncertainty* each have one entry per forecast hour
    (24 floats).  All values are in [0.0, 1.0].
    """

    location_id: str
    predictions: list[float] = Field(
        ...,
        description="Predicted danger score per hour (0.0 = safe, 1.0 = critical)",
    )
    uncertainty: list[float] = Field(
        ...,
        description="MC Dropout std-dev per hour — higher means less confident",
    )
    peak_danger_hour: int = Field(
        ...,
        ge=0,
        le=23,
        description="Hour index (0–23) with the highest predicted danger",
    )
    average_danger: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Mean predicted danger over all forecast hours",
    )
    timestamp: str = Field(..., description="UTC ISO-8601 timestamp of the prediction")

    @model_validator(mode="after")
    def check_list_lengths(self) -> DangerPredictResponse:
        if len(self.predictions) != len(self.uncertainty):
            raise ValueError(
                "predictions and uncertainty lists must have the same length"
            )
        return self


class ComponentScores(BaseModel):
    """Individual module contributions bundled inside DangerScoreResponse."""

    lstm: Optional[dict[str, Any]] = Field(
        default=None,
        description="LSTM score + uncertainty + peak_hour",
    )
    cv: Optional[dict[str, Any]] = Field(
        default=None,
        description="CV density_score + person_count + anomalies_detected",
    )
    anomaly: Optional[dict[str, Any]] = Field(
        default=None,
        description="Anomaly score + method used",
    )
    graph: Optional[dict[str, Any]] = Field(
        default=None,
        description="Historical graph-based danger score",
    )


class DangerScoreResponse(BaseModel):
    """
    Response for GET /api/v1/danger-score?lat=&lng=

    The aggregated danger score combining all AI modules.
    """

    location_id: str
    lat: float
    lng: float
    danger_score: float = Field(..., ge=0.0, le=1.0)
    danger_level: str = Field(
        ...,
        pattern=r"^(safe|moderate|unsafe|critical)$",
        description="Human-readable danger level",
    )
    component_scores: ComponentScores
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Prediction confidence (1.0 - LSTM uncertainty)",
    )
    recommendation: str
    weights_used: dict[str, float] = Field(
        ...,
        description="Weights applied to each component during aggregation",
    )
