import pytest
from httpx import AsyncClient

# Mark all tests as async
pytestmark = pytest.mark.asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.email_verification_token import EmailVerificationToken

async def create_test_user_and_get_token(client: AsyncClient, db_session: AsyncSession, email: str, is_admin: bool = True) -> str:
    """Helper method to register a user and return their token after verification."""
    await client.post(
        "/api/auth/register",
        json={"email": email, "name": "Test User", "password": "Password123!"}
    )
    
    # Retrieve user and set is_admin
    from app.models.user import User
    user_res = await db_session.execute(select(User).filter(User.email == email))
    user = user_res.scalars().first()
    if user:
        user.is_admin = is_admin
        await db_session.commit()

    # Retrieve the verification token generated in DB
    res = await db_session.execute(select(EmailVerificationToken))
    token_rec = res.scalars().all()
    token = token_rec[-1].token if token_rec else ""
    
    await client.post(
        "/api/auth/verify-email",
        json={"token": token}
    )
    
    login_response = await client.post(
        "/api/auth/login",
        data={"username": email, "password": "Password123!"}
    )
    return login_response.json()["access_token"]

async def test_catalog_crud_operations(client: AsyncClient, db_session: AsyncSession):
    """Test full E2E catalog management and fetching lifecycle."""
    token = await create_test_user_and_get_token(client, db_session, "catalog@example.com")

    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create a genre category via admin API
    genre_response = await client.post(
        "/api/admin/genres",
        json={"name": "Sci-Fi"},
        headers=headers
    )
    assert genre_response.status_code == 201
    genre = genre_response.json()
    assert genre["name"] == "Sci-Fi"
    genre_id = genre["genre_id"]

    # 2. Ingest a movie entry via admin API
    movie_payload = {
        "title": "Interstellar",
        "description": "A team of explorers travel through a wormhole in space.",
        "release_year": 2014,
        "duration_minutes": 169,
        "thumbnail_url": "http://example.com/interstellar.jpg",
        "video_url": "http://example.com/interstellar.m3u8",
        "genre_ids": [genre_id]
    }
    create_response = await client.post(
        "/api/admin/movies",
        json=movie_payload,
        headers=headers
    )
    assert create_response.status_code == 201
    movie = create_response.json()
    assert movie["title"] == "Interstellar"
    assert len(movie["genres"]) == 1
    assert movie["genres"][0]["name"] == "Sci-Fi"
    movie_id = movie["movie_id"]

    # 3. Retrieve all genres via client API
    genres_response = await client.get("/api/catalog/genres", headers=headers)
    assert genres_response.status_code == 200
    assert len(genres_response.json()) >= 1

    # 4. Fetch movies list (all)
    movies_response = await client.get("/api/catalog/movies", headers=headers)
    assert movies_response.status_code == 200
    movies = movies_response.json()
    assert len(movies) >= 1
    assert movies[0]["movie_id"] == movie_id

    # 5. Fetch movies list with category filtering
    filtered_response = await client.get(
        "/api/catalog/movies?genre=Sci-Fi", 
        headers=headers
    )
    assert filtered_response.status_code == 200
    assert len(filtered_response.json()) >= 1

    # Fetch movies list with wrong category filtering (should return empty list)
    empty_filtered_response = await client.get(
        "/api/catalog/movies?genre=Action", 
        headers=headers
    )
    assert empty_filtered_response.status_code == 200
    assert len(empty_filtered_response.json()) == 0

    # 6. Fetch single movie details by ID
    detail_response = await client.get(
        f"/api/catalog/movies/{movie_id}", 
        headers=headers
    )
    assert detail_response.status_code == 200
    assert detail_response.json()["title"] == "Interstellar"

    # 7. Update movie parameters
    update_response = await client.put(
        f"/api/admin/movies/{movie_id}",
        json={"title": "Interstellar Remastered", "duration_minutes": 172},
        headers=headers
    )
    assert update_response.status_code == 200
    assert update_response.json()["title"] == "Interstellar Remastered"
    assert update_response.json()["duration_minutes"] == 172

    # 8. Delete movie
    delete_response = await client.delete(
        f"/api/admin/movies/{movie_id}", 
        headers=headers
    )
    assert delete_response.status_code == 204

    # Verify deletion
    verify_deleted_response = await client.get(
        f"/api/catalog/movies/{movie_id}", 
        headers=headers
    )
    assert verify_deleted_response.status_code == 404
