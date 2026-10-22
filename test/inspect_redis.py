import asyncio
import os
import redis.asyncio as aioredis
from dotenv import load_dotenv

load_dotenv()

async def main():
    redis_host = os.getenv("REDIS_HOST", "localhost")
    redis_port = int(os.getenv("REDIS_PORT", 6379))
    redis_pass = os.getenv("REDIS_PASSWORD") or None

    r = aioredis.Redis(host=redis_host, port=redis_port, password=redis_pass)
    dbsize = await r.dbsize()
    print(f"Total keys in Redis: {dbsize}")

    geo_count = await r.zcard("live:geo:vehicles")
    print(f"live:geo:vehicles member count: {geo_count}")

    pos_keys = await r.keys("live:pos:*")
    print(f"live:pos:* keys count: {len(pos_keys)}")

    route_keys = await r.keys("live:route:*")
    print(f"live:route:* keys count: {len(route_keys)}")

    if pos_keys:
        sample_key = pos_keys[0].decode('utf-8')
        sample_val = await r.hgetall(sample_key)
        ttl = await r.ttl(sample_key)
        print(f"Sample {sample_key} (TTL={ttl}s):")
        for k, v in sample_val.items():
            print(f"  {k.decode('utf-8')}: {v.decode('utf-8')}")

    await r.aclose()

if __name__ == "__main__":
    asyncio.run(main())
