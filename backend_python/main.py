"""
backend_python/main.py
========================
FastAPI application entry point for the Smart City AI Services.

Router map (all prefixed with /api/v1):
  /api/v1/danger/score     → danger.py     (AI-powered POST, LSTM+CV+anomaly aggregation)
  /api/v1/danger-score     → danger_score.py (Simple GET, mock/TG-backed)
  /api/v1/reports          → reports.py    (GET list, POST submit, POST /analyze NLP)
  /api/v1/cctv             → cctv.py       (POST /analyze, POST /analyze-b64)
  /api/v1/anomaly          → anomaly.py    (POST /detect)
  /api/v1/safe-route       → safe_route.py (GET /)
  /api/v1/intersections    → intersections.py (GET /)
  /api/v1/incidents        → incidents.py  (GET /)
  /api/v1/cluster-info     → cluster_info.py (GET /)
  /api/v1/graph            → graph.py      (GET /heatmap, GET /intersections, GET /status)
"""

import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# AI Data Loaders (Single-load singletons)
from ai.lstm.loader import get_lstm_bundle
from ai.cv.loader import get_cv_bundle
from ai.nlp.loader import get_nlp_bundle
from ai.anomaly.loader import get_anomaly_bundle

# ── Routers ────────────────────────────────────────────────────────────────────
# AI-powered routers (use app.state.models)
from routers import danger, cctv, anomaly, reports

# Data / graph routers (use mock_data or TigerGraph directly)
from routers import safe_route, intersections, danger_score, incidents, cluster_info, graph

# Setup basic logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifecycle manager for the FastAPI app.
    Loads all AI models sequentially ONCE on startup.
    """
    logger.info("🚀 Starting up Smart City AI Services...")

    app.state.models = {}

    logger.info("Loading LSTM...")
    app.state.models["lstm"] = get_lstm_bundle()
    logger.info("✅ LSTM loaded.")

    logger.info("Loading CV...")
    app.state.models["cv"] = get_cv_bundle()
    logger.info("✅ CV loaded.")

    logger.info("Loading NLP...")
    app.state.models["nlp"] = get_nlp_bundle()
    logger.info("✅ NLP loaded.")

    logger.info("Loading Anomaly...")
    app.state.models["anomaly"] = get_anomaly_bundle()
    logger.info("✅ Anomaly loaded.")

    logger.info("🎉 All AI models loaded and ready.")

    yield  # Application runs here

    logger.info("Shutting down Smart City AI Services...")
    app.state.models.clear()


app = FastAPI(
    title="Smart City AI Services",
    description=(
        "AI-powered women's safety platform. "
        "Endpoints: LSTM danger scoring, CV crowd analysis, NLP report analysis, "
        "safe routing, and TigerGraph heatmap."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite React dev port
        "http://localhost:3000",   # CRA / Next.js dev port
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register all routers under /api/v1 ────────────────────────────────────────
#
# Each router already has its own sub-prefix defined in the router file.
# Registering ALL with prefix="/api/v1" ensures consistent URL structure.
#
# Result:
#   danger.router        → /api/v1/danger/score
#   danger_score.router  → /api/v1/danger-score
#   reports.router       → /api/v1/reports, /api/v1/reports/analyze
#   cctv.router          → /api/v1/cctv/analyze, /api/v1/cctv/analyze-b64
#   anomaly.router       → /api/v1/anomaly/detect
#   safe_route.router    → /api/v1/safe-route
#   intersections.router → /api/v1/intersections
#   incidents.router     → /api/v1/incidents
#   cluster_info.router  → /api/v1/cluster-info
#   graph.router         → /api/v1/graph/heatmap, /api/v1/graph/intersections

app.include_router(danger.router,       prefix="/api/v1")
app.include_router(danger_score.router, prefix="/api/v1")
app.include_router(reports.router,      prefix="/api/v1")
app.include_router(cctv.router,         prefix="/api/v1")
app.include_router(anomaly.router,      prefix="/api/v1")
app.include_router(safe_route.router,   prefix="/api/v1")
app.include_router(intersections.router, prefix="/api/v1")
app.include_router(incidents.router,    prefix="/api/v1")
app.include_router(cluster_info.router, prefix="/api/v1")
app.include_router(graph.router,        prefix="/api/v1")


@app.get("/health", tags=["System"])
async def health_check():
    """Simple health check endpoint."""
    models_loaded = list(getattr(app.state, "models", {}).keys())
    return {
        "status": "ok",
        "models_loaded": models_loaded,
        "api_prefix": "/api/v1",
    }


@app.get("/", tags=["System"])
async def root():
    """Root redirect — informs clients where the API lives."""
    return {
        "message": "Smart City AI Services",
        "docs": "/docs",
        "api_base": "/api/v1",
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
