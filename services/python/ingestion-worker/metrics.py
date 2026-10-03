"""Metrics recording interfaces and implementations for the ingestion pipeline."""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from typing import Any


class IMetricsRecorder(ABC):
    """Abstract metrics recorder for pipeline observability."""

    @abstractmethod
    def record_payload_received(self, source: str, size_bytes: int) -> None: ...

    @abstractmethod
    def record_positions_parsed(self, source: str, count: int) -> None: ...

    @abstractmethod
    def record_validation_passed(self, count: int) -> None: ...

    @abstractmethod
    def record_validation_rejected(self, rule_code: str, count: int = 1) -> None: ...

    @abstractmethod
    def record_batch_flushed(self, count: int, duration_ms: float) -> None: ...

    @abstractmethod
    def record_sink_write(
        self, sink_name: str, count: int, duration_ms: float, success: bool
    ) -> None: ...

    @abstractmethod
    def get_snapshot(self) -> dict[str, Any]: ...


class InMemoryMetricsRecorder(IMetricsRecorder):
    """Thread-safe in-memory metrics recorder for runtime and test verification."""

    def __init__(self) -> None:
        self.started_at: float = time.time()
        self.payloads_received: int = 0
        self.bytes_received: int = 0
        self.positions_parsed: int = 0
        self.validation_passed: int = 0
        self.validation_rejected: dict[str, int] = {}
        self.batches_flushed: int = 0
        self.total_flushed_count: int = 0
        self.total_flush_duration_ms: float = 0.0
        self.source_stats: dict[str, dict[str, int]] = {}
        self.sink_writes: dict[str, dict[str, Any]] = {}

    def _ensure_source(self, source: str) -> dict[str, int]:
        if source not in self.source_stats:
            self.source_stats[source] = {"payloads": 0, "positions": 0}
        return self.source_stats[source]

    def record_payload_received(self, source: str, size_bytes: int) -> None:
        self.payloads_received += 1
        self.bytes_received += size_bytes
        self._ensure_source(source)["payloads"] += 1

    def record_positions_parsed(self, source: str, count: int) -> None:
        self.positions_parsed += count
        self._ensure_source(source)["positions"] += count

    def record_validation_passed(self, count: int) -> None:
        self.validation_passed += count

    def record_validation_rejected(self, rule_code: str, count: int = 1) -> None:
        self.validation_rejected[rule_code] = (
            self.validation_rejected.get(rule_code, 0) + count
        )

    def record_batch_flushed(self, count: int, duration_ms: float) -> None:
        self.batches_flushed += 1
        self.total_flushed_count += count
        self.total_flush_duration_ms += duration_ms

    def record_sink_write(
        self, sink_name: str, count: int, duration_ms: float, success: bool
    ) -> None:
        if sink_name not in self.sink_writes:
            self.sink_writes[sink_name] = {
                "success_count": 0,
                "error_count": 0,
                "items_written": 0,
                "total_duration_ms": 0.0,
            }
        stats = self.sink_writes[sink_name]
        if success:
            stats["success_count"] += 1
            stats["items_written"] += count
        else:
            stats["error_count"] += 1
        stats["total_duration_ms"] += duration_ms

    def get_snapshot(self) -> dict[str, Any]:
        return {
            "uptime_seconds": time.time() - self.started_at,
            "payloads_received": self.payloads_received,
            "bytes_received": self.bytes_received,
            "positions_parsed": self.positions_parsed,
            "validation_passed": self.validation_passed,
            "validation_rejected": dict(self.validation_rejected),
            "batches_flushed": self.batches_flushed,
            "total_flushed_count": self.total_flushed_count,
            "sink_writes": {k: dict(v) for k, v in self.sink_writes.items()},
        }
