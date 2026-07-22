import pytest
import io
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.email_verification_token import EmailVerificationToken
from app.models.user import User

pytestmark = pytest.mark.asyncio

async def create_test_token(client: AsyncClient, db_session: AsyncSession, email: str, is_admin: bool = True) -> str:
    await client.post(
        "/api/auth/register",
        json={"email": email, "name": "HLS Test User", "password": "Password123!"}
    )
    user_res = await db_session.execute(select(User).filter(User.email == email))
    user = user_res.scalars().first()
    if user:
        user.is_admin = is_admin
        await db_session.commit()

    res = await db_session.execute(select(EmailVerificationToken))
    tokens = res.scalars().all()
    token = tokens[-1].token if tokens else ""
    
    await client.post("/api/auth/verify-email", json={"token": token})
    login_res = await client.post("/api/auth/login", data={"username": email, "password": "Password123!"})
    return login_res.json()["access_token"]

async def test_hls_processing_and_endpoints(client: AsyncClient, db_session: AsyncSession):
    token = await create_test_token(client, db_session, "hlstester@example.com", is_admin=True)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Upload video file
    dummy_bytes = b"ftypisom" + b"\x00" * 1000
    files = {"file": ("sample_movie.mp4", io.BytesIO(dummy_bytes), "video/mp4")}

    upload_res = await client.post("/api/videos/admin/upload", files=files, headers=headers)
    assert upload_res.status_code == 201
    video_data = upload_res.json()
    
    assert video_data["original_filename"] == "sample_movie.mp4"
    assert video_data["status"] == "completed"
    assert video_data["format"] == "hls"
    assert "hls/master.m3u8" in video_data["hls_url"]
    video_id = video_data["video_id"]

    # 2. Test manual re-processing endpoint (/process-hls)
    reprocess_res = await client.post(f"/api/videos/admin/{video_id}/process-hls", headers=headers)
    assert reprocess_res.status_code == 200
    assert reprocess_res.json()["status"] == "completed"

    # 3. Test GET HLS Master Playlist (.m3u8)
    playlist_res = await client.get(f"/api/videos/{video_id}/hls/master.m3u8")
    assert playlist_res.status_code == 200
    assert "application/x-mpegURL" in playlist_res.headers["content-type"]
    assert "#EXTM3U" in playlist_res.text
    assert "480p/index.m3u8" in playlist_res.text

    # 4. Test GET HLS TS Segment (.ts)
    segment_res = await client.get(f"/api/videos/{video_id}/hls/480p/segment_000.ts")
    assert segment_res.status_code == 200
    assert "video/MP2T" in segment_res.headers["content-type"]
    assert len(segment_res.content) > 0

async def test_non_admin_forbidden_hls_process(client: AsyncClient, db_session: AsyncSession):
    admin_token = await create_test_token(client, db_session, "admin_user@example.com", is_admin=True)
    normal_token = await create_test_token(client, db_session, "regular_user@example.com", is_admin=False)

    # Upload video with admin token
    dummy_bytes = b"ftypisom" + b"\x00" * 500
    files = {"file": ("test.mp4", io.BytesIO(dummy_bytes), "video/mp4")}
    upload_res = await client.post("/api/videos/admin/upload", files=files, headers={"Authorization": f"Bearer {admin_token}"})
    video_id = upload_res.json()["video_id"]

    # Attempt process-hls with regular user token -> 403 Forbidden
    normal_headers = {"Authorization": f"Bearer {normal_token}"}
    forbidden_res = await client.post(f"/api/videos/admin/{video_id}/process-hls", headers=normal_headers)
    assert forbidden_res.status_code == 403
    assert "administrative privileges" in forbidden_res.json()["detail"].lower()
