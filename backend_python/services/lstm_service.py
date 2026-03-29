"""
backend_python/services/lstm_service.py
=========================================
Business-logic wrapper around the LSTM AI loader.

Responsibilities
----------------
* Convert raw API request dicts into the format inference.predict() expects.
* Call bundle["predict_fn"] (real model OR sinusoidal mock — transparent to caller).
* Re-shape the 24-hour prediction list into whatever the router / aggregator needs.
* Optionally cache results to avoid redundant model calls on identical inputs.

This module NEVER loads a model itself — it always delegates to get_lstm_bundle().
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from ai.lstm.loader import get_lstm_bundle
from utils.cache import TTLCache
from config import LSTM_PREDICTION_CACHE_TTL

logger = logging.getLogger(__name__)

# Per-intersection TTL cache keyed by (intersection_id, hour_bucket)
_cache: TTLCache = TTLCache(ttl=LSTM_PREDICTION_CACHE_TTL)


# ── Public API ────────────────────────────────────────────────────────────────

def predict_danger(
    intersection_id: str,
    history: list[dict],
    current_time: str | None = None,
    use_cache: bool = True,
) -> dict[str, Any]:
    """
    Generate a 24-hour danger forecast for one intersection.

    Args
    ----
    intersection_id : e.g. "INT007"
    history         : List of 24 hourly observation dicts. Each must contain:
                        timestamp, safety_score, crowd_density, hour,
                        day_of_week, is_weekend, weather_condition,
                        incident_count_last_6h, lights_functional, cctv_functional
    current_time    : ISO-8601 string for "now". Defaults to the current wall clock.
    use_cache       : If True, returns cached result for the same (id, hour) pair.

    Returns
    -------
    Full output dict from inference.predict() plus an extra "loader_status" key.
    Keys: intersection_id, forecast_generated_at, model_info, predictions,
          danger_hours, alert_recommended, alert_time, loader_status
    """
    bundle = get_lstm_bundle()

    # Cache key: intersection + UTC hour (predictions are hourly, cache for 1h)
    now_str = current_time or datetime.utcnow().strftime("%Y-%m-%dT%H:00:00")
    cache_key = f"lstm:{intersection_id}:{now_str[:13]}"

    if use_cache:
        cached = _cache.get(cache_key)
        if cached is not None:
            logger.debug("LSTM cache hit: %s", cache_key)
            return cached

    input_data = {
        "intersection_id": intersection_id,
        "history":         history,
    }
    if current_time:
        input_data["current_time"] = current_time

    try:
        result = bundle["predict_fn"](input_data)
    except Exception as exc:
        logger.error("LSTM predict_fn raised: %s", exc, exc_info=True)
        result = _error_result(intersection_id, str(exc))

    result["loader_status"] = bundle["status"]

    if use_cache:
        _cache.set(cache_key, result)

    return result


def get_next_danger_hour(prediction_result: dict) -> dict | None:
    """
    Returns the first danger hour entry from a prediction result, or None if
    no danger hours are forecast.

    A "danger hour" is any predicted hour with safety score < 50.
    """
    danger = prediction_result.get("danger_hours", [])
    return danger[0] if danger else None


def get_current_danger_score(
    intersection_id: str,
    history: list[dict],
) -> float:
    """
    Convenience method: runs prediction and returns the danger score
    (inverted safety score, normalised to [0.0, 1.0]) for the next 1 hour.

    Returns 0.5 (neutral) on any error.
    """
    try:
        result = predict_danger(intersection_id, history)
        predictions = result.get("predictions", [])
        if not predictions:
            return 0.5
        score_0_100: float = predictions[0]["predicted_score"]
        # LSTM outputs safety score (higher = safer). Invert for danger [0,1].
        return round(max(0.0, min(1.0, (100.0 - score_0_100) / 100.0)), 4)
    except Exception as exc:
        logger.warning("get_current_danger_score failed: %s — returning 0.5", exc)
        return 0.5


# ── Internal helpers ──────────────────────────────────────────────────────────

def _error_result(intersection_id: str, reason: str) -> dict[str, Any]:
    """Minimal valid result dict returned when predict_fn raises."""
    return {
        "intersection_id":       intersection_id,
        "forecast_generated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S"),
        "model_info":            {"architecture": "ERROR", "forecast_horizon": 24},
        "predictions":           [],
        "danger_hours":          [],
        "alert_recommended":     False,
        "alert_time":            None,
        "error":                 reason,
    }
