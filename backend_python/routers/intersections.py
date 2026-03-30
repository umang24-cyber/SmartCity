from fastapi import APIRouter, HTTPException, Query
from typing import Optional

router = APIRouter(prefix="/intersections", tags=["Intersections"])

@router.get("/")
async def get_intersections(
    lat: Optional[float] = Query(None, description="Center latitude"),
    lng: Optional[float] = Query(None, description="Center longitude"),
    radius_km: float = Query(2.0, description="Search radius in km"),
    limit: int = Query(50, description="Max intersections to return")
):
    """
    Returns intersections with danger scores for map overlay.
    Each intersection includes lat/lng and a danger_score for heatmap/marker rendering.
    """
    from db.tigergraph_client import get_client
    from db.mock_db import get_heatmap_data # using heatmap data as intersections for now

    try:
        # Instead of get_mock_intersections which isn't defined in the prompt's db.mock_db,
        # we'll use the heatmap data which returns all zones/intersections
        intersections = get_heatmap_data()
        
        # Simple local filtering if lat/lng is provided
        if lat is not None and lng is not None:
             import math
             def _dist(p1, p2):
                 R = 6371
                 dlat = math.radians(p2[0] - p1[0])
                 dlon = math.radians(p2[1] - p1[1])
                 a = (math.sin(dlat / 2) * math.sin(dlat / 2) + 
                      math.cos(math.radians(p1[0])) * math.cos(math.radians(p2[0])) * 
                      math.sin(dlon / 2) * math.sin(dlon / 2))
                 c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
                 return R * c
                 
             intersections = [i for i in intersections if _dist((lat, lng), (i["lat"], i["lng"])) <= radius_km]
             
        # Sort by danger and limit
        intersections = sorted(intersections, key=lambda x: x["danger_score"], reverse=True)[:limit]

        return {
            "intersections": intersections,
            "total": len(intersections),
            "center": {"lat": lat, "lng": lng} if lat and lng else None,
            "radius_km": radius_km
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
