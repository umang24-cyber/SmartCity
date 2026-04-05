# backend_python/services/clustering_service.py
"""
Spatial clustering of incidents and danger zones.
Uses a simple grid-based approach for hackathon scope.
For production: replace with DBSCAN via scikit-learn.
"""

import math
import logging
from typing import List, Dict, Any
from custom_db.tigergraph_client import get_all_zones

logger = logging.getLogger(__name__)


SEVERITY_RANK = {"critical": 4, "high": 3, "medium": 2, "low": 1}


async def compute_clusters(
    min_size: int = 2,
    radius_km: float = 0.5,
    hours: int = 24
) -> List[Dict[str, Any]]:
    """
    Groups zones into spatial clusters using a simple neighbor-merge algorithm.

    For production: replace with:
      from sklearn.cluster import DBSCAN
      import numpy as np
      coords = np.array([(z['lat'], z['lng']) for z in zones])
      labels = DBSCAN(eps=radius_km/111, min_samples=min_size).fit_predict(coords)
    """
    zones = await get_all_zones(limit=10000)

    # Simple grid-cell clustering
    cell_size = radius_km / 111.0  # degrees per km
    cells: Dict[str, List[dict]] = {}

    for zone in zones:
        cell_lat = math.floor(zone["lat"] / cell_size)
        cell_lng = math.floor(zone["lng"] / cell_size)
        cell_key = f"{cell_lat}_{cell_lng}"
        cells.setdefault(cell_key, []).append(zone)

    clusters = []
    for idx, (cell_key, cell_zones) in enumerate(cells.items()):
        if len(cell_zones) < min_size:
            continue

        center_lat = sum(z["lat"] for z in cell_zones) / len(cell_zones)
        center_lng = sum(z["lng"] for z in cell_zones) / len(cell_zones)
        avg_danger = sum(z["danger_score"] for z in cell_zones) / len(cell_zones)

        # Compute dominant severity from incident data
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for z in cell_zones:
            inc_count = z.get("incident_count_24h", 0)
            if inc_count > 10:
                severity_counts["critical"] += 1
            elif inc_count > 5:
                severity_counts["high"] += 1
            elif inc_count > 2:
                severity_counts["medium"] += 1
            else:
                severity_counts["low"] += 1

        dominant = max(severity_counts, key=lambda k: severity_counts[k])

        # Danger level
        if avg_danger < 0.25:
            level = "safe"
        elif avg_danger < 0.50:
            level = "moderate"
        elif avg_danger < 0.75:
            level = "unsafe"
        else:
            level = "critical"

        clusters.append({
            "cluster_id": f"cluster_{idx}",
            "center_lat": round(center_lat, 6),
            "center_lng": round(center_lng, 6),
            "zone_count": len(cell_zones),
            "incident_count": sum(z.get("incident_count_24h", 0) for z in cell_zones),
            "avg_danger_score": round(avg_danger, 3),
            "danger_level": level,
            "dominant_severity": dominant,
            "radius_m": int(radius_km * 1000),
            "zone_ids": [z["zone_id"] for z in cell_zones]
        })

    # Sort by danger descending
    clusters.sort(key=lambda c: c["avg_danger_score"], reverse=True)
    return clusters
