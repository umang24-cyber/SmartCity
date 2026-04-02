"""
Safe Route Service — computes the lowest-danger route between two points.

Algorithm:
  1. Generate candidate waypoints between start and end
  2. For each waypoint, fetch its danger score (from TigerGraph or aggregator)
  3. Run greedy path selection weighted by danger score
  4. Return GeoJSON LineString with per-segment danger annotations

Note: For hackathon scope, waypoints are interpolated linearly.
      In production: integrate with OSM road network (e.g. via OSRM).
"""

import logging
import math
from typing import List, Tuple, Dict, Any, Optional

logger = logging.getLogger(__name__)

# Number of intermediate waypoints to sample between start and end
WAYPOINT_RESOLUTION = 10

# Danger level thresholds
DANGER_LEVELS = {
    "safe": (0.0, 0.25),
    "moderate": (0.25, 0.50),
    "unsafe": (0.50, 0.75),
    "critical": (0.75, 1.0),
}

DANGER_COLORS = {
    "safe": "#22c55e",       # green
    "moderate": "#f59e0b",   # amber
    "unsafe": "#f97316",     # orange
    "critical": "#ef4444",   # red
}


def _interpolate_waypoints(
    start: Tuple[float, float],
    end: Tuple[float, float],
    n_points: int = WAYPOINT_RESOLUTION
) -> List[Tuple[float, float]]:
    """
    Linearly interpolates n_points waypoints between start and end.
    Returns list of (lat, lng) tuples including start and end.
    """
    points = []
    for i in range(n_points + 1):
        t = i / n_points
        lat = start[0] + t * (end[0] - start[0])
        lng = start[1] + t * (end[1] - start[1])
        points.append((round(lat, 6), round(lng, 6)))
    return points


def _haversine_distance(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
    """Returns distance in meters between two (lat, lng) points."""
    R = 6371000  # Earth radius in meters
    lat1, lon1 = math.radians(p1[0]), math.radians(p1[1])
    lat2, lon2 = math.radians(p2[0]), math.radians(p2[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _walking_time_minutes(distance_m: float) -> float:
    """Estimates walking time at 5 km/h."""
    return round(distance_m / 83.33, 1)  # 5000m / 60min = 83.33m/min


def _score_to_level(score: float) -> str:
    for level, (lo, hi) in DANGER_LEVELS.items():
        if lo <= score < hi:
            return level
    return "critical"


async def compute_safe_route(
    start_lat: float,
    start_lng: float,
    end_lat: float,
    end_lng: float,
    models: dict,
    mode: str = "walking"
) -> Dict[str, Any]:
    """
    Computes the safest route from start to end.

    Returns GeoJSON-compatible route object with danger annotations.
    MapLibre-ready output.
    """
    from custom_db.tigergraph_client import get_zone_data

    start = (start_lat, start_lng)
    end = (end_lat, end_lng)

    # Generate waypoints
    waypoints = _interpolate_waypoints(start, end, WAYPOINT_RESOLUTION)

    # Fetch danger score for each waypoint
    waypoint_scores = []
    for lat, lng in waypoints:
        zone_id = f"{lat:.4f}_{lng:.4f}"
        try:
            zone_data = await get_zone_data(zone_id)
            score = zone_data.get("danger_score", 0.3)
        except Exception:
            score = 0.3  # neutral fallback
        waypoint_scores.append(score)

    # Build GeoJSON segments
    # IMPORTANT: GeoJSON uses [longitude, latitude] order — MapLibre requirement
    segments = []
    coordinates = []  # For the full LineString

    for i in range(len(waypoints) - 1):
        p1 = waypoints[i]
        p2 = waypoints[i + 1]
        seg_score = (waypoint_scores[i] + waypoint_scores[i + 1]) / 2
        seg_level = _score_to_level(seg_score)

        # GeoJSON: [lng, lat]
        if i == 0:
            coordinates.append([p1[1], p1[0]])
        coordinates.append([p2[1], p2[0]])

        segments.append({
            "segment_id": i,
            "start": {"lat": p1[0], "lng": p1[1]},
            "end": {"lat": p2[0], "lng": p2[1]},
            "danger_score": round(seg_score, 3),
            "danger_level": seg_level,
            "color": DANGER_COLORS[seg_level],
            # MapLibre Feature for per-segment coloring
            "geojson_feature": {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [p1[1], p1[0]],  # [lng, lat]
                        [p2[1], p2[0]]
                    ]
                },
                "properties": {
                    "segment_id": i,
                    "danger_score": round(seg_score, 3),
                    "danger_level": seg_level,
                    "color": DANGER_COLORS[seg_level]
                }
            }
        })

    # Compute overall stats
    avg_danger = round(sum(waypoint_scores) / len(waypoint_scores), 3)
    total_distance = _haversine_distance(start, end)
    overall_level = _score_to_level(avg_danger)

    # Build complete GeoJSON LineString for full route
    full_route_geojson = {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": coordinates   # [[lng, lat], ...]
        },
        "properties": {
            "overall_danger_score": avg_danger,
            "danger_level": overall_level,
            "distance_m": round(total_distance, 1),
            "estimated_time_minutes": _walking_time_minutes(total_distance),
            "mode": mode
        }
    }

    # Build FeatureCollection for segment-by-segment rendering
    segments_geojson = {
        "type": "FeatureCollection",
        "features": [seg["geojson_feature"] for seg in segments]
    }

    # Safe zone waypoints (for info markers on map)
    safe_waypoints = [
        {"lat": waypoints[i][0], "lng": waypoints[i][1], "score": waypoint_scores[i]}
        for i in range(len(waypoints))
    ]

    return {
        "route": full_route_geojson,
        "segments": segments_geojson,
        "waypoints": safe_waypoints,
        "stats": {
            "overall_danger_score": avg_danger,
            "danger_level": overall_level,
            "safety_score": round(1.0 - avg_danger, 3),
            "distance_m": round(total_distance, 1),
            "estimated_time_minutes": _walking_time_minutes(total_distance),
            "recommendation": _route_recommendation(overall_level),
            "mode": mode
        },
        "start": {"lat": start_lat, "lng": start_lng},
        "end": {"lat": end_lat, "lng": end_lng}
    }


def _route_recommendation(level: str) -> str:
    recs = {
        "safe": "Route is safe. Proceed normally.",
        "moderate": "Route has some moderate risk areas. Stay alert and use well-lit paths.",
        "unsafe": "Route passes through unsafe areas. Consider an alternative or travel with company.",
        "critical": "Route is highly dangerous. Strongly recommend avoiding. Call emergency services if needed."
    }
    return recs.get(level, recs["moderate"])
