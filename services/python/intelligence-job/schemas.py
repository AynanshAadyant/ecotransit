"""Pydantic V2 schemas for the Intelligence Job ETA Serving Microservice."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class SegmentInput(BaseModel):
    """Input definition for a single route segment."""
    segment_id: int | str = Field(description="Canonical segment ID or numerical index")
    from_stop_id: str = Field(default="", description="Origin stop cluster ID")
    to_stop_id: str = Field(default="", description="Destination stop cluster ID")
    distance_meters: float = Field(default=500.0, ge=0.0, description="Segment distance in meters")
    sequence: int = Field(default=0, description="Sequential order in remaining route")


class ETAPredictionRequest(BaseModel):
    """Payload for requesting journey ETA predictions."""
    bus_id: str | None = Field(default=None, description="Optional vehicle ID (e.g., DL1PC9999)")
    route_id: str = Field(description="GTFS Route ID (e.g., '142')")
    target_stop_id: str | None = Field(default=None, description="Commuter destination stop cluster ID")
    remaining_segments: list[SegmentInput] = Field(default_factory=list, description="Ordered ahead segments")
    hour_of_day: int | None = Field(default=None, ge=0, le=23, description="Hour of day in IST (0-23)")
    day_type: Literal["weekday", "weekend"] | None = Field(default=None, description="Day type")
    current_speed_mps: float | None = Field(default=None, ge=0.0, description="Live telemetry speed in m/s")
    calculator_type: Literal["all", "ml", "naive"] = Field(
        default="all",
        description="Calculation strategy to compute ('all' executes both for comparison)"
    )


class SegmentPrediction(BaseModel):
    """Segment-level prediction breakdown comparing algorithms."""
    segment_id: str
    distance_meters: float
    naive_eta_seconds: float
    ml_eta_seconds: float


class ETAPredictionResponse(BaseModel):
    """Standardized ETA prediction response envelope."""
    status: Literal["success", "error"] = "success"
    bus_id: str | None = None
    route_id: str
    target_stop_id: str | None = None
    total_distance_meters: float
    naive_eta_seconds: float
    ml_eta_seconds: float
    delta_seconds: float
    preferred_eta_seconds: float
    confidence_score: float
    segments: list[SegmentPrediction] = Field(default_factory=list)
    computed_at_ist: str


class HealthResponse(BaseModel):
    """Health status and model readiness report."""
    status: Literal["healthy", "degraded", "unhealthy"]
    service: str = "ecotransit_intelligence_microservice"
    model_loaded: bool
    learned_segments_count: int
    environment: str
    timestamp_ist: str
