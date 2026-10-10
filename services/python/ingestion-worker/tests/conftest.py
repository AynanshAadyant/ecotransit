"""Test configuration and fixtures for the Ingestion Worker test suite."""

from __future__ import annotations

import sys
import time
from pathlib import Path
from typing import Any

from google.transit import gtfs_realtime_pb2

# Ensure shared/python and service directories are in sys.path
workspace_root = Path(__file__).resolve().parents[4]
shared_path = workspace_root / "shared" / "python"
service_path = workspace_root / "services" / "python" / "ingestion-worker"

for p in (str(shared_path), str(service_path)):
    if p not in sys.path:
        sys.path.insert(0, p)

from adapters.feed_client import IOTDFeedClient  # noqa: E402
from adapters.postgres_store import IPostgresArchiveStore  # noqa: E402
from adapters.redis_store import IRedisLiveStore  # noqa: E402

from ecotransit_shared.schemas import VehiclePosition  # noqa: E402


def make_sample_protobuf(
    vehicles: list[dict[str, Any]] | None = None,
    feed_timestamp: int | None = None,
) -> bytes:
    """Builds a real GTFS-RT Protobuf FeedMessage in bytes."""
    feed = gtfs_realtime_pb2.FeedMessage()
    feed.header.gtfs_realtime_version = "2.0"
    feed.header.incrementality = gtfs_realtime_pb2.FeedHeader.Incrementality.FULL_DATASET
    feed.header.timestamp = feed_timestamp or int(time.time())

    if vehicles is None:
        vehicles = [
            {
                "entity_id": "ent_1",
                "vehicle_id": "DL1PC1001",
                "route_id": "419",
                "trip_id": "trip_01",
                "lat": 28.6139,
                "lon": 77.2090,
                "speed": 12.5,
                "bearing": 180.0,
                "timestamp": feed.header.timestamp,
            }
        ]

    for item in vehicles:
        entity = feed.entity.add()
        entity.id = item.get("entity_id", "ent_default")

        if item.get("vehicle_id") is not None:
            entity.vehicle.vehicle.id = str(item["vehicle_id"])
        if item.get("route_id") is not None or item.get("trip_id") is not None:
            if item.get("route_id"):
                entity.vehicle.trip.route_id = str(item["route_id"])
            if item.get("trip_id"):
                entity.vehicle.trip.trip_id = str(item["trip_id"])

        if item.get("lat") is not None and item.get("lon") is not None:
            entity.vehicle.position.latitude = float(item["lat"])
            entity.vehicle.position.longitude = float(item["lon"])
        if item.get("speed") is not None:
            entity.vehicle.position.speed = float(item["speed"])
        if item.get("bearing") is not None:
            entity.vehicle.position.bearing = float(item["bearing"])
        if item.get("timestamp") is not None:
            entity.vehicle.timestamp = int(item["timestamp"])

    return feed.SerializeToString()


class MockRedisStore(IRedisLiveStore):
    """Mock Redis store tracking written positions in memory."""

    def __init__(self) -> None:
        self.saved_batches: list[list[VehiclePosition]] = []
        self.ping_result = True
        self.should_fail = False

    async def save_live_positions(
        self, positions: list[VehiclePosition], ttl_seconds: int = 45
    ) -> int:
        _ = ttl_seconds
        if self.should_fail:
            raise ConnectionError("Simulated Redis connection failure")
        self.saved_batches.append(list(positions))
        return len(positions)

    async def ping(self) -> bool:
        return self.ping_result

    async def close(self) -> None:
        pass


class MockPostgresStore(IPostgresArchiveStore):
    """Mock Postgres store tracking archived positions in memory."""

    def __init__(self) -> None:
        self.archived_batches: list[list[VehiclePosition]] = []
        self.ping_result = True
        self.should_fail = False

    async def archive_positions(self, positions: list[VehiclePosition]) -> int:
        if self.should_fail:
            raise RuntimeError("Simulated Postgres database error")
        self.archived_batches.append(list(positions))
        return len(positions)

    async def ping(self) -> bool:
        return self.ping_result

    async def close(self) -> None:
        pass


class MockFeedClient(IOTDFeedClient):
    """Mock OTD feed client returning preconfigured protobuf payloads."""

    def __init__(self, payloads: list[bytes] | None = None) -> None:
        self.payloads = list(payloads) if payloads else [make_sample_protobuf()]
        self.call_count = 0
        self.ping_result = True

    async def fetch_feed(self) -> bytes:
        if not self.payloads:
            return b""
        payload = self.payloads[self.call_count % len(self.payloads)]
        self.call_count += 1
        return payload

    async def ping(self) -> bool:
        return self.ping_result

    async def close(self) -> None:
        pass
