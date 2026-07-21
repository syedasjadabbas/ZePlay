import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.movie import Movie
from app.models.email_verification_token import EmailVerificationToken
from app.models.user import User

pytestmark = pytest.mark.asyncio

async def create_user_and_profile(client: AsyncClient, db_session: AsyncSession, email: str):
    await client.post(
        "/api/auth/register",
        json={"email": email, "name": "Rating User", "password": "Password123!"}
    )
    res = await db_session.execute(select(EmailVerificationToken))
    all_tokens = res.scalars().all()
    my_token = None
    for tr in all_tokens:
        user_res = await db_session.execute(select(User).filter(User.user_id == tr.user_id))
        u = user_res.scalars().first()
        if u and u.email == email:
            my_token = tr.token
            break

    await client.post("/api/auth/verify-email", json={"token": my_token})
    login_res = await client.post("/api/auth/login", data={"username": email, "password": "Password123!"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    prof_res = await client.post("/api/profiles/", json={"display_name": "Rating Prof"}, headers=headers)
    profile_id = prof_res.json()["profile_id"]
    return token, profile_id

async def test_rating_flow(client: AsyncClient, db_session: AsyncSession):
    token, profile_id = await create_user_and_profile(client, db_session, "rater@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Create catalog movie for test
    movie = Movie(
        title="Test Rating Movie",
        description="Rating test description",
        release_year=2026,
        duration_minutes=120,
        thumbnail_url="http://example.com/thumb.jpg",
        video_url="http://example.com/video.mp4"
    )
    db_session.add(movie)
    await db_session.commit()
    await db_session.refresh(movie)
    assert movie is not None

    # Get initial movie ratings
    initial_stats = await client.get(f"/api/ratings/movie/{movie.movie_id}?profile_id={profile_id}")
    assert initial_stats.status_code == 200
    assert initial_stats.json()["user_rating"] is None

    # Submit 5 star rating
    rate_res = await client.post(
        f"/api/ratings/movie/{movie.movie_id}?profile_id={profile_id}",
        json={"score": 5},
        headers=headers
    )
    assert rate_res.status_code == 200
    assert rate_res.json()["score"] == 5

    # Check updated stats
    stats_res = await client.get(f"/api/ratings/movie/{movie.movie_id}?profile_id={profile_id}")
    assert stats_res.status_code == 200
    assert stats_res.json()["average_rating"] == 5.0
    assert stats_res.json()["total_ratings"] == 1
    assert stats_res.json()["user_rating"] == 5

    # Update rating to 3 stars
    rate_res2 = await client.post(
        f"/api/ratings/movie/{movie.movie_id}?profile_id={profile_id}",
        json={"score": 3},
        headers=headers
    )
    assert rate_res2.status_code == 200
    assert rate_res2.json()["score"] == 3

    # Check updated stats
    stats_res2 = await client.get(f"/api/ratings/movie/{movie.movie_id}?profile_id={profile_id}")
    assert stats_res2.json()["average_rating"] == 3.0
    assert stats_res2.json()["user_rating"] == 3
