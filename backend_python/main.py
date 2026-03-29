"""
backend_python/main.py
========================
FastAPI application entry point for the Smart City AI Services.
Implements single-load model lifecycle using the lifespan manager.
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

# Routers
from routers import danger, cctv, anomaly, reports

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
    logger.info("Starting up Smart City AI Services...")
    
    # Store loaded bundles directly on the app state for router access
    app.state.models = {}

    logger.info("Loading LSTM...")
    app.state.models["lstm"] = get_lstm_bundle()
    logger.info("LSTM loaded.")

    logger.info("Loading CV...")
    app.state.models["cv"] = get_cv_bundle()
    logger.info("CV loaded.")

    logger.info("Loading NLP...")
    app.state.models["nlp"] = get_nlp_bundle()
    logger.info("NLP loaded.")

    logger.info("Loading Anomaly...")
    app.state.models["anomaly"] = get_anomaly_bundle()
    logger.info("Anomaly loaded.")

    logger.info("All AI models loaded and ready.")

    yield  # Application runs here

    # Shutdown
    logger.info("Shutting down Smart City AI Services...")
    app.state.models.clear()


app = FastAPI(
    title="Smart City AI Services Integration",
    description="Backend services for LSTM, CV, NLP, and Anomaly Detection",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Typical Vite React dev port
        "http://localhost:3000"   # Typical Create React App dev port
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["System"])
async def health_check():
    """Simple health check endpoint."""
    return {
        "status": "ok",
        "models": ["lstm", "cv", "nlp", "anomaly"]
    }


# Register all component routers
app.include_router(danger.router)
app.include_router(cctv.router)
app.include_router(anomaly.router)
app.include_router(reports.router)


if __name__ == "__main__":
    # Run development server locally
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
