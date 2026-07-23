#!/usr/bin/env python3
"""
ZePlay Development Video Import Tool

Import local MP4 (and other supported) video files directly from disk into the
ZePlay catalog without using the Admin Dashboard upload UI.

Reuses existing video storage, HLS processing, and movie catalog services.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

# Ensure backend/ is on sys.path when run as `python import_video.py`
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)


def log(message: str) -> None:
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}", flush=True)


def format_bytes(num_bytes: int) -> str:
    if num_bytes < 1024:
        return f"{num_bytes} B"
    if num_bytes < 1024 ** 2:
        return f"{num_bytes / 1024:.1f} KB"
    if num_bytes < 1024 ** 3:
        return f"{num_bytes / (1024 ** 2):.1f} MB"
    return f"{num_bytes / (1024 ** 3):.2f} GB"


def title_from_filename(path: str) -> str:
    base = os.path.basename(path)
    name, _ = os.path.splitext(base)
    cleaned = re.sub(r"[_\-]+", " ", name).strip()
    return cleaned.title() if cleaned else "Imported Movie"


async def probe_video_metadata(file_path: str) -> dict:
    """Extract duration and resolution using FFmpeg (same probe approach as HLS pipeline)."""
    from app.services.video_processing_service import get_ffmpeg_path

    metadata = {"duration_seconds": None, "width": None, "height": None}
    ffmpeg_bin = get_ffmpeg_path()
    if not ffmpeg_bin:
        return metadata

    proc = await asyncio.create_subprocess_exec(
        ffmpeg_bin, "-i", file_path,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    output = stderr.decode(errors="replace")

    duration_match = re.search(r"Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})", output)
    if duration_match:
        hours, mins, secs = duration_match.groups()
        metadata["duration_seconds"] = (
            float(hours) * 3600 + float(mins) * 60 + float(secs)
        )

    resolution_match = re.search(r"(\d{2,5})x(\d{2,5})", output)
    if resolution_match:
        metadata["width"] = int(resolution_match.group(1))
        metadata["height"] = int(resolution_match.group(2))

    return metadata


async def generate_poster(
    video_path: str,
    movie_id: UUID,
    duration_seconds: Optional[float] = None,
) -> Optional[str]:
    """
    Extract a poster frame from the video using FFmpeg.
    Saves to backend/static/posters/ and returns the public URL path.
    """
    from app.services.video_processing_service import get_ffmpeg_path

    ffmpeg_bin = get_ffmpeg_path()
    if not ffmpeg_bin:
        log("WARN  FFmpeg not found — skipping poster generation.")
        return None

    static_dir = os.path.join(_BACKEND_DIR, "static", "posters")
    os.makedirs(static_dir, exist_ok=True)
    poster_filename = f"poster_{movie_id}.jpg"
    poster_path = os.path.join(static_dir, poster_filename)

    seek_at = 5.0
    if duration_seconds and duration_seconds > 10:
        seek_at = min(duration_seconds * 0.1, 30.0)

    cmd = [
        ffmpeg_bin, "-y",
        "-ss", str(seek_at),
        "-i", video_path,
        "-vframes", "1",
        "-q:v", "2",
        "-vf", "scale=480:-2",
        poster_path,
    ]

    log(f"Generating poster frame at {seek_at:.1f}s …")
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    await proc.communicate()

    if proc.returncode != 0 or not os.path.exists(poster_path):
        log("WARN  Poster generation failed — using placeholder thumbnail.")
        return None

    poster_url = f"/static/posters/{poster_filename}"
    log(f"Poster saved → {poster_url}")
    return poster_url


async def poll_processing_progress(video_id: UUID, stop_event: asyncio.Event) -> None:
    """Poll DB for HLS transcoding progress and print updates to terminal."""
    from app.database import SessionLocal
    from app.models.video import Video
    from sqlalchemy import select

    last_logged = -1.0
    while not stop_event.is_set():
        try:
            async with SessionLocal() as db:
                result = await db.execute(
                    select(Video).filter(Video.video_id == video_id)
                )
                video = result.scalars().first()
                if video:
                    progress = video.processing_progress or 0.0
                    if progress - last_logged >= 5.0 or (
                        video.status in ("completed", "failed") and progress != last_logged
                    ):
                        log(f"HLS transcoding progress: {progress:.0f}% (status: {video.status})")
                        last_logged = progress
                    if video.status in ("completed", "failed"):
                        return
        except Exception:
            pass
        await asyncio.sleep(2)


async def run_import(
    source_path: str,
    title: Optional[str] = None,
    year: Optional[int] = None,
    description: Optional[str] = None,
    genre_name: Optional[str] = None,
) -> None:
    from app.database import SessionLocal
    from app.models.genre import Genre
    from app.models.video import Video
    from app.schemas.movie import MovieCreate
    from app.services import movie_service, video_storage_service
    from app.services.cache_service import cache
    from app.services.video_processing_service import process_video_to_hls
    from sqlalchemy import select

    source_path = os.path.abspath(source_path)
    if not os.path.isfile(source_path):
        log(f"ERROR File not found: {source_path}")
        sys.exit(1)

    ext = os.path.splitext(source_path)[1].lower()
    if ext not in video_storage_service.ALLOWED_VIDEO_EXTENSIONS:
        log(
            f"ERROR Unsupported extension '{ext}'. "
            f"Allowed: {', '.join(sorted(video_storage_service.ALLOWED_VIDEO_EXTENSIONS))}"
        )
        sys.exit(1)

    file_size = os.path.getsize(source_path)
    movie_title = title or title_from_filename(source_path)
    release_year = year or datetime.now().year
    movie_description = description or f"Imported from {os.path.basename(source_path)}"

    log("=" * 60)
    log("ZePlay Development Video Import")
    log("=" * 60)
    log(f"Source file : {source_path}")
    log(f"File size   : {format_bytes(file_size)}")
    log(f"Movie title : {movie_title}")
    log(f"Release year: {release_year}")
    log("-" * 60)

    async with SessionLocal() as db:
        # Step 1: Probe metadata
        log("Step 1/5 — Probing video metadata …")
        metadata = await probe_video_metadata(source_path)
        duration_seconds = metadata.get("duration_seconds")
        duration_minutes = max(1, int((duration_seconds or 120) / 60))
        if duration_seconds:
            log(
                f"Duration: {duration_seconds:.0f}s ({duration_minutes} min)"
                + (f" | Resolution: {metadata['width']}x{metadata['height']}" if metadata.get("width") else "")
            )
        else:
            log("Could not probe duration — using 120 min placeholder for catalog.")

        # Step 2: Create catalog movie entry
        log("Step 2/5 — Creating catalog movie entry …")
        placeholder_thumb = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&q=80"
        movie_in = MovieCreate(
            title=movie_title,
            description=movie_description,
            release_year=release_year,
            duration_minutes=duration_minutes,
            thumbnail_url=placeholder_thumb,
            video_url="pending",
            genre_ids=[],
        )

        if genre_name:
            genre_result = await db.execute(
                select(Genre).filter(Genre.name.ilike(genre_name.strip()))
            )
            genre = genre_result.scalars().first()
            if genre:
                movie_in.genre_ids = [genre.genre_id]
                log(f"Linked genre: {genre.name}")
            else:
                log(f"WARN  Genre '{genre_name}' not found — movie created without genre.")

        movie = await movie_service.create_movie(db, movie_in)
        log(f"Movie created → ID: {movie.movie_id}")

        # Step 3: Copy video to storage and create Video record
        log("Step 3/5 — Copying video to storage/videos …")
        copy_start = time.time()
        video = await video_storage_service.import_video_from_disk(
            db,
            source_path,
            movie_id=movie.movie_id,
            original_filename=os.path.basename(source_path),
        )
        log(
            f"Video copied in {time.time() - copy_start:.1f}s "
            f"→ ID: {video.video_id} | UUID filename: {video.filename}"
        )

        if duration_seconds or metadata.get("width"):
            video.duration_seconds = duration_seconds
            video.width = metadata.get("width")
            video.height = metadata.get("height")
            await db.commit()
            await db.refresh(video)

        # Step 4: Generate poster thumbnail
        log("Step 4/5 — Generating poster thumbnail …")
        poster_url = await generate_poster(
            video.storage_path, movie.movie_id, duration_seconds
        )
        if poster_url:
            from app.services.movie_service import get_movie_by_id_orm
            db_movie = await get_movie_by_id_orm(db, movie.movie_id)
            if db_movie:
                db_movie.thumbnail_url = poster_url
                await db.commit()
                await cache.invalidate_pattern("catalog:*")

        # Step 5: HLS ABR transcoding (480p / 720p / 1080p + master.m3u8)
        log("Step 5/5 — Starting HLS ABR transcoding (480p, 720p, 1080p) …")
        log("This may take several minutes depending on video length …")

        stop_event = asyncio.Event()
        progress_task = asyncio.create_task(
            poll_processing_progress(video.video_id, stop_event)
        )
        hls_start = time.time()
        try:
            video = await process_video_to_hls(db, video.video_id)
        finally:
            stop_event.set()
            await progress_task

        elapsed = time.time() - hls_start

        if video.status == "completed":
            await cache.invalidate_pattern("catalog:*")
            await cache.invalidate_pattern("rec:*")

            hls_dir = video.hls_path or os.path.join(
                os.path.dirname(video.storage_path),
                f"{video.video_id}_hls",
            )
            master_playlist = os.path.join(hls_dir, "master.m3u8")

            log("-" * 60)
            log("IMPORT COMPLETE")
            log(f"Status          : {video.status}")
            log(f"Transcode time  : {elapsed:.1f}s")
            log(f"Movie ID        : {movie.movie_id}")
            log(f"Video ID        : {video.video_id}")
            log(f"HLS master      : {video.master_playlist_url}")
            log(f"Catalog URL     : /movies/{movie.movie_id}")
            if os.path.exists(master_playlist):
                for variant in ("480p", "720p", "1080p"):
                    variant_dir = os.path.join(hls_dir, variant)
                    if os.path.isdir(variant_dir):
                        segment_count = len([f for f in os.listdir(variant_dir) if f.endswith(".ts")])
                        log(f"  {variant}/index.m3u8 — {segment_count} segments")
            log("-" * 60)
            log("The movie is now visible in Admin Dashboard and Catalog.")
            log("Start the backend (uvicorn) and open the movie page to test playback.")
        else:
            log(f"ERROR HLS processing failed: {video.error_message}")
            sys.exit(1)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Import a local video file into ZePlay (catalog + HLS ABR pipeline).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python import_video.py "D:\\Videos\\movie.mp4"
  python import_video.py "D:\\Movies\\Avatar.mp4" --title "Avatar" --year 2009
  python import_video.py "./samples/clip.mp4" --genre Action --description "Sample clip"
        """,
    )
    parser.add_argument(
        "file",
        help="Absolute or relative path to the source video file (e.g. D:\\Videos\\movie.mp4)",
    )
    parser.add_argument(
        "--title",
        help="Catalog movie title (default: derived from filename)",
    )
    parser.add_argument(
        "--year",
        type=int,
        help="Release year (default: current year)",
    )
    parser.add_argument(
        "--description",
        help="Movie description (default: auto-generated import note)",
    )
    parser.add_argument(
        "--genre",
        help="Optional genre name to link (must exist in database)",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    try:
        asyncio.run(
            run_import(
                source_path=args.file,
                title=args.title,
                year=args.year,
                description=args.description,
                genre_name=args.genre,
            )
        )
    except KeyboardInterrupt:
        log("\nImport cancelled by user.")
        sys.exit(130)
    except FileNotFoundError as exc:
        log(f"ERROR {exc}")
        sys.exit(1)
    except ValueError as exc:
        log(f"ERROR {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
