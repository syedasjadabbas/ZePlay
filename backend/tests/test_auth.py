import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.email_verification_token import EmailVerificationToken

# Mark all test cases in this file as asynchronous
pytestmark = pytest.mark.asyncio

async def test_register_user(client: AsyncClient):
    """Test successful user registration (unverified by default)."""
    response = await client.post(
        "/api/auth/register",
        json={"email": "test@example.com", "name": "Test User", "password": "Password123!"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["name"] == "Test User"
    assert "user_id" in data
    assert data["is_verified"] is False

async def test_register_existing_email(client: AsyncClient):
    """Test registration block on duplicate email entries."""
    # First sign up
    await client.post(
        "/api/auth/register",
        json={"email": "duplicate@example.com", "name": "Duplicate", "password": "Password123!"}
    )
    # Duplicate sign up
    response = await client.post(
        "/api/auth/register",
        json={"email": "duplicate@example.com", "name": "Another Name", "password": "Password123!"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "A user with this email already exists."

async def test_login_user(client: AsyncClient, db_session: AsyncSession):
    """Test successful user login after verifying email address."""
    # Register
    await client.post(
        "/api/auth/register",
        json={"email": "login@example.com", "name": "Login User", "password": "Password123!"}
    )
    
    # Query verification token
    res = await db_session.execute(select(EmailVerificationToken))
    token_rec = res.scalars().first()
    assert token_rec is not None
    
    # Verify email
    verify_response = await client.post(
        "/api/auth/verify-email",
        json={"token": token_rec.token}
    )
    assert verify_response.status_code == 200
    
    # Login
    response = await client.post(
        "/api/auth/login",
        data={"username": "login@example.com", "password": "Password123!"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

async def test_get_current_user_unauthorized(client: AsyncClient):
    """Test that unauthorized access to /me fails with 401."""
    response = await client.get("/api/auth/me")
    assert response.status_code == 401

async def test_get_current_user_authorized(client: AsyncClient, db_session: AsyncSession):
    """Test accessing current user details with active JWT token."""
    # Register
    await client.post(
        "/api/auth/register",
        json={"email": "me@example.com", "name": "Me User", "password": "Password123!"}
    )
    
    # Query verification token and verify
    res = await db_session.execute(select(EmailVerificationToken))
    token_rec = res.scalars().all()
    # Find the one corresponding to me@example.com
    my_token = None
    for tr in token_rec:
        user_res = await db_session.execute(select(User).filter(User.user_id == tr.user_id))
        u = user_res.scalars().first()
        if u and u.email == "me@example.com":
            my_token = tr.token
            break
            
    if not my_token and token_rec:
        my_token = token_rec[-1].token
        
    await client.post(
        "/api/auth/verify-email",
        json={"token": my_token}
    )
    
    # Login
    login_response = await client.post(
        "/api/auth/login",
        data={"username": "me@example.com", "password": "Password123!"}
    )
    token = login_response.json()["access_token"]
    
    # Query current user endpoint with JWT token
    headers = {"Authorization": f"Bearer {token}"}
    response = await client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "me@example.com"
    assert data["name"] == "Me User"

# Import User model inside loop to avoid cyclic dependencies in tests
from app.models.user import User
