"""Unit tests for the IngestionEngine and ParserRegistry."""

from __future__ import annotations

import asyncio
import time

import pytest
from engine import IngestionEngine, ParserRegistry
from metrics import InMemoryMetricsRecorder
from parsers.gtfs_protobuf import GtfsProtobufParser
from sinks.redis_sink import RedisPositionSink
from sources.gtfs_realtime import GtfsRealtimeSource
from tests.conftest import MockFeedClient, MockRedisStore, make_sample_protobuf
from validation.chain import ValidationChain
from validation.rules import CoordinateBoundsRule, SpeedPlausibilityRule

from ecotransit_shared.schemas import RawPayload


def test_parser_registry_selection() -> None:
    parser = GtfsProtobufParser()
    registry = ParserRegistry([parser])

    valid_payload = RawPayload(source="gtfs-rt", payload=b"\x08\x00")
    selected = registry.get_parser(valid_payload)
    assert selected is parser

    unknown_payload = RawPayload(source="unsupported_source", payload="text_payload")
    with pytest.raises(ValueError, match="No registered parser"):
        registry.get_parser(unknown_payload)


@pytest.mark.asyncio
async def test_engine_flushes_on_batch_size() -> None:
    """Verifies that reaching batch_size immediately triggers a sink flush."""
    # Build protobuf with 5 vehicles
    vehicles = [
        {
            "entity_id": f"e_{i}",
            "vehicle_id": f"BUS_{i}",
            "lat": 28.6139,
            "lon": 77.2090,
            "speed": 10.0,
            "timestamp": int(time.time()),
        }
        for i in range(5)
    ]
    proto = make_sample_protobuf(vehicles)

    mock_feed = MockFeedClient([proto])
    source = GtfsRealtimeSource(feed_client=mock_feed, poll_interval_seconds=0.1)
    parsers = ParserRegistry([GtfsProtobufParser()])
    validation = ValidationChain([
        CoordinateBoundsRule(),
        SpeedPlausibilityRule(),
    ])
    mock_store = MockRedisStore()
    sink = RedisPositionSink(store=mock_store)
    metrics = InMemoryMetricsRecorder()

    # Batch size set to 5 -> should flush immediately when 5th item arrives
    engine = IngestionEngine(
        source=source,
        parsers=parsers,
        validation=validation,
        sink=sink,
        metrics=metrics,
        batch_size=5,
        flush_interval_ms=10000,  # Long timer to ensure size triggers it
    )

    runner = asyncio.create_task(engine.run())
    # Give engine enough time to process the first poll
    await asyncio.sleep(0.3)
    await engine.stop()
    await runner

    assert len(mock_store.saved_batches) >= 1
    assert len(mock_store.saved_batches[0]) == 5
    snapshot = metrics.get_snapshot()
    assert snapshot["positions_parsed"] >= 5
    assert snapshot["validation_passed"] >= 5
    assert snapshot["batches_flushed"] >= 1


@pytest.mark.asyncio
async def test_engine_flushes_on_timer_interval() -> None:
    """Verifies that buffered positions flush when timer expires even if batch_size isn't reached."""
    # Build protobuf with only 2 vehicles (batch_size is 10)
    vehicles = [
        {
            "entity_id": f"e_{i}",
            "vehicle_id": f"BUS_TIMER_{i}",
            "lat": 28.6139,
            "lon": 77.2090,
            "speed": 10.0,
            "timestamp": int(time.time()),
        }
        for i in range(2)
    ]
    proto = make_sample_protobuf(vehicles)

    mock_feed = MockFeedClient([proto])
    source = GtfsRealtimeSource(feed_client=mock_feed, poll_interval_seconds=0.1)
    parsers = ParserRegistry([GtfsProtobufParser()])
    validation = ValidationChain([CoordinateBoundsRule()])
    mock_store = MockRedisStore()
    sink = RedisPositionSink(store=mock_store)
    metrics = InMemoryMetricsRecorder()

    # Flush interval 200ms, batch size 10
    engine = IngestionEngine(
        source=source,
        parsers=parsers,
        validation=validation,
        sink=sink,
        metrics=metrics,
        batch_size=10,
        flush_interval_ms=200,
    )

    runner = asyncio.create_task(engine.run())
    # Wait 400ms for timer flush to trigger
    await asyncio.sleep(0.4)
    await engine.stop()
    await runner

    assert len(mock_store.saved_batches) >= 1
    total_written = sum(len(b) for b in mock_store.saved_batches)
    assert total_written >= 2
