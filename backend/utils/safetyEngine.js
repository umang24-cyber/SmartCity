// ================================================================
// SAFETY ENGINE
// Computes adjusted safety score from Intersection + TimeSlice data.
// This logic runs on mock data now. When TigerGraph is connected,
// the same function receives real vertex data — nothing changes here.
// ================================================================

/**
 * @param {Object} intersection  — Intersection vertex fields
 * @param {Object} timeSlice     — TimeSlice vertex fields
 * @param {Array}  features      — Array of SafetyFeature vertices at this intersection
 * @returns {{ score, risk, reasons, timeSlice }}
 */
function computeSafetyScore(intersection, timeSlice, features = []) {
  let score = intersection.baseline_safety_score;
  const reasons = [];
  const warnings = [];

  // ── 1. Peak danger hour penalty ────────────────────────────────
  const currentHour = timeSlice.ts_hour;
  if (intersection.peak_danger_hours.includes(currentHour)) {
    score -= 20;
    warnings.push(`Peak danger hour (${currentHour}:00) at this location`);
  }

  // ── 2. Weekend multiplier ──────────────────────────────────────
  if (timeSlice.is_weekend) {
    score = score * intersection.weekend_multiplier;
    if (intersection.weekend_multiplier < 1.0) {
      warnings.push(`Weekend risk: ${Math.round((1 - intersection.weekend_multiplier) * 100)}% more dangerous on weekends`);
    }
  }

  // ── 3. Weather impact ──────────────────────────────────────────
  const badWeather = ['rain', 'fog', 'storm'];
  if (badWeather.includes(timeSlice.weather_condition)) {
    const penalty = intersection.weather_sensitivity * 15;
    score -= penalty;
    warnings.push(`${timeSlice.weather_condition} reduces safety by ${Math.round(penalty)} points here`);
  }

  // ── 4. Isolation score ─────────────────────────────────────────
  if (intersection.isolation_score > 0.7) {
    score -= 10;
    warnings.push(`High isolation (${intersection.isolation_score.toFixed(2)}) — limited escape routes`);
  } else if (intersection.isolation_score < 0.3) {
    reasons.push(`Open area — multiple exit routes available`);
  }

  // ── 5. Safety variance warning ────────────────────────────────
  if (intersection.safety_variance > 20) {
    warnings.push(`Unpredictable area — safety varies significantly (variance: ${intersection.safety_variance.toFixed(1)})`);
  }

  // ── 6. City-wide aggregate context ────────────────────────────
  if (timeSlice.aggregate_safety < 50) {
    score -= 5;
    warnings.push(`City-wide safety is low right now (${timeSlice.aggregate_safety})`);
  }

  // ── 7. Moon phase (minor factor) ──────────────────────────────
  if (timeSlice.moon_phase > 0.8 && currentHour >= 20) {
    reasons.push(`Full moon — better natural visibility tonight`);
    score += 3;
  }

  // ── 8. Special event ──────────────────────────────────────────
  if (timeSlice.special_event !== 'none') {
    warnings.push(`Special event nearby: ${timeSlice.special_event} — unusual crowd patterns`);
  }

  // ── 9. SafetyFeature analysis ─────────────────────────────────
  const functionalLights = features.filter(
    f => f.feature_type === 'streetlight' && f.is_functional
  );
  const functionalCCTV = features.filter(
    f => f.feature_type === 'cctv' && f.is_functional
  );
  const brokenFeatures = features.filter(f => !f.is_functional);

  if (functionalLights.length > 0) {
    const avgLux = functionalLights.reduce((a, f) => a + f.lux_level, 0) / functionalLights.length;
    reasons.push(`${functionalLights.length} functional streetlight(s) — avg ${Math.round(avgLux)} lux`);
    score += functionalLights.length * 3;
  }

  if (functionalCCTV.length > 0) {
    const effectiveness = functionalCCTV[0].effectiveness_by_hour[currentHour] ?? 0.5;
    reasons.push(`CCTV coverage active (${Math.round(effectiveness * 100)}% effectiveness at ${currentHour}:00)`);
    score += 5;
  }

  if (brokenFeatures.length > 0) {
    const types = brokenFeatures.map(f => f.feature_type).join(', ');
    warnings.push(`${brokenFeatures.length} non-functional feature(s): ${types}`);
    score -= brokenFeatures.length * 4;
  }

  // ── 10. Graph centrality bonus ────────────────────────────────
  if (intersection.betweenness_score > 0.5) {
    reasons.push(`High foot traffic junction — people always around`);
  }

  // ── Clamp score ───────────────────────────────────────────────
  score = Math.max(0, Math.min(100, Math.round(score)));

  // ── Risk label ────────────────────────────────────────────────
  let risk;
  let themeAction;
  if (score >= 70) {
    risk = 'low';
    themeAction = 'pulse-green';
  } else if (score >= 45) {
    risk = 'medium';
    themeAction = 'pulse-yellow';
  } else {
    risk = 'high';
    themeAction = 'pulse-red';
  }

  // ── Explainable AI Reasoning ──────────────────────────────────
  const reasoning = [...reasons, ...warnings].join('. ') + (reasons.length || warnings.length ? '.' : '');

  return {
    score,
    risk,
    reasoning,    // Explainable AI text
    themeAction,  // Cyberpunk theme sync
    reasons,      // positive factors (legacy)
    warnings,     // negative factors (legacy)
    timeSlice: {
      hour: currentHour,
      weather: timeSlice.weather_condition,
      is_weekend: timeSlice.is_weekend,
      is_holiday: timeSlice.is_holiday,
      special_event: timeSlice.special_event,
      aggregate_safety: timeSlice.aggregate_safety
    },
    meta: {
      intersection_id: intersection.intersection_id,
      intersection_name: intersection.intersection_name,
      baseline_safety_score: intersection.baseline_safety_score,
      safety_variance: intersection.safety_variance,
      isolation_score: intersection.isolation_score,
      peak_danger_hours: intersection.peak_danger_hours
    }
  };
}

module.exports = { computeSafetyScore };