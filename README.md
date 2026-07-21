# ZePlay: Scalable Video Streaming Platform (Sprint 1 MVP)

This monorepo contains the Sprint 1 MVP implementation for **ZePlay**, featuring user authentication and a profile selection system.

---

## 1. Directory Structure

```
zeplay/
├── backend/            # FastAPI, SQLAlchemy 2.0, PostgreSQL & Pytest
├── frontend/           # React 18, TypeScript, Vite & Tailwind CSS
├── docs/               # System architecture documentation
├── docker-compose.yml  # Local developer stack orchestrator
└── README.md           # Root configuration and run guide
```

---

## 2. Bootstrapping with Docker Compose (Recommended)

To run the database, backend services, and frontend client in a unified containerized network:

1. Clone or navigate to the project directory:
   ```bash
   cd zeplay
   ```

2. Build and spin up the containers:
   ```bash
   docker-compose up --build
   ```

* **Frontend Dashboard**: http://localhost:5173
* **FastAPI REST API Docs**: http://localhost:8000/api/docs
* **FastAPI Service Health**: http://localhost:8000/health

---

## 3. Running Services Separately (Dev Mode)

If you prefer to run services on your host machine for active code hot reloading:

### A. Database (PostgreSQL)
Ensure you have PostgreSQL running locally with:
* **Username**: `postgres`
* **Password**: `postgres`
* **Port**: `5432`
* **Database Name**: `zeplay`

Alternatively, start just the database container:
```bash
docker-compose up db -d
```

### B. Backend Service (FastAPI)
Follow instructions in [backend/README.md](backend/README.md) to set up a virtual environment, install python libraries, apply migrations, and boot the server.

```bash
cd backend
python -m venv venv
source venv/bin/activate  # venv\Scripts\activate on Windows
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

### C. Frontend Service (React / Vite)
Install dependencies and run the Vite server locally:

```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173 in your web browser.

---

## 4. Running Backend Tests
Execute automated tests using `pytest` inside the `backend` environment:
```bash
cd backend
pytest -v
```
