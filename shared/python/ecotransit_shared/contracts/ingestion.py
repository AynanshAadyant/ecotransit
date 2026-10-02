"""Ingestion pipeline abstract contracts matching Section 5.2."""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator

from ecotransit_shared.schemas import (
    HealthStatus,
    RawPayload,
    RuleOutcome,
    SinkResult,
    ValidationContext,
    VehiclePosition,
)


class ISource(ABC):
    """A transport that yields raw, unparsed position payloads."""

    @property
    @abstractmethod
    def name(self) -> str: ...

    @abstractmethod
    async def open(self) -> None: ...

    @abstractmethod
    def stream(self) -> AsyncIterator[RawPayload]:
        """Yields payloads until close() is called. Must not raise on
        transient transport errors; reconnect internally and keep yielding."""
        ...

    @abstractmethod
    async def close(self) -> None: ...


class IParser(ABC):
    """Parses raw payloads into canonical VehiclePosition objects."""

    @abstractmethod
    def supports(self, payload: RawPayload) -> bool: ...

    @abstractmethod
    def parse(self, payload: RawPayload) -> list[VehiclePosition]:
        """Pure. Raises ParseError on malformed input; never performs I/O."""
        ...


class IValidationRule(ABC):
    """Validates an incoming vehicle position against a specific domain invariant."""

    @property
    @abstractmethod
    def code(self) -> str: ...

    @abstractmethod
    def check(
        self,
        position: VehiclePosition,
        context: ValidationContext,
    ) -> RuleOutcome: ...


class ISink(ABC):
    """Destination sink for validated vehicle positions (cache or durable store)."""

    @property
    @abstractmethod
    def is_critical(self) -> bool:
        """If True, a write failure aborts the batch and is retried.
        If False, failure is logged and the batch proceeds."""
        ...

    @abstractmethod
    async def write(self, batch: list[VehiclePosition]) -> SinkResult: ...

    @abstractmethod
    async def health(self) -> HealthStatus: ...
