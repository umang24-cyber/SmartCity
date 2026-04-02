"""
SAFETY ENGINE — Python port
Computes adjusted safety score from Intersection + TimeSlice data.
This logic runs on mock data now. When TigerGraph is connected,
the same function receives real vertex data — nothing changes here.
"""
from typing import Dict, Any, List


def compute_safety_score(
    intersection: Dict[str, Any],
    time_slice: Dict[str, Any],
    features: List[Dict[str, Any]] = [],
) -> Dict[str, Any]:
    score = float(intersection["baseline_safety_score"])
    reasons: List[str] = []
    warnings: List[str] = []

    current_hour = time_slice["ts_hour"]

    # 1. Peak danger hour penalty
    if current_hour in intersection.get("peak_danger_hours", []):
        score -= 20
        warnings.append(f"Peak danger hour ({current_hour}:00) at this location")

    # 2. Weekend multiplier
    if time_slice.get("is_weekend"):
        mult = intersection.get("weekend_multiplier", 1.0)
        score *= mult
        if mult < 1.0:
            warnings.append(f"Weekend risk: {round((1 - mult) * 100)}% more dangerous on weekends")

    # 3. Weather impact
    bad_weather = ["rain", "fog", "storm"]
    weather = time_slice.get("weather_condition", "clear")
    if weather in bad_weather:
        penalty = intersection.get("weather_sensitivity", 0) * 15
        score -= penalty
        warnings.append(f"{weather} reduces safety by {round(penalty)} points here")

    # 4. Isolation score
    isolation = intersection.get("isolation_score", 0)
    if isolation > 0.7:
        score -= 10
        warnings.append(f"High isolation ({isolation:.2f}) — limited escape routes")
    elif isolation < 0.3:
        reasons.append("Open area — multiple exit routes available")

    # 5. Safety variance warning
    variance = intersection.get("safety_variance", 0)
    if variance > 20:
        warnings.append(f"Unpredictable area — safety varies significantly (variance: {variance:.1f})")

    # 6. City-wide aggregate context
    agg = time_slice.get("aggregate_safety", 68)
    if agg < 50:
        score -= 5
        warnings.append(f"City-wide safety is low right now ({agg})")

    # 7. Moon phase (minor factor)
    moon = time_slice.get("moon_phase", 0)
    if moon > 0.8 and current_hour >= 20:
        reasons.append("Full moon — better natural visibility tonight")
        score += 3

    # 8. Special event
    event = time_slice.get("special_event", "none")
    if event != "none":
        warnings.append(f"Special event nearby: {event} — unusual crowd patterns")

    # 9. SafetyFeature analysis
    functional_lights = [f for f in features if f.get("feature_type") == "streetlight" and f.get("is_functional")]
    functional_cctv = [f for f in features if f.get("feature_type") == "cctv" and f.get("is_functional")]
    broken_features = [f for f in features if not f.get("is_functional")]

    if functional_lights:
        avg_lux = sum(f.get("lux_level", 0) for f in functional_lights) / len(functional_lights)
        reasons.append(f"{len(functional_lights)} functional streetlight(s) — avg {round(avg_lux)} lux")
        score += len(functional_lights) * 3

    if functional_cctv:
        effectiveness_map = functional_cctv[0].get("effectiveness_by_hour", {})
        effectiveness = effectiveness_map.get(current_hour, 0.5)
        reasons.append(f"CCTV coverage active ({round(effectiveness * 100)}% effectiveness at {current_hour}:00)")
        score += 5

    if broken_features:
        types = ", ".join(f.get("feature_type", "unknown") for f in broken_features)
        warnings.append(f"{len(broken_features)} non-functional feature(s): {types}")
        score -= len(broken_features) * 4

    # 10. Graph centrality bonus
    if intersection.get("betweenness_score", 0) > 0.5:
        reasons.append("High foot traffic junction — people always around")

    # Clamp score
    score = max(0, min(100, round(score)))

    # Risk label
    if score >= 70:
        risk = "low"
    elif score >= 45:
        risk = "medium"
    else:
        risk = "high"

    # Comfort score (inverted-ish, with smooth curve) for the dashboard gauge
    comfort_score = score
    comfort_label = (
        "SAFE CORRIDOR" if score >= 70
        else "MODERATE RISK" if score >= 45
        else "AVOID THIS AREA"
    )

    return {
        "score": score,
        "comfort_score": comfort_score,
        "comfort_label": comfort_label,
        "risk": risk,
        "reasons": reasons,
        "warnings": warnings,
        "timeSlice": {
            "hour": current_hour,
            "weather": weather,
            "is_weekend": time_slice.get("is_weekend", False),
            "is_holiday": time_slice.get("is_holiday", False),
            "special_event": event,
            "aggregate_safety": agg,
        },
        "meta": {
            "intersection_id": intersection.get("intersection_id"),
            "intersection_name": intersection.get("intersection_name"),
            "baseline_safety_score": intersection.get("baseline_safety_score"),
            "safety_variance": intersection.get("safety_variance"),
            "isolation_score": isolation,
            "peak_danger_hours": intersection.get("peak_danger_hours", []),
        },
    }
