"""Redis hot cache position sink using the IRedisLiveStore abstraction layer."""

from __future__ import annotations

import logging

from adapters.redis_store import IRedisLiveStore

from ecotransit_shared.contracts.ingestion import ISink
from ecotransit_shared.schemas import HealthStatus, SinkResult, VehiclePosition

logger = logging.getLogger("ingestion.sink.redis")


class RedisPositionSink(ISink):
    """Critical sink writing live vehicle telemetry to Redis.

    Uses IRedisLiveStore abstraction to keep domain code decoupled from driver specifics.
    """

    def __init__(self, store: IRedisLiveStore, ttl_seconds: int = 45) -> None:
        self._store = store
        self.ttl_seconds = ttl_seconds

    @property
    def is_critical(self) -> bool:
        # A commuter seeing a stale map is unacceptable; write failures abort batch
        return True

    async def write(self, batch: list[VehiclePosition]) -> SinkResult:
        if not batch:
            return SinkResult(written_count=0)

        try:
            count = await self._store.save_live_positions(batch, ttl_seconds=self.ttl_seconds)
            return SinkResult(written_count=count)
        except Exception as exc:
            logger.error("Failed to write %d positions to Redis: %s", len(batch), exc)
            # Propagate exception because is_critical is True
            raise

    async def health(self) -> HealthStatus:
        alive = await self._store.ping()
        return HealthStatus(
            status="healthy" if alive else "unhealthy",
            details={"sink": "RedisPositionSink", "ttl_seconds": self.ttl_seconds},
        )
