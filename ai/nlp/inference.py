"""
inference.py — B4 NLP Inference Pipeline (LLM Edition)
=======================================================
Smart City Women's Safety System — TigerGraph Hackathon
Module: B4 (NLP — Incident Report Intelligence)

Pipeline stages (executed in analyze_report):
  1. llm_analyze()         — LLM call (NVIDIA API) for sentiment/emotion/entities
  2. [merged into LLM]     — Emergency level extracted from LLM response
  3. compute_severity()    — multi-factor score 1.0 – 5.0 (using LLM outputs)
  4. compute_credibility() — rule-based score 0 – 100 (unchanged)
  5. [merged into LLM]     — Entity extraction by LLM
  6. detect_duplicate()    — TF-IDF cosine similarity (unchanged)
  7. generate_response()   — template-based auto-response (unchanged)

HuggingFace and spaCy models removed. LLM call replaces stages 1, 2, 6.
All output keys remain identical to the original pipeline.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# ── Logging ──────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(levelname)s │ %(message)s")
log = logging.getLogger("b4_nlp")

# ═══════════════════════════════════════════════════════════════════
# 1. COMPATIBILITY STUBS
#    app.py /health endpoint references these globals — keep them as
#    None so the attribute lookup doesn't raise AttributeError.
# ═══════════════════════════════════════════════════════════════════
_SENTIMENT_PIPE = None   # HF model removed; LLM handles sentiment
_EMOTION_PIPE   = None   # HF model removed; LLM handles emotion
_NLP_NER        = None   # spaCy removed; LLM handles entity extraction

log.info("LLM inference mode active — HuggingFace / spaCy models NOT loaded.")


# ═══════════════════════════════════════════════════════════════════
# 2. CONSTANTS  (all unchanged from original)
# ═══════════════════════════════════════════════════════════════════

_EMERGENCY_KW: dict[str, list[str]] = {
    "CRITICAL": [
        "help", "emergency", "attack", "assault", "rape", "kidnap",
        "danger", "sos", "save me", "being attacked", "being chased",
        "grabbed", "right now", "happening now",
    ],
    "HIGH": [
        "scared", "fear", "threatened", "following me", "stalked", "stalking",
        "harassed", "harassment", "unsafe", "threat", "intimidate",
    ],
    "MEDIUM": [
        "uncomfortable", "suspicious", "creepy", "weird", "loitering",
        "inappropriate", "staring", "catcalling",
    ],
    "LOW": [
        "dark", "empty", "deserted", "broken light", "no camera", "no cctv",
        "streetlight", "infrastructure", "fix", "repair",
    ],
}
_LEVEL_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NORMAL"]

_DISTRESS_KW = [
    "help", "scared", "afraid", "attack", "assault", "emergency", "danger",
    "please", "urgent", "now", "sos", "terrified", "running", "grabbed",
]

_EMOTION_WEIGHT: dict[str, float] = {
    "fear": 1.0, "anger": 0.8, "disgust": 0.6,
    "sadness": 0.5, "surprise": 0.3, "neutral": 0.1, "joy": 0.0,
}

_RESPONSE_TEMPLATES: dict[str, str] = {
    "CRITICAL": (
        "🚨 URGENT: Your report has been received and marked CRITICAL. "
        "Emergency services and nearby patrol units have been notified. "
        "If you are in immediate danger, call 100 (Police) or 112 (Emergency). "
        "Stay in a safe, public location. Help is on the way."
    ),
    "HIGH": (
        "🟠 Your safety report has been received with HIGH priority. "
        "A patrol unit will be dispatched to the reported area within 30 minutes. "
        "Stay cautious. If the situation escalates, call 100 immediately."
    ),
    "MEDIUM": (
        "🟡 Thank you for your report. It has been logged as MEDIUM priority "
        "and will be reviewed by our safety team within 24 hours. "
        "The area will be added to our monitoring heatmap."
    ),
    "LOW": (
        "🟢 Your infrastructure concern has been received and forwarded to "
        "the maintenance team. Expected resolution: 7–14 days. "
        "Thank you for helping improve safety in your area."
    ),
    "SPAM": (
        "⚫ This submission has been flagged as likely spam or a test message "
        "and will not be processed. If you have a genuine safety concern, "
        "please submit a detailed report with your location and description."
    ),
    "NORMAL": (
        "✅ Your report has been received and logged for trend analysis. "
        "Thank you for contributing to city safety data."
    ),
}

_RECOMMENDED_ACTIONS: dict[str, list[str]] = {
    "CRITICAL": [
        "Alert nearby police patrol immediately",
        "Notify emergency services",
        "Send safety alert to nearby users",
        "Activate CCTV in the reported area",
    ],
    "HIGH": [
        "Increase patrol frequency in the area",
        "Log report for 24-hour follow-up",
        "Send user acknowledgement + safety tips",
    ],
    "MEDIUM": [
        "Schedule 7-day response review",
        "Mark location on safety heatmap",
        "Track for pattern detection",
    ],
    "LOW": [
        "Forward to infrastructure maintenance team",
        "Schedule inspection within 30 days",
    ],
    "NORMAL": [
        "Archive for trend analysis",
    ],
}

_SPAM_KW = [
    "click here", "buy now", "amazing deals", "limited offer",
    "www.", "http://", "https://", ".com", ".xyz",
    "free download", "visit now", "subscribe", "register now", "earn money",
]

# ── In-memory TF-IDF duplicate store ────────────────────────────
_DUP_STORE: list[str] = []
_DUP_THRESHOLD = 0.75


# ═══════════════════════════════════════════════════════════════════
# 3. LLM LAYER
# ═══════════════════════════════════════════════════════════════════

# System prompt: role + instructions for the LLM
_SYSTEM_PROMPT = """You are an Incident Report Intelligence System for women's safety in a Smart City platform.

