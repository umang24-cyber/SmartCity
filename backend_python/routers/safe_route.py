import os
from fastapi import APIRouter, HTTPException, Query
from data.mock_data import MOCK_SAFE_ROUTE, get_current_time_slice
import utils.tigergraph as tg

router = APIRouter()

DATA_SOURCE = os.getenv("DATA_SOURCE", "mock")


@router.get("/", summary="Get safe route between two intersections")
async def get_safe_route(
    start: str = Query(default="INT_001", description="Start intersection ID"),
    end: str = Query(default="INT_005", description="End intersection ID"),
):
    try:
        if DATA_SOURCE == "tigergraph":
            route_data = await tg.get_safe_route(start, end)
        else:
            time_slice = get_current_time_slice()
            hour = time_slice["ts_hour"]
            is_night = hour >= 20 or hour <= 5

            route_data = {
                **MOCK_SAFE_ROUTE,
                "reason": (
                    [
                        "3 functional streetlights (avg 85 lux) along this corridor",
                        "CCTV at INT_001 — 90% effective at this hour",
                        "Avoids Cubbon Park North Gate (isolation 0.78)",
                        "Emergency button at INT_004 is functional",
                        "No verified incidents in last 48h on this path",
                    ]
                    if is_night
                    else MOCK_SAFE_ROUTE["reason"]
                ),
            }

        return route_data

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch safe route: {str(e)}")
