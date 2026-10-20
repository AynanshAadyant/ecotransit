"""Sinks module for persisting vehicle positions to hot caches and durable archives."""

from .csv_sink import CsvSink, CsvSnapshotSink
from .fan_out import FanOutSink
from .postgres_sink import PostgresArchiveSink
from .redis_sink import RedisPositionSink

__all__ = [
    "RedisPositionSink",
    "PostgresArchiveSink",
    "FanOutSink",
    "CsvSink",
    "CsvSnapshotSink",
]