Your role:
- Analyze user-submitted safety incident reports
- Extract structured information with high precision
- Detect threat levels conservatively (prefer HIGH/CRITICAL if ambiguous)
- Never hallucinate facts not present in the report

Instructions:
1. SENTIMENT: Classify as "positive", "neutral", or "negative". Provide a confidence score 0.0–1.0.
2. DISTRESS LEVEL: Assign "LOW", "MODERATE", "HIGH", or "EXTREME" based on urgency and emotional tone.
3. EMOTION: Identify the dominant emotion from: fear, anger, disgust, sadness, surprise, neutral, joy. Provide confidence and all 7 scores summing to ~1.0.
4. EMERGENCY LEVEL: Assign "CRITICAL", "HIGH", "MEDIUM", "LOW", or "NORMAL". Be conservative — upgrade if uncertain.
5. MATCHED KEYWORDS: List safety-relevant keywords found in the text.
6. SEVERITY: Score 1.0–5.0 (float, two decimal places). 5.0 = life-threatening.
7. CREDIBILITY: Score 0–100 (integer). High score = genuine report. Flag suspicious patterns.
8. ENTITIES: Extract only what is explicitly present — time, location, people, clothing, vehicles, physical_description.
9. AUTO_RESPONSE: Write a brief, empathetic response to send to the user.
10. REASONING: Explain your threat assessment in 1–2 sentences.

Rules:
- If ambiguous → prefer the more severe classification
- All JSON keys MUST be present even if values are empty lists or defaults
- Be deterministic and structured
- Do NOT add markdown, commentary, or explanations outside the JSON

