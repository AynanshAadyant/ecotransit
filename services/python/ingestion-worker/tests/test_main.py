"""Unit tests for pipeline assembly and engine building in main.py."""

from __future__ import annotations

from unittest.mock import MagicMock

from config import load_settings
from engine import IngestionEngine
from main import build_engine
from tests.conftest import MockFeedClient
from ecotransit_shared.logging import create_logger


def test_build_engine_wiring() -> None:
    """Verifies that build_engine constructs an IngestionEngine with all wired components."""
    settings = load_settings()
    mock_redis = MagicMock()
    mock_db_pool = MagicMock()
    logger = create_logger("test-build-engine")
    mock_feed = MockFeedClient()

    engine = build_engine(
        settings=settings,
        redis_client=mock_redis,
        db_pool=mock_db_pool,
        logger=logger,
        custom_feed_client=mock_feed,
    )

    assert isinstance(engine, IngestionEngine)
    assert engine.batch_size == 5000
    assert engine.flush_interval_seconds == settings.flush_interval_ms / 1000.0
