"""
backend_python/services/anomaly_service.py
============================================
Business-logic wrapper around the anomaly AI loader.

The router sends a flat list[float] of recent values (incident counts
or composite danger readings). This service adapts that into the
(zone_id, recent_data) dict format that the z-score detector expects.
"""

from __future__ import annotations

import logging
from typing import Any

from ai.anomaly.loader import get_anomaly_bundle

logger = logging.getLogger(__name__)


def detect_anomaly(zone_id: str, values: list[float]) -> dict[str, Any]:
    """
    Detect whether the given time-series values contain an anomaly.

    Args
    ----
    zone_id : Zone identifier for labelling.
    values  : Flat list of recent numeric readings (e.g. incident counts).
              Minimum 3 values required for z-score computation.

    Returns
    -------
    {
        "zone_id":       str,
        "anomaly_score": float,     # [0.0, 1.0]
        "is_anomaly":    bool,
        "anomaly_type":  str | None,
        "zscore":        float | None,
        "method":        str,       # "zscore" or "model"
        "details":       dict,
        "loader_status": str,       # "loaded" | "fallback"
    }
    """
    bundle = get_anomaly_bundle()

    # Adapt flat list → recent_data format expected by the z-score detector
    # Each row needs "incident_count" and "crowd" keys. We use the value for
    # both since the router provides a generic numeric series.
    recent_data = [
        {"hour": i, "incident_count": float(v), "crowd": float(v) / 100.0}
        for i, v in enumerate(values)
    ]

    try:
        result = bundle["model"](zone_id, recent_data)
    except Exception as exc:
        logger.error("Anomaly detect raised for zone %s: %s", zone_id, exc, exc_info=True)
        result = _error_result(zone_id, str(exc))

    result["loader_status"] = bundle["status"]
    return result


def _error_result(zone_id: str, reason: str) -> dict[str, Any]:
    return {
        "zone_id":       zone_id,
        "anomaly_score": 0.0,
        "is_anomaly":    False,
        "anomaly_type":  None,
        "zscore":        None,
        "method":        "error",
        "details":       {"error": reason},
    }
