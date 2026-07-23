import uuid
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy.types import TypeDecorator, UUID as SA_UUID
from app.config import settings

from sqlalchemy.types import TypeDecorator, CHAR
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

class GUID(TypeDecorator):
    """Platform-independent GUID type.
    Uses PostgreSQL's native UUID type, and CHAR(36) for SQLite.
    Converts safely between strings, ints, and uuid.UUID objects.
    """
    impl = CHAR(36)
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return str(value)
        if isinstance(value, int):
            try:
                return str(uuid.UUID(int=value))
            except ValueError:
                return str(value)
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return value
        if isinstance(value, int):
            try:
                return uuid.UUID(int=value)
            except ValueError:
                return str(value)
        if isinstance(value, str):
            clean_val = value.replace("-", "").replace(" ", "")
            if len(clean_val) == 32:
                try:
                    return uuid.UUID(hex=clean_val)
                except ValueError:
                    pass
            try:
                return uuid.UUID(int=int(value))
            except ValueError:
                try:
                    return uuid.UUID(value)
                except ValueError:
                    return value
        return value

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
