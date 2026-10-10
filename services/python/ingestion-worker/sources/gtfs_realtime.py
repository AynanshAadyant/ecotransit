"""GTFS-Realtime Polling Source using the IOTDFeedClient abstraction layer."""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import AsyncIterator

from adapters.feed_client import IOTDFeedClient

from ecotransit_shared.contracts.ingestion import ISource
from ecotransit_shared.schemas import RawPayload

logger = logging.getLogger("ingestion.source.gtfs_rt")


class GtfsRealtimeSource(ISource):
    """Polling source adapter for GTFS-RT Protobuf feeds.

    Re-connects internally and keeps yielding without raising on transient network failures.
    """

    def __init__(
        self,
        feed_client: IOTDFeedClient,
        poll_interval_seconds: float = 10.0,
        name: str = "gtfs-rt",
    ) -> None:
        self._feed_client = feed_client
        self._poll_interval = poll_interval_seconds
        self._name = name
        self._running = False
        self._stop_event = asyncio.Event()

    @property
    def name(self) -> str:
        return self._name

    async def open(self) -> None:
        self._running = True
        self._stop_event.clear()
        logger.info("Opened %s source with %.1fs polling interval", self._name, self._poll_interval)

    async def stream(self) -> AsyncIterator[RawPayload]:
        self._running = True
        self._stop_event.clear()

        while self._running:
            try:
                raw_bytes = await self._feed_client.fetch_feed()
                if raw_bytes:
                    yield RawPayload(
                        source=self._name,
                        timestamp=time.time(),
                        payload=raw_bytes,
                        metadata={"size_bytes": len(raw_bytes)},
                    )
            except Exception as exc:
                # Do not raise on transient network/feed errors; log and retry next cycle
                logger.warning("Feed fetch error in %s: %s. Retrying next cycle...", self._name, exc)

            if not self._running:
                break

            import contextlib
            with contextlib.suppress(TimeoutError):
                # Wait for poll interval or until close() is signaled
                await asyncio.wait_for(self._stop_event.wait(), timeout=self._poll_interval)

    async def close(self) -> None:
        self._running = False
        self._stop_event.set()
        await self._feed_client.close()
        logger.info("Closed %s source", self._name)
