"""FastAPI ETA Prediction Microservice for EcoTransit.

Provides high-performance, real-time travel time estimation comparing
Naive (velocity & historical average) vs Machine Learning (Linear Regression Ridge) strategies.
"""

from __future__ import annotations

import csv
import logging
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

# Load environment configuration from root .env
load_dotenv()

# Setup module path
SERVICE_DIR = Path(__file__).resolve().parent
if str(SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICE_DIR))

from inference import (  # noqa: E402
    LinearRegressionETACalculator,
    NaiveETACalculator,
    SegmentContext,
)
from schemas import (  # noqa: E402
    ETAPredictionRequest,
    ETAPredictionResponse,
    HealthResponse,
    SegmentPrediction,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] (%(name)s) %(message)s",
)
logger = logging.getLogger("ETAMicroservice")

# Environment / Secrets
HOST = os.getenv("ETA_SERVICE_HOST", "0.0.0.0")
PORT = int(os.getenv("PORT_INTELLIGENCE_SERVICE", os.getenv("ETA_SERVICE_PORT", "8002")))
ENV = os.getenv("STATUS", "development")
IST_OFFSET = timedelta(hours=5, minutes=30)
IST_TZ = timezone(IST_OFFSET)

# Initialize FastAPI App
app = FastAPI(
    title="EcoTransit ETA Intelligence Microservice",
    version="2.1.0",
    description="Microservice serving baseline naive and linear regression ML transit ETAs.",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Enable CORS for cross-origin frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Calculators
naive_calculator = NaiveETACalculator()
ml_calculator = LinearRegressionETACalculator()

# Cache static route segments if road_segments.csv exists
_route_segments_cache: dict[str, list[dict[str, Any]]] = {}


def get_current_ist_time() -> tuple[datetime, int, str]:

    """Returns (current_dt_ist, hour_of_day, day_type)."""
    now_ist = datetime.now(IST_TZ)
    hour = now_ist.hour
    day_type = "weekend" if now_ist.weekday() >= 5 else "weekday"
    return now_ist, hour, day_type


def load_cached_route_segments(route_id: str) -> list[SegmentContext]:
    """Finds segments for route_id from road_segments.csv if available."""
    global _route_segments_cache
    if not _route_segments_cache:
        artifacts_dir = Path(os.getenv("ETA_ARTIFACTS_DIR", str(SERVICE_DIR / "artifacts")))
        csv_candidates = [
            artifacts_dir / "road_segments.csv",
            artifacts_dir / "static_route_segments.csv",
        ]
        for csv_path in csv_candidates:
            if csv_path.exists():
                try:
                    with open(csv_path, encoding="utf-8") as f:
                        reader = csv.DictReader(f)
                        for row in reader:
                            rid = str(row.get("route_id", "")).strip()
                            if rid:
                                if rid not in _route_segments_cache:
                                    _route_segments_cache[rid] = []
                                _route_segments_cache[rid].append(row)
                    logger.info("Loaded segments cache for %d routes from %s", len(_route_segments_cache), csv_path.name)
                    break
                except Exception as e:
                    logger.warning("Error reading %s: %s", csv_path, e)

    rows = _route_segments_cache.get(route_id, [])
    segments = []
    for r in rows:
        try:
            segments.append(
                SegmentContext(
                    segment_id=int(r.get("segment_id", 0)),
                    from_stop_id=str(r.get("from_stop_id", "")),
                    to_stop_id=str(r.get("to_stop_id", "")),
                    distance_meters=float(r.get("distance_meters", 500.0)),
                    sequence=int(r.get("sequence", 0)),
                )
            )
        except (ValueError, TypeError):
            continue
    return segments


@app.get("/", tags=["General"])
def root() -> dict[str, Any]:
    return {
        "service": "ecotransit_intelligence_microservice",
        "version": "2.1.0",
        "status": "online",
        "documentation": "/docs",
        "health": "/health",
        "predict_endpoint": "/api/v1/predict-eta",
    }


@app.get("/health", response_model=HealthResponse, tags=["General"])
def health() -> HealthResponse:
    now_ist, _, _ = get_current_ist_time()
    return HealthResponse(
        status="healthy" if ml_calculator.is_loaded else "degraded",
        service="ecotransit_intelligence_microservice",
        model_loaded=ml_calculator.is_loaded,
        learned_segments_count=len(ml_calculator.known_segments),
        environment=ENV,
        timestamp_ist=now_ist.isoformat(),
    )


@app.post("/api/v1/predict-eta", response_model=ETAPredictionResponse, tags=["Inference"])
def predict_eta(payload: ETAPredictionRequest) -> ETAPredictionResponse:
    """Computes and compares journey ETA using Naive Baseline and Linear Regression ML."""
    now_ist, default_hour, default_day = get_current_ist_time()
    hour = payload.hour_of_day if payload.hour_of_day is not None else default_hour
    day = payload.day_type if payload.day_type is not None else default_day

    # Resolve segment contexts
    segment_contexts: list[SegmentContext] = []
    if payload.remaining_segments:
        for s in payload.remaining_segments:
            segment_contexts.append(
                SegmentContext(
                    segment_id=s.segment_id,
                    from_stop_id=s.from_stop_id,
                    to_stop_id=s.to_stop_id,
                    distance_meters=s.distance_meters,
                    sequence=s.sequence,
                )
            )
    else:
        # Fallback to segments from route cache
        cached = load_cached_route_segments(payload.route_id)
        if cached:
            segment_contexts = cached[:10]  # Take first 10 segments as representative ahead window
        else:
            # Synthetic default segment if route geometry unknown
            segment_contexts = [
                SegmentContext(
                    segment_id=f"{payload.route_id}_DEF1",
                    from_stop_id="START",
                    to_stop_id=payload.target_stop_id or "END",
                    distance_meters=1500.0,
                    sequence=0,
                )
            ]

    total_dist = sum(s.distance_meters for s in segment_contexts)

    # 1. Compute Naive baseline
    naive_res = naive_calculator.calculate_eta(
        route_id=payload.route_id,
        remaining_segments=segment_contexts,
        hour_of_day=hour,
        day_type=day,
        current_speed_mps=payload.current_speed_mps,
    )

    # 2. Compute Machine Learning prediction
    ml_res = ml_calculator.calculate_eta(
        route_id=payload.route_id,
        remaining_segments=segment_contexts,
        hour_of_day=hour,
        day_type=day,
        current_speed_mps=payload.current_speed_mps,
    )

    # Build per-segment breakdown
    segment_breakdown: list[SegmentPrediction] = []
    n_preds = naive_res.per_segment_eta
    m_preds = ml_res.per_segment_eta
    for i, seg in enumerate(segment_contexts):
        n_val = n_preds[i] if i < len(n_preds) else 30.0
        m_val = m_preds[i] if i < len(m_preds) else 30.0
        segment_breakdown.append(
            SegmentPrediction(
                segment_id=str(seg.segment_id),
                distance_meters=round(seg.distance_meters, 2),
                naive_eta_seconds=n_val,
                ml_eta_seconds=m_val,
            )
        )

    # Determine preferred ETA and delta
    preferred_eta = ml_res.total_eta_seconds if ml_calculator.is_loaded else naive_res.total_eta_seconds
    delta = round(ml_res.total_eta_seconds - naive_res.total_eta_seconds, 2)
    confidence = ml_res.confidence_score if ml_calculator.is_loaded else naive_res.confidence_score

    return ETAPredictionResponse(
        status="success",
        bus_id=payload.bus_id,
        route_id=payload.route_id,
        target_stop_id=payload.target_stop_id,
        total_distance_meters=round(total_dist, 2),
        naive_eta_seconds=naive_res.total_eta_seconds,
        ml_eta_seconds=ml_res.total_eta_seconds,
        delta_seconds=delta,
        preferred_eta_seconds=preferred_eta,
        confidence_score=confidence,
        segments=segment_breakdown,
        computed_at_ist=now_ist.isoformat(),
    )


@app.get("/api/v1/models/metadata", tags=["Model Information"])
def get_model_metadata() -> dict[str, Any]:
    """Returns training parameters, equation coefficients, and evaluation metrics."""
    if not ml_calculator.metadata:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model metadata.json not found.",
        )
    return ml_calculator.metadata


@app.get("/api/v1/segments", tags=["Model Information"])
def list_segments(
    route_id: str | None = Query(default=None, description="Optional route filter"),
    limit: int = Query(default=50, ge=1, le=500, description="Max segments to return"),
) -> dict[str, Any]:
    """Returns sample of known road segments from canonical road_segments.csv."""
    artifacts_dir = Path(os.getenv("ETA_ARTIFACTS_DIR", str(SERVICE_DIR / "artifacts")))
    csv_file = artifacts_dir / "road_segments.csv"
    if not csv_file.exists():
        csv_file = artifacts_dir / "static_route_segments.csv"

    if not csv_file.exists():
        raise HTTPException(status_code=404, detail="road_segments.csv not found in artifacts.")

    results: list[dict[str, Any]] = []
    with open(csv_file, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if route_id and row.get("route_id") != route_id:
                continue
            results.append(row)
            if len(results) >= limit:
                break

    return {
        "count": len(results),
        "source": csv_file.name,
        "segments": results,
    }


if __name__ == "__main__":
    import uvicorn
    logger.info("Starting EcoTransit ETA Intelligence Microservice on http://%s:%d", HOST, PORT)
    uvicorn.run("server:app", host=HOST, port=PORT, reload=(ENV == "development"))
