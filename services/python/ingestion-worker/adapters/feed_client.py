"""Service-specific Delhi OTD Feed HTTP Client Abstraction.

Encapsulates external HTTP transport, authentication (headers/params loaded from env),
and network retry/exponential backoff.
"""

from __future__ import annotations

import asyncio
import logging
from abc import ABC, abstractmethod

import httpx

logger = logging.getLogger("ingestion.adapter.feed")


class IOTDFeedClient(ABC):
    """Abstract Port for acquiring raw GTFS-RT Protobuf feeds from transit authorities."""

    @abstractmethod
    async def fetch_feed(self) -> bytes:
        """Fetches binary protobuf payload from the feed endpoint."""
        ...

    @abstractmethod
    async def ping(self) -> bool:
        """Checks network accessibility of the feed provider."""
        ...

    @abstractmethod
    async def close(self) -> None:
        """Closes the underlying HTTP client session."""
        ...


class DelhiOtdFeedClient(IOTDFeedClient):
    """Concrete Adapter implementing IOTDFeedClient using httpx with environment secrets."""

    def __init__(
        self,
        feed_url: str,
        api_key: str | None = None,
        timeout: float = 10.0,
        max_retries: int = 3,
        backoff_factor: float = 1.5,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._feed_url = feed_url
        self._api_key = api_key
        self._timeout = timeout
        self._max_retries = max_retries
        self._backoff_factor = backoff_factor
        self._external_client = client is not None
        self._client = client or httpx.AsyncClient(timeout=timeout)

    def _build_request_params(self) -> tuple[dict[str, str], dict[str, str]]:
        headers: dict[str, str] = {
            "User-Agent": "EcoTransit-IngestionWorker/1.0",
            "Accept": "application/x-protobuf, application/octet-stream, */*",
        }
        params: dict[str, str] = {}
        if self._api_key:
            # Delhi OTD accepts key as query parameter or header depending on endpoint
            headers["x-api-key"] = self._api_key
            params["key"] = self._api_key
        return headers, params

    async def fetch_feed(self) -> bytes:
        headers, params = self._build_request_params()
        url = self._feed_url + ("?key=" + self._api_key if self._api_key else "")
        last_exception: Exception | None = None

        for attempt in range(1, self._max_retries + 1):
            try:
                response = await self._client.get(
                    url,

                )
                response.raise_for_status()
                return response.content
            except (TimeoutError, httpx.HTTPError) as exc:
                last_exception = exc
                if attempt == self._max_retries:
                    logger.error(
                        "Exhausted %d attempts fetching Delhi OTD feed: %s",
                        self._max_retries,
                        exc,
                    )
                    break
                wait_time = self._backoff_factor ** attempt
                logger.warning(
                    "Attempt %d/%d failed to fetch feed (%s). Retrying in %.2fs...",
                    attempt,
                    self._max_retries,
                    exc,
                    wait_time,
                )
                await asyncio.sleep(wait_time)

        raise RuntimeError(f"Failed to fetch feed after {self._max_retries} attempts") from last_exception

    async def ping(self) -> bool:
        try:
            headers, params = self._build_request_params()
            res = await self._client.head(
                self._feed_url,
                headers=headers,
                params=params,
                timeout=5.0,
            )
            return res.status_code < 500
        except Exception:
            return False

    async def close(self) -> None:
        if not self._external_client and not self._client.is_closed:
            await self._client.aclose()
