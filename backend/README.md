# ZePlay Backend: Sprint 1 (MVP Foundation)

This is the production-ready microservice foundation for **ZePlay**, featuring asynchronous PostgreSQL connections, SQLAlchemy ORM modeling, Alembic schema migrations, and JWT Authentication.

---

## 1. Quickstart Guide

### Prerequisites
* Python 3.10+
* PostgreSQL running locally or in a container

### Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use: venv\Scripts\activate
   ```

3. Install required packages:
   ```bash
   pip install -r requirements.txt
   ```

---

## 2. Configuration

Environment settings are controlled via the `.env` file at the root of the `backend/` directory:
```env
PROJECT_NAME="ZePlay API"
DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/zeplay"
JWT_SECRET_KEY="your-jwt-signing-secret-here"
JWT_ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=11520
```

---

## 3. Database Migrations

Apply database schemas using Alembic:
```bash
alembic upgrade head
```

If you modify models in the future, generate automatic migration scripts using:
```bash
alembic revision --autogenerate -m "description of changes"
```

---

## 4. Run the Dev Server

Start the development server using Uvicorn:
```bash
uvicorn app.main:app --reload
```

* **Interactive API documentation (Swagger)**: http://localhost:8000/api/docs
* **Alternative documentation (Redoc)**: http://localhost:8000/api/redoc
* **Service health check**: http://localhost:8000/health

---

## 5. Directory Structure
```
backend/
├── app/
│   ├── api/
│   │   ├── endpoints/
│   │   │   ├── auth.py          # /register, /login, /me endpoints
│   │   │   └── profiles.py      # /profiles GET, POST, PUT, DELETE
│   │   ├── deps.py              # db & current user authentication dependencies
│   │   └── router.py            # consolidated api routers registry
│   ├── core/
│   │   └── security.py          # password verification and jwt token generators
│   ├── models/                  # SQLAlchemy model classes
│   │   ├── user.py
│   │   └── profile.py
│   ├── schemas/                 # Pydantic validation structures
│   │   ├── user.py
│   │   └── profile.py
│   ├── config.py                # Pydantic Settings configuration engine
│   ├── database.py              # Async PostgreSQL engine configuration
│   └── main.py                  # FastAPI initialization & CORSMiddleware configuration
├── alembic/
│   ├── versions/
│   │   └── 0001_initial.py      # Initial schema migration
│   ├── env.py                   # Async alembic migration runner
│   └── script.py.mako           # Migration script structure template
├── alembic.ini                  # Alembic setup configuration
├── requirements.txt             # In-project third-party libraries list
└── .env                         # Environment configurations & secrets template
```
