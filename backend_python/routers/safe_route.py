from fastapi import APIRouter, Request, HTTPException, Query
from typing import Optional
from services.route_service import compute_safe_route

# We don't have utils.cache in the snippet (might not exist), so we use a simple dict cache for safety or remove it.
_cache = {}

def get_cached(key):
    return _cache.get(key)
    
def set_cached(key, value, ttl=120):
    _cache[key] = value

router = APIRouter(prefix="/safe-route", tags=["Safe Route"])

@router.get("/")
async def get_safe_route(
    request: Request,
    start_lat: float = Query(..., description="Start latitude"),
    start_lng: float = Query(..., description="Start longitude"),
    end_lat: float = Query(..., description="End latitude"),
    end_lng: float = Query(..., description="End longitude"),
    mode: str = Query("walking", description="Travel mode: walking|driving")
):
    """
    Returns the safest route from start to end as GeoJSON.

    Response is MapLibre-ready:
    - `route`: GeoJSON Feature (LineString) for the full path
    - `segments`: GeoJSON FeatureCollection with per-segment danger colors
    - `stats`: Overall danger score, distance, estimated time
    """
    cache_key = f"route_{start_lat:.4f}_{start_lng:.4f}_{end_lat:.4f}_{end_lng:.4f}_{mode}"
    cached = get_cached(cache_key)
    if cached:
        return cached

    try:
        result = await compute_safe_route(
            start_lat=start_lat,
            start_lng=start_lng,
            end_lat=end_lat,
            end_lng=end_lng,
            models=request.app.state.models,
            mode=mode
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Route computation failed: {str(e)}")

    set_cached(cache_key, result, ttl=120)
    return result
