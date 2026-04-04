"""
inference.py — B4 NLP Inference Pipeline
=========================================
Smart City Women's Safety System — TigerGraph Hackathon
Module: B4 (NLP — Incident Report Intelligence)

Pipeline stages (executed in analyze_report):
  1. analyze_sentiment()   — DistilBERT SST-2 (POSITIVE / NEGATIVE / NEUTRAL)
  2. analyze_emotion()     — j-hartmann RoBERTa (7-class emotion)
  3. detect_emergency()    — keyword + model signal fusion
  4. compute_severity()    — multi-factor score 1.0 – 5.0
  5. compute_credibility() — rule-based score 0 – 100
  6. extract_entities()    — regex + spaCy NER
  7. detect_duplicate()    — TF-IDF cosine similarity against in-memory store
  8. generate_response()   — template-based auto-response

All HuggingFace and spaCy models are loaded ONCE at module import time
(globals) so no model is re-initialised per request.
"""

from __future__ import annotations

import os
import re
import time
import logging
from pathlib import Path
from typing import Any

import numpy as np
import torch
from transformers import pipeline as hf_pipeline
import spacy
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# ── Logging ──────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(levelname)s │ %(message)s")
log = logging.getLogger("b4_nlp")

# ═══════════════════════════════════════════════════════════════════
# 1. MODEL LOADING  (executed once at import / startup)
# ═══════════════════════════════════════════════════════════════════

# Local model cache directory (optional — set via env var or default path)
_MODELS_DIR = Path(os.getenv("MODELS_DIR", "./models"))

def _local_or_hub(model_name: str) -> str:
    """
    Return a local path if the model has been pre-downloaded to /models,
    otherwise fall back to HuggingFace Hub download.
    
    Convention: /models/<model-name-with-slashes-replaced-by-dashes>
    e.g. "j-hartmann/emotion-english-distilroberta-base"
         → /models/j-hartmann--emotion-english-distilroberta-base
    """
    slug = model_name.replace("/", "--")
    local = _MODELS_DIR / slug
    if local.exists():
        log.info(f"Loading from local cache: {local}")
        return str(local)
    log.info(f"Loading from HuggingFace Hub: {model_name}")
    return model_name


def _load_spacy() -> spacy.language.Language:
    """Load spaCy en_core_web_sm from local path or pip-installed package."""
    local = _MODELS_DIR / "en_core_web_sm"
    if local.exists():
        return spacy.load(str(local))
    return spacy.load("en_core_web_sm")


# CPU-friendly device selection
_DEVICE = 0 if torch.cuda.is_available() else -1
log.info(f"Inference device: {'GPU:0' if _DEVICE == 0 else 'CPU'}")

log.info("Loading sentiment model (DistilBERT SST-2)…")
_SENTIMENT_PIPE = hf_pipeline(
    "sentiment-analysis",
    model=_local_or_hub("distilbert-base-uncased-finetuned-sst-2-english"),
    device=_DEVICE,
    truncation=True,
    max_length=512,
)

log.info("Loading emotion model (j-hartmann RoBERTa 7-class)…")
_EMOTION_PIPE = hf_pipeline(
    "text-classification",
    model=_local_or_hub("j-hartmann/emotion-english-distilroberta-base"),
    return_all_scores=True,
    device=_DEVICE,
    truncation=True,
    max_length=512,
)

log.info("Loading spaCy NER (en_core_web_sm)…")
_NLP_NER = _load_spacy()

log.info("All models loaded ✓")


# ═══════════════════════════════════════════════════════════════════
# 2. CONSTANTS
# ═══════════════════════════════════════════════════════════════════

# Emergency keywords by tier — order matters (most severe first)
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

# Distress signal words used by sentiment helper
_DISTRESS_KW = [
    "help", "scared", "afraid", "attack", "assault", "emergency", "danger",
    "please", "urgent", "now", "sos", "terrified", "running", "grabbed",
]

# Emotion → severity weight (0 – 1.0)
_EMOTION_WEIGHT: dict[str, float] = {
    "fear": 1.0, "anger": 0.8, "disgust": 0.6,
    "sadness": 0.5, "surprise": 0.3, "neutral": 0.1, "joy": 0.0,
}

# Auto-response templates keyed by emergency level
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

# Recommended actions per emergency level
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

# Spam-signal phrases for credibility check
_SPAM_KW = [
    "click here", "buy now", "amazing deals", "limited offer",
    "www.", "http://", "https://", ".com", ".xyz",
    "free download", "visit now", "subscribe", "register now", "earn money",
]

