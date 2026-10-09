"""Live Ingestion Engine Validation Script.

Runs the complete IngestionEngine against real-world Delhi OTD feed,
validates data ingestion into Redis hot cache and PostgreSQL durable archive,
and generates a structured verification report.
"""

from __future__ import annotations

import asyncio
import sys
import time
from pathlib import Path

# Ensure paths
workspace_root = Path(__file__).resolve().parents[3]
shared_path = workspace_root / "shared" / "python"
if str(shared_path) not in sys.path:
    sys.path.insert(0, str(shared_path))
service_path = Path(__file__).resolve().parent
if str(service_path) not in sys.path:
    sys.path.insert(0, str(service_path))

from config import load_settings  # noqa: E402
from engine import IngestionEngine  # noqa: E402
from main import build_engine  # noqa: E402

from ecotransit_shared.db import create_postgres_pool, create_redis_client  # noqa: E402


async def run_live_validation() -> dict[str, object]:
    report: dict[str, object] = {
        "status": "FAILED",
        "delhi_otd": {},
        "engine": {},
        "redis_validation": {},
        "postgres_validation": {},
        "errors": [],
    }

    settings = load_settings()
    print("=" * 70)
    print("EcoTransit Live Ingestion Engine Validation")
    print("=" * 70)
    print(f"Feed URL:     {settings.delhi_otd_feed_url}")
    print(f"Redis:        {settings.redis.redis_host}:{settings.redis.redis_port}")
    print(f"PostgreSQL:   {settings.db.postgres_host}:{settings.db.postgres_port}/{settings.db.database_name}")
    print("=" * 70)

    # 1. Connect drivers
    print("\n[1/5] Connecting to shared storage infrastructure...")
    redis_client = create_redis_client(settings.redis.url)
    db_pool = await create_postgres_pool(settings.db.dsn, min_size=2, max_size=5)

    redis_ok = await redis_client.ping()
    print(f" -> Redis Ping: {'SUCCESS' if redis_ok else 'FAILED'}")

    async with db_pool.acquire() as conn:
        pg_version = await conn.fetchval("SELECT version()")
        print(f" -> PostgreSQL Version: {pg_version[:40]}...")

    # Record initial Postgres row count
    async with db_pool.acquire() as conn:
        initial_pg_count: int = await conn.fetchval("SELECT count(*) FROM vehicle_position_archive")
    print(f" -> Initial archive rows in PostgreSQL: {initial_pg_count}")

    # 2. Build IngestionEngine
    print("\n[2/5] Building Ingestion Engine pipeline...")
    engine: IngestionEngine = build_engine(settings, redis_client=redis_client, db_pool=db_pool)
    print(" -> Engine assembled (Source -> Parser -> Validation -> Sinks -> Metrics)")

    # 3. Run Ingestion Engine for a controlled ingestion cycle
    print("\n[3/5] Starting Ingestion Engine for live cycle...")
    start_time = time.time()

    # Launch engine in background task
    engine_task = asyncio.create_task(engine.run())

    # Wait until engine processes at least one batch or timeout after 25s
    max_wait = 25.0
    while time.time() - start_time < max_wait:
        await asyncio.sleep(1.0)
        # Check metrics
        snapshot = engine.metrics.get_snapshot()
        parsed_count = snapshot["positions_parsed"]
        persisted_count = snapshot["total_flushed_count"]
        if persisted_count > 0:
            print(f" -> Processed {parsed_count} incoming positions, {persisted_count} persisted!")
            # Allow flush to finish completely
            await asyncio.sleep(2.0)
            break
        print(f" -> Waiting for feed fetch and batch flush... ({time.time() - start_time:.1f}s)")

    # Stop engine gracefully
    print(" -> Signalling engine shutdown...")
    await engine.stop()
    try:
        await asyncio.wait_for(engine_task, timeout=5.0)
    except (TimeoutError, asyncio.CancelledError):
        engine_task.cancel()
    print(" -> Ingestion Engine stopped successfully.")

    # 4. Validate Redis Storage
    print("\n[4/5] Validating Redis hot cache telemetry...")
    # Geo index count
    geo_count = await redis_client.zcard("live:geo:vehicles")
    print(f" -> 'live:geo:vehicles' geospatial members: {geo_count}")

    # Sample position hash
    sample_members = await redis_client.zrange("live:geo:vehicles", 0, 4)
    sample_vehicle_id = sample_members[0] if sample_members else None
    sample_hash = {}
    sample_ttl = -1
    if sample_vehicle_id:
        sample_hash = await redis_client.hgetall(f"live:pos:{sample_vehicle_id}")
        sample_ttl = await redis_client.ttl(f"live:pos:{sample_vehicle_id}")
        print(f" -> Sample Vehicle Hash (live:pos:{sample_vehicle_id}, TTL={sample_ttl}s):")
        for k, v in sample_hash.items():
            print(f"     {k}: {v}")

    # Spatial radius query: 10km around Connaught Place (lon=77.2167, lat=28.6315)
    nearby = await redis_client.geosearch(
        "live:geo:vehicles",
        longitude=77.2167,
        latitude=28.6315,
        radius=10.0,
        unit="km",
    )
    print(f" -> Spatial query: {len(nearby)} vehicles active within 10km of Connaught Place")

    # 5. Validate PostgreSQL Storage
    print("\n[5/5] Validating PostgreSQL durable archive...")
    async with db_pool.acquire() as conn:
        final_pg_count: int = await conn.fetchval("SELECT count(*) FROM vehicle_position_archive")
        recent_rows = await conn.fetch(
            """
            SELECT id, vehicle_id, route_id, latitude, longitude, speed, is_speed_suspect, gtfs_timestamp, recorded_at
            FROM vehicle_position_archive
            ORDER BY id DESC
            LIMIT 3
            """
        )

    new_rows = final_pg_count - initial_pg_count
    print(f" -> Total archive rows in DB: {final_pg_count} (+{new_rows} new rows)")
    print(" -> Recent archived rows:")
    for r in recent_rows:
        print(f"     ID {r['id']}: Vehicle={r['vehicle_id']}, Route={r['route_id']}, Coord=({r['latitude']:.4f}, {r['longitude']:.4f}), Speed={r['speed']}, Suspect={r['is_speed_suspect']}")

    # Clean up connections
    await redis_client.aclose()
    await db_pool.close()

    # Compile report
    report["status"] = "SUCCESS" if (geo_count > 0 and new_rows > 0) else "FAILED"
    final_snapshot = engine.metrics.get_snapshot()
    report["engine"] = {
        "positions_parsed": final_snapshot["positions_parsed"],
        "positions_valid": final_snapshot["validation_passed"],
        "positions_persisted": final_snapshot["total_flushed_count"],
        "validation_rejected": final_snapshot["validation_rejected"],
        "batches_flushed": final_snapshot["batches_flushed"],
    }
    report["redis_validation"] = {
        "geo_vehicles_count": geo_count,
        "sample_vehicle_id": sample_vehicle_id,
        "sample_vehicle_data": sample_hash,
        "sample_ttl_seconds": sample_ttl,
        "vehicles_within_10km_cp": len(nearby),
    }
    report["postgres_validation"] = {
        "initial_rows": initial_pg_count,
        "final_rows": final_pg_count,
        "newly_archived_rows": new_rows,
        "sample_rows_count": len(recent_rows),
    }

    print("\n" + "=" * 70)
    print(f"OVERALL VALIDATION OUTCOME: {report['status']}")
    print("=" * 70)
    return report


if __name__ == "__main__":
    result = asyncio.run(run_live_validation())
    if result["status"] != "SUCCESS":
        sys.exit(1)
    sys.exit(0)
