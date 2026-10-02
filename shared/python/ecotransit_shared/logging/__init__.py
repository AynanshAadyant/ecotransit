"""Structured JSON logging factory matching the TypeScript JSON log schema."""

from __future__ import annotations

import datetime
import json
import logging
import sys
from typing import Any


class JsonFormatter(logging.Formatter):
    """Formats log records as JSON lines."""

    def __init__(self, service_name: str) -> None:
        super().__init__()
        self.service_name = service_name

    def format(self, record: logging.LogRecord) -> str:
        log_payload: dict[str, Any] = {
            "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
            "level": record.levelname.lower(),
            "service": self.service_name,
            "message": record.getMessage(),
        }

        if hasattr(record, "correlation_id"):
            log_payload["correlation_id"] = record.correlation_id

        if record.exc_info:
            log_payload["exception"] = self.formatException(record.exc_info)

        # Merge any extra attributes passed via extra={}
        for key, val in record.__dict__.items():
            if key not in {
                "name", "msg", "args", "levelname", "levelno", "pathname", "filename",
                "module", "exc_info", "exc_text", "stack_info", "lineno", "funcName",
                "created", "msecs", "relativeCreated", "thread", "threadName",
                "processName", "process", "message", "service_name", "correlation_id",
            }:
                log_payload[key] = val

        return json.dumps(log_payload, default=str)


def create_logger(service_name: str, level: str = "INFO") -> logging.Logger:
    """Creates a structured JSON logger for a named service."""
    logger = logging.getLogger(f"ecotransit.{service_name}")
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Avoid duplicate handlers if called multiple times
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JsonFormatter(service_name))
        logger.addHandler(handler)

    logger.propagate = False
    return logger
