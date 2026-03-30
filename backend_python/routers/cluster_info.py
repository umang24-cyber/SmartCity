# backend_python/routers/cluster_info.py
"""
Clustering endpoint — groups incident reports and danger zones into clusters
for map visualization. Uses spatial clustering.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import math

router = APIRouter(prefix="/cluster-info", tags=["Clusters"])


@router.get("/")
async def get_clusters(
    min_cluster_size: int = Query(2, description="Minimum incidents to form a cluster"),
    radius_km: float = Query(0.5, description="Clustering radius in km"),
    hours: int = Query(24, description="Lookback window in hours")
):
    """
    Returns spatially clustered danger zones for map visualization.

    Each cluster contains:
    - center (lat, lng)
    - radius
    - incident_count
    - avg_danger_score
    - dominant_severity

    MapLibre-ready: render as circles with radius proportional to incident_count.
    """
    try:
        from services.clustering_service import compute_clusters
        clusters = await compute_clusters(
            min_size=min_cluster_size,
            radius_km=radius_km,
            hours=hours
        )
        return {
            "clusters": clusters,
            "total": len(clusters),
            "params": {
                "min_cluster_size": min_cluster_size,
                "radius_km": radius_km,
                "hours": hours
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/geojson")
async def get_clusters_geojson(
    min_cluster_size: int = Query(2),
    radius_km: float = Query(0.5)
):
    """
    Same as /clusters but returns GeoJSON FeatureCollection.
    Direct input to MapLibre addSource().
    """
    try:
        from services.clustering_service import compute_clusters
        clusters = await compute_clusters(min_size=min_cluster_size, radius_km=radius_km)

        features = [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [c["center_lng"], c["center_lat"]]  # GeoJSON: lng first
                },
                "properties": {
                    "cluster_id": c["cluster_id"],
                    "incident_count": c["incident_count"],
                    "avg_danger_score": c["avg_danger_score"],
                    "danger_level": c["danger_level"],
                    "dominant_severity": c["dominant_severity"],
                    "radius_m": c.get("radius_m", 500)
                }
            }
            for c in clusters
        ]

        return {
            "type": "FeatureCollection",
            "features": features
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
