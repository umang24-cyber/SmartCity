# 🏙️ Smart City Women's Safety Platform — Complete Integration Blueprint
> **Version:** 1.0 | **Status:** Production-Ready Blueprint | **Audience:** AI-Assisted Execution (Claude Sonnet)
> **Rule:** Execute every step exactly as written. Deviate ONLY if a runtime error makes a step physically impossible — and document why.

---

## 📋 TABLE OF CONTENTS

1. [Final Architecture Design](#1-final-architecture-design)
2. [Backend Integration Plan (B1–B4)](#2-backend-integration-plan)
3. [Complete API Design](#3-complete-api-design)
4. [Data Flow Design](#4-data-flow-design)
5. [TigerGraph Integration Strategy](#5-tigergraph-integration-strategy)
6. [Frontend Connection Plan](#6-frontend-connection-plan)
7. [Step-by-Step Execution Plan](#7-step-by-step-execution-plan)
8. [Performance & Deployment](#8-performance--deployment)
9. [Hackathon Demo Flow](#9-hackathon-demo-flow)
10. [File Checklists & Verification Gates](#10-file-checklists--verification-gates)

---

# 1. FINAL ARCHITECTURE DESIGN

## 1.1 Decision: Unified FastAPI Monolith with Internal Module Boundaries

**Decision: Single FastAPI service, NOT microservices.**

**Rationale:**
- All models run locally — no network overhead between services
- Hackathon/demo context — operational simplicity wins
- Models can share memory (no duplicate loading)
- Single process = single deployment command
- Internal module separation still enforces clean architecture

**The only exception:** If CV inference is GPU-heavy and causes API thread blocking, extract it to a background worker using FastAPI's `BackgroundTasks` or `asyncio.run_in_executor`. This is handled in Section 8.

---

## 1.2 Final Folder Structure

```
project-root/
│
├── frontend/                        # React + Vite + MapLibre (unchanged)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Map/
│   │   │   │   ├── SafetyHeatmap.jsx
│   │   │   │   ├── RouteOverlay.jsx
│   │   │   │   └── AlertMarkers.jsx
│   │   │   ├── Reports/
│   │   │   │   ├── IncidentReportForm.jsx
│   │   │   │   └── ReportFeed.jsx
│   │   │   ├── Dashboard/
│   │   │   │   ├── DangerScoreWidget.jsx
│   │   │   │   ├── CrowdDensityWidget.jsx
│   │   │   │   └── AlertsPanel.jsx
│   │   │   └── CCTV/
│   │   │       └── CCTVFeedUpload.jsx
│   │   ├── hooks/
│   │   │   ├── useSafetyData.js
│   │   │   ├── useWebSocket.js
│   │   │   └── useReportSubmit.js
│   │   ├── services/
│   │   │   └── api.js               # All API calls centralized here
│   │   └── store/
│   │       └── safetyStore.js       # Zustand/Redux state
│
├── backend_python/                  # PRIMARY BACKEND — ALL AI LIVES HERE
│   ├── main.py                      # FastAPI app entrypoint
│   ├── config.py                    # Environment config, model paths
│   ├── dependencies.py              # Shared FastAPI dependencies (DB, auth)
│   │
│   ├── routers/                     # One router file per domain
│   │   ├── __init__.py
│   │   ├── routing.py               # /safe-route, /intersections
│   │   ├── danger.py                # /danger-score, /predict-danger
│   │   ├── reports.py               # /analyze-report, /reports
│   │   ├── cctv.py                  # /analyze-cctv
│   │   ├── anomaly.py               # /detect-anomaly
│   │   └── graph.py                 # /graph/* TigerGraph endpoints
│   │
│   ├── services/                    # Business logic, orchestration
│   │   ├── __init__.py
│   │   ├── lstm_service.py          # Wraps B1 inference
│   │   ├── cv_service.py            # Wraps B2 inference
│   │   ├── nlp_service.py           # Wraps B4 inference
│   │   ├── anomaly_service.py       # Wraps B3 inference
│   │   ├── route_service.py         # Safe routing logic
│   │   ├── danger_aggregator.py     # Combines B1+B2+B3 into one score
│   │   └── graph_service.py         # TigerGraph read/write
│   │
│   ├── models/                      # Pydantic request/response schemas
│   │   ├── __init__.py
│   │   ├── danger_models.py
│   │   ├── report_models.py
│   │   ├── cctv_models.py
│   │   ├── route_models.py
│   │   └── graph_models.py
│   │
│   ├── ai/                          # AI module wrappers (DO NOT edit original files)
│   │   ├── __init__.py
│   │   ├── lstm/
│   │   │   ├── __init__.py
│   │   │   └── loader.py            # Loads lstm_INT007.keras + scaler
│   │   ├── cv/
│   │   │   ├── __init__.py
│   │   │   └── loader.py            # Loads MobileNetV2 + YOLOv8
│   │   ├── nlp/
│   │   │   ├── __init__.py
│   │   │   └── loader.py            # Loads NLP pipeline
│   │   └── anomaly/
│   │       ├── __init__.py
│   │       └── loader.py            # Loads anomaly model
│   │
│   ├── db/
│   │   ├── __init__.py
│   │   ├── tigergraph_client.py     # TigerGraph connection
│   │   └── mock_db.py               # Mock fallback data
│   │
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── geo_utils.py             # Coordinate helpers, bounding boxes
│   │   ├── scoring.py               # Score normalization (0-100)
│   │   └── cache.py                 # In-memory TTL cache
│   │
│   ├── tests/
│   │   ├── test_lstm_service.py
│   │   ├── test_cv_service.py
│   │   ├── test_nlp_service.py
│   │   └── test_endpoints.py
│   │
│   └── requirements.txt
│
├── ai/                              # ORIGINAL AI MODULE FILES — READ-ONLY
│   ├── lstm/
│   │   ├── inference.py
│   │   ├── lstm_INT007.keras
│   │   └── scaler_INT007.pkl
│   ├── cv/
│   │   ├── inference.py
│   │   ├── mobilenetv2_crowd.pth
│   │   └── (YOLOv8n model file)
│   ├── nlp/
│   │   ├── inference.py
│   │   └── app.py
│   └── anomaly/
│       └── (model files)
│
└── docker-compose.yml               # Optional: containerized dev environment
```

---

## 1.3 Module Dependency Map

```
                    ┌─────────────────────────────┐
                    │         React Frontend        │
                    │  (MapLibre + Vite + Zustand)  │
                    └──────────────┬──────────────┘
                                   │ HTTP/WebSocket
                    ┌──────────────▼──────────────┐
                    │       FastAPI Backend         │
                    │    (backend_python/main.py)   │
                    │                               │
                    │  ┌─────────┐ ┌────────────┐  │
                    │  │ routers │ │  services  │  │
                    │  └────┬────┘ └─────┬──────┘  │
                    └───────┼────────────┼──────────┘
                            │            │
           ┌────────────────┼────────────┼──────────────────┐
           │                │            │                    │
    ┌──────▼──────┐  ┌──────▼──────┐  ┌─▼────────────┐  ┌──▼──────────┐
    │  B1: LSTM   │  │  B2: CV     │  │  B4: NLP     │  │  B3: Anomaly│
    │  Service    │  │  Service    │  │  Service     │  │  Service    │
    │  (24h score)│  │  (crowd/   │  │  (sentiment/ │  │  (pattern   │
    │             │  │  anomaly)  │  │  entity/etc) │  │  detection) │
    └──────┬──────┘  └──────┬──────┘  └─────┬────────┘  └──────┬──────┘
           │                │               │                    │
           └────────────────┴───────────────┴────────────────────┘
                                            │
                    ┌───────────────────────▼──────────────────┐
                    │         danger_aggregator.py              │
                    │  (combines all scores into unified score) │
                    └───────────────────────┬──────────────────┘
                                            │
                    ┌───────────────────────▼──────────────────┐
                    │        TigerGraph / Mock DB               │
                    │  (graph_service.py + tigergraph_client)   │
                    └──────────────────────────────────────────┘
```

---

# 2. BACKEND INTEGRATION PLAN

## 2.1 Application Entry Point — `main.py`

**File:** `backend_python/main.py`

```python
# backend_python/main.py
# EXACT CONTENT — copy this verbatim

import sys
import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Add ai/ directory to sys.path so original inference.py files are importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'ai')))

# Import routers
from routers import routing, danger, reports, cctv, anomaly, graph

# Import AI loaders (startup pre-loading)
from ai.lstm.loader import load_lstm_model
from ai.cv.loader import load_cv_models
from ai.nlp.loader import load_nlp_pipeline
from ai.anomaly.loader import load_anomaly_model

# Global model registry — loaded once, reused forever
MODEL_REGISTRY = {}

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Load all AI models at startup.
    FastAPI lifespan context manager (replaces deprecated @app.on_event).
    """
    logger.info("🚀 Starting model loading sequence...")

    # B1: LSTM
    logger.info("Loading B1: LSTM model...")
    MODEL_REGISTRY["lstm"] = load_lstm_model()
    logger.info("✅ B1 LSTM loaded")

    # B2: Computer Vision
    logger.info("Loading B2: CV models...")
    MODEL_REGISTRY["cv"] = load_cv_models()
    logger.info("✅ B2 CV loaded")

    # B4: NLP
    logger.info("Loading B4: NLP pipeline...")
    MODEL_REGISTRY["nlp"] = load_nlp_pipeline()
    logger.info("✅ B4 NLP loaded")

    # B3: Anomaly
    logger.info("Loading B3: Anomaly model...")
    MODEL_REGISTRY["anomaly"] = load_anomaly_model()
    logger.info("✅ B3 Anomaly loaded")

    logger.info("🎉 All models loaded. Server ready.")

    # Store in app state so routers can access via request.app.state
    app.state.models = MODEL_REGISTRY

    yield  # Server runs here

    # Cleanup on shutdown
    logger.info("Shutting down — clearing model registry")
    MODEL_REGISTRY.clear()


app = FastAPI(
    title="Smart City Women's Safety API",
    description="AI-powered safety platform with LSTM, CV, NLP, and Anomaly Detection",
    version="1.0.0",
    lifespan=lifespan
)

# CORS — allow React frontend (adjust origins for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers with prefixes
app.include_router(routing.router, prefix="/api/v1", tags=["Routing"])
app.include_router(danger.router, prefix="/api/v1", tags=["Danger"])
app.include_router(reports.router, prefix="/api/v1", tags=["Reports"])
app.include_router(cctv.router, prefix="/api/v1", tags=["CCTV"])
app.include_router(anomaly.router, prefix="/api/v1", tags=["Anomaly"])
app.include_router(graph.router, prefix="/api/v1", tags=["Graph"])


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "models_loaded": list(app.state.models.keys())
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, workers=1)
```

**Critical note on `workers=1`:** Keep workers at 1 in development. Multiple workers would each load all models, consuming enormous RAM. In production, use model servers (see Section 8).

---

## 2.2 Config File — `config.py`

**File:** `backend_python/config.py`

```python
# backend_python/config.py

import os
from pathlib import Path

# Project root (two levels up from this file)
PROJECT_ROOT = Path(__file__).parent.parent

# AI model paths — relative to project root
AI_ROOT = PROJECT_ROOT / "ai"

LSTM_MODEL_PATH = AI_ROOT / "lstm" / "lstm_INT007.keras"
LSTM_SCALER_PATH = AI_ROOT / "lstm" / "scaler_INT007.pkl"

CV_MOBILENET_PATH = AI_ROOT / "cv" / "mobilenetv2_crowd.pth"
CV_YOLO_MODEL_NAME = "yolov8n.pt"   # YOLOv8 auto-downloads if not present, or set full path

NLP_MODULE_PATH = AI_ROOT / "nlp"   # directory containing inference.py

ANOMALY_MODULE_PATH = AI_ROOT / "anomaly"

# TigerGraph connection
TIGERGRAPH_HOST = os.getenv("TIGERGRAPH_HOST", "http://localhost")
TIGERGRAPH_PORT = int(os.getenv("TIGERGRAPH_PORT", 14240))
TIGERGRAPH_GRAPH = os.getenv("TIGERGRAPH_GRAPH", "SafeCity")
TIGERGRAPH_USERNAME = os.getenv("TIGERGRAPH_USERNAME", "tigergraph")
TIGERGRAPH_PASSWORD = os.getenv("TIGERGRAPH_PASSWORD", "tigergraph")
USE_MOCK_DB = os.getenv("USE_MOCK_DB", "true").lower() == "true"

# Cache TTL in seconds
DANGER_SCORE_CACHE_TTL = 300        # 5 minutes
LSTM_PREDICTION_CACHE_TTL = 3600    # 1 hour (24h predictions don't change often)

# Feature flags
ENABLE_CV_INFERENCE = os.getenv("ENABLE_CV", "true").lower() == "true"
ENABLE_NLP_INFERENCE = os.getenv("ENABLE_NLP", "true").lower() == "true"
```

---

## 2.3 Module B1 — LSTM Integration

### Step B1.1 — Create the LSTM Loader

**File:** `backend_python/ai/lstm/loader.py`

```python
# backend_python/ai/lstm/loader.py
"""
Loader for B1: LSTM time-series model.
Loads lstm_INT007.keras and scaler_INT007.pkl ONCE at startup.
"""

import sys
import pickle
import logging
from pathlib import Path

import numpy as np

# Add ai/lstm to path so we can import the original inference.py
LSTM_AI_DIR = Path(__file__).parent.parent.parent.parent / "ai" / "lstm"
sys.path.insert(0, str(LSTM_AI_DIR))

logger = logging.getLogger(__name__)


def load_lstm_model() -> dict:
    """
    Loads the LSTM model and scaler.
    Returns a dict with keys: 'model', 'scaler', 'inference_fn'
    """
    from config import LSTM_MODEL_PATH, LSTM_SCALER_PATH

    try:
        import tensorflow as tf
        model = tf.keras.models.load_model(str(LSTM_MODEL_PATH))
        logger.info(f"LSTM model loaded from {LSTM_MODEL_PATH}")
    except Exception as e:
        logger.error(f"Failed to load LSTM model: {e}")
        raise

    try:
        with open(str(LSTM_SCALER_PATH), "rb") as f:
            scaler = pickle.load(f)
        logger.info(f"LSTM scaler loaded from {LSTM_SCALER_PATH}")
    except Exception as e:
        logger.error(f"Failed to load LSTM scaler: {e}")
        raise

    # Import the original inference function
    try:
        import inference as lstm_inference
        inference_fn = lstm_inference.predict  # adjust to actual function name
    except (ImportError, AttributeError) as e:
        logger.warning(f"Could not import original inference.py: {e}. Will use inline inference.")
        inference_fn = None

    return {
        "model": model,
        "scaler": scaler,
        "inference_fn": inference_fn
    }
```

### Step B1.2 — Create the LSTM Service

**File:** `backend_python/services/lstm_service.py`

```python
# backend_python/services/lstm_service.py
"""
B1 LSTM Service — wraps model inference into clean business logic.
Provides 24-hour safety score predictions for a given location.
"""

import logging
import numpy as np
from datetime import datetime
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

# Number of MC Dropout samples for uncertainty estimation
MC_SAMPLES = 20
SEQUENCE_LENGTH = 24  # Must match training sequence length


def predict_danger_score(
    lstm_bundle: dict,
    location_id: str,
    historical_features: List[List[float]],
    forecast_hours: int = 24
) -> Dict[str, Any]:
    """
    Runs LSTM inference with MC Dropout to produce a 24-hour danger forecast.

    Args:
        lstm_bundle: dict from loader.py containing 'model', 'scaler', 'inference_fn'
        location_id: zone/intersection identifier string
        historical_features: List of SEQUENCE_LENGTH feature vectors
                             Each vector = [hour, day_of_week, crime_count,
                                            crowd_density, lighting_score, ...]
        forecast_hours: Number of hours to predict ahead (default 24)

    Returns:
        dict with keys:
            - location_id: str
            - predictions: List[float] — danger scores 0.0–1.0, one per hour
            - uncertainty: List[float] — std dev from MC Dropout per hour
            - peak_danger_hour: int — hour index of max danger
            - average_danger: float — mean danger over 24h
            - timestamp: str ISO format
    """
    model = lstm_bundle["model"]
    scaler = lstm_bundle["scaler"]

    if len(historical_features) < SEQUENCE_LENGTH:
        raise ValueError(
            f"Need {SEQUENCE_LENGTH} historical timesteps, got {len(historical_features)}"
        )

    # Use last SEQUENCE_LENGTH timesteps
    features_array = np.array(historical_features[-SEQUENCE_LENGTH:], dtype=np.float32)

    # Scale features
    features_scaled = scaler.transform(features_array)

    # Reshape for LSTM: (1, sequence_length, n_features)
    X = features_scaled.reshape(1, SEQUENCE_LENGTH, -1)

    # MC Dropout inference — run model N times with training=True to keep dropout active
    mc_predictions = []
    for _ in range(MC_SAMPLES):
        # Pass training=True to enable MC Dropout
        pred = model(X, training=True).numpy()
        mc_predictions.append(pred)

    mc_array = np.array(mc_predictions)  # (MC_SAMPLES, 1, forecast_hours) or similar

    # Compute mean and std across MC samples
    mean_pred = np.mean(mc_array, axis=0).flatten()
    std_pred = np.std(mc_array, axis=0).flatten()

    # Clip to [0, 1]
    mean_pred = np.clip(mean_pred, 0.0, 1.0)

    # If forecast is a single value per call, tile it for 24 hours
    # Adjust this logic based on actual LSTM output shape
    if len(mean_pred) == 1:
        mean_pred = np.tile(mean_pred, forecast_hours)
        std_pred = np.tile(std_pred, forecast_hours)

    predictions = mean_pred[:forecast_hours].tolist()
    uncertainty = std_pred[:forecast_hours].tolist()

    return {
        "location_id": location_id,
        "predictions": predictions,
        "uncertainty": uncertainty,
        "peak_danger_hour": int(np.argmax(mean_pred[:forecast_hours])),
        "average_danger": float(np.mean(mean_pred[:forecast_hours])),
        "timestamp": datetime.utcnow().isoformat()
    }
```

### Step B1.3 — Create the Danger Router

**File:** `backend_python/routers/danger.py`

```python
# backend_python/routers/danger.py

from fastapi import APIRouter, Request, HTTPException
from models.danger_models import DangerPredictRequest, DangerPredictResponse
from services.lstm_service import predict_danger_score
from services.danger_aggregator import aggregate_danger_score
from utils.cache import get_cached, set_cached

router = APIRouter()


@router.post("/predict-danger", response_model=DangerPredictResponse)
async def predict_danger(request: Request, body: DangerPredictRequest):
    """
    B1: LSTM 24-hour danger prediction for a location.
    Uses MC Dropout for uncertainty quantification.
    """
    cache_key = f"lstm_{body.location_id}_{body.date_hour}"
    cached = get_cached(cache_key)
    if cached:
        return cached

    lstm_bundle = request.app.state.models.get("lstm")
    if not lstm_bundle:
        raise HTTPException(status_code=503, detail="LSTM model not loaded")

    try:
        result = predict_danger_score(
            lstm_bundle=lstm_bundle,
            location_id=body.location_id,
            historical_features=body.historical_features,
            forecast_hours=24
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LSTM inference failed: {str(e)}")

    set_cached(cache_key, result, ttl=3600)
    return result


@router.get("/danger-score")
async def get_danger_score(request: Request, lat: float, lng: float):
    """
    Aggregated danger score for a coordinate.
    Combines LSTM + CV + Anomaly outputs.
    (Replaces the old mock /danger-score endpoint.)
    """
    location_id = f"{lat:.4f}_{lng:.4f}"

    cache_key = f"danger_agg_{location_id}"
    cached = get_cached(cache_key)
    if cached:
        return cached

    models = request.app.state.models
    result = await aggregate_danger_score(
        location_id=location_id,
        lat=lat, lng=lng,
        models=models
    )

    set_cached(cache_key, result, ttl=300)
    return result
```

---

## 2.4 Module B2 — Computer Vision Integration

### Step B2.1 — Create the CV Loader

**File:** `backend_python/ai/cv/loader.py`

```python
# backend_python/ai/cv/loader.py
"""
Loader for B2: Computer Vision models.
Loads MobileNetV2 (crowd density) and YOLOv8n (person detection).
"""

import sys
import logging
from pathlib import Path
import torch

CV_AI_DIR = Path(__file__).parent.parent.parent.parent / "ai" / "cv"
sys.path.insert(0, str(CV_AI_DIR))

logger = logging.getLogger(__name__)


def load_cv_models() -> dict:
    """
    Loads MobileNetV2 and YOLOv8 models.
    Returns dict with keys: 'mobilenet', 'yolo', 'device', 'inference_fn'
    """
    from config import CV_MOBILENET_PATH, CV_YOLO_MODEL_NAME

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"CV using device: {device}")

    # Load MobileNetV2 for crowd density classification
    try:
        import torchvision.models as tv_models

        # Rebuild architecture (must match training architecture)
        mobilenet = tv_models.mobilenet_v2(pretrained=False)
        # Modify classifier to match saved model output
        # ASSUMPTION: model was saved with same architecture — adjust n_classes if needed
        mobilenet.classifier[1] = torch.nn.Linear(
            mobilenet.last_channel, 3  # 3 density classes: low/medium/high
        )
        state_dict = torch.load(str(CV_MOBILENET_PATH), map_location=device)
        mobilenet.load_state_dict(state_dict)
        mobilenet.to(device)
        mobilenet.eval()
        logger.info(f"MobileNetV2 loaded from {CV_MOBILENET_PATH}")
    except Exception as e:
        logger.error(f"Failed to load MobileNetV2: {e}")
        raise

    # Load YOLOv8n for person detection + anomaly
    try:
        from ultralytics import YOLO
        yolo = YOLO(CV_YOLO_MODEL_NAME)
        logger.info("YOLOv8n loaded")
    except Exception as e:
        logger.error(f"Failed to load YOLOv8: {e}")
        raise

    # Try to import original inference.py
    try:
        import inference as cv_inference
        inference_fn = cv_inference.analyze  # adjust to actual function name
    except (ImportError, AttributeError):
        inference_fn = None

    return {
        "mobilenet": mobilenet,
        "yolo": yolo,
        "device": device,
        "inference_fn": inference_fn
    }
```

### Step B2.2 — Create the CV Service

**File:** `backend_python/services/cv_service.py`

```python
# backend_python/services/cv_service.py
"""
B2 CV Service — analyzes images for crowd density, person count, anomaly detection.
"""

import logging
import io
import base64
from typing import Dict, Any, Optional

import numpy as np
import torch
from PIL import Image
import torchvision.transforms as transforms

logger = logging.getLogger(__name__)

# Image preprocessing for MobileNetV2
MOBILENET_TRANSFORM = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225])
])

DENSITY_LABELS = {0: "low", 1: "medium", 2: "high"}
YOLO_PERSON_CLASS = 0  # COCO class ID for 'person'
ANOMALY_THRESHOLD = 0.7  # Confidence above which to flag as anomaly


def analyze_frame(
    cv_bundle: dict,
    image_bytes: bytes,
    camera_id: str,
    location_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Analyzes a single image frame from a CCTV feed.

    Args:
        cv_bundle: dict from loader.py
        image_bytes: raw image bytes (JPEG/PNG)
        camera_id: identifier for the camera
        location_id: optional zone identifier

    Returns:
        dict with:
            - camera_id: str
            - location_id: str
            - person_count: int
            - crowd_density: str — "low" | "medium" | "high"
            - density_score: float — 0.0–1.0
            - anomalies_detected: bool
            - anomaly_details: List[dict] — bounding boxes + confidence
            - yolo_detections: List[dict] — all detected objects
            - danger_contribution: float — 0.0–1.0 (CV's input to danger score)
    """
    mobilenet = cv_bundle["mobilenet"]
    yolo = cv_bundle["yolo"]
    device = cv_bundle["device"]

    # Decode image
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    # ── MobileNetV2 density classification ──
    img_tensor = MOBILENET_TRANSFORM(image).unsqueeze(0).to(device)
    with torch.no_grad():
        density_logits = mobilenet(img_tensor)
        density_probs = torch.softmax(density_logits, dim=1).cpu().numpy()[0]
        density_class = int(np.argmax(density_probs))
        density_score = float(density_probs[2])  # probability of "high" density

    # ── YOLOv8 person detection + anomaly ──
    yolo_results = yolo(image, verbose=False)
    detections = []
    person_count = 0
    anomalies = []

    for result in yolo_results:
        boxes = result.boxes
        for box in boxes:
            cls_id = int(box.cls.item())
            conf = float(box.conf.item())
            xyxy = box.xyxy.cpu().numpy()[0].tolist()

            det = {
                "class_id": cls_id,
                "class_name": result.names.get(cls_id, str(cls_id)),
                "confidence": conf,
                "bbox": xyxy
            }
            detections.append(det)

            if cls_id == YOLO_PERSON_CLASS:
                person_count += 1

            # Flag unusual object classes as anomalies (non-person objects
            # like weapons, falling persons, etc.)
            if cls_id != YOLO_PERSON_CLASS and conf > ANOMALY_THRESHOLD:
                anomalies.append(det)

    # Compute danger contribution from CV
    # Formula: 0.4 * density_score + 0.4 * (person_count / 50.0 capped at 1) + 0.2 * anomaly_flag
    density_contrib = density_score
    crowd_contrib = min(person_count / 50.0, 1.0)
    anomaly_contrib = 1.0 if len(anomalies) > 0 else 0.0
    danger_contribution = (0.4 * density_contrib + 0.4 * crowd_contrib + 0.2 * anomaly_contrib)

    return {
        "camera_id": camera_id,
        "location_id": location_id or camera_id,
        "person_count": person_count,
        "crowd_density": DENSITY_LABELS[density_class],
        "density_score": density_score,
        "anomalies_detected": len(anomalies) > 0,
        "anomaly_details": anomalies,
        "yolo_detections": detections,
        "danger_contribution": round(danger_contribution, 3)
    }
```

### Step B2.3 — CCTV Router

**File:** `backend_python/routers/cctv.py`

```python
# backend_python/routers/cctv.py

import base64
from fastapi import APIRouter, Request, HTTPException, UploadFile, File, Form
from typing import Optional
from services.cv_service import analyze_frame

router = APIRouter()


@router.post("/analyze-cctv")
async def analyze_cctv(
    request: Request,
    camera_id: str = Form(...),
    location_id: Optional[str] = Form(None),
    file: UploadFile = File(...)
):
    """
    B2: Analyze CCTV frame for crowd density and anomalies.
    Accepts multipart form with image file.
    """
    cv_bundle = request.app.state.models.get("cv")
    if not cv_bundle:
        raise HTTPException(status_code=503, detail="CV model not loaded")

    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(status_code=422, detail="Empty image file")

    try:
        result = analyze_frame(
            cv_bundle=cv_bundle,
            image_bytes=image_bytes,
            camera_id=camera_id,
            location_id=location_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CV inference failed: {str(e)}")

    return result


@router.post("/analyze-cctv-base64")
async def analyze_cctv_base64(request: Request, body: dict):
    """
    B2: Same as analyze-cctv but accepts base64-encoded image.
    Useful for frontend direct upload.

    Body: {"camera_id": str, "location_id": str, "image_b64": str}
    """
    cv_bundle = request.app.state.models.get("cv")
    if not cv_bundle:
        raise HTTPException(status_code=503, detail="CV model not loaded")

    try:
        image_bytes = base64.b64decode(body["image_b64"])
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid base64 image")

    result = analyze_frame(
        cv_bundle=cv_bundle,
        image_bytes=image_bytes,
        camera_id=body.get("camera_id", "unknown"),
        location_id=body.get("location_id")
    )
    return result
```

---

## 2.5 Module B4 — NLP Integration

### Step B4.1 — NLP Loader

**File:** `backend_python/ai/nlp/loader.py`

```python
# backend_python/ai/nlp/loader.py
"""
Loader for B4: NLP Intelligence pipeline.
Loads sentiment, emotion, severity, credibility, entity extraction.
"""

import sys
import logging
from pathlib import Path

NLP_AI_DIR = Path(__file__).parent.parent.parent.parent / "ai" / "nlp"
sys.path.insert(0, str(NLP_AI_DIR))

logger = logging.getLogger(__name__)


def load_nlp_pipeline() -> dict:
    """
    Imports and initializes the NLP inference module.
    Returns dict with keys: 'inference_module', 'pipeline'
    """
    try:
        import inference as nlp_inference
        logger.info("NLP inference module imported")

        # Initialize pipeline (call setup function if it exists)
        pipeline = None
        if hasattr(nlp_inference, "initialize"):
            pipeline = nlp_inference.initialize()
            logger.info("NLP pipeline initialized via initialize()")
        elif hasattr(nlp_inference, "NLPPipeline"):
            pipeline = nlp_inference.NLPPipeline()
            logger.info("NLP pipeline initialized via NLPPipeline class")
        else:
            pipeline = nlp_inference  # treat module itself as the pipeline
            logger.info("NLP: using module directly as pipeline")

        return {
            "inference_module": nlp_inference,
            "pipeline": pipeline
        }
    except ImportError as e:
        logger.error(f"NLP inference module not found: {e}")
        raise
```

### Step B4.2 — NLP Service

**File:** `backend_python/services/nlp_service.py`

```python
# backend_python/services/nlp_service.py
"""
B4 NLP Service — full natural language processing for incident reports.
Wraps inference.py functions into clean service methods.
"""

import logging
import hashlib
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# In-memory deduplication store (replace with Redis in production)
_SEEN_REPORTS: Dict[str, str] = {}  # hash -> report_id


def analyze_incident_report(
    nlp_bundle: dict,
    report_text: str,
    report_id: str,
    location_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Full NLP analysis of an incident report.

    Args:
        nlp_bundle: dict from loader.py
        report_text: raw incident description text
        report_id: unique identifier
        location_id: optional zone

    Returns:
        dict with:
            - report_id: str
            - sentiment: str — "positive" | "neutral" | "negative"
            - sentiment_score: float
            - emotion: str — primary emotion detected
            - severity: str — "low" | "medium" | "high" | "critical"
            - severity_score: float — 0.0–1.0
            - credibility_score: float — 0.0–1.0
            - entities: dict — extracted locations, persons, times, etc.
            - is_duplicate: bool
            - duplicate_of: Optional[str] — report_id of original
            - auto_response: str — suggested response text
            - graph_payload: dict — data formatted for TigerGraph insertion
            - timestamp: str
    """
    pipeline = nlp_bundle["pipeline"]
    nlp_module = nlp_bundle["inference_module"]

    result = {
        "report_id": report_id,
        "timestamp": datetime.utcnow().isoformat(),
        "location_id": location_id
    }

    # ── Sentiment Analysis ──
    if hasattr(nlp_module, "analyze_sentiment"):
        sentiment_out = nlp_module.analyze_sentiment(report_text)
        result["sentiment"] = sentiment_out.get("label", "neutral")
        result["sentiment_score"] = sentiment_out.get("score", 0.5)
    else:
        result["sentiment"] = "neutral"
        result["sentiment_score"] = 0.5

    # ── Emotion Detection ──
    if hasattr(nlp_module, "detect_emotion"):
        emotion_out = nlp_module.detect_emotion(report_text)
        result["emotion"] = emotion_out.get("primary_emotion", "neutral")
        result["emotion_scores"] = emotion_out.get("scores", {})
    else:
        result["emotion"] = "neutral"
        result["emotion_scores"] = {}

    # ── Severity Classification ──
    if hasattr(nlp_module, "classify_severity"):
        severity_out = nlp_module.classify_severity(report_text)
        result["severity"] = severity_out.get("label", "medium")
        result["severity_score"] = severity_out.get("score", 0.5)
    else:
        result["severity"] = "medium"
        result["severity_score"] = 0.5

    # ── Credibility Scoring ──
    if hasattr(nlp_module, "score_credibility"):
        cred_out = nlp_module.score_credibility(report_text)
        result["credibility_score"] = cred_out.get("score", 0.7)
    else:
        result["credibility_score"] = 0.7

    # ── Entity Extraction ──
    if hasattr(nlp_module, "extract_entities"):
        entities = nlp_module.extract_entities(report_text)
        result["entities"] = entities
    else:
        result["entities"] = {}

    # ── Duplicate Detection ──
    text_hash = hashlib.md5(report_text.lower().strip().encode()).hexdigest()
    if text_hash in _SEEN_REPORTS:
        result["is_duplicate"] = True
        result["duplicate_of"] = _SEEN_REPORTS[text_hash]
    else:
        result["is_duplicate"] = False
        result["duplicate_of"] = None
        _SEEN_REPORTS[text_hash] = report_id

    # ── Auto-Response Generation ──
    if hasattr(nlp_module, "generate_response"):
        result["auto_response"] = nlp_module.generate_response(
            severity=result["severity"],
            emotion=result["emotion"],
            entities=result["entities"]
        )
    else:
        # Fallback template-based response
        result["auto_response"] = _template_response(
            result["severity"], result["emotion"]
        )

    # ── Graph Payload ──
    # Format data for TigerGraph insertion (used by graph_service.py)
    result["graph_payload"] = {
        "vertex_type": "Incident",
        "vertex_id": report_id,
        "attributes": {
            "text": report_text,
            "severity": result["severity"],
            "severity_score": result["severity_score"],
            "credibility": result["credibility_score"],
            "location_id": location_id or "unknown",
            "timestamp": result["timestamp"],
            "emotion": result["emotion"]
        },
        "edges": [
            {
                "edge_type": "OCCURRED_AT",
                "to_vertex_type": "Zone",
                "to_vertex_id": location_id
            }
        ] if location_id else []
    }

    return result


def _template_response(severity: str, emotion: str) -> str:
    responses = {
        "critical": "Emergency services have been notified. Please stay safe and call 112 immediately.",
        "high": "Your report has been flagged as high priority. Authorities are being alerted.",
        "medium": "Thank you for your report. Our safety team will review and respond shortly.",
        "low": "Report received. We will monitor this area."
    }
    return responses.get(severity, responses["medium"])
```

### Step B4.3 — Reports Router

**File:** `backend_python/routers/reports.py`

```python
# backend_python/routers/reports.py

import uuid
from fastapi import APIRouter, Request, HTTPException
from models.report_models import ReportRequest, ReportResponse
from services.nlp_service import analyze_incident_report
from services.graph_service import upsert_incident_to_graph

router = APIRouter()


@router.post("/analyze-report", response_model=ReportResponse)
async def analyze_report(request: Request, body: ReportRequest):
    """
    B4: Full NLP analysis of an incident report.
    Stores result to TigerGraph after analysis.
    """
    nlp_bundle = request.app.state.models.get("nlp")
    if not nlp_bundle:
        raise HTTPException(status_code=503, detail="NLP model not loaded")

    report_id = body.report_id or str(uuid.uuid4())

    try:
        analysis = analyze_incident_report(
            nlp_bundle=nlp_bundle,
            report_text=body.text,
            report_id=report_id,
            location_id=body.location_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"NLP inference failed: {str(e)}")

    # Store to TigerGraph (non-blocking — don't fail if graph is down)
    try:
        await upsert_incident_to_graph(analysis["graph_payload"])
    except Exception as e:
        # Log but don't fail the request
        import logging
        logging.getLogger(__name__).warning(f"TigerGraph upsert failed: {e}")

    return analysis


@router.get("/reports")
async def get_reports(location_id: str = None, severity: str = None, limit: int = 50):
    """
    Returns recent incident reports, optionally filtered.
    """
    from services.graph_service import query_incidents
    return await query_incidents(location_id=location_id, severity=severity, limit=limit)
```

---

## 2.6 Module B3 — Anomaly Detection Integration

### Step B3.1 — Anomaly Loader

**File:** `backend_python/ai/anomaly/loader.py`

```python
# backend_python/ai/anomaly/loader.py
"""
Loader for B3: Anomaly Detection on structured data.
"""

import sys
import logging
from pathlib import Path

ANOMALY_AI_DIR = Path(__file__).parent.parent.parent.parent / "ai" / "anomaly"
sys.path.insert(0, str(ANOMALY_AI_DIR))

logger = logging.getLogger(__name__)


def load_anomaly_model() -> dict:
    """
    Loads the anomaly detection model.
    Returns dict with inference function.
    """
    try:
        import inference as anomaly_inference
        logger.info("Anomaly inference module loaded")

        model = None
        if hasattr(anomaly_inference, "load_model"):
            model = anomaly_inference.load_model()
        elif hasattr(anomaly_inference, "AnomalyDetector"):
            model = anomaly_inference.AnomalyDetector()

        return {
            "inference_module": anomaly_inference,
            "model": model
        }
    except ImportError:
        # B3 might not have inference.py yet — use statistical fallback
        logger.warning("B3 anomaly module not found — using statistical fallback")
        return {
            "inference_module": None,
            "model": None,
            "use_fallback": True
        }
```

### Step B3.2 — Anomaly Service

**File:** `backend_python/services/anomaly_service.py`

```python
# backend_python/services/anomaly_service.py
"""
B3 Anomaly Service — detects unusual patterns in structured time-series data.
Falls back to Z-score statistical method if model unavailable.
"""

import logging
import numpy as np
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

Z_SCORE_THRESHOLD = 2.5  # Standard deviations above mean to flag as anomaly


def detect_anomalies(
    anomaly_bundle: dict,
    location_id: str,
    data_points: List[Dict[str, float]]
) -> Dict[str, Any]:
    """
    Detects anomalies in structured sensor/event data.

    Args:
        anomaly_bundle: dict from loader.py
        location_id: zone identifier
        data_points: List of dicts, each with timestamp + feature values
                    Example: [{"hour": 22, "incident_count": 5, "crowd": 0.8, ...}]

    Returns:
        dict with:
            - location_id: str
            - anomaly_detected: bool
            - anomaly_score: float — 0.0–1.0
            - flagged_points: List[int] — indices of anomalous data points
            - method: str — "model" | "zscore_fallback"
    """
    use_fallback = anomaly_bundle.get("use_fallback", False)
    model = anomaly_bundle.get("model")
    inference_module = anomaly_bundle.get("inference_module")

    if not use_fallback and inference_module and hasattr(inference_module, "detect"):
        try:
            result = inference_module.detect(location_id, data_points)
            result["method"] = "model"
            return result
        except Exception as e:
            logger.warning(f"B3 model inference failed, falling back: {e}")

    # ── Statistical Z-Score Fallback ──
    if not data_points:
        return {
            "location_id": location_id,
            "anomaly_detected": False,
            "anomaly_score": 0.0,
            "flagged_points": [],
            "method": "zscore_fallback"
        }

    # Use 'incident_count' field if present, else first numeric value
    values = []
    for dp in data_points:
        v = dp.get("incident_count") or dp.get("crime_count") or list(dp.values())[0]
        values.append(float(v))

    arr = np.array(values)
    if arr.std() == 0:
        return {
            "location_id": location_id,
            "anomaly_detected": False,
            "anomaly_score": 0.0,
            "flagged_points": [],
            "method": "zscore_fallback"
        }

    z_scores = np.abs((arr - arr.mean()) / arr.std())
    flagged = [i for i, z in enumerate(z_scores) if z > Z_SCORE_THRESHOLD]
    max_z = float(z_scores.max())
    anomaly_score = min(max_z / (Z_SCORE_THRESHOLD * 2), 1.0)

    return {
        "location_id": location_id,
        "anomaly_detected": len(flagged) > 0,
        "anomaly_score": round(anomaly_score, 3),
        "flagged_points": flagged,
        "method": "zscore_fallback"
    }
```

---

## 2.7 Danger Aggregator Service

**This is the most critical service** — it combines B1 + B2 + B3 into one unified score.

**File:** `backend_python/services/danger_aggregator.py`

```python
# backend_python/services/danger_aggregator.py
"""
Combines outputs of B1 (LSTM), B2 (CV), and B3 (Anomaly) into one danger score.
This is the central intelligence hub of the system.
"""

import logging
import asyncio
from typing import Dict, Any, Optional

from services.lstm_service import predict_danger_score
from services.cv_service import analyze_frame
from services.anomaly_service import detect_anomalies
from db.tigergraph_client import get_zone_data

logger = logging.getLogger(__name__)

# Weights for final danger score
# Must sum to 1.0
WEIGHTS = {
    "lstm": 0.45,       # Time-series prediction dominates
    "cv": 0.30,         # Real-time visual data
    "anomaly": 0.15,    # Pattern deviation signal
    "graph": 0.10       # Historical graph-based crime data
}


async def aggregate_danger_score(
    location_id: str,
    lat: float,
    lng: float,
    models: dict,
    current_hour: Optional[int] = None,
    image_bytes: Optional[bytes] = None
) -> Dict[str, Any]:
    """
    Aggregates all AI module outputs into a single danger score.

    Returns:
        dict with:
            - location_id: str
            - danger_score: float — 0.0–1.0 (final weighted score)
            - danger_level: str — "safe" | "moderate" | "unsafe" | "critical"
            - component_scores: dict — individual module contributions
            - confidence: float — based on LSTM uncertainty
            - recommendation: str
    """
    from datetime import datetime
    current_hour = current_hour or datetime.utcnow().hour

    component_scores = {}
    score_values = {}

    # ── B1: LSTM Score ──
    try:
        lstm_bundle = models.get("lstm")
        if lstm_bundle:
            # For aggregation, we use the current-hour danger prediction
            # Build minimal feature vector from available data
            historical_features = await _build_feature_vector(lat, lng, current_hour)
            lstm_result = predict_danger_score(
                lstm_bundle, location_id, historical_features
            )
            current_hour_score = lstm_result["predictions"][current_hour % 24]
            component_scores["lstm"] = {
                "score": current_hour_score,
                "uncertainty": lstm_result["uncertainty"][current_hour % 24],
                "peak_hour": lstm_result["peak_danger_hour"]
            }
            score_values["lstm"] = current_hour_score
        else:
            score_values["lstm"] = 0.5
    except Exception as e:
        logger.warning(f"LSTM aggregation failed: {e}")
        score_values["lstm"] = 0.5

    # ── B2: CV Score ──
    try:
        cv_bundle = models.get("cv")
        if cv_bundle and image_bytes:
            cv_result = analyze_frame(cv_bundle, image_bytes, location_id, location_id)
            component_scores["cv"] = cv_result
            score_values["cv"] = cv_result["danger_contribution"]
        else:
            score_values["cv"] = 0.3  # neutral default if no image
    except Exception as e:
        logger.warning(f"CV aggregation failed: {e}")
        score_values["cv"] = 0.3

    # ── B3: Anomaly Score ──
    try:
        anomaly_bundle = models.get("anomaly")
        if anomaly_bundle:
            zone_data = await get_zone_data(location_id)
            anomaly_result = detect_anomalies(
                anomaly_bundle, location_id, zone_data.get("recent_data", [])
            )
            component_scores["anomaly"] = anomaly_result
            score_values["anomaly"] = anomaly_result["anomaly_score"]
        else:
            score_values["anomaly"] = 0.2
    except Exception as e:
        logger.warning(f"Anomaly aggregation failed: {e}")
        score_values["anomaly"] = 0.2

    # ── Graph Historical Score ──
    try:
        zone_data = await get_zone_data(location_id)
        historical_score = zone_data.get("historical_danger_score", 0.3)
        score_values["graph"] = historical_score
        component_scores["graph"] = {"historical_score": historical_score}
    except Exception as e:
        score_values["graph"] = 0.3

    # ── Weighted Aggregation ──
    final_score = sum(
        WEIGHTS[k] * score_values.get(k, 0.3)
        for k in WEIGHTS
    )
    final_score = round(min(max(final_score, 0.0), 1.0), 3)

    # ── Danger Level Classification ──
    if final_score < 0.25:
        danger_level = "safe"
        recommendation = "Area appears safe. Normal precautions apply."
    elif final_score < 0.50:
        danger_level = "moderate"
        recommendation = "Exercise caution. Stay in well-lit areas."
    elif final_score < 0.75:
        danger_level = "unsafe"
        recommendation = "Avoid if possible. Use safe route recommendations."
    else:
        danger_level = "critical"
        recommendation = "Do not enter. Contact emergency services if needed."

    # ── Confidence from LSTM uncertainty ──
    lstm_uncertainty = component_scores.get("lstm", {}).get("uncertainty", 0.2)
    confidence = round(1.0 - min(lstm_uncertainty, 1.0), 3)

    return {
        "location_id": location_id,
        "lat": lat,
        "lng": lng,
        "danger_score": final_score,
        "danger_level": danger_level,
        "component_scores": component_scores,
        "confidence": confidence,
        "recommendation": recommendation,
        "weights_used": WEIGHTS
    }


async def _build_feature_vector(lat: float, lng: float, current_hour: int):
    """
    Builds a 24-timestep feature vector for LSTM input.
    Uses TigerGraph data if available, else synthetic data.
    """
    try:
        zone_data = await get_zone_data(f"{lat:.4f}_{lng:.4f}")
        if zone_data.get("feature_vectors"):
            return zone_data["feature_vectors"]
    except Exception:
        pass

    # Synthetic fallback — 24 hours of approximate features
    # [hour, day_of_week, crime_count, crowd_density, lighting_score, ...]
    import numpy as np
    from datetime import datetime
    now = datetime.utcnow()
    features = []
    for h in range(24):
        hour = (current_hour - 24 + h) % 24
        features.append([
            hour,
            now.weekday(),
            2.0,   # avg crime count placeholder
            0.4,   # avg crowd density
            0.6,   # avg lighting score
            0.3    # avg safety report density
        ])
    return features
```

---

# 3. COMPLETE API DESIGN

## 3.1 Full Endpoint Registry

### Namespace: `/api/v1`

All endpoints below are prefixed with `/api/v1`.

---

### 🔴 Danger Endpoints (`routers/danger.py`)

#### `POST /predict-danger`
```
Purpose: 24-hour LSTM danger prediction for a location
Auth: None (open for demo)

Request Body:
{
  "location_id": "zone_42",
  "date_hour": "2024-01-15T22:00",
  "historical_features": [
    [22, 1, 3.0, 0.8, 0.4, 0.6],   // [hour, dow, crime, crowd, lighting, report_density]
    ... (24 rows minimum)
  ]
}

Response:
{
  "location_id": "zone_42",
  "predictions": [0.32, 0.28, ...],    // 24 floats
  "uncertainty": [0.05, 0.07, ...],    // 24 floats
  "peak_danger_hour": 22,
  "average_danger": 0.41,
  "timestamp": "2024-01-15T18:00:00"
}

Frontend usage: Power the 24-hour danger timeline chart
```

#### `GET /danger-score?lat=&lng=`
```
Purpose: Real-time aggregated danger score for a map coordinate
Auth: None

Query Params:
  lat: float (required)
  lng: float (required)

Response:
{
  "location_id": "30.7333_76.7794",
  "lat": 30.7333,
  "lng": 76.7794,
  "danger_score": 0.67,
  "danger_level": "unsafe",
  "component_scores": {
    "lstm": {"score": 0.71, "uncertainty": 0.08},
    "cv": {"density_score": 0.55, "person_count": 12},
    "anomaly": {"anomaly_score": 0.42},
    "graph": {"historical_score": 0.60}
  },
  "confidence": 0.92,
  "recommendation": "Avoid if possible. Use safe route recommendations."
}

Frontend usage: Map heatmap tile color + info panel
```

---

### 📹 CCTV Endpoints (`routers/cctv.py`)

#### `POST /analyze-cctv` (multipart)
```
Purpose: Analyze CCTV frame — crowd density, person count, anomaly
Content-Type: multipart/form-data

Form Fields:
  camera_id: str (required)
  location_id: str (optional)
  file: image/jpeg or image/png

Response:
{
  "camera_id": "cam_sector_7",
  "location_id": "zone_42",
  "person_count": 18,
  "crowd_density": "high",
  "density_score": 0.81,
  "anomalies_detected": false,
  "anomaly_details": [],
  "yolo_detections": [...],
  "danger_contribution": 0.65
}

Frontend usage: Live CCTV panel, real-time crowd overlay on map
```

#### `POST /analyze-cctv-base64`
```
Same as above but accepts JSON with base64 image.
Useful when frontend can't use FormData easily.
```

---

### 📝 Report Endpoints (`routers/reports.py`)

#### `POST /analyze-report`
```
Purpose: Full NLP analysis of an incident report
Content-Type: application/json

Request Body:
{
  "text": "I felt unsafe near the bus stop on sector 7 main road at 11pm. A group of men were harassing women.",
  "location_id": "zone_42",
  "report_id": "RPT-2024-001",    // optional, auto-generated if absent
  "reporter_id": "user_123"        // optional
}

Response:
{
  "report_id": "RPT-2024-001",
  "sentiment": "negative",
  "sentiment_score": 0.94,
  "emotion": "fear",
  "emotion_scores": {"fear": 0.87, "anger": 0.23},
  "severity": "high",
  "severity_score": 0.78,
  "credibility_score": 0.82,
  "entities": {
    "locations": ["bus stop", "sector 7 main road"],
    "time": ["11pm"],
    "persons": ["group of men"]
  },
  "is_duplicate": false,
  "duplicate_of": null,
  "auto_response": "Your report has been flagged as high priority...",
  "graph_payload": {...}
}

Frontend usage: Report submission flow, admin dashboard
```

#### `GET /reports`
```
Purpose: List recent incident reports
Query Params:
  location_id: str (optional filter)
  severity: str (optional filter: low|medium|high|critical)
  limit: int (default 50)

Response:
{
  "reports": [...],
  "total": 247,
  "filtered_by": {"location_id": "zone_42"}
}
```

---

### 🔵 Routing Endpoints (`routers/routing.py`)

#### `GET /safe-route` (existing, enhanced)
```
Purpose: Compute safest route from A to B using danger scores
Query Params:
  start_lat: float
  start_lng: float
  end_lat: float
  end_lng: float
  mode: str (default "walking")

Response:
{
  "route": {
    "type": "LineString",
    "coordinates": [[lng, lat], [lng, lat], ...]
  },
  "danger_segments": [
    {
      "segment_id": 0,
      "start": [30.73, 76.77],
      "end": [30.74, 76.78],
      "danger_score": 0.23,
      "danger_level": "safe"
    }
  ],
  "overall_safety_score": 0.28,
  "estimated_time_minutes": 12,
  "alternative_routes": [...]
}
```

#### `GET /intersections`
```
Existing endpoint — unchanged.
Returns dangerous intersection data for map overlay.
```

---

### 🔍 Anomaly Endpoints (`routers/anomaly.py`)

#### `POST /detect-anomaly`
```
Request Body:
{
  "location_id": "zone_42",
  "data_points": [
    {"hour": 20, "incident_count": 1, "crowd": 0.4},
    {"hour": 21, "incident_count": 1, "crowd": 0.5},
    {"hour": 22, "incident_count": 8, "crowd": 0.9}   // spike
  ]
}

Response:
{
  "location_id": "zone_42",
  "anomaly_detected": true,
  "anomaly_score": 0.89,
  "flagged_points": [2],
  "method": "model"
}
```

---

### 🕸️ Graph Endpoints (`routers/graph.py`)

#### `GET /graph/zone-summary/{zone_id}`
```
Returns TigerGraph-stored data for a zone.
Includes: historical incidents, danger trends, connected zones.
```

#### `GET /graph/heatmap`
```
Returns heatmap data for all zones.
Response: Array of {lat, lng, danger_score, zone_id}
Used by MapLibre heatmap layer.
```

#### `POST /graph/update-zone`
```
Updates a zone's danger score in TigerGraph.
Called internally after aggregation.
```

---

### 🔔 WebSocket Endpoint

#### `WS /ws/alerts`
```
Purpose: Real-time alerts to frontend
Protocol: WebSocket

Server pushes:
{
  "type": "NEW_ALERT",
  "data": {
    "alert_id": "ALT-001",
    "location_id": "zone_42",
    "danger_level": "critical",
    "message": "Anomaly detected in sector 7",
    "timestamp": "2024-01-15T22:05:00"
  }
}

Frontend: useWebSocket() hook listens and adds to alert feed
```

**File:** `backend_python/routers/websocket.py`

```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List
import asyncio, json

router = APIRouter()
active_connections: List[WebSocket] = []


@router.websocket("/ws/alerts")
async def alerts_websocket(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            await asyncio.sleep(30)  # keep alive
            await websocket.send_json({"type": "PING"})
    except WebSocketDisconnect:
        active_connections.remove(websocket)


async def broadcast_alert(alert_data: dict):
    """Call this from any service to push alert to all connected clients."""
    for conn in active_connections[:]:
        try:
            await conn.send_json({"type": "NEW_ALERT", "data": alert_data})
        except Exception:
            active_connections.remove(conn)
```

---

# 4. DATA FLOW DESIGN

## 4.1 Primary Flow: User Reports Incident

```
1. User opens React app → fills IncidentReportForm
2. Frontend: POST /api/v1/analyze-report
   Body: {text, location_id, lat, lng}
3. FastAPI → routers/reports.py → analyze_report()
4. nlp_service.analyze_incident_report()
   → B4: sentiment, severity, credibility, entities, auto_response
5. graph_service.upsert_incident_to_graph()
   → TigerGraph: creates Incident vertex, OCCURRED_AT edge to Zone vertex
6. Response returned to frontend (step 4's output)
7. Frontend displays:
   → auto_response in the report form (acknowledgment)
   → severity badge on map marker
8. BACKGROUND (async, after response):
   → If severity >= "high": trigger danger_aggregator for that zone
   → danger_aggregator calls B1 + B3 with new data
   → Updated danger_score stored back to TigerGraph
   → WebSocket broadcast: NEW_ALERT pushed to all connected clients
   → Frontend map heatmap refreshes
```

## 4.2 Primary Flow: Map Loads / User Views Area

```
1. React MapLibre component mounts
2. Frontend: GET /api/v1/graph/heatmap (fetches all zone scores)
3. FastAPI → graph_service.get_heatmap_data()
   → TigerGraph: query all Zone vertices with danger_score
4. Response: [{lat, lng, danger_score, zone_id}, ...]
5. MapLibre renders heatmap layer (color-coded by danger_score)

SEPARATELY (per visible zone):
6. Frontend: GET /api/v1/danger-score?lat=&lng= (for focused zone)
7. danger_aggregator.aggregate_danger_score()
   → B1: LSTM current-hour prediction
   → B3: Anomaly detection on recent data
   → Graph: historical score
8. Component updates info panel with live scores
```

## 4.3 Primary Flow: CCTV Frame Analysis

```
1. Frontend CCTV panel: user uploads/captures frame
2. Frontend: POST /api/v1/analyze-cctv (multipart)
3. cv_service.analyze_frame()
   → B2: YOLOv8 person count
   → B2: MobileNetV2 crowd density
   → Danger contribution computed
4. Result returned and displayed in CCTV widget
5. BACKGROUND: danger_contribution fed into aggregator for that zone
   → Zone danger score updates in TigerGraph
   → If anomaly_detected: WebSocket alert broadcast
```

## 4.4 Primary Flow: Safe Route Request

```
1. User enters start/end on map (MapLibre click or search)
2. Frontend: GET /api/v1/safe-route?start_lat=&start_lng=&end_lat=&end_lng=
3. route_service.compute_safe_route()
   → Fetch all intersections between A and B
   → For each path node: GET danger_score (from cache or TigerGraph)
   → Dijkstra/A* with danger_score as edge weight
   → Return lowest-danger-score path
4. Frontend: MapLibre draws route as colored LineString
   → Color segments by danger_level (green/yellow/red)
5. Route summary panel: shows overall safety score
```

## 4.5 Full System Data Flow (Composite View)

```
User Action
    │
    ▼
React Frontend
    │
    ├─── Report Incident ──────────────────────────────────────┐
    │         │                                                  │
    │    POST /analyze-report                                    │
    │         │                                                  │
    │    NLP Service (B4)                                        │
    │         │                                                  │
    │    [sentiment + severity + entities + auto_response]       │
    │         │                                                  │
    │    TigerGraph: insert Incident vertex                      │
    │         │                                                  │
    │    [ASYNC] trigger aggregation for zone ────────────────┐  │
    │                                                          │  │
    ├─── View Map ─────────────────────────────────────────┐  │  │
    │         │                                             │  │  │
    │    GET /heatmap  (all zones)                          │  │  │
    │         │                                             │  │  │
    │    TigerGraph: query Zone vertices                    │  │  │
    │         │                                             │  │  │
    │    MapLibre: render heatmap                           │  │  │
    │                                                       │  │  │
    └─── Request Safe Route ──────────────────────────────┐│  │  │
              │                                            ││  │  │
         GET /safe-route                                   ││  │  │
              │                                            ││  │  │
         route_service                                     ││  │  │
              │                                            ││  │  │
         [per intersection] danger_aggregator ─────────────┘│  │  │
                             │                               │  │  │
                        ┌────┴────────────────────────────┐  │  │  │
                        │         danger_aggregator        │◄─┘  │  │
                        │                                  │◄────┘  │
                        │  B1: LSTM (0.45 weight)          │◄───────┘
                        │  B2: CV   (0.30 weight)          │
                        │  B3: Anom (0.15 weight)          │
                        │  Graph   (0.10 weight)           │
                        └──────────────┬──────────────────┘
                                       │
                        ┌──────────────▼──────────────────┐
                        │         TigerGraph               │
                        │  Nodes: Zone, Incident,           │
                        │         Intersection, Camera      │
                        │  Edges: OCCURRED_AT, CONNECTS_TO, │
                        │         MONITORED_BY             │
                        └──────────────┬──────────────────┘
                                       │
                        ┌──────────────▼──────────────────┐
                        │      WebSocket Broadcast         │
                        │    (if score changed > 0.1)      │
                        └──────────────┬──────────────────┘
                                       │
                        React Frontend: refresh heatmap + alerts
```

---

# 5. TIGERGRAPH INTEGRATION STRATEGY

## 5.1 Graph Schema Design

### Vertex Types

```
Vertex: Zone
  Attributes:
    - zone_id: STRING (PRIMARY KEY)
    - name: STRING
    - lat: DOUBLE
    - lng: DOUBLE
    - danger_score: DOUBLE         (updated by aggregator)
    - historical_avg_danger: DOUBLE
    - incident_count_24h: INT
    - last_updated: DATETIME

Vertex: Incident
  Attributes:
    - incident_id: STRING (PRIMARY KEY)
    - text: STRING
    - severity: STRING             (from B4 NLP)
    - severity_score: DOUBLE
    - credibility: DOUBLE
    - emotion: STRING
    - timestamp: DATETIME
    - source: STRING               ("user_report" | "cctv" | "sensor")

Vertex: Camera
  Attributes:
    - camera_id: STRING (PRIMARY KEY)
    - location_id: STRING
    - lat: DOUBLE
    - lng: DOUBLE
    - last_crowd_density: STRING   (from B2 CV)
    - last_person_count: INT
    - last_danger_contribution: DOUBLE
    - last_analyzed: DATETIME

Vertex: Intersection
  Attributes:
    - intersection_id: STRING (PRIMARY KEY)
    - lat: DOUBLE
    - lng: DOUBLE
    - danger_score: DOUBLE
    - incident_count: INT
```

### Edge Types

```
Edge: OCCURRED_AT
  From: Incident → To: Zone
  Attributes: timestamp: DATETIME

Edge: CONNECTS_TO
  From: Zone → To: Zone
  Attributes:
    - distance_m: DOUBLE
    - avg_danger: DOUBLE           (weighted avg of both zones)

Edge: MONITORED_BY
  From: Zone → To: Camera
  Attributes: active: BOOL

Edge: PART_OF
  From: Intersection → To: Zone
```

## 5.2 TigerGraph Client

**File:** `backend_python/db/tigergraph_client.py`

```python
# backend_python/db/tigergraph_client.py

import logging
import asyncio
from typing import Dict, Any, List, Optional
from config import (
    TIGERGRAPH_HOST, TIGERGRAPH_PORT, TIGERGRAPH_GRAPH,
    TIGERGRAPH_USERNAME, TIGERGRAPH_PASSWORD, USE_MOCK_DB
)

logger = logging.getLogger(__name__)

# Try importing pyTigerGraph
try:
    import pyTigerGraph as tg
    TG_AVAILABLE = True
except ImportError:
    TG_AVAILABLE = False
    logger.warning("pyTigerGraph not installed — using mock DB")


class TigerGraphClient:
    def __init__(self):
        self.conn = None
        self.connected = False

    def connect(self):
        if USE_MOCK_DB or not TG_AVAILABLE:
            logger.info("Using MOCK DB (TigerGraph not configured or USE_MOCK_DB=true)")
            return
        try:
            self.conn = tg.TigerGraphConnection(
                host=TIGERGRAPH_HOST,
                graphname=TIGERGRAPH_GRAPH,
                username=TIGERGRAPH_USERNAME,
                password=TIGERGRAPH_PASSWORD
            )
            self.conn.getToken(self.conn.createSecret())
            self.connected = True
            logger.info("✅ TigerGraph connected")
        except Exception as e:
            logger.warning(f"TigerGraph connection failed: {e}. Using mock fallback.")
            self.connected = False

    async def upsert_vertex(self, vertex_type: str, vertex_id: str, attributes: dict):
        if not self.connected:
            return _mock_upsert(vertex_type, vertex_id, attributes)
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.conn.upsertVertex(vertex_type, vertex_id, attributes)
        )

    async def upsert_edge(self, from_type: str, from_id: str,
                          edge_type: str, to_type: str, to_id: str,
                          attributes: dict = None):
        if not self.connected:
            return _mock_upsert_edge(from_type, from_id, edge_type, to_type, to_id)
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.conn.upsertEdge(
                from_type, from_id, edge_type, to_type, to_id, attributes or {}
            )
        )

    async def run_query(self, query_name: str, params: dict = None):
        if not self.connected:
            return _mock_query(query_name, params)
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.conn.runInstalledQuery(query_name, params or {})
        )

    async def get_vertex(self, vertex_type: str, vertex_id: str):
        if not self.connected:
            return _mock_get_vertex(vertex_type, vertex_id)
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.conn.getVerticesById(vertex_type, vertex_id)
        )


# Singleton
_client = TigerGraphClient()


def get_client() -> TigerGraphClient:
    if not _client.connected and not USE_MOCK_DB:
        _client.connect()
    return _client


# ── High-level helper functions used by services ──

async def upsert_incident_to_graph(payload: dict):
    client = get_client()
    vertex_attrs = payload.get("attributes", {})
    await client.upsert_vertex("Incident", payload["vertex_id"], vertex_attrs)
    for edge in payload.get("edges", []):
        await client.upsert_edge(
            "Incident", payload["vertex_id"],
            edge["edge_type"],
            edge["to_vertex_type"], edge["to_vertex_id"]
        )


async def get_zone_data(zone_id: str) -> dict:
    client = get_client()
    result = await client.get_vertex("Zone", zone_id)
    if result:
        return result
    return _mock_zone_data(zone_id)


async def update_zone_danger_score(zone_id: str, danger_score: float):
    client = get_client()
    await client.upsert_vertex("Zone", zone_id, {"danger_score": danger_score})


# ── Mock fallback functions ──

def _mock_upsert(vtype, vid, attrs):
    logger.debug(f"MOCK upsert {vtype}:{vid} → {attrs}")
    return {"upserted": 1}

def _mock_upsert_edge(ft, fid, etype, tt, tid):
    logger.debug(f"MOCK edge {ft}:{fid} --{etype}--> {tt}:{tid}")
    return {"upserted": 1}

def _mock_query(qname, params):
    return {"results": []}

def _mock_get_vertex(vtype, vid):
    return None

def _mock_zone_data(zone_id: str) -> dict:
    """Returns mock zone data for testing."""
    import random
    return {
        "zone_id": zone_id,
        "danger_score": round(random.uniform(0.2, 0.8), 2),
        "historical_danger_score": round(random.uniform(0.2, 0.7), 2),
        "incident_count_24h": random.randint(0, 10),
        "feature_vectors": None,
        "recent_data": [
            {"hour": h, "incident_count": random.randint(0, 5), "crowd": random.uniform(0.1, 0.9)}
            for h in range(24)
        ]
    }
```

## 5.3 When to Call TigerGraph vs AI

| Trigger | Call | Action |
|---|---|---|
| User views map | TigerGraph | Fetch all zone danger scores (cached) |
| User requests safe route | TigerGraph + LSTM | Get node scores + LSTM refines current-hour |
| User submits report | NLP → TigerGraph | Analyze then store |
| CCTV frame uploaded | CV → TigerGraph | Analyze then update camera vertex |
| Periodic refresh (5 min) | LSTM + TigerGraph | Re-predict danger, update zones |
| Anomaly spike detected | Anomaly → TigerGraph + WS | Store event, broadcast alert |
| Zone danger changes >0.1 | TigerGraph | Update zone vertex, trigger frontend refresh |

---

# 6. FRONTEND CONNECTION PLAN

## 6.1 API Service Layer

**File:** `frontend/src/services/api.js`

```javascript
// frontend/src/services/api.js
// ALL backend API calls go through this file — never call fetch() directly in components

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// ── Utility ──
async function apiFetch(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

// ── Danger Score ──
export const getDangerScore = (lat, lng) =>
  apiFetch(`/danger-score?lat=${lat}&lng=${lng}`);

export const predictDanger = (body) =>
  apiFetch('/predict-danger', { method: 'POST', body: JSON.stringify(body) });

// ── Heatmap ──
export const getHeatmapData = () => apiFetch('/graph/heatmap');

// ── Safe Route ──
export const getSafeRoute = (startLat, startLng, endLat, endLng) =>
  apiFetch(`/safe-route?start_lat=${startLat}&start_lng=${startLng}&end_lat=${endLat}&end_lng=${endLng}`);

// ── Reports ──
export const submitReport = (body) =>
  apiFetch('/analyze-report', { method: 'POST', body: JSON.stringify(body) });

export const getReports = (filters = {}) => {
  const params = new URLSearchParams(filters).toString();
  return apiFetch(`/reports${params ? '?' + params : ''}`);
};

// ── CCTV ──
export const analyzeCCTV = async (cameraId, locationId, imageFile) => {
  const formData = new FormData();
  formData.append('camera_id', cameraId);
  if (locationId) formData.append('location_id', locationId);
  formData.append('file', imageFile);
  const response = await fetch(`${BASE_URL}/analyze-cctv`, {
    method: 'POST',
    body: formData,  // Note: no Content-Type header — browser sets multipart boundary
  });
  if (!response.ok) throw new Error(`CCTV analysis failed: ${response.status}`);
  return response.json();
};

// ── Anomaly ──
export const detectAnomaly = (body) =>
  apiFetch('/detect-anomaly', { method: 'POST', body: JSON.stringify(body) });

// ── Graph ──
export const getZoneSummary = (zoneId) => apiFetch(`/graph/zone-summary/${zoneId}`);
```

## 6.2 WebSocket Hook

**File:** `frontend/src/hooks/useWebSocket.js`

```javascript
// frontend/src/hooks/useWebSocket.js

import { useEffect, useCallback, useRef } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/api/v1/ws/alerts';
const RECONNECT_INTERVAL = 3000;

export function useWebSocket(onMessage) {
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    wsRef.current = new WebSocket(WS_URL);

    wsRef.current.onopen = () => {
      console.log('[WS] Connected to alerts stream');
      clearTimeout(reconnectTimer.current);
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type !== 'PING') {
          onMessage(data);
        }
      } catch (e) {
        console.error('[WS] Parse error:', e);
      }
    };

    wsRef.current.onclose = () => {
      console.log('[WS] Disconnected. Reconnecting...');
      reconnectTimer.current = setTimeout(connect, RECONNECT_INTERVAL);
    };

    wsRef.current.onerror = (err) => {
      console.error('[WS] Error:', err);
      wsRef.current.close();
    };
  }, [onMessage]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
```

## 6.3 MapLibre Heatmap Integration

**File:** `frontend/src/components/Map/SafetyHeatmap.jsx`

```jsx
// frontend/src/components/Map/SafetyHeatmap.jsx

import { useEffect, useRef } from 'react';
import { getHeatmapData } from '../../services/api';

export function SafetyHeatmap({ mapRef }) {
  const dataRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    const loadHeatmap = async () => {
      const data = await getHeatmapData();
      dataRef.current = data;

      const geojson = {
        type: 'FeatureCollection',
        features: data.map(zone => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [zone.lng, zone.lat] },
          properties: { danger_score: zone.danger_score, zone_id: zone.zone_id }
        }))
      };

      // Add source if not exists
      if (!map.getSource('safety-heatmap')) {
        map.addSource('safety-heatmap', { type: 'geojson', data: geojson });
      } else {
        map.getSource('safety-heatmap').setData(geojson);
      }

      // Add heatmap layer
      if (!map.getLayer('safety-heatmap-layer')) {
        map.addLayer({
          id: 'safety-heatmap-layer',
          type: 'heatmap',
          source: 'safety-heatmap',
          paint: {
            'heatmap-weight': ['get', 'danger_score'],
            'heatmap-intensity': 1.5,
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0,   'rgba(0, 255, 0, 0)',   // transparent (safe)
              0.3, 'rgba(255, 255, 0, 0.6)', // yellow (moderate)
              0.6, 'rgba(255, 128, 0, 0.8)', // orange (unsafe)
              1.0, 'rgba(255, 0, 0, 1.0)'    // red (critical)
            ],
            'heatmap-radius': 40,
            'heatmap-opacity': 0.7
          }
        });
      }
    };

    map.on('load', loadHeatmap);

    // Refresh every 5 minutes
    const interval = setInterval(loadHeatmap, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [mapRef]);

  return null; // Map layer rendered inside MapLibre canvas
}
```

## 6.4 Data to Visualize — Frontend Component Map

| Data | Component | API Call | Update Frequency |
|---|---|---|---|
| Zone danger heatmap | `SafetyHeatmap.jsx` | `GET /graph/heatmap` | Every 5 min + WS trigger |
| Safe route overlay | `RouteOverlay.jsx` | `GET /safe-route` | On user request |
| Live alerts feed | `AlertsPanel.jsx` | WebSocket `/ws/alerts` | Real-time |
| Incident report markers | `AlertMarkers.jsx` | `GET /reports` | On map pan/zoom |
| Zone danger score | `DangerScoreWidget.jsx` | `GET /danger-score` | On map click |
| 24-hour prediction chart | `DangerScoreWidget.jsx` | `POST /predict-danger` | On zone select |
| Crowd density overlay | `CrowdDensityWidget.jsx` | `POST /analyze-cctv` | On camera select |
| Report submission form | `IncidentReportForm.jsx` | `POST /analyze-report` | On submit |
| Auto-response display | `IncidentReportForm.jsx` | ← from report response | After submit |

---

# 7. STEP-BY-STEP EXECUTION PLAN

## PRE-EXECUTION CHECKLIST

Before starting, verify these exist:
- [ ] `ai/lstm/lstm_INT007.keras` — file exists
- [ ] `ai/lstm/scaler_INT007.pkl` — file exists
- [ ] `ai/cv/mobilenetv2_crowd.pth` — file exists
- [ ] `ai/cv/inference.py` — file exists, open it, note function names
- [ ] `ai/nlp/inference.py` — file exists, open it, note function names
- [ ] `backend_python/main.py` — existing file (will be replaced)
- [ ] Python 3.9+ installed
- [ ] Node.js 18+ installed (for frontend)

---

## PHASE 0 — Environment Setup (Day 0)
**Estimated time: 30 minutes**

### Step 0.1 — Install Python dependencies

Create `backend_python/requirements.txt`:

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
pyTigerGraph>=1.0.0
python-dotenv==1.0.0
websockets>=12.0
httpx>=0.26.0
```

Run:
```bash
cd backend_python
pip install -r requirements.txt
```

### Step 0.2 — Create `.env` file

```bash
# backend_python/.env
USE_MOCK_DB=true
TIGERGRAPH_HOST=http://localhost
TIGERGRAPH_PORT=14240
ENABLE_CV=true
ENABLE_NLP=true
```

### Step 0.3 — Create directory structure

```bash
mkdir -p backend_python/{routers,services,models,ai/{lstm,cv,nlp,anomaly},db,utils,tests}
touch backend_python/{routers,services,models,ai,ai/lstm,ai/cv,ai/nlp,ai/anomaly,db,utils}/__init__.py
```

### Step 0.4 — Verify AI model imports work

```bash
cd backend_python
python -c "
import sys
sys.path.insert(0, '../ai/lstm')
import inference as lstm_inf
print('LSTM inference.py:', dir(lstm_inf))

sys.path.insert(0, '../ai/nlp')
import inference as nlp_inf
print('NLP inference.py:', dir(nlp_inf))

sys.path.insert(0, '../ai/cv')
import inference as cv_inf
print('CV inference.py:', dir(cv_inf))
"
```

**STOP.** Read the output. Note the actual function names. Update `lstm_service.py`, `cv_service.py`, and `nlp_service.py` accordingly if they differ from the assumed names (`predict`, `analyze`, `analyze_sentiment`, etc.).

---

## PHASE 1 — Core Infrastructure (Day 1, Morning)
**Estimated time: 2 hours**

### Step 1.1 — Create `config.py`
Copy the config.py from Section 2.2 exactly.

### Step 1.2 — Create utility files

**File:** `backend_python/utils/cache.py`
```python
import time
from typing import Any, Optional

_cache: dict = {}

def get_cached(key: str) -> Optional[Any]:
    entry = _cache.get(key)
    if entry and time.time() < entry["expires"]:
        return entry["value"]
    if entry:
        del _cache[key]
    return None

def set_cached(key: str, value: Any, ttl: int = 300):
    _cache[key] = {"value": value, "expires": time.time() + ttl}

def invalidate(key: str):
    _cache.pop(key, None)

def invalidate_prefix(prefix: str):
    keys_to_delete = [k for k in _cache if k.startswith(prefix)]
    for k in keys_to_delete:
        del _cache[k]
```

**File:** `backend_python/utils/scoring.py`
```python
def normalize_score(value: float, min_val: float = 0.0, max_val: float = 1.0) -> float:
    """Normalize a value to [0, 1] range."""
    if max_val == min_val:
        return 0.5
    return max(0.0, min(1.0, (value - min_val) / (max_val - min_val)))

def score_to_level(score: float) -> str:
    if score < 0.25: return "safe"
    if score < 0.50: return "moderate"
    if score < 0.75: return "unsafe"
    return "critical"
```

### Step 1.3 — Create Pydantic models

**File:** `backend_python/models/danger_models.py`
```python
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class DangerPredictRequest(BaseModel):
    location_id: str
    date_hour: Optional[str] = None
    historical_features: List[List[float]] = Field(
        ..., min_length=24,
        description="24 timestep feature vectors: [hour, dow, crime, crowd, lighting, report_density]"
    )

class DangerPredictResponse(BaseModel):
    location_id: str
    predictions: List[float]
    uncertainty: List[float]
    peak_danger_hour: int
    average_danger: float
    timestamp: str
```

**File:** `backend_python/models/report_models.py`
```python
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

class ReportRequest(BaseModel):
    text: str
    location_id: Optional[str] = None
    report_id: Optional[str] = None
    reporter_id: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

class ReportResponse(BaseModel):
    report_id: str
    sentiment: str
    sentiment_score: float
    emotion: str
    severity: str
    severity_score: float
    credibility_score: float
    entities: Dict[str, Any]
    is_duplicate: bool
    duplicate_of: Optional[str]
    auto_response: str
    timestamp: str
```

### Step 1.4 — Create mock DB

**File:** `backend_python/db/mock_db.py`
```python
# Provides mock data when TigerGraph is not connected
import random

MOCK_ZONES = {
    f"zone_{i}": {
        "zone_id": f"zone_{i}",
        "danger_score": round(random.uniform(0.1, 0.9), 2),
        "historical_danger_score": round(random.uniform(0.2, 0.7), 2),
        "incident_count_24h": random.randint(0, 15),
        "lat": 30.73 + (i * 0.01),
        "lng": 76.77 + (i * 0.01),
        "recent_data": [
            {"hour": h, "incident_count": random.randint(0, 5), "crowd": random.uniform(0.1, 0.9)}
            for h in range(24)
        ]
    }
    for i in range(20)
}
```

### Step 1.5 — Smoke test infrastructure

```bash
cd backend_python
python -c "
from config import LSTM_MODEL_PATH, NLP_MODULE_PATH
from utils.cache import get_cached, set_cached
from utils.scoring import score_to_level

set_cached('test', 42, ttl=60)
assert get_cached('test') == 42
assert score_to_level(0.8) == 'critical'
print('✅ Infrastructure smoke test passed')
"
```

---

## PHASE 2 — AI Module Loaders (Day 1, Afternoon)
**Estimated time: 3 hours**

### Step 2.1 — Create LSTM loader

Copy `backend_python/ai/lstm/loader.py` from Section 2.3.

**Test:**
```bash
cd backend_python
python -c "
from ai.lstm.loader import load_lstm_model
bundle = load_lstm_model()
print('✅ LSTM loaded:', list(bundle.keys()))
print('Model type:', type(bundle['model']))
"
```

Expected: No exceptions, model type printed.

### Step 2.2 — Create CV loader

Copy `backend_python/ai/cv/loader.py` from Section 2.4.

**Test:**
```bash
python -c "
from ai.cv.loader import load_cv_models
bundle = load_cv_models()
print('✅ CV loaded:', list(bundle.keys()))
print('Device:', bundle['device'])
"
```

### Step 2.3 — Create NLP loader

Copy `backend_python/ai/nlp/loader.py` from Section 2.5.

**Test:**
```bash
python -c "
from ai.nlp.loader import load_nlp_pipeline
bundle = load_nlp_pipeline()
print('✅ NLP loaded:', list(bundle.keys()))
module = bundle['inference_module']
print('NLP functions available:', [f for f in dir(module) if not f.startswith('_')])
"
```

**CRITICAL:** Read the printed function list. If function names differ from what's used in `nlp_service.py`, update the service file accordingly before proceeding.

### Step 2.4 — Create Anomaly loader

Copy `backend_python/ai/anomaly/loader.py` from Section 2.6.

**Test:**
```bash
python -c "
from ai.anomaly.loader import load_anomaly_model
bundle = load_anomaly_model()
use_fallback = bundle.get('use_fallback', False)
print('✅ Anomaly loaded. Using fallback:', use_fallback)
"
```

---

## PHASE 3 — Services Layer (Day 2, Morning)
**Estimated time: 4 hours**

### Step 3.1 — Create LSTM service

Copy `backend_python/services/lstm_service.py` from Section 2.3.

**Test with synthetic data:**
```bash
python -c "
import sys; sys.path.insert(0, '.')
from ai.lstm.loader import load_lstm_model
from services.lstm_service import predict_danger_score

bundle = load_lstm_model()
# 24 timesteps × 6 features
features = [[h, 0, 2.0, 0.4, 0.6, 0.3] for h in range(24)]
result = predict_danger_score(bundle, 'test_zone', features)
print('✅ LSTM service test passed')
print('Predictions (first 5):', result['predictions'][:5])
print('Peak hour:', result['peak_danger_hour'])
"
```

### Step 3.2 — Create CV service

Copy `backend_python/services/cv_service.py` from Section 2.4.

**Test with a sample image:**
```bash
python -c "
import sys; sys.path.insert(0, '.')
from ai.cv.loader import load_cv_models
from services.cv_service import analyze_frame

# Create a minimal test image
from PIL import Image
import io
img = Image.new('RGB', (640, 480), color=(128, 128, 128))
buf = io.BytesIO()
img.save(buf, format='JPEG')
img_bytes = buf.getvalue()

bundle = load_cv_models()
result = analyze_frame(bundle, img_bytes, 'cam_test', 'zone_test')
print('✅ CV service test passed')
print('Person count:', result['person_count'])
print('Density:', result['crowd_density'])
"
```

### Step 3.3 — Create NLP service

Copy `backend_python/services/nlp_service.py` from Section 2.5.

**Test:**
```bash
python -c "
import sys; sys.path.insert(0, '.')
from ai.nlp.loader import load_nlp_pipeline
from services.nlp_service import analyze_incident_report

bundle = load_nlp_pipeline()
result = analyze_incident_report(
    bundle,
    'I was harassed near the main market at night. Very scary.',
    'RPT-001',
    'zone_42'
)
print('✅ NLP service test passed')
print('Severity:', result['severity'])
print('Emotion:', result['emotion'])
print('Auto-response:', result['auto_response'])
"
```

### Step 3.4 — Create Anomaly service

Copy `backend_python/services/anomaly_service.py` from Section 2.6.

**Test:**
```bash
python -c "
import sys; sys.path.insert(0, '.')
from ai.anomaly.loader import load_anomaly_model
from services.anomaly_service import detect_anomalies

bundle = load_anomaly_model()
# Inject an obvious spike at index 5
data = [{'hour': h, 'incident_count': 1, 'crowd': 0.3} for h in range(10)]
data[5] = {'hour': 5, 'incident_count': 50, 'crowd': 0.95}  # spike
result = detect_anomalies(bundle, 'zone_42', data)
print('✅ Anomaly service test passed')
print('Detected:', result['anomaly_detected'])
print('Score:', result['anomaly_score'])
assert result['anomaly_detected'] == True, 'Should detect spike!'
"
```

### Step 3.5 — Create Danger Aggregator

Copy `backend_python/services/danger_aggregator.py` from Section 2.7.

### Step 3.6 — Create Graph Service

**File:** `backend_python/services/graph_service.py`
```python
from db.tigergraph_client import (
    upsert_incident_to_graph,
    get_zone_data,
    update_zone_danger_score,
    get_client
)
from typing import Optional

async def upsert_incident_to_graph(payload: dict):
    from db.tigergraph_client import upsert_incident_to_graph as _upsert
    return await _upsert(payload)

async def query_incidents(location_id: Optional[str] = None,
                          severity: Optional[str] = None,
                          limit: int = 50):
    client = get_client()
    # In real TigerGraph: run installed query
    # For mock: return sample data
    from db.mock_db import MOCK_ZONES
    return {
        "reports": [],
        "total": 0,
        "message": "Connect TigerGraph for real data"
    }

async def get_heatmap_data():
    from db.mock_db import MOCK_ZONES
    return [
        {
            "zone_id": z["zone_id"],
            "lat": z["lat"],
            "lng": z["lng"],
            "danger_score": z["danger_score"]
        }
        for z in MOCK_ZONES.values()
    ]
```

---

## PHASE 4 — Routers + main.py (Day 2, Afternoon)
**Estimated time: 2 hours**

### Step 4.1 — Create all router files

Create these files using the exact code from Section 2 and Section 3:
- `routers/danger.py` (Section 2.3 Step B1.3)
- `routers/cctv.py` (Section 2.4 Step B2.3)
- `routers/reports.py` (Section 2.5 Step B4.3)
- `routers/anomaly.py` (new, below)
- `routers/routing.py` (migrate existing /safe-route here)
- `routers/graph.py` (new, below)

**File:** `backend_python/routers/anomaly.py`
```python
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import List, Dict

router = APIRouter()

class AnomalyRequest(BaseModel):
    location_id: str
    data_points: List[Dict]

@router.post("/detect-anomaly")
async def detect_anomaly(request: Request, body: AnomalyRequest):
    anomaly_bundle = request.app.state.models.get("anomaly")
    if not anomaly_bundle:
        raise HTTPException(status_code=503, detail="Anomaly model not loaded")
    from services.anomaly_service import detect_anomalies
    return detect_anomalies(anomaly_bundle, body.location_id, body.data_points)
```

**File:** `backend_python/routers/graph.py`
```python
from fastapi import APIRouter, HTTPException

router = APIRouter()

@router.get("/graph/heatmap")
async def get_heatmap():
    from services.graph_service import get_heatmap_data
    return await get_heatmap_data()

@router.get("/graph/zone-summary/{zone_id}")
async def get_zone_summary(zone_id: str):
    from db.tigergraph_client import get_zone_data
    data = await get_zone_data(zone_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Zone {zone_id} not found")
    return data
```

### Step 4.2 — Replace main.py

Backup the existing main.py:
```bash
cp backend_python/main.py backend_python/main_original.py
```

Copy the new `main.py` from Section 2.1 exactly.

### Step 4.3 — First full startup test

```bash
cd backend_python
python main.py
```

Watch console output. All 4 "✅ loaded" messages must appear before "Server ready."

Then in another terminal:
```bash
curl http://localhost:8000/health
```

Expected:
```json
{"status": "healthy", "models_loaded": ["lstm", "cv", "nlp", "anomaly"]}
```

---

## PHASE 5 — Endpoint Integration Tests (Day 3)
**Estimated time: 3 hours**

### Step 5.1 — Test B1 LSTM endpoint

```bash
curl -X POST http://localhost:8000/api/v1/predict-danger \
  -H "Content-Type: application/json" \
  -d '{
    "location_id": "zone_42",
    "historical_features": [[0,0,2,0.4,0.6,0.3],[1,0,1,0.3,0.6,0.2],[2,0,1,0.2,0.7,0.1],[3,0,0,0.1,0.7,0.0],[4,0,0,0.1,0.8,0.0],[5,0,0,0.2,0.8,0.1],[6,0,1,0.3,0.9,0.2],[7,0,2,0.5,1.0,0.3],[8,0,2,0.6,1.0,0.4],[9,0,1,0.7,1.0,0.4],[10,0,1,0.8,1.0,0.3],[11,0,1,0.9,1.0,0.3],[12,0,1,0.8,1.0,0.3],[13,0,1,0.7,1.0,0.3],[14,0,2,0.7,0.9,0.4],[15,0,2,0.8,0.8,0.5],[16,0,3,0.9,0.7,0.6],[17,0,4,0.9,0.6,0.8],[18,0,5,0.8,0.5,0.9],[19,0,4,0.7,0.4,0.8],[20,0,3,0.7,0.4,0.7],[21,0,3,0.6,0.3,0.6],[22,0,2,0.5,0.3,0.5],[23,0,2,0.4,0.3,0.4]]
  }'
```

Expected: JSON with predictions array of 24 floats. No 500 error.

### Step 5.2 — Test B4 NLP endpoint

```bash
curl -X POST http://localhost:8000/api/v1/analyze-report \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I was followed by a man near the bus stop on main road at 10pm. I felt very unsafe.",
    "location_id": "zone_42",
    "lat": 30.7333,
    "lng": 76.7794
  }'
```

Expected: JSON with severity, emotion, auto_response fields.

### Step 5.3 — Test B2 CV endpoint

```bash
# Download a test image first
curl -o /tmp/test_crowd.jpg "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Above_Gotham.jpg/640px-Above_Gotham.jpg"

curl -X POST http://localhost:8000/api/v1/analyze-cctv \
  -F "camera_id=cam_001" \
  -F "location_id=zone_42" \
  -F "file=@/tmp/test_crowd.jpg"
```

Expected: JSON with person_count, crowd_density fields.

### Step 5.4 — Test Aggregated Danger Score

```bash
curl "http://localhost:8000/api/v1/danger-score?lat=30.7333&lng=76.7794"
```

Expected: JSON with danger_score, danger_level, component_scores.

### Step 5.5 — Test Heatmap

```bash
curl http://localhost:8000/api/v1/graph/heatmap
```

Expected: Array of zone objects with lat, lng, danger_score.

### Step 5.6 — Open FastAPI Docs

Navigate to `http://localhost:8000/docs` in browser.
All endpoints should be visible and testable via Swagger UI.

---

## PHASE 6 — Frontend Connection (Day 3-4)
**Estimated time: 3 hours**

### Step 6.1 — Create `.env` in frontend

```bash
# frontend/.env
VITE_API_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000/api/v1/ws/alerts
```

### Step 6.2 — Create `api.js`

Copy the full `api.js` from Section 6.1.

### Step 6.3 — Create `useWebSocket.js`

Copy from Section 6.2.

### Step 6.4 — Integrate heatmap into MapLibre

Copy `SafetyHeatmap.jsx` from Section 6.3.
Import and add to the main Map component.

### Step 6.5 — Wire up Report Form

In `IncidentReportForm.jsx`:
```jsx
import { submitReport } from '../../services/api';

// In handleSubmit:
const result = await submitReport({
  text: formData.text,
  location_id: selectedZoneId,
  lat: selectedLat,
  lng: selectedLng
});
setAutoResponse(result.auto_response);
setSeverityBadge(result.severity);
```

### Step 6.6 — Add WebSocket alert listener

In your main App component or layout:
```jsx
import { useWebSocket } from './hooks/useWebSocket';
import { useAlertStore } from './store/safetyStore';

const addAlert = useAlertStore(state => state.addAlert);

useWebSocket((message) => {
  if (message.type === 'NEW_ALERT') {
    addAlert(message.data);
    // Also trigger heatmap refresh
    refetchHeatmap();
  }
});
```

### Step 6.7 — Frontend smoke test

```bash
cd frontend
npm run dev
```

Open browser at `http://localhost:5173`. Verify:
- [ ] Map loads with heatmap overlay
- [ ] Clicking a zone shows danger score
- [ ] Report form submits and shows auto-response
- [ ] No CORS errors in browser console

---

## PHASE 7 — TigerGraph Integration (Day 4, if available)
**Estimated time: 2 hours**

### Step 7.1 — Install and start TigerGraph

If using TigerGraph Cloud or local:
```bash
# Set USE_MOCK_DB=false in .env
# Set TIGERGRAPH_HOST, credentials
```

### Step 7.2 — Create graph schema

In TigerGraph Studio GSQL:
```sql
CREATE VERTEX Zone (PRIMARY_ID zone_id STRING, name STRING, lat DOUBLE, lng DOUBLE,
  danger_score DOUBLE, historical_avg_danger DOUBLE, incident_count_24h INT, last_updated DATETIME)
  WITH primary_id_as_attribute="true"

CREATE VERTEX Incident (PRIMARY_ID incident_id STRING, text STRING, severity STRING,
  severity_score DOUBLE, credibility DOUBLE, emotion STRING, timestamp DATETIME, source STRING)
  WITH primary_id_as_attribute="true"

CREATE VERTEX Camera (PRIMARY_ID camera_id STRING, lat DOUBLE, lng DOUBLE,
  last_crowd_density STRING, last_person_count INT, last_analyzed DATETIME)
  WITH primary_id_as_attribute="true"

CREATE DIRECTED EDGE OCCURRED_AT (FROM Incident, TO Zone, timestamp DATETIME)
CREATE DIRECTED EDGE CONNECTS_TO (FROM Zone, TO Zone, distance_m DOUBLE, avg_danger DOUBLE)
CREATE DIRECTED EDGE MONITORED_BY (FROM Zone, TO Camera, active BOOL)

CREATE GRAPH SafeCity (Zone, Incident, Camera, OCCURRED_AT, CONNECTS_TO, MONITORED_BY)
```

### Step 7.3 — Switch from mock to TigerGraph

```bash
# .env
USE_MOCK_DB=false
```

Restart server. Verify TigerGraph connection in startup logs.

### Step 7.4 — Test TigerGraph write path

Submit a report via `POST /analyze-report`.
In TigerGraph Studio, verify Incident vertex was created.

---

# 8. PERFORMANCE & DEPLOYMENT

## 8.1 Model Loading Strategy

**Problem:** Keras and PyTorch models are large and slow to load.
**Solution:** Load ONCE at startup (already done in `lifespan` context manager).
**Benefit:** All requests share the same in-memory model — no repeated disk reads.

**Memory estimate:**
| Model | Approximate RAM |
|---|---|
| LSTM (INT007.keras) | ~50–200 MB |
| MobileNetV2 (.pth) | ~14 MB |
| YOLOv8n | ~6 MB |
| NLP transformers (if any) | ~400–800 MB |
| **Total** | **~500 MB – 1.2 GB** |

Ensure development machine has **at least 4 GB RAM** available.

## 8.2 Latency Management

| Endpoint | Expected Latency | Caching Strategy |
|---|---|---|
| `/predict-danger` | 500ms–2s (LSTM + MC) | Cache 1 hour by zone+hour |
| `/danger-score` | 200ms–800ms (aggregation) | Cache 5 min by coordinates |
| `/analyze-report` | 300ms–1s (NLP) | No cache (each report unique) |
| `/analyze-cctv` | 200ms–500ms (CV) | No cache (each frame unique) |
| `/graph/heatmap` | 50ms–200ms (TigerGraph/mock) | Cache 5 min |
| `/safe-route` | 100ms–400ms | Cache 2 min by start+end |

## 8.3 Handling CV Blocking (GPU Thread)

If CV inference blocks the event loop:
```python
# In cv_service.py, wrap CPU-heavy inference
import asyncio

async def analyze_frame_async(cv_bundle, image_bytes, camera_id, location_id=None):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,   # uses default thread pool
        analyze_frame,
        cv_bundle, image_bytes, camera_id, location_id
    )
```

Update `routers/cctv.py` to call `analyze_frame_async` instead.

## 8.4 Demo Deployment Checklist

For hackathon demo, run everything locally:

```bash
# Terminal 1: Backend
cd backend_python && python main.py

# Terminal 2: Frontend
cd frontend && npm run dev

# Optional Terminal 3: TigerGraph (if using local)
# (TigerGraph start command depends on installation)
```

**Pre-demo checklist:**
- [ ] All 4 models loaded (check `/health` endpoint)
- [ ] Frontend connects to backend (no CORS errors)
- [ ] WebSocket connected (check browser DevTools Network > WS)
- [ ] Heatmap visible on map
- [ ] Submit one test report — verify auto-response appears
- [ ] Test safe route request — verify colored route appears

---

# 9. HACKATHON DEMO FLOW

## 9.1 Primary Demo Script (5 minutes)

### Scene 1: Real-Time Map Dashboard (1 min)
```
SHOW: Map with color-coded heatmap overlay
SAY: "Our platform provides a live city-wide safety map powered by AI"
ACTION: Pan map over city — heatmap shows red zones (high danger) and green zones (safe)
DATA SOURCE: GET /graph/heatmap → danger_scores from TigerGraph (or mock)
```

### Scene 2: Incident Report → NLP → Map Update (2 min)
```
SHOW: Report form on side panel
SAY: "A citizen reports a safety concern"
TYPE: "There were suspicious men following women near sector 7 bus stop at 11pm. Very frightening."
CLICK: Submit

BACKEND HAPPENS:
  POST /analyze-report
  → B4 NLP: sentiment=negative, severity=high, emotion=fear, credibility=0.84
  → TigerGraph: Incident vertex created
  → danger_aggregator: zone danger score updates from 0.4 → 0.72
  → WebSocket: alert broadcast to all clients

SHOW: Map updates — sector 7 zone turns orange/red
SHOW: Alerts panel — NEW ALERT appears in real-time
SHOW: Report acknowledgment — auto_response shown to user:
  "Your report has been flagged as high priority. Authorities are being alerted."
SAY: "In real-time, our NLP engine analyzed the report and updated the city danger map"
```

### Scene 3: Safe Route Request (1 min)
```
SHOW: User clicks on map to set start and end points
SAY: "The user now wants to navigate safely home"
ACTION: Click "Get Safe Route" button

BACKEND HAPPENS:
  GET /safe-route
  → route_service: fetches danger scores for all path nodes
  → B1 LSTM: current-hour predictions for each intersection
  → Returns route avoiding sector 7 (now danger_level=unsafe)

SHOW: Route displayed on map — green segments (safe) with red avoided zone
SHOW: Route summary: "Overall safety score: 0.82 — Moderate"
SAY: "The system automatically re-routed to avoid the newly flagged danger zone"
```

### Scene 4: CCTV Analysis (1 min)
```
SHOW: CCTV panel — camera feed or uploaded image
SAY: "Our system can also analyze live camera feeds"
ACTION: Upload/use sample crowd image
CLICK: "Analyze"

BACKEND HAPPENS:
  POST /analyze-cctv
  → B2 CV: YOLOv8 detects 23 persons, MobileNetV2 → density=high
  → danger_contribution=0.76

SHOW: Overlay on map — crowd density bubble appears on camera zone
SHOW: Widget: "Person count: 23 | Density: HIGH | Danger contribution: 76%"
SAY: "Real-time crowd analysis updates the danger map without any human input"
```

## 9.2 Backup Demo (if live API fails)

Pre-record all API responses as JSON fixtures. Serve from static files.
```javascript
// frontend/src/services/api.js — add mock mode
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

export const getDangerScore = (lat, lng) =>
  DEMO_MODE
    ? Promise.resolve(MOCK_DANGER_SCORE)
    : apiFetch(`/danger-score?lat=${lat}&lng=${lng}`);
```

---

# 10. FILE CHECKLISTS & VERIFICATION GATES

## 10.1 File Creation Checklist

### backend_python/

- [ ] `main.py` — new version
- [ ] `config.py`
- [ ] `dependencies.py`
- [ ] `requirements.txt`
- [ ] `.env`

### ai loaders

- [ ] `ai/__init__.py`
- [ ] `ai/lstm/__init__.py`
- [ ] `ai/lstm/loader.py`
- [ ] `ai/cv/__init__.py`
- [ ] `ai/cv/loader.py`
- [ ] `ai/nlp/__init__.py`
- [ ] `ai/nlp/loader.py`
- [ ] `ai/anomaly/__init__.py`
- [ ] `ai/anomaly/loader.py`

### services

- [ ] `services/__init__.py`
- [ ] `services/lstm_service.py`
- [ ] `services/cv_service.py`
- [ ] `services/nlp_service.py`
- [ ] `services/anomaly_service.py`
- [ ] `services/danger_aggregator.py`
- [ ] `services/graph_service.py`
- [ ] `services/route_service.py`

### routers

- [ ] `routers/__init__.py`
- [ ] `routers/danger.py`
- [ ] `routers/cctv.py`
- [ ] `routers/reports.py`
- [ ] `routers/anomaly.py`
- [ ] `routers/routing.py`
- [ ] `routers/graph.py`
- [ ] `routers/websocket.py`

### models (Pydantic)

- [ ] `models/__init__.py`
- [ ] `models/danger_models.py`
- [ ] `models/report_models.py`
- [ ] `models/cctv_models.py`
- [ ] `models/route_models.py`

### db

- [ ] `db/__init__.py`
- [ ] `db/tigergraph_client.py`
- [ ] `db/mock_db.py`

### utils

- [ ] `utils/__init__.py`
- [ ] `utils/cache.py`
- [ ] `utils/scoring.py`
- [ ] `utils/geo_utils.py`

### frontend

- [ ] `src/services/api.js`
- [ ] `src/hooks/useWebSocket.js`
- [ ] `src/components/Map/SafetyHeatmap.jsx`

## 10.2 Integration Verification Gates

Run these in order. Do NOT proceed to the next phase until the current gate passes.

```
GATE 0: pip install -r requirements.txt → no errors
GATE 1: python -c "from ai.lstm.loader import load_lstm_model; load_lstm_model()" → no exceptions
GATE 2: python -c "from ai.cv.loader import load_cv_models; load_cv_models()" → no exceptions
GATE 3: python -c "from ai.nlp.loader import load_nlp_pipeline; load_nlp_pipeline()" → no exceptions
GATE 4: python main.py → all 4 "✅ loaded" messages appear
GATE 5: curl /health → {"status":"healthy","models_loaded":["lstm","cv","nlp","anomaly"]}
GATE 6: curl POST /predict-danger → predictions array returned
GATE 7: curl POST /analyze-report → severity field in response
GATE 8: curl POST /analyze-cctv → person_count in response
GATE 9: curl GET /danger-score → danger_level in response
GATE 10: Frontend npm run dev → map visible, no console errors
GATE 11: Submit report from frontend → auto_response visible in UI
GATE 12: Request safe route → colored route overlay on map
```

---

## ⚠️ CRITICAL NOTES FOR AI-ASSISTED EXECUTION

1. **Function Name Verification:** At Step 0.4, the actual function names in `ai/*/inference.py` files MUST be verified. All service files assume certain function names (`predict`, `analyze_sentiment`, etc.). If they differ, update the service files — do NOT rename the original inference files.

2. **LSTM Output Shape:** The LSTM model may output a different shape than assumed (e.g., single value vs. 24-step forecast). Inspect `model.output_shape` after loading and adjust `lstm_service.py` accordingly.

3. **MC Dropout Activation:** The `model(X, training=True)` pattern assumes the LSTM was trained with Dropout layers. If not, `training=True` has no effect — this is fine, just means no uncertainty quantification.

4. **TigerGraph Mock First:** Always run with `USE_MOCK_DB=true` first. Only switch to real TigerGraph after all endpoints pass their verification gates.

5. **WebSocket in Demo:** WebSocket connections require the server to remain running. Do not use `reload=True` in uvicorn during demo — hot-reload disconnects WebSocket clients.

6. **workers=1 is Non-Negotiable:** Multiple workers = multiple model copies in memory = likely OOM crash on most development machines.

---

*End of Integration Blueprint — Version 1.0*
*Total estimated execution time: 4–5 days for complete integration, 2 days for demo-ready state*
