"""FanOutSink composite persisting positions concurrently across child sinks."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Sequence
from typing import Any

from ecotransit_shared.contracts.ingestion import ISink
from ecotransit_shared.schemas import HealthStatus, SinkError, SinkResult, VehiclePosition

logger = logging.getLogger("ingestion.sink.fan_out")


class FanOutSink(ISink):
    """Composite sink that concurrently writes batches to all registered child sinks.

    Critical child failures propagate and fail the batch.
    Non-critical child failures are logged and recorded without aborting the batch.
    """

    def __init__(self, children: Sequence[ISink]) -> None:
        self._children = tuple(children)

    @property
    def is_critical(self) -> bool:
        return any(child.is_critical for child in self._children)

    @property
    def children(self) -> tuple[ISink, ...]:
        return self._children

    async def write(self, batch: list[VehiclePosition]) -> SinkResult:
        if not batch:
            return SinkResult(written_count=0)

        tasks = [child.write(batch) for child in self._children]
        outcomes = await asyncio.gather(*tasks, return_exceptions=True)

        total_errors: list[SinkError] = []
        max_written = 0

        for child, outcome in zip(self._children, outcomes, strict=False):
            if isinstance(outcome, Exception):
                logger.error(
                    "Child sink %s encountered exception: %s",
                    child.__class__.__name__,
                    outcome,
                )
                if child.is_critical:
                    # Critical sink failure propagates immediately
                    raise outcome
                total_errors.append(
                    SinkError(error=f"{child.__class__.__name__}: {outcome}")
                )
            elif isinstance(outcome, SinkResult):
                max_written = max(max_written, outcome.written_count)
                if outcome.errors:
                    total_errors.extend(outcome.errors)

        return SinkResult(written_count=max_written, errors=total_errors)

    async def health(self) -> HealthStatus:
        tasks = [child.health() for child in self._children]
        outcomes = await asyncio.gather(*tasks, return_exceptions=True)

        details: dict[str, Any] = {}
        critical_unhealthy = False
        non_critical_unhealthy = False

        for child, outcome in zip(self._children, outcomes, strict=False):
            c_name = child.__class__.__name__
            if isinstance(outcome, Exception):
                details[c_name] = {"status": "error", "error": str(outcome)}
                if child.is_critical:
                    critical_unhealthy = True
                else:
                    non_critical_unhealthy = True
            elif isinstance(outcome, HealthStatus):
                details[c_name] = outcome.model_dump()
                if outcome.status == "unhealthy":
                    if child.is_critical:
                        critical_unhealthy = True
                    else:
                        non_critical_unhealthy = True

        if critical_unhealthy:
            status = "unhealthy"
        elif non_critical_unhealthy:
            status = "degraded"
        else:
            status = "healthy"

        return HealthStatus(status=status, details=details)
