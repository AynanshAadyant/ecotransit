"""Composition root for the EcoTransit Ingestion Worker service.

Names concrete classes and wires them strictly through abstract contracts and ports.
"""

from __future__ import annotations

import asyncio
import signal
import sys
from pathlib import Path
from typing import Any

# Ensure shared/python is available in sys.path
workspace_root = Path(__file__).resolve().parents[3]
shared_path = workspace_root / "shared" / "python"
if str(shared_path) not in sys.path:
    sys.path.insert(0, str(shared_path))

service_path = Path(__file__).resolve().parent
if str(service_path) not in sys.path:
    sys.path.insert(0, str(service_path))

from adapters.feed_client import DelhiOtdFeedClient  # noqa: E402
from adapters.postgres_store import PostgresArchiveStore  # noqa: E402
from adapters.redis_store import RedisLiveStore  # noqa: E402
from config import IngestionWorkerSettings, load_settings  # noqa: E402
from engine import IngestionEngine, ParserRegistry  # noqa: E402
from metrics import InMemoryMetricsRecorder  # noqa: E402
from parsers.gtfs_protobuf import GtfsProtobufParser  # noqa: E402
from sinks.fan_out import FanOutSink  # noqa: E402
from sinks.postgres_sink import PostgresArchiveSink  # noqa: E402
from sinks.redis_sink import RedisPositionSink  # noqa: E402
from sources.gtfs_realtime import GtfsRealtimeSource  # noqa: E402
from validation.chain import ValidationChain  # noqa: E402
from validation.rules import (  # noqa: E402
    CoordinateBoundsRule,
    DuplicatePingRule,
    SpeedPlausibilityRule,
    TimestampFreshnessRule,
)

from ecotransit_shared.db import create_postgres_pool, create_redis_client  # noqa: E402
from ecotransit_shared.logging import create_logger  # noqa: E402


def build_engine(
    settings: IngestionWorkerSettings,
    redis_client: Any,
    db_pool: Any,
    logger: Any,
    custom_feed_client: Any = None,
) -> IngestionEngine:
    """Builds and wires the IngestionEngine with all configured components."""
    # 1. Service-specific abstraction layers
    logger.info("Initializing feed client...")
    feed_client = custom_feed_client or DelhiOtdFeedClient(
        feed_url=settings.delhi_otd_feed_url,
        api_key=settings.delhi_otd_api_key,
        timeout=settings.http_timeout_seconds,
        max_retries=settings.max_retries,
        backoff_factor=settings.backoff_factor,
    )
    logger.info(f"Feed client initialized with URL: {settings.delhi_otd_feed_url}")
    redis_store = RedisLiveStore(redis_client=redis_client)
    postgres_store = PostgresArchiveStore(pool=db_pool)

    # 2. Pipeline stages
    source = GtfsRealtimeSource(
        feed_client=feed_client,
        poll_interval_seconds=settings.otd_poll_interval_seconds,
    )
    logger.info(f"Source initialized with poll interval: {settings.otd_poll_interval_seconds} seconds")
    parsers = ParserRegistry([GtfsProtobufParser()])
    logger.info("Parser registry initialized with GtfsProtobufParser.")
    validation = ValidationChain([
        CoordinateBoundsRule(
            min_lat=settings.delhi_bbox_min_lat,
            max_lat=settings.delhi_bbox_max_lat,
            min_lon=settings.delhi_bbox_min_lon,
            max_lon=settings.delhi_bbox_max_lon,
        ),
        SpeedPlausibilityRule(max_kmh=settings.max_speed_kmh),
        TimestampFreshnessRule(max_age_s=settings.max_age_seconds),
        DuplicatePingRule(),
    ])
    logger.info("Validation chain initialized with CoordinateBoundsRule, SpeedPlausibilityRule, TimestampFreshnessRule, and DuplicatePingRule.")
    sinks = FanOutSink([
        RedisPositionSink(store=redis_store, ttl_seconds=settings.redis_ttl_seconds),
        PostgresArchiveSink(store=postgres_store),
    ])
    logger.info("Fan-out sink initialized with RedisPositionSink and PostgresArchiveSink.")
    metrics = InMemoryMetricsRecorder()
    logger.info("In-memory metrics recorder initialized.")

    return IngestionEngine(
        source=source,
        parsers=parsers,
        validation=validation,
        sink=sinks,
        metrics=metrics,
        batch_size=5000,
        flush_interval_ms=settings.flush_interval_ms,
    )


async def main_async() -> int:
    logger = create_logger("ingestion-worker")
    settings = load_settings()

    logger.info("Starting EcoTransit Ingestion Worker...")
    logger.info("Initializing database and cache connections...")

    # Shared drivers
    try :
        db_pool = await create_postgres_pool(settings.db.dsn)
        redis_client = create_redis_client(settings.redis.url)
        logger.info("Database and cache connections initialized successfully.")
        engine = build_engine(settings, redis_client=redis_client, db_pool=db_pool, logger=logger)
        stop_event = asyncio.Event()
        
        def handle_signal() -> None:
            logger.info("Received termination signal. Stopping ingestion engine...")
            stop_event.set()
    
        loop = asyncio.get_running_loop()
        if sys.platform != "win32":
            for sig in (signal.SIGINT, signal.SIGTERM):
                loop.add_signal_handler(sig, handle_signal)
        logger.info("Signal handlers registered. Press Ctrl+C to stop the ingestion worker.")
        logger.info(
            "Engine object: %s, run method: %s",
            engine,
            engine.run,
        )

        runner_task = asyncio.create_task(
            engine.run(),
            name="ingestion-engine",
        )

        logger.info(
            "Runner task created: %s, done=%s",
            runner_task,
            runner_task.done(),
        )        
        logger.info("Ingestion engine started. Running until stopped or task completes.")
        try:
            # Run until stopped or task completes
            if sys.platform == "win32":
                logger.info("Running on Windows. Awaiting runner task completion...")
                try:
                    await runner_task
                except Exception:
                    logger.exception("Ingestion engine task crashed")                
                logger.info("Runner task completed. Stopping ingestion engine...")
            else:       
                await stop_event.wait()
                await engine.stop()
                await runner_task
        except (asyncio.CancelledError, KeyboardInterrupt):
            logger.info("Interrupted, shutting down...")
            await engine.stop()
        finally:
            await redis_client.aclose() if hasattr(redis_client, "aclose") else redis_client.close()
            await db_pool.close()
            logger.info("Shutdown complete.")
    
    except Exception as e:
        logger.error(f"Failed to initialize database or cache connections: {e}")
    return 0

def main() -> None:
    try:
        sys.exit(asyncio.run(main_async()))
    except KeyboardInterrupt:
        sys.exit(0)


if __name__ == "__main__":
    main()
