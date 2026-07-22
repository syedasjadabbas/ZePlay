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

### 1.1 Database Path Configuration
To ensure database persistence consistency across different runtime directories (e.g. project root vs backend folder), the SQLite datastore is configured with an **absolute database path**.
- Relative URLs (e.g., `sqlite+aiosqlite:///./local_zeplay.db`) are dynamically resolved on startup to their absolute filesystem path relative to the `backend/` directory.
- This ensures that both Uvicorn/FastAPI and Alembic migration tools target the exact same database file, preventing duplicate empty databases or missing table exceptions.

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

---

## 4. Watch History & Continue Watching Pipeline (Sprint 5)

### Watch History Entity
Tracks exact playback positions per user and profile for cross-device playback resumption.
* Fields: `history_id` (UUID PK), `user_id` (UUID FK), `profile_id` (UUID FK), `movie_id` (UUID FK), `video_id` (UUID FK, nullable), `current_position` (FLOAT seconds), `duration` (FLOAT seconds), `percentage_watched` (FLOAT 0-100%), `last_watched` (Timestamp), `created_at` (Timestamp).

### Progress & Continue Watching API Endpoints

- **Update Progress**: `POST /api/watch-history/progress` (Upserts progress position, updates `percentage_watched` and `last_watched`)
- **Get Continue Watching**: `GET /api/watch-history/continue-watching?profile_id={uuid}` (Returns in-progress items `0.5% <= percentage < 95%`)
- **Get Single Progress**: `GET /api/watch-history/progress/{movie_id}?profile_id={uuid}` (Returns saved progress position for single movie)
- **Get Full History**: `GET /api/watch-history/?profile_id={uuid}` (Returns complete watch history log sorted by `last_watched DESC`)
- **Delete History Entry**: `DELETE /api/watch-history/{history_id}` (Removes item from watch history)

---

## 5. Search & Discovery Pipeline (Sprint 6)

### Search Engine Query Strategy
Multi-field substring searching using SQL `ilike` and `ANY` genre array joins across 4 fields:
1. **Movie Title** (`Movie.title`)
2. **Movie Description** (`Movie.description`)
3. **Genre Name** (`Genre.name`)
4. **Release Year** (`Movie.release_year` for numeric search queries)

### Search & Discovery Endpoints

- **Catalog Search**: `GET /api/catalog/search?q={term}&genre={name}&year={yyyy}&sort_by={relevance|year_desc|title}&limit={n}&offset={m}`
- **Search Suggestions**: `GET /api/catalog/search/suggestions?q={term}&limit=5` (Fast auto-complete lookup for top matches)

---

## 6. Recommendation Engine Pipeline (Sprint 7)

### Database Entity: `MovieStats`
Tracks view counts and popularity scores for recommendation calculation.
* Fields: `stats_id` (UUID PK), `movie_id` (UUID FK), `view_count` (Integer), `watch_count` (Integer), `popularity_score` (Float), `last_viewed_at` (Timestamp), `updated_at` (Timestamp).

### Rule-Based Recommendation Strategies
1. **Trending Movies**: Ranks titles by `popularity_score` and creation recency (`created_at DESC`).
2. **Popular Movies**: Ranks titles by total `view_count` and `popularity_score`.
3. **Recently Added**: Orders catalog titles by `created_at DESC` and `release_year DESC`.
4. **Personalized Recommendations**: Extracts active profile's top watched genres from `WatchHistory` and recommends unwatched catalog movies matching preferred categories.
5. **Because You Watched**: Identifies profile's most recently watched movie and recommends titles sharing 1+ matching genres.
6. **Similar Movies**: Computes genre overlap and release proximity to recommend related content on movie detail pages.

### Recommendation API Endpoints

- **Trending Movies**: `GET /api/recommendations/trending`
- **Popular Movies**: `GET /api/recommendations/popular`
- **Recently Added**: `GET /api/recommendations/recently-added`
- **Personalized Recommendations**: `GET /api/recommendations/personalized?profile_id={uuid}`
- **Similar Movies**: `GET /api/recommendations/similar/{movie_id}`
- **Track Movie View**: `POST /api/recommendations/track-view/{movie_id}`

---

## 7. Redis Caching Layer Pipeline (Sprint 8)

