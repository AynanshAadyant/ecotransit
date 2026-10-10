"""Configuration for the EcoTransit Ingestion Worker service.

Loads strictly from environment variables (.env) with Pydantic validation.
"""

from __future__ import annotations

from pathlib import Path

from dotenv import find_dotenv, load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from ecotransit_shared.config import DatabaseSettings, RedisSettings

# Locate root .env relative to this service file
WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
ENV_FILE_PATH = WORKSPACE_ROOT / ".env"
_env_file = str(ENV_FILE_PATH) if ENV_FILE_PATH.exists() else find_dotenv()
if _env_file:
    load_dotenv(_env_file, override=False)


class IngestionWorkerSettings(BaseSettings):
    """Complete configuration settings for the ingestion worker."""

    model_config = SettingsConfigDict(
        env_file=_env_file or None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database & Redis Settings
    db: DatabaseSettings = Field(default_factory=DatabaseSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)

    # Delhi OTD GTFS-RT feed settings
    delhi_otd_feed_url: str = Field(
        default="https://otd.delhi.gov.in/api/realtime/VehiclePositions.pb",
        alias="DELHI_OTD_FEED_URL",
    )
    delhi_otd_api_key: str | None = Field(
        default=None,
        alias="DELHI_OTD_API_KEY",
    )
    otd_poll_interval_seconds: int = Field(
        default=10,
        alias="OTD_POLL_INTERVAL_SECONDS",
    )
    http_timeout_seconds: float = Field(
        default=10.0,
        alias="HTTP_TIMEOUT_SECONDS",
    )
    max_retries: int = Field(
        default=3,
        alias="INGESTION_MAX_RETRIES",
    )
    backoff_factor: float = Field(
        default=1.5,
        alias="INGESTION_BACKOFF_FACTOR",
    )

    # Pipeline tuning
    redis_ttl_seconds: int = Field(
        default=45,
        alias="REDIS_TTL_SECONDS",
    )
    batch_size: int = Field(
        default=100,
        alias="INGESTION_BATCH_SIZE",
    )
    flush_interval_ms: int = Field(
        default=2000,
        alias="INGESTION_FLUSH_INTERVAL_MS",
    )

    # Domain Validation thresholds
    max_age_seconds: int = Field(
        default=120,
        alias="INGESTION_MAX_AGE_SECONDS",
    )
    max_speed_kmh: float = Field(
        default=80.0,
        alias="INGESTION_MAX_SPEED_KMH",
    )

    # Delhi NCR Bounding Box (28.30-28.95 N, 76.80-77.55 E)
    delhi_bbox_min_lat: float = 28.30
    delhi_bbox_max_lat: float = 28.95
    delhi_bbox_min_lon: float = 76.80
    delhi_bbox_max_lon: float = 77.55


def load_settings() -> IngestionWorkerSettings:
    """Loads and validates settings from .env and os.environ."""
    return IngestionWorkerSettings()
