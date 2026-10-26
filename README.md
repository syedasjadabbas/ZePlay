# ZePlay

> Production-oriented adaptive video streaming platform with background transcoding, caching layers, and high-concurrency API performance.

For comprehensive technical documentation, architecture deep dives, and historical milestone logs, see the [Full ZePlay Documentation](docs/FULL_README.md).

---

## Overview

ZePlay is a full-stack media streaming system engineered around reliable adaptive bitrate video delivery, background media processing, database query scalability, caching, and measured concurrent throughput. The platform provides an end-to-end streaming architecture spanning media ingestion, multi-variant HLS transcoding, authenticated catalog access, and responsive playback.

---

## Architecture & Stack

```
ZePlay Architecture
├── Frontend: React 18, TypeScript, Tailwind CSS, HLS.js
├── Backend: FastAPI (Python asynchronous REST API)
├── Database: PostgreSQL (with keyset pagination & composite indexing)
├── Caching & Sessions: Redis 7
├── Media Pipeline: FFmpeg (HLS multi-variant generation: 1080p, 720p, 480p)
└── Load Testing: k6 & Locust
```

### System Stack

- **Frontend Client**: React, TypeScript, Vite, Tailwind CSS, and HLS.js video player with automatic bitrate switching.
- **Backend Application**: FastAPI (Python 3.11+) asynchronous REST API with structured dependency injection.
- **Relational Database**: PostgreSQL with Alembic migrations, connection pooling, and optimized execution plans.
- **Cache & Rate Limiting**: Redis for catalogue caching, session tokens, and request throttling.
- **Transcoding Pipeline**: FFmpeg CLI pipeline executing multi-rendition HLS encoding (1080p, 720p, 480p) with master playlist generation and fragmented MPEG-TS chunks.

---

## Key Features

- **Adaptive Bitrate Streaming**: Multi-quality HLS delivery (1080p, 720p, 480p) allowing seamless playback adaptation to client network conditions.
- **Background Transcoding Pipeline**: Asynchronous media processing generating master playlists, variant playlists, and video segment chunks.
- **Catalog Management & Keyset Pagination**: Keyset cursor pagination over large catalogue datasets, eliminating `OFFSET` table scans.
- **Authentication & Profile Controls**: JWT-based authentication, refresh tokens, role-based access control, and profile-specific PIN protection.
- **Search & Discovery**: Title, genre, and metadata filtering backed by indexed PostgreSQL queries and Redis caching.
- **Studio Administration**: Management interface for media uploads, ingestion monitoring, playlist repair, and catalogue curation.

---

## Performance & Benchmarks

Performance metrics were measured in a local test environment under controlled load conditions using k6 and PostgreSQL query analysis.

### Local k6 Concurrency Benchmark (500 Virtual Users)

Tested against cached catalogue workloads on a 4-worker FastAPI configuration:

| Metric | Result |
| :--- | :--- |
| **Concurrent Load** | 500 Virtual Users (VUs) |
| **Throughput Improvement** | 84.2 req/s to 650.2 req/s (7.7x gain) |
| **Peak Throughput** | 650.2 req/s |
| **Median Latency** | 526.8 ms |
| **P90 Latency** | 934.6 ms |
| **P95 Latency** | 1.684 s |
| **Failure Rate** | 0.00% (0 errors across all runs) |

### Database Optimization: Keyset Pagination

On a benchmark dataset of 100,017 catalogue items, shifting from standard offset scanning to keyset cursor pagination yielded substantial execution speedups:

| Query Strategy | Execution Time |
| :--- | :--- |
| `LIMIT 40 OFFSET 50000` | ~295 ms |
| Keyset Cursor (`WHERE id > :cursor LIMIT 40`) | 0.27 ms |

### Automated Test Coverage

- **Backend Test Suite**: 59 / 59 passing tests (`backend/tests/`).

*Note: Benchmark figures reflect local benchmarking environments and represent measured system optimizations rather than hosted production capacity.*

---

## Project Structure

```
ZePlay/
├── backend/
│   ├── app/                # FastAPI routers, models, schemas, and services
│   ├── alembic/            # Database schema migrations
│   ├── tests/              # Backend test suite (59 passing tests)
│   ├── requirements.txt    # Python dependencies
│   ├── Dockerfile          # Backend container specification
│   └── import_video.py     # Transcoding and ingestion script
├── frontend/
│   ├── src/                # React components, pages, player, and API client
│   ├── package.json        # Frontend dependencies
│   └── vite.config.ts      # Vite build configuration
├── docs/
│   ├── FULL_README.md      # Unabridged architectural documentation (2,000+ lines)
│   └── images/             # Architecture and UI diagrams
├── docker-compose.yml       # Local PostgreSQL and Redis orchestration
└── README.md
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+ and npm
- Docker and Docker Compose (or local PostgreSQL and Redis)
- FFmpeg installed and available on system PATH

### 1. Infrastructure Services

Start PostgreSQL and Redis:

```bash
docker compose up -d
```

### 2. Backend Setup

```bash
cd backend
python -m venv venv

# Windows
.\venv\Scripts\activate

# Linux/macOS
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

- API Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

- Web Client: [http://localhost:5173](http://localhost:5173)

---

## Running Tests

Execute the backend automated test suite:

```bash
cd backend
pytest
```
