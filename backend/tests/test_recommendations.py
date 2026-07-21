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
        json={"email": email, "name": "Rec Test User", "password": "Password123!"}
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

async def test_recommendations_full_pipeline(client: AsyncClient, db_session: AsyncSession):
    token = await create_test_user_and_get_token(client, db_session, "rectest@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Profile
    prof_res = await client.post("/api/profiles/", json={"display_name": "RecProfile"}, headers=headers)
    profile_id = prof_res.json()["profile_id"]

    # 2. Create Genres
    g_action = await client.post("/api/admin/genres", json={"name": "Action Rec"}, headers=headers)
    action_id = g_action.json()["genre_id"]

    g_drama = await client.post("/api/admin/genres", json={"name": "Drama Rec"}, headers=headers)
    drama_id = g_drama.json()["genre_id"]

    # 3. Create Movies
    m_action1 = await client.post(
        "/api/admin/movies",
        json={
            "title": "Action Hero 1",
            "description": "Explosive action adventure movie.",
            "release_year": 2024,
            "duration_minutes": 130,
            "thumbnail_url": "http://example.com/act1.jpg",
            "video_url": "http://example.com/act1.mp4",
            "genre_ids": [action_id]
        },
        headers=headers
    )
    act1_id = m_action1.json()["movie_id"]

    m_action2 = await client.post(
        "/api/admin/movies",
        json={
            "title": "Action Hero 2",
            "description": "High speed car chases and combat.",
            "release_year": 2023,
            "duration_minutes": 115,
            "thumbnail_url": "http://example.com/act2.jpg",
            "video_url": "http://example.com/act2.mp4",
            "genre_ids": [action_id]
        },
        headers=headers
    )
    act2_id = m_action2.json()["movie_id"]

    m_drama1 = await client.post(
        "/api/admin/movies",
        json={
            "title": "Emotional Journey",
            "description": "Touching family drama story.",
            "release_year": 2021,
            "duration_minutes": 100,
            "thumbnail_url": "http://example.com/drama.jpg",
            "video_url": "http://example.com/drama.mp4",
            "genre_ids": [drama_id]
        },
        headers=headers
    )

    # 4. Test View Tracking Endpoint
    track_res = await client.post(f"/api/recommendations/track-view/{act1_id}", headers=headers)
    assert track_res.status_code == 200
    assert track_res.json()["view_count"] >= 1

    # 5. Test Trending Movies
    trending_res = await client.get("/api/recommendations/trending", headers=headers)
    assert trending_res.status_code == 200
    assert len(trending_res.json()) >= 1

    # 6. Test Popular Movies
    popular_res = await client.get("/api/recommendations/popular", headers=headers)
    assert popular_res.status_code == 200
    assert len(popular_res.json()) >= 1

    # 7. Test Recently Added
    rec_added_res = await client.get("/api/recommendations/recently-added", headers=headers)
    assert rec_added_res.status_code == 200
    assert len(rec_added_res.json()) >= 1

    # 8. Test Similar Movies for Action Hero 1
    similar_res = await client.get(f"/api/recommendations/similar/{act1_id}", headers=headers)
    assert similar_res.status_code == 200
    similar_movies = similar_res.json()
    assert any(m["movie_id"] == act2_id for m in similar_movies)

    # 9. Watch Action Hero 1 (Post Progress to Watch History)
    await client.post(
        "/api/watch-history/progress",
        json={
            "profile_id": profile_id,
            "movie_id": act1_id,
            "current_position": 1200.0,
            "duration": 1300.0
        },
        headers=headers
    )

    # 10. Test Personalized Recommendations for Profile (Should recommend Action Hero 2 based on Action genre preference)
    pers_res = await client.get(f"/api/recommendations/personalized?profile_id={profile_id}", headers=headers)
    assert pers_res.status_code == 200
    pers_movies = pers_res.json()
    assert len(pers_movies) >= 1

    # 11. Test Because You Watched
    byw_res = await client.get(f"/api/recommendations/because-you-watched?profile_id={profile_id}", headers=headers)
    assert byw_res.status_code == 200
    byw_data = byw_res.json()
    assert byw_data["because_movie"]["movie_id"] == act1_id
    assert any(m["movie_id"] == act2_id for m in byw_data["recommendations"])
