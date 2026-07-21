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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict this to designated domain list in production
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
    """Simple service checking endpoint."""
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": "1.0.0"
    }
