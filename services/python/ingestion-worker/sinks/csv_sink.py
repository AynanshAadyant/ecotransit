"""Local CSV Snapshot Sink for periodic telemetry snapshots with file size rotation."""

from __future__ import annotations

import asyncio
import csv
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, TextIO

from ecotransit_shared.contracts.ingestion import ISink
from ecotransit_shared.schemas import HealthStatus, SinkError, SinkResult, VehiclePosition

logger = logging.getLogger("ingestion.sink.csv")

CSV_COLUMNS: list[str] = [
    "timestamp",
    "vehicle_id",
    "route_id",
    "trip_id",
    "latitude",
    "longitude",
    "bearing",
    "speed",
    "nearest_stop_sequence",
    "is_speed_suspect",
]

DEFAULT_MAX_BYTES: int = 200 * 1024 * 1024  # 200 MB


class CsvSink(ISink):
    """Non-critical durable sink writing periodic local snapshots of telemetry to CSV.

    Creates a new timestamp-named file upon sink/ingestion startup, and automatically
    rotates to a new timestamped file whenever the file size reaches or exceeds the
    configured size cap (default 200 MB). Uses an open write stream for streaming writes.
    """

    def __init__(
        self,
        output_dir: Path | str = "data/snapshots",
        max_bytes: int = DEFAULT_MAX_BYTES,
        filename_prefix: str = "telemetry",
    ) -> None:
        self.output_dir = Path(output_dir)
        self.max_bytes = max_bytes
        self.filename_prefix = filename_prefix

        self._lock = asyncio.Lock()
        self._write_stream: TextIO | None = None
        self._csv_writer: Any = None
        self._current_file_path: Path | None = None
        self._rows_written_in_current_file: int = 0
        self._total_rows_written: int = 0
        self._files_created: list[Path] = []

        # Create output directory and initial timestamp-based file on startup
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self._rotate_to_new_file()

    @property
    def is_critical(self) -> bool:
        # Non-critical: file snapshot issues do not disrupt live Redis tracking
        return False

    @property
    def current_file_path(self) -> Path | None:
        return self._current_file_path

    @property
    def files_created(self) -> list[Path]:
        return list(self._files_created)

    @property
    def total_rows_written(self) -> int:
        return self._total_rows_written

    @property
    def current_file_bytes(self) -> int:
        if self._write_stream and not self._write_stream.closed:
            try:
                return self._write_stream.tell()
            except Exception:
                return 0
        return 0

    def _generate_file_path(self) -> Path:
        """Generates a unique timestamp-based filename in the output directory."""
        now = datetime.now(timezone.utc)
        ts_str = now.strftime("%Y%m%d_%H%M%S")
        base_name = f"{self.filename_prefix}_{ts_str}"
        candidate = self.output_dir / f"{base_name}.csv"
        counter = 1
        while candidate.exists():
            candidate = self.output_dir / f"{base_name}_{counter}.csv"
            counter += 1
        return candidate

    def _rotate_to_new_file(self) -> Path:
        """Closes any active write stream and opens a new timestamped CSV file."""
        if self._write_stream and not self._write_stream.closed:
            try:
                self._write_stream.flush()
                self._write_stream.close()
            except Exception as exc:
                logger.warning("Error closing prior CSV write stream: %s", exc)

        new_path = self._generate_file_path()
        stream = open(new_path, mode="w", newline="", encoding="utf-8")
        writer = csv.writer(stream)
        writer.writerow(CSV_COLUMNS)
        stream.flush()

        self._write_stream = stream
        self._csv_writer = writer
        self._current_file_path = new_path
        self._rows_written_in_current_file = 0
        self._files_created.append(new_path)

        logger.info(
            "Created new CSV snapshot file: %s (size cap: %d bytes)",
            new_path,
            self.max_bytes,
        )
        return new_path

    @staticmethod
    def _format_row(pos: VehiclePosition) -> list[Any]:
        return [
            pos.timestamp,
            pos.vehicle_id,
            pos.route_id,
            pos.trip_id if pos.trip_id is not None else "",
            pos.latitude,
            pos.longitude,
            pos.bearing if pos.bearing is not None else "",
            pos.speed if pos.speed is not None else "",
            pos.nearest_stop_sequence if pos.nearest_stop_sequence is not None else "",
            pos.is_speed_suspect,
        ]

    def _write_batch_sync(self, batch: list[VehiclePosition]) -> int:
        """Synchronously writes rows to the active write stream with size cap rotation."""
        if self._write_stream is None or self._write_stream.closed:
            self._rotate_to_new_file()

        written = 0
        for pos in batch:
            # Check if current file reached size cap (and has written at least one row)
            if (
                self._rows_written_in_current_file > 0
                and self._write_stream is not None
                and self._write_stream.tell() >= self.max_bytes
            ):
                self._rotate_to_new_file()

            row = self._format_row(pos)
            self._csv_writer.writerow(row)
            self._rows_written_in_current_file += 1
            self._total_rows_written += 1
            written += 1

        if self._write_stream and not self._write_stream.closed:
            self._write_stream.flush()

        return written

    async def write(self, batch: list[VehiclePosition]) -> SinkResult:
        if not batch:
            return SinkResult(written_count=0)

        async with self._lock:
            try:
                count = await asyncio.to_thread(self._write_batch_sync, batch)
                return SinkResult(written_count=count)
            except Exception as exc:
                logger.error("Failed to write %d positions to CSV snapshot: %s", len(batch), exc)
                return SinkResult(
                    written_count=0,
                    errors=[SinkError(error=f"CsvSink: {exc}")],
                )

    async def health(self) -> HealthStatus:
        async with self._lock:
            is_healthy = self._write_stream is not None and not self._write_stream.closed
            status = "healthy" if is_healthy else "unhealthy"
            current_bytes = self.current_file_bytes

            return HealthStatus(
                status=status,
                details={
                    "sink": "CsvSink",
                    "current_file": str(self._current_file_path) if self._current_file_path else None,
                    "current_size_bytes": current_bytes,
                    "max_bytes": self.max_bytes,
                    "total_rows_written": self._total_rows_written,
                    "files_count": len(self._files_created),
                },
            )

    def close(self) -> None:
        """Closes the underlying write stream cleanly."""
        if self._write_stream and not self._write_stream.closed:
            try:
                self._write_stream.flush()
                self._write_stream.close()
                logger.info("Closed CSV snapshot write stream: %s", self._current_file_path)
            except Exception as exc:
                logger.warning("Error closing CSV write stream: %s", exc)

    async def aclose(self) -> None:
        async with self._lock:
            self.close()

    def __del__(self) -> None:
        try:
            self.close()
        except Exception:
            pass


# Alias for explicit naming
CsvSnapshotSink = CsvSink
