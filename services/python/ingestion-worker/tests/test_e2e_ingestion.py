"""End-to-end integration test for Phase 2 GTFS-RT Ingestion Worker.

Verifies end-to-end telemetry ingestion into live Redis hot cache (hashes, TTL, GEO, route sets)
and durable PostgreSQL vehicle_position_archive using the full production pipeline wiring.
"""

from __future__ import annotations

import asyncio
import time

import pytest
from config import load_settings
from main import build_engine
from tests.conftest import MockFeedClient, make_sample_protobuf

from ecotransit_shared.db import (
    create_postgres_pool,
    create_redis_client,
    route_live_key,
    vehicle_geo_key,
    vehicle_live_key,
)


@pytest.mark.asyncio
async def test_e2e_live_ingestion_pipeline() -> None:
    settings = load_settings()
    unique_ts = int(time.time())
    test_vehicle_id = f"DL1PC_PHASE2_{unique_ts}"
    test_route_id = "419_TEST"

    # 1. Build a realistic GTFS-RT Protobuf payload
    proto_data = make_sample_protobuf([
        {
            "entity_id": f"ent_{unique_ts}",
            "vehicle_id": test_vehicle_id,
            "route_id": test_route_id,
            "trip_id": f"trip_{unique_ts}",
            "lat": 28.6315,  # Connaught Place, New Delhi
            "lon": 77.2167,
            "speed": 14.5,
            "bearing": 90.0,
            "timestamp": unique_ts,
        }
    ])

    # 2. Setup real DB and Redis clients
    db_pool = await create_postgres_pool(settings.db.dsn, min_size=1, max_size=3)
    redis_client = create_redis_client(settings.redis.url)

    mock_feed = MockFeedClient([proto_data])

    engine = build_engine(
        settings=settings,
        redis_client=redis_client,
        db_pool=db_pool,
        custom_feed_client=mock_feed,
    )

    pos_key = vehicle_live_key(test_vehicle_id)
    geo_key = vehicle_geo_key()
    route_key = route_live_key(test_route_id)

    try:
        # 3. Start engine and let it consume the feed poll
        runner = asyncio.create_task(engine.run())
        await asyncio.sleep(0.4)
        await engine.stop()
        await runner

        # 4. Verify Redis Hot Cache
        # 4a. Hash fields
        pos_hash = await redis_client.hgetall(pos_key)
        assert pos_hash, f"Hash for {pos_key} must exist in Redis"
        assert pos_hash.get("vehicle_id") == test_vehicle_id
        assert pos_hash.get("route_id") == test_route_id
        assert abs(float(pos_hash.get("latitude")) - 28.6315) < 1e-4
        assert abs(float(pos_hash.get("longitude")) - 77.2167) < 1e-4
        assert abs(float(pos_hash.get("speed")) - 14.5) < 1e-4

        # 4b. TTL expiration (spec requires ~45s)
        ttl = await redis_client.ttl(pos_key)
        assert 0 < ttl <= settings.redis_ttl_seconds, f"TTL must be active, got {ttl}"

        # 4c. Geospatial indexing
        geo_pos = await redis_client.geopos(geo_key, test_vehicle_id)
        assert geo_pos and geo_pos[0] is not None, "Vehicle must be indexed in live:geo:vehicles"
        lon, lat = geo_pos[0]
        assert abs(lon - 77.2167) < 0.001
        assert abs(lat - 28.6315) < 0.001

        # 4d. Route membership set
        route_members = await redis_client.smembers(route_key)
        assert test_vehicle_id in route_members, f"Vehicle must be member of {route_key}"

        # 5. Verify PostgreSQL Durable Archive
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, vehicle_id, route_id, latitude, longitude, speed, is_speed_suspect, gtfs_timestamp
                FROM vehicle_position_archive
                WHERE vehicle_id = $1 AND gtfs_timestamp = $2
                """,
                test_vehicle_id,
                unique_ts,
            )
            assert row is not None, "Row must be inserted into vehicle_position_archive"
            assert row["vehicle_id"] == test_vehicle_id
            assert row["route_id"] == test_route_id
            assert abs(row["latitude"] - 28.6315) < 0.0001
            assert abs(row["longitude"] - 77.2167) < 0.0001
            assert abs(row["speed"] - 14.5) < 0.0001
            assert row["is_speed_suspect"] is False

    finally:
        # Clean up test artifacts
        await redis_client.delete(pos_key)
        await redis_client.zrem(geo_key, test_vehicle_id)
        await redis_client.delete(route_key)
        async with db_pool.acquire() as conn:
            await conn.execute(
                "DELETE FROM vehicle_position_archive WHERE vehicle_id = $1", test_vehicle_id
            )
        await redis_client.aclose() if hasattr(redis_client, "aclose") else redis_client.close()
        await db_pool.close()
