"""Service-specific Redis Live Position Store Abstraction.

Encapsulates all Redis hot-telemetry storage operations (Hashes, TTL, Geospatial, Route Sets)
while coordinating with the shared Redis driver from ecotransit_shared.db.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any

from ecotransit_shared.db import route_live_key, vehicle_geo_key, vehicle_live_key
from ecotransit_shared.schemas import VehiclePosition

logger = logging.getLogger("ingestion.adapter.redis")


class IRedisLiveStore(ABC):
    """Abstract Port for live vehicle telemetry caching in Redis."""

    @abstractmethod
    async def save_live_positions(
        self, positions: list[VehiclePosition], ttl_seconds: int = 45
    ) -> int:
        """Pipelined storage of vehicle hashes with TTL, geospatial coordinates, and route sets."""
        ...

    @abstractmethod
    async def ping(self) -> bool:
        """Performs a liveness check against Redis."""
        ...

    @abstractmethod
    async def close(self) -> None:
        """Closes the underlying Redis connection."""
        ...


class RedisLiveStore(IRedisLiveStore):
    """Concrete Adapter implementing IRedisLiveStore via the shared Redis client driver."""

    def __init__(self, redis_client: Any) -> None:
        self._client = redis_client

    async def save_live_positions(
        self, positions: list[VehiclePosition], ttl_seconds: int = 45
    ) -> int:
        if not positions:
            return 0

        geo_key = vehicle_geo_key()
        pipe = self._client.pipeline(transaction=False)

        for pos in positions:
            pos_key = vehicle_live_key(pos.vehicle_id)
            mapping: dict[str, str] = {
                "vehicle_id": pos.vehicle_id,
                "route_id": pos.route_id,
                "latitude": str(pos.latitude),
                "longitude": str(pos.longitude),
                "speed": str(pos.speed if pos.speed is not None else 0.0),
                "bearing": str(pos.bearing if pos.bearing is not None else 0.0),
                "timestamp": str(pos.timestamp),
                "is_speed_suspect": "1" if pos.is_speed_suspect else "0",
            }
            if pos.trip_id is not None:
                mapping["trip_id"] = pos.trip_id

            pipe.hset(pos_key, mapping=mapping)
            pipe.expire(pos_key, ttl_seconds)

            # Geospatial indexing (longitude, latitude, member)
            pipe.geoadd(geo_key, [pos.longitude, pos.latitude, pos.vehicle_id])

            # Route set membership
            if pos.route_id:
                route_key = route_live_key(pos.route_id)
                pipe.sadd(route_key, pos.vehicle_id)
                pipe.expire(route_key, ttl_seconds)

        await pipe.execute()
        return len(positions)

    async def ping(self) -> bool:
        try:
            res = await self._client.ping()
            return bool(res)
        except Exception as exc:
            logger.error("RedisLiveStore ping check failed: %s", exc)
            return False

    async def close(self) -> None:
        try:
            if hasattr(self._client, "aclose"):
                await self._client.aclose()
            elif hasattr(self._client, "close"):
                await self._client.close()
        except Exception as exc:
            logger.warning("Error closing RedisLiveStore: %s", exc)
