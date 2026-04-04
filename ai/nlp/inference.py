"""
inference.py — B4 NLP Inference Pipeline (LLM Edition)
=======================================================
Smart City Women's Safety System — TigerGraph Hackathon
Module: B4 (NLP — Incident Report Intelligence)

Pipeline stages (executed in analyze_report):
  0. is_non_incident()      — pre-LLM guard: returns SAFE_NON_INCIDENT for food/casual text
  1. llm_analyze()          — LLM call (NVIDIA API) for sentiment/emotion/entities
  2. [merged into LLM]      — Emergency level extracted from LLM response
  3. compute_credibility()  — rule-based score 0 – 100 (unchanged)
  4. [merged into LLM]      — Entity extraction by LLM
  5. detect_duplicate()     — TF-IDF cosine similarity (unchanged)
  6. generate_response()    — template-based auto-response (unchanged)

HuggingFace and spaCy models removed. LLM call replaces stages 1, 2, 4.
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
# 2. CONSTANTS
# ═══════════════════════════════════════════════════════════════════

# Safety keywords organized by emergency level.
# IMPORTANT: every keyword here is *only* added to matched_keywords if
# the keyword literally appears in the report text (text_lower check).
_EMERGENCY_KW: dict[str, list[str]] = {
    "CRITICAL": [
        "help", "emergency", "attack", "assault", "rape", "kidnap",
        "danger", "sos", "save me", "being attacked", "being chased",
        "grabbed", "right now", "happening now", "chasing me", "please help",
        "someone attacked", "i am in danger", "call police", "send help",
    ],
    "HIGH": [
        "scared", "fear", "threatened", "following me", "he is following",
        "stalked", "stalking", "harassed", "harassment", "unsafe", "threat",
        "intimidate", "chasing", "following", "someone is following",
        "feels dangerous", "i am afraid", "terrified",
    ],
    "MEDIUM": [
        "uncomfortable", "suspicious", "creepy", "weird", "loitering",
        "inappropriate", "staring", "catcalling", "being watched",
        "looks suspicious",
    ],
    "LOW": [
        "dark", "empty", "deserted", "broken light", "no camera", "no cctv",
        "streetlight", "infrastructure", "fix", "repair",
    ],
}

# All safety keywords flattened — used for non-incident guard and expansion
_ALL_SAFETY_KW: frozenset[str] = frozenset(
    kw for kws in _EMERGENCY_KW.values() for kw in kws
)

_LEVEL_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NORMAL"]

# Phrases that alone force CRITICAL — present-tense immediate threat.
# Only applied when the phrase is literally found in text_lower.
_CRITICAL_FORCE_PHRASES = [
    "following me", "chasing me", "right now", "happening now",
    "he is following", "someone is following", "please help",
    "send help", "call police", "i am in danger", "help me",
]

_DISTRESS_KW = [
    "help", "scared", "afraid", "attack", "assault", "emergency", "danger",
    "please", "urgent", "sos", "terrified", "running", "grabbed",
    "chasing", "following", "stalking", "kidnap", "threat", "save",
    "rape", "unsafe", "fear",
]

# ── NON-INCIDENT detection word lists ───────────────────────────
# Words that strongly signal irrelevant / non-safety content.
# We check: text has ≥1 non-incident word AND zero safety keywords.
_FOOD_WORDS = frozenset([
    "pizza", "burger", "hot dog", "hot dogs", "hotdog", "sandwich", "taco",
    "sushi", "pasta", "noodle", "rice", "breakfast", "lunch", "dinner",
    "coffee", "tea", "beer", "wine", "snack", "cookie", "cake", "dessert",
    "restaurant", "eat", "eating", "food", "meal", "hungry", "delicious",
    "yummy", "tasty", "recipe", "cook", "cooking", "bake",
])

_CASUAL_WORDS = frozenset([
    "hello", "hi", "hey", "yo", "sup", "lol", "haha", "hehe", "lmao",
    "bye", "goodbye", "goodnight", "morning", "evening", "weekend",
    "movie", "music", "song", "game", "sport", "cricket", "football",
    "shopping", "mall", "sale", "discount", "clothes", "fashion",
    "love", "like", "cool", "awesome", "nice", "great", "good",
    "happy", "excited", "fun", "enjoy", "enjoy", "bored", "tired",
    "weather", "rain", "sunny", "hot", "cold", "temperature",
])

_JUNK_PATTERN = re.compile(
    r"^[a-z0-9 ]{1,30}$"  # very short lowercase-only with digits
)


# ── Root-word safety signals ────────────────────────────────────
# These are checked by substring (`in text_lower`) so "following" catches
# "someone is following me", "chasing" catches "chasing me", etc.
# Deliberately broad — a false negative (missing a real incident) is far
# worse than a false positive (letting the LLM see a benign text).
_SAFETY_ROOT_SIGNALS: tuple[str, ...] = (
    "follow", "chase", "attack", "assault", "rape", "kidnap",
    "stalk", "harass", "threat", "danger", "unsafe", "emergency",
    "help", "scared", "afraid", "terrif", "grabbed", "sos",
    "hurt", "hit me", "beat", "abuse", "molest", "force",
    "creep", "suspicious", "uncomfortable", "following",
    "sector", "street", "road", "area",  # location = plausible incident
)


def _is_non_incident(text: str) -> bool:
    """
    Returns True ONLY if the text is unambiguously non-safety content
    (food, casual chat, junk) AND contains zero safety signals.

    Safety-first: when in doubt, return False (let LLM decide).
    This function NEVER raises.
    """
    text_lower = text.lower().strip()
    words = text_lower.split()
    word_count = len(words)

    if word_count == 0:
        return True

    # ── SAFETY GATE: any safety signal → never a non-incident ────
    # Check 1: root-word signals (substring match → catches morphological variants)
    for sig in _SAFETY_ROOT_SIGNALS:
        if sig in text_lower:
            return False

    # Check 2: exact keyword list (catches multi-word phrases)
    for kw in _ALL_SAFETY_KW:
        if kw in text_lower:
            return False

    # Check 3: force-CRITICAL phrases
    for phrase in _CRITICAL_FORCE_PHRASES:
        if phrase in text_lower:
            return False

    # Short input with no safety signals → non-incident
    if word_count < 3:
        return True

    # Food or casual token signal
    text_words = set(words)
    text_bigrams = {f"{words[i]} {words[i+1]}" for i in range(len(words) - 1)}
    all_tokens = text_words | text_bigrams

    if _FOOD_WORDS & all_tokens:
        return True
    if _CASUAL_WORDS & all_tokens:
        return True

    return False


# ── SAFE_NON_INCIDENT constant ────────────────────────────────────
# Returned immediately when _is_non_incident() fires.
# Schema is identical to the full output — all keys present.
_SAFE_NON_INCIDENT: dict[str, Any] = {
    "sentiment":           "neutral",
    "sentiment_score":     0.5,
    "distress_level":      "LOW",
    "emotion":             "neutral",
    "emotion_confidence":  0.9,
    "emotion_all_scores":  {
        "fear": 0.0, "anger": 0.0, "disgust": 0.0,
        "sadness": 0.0, "surprise": 0.0, "neutral": 0.9, "joy": 0.1,
    },
    "emergency_level":     "NORMAL",
    "is_emergency":        False,
    "matched_keywords":    [],
    "severity":            1.0,
    "credibility_score":   20,
    "credibility_label":   "SPAM/FAKE",
    "credibility_flags":   ["NON-INCIDENT"],
    "entities": {
        "time": [], "location": [], "people": [],
        "clothing": [], "vehicles": [], "physical_description": [],
    },
    "auto_response": (
        "⚫ This does not appear to be a safety-related report. "
        "If you have a genuine safety concern, please describe the incident in detail."
    ),
    "reasoning": "Input classified as non-incident: no safety keywords detected.",
}


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

# System prompt updated: explicitly instructs model NOT to classify
# irrelevant / non-safety text as emergencies.
_SYSTEM_PROMPT = """You are an Incident Report Intelligence System for women's safety in a Smart City platform.

