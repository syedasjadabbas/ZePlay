import os
import sys
import uuid
import signal
import asyncio
import logging
from typing import Optional
from uuid import UUID

# Ensure backend root is on sys.path when executed via python -m app.worker
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import SessionLocal, engine
from app.services.cache_service import cache
from app.services.job_queue_service import job_queue
from app.services.video_processing_service import process_video_to_hls
from app.models.video import Video
from sqlalchemy import select

logger = logging.getLogger("zeplay.worker")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

MAX_RETRIES = 3

class ZePlayWorker:
    def __init__(self, worker_id: Optional[str] = None):
        self.worker_id = worker_id or f"worker_{uuid.uuid4().hex[:8]}"
        self.running = False

    async def start(self):
        """Starts the background worker event loop."""
        self.running = True
        logger.info(f"Starting ZePlay Background Video Worker [{self.worker_id}]")
        
        # Initialize Redis cache & connections
        await cache.initialize()

        # Register signal handlers for graceful shutdown
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, lambda: asyncio.create_task(self.stop()))
            except NotImplementedError:
                # Windows signal handler fallback
                pass

        heartbeat_task = asyncio.create_task(self._heartbeat_loop())

        try:
            while self.running:
                job_data = await job_queue.dequeue_job(timeout_seconds=2)
                if not job_data:
                    await asyncio.sleep(0.5)
                    continue

                await self.process_job(job_data)
        finally:
            heartbeat_task.cancel()
            logger.info(f"Worker [{self.worker_id}] stopped cleanly.")

    async def stop(self):
        """Triggers graceful worker shutdown."""
        logger.info(f"Worker [{self.worker_id}] shutdown signal received...")
        self.running = False

    async def _heartbeat_loop(self):
        """Sends periodic heartbeat while worker is running."""
        while self.running:
            await job_queue.update_heartbeat(self.worker_id, status="active")
            await asyncio.sleep(10)

    async def process_job(self, job_data: dict, db=None):
        """Processes a single video transcoding job with lock acquisition and retries."""
        vid_str = job_data.get("video_id")
        retry_count = job_data.get("retry_count", 0)

        if not vid_str:
            return

        try:
            video_id = UUID(vid_str)
        except Exception:
            logger.error(f"Invalid video_id in job: {vid_str}")
            return

        # Deduplication: Acquire Redis lock for this video asset
        locked = await job_queue.acquire_lock(vid_str, self.worker_id, ttl_seconds=600)
        if not locked:
            logger.info(f"[WORKER] Video {vid_str} is already locked by another worker. Skipping.")
            return

        logger.info(f"[WORKER {self.worker_id}] Claimed job for video {vid_str} (attempt {retry_count + 1}/{MAX_RETRIES + 1})")

        try:
            if db is not None:
                await self._execute_transcode(db, video_id, job_data)
            else:
                async with SessionLocal() as session:
                    await self._execute_transcode(session, video_id, job_data)
        except Exception as exc:
            logger.exception(f"[WORKER] Unexpected exception processing video {vid_str}: {exc}")
            if db is not None:
                await self._handle_retry_or_fail(db, video_id, job_data, str(exc))
            else:
                async with SessionLocal() as session:
                    await self._handle_retry_or_fail(session, video_id, job_data, str(exc))
        finally:
            await job_queue.release_lock(vid_str)

    async def _execute_transcode(self, db, video_id: UUID, job_data: dict):
        vid_str = str(video_id)
        res = await db.execute(select(Video).filter(Video.video_id == video_id))
        video = res.scalars().first()

        if not video:
            logger.warning(f"[WORKER] Video record {vid_str} not found in database. Aborting.")
            return

        if video.status == "completed":
            logger.info(f"[WORKER] Video {vid_str} is already in 'completed' state. Skipping transcoding.")
            return

        # Execute HLS transcoding
        processed_video = await process_video_to_hls(db, video_id)

        if processed_video and processed_video.status == "completed":
            logger.info(f"[WORKER] Successfully completed transcoding for video {vid_str}")
        else:
            err_msg = processed_video.error_message if processed_video else "Transcoding failed"
            logger.error(f"[WORKER] Transcoding failed for video {vid_str}: {err_msg}")
            await self._handle_retry_or_fail(db, video_id, job_data, err_msg)

    async def _handle_retry_or_fail(self, db, video_id: UUID, job_data: dict, error_detail: str):
        """Handles bounded retries for transient infrastructure failures."""
        retry_count = job_data.get("retry_count", 0)
        vid_str = str(video_id)

        # Bounded retries check
        if retry_count < MAX_RETRIES and "Invalid input" not in error_detail:
            next_retry = retry_count + 1
            backoff_delay = 2 ** next_retry
            logger.info(f"[WORKER] Retrying job {vid_str} in {backoff_delay}s (Attempt {next_retry}/{MAX_RETRIES})...")
            await asyncio.sleep(backoff_delay)
            await job_queue.enqueue_job(video_id, retry_count=next_retry)
        else:
            # Mark permanently failed in PostgreSQL
            res = await db.execute(select(Video).filter(Video.video_id == video_id))
            video = res.scalars().first()
            if video:
                video.status = "failed"
                video.error_message = f"Processing failed after {retry_count + 1} attempt(s)."
                await db.commit()
                logger.error(f"[WORKER] Video {vid_str} marked permanently as failed.")

async def main():
    worker_id = sys.argv[1] if len(sys.argv) > 1 else None
    worker = ZePlayWorker(worker_id=worker_id)
    await worker.start()

if __name__ == "__main__":
    asyncio.run(main())
