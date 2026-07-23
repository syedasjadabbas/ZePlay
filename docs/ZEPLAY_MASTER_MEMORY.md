# ZePlay Master Memory & Permanent Knowledge Base

This document serves as the single source of truth for the ZePlay streaming platform. It provides a comprehensive engineering reference for future developers, administrators, supervisors, and AI agents.

---

## 1. Project Overview

- **Project Name**: ZePlay
- **Purpose**: A subscription-based, high-performance video streaming platform built to emulate modern Netflix-style media rendering, profile customization, and secure subscription gating.
- **Business Goal**: Deliver premium, low-latency video streaming experiences, drive paid subscriptions, and scale infrastructure cost-efficiently.
- **Target Users**: General entertainment consumers, family households requiring multi-profile management (including pin-gated adult and filtered kids profiles), and administrators managing media catalog ingestions.
- **Current Stage**: Hardening, Scalability, and Production Readiness Sprint.
- **Internship Objectives**: Upgrade database engines to production standards, implement asynchronous background architectures to optimize response latencies, secure client entitlements, and layout a high-performance AWS cloud-native target architecture.

---

## 2. System Architecture

ZePlay is designed around a modern client-server model, separating client presentation logic from database orchestration.

### Frontend
- **Framework**: React 18+ bootstrapped with Vite for fast build and reload cycles.
- **Language**: TypeScript (enforcing strong compile-time types).
- **Routing**: `react-router-dom` v6 for client-side routing.
- **State Management**: React Context API for global auth sessions, themes, and profile states.
- **Styling**: Vanilla CSS with HSL variables.

### Backend
- **Framework**: FastAPI (Python 3.12+) utilizing asynchronous ASGI servers.
- **ORM**: SQLAlchemy 2.0 with `asyncio` extension layers.
- **Migrations**: Alembic for database version history tracking.
- **Authentication**: JWT (JSON Web Tokens) with HS256 encryption.

### Database
- **Current DB**: SQLite (Local file DB used during early sprints and testing).
- **Target DB**: Amazon RDS PostgreSQL (using native UUID fields).

### Caching
- **Cache Engine**: Redis (Distributed key-value caching).

### Email Services
- **Client Provider**: Resend API (for transactional SMTP verification).

### Target Production Infrastructure (AWS)
- **Object Storage**: Amazon S3 (for adaptive HLS segments).
- **CDN**: Amazon CloudFront (caching video at edge nodes).
- **Compute**: AWS ECS (Fargate container clusters).

---

## 3. Completed Sprints (Sprints 1 - 10)

### Sprint 1: Foundation & Video Upload
- **Objective**: Setup web app framework and support raw MP4 uploads.
- **Features Built**: File storage engine, upload APIs, basic movie catalog listing.
- **Technical Decisions**: Stored uploads directly to filesystem paths.
- **Lessons Learned**: VPS filesystem directories are ephemeral; production needs cloud object storage.

### Sprint 2: User Authentication
- **Objective**: Implement login, register, and JWT tokens.
- **Features Built**: Registration forms, login endpoints, password hashing (bcrypt).
- **Lessons Learned**: Synchronously sending validation emails blocks API response cycles.

### Sprint 3: Watchlist & Favorites
- **Objective**: Let users bookmark content.
- **Features Built**: Watchlist tables, add/remove endpoints.
- **Technical Decisions**: Used join tables with composite primary keys.

### Sprint 4: Rating System
- **Objective**: Capture user feedback.
- **Features Built**: 5-star ratings, reviews.
- **Lessons Learned**: Database engines require row-level locking to prevent write blocks on ratings.

### Sprint 5: Profiles & Kids Filter
- **Objective**: Support multi-profile family accounts.
- **Features Built**: Profile CRUD, kids content filter.
- **Lessons Learned**: Gating profiles requires robust sub-authentication layers.

### Sprint 6: PIN-Lock Security
- **Objective**: Gate adult profiles from children.
- **Features Built**: Profile PIN-locks, session-based profile verification.

