"""
backend_python/ai/cv/loader.py
================================
Production loader for the Computer Vision pipeline (ai/cv/inference.py).

Design
------
* Instantiates CrowdAnalysisPipeline ONCE at server startup.
* CrowdAnalysisPipeline.__init__ loads YOLOv8 (local .pt or auto-download
  via ultralytics) and MobileNetV2 (mobilenetv2_crowd.pth).
* No dependency pre-checks. If the import or instantiation fails for any
  reason, the loader logs the error and activates a lightweight mock that
  mirrors the exact output schema so services need zero branching logic.

Bundle shape
------------
{
    "pipeline":   <CrowdAnalysisPipeline> | None,
    "predict_fn": callable,
    "reset_fn":   callable,
    "status":     "loaded" | "fallback",
    "reason":     str,
}
"""

from __future__ import annotations

import importlib.util
import logging
import sys
import time
from typing import Any, Optional

logger = logging.getLogger(__name__)

from config import AI_ROOT

_CV_SRC_DIR = AI_ROOT / "cv"

# Module-level singleton
_bundle: Optional[dict[str, Any]] = None


# ── Mock fallback ─────────────────────────────────────────────────────────────

def _mock_predict(image_bytes: bytes) -> dict:
    """Mirrors the exact output schema of CrowdAnalysisPipeline.predict()."""
    return {
        "prediction": "LOW",
        "confidence": 0.72,
        "extra": {
            "person_count":     3,
            "crowd_density":    "LOW",
            "anomaly_detected": False,
            "anomalies":        [],
            "detections":       [],
            "safety_score":     75,
            "inference_ms":     0.0,
        },
    }


def _mock_reset() -> None:
    pass


# ── Loader ────────────────────────────────────────────────────────────────────

def load_cv_pipeline() -> dict[str, Any]:
    """
    Loads CrowdAnalysisPipeline from ai/cv/inference.py. Idempotent.
    Returns the same bundle singleton on every call after the first.
    """
    global _bundle
    if _bundle is not None:
        return _bundle

    cv_inference_path = _CV_SRC_DIR / "inference.py"

    if not cv_inference_path.exists():
        logger.warning(
            "CV inference.py not found at %s — using mock fallback.", cv_inference_path
        )
        _bundle = _fallback(f"inference.py missing: {cv_inference_path}")
        return _bundle

    logger.info("Loading CV pipeline from %s …", cv_inference_path)
    t0 = time.perf_counter()

    try:
        spec = importlib.util.spec_from_file_location("cv_inference", cv_inference_path)
        if spec is None or spec.loader is None:
            raise ImportError("importlib could not build a spec for cv inference.py")

        module = importlib.util.module_from_spec(spec)

        cv_src = str(_CV_SRC_DIR)
        if cv_src not in sys.path:
            sys.path.insert(0, cv_src)

        spec.loader.exec_module(module)  # type: ignore[attr-defined]

    except Exception as exc:
        logger.error(
            "CV inference import failed after %.1f s: %s — using mock fallback.",
            time.perf_counter() - t0, exc, exc_info=True,
        )
        _bundle = _fallback(f"Import error: {exc}")
        return _bundle

    try:
        pipeline = module.CrowdAnalysisPipeline()
    except Exception as exc:
        logger.error(
            "CrowdAnalysisPipeline init failed after %.1f s: %s — using mock fallback.",
            time.perf_counter() - t0, exc, exc_info=True,
        )
        _bundle = _fallback(f"Pipeline init error: {exc}")
        return _bundle

    logger.info("✅ CV pipeline (YOLOv8 + MobileNetV2) ready in %.1f s", time.perf_counter() - t0)

    _bundle = {
        "model":      pipeline,
        "pipeline":   pipeline,
        "predict_fn": pipeline.predict,
        "reset_fn":   pipeline.reset,
        "status":     "loaded",
        "reason":     "",
    }
    return _bundle


def _fallback(reason: str) -> dict[str, Any]:
    return {
        "pipeline":   None,
        "predict_fn": _mock_predict,
        "reset_fn":   _mock_reset,
        "status":     "fallback",
        "reason":     reason,
    }


def get_cv_bundle() -> dict[str, Any]:
    """Public accessor for cv_service.py — returns the singleton."""
    return load_cv_pipeline()
