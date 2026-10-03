"""Unit tests for the service-specific abstraction layers (Adapters)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from adapters.feed_client import DelhiOtdFeedClient
from adapters.postgres_store import PostgresArchiveStore
from adapters.redis_store import RedisLiveStore

from ecotransit_shared.schemas import VehiclePosition


@pytest.mark.asyncio
async def test_redis_live_store_adapter_pipeline_calls() -> None:
    """Verifies that RedisLiveStore compiles and executes pipelined commands."""
    mock_pipeline = MagicMock()
    mock_pipeline.execute = AsyncMock(return_value=[True, True, True, True])

    mock_client = MagicMock()
    mock_client.pipeline.return_value = mock_pipeline
    mock_client.ping = AsyncMock(return_value=True)

    store = RedisLiveStore(redis_client=mock_client)

    pos = VehiclePosition(
        vehicle_id="DL1PC1001",
        route_id="419",
        trip_id="trip_99",
        latitude=28.6139,
        longitude=77.2090,
        speed=15.0,
        bearing=180.0,
        timestamp=1700000000,
        is_speed_suspect=False,
    )

    written = await store.save_live_positions([pos], ttl_seconds=45)
    assert written == 1

    # Verify pipeline was populated
    mock_pipeline.hset.assert_called_once()
    assert mock_pipeline.expire.call_count >= 1
    mock_pipeline.geoadd.assert_called_once()
    mock_pipeline.sadd.assert_called_once()
    mock_pipeline.execute.assert_called_once()

    # Verify ping
    assert await store.ping() is True


@pytest.mark.asyncio
async def test_postgres_archive_store_adapter_batch_insert() -> None:
    """Verifies that PostgresArchiveStore executes executemany with matching columns."""
    mock_conn = MagicMock()
    mock_conn.executemany = AsyncMock()
    mock_conn.fetchval = AsyncMock(return_value=1)

    mock_pool = MagicMock()
    mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_pool.acquire.return_value.__aexit__ = AsyncMock()

    store = PostgresArchiveStore(pool=mock_pool)

    pos = VehiclePosition(
        vehicle_id="DL1PC2002",
        route_id="419",
        trip_id="trip_42",
        latitude=28.6139,
        longitude=77.2090,
        speed=10.0,
        bearing=90.0,
        timestamp=1700000000,
        is_speed_suspect=False,
    )

    count = await store.archive_positions([pos])
    assert count == 1
    mock_conn.executemany.assert_called_once()

    assert await store.ping() is True


@pytest.mark.asyncio
async def test_delhi_otd_feed_client_adapter_headers_and_retries() -> None:
    """Verifies DelhiOtdFeedClient injects authentication keys and retries appropriately."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b"fake_proto_bytes"
    mock_response.raise_for_status = MagicMock()

    mock_http_client = MagicMock()
    mock_http_client.get = AsyncMock(return_value=mock_response)
    mock_http_client.is_closed = False

    client = DelhiOtdFeedClient(
        feed_url="https://otd.test.endpoint/feed.pb",
        api_key="secret_test_key_123",
        client=mock_http_client,
    )

    data = await client.fetch_feed()
    assert data == b"fake_proto_bytes"

    # Verify header and param injection
    mock_http_client.get.assert_called_once()
    call_args = mock_http_client.get.call_args
    headers = call_args.kwargs.get("headers", {})
    params = call_args.kwargs.get("params", {})

    assert headers.get("x-api-key") == "secret_test_key_123"
    assert params.get("key") == "secret_test_key_123"
