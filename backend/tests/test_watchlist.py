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
        json={"email": email, "name": "Watchlist User", "password": "Password123!"}
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

async def test_watchlist_flow(client: AsyncClient, db_session: AsyncSession):
    token = await create_test_user_and_get_token(client, db_session, "watchlisttest@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Profile
    prof_res = await client.post("/api/profiles/", json={"display_name": "My List Viewer"}, headers=headers)
    assert prof_res.status_code == 201
    profile_id = prof_res.json()["profile_id"]

    # 2. Create Movie
    movie_res = await client.post(
        "/api/admin/movies",
        json={
            "title": "Interstellar",
            "description": "Space exploration masterpiece.",
            "release_year": 2014,
            "duration_minutes": 169,
            "thumbnail_url": "http://example.com/interstellar.jpg",
            "video_url": "http://example.com/interstellar.mp4"
        },
        headers=headers
    )
    assert movie_res.status_code == 201
    movie_id = movie_res.json()["movie_id"]

    # 3. Check initial watchlist status
    check_res = await client.get(f"/api/watchlist/check/{movie_id}?profile_id={profile_id}", headers=headers)
    assert check_res.status_code == 200
    assert check_res.json()["is_in_watchlist"] is False

    # 4. Add movie to Watchlist
    add_res = await client.post(
        "/api/watchlist/",
        json={"profile_id": profile_id, "movie_id": movie_id},
        headers=headers
    )
    assert add_res.status_code == 201
    add_data = add_res.json()
    assert add_data["movie_id"] == movie_id
    assert add_data["profile_id"] == profile_id
    assert add_data["movie"]["title"] == "Interstellar"

    # 5. Re-check watchlist status
    check_after = await client.get(f"/api/watchlist/check/{movie_id}?profile_id={profile_id}", headers=headers)
    assert check_after.status_code == 200
    assert check_after.json()["is_in_watchlist"] is True

    # 6. Fetch full Watchlist list
    list_res = await client.get(f"/api/watchlist/?profile_id={profile_id}", headers=headers)
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) == 1
    assert items[0]["movie_id"] == movie_id

    # 7. Verify Watch History remains empty (Watch History and Watchlist are separate!)
    wh_res = await client.get(f"/api/watch-history/?profile_id={profile_id}", headers=headers)
    assert wh_res.status_code == 200
    assert len(wh_res.json()) == 0

    # 8. Remove movie from Watchlist
    del_res = await client.delete(f"/api/watchlist/{movie_id}?profile_id={profile_id}", headers=headers)
    assert del_res.status_code == 204

    # 9. Verify Watchlist is empty after deletion
    check_final = await client.get(f"/api/watchlist/check/{movie_id}?profile_id={profile_id}", headers=headers)
    assert check_final.status_code == 200
    assert check_final.json()["is_in_watchlist"] is False

    list_final = await client.get(f"/api/watchlist/?profile_id={profile_id}", headers=headers)
    assert list_final.status_code == 200
    assert len(list_final.json()) == 0
