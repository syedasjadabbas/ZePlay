import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.email_verification_token import EmailVerificationToken
from app.models.user import User

pytestmark = pytest.mark.asyncio

async def create_test_user_and_get_token(client: AsyncClient, db_session: AsyncSession, email: str) -> str:
    await client.post(
        "/api/auth/register",
        json={"email": email, "name": "Search Test User", "password": "Password123!"}
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

async def test_search_and_suggestions_flow(client: AsyncClient, db_session: AsyncSession):
    token = await create_test_user_and_get_token(client, db_session, "searcher@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Sci-Fi Genre
    g1 = await client.post("/api/admin/genres", json={"name": "Sci-Fi Search"}, headers=headers)
    g1_id = g1.json()["genre_id"]

    # 2. Ingest Test Movies
    m1 = await client.post(
        "/api/admin/movies",
        json={
            "title": "Quantum Odyssey",
            "description": "Exploration of parallel dimensions through wormhole science.",
            "release_year": 2024,
            "duration_minutes": 140,
            "thumbnail_url": "http://example.com/quantum.jpg",
            "video_url": "http://example.com/quantum.mp4",
            "genre_ids": [g1_id]
        },
        headers=headers
    )
    assert m1.status_code == 201

    m2 = await client.post(
        "/api/admin/movies",
        json={
            "title": "Cyberpunk Horizon",
            "description": "Neon city detective solving high tech cyber crimes.",
            "release_year": 2022,
            "duration_minutes": 120,
            "thumbnail_url": "http://example.com/cyber.jpg",
            "video_url": "http://example.com/cyber.mp4"
        },
        headers=headers
    )
    assert m2.status_code == 201

    # 3. Test Title Search
    res_title = await client.get("/api/catalog/search?q=Quantum", headers=headers)
    assert res_title.status_code == 200
    results = res_title.json()
    assert len(results) >= 1
    assert any(r["title"] == "Quantum Odyssey" for r in results)

    # 4. Test Description Keyword Search ("wormhole")
    res_desc = await client.get("/api/catalog/search?q=wormhole", headers=headers)
    assert res_desc.status_code == 200
    assert any(r["title"] == "Quantum Odyssey" for r in res_desc.json())

    # 5. Test Genre Name Search ("Sci-Fi Search")
    res_genre = await client.get("/api/catalog/search?q=Sci-Fi Search", headers=headers)
    assert res_genre.status_code == 200
    assert any(r["title"] == "Quantum Odyssey" for r in res_genre.json())

    # 6. Test Release Year Search ("2024")
    res_year = await client.get("/api/catalog/search?q=2024", headers=headers)
    assert res_year.status_code == 200
    assert any(r["title"] == "Quantum Odyssey" for r in res_year.json())

    # 7. Test Search Suggestions Endpoint
    res_sug = await client.get("/api/catalog/search/suggestions?q=Cyber", headers=headers)
    assert res_sug.status_code == 200
    sug_items = res_sug.json()
    assert len(sug_items) >= 1
    assert sug_items[0]["title"] == "Cyberpunk Horizon"
