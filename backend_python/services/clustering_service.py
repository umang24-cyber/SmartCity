"""
Spatial clustering of incidents and danger zones.
Uses DBSCAN via scikit-learn with Haversine distance for production accuracy.
"""

import math
import logging
from typing import List, Dict, Any
import numpy as np
from sklearn.cluster import DBSCAN
from custom_db import get_all_zones

logger = logging.getLogger(__name__)

SEVERITY_RANK = {"critical": 4, "high": 3, "medium": 2, "low": 1}

async def compute_clusters(min_size: int = 2, radius_km: float = 0.5, hours: int = 24) -> List[Dict[str, Any]]:
    zones = await get_all_zones(limit=10000)
    if not zones:
        return []
    coords = np.array([[z["lat"], z["lng"]] for z in zones])
    coords_rad = np.radians(coords)
    kms_per_radian = 6371.008
    epsilon_rad = radius_km / kms_per_radian
    db = DBSCAN(eps=epsilon_rad, min_samples=min_size, metric='haversine')
    labels = db.fit_predict(coords_rad)
    cluster_groups: Dict[int, List[dict]] = {}
    for zone, label in zip(zones, labels):
        if label == -1:
            continue
        cluster_groups.setdefault(label, []).append(zone)
    clusters = []
    for idx, (label, cell_zones) in enumerate(cluster_groups.items()):
        center_lat = sum(z["lat"] for z in cell_zones) / len(cell_zones)
        center_lng = sum(z["lng"] for z in cell_zones) / len(cell_zones)
        avg_danger = sum(z["danger_score"] for z in cell_zones) / len(cell_zones)
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
        if avg_danger < 0.25:
            level = "safe"
        elif avg_danger < 0.50:
            level = "moderate"
        elif avg_danger < 0.75:
            level = "unsafe"
        else:
            level = "critical"
        clusters.append({"cluster_id": f"cluster_{idx}", "center_lat": round(center_lat, 6), "center_lng": round(center_lng, 6), "zone_count": len(cell_zones), "incident_count": sum(z.get("incident_count_24h", 0) for z in cell_zones), "avg_danger_score": round(avg_danger, 3), "danger_level": level, "dominant_severity": dominant, "radius_m": int(radius_km * 1000), "zone_ids": [z["zone_id"] for z in cell_zones]})
    clusters.sort(key=lambda c: c["avg_danger_score"], reverse=True)
    return clusters
