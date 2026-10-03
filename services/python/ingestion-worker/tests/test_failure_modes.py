"""Module-by-module failure tests verifying graceful degradation and crash prevention.

Validates that individual component failures (network drops, corrupt payloads,
NaN/inf calculations, database disconnects, cache timeouts, and corrupted files)
degrade gracefully without causing unhandled exceptions or crashing the system.
"""

from __future__ import annotations

import asyncio
import tempfile
import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from adapters.feed_client import DelhiOtdFeedClient, IOTDFeedClient
from adapters.postgres_store import IPostgresArchiveStore
from engine import IngestionEngine, ParserRegistry
from metrics import InMemoryMetricsRecorder
from parsers.gtfs_protobuf import GtfsProtobufParser
from sinks.fan_out import FanOutSink
from sinks.postgres_sink import PostgresArchiveSink
from sinks.redis_sink import RedisPositionSink
from sources.gtfs_realtime import GtfsRealtimeSource
from tests.conftest import MockRedisStore, make_sample_protobuf
from tooling.combine_otd_snapshots import combine_snapshots
from validation.chain import ValidationChain
from validation.rules import CoordinateBoundsRule, SpeedPlausibilityRule

from ecotransit_shared.schemas import RawPayload, ValidationContext, VehiclePosition

# ============================================================================
# 1. Source & HTTP Client Failure Modes
# ============================================================================

@pytest.mark.asyncio
async def test_feed_client_http_5xx_retries_and_graceful_error() -> None:
    """Verifies DelhiOtdFeedClient handles repeated 502/503 server errors gracefully."""
    mock_response = MagicMock()
    mock_response.status_code = 503
    mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
        "503 Service Unavailable",
        request=MagicMock(),
        response=mock_response,
    )

    mock_http = MagicMock()
    mock_http.get = AsyncMock(return_value=mock_response)
    mock_http.is_closed = False

    client = DelhiOtdFeedClient(
        feed_url="https://otd.test/failing.pb",
        max_retries=2,
        backoff_factor=1.1,
        client=mock_http,
    )

    # Must raise a clean RuntimeError with failure cause, not an unhandled crash
    with pytest.raises(RuntimeError, match="Failed to fetch feed after 2 attempts"):
        await client.fetch_feed()

    assert mock_http.get.call_count == 2


@pytest.mark.asyncio
async def test_feed_client_ping_failure_returns_false() -> None:
    """Verifies that network timeout or connection reset during ping returns False rather than crashing."""
    mock_http = MagicMock()
    mock_http.head = AsyncMock(side_effect=httpx.ConnectTimeout("Connection timed out"))
    mock_http.is_closed = False

    client = DelhiOtdFeedClient(
        feed_url="https://otd.test/unreachable.pb",
        client=mock_http,
    )

    is_alive = await client.ping()
    assert is_alive is False


@pytest.mark.asyncio
async def test_source_stream_catches_feed_client_crash_and_stays_alive() -> None:
    """Verifies GtfsRealtimeSource suppresses transient feed client exceptions and keeps running."""
    call_count = 0

    class ExplodingFeedClient(IOTDFeedClient):
        async def fetch_feed(self) -> bytes:
            nonlocal call_count
            call_count += 1
            if call_count <= 2:
                raise OSError("Socket abruptly disconnected by peer")
            # Recovers on attempt 3
            return make_sample_protobuf([{"vehicle_id": "RECOVERED_1", "lat": 28.61, "lon": 77.20}])

        async def ping(self) -> bool:
            return call_count > 2

        async def close(self) -> None:
            pass

    source = GtfsRealtimeSource(
        feed_client=ExplodingFeedClient(),
        poll_interval_seconds=0.05,
    )

    yielded_payloads = []

    async def run_consumer() -> None:
        async for item in source.stream():
            yielded_payloads.append(item)
            if len(yielded_payloads) >= 1:
                break

    task = asyncio.create_task(run_consumer())
    await asyncio.sleep(0.3)
    await source.close()
    await task

    # Stream stayed alive through 2 OSErrors and successfully yielded upon recovery
    assert len(yielded_payloads) == 1
    assert call_count >= 3


# ============================================================================
# 2. Parser & Engine Ingestion Failure Modes
# ============================================================================

