"""
app.py
------
FastAPI service for the Women's Safety Smart City — B2 CCTV Crowd Analyzer.

Run locally:
    uvicorn app:app --host 0.0.0.0 --port 8000 --reload

Run in production:
    uvicorn app:app --host 0.0.0.0 --port 8000 --workers 2
"""

import logging
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from inference import CrowdAnalysisPipeline

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ── Allowed upload MIME types ─────────────────────────────────────────────────
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/bmp",
    "image/webp",
    "image/tiff",
}
MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB


# ── App lifecycle: load models once at startup ────────────────────────────────
pipeline: CrowdAnalysisPipeline | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global pipeline
    logger.info("Loading ML models …")
    pipeline = CrowdAnalysisPipeline()
    logger.info("Models loaded. Service ready.")
    yield
    logger.info("Shutting down.")


# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Women's Safety Smart City — B2 Crowd Analyzer",
    description=(
        "Real-time CCTV crowd density estimation and anomaly detection "
        "using YOLOv8n + MobileNetV2. Part of the TigerGraph Hackathon pipeline."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # tighten for production
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Response schemas (for OpenAPI docs) ──────────────────────────────────────

class AnomalyItem(BaseModel):
    type:     str = Field(example="RUNNING")
    severity: str = Field(example="MEDIUM")
    message:  str = Field(example="Running detected (speed=52px/frame)")

class DetectionItem(BaseModel):
    bbox:   list[int] = Field(example=[120, 80, 200, 310])
    conf:   float     = Field(example=0.87)
    center: list[int] = Field(example=[160, 195])
    area:   int       = Field(example=14400)

class PredictionExtra(BaseModel):
    person_count:     int              = Field(example=12)
    crowd_density:    str              = Field(example="HIGH")
    anomaly_detected: bool             = Field(example=True)
    anomalies:        list[AnomalyItem]
    detections:       list[DetectionItem]
    safety_score:     int              = Field(example=30)
    inference_ms:     float            = Field(example=42.1)

class PredictionResponse(BaseModel):
    prediction: str          = Field(example="HIGH")
    confidence: float        = Field(example=0.87)
    extra:      PredictionExtra


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": "B2 Crowd Analyzer"}


@app.get("/health", tags=["Health"])
async def health():
    return {
        "status":  "healthy",
        "model_loaded": pipeline is not None,
    }


@app.post(
    "/predict",
    response_model=PredictionResponse,
    status_code=status.HTTP_200_OK,
    tags=["Inference"],
    summary="Analyse a single CCTV frame",
    response_description="Crowd density, person count, anomalies, and safety score",
)
async def predict(
    file: Annotated[
        UploadFile,
        File(description="CCTV frame — JPEG / PNG / BMP / WEBP, max 20 MB"),
    ]
):
    """
    Upload a CCTV image frame and receive:

    - **prediction** – dominant density label (EMPTY / LOW / MEDIUM / HIGH)
    - **confidence** – classifier confidence [0, 1]
    - **extra.person_count** – number of people detected
    - **extra.anomaly_detected** – whether any anomaly was flagged
    - **extra.anomalies** – list of anomaly events with type, severity, message
    - **extra.detections** – per-person bounding boxes and confidence scores
    - **extra.safety_score** – 0-100 safety index (100 = perfectly safe)
    - **extra.inference_ms** – total inference time in milliseconds
    """
    if pipeline is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Models are not yet loaded. Try again in a few seconds.",
        )

    # ── Validate MIME type ────────────────────────────────────────────────────
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{content_type}'. "
                   f"Accepted: {sorted(ALLOWED_CONTENT_TYPES)}",
        )

    # ── Read & size-check ────────────────────────────────────────────────────
    image_bytes = await file.read()
    if len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large ({len(image_bytes)//1024} KB). Max 20 MB.",
        )
    if len(image_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file received.",
        )

    # ── Run inference ────────────────────────────────────────────────────────
    try:
        result = pipeline.predict(image_bytes)
    except Exception as exc:
        logger.exception("Inference error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference failed: {str(exc)}",
        ) from exc

    logger.info(
        f"[/predict] density={result['prediction']} "
        f"persons={result['extra']['person_count']} "
        f"anomaly={result['extra']['anomaly_detected']} "
        f"safety={result['extra']['safety_score']} "
        f"ms={result['extra']['inference_ms']}"
    )

    return JSONResponse(content=result)


@app.post(
    "/predict/batch",
    tags=["Inference"],
    summary="Analyse multiple frames (up to 10)",
)
async def predict_batch(
    files: Annotated[
        list[UploadFile],
        File(description="Up to 10 CCTV frames"),
    ]
):
    """
    Batch endpoint — useful for processing a short clip frame-by-frame
    while preserving the AnomalyDetector's state across frames.
    """
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Models not loaded.")

    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Max 10 frames per batch.")

    # Reset anomaly state so batch is treated as a single continuous sequence
    pipeline.reset()
    results = []
    for i, file in enumerate(files):
        content_type = (file.content_type or "").lower()
        if content_type not in ALLOWED_CONTENT_TYPES:
            results.append({"frame": i, "error": f"Unsupported type: {content_type}"})
            continue
        image_bytes = await file.read()
        try:
            results.append({"frame": i, **pipeline.predict(image_bytes)})
        except Exception as exc:
            results.append({"frame": i, "error": str(exc)})

    return {"batch_size": len(files), "results": results}
