import os
import uuid
from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from middleware.auth import require_role
from custom_db.mock_db import get_mock_incidents, add_mock_incident

router = APIRouter(prefix="/citizen", tags=["Citizen"])

DATA_SOURCE = os.getenv("DATA_SOURCE", "mock")

@router.get("/my-reports")
async def get_my_reports(current_user: dict = Depends(require_role(["user", "citizen"]))):
    # In mock mode, reports would need to track userId. Let's filter by userId in memory if existing.
    # The existing mock db doesn't have userId on seeded incidents.
    # Let's just return incidents that either belong to them or we just return a slice of existing incidents.
    # For now, let's filter by source="user_report" and try to find their id. 
    # To fully support this, in-memory reports need to store user_id. We'll simulate this.
    user_id = current_user["id"]
    all_incidents = get_mock_incidents(limit=100)
    # Return user's reports. If seed data doesn't have user_id, we can mock it by matching source or returning some.
    # For the sake of the demo, let's say INC_001 is theirs if they are u1.
    my_reports = []
    for inc in all_incidents:
        if inc.get("user_id") == user_id or (inc.get("incident_id") == "INC_001" and user_id == "u1"):
            my_reports.append(inc)
    return my_reports

@router.get("/sos-contacts")
async def get_sos_contacts(current_user: dict = Depends(require_role(["user", "citizen"]))):
    return {
        "emergency": "112",
        "women_helpline": "1091",
        "nearest_police_box": {
            "name": "Sector 17 Police Station",
            "lat": 30.7414,
            "lng": 76.7682,
            "distance_m": 350
        }
    }

@router.get("/safe-zones")
async def get_safe_zones(current_user: dict = Depends(require_role(["user", "citizen"]))):
    return [
        {
            "name": "Sector 17 Metro Bus Stand",
            "type": "safe_haven",
            "lat": 30.7403, "lng": 76.7714,
            "is_open_now": True, "closing_time": "23:00"
        },
        {
            "name": "Sector 17 Police Station",
            "type": "police_station",
            "lat": 30.7414, "lng": 76.7682,
            "is_open_now": True, "closing_time": "24:00"
        },
        {
            "name": "Government Multi Speciality Hospital Sector 16",
            "type": "hospital",
            "lat": 30.7456, "lng": 76.7670,
            "is_open_now": True, "closing_time": "24:00"
        },
        {
            "name": "PGI Chandigarh",
            "type": "hospital",
            "lat": 30.7643, "lng": 76.7760,
            "is_open_now": True, "closing_time": "24:00"
        },
        {
            "name": "Sector 22 Police Post",
            "type": "police_station",
            "lat": 30.7333, "lng": 76.7794,
            "is_open_now": True, "closing_time": "24:00"
        }
    ]

class SosAlert(BaseModel):
    lat: float
    lng: float
    message: str

@router.post("/sos-alert")
async def post_sos_alert(alert: SosAlert, current_user: dict = Depends(require_role(["user", "citizen"]))):
    alert_id = f"SOS_{uuid.uuid4().hex[:6].upper()}"
    new_so = {
        "incident_id": alert_id,
        "incident_type": "sos_alert",
        "severity": "critical",
        "severity_score": 1.0,
        "credibility": 1.0,
        "emotion": "fear",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "source": "sos_button",
        "location_id": "unknown",
        "lat": alert.lat,
        "lng": alert.lng,
        "verified": False,
        "user_id": current_user["id"],
        "message": alert.message
    }
    if DATA_SOURCE == "mock":
        add_mock_incident(new_so)
    else:
        # In Tigergraph mode this would hit the adapter
        pass
        
    return {
        "alert_id": alert_id, 
        "message": "Help is on the way"
    }
