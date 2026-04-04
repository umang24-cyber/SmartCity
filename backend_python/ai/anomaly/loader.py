"""
backend_python/ai/anomaly/loader.py
=====================================
Loader for the anomaly detection module (ai/anomaly/inference.py).

Situation
---------
The ai/anomaly/ directory does NOT currently exist in the project.
This loader therefore always operates in statistical fallback mode using
z-score analysis — a well-established, interpretable method for detecting
unusual incident spikes in time-series zone data.

If ai/anomaly/inference.py is placed in the project later, this loader
will automatically detect and load it at the next server restart.

What this module does
---------------------
1. Checks if ai/anomaly/inference.py exists.
2. If it exists: dynamically imports it and exposes detect_anomaly().
3. If it does not exist: implements a z-score statistical anomaly detector
   that operates identically to what the service layer expects.
4. Never crashes the server.

Statistical fallback design
---------------------------
Z-score anomaly detection:
  1. Compute rolling mean and std of incident_count over the input window.
  2. Flag the current hour as anomalous when z > threshold (default 2.5).
  3. Combine with crowd density spike detection (similar z-score logic).
  4. Return a normalised anomaly_score in [0.0, 1.0].

This method requires no pretrained model files and works with any
window length ≥ 3 observations.

Bundle shape
------------
{
    "detect_fn": callable,    # always set; never None
    "module":    <module> | None,
    "method":    "model" | "zscore",
    "status":    "loaded" | "fallback",
    "reason":    str,
}
"""

from __future__ import annotations

import importlib.util
import logging
import sys
import time
from typing import Any, Optional

logger = logging.getLogger(__name__)

from config import AI_ROOT, ANOMALY_ZSCORE_THRESHOLD

_ANOMALY_SRC_DIR   = AI_ROOT / "anomaly"
_ANOMALY_INFERENCE = _ANOMALY_SRC_DIR / "inference.py"

# Module-level singleton
_bundle: Optional[dict[str, Any]] = None


# ── Statistical fallback ──────────────────────────────────────────────────────

def _zscore_detect(zone_id: str, recent_data: list[dict]) -> dict[str, Any]:
    """
    Z-score anomaly detection over hourly zone observations.

    Args
    ----
    zone_id     : Zone identifier (used only for labelling the response)
    recent_data : List of dicts, each containing:
                    { "hour": int, "incident_count": float, "crowd": float }
                  Recommended length: 24 (one per hour).

    Returns
    -------
    Structured dict matching the AnomalyDetectResponse schema from
    models/graph_models.py.
    """
    if len(recent_data) < 3:
        # Not enough data to compute a meaningful z-score
        return _empty_result(zone_id, "Insufficient data for z-score computation")

    # ── Extract series ────────────────────────────────────────────────────────
    incident_counts = [float(d.get("incident_count", 0)) for d in recent_data]
    crowd_values    = [float(d.get("crowd", 0.0))         for d in recent_data]

    # ── Compute statistics ────────────────────────────────────────────────────
    # Use the most-recent observation as the "current" data point
    n = len(incident_counts)
    inc_arr  = incident_counts
    crd_arr  = crowd_values

    inc_mean = sum(inc_arr) / n
    inc_std  = _std(inc_arr, inc_mean) or 1e-6   # avoid div-by-zero

    crd_mean = sum(crd_arr) / n
    crd_std  = _std(crd_arr, crd_mean) or 1e-6

    # Current (most recent) values
    current_inc = inc_arr[-1]
    current_crd = crd_arr[-1]

    inc_z   = (current_inc - inc_mean) / inc_std
    crd_z   = (current_crd - crd_mean) / crd_std

    threshold = ANOMALY_ZSCORE_THRESHOLD

    # ── Detect anomaly type ───────────────────────────────────────────────────
    inc_anomaly = inc_z > threshold
    crd_anomaly = crd_z > threshold

    is_anomaly = inc_anomaly or crd_anomaly

    if inc_anomaly and crd_anomaly:
        anomaly_type = "combined"
    elif inc_anomaly:
        anomaly_type = "incident_spike"
    elif crd_anomaly:
        anomaly_type = "crowd_surge"
    else:
        anomaly_type = None

    # ── Compute normalised anomaly score ──────────────────────────────────────
    # Weighted combination of z-scores, clipped to [0, 1]
    max_z    = max(abs(inc_z), abs(crd_z))
    # sigmoid-like normalisation: score = 1 - exp(-z/threshold)
    import math
    raw_score = 1.0 - math.exp(-max_z / max(threshold, 0.5))
    anomaly_score = max(0.0, min(1.0, round(raw_score, 4)))

    # Best z-score to surface in the response
    best_z = float(inc_z if abs(inc_z) >= abs(crd_z) else crd_z)

    logger.debug(
        "Zone %s z-score: inc=%.2f crowd=%.2f → anomaly=%s score=%.3f",
        zone_id, inc_z, crd_z, is_anomaly, anomaly_score,
    )

    return {
        "zone_id":       zone_id,
        "anomaly_score": anomaly_score,
        "is_anomaly":    is_anomaly,
        "anomaly_type":  anomaly_type,
        "zscore":        round(best_z, 4),
        "method":        "zscore",
        "details": {
            "incident_zscore":   round(float(inc_z), 4),
            "crowd_zscore":      round(float(crd_z), 4),
            "incident_mean":     round(inc_mean, 3),
            "incident_std":      round(inc_std, 3),
            "crowd_mean":        round(crd_mean, 3),
            "crowd_std":         round(crd_std, 3),
            "threshold_used":    threshold,
            "window_size":       n,
            "current_incident":  current_inc,
            "current_crowd":     current_crd,
        },
    }


