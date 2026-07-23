import asyncio
import uuid
from datetime import datetime, timezone
import pytest
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.main import app

# SQLite in-memory URL for fast async unit tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# Fixed plan UUIDs matching migration seed
FREE_PLAN_ID    = uuid.UUID("f0000000-0000-0000-0000-000000000001")
PREMIUM_PLAN_ID = uuid.UUID("f0000000-0000-0000-0000-000000000002")


@pytest.fixture(scope="session")
async def db_engine():
    """Setup async connection engine, build schemas, and seed subscription plans."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # Patch app.database.SessionLocal and app.database.engine to use the test database
    import app.database
    old_engine = app.database.engine
    old_session_local = app.database.SessionLocal
    
    app.database.engine = engine
    app.database.SessionLocal = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed default subscription plans required by all tests
    from sqlalchemy.ext.asyncio import async_sessionmaker as _asm
    _Session = _asm(bind=engine, class_=AsyncSession, expire_on_commit=False)
    from app.models.subscription_plan import SubscriptionPlan
    now = datetime.now(timezone.utc)
    async with _Session() as seed_session:
        async with seed_session.begin():
            seed_session.add(SubscriptionPlan(
                id=FREE_PLAN_ID,
                name="free",
                description="Standard streaming with 1 profile.",
                max_profiles=1,
                supports_4k=False,
                supports_multi_device=False,
                created_at=now,
            ))
            seed_session.add(SubscriptionPlan(
                id=PREMIUM_PLAN_ID,
                name="premium",
                description="Premium badge, up to 4 profiles, 4K and multi-device ready.",
                max_profiles=4,
                supports_4k=True,
                supports_multi_device=True,
                created_at=now,
            ))

    yield engine

    # Restore originals
    app.database.engine = old_engine
    app.database.SessionLocal = old_session_local

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    """Provide a isolated database transaction per test case."""
    connection = await db_engine.connect()
    transaction = await connection.begin()
    
    Session = async_sessionmaker(
        bind=connection,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    
    async with Session() as session:
        yield session
        
    await transaction.rollback()
    await connection.close()

@pytest.fixture
async def client(db_session: AsyncSession):
    """Expose a mocked test HTTP client with dependencies overridden."""
    async def override_get_db():
        try:
            yield db_session
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    
    from httpx import AsyncClient, ASGITransport
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
        
    app.dependency_overrides.clear()
