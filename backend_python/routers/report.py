import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from models import ReportRequest, ReportResponse
import utils.tigergraph as tg
from routers.incidents import add_runtime_incident

router = APIRouter()

DATA_SOURCE = os.getenv("DATA_SOURCE", "mock")

# Dev-only in-memory store (so /report/all works in mock mode)
_report_store: list = []


@router.post("/", response_model=ReportResponse, status_code=201, summary="Submit a new incident report")
async def post_report(body: ReportRequest):
    incident = {
        "incident_id": f"INC_{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        "incident_type": body.incident_type.value,
        "severity": body.severity,
        "reported_at": datetime.now(timezone.utc).isoformat(),
        "verified": False,
        "source": body.source,
        "lat": body.lat,
        "lng": body.lng,
    }

    try:
        if DATA_SOURCE == "tigergraph":
            await tg.create_incident(incident)
        else:
            # Store in memory and push to live incidents feed
            _report_store.append(incident)
            add_runtime_incident(incident)
            print(f"[Report received] {incident}")

        return ReportResponse(
            success=True,
            message="Incident reported successfully",
            incident_id=incident["incident_id"],
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save report: {str(e)}")


@router.get("/all", summary="Dev-only: view all in-memory reports")
async def get_all_reports():
    return _report_store
