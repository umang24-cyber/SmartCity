"""
backend_python/services/portal_service.py
==========================================
NEW additive service — powers the portal_routes.py endpoints.
Computes dual routes (shortest + safest) without touching existing services.
"""

from __future__ import annotations

import logging
import math
from typing import Any

logger = logging.getLogger(__name__)

WAYPOINT_RESOLUTION = 10

DANGER_COLORS = {
    "safe":     "#22c55e",
    "moderate": "#f59e0b",
    "unsafe":   "#f97316",
    "critical": "#ef4444",
}

DANGER_LEVELS = {
    "safe":     (0.00, 0.25),
    "moderate": (0.25, 0.50),
    "unsafe":   (0.50, 0.75),
    "critical": (0.75, 1.01),
}


def _level(score: float) -> str:
    for lvl, (lo, hi) in DANGER_LEVELS.items():
        if lo <= score < hi:
            return lvl
    return "critical"


def _haversine(p1: tuple, p2: tuple) -> float:
    R = 6_371_000
    lat1, lon1 = math.radians(p1[0]), math.radians(p1[1])
    lat2, lon2 = math.radians(p2[0]), math.radians(p2[1])
    dl = lat2 - lat1
    dg = lon2 - lon1
    a = math.sin(dl / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dg / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _walk_time(m: float) -> float:
    return round(m / 83.33, 1)


def _interpolate(start: tuple, end: tuple, n: int) -> list[tuple]:
    return [
        (
            round(start[0] + (i / n) * (end[0] - start[0]), 6),
            round(start[1] + (i / n) * (end[1] - start[1]), 6),
        )
        for i in range(n + 1)
    ]


def _mock_danger(lat: float, lng: float) -> float:
    """
    Deterministic mock danger scorer based on coordinate hash.
    Returns a value in [0.1, 0.9].
    No external calls needed.
    """
    seed = (int(lat * 1000) * 31 + int(lng * 1000) * 17) % 100
    return round(0.1 + (seed / 100) * 0.8, 3)


def _build_geojson_route(waypoints: list[tuple], scores: list[float], mode: str) -> dict[str, Any]:
    coords = [[wp[1], wp[0]] for wp in waypoints]  # GeoJSON: [lng, lat]
    avg    = round(sum(scores) / len(scores), 3) if scores else 0.3
    dist   = _haversine(waypoints[0], waypoints[-1])

    segments_features = []
    for i in range(len(waypoints) - 1):
        seg_score = (scores[i] + scores[i + 1]) / 2
        seg_lvl   = _level(seg_score)
        segments_features.append({
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [waypoints[i][1],     waypoints[i][0]],
                    [waypoints[i + 1][1], waypoints[i + 1][0]],
                ],
            },
            "properties": {
                "segment_id":   i,
                "danger_score": round(seg_score, 3),
                "danger_level": seg_lvl,
                "color":        DANGER_COLORS[seg_lvl],
            },
        })

    return {
        "route": {
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": {
                "overall_danger_score":    avg,
                "danger_level":            _level(avg),
                "distance_m":              round(dist, 1),
                "estimated_time_minutes":  _walk_time(dist),
                "mode":                    mode,
            },
        },
        "segments": {"type": "FeatureCollection", "features": segments_features},
        "stats": {
            "overall_danger_score":   avg,
            "danger_level":           _level(avg),
            "safety_score":           round(1.0 - avg, 3),
            "distance_m":             round(dist, 1),
            "estimated_time_minutes": _walk_time(dist),
            "recommendation":         _recommendation(_level(avg)),
            "danger_score":           avg,
        },
    }


def _recommendation(level: str) -> str:
    return {
        "safe":     "Route is safe. Proceed normally.",
        "moderate": "Moderate risk. Stay on well-lit paths.",
        "unsafe":   "Unsafe areas ahead. Travel with company.",
        "critical": "Highly dangerous. Avoid if possible.",
    }.get(level, "Exercise caution.")


async def compute_dual_routes(
    start_lat: float,
    start_lng: float,
    end_lat: float,
    end_lng: float,
    models: dict,
    mode: str = "walking",
) -> dict[str, Any]:
    """
    Returns both the shortest route (straight line) and safest route
    (waypoints re-weighted by danger score) between start and end.

    Tries to use the existing route_service.compute_safe_route first;
    falls back to pure mock computation if unavailable.
    """
    start = (start_lat, start_lng)
    end   = (end_lat, end_lng)

    # ── Shortest route (straight line, no danger weighting) ──────────────────
    shortest_wps     = _interpolate(start, end, WAYPOINT_RESOLUTION)
    shortest_scores  = [_mock_danger(lat, lng) for lat, lng in shortest_wps]
    shortest         = _build_geojson_route(shortest_wps, shortest_scores, mode)

    # ── Safest route — try existing service, fall back to mock ─────────────
    safest = None
    try:
        from services.route_service import compute_safe_route
        safest_raw = await compute_safe_route(
            start_lat=start_lat,
            start_lng=start_lng,
            end_lat=end_lat,
            end_lng=end_lng,
            models=models,
            mode=mode,
        )
        # Normalise keys so frontend always sees the same shape
        safest = {
            "route":    safest_raw.get("route",    shortest["route"]),
            "segments": safest_raw.get("segments", shortest["segments"]),
            "stats":    safest_raw.get("stats",    shortest["stats"]),
        }
        # Ensure danger_score key exists on stats
        safest["stats"].setdefault("danger_score", safest["stats"].get("overall_danger_score", 0.3))
    except Exception as exc:
        logger.warning("Falling back to mock safest route: %s", exc)

    if safest is None:
        # Pure mock: nudge lat slightly north to simulate an alternate path
        alt_wps    = _interpolate(
            (start_lat + 0.003, start_lng),
            (end_lat   + 0.003, end_lng),
            WAYPOINT_RESOLUTION,
        )
        alt_scores = [_mock_danger(lat - 0.003, lng) for lat, lng in alt_wps]
        safest     = _build_geojson_route(alt_wps, alt_scores, mode)

    return {
        "shortest_route": {**shortest["stats"], "route_geojson": shortest["route"], "segments": shortest["segments"]},
        "safest_route":   {**safest["stats"],   "route_geojson": safest["route"],   "segments": safest["segments"]},
        "start": {"lat": start_lat, "lng": start_lng},
        "end":   {"lat": end_lat,   "lng": end_lng},
        "comparison": {
            "shortest_danger": shortest["stats"]["overall_danger_score"],
            "safest_danger":   safest["stats"]["overall_danger_score"],
            "improvement":     round(
                shortest["stats"]["overall_danger_score"] - safest["stats"]["overall_danger_score"], 3
            ),
        },
    }
