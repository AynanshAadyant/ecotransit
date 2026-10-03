"""Unit tests for Sinks (RedisPositionSink, PostgresArchiveSink, FanOutSink)."""

from __future__ import annotations

import pytest
from sinks.fan_out import FanOutSink
from sinks.postgres_sink import PostgresArchiveSink
from sinks.redis_sink import RedisPositionSink
from tests.conftest import MockPostgresStore, MockRedisStore

from ecotransit_shared.schemas import VehiclePosition


def sample_positions() -> list[VehiclePosition]:
    return [
        VehiclePosition(
            vehicle_id="DL1PC1001",
            route_id="419",
            latitude=28.6139,
            longitude=77.2090,
            speed=12.0,
            timestamp=1700000000,
        ),
        VehiclePosition(
            vehicle_id="DL1PC1002",
            route_id="419",
            latitude=28.6200,
            longitude=77.2100,
            speed=14.0,
            timestamp=1700000000,
        ),
    ]


@pytest.mark.asyncio
async def test_redis_position_sink_criticality_and_write() -> None:
    mock_store = MockRedisStore()
    sink = RedisPositionSink(store=mock_store, ttl_seconds=45)

    assert sink.is_critical is True

    # 1. Successful write
    positions = sample_positions()
    res = await sink.write(positions)
    assert res.written_count == 2
    assert len(mock_store.saved_batches) == 1

    # 2. Store failure propagates because sink is critical
    mock_store.should_fail = True
    with pytest.raises(ConnectionError):
        await sink.write(positions)

    # 3. Health check
    mock_store.should_fail = False
    health = await sink.health()
    assert health.status == "healthy"


@pytest.mark.asyncio
async def test_postgres_archive_sink_non_criticality_and_resilience() -> None:
    mock_store = MockPostgresStore()
    sink = PostgresArchiveSink(store=mock_store)

    assert sink.is_critical is False

    # 1. Successful write
    positions = sample_positions()
    res = await sink.write(positions)
    assert res.written_count == 2
    assert len(mock_store.archived_batches) == 1

    # 2. Store failure does NOT raise, returns SinkResult with error
    mock_store.should_fail = True
    res_failed = await sink.write(positions)
    assert res_failed.written_count == 0
    assert len(res_failed.errors) == 1
    assert "Simulated Postgres database error" in res_failed.errors[0].error


@pytest.mark.asyncio
async def test_fan_out_sink_concurrent_dispatch_and_critical_propagation() -> None:
    redis_store = MockRedisStore()
    pg_store = MockPostgresStore()

    redis_sink = RedisPositionSink(store=redis_store)
    pg_sink = PostgresArchiveSink(store=pg_store)

    fan_out = FanOutSink([redis_sink, pg_sink])
    assert fan_out.is_critical is True

    positions = sample_positions()

    # 1. Both succeed
    res = await fan_out.write(positions)
    assert res.written_count == 2
    assert len(redis_store.saved_batches) == 1
    assert len(pg_store.archived_batches) == 1
    assert len(res.errors) == 0

    # 2. Non-critical Postgres fails, Redis succeeds -> FanOut completes with recorded error
    pg_store.should_fail = True
    res_partial = await fan_out.write(positions)
    assert res_partial.written_count == 2
    assert len(res_partial.errors) == 1

    # 3. Critical Redis fails -> FanOut propagates exception
    redis_store.should_fail = True
    with pytest.raises(ConnectionError):
        await fan_out.write(positions)


@pytest.mark.asyncio
async def test_fan_out_sink_health_aggregation() -> None:
    redis_store = MockRedisStore()
    pg_store = MockPostgresStore()

    redis_sink = RedisPositionSink(store=redis_store)
    pg_sink = PostgresArchiveSink(store=pg_store)
    fan_out = FanOutSink([redis_sink, pg_sink])

    # Healthy
    assert (await fan_out.health()).status == "healthy"

    # Degraded (only non-critical fails)
    pg_store.ping_result = False
    assert (await fan_out.health()).status == "degraded"

    # Unhealthy (critical fails)
    redis_store.ping_result = False
    assert (await fan_out.health()).status == "unhealthy"
