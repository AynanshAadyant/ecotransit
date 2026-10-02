"""Pydantic v2 schemas crossing module boundaries in EcoTransit."""

from __future__ import annotations

import time
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class RawPayload(BaseModel):
    """Raw, unparsed position payload yielded from ISource."""

    model_config = ConfigDict(extra="ignore")

    source: str
    timestamp: float = Field(default_factory=time.time)
    payload: Any
    metadata: dict[str, Any] = Field(default_factory=dict)


class VehiclePosition(BaseModel):
    """Canonical normalized position record."""

    model_config = ConfigDict(extra="ignore")

    vehicle_id: str
    route_id: str
    trip_id: str | None = None
    latitude: float
    longitude: float
    bearing: float | None = None
    speed: float | None = None  # in m/s
    timestamp: int  # epoch seconds GPS timestamp
    nearest_stop_sequence: int | None = None
    is_speed_suspect: bool = False
    raw: Any = None


class TraversalSample(BaseModel):
    """A single segment traversal observation extracted from successive pings."""

    model_config = ConfigDict(extra="ignore")

    vehicle_id: str
    segment_id: int
    entry_timestamp: int
    exit_timestamp: int
    traversal_seconds: float
    hour_of_day: int
    day_type: Literal["weekday", "saturday", "sunday"]


class MatrixCell(BaseModel):
    """Discrete cell of route_segment_traversal_matrix before resolution."""

    model_config = ConfigDict(extra="ignore")

    segment_id: int
    hour_of_day: int
    day_type: Literal["weekday", "saturday", "sunday"]
    sample_count: int = 0
    naive_avg_seconds: float | None = None
    ml_predicted_seconds: float | None = None
    variance_score: float = 0.0


class ResolvedCell(BaseModel):
    """Discrete cell resolved by IFallbackPolicy, ready for materialisation."""

    model_config = ConfigDict(extra="ignore")

    segment_id: int
    hour_of_day: int
    day_type: Literal["weekday", "saturday", "sunday"]
    sample_count: int
    naive_avg_seconds: float | None
    ml_predicted_seconds: float | None
    variance_score: float
    effective_seconds: float
    tier: Literal["ml", "naive", "fallback"]


class SinkError(BaseModel):
    vehicle_id: str | None = None
    error: str


class SinkResult(BaseModel):
    written_count: int
    errors: list[SinkError] = Field(default_factory=list)


class RuleOutcome(BaseModel):
    passed: bool
    code: str
    reason: str | None = None


class ValidationContext(BaseModel):
    previous_position: VehiclePosition | None = None
    received_at: float = Field(default_factory=time.time)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ValidationResult(BaseModel):
    valid: bool
    failed_rule: str | None = None
    failure_reason: str | None = None


class HealthStatus(BaseModel):
    status: Literal["healthy", "degraded", "unhealthy"]
    details: dict[str, Any] = Field(default_factory=dict)


class FitReport(BaseModel):
    model_name: str
    train_mae: float
    train_rmse: float
    val_mae: float | None = None
    val_rmse: float | None = None
    feature_importances: dict[str, float] = Field(default_factory=dict)
