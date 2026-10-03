"""Universal Ingestion Engine and Parser Registry.

Drives the end-to-end flow:
Source -> ParserRegistry -> ValidationChain -> Batch Accumulator -> FanOutSink.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Sequence

from metrics import IMetricsRecorder
from validation.chain import ValidationChain

from ecotransit_shared.contracts.ingestion import IParser, ISink, ISource
from ecotransit_shared.schemas import RawPayload, ValidationContext, VehiclePosition
from ecotransit_shared.logging import create_logger  # noqa: E402
logger = create_logger("ingestion-engine")


class ParserRegistry:
    """Registry matching incoming raw payloads to supporting parsers."""

    def __init__(self, parsers: Sequence[IParser]) -> None:
        self._parsers = tuple(parsers)

    def get_parser(self, payload: RawPayload) -> IParser:
        for parser in self._parsers:
            if parser.supports(payload):
                return parser
        raise ValueError(f"No registered parser supports payload from source '{payload.source}'")


class IngestionEngine:
    """Universal pipeline engine accumulating validated telemetry records and flushing to sinks."""

    def __init__(
        self,
        source: ISource,
        parsers: ParserRegistry,
        validation: ValidationChain,
        sink: ISink,
        metrics: IMetricsRecorder,
        batch_size: int = 100,
        flush_interval_ms: int = 2000,
    ) -> None:
        self.source = source
        self.parsers = parsers
        self.validation = validation
        self.sink = sink
        self.metrics = metrics
        self.batch_size = batch_size
        self.flush_interval_seconds = flush_interval_ms / 1000.0

        self._buffer: list[VehiclePosition] = []
        self._lock = asyncio.Lock()
        self._last_flush_time = time.time()
        self._running = False
        self._flush_timer_task: asyncio.Task[None] | None = None

        self.logger = logger

    async def flush(self) -> int:
        """Flushes buffered vehicle positions to the sink."""
        async with self._lock:
            if not self._buffer:
                return 0

            batch = list(self._buffer)
            self._buffer.clear()
            self._last_flush_time = time.time()

        start_time = time.time()
        try:
            await self.sink.write(batch)
            duration_ms = (time.time() - start_time) * 1000.0
            self.metrics.record_batch_flushed(len(batch), duration_ms)
            self.metrics.record_sink_write(
                sink_name=self.sink.__class__.__name__,
                count=len(batch),
                duration_ms=duration_ms,
                success=True,
            )
            logger.info("Flushed %d positions to sink %s in %.2f ms", len(batch), self.sink.__class__.__name__, duration_ms)
            return len(batch)
        except Exception as exc:
            duration_ms = (time.time() - start_time) * 1000.0
            self.metrics.record_sink_write(
                sink_name=self.sink.__class__.__name__,
                count=len(batch),
                duration_ms=duration_ms,
                success=False,
            )
            logger.error("Error writing batch to sink: %s", exc)
            if self.sink.is_critical:
                raise
            return 0

    async def _timer_flush_loop(self) -> None:
        """Background periodic flusher ensuring quiet periods still persist promptly."""
        while self._running:
            try:
                await asyncio.sleep(self.flush_interval_seconds / 2.0)
                if (time.time() - self._last_flush_time >= self.flush_interval_seconds) and len(self._buffer) > 0:
                    await self.flush()
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error("Error in timer flush loop: %s", exc)

    async def run(self) -> None:
        """Main pipeline loop. Opens source, consumes stream, parses, validates, and batches."""
        logger.info("IngestionEngine starting...")
        self._running = True
        self._last_flush_time = time.time()
        self._flush_timer_task = asyncio.create_task(self._timer_flush_loop())

        await self.source.open()
        logger.info("Source opened successfully. Starting to consume stream...")
        try:
            async for raw_payload in self.source.stream():
                size_bytes = len(raw_payload.payload) if isinstance(raw_payload.payload, (bytes, bytearray)) else 0
                self.metrics.record_payload_received(raw_payload.source, size_bytes)

                try:
                    parser = self.parsers.get_parser(raw_payload)
                    positions = parser.parse(raw_payload)
                except Exception as exc:
                    logger.error("Failed to parse payload from source %s: %s", raw_payload.source, exc)
                    continue

                self.metrics.record_positions_parsed(raw_payload.source, len(positions))

                received_at = time.time()
                for pos in positions:
                    context = ValidationContext(received_at=received_at)
                    validation_res = self.validation.evaluate(pos, context)

                    if validation_res.valid:
                        self.metrics.record_validation_passed(1)
                        async with self._lock:
                            self._buffer.append(pos)
                            should_flush = len(self._buffer) >= self.batch_size
                        if should_flush:
                            await self.flush()
                    else:
                        rule_code = validation_res.failed_rule or "UNKNOWN"
                        self.metrics.record_validation_rejected(rule_code, 1)
                        logger.debug(
                            "Position for vehicle %s rejected by %s: %s",
                            pos.vehicle_id,
                            rule_code,
                            validation_res.failure_reason,
                        )

        finally:
            logger.info("IngestionEngine stopping...")
            await self.stop()

    async def stop(self) -> None:
        """Gracefully halts the engine and drains the buffer."""
        if not self._running:
            return
        self._running = False

        if self._flush_timer_task and not self._flush_timer_task.done():
            self._flush_timer_task.cancel()
            import contextlib
            with contextlib.suppress(asyncio.CancelledError):
                await self._flush_timer_task

        # Drain any remaining records in buffer
        if self._buffer:
            logger.info("Draining final %d buffered positions before shutdown", len(self._buffer))
            await self.flush()

        await self.source.close()
        logger.info("IngestionEngine stopped gracefully")