Your role:
- Analyze user-submitted safety incident reports
- Extract structured information with high precision
- Detect threat levels conservatively
- Never hallucinate facts not present in the report
- If the input is NOT a safety-related incident (e.g. food talk, casual conversation, random words), classify it as NORMAL with severity 1.0 and emotion neutral. Do NOT invent threats.

Instructions:
1. SENTIMENT: Classify as "positive", "neutral", or "negative". Provide a confidence score 0.0–1.0.
2. DISTRESS LEVEL: Assign "LOW", "MODERATE", "HIGH", or "EXTREME" based on urgency and emotional tone.
3. EMOTION: Identify the dominant emotion from: fear, anger, disgust, sadness, surprise, neutral, joy. Provide confidence and all 7 scores summing to ~1.0.
4. EMERGENCY LEVEL: Assign "CRITICAL", "HIGH", "MEDIUM", "LOW", or "NORMAL". Use NORMAL for non-safety content.
5. MATCHED KEYWORDS: List ONLY safety-relevant keywords that are LITERALLY PRESENT in the input text. Do not invent keywords.
6. SEVERITY: Score 1.0–5.0 (float, two decimal places). Use 1.0 for irrelevant content. 5.0 = life-threatening.
7. CREDIBILITY: Score 0–100 (integer). High score = genuine report. Flag suspicious patterns.
8. ENTITIES: Extract only what is explicitly present — time, location, people, clothing, vehicles, physical_description.
9. AUTO_RESPONSE: Write a brief, empathetic response to send to the user.
10. REASONING: Explain your threat assessment in 1–2 sentences.

