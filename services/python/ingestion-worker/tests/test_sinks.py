"""Unit tests for Sinks (RedisPositionSink, PostgresArchiveSink, FanOutSink)."""

from __future__ import annotations

import csv
import re
from pathlib import Path

import pytest
from sinks.csv_sink import CSV_COLUMNS, CsvSink
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


@pytest.mark.asyncio
async def test_csv_sink_initialization_creates_timestamp_file(tmp_path: Path) -> None:
    sink = CsvSink(output_dir=tmp_path)
    assert sink.is_critical is False
    assert sink.current_file_path is not None
    assert sink.current_file_path.exists()
    assert re.match(r"^telemetry_\d{8}_\d{6}.*\.csv$", sink.current_file_path.name)

    # Verify CSV header
    content = sink.current_file_path.read_text(encoding="utf-8")
    header_line = content.strip().splitlines()[0]
    assert header_line == ",".join(CSV_COLUMNS)
    sink.close()


@pytest.mark.asyncio
async def test_csv_sink_write_stream_persists_data(tmp_path: Path) -> None:
    sink = CsvSink(output_dir=tmp_path)
    positions = sample_positions()

    res = await sink.write(positions)
    assert res.written_count == 2
    assert len(res.errors) == 0
    assert sink.total_rows_written == 2

    # Verify rows written to CSV file
    file_path = sink.current_file_path
    assert file_path is not None
    with open(file_path, mode="r", newline="", encoding="utf-8") as f:
        reader = list(csv.DictReader(f))
        assert len(reader) == 2
        assert reader[0]["vehicle_id"] == "DL1PC1001"
        assert reader[0]["route_id"] == "419"
        assert float(reader[0]["latitude"]) == 28.6139
        assert float(reader[0]["speed"]) == 12.0
        assert reader[1]["vehicle_id"] == "DL1PC1002"

    sink.close()


@pytest.mark.asyncio
async def test_csv_sink_rotates_on_size_cap(tmp_path: Path) -> None:
    # Header is ~111 bytes. 2 rows are ~113 bytes (total ~224 bytes).
    # With max_bytes=200, the first 2 rows write to file 1, and the next write triggers rotation.
    sink = CsvSink(output_dir=tmp_path, max_bytes=200)
    first_file = sink.current_file_path
    assert first_file is not None

    positions = sample_positions()  # 2 positions
    res1 = await sink.write(positions)
    assert res1.written_count == 2
    assert sink.current_file_path == first_file
    assert sink.current_file_bytes >= 200

    # Writing 2 more rows should cross the 250-byte cap and trigger rotation
    res2 = await sink.write(positions)
    assert res2.written_count == 2
    assert len(sink.files_created) == 2
    second_file = sink.current_file_path
    assert second_file != first_file
    assert second_file.exists()

    # Both files must have valid headers and rows
    with open(first_file, mode="r", newline="", encoding="utf-8") as f1:
        reader1 = list(csv.DictReader(f1))
        assert len(reader1) == 2

    with open(second_file, mode="r", newline="", encoding="utf-8") as f2:
        reader2 = list(csv.DictReader(f2))
        assert len(reader2) == 2

    assert sink.total_rows_written == 4
    sink.close()


@pytest.mark.asyncio
async def test_csv_sink_health_and_close(tmp_path: Path) -> None:
    sink = CsvSink(output_dir=tmp_path)
    health_before = await sink.health()
    assert health_before.status == "healthy"
    assert health_before.details["sink"] == "CsvSink"

    sink.close()
    health_after = await sink.health()
    assert health_after.status == "unhealthy"

    # Writing after close safely reopens a new write stream file
    positions = sample_positions()
    res = await sink.write(positions)
    assert res.written_count == 2
    assert (await sink.health()).status == "healthy"
    sink.close()


@pytest.mark.asyncio
async def test_fan_out_sink_with_csv_sink(tmp_path: Path) -> None:
    redis_store = MockRedisStore()
    pg_store = MockPostgresStore()
    redis_sink = RedisPositionSink(store=redis_store)
    pg_sink = PostgresArchiveSink(store=pg_store)
    csv_sink = CsvSink(output_dir=tmp_path)

    fan_out = FanOutSink([redis_sink, pg_sink, csv_sink])
    assert fan_out.is_critical is True  # Because Redis is critical

    positions = sample_positions()
    res = await fan_out.write(positions)
    assert res.written_count == 2
    assert len(res.errors) == 0
    assert len(redis_store.saved_batches) == 1
    assert len(pg_store.archived_batches) == 1
    assert csv_sink.total_rows_written == 2

    # Close FanOutSink cleanly closes children
    await fan_out.aclose()
    assert (await csv_sink.health()).status == "unhealthy"


@pytest.mark.asyncio
async def test_csv_sink_error_resilience(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    sink = CsvSink(output_dir=tmp_path)

    # Simulate an I/O failure during batch writing
    def failing_write_batch(*args: Any, **kwargs: Any) -> int:
        raise OSError("Disk write error")

    monkeypatch.setattr(sink, "_write_batch_sync", failing_write_batch)

    positions = sample_positions()
    res = await sink.write(positions)
    assert res.written_count == 0
    assert len(res.errors) == 1
    assert "Disk write error" in res.errors[0].error
    sink.close()
