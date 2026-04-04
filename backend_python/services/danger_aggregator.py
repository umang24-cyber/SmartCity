"""
backend_python/services/danger_aggregator.py
==============================================
Combines LSTM + CV + Anomaly (+ Graph) signals into a single danger score.

Design
------
Weights come from config.DANGER_WEIGHTS:
    lstm    : 0.45   (predictive time-series model)
    cv      : 0.30   (real-time crowd / anomaly camera feed)
    anomaly : 0.15   (zone-level incident spike detection)
    graph   : 0.10   (TigerGraph historical zone density)

If a component is unavailable (loader in fallback, no image provided, etc.)
its weight is redistributed proportionally across the remaining components
so the final score always sums to 1.0.

Return schema
-------------
{
    "zone_id":       str,
    "danger_score":  float,           # [0.0, 1.0] weighted aggregate
    "danger_level":  str,             # "safe" | "moderate" | "unsafe" | "critical"
    "danger_100":    int,             # 0–100 integer for the dashboard gauge
    "alert":         bool,
    "recommendation": str,
    "components": {
        "lstm": {
            "score":   float | None,  # None if component was skipped
            "weight":  float,         # effective weight after redistribution
            "status":  str,           # "used" | "skipped" | "unavailable"
            "detail":  dict,          # raw output summary
        },
        "cv":      {...},
        "anomaly": {...},
        "graph":   {...},
    },
    "computed_at": str,               # ISO-8601 UTC timestamp
}
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from config import DANGER_WEIGHTS
from utils.scoring import (
    weighted_average,
    score_to_level,
    danger_score_to_100,
    level_to_recommendation,
    clamp,
    normalize_score,
)
from ai.anomaly.loader import get_anomaly_bundle

logger = logging.getLogger(__name__)


# ── Public API ────────────────────────────────────────────────────────────────

def aggregate_danger(
    zone_id: str,
    *,
    lstm_result:  dict | None = None,  # full output from lstm_service.predict_danger()
    cv_result:    dict | None = None,  # full output from cv_service.analyze_frame()
    graph_score:  float | None = None, # [0.0, 1.0] from TigerGraph historical density
    zone_history: list[dict] | None = None,  # hourly rows for anomaly z-score
) -> dict[str, Any]:
    """
    Aggregate all AI signals into a unified zone danger score.

    Args
    ----
    zone_id      : Zone identifier (e.g. "ZONE_12", "INT007").
    lstm_result  : Full dict returned by lstm_service.predict_danger().
                   If None, the LSTM component is skipped.
    cv_result    : Full dict returned by cv_service.analyze_frame().
                   If None, the CV component is skipped.
    graph_score  : Historical danger contribution from TigerGraph [0.0, 1.0].
                   If None, the graph component is skipped.
    zone_history : List of hourly observation dicts for anomaly detection.
                   Each must have "incident_count" and "crowd" keys.
                   If None/<3 entries, anomaly component returns 0.0.

    Returns
    -------
    Structured result dict described in the module docstring.
    """
    # ── 1. Extract per-component danger scores ─────────────────────────────
    components: dict[str, dict[str, Any]] = {}

    # ── LSTM ──────────────────────────────────────────────────────────────
    lstm_score = _extract_lstm_score(lstm_result)
    components["lstm"] = _build_component(
        score  = lstm_score,
        weight = DANGER_WEIGHTS["lstm"],
        status = "used" if lstm_score is not None else "skipped",
        detail = _lstm_detail(lstm_result),
    )

    # ── CV ────────────────────────────────────────────────────────────────
    cv_score = _extract_cv_score(cv_result)
    components["cv"] = _build_component(
        score  = cv_score,
        weight = DANGER_WEIGHTS["cv"],
        status = "used" if cv_score is not None else "skipped",
        detail = _cv_detail(cv_result),
    )

    # ── Anomaly ───────────────────────────────────────────────────────────
    anomaly_score, anomaly_detail = _run_anomaly(zone_id, zone_history)
    components["anomaly"] = _build_component(
        score  = anomaly_score,
        weight = DANGER_WEIGHTS["anomaly"],
        status = "used" if anomaly_score is not None else "skipped",
        detail = anomaly_detail,
    )

    # ── Graph ─────────────────────────────────────────────────────────────
    components["graph"] = _build_component(
        score  = graph_score,
        weight = DANGER_WEIGHTS["graph"],
        status = "used" if graph_score is not None else "skipped",
        detail = {"raw_graph_score": graph_score},
    )

    # ── 2. Redistribute weights for missing components ─────────────────────
    scores, effective_weights = _redistribute(components)

    # ── 3. Compute weighted aggregate ─────────────────────────────────────
    if not scores:
        # All components skipped — return conservative mid-range value
        logger.warning("Zone %s: ALL components skipped — returning neutral score 0.5", zone_id)
        danger_score = 0.5
    else:
        danger_score = clamp(weighted_average(scores, effective_weights))

    # Update effective weights in components for transparency
    for key, ew in effective_weights.items():
        components[key]["weight"] = round(ew, 6)

    # ── 4. Derive level + recommendation ──────────────────────────────────
    level = score_to_level(danger_score)
    alert = level in ("unsafe", "critical")

    return {
        "zone_id":        zone_id,
        "danger_score":   round(danger_score, 4),
        "danger_level":   level,
        "danger_100":     danger_score_to_100(danger_score),
        "alert":          alert,
        "recommendation": level_to_recommendation(level),
        "components":     components,
        "computed_at":    datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


# ── Score extractors ──────────────────────────────────────────────────────────

def _extract_lstm_score(lstm_result: dict | None) -> float | None:
    """
    Extract a [0.0, 1.0] danger score from the LSTM prediction result.
    LSTM outputs safety_score (0–100, higher = safer).
    We take the next-hour prediction and invert it.
    Returns None if result is missing or empty.
    """
    if not lstm_result:
        return None
    predictions = lstm_result.get("predictions", [])
    if not predictions:
        return None
    next_hour_score: float = predictions[0].get("predicted_score", 50.0)
    danger = normalize_score(100.0 - next_hour_score, 0.0, 100.0)
    return round(clamp(danger), 4)


def _extract_cv_score(cv_result: dict | None) -> float | None:
    """
    Extract the pre-computed danger score from the CV service result.
    cv_service.analyze_frame() already returns danger_score in [0.0, 1.0].
    """
    if not cv_result:
        return None
    score = cv_result.get("danger_score")
    if score is None:
        return None
    return round(clamp(float(score)), 4)


def _run_anomaly(zone_id: str, zone_history: list[dict] | None) -> tuple[float | None, dict]:
    """
    Runs the anomaly detector (z-score or neural) and returns
    (anomaly_score | None, detail_dict).
    """
    if not zone_history or len(zone_history) < 3:
        return None, {"reason": "Insufficient history for anomaly detection"}

    bundle = get_anomaly_bundle()
    try:
        result = bundle["model"](zone_id, zone_history)
    except Exception as exc:
        logger.warning("Anomaly detect_fn raised for zone %s: %s", zone_id, exc)
        return None, {"error": str(exc)}

    score = float(result.get("anomaly_score", 0.0))
    return round(clamp(score), 4), {
        "is_anomaly":   result.get("is_anomaly"),
        "anomaly_type": result.get("anomaly_type"),
        "zscore":       result.get("zscore"),
        "method":       result.get("method"),
    }


# ── Weight redistribution ─────────────────────────────────────────────────────

def _redistribute(
    components: dict[str, dict],
) -> tuple[dict[str, float], dict[str, float]]:
    """
    For components with status="skipped", redistribute their weight
    proportionally to the active components so effective weights sum to 1.0.

    Returns (scores dict, effective_weights dict) — only for active components.
    """
    active_keys = [k for k, v in components.items() if v["status"] == "used"]

    if not active_keys:
        return {}, {}

    total_active_weight = sum(components[k]["weight"] for k in active_keys)

    scores:   dict[str, float] = {}
    weights:  dict[str, float] = {}

    for key in active_keys:
        original_w = components[key]["weight"]
        effective_w = original_w / total_active_weight if total_active_weight > 0 else 0.0
        scores[key]  = components[key]["score"]   # type: ignore[assignment]
        weights[key] = effective_w

    return scores, weights


# ── Component builders ────────────────────────────────────────────────────────

def _build_component(
    score:  float | None,
    weight: float,
    status: str,
    detail: dict,
) -> dict[str, Any]:
    return {
        "score":  score,
        "weight": round(weight, 4),
        "status": status,
        "detail": detail,
    }


def _lstm_detail(lstm_result: dict | None) -> dict:
    if not lstm_result:
        return {}
    preds = lstm_result.get("predictions", [])
    return {
        "loader_status":    lstm_result.get("loader_status", "unknown"),
        "alert_recommended": lstm_result.get("alert_recommended", False),
        "danger_hours_count": len(lstm_result.get("danger_hours", [])),
        "next_hour_score":   preds[0].get("predicted_score") if preds else None,
        "next_hour_severity": preds[0].get("severity") if preds else None,
    }


def _cv_detail(cv_result: dict | None) -> dict:
    if not cv_result:
        return {}
    return {
        "loader_status":   cv_result.get("loader_status", "unknown"),
        "person_count":    cv_result.get("person_count"),
        "crowd_density":   cv_result.get("crowd_density"),
        "anomaly_detected": cv_result.get("anomaly_detected"),
        "safety_score":    cv_result.get("safety_score"),
    }
