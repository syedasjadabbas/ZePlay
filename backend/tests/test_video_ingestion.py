import pytest
import io
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.email_verification_token import EmailVerificationToken
from app.models.user import User

pytestmark = pytest.mark.asyncio

async def create_test_user_token(client: AsyncClient, db_session: AsyncSession, email: str, is_admin: bool = True) -> str:
    await client.post(
        "/api/auth/register",
        json={"email": email, "name": "Video Admin", "password": "Password123!"}
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

async def test_non_admin_forbidden_video_upload(client: AsyncClient, db_session: AsyncSession):
    # Create normal non-admin user
    token = await create_test_user_token(client, db_session, "normaluser@example.com", is_admin=False)
    headers = {"Authorization": f"Bearer {token}"}

    dummy_bytes = b"ftypisom" + b"\x00" * 100
    files = {"file": ("test_clip.mp4", io.BytesIO(dummy_bytes), "video/mp4")}

    response = await client.post("/api/videos/admin/upload", files=files, headers=headers)
    assert response.status_code == 403
    assert "administrative privileges" in response.json()["detail"].lower()

async def test_video_upload_and_stream(client: AsyncClient, db_session: AsyncSession):
    token = await create_test_user_token(client, db_session, "videoadmin@example.com", is_admin=True)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Upload video asset
    dummy_video_bytes = b"ftypisom" + b"\x00" * 2000  # Dummy MP4 header bytes
    files = {"file": ("test_clip.mp4", io.BytesIO(dummy_video_bytes), "video/mp4")}
    
    response = await client.post("/api/videos/admin/upload", files=files, headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["original_filename"] == "test_clip.mp4"
    assert data["mime_type"] == "video/mp4"
    assert data["file_size_bytes"] == len(dummy_video_bytes)
    assert data["status"] in ["completed", "uploaded", "READY", "processing"]
    assert "playback_url" in data
    
    video_id = data["video_id"]

    # Wait for background transcoding to complete
    import asyncio
    status_val = data["status"]
    for _ in range(10):
        if status_val in ["completed", "READY"]:
            break
        await asyncio.sleep(0.1)
        detail_res = await client.get(f"/api/videos/{video_id}", headers=headers)
        status_val = detail_res.json()["status"]

    # 2. List videos
    list_res = await client.get("/api/videos", headers=headers)
    assert list_res.status_code == 200
    items = list_res.json()
    assert len(items) >= 1

    # 3. Get single video details
    detail_res = await client.get(f"/api/videos/{video_id}", headers=headers)
    assert detail_res.status_code == 200
    assert detail_res.json()["video_id"] == video_id

    # 4. Full stream (200 OK or 307 Redirect)
    stream_res = await client.get(f"/api/videos/{video_id}/stream", headers=headers, follow_redirects=False)
    assert stream_res.status_code in [200, 302, 307]
    if stream_res.status_code in [302, 307]:
        assert "location" in stream_res.headers
    else:
        assert stream_res.headers["content-type"] == "video/mp4"

    # 5. Range stream (206 Partial Content or 307 Redirect)
    range_headers = {"Range": "bytes=0-499", "Authorization": f"Bearer {token}"}
    range_res = await client.get(f"/api/videos/{video_id}/stream", headers=range_headers, follow_redirects=False)
    assert range_res.status_code in [206, 302, 307]
    if range_res.status_code == 206:
        assert range_res.headers["content-range"].startswith("bytes 0-499/")
        assert len(range_res.content) == 500

    # 6. Delete video asset
    del_res = await client.delete(f"/api/videos/admin/{video_id}", headers=headers)
    assert del_res.status_code == 204

    # Verify 404 after deletion
    verify_res = await client.get(f"/api/videos/{video_id}", headers=headers)
    assert verify_res.status_code == 404
