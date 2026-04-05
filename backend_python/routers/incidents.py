import logging
from fastapi import APIRouter, HTTPException, Query
from typing import List
import utils.tigergraph as tg

router = APIRouter(prefix="/incidents", tags=["Incidents"])
logger = logging.getLogger(__name__)

# In-memory store for user-submitted incidents (added at runtime via POST /report)
_runtime_incidents: List[dict] = []


@router.get("/", summary="Get all incident reports (optionally filtered by verified)")
async def get_incidents(verified: bool = Query(default=False, description="Return only verified incidents")):
    try:
        logger.info("Fetching incidents from TigerGraph (verified_only=%s)", verified)
        incidents = await tg.get_all_incidents(verified_only=verified)
        # Tack on runtime-submitted incidents (from the current session)
        incidents += [i for i in _runtime_incidents if not verified or i.get("verified")]
        logger.info("Returning %s incidents", len(incidents))
        return incidents
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch incidents: {str(e)}")


def add_runtime_incident(incident: dict):
    """Called by the /report endpoint to add user-submitted incidents to the live feed."""
    _runtime_incidents.append(incident)

