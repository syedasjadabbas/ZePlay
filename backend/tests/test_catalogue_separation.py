import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.email_verification_token import EmailVerificationToken
from app.models.user import User
from app.models.movie import Movie

pytestmark = pytest.mark.asyncio

async def create_test_user_and_get_token(client: AsyncClient, db_session: AsyncSession, email: str) -> str:
    """Helper method to register a user and return access token."""
    await client.post(
        "/api/auth/register",
        json={"email": email, "name": "Separation User", "password": "Password123!"}
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

async def seed_test_movies(db_session: AsyncSession):
    """Seed 1 real movie and 1 synthetic movie in test DB if not present."""
    m_real = Movie(
        title="Curated Real Movie",
        description="A real movie for production users.",
        release_year=2024,
        duration_minutes=120,
        thumbnail_url="http://example.com/real.jpg",
        video_url="http://example.com/real.m3u8",
        is_generated=False
    )
    m_synth = Movie(
        title="Synthetic Benchmark Movie",
        description="A synthetic benchmark record.",
        release_year=2020,
        duration_minutes=90,
        thumbnail_url="http://example.com/synth.jpg",
        video_url="http://example.com/synth.m3u8",
        is_generated=True
    )
    db_session.add(m_real)
    db_session.add(m_synth)
    await db_session.commit()

async def test_catalogue_separation_movies_list(client: AsyncClient, db_session: AsyncSession):
    await seed_test_movies(db_session)
    token = await create_test_user_and_get_token(client, db_session, "sep_user1@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Normal list_movies request (include_synthetic defaults to False)
    res = await client.get("/api/catalog/movies", headers=headers)
    assert res.status_code == 200
    movies = res.json()
    assert len(movies) > 0
    # Every movie returned must have is_generated == False
    for m in movies:
        assert m["is_generated"] is False

    # 2. Benchmark list_movies request (include_synthetic=true)
    res_bench = await client.get("/api/catalog/movies?include_synthetic=true&limit=40", headers=headers)
    assert res_bench.status_code == 200
    bench_movies = res_bench.json()
    assert len(bench_movies) >= 2
    has_synth = any(m["is_generated"] is True for m in bench_movies)
    assert has_synth is True

async def test_catalogue_separation_recommendations(client: AsyncClient, db_session: AsyncSession):
    await seed_test_movies(db_session)
    token = await create_test_user_and_get_token(client, db_session, "sep_user2@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Trending
    res_trending = await client.get("/api/recommendations/trending", headers=headers)
    assert res_trending.status_code == 200
    trending = res_trending.json()
    for m in trending:
        assert m["is_generated"] is False

    # 2. Popular
    res_popular = await client.get("/api/recommendations/popular", headers=headers)
    assert res_popular.status_code == 200
    popular = res_popular.json()
    for m in popular:
        assert m["is_generated"] is False

    # 3. Recently Added
    res_recent = await client.get("/api/recommendations/recently-added", headers=headers)
    assert res_recent.status_code == 200
    recent = res_recent.json()
    for m in recent:
        assert m["is_generated"] is False

async def test_catalogue_separation_search(client: AsyncClient, db_session: AsyncSession):
    await seed_test_movies(db_session)
    token = await create_test_user_and_get_token(client, db_session, "sep_user3@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Search for real movie ("Curated Real Movie")
    res_search = await client.get("/api/catalog/search?q=Curated", headers=headers)
    assert res_search.status_code == 200
    results = res_search.json()
    assert len(results) > 0
    for m in results:
        assert m["is_generated"] is False
