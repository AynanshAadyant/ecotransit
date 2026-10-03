"""Service-specific PostgreSQL Archive Store Abstraction.

Encapsulates durable position persistence into vehicle_position_archive
while coordinating with the shared asyncpg pool from ecotransit_shared.db.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any

from ecotransit_shared.schemas import VehiclePosition

logger = logging.getLogger("ingestion.adapter.postgres")


class IPostgresArchiveStore(ABC):
    """Abstract Port for persisting vehicle positions to the historical archive."""

    @abstractmethod
    async def archive_positions(self, positions: list[VehiclePosition]) -> int:
        """Executes high-throughput batch insertion into vehicle_position_archive."""
        ...

    @abstractmethod
    async def ping(self) -> bool:
        """Performs a liveness check against PostgreSQL."""
        ...

    @abstractmethod
    async def close(self) -> None:
        """Closes the underlying database connection pool."""
        ...


class PostgresArchiveStore(IPostgresArchiveStore):
    """Concrete Adapter implementing IPostgresArchiveStore via the shared asyncpg pool driver."""

    _INSERT_SQL = """
        INSERT INTO vehicle_position_archive (
            vehicle_id,
            route_id,
            trip_id,
            latitude,
            longitude,
            bearing,
            speed,
            is_speed_suspect,
            gtfs_timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    """

    def __init__(self, pool: Any) -> None:
        self._pool = pool

    async def archive_positions(self, positions: list[VehiclePosition]) -> int:
        if not positions:
            return 0

        records = [
            (
                p.vehicle_id,
                p.route_id,
                p.trip_id,
                p.latitude,
                p.longitude,
                p.bearing,
                p.speed,
                p.is_speed_suspect,
                p.timestamp,
            )
            for p in positions
        ]

        async with self._pool.acquire() as conn:
            await conn.executemany(self._INSERT_SQL, records)

        return len(records)

    async def ping(self) -> bool:
        try:
            async with self._pool.acquire() as conn:
                res = await conn.fetchval("SELECT 1")
                return res == 1
        except Exception as exc:
            logger.error("PostgresArchiveStore ping check failed: %s", exc)
            return False

    async def close(self) -> None:
        try:
            await self._pool.close()
        except Exception as exc:
            logger.warning("Error closing PostgresArchiveStore pool: %s", exc)
