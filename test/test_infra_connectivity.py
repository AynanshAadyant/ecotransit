"""Phase 0 Infrastructure Connectivity Tests (Python / Pytest).

Validates PostgreSQL database and Redis cache configurations, async client factories,
and shared key builders from ecotransit_shared.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

import pytest
from dotenv import load_dotenv

# Ensure root .env is loaded and shared/python is in sys.path
workspace_root = Path(__file__).resolve().parents[1]
dotenv_path = workspace_root / ".env"
load_dotenv(dotenv_path)

shared_path = workspace_root / "shared" / "python"
if str(shared_path) not in sys.path:
    sys.path.insert(0, str(shared_path))

from ecotransit_shared.config import DatabaseSettings, RedisSettings  # noqa: E402
from ecotransit_shared.db import (  # noqa: E402
    create_postgres_pool,
    create_redis_client,
    route_live_key,
    route_segments_cache_key,
    staff_session_key,
    static_route_cache_key,
    static_stop_cache_key,
    vehicle_geo_key,
    vehicle_live_key,
)


def test_environment_and_settings() -> None:
    """Verifies environment variables load into Pydantic settings models."""
    db_settings = DatabaseSettings()
    assert db_settings.postgres_host == os.getenv("POSTGRES_HOST", "localhost")
    assert db_settings.postgres_port == int(os.getenv("POSTGRES_PORT", "5432"))
    assert db_settings.database_name == os.getenv("DATABASE_NAME", "ecotransit")
    assert db_settings.dsn.startswith("postgresql://")

    redis_settings = RedisSettings()
    assert redis_settings.redis_host == os.getenv("REDIS_HOST", "localhost")
    assert redis_settings.redis_port == int(os.getenv("REDIS_PORT", "6379"))
    assert redis_settings.url.startswith("redis://")


def test_key_builders_spec_parity() -> None:
    """Ensures Python key builders match the canonical keys used in TypeScript."""
    assert vehicle_live_key("DL1PC9999") == "live:pos:DL1PC9999"
    assert vehicle_geo_key() == "live:geo:vehicles"
    assert route_live_key("419") == "live:route:419"
    assert staff_session_key("sess-1") == "staff:session:sess-1"
    assert static_route_cache_key("419") == "cache:route:419"
    assert static_stop_cache_key("stop-1") == "cache:stop:stop-1"
    assert route_segments_cache_key("419") == "cache:segments:419"


@pytest.mark.asyncio
async def test_postgres_pool_connectivity() -> None:
    """Verifies asyncpg connection pool creation and PostGIS queries."""
    db_settings = DatabaseSettings()
    pool = await create_postgres_pool(db_settings.dsn, min_size=1, max_size=3)

    try:
        async with pool.acquire() as conn:
            # Basic handshake query
            alive = await conn.fetchval("SELECT 1")
            assert alive == 1

            # Verify connected database
            current_db = await conn.fetchval("SELECT current_database()")
            assert current_db == db_settings.database_name

            # Verify PostGIS extension
            postgis_ver = await conn.fetchval("SELECT postgis_version()")
            assert postgis_ver is not None and len(postgis_ver) > 0

            # Verify schema_migrations table contains 001_initial_schema.sql
            applied: Any = await conn.fetchval(
                "SELECT version FROM schema_migrations WHERE version = '001_initial_schema.sql'"
            )
            assert applied == "001_initial_schema.sql"
    finally:
        await pool.close()


@pytest.mark.asyncio
async def test_redis_client_connectivity_and_operations() -> None:
    """Verifies redis.asyncio client connectivity, ping, and key-value/hash ops."""
    redis_settings = RedisSettings()
    client = create_redis_client(redis_settings.url)

    test_key = "test:python:infra:ping"
    test_hash_key = vehicle_live_key("DL1PC_PY_TEST")
    test_geo_key = "test:python:infra:geo"

    try:
        # PING check
        pong = await client.ping()
        assert pong is True

        # String SET / GET with TTL
        await client.set(test_key, "python_phase0_ok", ex=10)
        val = await client.get(test_key)
        assert val == "python_phase0_ok"
        ttl = await client.ttl(test_key)
        assert 0 < ttl <= 10

        # Hash HSET / HGETALL
        await client.hset(
            test_hash_key,
            mapping={
                "vehicle_id": "DL1PC_PY_TEST",
                "route_id": "419",
                "latitude": "28.6139",
                "longitude": "77.2090",
            },
        )
        hval = await client.hgetall(test_hash_key)
        assert hval.get("vehicle_id") == "DL1PC_PY_TEST"
        assert hval.get("route_id") == "419"

        # Geospatial GEOADD & GEODIST
        await client.geoadd(
            test_geo_key,
            (77.2167, 28.6315, "CONNAUGHT_PLACE", 77.2289, 28.6669, "KASHMERE_GATE"),
        )
        dist = await client.geodist(test_geo_key, "CONNAUGHT_PLACE", "KASHMERE_GATE", unit="m")
        assert dist is not None
        assert 3500 < dist < 4600
    finally:
        await client.delete(test_key, test_hash_key, test_geo_key)
        await client.aclose()
