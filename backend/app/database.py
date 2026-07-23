from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from app.config import settings

# Create asynchronous engine with SQLite/PostgreSQL compatibility
_is_sqlite = settings.DATABASE_URL.startswith("sqlite")
_connect_args = {"check_same_thread": False} if _is_sqlite else {}

if not _is_sqlite:
    # Production-grade PostgreSQL pooling configuration
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        future=True,
        pool_size=80,
        max_overflow=15,
    )

else:
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        future=True,
        connect_args=_connect_args,
    )

# Async session maker
SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

# Shared Declarative Base for models
Base = declarative_base()

# Dependency to yield database sessions per request
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
