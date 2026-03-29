"""
backend_python/services/nlp_service.py
========================================
Business-logic wrapper around the NLP AI loader.

Delegates entirely to get_nlp_bundle()["model"] which is either the real
analyze_report() from ai/nlp/inference.py or the keyword-based mock.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from ai.nlp.loader import get_nlp_bundle

logger = logging.getLogger(__name__)


def analyze_report(text: str) -> dict[str, Any]:
    """
    Run the full NLP pipeline on a raw incident report string.

    Args
    ----
    text : Free-form incident report text (any length).

    Returns
    -------
    Full dict from inference.analyze_report() — keys include:
        sentiment, sentiment_score, distress_level, emotion,
        emotion_confidence, emotion_all_scores, emergency_level,
        is_emergency, matched_keywords, severity, credibility_score,
        credibility_label, credibility_flags, entities, duplicate_score,
        is_duplicate, duplicate_matched_index, auto_response,
        recommended_actions, word_count, processing_ms

    Plus an extra "loader_status" key added by this service.
    """
    if not text or not text.strip():
        raise ValueError("Report text must be a non-empty string.")

    bundle = get_nlp_bundle()
    t0 = time.perf_counter()

    try:
        result = bundle["model"](text)
    except Exception as exc:
        logger.error("NLP analyze_report raised: %s", exc, exc_info=True)
        result = _error_result(text, str(exc))

    result["loader_status"] = bundle["status"]
    result["processing_ms"] = round((time.perf_counter() - t0) * 1000, 2)
    return result


def _error_result(text: str, reason: str) -> dict[str, Any]:
    """Minimal valid result returned when the NLP callable raises."""
    return {
        "sentiment": "neutral",
        "sentiment_score": 0.0,
        "distress_level": "LOW",
        "emotion": "neutral",
        "emotion_confidence": 0.0,
        "emotion_all_scores": {},
        "emergency_level": "LOW",
        "is_emergency": False,
        "matched_keywords": [],
        "severity": 1.0,
        "credibility_score": 0,
        "credibility_label": "ERROR",
        "credibility_flags": ["PROCESSING_ERROR"],
        "entities": {
            "time": [], "location": [], "people": [],
            "clothing": [], "vehicles": [], "physical_description": [],
        },
        "duplicate_score": 0.0,
        "is_duplicate": False,
        "duplicate_matched_index": None,
        "auto_response": "Your report was received. An error occurred during analysis.",
        "recommended_actions": [],
        "word_count": len(text.split()),
        "processing_ms": 0.0,
        "error": reason,
    }