### Sprint 7: Continue Watching & Playback Progress
- **Objective**: Auto-resume video playback from previous timestamps.
- **Features Built**: Resume APIs, playback progress tables.

### Sprint 8: Search & Suggestions
- **Objective**: High-performance catalog searching.
- **Features Built**: Trie-based autocomplete suggestions, search indexes.

### Sprint 9: Subscription Engine
- **Objective**: Tiered content access.
- **Features Built**: Free/Premium plan tables, profile limits, billing portals.
- **Technical Decisions**: Implemented UUID columns for subscription references.

### Sprint 10: Video Transcoding & HLS
- **Objective**: Netflix-style adaptive stream preparation.
- **Features Built**: FFmpeg background transcoding pipelines, HLS segmenting.

### Sprint 11A: Local ABR & PostgreSQL Migration Verification
- **Objective**: Execute database migrations against PostgreSQL dialect, implement multi-bitrate HLS structure, and write Locust load testing configs.
- **Features Built**: ABR playlist index master.m3u8, 480p/720p/1080p transcoder tasks, autocomplete suggestion caching, and locustfile.py suite.

### Sprint 12: PostgreSQL Database Migration & Cache Load Scaling
- **Objective**: Deploy local standalone PostgreSQL & Redis servers, execute all schema migrations, build a type-safe data migration pipeline, and execute high-concurrency load testing comparisons.
- **Features Built**: Automated dynamic SQLite-to-PostgreSQL data migration script (handling UUID numeric coercion, boolean serialization, and constraints bypasses), production-scaled SQLAlchemy connection pools, multi-worker process deployment, and verification of local Redis RESP2 compatibility.

### Sprint 13: Production Validation & Streaming Verification
- **Objective**: Complete a comprehensive production readiness audit.
- **Features Built**: Developed automated integration testing harness checking user activation, profile/PIN gates, sub entitlements, Continue Watching, HLS binary segment structure, and Redis keyspace integrity.

### Sprint 14: Production Architecture Completion
- **Objective**: Resolve remaining scalability bottlenecks, decouple local storage, and configure CloudFront redirects.
- **Features Built**: Asynchronous background transcoding, S3 directory upload with local storage cleanup, HTTP 307 CDN redirect serving, and Redis-based global cache counters (resolving multi-worker metrics isolation).

### Sprint 15: Performance, Security & Reliability Audit
- **Objective**: Identify, document, and remediate top architectural performance bottlenecks, security weaknesses, and reliability risks to ensure production readiness.
- **Features Built**: Fixed critical health check coroutine bug; upgraded Bcrypt hashing cost factors; added verify_user_entitlement gating to HLS master playlists, segments, and MP4 stream routes; implemented strict video upload extension whitelisting and 5GB upload limits; optimized streaming ranged generator with non-blocking AnyIO async file reads; added database indexes to foreign keys (`plan_id` in `user_subscriptions` and `genre_id` in `movie_genres`); modernized unit tests to support background processing and CDN redirects context.

### Sprint 16: Streaming Resilience & Network Validation
- **Objective**: Validate the streaming delivery loop, seeking timeline actions, and adaptive bitrate behavior under simulated network constraints.
- **Features Built**: Added strict keyframe GOP constraints (`-g 6 -keyint_min 6 -sc_threshold 0`) to `720p` and `480p` transcoder settings to allow uniform 6-second segment sizes; refactored video transcoding execution to run resolutions concurrently using async subprocesses; built dynamic client simulator validating WiFi (1080p), 4G (720p), 3G (480p), and Slow network profiles without playback stalls.

### Sprint 17: Real Local Streaming Validation
- **Objective**: Establish fully functional local HLS video serving, bypassing all S3 and CloudFront dependencies to guarantee local network (LAN) supervisor demo readiness.
- **Features Built**: Disabled mock S3 configuration (`MOCK_S3=false`), forcing local HLS folder persistence and relative endpoint pathing; built direct FastAPI endpoints serving variant playlists and segment chunks (.ts files) straight from host disk; validated local playback loop using `test_lan_streaming.py` verification runner.

---


