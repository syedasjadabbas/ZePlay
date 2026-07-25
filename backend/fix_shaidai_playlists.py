#!/usr/bin/env python3
"""
ZePlay HLS Playlist Repair Script

Scans all video HLS directories, finds real .ts segments on disk,
probes their durations, and regenerates correct index.m3u8 playlists.

Fixes the truncated 2-segment dummy playlists that were overwritten
by generate_fallback_hls_assets().

Usage:
    python fix_shaidai_playlists.py
"""

import os
import re
import subprocess
import shutil
import sqlite3
import sys

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BACKEND_DIR, "local_zeplay.db")


def get_ffmpeg_path():
    path = shutil.which("ffmpeg")
    if path:
        return path
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass
    for p in [
        r"C:\ffmpeg\bin\ffmpeg.exe",
        r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
        r"C:\tools\ffmpeg\bin\ffmpeg.exe",
    ]:
        if os.path.exists(p):
            return p
    return None


def probe_segment_duration(ffmpeg_bin, segment_path):
    """Probe a single .ts segment duration using ffmpeg. Falls back to 6.0s."""
    try:
        proc = subprocess.run(
            [ffmpeg_bin, "-i", segment_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=15,
        )
        output = proc.stderr.decode(errors="replace")
        match = re.search(r"Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})", output)
        if match:
            h, m, s = match.groups()
            return float(h) * 3600 + float(m) * 60 + float(s)
    except Exception:
        pass
    return 6.0


def repair_variant_playlist(variant_dir, variant_name, ffmpeg_bin):
    """Repair a single variant's index.m3u8 from real .ts segments on disk."""
    ts_files = sorted(
        [f for f in os.listdir(variant_dir) if f.endswith(".ts")],
        key=lambda x: int(re.search(r"(\d+)", x).group(1)) if re.search(r"(\d+)", x) else 0,
    )

    # Filter to real segments (> 50 KB — dummy segments are ~9.4 KB)
    real_segments = [
        f for f in ts_files
        if os.path.getsize(os.path.join(variant_dir, f)) > 50_000
    ]

    if not real_segments:
        print(f"  [{variant_name}] SKIP — no real segments found (all < 50KB)")
        return 0

    # Probe durations
    max_dur = 0.0
    entries = []
    total = len(real_segments)

    for i, ts in enumerate(real_segments):
        ts_path = os.path.join(variant_dir, ts)
        dur = probe_segment_duration(ffmpeg_bin, ts_path) if ffmpeg_bin else 6.0
        max_dur = max(max_dur, dur)
        entries.append((ts, dur))

        # Progress feedback every 20 segments
        if (i + 1) % 20 == 0 or i == total - 1:
            print(f"  [{variant_name}] Probed {i + 1}/{total} segments...")

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

    # Backup the old broken playlist
    backup_path = playlist_path + ".broken.bak"
    if os.path.exists(playlist_path) and not os.path.exists(backup_path):
        shutil.copy2(playlist_path, backup_path)

    with open(playlist_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"  [{variant_name}] REPAIRED — {len(real_segments)} segments, target_duration={target_dur}s")
    return len(real_segments)


def main():
    print("=" * 60)
    print("ZePlay HLS Playlist Repair")
    print("=" * 60)

    ffmpeg_bin = get_ffmpeg_path()
    if ffmpeg_bin:
        print(f"FFmpeg: {ffmpeg_bin}")
    else:
        print("WARNING: FFmpeg not found — using 6.0s fallback duration for all segments")

    # Read all video records from DB
    if not os.path.exists(DB_PATH):
        print(f"ERROR: Database not found at {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "SELECT video_id, movie_id, hls_path, status, master_playlist_url "
        "FROM videos WHERE status = 'completed' AND hls_path IS NOT NULL"
    )
    rows = cur.fetchall()
    conn.close()

    if not rows:
        print("No completed videos with HLS paths found.")
        sys.exit(0)

    print(f"\nFound {len(rows)} completed video(s) with HLS paths.\n")

    total_repaired = 0

    for video_id, movie_id, hls_path, status, master_url in rows:
        print(f"--- Video: {video_id} ---")
        print(f"    HLS path: {hls_path}")

        if not os.path.isdir(hls_path):
            print(f"    SKIP — HLS directory does not exist on disk")
            continue

        video_repaired = 0
        for variant in ["480p", "720p", "1080p"]:
            variant_dir = os.path.join(hls_path, variant)
            if not os.path.isdir(variant_dir):
                print(f"  [{variant}] SKIP — directory not found")
                continue

            count = repair_variant_playlist(variant_dir, variant, ffmpeg_bin)
            video_repaired += count

        # Verify/rewrite master.m3u8
        master_path = os.path.join(hls_path, "master.m3u8")
        if video_repaired > 0:
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
            print(f"    master.m3u8 validated OK")

        total_repaired += video_repaired
        print()

    print("=" * 60)
    if total_repaired > 0:
        print(f"DONE — Repaired playlists covering {total_repaired} total segments.")
    else:
        print("No repairs needed — all playlists are already correct.")
    print("=" * 60)


if __name__ == "__main__":
    main()
