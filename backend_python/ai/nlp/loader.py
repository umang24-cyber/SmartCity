"""
backend_python/ai/nlp/loader.py
================================
Production loader for the NLP pipeline (ai/nlp/inference.py).

Design
------
* Imports ai/nlp/inference.py ONCE at server startup.
* inference.py loads all models (DistilBERT, RoBERTa, spaCy) at module
  import time — this is intentional and happens only on the first load.
* HuggingFace models are cached to ~/.cache/huggingface after the first
  download, so subsequent restarts are fast (~20–60 s).
* If the import fails for any reason, the loader logs the error and
  activates a lightweight keyword-based mock so the server keeps running.
* No dependency pre-checks. No download avoidance. Production path always.

Bundle shape
------------
{
    "analyze_report": callable,   # inference.analyze_report OR mock
    "module":         <module> | None,
    "status":         "loaded" | "fallback",
    "reason":         str,         # empty on success
}
"""

from __future__ import annotations

import importlib.util
import logging
import sys
import time
from typing import Any, Optional

logger = logging.getLogger(__name__)

from config import AI_ROOT, NLP_ENTRYPOINT

_NLP_SRC_DIR = AI_ROOT / "nlp"

# Module-level singleton — populated once, reused for every request.
_bundle: Optional[dict[str, Any]] = None


# ── Mock fallback (only used if inference.py itself fails to import) ──────────

def _mock_analyze_report(text: str) -> dict[str, Any]:
    """
    Keyword-based fallback. Mirrors the exact schema of inference.analyze_report()
    so the service layer never needs null-checks.
    """
    t = text.lower()
    critical_keywords = [
        "attack", "assault", "emergency", "help", "danger", "sos",
        "chasing", "chased", "police", "kidnap", "rape",
    ]
    high_keywords = [
        "scared", "followed", "following", "threatened", "harassed", "unsafe",
        "stalking", "stalker",
    ]
    medium_keywords = ["suspicious", "uncomfortable", "dark", "loitering"]
    matched = sorted(
        {
            k for k in (critical_keywords + high_keywords + medium_keywords)
            if k in t
        }
    )
    if any(k in t for k in critical_keywords):
        level, sev, emotion = "CRITICAL", 4.5, "fear"
    elif any(k in t for k in high_keywords):
        level, sev, emotion = "HIGH",     3.5, "fear"
    elif any(k in t for k in medium_keywords):
        level, sev, emotion = "MEDIUM",   2.5, "disgust"
    else:
        level, sev, emotion = "LOW",      1.5, "neutral"

    wc = len(text.split())
    cred = min(100, max(30, 40 + wc * 2))
    responses = {
        "CRITICAL": "🚨 URGENT: Your report has been received. Emergency services notified.",
        "HIGH":     "🟠 HIGH priority report received. Patrol unit being dispatched.",
        "MEDIUM":   "🟡 MEDIUM priority report logged. Safety team will review within 24h.",
        "LOW":      "🟢 Your concern has been forwarded to the maintenance team.",
    }
    return {
        "sentiment": "negative" if level != "LOW" else "neutral",
        "sentiment_score": 0.72,
        "distress_level": "HIGH" if emotion == "fear" else "LOW",
        "emotion": emotion,
        "emotion_confidence": 0.65,
        "emotion_all_scores": {
            "fear": 0.65, "anger": 0.10, "disgust": 0.08,
            "sadness": 0.07, "neutral": 0.05, "surprise": 0.03, "joy": 0.02,
        },
        "emergency_level": level,
        "is_emergency": level in ("CRITICAL", "HIGH"),
        "matched_keywords": matched,
        "severity": sev,
        "credibility_score": cred,
        "credibility_label": "LIKELY GENUINE" if cred >= 55 else "SUSPICIOUS",
        "credibility_flags": ["FALLBACK_MODE"],
        "entities": {
            "time": [], "location": [], "people": [],
            "clothing": [], "vehicles": [], "physical_description": [],
        },
        "duplicate_score": 0.0,
        "is_duplicate": False,
        "duplicate_matched_index": None,
        "auto_response": responses[level],
        "recommended_actions": [],
        "word_count": wc,
        "processing_ms": 0.0,
    }


# ── Loader ────────────────────────────────────────────────────────────────────

def load_nlp_pipeline() -> dict[str, Any]:
    """
    Loads ai/nlp/inference.py and returns the bundle singleton.

    Calling this for the first time triggers:
      1. spaCy model load
      2. DistilBERT (distilbert-base-uncased-finetuned-sst-2-english) load
      3. RoBERTa (j-hartmann/emotion-english-distilroberta-base) load

    HuggingFace models are auto-downloaded and cached on first run.
    Returns the same object on every subsequent call (singleton).
    """
    global _bundle
    if _bundle is not None:
        return _bundle

    if not NLP_ENTRYPOINT.exists():
        logger.warning(
            "NLP inference.py not found at %s — using keyword fallback.", NLP_ENTRYPOINT
        )
        _bundle = _fallback(f"inference.py missing: {NLP_ENTRYPOINT}")
        return _bundle

    logger.info(
        "Loading NLP pipeline from %s "
        "(first run downloads HuggingFace models — this may take several minutes) …",
        NLP_ENTRYPOINT,
    )
    t0 = time.perf_counter()

    try:
        spec = importlib.util.spec_from_file_location("nlp_inference", NLP_ENTRYPOINT)
        if spec is None or spec.loader is None:
            raise ImportError("importlib could not build a spec for nlp inference.py")

        module = importlib.util.module_from_spec(spec)

        # Ensure ai/nlp/ sub-imports resolve correctly
        nlp_src = str(_NLP_SRC_DIR)
        if nlp_src not in sys.path:
            sys.path.insert(0, nlp_src)

        # ← This line loads ALL models in inference.py (module-level globals)
        spec.loader.exec_module(module)  # type: ignore[attr-defined]

    except Exception as exc:
        logger.error(
            "NLP inference import failed after %.1f s: %s — activating keyword fallback.",
            time.perf_counter() - t0,
            exc,
            exc_info=True,
        )
        _bundle = _fallback(f"Import error: {exc}")
        return _bundle

    if not callable(getattr(module, "analyze_report", None)):
        logger.error(
            "NLP inference.py loaded but analyze_report() not found — keyword fallback."
        )
        _bundle = _fallback("analyze_report() not found in module")
        return _bundle

    logger.info(
        "✅ NLP pipeline ready (LLM mode — NVIDIA NIM / mock) in %.1f s",
        time.perf_counter() - t0,
    )

    _bundle = {
        "model": module.analyze_report,
        "module":         module,
        "status":         "loaded",
        "reason":         "",
    }
    return _bundle


def _fallback(reason: str) -> dict[str, Any]:
    return {
        "model": _mock_analyze_report,
        "module":         None,
        "status":         "fallback",
        "reason":         reason,
    }


def get_nlp_bundle() -> dict[str, Any]:
    """Public accessor for nlp_service.py — returns the singleton."""
    return load_nlp_pipeline()
