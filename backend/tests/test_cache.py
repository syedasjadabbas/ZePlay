import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.email_verification_token import EmailVerificationToken
from app.models.user import User
from app.services.cache_service import cache

pytestmark = pytest.mark.asyncio

async def create_test_user_and_get_token(client: AsyncClient, db_session: AsyncSession, email: str) -> str:
    await client.post(
        "/api/auth/register",
        json={"email": email, "name": "Cache Test User", "password": "Password123!"}
    )
    user_res = await db_session.execute(select(User).filter(User.email == email))
    user = user_res.scalars().first()
    if user:
        user.is_admin = True
        await db_session.commit()

    res = await db_session.execute(select(EmailVerificationToken))
    tokens = res.scalars().all()
    token = tokens[-1].token if tokens else ""

    await client.post("/api/auth/verify-email", json={"token": token})
    login_res = await client.post("/api/auth/login", data={"username": email, "password": "Password123!"})
    return login_res.json()["access_token"]

async def test_cache_service_operations():
    await cache.clear_all()
    
    # Test set and get
    await cache.set("test:key1", {"message": "hello world"}, ttl=60)
    val = await cache.get("test:key1")
    assert val == {"message": "hello world"}

    # Test cache miss
    val_miss = await cache.get("test:non_existent_key")
    assert val_miss is None

    # Test stats
    stats = await cache.get_stats()
    assert stats["hits"] >= 1
    assert stats["misses"] >= 1
    assert stats["hit_rate_pct"] > 0.0

    # Test pattern invalidation
    await cache.set("test:key2", "value2", ttl=60)
    await cache.invalidate_pattern("test:*")
    assert await cache.get("test:key1") is None
    assert await cache.get("test:key2") is None

async def test_cache_api_integration(client: AsyncClient, db_session: AsyncSession):
    token = await create_test_user_and_get_token(client, db_session, "admincache@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. First GET /api/catalog/movies (Cache Miss -> DB read -> Cache store)
    res1 = await client.get("/api/catalog/movies", headers=headers)
    assert res1.status_code == 200

    # 2. Second GET /api/catalog/movies (Cache Hit)
    res2 = await client.get("/api/catalog/movies", headers=headers)
    assert res2.status_code == 200

    # 3. Test Admin Cache Stats endpoint
    stats_res = await client.get("/api/admin/cache/stats", headers=headers)
    assert stats_res.status_code == 200
    cache_info = stats_res.json()
    assert "hits" in cache_info
    assert "misses" in cache_info
    assert "hit_rate_pct" in cache_info

    # 4. Test Admin Clear Cache endpoint
    clear_res = await client.post("/api/admin/cache/clear", headers=headers)
    assert clear_res.status_code == 200
    assert clear_res.json()["message"] == "Cache successfully cleared."

async def test_cache_disabled_fallback():
    from app.config import settings
    original_setting = settings.REDIS_ENABLED
    try:
        settings.REDIS_ENABLED = False
        await cache.initialize()
        await cache.set("fallback:key", "fallback_value", ttl=60)
        assert await cache.get("fallback:key") == "fallback_value"
        stats = await cache.get_stats()
        assert stats["redis_connected"] is False
        assert "In-Memory" in stats["cache_engine"]
    finally:
        settings.REDIS_ENABLED = original_setting
        await cache.initialize()

