"""Custom advanced scenario tests for the Ingestion Worker pipeline.

Covers:
1. Network fault injection and reconnect recovery.
2. Adverse dirty telemetry stress testing (mixed glitches, bounds errors, speed spikes, stale times).
3. Partial sink degradation (PostgreSQL failure while Redis remains healthy).
4. Rapid buffer burst accumulation and multi-batch flushing.
5. In-flight buffer draining upon graceful shutdown.
6. Feed client authentication header and query parameter dynamic injection.
"""

from __future__ import annotations

import asyncio
import time
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from adapters.feed_client import DelhiOtdFeedClient, IOTDFeedClient
from engine import IngestionEngine, ParserRegistry
from metrics import InMemoryMetricsRecorder
from parsers.gtfs_protobuf import GtfsProtobufParser
from sinks.fan_out import FanOutSink
from sinks.postgres_sink import PostgresArchiveSink
from sinks.redis_sink import RedisPositionSink
from sources.gtfs_realtime import GtfsRealtimeSource
from tests.conftest import MockPostgresStore, MockRedisStore, make_sample_protobuf
from validation.chain import ValidationChain
from validation.rules import (
    CoordinateBoundsRule,
    DuplicatePingRule,
    SpeedPlausibilityRule,
    TimestampFreshnessRule,
)

from ecotransit_shared.schemas import VehiclePosition


class FaultyFeedClient(IOTDFeedClient):
    """Feed client that fails N times before yielding valid data."""

    def __init__(self, fail_count: int, valid_payload: bytes) -> None:
        self.fail_count = fail_count
        self.attempts = 0
        self.valid_payload = valid_payload

    async def fetch_feed(self) -> bytes:
        self.attempts += 1
        if self.attempts <= self.fail_count:
            raise httpx.ConnectError(f"Simulated network drop attempt {self.attempts}")
        return self.valid_payload

    async def ping(self) -> bool:
        return self.attempts > self.fail_count

    async def close(self) -> None:
        pass


@pytest.mark.asyncio
async def test_scenario_network_fault_injection_and_recovery() -> None:
    """Verifies GtfsRealtimeSource survives consecutive transport failures and resumes streaming."""
    valid_proto = make_sample_protobuf([
        {
            "entity_id": "e_recovered",
            "vehicle_id": "BUS_RECOVERED",
            "lat": 28.6139,
            "lon": 77.2090,
            "speed": 10.0,
            "timestamp": int(time.time()),
        }
    ])

    # Fails 2 times with network drop, then recovers on 3rd attempt
    faulty_client = FaultyFeedClient(fail_count=2, valid_payload=valid_proto)
    source = GtfsRealtimeSource(feed_client=faulty_client, poll_interval_seconds=0.05)

    received_payloads = []

    async def consume_stream() -> None:
        async for payload in source.stream():
            received_payloads.append(payload)
            if len(received_payloads) >= 1:
                break

    task = asyncio.create_task(consume_stream())
    await asyncio.sleep(0.4)
    await source.close()
    await task

    assert len(received_payloads) == 1
    assert faulty_client.attempts >= 3


@pytest.mark.asyncio
async def test_scenario_adverse_dirty_telemetry_filtering() -> None:
    """Stress tests the pipeline with a mixed payload containing valid and invalid telemetry."""
    now_ts = int(time.time())

    # Generate 20 test vehicles:
    # 5 Valid in Delhi
    # 5 Out of bounds (e.g. lat=10, lon=10)
    # 5 Supersonic speed (150 km/h)
    # 5 Stale timestamp (1 hour ago)
    test_vehicles = []

    # Valid
    for i in range(5):
        test_vehicles.append({
            "entity_id": f"valid_{i}",
            "vehicle_id": f"BUS_VALID_{i}",
            "lat": 28.61 + (i * 0.01),
            "lon": 77.20 + (i * 0.01),
            "speed": 12.0,
            "timestamp": now_ts,
        })
    # Out of bounds
    for i in range(5):
        test_vehicles.append({
            "entity_id": f"oob_{i}",
            "vehicle_id": f"BUS_OOB_{i}",
            "lat": 12.9716,  # Bangalore
            "lon": 77.5946,
            "speed": 12.0,
            "timestamp": now_ts,
        })
    # Supersonic speed (> 80 km/h)
    for i in range(5):
        test_vehicles.append({
            "entity_id": f"fast_{i}",
            "vehicle_id": f"BUS_FAST_{i}",
            "lat": 28.62,
            "lon": 77.21,
            "speed": 45.0,  # 162 km/h
            "timestamp": now_ts,
        })
    # Stale timestamp (> 120s)
    for i in range(5):
        test_vehicles.append({
            "entity_id": f"stale_{i}",
            "vehicle_id": f"BUS_STALE_{i}",
            "lat": 28.63,
            "lon": 77.22,
            "speed": 10.0,
            "timestamp": now_ts - 3600,
        })

    dirty_proto = make_sample_protobuf(test_vehicles)

    class SingleFeedClient(IOTDFeedClient):
        def __init__(self) -> None:
            self.served = False

        async def fetch_feed(self) -> bytes:
            if not self.served:
                self.served = True
                return dirty_proto
            return b""

        async def ping(self) -> bool:
            return True

        async def close(self) -> None:
            pass

    source = GtfsRealtimeSource(feed_client=SingleFeedClient(), poll_interval_seconds=0.05)
    parsers = ParserRegistry([GtfsProtobufParser()])
    validation = ValidationChain([
        CoordinateBoundsRule(),
        SpeedPlausibilityRule(max_kmh=80.0),
        TimestampFreshnessRule(max_age_s=120),
        DuplicatePingRule(),
    ])

    mock_redis = MockRedisStore()
    sink = RedisPositionSink(store=mock_redis)
    metrics = InMemoryMetricsRecorder()

    engine = IngestionEngine(
        source=source,
        parsers=parsers,
        validation=validation,
        sink=sink,
        metrics=metrics,
        batch_size=5,
        flush_interval_ms=500,
    )

    runner = asyncio.create_task(engine.run())
    await asyncio.sleep(0.2)
    await engine.stop()
    await runner

    snapshot = metrics.get_snapshot()
    assert snapshot["positions_parsed"] == 20
    assert snapshot["validation_passed"] == 5
    assert snapshot["validation_rejected"]["ERR_GEO_OUT_OF_BOUNDS"] == 5
    assert snapshot["validation_rejected"]["ERR_SPEED_IMPLAUSIBLE"] == 5
    assert snapshot["validation_rejected"]["ERR_TIMESTAMP_STALE"] == 5

    # Exactly the 5 valid buses were written
    written_positions = [pos for batch in mock_redis.saved_batches for pos in batch]
    assert len(written_positions) == 5
    for p in written_positions:
        assert p.vehicle_id.startswith("BUS_VALID_")