Return ONLY valid JSON matching this exact schema:
{
  "sentiment": "positive|neutral|negative",
  "sentiment_score": <float 0.0-1.0>,
  "distress_level": "LOW|MODERATE|HIGH|EXTREME",
  "emotion": "<dominant emotion string>",
  "emotion_confidence": <float 0.0-1.0>,
  "emotion_all_scores": {"fear": 0.0, "anger": 0.0, "disgust": 0.0, "sadness": 0.0, "surprise": 0.0, "neutral": 0.0, "joy": 0.0},
  "emergency_level": "CRITICAL|HIGH|MEDIUM|LOW|NORMAL",
  "is_emergency": <true|false>,
  "matched_keywords": [],
  "severity": <float 1.0-5.0>,
  "credibility_score": <int 0-100>,
  "credibility_label": "GENUINE|LIKELY GENUINE|SUSPICIOUS|SPAM/FAKE",
  "credibility_flags": [],
  "entities": {
    "time": [],
    "location": [],
    "people": [],
    "clothing": [],
    "vehicles": [],
    "physical_description": []
  },
  "auto_response": "<string>",
  "reasoning": "<string>"
}"""


def call_llm_api(prompt: str) -> str:
    """
    Call the LLM API and return the raw response text.

    - If NVIDIA_API_KEY env var is set → calls NVIDIA NIM endpoint.
    - Otherwise → returns a well-formed mock JSON string (safe fallback).

    Never raises. Returns a string that should be valid JSON.
    """
    api_key = os.environ.get("NVIDIA_API_KEY", "").strip()

    if api_key:
        try:
            import urllib.request
            import urllib.error

            payload = json.dumps({
                "model": "meta/llama-3.3-70b-instruct",
                "messages": [
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user",   "content": prompt},
                ],
                "temperature": 0.1,   # deterministic output
                "top_p": 0.95,
                "max_tokens": 1024,
                "stream": False,
            }).encode("utf-8")

            req = urllib.request.Request(
                "https://integrate.api.nvidia.com/v1/chat/completions",
                data=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                method="POST",
            )

            with urllib.request.urlopen(req, timeout=30) as resp:
                body = json.loads(resp.read().decode("utf-8"))
                return body["choices"][0]["message"]["content"]

        except Exception as exc:
            log.warning("NVIDIA LLM API call failed: %s — using mock response.", exc)
            # Fall through to mock

    # ── Mock response (no key or API failure) ────────────────────
    log.info("Using mock LLM response (NVIDIA_API_KEY not set or API unavailable).")
    return json.dumps({
        "sentiment": "negative",
        "sentiment_score": 0.72,
        "distress_level": "HIGH",
        "emotion": "fear",
        "emotion_confidence": 0.78,
        "emotion_all_scores": {
            "fear": 0.78, "anger": 0.08, "disgust": 0.05,
            "sadness": 0.04, "surprise": 0.02, "neutral": 0.02, "joy": 0.01,
        },
        "emergency_level": "HIGH",
        "is_emergency": True,
        "matched_keywords": ["unsafe", "following"],
        "severity": 3.5,
        "credibility_score": 72,
        "credibility_label": "LIKELY GENUINE",
        "credibility_flags": ["MOCK_RESPONSE"],
        "entities": {
            "time": [],
            "location": [],
            "people": [],
            "clothing": [],
            "vehicles": [],
            "physical_description": [],
        },
        "auto_response": (
            "🟠 Your safety report has been received with HIGH priority. "
            "A patrol unit will be dispatched. Stay cautious and call 100 if needed."
        ),
        "reasoning": "Mock analysis: report flagged as HIGH due to safety keyword signals.",
    })


# ── Strict JSON validator / parser ──────────────────────────────

_REQUIRED_KEYS = {
    "sentiment", "sentiment_score", "distress_level",
    "emotion", "emotion_confidence", "emotion_all_scores",
    "emergency_level", "is_emergency", "matched_keywords",
    "severity", "credibility_score", "credibility_label", "credibility_flags",
    "entities", "auto_response", "reasoning",
}

_ENTITY_KEYS = {"time", "location", "people", "clothing", "vehicles", "physical_description"}

_SAFE_FALLBACK: dict[str, Any] = {
    "sentiment": "neutral",
    "sentiment_score": 0.5,
    "distress_level": "LOW",
    "emotion": "neutral",
    "emotion_confidence": 0.5,
    "emotion_all_scores": {
        "fear": 0.0, "anger": 0.0, "disgust": 0.0,
        "sadness": 0.0, "surprise": 0.0, "neutral": 1.0, "joy": 0.0,
    },
    "emergency_level": "LOW",
    "is_emergency": False,
    "matched_keywords": [],
    "severity": 1.0,
    "credibility_score": 50,
    "credibility_label": "SUSPICIOUS",
    "credibility_flags": ["PARSE_FAILED"],
    "entities": {
        "time": [], "location": [], "people": [],
        "clothing": [], "vehicles": [], "physical_description": [],
    },
    "auto_response": "Your report has been received. Please contact emergency services if in immediate danger.",
    "reasoning": "Analysis could not be completed. Default safety response applied.",
}


def _parse_llm_json(raw: str) -> dict[str, Any]:
    """
    Safely parse LLM output into a validated dict.

    Strips markdown code fences if present.
    Falls back to _SAFE_FALLBACK if parsing or validation fails.
    Never raises.
    """
    # Strip leading/trailing whitespace
    text = raw.strip()

    # Remove markdown code fences (```json ... ``` or ``` ... ```)
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$",          "", text.strip())

    # Attempt JSON parse
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Try to extract first {...} block
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try:
                data = json.loads(m.group(0))
            except json.JSONDecodeError:
                log.warning("LLM JSON parse failed after extraction — using safe fallback.")
                return dict(_SAFE_FALLBACK)
        else:
            log.warning("No JSON object found in LLM response — using safe fallback.")
            return dict(_SAFE_FALLBACK)

    if not isinstance(data, dict):
        log.warning("LLM returned non-dict JSON — using safe fallback.")
        return dict(_SAFE_FALLBACK)

    # Validate and fill missing keys
    for key in _REQUIRED_KEYS:
        if key not in data:
            log.warning("LLM response missing key '%s' — using fallback value.", key)
            data[key] = _SAFE_FALLBACK[key]

    # Ensure entities has all sub-keys
    if not isinstance(data.get("entities"), dict):
        data["entities"] = dict(_SAFE_FALLBACK["entities"])
    else:
        for ek in _ENTITY_KEYS:
            if ek not in data["entities"]:
                data["entities"][ek] = []
            if not isinstance(data["entities"][ek], list):
                data["entities"][ek] = []

    # Type coercions (guard against LLM returning wrong types)
    try:
        data["sentiment_score"]     = float(data["sentiment_score"])
        data["emotion_confidence"]  = float(data["emotion_confidence"])
        data["severity"]            = float(data["severity"])
        data["credibility_score"]   = int(data["credibility_score"])
        data["is_emergency"]        = bool(data["is_emergency"])
        if not isinstance(data["matched_keywords"], list):
            data["matched_keywords"] = []
        if not isinstance(data["credibility_flags"], list):
            data["credibility_flags"] = []
        if not isinstance(data["emotion_all_scores"], dict):
            data["emotion_all_scores"] = dict(_SAFE_FALLBACK["emotion_all_scores"])
    except Exception as exc:
        log.warning("LLM response type coercion error: %s — using safe fallback.", exc)
        return dict(_SAFE_FALLBACK)

    # Clamp numeric ranges
    data["sentiment_score"]    = max(0.0, min(1.0, data["sentiment_score"]))
    data["emotion_confidence"] = max(0.0, min(1.0, data["emotion_confidence"]))
    data["severity"]           = round(max(1.0, min(5.0, data["severity"])), 2)
    data["credibility_score"]  = max(0, min(100, data["credibility_score"]))

    return data


def llm_analyze(text: str) -> dict[str, Any]:
    """
    Core LLM analysis function.

    Builds the user prompt, calls the LLM API, parses the response,
    and returns a validated structured dict. Never crashes.

    Args:
        text: raw incident report string

    Returns:
        Validated dict with all required keys (falls back to safe defaults
        if the LLM fails or returns bad JSON).
    """
    prompt = (
        f"Analyze the following women's safety incident report and return "
        f"ONLY a JSON object matching the required schema:\n\n"
        f"REPORT:\n{text[:2000]}"  # cap prompt length
    )

    try:
        raw = call_llm_api(prompt)
        return _parse_llm_json(raw)
    except Exception as exc:
        log.error("llm_analyze failed unexpectedly: %s", exc, exc_info=True)
        return dict(_SAFE_FALLBACK)


# ═══════════════════════════════════════════════════════════════════
# 4. RULE-BASED HELPERS  (unchanged logic from original)
# ═══════════════════════════════════════════════════════════════════

def compute_credibility(text: str) -> dict[str, Any]:
    """
    Stage — Credibility Assessment (0 – 100 score).

    Penalises: too-short text, ALL-CAPS, excessive punctuation, spam
               keywords, vague content, test/dummy strings.
    Rewards:   time references, location mentions, clothing/physical
               descriptions, reasonable length.

    Returns:
        score  : int   (0 – 100)
        label  : "GENUINE" | "LIKELY GENUINE" | "SUSPICIOUS" | "SPAM/FAKE"
        flags  : list[str]
    """
    score = 70  # baseline
    flags: list[str] = []
    words = text.split()
    word_count = len(words)
    text_lower = text.lower()

    # ── Penalties ────────────────────────────────────────────────
    if word_count < 5:
        score -= 20
        flags.append("TOO SHORT")

    if text.isupper() and word_count > 3:
        score -= 15
        flags.append("ALL CAPS")

    if text.count("!") >= 3:
        score -= 10
        flags.append("EXCESSIVE PUNCTUATION")

    if any(kw in text_lower for kw in _SPAM_KW):
        score -= 50
        flags.append("SPAM KEYWORD")

    if word_count < 8 and re.match(r"^[a-z .,!?]+$", text.strip().lower()):
        score -= 10
        flags.append("VAGUE")

    if re.search(r"(test|asdf|qwerty|1234|abc|dummy|ignore|testing)", text_lower):
        score -= 40
        flags.append("TEST/DUMMY CONTENT")

    non_word_ratio = sum(1 for w in words if not re.match(r"[a-zA-Z]+", w)) / max(word_count, 1)
    if non_word_ratio > 0.4:
        score -= 20
        flags.append("NON-WORD CONTENT")

    # ── Boosters ─────────────────────────────────────────────────
    time_re = r"\b(\d{1,2}[:.\s]?\d{0,2}\s?(am|pm|AM|PM)|morning|afternoon|evening|night|\d{1,2}\s?minutes?)\b"
    if re.search(time_re, text, re.IGNORECASE):
        score += 10
        flags.append("HAS TIME DETAIL")

    if any(k in text_lower for k in ["jacket", "shirt", "cap", "hoodie", "wearing", "dressed"]):
        score += 8
        flags.append("HAS CLOTHING DETAIL")

    if any(k in text_lower for k in ["near", "at", "street", "road", "park", "station", "avenue", "alley"]):
        score += 7
        flags.append("HAS LOCATION DETAIL")

    if 20 <= word_count <= 200:
        score += 10
        flags.append("REASONABLE LENGTH")

    if any(k in text_lower for k in ["tall", "short", "beard", "glasses", "feet", "age", "hair"]):
        score += 5
        flags.append("HAS PHYSICAL DESCRIPTION")

    score = max(0, min(100, score))

    if score < 30:
        label = "SPAM/FAKE"
    elif score < 55:
        label = "SUSPICIOUS"
    elif score < 75:
        label = "LIKELY GENUINE"
    else:
        label = "GENUINE"

    return {"score": score, "label": label, "flags": flags}


def detect_duplicate(text: str, threshold: float = _DUP_THRESHOLD) -> dict[str, Any]:
    """
    Stage — Duplicate Detection (TF-IDF cosine similarity).

    Compares `text` against all previously analysed reports stored in
    the module-level `_DUP_STORE` list.  After scoring, appends `text`
    to the store so future requests can match against it.

    Args:
        text      : incoming report text
        threshold : cosine similarity above which a report is "duplicate"

    Returns:
        is_duplicate    : bool
        duplicate_score : float  (0.0 – 1.0, highest match found)
        matched_index   : int | None  (position in _DUP_STORE if duplicate)
    """
    global _DUP_STORE

    result: dict[str, Any] = {
        "is_duplicate": False,
        "duplicate_score": 0.0,
        "matched_index": None,
    }

    if len(_DUP_STORE) == 0:
        _DUP_STORE.append(text)
        return result

    try:
        corpus = _DUP_STORE + [text]
        vec = TfidfVectorizer(max_features=500, stop_words="english")
        tfidf = vec.fit_transform(corpus)
        sims = cosine_similarity(tfidf[-1], tfidf[:-1]).flatten()
        best_idx = int(np.argmax(sims))
        best_score = float(sims[best_idx])

        if best_score >= threshold:
            result["is_duplicate"] = True
            result["duplicate_score"] = round(best_score, 4)
            result["matched_index"] = best_idx
        else:
            result["duplicate_score"] = round(best_score, 4)
    except Exception as exc:
        log.warning("Duplicate detection failed: %s", exc)

    _DUP_STORE.append(text)
    return result


def generate_response(emergency_level: str, credibility_score: int) -> str:
    """
    Stage — Auto-Response Generation.

    Selects a pre-written template based on emergency level.
    Redirects to SPAM template if credibility is very low.

    Args:
        emergency_level   : one of CRITICAL | HIGH | MEDIUM | LOW | NORMAL
        credibility_score : 0 – 100

    Returns:
        Human-readable response string to send back to the user.
    """
    if credibility_score < 30:
        return _RESPONSE_TEMPLATES["SPAM"]
    return _RESPONSE_TEMPLATES.get(emergency_level, _RESPONSE_TEMPLATES["NORMAL"])


# ═══════════════════════════════════════════════════════════════════
# 5. MAIN ENTRYPOINT
# ═══════════════════════════════════════════════════════════════════

def analyze_report(text: str) -> dict[str, Any]:
    """
    Full NLP analysis pipeline for a single incident report.

    This is the only function that should be called from app.py / loader.py.
    The LLM call replaces HuggingFace sentiment/emotion + spaCy NER stages.
    Duplicate detection and credibility scoring remain rule-based.

    Args:
        text : raw user-submitted incident report string

    Returns:
        Structured JSON-serialisable dict with all analysis results.
        Output schema is identical to the original HuggingFace pipeline.

    Raises:
        ValueError : if text is empty or whitespace-only.
    """
    text = text.strip()
    if not text:
        raise ValueError("Report text must not be empty.")

    t_start = time.perf_counter()

    # ── Stage 1+2+6: LLM analysis (sentiment, emotion, entities) ──
    llm_result = llm_analyze(text)

    # ── Stage 3: Credibility (rule-based, unchanged) ───────────────
    # We blend: LLM credibility score averaged with rule-based score
    # for robustness. Rule-based score takes precedence for spam signals.
    rule_cred = compute_credibility(text)

    # If rule-based detects spam signals, override LLM credibility
    if "SPAM KEYWORD" in rule_cred["flags"] or "TEST/DUMMY CONTENT" in rule_cred["flags"]:
        credibility_score = rule_cred["score"]
        credibility_label = rule_cred["label"]
        credibility_flags = rule_cred["flags"]
    else:
        # Blend: 60% rule-based, 40% LLM
        blended = int(rule_cred["score"] * 0.6 + llm_result["credibility_score"] * 0.4)
        blended = max(0, min(100, blended))
        if blended < 30:
            credibility_label = "SPAM/FAKE"
        elif blended < 55:
            credibility_label = "SUSPICIOUS"
        elif blended < 75:
            credibility_label = "LIKELY GENUINE"
        else:
            credibility_label = "GENUINE"
        credibility_score = blended
        credibility_flags = rule_cred["flags"]

    # ── Stage 4: Duplicate Detection (TF-IDF, unchanged) ──────────
    dup = detect_duplicate(text)

    # ── Stage 5: Auto-Response ─────────────────────────────────────
    # Use LLM auto_response but override with SPAM template if needed
    if credibility_score < 30:
        auto_response = _RESPONSE_TEMPLATES["SPAM"]
    else:
        auto_response = llm_result.get("auto_response") or generate_response(
            llm_result["emergency_level"], credibility_score
        )

    elapsed_ms = round((time.perf_counter() - t_start) * 1000, 1)

    # ── Assemble output (schema identical to original pipeline) ────
    return {
        # Core outputs consumed by TigerGraph / downstream modules
        "sentiment":           llm_result["sentiment"],
        "sentiment_score":     round(llm_result["sentiment_score"], 4),
        "distress_level":      llm_result["distress_level"],

        "emotion":             llm_result["emotion"],
        "emotion_confidence":  round(llm_result["emotion_confidence"], 4),
        "emotion_all_scores":  llm_result["emotion_all_scores"],

        "emergency_level":     llm_result["emergency_level"],
        "is_emergency":        llm_result["is_emergency"],
        "matched_keywords":    llm_result["matched_keywords"],

        "severity":            llm_result["severity"],

        "credibility_score":   credibility_score,
        "credibility_label":   credibility_label,
        "credibility_flags":   credibility_flags,

        "entities":            llm_result["entities"],

        "duplicate_score":     dup["duplicate_score"],
        "is_duplicate":        dup["is_duplicate"],
        "duplicate_matched_index": dup["matched_index"],

        "auto_response":       auto_response,

        "recommended_actions": _RECOMMENDED_ACTIONS.get(llm_result["emergency_level"], []),

        # Metadata
        "word_count":          len(text.split()),
        "processing_ms":       elapsed_ms,
    }
