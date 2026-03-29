"""
Phase 2 loader smoke test.
- LSTM:  fallback mock (no TF installed) — instant
- CV:    fallback mock (no torch/ultralytics) — instant
- NLP:   REAL models loaded from ai/nlp/inference.py
          First run may take 1–5 min (HuggingFace download ~250 MB)
          Subsequent runs: 30–60 s (local cache)
- Anomaly: SKIPPED (no model files — z-score fallback confirmed by design)
"""
import sys, time
sys.path.insert(0, ".")

PASS = []
FAIL = []

def check(name, fn):
    try:
        fn()
        print(f"  ✅  {name}")
        PASS.append(name)
    except Exception as e:
        print(f"  ❌  {name}: {e}")
        import traceback; traceback.print_exc()
        FAIL.append(name)

# ─────────────────────────────────────────────────────────────────
# 1. LSTM loader
# ─────────────────────────────────────────────────────────────────
print("\n[1/3] LSTM loader")
from ai.lstm.loader import load_lstm_model, get_lstm_bundle
b = load_lstm_model()
print(f"      status={b['status']}  reason={b['reason'] or '(none)'}")

history = [
    {"timestamp": f"2025-01-15T{h:02d}:00:00", "safety_score": 70.0,
     "crowd_density": 0.4, "hour": h, "day_of_week": 2, "is_weekend": 0,
     "weather_condition": "clear", "incident_count_last_6h": 0,
     "lights_functional": 5, "cctv_functional": 2}
    for h in range(24)
]

def test_lstm_shape():
    r = b["predict_fn"]({"intersection_id": "INT007", "history": history})
    assert "predictions" in r,            "missing key: predictions"
    assert len(r["predictions"]) == 24,   f"expected 24 preds, got {len(r['predictions'])}"
    assert "alert_recommended" in r,      "missing key: alert_recommended"
    p0 = r["predictions"][0]
    for k in ("predicted_score", "confidence_interval", "severity", "hour_offset"):
        assert k in p0, f"prediction entry missing key: {k}"

check("LSTM predict_fn output shape", test_lstm_shape)
check("LSTM get_lstm_bundle singleton", lambda: (get_lstm_bundle() is b) or (_ for _ in ()).throw(AssertionError("not same singleton")))

# ─────────────────────────────────────────────────────────────────
# 2. CV loader
# ─────────────────────────────────────────────────────────────────
print("\n[2/3] CV loader")
from ai.cv.loader import load_cv_pipeline, get_cv_bundle
cb = load_cv_pipeline()
print(f"      status={cb['status']}  reason={cb['reason'] or '(none)'}")

def test_cv_shape():
    r = cb["predict_fn"](b"fake_image_bytes")
    assert "prediction" in r and "confidence" in r and "extra" in r
    for k in ("person_count", "crowd_density", "anomaly_detected", "safety_score"):
        assert k in r["extra"], f"extra missing: {k}"
    assert r["prediction"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL")

check("CV predict_fn output shape", test_cv_shape)
check("CV reset_fn callable",       lambda: cb["reset_fn"]())

# ─────────────────────────────────────────────────────────────────
# 3. NLP loader  — REAL models, no mocking
# ─────────────────────────────────────────────────────────────────
print("\n[3/3] NLP loader  (loading REAL models — may take 1-5 min on first run)")
t0 = time.perf_counter()
from ai.nlp.loader import load_nlp_pipeline, get_nlp_bundle
nb = load_nlp_pipeline()
elapsed = time.perf_counter() - t0
print(f"      status={nb['status']}  loaded_in={elapsed:.1f}s")
if nb["status"] == "fallback":
    print(f"      reason={nb['reason']}")

def test_nlp_schema():
    r = nb["analyze_report"]("A man followed me to my car late at night and threatened me.")
    required = [
        "sentiment", "sentiment_score", "distress_level", "emotion",
        "emotion_confidence", "emergency_level", "is_emergency",
        "severity", "credibility_score", "auto_response",
        "entities", "word_count",
    ]
    for k in required:
        assert k in r, f"analyze_report() missing key: {k}"
    assert r["emergency_level"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
    assert isinstance(r["entities"], dict)
    assert len(r["auto_response"]) > 10
    print(f"         emergency_level={r['emergency_level']}  emotion={r['emotion']}  "
          f"severity={r['severity']}  credibility={r['credibility_score']}")

def test_nlp_levels():
    low  = nb["analyze_report"]("The street light near the park is dim.")
    high = nb["analyze_report"]("Help! Someone is attacking me! SOS emergency!")
    print(f"         low_report  -> level={low['emergency_level']}")
    print(f"         high_report -> level={high['emergency_level']}")
    # high urgency text should score higher than low urgency
    assert high["severity"] >= low["severity"], \
        f"Expected high severity ({high['severity']}) >= low severity ({low['severity']})"

check("NLP analyze_report schema",  test_nlp_schema)
check("NLP severity ordering",       test_nlp_levels)

# ─────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────
print("\n" + "=" * 55)
print(f"  Passed  : {len(PASS)}")
print(f"  Failed  : {len(FAIL)}")
if FAIL:
    print(f"  FAILED  : {FAIL}")
    sys.exit(1)
else:
    print("  Anomaly : SKIPPED (no model — z-score fallback is live by design)")
    print("  ALL PHASE 2 LOADERS PASSED ✅")
