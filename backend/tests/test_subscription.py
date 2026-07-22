"""
Tests for Sprint 9: Subscription & Plans

Covers:
- New user receives Free plan automatically
- Plan listing
- Current subscription retrieval
- Free user limited to 1 profile
- Premium user allowed up to 4 profiles
- Upgrade endpoint
- Downgrade endpoint (including rejection when profile count exceeds new plan limit)
- Cancel endpoint
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.email_verification_token import EmailVerificationToken
from app.models.subscription_plan import SubscriptionPlan
from app.models.user_subscription import UserSubscription

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------

async def register_and_verify(
    client: AsyncClient,
    db_session: AsyncSession,
    email: str,
    name: str = "Test User",
) -> str:
    """Register a user, verify their email, and return a JWT token."""
    await client.post(
        "/api/auth/register",
        json={"email": email, "name": name, "password": "Password123!"},
    )

    # Retrieve verification token
    res = await db_session.execute(select(EmailVerificationToken))
    tokens = res.scalars().all()
    my_token = None
    for tr in tokens:
        user_res = await db_session.execute(
            select(User).filter(User.user_id == tr.user_id)
        )
        u = user_res.scalars().first()
        if u and u.email == email:
            my_token = tr.token
            break

    if my_token is None and tokens:
        my_token = tokens[-1].token

    await client.post("/api/auth/verify-email", json={"token": my_token})

    login_res = await client.post(
        "/api/auth/login",
        data={"username": email, "password": "Password123!"},
    )
    return login_res.json()["access_token"]


async def upgrade_to_premium(client: AsyncClient, token: str) -> None:
    """Helper to upgrade a user to the Premium plan."""
    resp = await client.post(
        "/api/subscription/upgrade",
        json={"plan_name": "premium"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, f"Upgrade failed: {resp.text}"


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

async def test_new_user_gets_free_plan(client: AsyncClient, db_session: AsyncSession):
    """Every new user must automatically receive an active Free subscription."""
    token = await register_and_verify(client, db_session, "new_sub_user@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get("/api/subscription/current", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "active"
    assert data["plan"]["name"] == "free"
    assert data["plan"]["max_profiles"] == 1


async def test_list_plans_returns_two_plans(client: AsyncClient, db_session: AsyncSession):
    """GET /api/subscription/plans should return at least the Free and Premium plans."""
    token = await register_and_verify(client, db_session, "plans_list@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.get("/api/subscription/plans", headers=headers)
    assert resp.status_code == 200
    plans = resp.json()
    plan_names = {p["name"] for p in plans}
    assert "free" in plan_names
    assert "premium" in plan_names


async def test_free_user_limited_to_one_profile(client: AsyncClient, db_session: AsyncSession):
    """Free-plan users should only be able to create 1 profile; the 2nd must fail."""
    token = await register_and_verify(client, db_session, "free_limit@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # First profile — should succeed
    resp1 = await client.post(
        "/api/profiles/",
        json={"display_name": "Profile One"},
        headers=headers,
    )
    assert resp1.status_code == 201

    # Second profile — should be blocked
    resp2 = await client.post(
        "/api/profiles/",
        json={"display_name": "Profile Two"},
        headers=headers,
    )
    assert resp2.status_code == 403
    assert "Upgrade to Premium" in resp2.json()["detail"]


async def test_premium_user_allowed_four_profiles(client: AsyncClient, db_session: AsyncSession):
    """Premium-plan users should be able to create up to 4 profiles."""
    token = await register_and_verify(client, db_session, "premium_limit@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Upgrade first
    await upgrade_to_premium(client, token)

    # Create 4 profiles — all must succeed
    for i in range(4):
        resp = await client.post(
            "/api/profiles/",
            json={"display_name": f"Profile {i + 1}"},
            headers=headers,
        )
        assert resp.status_code == 201, f"Profile {i + 1} creation failed: {resp.text}"

    # 5th profile must fail
    resp5 = await client.post(
        "/api/profiles/",
        json={"display_name": "Profile 5"},
        headers=headers,
    )
    assert resp5.status_code == 400
    assert "Maximum profile limit of 4" in resp5.json()["detail"]


async def test_upgrade_to_premium(client: AsyncClient, db_session: AsyncSession):
    """Upgrade endpoint should change the plan to Premium and set status=active."""
    token = await register_and_verify(client, db_session, "upgrade_test@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post(
        "/api/subscription/upgrade",
        json={"plan_name": "premium"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["plan"]["name"] == "premium"
    assert data["status"] == "active"
    assert data["plan"]["max_profiles"] == 4


async def test_downgrade_to_free(client: AsyncClient, db_session: AsyncSession):
    """Downgrade endpoint should work when the user has ≤ 1 profile."""
    token = await register_and_verify(client, db_session, "downgrade_test@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Upgrade first
    await upgrade_to_premium(client, token)

    # Create exactly 1 profile so downgrade is allowed
    await client.post(
        "/api/profiles/",
        json={"display_name": "Solo Profile"},
        headers=headers,
    )

    resp = await client.post(
        "/api/subscription/downgrade",
        json={"plan_name": "free"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["plan"]["name"] == "free"
    assert data["status"] == "active"


async def test_downgrade_blocked_by_profile_count(client: AsyncClient, db_session: AsyncSession):
    """Downgrade to Free must fail when user has more profiles than the Free plan allows."""
    token = await register_and_verify(client, db_session, "downgrade_block@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Upgrade to Premium
    await upgrade_to_premium(client, token)

    # Create 2 profiles
    for i in range(2):
        await client.post(
            "/api/profiles/",
            json={"display_name": f"Profile {i + 1}"},
            headers=headers,
        )

    # Attempt downgrade — must fail
    resp = await client.post(
        "/api/subscription/downgrade",
        json={"plan_name": "free"},
        headers=headers,
    )
    assert resp.status_code == 400
    assert "delete" in resp.json()["detail"].lower() or "profile" in resp.json()["detail"].lower()


async def test_cancel_subscription(client: AsyncClient, db_session: AsyncSession):
    """Cancel endpoint should set subscription status to 'cancelled'."""
    token = await register_and_verify(client, db_session, "cancel_test@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    resp = await client.post("/api/subscription/cancel", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "cancelled"
    assert data["auto_renew"] is False


async def test_cancel_already_cancelled(client: AsyncClient, db_session: AsyncSession):
    """Cancelling an already-cancelled subscription must return 400."""
    token = await register_and_verify(client, db_session, "cancel_twice@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    await client.post("/api/subscription/cancel", headers=headers)

    resp = await client.post("/api/subscription/cancel", headers=headers)
    assert resp.status_code == 400
    assert "already cancelled" in resp.json()["detail"].lower()


async def test_upgrade_already_on_plan(client: AsyncClient, db_session: AsyncSession):
    """Upgrading when already on Premium must return 400."""
    token = await register_and_verify(client, db_session, "already_premium@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    await upgrade_to_premium(client, token)

    resp = await client.post(
        "/api/subscription/upgrade",
        json={"plan_name": "premium"},
        headers=headers,
    )
    assert resp.status_code == 400
    assert "already on" in resp.json()["detail"].lower()
