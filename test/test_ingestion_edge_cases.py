import asyncio
import time
import pytest
from unittest.mock import MagicMock, AsyncMock

import sys
from pathlib import Path
sys.path.insert(0, str(Path("shared/python").resolve()))
sys.path.insert(0, str(Path("services/python/ingestion-worker").resolve()))

from ecotransit_shared.contracts.ingestion import ISource, IParser, ISink
from ecotransit_shared.schemas import (
    RawPayload, VehiclePosition, SinkResult, HealthStatus, ValidationContext, RuleOutcome
)
from engine import IngestionEngine, ParserRegistry
from validation.chain import ValidationChain
from validation.rules import CoordinateBoundsRule, SpeedPlausibilityRule, TimestampFreshnessRule, DuplicatePingRule
from metrics import InMemoryMetricsRecorder

class MockSource(ISource):
    def __init__(self, payloads):
        self._payloads = payloads
        self.opened = False
        self.closed = False

    @property
    def name(self) -> str:
        return "mock_source"

    async def open(self) -> None:
        self.opened = True

    async def stream(self):
        for p in self._payloads:
            yield p

    async def close(self) -> None:
        self.closed = True

class MockParser(IParser):
    def __init__(self, positions):
        self._positions = positions

    def supports(self, payload: RawPayload) -> bool:
        return True

    def parse(self, payload: RawPayload) -> list[VehiclePosition]:
        return self._positions

class FlakyCriticalSink(ISink):
    def __init__(self, fail_times=1):
        self.fail_times = fail_times
        self.attempts = 0
        self.written_batches = []

    @property
    def is_critical(self) -> bool:
        return True

    async def write(self, batch: list[VehiclePosition]) -> SinkResult:
        self.attempts += 1
        if self.attempts <= self.fail_times:
            raise ConnectionError(f"Transient Redis Failure on attempt {self.attempts}")
        self.written_batches.append(batch)
        return SinkResult(written_count=len(batch))

    async def health(self) -> HealthStatus:
        return HealthStatus(status="healthy")

async def test_flaky_critical_sink_resilience():
    print("\n--- Testing Critical Sink Failure & Retry Semantics ---")
    pos = VehiclePosition(
        vehicle_id="BUS_001",
        route_id="101",
        latitude=28.6139,
        longitude=77.2090,
        speed=10.0,
        bearing=90.0,
        timestamp=int(time.time()),
        is_speed_suspect=False,
    )
    source = MockSource([RawPayload(source="test", payload=b"dummy")])
    parsers = ParserRegistry([MockParser([pos])])
    validation = ValidationChain([]) # pass all
    sink = FlakyCriticalSink(fail_times=1)
    metrics = InMemoryMetricsRecorder()

    engine = IngestionEngine(
        source=source,
        parsers=parsers,
        validation=validation,
        sink=sink,
        metrics=metrics,
        batch_size=1, # immediate flush
        flush_interval_ms=1000
    )

    try:
        await engine.run()
        print("Engine survived without crash.")
    except Exception as e:
        print(f"FAILED: IngestionEngine crashed on critical sink failure: {type(e).__name__}: {e}")
        print(f"Buffer remaining: {len(engine._buffer)}")
        print(f"Sink written batches: {len(sink.written_batches)}")
        print("Defect confirmed: Engine crashes and drops batch on transient critical sink failure!")

if __name__ == "__main__":
    asyncio.run(test_flaky_critical_sink_resilience())