Rules:
- If text contains NO safety-related content → emergency_level=NORMAL, severity=1.0, emotion=neutral, matched_keywords=[]
- If ambiguous safety content → prefer the more severe classification
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


def _build_mock_response(text: str) -> dict[str, Any]:
    """
    Build a context-aware mock response when NVIDIA_API_KEY is unavailable.

    Instead of always returning HIGH+fear, we check whether the text
    contains actual safety keywords and scale the response accordingly.
    This prevents 'I love hot dogs' from getting HIGH/fear in mock mode.
    """
    text_lower = text.lower()

    # Check if ANY safety keyword is present
    has_safety_kw = any(kw in text_lower for kw in _ALL_SAFETY_KW)
    has_force_phrase = any(p in text_lower for p in _CRITICAL_FORCE_PHRASES)
    word_count = len(text.split())

    if has_force_phrase or (has_safety_kw and word_count >= 3):
        # Genuine-looking safety report in mock mode
        return {
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
            # Only include keywords that are literally present in text
            "matched_keywords": [kw for kw in ["unsafe", "following", "scared", "help"]
                                  if kw in text_lower],
            "severity": 3.5,
            "credibility_score": 72,
            "credibility_label": "LIKELY GENUINE",
            "credibility_flags": ["MOCK_RESPONSE"],
            "entities": {
                "time": [], "location": [], "people": [],
                "clothing": [], "vehicles": [], "physical_description": [],
            },
            "auto_response": (
                "🟠 Your safety report has been received with HIGH priority. "
                "A patrol unit will be dispatched. Stay cautious and call 100 if needed."
            ),
            "reasoning": "Mock analysis: report flagged as HIGH due to safety keyword signals.",
        }
    else:
        # Non-safety / irrelevant content in mock mode → NORMAL
        return {
            "sentiment": "neutral",
            "sentiment_score": 0.5,
            "distress_level": "LOW",
            "emotion": "neutral",
            "emotion_confidence": 0.85,
            "emotion_all_scores": {
                "fear": 0.0, "anger": 0.0, "disgust": 0.0,
                "sadness": 0.0, "surprise": 0.05, "neutral": 0.85, "joy": 0.1,
            },
            "emergency_level": "NORMAL",
            "is_emergency": False,
            "matched_keywords": [],
            "severity": 1.0,
            "credibility_score": 20,
            "credibility_label": "SPAM/FAKE",
            "credibility_flags": ["MOCK_RESPONSE", "NON-INCIDENT"],
            "entities": {
                "time": [], "location": [], "people": [],
                "clothing": [], "vehicles": [], "physical_description": [],
            },
            "auto_response": (
                "⚫ This does not appear to be a safety-related report. "
                "Please submit a genuine incident description if you need help."
            ),
            "reasoning": "Mock analysis: no safety keywords detected. Classified as non-incident.",
        }


