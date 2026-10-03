"""Pure GTFS-Realtime Protobuf feed parser.

Converts google.transit.gtfs_realtime_pb2.FeedMessage into canonical
VehiclePosition domain models without performing any network or database I/O.
"""

from __future__ import annotations

import logging
import time

from google.protobuf.message import DecodeError
from google.transit import gtfs_realtime_pb2

from ecotransit_shared.contracts.ingestion import IParser
from ecotransit_shared.schemas import RawPayload, VehiclePosition

logger = logging.getLogger("ingestion.parser.gtfs_rt")


class GtfsProtobufParser(IParser):
    """Pure parser decoding GTFS-RT Protobuf feeds into canonical VehiclePosition objects."""

    def supports(self, payload: RawPayload) -> bool:
        return (payload.source in ("gtfs-rt", "gtfs_realtime", "otd")) or (
            isinstance(payload.payload, (bytes, bytearray)) and len(payload.payload) > 0
        )

    def parse(self, payload: RawPayload) -> list[VehiclePosition]:
        raw_bytes: bytes
        if isinstance(payload.payload, bytes):
            raw_bytes = payload.payload
        elif isinstance(payload.payload, bytearray):
            raw_bytes = bytes(payload.payload)
        else:
            raise ValueError(f"GtfsProtobufParser requires bytes payload, got {type(payload.payload)}")

        feed = gtfs_realtime_pb2.FeedMessage()
        try:
            feed.ParseFromString(raw_bytes)
        except DecodeError as exc:
            raise ValueError(f"Corrupt or non-Protobuf GTFS-RT payload: {exc}") from exc

        feed_timestamp = int(feed.header.timestamp) if feed.header.HasField("timestamp") else int(time.time())
        results: list[VehiclePosition] = []

        for entity in feed.entity:
            if not entity.HasField("vehicle"):
                continue

            v = entity.vehicle
            if not v.HasField("position"):
                continue

            # 1. Resolve vehicle identifier (must be present per Appendix A.2 Step 2)
            vehicle_id: str | None = None
            if v.HasField("vehicle") and v.vehicle.id:
                vehicle_id = str(v.vehicle.id).strip()
            elif entity.id:
                vehicle_id = str(entity.id).strip()

            if not vehicle_id:
                continue

            # 2. Resolve coordinates (must be valid floats per Appendix A.2 Step 1)
            try:
                lat = float(v.position.latitude)
                lon = float(v.position.longitude)
            except (ValueError, TypeError):
                continue

            # 3. Resolve route & trip
            route_id = ""
            trip_id: str | None = None
            if v.HasField("trip"):
                if v.trip.route_id:
                    route_id = str(v.trip.route_id).strip()
                if v.trip.trip_id:
                    trip_id = str(v.trip.trip_id).strip()

            # 4. Resolve speed & bearing
            speed: float | None = None
            if v.position.HasField("speed"):
                speed = float(v.position.speed)

            bearing: float | None = None
            if v.position.HasField("bearing"):
                bearing = float(v.position.bearing)

            # 5. Speed suspect flag (Appendix A.2: speed is null, <= 0, or > 34 m/s ~120 km/h)
            is_speed_suspect = (speed is None) or (speed <= 0.0) or (speed > 34.0)

            # 6. Authoritative GPS timestamp
            timestamp = int(v.timestamp) if v.HasField("timestamp") and v.timestamp > 0 else feed_timestamp

            record = VehiclePosition(
                vehicle_id=vehicle_id,
                route_id=route_id,
                trip_id=trip_id,
                latitude=lat,
                longitude=lon,
                bearing=bearing,
                speed=speed,
                timestamp=timestamp,
                is_speed_suspect=is_speed_suspect,
                raw=None,
            )
            results.append(record)

        return results