def test_gtfs_parser_garbage_bytes_raises_clean_value_error() -> None:
    """Verifies that completely corrupt data raises ValueError, not unhandled memory errors."""
    parser = GtfsProtobufParser()
    payload = RawPayload(source="gtfs-rt", payload=b"\x00\xFF\xFE\xFD_NOT_A_PROTOBUF_DATA_CORRUPT")

    with pytest.raises(ValueError, match="Corrupt or non-Protobuf GTFS-RT payload"):
        parser.parse(payload)


@pytest.mark.asyncio
async def test_engine_continues_running_when_one_payload_is_corrupt() -> None:
    """Verifies that a malformed payload does not terminate the IngestionEngine."""
    valid_proto = make_sample_protobuf([{"vehicle_id": "BUS_GOOD", "lat": 28.61, "lon": 77.20}])
    corrupt_bytes = b"garbage_corrupted_payload"

    class MixedSource(IOTDFeedClient):
        def __init__(self) -> None:
            self.seq = [corrupt_bytes, valid_proto]
            self.idx = 0

        async def fetch_feed(self) -> bytes:
            if self.idx < len(self.seq):
                val = self.seq[self.idx]
                self.idx += 1
                return val
            return b""

        async def ping(self) -> bool:
            return True

        async def close(self) -> None:
            pass

    source = GtfsRealtimeSource(feed_client=MixedSource(), poll_interval_seconds=0.05)
    parsers = ParserRegistry([GtfsProtobufParser()])
    validation = ValidationChain([CoordinateBoundsRule()])
    mock_redis = MockRedisStore()
    sink = RedisPositionSink(store=mock_redis)
    metrics = InMemoryMetricsRecorder()

    engine = IngestionEngine(
        source=source,
        parsers=parsers,
        validation=validation,
        sink=sink,
        metrics=metrics,
        batch_size=1,
        flush_interval_ms=200,
    )

    runner = asyncio.create_task(engine.run())
    await asyncio.sleep(0.2)
    await engine.stop()
    await runner

    # Corrupt payload was skipped and valid payload was successfully flushed
    written_vids = [p.vehicle_id for batch in mock_redis.saved_batches for p in batch]
    assert "BUS_GOOD" in written_vids
    snapshot = metrics.get_snapshot()
    assert snapshot["payloads_received"] == 2
    assert snapshot["positions_parsed"] == 1


# ============================================================================
# 3. Validation Rules Numeric & Glitch Failure Modes
# ============================================================================

def test_validation_rules_handle_nan_and_infinity_safely() -> None:
    """Verifies rules gracefully reject NaN and Inf coordinates without raising OverflowError."""
    bounds_rule = CoordinateBoundsRule()
    speed_rule = SpeedPlausibilityRule()
    ctx = ValidationContext(received_at=time.time())

    # NaN coordinates
    nan_pos = VehiclePosition(
        vehicle_id="BUS_NAN",
        route_id="419",
        latitude=float("nan"),
        longitude=float("nan"),
        timestamp=int(time.time()),
    )
    outcome_nan = bounds_rule.check(nan_pos, ctx)
    assert outcome_nan.passed is False
    assert outcome_nan.code == "ERR_GEO_OUT_OF_BOUNDS"

    # Infinite coordinates
    inf_pos = VehiclePosition(
        vehicle_id="BUS_INF",
        route_id="419",
        latitude=float("inf"),
        longitude=77.20,
        timestamp=int(time.time()),
    )
    outcome_inf = bounds_rule.check(inf_pos, ctx)
    assert outcome_inf.passed is False

    # Infinite speed
    inf_speed_pos = VehiclePosition(
        vehicle_id="BUS_INF_SPEED",
        route_id="419",
        latitude=28.61,
        longitude=77.20,
        speed=float("inf"),
        timestamp=int(time.time()),
    )
    outcome_speed = speed_rule.check(inf_speed_pos, ctx)
    assert outcome_speed.passed is False
    assert outcome_speed.code == "ERR_SPEED_IMPLAUSIBLE"


# ============================================================================
# 4. Storage Sinks Degradation & Liveness Failure Modes
# ============================================================================

