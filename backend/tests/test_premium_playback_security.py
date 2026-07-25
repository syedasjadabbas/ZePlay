import pytest
import uuid
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt
from app.models.user import User
from app.models.email_verification_token import EmailVerificationToken

async def register_and_verify_user(client: AsyncClient, db_session: AsyncSession, email: str) -> str:
    """Helper to register and verify test user, returning access token."""
    await client.post("/api/auth/register", json={"email": email, "name": "Security User", "password": "Password123!"})
    res = await db_session.execute(select(EmailVerificationToken))
    tokens = res.scalars().all()
    my_token = None
    for tr in tokens:
        u_res = await db_session.execute(select(User).filter(User.user_id == tr.user_id))
        u = u_res.scalars().first()
        if u and u.email == email:
            my_token = tr.token
            break
    if my_token is None and tokens:
        my_token = tokens[-1].token
    await client.post("/api/auth/verify-email", json={"token": my_token})
    login_res = await client.post("/api/auth/login", data={"username": email, "password": "Password123!"})
    return login_res.json()["access_token"]

@pytest.mark.asyncio
async def test_free_user_playback_denied(client: AsyncClient, db_session: AsyncSession):
    """Verify non-premium user is rejected with HTTP 403 when requesting stream or HLS playlists."""
    token = await register_and_verify_user(client, db_session, "free_security_test@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    fake_video_id = str(uuid.uuid4())

    # 1. Stream endpoint
    stream_res = await client.get(f"/api/videos/{fake_video_id}/stream", headers=headers)
    assert stream_res.status_code == 403
    assert "Active premium subscription required" in stream_res.json()["detail"]

    # 2. Master playlist endpoint
    master_res = await client.get(f"/api/videos/{fake_video_id}/hls/master.m3u8", headers=headers)
    assert master_res.status_code == 403

    # 3. TS segment chunk endpoint
    segment_res = await client.get(f"/api/videos/{fake_video_id}/hls/480p/segment_000.ts", headers=headers)
    assert segment_res.status_code == 403

@pytest.mark.asyncio
async def test_unauthenticated_media_access_denied(client: AsyncClient):
    """Verify unauthenticated direct requests to video endpoints are rejected with HTTP 401."""
    fake_video_id = str(uuid.uuid4())
    res = await client.get(f"/api/videos/{fake_video_id}/hls/master.m3u8")
    assert res.status_code == 401

@pytest.mark.asyncio
async def test_premium_user_playback_allowed(client: AsyncClient, db_session: AsyncSession):
    """Verify premium user gets authorized entitlement check."""
    token = await register_and_verify_user(client, db_session, "premium_security_test@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Upgrade to premium
    upg_res = await client.post("/api/subscription/upgrade", json={"plan_name": "premium"}, headers=headers)
    assert upg_res.status_code == 200

    fake_video_id = str(uuid.uuid4())
    # Should get 404 Not Found (since dummy video UUID doesn't exist), NOT 403 Forbidden!
    res = await client.get(f"/api/videos/{fake_video_id}/hls/master.m3u8", headers=headers)
    assert res.status_code == 404

@pytest.mark.asyncio
async def test_google_auth_endpoint(client: AsyncClient):
    """Verify Google OAuth token processing endpoint."""
    fake_google_jwt = jwt.encode(
        {"email": "google_test_user@example.com", "name": "Google Test User", "email_verified": True},
        "secret",
        algorithm="HS256"
    )
    res = await client.post("/api/auth/google", json={"id_token": fake_google_jwt})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "google_test_user@example.com"
