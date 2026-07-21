import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.email_verification_token import EmailVerificationToken
from app.models.user import User

pytestmark = pytest.mark.asyncio

async def create_test_user_and_get_token(client: AsyncClient, db_session: AsyncSession, email: str) -> str:
    """Helper method to register a user and return access token."""
    await client.post(
        "/api/auth/register",
        json={"email": email, "name": "WatchHistory User", "password": "Password123!"}
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

async def test_watch_history_flow(client: AsyncClient, db_session: AsyncSession):
    token = await create_test_user_and_get_token(client, db_session, "watchtest@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Profile
    prof_res = await client.post("/api/profiles/", json={"display_name": "Main Viewer"}, headers=headers)
    assert prof_res.status_code == 201
    profile_id = prof_res.json()["profile_id"]

    # 2. Create Movie
    movie_res = await client.post(
        "/api/admin/movies",
        json={
            "title": "Inception",
            "description": "Dream within a dream.",
            "release_year": 2010,
            "duration_minutes": 148,
            "thumbnail_url": "http://example.com/inception.jpg",
            "video_url": "http://example.com/inception.mp4"
        },
        headers=headers
    )
    assert movie_res.status_code == 201
    movie_id = movie_res.json()["movie_id"]

    # 3. Save initial playback progress (300 seconds of 1000s)
    progress_payload = {
        "profile_id": profile_id,
        "movie_id": movie_id,
        "current_position": 300.0,
        "duration": 1000.0
    }
    progress_res = await client.post("/api/watch-history/progress", json=progress_payload, headers=headers)
    assert progress_res.status_code == 200
    prog_data = progress_res.json()
    assert prog_data["current_position"] == 300.0
    assert prog_data["percentage_watched"] == 30.0
    history_id = prog_data["history_id"]

    # 4. Fetch Continue Watching list
    cw_res = await client.get(f"/api/watch-history/continue-watching?profile_id={profile_id}", headers=headers)
    assert cw_res.status_code == 200
    cw_items = cw_res.json()
    assert len(cw_items) == 1
    assert cw_items[0]["movie_id"] == movie_id
    assert cw_items[0]["percentage_watched"] == 30.0

    # 5. Fetch single item progress
    single_res = await client.get(f"/api/watch-history/progress/{movie_id}?profile_id={profile_id}", headers=headers)
    assert single_res.status_code == 200
    assert single_res.json()["current_position"] == 300.0

    # 6. Update progress to 980s (98% - completed)
    completed_payload = {
        "profile_id": profile_id,
        "movie_id": movie_id,
        "current_position": 980.0,
        "duration": 1000.0
    }
    await client.post("/api/watch-history/progress", json=completed_payload, headers=headers)

    # Continue watching list should now exclude this item because percentage >= 95%
    cw_after = await client.get(f"/api/watch-history/continue-watching?profile_id={profile_id}", headers=headers)
    assert cw_after.status_code == 200
    assert len(cw_after.json()) == 0

    # 7. Delete Watch History Item
    del_res = await client.delete(f"/api/watch-history/{history_id}", headers=headers)
    assert del_res.status_code == 204

    # Full history check
    hist_after = await client.get(f"/api/watch-history/?profile_id={profile_id}", headers=headers)
    assert hist_after.status_code == 200
    assert len(hist_after.json()) == 0