@pytest.mark.asyncio
async def test_postgres_sink_catches_driver_errors_without_raising() -> None:
    """Verifies PostgresArchiveSink catches query/driver errors and returns SinkResult."""
    class FailingPostgresStore(IPostgresArchiveStore):
        async def archive_positions(self, _positions: list[VehiclePosition]) -> int:
            raise RuntimeError("deadlock detected or connection lost to PostgreSQL")

        async def ping(self) -> bool:
            return False

        async def close(self) -> None:
            pass

    sink = PostgresArchiveSink(store=FailingPostgresStore())
    assert sink.is_critical is False

    pos = VehiclePosition(
        vehicle_id="DL1PC8888",
        route_id="419",
        latitude=28.61,
        longitude=77.20,
        timestamp=int(time.time()),
    )

    # Must NOT raise exception; non-critical sink degrades gracefully
    result = await sink.write([pos])
    assert result.written_count == 0
    assert len(result.errors) == 1
    assert "deadlock" in result.errors[0].error

    # Health check degrades gracefully
    health = await sink.health()
    assert health.status == "unhealthy"


@pytest.mark.asyncio
async def test_redis_store_ping_exception_returns_false() -> None:
    """Verifies RedisLiveStore returns False on ping exceptions instead of raising."""
    mock_client = MagicMock()
    mock_client.ping = AsyncMock(side_effect=ConnectionResetError("Redis server closed connection"))

    from adapters.redis_store import RedisLiveStore
    store = RedisLiveStore(redis_client=mock_client)

    alive = await store.ping()
    assert alive is False


@pytest.mark.asyncio
async def test_fan_out_sink_handles_partial_sink_exceptions() -> None:
    """Verifies FanOutSink records errors when one sink fails while allowing successful sinks to persist."""
    redis_store = MockRedisStore()
    redis_sink = RedisPositionSink(store=redis_store)

    class BrokenArchiveStore(IPostgresArchiveStore):
        async def archive_positions(self, _positions: list[VehiclePosition]) -> int:
            raise ConnectionRefusedError("PostgreSQL port 5432 unreachable")

        async def ping(self) -> bool:
            return False

        async def close(self) -> None:
            pass

    pg_sink = PostgresArchiveSink(store=BrokenArchiveStore())
    fan_out = FanOutSink([redis_sink, pg_sink])

    pos = VehiclePosition(
        vehicle_id="DL1PC1001",
        route_id="419",
        latitude=28.61,
        longitude=77.20,
        timestamp=int(time.time()),
    )

    res = await fan_out.write([pos])
    # Redis still recorded the write
    assert res.written_count == 1
    assert len(redis_store.saved_batches) == 1
    # Broken Postgres was captured in errors without throwing
    assert len(res.errors) == 1
    assert "PostgreSQL" in res.errors[0].error

    # Aggregate status is degraded
    health = await fan_out.health()
    assert health.status == "degraded"


# ============================================================================
# 5. Snapshot Tooling Failure Modes
# ============================================================================

def test_combine_snapshots_skips_corrupted_json_file_gracefully() -> None:
    """Verifies combine_snapshots skips unparseable JSON files without aborting the entire process."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        input_dir = Path(tmp_dir) / "snapshots"
        input_dir.mkdir()
        output_csv = Path(tmp_dir) / "output.csv"

        # 1. Corrupt JSON file (syntax error)
        corrupt_file = input_dir / "broken_snap.json"
        corrupt_file.write_text("{ this is invalid json syntax !!!", encoding="utf-8")

        # 2. Valid JSON file
        valid_file = input_dir / "valid_snap.json"
        valid_data = {
            "started_at": "2026-10-02T10:00:00",
            "snapshots": [
                {
                    "collected_at": "2026-10-02T10:00:10",
                    "vehicles": [
                        {
                            "entity_id": "v1",
                            "vehicle": {"id": "SURVIVOR_BUS"},
                            "trip": {"route_id": "419"},
                            "position": {"latitude": 28.61, "longitude": 77.20, "speed": 10.0},
                            "timestamp": 1700000000,
                        }
                    ],
                }
            ],
        }
        valid_file.write_text(import_json_dumps(valid_data), encoding="utf-8")

        # Pipeline must not crash; must log warning and process valid file
        df = combine_snapshots(input_dir=input_dir, output_csv=output_csv)
        assert output_csv.exists()
        assert len(df) == 1
        assert df.iloc[0]["vehicle_id"] == "SURVIVOR_BUS"


def import_json_dumps(data: dict) -> str:
    import json
    return json.dumps(data)
