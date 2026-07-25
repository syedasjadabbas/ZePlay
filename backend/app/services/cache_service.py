import json
import logging
import time
import asyncio
from typing import Any, Optional, Dict
from app.config import settings

logger = logging.getLogger(__name__)

class CacheService:
    def __init__(self):
        self._redis_client = None
        self._redis_pool = None
        self._redis_available = False
        self._memory_cache: Dict[str, Dict[str, Any]] = {}
        self._hits = 0
        self._misses = 0
        self._locks: Dict[str, asyncio.Lock] = {}

    async def initialize(self):
        """Initialize Redis connection pool if enabled."""
        if not settings.REDIS_ENABLED:
            logger.info("Redis cache is explicitly disabled in settings.")
            return

        try:
            import redis.asyncio as aioredis
            self._redis_pool = aioredis.ConnectionPool.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                max_connections=50,
                socket_timeout=2.0,
                socket_connect_timeout=2.0,
            )
            self._redis_client = aioredis.Redis(connection_pool=self._redis_pool)

            # Ping Redis to test connection
            await self._redis_client.ping()
            self._redis_available = True
            logger.info("Connected to Redis cache server successfully.")
        except Exception as e:
            self._redis_available = False
            logger.warning(f"Redis cache connection unavailable ({e}). Fallback to in-memory cache.")

    async def get(self, key: str) -> Optional[Any]:
        """
        Retrieve item from cache (Cache First strategy).
        Returns None if cache miss or expired. Handles Redis errors gracefully.
        """
        if self._redis_client:
            try:
                data = await self._redis_client.get(key)
                self._redis_available = True
                if data is not None:
                    try:
                        await self._redis_client.incr("cache_stats:hits")
                    except Exception:
                        pass
                    self._hits += 1
                    return json.loads(data)
                else:
                    try:
                        await self._redis_client.incr("cache_stats:misses")
                    except Exception:
                        pass
                    self._misses += 1
                    return None
            except Exception as e:
                logger.warning(f"Redis get error on key '{key}': {e}")
                self._redis_available = False

        # In-memory fallback lookup
        item = self._memory_cache.get(key)
        if item:
            if item["expires_at"] > time.time():
                self._hits += 1
                return item["value"]
            else:
                del self._memory_cache[key]

        self._misses += 1
        return None

    async def set(self, key: str, value: Any, ttl: int = 300) -> None:
        """Store serialized item in cache with specified TTL in seconds."""
        if value is None:
            return

        if self._redis_client:
            try:
                serialized = json.dumps(value, default=str)
                await self._redis_client.set(key, serialized, ex=ttl)
                self._redis_available = True
                return
            except Exception as e:
                logger.warning(f"Redis set error on key '{key}': {e}")
                self._redis_available = False

        # In-memory fallback store
        self._memory_cache[key] = {
            "value": value,
            "expires_at": time.time() + ttl
        }

    async def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate all keys matching pattern (e.g. 'catalog:*', 'rec:*')."""
        removed_count = 0
        if self._redis_client:
            try:
                keys = await self._redis_client.keys(pattern)
                if keys:
                    removed_count = await self._redis_client.delete(*keys)
                self._redis_available = True
            except Exception as e:
                logger.warning(f"Redis invalidate error on pattern '{pattern}': {e}")
                self._redis_available = False

        # In-memory pattern removal
        prefix = pattern.replace("*", "")
        mem_keys_to_remove = [k for k in self._memory_cache if k.startswith(prefix)]
        for k in mem_keys_to_remove:
            self._memory_cache.pop(k, None)
            removed_count += 1

        return removed_count

    def get_lock(self, key: str) -> asyncio.Lock:
        """Get per-key lock for single-flight cache stampede protection."""
        if key not in self._locks:
            self._locks[key] = asyncio.Lock()
        return self._locks[key]

    async def clear_all(self) -> None:
        """Flush all cache entries and reset hit/miss counters."""
        if self._redis_client:
            try:
                await self._redis_client.flushdb()
                try:
                    await self._redis_client.delete("cache_stats:hits", "cache_stats:misses")
                except Exception:
                    pass
                self._redis_available = True
            except Exception as e:
                logger.warning(f"Redis flush error: {e}")
                self._redis_available = False

        self._memory_cache.clear()
        self._hits = 0
        self._misses = 0

    async def get_stats(self) -> dict:
        """Return cache performance statistics (hits, misses, hit_rate_pct, connection status)."""
        hits = self._hits
        misses = self._misses
        redis_ok = False

        if self._redis_client:
            try:
                await self._redis_client.ping()
                redis_ok = True
                r_hits = await self._redis_client.get("cache_stats:hits")
                r_misses = await self._redis_client.get("cache_stats:misses")
                if r_hits is not None:
                    hits = int(r_hits)
                if r_misses is not None:
                    misses = int(r_misses)
            except Exception as e:
                redis_ok = False
                logger.warning(f"Failed to fetch Redis cache stats: {e}")

        self._redis_available = redis_ok
        total = hits + misses
        hit_rate = round((hits / total) * 100, 2) if total > 0 else 0.0

        return {
            "hits": hits,
            "misses": misses,
            "hit_rate_pct": hit_rate,
            "total_keys": len(self._memory_cache),
            "redis_connected": redis_ok,
            "cache_engine": "Redis" if redis_ok else "In-Memory (Fallback)"
        }

# Global singleton cache service instance
cache = CacheService()
