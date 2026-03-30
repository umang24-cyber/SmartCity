# backend_python/routers/graph.py

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from services.graph_service import get_heatmap_data, get_zone_summary_data

router = APIRouter()


@router.get("/graph/heatmap")
async def get_heatmap():
    """
    Returns danger scores for ALL zones.
    Response is MapLibre heatmap-ready:
    [{"zone_id": str, "lat": float, "lng": float,
      "danger_score": float, "danger_level": str}]
    """
    try:
        data = await get_heatmap_data()
        
        # Add a danger_level string if not present
        from services.route_service import _score_to_level
        for z in data:
            if "danger_level" not in z and "danger_score" in z:
                z["danger_level"] = _score_to_level(z["danger_score"])
                
        return {"zones": data, "total": len(data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/graph/heatmap/geojson")
async def get_heatmap_geojson():
    """
    Returns heatmap data as GeoJSON FeatureCollection.
    Direct input to MapLibre map.addSource('heatmap', {type:'geojson', data: response})
    """
    try:
        data = await get_heatmap_data()
        from services.route_service import _score_to_level
        
        features = []
        for z in data:
            if "danger_level" not in z and "danger_score" in z:
                z["danger_level"] = _score_to_level(z["danger_score"])
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [z["lng"], z["lat"]]   # [lng, lat] — GeoJSON order
                },
                "properties": {
                    "zone_id": z["zone_id"],
                    "danger_score": z["danger_score"],
                    "danger_level": z.get("danger_level", "moderate")
                }
            })
            
        return {
            "type": "FeatureCollection",
            "features": features
        }
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))


@router.get("/graph/zone-summary/{zone_id}")
async def get_zone_summary(zone_id: str):
    """
    Returns full data for a zone: danger score, incident count,
    recent incidents, connected zones, camera data.
    """
    try:
        data = await get_zone_summary_data(zone_id)
        if not data:
            raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found")
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/graph/zones")
async def list_zones(
    min_danger: Optional[float] = Query(None, ge=0.0, le=1.0),
    max_danger: Optional[float] = Query(None, ge=0.0, le=1.0),
    limit: int = Query(100, le=500)
):
    """Lists all zones with optional danger score filtering."""
    data = await get_heatmap_data()
    from services.route_service import _score_to_level
    for z in data:
        if "danger_level" not in z and "danger_score" in z:
            z["danger_level"] = _score_to_level(z["danger_score"])
                
    if min_danger is not None:
        data = [z for z in data if z["danger_score"] >= min_danger]
    if max_danger is not None:
        data = [z for z in data if z["danger_score"] <= max_danger]
    return {"zones": data[:limit], "total": len(data)}
