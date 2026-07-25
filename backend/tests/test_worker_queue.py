import os
import uuid
import asyncio
import pytest
from app.services.cache_service import cache
from app.services.job_queue_service import job_queue
from app.worker import ZePlayWorker
from app.models.video import Video
from sqlalchemy import select

pytestmark = pytest.mark.asyncio

@pytest.fixture(autouse=True)
async def setup_redis_cache():
    """Ensure Redis cache client is initialized for test event loop."""
    await cache.initialize()

async def test_job_enqueue_and_dequeue():
    """Test enqueuing and dequeuing jobs in JobQueueService."""
    test_id = uuid.uuid4()
    success = await job_queue.enqueue_job(test_id)
    assert success is True

    job = await job_queue.dequeue_job(timeout_seconds=1)
    assert job is not None
    assert "video_id" in job
    assert job["retry_count"] == 0

async def test_distributed_lock_deduplication_and_release():
    """Test Redis/distributed lock acquisition and cross-worker deduplication."""
    vid_str = str(uuid.uuid4())
    worker_1 = "worker_alpha"
    worker_2 = "worker_beta"

    # Worker 1 acquires lock
    acquired_1 = await job_queue.acquire_lock(vid_str, worker_1, ttl_seconds=10)
    assert acquired_1 is True

    # Worker 2 attempting same lock fails (deduplication)
    acquired_2 = await job_queue.acquire_lock(vid_str, worker_2, ttl_seconds=10)
    assert acquired_2 is False

    # Worker 1 releases lock
    await job_queue.release_lock(vid_str)

    # Worker 2 can now acquire lock
    acquired_3 = await job_queue.acquire_lock(vid_str, worker_2, ttl_seconds=10)
    assert acquired_3 is True
    await job_queue.release_lock(vid_str)

async def test_worker_processing_flow():
    """Test worker processing job execution and state updates."""
    from app.database import SessionLocal
    vid_id = uuid.uuid4()
    fname = f"worker_test_{vid_id.hex[:6]}.mp4"
    async with SessionLocal() as db:
        video = Video(
            video_id=vid_id,
            filename=fname,
            original_filename=fname,
            storage_path=f"storage/videos/{fname}",
            file_size_bytes=1024,
            mime_type="video/mp4",
            status="queued"
        )
        db.add(video)
        await db.commit()

        worker = ZePlayWorker(worker_id="test_worker_1")
        job_payload = {"video_id": str(vid_id), "retry_count": 0}

        # Process job via worker using active db session
        await worker.process_job(job_payload, db=db)

        # Inspect updated video state in DB
        res = await db.execute(select(Video).filter(Video.video_id == vid_id))
        updated_video = res.scalars().first()
        assert updated_video is not None
        assert updated_video.status in ["completed", "failed"]

async def test_multi_worker_lock_isolation():
    """Test multi-worker execution where two workers compete for the same job lock."""
    vid_str = str(uuid.uuid4())
    w1 = ZePlayWorker(worker_id="worker_1")
    w2 = ZePlayWorker(worker_id="worker_2")

    # Worker 1 locks job
    lock_1 = await job_queue.acquire_lock(vid_str, w1.worker_id, ttl_seconds=30)
    assert lock_1 is True

    # Worker 2 attempts same job and is skipped due to lock
    lock_2 = await job_queue.acquire_lock(vid_str, w2.worker_id, ttl_seconds=30)
    assert lock_2 is False

    await job_queue.release_lock(vid_str)
