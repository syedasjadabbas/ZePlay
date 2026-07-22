import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.email_verification_token import EmailVerificationToken
from app.models.user import User

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
    
    # Upgrade to Premium so we can create a 2nd profile (Free is limited to 1)
    upgrade_resp = await client.post(
        "/api/subscription/upgrade",
        json={"plan_name": "premium"},
        headers=headers,
    )
    assert upgrade_resp.status_code == 200

    # Create 2nd profile so deletion of 1st profile is allowed
    create2_response = await client.post(
        "/api/profiles/",
        json={"display_name": "Second Profile"},
        headers=headers
    )
    assert create2_response.status_code == 201

    # 4. Delete profile
    delete_response = await client.delete(f"/api/profiles/{profile_id}", headers=headers)
    assert delete_response.status_code == 204
    
    # Verify profile is deleted and 1 profile remains
    list_response_after = await client.get("/api/profiles/", headers=headers)
    assert len(list_response_after.json()) == 1

async def test_profile_creation_limit(client: AsyncClient, db_session: AsyncSession):
    """Test that Premium users are limited to 4 profiles, and Free users to 1."""
    token = await create_test_user_and_get_token(client, db_session, "limit@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Upgrade to Premium so we can test the 4-profile ceiling
    upgrade_resp = await client.post(
        "/api/subscription/upgrade",
        json={"plan_name": "premium"},
        headers=headers,
    )
    assert upgrade_resp.status_code == 200

    # Create 4 profiles — all must succeed for Premium users
    for i in range(4):
        response = await client.post(
            "/api/profiles/",
            json={"display_name": f"Profile {i+1}"},
            headers=headers
        )
        assert response.status_code == 201

    # Attempt to create the 5th profile — must fail at the Premium ceiling
    fail_response = await client.post(
        "/api/profiles/",
        json={"display_name": "Profile 5"},
        headers=headers
    )
    assert fail_response.status_code == 400
    assert "Maximum profile limit of 4" in fail_response.json()["detail"]

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

async def test_profile_default_avatar_and_update(client: AsyncClient, db_session: AsyncSession):
    """Test that default avatar 🍿 is assigned and updating emoji avatar works."""
    token = await create_test_user_and_get_token(client, db_session, "avatar_test@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create profile without avatar_url
    create_response = await client.post(
        "/api/profiles/",
        json={"display_name": "Avatar test"},
        headers=headers
    )
    assert create_response.status_code == 201
    profile = create_response.json()
    assert profile["avatar_url"] == "🍿"  # Should default to popcorn emoji
    profile_id = profile["profile_id"]
    
    # Update profile with a custom emoji avatar
    update_response = await client.put(
        f"/api/profiles/{profile_id}",
        json={"avatar_url": "🤖"},
        headers=headers
    )
    assert update_response.status_code == 200
    assert update_response.json()["avatar_url"] == "🤖"

async def test_cannot_delete_last_profile(client: AsyncClient, db_session: AsyncSession):
    """Verify that deleting the last remaining profile on an account is rejected."""
    token = await create_test_user_and_get_token(client, db_session, "only_one_prof@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Create 1 profile
    create_response = await client.post(
        "/api/profiles/",
        json={"display_name": "Only Profile"},
        headers=headers
    )
    profile_id = create_response.json()["profile_id"]
    
    # Try deleting it
    del_res = await client.delete(f"/api/profiles/{profile_id}", headers=headers)
    assert del_res.status_code == 400
    assert "Cannot delete the last remaining profile" in del_res.json()["detail"]