# ── In-memory TF-IDF duplicate store ────────────────────────────
# Grows as reports are analysed; reset on restart.
_DUP_STORE: list[str] = []          # raw texts seen so far
_DUP_THRESHOLD = 0.75               # cosine similarity threshold


# ═══════════════════════════════════════════════════════════════════
# 3. INDIVIDUAL ANALYZERS
# ═══════════════════════════════════════════════════════════════════

def analyze_sentiment(text: str) -> dict[str, Any]:
    """
    Stage 1 — Sentiment Analysis (DistilBERT SST-2).

    Returns:
        label          : "POSITIVE" | "NEGATIVE" | "NEUTRAL"
        score          : float  (model confidence 0-1)
        distress_level : "LOW" | "MODERATE" | "HIGH" | "EXTREME"
    """
    if len(text.split()) < 3:
        return {"label": "NEUTRAL", "score": 0.5, "distress_level": "LOW"}

    result = _SENTIMENT_PIPE(text[:512])[0]
    label: str = result["label"]       # "POSITIVE" or "NEGATIVE"
    score: float = round(result["score"], 4)

    # Collapse weak negatives to NEUTRAL
    if label == "NEGATIVE" and score < 0.65:
        label = "NEUTRAL"

    # Distress level heuristic — keyword hits in negative text
    text_lower = text.lower()
    kw_hits = sum(1 for k in _DISTRESS_KW if k in text_lower)

    if label == "NEGATIVE" and kw_hits >= 3:
        distress = "EXTREME"
    elif label == "NEGATIVE" and kw_hits >= 1:
        distress = "HIGH"
    elif label == "NEGATIVE":
        distress = "MODERATE"
    else:
        distress = "LOW"

    return {"label": label, "score": score, "distress_level": distress}


def analyze_emotion(text: str) -> dict[str, Any]:
    """
    Stage 2 — 7-class Emotion Detection (j-hartmann RoBERTa).

    Returns:
        dominant            : str   (e.g. "fear")
        dominant_confidence : float
        all_scores          : dict  {emotion: score, …}
    """
    if len(text.split()) < 3:
        return {
            "dominant": "neutral",
            "dominant_confidence": 0.9,
            "all_scores": {
                "neutral": 0.9, "fear": 0.02, "anger": 0.02,
                "sadness": 0.02, "disgust": 0.02, "surprise": 0.01, "joy": 0.01,
            },
        }

    results = _EMOTION_PIPE(text[:512])[0]
    scores = {r["label"].lower(): round(r["score"], 4) for r in results}
    dominant = max(scores, key=scores.get)  # type: ignore[arg-type]

    return {
        "dominant": dominant,
        "dominant_confidence": scores[dominant],
        "all_scores": scores,
    }


def detect_emergency(
    text: str,
    sentiment: dict[str, Any],
    emotion: dict[str, Any],
) -> dict[str, Any]:
    """
    Stage 3 — Emergency Level Detection.

    Combines keyword matching with sentiment distress and emotion confidence.

    Returns:
        level            : "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NORMAL"
        matched_keywords : list[str]
        is_emergency     : bool  (True for CRITICAL or HIGH)
    """
    text_lower = text.lower()
    detected_level = "NORMAL"
    matched: list[str] = []

    for level in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
        for kw in _EMERGENCY_KW[level]:
            if kw in text_lower:
                matched.append(kw)
                if _LEVEL_ORDER.index(level) < _LEVEL_ORDER.index(detected_level):
                    detected_level = level

    # Boost: high-confidence fear → at least HIGH
    if emotion["dominant"] == "fear" and emotion["dominant_confidence"] > 0.7:
        if _LEVEL_ORDER.index("HIGH") < _LEVEL_ORDER.index(detected_level):
            detected_level = "HIGH"

    # Boost: EXTREME distress → CRITICAL
    if sentiment["distress_level"] == "EXTREME":
        if _LEVEL_ORDER.index("CRITICAL") < _LEVEL_ORDER.index(detected_level):
            detected_level = "CRITICAL"

    return {
        "level": detected_level,
        "matched_keywords": list(set(matched)),
        "is_emergency": detected_level in ("CRITICAL", "HIGH"),
    }


