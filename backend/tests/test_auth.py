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

async def test_change_password_success(client: AsyncClient, db_session: AsyncSession):
    # 1. Register & verify email
    await client.post(
        "/api/auth/register",
        json={"email": "changepwd@example.com", "name": "Change User", "password": "Password123!"}
    )
    res = await db_session.execute(select(EmailVerificationToken))
    all_tokens = res.scalars().all()
    my_token = None
    for tr in all_tokens:
        user_res = await db_session.execute(select(User).filter(User.user_id == tr.user_id))
        u = user_res.scalars().first()
        if u and u.email == "changepwd@example.com":
            my_token = tr.token
            break
            
    await client.post("/api/auth/verify-email", json={"token": my_token})
    
    # 2. Login
    login_response = await client.post(
        "/api/auth/login",
        data={"username": "changepwd@example.com", "password": "Password123!"}
    )
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 3. Change password successfully
    response = await client.post(
        "/api/auth/change-password",
        headers=headers,
        json={
            "current_password": "Password123!",
            "new_password": "NewPassword123!",
            "confirm_password": "NewPassword123!"
        }
    )
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    
    # 4. Attempt login with old password (fails)
    old_login = await client.post(
        "/api/auth/login",
        data={"username": "changepwd@example.com", "password": "Password123!"}
    )
    assert old_login.status_code == 400
    
    # 5. Login with new password (succeeds)
    new_login = await client.post(
        "/api/auth/login",
        data={"username": "changepwd@example.com", "password": "NewPassword123!"}
    )
    assert new_login.status_code == 200
    assert "access_token" in new_login.json()

async def test_change_password_failures(client: AsyncClient, db_session: AsyncSession):
    # Register, verify, login
    await client.post(
        "/api/auth/register",
        json={"email": "changepwdfail@example.com", "name": "Change User Fail", "password": "Password123!"}
    )
    res = await db_session.execute(select(EmailVerificationToken))
    all_tokens = res.scalars().all()
    my_token = None
    for tr in all_tokens:
        user_res = await db_session.execute(select(User).filter(User.user_id == tr.user_id))
        u = user_res.scalars().first()
        if u and u.email == "changepwdfail@example.com":
            my_token = tr.token
            break
    await client.post("/api/auth/verify-email", json={"token": my_token})
    
    login_response = await client.post(
        "/api/auth/login",
        data={"username": "changepwdfail@example.com", "password": "Password123!"}
    )
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Mismatched passwords
    response1 = await client.post(
        "/api/auth/change-password",
        headers=headers,
        json={
            "current_password": "Password123!",
            "new_password": "NewPassword123!",
            "confirm_password": "DifferentPassword123!"
        }
    )
    assert response1.status_code == 400
    assert "Mismatched" in response1.json()["detail"]
    
    # Incorrect current password
    response2 = await client.post(
        "/api/auth/change-password",
        headers=headers,
        json={
            "current_password": "WrongPassword!",
            "new_password": "NewPassword123!",
            "confirm_password": "NewPassword123!"
        }
    )
    assert response2.status_code == 400
    assert "Incorrect current password" in response2.json()["detail"]
    
    # New password too short
    response3 = await client.post(
        "/api/auth/change-password",
        headers=headers,
        json={
            "current_password": "Password123!",
            "new_password": "short",
            "confirm_password": "short"
        }
    )
    assert response3.status_code == 422


from app.models.password_reset_token import PasswordResetToken

async def test_forgot_password_and_reset_via_otp(client: AsyncClient, db_session: AsyncSession):
    # 1. Register a user
    await client.post(
        "/api/auth/register",
        json={"email": "forgot@example.com", "name": "Forgot User", "password": "Password123!"}
    )
    
    # Verify email first
    res_verify = await db_session.execute(select(EmailVerificationToken))
    verify_token_rec = res_verify.scalars().first()
    await client.post(
        "/api/auth/verify-email",
        json={"token": verify_token_rec.token}
    )
    
    # 2. Trigger forgot password
    forgot_response = await client.post(
        "/api/auth/forgot-password",
        json={"email": "forgot@example.com"}
    )
    assert forgot_response.status_code == 200
    assert "password reset code will be sent" in forgot_response.json()["message"]
    
    # 3. Query the password reset token from DB
    res_reset = await db_session.execute(select(PasswordResetToken))
    reset_token_rec = res_reset.scalars().first()
    assert reset_token_rec is not None
    assert len(reset_token_rec.token) == 6  # 6-digit OTP
    
    # 4. Reset password using the 6-digit OTP token
    reset_response = await client.post(
        "/api/auth/reset-password",
        json={
            "token": reset_token_rec.token,
            "new_password": "NewPassword123!"
        }
    )
    assert reset_response.status_code == 200
    assert "Password successfully reset" in reset_response.json()["message"]
    
    # 5. Attempt login with new password (should succeed)
    login_res = await client.post(
        "/api/auth/login",
        data={"username": "forgot@example.com", "password": "NewPassword123!"}
    )
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

