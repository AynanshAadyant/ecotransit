"""Unit tests for InMemoryMetricsRecorder metrics tracking component."""

from __future__ import annotations

from metrics import InMemoryMetricsRecorder


def test_in_memory_metrics_recorder_pipeline_tracking() -> None:
    """Verifies metrics recording across all pipeline stages."""
    recorder = InMemoryMetricsRecorder()

    recorder.record_payload_received("gtfs-rt", 1024)
    recorder.record_positions_parsed("gtfs-rt", 10)
    recorder.record_validation_passed(8)
    recorder.record_validation_rejected("ERR_GEO_OUT_OF_BOUNDS", 2)
    recorder.record_batch_flushed(8, 15.5)
    recorder.record_sink_write("RedisPositionSink", 8, 12.0, success=True)
    recorder.record_sink_write("PostgresArchiveSink", 8, 3.5, success=False)

    snapshot = recorder.get_snapshot()

    assert snapshot["payloads_received"] == 1
    assert snapshot["bytes_received"] == 1024
    assert snapshot["positions_parsed"] == 10
    assert snapshot["validation_passed"] == 8
    assert snapshot["validation_rejected"] == {"ERR_GEO_OUT_OF_BOUNDS": 2}
    assert snapshot["batches_flushed"] == 1
    assert snapshot["total_flushed_count"] == 8

    redis_stats = snapshot["sink_writes"]["RedisPositionSink"]
    assert redis_stats["success_count"] == 1
    assert redis_stats["items_written"] == 8

    pg_stats = snapshot["sink_writes"]["PostgresArchiveSink"]
    assert pg_stats["error_count"] == 1
    assert pg_stats["items_written"] == 0
