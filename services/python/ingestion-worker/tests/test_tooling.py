"""Unit tests for the Appendix A tooling scripts (otd_collector, combine_otd_snapshots)."""

from __future__ import annotations

import json
import tempfile
import time
from pathlib import Path

import pytest
from tests.conftest import MockFeedClient, make_sample_protobuf
from tooling.combine_otd_snapshots import combine_snapshots
from tooling.otd_collector import OtdCollector, decode_feed_to_dict


def test_otd_collector_decode_feed() -> None:
    proto = make_sample_protobuf([
        {
            "entity_id": "ent_test",
            "vehicle_id": "DL1PC3333",
            "route_id": "419",
            "lat": 28.6139,
            "lon": 77.2090,
            "speed": 8.5,
            "bearing": 180.0,
            "timestamp": 1700000000,
        }
    ])

    ts, vehicles = decode_feed_to_dict(proto)
    assert len(vehicles) == 1
    v = vehicles[0]
    assert v["entity_id"] == "ent_test"
    assert v["vehicle"]["id"] == "DL1PC3333"
    assert v["trip"]["route_id"] == "419"
    assert pytest.approx(v["position"]["latitude"], rel=1e-4) == 28.6139
    assert pytest.approx(v["position"]["speed"], rel=1e-4) == 8.5


@pytest.mark.asyncio
async def test_otd_collector_file_archiving() -> None:
    proto = make_sample_protobuf([{"vehicle_id": "DL1PC7777", "lat": 28.61, "lon": 77.21}])
    feed_client = MockFeedClient([proto])

    with tempfile.TemporaryDirectory() as tmp_dir:
        collector = OtdCollector(
            feed_client=feed_client,
            output_dir=tmp_dir,
            poll_interval_seconds=0.05,
        )
        run_file = await collector.run_collection(max_polls=2)
        assert run_file.exists()

        content = json.loads(run_file.read_text(encoding="utf-8"))
        assert "started_at" in content
        assert len(content["snapshots"]) == 2
        assert content["snapshots"][0]["vehicle_count"] == 1


def test_combine_otd_snapshots_pipeline() -> None:
    now_ts = int(time.time())
    with tempfile.TemporaryDirectory() as tmp_dir:
        input_dir = Path(tmp_dir) / "snapshots"
        input_dir.mkdir()
        output_csv = Path(tmp_dir) / "cleaned.csv"

        snapshot_data = {
            "started_at": "2026-10-02T12:00:00",
            "snapshots": [
                {
                    "collected_at": "2026-10-02T12:00:10",
                    "vehicle_count": 5,
                    "vehicles": [
                        # 1. Valid normal vehicle
                        {
                            "entity_id": "e_valid",
                            "vehicle": {"id": "BUS_VALID", "label": "B1"},
                            "trip": {"route_id": "419"},
                            "position": {"latitude": 28.6139, "longitude": 77.2090, "speed": 12.0, "bearing": 90.0},
                            "timestamp": now_ts,
                        },
                        # 2. Missing vehicle ID (should be dropped in stage 2)
                        {
                            "entity_id": "e_no_id",
                            "vehicle": {"id": None},
                            "trip": {"route_id": "419"},
                            "position": {"latitude": 28.6139, "longitude": 77.2090, "speed": 10.0},
                            "timestamp": now_ts,
                        },
                        # 3. Out of bounds (should be dropped in stage 3)
                        {
                            "entity_id": "e_out",
                            "vehicle": {"id": "BUS_OUT"},
                            "trip": {"route_id": "419"},
                            "position": {"latitude": 19.0, "longitude": 72.8, "speed": 10.0},
                            "timestamp": now_ts,
                        },
                        # 4. Duplicate of BUS_VALID at identical timestamp (should be deduplicated in stage 4)
                        {
                            "entity_id": "e_dup",
                            "vehicle": {"id": "BUS_VALID"},
                            "trip": {"route_id": "419"},
                            "position": {"latitude": 28.6139, "longitude": 77.2090, "speed": 12.0},
                            "timestamp": now_ts,
                        },
                        # 5. Suspect speed (speed 0.0 -> flagged, not dropped in stage 6)
                        {
                            "entity_id": "e_suspect",
                            "vehicle": {"id": "BUS_SUSPECT"},
                            "trip": {"route_id": "419"},
                            "position": {"latitude": 28.62, "longitude": 77.22, "speed": 0.0},
                            "timestamp": now_ts + 5,
                        },
                    ],
                }
            ],
        }

        test_file = input_dir / "snap_1.json"
        test_file.write_text(json.dumps(snapshot_data), encoding="utf-8")

        df = combine_snapshots(input_dir=input_dir, output_csv=output_csv)
        assert output_csv.exists()
        assert len(df) == 2  # BUS_VALID and BUS_SUSPECT survived

        row_valid = df[df["vehicle_id"] == "BUS_VALID"].iloc[0]
        row_suspect = df[df["vehicle_id"] == "BUS_SUSPECT"].iloc[0]

        assert not bool(row_valid["is_speed_suspect"])
        assert bool(row_suspect["is_speed_suspect"])
        assert "gtfs_datetime_ist" in df.columns