def compute_severity(
    text: str,
    sentiment: dict[str, Any],
    emotion: dict[str, Any],
    emergency: dict[str, Any],
) -> float:
    """
    Stage 4 — Severity Prediction (1.0 – 5.0, two decimal places).

    Six weighted factors:
        F1: dominant emotion weight        (0 – 2.0 pts)
        F2: emergency level score          (0 – 2.0 pts)
        F3: sentiment negativity           (0 – 1.0 pts)
        F4: keyword density                (0 – 1.0 pts)
        F5: time-sensitive language        (0 – 0.5 pts)
        F6: report length / detail         (0 – 0.5 pts)
    Raw max = 7.0 → normalised to 1 – 5.
    """
    score = 0.0

    # F1 — emotion
    score += _EMOTION_WEIGHT.get(emotion["dominant"], 0.0) * 2.0

    # F2 — emergency level
    level_pts = {"CRITICAL": 2.0, "HIGH": 1.5, "MEDIUM": 1.0, "LOW": 0.5, "NORMAL": 0.0}
    score += level_pts.get(emergency["level"], 0.0)

    # F3 — sentiment
    if sentiment["label"] == "NEGATIVE":
        score += sentiment["score"] * 1.0

    # F4 — keyword density (capped at 1.0)
    score += min(len(emergency["matched_keywords"]) * 0.15, 1.0)

    # F5 — time-sensitive language
    time_sensitive = ["right now", "currently", "happening", "this moment", "help me"]
    if any(k in text.lower() for k in time_sensitive):
        score += 0.5

    # F6 — detail level (word count 20–300 is informative)
    word_count = len(text.split())
    if 20 <= word_count <= 300:
        score += 0.5

    # Normalise: raw 0..7 → severity 1..5
    raw_max = 7.0
    normalised = (score / raw_max) * 4.0 + 1.0
    return round(min(5.0, max(1.0, normalised)), 2)


def compute_credibility(text: str) -> dict[str, Any]:
    """
    Stage 5 — Credibility Assessment (0 – 100 score).

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

    # Vague single-clause report
    if word_count < 8 and re.match(r"^[a-z .,!?]+$", text.strip().lower()):
        score -= 10
        flags.append("VAGUE")

    # Test / dummy content
    if re.search(r"(test|asdf|qwerty|1234|abc|dummy|ignore|testing)", text_lower):
        score -= 40
        flags.append("TEST/DUMMY CONTENT")

    # High ratio of non-alphabetic tokens
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


def extract_entities(text: str) -> dict[str, list[str]]:
    """
    Stage 6 — Named Entity Recognition.

    Combines hand-crafted regex patterns (time, clothing, vehicles, people,
    physical descriptions) with spaCy NER (locations, GPE, FAC).

    Returns a dict with keys:
        time | location | people | clothing | vehicles | physical_description
    """
    entities: dict[str, list[str]] = {
        "time": [],
        "location": [],
        "people": [],
        "clothing": [],
        "vehicles": [],
        "physical_description": [],
    }

    # Time expressions
    time_patterns = [
        r"\b\d{1,2}[:.\s]\d{2}\s?(?:am|pm|AM|PM)\b",
        r"\b(?:morning|afternoon|evening|night|midnight|noon)\b",
        r"\b\d{1,2}\s?(?:minutes?|hours?)\s?(?:ago)?\b",
        r"\b(?:yesterday|today|last\s+\w+|right now|currently)\b",
        r"\b(?:around|at|since)\s+\d{1,2}(?::\d{2})?\s?(?:am|pm)?\b",
    ]
    for pat in time_patterns:
        entities["time"].extend(re.findall(pat, text, re.IGNORECASE))

    # Clothing
    clothing_patterns = [
        r"\b(?:black|blue|red|white|grey|green|brown|yellow|orange|purple)\s+"
        r"(?:jacket|hoodie|shirt|t-shirt|cap|dress|jeans|pants|kurta)\b",
        r"wearing\s+(?:a\s+)?(?:\w+\s+){0,2}(?:jacket|hoodie|shirt|cap|dress|jeans)",
    ]
    for pat in clothing_patterns:
        entities["clothing"].extend(re.findall(pat, text, re.IGNORECASE))

    # Vehicles
    vehicle_pat = (
        r"\b(?:motorcycle|motorbike|car|bike|bicycle|scooter|suv|truck|"
        r"auto|rickshaw|van)\b"
    )
    entities["vehicles"] = re.findall(vehicle_pat, text, re.IGNORECASE)

    # People
    people_pat = (
        r"\b(?:(?:a|one|two|three|four|five|six|\d+)\s+"
        r"(?:man|men|woman|women|person|people|group|gang))\b"
    )
    entities["people"] = re.findall(people_pat, text, re.IGNORECASE)

    # Physical descriptions
    phys_pat = (
        r"\b(?:\d+(?:\.\d+)?\s+feet|tall|short|heavy|thin|beard|"
        r"mustache|bald|glasses|scar|tattoo|cap)\b"
    )
    entities["physical_description"] = re.findall(phys_pat, text, re.IGNORECASE)

    # spaCy NER — locations
    try:
        doc = _NLP_NER(text[:1000])
        for ent in doc.ents:
            if ent.label_ in ("GPE", "LOC", "FAC"):
                entities["location"].append(ent.text)
    except Exception as exc:
        log.warning(f"spaCy NER failed: {exc}")

    # Deduplicate and normalise
    for key in entities:
        entities[key] = list(
            dict.fromkeys(
                [e.strip().lower() for e in entities[key] if e.strip()]
            )
        )

    return entities


def detect_duplicate(text: str, threshold: float = _DUP_THRESHOLD) -> dict[str, Any]:
    """
    Stage 7 — Duplicate Detection (TF-IDF cosine similarity).

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
        # Compare last vector (new text) against all existing ones
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
        log.warning(f"Duplicate detection failed: {exc}")

    # Always add to store after scoring
    _DUP_STORE.append(text)
    return result


