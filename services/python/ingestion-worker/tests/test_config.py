"""Unit tests for IngestionWorkerSettings and load_settings configuration module."""

from __future__ import annotations

import pytest
from config import IngestionWorkerSettings, load_settings


def test_ingestion_worker_settings_defaults() -> None:
    """Verifies default values for ingestion worker settings."""
    settings = load_settings()

    assert settings.delhi_otd_feed_url == "https://otd.delhi.gov.in/api/realtime/VehiclePositions.pb"
    assert settings.otd_poll_interval_seconds == 10
    assert settings.http_timeout_seconds == 10.0
    assert settings.max_retries == 3
    assert settings.backoff_factor == 1.5
    assert settings.redis_ttl_seconds == 45
    assert settings.batch_size == 100
    assert settings.flush_interval_ms == 2000
    assert settings.max_age_seconds == 120
    assert settings.max_speed_kmh == 80.0

    # Delhi bounding box checks
    assert settings.delhi_bbox_min_lat == 28.30
    assert settings.delhi_bbox_max_lat == 28.95
    assert settings.delhi_bbox_min_lon == 76.80
    assert settings.delhi_bbox_max_lon == 77.55


def test_ingestion_worker_settings_custom_overrides(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verifies environment variable overrides for worker settings."""
    monkeypatch.setenv("DELHI_OTD_FEED_URL", "https://custom.endpoint/feed.pb")
    monkeypatch.setenv("OTD_POLL_INTERVAL_SECONDS", "15")
    monkeypatch.setenv("INGESTION_BATCH_SIZE", "500")
    monkeypatch.setenv("INGESTION_MAX_SPEED_KMH", "100.0")

    settings = IngestionWorkerSettings()
    assert settings.delhi_otd_feed_url == "https://custom.endpoint/feed.pb"
    assert settings.otd_poll_interval_seconds == 15
    assert settings.batch_size == 500
    assert settings.max_speed_kmh == 100.0
