from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.router import api_router

# Initialize FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="ZePlay scalable video streaming platform back-end service catalog.",
    version="1.0.0",
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# Setup CORS middleware for local frontend connectivity
origins = [
    settings.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
origins = [org.rstrip("/") for org in origins if org]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.services.cache_service import cache
from app.database import engine, _is_sqlite
from sqlalchemy import text
import logging

# Mount Unified Router
app.include_router(api_router, prefix="/api")

import os
from fastapi.staticfiles import StaticFiles
static_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "static")
os.makedirs(static_path, exist_ok=True)
app.mount("/static", StaticFiles(directory=static_path), name="static")

@app.on_event("startup")
async def startup_event():
    """Initialize cache service and validate database connection on application startup."""
    logger = logging.getLogger("uvicorn")
    logger.info(f"Database URL in use: {settings.DATABASE_URL}")
    
    # Validate database connectivity
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("Database connection validation successful.")
    except Exception as e:
        logger.error(f"Database connection validation failed: {e}")
        
    await cache.initialize()

    # Safe Google OAuth Configuration Diagnostic
    client_id = (settings.GOOGLE_CLIENT_ID or "").strip()
    if client_id:
        has_valid_format = client_id.endswith(".apps.googleusercontent.com")
        masked_id = client_id[:6] + "..." + client_id[-20:] if len(client_id) > 26 else "***"
        logger.info(f"[Google OAuth Diagnostic] GOOGLE_CLIENT_ID configured: {masked_id} (Valid format: {has_valid_format})")
    else:
        logger.warning("[Google OAuth Diagnostic] GOOGLE_CLIENT_ID is NOT configured in backend environment.")


@app.get("/health", tags=["System Health"])
@app.get("/api/health", tags=["System Health"])
async def health_check():
    """Lightweight database and cache health check for production readiness."""
    db_connected = False
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_connected = True
    except Exception:
        db_connected = False

    cache_stats = await cache.get_stats()
    from app.services.job_queue_service import job_queue
    queue_stats = await job_queue.get_queue_stats()

    return {
        "status": "online" if db_connected else "degraded",
        "service": settings.PROJECT_NAME,
        "version": "1.0.0",
        "database": {
            "connected": db_connected,
            "engine": "postgresql" if not _is_sqlite else "sqlite"
        },
        "cache": {
            "engine": cache_stats["cache_engine"],
            "redis_connected": cache_stats["redis_connected"],
        },
        "queue": {
            "queued_jobs": queue_stats["queue_length"],
            "backend": queue_stats["backend"],
        }
    }
