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
        self._last_redis_retry = 0.0
        self._memory_cache: Dict[str, Dict[str, Any]] = {}
        self._hits = 0
        self._misses = 0
        self._locks: Dict[str, asyncio.Lock] = {}

    async def get_client(self):
        """Returns active Redis client, re-initializing pool if current event loop changed."""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if self._redis_pool is not None and getattr(self, "_loop", None) != loop:
            try:
                await self._redis_pool.disconnect()
            except Exception:
                pass
            self._redis_pool = None
            self._redis_client = None

        if self._redis_client is None and settings.REDIS_ENABLED:
            await self.initialize()
            self._loop = loop
        return self._redis_client

    async def initialize(self):
        """Initialize Redis connection pool if enabled."""
        if not settings.REDIS_ENABLED:
            logger.info("Redis cache is explicitly disabled in settings.")
            return

        if self._redis_pool is not None:
            try:
                await self._redis_pool.disconnect()
            except Exception:
                pass
            self._redis_pool = None
            self._redis_client = None

        try:
            import redis.asyncio as aioredis
            try:
                self._loop = asyncio.get_running_loop()
            except RuntimeError:
                self._loop = None
            self._redis_pool = aioredis.ConnectionPool.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                max_connections=500,
                socket_timeout=5.0,
                socket_connect_timeout=5.0,
                protocol=2,
            )
            self._redis_client = aioredis.Redis(connection_pool=self._redis_pool)

            # Ping Redis to test connection
            await self._redis_client.ping()
            self._redis_available = True
            logger.info("Connected to Redis cache server successfully.")
        except Exception as e:
            self._redis_available = False
            logger.warning(f"Redis cache connection unavailable ({e}). Fallback to in-memory cache.")

    async def _check_redis(self) -> bool:
        if not settings.REDIS_ENABLED or not self._redis_client:
            return False
        if not self._redis_available:
            now = time.time()
            if now - self._last_redis_retry > 60.0:
                self._last_redis_retry = now
                try:
                    await self._redis_client.ping()
                    self._redis_available = True
                    logger.info("Redis cache connection re-established.")
                except Exception:
                    self._redis_available = False
            return self._redis_available
        return True

    async def get(self, key: str) -> Optional[Any]:
        """
        Retrieve item from cache (Cache First strategy).
        Returns None if cache miss or expired. Handles Redis errors gracefully.
        """
        if await self._check_redis():
            try:
                data = await self._redis_client.get(key)
                if data is not None:
                    self._hits += 1
                    return json.loads(data)
                else:
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

        if await self._check_redis():
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

    async def get_raw(self, key: str) -> Optional[str]:
        """Retrieve raw un-parsed pre-serialized JSON string from cache."""
        if await self._check_redis():
            try:
                data = await self._redis_client.get(key)
                if data is not None:
                    self._hits += 1
                    return data
                else:
                    self._misses += 1
                    return None
            except Exception as e:
                logger.warning(f"Redis get_raw error on key '{key}': {e}")
                self._redis_available = False

        item = self._memory_cache.get(key)
        if item:
            if item["expires_at"] > time.time():
                self._hits += 1
                val = item["value"]
                return json.dumps(val, default=str) if not isinstance(val, str) else val
            else:
                del self._memory_cache[key]

        self._misses += 1
        return None

    async def set_raw(self, key: str, json_str: str, ttl: int = 300) -> None:
        """Store pre-serialized JSON string directly in cache with TTL."""
        if not json_str:
            return

        if await self._check_redis():
            try:
                await self._redis_client.set(key, json_str, ex=ttl)
                return
            except Exception as e:
                logger.warning(f"Redis set_raw error on key '{key}': {e}")
                self._redis_available = False

        self._memory_cache[key] = {
            "value": json_str,
            "expires_at": time.time() + ttl
        }

    async def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate all keys matching pattern (e.g. 'catalog:*', 'rec:*')."""
        removed_count = 0
        if await self._check_redis():
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

    def get_lock(self, key: str) -> asyncio.Lock:
        """Get per-key lock for single-flight cache stampede protection."""
        if key not in self._locks:
            self._locks[key] = asyncio.Lock()
        return self._locks[key]

    async def clear_all(self) -> None:
        """Flush all cache entries and reset hit/miss counters."""
        if await self._check_redis():
            try:
                await self._redis_client.flushdb()
                try:
                    await self._redis_client.delete("cache_stats:hits", "cache_stats:misses")
                except Exception:
                    pass
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
        redis_ok = await self._check_redis()

        if redis_ok:
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
