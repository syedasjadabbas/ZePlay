import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.email_verification_token import EmailVerificationToken

# Mark all test cases in this file as asynchronous
pytestmark = pytest.mark.asyncio

async def create_test_user_and_get_token(client: AsyncClient, db_session: AsyncSession, email: str) -> str:
    """Helper method to register a user and return their token after verification."""
    await client.post(
        "/api/auth/register",
        json={"email": email, "name": "Test User", "password": "Password123!"}
    )
    
    # Retrieve the verification token generated in DB
    res = await db_session.execute(select(EmailVerificationToken))
    token_rec = res.scalars().all()
    # Find token corresponding to this user
    my_token = None
    for tr in token_rec:
        user_res = await db_session.execute(select(User).filter(User.user_id == tr.user_id))
        u = user_res.scalars().first()
        if u and u.email == email:
            my_token = tr.token
            break
            
    if not my_token and token_rec:
        my_token = token_rec[-1].token
        
    await client.post(
        "/api/auth/verify-email",
        json={"token": my_token}
    )
    
    login_response = await client.post(
        "/api/auth/login",
        data={"username": email, "password": "Password123!"}
    )
    return login_response.json()["access_token"]

async def test_profile_crud_operations(client: AsyncClient, db_session: AsyncSession):
    """Test successful creation, listing, updating, and deletion of user profiles."""
    token = await create_test_user_and_get_token(client, db_session, "profile@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Create profile
    create_response = await client.post(
        "/api/profiles/",
        json={"display_name": "Main Account", "is_kids_profile": False},
        headers=headers
    )
    assert create_response.status_code == 201
    profile = create_response.json()
    assert profile["display_name"] == "Main Account"
    assert profile["is_kids_profile"] is False
    profile_id = profile["profile_id"]
    
    # 2. List profiles
    list_response = await client.get("/api/profiles/", headers=headers)
    assert list_response.status_code == 200
    profiles = list_response.json()
    assert len(profiles) == 1
    assert profiles[0]["profile_id"] == profile_id
    
    # 3. Update profile
    update_response = await client.put(
        f"/api/profiles/{profile_id}",
        json={"display_name": "Primary User", "language_pref": "fr"},
        headers=headers
    )
    assert update_response.status_code == 200
    assert update_response.json()["display_name"] == "Primary User"
    assert update_response.json()["language_pref"] == "fr"
    
    # 4. Delete profile
    delete_response = await client.delete(f"/api/profiles/{profile_id}", headers=headers)
    assert delete_response.status_code == 204
    
    # Verify profile is deleted
    list_response_after = await client.get("/api/profiles/", headers=headers)
    assert len(list_response_after.json()) == 0

async def test_profile_creation_limit(client: AsyncClient, db_session: AsyncSession):
    """Test that users are strictly prevented from creating more than 4 profiles."""
    token = await create_test_user_and_get_token(client, db_session, "limit@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create 4 profiles
    for i in range(4):
        response = await client.post(
            "/api/profiles/",
            json={"display_name": f"Profile {i+1}"},
            headers=headers
        )
        assert response.status_code == 201
        
    # Attempt to create the 5th profile
    fail_response = await client.post(
        "/api/profiles/",
        json={"display_name": "Profile 5"},
        headers=headers
    )
    assert fail_response.status_code == 400
    assert fail_response.json()["detail"] == "Maximum profile limit of 4 reached for this account."

async def test_profiles_ownership_protection(client: AsyncClient, db_session: AsyncSession):
    """Verify that User B cannot view, modify, or delete User A's profile."""
    token_a = await create_test_user_and_get_token(client, db_session, "user_a@example.com")
    token_b = await create_test_user_and_get_token(client, db_session, "user_b@example.com")
    
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}
    
    # User A creates a profile
    create_response = await client.post(
        "/api/profiles/",
        json={"display_name": "User A Profile"},
        headers=headers_a
    )
    profile_id = create_response.json()["profile_id"]
    
    # User B attempts to update User A's profile
    fail_update = await client.put(
        f"/api/profiles/{profile_id}",
        json={"display_name": "Hacked Profile"},
        headers=headers_b
    )
    assert fail_update.status_code == 404
    
    # User B attempts to delete User A's profile
    fail_delete = await client.delete(
        f"/api/profiles/{profile_id}",
        headers=headers_b
    )
    assert fail_delete.status_code == 404

from app.models.user import User
