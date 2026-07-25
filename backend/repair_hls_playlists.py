#!/usr/bin/env python3
"""
ZePlay HLS Playlist Repair Tool

Regenerates variant index.m3u8 playlists from existing .ts segment files on disk.
Fixes playlists that were overwritten by the fallback dummy generator after a
partially-successful FFmpeg transcode.

Usage:
    python repair_hls_playlists.py                          # Repair ALL videos with status=completed
    python repair_hls_playlists.py --video-id <UUID>        # Repair a specific video
"""

from __future__ import annotations

import argparse
import asyncio
import os
import re
import subprocess
import sys
from uuid import UUID

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)


def get_ffmpeg_path():
    """Locate FFmpeg binary using the same logic as the processing service."""
    from app.services.video_processing_service import get_ffmpeg_path as _get
    return _get()


def probe_segment_duration(ffmpeg_bin: str, segment_path: str) -> float:
    """
    Use ffmpeg -i to read the duration of a single .ts segment.
    Returns duration in seconds, or falls back to 6.0 if probing fails.
    """
    try:
        proc = subprocess.run(
            [ffmpeg_bin, "-i", segment_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=10,
        )
        output = proc.stderr.decode(errors="replace")
        match = re.search(r"Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})", output)
        if match:
            h, m, s = match.groups()
            return float(h) * 3600 + float(m) * 60 + float(s)
    except Exception:
        pass
    return 6.0  # Default HLS segment duration used during encoding


def regenerate_variant_playlist(variant_dir: str, ffmpeg_bin: str | None) -> int:
    """
    Scan a variant directory for .ts segments, probe durations, and write
    a correct index.m3u8.

    Returns the number of segments written.
    """
    ts_files = sorted(
        [f for f in os.listdir(variant_dir) if f.endswith(".ts")],
        key=lambda x: int(re.search(r"(\d+)", x).group(1)) if re.search(r"(\d+)", x) else 0,
    )

    if not ts_files:
        return 0

    # Filter out tiny dummy segments (< 50KB) — only keep real ones
    real_segments = []
    for ts in ts_files:
        fpath = os.path.join(variant_dir, ts)
        size = os.path.getsize(fpath)
        if size > 50_000:  # Real segments are typically 2-7 MB
            real_segments.append(ts)

    if not real_segments:
        print(f"  WARN: No real segments found in {variant_dir} (all < 50KB)")
        return 0

    # Probe durations
    max_duration = 0.0
    entries = []
    for ts in real_segments:
        fpath = os.path.join(variant_dir, ts)
        if ffmpeg_bin:
            duration = probe_segment_duration(ffmpeg_bin, fpath)
        else:
            duration = 6.0
        max_duration = max(max_duration, duration)
        entries.append((ts, duration))

    target_duration = int(max_duration) + 1

    # Build playlist content
    lines = [
        "#EXTM3U",
        "#EXT-X-VERSION:3",
        f"#EXT-X-TARGETDURATION:{target_duration}",
        "#EXT-X-MEDIA-SEQUENCE:0",
        "#EXT-X-PLAYLIST-TYPE:VOD",
    ]
    for ts, duration in entries:
        lines.append(f"#EXTINF:{duration:.6f},")
        lines.append(ts)
    lines.append("#EXT-X-ENDLIST")
    lines.append("")

    playlist_path = os.path.join(variant_dir, "index.m3u8")
    with open(playlist_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    return len(real_segments)


async def repair_video(video_id_str: str | None = None) -> None:
    from app.database import SessionLocal
    from app.models.video import Video
    from sqlalchemy import select

    ffmpeg_bin = get_ffmpeg_path()
    if not ffmpeg_bin:
        print("ERROR: FFmpeg not found. Cannot probe segment durations (will use 6.0s fallback).")

    async with SessionLocal() as db:
        if video_id_str:
            vid = UUID(video_id_str)
            result = await db.execute(select(Video).filter(Video.video_id == vid))
            videos = [result.scalars().first()]
            if not videos[0]:
                print(f"ERROR: Video {video_id_str} not found in database.")
                return
        else:
            result = await db.execute(
                select(Video).filter(
                    Video.status == "completed",
                    Video.format == "hls",
                )
            )
            videos = result.scalars().all()

        if not videos:
            print("No completed HLS videos found to repair.")
            return

        for video in videos:
            if not video:
                continue

            hls_dir = video.hls_path
            if not hls_dir or not os.path.isdir(hls_dir):
                print(f"SKIP: Video {video.video_id} — HLS directory not found at {hls_dir}")
                continue

            print(f"\n{'='*60}")
            print(f"Repairing video: {video.video_id}")
            print(f"  Original file: {video.original_filename}")
            print(f"  HLS dir: {hls_dir}")
            print(f"  Current progress: {video.processing_progress}%")

            total_segments = 0
            for variant in ["480p", "720p", "1080p"]:
                variant_dir = os.path.join(hls_dir, variant)
                if not os.path.isdir(variant_dir):
                    print(f"  SKIP: {variant}/ directory not found")
                    continue

                count = regenerate_variant_playlist(variant_dir, ffmpeg_bin)
                total_segments += count
                print(f"  {variant}/index.m3u8 — {count} segments written")

            if total_segments > 0:
                video.processing_progress = 100.0
                await db.commit()
                print(f"  Updated processing_progress to 100.0")
            else:
                print(f"  WARN: No segments repaired for this video.")

            print(f"{'='*60}")

    print("\nRepair complete.")


def main():
    parser = argparse.ArgumentParser(description="Repair HLS playlists from existing segments on disk.")
    parser.add_argument("--video-id", help="Specific video UUID to repair (default: all completed HLS videos)")
    args = parser.parse_args()

    asyncio.run(repair_video(args.video_id))


if __name__ == "__main__":
    main()
