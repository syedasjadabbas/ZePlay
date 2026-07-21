import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.email_verification_token import EmailVerificationToken
from app.models.user import User

pytestmark = pytest.mark.asyncio

async def create_admin_and_regular_users(client: AsyncClient, db_session: AsyncSession):
    # Admin user
    await client.post(
        "/api/auth/register",
        json={"email": "admin_test@example.com", "name": "Admin Test", "password": "Password123!"}
    )
    res1 = await db_session.execute(select(EmailVerificationToken))
    for tr in res1.scalars().all():
        u = (await db_session.execute(select(User).filter(User.user_id == tr.user_id))).scalars().first()
        if u and u.email == "admin_test@example.com":
            await client.post("/api/auth/verify-email", json={"token": tr.token})
            u.is_admin = True
            await db_session.commit()
            break

    admin_login = await client.post("/api/auth/login", data={"username": "admin_test@example.com", "password": "Password123!"})
    admin_token = admin_login.json()["access_token"]

    # Regular user
    await client.post(
        "/api/auth/register",
        json={"email": "regular_test@example.com", "name": "Regular Test", "password": "Password123!"}
    )
    res2 = await db_session.execute(select(EmailVerificationToken))
    regular_user_id = None
    for tr in res2.scalars().all():
        u = (await db_session.execute(select(User).filter(User.user_id == tr.user_id))).scalars().first()
        if u and u.email == "regular_test@example.com":
            await client.post("/api/auth/verify-email", json={"token": tr.token})
            regular_user_id = u.user_id
            break

    return admin_token, regular_user_id

async def test_admin_user_management(client: AsyncClient, db_session: AsyncSession):
    admin_token, reg_user_id = await create_admin_and_regular_users(client, db_session)
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Get users list
    list_res = await client.get("/api/admin/users", headers=headers)
    assert list_res.status_code == 200
    users = list_res.json()
    assert any(u["email"] == "regular_test@example.com" for u in users)

    # 2. Promote regular user to admin
    promote_res = await client.put(f"/api/admin/users/{reg_user_id}/role", json={"is_admin": True}, headers=headers)
    assert promote_res.status_code == 200
    assert promote_res.json()["is_admin"] is True

    # Verify in DB
    reg_u = (await db_session.execute(select(User).filter(User.user_id == reg_user_id))).scalars().first()
    assert reg_u.is_admin is True

    # 3. Demote user back to regular
    demote_res = await client.put(f"/api/admin/users/{reg_user_id}/role", json={"is_admin": False}, headers=headers)
    assert demote_res.status_code == 200
    assert demote_res.json()["is_admin"] is False