def generate_response(
    emergency_level: str,
    credibility_score: int,
) -> str:
    """
    Stage 8 — Auto-Response Generation.

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
# 4. MAIN ENTRYPOINT
# ═══════════════════════════════════════════════════════════════════

def analyze_report(text: str) -> dict[str, Any]:
    """
    Full NLP analysis pipeline for a single incident report.

    This is the only function that should be called from app.py.
    All 8 stages run sequentially; intermediate results are passed
    forward so later stages can condition on earlier ones.

    Args:
        text : raw user-submitted incident report string

    Returns:
        Structured JSON-serialisable dict with all analysis results.
        See README / API docs for field descriptions.

    Raises:
        ValueError : if text is empty or whitespace-only.
    """
    text = text.strip()
    if not text:
        raise ValueError("Report text must not be empty.")

    t_start = time.perf_counter()

    # ── Stage 1: Sentiment ───────────────────────────────────────
    sentiment = analyze_sentiment(text)

    # ── Stage 2: Emotion ─────────────────────────────────────────
    emotion = analyze_emotion(text)

    # ── Stage 3: Emergency Level ──────────────────────────────────
    emergency = detect_emergency(text, sentiment, emotion)

    # ── Stage 4: Severity ────────────────────────────────────────
    severity = compute_severity(text, sentiment, emotion, emergency)

    # ── Stage 5: Credibility ──────────────────────────────────────
    credibility = compute_credibility(text)

    # ── Stage 6: Entity Extraction ────────────────────────────────
    entities = extract_entities(text)

    # ── Stage 7: Duplicate Detection ─────────────────────────────
    dup = detect_duplicate(text)

    # ── Stage 8: Auto-Response ────────────────────────────────────
    auto_response = generate_response(emergency["level"], credibility["score"])

    elapsed_ms = round((time.perf_counter() - t_start) * 1000, 1)

    # ── Assemble output ───────────────────────────────────────────
    return {
        # Core outputs consumed by TigerGraph / downstream modules
        "sentiment":           sentiment["label"].lower(),
        "sentiment_score":     sentiment["score"],
        "distress_level":      sentiment["distress_level"],

        "emotion":             emotion["dominant"],
        "emotion_confidence":  emotion["dominant_confidence"],
        "emotion_all_scores":  emotion["all_scores"],

        "emergency_level":     emergency["level"],
        "is_emergency":        emergency["is_emergency"],
        "matched_keywords":    emergency["matched_keywords"],

        "severity":            severity,

        "credibility_score":   credibility["score"],
        "credibility_label":   credibility["label"],
        "credibility_flags":   credibility["flags"],

        "entities":            entities,

        "duplicate_score":     dup["duplicate_score"],
        "is_duplicate":        dup["is_duplicate"],
        "duplicate_matched_index": dup["matched_index"],

        "auto_response":       auto_response,

        "recommended_actions": _RECOMMENDED_ACTIONS.get(emergency["level"], []),

        # Metadata
        "word_count":          len(text.split()),
        "processing_ms":       elapsed_ms,
    }
