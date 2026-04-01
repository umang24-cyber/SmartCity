import os
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from middleware.auth import require_role
from custom_db.mock_db import get_mock_incidents, MOCK_INTERSECTIONS, get_all_mock_zones

router = APIRouter(prefix="/patrol", tags=["Officer"])

DATA_SOURCE = os.getenv("DATA_SOURCE", "mock")

@router.get("/assignments")
async def get_patrol_assignments(current_user: dict = Depends(require_role(["officer"]))):
    return [
        {
            "zone_id": "CL_01",
            "cluster_name": "MG Road Corridor",
            "priority": "HIGH",
            "reason": "Multiple unverified high-severity incidents",
            "intersections_to_check": ["INT_001", "INT_002"],
            "start_time": "22:00",
            "end_time": "02:00"
        },
        {
            "zone_id": "CL_02",
            "cluster_name": "Cubbon Park Edge",
            "priority": "MED",
            "reason": "High isolation score + broken lighting",
            "intersections_to_check": ["INT_003"],
            "start_time": "00:00",
            "end_time": "04:00"
        }
    ]

@router.get("/active-incidents")
async def get_active_incidents(current_user: dict = Depends(require_role(["officer"]))):
    # Only verified:false AND severity >= 3 (high, critical)
    # Severity values could be int or string.
    # In my seeded mock db, severity="high" or "critical". 
    all_incidents = get_mock_incidents(limit=100)
    officer_view = []
    
    severity_map = {
        "low": 1,
        "medium": 2,
        "high": 4,
        "critical": 5
    }

    for inc in all_incidents:
        if not inc.get("verified"):
            sev = inc.get("severity", 1)
            sev_num = severity_map.get(sev.lower(), 1) if isinstance(sev, str) else sev
            if sev_num >= 3:
                officer_view.append({
                    "incident_id": inc.get("incident_id"),
                    "incident_type": inc.get("incident_type"),
                    "severity": sev_num, # Map it to int
                    "lat": inc.get("lat"),
                    "lng": inc.get("lng"),
                    "reported_at": inc.get("timestamp"),
                    "intersection_name": inc.get("location_id"),
                    "distance_from_base_m": 1200 # Dummy
                })
    return sorted(officer_view, key=lambda x: x["severity"], reverse=True)


class RespondRequest(BaseModel):
    action: str
    officer_note: str = ""

@router.patch("/incidents/{incident_id}/respond")
async def respond_incident(incident_id: str, payload: RespondRequest, current_user: dict = Depends(require_role(["officer"]))):
    all_incidents = get_mock_incidents(limit=100)
    for inc in all_incidents:
        if inc.get("incident_id") == incident_id:
            # Append interaction
            if "status_update" not in inc:
                inc["status_update"] = []
            inc["status_update"].append(f"Officer Response - {payload.action}: {payload.officer_note}")
            return {"success": True, "incident_id": incident_id, "action": payload.action}
    
    raise HTTPException(status_code=404, detail="Incident not found")


@router.get("/safe-zones")
async def get_patrol_safe_zones(current_user: dict = Depends(require_role(["officer"]))):
    # Same as citizen but includes capacity/occupancy
    return [
        {
            "name": "MG Road Metro Station",
            "type": "safe_haven",
            "lat": 12.9754,
            "lng": 77.5985,
            "is_open_now": True,
            "closing_time": "23:00",
            "capacity": 200,
            "current_occupancy": 45,
            "contact_number": "+91 80 2296 6608"
        },
        {
            "name": "Cubbon Park Police Station",
            "type": "police_station",
            "lat": 12.9760,
            "lng": 77.5940,
            "is_open_now": True,
            "closing_time": "24:00",
            "capacity": 50,
            "current_occupancy": 12,
            "contact_number": "+91 80 2294 2195"
        }
    ]
