"""
backend_python/utils/scoring.py
================================
Score normalization, bucketing, and label helpers.

All danger scores in this system are represented as floats in [0.0, 1.0]
where 0.0 = perfectly safe and 1.0 = imminent critical danger.

The 0–100 integer representation is reserved for the legacy REST
endpoints that serve the React dashboard's numeric gauge widgets.
"""


def normalize_score(
    value: float,
    min_val: float = 0.0,
    max_val: float = 1.0,
) -> float:
    """
    Maps *value* from [min_val, max_val] into [0.0, 1.0].

    - If min_val == max_val, returns 0.5 (mid-point) to avoid ZeroDivisionError.
    - Result is always clamped to [0.0, 1.0].

    >>> normalize_score(0.5) == 0.5
    True
    >>> normalize_score(75.0, 0.0, 100.0)
    0.75
    """
    if max_val == min_val:
        return 0.5
    normalized = (value - min_val) / (max_val - min_val)
    return float(max(0.0, min(1.0, normalized)))


def score_to_level(score: float) -> str:
    """
    Converts a [0.0, 1.0] danger score to a human-readable danger level.

    Thresholds (inclusive of lower bound):
        [0.00, 0.25) → "safe"
        [0.25, 0.50) → "moderate"
        [0.50, 0.75) → "unsafe"
        [0.75, 1.00] → "critical"

    >>> score_to_level(0.0)
    'safe'
    >>> score_to_level(0.74)
    'unsafe'
    >>> score_to_level(1.0)
    'critical'
    """
    if score < 0.25:
        return "safe"
    if score < 0.50:
        return "moderate"
    if score < 0.75:
        return "unsafe"
    return "critical"


def danger_score_to_100(score: float) -> int:
    """
    Converts a [0.0, 1.0] danger score to the legacy 0–100 integer scale
    used by the existing dashboard endpoints.

    NOTE: Higher score → higher danger.  The safety score visible in the
    frontend gauge is: safety = 100 - danger_score_to_100(score).

    >>> danger_score_to_100(0.72)
    72
    >>> danger_score_to_100(0.0)
    0
    >>> danger_score_to_100(1.0)
    100
    """
    return int(round(max(0.0, min(1.0, score)) * 100))


def level_to_recommendation(level: str) -> str:
    """Returns a default safety recommendation string for a given danger level."""
    _recommendations: dict[str, str] = {
        "safe":     "Area appears safe. Normal precautions apply.",
        "moderate": "Exercise caution. Stay in well-lit, populated areas.",
        "unsafe":   "Avoid if possible. Use safe route recommendations.",
        "critical": "Do not enter. Contact emergency services if needed.",
    }
    return _recommendations.get(level, _recommendations["moderate"])


def clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    """Clamps *value* to [lo, hi]."""
    return float(max(lo, min(hi, value)))


def weighted_average(scores: dict[str, float], weights: dict[str, float]) -> float:
    """
    Computes a weighted average of *scores* using *weights*.

    Keys present in *weights* but missing from *scores* are skipped.
    Returns 0.0 if no overlapping keys exist.

    Args:
        scores:  mapping of component_name → score (0.0–1.0)
        weights: mapping of component_name → weight; should sum to 1.0

    >>> weighted_average({"a": 1.0, "b": 0.0}, {"a": 0.5, "b": 0.5})
    0.5
    """
    total_weight = 0.0
    total_value = 0.0
    for key, weight in weights.items():
        if key in scores:
            total_value += weight * scores[key]
            total_weight += weight
    if total_weight == 0.0:
        return 0.0
    return clamp(total_value / total_weight)
