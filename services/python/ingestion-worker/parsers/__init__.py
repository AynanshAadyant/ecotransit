"""Parsers module for transforming raw protocol payloads into canonical domain models."""

from .gtfs_protobuf import GtfsProtobufParser

__all__ = ["GtfsProtobufParser"]
