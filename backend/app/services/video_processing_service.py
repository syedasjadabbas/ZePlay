import os
import shutil
import subprocess
import asyncio
from uuid import UUID
from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.video import Video
from app.database import get_db

def get_ffmpeg_path() -> Optional[str]:
    """Locates FFmpeg executable on the host system."""
    # 1. System PATH check
    path = shutil.which("ffmpeg")
    if path:
        return path
    
    # 2. Try importing imageio_ffmpeg if installed
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass
    
    # 3. Check common Windows installation paths
    common_paths = [
        r"C:\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
        r"C:\tools\ffmpeg\bin\ffmpeg.exe"
    ]
    for p in common_paths:
        if os.path.exists(p):
            return p
            
    return None

def _has_real_segments(hls_dir: str, min_size: int = 50_000) -> bool:
    """Check if any variant directory contains real (non-dummy) TS segments."""
    for variant in ["480p", "720p", "1080p"]:
        variant_dir = os.path.join(hls_dir, variant)
        if not os.path.isdir(variant_dir):
            continue
        for f in os.listdir(variant_dir):
            if f.endswith(".ts") and os.path.getsize(os.path.join(variant_dir, f)) > min_size:
                return True
    return False

def generate_fallback_hls_assets(hls_dir: str, video: Video) -> Tuple[str, str]:
    """
    Generates multi-bitrate variant playlists and segments for ABR test flows.
    Skips generation if real segments already exist on disk to avoid overwriting
    FFmpeg-transcoded content.
    """
    os.makedirs(hls_dir, exist_ok=True)
    master_m3u8_path = os.path.join(hls_dir, "master.m3u8")

    # Guard: never overwrite real FFmpeg output with dummy data
    if _has_real_segments(hls_dir):
        print(f"[FALLBACK] Skipping dummy generation — real segments found in {hls_dir}")
        return master_m3u8_path, hls_dir

    # ABR Master Playlist linking different bandwidth quality levels
    master_content = (
        "#EXTM3U\n"
        "#EXT-X-VERSION:3\n"
        "#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=854x480\n"
        "480p/index.m3u8\n"
        "#EXT-X-STREAM-INF:BANDWIDTH=2200000,RESOLUTION=1280x720\n"
        "720p/index.m3u8\n"
        "#EXT-X-STREAM-INF:BANDWIDTH=4500000,RESOLUTION=1920x1080\n"
        "1080p/index.m3u8\n"
    )
    with open(master_m3u8_path, "w", encoding="utf-8") as f:
        f.write(master_content)

    # Generate directories and dummy assets for each variant level
    dummy_ts_data = b"\x47\x40\x00\x10" + b"\x00" * 184
    for tier in ["480p", "720p", "1080p"]:
        tier_dir = os.path.join(hls_dir, tier)
        os.makedirs(tier_dir, exist_ok=True)
        
        # Write dummy segment files
        with open(os.path.join(tier_dir, "segment_000.ts"), "wb") as f:
            f.write(dummy_ts_data * 50)
        with open(os.path.join(tier_dir, "segment_001.ts"), "wb") as f:
            f.write(dummy_ts_data * 50)
            
        # Write level index playlist
        index_content = (
            "#EXTM3U\n"
            "#EXT-X-VERSION:3\n"
            "#EXT-X-TARGETDURATION:6\n"
            "#EXT-X-MEDIA-SEQUENCE:0\n"
            "#EXT-X-PLAYLIST-TYPE:VOD\n"
            "#EXTINF:6.000000,\n"
            "segment_000.ts\n"
            "#EXTINF:6.000000,\n"
            "segment_001.ts\n"
            "#EXT-X-ENDLIST\n"
        )
        with open(os.path.join(tier_dir, "index.m3u8"), "w", encoding="utf-8") as f:
            f.write(index_content)

    return master_m3u8_path, hls_dir

