"""
SmartCity Safety API — FastAPI/Uvicorn Backend
================================================
Endpoints:
  GET  /health                 — server health + data source status
  GET  /intersections          — all intersection coordinates (Mapbox dots layer)
  GET  /danger-score           — comfort/safety score for an intersection
  GET  /safe-route             — ordered route waypoints + coordinates + reasoning
  GET  /incidents              — incident heatmap data
  POST /report                 — submit a new incident report
  GET  /report/all             — dev-only: view in-memory reports
  GET  /cluster-info           — cluster analysis & interventions

Data source is controlled by the DATA_SOURCE env var:
  DATA_SOURCE=mock        → uses rich mock data (default, no TigerGraph needed)
  DATA_SOURCE=tigergraph  → calls real TigerGraph REST++ API (requires .env creds)
"""
import os
import sys

# Make sure the backend_python directory is on PYTHONPATH
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from routers import danger_score, safe_route, incidents, report, cluster_info, intersections

app = FastAPI(
    title="SmartCity Safety API",
    description="Real-time urban safety scoring, incident reporting, and safe routing.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS — allow frontend dev server ─────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite default
        "http://localhost:3000",   # CRA / Next.js
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────
app.include_router(intersections.router,  prefix="/intersections",  tags=["Geo-Architect"])
app.include_router(danger_score.router,   prefix="/danger-score",   tags=["Comfort Dashboard"])
app.include_router(safe_route.router,     prefix="/safe-route",     tags=["Route Painter"])
app.include_router(incidents.router,      prefix="/incidents",       tags=["Heatmap"])
app.include_router(report.router,         prefix="/report",          tags=["Incident Reporting"])
app.include_router(cluster_info.router,   prefix="/cluster-info",   tags=["Sector Analysis"])


# ── Health check ──────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health():
    from datetime import datetime, timezone
    return {
        "status": "ok",
        "dataSource": os.getenv("DATA_SOURCE", "mock"),
        "time": datetime.now(timezone.utc).isoformat(),
        "version": "2.0.0",
    }


# ── Root ──────────────────────────────────────────────────────────
@app.get("/", tags=["System"])
async def root():
    return {
        "service": "SmartCity Safety API",
        "docs": "/docs",
        "health": "/health",
    }
