import asyncio
import os
import asyncpg
import redis.asyncio as aioredis
from dotenv import load_dotenv

load_dotenv()

async def main():
    pg_host = os.getenv("POSTGRES_HOST", "localhost")
    pg_port = int(os.getenv("POSTGRES_PORT", 5432))
    pg_user = os.getenv("POSTGRES_USER", "postgres")
    pg_pass = os.getenv("POSTGRES_PASSWORD", "")
    pg_db = os.getenv("DATABASE_NAME", "ecotransit")

    print(f"=== PostgreSQL Connection: {pg_user}@{pg_host}:{pg_port}/{pg_db} ===")
    try:
        conn = await asyncpg.connect(
            host=pg_host, port=pg_port, user=pg_user, password=pg_pass, database=pg_db
        )
        print(" Connected to PostgreSQL.")
        tables = [
            "stops",
            "routes",
            "route_stops",
            "route_segments",
            "route_segment_traversal_matrix",
            "vehicle_position_archive",
            "staff",
            "shift_assignments",
            "incidents",
            "schema_migrations"
        ]
        for t in tables:
            try:
                cnt = await conn.fetchval(f"SELECT COUNT(*) FROM {t}")
                print(f"  - Table {t:30s}: {cnt:>8} rows")
            except Exception as e:
                print(f"  - Table {t:30s}: ERROR ({e})")
        await conn.close()
    except Exception as e:
        print(f"PostgreSQL Connection Error: {e}")

    redis_host = os.getenv("REDIS_HOST", "localhost")
    redis_port = int(os.getenv("REDIS_PORT", 6379))
    redis_pass = os.getenv("REDIS_PASSWORD") or None

    print(f"\n=== Redis Connection: {redis_host}:{redis_port} ===")
    try:
        r = aioredis.Redis(host=redis_host, port=redis_port, password=redis_pass)
        await r.ping()
        print(" Connected to Redis.")
        dbsize = await r.dbsize()
        print(f"  - Total Redis keys: {dbsize}")
        keys = await r.keys("vehicle:*")
        print(f"  - vehicle:* keys: {len(keys)}")
        if keys:
            print(f"  - Sample keys: {[k.decode('utf-8') for k in keys[:5]]}")
            val = await r.get(keys[0])
            print(f"  - Sample data: {val.decode('utf-8') if val else None}")
        await r.aclose()
    except Exception as e:
        print(f"Redis Connection Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