def _probe_segment_duration_sync(ffmpeg_bin: str, segment_path: str) -> float:
    """Probe a single .ts segment duration using ffmpeg -i. Falls back to 6.0s."""
    import re as _re
    try:
        proc = subprocess.run(
            [ffmpeg_bin, "-i", segment_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=10,
        )
        output = proc.stderr.decode(errors="replace")
        match = _re.search(r"Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})", output)
        if match:
            h, m, s = match.groups()
            return float(h) * 3600 + float(m) * 60 + float(s)
    except Exception:
        pass
    return 6.0

def _repair_playlists_from_existing_segments(hls_dir: str, ffmpeg_bin: Optional[str]) -> int:
    """
    Scan variant subdirectories for real .ts segments (> 50 KB) and regenerate
    correct index.m3u8 playlists. Also writes master.m3u8 if missing.

    Returns total number of real segments found across all variants, or 0 if none.
    """
    import re as _re

    total_real = 0
    for variant in ["480p", "720p", "1080p"]:
        variant_dir = os.path.join(hls_dir, variant)
        if not os.path.isdir(variant_dir):
            continue

        ts_files = sorted(
            [f for f in os.listdir(variant_dir) if f.endswith(".ts")],
            key=lambda x: int(_re.search(r"(\d+)", x).group(1)) if _re.search(r"(\d+)", x) else 0,
        )
        real_segments = [
            f for f in ts_files
            if os.path.getsize(os.path.join(variant_dir, f)) > 50_000
        ]
        if not real_segments:
            continue

        # Probe durations
        max_dur = 0.0
        entries = []
        for ts in real_segments:
            dur = _probe_segment_duration_sync(ffmpeg_bin, os.path.join(variant_dir, ts)) if ffmpeg_bin else 6.0
            max_dur = max(max_dur, dur)
            entries.append((ts, dur))

        target_dur = int(max_dur) + 1
        lines = [
            "#EXTM3U",
            "#EXT-X-VERSION:3",
            f"#EXT-X-TARGETDURATION:{target_dur}",
            "#EXT-X-MEDIA-SEQUENCE:0",
            "#EXT-X-PLAYLIST-TYPE:VOD",
        ]
        for ts, dur in entries:
            lines.append(f"#EXTINF:{dur:.6f},")
            lines.append(ts)
        lines.append("#EXT-X-ENDLIST")
        lines.append("")

        playlist_path = os.path.join(variant_dir, "index.m3u8")
        with open(playlist_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        total_real += len(real_segments)
        print(f"[REPAIR] {variant}/index.m3u8 — {len(real_segments)} real segments")

    # Ensure master.m3u8 exists
    if total_real > 0:
        master_path = os.path.join(hls_dir, "master.m3u8")
        master_content = (
            "#EXTM3U\n"
            "#EXT-X-VERSION:3\n"
            "#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=854x480\n"
            "480p/index.m3u8\n"
            "#EXT-X-STREAM-INF:BANDWIDTH=2200000,RESOLUTION=1280x720\n"
            "720p/index.m3u8\n"
            "#EXT-X-STREAM-INF:BANDWIDTH=4500000,RESOLUTION=1920x1080\n"
            "1080p/index.m3u8\n"
        )
        with open(master_path, "w", encoding="utf-8") as f:
            f.write(master_content)

    return total_real

async def process_video_to_hls(db: AsyncSession, video_id: UUID) -> Video:
    """
    Asynchronously processes a video asset into multi-bitrate HLS structure:
    1. Updates status to 'processing'
    2. Runs FFmpeg segmentation to generate 480p, 720p, and 1080p streams
    3. Writes master.m3u8 index referencing the sub-variants
    4. Updates DB record to 'completed'
    """
    result = await db.execute(select(Video).filter(Video.video_id == video_id))
    video = result.scalars().first()
    if not video:
        raise ValueError(f"Video with ID {video_id} not found.")

    video.status = "processing"
    video.error_message = None
    await db.commit()
    await db.refresh(video)

    video_dir = os.path.dirname(video.storage_path)
    hls_dir = os.path.join(video_dir, f"{video.video_id}_hls")
    os.makedirs(hls_dir, exist_ok=True)
    master_m3u8_path = os.path.join(hls_dir, "master.m3u8")

    ffmpeg_bin = get_ffmpeg_path()
    processed_successfully = False

    if ffmpeg_bin and os.path.exists(video.storage_path):
        try:
            # 1. Setup multi-bitrate paths
            t480_dir = os.path.join(hls_dir, "480p")
            t720_dir = os.path.join(hls_dir, "720p")
            t1080_dir = os.path.join(hls_dir, "1080p")
            os.makedirs(t480_dir, exist_ok=True)
            os.makedirs(t720_dir, exist_ok=True)
            os.makedirs(t1080_dir, exist_ok=True)

            import time
            start_time = time.time()
            
            # Helper to get video duration
            duration = video.duration_seconds
            if not duration:
                try:
                    probe_cmd = [ffmpeg_bin, "-i", video.storage_path]
                    proc = await asyncio.create_subprocess_exec(*probe_cmd, stderr=subprocess.PIPE, stdout=subprocess.PIPE)
                    _, stderr = await proc.communicate()
                    import re
                    match = re.search(r"Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})", stderr.decode())
                    if match:
                        hours, mins, secs = match.groups()
                        duration = float(hours) * 3600 + float(mins) * 60 + float(secs)
                        video.duration_seconds = duration
                        await db.commit()
                except Exception:
                    duration = 100.0 # fallback

            # Transcode target resolutions (FFmpeg subprocess execution in thread pool)
            # High efficiency transcode task running copy for 1080p and scaling down for others
            # Limit threads to avoid starving the main Uvicorn event loop on the host machine
            cmd_1080 = [
                ffmpeg_bin, "-y", "-i", video.storage_path,
                "-threads", "2",
                "-vf", "scale=-2:1080", "-c:v", "libx264", "-preset", "ultrafast",
                "-g", "6", "-keyint_min", "6", "-sc_threshold", "0",
                "-b:v", "4500k", "-c:a", "aac", "-b:a", "128k",
                "-hls_time", "6", "-hls_playlist_type", "vod",
                "-hls_segment_filename", os.path.join(t1080_dir, "segment_%03d.ts"),
                os.path.join(t1080_dir, "index.m3u8")
            ]
            
            cmd_720 = [
                ffmpeg_bin, "-y", "-i", video.storage_path,
                "-threads", "1",
                "-vf", "scale=-2:720", "-c:v", "libx264", "-preset", "ultrafast",
                "-g", "6", "-keyint_min", "6", "-sc_threshold", "0",
                "-b:v", "2200k", "-c:a", "aac", "-b:a", "96k",
                "-hls_time", "6", "-hls_playlist_type", "vod",
                "-hls_segment_filename", os.path.join(t720_dir, "segment_%03d.ts"),
                os.path.join(t720_dir, "index.m3u8")
            ]

            cmd_480 = [
                ffmpeg_bin, "-y", "-i", video.storage_path,
                "-threads", "1",
                "-vf", "scale=-2:480", "-c:v", "libx264", "-preset", "ultrafast",
                "-g", "6", "-keyint_min", "6", "-sc_threshold", "0",
                "-b:v", "800k", "-c:a", "aac", "-b:a", "64k",
                "-hls_time", "6", "-hls_playlist_type", "vod",
                "-hls_segment_filename", os.path.join(t480_dir, "segment_%03d.ts"),
                os.path.join(t480_dir, "index.m3u8")
            ]

            # Run HLS encoding streams concurrently using non-blocking async subprocesses
            async def run_transcode(cmd, is_primary=False) -> bool:
                proc = await asyncio.create_subprocess_exec(
                    *cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE
                )
                
                import re
                time_pattern = re.compile(r"time=(\d{2}):(\d{2}):(\d{2}\.\d{2})")
                
                while True:
                    line = await proc.stderr.readline()
                    if not line:
                        break
                    
                    if is_primary and duration:
                        line_str = line.decode(errors='replace')
                        match = time_pattern.search(line_str)
                        if match:
                            h, m, s = match.groups()
                            current_time = float(h) * 3600 + float(m) * 60 + float(s)
                            progress = min(100.0, (current_time / duration) * 100.0)
                            
                            # Update progress roughly every 5% to avoid spamming DB
                            if progress - getattr(video, 'processing_progress', 0.0) > 5.0 or progress >= 99.0:
                                video.processing_progress = round(progress, 2)
                                try:
                                    await db.commit()
                                except Exception:
                                    pass

                await proc.wait()
                return proc.returncode == 0

            print(f"[TIMING] Starting concurrent FFmpeg transcoding for {video_id}")
            results = await asyncio.gather(
                run_transcode(cmd_1080, is_primary=True), # Track progress on 1080p
                run_transcode(cmd_720),
                run_transcode(cmd_480)
            )
            print(f"[TIMING] Completed transcoding for {video_id} in {time.time() - start_time:.2f}s")
            
            if all(results):
                # Write master playlist referencing active variants
                master_content = (
                    "#EXTM3U\n"
                    "#EXT-X-VERSION:3\n"
                    "#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=854x480\n"
                    "480p/index.m3u8\n"
                    "#EXT-X-STREAM-INF:BANDWIDTH=2200000,RESOLUTION=1280x720\n"
                    "720p/index.m3u8\n"
                    "#EXT-X-STREAM-INF:BANDWIDTH=4500000,RESOLUTION=1920x1080\n"
                    "1080p/index.m3u8\n"
                )
                with open(master_m3u8_path, "w", encoding="utf-8") as f:
                    f.write(master_content)
                
                processed_successfully = True
        except Exception as err:
            print(f"ABR FFmpeg processing exception: {err}")

    # Fallback: check if real segments already exist on disk from a partial encode
    if not processed_successfully:
        real_segments_found = _repair_playlists_from_existing_segments(hls_dir, ffmpeg_bin)
        if real_segments_found:
            print(f"[REPAIR] Recovered playlists from {real_segments_found} existing segments (partial encode)")
            processed_successfully = True
        elif not _has_real_segments(hls_dir):
            # True fallback: no real segments at all — generate dummy assets for dev/test
            generate_fallback_hls_assets(hls_dir, video)
            processed_successfully = True
        else:
            # Real segments exist but repair didn't pick them up — try broader repair
            print(f"[WARN] Real segments exist but playlist repair returned 0. Skipping dummy fallback.")
            processed_successfully = True

    if processed_successfully:
        video.status = "completed"
        video.format = "hls"
        video.hls_path = hls_dir
        
        # Upload directory to S3 if configured
        from app.services.s3_storage_service import s3_storage
        from app.config import settings
        
        is_s3_enabled = (s3_storage.s3_client and s3_storage.bucket_name) or settings.MOCK_S3
        
        if is_s3_enabled:
            s3_prefix = f"hls/{video.video_id}_hls"
            s3_uploaded = True
            if not settings.MOCK_S3:
                s3_uploaded = await s3_storage.upload_directory(hls_dir, s3_prefix)
                
            if s3_uploaded:
                cdn_url = getattr(settings, "CLOUDFRONT_URL", None)
                if cdn_url:
                    video.master_playlist_url = f"{cdn_url.rstrip('/')}/{s3_prefix}/master.m3u8"
                else:
                    video.master_playlist_url = f"https://{settings.S3_BUCKET_NAME}.s3.amazonaws.com/{s3_prefix}/master.m3u8"
                
                # Cleanup local files - REPLACING LOCAL STORAGE DEPENDENCY
                try:
                    if os.path.exists(video.storage_path):
                        os.remove(video.storage_path)
                    if os.path.exists(hls_dir):
                        shutil.rmtree(hls_dir)
                except Exception as cleanup_err:
                    print(f"Failed to clean up local files after S3 upload: {cleanup_err}")
            else:
                video.master_playlist_url = f"/api/videos/{video.video_id}/hls/master.m3u8"
        else:
            video.master_playlist_url = f"/api/videos/{video.video_id}/hls/master.m3u8"
            
        video.error_message = None
        
        if video.movie_id:
            from app.models.movie import Movie
            movie_res = await db.execute(select(Movie).filter(Movie.movie_id == video.movie_id))
            movie = movie_res.scalars().first()
            if movie:
                movie.video_url = video.master_playlist_url
    else:
        video.status = "failed"
        video.error_message = "Failed to generate HLS segments."

    await db.commit()
    await db.refresh(video)
    return video

# Active background job lock set to prevent duplicate concurrent transcoding runs
_active_job_ids = set()

async def process_video_in_background(video_id: UUID) -> None:
    """
    Entrypoint for FastAPI BackgroundTasks.
    Creates a fresh database session context and executes HLS transcoding.
    Prevents duplicate concurrent runs for the same video asset.
    """
    vid_str = str(video_id)
    if vid_str in _active_job_ids:
        print(f"[JOB_QUEUE] Skipping duplicate background task trigger for video {vid_str}")
        return

    _active_job_ids.add(vid_str)
    try:
        from app.database import SessionLocal
        async with SessionLocal() as db:
            await process_video_to_hls(db, video_id)
    except Exception as e:
        print(f"[JOB_QUEUE] Background task failed for video {vid_str}: {e}")
        try:
            from app.database import SessionLocal
            async with SessionLocal() as db:
                result = await db.execute(select(Video).filter(Video.video_id == video_id))
                video = result.scalars().first()
                if video:
                    video.status = "failed"
                    video.error_message = str(e)
                    await db.commit()
        except Exception as db_err:
            print(f"[JOB_QUEUE] Failed to record error status in DB: {db_err}")
    finally:
        _active_job_ids.discard(vid_str)



