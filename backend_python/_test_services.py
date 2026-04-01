"""Services smoke test — fast path, no model loading."""
import sys
sys.path.insert(0, ".")

PASS, FAIL = [], []

def check(name, fn):
    try:
        fn()
        print(f"  [PASS] {name}")
        PASS.append(name)
    except Exception as e:
        import traceback
        print(f"  [FAIL] {name}: {e}")
        traceback.print_exc()
        FAIL.append(name)

# ── LSTM service ──────────────────────────────────────────────────────────────
print("\n[1] lstm_service")
from services.lstm_service import predict_danger, get_current_danger_score

history = [
    {"timestamp": f"2025-01-15T{h:02d}:00:00", "safety_score": 72.0,
     "crowd_density": 0.4, "hour": h, "day_of_week": 2, "is_weekend": 0,
     "weather_condition": "clear", "incident_count_last_6h": 0,
     "lights_functional": 5, "cctv_functional": 3}
    for h in range(24)
]

def t_lstm_predict():
    r = predict_danger("INT007", history)
    assert "predictions" in r, "missing predictions"
    assert "loader_status" in r, "missing loader_status"
    assert len(r["predictions"]) == 24
    print(f"     loader={r['loader_status']}  alert={r['alert_recommended']}")

def t_lstm_danger_score():
    s = get_current_danger_score("INT007", history)
    assert 0.0 <= s <= 1.0, f"score out of range: {s}"
    print(f"     danger_score={s}")

check("predict_danger schema", t_lstm_predict)
check("get_current_danger_score range", t_lstm_danger_score)

# ── CV service ────────────────────────────────────────────────────────────────
print("\n[2] cv_service")
from services.cv_service import analyze_frame, get_cv_danger_score, reset_pipeline

def t_cv_analyze():
    r = analyze_frame(b"fake_bytes")
    required = ["person_count","crowd_density","density_danger","anomaly_detected",
                "anomalies","safety_score","danger_score","danger_level",
                "confidence","inference_ms","loader_status"]
    for k in required:
        assert k in r, f"missing key: {k}"
    assert 0.0 <= r["danger_score"] <= 1.0
    assert r["danger_level"] in ("safe","moderate","unsafe","critical")
    print(f"     density={r['crowd_density']}  danger_score={r['danger_score']}  level={r['danger_level']}")

def t_cv_danger_score():
    s = get_cv_danger_score(b"fake")
    assert 0.0 <= s <= 1.0
    print(f"     get_cv_danger_score={s}")

def t_cv_reset():
    reset_pipeline()  # must not raise

check("analyze_frame schema + range", t_cv_analyze)
check("get_cv_danger_score range", t_cv_danger_score)
check("reset_pipeline no-raise", t_cv_reset)

# ── Danger aggregator ─────────────────────────────────────────────────────────
print("\n[3] danger_aggregator")
from services.danger_aggregator import aggregate_danger

lstm_r = predict_danger("INT007", history)
cv_r   = analyze_frame(b"fake")
zone_h = [{"hour": h, "incident_count": 1 if h < 22 else 15, "crowd": 0.3} for h in range(24)]

def t_agg_full():
    r = aggregate_danger(
        "ZONE_01",
        lstm_result=lstm_r,
        cv_result=cv_r,
        graph_score=0.35,
        zone_history=zone_h,
    )
    required = ["zone_id","danger_score","danger_level","danger_100",
                "alert","recommendation","components","computed_at"]
    for k in required:
        assert k in r, f"missing key: {k}"
    assert 0.0 <= r["danger_score"] <= 1.0
    assert r["danger_100"] == round(r["danger_score"] * 100)
    assert set(r["components"].keys()) == {"lstm","cv","anomaly","graph"}
    print(f"     danger_score={r['danger_score']}  level={r['danger_level']}  alert={r['alert']}")
    for comp, data in r["components"].items():
        print(f"       {comp}: score={data['score']}  weight={data['weight']}  status={data['status']}")

def t_agg_partial_no_cv():
    """Test weight redistribution when CV is missing."""
    r = aggregate_danger("ZONE_02", lstm_result=lstm_r, zone_history=zone_h)
    assert r["components"]["cv"]["status"] == "skipped"
    assert r["components"]["lstm"]["status"] == "used"
    active_weights = sum(
        v["weight"] for v in r["components"].values() if v["status"] == "used"
    )
    assert abs(active_weights - 1.0) < 1e-5, f"weights don't sum to 1.0: {active_weights}"
    print(f"     partial(no cv) danger_score={r['danger_score']}")

def t_agg_all_skipped():
    """All None — should return 0.5 neutral."""
    r = aggregate_danger("ZONE_03")
    assert r["danger_score"] == 0.5, f"expected 0.5 got {r['danger_score']}"
    print(f"     all-skipped danger_score={r['danger_score']} (expected 0.5)")

check("aggregate_danger full schema", t_agg_full)
check("aggregate_danger weight redistribution (no cv)", t_agg_partial_no_cv)
check("aggregate_danger all-skipped to 0.5", t_agg_all_skipped)

# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n{'='*55}")
print(f"  Passed : {len(PASS)}")
print(f"  Failed : {len(FAIL)}")
if FAIL:
    print(f"  FAILED : {FAIL}")
    sys.exit(1)
else:
    print("  PHASE 3 SERVICES PASSED")
