"""Unit tests for the GtfsProtobufParser."""

from __future__ import annotations

import pytest
from parsers.gtfs_protobuf import GtfsProtobufParser
from tests.conftest import make_sample_protobuf

from ecotransit_shared.schemas import RawPayload


def test_gtfs_protobuf_parser_valid_payload() -> None:
    parser = GtfsProtobufParser()
    proto_bytes = make_sample_protobuf([
        {
            "entity_id": "e_01",
            "vehicle_id": "DL1PC5555",
            "route_id": "419",
            "trip_id": "trip_001",
            "lat": 28.6139,
            "lon": 77.2090,
            "speed": 12.0,
            "bearing": 90.0,
            "timestamp": 1700000000,
        }
    ])

    payload = RawPayload(source="gtfs-rt", payload=proto_bytes)
    assert parser.supports(payload) is True

    positions = parser.parse(payload)
    assert len(positions) == 1
    pos = positions[0]
    assert pos.vehicle_id == "DL1PC5555"
    assert pos.route_id == "419"
    assert pos.trip_id == "trip_001"
    assert pytest.approx(pos.latitude, rel=1e-4) == 28.6139
    assert pytest.approx(pos.longitude, rel=1e-4) == 77.2090
    assert pytest.approx(pos.speed, rel=1e-4) == 12.0
    assert pos.bearing == 90.0
    assert pos.timestamp == 1700000000
    assert pos.is_speed_suspect is False


def test_gtfs_protobuf_parser_speed_suspect_flagging() -> None:
    parser = GtfsProtobufParser()
    # Entity 1: speed 0.0 (suspect per Appendix A.2)
    # Entity 2: speed > 34 m/s (suspect ~125 km/h)
    # Entity 3: normal speed 10.5 m/s
    proto_bytes = make_sample_protobuf([
        {
            "entity_id": "e_zero",
            "vehicle_id": "BUS_ZERO",
            "lat": 28.60,
            "lon": 77.20,
            "speed": 0.0,
        },
        {
            "entity_id": "e_fast",
            "vehicle_id": "BUS_FAST",
            "lat": 28.60,
            "lon": 77.20,
            "speed": 35.0,
        },
        {
            "entity_id": "e_normal",
            "vehicle_id": "BUS_NORM",
            "lat": 28.60,
            "lon": 77.20,
            "speed": 10.5,
        },
    ])

    payload = RawPayload(source="gtfs-rt", payload=proto_bytes)
    positions = parser.parse(payload)
    assert len(positions) == 3

    p_zero = next(p for p in positions if p.vehicle_id == "BUS_ZERO")
    p_fast = next(p for p in positions if p.vehicle_id == "BUS_FAST")
    p_norm = next(p for p in positions if p.vehicle_id == "BUS_NORM")

    assert p_zero.is_speed_suspect is True
    assert p_fast.is_speed_suspect is True
    assert p_norm.is_speed_suspect is False


def test_gtfs_protobuf_parser_skips_missing_mandatory_fields() -> None:
    parser = GtfsProtobufParser()
    # Entity 1: missing vehicle ID (must be dropped)
    # Entity 2: missing lat/lon (must be dropped)
    # Entity 3: valid
    proto_bytes = make_sample_protobuf([
        {
            "entity_id": "",
            "vehicle_id": None,
            "lat": 28.60,
            "lon": 77.20,
        },
        {
            "entity_id": "e_no_coords",
            "vehicle_id": "BUS_NO_COORDS",
            "lat": None,
            "lon": None,
        },
        {
            "entity_id": "e_valid",
            "vehicle_id": "BUS_VALID",
            "lat": 28.60,
            "lon": 77.20,
        },
    ])

    payload = RawPayload(source="gtfs-rt", payload=proto_bytes)
    positions = parser.parse(payload)
    assert len(positions) == 1
    assert positions[0].vehicle_id == "BUS_VALID"


def test_gtfs_protobuf_parser_corrupt_payload_raises() -> None:
    parser = GtfsProtobufParser()
    payload = RawPayload(source="gtfs-rt", payload=b"this_is_not_protobuf")
    with pytest.raises(ValueError, match="Corrupt or non-Protobuf"):
        parser.parse(payload)
