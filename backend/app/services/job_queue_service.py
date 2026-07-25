import json
import logging
import time
import asyncio
from typing import Optional, Dict, Any
from uuid import UUID
from app.config import settings
from app.services.cache_service import cache

logger = logging.getLogger(__name__)

QUEUE_KEY = "zeplay:video_jobs"
LOCK_KEY_PREFIX = "zeplay:lock:job:"
HEARTBEAT_PREFIX = "zeplay:worker_heartbeat:"

class JobQueueService:
    def __init__(self):
        self._in_memory_queue: asyncio.Queue = asyncio.Queue()

    async def enqueue_job(self, video_id: UUID, retry_count: int = 0) -> bool:
        """
        Enqueues a video processing job into Redis queue.
        Falls back to in-memory queue if Redis is unavailable.
        """
        vid_str = str(video_id)
        job_data = {
            "video_id": vid_str,
            "retry_count": retry_count,
            "enqueued_at": time.time(),
        }
        payload = json.dumps(job_data)

        client = await cache.get_client()
        if client and cache._redis_available:
            try:
                await client.rpush(QUEUE_KEY, payload)
                logger.info(f"[QUEUE] Enqueued job for video {vid_str} to Redis queue (retry_count={retry_count})")
                return True
            except Exception as e:
                logger.warning(f"[QUEUE] Redis RPUSH failed for video {vid_str}: {e}. Using in-memory fallback queue.")

        await self._in_memory_queue.put(payload)
        logger.info(f"[QUEUE] Enqueued job for video {vid_str} to in-memory fallback queue.")
        return True

    async def dequeue_job(self, timeout_seconds: int = 2) -> Optional[Dict[str, Any]]:
        """
        Pops a job from Redis queue. Blocks for timeout_seconds.
        Falls back to in-memory queue if Redis is empty/unavailable.
        """
        client = await cache.get_client()
        if client and cache._redis_available:
            try:
                result = await client.blpop(QUEUE_KEY, timeout=timeout_seconds)
                if result:
                    _, payload = result
                    return json.loads(payload)
            except Exception as e:
                logger.warning(f"[QUEUE] Redis BLPOP failed: {e}")

        # In-memory fallback check
        try:
            payload = await asyncio.wait_for(self._in_memory_queue.get(), timeout=0.1)
            return json.loads(payload)
        except (asyncio.TimeoutError, asyncio.QueueEmpty):
            return None

    async def acquire_lock(self, video_id: str, worker_id: str, ttl_seconds: int = 600) -> bool:
        """Acquires a distributed lock in Redis for video_id with TTL expiration."""
        lock_key = f"{LOCK_KEY_PREFIX}{video_id}"
        client = await cache.get_client()
        if client and cache._redis_available:
            try:
                res = await client.set(lock_key, worker_id, nx=True, ex=ttl_seconds)
                return bool(res)
            except Exception as e:
                logger.warning(f"[QUEUE] Redis lock acquire error for {video_id}: {e}")
                return True
        return True

    async def release_lock(self, video_id: str):
        """Releases the distributed lock for video_id."""
        lock_key = f"{LOCK_KEY_PREFIX}{video_id}"
        client = await cache.get_client()
        if client and cache._redis_available:
            try:
                await client.delete(lock_key)
            except Exception as e:
                logger.warning(f"[QUEUE] Redis lock release error for {video_id}: {e}")

    async def update_heartbeat(self, worker_id: str, status: str = "active"):
        """Sends periodic heartbeat for worker observability."""
        key = f"{HEARTBEAT_PREFIX}{worker_id}"
        client = await cache.get_client()
        if client and cache._redis_available:
            try:
                data = json.dumps({"worker_id": worker_id, "status": status, "last_seen": time.time()})
                await client.set(key, data, ex=30)
            except Exception:
                pass

    async def get_queue_stats(self) -> Dict[str, Any]:
        """Returns queue statistics for health/observability."""
        client = await cache.get_client()
        q_len = 0
        if client and cache._redis_available:
            try:
                q_len = await client.llen(QUEUE_KEY)
            except Exception:
                pass
        else:
            q_len = self._in_memory_queue.qsize()

        return {
            "queue_length": q_len,
            "backend": "redis" if (client and cache._redis_available) else "in-memory"
        }

job_queue = JobQueueService()
