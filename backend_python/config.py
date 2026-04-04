"""
backend_python/config.py
========================
Central configuration for the SmartCity Safety Platform.

All environment variables, file paths, and feature flags are
defined here. Nothing else should call os.getenv() directly —
import from this module instead.
"""

import os
from pathlib import Path

# ── Root paths ───────────────────────────────────────────────────────────────

# backend_python/ directory (where this file lives)
BACKEND_ROOT: Path = Path(__file__).parent.resolve()

# Project root (one level above backend_python/)
PROJECT_ROOT: Path = BACKEND_ROOT.parent.resolve()

# Top-level ai/ directory (read-only source AI modules + model files)
AI_ROOT: Path = PROJECT_ROOT / "ai"


# ── AI Model Paths ────────────────────────────────────────────────────────────

LSTM_MODEL_PATH: Path = AI_ROOT / "lstm" / "lstm_INT007.keras"
LSTM_SCALER_PATH: Path = AI_ROOT / "lstm" / "scaler_INT007.pkl"

CV_MOBILENET_PATH: Path = AI_ROOT / "cv" / "mobilenetv2_crowd.pth"
# YOLOv8n — ultralytics auto-downloads this if not present at the given name
CV_YOLO_PATH: Path = AI_ROOT / "cv" / "yolov8n.pt"
CV_YOLO_MODEL_NAME: str = os.getenv("YOLO_MODEL_NAME", "yolov8n.pt")

NLP_MODULE_PATH: Path = AI_ROOT / "nlp"
# NLP entrypoint (main inference file)
NLP_ENTRYPOINT: Path = NLP_MODULE_PATH / "inference.py"

ANOMALY_MODULE_PATH: Path = AI_ROOT / "anomaly"

LSTM_MODEL_EXISTS: bool = LSTM_MODEL_PATH.exists()
CV_MODEL_EXISTS: bool = CV_MOBILENET_PATH.exists()
# ── TigerGraph Connection ─────────────────────────────────────────────────────

# Core connection requirements (strictly no username/password)
TIGERGRAPH_HOST: str = os.getenv("TG_HOST", "https://tg-955b4acb-5d72-46eb-a8f4-420628df0978.tg-3452941248.i.tgcloud.io")
TIGERGRAPH_GRAPH: str = os.getenv("TG_GRAPHNAME", "UrbanSafetyGraph")
TIGERGRAPH_TOKEN: str = os.getenv("TG_TOKEN", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwYWxha21pdHRhbC5idDI1Y3NlZHNAcGVjLmVkdS5pbiIsImlhdCI6MTc3NTExMzA3NiwiZXhwIjoxNzgyODg5MDgxLCJpc3MiOiJUaWdlckdyYXBoIn0.qDivaGPN9N9nRCwDnepSqgXNyjF76yo1ABmLMngEHXg")

USE_MOCK_DB: bool = False


# ── Cache TTLs (seconds) ──────────────────────────────────────────────────────

DANGER_SCORE_CACHE_TTL: int = int(os.getenv("DANGER_SCORE_CACHE_TTL", "300"))    # 5 min
LSTM_PREDICTION_CACHE_TTL: int = int(os.getenv("LSTM_CACHE_TTL", "3600"))        # 1 h
HEATMAP_CACHE_TTL: int = int(os.getenv("HEATMAP_CACHE_TTL", "300"))              # 5 min
ROUTE_CACHE_TTL: int = int(os.getenv("ROUTE_CACHE_TTL", "120"))                  # 2 min


# ── Feature Flags ─────────────────────────────────────────────────────────────

ENABLE_CV_INFERENCE: bool = os.getenv("ENABLE_CV", "true").lower() == "true"
ENABLE_NLP_INFERENCE: bool = os.getenv("ENABLE_NLP", "true").lower() == "true"
ENABLE_LSTM_INFERENCE: bool = os.getenv("ENABLE_LSTM", "true").lower() == "true"
ENABLE_ANOMALY_INFERENCE: bool = os.getenv("ENABLE_ANOMALY", "true").lower() == "true"


# ── Server Settings ───────────────────────────────────────────────────────────

SERVER_HOST: str = os.getenv("HOST", "0.0.0.0")
SERVER_PORT: int = int(os.getenv("PORT", "8000"))
LOG_LEVEL: str = os.getenv("LOG_LEVEL", "info")


# ── CORS Origins ──────────────────────────────────────────────────────────────

CORS_ORIGINS: list[str] = [
    "http://localhost:5173",   # Vite default
    "http://localhost:3000",   # CRA / Next.js
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]


# ── Model Inference Settings ──────────────────────────────────────────────────

# MC Dropout samples for LSTM uncertainty estimation
LSTM_MC_SAMPLES: int = int(os.getenv("LSTM_MC_SAMPLES", "20"))

# Number of past time-steps the LSTM expects as input
LSTM_SEQUENCE_LENGTH: int = int(os.getenv("LSTM_SEQUENCE_LENGTH", "24"))

# Number of crowd density classes ModelNetV2 was trained for
CV_NUM_DENSITY_CLASSES: int = 3   # low / medium / high

# YOLO confidence threshold above which a non-person detection triggers anomaly
CV_ANOMALY_THRESHOLD: float = float(os.getenv("CV_ANOMALY_THRESHOLD", "0.7"))

# Z-score threshold for statistical anomaly fallback
ANOMALY_ZSCORE_THRESHOLD: float = float(os.getenv("ANOMALY_ZSCORE", "2.5"))


# ── Danger Aggregation Weights ────────────────────────────────────────────────
# Must sum to 1.0 — enforced at import time below.

DANGER_WEIGHTS: dict[str, float] = {
    "lstm":    float(os.getenv("W_LSTM", "0.45")),
    "cv":      float(os.getenv("W_CV", "0.30")),
    "anomaly": float(os.getenv("W_ANOMALY", "0.15")),
    "graph":   float(os.getenv("W_GRAPH", "0.10")),
}

_total_weight = sum(DANGER_WEIGHTS.values())
if abs(_total_weight - 1.0) > 1e-6:
    raise ValueError(
        f"DANGER_WEIGHTS must sum to 1.0 but sum to {_total_weight:.4f}. "
        "Adjust W_LSTM / W_CV / W_ANOMALY / W_GRAPH environment variables."
    )
import logging

logging.basicConfig(
    level=LOG_LEVEL.upper(),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)

logger = logging.getLogger("smartcity")
