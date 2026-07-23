import json
import logging
import time
from typing import Any, Optional, Dict
from app.config import settings

logger = logging.getLogger(__name__)

class CacheService:
    def __init__(self):
        self._redis_client = None
        self._redis_available = False
        self._memory_cache: Dict[str, Dict[str, Any]] = {}
        self._hits = 0
        self._misses = 0

    async def initialize(self):
        """Initialize Redis connection if enabled."""
        if not settings.REDIS_ENABLED:
            logger.info("Redis cache is explicitly disabled in settings.")
            return

        try:
            import redis.asyncio as aioredis
            self._redis_client = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_timeout=1.5,
                protocol=2
            )

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
        Returns None if cache miss or expired. Updates hit/miss metrics.
        """
        if self._redis_available and self._redis_client:
            try:
                data = await self._redis_client.get(key)
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

        if self._redis_available and self._redis_client:
            try:
                serialized = json.dumps(value, default=str)
                await self._redis_client.set(key, serialized, ex=ttl)
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
        if self._redis_available and self._redis_client:
            try:
                keys = await self._redis_client.keys(pattern)
                if keys:
                    removed_count = await self._redis_client.delete(*keys)
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

    async def clear_all(self) -> None:
        """Flush all cache entries and reset hit/miss counters."""
        if self._redis_available and self._redis_client:
            try:
                await self._redis_client.flushdb()
                try:
                    await self._redis_client.delete("cache_stats:hits", "cache_stats:misses")
                except Exception:
                    pass
            except Exception as e:
                logger.warning(f"Redis flush error: {e}")

        self._memory_cache.clear()
        self._hits = 0
        self._misses = 0

    async def get_stats(self) -> dict:
        """Return cache performance statistics (hits, misses, hit_rate_pct)."""
        hits = self._hits
        misses = self._misses
        
        if self._redis_available and self._redis_client:
            try:
                r_hits = await self._redis_client.get("cache_stats:hits")
                r_misses = await self._redis_client.get("cache_stats:misses")
                if r_hits is not None:
                    hits = int(r_hits)
                if r_misses is not None:
                    misses = int(r_misses)
            except Exception as e:
                logger.warning(f"Failed to fetch Redis cache stats: {e}")
                
        total = hits + misses
        hit_rate = round((hits / total) * 100, 2) if total > 0 else 0.0
        
        total_keys = len(self._memory_cache)
        return {
            "hits": hits,
            "misses": misses,
            "hit_rate_pct": hit_rate,
            "total_keys": total_keys,
            "redis_connected": self._redis_available,
            "cache_engine": "Redis" if self._redis_available else "In-Memory (Fallback)"
        }

# Global singleton cache service instance
cache = CacheService()
