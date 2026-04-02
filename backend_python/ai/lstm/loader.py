"""
backend_python/ai/lstm/loader.py
=================================
Production loader for the LSTM safety-score predictor (ai/lstm/lstm_INT007.keras).

Design
------
* Loads the .keras model + .pkl scaler ONCE using the existing
  ai/lstm/inference.py `load_model_and_scaler()` function.
* Does NOT duplicate any model logic — delegates entirely to inference.py.
* If TensorFlow is not installed or the model files are absent, logs the
  error and activates a sinusoidal 24-hour mock that matches the real
  output schema exactly, so downstream services need zero branching logic.

Bundle shape
------------
{
    "model":           <tf.keras.Model> | None,
    "scaler":          <MinMaxScaler>   | None,
    "predict_fn":      callable,
    "load_fn":         callable | None,
    "intersection_id": "INT007",
    "status":          "loaded" | "fallback",
    "reason":          str,
}
"""

from __future__ import annotations

import importlib.util
import logging
import sys
import time
from typing import Any, Optional

logger = logging.getLogger(__name__)

from config import AI_ROOT, LSTM_MODEL_PATH, LSTM_SCALER_PATH

_LSTM_SRC_DIR      = AI_ROOT / "lstm"
_INTERSECTION_ID   = "INT007"

# Module-level singleton
_bundle: Optional[dict[str, Any]] = None


# ── Mock fallback ─────────────────────────────────────────────────────────────

def _mock_predict(input_data: dict) -> dict:
    """
    Sinusoidal 24-hour mock. Mirrors the exact output schema of
    inference.predict() so downstream services need zero branching logic.
    """
    import math
    from datetime import datetime, timedelta

    iid = input_data.get("intersection_id", "UNKNOWN")
    now = datetime.now().replace(minute=0, second=0, microsecond=0)

    predictions, danger_hours = [], []
    for i in range(24):
        h     = (now.hour + i + 1) % 24
        score = round(60.0 + 20.0 * math.sin(math.pi * (h - 11) / 12), 2)
        score = max(0.0, min(100.0, score))
        sigma = 4.0
        entry = {
            "hour_offset":         i + 1,
            "predicted_time":      (now + timedelta(hours=i + 1)).strftime("%Y-%m-%dT%H:%M:%S"),
            "predicted_score":     score,
            "confidence_interval": [round(max(0.0, score - 1.96 * sigma), 2),
                                     round(min(100.0, score + 1.96 * sigma), 2)],
            "confidence":          round(0.88 - i * 0.01, 4),
            "uncertainty_sigma":   sigma,
            "severity": (
                "Critical"      if score < 35 else
                "High Risk"     if score < 45 else
                "Moderate Risk" if score < 50 else
                "Caution"       if score < 70 else "Safe"
            ),
        }
        predictions.append(entry)
        if score < 50:
            danger_hours.append(entry)

    alert_time = None
    if danger_hours:
        from datetime import datetime as _dt, timedelta as _td
        first = _dt.fromisoformat(danger_hours[0]["predicted_time"])
        alert_time = (first - _td(hours=2)).strftime("%Y-%m-%dT%H:%M:%S")

    return {
        "intersection_id":       iid,
        "forecast_generated_at": now.strftime("%Y-%m-%dT%H:%M:%S"),
        "model_info": {
            "architecture":    "MOCK — real model not loaded",
            "sequence_length": 24,
            "forecast_horizon": 24,
            "mc_passes":       0,
            "n_features":      22,
        },
        "predictions":       predictions,
        "danger_hours":      danger_hours,
        "alert_recommended": len(danger_hours) > 0,
        "alert_time":        alert_time,
    }


# ── Loader ────────────────────────────────────────────────────────────────────

def load_lstm_model() -> dict[str, Any]:
    """
    Loads the LSTM model + scaler bundle. Idempotent.
    Returns the same singleton on every subsequent call.
    """
    global _bundle
    if _bundle is not None:
        return _bundle

    if not LSTM_MODEL_PATH.exists():
        logger.warning("LSTM model file not found: %s — using mock fallback.", LSTM_MODEL_PATH)
        _bundle = _fallback(f"Model file missing: {LSTM_MODEL_PATH}")
        return _bundle

    if not LSTM_SCALER_PATH.exists():
        logger.warning("LSTM scaler file not found: %s — using mock fallback.", LSTM_SCALER_PATH)
        _bundle = _fallback(f"Scaler file missing: {LSTM_SCALER_PATH}")
        return _bundle

    lstm_inference_path = _LSTM_SRC_DIR / "inference.py"
    if not lstm_inference_path.exists():
        logger.warning("LSTM inference.py not found at %s — using mock fallback.", lstm_inference_path)
        _bundle = _fallback(f"inference.py missing: {lstm_inference_path}")
        return _bundle

    logger.info("Loading LSTM model from %s …", lstm_inference_path)
    t0 = time.perf_counter()

    try:
        spec = importlib.util.spec_from_file_location("lstm_inference", lstm_inference_path)
        if spec is None or spec.loader is None:
            raise ImportError("importlib could not build a spec for lstm inference.py")

        module = importlib.util.module_from_spec(spec)

        lstm_src = str(_LSTM_SRC_DIR)
        if lstm_src not in sys.path:
            sys.path.insert(0, lstm_src)

        spec.loader.exec_module(module)  # type: ignore[attr-defined]

    except Exception as exc:
        logger.error(
            "LSTM inference import failed after %.1f s: %s — using mock fallback.",
            time.perf_counter() - t0, exc, exc_info=True,
        )
        _bundle = _fallback(f"Import error: {exc}")
        return _bundle

    try:
        module.load_model_and_scaler(
            intersection_id=_INTERSECTION_ID,
            model_dir=str(_LSTM_SRC_DIR),
        )
    except Exception as exc:
        logger.error(
            "LSTM load_model_and_scaler failed after %.1f s: %s — using mock fallback.",
            time.perf_counter() - t0, exc, exc_info=True,
        )
        _bundle = _fallback(f"load_model_and_scaler error: {exc}")
        return _bundle

    logger.info("✅ LSTM model ready (intersection=%s) in %.1f s", _INTERSECTION_ID, time.perf_counter() - t0)

    _bundle = {
        "model":           module._models.get(_INTERSECTION_ID),
        "scaler":          module._scalers.get(_INTERSECTION_ID),
        "predict_fn":      module.predict,
        "load_fn":         module.load_model_and_scaler,
        "intersection_id": _INTERSECTION_ID,
        "status":          "loaded",
        "reason":          "",
    }
    return _bundle


def _fallback(reason: str) -> dict[str, Any]:
    return {
        "model":           None,
        "scaler":          None,
        "predict_fn":      _mock_predict,
        "load_fn":         None,
        "intersection_id": _INTERSECTION_ID,
        "status":          "fallback",
        "reason":          reason,
    }


def get_lstm_bundle() -> dict[str, Any]:
    """Public accessor for lstm_service.py — returns the singleton."""
    return load_lstm_model()
