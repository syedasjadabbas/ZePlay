import pytest
import io
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.email_verification_token import EmailVerificationToken
from app.models.user import User
from app.models.movie import Movie
from app.models.video import Video
from app.schemas.movie import MovieCreate
from app.services import movie_service, video_storage_service

pytestmark = pytest.mark.asyncio

async def create_admin_token(client: AsyncClient, db_session: AsyncSession, email: str = "dupadmin@example.com") -> str:
    await client.post(
        "/api/auth/register",
        json={"email": email, "name": "Dup Admin", "password": "Password123!"}
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

async def test_duplicate_upload_same_filename_rejected(client: AsyncClient, db_session: AsyncSession):
    token = await create_admin_token(client, db_session, "dup1@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    dummy_bytes = b"ftypisom" + b"\x00" * 1500
    files1 = {"file": ("duplicate_clip.mp4", io.BytesIO(dummy_bytes), "video/mp4")}

    # First upload
    res1 = await client.post("/api/videos/admin/upload", files=files1, headers=headers)
    assert res1.status_code == 201

    # Second upload with same filename should return 409 Conflict
    files2 = {"file": ("duplicate_clip.mp4", io.BytesIO(dummy_bytes), "video/mp4")}
    res2 = await client.post("/api/videos/admin/upload", files=files2, headers=headers)
    assert res2.status_code == 409
    assert "already been uploaded" in res2.json()["detail"].lower()

async def test_duplicate_upload_attached_movie_rejected(client: AsyncClient, db_session: AsyncSession):
    token = await create_admin_token(client, db_session, "dup2@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    movie_in = MovieCreate(
        title="Unique Movie Title",
        description="Test movie for attached video check",
        release_year=2026,
        duration_minutes=120,
        thumbnail_url="http://example.com/thumb.jpg",
        video_url="pending",
        genre_ids=[]
    )
    movie = await movie_service.create_movie(db_session, movie_in)

    dummy_bytes = b"ftypisom" + b"\x00" * 1500
    files1 = {"file": ("first_attached.mp4", io.BytesIO(dummy_bytes), "video/mp4")}
    data1 = {"movie_id": str(movie.movie_id)}

    res1 = await client.post("/api/videos/admin/upload", files=files1, data=data1, headers=headers)
    assert res1.status_code == 201

    # Attempting to upload a second video to the same movie_id should return 409 Conflict
    files2 = {"file": ("second_attached.mp4", io.BytesIO(dummy_bytes), "video/mp4")}
    res2 = await client.post("/api/videos/admin/upload", files=files2, data=data1, headers=headers)
    assert res2.status_code == 409
    assert "already has an attached video" in res2.json()["detail"].lower()
