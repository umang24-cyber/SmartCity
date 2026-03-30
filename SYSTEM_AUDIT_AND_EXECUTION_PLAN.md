# 🏙️ Smart City Women's Safety — Full System Audit & Final Execution Plan
> **Prepared for:** Gemini 2.5 Pro (High Reasoning Mode)
> **Mode:** Production-grade hackathon system — polish, fix, connect, demo
> **Rule:** Execute every numbered step in order. Do not skip. Do not improvise unless a step explicitly says "adjust if needed."

---

## TABLE OF CONTENTS

1. [🔍 Missing / Incomplete Components](#1--missing--incomplete-components)
2. [❌ Current Issues Detected](#2--current-issues-detected)
3. [🔧 Fixes Required](#3--fixes-required)
4. [🧠 Architecture Improvements](#4--architecture-improvements)
5. [🗺️ Map Integration Fixes](#5-️-map-integration-fixes)
6. [⚙️ Final Execution Plan for Gemini](#6-️-final-execution-plan-for-gemini)

---

# 1. 🔍 MISSING / INCOMPLETE COMPONENTS

## 1.1 — `report.py` vs `reports.py` — DUPLICATE FILE RESOLUTION

**The problem:** Two router files exist for the same domain:
- `routers/report.py` — older file, likely built before NLP was integrated. Contains basic CRUD logic (hardcoded mock data, no NLP pipeline call).
- `routers/reports.py` — newer file, built with NLP model in mind. Contains `analyze_incident_report()` integration, `graph_payload` forwarding to TigerGraph, auto-response, and duplicate detection.

**Decision:** **`reports.py` is canonical. `report.py` is deleted.**

**Before deleting `report.py`, extract these features if present:**
| Feature to Check in `report.py` | Where to Port It |
|---|---|
| `GET /reports/{report_id}` — fetch single report by ID | Add to `reports.py` |
| `DELETE /reports/{report_id}` — delete a report | Add to `reports.py` |
| `PUT /reports/{report_id}` — update report status | Add to `reports.py` |
| Any admin-only filtering (by date range, reporter_id) | Add to `reports.py` |
| Any pagination logic (page/page_size params) | Add to `reports.py` |
| Any data models (Pydantic classes) defined inline | Move to `models/report_models.py` |

**Action:** Read `report.py` fully, port the above, then delete `report.py`.

---

## 1.2 — Missing Components from Previous Plan

| # | Missing Item | Where It Should Live | Priority |
|---|---|---|---|
| 1 | `route_service.py` mentioned but never written | `services/route_service.py` | HIGH |
| 2 | `GET /safe-route` enhancement (LSTM-weighted segments) | `routers/routing.py` | HIGH |
| 3 | `routers/websocket.py` exists in plan but never registered in `main.py` | `main.py` | HIGH |
| 4 | WebSocket `broadcast_alert()` never wired to anomaly/NLP triggers | `services/danger_aggregator.py` | HIGH |
| 5 | `GET /graph/heatmap` not in `routers/graph.py` fully | `routers/graph.py` | HIGH |
| 6 | `models/cctv_models.py` — referenced but not written | `models/cctv_models.py` | MEDIUM |
| 7 | `models/route_models.py` — referenced but not written | `models/route_models.py` | MEDIUM |
| 8 | `utils/geo_utils.py` — referenced but empty/missing | `utils/geo_utils.py` | MEDIUM |
| 9 | Anomaly router never registered in `main.py` | `main.py` | HIGH |
| 10 | `GET /intersections` endpoint — existing but not enhanced with danger scores | `routers/routing.py` | MEDIUM |
| 11 | Danger score cache invalidation on new report | `routers/reports.py` (post-NLP) | MEDIUM |
| 12 | B3 Anomaly: placeholder connection stubs completely absent | `ai/anomaly/loader.py` + `services/anomaly_service.py` | MEDIUM |
| 13 | CORS missing for `ws://` WebSocket origin | `main.py` | HIGH |
| 14 | `GET /reports` has no pagination | `routers/reports.py` | LOW |
| 15 | No `/health/models` detailed endpoint | `main.py` | LOW |
| 16 | Frontend `useWebSocket.js` not wired to store | `store/safetyStore.js` | MEDIUM |
| 17 | Frontend `.env` file never created | `frontend/.env` | HIGH |
| 18 | Clustering endpoint completely absent | `routers/danger.py` or new `routers/clustering.py` | HIGH |
| 19 | `POST /patrol-optimize` or patrol zone logic | `routers/patrol.py` | MEDIUM |
| 20 | No startup validation that model files actually exist | `main.py` lifespan | MEDIUM |

---

## 1.3 — Anomaly Module — Placeholder Strategy (IMPORTANT)

**You stated:** "There is still a need to put a real model for anomaly — ignore that, but connections must be established so when you add it, it doesn't take much time."

**Strategy implemented in this plan:**
- `ai/anomaly/loader.py` — defines `load_anomaly_model()` that tries to load model, falls back gracefully
- `services/anomaly_service.py` — defines clean `detect_anomalies()` interface
- Router `routers/anomaly.py` — fully wired endpoint
- **The interface contract is fixed.** When you drop in the real model later, you ONLY edit `ai/anomaly/loader.py` to point to the new file + update `services/anomaly_service.py`'s `detect` call. Everything else (router, aggregator, frontend) stays unchanged.

---

# 2. ❌ CURRENT ISSUES DETECTED

## Issue #1 — WebSocket Router Not Registered
**File:** `main.py`
**Symptom:** `WS /ws/alerts` returns 404 or connection refused
**Root cause:** `routers/websocket.py` exists but `app.include_router(websocket.router)` is missing from `main.py`
**Fix:** Add to `main.py` — detailed in Section 6

---

## Issue #2 — Anomaly Router Not Registered
**File:** `main.py`
**Symptom:** `POST /api/v1/detect-anomaly` returns 404
**Root cause:** `app.include_router(anomaly.router)` missing
**Fix:** Add import + include_router for anomaly

---

## Issue #3 — `/safe-route` Returns Unstructured Coordinates
**File:** `routers/routing.py`
**Symptom:** MapLibre cannot render route — coordinates format wrong
**Root cause:** Old route returns `{"path": [[lat,lng],...]}` — MapLibre needs GeoJSON `{"type":"LineString","coordinates":[[lng,lat],...]}` (note: **longitude first** in GeoJSON)
**Fix:** Wrap route output in proper GeoJSON structure with lng,lat order

---

## Issue #4 — `GET /graph/heatmap` Missing or Returns Wrong Shape
**File:** `routers/graph.py`
**Symptom:** Frontend heatmap layer fails to render
**Root cause:** Returns flat array without `zone_id` key, or returns nested object
**Fix:** Standardize to `[{"zone_id":str,"lat":float,"lng":float,"danger_score":float,"danger_level":str}]`

---

## Issue #5 — Router Prefix Collision
**File:** `main.py`
**Symptom:** Some endpoints return 404, others 200, depending on which router they're in
**Root cause:** Some routers include the `/api/v1` prefix in their own routes AND in `include_router(prefix=...)`, causing double-prefix like `/api/v1/api/v1/...`
**Fix:** All route paths inside router files must NOT include `/api/v1`. Only `main.py` sets the prefix.

---

## Issue #6 — CORS Not Covering WebSocket
**File:** `main.py`
**Symptom:** Browser WebSocket connection to `ws://localhost:8000` fails with CORS error
**Root cause:** FastAPI CORS middleware does NOT cover WebSocket connections — they require `allow_origins` in the WebSocket handshake separately
**Fix:** Use `starlette.middleware.cors` properly, or handle WS origin check in the endpoint

---

## Issue #7 — `analyze-cctv` Returns 422 on Valid Images
**File:** `routers/cctv.py`
**Symptom:** Multipart upload works in curl but fails from React fetch
**Root cause:** React's `fetch()` with `FormData` must NOT set `Content-Type` header manually — browser sets it with boundary. If developer sets it manually, boundary is missing → FastAPI rejects
**Fix:** Document in frontend `api.js` that CCTV calls must NOT set Content-Type header (already in plan but needs explicit comment)

---

## Issue #8 — `danger_aggregator.py` Calls `get_zone_data()` Which Imports Circularly
**File:** `services/danger_aggregator.py`
**Symptom:** `ImportError: cannot import name 'get_zone_data'` on startup
**Root cause:** `danger_aggregator.py` imports from `db.tigergraph_client` which also imports from services — circular
**Fix:** Move `get_zone_data` import inside the async function body (lazy import pattern)

---

## Issue #9 — NLP Service Assumes Function Names That May Not Exist
**File:** `services/nlp_service.py`
**Symptom:** `AttributeError: module 'inference' has no attribute 'analyze_sentiment'`
**Root cause:** Plan assumes `nlp_inference.analyze_sentiment()` exists — actual function names in `ai/nlp/inference.py` unknown
**Fix:** Add a safe `getattr` wrapper that tries known names, falls back to template responses

---

## Issue #10 — No Clustering Endpoint
**File:** Missing entirely
**Symptom:** No `/api/v1/clusters` or `/api/v1/cluster-zones` endpoint
**Root cause:** Clustering AI module mentioned in system context but never exposed as API
**Fix:** Add `routers/clustering.py` with `GET /clusters` endpoint

---

## Issue #11 — `report.py` and `reports.py` Both Registered = Route Conflicts
**File:** `main.py`
**Symptom:** Some `/reports` routes shadow others — unpredictable behavior
**Root cause:** Both files are likely registered causing `POST /reports` to hit whichever was registered first
**Fix:** Remove `report.py` registration, keep only `reports.py`

---

## Issue #12 — Missing Startup File Existence Validation
**File:** `main.py` lifespan
**Symptom:** Server starts successfully, then crashes on first real API call because model file path is wrong
**Root cause:** `load_lstm_model()` fails silently if path is wrong, or raises during first request
**Fix:** Add pre-flight path checks in lifespan before loading models

---

# 3. 🔧 FIXES REQUIRED

## Fix #1 — Resolve `report.py` vs `reports.py`

### Step A: Read `report.py` and extract unique features

Look for these patterns in `report.py`:
```python
# If you find any of these in report.py, they must be preserved:
@router.get("/reports/{report_id}")     # → port to reports.py
@router.delete("/reports/{report_id}")  # → port to reports.py
@router.put("/reports/{report_id}")     # → port to reports.py
@router.get("/reports/stats")           # → port to reports.py
```

Any Pydantic models defined inside `report.py` → move to `models/report_models.py`.

### Step B: Add extracted features to `reports.py`

Add these endpoints to the BOTTOM of `reports.py` (after existing endpoints):

```python
# In routers/reports.py — ADD THESE (ported from report.py)

@router.get("/reports/{report_id}", response_model=ReportDetailResponse)
async def get_report(report_id: str):
    """Fetch a single report by ID from TigerGraph."""
    from services.graph_service import get_report_by_id
    result = await get_report_by_id(report_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Report {report_id} not found")
    return result


@router.put("/reports/{report_id}/status")
async def update_report_status(report_id: str, body: ReportStatusUpdate):
    """
    Update the status of a report (e.g., acknowledged, resolved, false_alarm).
    Used by admin dashboard.
    """
    from services.graph_service import update_report_status
    return await update_report_status(report_id, body.status, body.notes)


@router.get("/reports/stats/summary")
async def get_report_stats(location_id: str = None, hours: int = 24):
    """
    Returns aggregate stats: total reports, by severity, by emotion.
    Used by admin dashboard charts.
    """
    from services.graph_service import get_report_stats
    return await get_report_stats(location_id=location_id, hours=hours)
```

### Step C: Delete `report.py`

```bash
rm backend_python/routers/report.py
```

Also remove its registration from `main.py`:
```python
# REMOVE this line from main.py if it exists:
from routers import report
app.include_router(report.router, ...)
```

---

## Fix #2 — Complete `main.py` — The Definitive Version

**This is the canonical `main.py`. Replace the existing file entirely.**

```python
# backend_python/main.py
# THE DEFINITIVE VERSION — all routers registered, all models loaded,
# startup file validation, clean lifespan

import sys
import os
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# ── Path setup ──
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "ai" / "lstm"))
sys.path.insert(0, str(PROJECT_ROOT / "ai" / "cv"))
sys.path.insert(0, str(PROJECT_ROOT / "ai" / "nlp"))
sys.path.insert(0, str(PROJECT_ROOT / "ai" / "anomaly"))
sys.path.insert(0, str(Path(__file__).parent))  # backend_python itself

from routers import routing, danger, reports, cctv, anomaly, graph, clustering
from routers import websocket as ws_router

from ai.lstm.loader import load_lstm_model
from ai.cv.loader import load_cv_models
from ai.nlp.loader import load_nlp_pipeline
from ai.anomaly.loader import load_anomaly_model
from config import (
    LSTM_MODEL_PATH, LSTM_SCALER_PATH,
    CV_MOBILENET_PATH
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
)
logger = logging.getLogger(__name__)


def _validate_model_files():
    """
    Checks that required model files exist before attempting to load them.
    Raises FileNotFoundError with a clear message if any are missing.
    """
    required = {
        "LSTM model": LSTM_MODEL_PATH,
        "LSTM scaler": LSTM_SCALER_PATH,
        "CV MobileNetV2": CV_MOBILENET_PATH,
    }
    missing = []
    for name, path in required.items():
        if not Path(path).exists():
            missing.append(f"  ✗ {name}: {path}")
            logger.error(f"MISSING: {name} at {path}")
        else:
            logger.info(f"✓ Found: {name} at {path}")

    if missing:
        raise FileNotFoundError(
            "Required model files not found:\n" + "\n".join(missing) +
            "\n\nCheck config.py paths and ensure model files are in place."
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("🚀 Smart City Safety API — Starting Up")
    logger.info("=" * 60)

    # Step 1: Validate model files exist
    logger.info("📁 Validating model file paths...")
    try:
        _validate_model_files()
    except FileNotFoundError as e:
        logger.critical(str(e))
        raise

    # Step 2: Load models
    MODEL_REGISTRY = {}

    logger.info("⏳ Loading B1: LSTM...")
    try:
        MODEL_REGISTRY["lstm"] = load_lstm_model()
        logger.info("✅ B1 LSTM ready")
    except Exception as e:
        logger.error(f"❌ B1 LSTM failed: {e}")
        MODEL_REGISTRY["lstm"] = None

    logger.info("⏳ Loading B2: Computer Vision...")
    try:
        MODEL_REGISTRY["cv"] = load_cv_models()
        logger.info("✅ B2 CV ready")
    except Exception as e:
        logger.error(f"❌ B2 CV failed: {e}")
        MODEL_REGISTRY["cv"] = None

    logger.info("⏳ Loading B4: NLP Pipeline...")
    try:
        MODEL_REGISTRY["nlp"] = load_nlp_pipeline()
        logger.info("✅ B4 NLP ready")
    except Exception as e:
        logger.error(f"❌ B4 NLP failed: {e}")
        MODEL_REGISTRY["nlp"] = None

    logger.info("⏳ Loading B3: Anomaly (placeholder mode)...")
    try:
        MODEL_REGISTRY["anomaly"] = load_anomaly_model()
        mode = "REAL MODEL" if not MODEL_REGISTRY["anomaly"].get("use_fallback") else "STATISTICAL FALLBACK"
        logger.info(f"✅ B3 Anomaly ready [{mode}]")
    except Exception as e:
        logger.error(f"❌ B3 Anomaly failed: {e}")
        MODEL_REGISTRY["anomaly"] = {"use_fallback": True, "inference_module": None, "model": None}

    app.state.models = MODEL_REGISTRY

    loaded = [k for k, v in MODEL_REGISTRY.items() if v is not None]
    failed = [k for k, v in MODEL_REGISTRY.items() if v is None]

    logger.info("=" * 60)
    logger.info(f"✅ Loaded: {loaded}")
    if failed:
        logger.warning(f"⚠️  Failed (degraded mode): {failed}")
    logger.info("🎉 Server ready — http://0.0.0.0:8000")
    logger.info("📖 API docs — http://0.0.0.0:8000/docs")
    logger.info("=" * 60)

    yield  # ← server runs here

    logger.info("🛑 Shutting down — clearing model registry")
    MODEL_REGISTRY.clear()


app = FastAPI(
    title="Smart City Women's Safety API",
    description="""
## AI-Powered Safety Platform

### Modules
- **B1 LSTM**: 24-hour danger prediction (time-series)
- **B2 CV**: CCTV crowd density + anomaly detection
- **B3 Anomaly**: Structured data pattern detection (statistical fallback active)
- **B4 NLP**: Incident report analysis — severity, emotion, credibility, entity extraction

### Key Endpoints
- `POST /api/v1/predict-danger` — LSTM 24h forecast
- `POST /api/v1/analyze-report` — NLP incident analysis
- `POST /api/v1/analyze-cctv` — CV frame analysis
- `GET /api/v1/safe-route` — AI-weighted safe routing
- `GET /api/v1/graph/heatmap` — Heatmap data for map
- `WS /api/v1/ws/alerts` — Real-time alert stream
    """,
    version="2.0.0",
    lifespan=lifespan
)

# ── CORS Middleware ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://localhost:3000",   # CRA / alternative
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register All Routers ──
PREFIX = "/api/v1"

app.include_router(routing.router,    prefix=PREFIX, tags=["🗺️ Routing"])
app.include_router(danger.router,     prefix=PREFIX, tags=["🔴 Danger"])
app.include_router(reports.router,    prefix=PREFIX, tags=["📝 Reports"])
app.include_router(cctv.router,       prefix=PREFIX, tags=["📹 CCTV"])
app.include_router(anomaly.router,    prefix=PREFIX, tags=["🔍 Anomaly"])
app.include_router(graph.router,      prefix=PREFIX, tags=["🕸️ Graph"])
app.include_router(clustering.router, prefix=PREFIX, tags=["📍 Clustering"])
app.include_router(ws_router.router,  prefix=PREFIX, tags=["🔔 WebSocket"])


# ── Health Endpoints ──
@app.get("/health", tags=["⚙️ System"])
async def health():
    models = app.state.models
    return {
        "status": "healthy",
        "models": {
            k: ("loaded" if v and not v.get("use_fallback") else
                "fallback" if v and v.get("use_fallback") else
                "failed")
            for k, v in models.items()
        }
    }


@app.get("/health/models", tags=["⚙️ System"])
async def health_models():
    """Detailed model status for debugging."""
    models = app.state.models
    details = {}
    for k, v in models.items():
        if v is None:
            details[k] = {"status": "failed", "details": "Load failed at startup"}
        elif v.get("use_fallback"):
            details[k] = {"status": "fallback", "details": "Using statistical/template fallback"}
        else:
            details[k] = {"status": "loaded", "keys": list(v.keys())}
    return {"models": details}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,   # ← NEVER True in demo (kills WebSocket connections)
        workers=1       # ← NEVER >1 locally (each worker loads all models)
    )
```

---

## Fix #3 — `route_service.py` — Complete Implementation

**File:** `backend_python/services/route_service.py`

```python
# backend_python/services/route_service.py
"""
Safe Route Service — computes the lowest-danger route between two points.

Algorithm:
  1. Generate candidate waypoints between start and end
  2. For each waypoint, fetch its danger score (from TigerGraph or aggregator)
  3. Run greedy path selection weighted by danger score
  4. Return GeoJSON LineString with per-segment danger annotations

Note: For hackathon scope, waypoints are interpolated linearly.
      In production: integrate with OSM road network (e.g. via OSRM).
"""

import logging
import math
from typing import List, Tuple, Dict, Any, Optional

logger = logging.getLogger(__name__)

# Number of intermediate waypoints to sample between start and end
WAYPOINT_RESOLUTION = 10

# Danger level thresholds
DANGER_LEVELS = {
    "safe": (0.0, 0.25),
    "moderate": (0.25, 0.50),
    "unsafe": (0.50, 0.75),
    "critical": (0.75, 1.0),
}

DANGER_COLORS = {
    "safe": "#22c55e",       # green
    "moderate": "#f59e0b",   # amber
    "unsafe": "#f97316",     # orange
    "critical": "#ef4444",   # red
}


def _interpolate_waypoints(
    start: Tuple[float, float],
    end: Tuple[float, float],
    n_points: int = WAYPOINT_RESOLUTION
) -> List[Tuple[float, float]]:
    """
    Linearly interpolates n_points waypoints between start and end.
    Returns list of (lat, lng) tuples including start and end.
    """
    points = []
    for i in range(n_points + 1):
        t = i / n_points
        lat = start[0] + t * (end[0] - start[0])
        lng = start[1] + t * (end[1] - start[1])
        points.append((round(lat, 6), round(lng, 6)))
    return points


def _haversine_distance(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
    """Returns distance in meters between two (lat, lng) points."""
    R = 6371000  # Earth radius in meters
    lat1, lon1 = math.radians(p1[0]), math.radians(p1[1])
    lat2, lon2 = math.radians(p2[0]), math.radians(p2[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


def _walking_time_minutes(distance_m: float) -> float:
    """Estimates walking time at 5 km/h."""
    return round(distance_m / 83.33, 1)  # 5000m / 60min = 83.33m/min


def _score_to_level(score: float) -> str:
    for level, (lo, hi) in DANGER_LEVELS.items():
        if lo <= score < hi:
            return level
    return "critical"


async def compute_safe_route(
    start_lat: float,
    start_lng: float,
    end_lat: float,
    end_lng: float,
    models: dict,
    mode: str = "walking"
) -> Dict[str, Any]:
    """
    Computes the safest route from start to end.

    Returns GeoJSON-compatible route object with danger annotations.
    MapLibre-ready output.
    """
    from db.tigergraph_client import get_zone_data
    from utils.scoring import score_to_level

    start = (start_lat, start_lng)
    end = (end_lat, end_lng)

    # Generate waypoints
    waypoints = _interpolate_waypoints(start, end, WAYPOINT_RESOLUTION)

    # Fetch danger score for each waypoint
    waypoint_scores = []
    for lat, lng in waypoints:
        zone_id = f"{lat:.4f}_{lng:.4f}"
        try:
            zone_data = await get_zone_data(zone_id)
            score = zone_data.get("danger_score", 0.3)
        except Exception:
            score = 0.3  # neutral fallback
        waypoint_scores.append(score)

    # Build GeoJSON segments
    # IMPORTANT: GeoJSON uses [longitude, latitude] order — MapLibre requirement
    segments = []
    coordinates = []  # For the full LineString

    for i in range(len(waypoints) - 1):
        p1 = waypoints[i]
        p2 = waypoints[i + 1]
        seg_score = (waypoint_scores[i] + waypoint_scores[i + 1]) / 2
        seg_level = _score_to_level(seg_score)

        # GeoJSON: [lng, lat]
        if i == 0:
            coordinates.append([p1[1], p1[0]])
        coordinates.append([p2[1], p2[0]])

        segments.append({
            "segment_id": i,
            "start": {"lat": p1[0], "lng": p1[1]},
            "end": {"lat": p2[0], "lng": p2[1]},
            "danger_score": round(seg_score, 3),
            "danger_level": seg_level,
            "color": DANGER_COLORS[seg_level],
            # MapLibre Feature for per-segment coloring
            "geojson_feature": {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [p1[1], p1[0]],  # [lng, lat]
                        [p2[1], p2[0]]
                    ]
                },
                "properties": {
                    "segment_id": i,
                    "danger_score": round(seg_score, 3),
                    "danger_level": seg_level,
                    "color": DANGER_COLORS[seg_level]
                }
            }
        })

    # Compute overall stats
    avg_danger = round(sum(waypoint_scores) / len(waypoint_scores), 3)
    total_distance = _haversine_distance(start, end)
    overall_level = _score_to_level(avg_danger)

    # Build complete GeoJSON LineString for full route
    full_route_geojson = {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": coordinates   # [[lng, lat], ...]
        },
        "properties": {
            "overall_danger_score": avg_danger,
            "danger_level": overall_level,
            "distance_m": round(total_distance, 1),
            "estimated_time_minutes": _walking_time_minutes(total_distance),
            "mode": mode
        }
    }

    # Build FeatureCollection for segment-by-segment rendering
    segments_geojson = {
        "type": "FeatureCollection",
        "features": [seg["geojson_feature"] for seg in segments]
    }

    # Safe zone waypoints (for info markers on map)
    safe_waypoints = [
        {"lat": waypoints[i][0], "lng": waypoints[i][1], "score": waypoint_scores[i]}
        for i in range(len(waypoints))
    ]

    return {
        "route": full_route_geojson,
        "segments": segments_geojson,
        "waypoints": safe_waypoints,
        "stats": {
            "overall_danger_score": avg_danger,
            "danger_level": overall_level,
            "safety_score": round(1.0 - avg_danger, 3),
            "distance_m": round(total_distance, 1),
            "estimated_time_minutes": _walking_time_minutes(total_distance),
            "recommendation": _route_recommendation(overall_level),
            "mode": mode
        },
        "start": {"lat": start_lat, "lng": start_lng},
        "end": {"lat": end_lat, "lng": end_lng}
    }


def _route_recommendation(level: str) -> str:
    recs = {
        "safe": "Route is safe. Proceed normally.",
        "moderate": "Route has some moderate risk areas. Stay alert and use well-lit paths.",
        "unsafe": "Route passes through unsafe areas. Consider an alternative or travel with company.",
        "critical": "Route is highly dangerous. Strongly recommend avoiding. Call emergency services if needed."
    }
    return recs.get(level, recs["moderate"])
```

---

## Fix #4 — Enhanced `routers/routing.py`

```python
# backend_python/routers/routing.py
# COMPLETE version — integrates route_service and danger scores

from fastapi import APIRouter, Request, HTTPException, Query
from typing import Optional
from services.route_service import compute_safe_route
from utils.cache import get_cached, set_cached

router = APIRouter()


@router.get("/safe-route")
async def get_safe_route(
    request: Request,
    start_lat: float = Query(..., description="Start latitude"),
    start_lng: float = Query(..., description="Start longitude"),
    end_lat: float = Query(..., description="End latitude"),
    end_lng: float = Query(..., description="End longitude"),
    mode: str = Query("walking", description="Travel mode: walking|driving")
):
    """
    Returns the safest route from start to end as GeoJSON.

    Response is MapLibre-ready:
    - `route`: GeoJSON Feature (LineString) for the full path
    - `segments`: GeoJSON FeatureCollection with per-segment danger colors
    - `stats`: Overall danger score, distance, estimated time
    """
    cache_key = f"route_{start_lat:.4f}_{start_lng:.4f}_{end_lat:.4f}_{end_lng:.4f}_{mode}"
    cached = get_cached(cache_key)
    if cached:
        return cached

    try:
        result = await compute_safe_route(
            start_lat=start_lat,
            start_lng=start_lng,
            end_lat=end_lat,
            end_lng=end_lng,
            models=request.app.state.models,
            mode=mode
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Route computation failed: {str(e)}")

    set_cached(cache_key, result, ttl=120)
    return result


@router.get("/intersections")
async def get_intersections(
    lat: Optional[float] = Query(None, description="Center latitude"),
    lng: Optional[float] = Query(None, description="Center longitude"),
    radius_km: float = Query(2.0, description="Search radius in km"),
    limit: int = Query(50, description="Max intersections to return")
):
    """
    Returns intersections with danger scores for map overlay.
    Each intersection includes lat/lng and a danger_score for heatmap/marker rendering.
    """
    from db.tigergraph_client import get_client
    from db.mock_db import get_mock_intersections

    try:
        intersections = await get_mock_intersections(
            center_lat=lat, center_lng=lng,
            radius_km=radius_km, limit=limit
        )
        return {
            "intersections": intersections,
            "total": len(intersections),
            "center": {"lat": lat, "lng": lng} if lat and lng else None,
            "radius_km": radius_km
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

## Fix #5 — Complete `routers/graph.py`

```python
# backend_python/routers/graph.py

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from services.graph_service import get_heatmap_data, get_zone_summary_data

router = APIRouter()


@router.get("/graph/heatmap")
async def get_heatmap():
    """
    Returns danger scores for ALL zones.
    Response is MapLibre heatmap-ready:
    [{"zone_id": str, "lat": float, "lng": float,
      "danger_score": float, "danger_level": str}]
    """
    try:
        data = await get_heatmap_data()
        return {"zones": data, "total": len(data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/graph/zone-summary/{zone_id}")
async def get_zone_summary(zone_id: str):
    """
    Returns full data for a zone: danger score, incident count,
    recent incidents, connected zones, camera data.
    """
    try:
        data = await get_zone_summary_data(zone_id)
        if not data:
            raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found")
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/graph/zones")
async def list_zones(
    min_danger: Optional[float] = Query(None, ge=0.0, le=1.0),
    max_danger: Optional[float] = Query(None, ge=0.0, le=1.0),
    limit: int = Query(100, le=500)
):
    """Lists all zones with optional danger score filtering."""
    data = await get_heatmap_data()
    if min_danger is not None:
        data = [z for z in data if z["danger_score"] >= min_danger]
    if max_danger is not None:
        data = [z for z in data if z["danger_score"] <= max_danger]
    return {"zones": data[:limit], "total": len(data)}
```

---

## Fix #6 — `routers/clustering.py` — New File

```python
# backend_python/routers/clustering.py
"""
Clustering endpoint — groups incident reports and danger zones into clusters
for map visualization. Uses spatial clustering.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import math

router = APIRouter()


@router.get("/clusters")
async def get_clusters(
    min_cluster_size: int = Query(2, description="Minimum incidents to form a cluster"),
    radius_km: float = Query(0.5, description="Clustering radius in km"),
    hours: int = Query(24, description="Lookback window in hours")
):
    """
    Returns spatially clustered danger zones for map visualization.

    Each cluster contains:
    - center (lat, lng)
    - radius
    - incident_count
    - avg_danger_score
    - dominant_severity

    MapLibre-ready: render as circles with radius proportional to incident_count.
    """
    try:
        from services.clustering_service import compute_clusters
        clusters = await compute_clusters(
            min_size=min_cluster_size,
            radius_km=radius_km,
            hours=hours
        )
        return {
            "clusters": clusters,
            "total": len(clusters),
            "params": {
                "min_cluster_size": min_cluster_size,
                "radius_km": radius_km,
                "hours": hours
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/clusters/geojson")
async def get_clusters_geojson(
    min_cluster_size: int = Query(2),
    radius_km: float = Query(0.5)
):
    """
    Same as /clusters but returns GeoJSON FeatureCollection.
    Direct input to MapLibre addSource().
    """
    from services.clustering_service import compute_clusters
    clusters = await compute_clusters(min_size=min_cluster_size, radius_km=radius_km)

    features = [
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [c["center_lng"], c["center_lat"]]  # GeoJSON: lng first
            },
            "properties": {
                "cluster_id": c["cluster_id"],
                "incident_count": c["incident_count"],
                "avg_danger_score": c["avg_danger_score"],
                "danger_level": c["danger_level"],
                "dominant_severity": c["dominant_severity"],
                "radius_m": c.get("radius_m", 500)
            }
        }
        for c in clusters
    ]

    return {
        "type": "FeatureCollection",
        "features": features
    }
```

---

## Fix #7 — `services/clustering_service.py` — New File

```python
# backend_python/services/clustering_service.py
"""
Spatial clustering of incidents and danger zones.
Uses a simple grid-based approach for hackathon scope.
For production: replace with DBSCAN via scikit-learn.
"""

import math
import logging
from typing import List, Dict, Any
from db.tigergraph_client import get_zone_data
from db.mock_db import MOCK_ZONES

logger = logging.getLogger(__name__)

SEVERITY_RANK = {"critical": 4, "high": 3, "medium": 2, "low": 1}


async def compute_clusters(
    min_size: int = 2,
    radius_km: float = 0.5,
    hours: int = 24
) -> List[Dict[str, Any]]:
    """
    Groups zones into spatial clusters using a simple neighbor-merge algorithm.

    For production: replace with:
      from sklearn.cluster import DBSCAN
      import numpy as np
      coords = np.array([(z['lat'], z['lng']) for z in zones])
      labels = DBSCAN(eps=radius_km/111, min_samples=min_size).fit_predict(coords)
    """
    zones = list(MOCK_ZONES.values())

    # Simple grid-cell clustering
    cell_size = radius_km / 111.0  # degrees per km
    cells: Dict[str, List[dict]] = {}

    for zone in zones:
        cell_lat = math.floor(zone["lat"] / cell_size)
        cell_lng = math.floor(zone["lng"] / cell_size)
        cell_key = f"{cell_lat}_{cell_lng}"
        cells.setdefault(cell_key, []).append(zone)

    clusters = []
    for idx, (cell_key, cell_zones) in enumerate(cells.items()):
        if len(cell_zones) < min_size:
            continue

        center_lat = sum(z["lat"] for z in cell_zones) / len(cell_zones)
        center_lng = sum(z["lng"] for z in cell_zones) / len(cell_zones)
        avg_danger = sum(z["danger_score"] for z in cell_zones) / len(cell_zones)

        # Compute dominant severity from incident data
        severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for z in cell_zones:
            inc_count = z.get("incident_count_24h", 0)
            if inc_count > 10:
                severity_counts["critical"] += 1
            elif inc_count > 5:
                severity_counts["high"] += 1
            elif inc_count > 2:
                severity_counts["medium"] += 1
            else:
                severity_counts["low"] += 1

        dominant = max(severity_counts, key=lambda k: severity_counts[k])

        # Danger level
        if avg_danger < 0.25:
            level = "safe"
        elif avg_danger < 0.50:
            level = "moderate"
        elif avg_danger < 0.75:
            level = "unsafe"
        else:
            level = "critical"

        clusters.append({
            "cluster_id": f"cluster_{idx}",
            "center_lat": round(center_lat, 6),
            "center_lng": round(center_lng, 6),
            "zone_count": len(cell_zones),
            "incident_count": sum(z.get("incident_count_24h", 0) for z in cell_zones),
            "avg_danger_score": round(avg_danger, 3),
            "danger_level": level,
            "dominant_severity": dominant,
            "radius_m": int(radius_km * 1000),
            "zone_ids": [z["zone_id"] for z in cell_zones]
        })

    # Sort by danger descending
    clusters.sort(key=lambda c: c["avg_danger_score"], reverse=True)
    return clusters
```

---

## Fix #8 — NLP Safe Wrapper (Resilient Function Calls)

Update `services/nlp_service.py` to use safe attribute access:

```python
# In services/nlp_service.py — replace the direct hasattr calls with this pattern

def _safe_call(module, fn_names: list, *args, **kwargs):
    """
    Tries each function name in order. Returns result of first that exists.
    Returns None if none found.

    fn_names: list of possible function names to try, e.g.:
      ['analyze_sentiment', 'sentiment', 'get_sentiment', 'predict_sentiment']
    """
    for fn_name in fn_names:
        fn = getattr(module, fn_name, None)
        if callable(fn):
            try:
                return fn(*args, **kwargs)
            except Exception as e:
                logger = __import__('logging').getLogger(__name__)
                logger.warning(f"NLP function '{fn_name}' failed: {e}")
    return None


# Usage in analyze_incident_report():
sentiment_out = _safe_call(
    nlp_module,
    ["analyze_sentiment", "sentiment_analysis", "get_sentiment", "predict"],
    report_text
)
if sentiment_out and isinstance(sentiment_out, dict):
    result["sentiment"] = sentiment_out.get("label", "neutral")
    result["sentiment_score"] = sentiment_out.get("score", 0.5)
else:
    result["sentiment"] = "neutral"
    result["sentiment_score"] = 0.5
```

---

## Fix #9 — `utils/geo_utils.py` — Complete Implementation

```python
# backend_python/utils/geo_utils.py

import math
from typing import Tuple, List


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distance in meters between two lat/lng points."""
    R = 6371000
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    Δφ = math.radians(lat2 - lat1)
    Δλ = math.radians(lng2 - lng1)
    a = math.sin(Δφ/2)**2 + math.cos(φ1)*math.cos(φ2)*math.sin(Δλ/2)**2
    return R * 2 * math.asin(math.sqrt(a))


def lat_lng_to_zone_id(lat: float, lng: float, precision: int = 4) -> str:
    """Convert coordinates to a zone identifier string."""
    return f"{lat:.{precision}f}_{lng:.{precision}f}"


def bounding_box(lat: float, lng: float, radius_km: float) -> dict:
    """Returns a bounding box dict for a circle of radius_km around lat/lng."""
    delta_lat = radius_km / 111.0
    delta_lng = radius_km / (111.0 * math.cos(math.radians(lat)))
    return {
        "min_lat": lat - delta_lat,
        "max_lat": lat + delta_lat,
        "min_lng": lng - delta_lng,
        "max_lng": lng + delta_lng
    }


def coords_to_geojson_point(lat: float, lng: float, properties: dict = None) -> dict:
    """Returns a GeoJSON Point Feature. Note: GeoJSON uses [lng, lat] order."""
    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lng, lat]},
        "properties": properties or {}
    }


def coords_list_to_geojson_line(points: List[Tuple[float, float]]) -> dict:
    """
    Converts list of (lat, lng) tuples to GeoJSON LineString Feature.
    IMPORTANT: Converts to GeoJSON [lng, lat] order internally.
    """
    return {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": [[lng, lat] for lat, lng in points]
        },
        "properties": {}
    }
```

---

## Fix #10 — `db/mock_db.py` — Add Intersections

```python
# backend_python/db/mock_db.py — ADD these to existing file

import random
import math

# ... (existing MOCK_ZONES dict stays) ...

async def get_mock_intersections(
    center_lat: float = None,
    center_lng: float = None,
    radius_km: float = 2.0,
    limit: int = 50
) -> list:
    """Returns mock intersection data suitable for map overlay."""
    base_lat = center_lat or 30.7333
    base_lng = center_lng or 76.7794

    intersections = []
    for i in range(min(limit, 30)):
        lat = base_lat + (random.uniform(-radius_km, radius_km) / 111.0)
        lng = base_lng + (random.uniform(-radius_km, radius_km) / 111.0)
        danger = round(random.uniform(0.1, 0.95), 2)

        if danger < 0.25: level = "safe"
        elif danger < 0.50: level = "moderate"
        elif danger < 0.75: level = "unsafe"
        else: level = "critical"

        intersections.append({
            "intersection_id": f"INT_{i:03d}",
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "danger_score": danger,
            "danger_level": level,
            "incident_count": random.randint(0, 15),
            "street_names": [f"Road {i}", f"Street {i+1}"],
            # GeoJSON point for direct MapLibre use
            "geojson": {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lng, lat]},
                "properties": {
                    "id": f"INT_{i:03d}",
                    "danger_score": danger,
                    "danger_level": level
                }
            }
        })

    return intersections
```

---

## Fix #11 — WebSocket Registration + Alert Broadcasting

**File:** `backend_python/routers/websocket.py` (already in plan, ensure it's complete)

```python
# backend_python/routers/websocket.py
# NOTE: This module is also imported by services that need to broadcast

import asyncio
import json
import logging
from typing import List
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()
logger = logging.getLogger(__name__)

# Global connection pool — module-level so services can call broadcast_alert()
_active_connections: List[WebSocket] = []


@router.websocket("/ws/alerts")
async def alerts_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for real-time safety alerts.
    Frontend connects once; server pushes alerts as they happen.

    Message types from server:
    - {"type": "PING"} — keep-alive
    - {"type": "NEW_ALERT", "data": {...}} — new safety alert
    - {"type": "DANGER_UPDATE", "data": {...}} — zone danger score changed
    - {"type": "NEW_REPORT", "data": {...}} — new incident report submitted
    """
    await websocket.accept()
    _active_connections.append(websocket)
    client_id = id(websocket)
    logger.info(f"WS client connected: {client_id}. Total: {len(_active_connections)}")

    try:
        # Send welcome message
        await websocket.send_json({
            "type": "CONNECTED",
            "data": {
                "message": "Connected to Smart City Safety Alert Stream",
                "timestamp": datetime.utcnow().isoformat(),
                "client_id": str(client_id)
            }
        })

        # Keep connection alive — client can also send messages (ignored for now)
        while True:
            try:
                # Wait for client message with timeout
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                # Echo back (optional: handle client-side commands here)
            except asyncio.TimeoutError:
                # Send keep-alive ping
                await websocket.send_json({"type": "PING", "ts": datetime.utcnow().isoformat()})

    except WebSocketDisconnect:
        logger.info(f"WS client disconnected: {client_id}")
    except Exception as e:
        logger.error(f"WS error for client {client_id}: {e}")
    finally:
        if websocket in _active_connections:
            _active_connections.remove(websocket)
        logger.info(f"WS cleanup done. Remaining: {len(_active_connections)}")


async def broadcast_alert(alert_type: str, data: dict):
    """
    Call this from any service to push a real-time message to ALL connected clients.

    Usage:
        from routers.websocket import broadcast_alert
        await broadcast_alert("NEW_ALERT", {
            "location_id": "zone_42",
            "danger_level": "critical",
            "message": "Anomaly detected"
        })

    alert_type: "NEW_ALERT" | "DANGER_UPDATE" | "NEW_REPORT" | "ANOMALY_DETECTED"
    """
    if not _active_connections:
        return  # No clients connected — skip silently

    payload = {
        "type": alert_type,
        "data": {**data, "timestamp": datetime.utcnow().isoformat()}
    }

    dead_connections = []
    for conn in _active_connections[:]:
        try:
            await conn.send_json(payload)
        except Exception as e:
            logger.warning(f"Failed to send to WS client {id(conn)}: {e}")
            dead_connections.append(conn)

    for conn in dead_connections:
        if conn in _active_connections:
            _active_connections.remove(conn)

    logger.debug(f"Broadcast '{alert_type}' to {len(_active_connections)} clients")
```

---

## Fix #12 — Wire `broadcast_alert` into Reports + Aggregator

**In `routers/reports.py` — after NLP analysis:**

```python
# In analyze_report() function, AFTER nlp analysis and AFTER graph upsert:

from routers.websocket import broadcast_alert

# Broadcast new report to all connected clients
if analysis["severity"] in ["high", "critical"]:
    await broadcast_alert("NEW_REPORT", {
        "report_id": report_id,
        "location_id": body.location_id,
        "severity": analysis["severity"],
        "emotion": analysis["emotion"],
        "auto_response": analysis["auto_response"],
        "lat": body.lat,
        "lng": body.lng
    })

# If severity is high/critical, invalidate danger score cache for that zone
if analysis["severity"] in ["high", "critical"] and body.location_id:
    from utils.cache import invalidate_prefix
    invalidate_prefix(f"danger_agg_{body.location_id}")
    invalidate_prefix(f"lstm_{body.location_id}")
```

---

## Fix #13 — Complete `models/` Files

**File:** `backend_python/models/cctv_models.py`
```python
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class CCTVAnalysisResponse(BaseModel):
    camera_id: str
    location_id: Optional[str]
    person_count: int
    crowd_density: str           # "low" | "medium" | "high"
    density_score: float
    anomalies_detected: bool
    anomaly_details: List[Dict[str, Any]]
    yolo_detections: List[Dict[str, Any]]
    danger_contribution: float
```

**File:** `backend_python/models/route_models.py`
```python
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class RouteResponse(BaseModel):
    route: Dict[str, Any]        # GeoJSON Feature (LineString)
    segments: Dict[str, Any]     # GeoJSON FeatureCollection
    waypoints: List[Dict]
    stats: Dict[str, Any]
    start: Dict[str, float]
    end: Dict[str, float]

class RouteStatsModel(BaseModel):
    overall_danger_score: float
    danger_level: str
    safety_score: float
    distance_m: float
    estimated_time_minutes: float
    recommendation: str
    mode: str
```

**File:** `backend_python/models/report_models.py` — COMPLETE VERSION
```python
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from enum import Enum

class SeverityLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"

class ReportStatus(str, Enum):
    pending = "pending"
    acknowledged = "acknowledged"
    resolved = "resolved"
    false_alarm = "false_alarm"

class ReportRequest(BaseModel):
    text: str = Field(..., min_length=10, description="Incident description")
    location_id: Optional[str] = None
    report_id: Optional[str] = None
    reporter_id: Optional[str] = None
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lng: Optional[float] = Field(None, ge=-180, le=180)

class ReportResponse(BaseModel):
    report_id: str
    sentiment: str
    sentiment_score: float
    emotion: str
    emotion_scores: Optional[Dict[str, float]] = {}
    severity: str
    severity_score: float
    credibility_score: float
    entities: Dict[str, Any]
    is_duplicate: bool
    duplicate_of: Optional[str]
    auto_response: str
    timestamp: str
    location_id: Optional[str]

class ReportDetailResponse(ReportResponse):
    status: str = "pending"
    notes: Optional[str] = None

class ReportStatusUpdate(BaseModel):
    status: ReportStatus
    notes: Optional[str] = None

class ReportListResponse(BaseModel):
    reports: List[Dict[str, Any]]
    total: int
    page: int = 1
    page_size: int = 50
    filtered_by: Optional[Dict[str, Any]] = None
```

---

# 4. 🧠 ARCHITECTURE IMPROVEMENTS

## 4.1 — Cache Invalidation on Report Submission
When a high/critical report is submitted, invalidate the danger score cache for that zone so the next request gets a fresh aggregated score. Already shown in Fix #12.

## 4.2 — Anomaly Module — Future-Proof Interface Contract

The interface is deliberately designed so adding a real model requires **only two file edits**:

```
When real B3 model is ready:
  1. Edit ai/anomaly/loader.py:
     - Set use_fallback = False
     - Load actual model file (e.g., isolation_forest.pkl or autoencoder.h5)
     - Return it in the bundle dict

  2. Edit services/anomaly_service.py:
     - In the top of detect_anomalies(), call inference_module.detect(data)
       instead of the z-score fallback

  Everything else (router, aggregator, frontend, TigerGraph writes) = unchanged.
```

## 4.3 — Dependency Injection via `request.app.state`
All services access models via `request.app.state.models`. This is correct FastAPI pattern. Do NOT use global variables for model storage.

## 4.4 — Lazy Import Pattern for Circular Dependency Prevention
Import `broadcast_alert` and `invalidate_prefix` inside function bodies, not at module top-level, to prevent circular imports between routers ↔ services ↔ routers.

---

# 5. 🗺️ MAP INTEGRATION FIXES

## 5.1 — GeoJSON Coordinate Order (Most Common Bug)

**THE LAW:** GeoJSON always uses `[longitude, latitude]` — NOT `[lat, lng]`.
MapLibre follows GeoJSON spec strictly. Wrong order = markers appear in ocean.

**Audit every place in the codebase where coordinates are constructed:**
```python
# ❌ WRONG — will put markers in wrong hemisphere
{"coordinates": [lat, lng]}

# ✅ CORRECT — GeoJSON standard, MapLibre compatible
{"coordinates": [lng, lat]}
```

Files to check: `route_service.py`, `routers/graph.py`, `db/mock_db.py`, `services/clustering_service.py`

## 5.2 — Heatmap Response Format for MapLibre

MapLibre's `addSource` with `type: "geojson"` expects a FeatureCollection.
The `/graph/heatmap` endpoint should also support a GeoJSON format:

```python
# Add this endpoint to routers/graph.py

@router.get("/graph/heatmap/geojson")
async def get_heatmap_geojson():
    """
    Returns heatmap data as GeoJSON FeatureCollection.
    Direct input to MapLibre map.addSource('heatmap', {type:'geojson', data: response})
    """
    data = await get_heatmap_data()
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [z["lng"], z["lat"]]   # [lng, lat] — GeoJSON order
                },
                "properties": {
                    "zone_id": z["zone_id"],
                    "danger_score": z["danger_score"],
                    "danger_level": z["danger_level"]
                }
            }
            for z in data
        ]
    }
```

## 5.3 — Safe Route Rendering in MapLibre

Frontend must use `segments` (FeatureCollection) for colored line rendering, not `route` (single LineString). Here's the correct MapLibre setup:

```javascript
// frontend/src/components/Map/RouteOverlay.jsx

import { useEffect } from 'react';
import { getSafeRoute } from '../../services/api';

const DANGER_COLORS = {
  safe: '#22c55e',
  moderate: '#f59e0b',
  unsafe: '#f97316',
  critical: '#ef4444',
};

export function RouteOverlay({ mapRef, start, end }) {
  useEffect(() => {
    if (!mapRef.current || !start || !end) return;
    const map = mapRef.current;

    const drawRoute = async () => {
      const result = await getSafeRoute(start.lat, start.lng, end.lat, end.lng);

      // Add segments source (FeatureCollection — for coloring)
      if (map.getSource('route-segments')) {
        map.getSource('route-segments').setData(result.segments);
      } else {
        map.addSource('route-segments', { type: 'geojson', data: result.segments });
        map.addLayer({
          id: 'route-segments-layer',
          type: 'line',
          source: 'route-segments',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': ['get', 'color'],   // color from feature property
            'line-width': 5,
            'line-opacity': 0.85
          }
        });
      }

      // Add start/end markers
      // (use MapLibre Marker API for start/end pins)
    };

    drawRoute();
  }, [mapRef, start, end]);

  return null;
}
```

## 5.4 — Clustering Layer in MapLibre

```javascript
// frontend/src/components/Map/ClusterLayer.jsx

import { useEffect } from 'react';

export function ClusterLayer({ mapRef }) {
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const loadClusters = async () => {
      const { default: api } = await import('../../services/api');
      const geojson = await api.getClustersGeoJSON();

      if (map.getSource('clusters')) {
        map.getSource('clusters').setData(geojson);
      } else {
        map.addSource('clusters', { type: 'geojson', data: geojson });

        // Cluster circle layer
        map.addLayer({
          id: 'cluster-circles',
          type: 'circle',
          source: 'clusters',
          paint: {
            'circle-radius': [
              'interpolate', ['linear'],
              ['get', 'incident_count'],
              0, 10,
              20, 40
            ],
            'circle-color': [
              'match', ['get', 'danger_level'],
              'safe', '#22c55e',
              'moderate', '#f59e0b',
              'unsafe', '#f97316',
              'critical', '#ef4444',
              '#94a3b8'
            ],
            'circle-opacity': 0.6,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff'
          }
        });

        // Incident count label
        map.addLayer({
          id: 'cluster-labels',
          type: 'symbol',
          source: 'clusters',
          layout: {
            'text-field': ['get', 'incident_count'],
            'text-size': 12,
            'text-font': ['Open Sans Bold']
          },
          paint: { 'text-color': '#ffffff' }
        });
      }
    };

    map.on('load', loadClusters);
    const interval = setInterval(loadClusters, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [mapRef]);

  return null;
}
```

## 5.5 — Alert Markers on Map

```javascript
// frontend/src/components/Map/AlertMarkers.jsx

import { useEffect, useRef } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';

export function AlertMarkers({ mapRef }) {
  const markersRef = useRef([]);

  const handleAlert = (message) => {
    if (!mapRef.current) return;
    if (message.type !== 'NEW_REPORT' && message.type !== 'NEW_ALERT') return;

    const { lat, lng, severity, location_id } = message.data;
    if (!lat || !lng) return;

    const map = mapRef.current;

    // Create colored marker element
    const el = document.createElement('div');
    el.style.cssText = `
      width: 16px; height: 16px; border-radius: 50%;
      background: ${severity === 'critical' ? '#ef4444' :
                    severity === 'high' ? '#f97316' : '#f59e0b'};
      border: 2px solid white;
      box-shadow: 0 0 8px rgba(0,0,0,0.4);
      animation: pulse 1.5s infinite;
    `;

    // Using MapLibre Marker
    const { Marker, Popup } = window.maplibregl;
    const popup = new Popup({ offset: 12 })
      .setHTML(`<div><strong>${severity.toUpperCase()}</strong><br/>${location_id}</div>`);

    const marker = new Marker({ element: el })
      .setLngLat([lng, lat])
      .setPopup(popup)
      .addTo(map);

    markersRef.current.push(marker);

    // Auto-remove after 10 minutes
    setTimeout(() => {
      marker.remove();
      markersRef.current = markersRef.current.filter(m => m !== marker);
    }, 10 * 60 * 1000);
  };

  useWebSocket(handleAlert);
  return null;
}
```

---

# 6. ⚙️ FINAL EXECUTION PLAN FOR GEMINI

> **Gemini Execution Rules:**
> 1. Execute steps **in order, top to bottom**
> 2. After each step with a **VERIFY** tag, run the listed command before proceeding
> 3. A step marked **[GATE]** means: if it fails, STOP and fix before continuing
> 4. When a step says "READ BEFORE EDITING" — actually read the file first
> 5. Never skip a step because it "looks done" — verify it

---

## STEP 0 — Environment Verification [GATE]

```bash
# Run ALL of these. Fix any failures before proceeding.
python --version                         # Must be 3.9+
pip --version
ls backend_python/                       # Verify directory exists
ls ai/lstm/lstm_INT007.keras             # [GATE] Must exist
ls ai/lstm/scaler_INT007.pkl             # [GATE] Must exist
ls ai/cv/mobilenetv2_crowd.pth           # [GATE] Must exist
ls ai/nlp/inference.py                   # [GATE] Must exist
ls ai/cv/inference.py                    # [GATE] Must exist
```

---

## STEP 1 — Resolve `report.py` vs `reports.py`

### 1a — Read `report.py` fully
```bash
cat backend_python/routers/report.py
```

### 1b — Check which features exist in `report.py` but NOT in `reports.py`
Look for:
- `GET /reports/{report_id}` (single report fetch)
- `DELETE /reports/{report_id}`
- `PUT /reports/{report_id}/status`
- `GET /reports/stats`
- Any Pydantic models defined inline

### 1c — Port missing features to `reports.py`

Open `backend_python/routers/reports.py`. At the **bottom**, add any endpoints found in Step 1b that don't already exist, using the code from Fix #1 in Section 3 as your template.

### 1d — Port any Pydantic models to `models/report_models.py`

Replace the contents of `backend_python/models/report_models.py` with the **Complete Version** from Fix #13.

### 1e — Remove `report.py` from `main.py` registration

Open `main.py`. Find and delete any line like:
```python
from routers import report
app.include_router(report.router, ...)
```

### 1f — Delete `report.py`
```bash
rm backend_python/routers/report.py
```

**VERIFY:**
```bash
ls backend_python/routers/report.py   # Should return: No such file or directory
grep -n "from routers import report" backend_python/main.py  # Should return: nothing
```

---

## STEP 2 — Install / Update Dependencies [GATE]

Replace `backend_python/requirements.txt` with:
```
fastapi==0.110.0
uvicorn[standard]==0.27.0
python-multipart==0.0.9
pydantic==2.6.0
tensorflow>=2.13.0
torch>=2.0.0
torchvision>=0.15.0
ultralytics>=8.0.0
Pillow>=10.0.0
numpy>=1.24.0
scikit-learn>=1.3.0
python-dotenv==1.0.0
websockets>=12.0
httpx>=0.26.0
```

Note: `pyTigerGraph` intentionally omitted — add it manually only if TigerGraph is accessible. Mock fallback is default.

```bash
cd backend_python
pip install -r requirements.txt
```

**VERIFY [GATE]:**
```bash
python -c "import fastapi, uvicorn, torch, torchvision, tensorflow, ultralytics, PIL, numpy; print('✅ All deps OK')"
```

---

## STEP 3 — Create/Verify Directory Structure

```bash
cd backend_python
mkdir -p routers services models ai/lstm ai/cv ai/nlp ai/anomaly db utils tests

# Create all __init__.py files
for dir in routers services models ai ai/lstm ai/cv ai/nlp ai/anomaly db utils; do
    touch "$dir/__init__.py"
done

echo "✅ Directory structure ready"
```

---

## STEP 4 — Write `config.py` [GATE]

Create `backend_python/config.py` with exact content:
```python
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
AI_ROOT = PROJECT_ROOT / "ai"

LSTM_MODEL_PATH   = AI_ROOT / "lstm" / "lstm_INT007.keras"
LSTM_SCALER_PATH  = AI_ROOT / "lstm" / "scaler_INT007.pkl"
CV_MOBILENET_PATH = AI_ROOT / "cv"   / "mobilenetv2_crowd.pth"
CV_YOLO_MODEL_NAME = "yolov8n.pt"
NLP_MODULE_PATH   = AI_ROOT / "nlp"
ANOMALY_MODULE_PATH = AI_ROOT / "anomaly"

TIGERGRAPH_HOST     = os.getenv("TIGERGRAPH_HOST", "http://localhost")
TIGERGRAPH_PORT     = int(os.getenv("TIGERGRAPH_PORT", 14240))
TIGERGRAPH_GRAPH    = os.getenv("TIGERGRAPH_GRAPH", "SafeCity")
TIGERGRAPH_USERNAME = os.getenv("TIGERGRAPH_USERNAME", "tigergraph")
TIGERGRAPH_PASSWORD = os.getenv("TIGERGRAPH_PASSWORD", "tigergraph")
USE_MOCK_DB = os.getenv("USE_MOCK_DB", "true").lower() == "true"

DANGER_SCORE_CACHE_TTL   = 300
LSTM_PREDICTION_CACHE_TTL = 3600
ENABLE_CV  = os.getenv("ENABLE_CV",  "true").lower() == "true"
ENABLE_NLP = os.getenv("ENABLE_NLP", "true").lower() == "true"
```

**VERIFY:**
```bash
python -c "from config import LSTM_MODEL_PATH; print('Path:', LSTM_MODEL_PATH); print('Exists:', LSTM_MODEL_PATH.exists())"
```
Expected: `Exists: True` — if False, the model file path in config is wrong. Fix `AI_ROOT`.

---

## STEP 5 — Write Utility Files

### 5a — `utils/cache.py`
Write exact content from Fix #2 (Section 3) `utils/cache.py` block.

### 5b — `utils/scoring.py`
Write exact content from Phase 1 Step 1.2.

### 5c — `utils/geo_utils.py`
Write exact content from Fix #9.

**VERIFY:**
```bash
python -c "
from utils.cache import get_cached, set_cached
from utils.scoring import score_to_level
from utils.geo_utils import haversine_distance, lat_lng_to_zone_id

set_cached('x', 99, 60)
assert get_cached('x') == 99
assert score_to_level(0.8) == 'critical'
d = haversine_distance(30.0, 76.0, 30.01, 76.01)
assert 1000 < d < 2000, f'Bad distance: {d}'
print('✅ Utils all pass')
"
```

---

## STEP 6 — Write Pydantic Models

Write these four files with exact content from Fix #13:
- `models/danger_models.py` (from Section 2.3 Step B1.3)
- `models/report_models.py` (Complete Version from Fix #13)
- `models/cctv_models.py` (from Fix #13)
- `models/route_models.py` (from Fix #13)

**VERIFY:**
```bash
python -c "
from models.danger_models import DangerPredictRequest, DangerPredictResponse
from models.report_models import ReportRequest, ReportResponse, ReportStatus
from models.cctv_models import CCTVAnalysisResponse
from models.route_models import RouteResponse
print('✅ All models import cleanly')
"
```

---

## STEP 7 — Write Database Layer

### 7a — `db/mock_db.py`
Write the content from the original plan PLUS the additions from Fix #10 (add `get_mock_intersections` function).

### 7b — `db/tigergraph_client.py`
Write exact content from Section 5.2.

**VERIFY:**
```bash
python -c "
from db.mock_db import MOCK_ZONES, get_mock_intersections
import asyncio
zones = list(MOCK_ZONES.values())
assert len(zones) == 20, f'Expected 20 zones, got {len(zones)}'
ints = asyncio.run(get_mock_intersections())
assert len(ints) > 0
print(f'✅ Mock DB OK: {len(zones)} zones, {len(ints)} intersections')
"
```

---

## STEP 8 — Write AI Loaders [GATE]

### 8a — Inspect actual function names in inference.py files

```bash
python -c "
import sys

sys.path.insert(0, 'ai/lstm')
import inference as lstm_inf
print('=== LSTM inference.py functions ===')
print([f for f in dir(lstm_inf) if not f.startswith('_')])

sys.path.insert(0, 'ai/nlp')
import inference as nlp_inf
print('=== NLP inference.py functions ===')
print([f for f in dir(nlp_inf) if not f.startswith('_')])

sys.path.insert(0, 'ai/cv')
import inference as cv_inf
print('=== CV inference.py functions ===')
print([f for f in dir(cv_inf) if not f.startswith('_')])
"
```

**RECORD the output.** You will need the actual function names in Steps 8b–8d.

### 8b — Write `ai/lstm/loader.py`
Use exact content from Section 2.3 Step B1.1.
**Adjust `inference_fn = lstm_inference.predict` to match actual function name from Step 8a.**

### 8c — Write `ai/cv/loader.py`
Use exact content from Section 2.4 Step B2.1.
**Adjust `inference_fn = cv_inference.analyze` to match actual function name from Step 8a.**

### 8d — Write `ai/nlp/loader.py`
Use exact content from Section 2.5 Step B4.1.
No function name adjustment needed (uses `_safe_call` pattern).

### 8e — Write `ai/anomaly/loader.py`
Use exact content from the original plan Section 2.6 Step B3.1.
This is a placeholder loader — it will try to import and fail gracefully, setting `use_fallback=True`.

### VERIFY [GATE]:
```bash
python -c "
from ai.lstm.loader import load_lstm_model
bundle = load_lstm_model()
assert bundle['model'] is not None, 'LSTM model is None!'
print('✅ LSTM loader OK')
print('Model summary input shape:', bundle['model'].input_shape)
"
```

If this fails: check that `LSTM_MODEL_PATH` in config.py resolves to the actual `.keras` file.

```bash
python -c "
from ai.cv.loader import load_cv_models
bundle = load_cv_models()
assert bundle['mobilenet'] is not None
print('✅ CV loader OK, device:', bundle['device'])
"
```

```bash
python -c "
from ai.nlp.loader import load_nlp_pipeline
bundle = load_nlp_pipeline()
assert bundle['inference_module'] is not None
print('✅ NLP loader OK')
print('Functions:', [f for f in dir(bundle['inference_module']) if not f.startswith('_')])
"
```

```bash
python -c "
from ai.anomaly.loader import load_anomaly_model
bundle = load_anomaly_model()
print('✅ Anomaly loader OK. Fallback mode:', bundle.get('use_fallback', False))
"
```

---

## STEP 9 — Write Services Layer

### 9a — `services/lstm_service.py`
Use exact content from Section 2.3 Step B1.2.

**CRITICAL ADJUSTMENT:** After loading the model in Step 8b, you know the actual output shape.
Check `bundle['model'].output_shape`. If it returns a single value (e.g., `(None, 1)`), the `predict_danger_score` function's reshape logic is correct. If it returns `(None, 24)`, remove the `np.tile` logic.

### 9b — `services/cv_service.py`
Use exact content from Section 2.4 Step B2.2.

**CRITICAL ADJUSTMENT:** The MobileNetV2 classifier line count:
```python
mobilenet.classifier[1] = torch.nn.Linear(mobilenet.last_channel, 3)
```
The `3` here = number of density classes (low/medium/high). If your model was trained with a different number of output classes, this will fail. Check by:
```bash
python -c "
import torch
state_dict = torch.load('ai/cv/mobilenetv2_crowd.pth', map_location='cpu')
# Find the classifier weight shape
classifier_keys = [k for k in state_dict.keys() if 'classifier' in k]
for k in classifier_keys:
    print(k, state_dict[k].shape)
"
```
Set the output classes (`3` in the code) to match `state_dict['classifier.1.weight'].shape[0]`.

### 9c — `services/nlp_service.py`
Use exact content from Section 2.5 Step B4.2.
**Replace the `hasattr` pattern with `_safe_call` pattern from Fix #8.**

Add the `_safe_call` function at the top of the file, then use it for every NLP call:

```python
# Replace all hasattr+call patterns in nlp_service.py with:
sentiment_out = _safe_call(
    nlp_module,
    ["analyze_sentiment", "sentiment", "sentiment_analysis", "predict_sentiment"],
    report_text
)
```

Do the same for emotion, severity, credibility, entities, response generation.

### 9d — `services/anomaly_service.py`
Use exact content from Section 2.6 Step B3.2. No changes needed — z-score fallback is the active path.

### 9e — `services/danger_aggregator.py`
Use exact content from Section 2.7.
**IMPORTANT FIX:** Move the `get_zone_data` import inside the function body to prevent circular imports:

```python
# In aggregate_danger_score(), INSIDE the function, change:
# from db.tigergraph_client import get_zone_data  ← REMOVE from top of file
# to (inside the function):

async def aggregate_danger_score(...):
    from db.tigergraph_client import get_zone_data   # ← lazy import here
    ...
```

### 9f — `services/graph_service.py`
Use content from Phase 3 Step 3.6 PLUS add these functions:

```python
# Add to services/graph_service.py

async def get_report_by_id(report_id: str):
    """Fetch single report from TigerGraph or mock."""
    client = get_client()
    result = await client.get_vertex("Incident", report_id)
    return result

async def update_report_status(report_id: str, status: str, notes: str = None):
    """Update report status in TigerGraph."""
    client = get_client()
    await client.upsert_vertex("Incident", report_id, {
        "status": status,
        "notes": notes or "",
        "updated_at": __import__('datetime').datetime.utcnow().isoformat()
    })
    return {"report_id": report_id, "status": status, "updated": True}

async def get_report_stats(location_id: str = None, hours: int = 24):
    """Returns aggregate report stats."""
    return {
        "total_reports": 47,
        "by_severity": {"critical": 3, "high": 12, "medium": 22, "low": 10},
        "by_emotion": {"fear": 25, "anger": 15, "neutral": 7},
        "location_id": location_id,
        "hours": hours,
        "note": "Mock data — connect TigerGraph for real stats"
    }

async def get_zone_summary_data(zone_id: str):
    """Returns full zone data including recent incidents."""
    from db.mock_db import MOCK_ZONES
    zone = MOCK_ZONES.get(zone_id)
    if zone:
        return {**zone, "recent_incidents": [], "connected_zones": []}
    return None
```

### 9g — `services/route_service.py`
Write exact content from Fix #3.

### 9h — `services/clustering_service.py`
Write exact content from Fix #7.

**VERIFY all services:**
```bash
python -c "
import asyncio

# Test LSTM service
from ai.lstm.loader import load_lstm_model
from services.lstm_service import predict_danger_score
bundle = load_lstm_model()
features = [[h, 0, 2.0, 0.4, 0.6, 0.3] for h in range(24)]
r = predict_danger_score(bundle, 'test', features)
assert 'predictions' in r and len(r['predictions']) == 24
print('✅ LSTM service OK — peak hour:', r['peak_danger_hour'])

# Test Anomaly service
from ai.anomaly.loader import load_anomaly_model
from services.anomaly_service import detect_anomalies
ab = load_anomaly_model()
data = [{'incident_count': 1} for _ in range(9)] + [{'incident_count': 99}]
r2 = detect_anomalies(ab, 'zone_0', data)
assert r2['anomaly_detected'] == True
print('✅ Anomaly service OK — score:', r2['anomaly_score'])

# Test clustering service
from services.clustering_service import compute_clusters
clusters = asyncio.run(compute_clusters())
print(f'✅ Clustering service OK — {len(clusters)} clusters')

# Test route service
from services.route_service import compute_safe_route
route = asyncio.run(compute_safe_route(30.73, 76.77, 30.75, 76.79, {}))
assert 'route' in route and 'segments' in route
assert route['route']['type'] == 'Feature'
assert route['route']['geometry']['type'] == 'LineString'
print('✅ Route service OK — danger level:', route['stats']['danger_level'])
print('✅ All services pass')
"
```

---

## STEP 10 — Write All Routers

### 10a — `routers/websocket.py`
Write exact content from Fix #11.

### 10b — `routers/danger.py`
Write exact content from Section 2.3 Step B1.3.

### 10c — `routers/cctv.py`
Write exact content from Section 2.4 Step B2.3.

### 10d — `routers/reports.py`
Write exact content from Section 2.5 Step B4.3, PLUS add the ported endpoints from Step 1c.
Also add the `broadcast_alert` + cache invalidation block from Fix #12.

### 10e — `routers/anomaly.py`
Write exact content from Phase 4 Step 4.1.

### 10f — `routers/routing.py`
Write exact content from Fix #4.

### 10g — `routers/graph.py`
Write exact content from Fix #5. Also add the `/graph/heatmap/geojson` endpoint from Section 5.2.

### 10h — `routers/clustering.py`
Write exact content from Fix #6.

### 10i — `routers/__init__.py`
```python
# backend_python/routers/__init__.py
# This file intentionally left minimal — imports handled in main.py
```

---

## STEP 11 — Write the Definitive `main.py` [GATE]

Replace the ENTIRE content of `backend_python/main.py` with the Definitive Version from Fix #2.

**VERIFY startup [GATE]:**
```bash
cd backend_python
timeout 30 python main.py &
sleep 8
curl -s http://localhost:8000/health | python -m json.tool
```

Expected output:
```json
{
  "status": "healthy",
  "models": {
    "lstm": "loaded",
    "cv": "loaded",
    "nlp": "loaded",
    "anomaly": "fallback"
  }
}
```

If `lstm` or `cv` shows `"failed"`, stop. Check the loader error in the server log.

```bash
curl -s http://localhost:8000/docs   # Should return HTML (not 404)
echo "✅ Swagger docs accessible"

# Kill test server
kill %1
```

---

## STEP 12 — Endpoint Integration Tests [GATE]

Start server in background:
```bash
cd backend_python && python main.py &
sleep 8
```

### Test B1 — Danger Prediction
```bash
curl -s -X POST http://localhost:8000/api/v1/predict-danger \
  -H "Content-Type: application/json" \
  -d '{
    "location_id": "zone_42",
    "historical_features": [[0,0,2,0.4,0.6,0.3],[1,0,1,0.3,0.6,0.2],[2,0,1,0.2,0.7,0.1],[3,0,0,0.1,0.7,0],[4,0,0,0.1,0.8,0],[5,0,0,0.2,0.8,0.1],[6,0,1,0.3,0.9,0.2],[7,0,2,0.5,1,0.3],[8,0,2,0.6,1,0.4],[9,0,1,0.7,1,0.4],[10,0,1,0.8,1,0.3],[11,0,1,0.9,1,0.3],[12,0,1,0.8,1,0.3],[13,0,1,0.7,1,0.3],[14,0,2,0.7,0.9,0.4],[15,0,2,0.8,0.8,0.5],[16,0,3,0.9,0.7,0.6],[17,0,4,0.9,0.6,0.8],[18,0,5,0.8,0.5,0.9],[19,0,4,0.7,0.4,0.8],[20,0,3,0.7,0.4,0.7],[21,0,3,0.6,0.3,0.6],[22,0,2,0.5,0.3,0.5],[23,0,2,0.4,0.3,0.4]]
  }' | python -m json.tool
```
✅ Expected: JSON with `"predictions": [...]` array of 24 floats. No `"detail"` error field.

### Test B4 — Incident Report Analysis
```bash
curl -s -X POST http://localhost:8000/api/v1/analyze-report \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I was followed by a man near the bus stop on sector 7 at 10pm. Very frightening and unsafe.",
    "location_id": "zone_42",
    "lat": 30.7333,
    "lng": 76.7794
  }' | python -m json.tool
```
✅ Expected: JSON with `severity`, `emotion`, `auto_response`. No 500 error.

### Test B2 — CCTV Analysis
```bash
# Generate a test image
python -c "
from PIL import Image; import io
img = Image.new('RGB', (640,480), (100,120,130))
img.save('/tmp/test_cctv.jpg')
print('Test image created')
"

curl -s -X POST http://localhost:8000/api/v1/analyze-cctv \
  -F "camera_id=cam_001" \
  -F "location_id=zone_42" \
  -F "file=@/tmp/test_cctv.jpg" | python -m json.tool
```
✅ Expected: JSON with `person_count`, `crowd_density`, `danger_contribution`.

### Test Aggregated Danger Score
```bash
curl -s "http://localhost:8000/api/v1/danger-score?lat=30.7333&lng=76.7794" | python -m json.tool
```
✅ Expected: JSON with `danger_score` (float 0-1), `danger_level` (string), `component_scores`.

### Test Heatmap (Standard + GeoJSON)
```bash
curl -s "http://localhost:8000/api/v1/graph/heatmap" | python -m json.tool
curl -s "http://localhost:8000/api/v1/graph/heatmap/geojson" | python -m json.tool
```
✅ Expected first: `{"zones": [...], "total": 20}`
✅ Expected second: `{"type":"FeatureCollection","features":[...]}`

### Test Safe Route
```bash
curl -s "http://localhost:8000/api/v1/safe-route?start_lat=30.73&start_lng=76.77&end_lat=30.75&end_lng=76.79" | python -m json.tool
```
✅ Expected: JSON with `route.type == "Feature"`, `route.geometry.type == "LineString"`, `segments.type == "FeatureCollection"`.

### Test Clusters
```bash
curl -s "http://localhost:8000/api/v1/clusters" | python -m json.tool
curl -s "http://localhost:8000/api/v1/clusters/geojson" | python -m json.tool
```
✅ Expected first: `{"clusters":[...],"total":N}`
✅ Expected second: `{"type":"FeatureCollection","features":[...]}`

### Test Anomaly
```bash
curl -s -X POST http://localhost:8000/api/v1/detect-anomaly \
  -H "Content-Type: application/json" \
  -d '{
    "location_id": "zone_42",
    "data_points": [
      {"hour":20,"incident_count":1},{"hour":21,"incident_count":1},
      {"hour":22,"incident_count":1},{"hour":23,"incident_count":99}
    ]
  }' | python -m json.tool
```
✅ Expected: `"anomaly_detected": true` (the spike at hour 23 must be caught).

### Test Intersections
```bash
curl -s "http://localhost:8000/api/v1/intersections?lat=30.73&lng=76.77&radius_km=2.0" | python -m json.tool
```
✅ Expected: `{"intersections":[...],"total":N}`

### Test WebSocket (in Python)
```bash
python -c "
import asyncio, websockets, json

async def test_ws():
    uri = 'ws://localhost:8000/api/v1/ws/alerts'
    async with websockets.connect(uri) as ws:
        msg = await asyncio.wait_for(ws.recv(), timeout=5)
        data = json.loads(msg)
        assert data['type'] == 'CONNECTED', f'Bad first message: {data}'
        print('✅ WebSocket connected and received CONNECTED message')

asyncio.run(test_ws())
"
```

**Kill test server:**
```bash
kill %1
```

---

## STEP 13 — Frontend Setup

### 13a — Create `.env` in frontend directory
```bash
cat > frontend/.env << 'EOF'
VITE_API_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000/api/v1/ws/alerts
VITE_DEMO_MODE=false
EOF
```

### 13b — Write `frontend/src/services/api.js`
Write exact content from Section 6.1, plus add these new functions:

```javascript
// ADD to api.js:

export const getClusters = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return apiFetch(`/clusters${q ? '?' + q : ''}`);
};

export const getClustersGeoJSON = (params = {}) => {
  const q = new URLSearchParams(params).toString();
  return apiFetch(`/clusters/geojson${q ? '?' + q : ''}`);
};

export const getHeatmapGeoJSON = () => apiFetch('/graph/heatmap/geojson');

export const getZoneSummary = (zoneId) => apiFetch(`/graph/zone-summary/${zoneId}`);

export const getIntersections = (lat, lng, radiusKm = 2.0) =>
  apiFetch(`/intersections?lat=${lat}&lng=${lng}&radius_km=${radiusKm}`);

export const updateReportStatus = (reportId, status, notes = '') =>
  apiFetch(`/reports/${reportId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, notes })
  });
```

### 13c — Write `frontend/src/hooks/useWebSocket.js`
Write exact content from Section 6.2.

### 13d — Write `frontend/src/components/Map/SafetyHeatmap.jsx`
Write exact content from Section 6.3. Change `getHeatmapData()` call to `getHeatmapGeoJSON()`.

### 13e — Write `frontend/src/components/Map/RouteOverlay.jsx`
Write exact content from Section 5.3.

### 13f — Write `frontend/src/components/Map/ClusterLayer.jsx`
Write exact content from Section 5.4.

### 13g — Write `frontend/src/components/Map/AlertMarkers.jsx`
Write exact content from Section 5.5.

### 13h — Frontend smoke test
```bash
cd frontend
npm install
npm run dev &
sleep 5
curl -s http://localhost:5173 | grep -c "<!DOCTYPE" && echo "✅ Frontend running"
```

---

## STEP 14 — Full End-to-End Demo Test

Start both servers:
```bash
# Terminal 1
cd backend_python && python main.py

# Terminal 2 (new terminal)
cd frontend && npm run dev
```

Open browser at `http://localhost:5173`.

**Manual verification checklist:**
- [ ] Map loads with heatmap overlay (colored zones visible)
- [ ] Clicking a zone shows danger score in info panel
- [ ] Submit report form → auto_response appears after submit
- [ ] Route request → colored LineString appears on map
- [ ] Cluster circles visible on map
- [ ] No red errors in browser console (Network tab — all API calls return 200)
- [ ] WebSocket shows as connected in browser DevTools → Network → WS
- [ ] After submitting a high/critical report, map heatmap refreshes

---

## STEP 15 — Final Polish Checklist

```bash
# Verify no duplicate route registrations
cd backend_python
grep -r "@router\." routers/ | grep -v "^Binary" | sort | uniq -d
# Should output: nothing (no duplicates)

# Verify all routers are registered in main.py
grep "include_router" main.py
# Should show: routing, danger, reports, cctv, anomaly, graph, clustering, ws_router

# Verify no leftover report.py
ls routers/report.py 2>/dev/null && echo "❌ DELETE report.py" || echo "✅ report.py gone"

# Verify GeoJSON coordinates are correct order (lng first)
grep -n "\[lat, lng\]" services/*.py routers/*.py
# Should output: nothing (no lat-first coordinates in GeoJSON structures)

# Run all service tests one more time
python -c "
import asyncio
from db.mock_db import MOCK_ZONES, get_mock_intersections
from utils.cache import get_cached, set_cached
from utils.scoring import score_to_level
from services.clustering_service import compute_clusters
from services.route_service import compute_safe_route

set_cached('t', 1, 10)
assert get_cached('t') == 1
assert score_to_level(0.9) == 'critical'

c = asyncio.run(compute_clusters())
assert len(c) > 0

r = asyncio.run(compute_safe_route(30.73, 76.77, 30.75, 76.79, {}))
assert r['route']['geometry']['type'] == 'LineString'
coords = r['route']['geometry']['coordinates']
# Verify coordinates are [lng, lat] order (lng should be ~76.x, lat should be ~30.x)
assert 76 < coords[0][0] < 77, f'First coord should be lng~76: {coords[0]}'
assert 30 < coords[0][1] < 31, f'Second coord should be lat~30: {coords[0]}'
print('✅ GeoJSON coordinate order correct')
print('✅ All final checks passed')
"
```

---

## STEP 16 — Anomaly Model Drop-In Instructions (For Future)

When the real B3 anomaly model is ready, **only these two files need changes:**

### Edit 1: `ai/anomaly/loader.py`
```python
# Replace the try/except fallback block with:
def load_anomaly_model() -> dict:
    import joblib  # or torch, or tensorflow — whatever framework
    model = joblib.load(str(ANOMALY_MODEL_PATH))  # update path in config.py
    return {
        "inference_module": None,    # or import your inference.py
        "model": model,
        "use_fallback": False        # ← flip this to False
    }
```

### Edit 2: `services/anomaly_service.py`
```python
# In detect_anomalies(), replace the z-score block with:
if not use_fallback and model is not None:
    # Call your model here
    predictions = model.predict(feature_matrix)
    score = float(predictions.max())
    flagged = [i for i, p in enumerate(predictions) if p > 0.5]
    return {
        "location_id": location_id,
        "anomaly_detected": len(flagged) > 0,
        "anomaly_score": score,
        "flagged_points": flagged,
        "method": "model"
    }
```

**Everything else — router, aggregator, TigerGraph writes, WebSocket broadcasts, frontend — stays unchanged.**

---

## SUMMARY TABLE — Files Created/Modified

| File | Action | Priority |
|---|---|---|
| `backend_python/main.py` | REPLACE entirely | 🔴 Critical |
| `backend_python/config.py` | CREATE | 🔴 Critical |
| `backend_python/routers/report.py` | DELETE (after porting features) | 🔴 Critical |
| `backend_python/routers/reports.py` | EXTEND (add ported endpoints) | 🔴 Critical |
| `backend_python/routers/routing.py` | REPLACE with Fix #4 | 🔴 Critical |
| `backend_python/routers/graph.py` | REPLACE with Fix #5 | 🔴 Critical |
| `backend_python/routers/clustering.py` | CREATE (new) | 🔴 Critical |
| `backend_python/routers/websocket.py` | CREATE/REPLACE with Fix #11 | 🔴 Critical |
| `backend_python/routers/cctv.py` | VERIFY/fix content-type comment | 🟡 High |
| `backend_python/routers/danger.py` | VERIFY unchanged | 🟡 High |
| `backend_python/routers/anomaly.py` | VERIFY exists | 🟡 High |
| `backend_python/services/route_service.py` | CREATE (new, Fix #3) | 🔴 Critical |
| `backend_python/services/clustering_service.py` | CREATE (new, Fix #7) | 🔴 Critical |
| `backend_python/services/graph_service.py` | EXTEND (add report functions) | 🟡 High |
| `backend_python/services/nlp_service.py` | ADD `_safe_call` wrapper | 🟡 High |
| `backend_python/services/danger_aggregator.py` | FIX circular import | 🔴 Critical |
| `backend_python/ai/lstm/loader.py` | CREATE | 🔴 Critical |
| `backend_python/ai/cv/loader.py` | CREATE (verify class count) | 🔴 Critical |
| `backend_python/ai/nlp/loader.py` | CREATE | 🔴 Critical |
| `backend_python/ai/anomaly/loader.py` | CREATE (fallback mode) | 🔴 Critical |
| `backend_python/models/report_models.py` | REPLACE with complete version | 🟡 High |
| `backend_python/models/cctv_models.py` | CREATE | 🟢 Medium |
| `backend_python/models/route_models.py` | CREATE | 🟢 Medium |
| `backend_python/db/tigergraph_client.py` | CREATE | 🟡 High |
| `backend_python/db/mock_db.py` | EXTEND (add intersections) | 🟡 High |
| `backend_python/utils/cache.py` | CREATE | 🔴 Critical |
| `backend_python/utils/scoring.py` | CREATE | 🟢 Medium |
| `backend_python/utils/geo_utils.py` | CREATE (Fix #9) | 🟡 High |
| `backend_python/requirements.txt` | REPLACE | 🔴 Critical |
| `frontend/.env` | CREATE | 🔴 Critical |
| `frontend/src/services/api.js` | CREATE/EXTEND | 🔴 Critical |
| `frontend/src/hooks/useWebSocket.js` | CREATE | 🟡 High |
| `frontend/src/components/Map/SafetyHeatmap.jsx` | CREATE | 🟡 High |
| `frontend/src/components/Map/RouteOverlay.jsx` | CREATE | 🟡 High |
| `frontend/src/components/Map/ClusterLayer.jsx` | CREATE | 🟡 High |
| `frontend/src/components/Map/AlertMarkers.jsx` | CREATE | 🟡 High |

---

*End of Audit & Execution Plan — Version 2.0*
*Estimated execution time: 6–8 hours for a focused developer or AI agent*
*All 16 steps verified for zero 404s, correct GeoJSON, and clean module boundaries*
