"""
app.py — B4 NLP FastAPI Service
================================
Smart City Women's Safety System — TigerGraph Hackathon

Endpoints:
    POST /analyze-report   — analyse a single incident report (primary)
    POST /batch-analyze    — analyse up to 50 reports in one call
    GET  /health           — liveness + model-status check
    GET  /duplicate-store  — inspect / clear the in-memory duplicate store
    DELETE /duplicate-store — reset the duplicate detection store

Run locally:
    uvicorn app:app --host 0.0.0.0 --port 8000 --reload

Docker / production:
    uvicorn app:app --host 0.0.0.0 --port 8000 --workers 2
"""

from __future__ import annotations

import logging
import os
import time
from typing import Optional

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

import inference  # ← the entire NLP pipeline lives here

# ── Logging ──────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(levelname)s │ %(message)s")
log = logging.getLogger("b4_api")

# ═══════════════════════════════════════════════════════════════════
# APP SETUP
# ═══════════════════════════════════════════════════════════════════

app = FastAPI(
    title="B4 NLP — Incident Report Intelligence",
    description=(
        "Smart City Women's Safety System — TigerGraph Hackathon\n\n"
        "Performs sentiment, emotion, emergency, severity, credibility, "
        "NER, duplicate detection, and auto-response on incident reports."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Allow cross-origin requests (adjust origins in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request-timing middleware ─────────────────────────────────────
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = round((time.perf_counter() - start) * 1000, 1)
    response.headers["X-Process-Time-Ms"] = str(elapsed)
    return response


# ── Global exception handler — never let the service crash ───────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.error(f"Unhandled error on {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "Internal server error", "detail": str(exc)},
    )


# ═══════════════════════════════════════════════════════════════════
# PYDANTIC MODELS
# ═══════════════════════════════════════════════════════════════════

class ReportRequest(BaseModel):
    """
    Single incident report submitted by a user.
    
    Fields:
        text       : the raw report description (required)
        report_id  : optional caller-assigned ID (echoed in response)
        location   : optional location string   (echoed in response)
    """
    text: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="Raw incident report text from the user.",
        examples=["Someone is following me in a dark street near sector 21."],
    )
    report_id: Optional[str] = Field(
        default=None,
        description="Optional caller-supplied report identifier.",
        examples=["RPT_20240315_001"],
    )
    location: Optional[str] = Field(
        default=None,
        description="Optional structured location from the client.",
        examples=["Sector 21, Chandigarh"],
    )

    @field_validator("text")
    @classmethod
    def text_must_not_be_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("text must not be blank.")
        return v.strip()


class BatchReportRequest(BaseModel):
    """
    A list of reports to be analysed in one API call.
    Capped at 50 to prevent memory / latency issues.
    """
    reports: list[ReportRequest] = Field(
        ...,
        min_length=1,
        max_length=50,
        description="List of report objects (max 50).",
    )


class AnalysisResponse(BaseModel):
    """
    Full NLP analysis result returned to the caller.
    All fields are directly consumable by TigerGraph ingestion layer.
    """
    # Echo caller metadata
    report_id: Optional[str]
    location:  Optional[str]

    # Sentiment
    sentiment:       str
    sentiment_score: float
    distress_level:  str

    # Emotion
    emotion:              str
    emotion_confidence:   float
    emotion_all_scores:   dict

    # Emergency
    emergency_level:   str
    is_emergency:      bool
    matched_keywords:  list[str]

    # Severity
    severity: float

    # Credibility
    credibility_score: int
    credibility_label: str
    credibility_flags: list[str]

    # NER
    entities: dict

    # Duplicate
    duplicate_score:        float
    is_duplicate:           bool
    duplicate_matched_index: Optional[int]

    # Response & actions
    auto_response:       str
    recommended_actions: list[str]

    # Meta
    word_count:    int
    processing_ms: float


# ═══════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

# ── POST /analyze-report ─────────────────────────────────────────
@app.post(
    "/analyze-report",
    response_model=AnalysisResponse,
    summary="Analyse a single incident report",
    response_description="Full NLP analysis result",
    status_code=status.HTTP_200_OK,
    tags=["Core"],
)
async def analyze_report_endpoint(req: ReportRequest):
    """
    Primary endpoint called by the `/report` API before storing
    an incident in TigerGraph.

    - Runs all 8 NLP analysis stages on the submitted text.
    - Returns structured JSON ready for graph ingestion.
    - Latency target: < 400 ms on CPU.

    **Example request:**
    ```json
    {
      "text": "Someone is following me in a dark street near sector 21.",
      "report_id": "RPT_001",
      "location": "Sector 21, Chandigarh"
    }
    ```
    """
    log.info(f"POST /analyze-report | id={req.report_id} | chars={len(req.text)}")

    try:
        result = inference.analyze_report(req.text)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    except Exception as exc:
        log.error(f"Inference error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference failed: {exc}",
        )

    log.info(
        f"Result | level={result['emergency_level']} | "
        f"severity={result['severity']} | "
        f"cred={result['credibility_score']} | "
        f"ms={result['processing_ms']}"
    )

    return AnalysisResponse(
        report_id=req.report_id,
        location=req.location,
        **result,
    )


# ── POST /batch-analyze ──────────────────────────────────────────
@app.post(
    "/batch-analyze",
    summary="Analyse multiple reports in one call (max 50)",
    status_code=status.HTTP_200_OK,
    tags=["Core"],
)
async def batch_analyze_endpoint(req: BatchReportRequest):
    """
    Analyse up to 50 reports in a single request.

    Each report is processed sequentially (same pipeline as
    `/analyze-report`). The duplicate detection store grows
    within the batch, so duplicates across reports are caught.

    Returns a list of analysis results in the same order as
    the input, plus a summary object.
    """
    log.info(f"POST /batch-analyze | count={len(req.reports)}")
    t_start = time.perf_counter()

    results: list[dict] = []
    errors:  list[dict] = []

    for i, report in enumerate(req.reports):
        try:
            analysis = inference.analyze_report(report.text)
            analysis["report_id"] = report.report_id
            analysis["location"]  = report.location
            results.append(analysis)
        except Exception as exc:
            errors.append({
                "index":     i,
                "report_id": report.report_id,
                "error":     str(exc),
            })

    total_ms = round((time.perf_counter() - t_start) * 1000, 1)

    summary = {
        "total":       len(req.reports),
        "succeeded":   len(results),
        "failed":      len(errors),
        "total_ms":    total_ms,
        "avg_ms":      round(total_ms / max(len(results), 1), 1),
        "critical_count": sum(1 for r in results if r.get("emergency_level") == "CRITICAL"),
        "high_count":     sum(1 for r in results if r.get("emergency_level") == "HIGH"),
    }

    return {"summary": summary, "results": results, "errors": errors}


# ── GET /health ───────────────────────────────────────────────────
@app.get(
    "/health",
    summary="Liveness & model-status check",
    status_code=status.HTTP_200_OK,
    tags=["Meta"],
)
async def health():
    """
    Returns 200 + model-status dict if all models are loaded.
    Used by load-balancers and k8s liveness probes.
    """
    # LLM mode: HuggingFace / spaCy models replaced by LLM API.
    # NVIDIA_API_KEY presence determines live vs mock mode.
    nvidia_key_set = bool(os.environ.get("NVIDIA_API_KEY", "").strip())
    model_status = {
        "llm_mode":             True,
        "llm_provider":         "NVIDIA NIM" if nvidia_key_set else "mock (no key)",
        "nvidia_key_configured": nvidia_key_set,
        "duplicate_store_size": len(inference._DUP_STORE),
    }

    return {
        "status":   "ok",
        "models":   model_status,
        "version":  "1.0.0",
        "module":   "B4-NLP",
    }


def _check_model(pipe) -> bool:
    """Run a trivial inference to confirm the model is responsive."""
    try:
        pipe("test")
        return True
    except Exception:
        return False


# ── GET /duplicate-store ─────────────────────────────────────────
@app.get(
    "/duplicate-store",
    summary="Inspect in-memory duplicate detection store",
    status_code=status.HTTP_200_OK,
    tags=["Meta"],
)
async def get_duplicate_store():
    """
    Returns the current size and a preview of texts in the
    TF-IDF duplicate store (in-memory, resets on restart).
    """
    store = inference._DUP_STORE
    return {
        "size":    len(store),
        "preview": [t[:80] + "…" if len(t) > 80 else t for t in store[-10:]],
    }


# ── DELETE /duplicate-store ───────────────────────────────────────
@app.delete(
    "/duplicate-store",
    summary="Clear the duplicate detection store",
    status_code=status.HTTP_200_OK,
    tags=["Meta"],
)
async def clear_duplicate_store():
    """
    Empties the in-memory duplicate detection store.
    Call this at the start of a new batch or test run.
    """
    prev_size = len(inference._DUP_STORE)
    inference._DUP_STORE.clear()
    log.info(f"Duplicate store cleared ({prev_size} entries removed)")
    return {"cleared": True, "entries_removed": prev_size}


# ── GET / ─────────────────────────────────────────────────────────
@app.get("/", include_in_schema=False)
async def root():
    return {
        "service":     "B4 NLP — Incident Report Intelligence",
        "docs":        "/docs",
        "health":      "/health",
        "version":     "1.0.0",
    }


# ═══════════════════════════════════════════════════════════════════
# DEV ENTRYPOINT
# ═══════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
