"""
backend_python/models/cctv_models.py
======================================
Pydantic v2 models for CCTV analysis endpoints.

  POST /api/v1/analyze-cctv         (multipart)  → CCTVAnalysisResponse
  POST /api/v1/analyze-cctv-base64  (JSON)        → CCTVAnalysisResponse
"""

from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field


# ── Detection types ───────────────────────────────────────────────────────────

class YoloDetection(BaseModel):
    """A single object detected by YOLOv8."""

    class_id: int = Field(..., description="COCO class ID")
    class_name: str = Field(..., description="Human-readable class label")
    confidence: float = Field(..., ge=0.0, le=1.0)
    bbox: list[float] = Field(
        ...,
        min_length=4,
        max_length=4,
        description="Bounding box [x1, y1, x2, y2] in pixel coordinates",
    )


# ── Base64 request body ───────────────────────────────────────────────────────

class CCTVBase64Request(BaseModel):
    """
    Request body for POST /api/v1/analyze-cctv-base64.
    Useful when the frontend cannot send multipart/form-data.
    """

    camera_id: str = Field(..., min_length=1, max_length=64)
    location_id: Optional[str] = Field(default=None, max_length=128)
    image_b64: str = Field(
        ...,
        min_length=4,
        description="Base64-encoded JPEG or PNG image data (no data-URI prefix)",
    )

    model_config = {"json_schema_extra": {
        "example": {
            "camera_id": "cam_sector_7",
            "location_id": "zone_42",
            "image_b64": "<base64-encoded-image>",
        }
    }}


# ── Response ──────────────────────────────────────────────────────────────────

class CCTVAnalysisResponse(BaseModel):
    """
    Unified response for both CCTV analysis endpoints.

    *danger_contribution* is the CV module's contribution score (0.0–1.0)
    fed into the danger aggregator.
    """

    camera_id: str
    location_id: str
    person_count: int = Field(..., ge=0)
    crowd_density: str = Field(
        ...,
        pattern=r"^(low|medium|high)$",
        description="Crowd density category from MobileNetV2",
    )
    density_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Probability of 'high' density (from MobileNetV2 softmax)",
    )
    anomalies_detected: bool
    anomaly_details: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Non-person objects detected above anomaly confidence threshold",
    )
    yolo_detections: list[YoloDetection] = Field(
        default_factory=list,
        description="All YOLO detections in the frame",
    )
    danger_contribution: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="CV module's contribution to the aggregated danger score",
    )
