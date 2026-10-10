"""Delhi OTD Data Collector (Appendix A.1).

Polls VehiclePositions.pb from Delhi OTD and archives raw JSON snapshots per run under otd_data/.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from google.transit import gtfs_realtime_pb2

# Add service directory to sys.path
service_dir = Path(__file__).resolve().parents[1]
if str(service_dir) not in sys.path:
    sys.path.insert(0, str(service_dir))

workspace_dir = Path(__file__).resolve().parents[3]
shared_dir = workspace_dir / "shared" / "python"
if str(shared_dir) not in sys.path:
    sys.path.insert(0, str(shared_dir))

from adapters.feed_client import DelhiOtdFeedClient, IOTDFeedClient  # noqa: E402
from config import load_settings  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("otd_collector")


def decode_feed_to_dict(raw_bytes: bytes) -> tuple[int, list[dict[str, Any]]]:
    """Decodes FeedMessage protobuf into structured vehicle dictionaries."""
    feed = gtfs_realtime_pb2.FeedMessage()
    feed.ParseFromString(raw_bytes)

    vehicles: list[dict[str, Any]] = []
    feed_timestamp = int(feed.header.timestamp) if feed.header.HasField("timestamp") else int(datetime.now().timestamp())

    for entity in feed.entity:
        if not entity.HasField("vehicle"):
            continue

        v = entity.vehicle
        pos_dict: dict[str, Any] = {}
        if v.HasField("position"):
            pos_dict = {
                "latitude": float(v.position.latitude),
                "longitude": float(v.position.longitude),
                "bearing": float(v.position.bearing) if v.position.HasField("bearing") else 0.0,
                "speed": float(v.position.speed) if v.position.HasField("speed") else 0.0,
            }

        trip_dict: dict[str, Any] = {}
        if v.HasField("trip"):
            trip_dict = {
                "trip_id": v.trip.trip_id if v.trip.HasField("trip_id") else None,
                "route_id": v.trip.route_id if v.trip.HasField("route_id") else None,
                "direction_id": int(v.trip.direction_id) if v.trip.HasField("direction_id") else None,
            }

        veh_dict: dict[str, Any] = {}
        if v.HasField("vehicle"):
            veh_dict = {
                "id": v.vehicle.id if v.vehicle.HasField("id") else None,
                "label": v.vehicle.label if v.vehicle.HasField("label") else None,
                "license_plate": v.vehicle.license_plate if v.vehicle.HasField("license_plate") else None,
            }

        ts = int(v.timestamp) if v.HasField("timestamp") and v.timestamp > 0 else feed_timestamp

        vehicles.append({
            "entity_id": entity.id,
            "vehicle": veh_dict,
            "trip": trip_dict,
            "position": pos_dict,
            "timestamp": ts,
        })

    return feed_timestamp, vehicles


class OtdCollector:
    """Manages periodic polling of Delhi OTD and disk archiving."""

    def __init__(
        self,
        feed_client: IOTDFeedClient,
        output_dir: Path | str = "otd_data",
        poll_interval_seconds: int = 10,
    ) -> None:
        self.feed_client = feed_client
        self.output_dir = Path(output_dir)
        self.poll_interval = poll_interval_seconds
        self.output_dir.mkdir(parents=True, exist_ok=True)

    async def run_collection(self, max_polls: int | None = None) -> Path:
        run_start = datetime.now()
        timestamp_str = run_start.strftime("%Y%m%d_%H%M%S")
        run_file = self.output_dir / f"otd_snapshot_{timestamp_str}.json"

        data: dict[str, Any] = {
            "started_at": run_start.isoformat(),
            "snapshots": [],
        }

        logger.info("Starting OTD collection into %s every %ds", run_file, self.poll_interval)
        polls_completed = 0

        try:
            while max_polls is None or polls_completed < max_polls:
                try:
                    raw_bytes = await self.feed_client.fetch_feed()
                    collected_at = datetime.now().isoformat()
                    _, vehicles = decode_feed_to_dict(raw_bytes)

                    snapshot = {
                        "collected_at": collected_at,
                        "vehicle_count": len(vehicles),
                        "vehicles": vehicles,
                    }
                    data["snapshots"].append(snapshot)
                    polls_completed += 1
                    logger.info("Captured snapshot #%d: %d vehicles", polls_completed, len(vehicles))

                    # Atomic or periodic write
                    run_file.write_text(json.dumps(data, indent=2), encoding="utf-8")
                except Exception as exc:
                    logger.warning("Error during collection poll: %s", exc)

                if max_polls is not None and polls_completed >= max_polls:
                    break

                await asyncio.sleep(self.poll_interval)
        finally:
            await self.feed_client.close()

        return run_file


async def main_async() -> None:
    parser = argparse.ArgumentParser(description="Delhi OTD Feed Collector (Appendix A.1)")
    parser.add_argument("--output-dir", default="otd_data", help="Directory for snapshot JSONs")
    parser.add_argument("--interval", type=int, default=10, help="Poll interval in seconds")
    parser.add_argument("--max-polls", type=int, default=None, help="Maximum number of polls to execute")
    args = parser.parse_args()

    settings = load_settings()
    client = DelhiOtdFeedClient(
        feed_url=settings.delhi_otd_feed_url,
        api_key=settings.delhi_otd_api_key,
        timeout=settings.http_timeout_seconds,
    )
    collector = OtdCollector(
        feed_client=client,
        output_dir=args.output_dir,
        poll_interval_seconds=args.interval or settings.otd_poll_interval_seconds,
    )
    await collector.run_collection(max_polls=args.max_polls)


def main() -> None:
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
