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
from app.database import engine
from sqlalchemy import text
import logging

# Mount Unified Router
app.include_router(api_router, prefix="/api")

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


@app.get("/health", tags=["System Health"])
async def health_check():
    """Simple service checking endpoint including cache status."""
    cache_stats = await cache.get_stats()
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": "1.0.0",
        "cache": {
            "engine": cache_stats["cache_engine"],
            "redis_connected": cache_stats["redis_connected"],
        }
    }
