import os
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from db.mock_db import get_all_mock_zones
from utils.safety_engine import compute_safety_score
import utils.tigergraph as tg

router = APIRouter(prefix="/danger-score", tags=["Danger Score"])

DATA_SOURCE = os.getenv("DATA_SOURCE", "mock")


def _mock_intersections() -> list[dict]:
    zones = get_all_mock_zones()
    intersections = []
    for zone in zones:
        zone_danger = float(zone.get("danger_score", 0.35))
        baseline = max(35.0, min(95.0, round((1.0 - zone_danger) * 100.0, 2)))
        intersections.append(
            {
                "intersection_id": zone.get("zone_id", "INT_UNKNOWN").upper(),
                "intersection_name": zone.get("name", zone.get("zone_id", "Unknown Zone")),
                "lat": zone.get("lat"),
                "lng": zone.get("lng"),
                "baseline_safety_score": baseline,
                "peak_danger_hours": [21, 22, 23, 0, 1],
                "weekend_multiplier": 0.92,
                "weather_sensitivity": 0.45,
                "isolation_score": max(0.1, min(0.9, zone_danger)),
                "safety_variance": 12 + (zone_danger * 20),
                "betweenness_score": max(0.1, min(0.8, 1.0 - zone_danger)),
            }
        )
    return intersections


def _mock_safety_features() -> list[dict]:
    return [
        {"feature_type": "streetlight", "is_functional": True, "lux_level": 42},
        {
            "feature_type": "cctv",
            "is_functional": True,
            "effectiveness_by_hour": {h: (0.82 if 7 <= h <= 22 else 0.58) for h in range(24)},
        },
        {"feature_type": "panic_button", "is_functional": True},
    ]


def _current_time_slice(weather: str) -> dict:
    now = datetime.now()
    return {
        "ts_hour": now.hour,
        "hour": now.hour,
        "weather_condition": weather,
        "is_weekend": now.weekday() >= 5,
        "is_holiday": False,
        "special_event": "none",
        "aggregate_safety": 68,
        "moon_phase": 0.5,
    }


def _normalize_intersection(intersection: dict) -> dict:
    baseline = float(intersection.get("baseline_safety_score", 0))
    if baseline == 0:
        lighting = float(intersection.get("lighting_score", 0.6))
        visibility = float(intersection.get("visibility_score", 0.6))
        incident_rate = float(intersection.get("historical_incident_rate", 0.3))
        baseline = max(0.0, min(100.0, 70 + (lighting - 0.5) * 20 + (visibility - 0.5) * 15 - incident_rate * 30))

    return {
        **intersection,
        "intersection_name": intersection.get("intersection_name", intersection.get("intersection_id", "unknown")),
        "baseline_safety_score": baseline,
        "peak_danger_hours": intersection.get("peak_danger_hours", [22, 23, 0, 1]),
        "weekend_multiplier": float(intersection.get("weekend_multiplier", 0.95)),
        "weather_sensitivity": float(intersection.get("weather_sensitivity", 0.4)),
        "isolation_score": float(intersection.get("isolation_score", 0.4)),
        "safety_variance": float(intersection.get("safety_variance", 12.0)),
        "betweenness_score": float(intersection.get("betweenness_score", 0.2)),
    }


def _normalize_time_slice(time_slice: dict, weather: str) -> dict:
    hour = int(time_slice.get("ts_hour", time_slice.get("hour", 0)))
    return {
        **time_slice,
        "ts_hour": hour,
        "hour": hour,
        "weather_condition": weather,
        "aggregate_safety": float(time_slice.get("aggregate_safety", 68)),
        "is_holiday": bool(time_slice.get("is_holiday", False)),
        "special_event": time_slice.get("special_event", "none"),
        "moon_phase": float(time_slice.get("moon_phase", 0.5)),
    }


@router.get("/", summary="Get danger/comfort score for an intersection")
async def get_danger_score(
    intersection_id: str = Query(default="INT_001", description="Intersection ID"),
    weather: str = Query(default="clear", description="Current weather condition"),
):
    try:
        if DATA_SOURCE == "tigergraph":
            intersection = await tg.get_intersection(intersection_id)
            features = await tg.get_features_for_intersection(intersection_id)
            time_slice = await tg.get_current_time_slice()
            time_slice["weather_condition"] = weather
        else:
            intersections = _mock_intersections()
            intersection = next(
                (i for i in intersections if i["intersection_id"] == intersection_id),
                intersections[0],
            )
            features = _mock_safety_features()
            time_slice = _current_time_slice(weather)

        intersection = _normalize_intersection(intersection)
        time_slice = _normalize_time_slice(time_slice, weather)
        result = compute_safety_score(intersection, time_slice, features)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute danger score: {str(e)}")