### Topology & Flow
`Frontend UI -> FastAPI -> Redis Cache Service -> Database`

### Cache Strategy
- **Read Path**: Cache First. If hit, returns deserialized JSON directly. If miss, queries database, stores payload in Redis/Memory with TTL, and returns response.
- **Write Path**: Writes to database, then invalidates affected key namespaces (`catalog:*`, `rec:*`).
- **Resilience Fallback**: If Redis server connection drops or is disabled, system gracefully falls back to an in-memory TTL dictionary store without raising exceptions.

### Metric Tracking & Admin Endpoints
- **Metrics Tracked**: Cache Hits, Cache Misses, Hit Rate %, Total Keys.
- **Admin Endpoints**:
  - `GET /api/admin/cache/stats`: Returns JSON cache performance statistics.
  - `POST /api/admin/cache/clear`: Flushes cached keys and resets hit/miss counters.

---

## 8. Watchlist System

### Watchlist Entity
Represents user-curated saved movies per profile, completely isolated from automated playback watch history logs.
* Fields: `watchlist_id` (UUID PK), `user_id` (UUID FK), `profile_id` (UUID FK), `movie_id` (UUID FK), `created_at` (Timestamp).
* Constraints: `UniqueConstraint("profile_id", "movie_id", name="uq_profile_movie_watchlist")`.

### Watchlist Endpoints
- **Add to Watchlist**: `POST /api/watchlist/` (Body: `{ profile_id, movie_id }`)
- **Remove from Watchlist**: `DELETE /api/watchlist/{movie_id}?profile_id={uuid}`
- **Get Profile Watchlist**: `GET /api/watchlist/?profile_id={uuid}`
- **Check Watchlist Status**: `GET /api/watchlist/check/{movie_id}?profile_id={uuid}`

---

## 9. Page & Navigation Topology

| Page Route | Component | System Purpose & Capabilities |
| :--- | :--- | :--- |
| `/` | `Home.tsx` | **Personalized Feeds**: Featured Hero, Continue Watching, Recommended For You, Because You Watched, Trending Now, Popular Movies, Recently Added. |
| `/browse` | `Browse.tsx` | **Catalog Exploration**: Full catalog grid view, genre multi-filters, release era filters, sorting dropdowns, and inline search. |
| `/my-list` | `MyList.tsx` | **Saved Favorites**: Profile-curated watchlist of movies saved for later viewing. |
| `/history` | `WatchHistory.tsx` | **Playback Log**: Automated timeline of items watched with exact timestamp and progress percentage tracking. |
| `/subscription` | `Subscription.tsx` | **Membership Panel**: Details current tier plan features, status, renewal state, upgrade/downgrade, and cancellation controls. |

---

## 10. Subscription & Plans System (Sprint 9)

### Topology & Flow
`Frontend UI -> FastAPI -> Subscription Service -> DB`

### Database Models
- **SubscriptionPlan**: Defines plan features and limits.
  * Fields: `id` (String PK), `name` (VARCHAR unique: `free` / `premium`), `description` (VARCHAR), `max_profiles` (INT), `supports_4k` (BOOLEAN), `supports_multi_device` (BOOLEAN), `created_at` (Timestamp).
- **UserSubscription**: Records the active subscription state for each user account.
  * Fields: `id` (String PK), `user_id` (String FK), `plan_id` (String FK), `status` (VARCHAR active/cancelled/expired), `start_date` (Timestamp), `end_date` (Timestamp, nullable), `auto_renew` (BOOLEAN), `created_at` (Timestamp), `updated_at` (Timestamp).

### Business Rules
- **Registration**: All newly registered users are automatically assigned to the `free` subscription plan.
- **Profile Limit Enforcements**:
  - `free` plan allows a maximum of 1 profile.
  - `premium` plan allows a maximum of 4 profiles.
  - Users are blocked from creating a profile if the limit is exceeded.
- **Downgrade Validation**: Users cannot downgrade from `premium` to `free` unless they have already deleted excess profiles to satisfy the 1-profile limit.

### Admin Dashboard Conversion Statistics
- **Metrics Tracked**: Total Free Users, Total Premium Users, Premium Conversion % (Premium / Total active membership subscribers).
- **Endpoint**: `GET /api/admin/stats` updated to return these subscription metrics.