def call_llm_api(prompt: str, original_text: str = "") -> str:
    """
    Call the LLM API and return the raw response text.

    - If NVIDIA_API_KEY env var is set → calls NVIDIA NIM endpoint.
    - Otherwise → returns a context-aware mock JSON string.

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
                "temperature": 0.1,
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

    # ── Context-aware mock (no key or API failure) ───────────────
    log.info("Using mock LLM response (NVIDIA_API_KEY not set or API unavailable).")
    return json.dumps(_build_mock_response(original_text))


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
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$",          "", text.strip())

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
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

    for key in _REQUIRED_KEYS:
        if key not in data:
            log.warning("LLM response missing key '%s' — using fallback value.", key)
            data[key] = _SAFE_FALLBACK[key]

    if not isinstance(data.get("entities"), dict):
        data["entities"] = dict(_SAFE_FALLBACK["entities"])
    else:
        for ek in _ENTITY_KEYS:
            if ek not in data["entities"]:
                data["entities"][ek] = []
            if not isinstance(data["entities"][ek], list):
                data["entities"][ek] = []

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
    """
    prompt = (
        f"Analyze the following women's safety incident report and return "
        f"ONLY a JSON object matching the required schema:\n\n"
        f"REPORT:\n{text[:2000]}"
    )

    try:
        raw = call_llm_api(prompt, original_text=text)
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
    time_re = r"\b(\d{1,2}[:.\\s]?\d{0,2}\s?(am|pm|AM|PM)|morning|afternoon|evening|night|\d{1,2}\s?minutes?)\b"
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

    DO NOT MODIFY — unchanged from original.
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
    """
    if credibility_score < 30:
        return _RESPONSE_TEMPLATES["SPAM"]
    return _RESPONSE_TEMPLATES.get(emergency_level, _RESPONSE_TEMPLATES["NORMAL"])


# ── Severity tier weights ────────────────────────────────────────
# Each tier contributes additively (highest tier wins the base,
# lower tiers add fractional mass).
_SEVERITY_TIER: dict[str, tuple[float, float]] = {
    # tier → (base_score, per_extra_kw_bonus)
    "CRITICAL": (4.2, 0.15),
    "HIGH":     (2.8, 0.12),
    "MEDIUM":   (1.8, 0.10),
    "LOW":      (1.3, 0.05),
}

# Urgency phrases multiply the raw score
_URGENCY_PHRASES: tuple[str, ...] = (
    "right now", "happening now", "please help", "help me",
    "i am in danger", "someone is following me", "following me",
    "chasing me", "send help", "call police", "help!",
    "urgent", "immediately",
)


def compute_severity(
    text_lower: str,
    matched_keywords: list[str],
    emotion: str,
    emotion_confidence: float,
) -> tuple[float, str]:
    """
    Compute a deterministic severity score (1.0 – 5.0) and derive
    the canonical emergency_level from it.

    Scoring is weighted and prioritised:
      1. Highest threat-tier keywords found in text (primary driver)
      2. Urgency-phrase multiplier (+20 % if present)
      3. Emotion signal (supporting, capped contribution)

    Returns:
        (severity : float, emergency_level : str)

    The LLM's own emergency_level and severity fields are IGNORED;
    this function is the single source of truth.
    """
    base  = 1.0
    bonus = 0.0
    top_tier: str | None = None

    # ── Step 1: keyword-tier scoring ────────────────────────────
    tier_counts: dict[str, int] = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    kw_set_lower = {kw.lower() for kw in matched_keywords}

    for tier, kws in _EMERGENCY_KW.items():
        for kw in kws:
            if kw in text_lower or kw in kw_set_lower:
                tier_counts[tier] += 1

    # Walk tiers highest-first: first matching tier sets the base
    for tier in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
        count = tier_counts[tier]
        if count > 0:
            tier_base, per_kw = _SEVERITY_TIER[tier]
            if top_tier is None:
                base = tier_base
                top_tier = tier
            # Additional keywords in the same tier add small bonus
            bonus += per_kw * count

    raw_score = base + bonus

    # ── Step 2: urgency multiplier ──────────────────────────────
    if any(up in text_lower for up in _URGENCY_PHRASES):
        raw_score *= 1.20

    # ── Step 3: emotion support (small additive, capped at +0.4) ─
    emotion_add = _EMOTION_WEIGHT.get(emotion, 0.0) * emotion_confidence * 0.5
    raw_score += min(0.4, emotion_add)

    # ── Step 4: clamp and round ─────────────────────────────────
    severity = round(max(1.0, min(5.0, raw_score)), 2)

    # ── Step 5: derive emergency_level from severity ─────────────
    if severity >= 4.2:
        emergency_level = "CRITICAL"
    elif severity >= 3.0:
        emergency_level = "HIGH"
    elif severity >= 2.0:
        emergency_level = "MEDIUM"
    elif severity >= 1.25:
        emergency_level = "LOW"
    else:
        emergency_level = "NORMAL"

    return severity, emergency_level


# ═══════════════════════════════════════════════════════════════════
# 5. MAIN ENTRYPOINT
# ═══════════════════════════════════════════════════════════════════

def analyze_report(text: str) -> dict[str, Any]:
    """
    Full NLP analysis pipeline for a single incident report.

    This is the only function that should be called from app.py / loader.py.
    The LLM call replaces HuggingFace sentiment/emotion + spaCy NER stages.
    Duplicate detection and credibility scoring remain rule-based.

    Pipeline:
      Stage 0 — Non-incident guard (pre-LLM, rule-based)
      Stage 1 — LLM analysis
      Stage 2 — Keyword verification (text-presence check, anti-hallucination)
      Stage 3 — Force-CRITICAL check (present-tense threat phrases)
      Stage 4 — Post-LLM sanity check (no safety kw → NORMAL)
      Stage 5 — Credibility scoring (rule-based blend)
      Stage 6 — Credibility/emergency contradiction guard
      Stage 7 — Duplicate detection (TF-IDF, unchanged)
      Stage 8 — Auto-response

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
    text_lower = text.lower()
    word_count = len(text.split())  # always computed from text directly

    # ════════════════════════════════════════════════════════════
    # STAGE 0-A — STRONG EMERGENCY EARLY-EXIT  ← runs FIRST
    # ════════════════════════════════════════════════════════════
    # If ANY high-confidence threat signal is present, bypass ALL
    # downstream filters (non-incident guard, sanity check) and send
    # the text straight to the LLM.  This prevents false rejection of
    # real-danger reports such as "someone is following me right now".
    _STRONG_SIGNALS: tuple[str, ...] = (
        "following me", "being followed", "someone is following",
        "chasing me", "being chased", "chasing",
        "please help", "help me", "send help", "call police",
        "right now", "happening now",
        "i am in danger", "i am scared", "i am afraid",
        "attacked", "grabbed", "assault", "rape", "kidnap",
        "stalking me", "harassing me",
    )
    _is_strong_emergency = any(sig in text_lower for sig in _STRONG_SIGNALS)

    if _is_strong_emergency:
        log.info("Strong emergency signal detected — bypassing non-incident guard.")
        # Skip straight to LLM (Stage 1) — no non-incident short-circuit

    # ════════════════════════════════════════════════════════════
    # STAGE 0-B — NON-INCIDENT GUARD (only if NOT strong emergency)
    # ════════════════════════════════════════════════════════════
    elif _is_non_incident(text):
        log.info(
            "Non-incident detected (word_count=%d) — skipping LLM. text='%.60s'",
            word_count, text,
        )
        elapsed_ms = round((time.perf_counter() - t_start) * 1000, 1)
        dup = detect_duplicate(text)
        return {
            **_SAFE_NON_INCIDENT,
            "duplicate_score":          dup["duplicate_score"],
            "is_duplicate":             dup["is_duplicate"],
            "duplicate_matched_index":  dup["matched_index"],
            "recommended_actions":      _RECOMMENDED_ACTIONS.get("NORMAL", []),
            "word_count":               word_count,
            "processing_ms":            elapsed_ms,
            "loader_status":            "non_incident_guard",
        }

    # ════════════════════════════════════════════════════════════
    # STAGE 0-C — EARLY DUPLICATE DETECTION  ← before LLM
    # ════════════════════════════════════════════════════════════
    # Check for duplicates BEFORE calling the LLM.  If the report
    # is a duplicate of something already in the store, skip all
    # processing and return a minimal duplicate-rejection response.
    # detect_duplicate() also appends to _DUP_STORE; for true
    # duplicates we deliberately do NOT re-append (already there).
    dup_early = detect_duplicate(text)
    if dup_early["is_duplicate"]:
        elapsed_ms = round((time.perf_counter() - t_start) * 1000, 1)
        log.info(
            "Duplicate detected early (score=%.3f, idx=%s) — skipping LLM.",
            dup_early["duplicate_score"], dup_early["matched_index"],
        )
        return {
            # Minimal response — enough for the caller to act on
            "sentiment":           "neutral",
            "sentiment_score":     0.5,
            "distress_level":      "LOW",
            "emotion":             "neutral",
            "emotion_confidence":  0.5,
            "emotion_all_scores":  {
                "fear": 0.0, "anger": 0.0, "disgust": 0.0,
                "sadness": 0.0, "surprise": 0.0, "neutral": 1.0, "joy": 0.0,
            },
            "emergency_level":     "NORMAL",
            "is_emergency":        False,
            "matched_keywords":    [],
            "severity":            1.0,
            "credibility_score":   0,
            "credibility_label":   "SPAM/FAKE",
            "credibility_flags":   ["DUPLICATE"],
            "entities": {
                "time": [], "location": [], "people": [],
                "clothing": [], "vehicles": [], "physical_description": [],
            },
            "duplicate_score":              dup_early["duplicate_score"],
            "is_duplicate":                 True,
            "duplicate_matched_index":      dup_early["matched_index"],
            "auto_response": (
                "⚠️ This report appears to be a duplicate of a previously submitted "
                "incident. Your original report is already being processed. "
                "If the situation has changed, please submit a new detailed report."
            ),
            "recommended_actions":          [],
            "word_count":                   word_count,
            "processing_ms":                elapsed_ms,
            "loader_status":                "duplicate_rejected",
        }

    # ════════════════════════════════════════════════════════════
    # STAGE 1 — LLM ANALYSIS
    # ════════════════════════════════════════════════════════════
    llm_result = llm_analyze(text)

    # ════════════════════════════════════════════════════════════
    # STAGE 2 — MATCHED KEYWORDS: text-presence verification
    # ════════════════════════════════════════════════════════════
    # A keyword is only included if it is LITERALLY present in text.
    verified_from_llm = [
        kw for kw in llm_result.get("matched_keywords", [])
        if isinstance(kw, str) and kw.lower() in text_lower
    ]
    kw_set = set(verified_from_llm)
    for kw in _ALL_SAFETY_KW:
        if kw in text_lower:
            kw_set.add(kw)
    for kw in _DISTRESS_KW:
        if kw in text_lower:
            kw_set.add(kw)
    matched_keywords = sorted(kw_set)
    llm_result["matched_keywords"] = matched_keywords

    # ════════════════════════════════════════════════════════════
    # STAGE 3 — UNIFIED SEVERITY SCORING (single source of truth)
    # ════════════════════════════════════════════════════════════
    # severity and emergency_level are both derived here from
    # keyword tiers + urgency + emotion.  The LLM's own values
    # for these two fields are DISCARDED — they were unreliable
    # (mock always returned 3.5; LLM varied unpredictably).
    severity, emergency_level = compute_severity(
        text_lower=text_lower,
        matched_keywords=matched_keywords,
        emotion=llm_result["emotion"],
        emotion_confidence=llm_result["emotion_confidence"],
    )
    llm_result["severity"]         = severity
    llm_result["emergency_level"]  = emergency_level
    llm_result["is_emergency"]     = emergency_level in ("CRITICAL", "HIGH")
    log.info(
        "Severity computed: %.2f → %s (keywords=%d)",
        severity, emergency_level, len(matched_keywords),
    )

    # ════════════════════════════════════════════════════════════
    # STAGE 4 — POST-LLM SANITY CHECK
    # ════════════════════════════════════════════════════════════
    # If compute_severity() already set NORMAL (no keywords, no
    # urgency) and the LLM wanted something higher, leave it NORMAL.
    # If compute_severity() returned a real level, honour it.
    has_any_safety_kw   = bool(kw_set)
    _has_critical_phrase = any(p in text_lower for p in _CRITICAL_FORCE_PHRASES)

    # Only force-upgrade to CRITICAL if a critical phrase is present
    # AND compute_severity() under-scored (e.g. keyword not in list)
    if _has_critical_phrase and _LEVEL_ORDER.index(emergency_level) > _LEVEL_ORDER.index("CRITICAL"):
        emergency_level            = "CRITICAL"
        severity                   = max(severity, 4.5)
        llm_result["emergency_level"] = "CRITICAL"
        llm_result["is_emergency"]    = True
        log.info("CRITICAL forced by critical-force phrase (compute_severity under-scored).")

    # ════════════════════════════════════════════════════════════
    # STAGE 5 — CREDIBILITY SCORING (rule-based blend)
    # ════════════════════════════════════════════════════════════
    rule_cred = compute_credibility(text)

    if "SPAM KEYWORD" in rule_cred["flags"] or "TEST/DUMMY CONTENT" in rule_cred["flags"]:
        credibility_score = rule_cred["score"]
        credibility_label = rule_cred["label"]
        credibility_flags = rule_cred["flags"]
    else:
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

    # ════════════════════════════════════════════════════════════
    # STAGE 6 — CREDIBILITY / EMERGENCY CONTRADICTION GUARD
    # ════════════════════════════════════════════════════════════
    if credibility_score < 30 and emergency_level in ("CRITICAL", "HIGH"):
        log.info(
            "Emergency level downgraded: credibility=%d (< 30)",
            credibility_score,
        )
        emergency_level  = "NORMAL"
        severity         = 1.0
        llm_result["emergency_level"] = "NORMAL"
        llm_result["is_emergency"]    = False

    # Final numeric clamping
    severity         = round(max(1.0, min(5.0, severity)), 2)
    credibility_score = max(0, min(100, credibility_score))

    # ════════════════════════════════════════════════════════════
    # STAGE 7 — AUTO-RESPONSE
    # ════════════════════════════════════════════════════════════
    if credibility_score < 30:
        auto_response = _RESPONSE_TEMPLATES["SPAM"]
    else:
        auto_response = llm_result.get("auto_response") or generate_response(
            emergency_level, credibility_score
        )

    elapsed_ms = round((time.perf_counter() - t_start) * 1000, 1)

    # ── Assemble output (schema identical to original pipeline) ────
    return {
        "sentiment":           llm_result["sentiment"],
        "sentiment_score":     round(llm_result["sentiment_score"], 4),
        "distress_level":      llm_result["distress_level"],

        "emotion":             llm_result["emotion"],
        "emotion_confidence":  round(llm_result["emotion_confidence"], 4),
        "emotion_all_scores":  llm_result["emotion_all_scores"],

        "emergency_level":     emergency_level,
        "is_emergency":        llm_result["is_emergency"],
        "matched_keywords":    matched_keywords,

        "severity":            severity,

        "credibility_score":   credibility_score,
        "credibility_label":   credibility_label,
        "credibility_flags":   credibility_flags,

        "entities":            llm_result["entities"],

        "duplicate_score":     dup_early["duplicate_score"],
        "is_duplicate":        False,
        "duplicate_matched_index": None,

        "auto_response":       auto_response,

        "recommended_actions": _RECOMMENDED_ACTIONS.get(emergency_level, []),

        "word_count":          word_count,
        "processing_ms":       elapsed_ms,
    }
