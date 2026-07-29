"""
backend_python/main.py
========================
FastAPI application entry point for the Smart City AI Services.
"""

import logging
import time
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from ai.lstm.loader import get_lstm_bundle
from ai.cv.loader import get_cv_bundle
from ai.nlp.loader import get_nlp_bundle
from ai.anomaly.loader import get_anomaly_bundle
from routers import danger, cctv, anomaly, reports, export
from routers import safe_route, intersections, danger_score, incidents, cluster_info, graph
from routers import auth, citizen, supervisor, officer, dev
from routers import portal_routes

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)


async def _load_models_task(app: FastAPI):
    logger.info("?? Background loading of Smart City AI Services initialized...")
    try:
        logger.info("Loading LSTM...")
        app.state.models["lstm"] = get_lstm_bundle()
        logger.info("? LSTM loaded.")

        logger.info("Loading CV...")
        app.state.models["cv"] = get_cv_bundle()
        logger.info("? CV loaded.")

        logger.info("Loading NLP...")
        app.state.models["nlp"] = get_nlp_bundle()
        logger.info("? NLP loaded.")

        logger.info("Loading Anomaly...")
        app.state.models["anomaly"] = get_anomaly_bundle()
        logger.info("? Anomaly loaded.")

        logger.info("?? All AI models loaded and ready in background.")
    except Exception as e:
        logger.error(f"? Error during background model loading: {e}", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    app.state.models = {}

    from config import USE_MOCK_DB
    if not USE_MOCK_DB:
        from custom_db import get_client
        try:
            client = get_client()
            if hasattr(client, "connect"):
                result = client.connect()
                if asyncio.iscoroutine(result):
                    await result
        except Exception as e:
            logger.warning(f"Failed to connect to database: {e}")

    task = asyncio.create_task(_load_models_task(app))

    yield

    from services.portal_service import _osrm_client
    await _osrm_client.aclose()
    task.cancel()
    app.state.models.clear()


app = FastAPI(
    title="Smart City AI Services",
    description=(
        "AI-powered women's safety platform. "
        "Endpoints: LSTM danger scoring, CV crowd analysis, NLP report analysis, "
        "safe routing, graph heatmap, RBAC auth, and portal admin views."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    started = time.perf_counter()
    logger.info("HTTP %s %s", request.method, request.url.path)
    response = await call_next(request)
    elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
    logger.info("HTTP %s %s -> %s (%sms)", request.method, request.url.path, response.status_code, elapsed_ms)
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error for %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

app.include_router(danger.router, prefix="/api/v1")
app.include_router(danger_score.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(export.router, prefix="/api/v1")
app.include_router(cctv.router, prefix="/api/v1")
app.include_router(anomaly.router, prefix="/api/v1")
app.include_router(safe_route.router, prefix="/api/v1")
app.include_router(intersections.router, prefix="/api/v1")
app.include_router(incidents.router, prefix="/api/v1")
app.include_router(cluster_info.router, prefix="/api/v1")
app.include_router(graph.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(citizen.router, prefix="/api/v1")
app.include_router(supervisor.router, prefix="/api/v1")
app.include_router(officer.router, prefix="/api/v1")
app.include_router(dev.router, prefix="/api/v1")
app.include_router(portal_routes.router, prefix="/api/v1")

from custom_db import get_client


@app.get("/health", tags=["System"])
async def health_check():
    from config import USE_MOCK_DB
    models_loaded = list(getattr(app.state, "models", {}).keys())
    client = get_client()
    return {
        "status": "ok",
        "db_connected": getattr(client, "connected", False),
        "using_mock_db": USE_MOCK_DB,
        "models_loaded": models_loaded,
        "api_prefix": "/api/v1",
    }


@app.get("/", tags=["System"])
async def root():
    return {"message": "Smart City AI Services", "docs": "/docs", "api_base": "/api/v1"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
