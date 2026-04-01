import os
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from middleware.auth import require_role
from custom_db.mock_db import get_mock_incidents, MOCK_SAFETY_FEATURES, MOCK_INTERSECTIONS, get_all_mock_zones, update_incident_verification

router = APIRouter(tags=["Supervisor"])

DATA_SOURCE = os.getenv("DATA_SOURCE", "mock")


@router.get("/dashboard/overview")
async def get_dashboard_overview(current_user: dict = Depends(require_role(["supervisor"]))):
    all_incidents = get_mock_incidents(limit=1000)
    
    # Handle both string and int severity
    def _get_sev_val(s):
        if isinstance(s, int): return s
        mapping = {"low": 1, "medium": 2, "high": 4, "critical": 5}
        return mapping.get(s.lower(), 1) if isinstance(s, str) else 1

    high_severity_count = sum(1 for i in all_incidents if _get_sev_val(i.get("severity")) >= 4)
    unverified_count = sum(1 for i in all_incidents if not i.get("verified"))
    
    # Calculate average city safety from active zones
    zones = get_all_mock_zones()
    avg_city_safety = sum(100 - (z["danger_score"] * 100) for z in zones) / len(zones) if zones else 75.0
    
    # Mock incident types for charting
    types = [i.get("incident_type", "suspicious_activity") for i in all_incidents]
    poor_lighting = types.count("poor_lighting")
    felt_followed = types.count("felt_followed")
    broken_cctv = types.count("broken_cctv")
    suspicious_activity = types.count("suspicious_activity")

    return {
        "total_incidents_today": len(all_incidents),
        "high_severity_count": high_severity_count,
        "unverified_count": unverified_count,
        "avg_city_safety": round(avg_city_safety, 1),
        "clusters_at_risk": [
            {
                "cluster_id": "CL_01",
                "cluster_name": "MG Road Corridor",
                "avg_cluster_safety": 62.5,
                "trend": "down"
            },
            {
                "cluster_id": "CL_02",
                "cluster_name": "Indiranagar 100ft Road",
                "avg_cluster_safety": 68.0,
                "trend": "up"
            }
        ],
        "top_risk_intersections": MOCK_INTERSECTIONS[:3],
        "incidents_by_type": {
            "poor_lighting": poor_lighting if poor_lighting else 12,
            "felt_followed": felt_followed if felt_followed else 8,
            "broken_cctv": broken_cctv if broken_cctv else 4,
            "suspicious_activity": suspicious_activity if suspicious_activity else 15
        },
        "feature_failures": [f for f in MOCK_SAFETY_FEATURES if f["status"] == "inactive"]
    }

@router.get("/dashboard/trends")
async def get_dashboard_trends(current_user: dict = Depends(require_role(["supervisor"]))):
    return {
        "daily_incidents": [
            {"date": "2025-01-09", "count": 12, "avg_severity": 2.5},
            {"date": "2025-01-15", "count": 25, "avg_severity": 3.8}
        ],
        "safety_trend": [
            {"date": "2025-01-09", "avg_score": 75},
            {"date": "2025-01-15", "avg_score": 65}
        ],
        "peak_hours_chart": [{"hour": i, "incident_count": 5} for i in range(24)]
    }

class VerifyIncidentRequest(BaseModel):
    verified: bool
    note: str = ""

@router.patch("/incidents/{incident_id}/verify")
async def verify_incident(incident_id: str, payload: VerifyIncidentRequest, current_user: dict = Depends(require_role(["supervisor"]))):
    success = update_incident_verification(incident_id, payload.verified)
    if success:
        return {"success": True, "incident_id": incident_id, "verified": payload.verified}
    raise HTTPException(status_code=404, detail="Incident not found")

@router.get("/infrastructure/status")
async def get_infrastructure_status(current_user: dict = Depends(require_role(["supervisor"]))):
    return [
        {
            **f,
             "is_functional": f["status"] == "active",
             "reliability_score": 0.9 if f["status"] == "active" else 0.4,
             "maintenance_prediction": "14 days",
             "criticality_score": 0.8
        }
        for f in MOCK_SAFETY_FEATURES
    ]
