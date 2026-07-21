# ZePlay: System Design & Architecture Docs (Sprint 4)

This document describes the high-level system topology, entities, authentication, video ingestion, and HLS video processing pipeline for ZePlay.

---

## 1. System Topology

```
                  ┌──────────────────────────────────────────────┐
                  │                 Users Client                 │
                  │        (React, TS, Vite, HLS.js, Tailwind)   │
                  └──────────────────────┬───────────────────────┘
                                         │ HTTPS (REST & HLS VOD Stream Delivery)
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │               FastAPI Backend                │
                  │  (Auth, Profiles, Catalog, Video Processor)  │
                  └──────────┬────────────────────────┬──────────┘
                             │                        │
             Async SQLAlchemy│                        │Local Chunked I/O & FFmpeg
                             ▼                        ▼
                  ┌────────────────────┐   ┌────────────────────┐
                  │ SQLite Datastore   │   │ Disk Asset Storage │
                  │ (Relational DB)    │   │ (`storage/videos/`)│
                  └────────────────────┘   └────────────────────┘
```

---

## 2. Core Entities

### 1. User
Represents account authentication credentials, verification state, role permissions, and billing plans.
* Fields: `user_id` (UUID), `email` (Unique VARCHAR), `name` (VARCHAR), `password_hash` (VARCHAR), `is_verified` (BOOLEAN), `is_admin` (BOOLEAN), `subscription_plan` (VARCHAR), `created_at` (Timestamp), `updated_at` (Timestamp).

### 2. Profile
Represents sub-users within an account (e.g., family members). Enforced limit: Up to 4 profiles per user.
* Fields: `profile_id` (UUID), `user_id` (UUID FK), `display_name` (VARCHAR), `avatar_url` (VARCHAR), `is_kids_profile` (BOOLEAN), `language_pref` (VARCHAR), `created_at` (Timestamp).

### 3. Movie
Represents catalog titles, metadata descriptions, and linked stream pointers.
* Fields: `movie_id` (UUID), `title` (VARCHAR), `description` (TEXT), `release_year` (INT), `duration_minutes` (INT), `thumbnail_url` (VARCHAR), `video_url` (VARCHAR), `created_at` (Timestamp).

### 4. Video Asset (HLS VOD Transcoding Entity)
Represents raw uploaded MP4 files, processed HLS playlists, segment paths, processing status state machine, and error logs.
* Fields: `video_id` (UUID), `movie_id` (UUID FK, nullable), `filename` (VARCHAR unique), `original_filename` (VARCHAR), `storage_path` (VARCHAR), `file_size_bytes` (BIGINT), `mime_type` (VARCHAR), `duration_seconds` (FLOAT), `width` (INT), `height` (INT), `status` (`uploaded`, `processing`, `completed`, `failed`), `format` (`mp4`, `webm`, `hls`), `master_playlist_url` (VARCHAR), `hls_path` (VARCHAR), `error_message` (VARCHAR), `created_at`, `updated_at`.

---

## 3. Video Transcoding & HLS Streaming Pipeline (Sprint 4)

### Processing Flow Sequence

```
Upload MP4 File
      │
      ▼
Save Local Disk Storage (`storage/videos/<uuid>.mp4`)
      │  (status: "uploaded")
      ▼
Trigger Video Processing Service (`video_processing_service.py`)
      │  (status: "processing")
      ▼
FFmpeg Packaging / Segmentation Subprocess
      │  Generates `master.m3u8` playlist and 6-second `.ts` segments
      ▼
Store HLS Directory (`storage/videos/<uuid>_hls/`)
      │  (status: "completed", format: "hls")
      ▼
Serve via HLS Endpoints & Stream in Frontend using `Hls.js`
```

### Processing Status State Machine

| Status | Trigger Event | Result |
| :--- | :--- | :--- |
| `uploaded` | Raw video uploaded via `POST /api/videos/admin/upload` | File saved to disk, initial database record committed. |
| `processing` | Transcoding thread initiated | FFmpeg binary called or HLS fallback generator executed. |
| `completed` | HLS `.m3u8` playlist & `.ts` segments written | `master_playlist_url` populated (`/api/videos/{id}/hls/master.m3u8`), format set to `hls`. |
| `failed` | Transcoding exception encountered | `error_message` logged on Video record for admin debugging. |

### HLS Delivery API Endpoints

- **Master Playlist**: `GET /api/videos/{video_id}/hls/master.m3u8` (`Content-Type: application/x-mpegURL`)
- **Segment Chunk**: `GET /api/videos/{video_id}/hls/{segment_name}` (`Content-Type: video/MP2T`)
- **Admin Manual Transcode**: `POST /api/videos/admin/{video_id}/process-hls`
- **Range Stream Fallback**: `GET /api/videos/{video_id}/stream` (`HTTP 206 Partial Content`)
