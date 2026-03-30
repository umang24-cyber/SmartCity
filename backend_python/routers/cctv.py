"""
backend_python/routers/cctv.py
================================
POST /cctv/analyze

Accepts a JPEG/PNG frame as base64-encoded string or raw multipart bytes,
runs it through the CV service, and returns crowd + anomaly analysis.
"""

from __future__ import annotations

import base64
import binascii
import logging

from fastapi import APIRouter, File, HTTPException, UploadFile, status,Request
from pydantic import BaseModel, Field

from services.cv_service import analyze_frame, reset_pipeline

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/cctv", tags=["CCTV Analysis"])


# ── Request / Response models ─────────────────────────────────────────────────

class CCTVBase64Request(BaseModel):
    """For JSON-based clients that send the frame as a base64 string."""
    image_b64: str = Field(..., description="Base64-encoded JPEG/PNG image bytes.")
    camera_id: str | None = Field(default=None, description="Optional camera identifier.")


class CCTVResponse(BaseModel):
    camera_id: str | None
    people_count: int
    crowd_density: str        # "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    anomaly_detected: bool
    anomalies: list[dict]
    safety_score: int         # 0–100, higher = safer
    danger_contribution: float  # [0.0, 1.0]
    danger_level: str         # "safe" | "moderate" | "unsafe" | "critical"
    confidence: float
    inference_ms: float
    loader_status: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/analyze",
    response_model=CCTVResponse,
    summary="Analyze a CCTV frame (multipart upload)",
    description="Accepts a raw image file upload. Returns crowd density, person count, and anomaly flags.",
)
async def analyze_cctv_upload(
    file: UploadFile = File(...),
    camera_id: str | None = None,
    request: Request = None
) -> CCTVResponse:
    """Accepts raw image bytes via multipart/form-data upload."""
    try:
        image_bytes = await file.read()
        if not image_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty.",
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to read uploaded CCTV file: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not read uploaded file: {exc}",
        )
    cv_bundle = request.app.state.models["cv"]
    return _run_analysis(image_bytes, camera_id, cv_bundle)


@router.post(
    "/analyze-b64",
    response_model=CCTVResponse,
    summary="Analyze a CCTV frame (base64 JSON)",
    description="Accepts a base64-encoded image in a JSON body. Useful for WebSocket/REST clients.",
)
async def analyze_cctv_base64(req: CCTVBase64Request, request: Request = None) -> CCTVResponse:
    """Accepts base64-encoded image bytes in a JSON body."""
    try:
        image_bytes = base64.b64decode(req.image_b64)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid base64 image data: {exc}",
        )
    cv_bundle = request.app.state.models["cv"]
    return _run_analysis(image_bytes, req.camera_id, cv_bundle)


@router.post(
    "/reset",
    summary="Reset CV pipeline state",
    description="Clears the pipeline's internal anomaly history and frame buffer. Call between camera sessions.",
)
async def reset_cctv_pipeline() -> dict:
    try:
        reset_pipeline()
    except Exception as exc:
        logger.error("CV pipeline reset failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pipeline reset failed: {exc}",
        )
    return {"status": "ok", "message": "CV pipeline state reset successfully."}


# ── Internal helper ───────────────────────────────────────────────────────────

def _run_analysis(image_bytes: bytes, camera_id: str | None, cv_bundle) -> CCTVResponse:
    try:
        result = analyze_frame(image_bytes, cv_bundle)
    except Exception as exc:
        logger.error("CV analyze_frame raised: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"CV analysis failed: {exc}",
        )

    return CCTVResponse(
        camera_id=camera_id,
        people_count=result["person_count"],
        crowd_density=result["crowd_density"],
        anomaly_detected=result["anomaly_detected"],
        anomalies=result["anomalies"],
        safety_score=result["safety_score"],
        danger_contribution=result["danger_score"],
        danger_level=result["danger_level"],
        confidence=result["confidence"],
        inference_ms=result["inference_ms"],
        loader_status=result["loader_status"],
    )
