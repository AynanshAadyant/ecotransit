"""Database and cache client factories and shared key builders."""

from __future__ import annotations

from typing import Any
from config import DatabaseSettings, RedisSettings

# --- Shared Redis Key Builders ---

def vehicle_live_key(vehicle_id: str) -> str:
    """Key for live vehicle position payload (hash or JSON)."""
    return f"live:pos:{vehicle_id}"


def vehicle_geo_key() -> str:
    """Key for live geospatial index of vehicles."""
    return "live:geo:vehicles"


def route_live_key(route_id: str) -> str:
    """Key for set/list of live vehicles currently on a route."""
    return f"live:route:{route_id}"


def staff_session_key(session_id: str) -> str:
    """Key for staff session data."""
    return f"staff:session:{session_id}"


def static_route_cache_key(route_id: str) -> str:
    return f"cache:route:{route_id}"


def static_stop_cache_key(stop_id: str) -> str:
    return f"cache:stop:{stop_id}"


def route_segments_cache_key(route_id: str) -> str:
    return f"cache:segments:{route_id}"


# --- Client Factories ---

async def create_postgres_pool(
    dsn: str,
    min_size: int = 5,
    max_size: int = 20,
    **kwargs: Any,
) -> Any:
    """Creates an asyncpg connection pool."""
    try:
        import asyncpg
    except ImportError as e:
        raise ImportError("asyncpg is required to create a postgres pool. Run 'pip install asyncpg'.") from e
    except Exception as e:
        raise ImportError("An unexpected error occurred while importing asyncpg.") from e
    return await asyncpg.create_pool(
        dsn=dsn,
        min_size=min_size,
        max_size=max_size,
        **kwargs,
    )


def create_redis_client(
    url: str,
    decode_responses: bool = True,
    **kwargs: Any,
) -> Any:
    """Creates an asynchronous Redis client instance."""
    try:
        import redis.asyncio as redis
    except ImportError as e:
        raise ImportError("redis is required to create a redis client. Run 'pip install redis'.") from e    
    except Exception as e:
        raise ImportError("An unexpected error occurred while importing redis.asyncio.") from e

    return redis.from_url(
        url=url,
        decode_responses=decode_responses,
        **kwargs,
    )
