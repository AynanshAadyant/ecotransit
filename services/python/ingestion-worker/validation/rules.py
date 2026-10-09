"""Validation rules verifying domain invariants for vehicle position samples."""

from __future__ import annotations

import logging
from collections import OrderedDict

from ecotransit_shared.contracts.ingestion import IValidationRule
from ecotransit_shared.geo import is_in_bounding_box, is_valid_coordinate
from ecotransit_shared.schemas import RuleOutcome, ValidationContext, VehiclePosition

logger = logging.getLogger("ingestion.validation.rules")


class CoordinateBoundsRule(IValidationRule):
    """Enforces geographic bounding box and rejects coordinate glitches like (0, 0)."""

    def __init__(
        self,
        min_lat: float = 28.30,
        max_lat: float = 28.95,
        min_lon: float = 76.80,
        max_lon: float = 77.55,
    ) -> None:
        self.min_lat = min_lat
        self.max_lat = max_lat
        self.min_lon = min_lon
        self.max_lon = max_lon

    @property
    def code(self) -> str:
        return "ERR_GEO_OUT_OF_BOUNDS"

    def check(self, position: VehiclePosition, context: ValidationContext) -> RuleOutcome:
        _ = context
        if not is_valid_coordinate(position.latitude, position.longitude):
            return RuleOutcome(
                passed=False,
                code=self.code,
                reason=f"Coordinate ({position.latitude}, {position.longitude}) is mathematically invalid or GPS glitch",
            )

        if not is_in_bounding_box(
            position.latitude,
            position.longitude,
            min_lat=self.min_lat,
            max_lat=self.max_lat,
            min_lon=self.min_lon,
            max_lon=self.max_lon,
        ):
            return RuleOutcome(
                passed=False,
                code=self.code,
                reason=(
                    f"Coordinate ({position.latitude:.4f}, {position.longitude:.4f}) "
                    f"outside bounds [{self.min_lat}, {self.max_lat}, {self.min_lon}, {self.max_lon}]"
                ),
            )

        return RuleOutcome(passed=True, code=self.code)


class SpeedPlausibilityRule(IValidationRule):
    """Rejects positions indicating physically implausible vehicle speeds."""

    def __init__(self, max_kmh: float = 80.0) -> None:
        self.max_kmh = max_kmh
        self.max_mps = max_kmh / 3.6

    @property
    def code(self) -> str:
        return "ERR_SPEED_IMPLAUSIBLE"

    def check(self, position: VehiclePosition, context: ValidationContext) -> RuleOutcome:
        _ = context
        if position.speed is not None and position.speed > self.max_mps:
            speed_kmh = position.speed * 3.6
            return RuleOutcome(
                passed=False,
                code=self.code,
                reason=f"Speed {speed_kmh:.1f} km/h exceeds maximum threshold {self.max_kmh:.1f} km/h",
            )

        return RuleOutcome(passed=True, code=self.code)


class TimestampFreshnessRule(IValidationRule):
    """Enforces timestamp freshness against received wall-clock time."""

    def __init__(self, max_age_s: int = 120, max_future_drift_s: int = 60) -> None:
        self.max_age_s = max_age_s
        self.max_future_drift_s = max_future_drift_s

    @property
    def code(self) -> str:
        return "ERR_TIMESTAMP_STALE"

    def check(self, position: VehiclePosition, context: ValidationContext) -> RuleOutcome:
        age_seconds = context.received_at - position.timestamp
        if age_seconds > self.max_age_s:
            return RuleOutcome(
                passed=False,
                code=self.code,
                reason=f"Timestamp {position.timestamp} is stale ({age_seconds:.1f}s old, max {self.max_age_s}s)",
            )

        if age_seconds < -self.max_future_drift_s:
            return RuleOutcome(
                passed=False,
                code=self.code,
                reason=f"Timestamp {position.timestamp} is in the future ({-age_seconds:.1f}s drift)",
            )

        return RuleOutcome(passed=True, code=self.code)


class DuplicatePingRule(IValidationRule):
    """Rejects duplicate positions where (vehicle_id, timestamp) matches a previous observation."""

    def __init__(self, max_cache_size: int = 50000) -> None:
        self.max_cache_size = max_cache_size
        self._seen: OrderedDict[str, int] = OrderedDict()

    @property
    def code(self) -> str:
        return "ERR_DUPLICATE_PING"

    def check(self, position: VehiclePosition, context: ValidationContext) -> RuleOutcome:
        _ = context
        vid = position.vehicle_id
        if vid in self._seen:
            last_ts = self._seen[vid]
            if last_ts == position.timestamp:
                return RuleOutcome(
                    passed=False,
                    code=self.code,
                    reason=f"Duplicate ping for vehicle {vid} at timestamp {position.timestamp}",
                )

        # Store/update timestamp with LRU eviction
        self._seen[vid] = position.timestamp
        self._seen.move_to_end(vid)
        if len(self._seen) > self.max_cache_size:
            self._seen.popitem(last=False)

        return RuleOutcome(passed=True, code=self.code)

    def clear(self) -> None:
        self._seen.clear()