def _std(values: list[float], mean: float) -> float:
    """Population standard deviation."""
    n = len(values)
    if n < 2:
        return 0.0
    variance = sum((v - mean) ** 2 for v in values) / n
    import math
    return math.sqrt(variance)


def _empty_result(zone_id: str, reason: str) -> dict[str, Any]:
    """Safe fallback when there's not enough data."""
    return {
        "zone_id":       zone_id,
        "anomaly_score": 0.0,
        "is_anomaly":    False,
        "anomaly_type":  None,
        "zscore":        None,
        "method":        "zscore",
        "details":       {"reason": reason},
    }


# ── Public detect function for service layer ──────────────────────────────────

def detect_anomaly_zscore(zone_id: str, recent_data: list[dict]) -> dict[str, Any]:
    """
    Public-facing z-score anomaly detector.
    Signature matches what anomaly_service.py will call.
    """
    return _zscore_detect(zone_id, recent_data)


# ── Loader ────────────────────────────────────────────────────────────────────

def load_anomaly_model() -> dict[str, Any]:
    """
    Attempts to load ai/anomaly/inference.py.
    Falls back to z-score statistical detection if the file is absent
    or if any import fails.

    Returns
    -------
    dict with keys: detect_fn, module, method, status, reason
    """
    global _bundle
    if _bundle is not None:
        return _bundle

    # ── Check if the neural anomaly module exists ─────────────────────────────
    if not _ANOMALY_INFERENCE.exists():
        logger.info(
            "ai/anomaly/inference.py not found — using statistical z-score detector. "
            "This is normal for the current project state."
        )
        _bundle = _make_zscore_bundle(
            reason="ai/anomaly/inference.py not present — z-score fallback active"
        )
        return _bundle

    # ── Try to import the neural module ──────────────────────────────────────
    logger.info("Loading anomaly model from %s …", _ANOMALY_INFERENCE)
    t0 = time.perf_counter()

    try:
        spec = importlib.util.spec_from_file_location(
            "anomaly_inference", _ANOMALY_INFERENCE
        )
        if spec is None or spec.loader is None:
            raise ImportError("Could not create module spec for anomaly inference.py")

        anomaly_module = importlib.util.module_from_spec(spec)

        anomaly_src_str = str(_ANOMALY_SRC_DIR)
        if anomaly_src_str not in sys.path:
            sys.path.insert(0, anomaly_src_str)

        spec.loader.exec_module(anomaly_module)  # type: ignore[attr-defined]
    except Exception as exc:
        logger.warning(
            "Failed to import anomaly inference module after %.1fs: %s — z-score fallback.",
            time.perf_counter() - t0, exc,
        )
        _bundle = _make_zscore_bundle(f"Import error: {exc}")
        return _bundle

    # ── Check for detect_anomaly() function ───────────────────────────────────
    detect_fn = getattr(anomaly_module, "detect_anomaly", None)
    if not callable(detect_fn):
        logger.warning(
            "anomaly inference.py loaded but detect_anomaly() not found — z-score fallback."
        )
        _bundle = _make_zscore_bundle("detect_anomaly() not found in module")
        return _bundle

    elapsed = time.perf_counter() - t0
    logger.info("✅ Anomaly model loaded in %.1f s", elapsed)

    _bundle = {
        "model": detect_fn,   
        "module":    anomaly_module,
        "method":    "model",
        "status":    "loaded",
        "reason":    "",
    }
    return _bundle


def _make_zscore_bundle(reason: str = "") -> dict[str, Any]:
    """Returns a bundle wired to the z-score statistical detector."""
    return {
        "model": detect_anomaly_zscore,   
        "module":    None,
        "method":    "zscore",
        "status":    "fallback",
        "reason":    reason,
    }


def get_anomaly_bundle() -> dict[str, Any]:
    """
    Public accessor. Returns the already-loaded bundle or triggers a load.
    Use this in anomaly_service.py.
    """
    return load_anomaly_model()