## 4. Feature Inventory

| Feature | Purpose | Current Status | Dependencies |
| :--- | :--- | :--- | :--- |
| **Authentication** | Secure user registration and session management. | Production Ready | JWT, Bcrypt |
| **Profiles** | Multi-account setups on a single subscription. | Production Ready | User Model |
| **PIN Protection** | Protects adult profiles from child access. | Production Ready | Profiles |
| **Subscriptions** | Gates premium content. | Production Ready | PostgreSQL UUIDs |
| **Ratings** | Collects user star feedback. | Production Ready | Movie Model |
| **Recommendations** | Surfaces popular/trending content. | Caching Optimised | Redis, Database |
| **Search** | Finds movies. | Autocomplete Active | Catalog Service |
| **Watch History** | Tracks user viewing history. | Production Ready | Movie, Profile |
| **Movie Uploads** | Admins ingest new media. | Production Ready | BackgroundTasks, S3/CDN |
| **Video Processing** | Translates MP4 to HLS. | Production Ready | FFmpeg, BackgroundTasks, S3 |

---

## 5. Database Documentation

```mermaid
erDiagram
    users ||--o{ user_subscriptions : has
    subscription_plans ||--o{ user_subscriptions : defines
    users ||--o{ profiles : creates
    profiles ||--o{ watch_history : tracks
    movies ||--o{ watch_history : referenced-by
```

- **UUID Strategy**: Primary and foreign keys for `SubscriptionPlan`, `UserSubscription`, and `Profile` use native UUID types to prevent primary key sequence overlaps during PostgreSQL migrations.
- **Migration History**:
  - `i108k76k907j`: Base profile and auth models.
  - `j109l87l018k`: Subscription and Plans tables (UUID aligned).
  - `k110m98m109l`: Video status and processing tracks.

---

## 6. API Documentation

### Authentication
- `POST /api/auth/register`: Creates new user account.
- `POST /api/auth/login`: Issues JWT bearer access token.
- `POST /api/auth/forgot-password`: Generates reset token.

### Profile
- `POST /api/profiles/`: Creates a profile (enforces plan constraints).
- `GET /api/profiles/`: Lists all profiles for user.
- `POST /api/profiles/{id}/verify-pin`: Unlocks pin-gated profiles.

### Subscription
- `GET /api/subscription/plans`: Lists all available plans.
- `GET /api/subscription/current`: Returns active subscription.
- `POST /api/subscription/upgrade`: Upgrades plan to premium.
- `POST /api/subscription/downgrade`: Downgrades plan to free.

### Catalog
- `GET /api/catalog/movies/{movie_id}`: Fetches movie details (entitlement protected).
- `POST /api/videos/admin/upload`: Ingests video (admin only).

---

## 7. Deployment History & Root Cause Analysis

### 1. CORS Wildcard Collision
- **Root Cause**: Enabling `allow_credentials=True` alongside wildcard allowed origins (`allow_origins=["*"]`) triggers browser security violations, blocking frontend requests.
- **Fix**: Replaced wildcard with explicit server-side arrays containing dynamic Vite domains and `settings.FRONTEND_URL`.

### 2. SQLite Integer Coercion
- **Root Cause**: SQLite features dynamic typing affinity. When inserting UUID hexes containing only numbers (`00000000-0000-0000-0000-000000000001`), SQLite converted it into integer `1`, causing SQLAlchemy UUID conversion errors.
- **Fix**: Redefined seed/test UUID values to start with non-numeric chars (e.g. `f0000000-0000-...`), forcing SQLite to treat them as `TEXT`.

### 3. SMTP Sync blocking
- **Root Cause**: Registration API response times spiked to 2+ seconds due to synchronous Resend/SMTP email triggers.
- **Fix**: Refactored email triggers into FastAPI `BackgroundTasks`.

### 4. PostgreSQL WIN1252/UTF8 Encoding Conflict
- **Root Cause**: On Windows systems, PostgreSQL initializes database clusters with the default system locale (WIN1252), causing untranslatable character errors when storing 4-byte unicode emojis (like 😎) present in movie or user profile data.
- **Fix**: Reinitialized the PostgreSQL database cluster with C locale and UTF-8 encoding (`initdb --locale=C -E UTF8`), and configured the connection client to use `utf8` encoding.

