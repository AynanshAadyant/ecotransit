"""Unit tests for Validation rules and the short-circuiting ValidationChain."""

from __future__ import annotations

import time

from validation.chain import ValidationChain
from validation.rules import (
    CoordinateBoundsRule,
    DuplicatePingRule,
    SpeedPlausibilityRule,
    TimestampFreshnessRule,
)

from ecotransit_shared.schemas import ValidationContext, VehiclePosition


def make_valid_pos(
    vehicle_id: str = "DL1PC1001",
    lat: float = 28.6139,
    lon: float = 77.2090,
    speed: float | None = 10.0,
    timestamp: int | None = None,
) -> VehiclePosition:
    return VehiclePosition(
        vehicle_id=vehicle_id,
        route_id="419",
        latitude=lat,
        longitude=lon,
        speed=speed,
        timestamp=timestamp or int(time.time()),
    )


def test_coordinate_bounds_rule() -> None:
    rule = CoordinateBoundsRule(min_lat=28.30, max_lat=28.95, min_lon=76.80, max_lon=77.55)
    ctx = ValidationContext(received_at=time.time())

    # Valid Delhi coordinate
    assert rule.check(make_valid_pos(lat=28.6139, lon=77.2090), ctx).passed is True

    # Out of bounds coordinate (Mumbai)
    out_pos = make_valid_pos(lat=19.0760, lon=72.8777)
    outcome = rule.check(out_pos, ctx)
    assert outcome.passed is False
    assert outcome.code == "ERR_GEO_OUT_OF_BOUNDS"

    # Glitch (0, 0)
    glitch_pos = make_valid_pos(lat=0.0, lon=0.0)
    assert rule.check(glitch_pos, ctx).passed is False


def test_speed_plausibility_rule() -> None:
    rule = SpeedPlausibilityRule(max_kmh=80.0)  # ~22.2 m/s
    ctx = ValidationContext(received_at=time.time())

    # 15 m/s = 54 km/h -> plausible
    assert rule.check(make_valid_pos(speed=15.0), ctx).passed is True

    # 25 m/s = 90 km/h -> exceeds 80 km/h
    outcome = rule.check(make_valid_pos(speed=25.0), ctx)
    assert outcome.passed is False
    assert outcome.code == "ERR_SPEED_IMPLAUSIBLE"

    # None speed is allowed (passes validation, handled as suspect downstream)
    assert rule.check(make_valid_pos(speed=None), ctx).passed is True


def test_timestamp_freshness_rule() -> None:
    rule = TimestampFreshnessRule(max_age_s=120)
    now = time.time()
    ctx = ValidationContext(received_at=now)

    # 30 seconds old -> fresh
    assert rule.check(make_valid_pos(timestamp=int(now - 30)), ctx).passed is True

    # 300 seconds old -> stale
    outcome = rule.check(make_valid_pos(timestamp=int(now - 300)), ctx)
    assert outcome.passed is False
    assert outcome.code == "ERR_TIMESTAMP_STALE"

    # 120 seconds in future -> drift
    future_outcome = rule.check(make_valid_pos(timestamp=int(now + 120)), ctx)
    assert future_outcome.passed is False
    assert future_outcome.code == "ERR_TIMESTAMP_STALE"


def test_duplicate_ping_rule() -> None:
    rule = DuplicatePingRule()
    ctx = ValidationContext(received_at=time.time())
    ts = 1700000000

    pos1 = make_valid_pos(vehicle_id="BUS_DUP", timestamp=ts)
    # First ping passes
    assert rule.check(pos1, ctx).passed is True

    # Identical ping duplicate fails
    outcome = rule.check(pos1, ctx)
    assert outcome.passed is False
    assert outcome.code == "ERR_DUPLICATE_PING"

    # Newer ping passes
    pos2 = make_valid_pos(vehicle_id="BUS_DUP", timestamp=ts + 10)
    assert rule.check(pos2, ctx).passed is True


def test_validation_chain_short_circuiting() -> None:
    bounds_rule = CoordinateBoundsRule(min_lat=28.30, max_lat=28.95, min_lon=76.80, max_lon=77.55)
    speed_rule = SpeedPlausibilityRule(max_kmh=80.0)
    dup_rule = DuplicatePingRule()

    chain = ValidationChain([bounds_rule, speed_rule, dup_rule])
    ctx = ValidationContext(received_at=time.time())

    # 1. Fully valid position
    valid_res = chain.evaluate(make_valid_pos(lat=28.6139, lon=77.2090, speed=10.0), ctx)
    assert valid_res.valid is True
    assert valid_res.failed_rule is None

    # 2. Position that violates both bounds and speed
    # Must short-circuit on the first rule (bounds)
    bad_pos = make_valid_pos(lat=10.0, lon=10.0, speed=100.0)
    bad_res = chain.evaluate(bad_pos, ctx)
    assert bad_res.valid is False
    assert bad_res.failed_rule == "ERR_GEO_OUT_OF_BOUNDS"
