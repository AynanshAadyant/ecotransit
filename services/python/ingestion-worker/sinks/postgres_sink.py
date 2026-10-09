"""PostgreSQL historical archive sink using the IPostgresArchiveStore abstraction layer."""

from __future__ import annotations

import logging

from adapters.postgres_store import IPostgresArchiveStore

from ecotransit_shared.contracts.ingestion import ISink
from ecotransit_shared.schemas import HealthStatus, SinkError, SinkResult, VehiclePosition

logger = logging.getLogger("ingestion.sink.postgres")


class PostgresArchiveSink(ISink):
    """Non-critical durable archive sink writing telemetry to vehicle_position_archive.

    Uses IPostgresArchiveStore abstraction. Non-critical failures are recorded and logged
    without interrupting the live tracking pipeline.
    """

    def __init__(self, store: IPostgresArchiveStore) -> None:
        self._store = store

    @property
    def is_critical(self) -> bool:
        # Non-critical: transient DB failures do not break real-time commuter tracking
        return False

    async def write(self, batch: list[VehiclePosition]) -> SinkResult:
        if not batch:
            return SinkResult(written_count=0)

        try:
            count = await self._store.archive_positions(batch)
            return SinkResult(written_count=count)
        except Exception as exc:
            logger.error("Failed to archive %d positions to PostgreSQL: %s", len(batch), exc)
            return SinkResult(
                written_count=0,
                errors=[SinkError(error=str(exc))],
            )

    async def health(self) -> HealthStatus:
        alive = await self._store.ping()
        return HealthStatus(
            status="healthy" if alive else "unhealthy",
            details={"sink": "PostgresArchiveSink"},
        )
