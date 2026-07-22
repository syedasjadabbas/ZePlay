import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.email_verification_token import EmailVerificationToken
from app.models.user import User
from app.models.audit_log import AuditLog

# Mark all test cases in this file as asynchronous
pytestmark = pytest.mark.asyncio

async def create_test_user_and_get_token(client: AsyncClient, db_session: AsyncSession, email: str, is_admin: bool = False) -> dict:
    """Helper method to register a user, verify email, set admin if needed, and return token."""
    await client.post(
        "/api/auth/register",
        json={"email": email, "name": "Sprint 10 User", "password": "Password123!"}
    )
    
    # Retrieve and verify user
    res = await db_session.execute(select(EmailVerificationToken))
    tokens = res.scalars().all()
    my_token = None
    for t in tokens:
        user_res = await db_session.execute(select(User).filter(User.user_id == t.user_id))
        u = user_res.scalars().first()
        if u and u.email == email:
            my_token = t.token
            if is_admin:
                u.is_admin = True
                await db_session.commit()
            break
            
    await client.post(
        "/api/auth/verify-email",
        json={"token": my_token}
    )
    
    login_response = await client.post(
        "/api/auth/login",
        data={"username": email, "password": "Password123!"}
    )
    payload = login_response.json()
    return {"token": payload["access_token"], "user_id": str(u.user_id) if u else None}

async def test_admin_sprint10_endpoints(client: AsyncClient, db_session: AsyncSession):
    """Test Analytics, User Management, Admin Management, Platform Health, and Audit Logs."""
    # Create an admin user and a regular user
    admin_auth = await create_test_user_and_get_token(client, db_session, "admin10@example.com", is_admin=True)
    user_auth = await create_test_user_and_get_token(client, db_session, "user10@example.com", is_admin=False)
    
    admin_headers = {"Authorization": f"Bearer {admin_auth['token']}"}
    user_headers = {"Authorization": f"Bearer {user_auth['token']}"}

    # --- Test 1: Access protection (non-admin forbidden) ---
    forbidden_endpoints = [
        ("GET", "/api/admin/analytics"),
        ("GET", "/api/admin/content-analytics"),
        ("GET", "/api/admin/health"),
        ("GET", "/api/admin/audit-logs"),
        ("GET", "/api/admin/users"),
    ]
    for method, path in forbidden_endpoints:
        if method == "GET":
            resp = await client.get(path, headers=user_headers)
            assert resp.status_code == 403

    # --- Test 2: Analytics API ---
    analytics_resp = await client.get("/api/admin/analytics", headers=admin_headers)
    assert analytics_resp.status_code == 200
    data = analytics_resp.json()
    assert "total_users" in data
    assert "total_profiles" in data
    assert "conversion_rate" in data

    # --- Test 3: Content Analytics API ---
    content_resp = await client.get("/api/admin/content-analytics", headers=admin_headers)
    assert content_resp.status_code == 200
    c_data = content_resp.json()
    assert "most_watched_movies" in c_data
    assert "highest_rated_movies" in c_data

    # --- Test 4: Platform Health API ---
    health_resp = await client.get("/api/admin/health", headers=admin_headers)
    assert health_resp.status_code == 200
    h_data = health_resp.json()
    assert h_data["database_status"] == "healthy"
    assert "cache_status" in h_data

    # --- Test 5: User Management (list, search, status toggle) ---
    # List all users
    users_resp = await client.get("/api/admin/users", headers=admin_headers)
    assert users_resp.status_code == 200
    users_list = users_resp.json()
    assert len(users_list) >= 2

    # Disable regular user
    user_id = user_auth["user_id"]
    disable_resp = await client.post(
        f"/api/admin/users/{user_id}/status",
        json={"is_active": False},
        headers=admin_headers
    )
    assert disable_resp.status_code == 200
    assert disable_resp.json()["is_active"] is False

    # Verify disabled user cannot log in
    fail_login = await client.post(
        "/api/auth/login",
        data={"username": "user10@example.com", "password": "Password123!"}
    )
    assert fail_login.status_code == 403
    assert "disabled" in fail_login.json()["detail"]

    # Verify disabled user cannot query /me
    fail_me = await client.get("/api/auth/me", headers=user_headers)
    assert fail_me.status_code == 403

    # Enable user back
    enable_resp = await client.post(
        f"/api/admin/users/{user_id}/status",
        json={"is_active": True},
        headers=admin_headers
    )
    assert enable_resp.status_code == 200
    assert enable_resp.json()["is_active"] is True

    # --- Test 6: Admin Promotion / Revocation ---
    # Promote user
    promote_resp = await client.post(f"/api/admin/users/{user_id}/promote", headers=admin_headers)
    assert promote_resp.status_code == 200
    assert promote_resp.json()["is_admin"] is True

    # Demote user
    demote_resp = await client.post(f"/api/admin/users/{user_id}/demote", headers=admin_headers)
    assert demote_resp.status_code == 200
    assert demote_resp.json()["is_admin"] is False

    # Test self-demotion protection
    self_demote = await client.post(f"/api/admin/users/{admin_auth['user_id']}/demote", headers=admin_headers)
    assert self_demote.status_code == 400

    # --- Test 7: Audit Logging check ---
    audit_resp = await client.get("/api/admin/audit-logs", headers=admin_headers)
    assert audit_resp.status_code == 200
    logs = audit_resp.json()
    assert len(logs) > 0
    # The actions should include user_creation, user_enable, user_disable, admin_promotion, admin_removal
    actions = [l["action"] for l in logs]
    assert "user_creation" in actions
    assert "admin_promotion" in actions
    assert "admin_removal" in actions
