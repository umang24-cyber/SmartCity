from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import math

router = APIRouter(prefix="/intersections", tags=["Intersections"])


def _dist(p1, p2):
    R = 6371
    dlat = math.radians(p2[0] - p1[0])
    dlon = math.radians(p2[1] - p1[1])
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(p1[0])) * math.cos(math.radians(p2[0])) *
         math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@router.get("/")
async def get_intersections(
    lat: Optional[float] = Query(None, description="Center latitude"),
    lng: Optional[float] = Query(None, description="Center longitude"),
    radius_km: float = Query(2.0, description="Search radius in km"),
    limit: int = Query(50, description="Max intersections to return")
):
    """
    Returns intersections with danger scores for map overlay.
    Pulls live data from TigerGraph (Intersection vertex type).
    """
    from services.graph_service import get_heatmap_data

    try:
        intersections = await get_heatmap_data()

        # Add intersection_name fallback
        for i in intersections:
            i.setdefault("intersection_name", i.get("zone_id", ""))
            # Map baseline_safety_score → danger_score if missing
            if "danger_score" not in i or i["danger_score"] == 0.0:
                bss = float(i.get("baseline_safety_score", 0.7))
                i["danger_score"] = round(1.0 - bss, 3)

        # Radius filter
        if lat is not None and lng is not None:
            intersections = [
                i for i in intersections
                if _dist((lat, lng), (i["lat"], i["lng"])) <= radius_km
            ]

        intersections = sorted(intersections, key=lambda x: x["danger_score"], reverse=True)[:limit]

        return {
            "intersections": intersections,
            "total": len(intersections),
            "center": {"lat": lat, "lng": lng} if lat and lng else None,
            "radius_km": radius_km
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
