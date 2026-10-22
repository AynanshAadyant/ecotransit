import asyncio
import time
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
from sinks.fan_out import FanOutSink
from metrics import InMemoryMetricsRecorder

class MockSource(ISource):
    def __init__(self, payloads):
        self._payloads = payloads

    @property
    def name(self) -> str:
        return "mock_source"

    async def open(self) -> None:
        pass

    async def stream(self):
        for p in self._payloads:
            yield p

    async def close(self) -> None:
        pass

class MockParser(IParser):
    def __init__(self, positions):
        self._positions = positions

    def supports(self, payload: RawPayload) -> bool:
        return payload.source == "gtfs_rt"

    def parse(self, payload: RawPayload) -> list[VehiclePosition]:
        if payload.payload == b"corrupt":
            raise ValueError("Corrupt protobuf bytes")
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

class FailingNonCriticalSink(ISink):
    def __init__(self):
        self.attempts = 0

    @property
    def is_critical(self) -> bool:
        return False

    async def write(self, batch: list[VehiclePosition]) -> SinkResult:
        self.attempts += 1
        raise RuntimeError("Postgres Disk Full / Timeout")

    async def health(self) -> HealthStatus:
        return HealthStatus(status="unhealthy")

class WorkingCriticalSink(ISink):
    def __init__(self):
        self.written_count = 0

    @property
    def is_critical(self) -> bool:
        return True

    async def write(self, batch: list[VehiclePosition]) -> SinkResult:
        self.written_count += len(batch)
        return SinkResult(written_count=len(batch))

    async def health(self) -> HealthStatus:
        return HealthStatus(status="healthy")

async def run_edge_case_suite():
    print("=" * 70)
    print("QA TEST SUITE: INGESTION WORKER ADVERSARIAL & EDGE-CASE VALIDATION")
    print("=" * 70)

    # 1. Validation Rules Edge Cases
    print("\n[Case 1] Validation Rule Enforcement Testing")
    val_chain = ValidationChain([
        CoordinateBoundsRule(min_lat=28.3, max_lat=28.95, min_lon=76.8, max_lon=77.55),
        SpeedPlausibilityRule(max_kmh=80),
        TimestampFreshnessRule(max_age_s=120),
        DuplicatePingRule(),
    ])

    now = int(time.time())
    ctx = ValidationContext(received_at=time.time())

    # Valid Position
    p_valid = VehiclePosition(
        vehicle_id="V_VALID", route_id="R1", latitude=28.6, longitude=77.2,
        speed=10.0, bearing=0.0, timestamp=now, is_speed_suspect=False
    )
    res = val_chain.evaluate(p_valid, ctx)
    assert res.valid, f"Expected valid position to pass, got: {res}"
    print("  [OK] Valid position correctly accepted")

    # Coordinate Out of Bounds
    p_oob = VehiclePosition(
        vehicle_id="V_OOB", route_id="R1", latitude=0.0, longitude=0.0,
        speed=10.0, bearing=0.0, timestamp=now, is_speed_suspect=False
    )
    res_oob = val_chain.evaluate(p_oob, ctx)
    assert not res_oob.valid and res_oob.failed_rule == "ERR_GEO_OUT_OF_BOUNDS", f"Expected ERR_GEO_OUT_OF_BOUNDS, got {res_oob}"
    print("  [OK] (0,0) coordinate correctly rejected: ERR_GEO_OUT_OF_BOUNDS")

    # Implausible Speed (>80 km/h = >22.22 m/s)
    p_speed = VehiclePosition(
        vehicle_id="V_FAST", route_id="R1", latitude=28.6, longitude=77.2,
        speed=30.0, bearing=0.0, timestamp=now, is_speed_suspect=False # 30 m/s = 108 km/h
    )
    res_speed = val_chain.evaluate(p_speed, ctx)
    assert not res_speed.valid and res_speed.failed_rule == "ERR_SPEED_IMPLAUSIBLE", f"Expected ERR_SPEED_IMPLAUSIBLE, got {res_speed}"
    print("  [OK] 108 km/h speed correctly rejected: ERR_SPEED_IMPLAUSIBLE")

    # Stale Timestamp (>120s old)
    p_stale = VehiclePosition(
        vehicle_id="V_STALE", route_id="R1", latitude=28.6, longitude=77.2,
        speed=10.0, bearing=0.0, timestamp=now - 300, is_speed_suspect=False
    )
    res_stale = val_chain.evaluate(p_stale, ctx)
    assert not res_stale.valid and res_stale.failed_rule == "ERR_TIMESTAMP_STALE", f"Expected ERR_TIMESTAMP_STALE, got {res_stale}"
    print("  [OK] 300s old timestamp correctly rejected: ERR_TIMESTAMP_STALE")

    # Duplicate Ping
    val_chain.evaluate(p_valid, ctx) # First ping was recorded
    res_dup = val_chain.evaluate(p_valid, ctx) # Second ping with same timestamp
    assert not res_dup.valid and res_dup.failed_rule == "ERR_DUPLICATE_PING", f"Expected ERR_DUPLICATE_PING, got {res_dup}"
    print("  [OK] Immediate duplicate ping correctly rejected: ERR_DUPLICATE_PING")

    # 2. Corrupt Payload Ingestion
    print("\n[Case 2] Parser Malformed/Corrupt Payload Handling")
    corrupt_source = MockSource([
        RawPayload(source="gtfs_rt", payload=b"corrupt"),
        RawPayload(source="unknown_transport", payload=b"unknown"),
        RawPayload(source="gtfs_rt", payload=b"valid")
    ])
    p_good = VehiclePosition(
        vehicle_id="V_RECOVER", route_id="R1", latitude=28.6, longitude=77.2,
        speed=10.0, bearing=0.0, timestamp=int(time.time()), is_speed_suspect=False
    )
    parsers = ParserRegistry([MockParser([p_good])])
    critical_sink = WorkingCriticalSink()
    engine = IngestionEngine(
        source=corrupt_source,
        parsers=parsers,
        validation=ValidationChain([]),
        sink=critical_sink,
        metrics=InMemoryMetricsRecorder(),
        batch_size=1,
    )
    await engine.run()
    assert critical_sink.written_count == 1, f"Expected 1 valid position written despite corrupt payloads, got {critical_sink.written_count}"
    print("  [OK] Corrupt payloads safely skipped without aborting stream pipeline")

    # 3. FanOut Non-Critical Sink Failure Resilience
    print("\n[Case 3] Non-Critical Postgres Failure with Working Redis")
    non_crit_fail_sink = FailingNonCriticalSink()
    crit_work_sink = WorkingCriticalSink()
    fan_out = FanOutSink([crit_work_sink, non_crit_fail_sink])
    assert fan_out.is_critical, "FanOut with a critical child must be critical"

    res_fanout = await fan_out.write([p_good])
    assert res_fanout.written_count == 1, f"Expected written_count=1 from working critical sink, got {res_fanout.written_count}"
    assert len(res_fanout.errors) == 1, f"Expected 1 non-critical error recorded, got {res_fanout.errors}"
    print("  [OK] Non-critical Postgres archive failure did NOT abort live Redis write")

    print("\n" + "=" * 70)
    print("INGESTION WORKER QA SUITE: ALL EDGE CASES PASSED")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_edge_case_suite())
