from fastapi import APIRouter, HTTPException, Query
from utils.safety_engine import compute_safety_score
import utils.tigergraph as tg
import logging

router = APIRouter(prefix="/danger-score", tags=["Danger Score"])
logger = logging.getLogger(__name__)

def _normalize_intersection(intersection: dict) -> dict:
    baseline = float(intersection.get("baseline_safety_score", 0))
    if baseline == 0:
        lighting = float(intersection.get("lighting_score", 0.6))
        visibility = float(intersection.get("visibility_score", 0.6))
        incident_rate = float(intersection.get("historical_incident_rate", 0.3))
        baseline = max(0.0, min(100.0, 70 + (lighting - 0.5) * 20 + (visibility - 0.5) * 15 - incident_rate * 30))

    peak_hours = intersection.get("peak_danger_hours", [22, 23, 0, 1])
    if isinstance(peak_hours, str):
        peak_hours = [int(h) for h in peak_hours.split("|") if h != ""]

    return {
        **intersection,
        "intersection_name": intersection.get("intersection_name", intersection.get("intersection_id", "unknown")),
        "baseline_safety_score": baseline,
        "peak_danger_hours": peak_hours,
        "weekend_multiplier": float(intersection.get("weekend_multiplier", 0.95)),
        "weather_sensitivity": float(intersection.get("weather_sensitivity", 0.4)),
        "isolation_score": float(intersection.get("isolation_score", 0.4)),
        "safety_variance": float(intersection.get("safety_variance", 12.0)),
        "betweenness_score": float(intersection.get("betweenness_score", 0.2)),
    }


def _normalize_time_slice(time_slice: dict, weather: str) -> dict:
    def _safe_float(value, default: float) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    hour = int(time_slice.get("ts_hour", time_slice.get("hour", 0)))
    return {
        **time_slice,
        "ts_hour": hour,
        "hour": hour,
        "weather_condition": weather,
        "aggregate_safety": _safe_float(time_slice.get("aggregate_safety", 68), 68.0),
        "is_holiday": bool(time_slice.get("is_holiday", False)),
        "special_event": time_slice.get("special_event", "none"),
        "moon_phase": _safe_float(time_slice.get("moon_phase", 0.5), 0.5),
    }


@router.get("/", summary="Get danger/comfort score for an intersection")
async def get_danger_score(
    intersection_id: str = Query(default="INT_001", description="Intersection ID"),
    weather: str = Query(default="clear", description="Current weather condition"),
):
    try:
        logger.info("Danger score request intersection_id=%s weather=%s", intersection_id, weather)
        intersection = await tg.get_intersection(intersection_id)
        features = await tg.get_features_for_intersection(intersection_id)
        time_slice = await tg.get_current_time_slice()
        time_slice["weather_condition"] = weather

        intersection = _normalize_intersection(intersection)
        time_slice = _normalize_time_slice(time_slice, weather)
        result = compute_safety_score(intersection, time_slice, features)
        logger.info("Danger score computed intersection_id=%s score=%s risk=%s", intersection_id, result.get("score"), result.get("risk"))
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compute danger score: {str(e)}")