### 5. PostgreSQL TooManyConnections Pool Exhaustion
- **Root Cause**: Running Uvicorn in multi-worker configurations under high concurrency (500+ users) caused each process to exceed database pool size allocations, exhausting the default PostgreSQL `max_connections` limit of 100 and crashing with `TooManyConnectionsError`.
- **Fix**: Tuned `max_connections` in `postgresql.conf` to 500, and optimized Uvicorn worker pools to scale efficiently without exceeding system capacities.

---


## 8. Current Known Issues & Technical Debt

1. **Caching Granularity**: Cache invalidation for recommendations does not listen to catalog updates immediately.
2. **Third-Party Email Delivery**: Email dispatch (Resend/SMTP) is handled via background tasks but still runs within the FastAPI event loop pool. Highly scaled loads should offload these calls to a dedicated worker queue (e.g. Celery).

---

## 9. Scalability Roadmap

```
  [ User Client ]
         │
         ▼
  [ AWS CloudFront CDN ] ──── (Serves cached HLS segments & playlists)
         │
         ▼
  [ Application Load Balancer ]
         │
         ▼
  [ ECS Fargate Containers ] (Stateless FastAPI backend instances)
    ├── Reads / Writes
    │      ▼
    │  [ Aurora PostgreSQL (RDS) ]
    │
    └── Caches Queries
           ▼
       [ ElastiCache Redis ]
```

---

## 10. Netflix-Style Streaming Roadmap

```
[ Upload MP4 ] ──> [ FFmpeg Engine ] ──> [ Adaptive Bitrate Transcode ]
                                                    │
                                                    ▼
[ CDN Edge Cache ] <── [ S3 Storage Bucket ] <── [ HLS Master Playlist ]
```

- **Why HLS?**: Breaks video files into short, easily cacheable chunks, preventing massive file buffering.
- **Why ABR?**: Dynamically matches playback quality to user network conditions (3G/4G/WiFi) by providing multiple resolution profiles.
- **Why S3 & CDN?**: Offloads all heavy video traffic from server compute nodes directly to geographical caches.

---

## 11. Internship Defense Notes

* **Why PostgreSQL?**: Avoids database write locks via Multi-Version Concurrency Control (MVCC), accommodating thousands of write-heavy events (ratings, history tracking).
* **Why Redis?**: Reduces response time for read-intensive requests (popular media listings) to sub-2 milliseconds, preventing database bottlenecks.
* **Why HLS & CloudFront?**: Allows smooth playback on low-bandwidth networks (like 3G/4G) and reduces hosting egress fees by caching segments close to users.

---

## 12. Future Development Rules

1. **Stateless Operations**: Server instances must never save local application states. All state coordinates must reside in PostgreSQL or Redis.
2. **Type Enforcement**: All database primary and foreign keys must use `UUID(as_uuid=True)` instead of incremental integers or raw strings.
3. **Non-Blocking API Calls**: Any external integration (email delivery, transcoding, heavy file reads) must occur in background jobs.
4. **Secure Hashing**: Password hashing must enforce a production-grade cost factor (Bcrypt rounds >= 12).
5. **Entitlement Protection**: All media assets and streaming segments must be gated behind verified premium user/admin entitlements.
6. **Payload Guardrails**: All user-uploaded media files must have their extensions whitelisted and file sizes strictly capped to prevent Denial-of-Service (DoS) attacks.
7. **Database Indexing**: All foreign key columns and common query join/filter columns must be indexed to ensure sub-100ms API response rates.
8. **Uniform Keyframe Spacing**: Any ABR/HLS transcoding pipeline must enforce explicit keyframe GOP boundaries (e.g., `-g 6 -keyint_min 6 -sc_threshold 0` for 6-second chunks) across all scaled variants to support uniform segment sizes and reliable timeline seeking.

