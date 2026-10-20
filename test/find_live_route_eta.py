import asyncio
import os
import httpx
import asyncpg
import redis.asyncio as aioredis
from dotenv import load_dotenv

load_dotenv()

async def test_live_route_eta():
    print("--- Matching Live Vehicles with Static Route Stops for ETA ---")
    pg_conn = await asyncpg.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", 5432)),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", ""),
        database=os.getenv("DATABASE_NAME", "ecotransit")
    )

    r = aioredis.Redis(
        host=os.getenv("REDIS_HOST", "localhost"),
        port=int(os.getenv("REDIS_PORT", 6379)),
        password=os.getenv("REDIS_PASSWORD") or None
    )

    live_keys = await r.keys("live:pos:*")
    print(f"Total active live:pos:* keys in Redis: {len(live_keys)}")

    matched_bus = None
    matched_stops = []

    for k in live_keys[:200]:
        val = await r.hgetall(k)
        rid = val.get(b"route_id", b"").decode("utf-8")
        vid = val.get(b"vehicle_id", b"").decode("utf-8")
        if not rid:
            continue

        stops = await pg_conn.fetch("""
            SELECT s.stop_id, s.stop_name, rs.stop_sequence
            FROM route_stops rs
            JOIN stops s ON rs.stop_id = s.stop_id
            WHERE rs.route_id = $1
            ORDER BY rs.stop_sequence ASC
        """, rid)

        if len(stops) > 3:
            matched_bus = (vid, rid)
            matched_stops = stops
            print(f"Found matched live bus: Vehicle={vid}, Route={rid}, Total stops={len(stops)}")
            break

    await pg_conn.close()
    await r.aclose()

    if matched_bus and matched_stops:
        vid, rid = matched_bus
        target_stop = matched_stops[-1]
        target_stop_id = target_stop["stop_id"]
        print(f"\nCalling ETA Endpoint: GET http://localhost:4000/api/eta/{vid}?stopId={target_stop_id}")

        async with httpx.AsyncClient(base_url="http://localhost:4000", timeout=10.0) as client:
            res = await client.get(f"/api/eta/{vid}", params={"stopId": target_stop_id})
            print(f"Status: {res.status_code}")
            print(f"Response: {res.json()}")
            if res.status_code == 200:
                print("  [OK] Successfully computed ETA from Traversal Matrix on Live Vehicle!")
            else:
                print("  [NOTICE] Vehicle position check:", res.json())
    else:
        print("No route match found in first 200 samples.")

if __name__ == "__main__":
    asyncio.run(test_live_route_eta())
