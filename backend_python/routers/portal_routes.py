"""
backend_python/routers/portal_routes.py
========================================
NEW additive router — provides:
  POST /api/v1/route/safe   → safe + shortest route between two lat/lng points
  POST /api/v1/user/sos     → log SOS alert and simulate emergency dispatch
  GET  /api/v1/admin/incidents → all incidents (mock or live)
  GET  /api/v1/admin/zones     → all zone danger scores
  GET  /api/v1/admin/stats     → aggregated dashboard stats

Does NOT modify any existing router file.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Portal"])


# ─── Pydantic models ───────────────────────────────────────────────────────────

class LatLng(BaseModel):
    lat: float = Field(..., description="Latitude")
    lng: float = Field(..., description="Longitude")


class SafeRouteRequest(BaseModel):
    source: LatLng
    destination: LatLng
    mode: str = Field(default="walking", description="walking | driving")


class SOSRequest(BaseModel):
    lat: float
    lng: float
    message: str = Field(default="Emergency SOS")
    contact: Optional[str] = None


# ─── POST /route/safe ──────────────────────────────────────────────────────────

@router.post("/route/safe", summary="Compute safest + shortest route")
async def safe_route_post(payload: SafeRouteRequest, request: Request):
    """
    Computes a safest route and shortest route between source and destination.
    Delegates to the existing route_service when available; falls back to
    a lightweight mock scorer.
    """
    try:
        from services.portal_service import compute_dual_routes
        result = await compute_dual_routes(
            start_lat=payload.source.lat,
            start_lng=payload.source.lng,
            end_lat=payload.destination.lat,
            end_lng=payload.destination.lng,
            models=getattr(getattr(request, "app", None), "state", None) and request.app.state.models or {},
            mode=payload.mode,
        )
        return result
    except Exception as exc:
        logger.error("safe_route_post failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# ─── POST /user/sos ────────────────────────────────────────────────────────────

@router.post("/user/sos", summary="Dispatch SOS alert")
async def user_sos(payload: SOSRequest):
    """
    Logs an SOS incident and simulates emergency dispatch.
    In production, this would push to TigerGraph + notify emergency services.
    """
    incident_id = f"SOS_{uuid.uuid4().hex[:8].upper()}"
    timestamp   = datetime.now(timezone.utc).isoformat()

    # Log to mock DB (additive — does not overwrite anything)
    try:
        from custom_db.mock_db import add_mock_incident
        add_mock_incident({
            "incident_id": incident_id,
            "text": payload.message,
            "severity": "critical",
            "severity_score": 0.95,
            "credibility": 1.0,
            "emotion": "fear",
            "timestamp": timestamp,
            "source": "sos_alert",
            "lat": payload.lat,
            "lng": payload.lng,
            "location_id": f"{payload.lat:.4f}_{payload.lng:.4f}",
            "verified": True,
        })
    except Exception as exc:
        logger.warning("SOS: could not persist to mock_db: %s", exc)

    # Simulate dispatch (console alert)
    logger.warning(
        "🚨 SOS ALERT [%s] at (%.5f, %.5f): %s",
        incident_id, payload.lat, payload.lng, payload.message
    )

    return {
        "status": "dispatched",
        "incident_id": incident_id,
        "timestamp": timestamp,
        "location": {"lat": payload.lat, "lng": payload.lng},
        "message": payload.message,
        "alert_simulated": True,
        "note": "Emergency services notified (simulated). Real integration requires push notification config.",
    }


# ─── GET /admin/incidents ──────────────────────────────────────────────────────

@router.get("/admin/incidents", summary="All incidents for admin view")
async def admin_incidents(limit: int = 50, severity: Optional[str] = None):
    """Returns all incidents from the mock store (or TigerGraph in production)."""
    try:
        from custom_db.mock_db import get_mock_incidents
        data = get_mock_incidents(severity=severity, limit=limit)
        return {"incidents": data, "count": len(data)}
    except Exception as exc:
        logger.error("admin_incidents failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# ─── GET /admin/zones ─────────────────────────────────────────────────────────

@router.get("/admin/zones", summary="All zone danger scores for admin view")
async def admin_zones():
    """Returns all city zones with their danger scores."""
    try:
        from custom_db.mock_db import get_all_mock_zones
        zones = get_all_mock_zones()
        return {"zones": zones, "count": len(zones)}
    except Exception as exc:
        logger.error("admin_zones failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))


# ─── GET /admin/stats ─────────────────────────────────────────────────────────

@router.get("/admin/stats", summary="Aggregated admin dashboard stats")
async def admin_stats():
    """Returns summary statistics for the admin dashboard."""
    try:
        from custom_db.mock_db import get_all_mock_zones, get_mock_incidents
        zones     = get_all_mock_zones()
        incidents = get_mock_incidents(limit=500)

        danger_scores = [z["danger_score"] for z in zones if "danger_score" in z]
        avg_danger    = round(sum(danger_scores) / len(danger_scores), 3) if danger_scores else 0.0
        critical      = sum(1 for s in danger_scores if s >= 0.75)

        severity_breakdown = {}
        for inc in incidents:
            sev = inc.get("severity", "unknown")
            severity_breakdown[sev] = severity_breakdown.get(sev, 0) + 1

        return {
            "total_incidents":   len(incidents),
            "total_zones":       len(zones),
            "critical_zones":    critical,
            "avg_danger_score":  avg_danger,
            "severity_breakdown": severity_breakdown,
        }
    except Exception as exc:
        logger.error("admin_stats failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