@pytest.mark.asyncio
async def test_scenario_partial_sink_degradation_resilience() -> None:
    """Verifies that durable archive failure does not halt or fail live tracking writes."""
    redis_store = MockRedisStore()
    pg_store = MockPostgresStore()
    pg_store.should_fail = True  # Simulating Postgres connection drop
    pg_store.ping_result = False  # Simulating Postgres health check degraded

    redis_sink = RedisPositionSink(store=redis_store)
    pg_sink = PostgresArchiveSink(store=pg_store)
    fan_out = FanOutSink([redis_sink, pg_sink])

    test_positions = [
        VehiclePosition(
            vehicle_id="DL1PC9999",
            route_id="419",
            latitude=28.6139,
            longitude=77.2090,
            speed=12.0,
            timestamp=int(time.time()),
        )
    ]

    # Writing to composite FanOutSink
    result = await fan_out.write(test_positions)

    # Redis succeeded
    assert len(redis_store.saved_batches) == 1
    assert result.written_count == 1

    # Postgres failure was recorded in result errors, not raised
    assert len(result.errors) == 1
    assert "Postgres" in result.errors[0].error

    # Overall sink health should be degraded (not unhealthy, because live tracking still works)
    health = await fan_out.health()
    assert health.status == "degraded"


@pytest.mark.asyncio
async def test_scenario_rapid_burst_and_in_flight_drain() -> None:
    """Verifies that a rapid burst of positions is accumulated and flushed without loss upon shutdown."""
    proto = make_sample_protobuf([
        {
            "entity_id": f"burst_{i}",
            "vehicle_id": f"BURST_BUS_{i}",
            "lat": 28.6139,
            "lon": 77.2090,
            "speed": 10.0,
            "timestamp": int(time.time()),
        }
        for i in range(17)
    ])

    class RapidClient(IOTDFeedClient):
        def __init__(self) -> None:
            self.served = False

        async def fetch_feed(self) -> bytes:
            if not self.served:
                self.served = True
                return proto
            return b""

        async def ping(self) -> bool:
            return True

        async def close(self) -> None:
            pass

    mock_redis = MockRedisStore()
    sink = RedisPositionSink(store=mock_redis)
    metrics = InMemoryMetricsRecorder()

    # Batch size is 10, total items is 17
    # 10 will flush on size, remaining 7 should flush on shutdown drain
    engine = IngestionEngine(
        source=GtfsRealtimeSource(feed_client=RapidClient(), poll_interval_seconds=1.0),
        parsers=ParserRegistry([GtfsProtobufParser()]),
        validation=ValidationChain([CoordinateBoundsRule()]),
        sink=sink,
        metrics=metrics,
        batch_size=10,
        flush_interval_ms=10000,
    )

    runner = asyncio.create_task(engine.run())
    await asyncio.sleep(0.2)
    # Stop while remaining 7 items are still in buffer
    await engine.stop()
    await runner

    total_flushed = sum(len(b) for b in mock_redis.saved_batches)
    assert total_flushed == 17
    assert len(mock_redis.saved_batches) == 2
    assert len(mock_redis.saved_batches[0]) == 10
    assert len(mock_redis.saved_batches[1]) == 7


@pytest.mark.asyncio
async def test_scenario_delhi_otd_client_dynamic_key_handling() -> None:
    """Verifies DelhiOtdFeedClient handles missing vs configured API keys."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b"sample_bytes"
    mock_response.raise_for_status = MagicMock()

    mock_http = MagicMock()
    mock_http.get = AsyncMock(return_value=mock_response)
    mock_http.is_closed = False

    # 1. Without API key
    client_no_key = DelhiOtdFeedClient(feed_url="https://otd.test/feed.pb", client=mock_http)
    await client_no_key.fetch_feed()
    call_args_no_key = mock_http.get.call_args
    assert "x-api-key" not in call_args_no_key.kwargs["headers"]
    assert "key" not in call_args_no_key.kwargs["params"]

    # 2. With API key
    client_with_key = DelhiOtdFeedClient(
        feed_url="https://otd.test/feed.pb", api_key="secret_delhi_key", client=mock_http
    )
    await client_with_key.fetch_feed()
    call_args_with_key = mock_http.get.call_args
    assert call_args_with_key.kwargs["headers"]["x-api-key"] == "secret_delhi_key"
    assert call_args_with_key.kwargs["params"]["key"] == "secret_delhi_key"
