import os
from fastapi import APIRouter, HTTPException, Query
from typing import List
from custom_db.mock_db import MOCK_INCIDENTS
import utils.tigergraph as tg

router = APIRouter(prefix="/incidents", tags=["Incidents"])

DATA_SOURCE = os.getenv("DATA_SOURCE", "mock")

# In-memory store for user-submitted incidents (augments mock data in mock mode)
_runtime_incidents: List[dict] = []


@router.get("/", summary="Get all incident reports (optionally filtered by verified)")
async def get_incidents(verified: bool = Query(default=False, description="Return only verified incidents")):
    try:
        if DATA_SOURCE == "tigergraph":
            incidents = await tg.get_all_incidents(verified_only=verified)
        else:
            base = MOCK_INCIDENTS + _runtime_incidents
            incidents = [i for i in base if i["verified"]] if verified else base

        return incidents

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch incidents: {str(e)}")


def add_runtime_incident(incident: dict):
    """Called by the /report endpoint to add user-submitted incidents to the live feed."""
    _runtime_incidents.append(incident)
