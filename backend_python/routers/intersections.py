import os
from fastapi import APIRouter
from data.mock_data import MOCK_INTERSECTIONS
import utils.tigergraph as tg

router = APIRouter()

DATA_SOURCE = os.getenv("DATA_SOURCE", "mock")


@router.get("/", summary="Get all intersection coordinates (for Mapbox dots layer)")
async def get_intersections():
    """
    Returns all intersection coordinates for rendering dots on the map.
    Group B contract: [{ intersection_id, intersection_name, lat, lng, baseline_safety_score, cluster_id, isolation_score }]
    """
    try:
        if DATA_SOURCE == "tigergraph":
            raw = await tg.get_all_intersections()
            return [
                {
                    "intersection_id": i.get("intersection_id"),
                    "intersection_name": i.get("intersection_name"),
                    "lat": i.get("latitude"),
                    "lng": i.get("longitude"),
                    "baseline_safety_score": i.get("baseline_safety_score"),
                    "cluster_id": i.get("cluster_id"),
                    "isolation_score": i.get("isolation_score"),
                }
                for i in raw
            ]
        else:
            return [
                {
                    "intersection_id": i["intersection_id"],
                    "intersection_name": i["intersection_name"],
                    "lat": i["latitude"],
                    "lng": i["longitude"],
                    "baseline_safety_score": i["baseline_safety_score"],
                    "cluster_id": i["cluster_id"],
                    "isolation_score": i["isolation_score"],
                }
                for i in MOCK_INTERSECTIONS
            ]
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Failed to fetch intersections: {str(e)}")
