import os
from fastapi import APIRouter
from custom_db.mock_db import IN_MEMORY_REPORTS

router = APIRouter(prefix="/dev", tags=["Dev"])

DATA_SOURCE = os.getenv("DATA_SOURCE", "mock")

@router.get("/reset-reports")
async def reset_reports():
    if DATA_SOURCE == "mock":
        IN_MEMORY_REPORTS.clear()
        return {"status": "success", "message": "In-memory reports cleared"}
    return {"status": "ignored", "message": "Not in mock mode"}
