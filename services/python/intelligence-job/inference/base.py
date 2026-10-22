"""Base interface and data contracts for ETA inference calculators.

Designed to be lightweight, clean, and avoid unnecessary abstractions.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from pydantic import BaseModel, Field


class SegmentContext(BaseModel):
    """Context for an individual route segment traversal."""
    segment_id: int | str
    from_stop_id: str = ""
    to_stop_id: str = ""
    distance_meters: float = Field(default=500.0, ge=0.0)
    sequence: int = 0


class CalculationResult(BaseModel):
    """Result returned by an ETA calculation strategy."""
    total_eta_seconds: float
    per_segment_eta: list[float]
    confidence_score: float = 1.0
    strategy_name: str


class BaseETACalculator(ABC):
    """Abstract Strategy interface for calculating journey ETA."""

    @abstractmethod
    def calculate_eta(
        self,
        route_id: str,
        remaining_segments: list[SegmentContext],
        hour_of_day: int,
        day_type: str,
        current_speed_mps: float | None = None,
    ) -> CalculationResult:
        """Computes remaining journey time in seconds."""
        pass
