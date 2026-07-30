import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_verification_token import EmailVerificationToken
from app.models.user import User
from app.models.payment_transaction import PaymentTransaction

pytestmark = pytest.mark.asyncio


async def create_user_and_get_token(client: AsyncClient, db_session: AsyncSession, email: str, is_admin: bool = False) -> str:
    await client.post(
        "/api/auth/register",
        json={"email": email, "name": "Test Payment User", "password": "Password123!"}
    )
    user_res = await db_session.execute(select(User).filter(User.email == email))
    user = user_res.scalars().first()
    if user and is_admin:
        user.is_admin = True
        await db_session.commit()

    res = await db_session.execute(select(EmailVerificationToken))
    tokens = res.scalars().all()
    token = tokens[-1].token if tokens else ""

    await client.post("/api/auth/verify-email", json={"token": token})
    login_res = await client.post("/api/auth/login", data={"username": email, "password": "Password123!"})
    return login_res.json()["access_token"]


async def test_simulated_payment_success_flow(client: AsyncClient, db_session: AsyncSession):
    token = await create_user_and_get_token(client, db_session, "pay_success@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Check initial subscription (Free)
    sub1 = await client.get("/api/subscription/current", headers=headers)
    assert sub1.status_code == 200
    assert sub1.json()["plan"]["name"] == "free"

    # 2. Submit valid simulated payment checkout
    pay_res = await client.post(
        "/api/payment/process",
        json={
            "cardholder_name": "Syed Asjad Abbas",
            "card_number": "4242 4242 4242 4242",
            "expiry": "12/28",
            "cvv": "123",
            "plan_name": "premium"
        },
        headers=headers
    )
    assert pay_res.status_code == 200
    data = pay_res.json()
    assert data["status"] == "success"
    assert data["card_brand"] == "Visa"
    assert data["last4"] == "4242"
    assert data["amount"] == 9.99

    # 3. Check subscription status after payment
    sub2 = await client.get("/api/subscription/current", headers=headers)
    assert sub2.status_code == 200
    assert sub2.json()["plan"]["name"] == "premium"

    # 4. Confirm transaction record stored in DB without sensitive credentials
    tx_res = await db_session.execute(select(PaymentTransaction).filter(PaymentTransaction.user_id == data["user_id"]))
    tx_list = tx_res.scalars().all()
    assert len(tx_list) == 1
    tx = tx_list[0]
    assert tx.status == "success"
    assert tx.last4 == "4242"
    assert tx.card_brand == "Visa"


async def test_simulated_payment_failure_flow(client: AsyncClient, db_session: AsyncSession):
    token = await create_user_and_get_token(client, db_session, "pay_failed@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Submit failing test card payment (ending in 0002)
    pay_res = await client.post(
        "/api/payment/process",
        json={
            "cardholder_name": "Syed Asjad Abbas",
            "card_number": "4000 0000 0000 0002",
            "expiry": "12/28",
            "cvv": "999",
            "plan_name": "premium"
        },
        headers=headers
    )
    assert pay_res.status_code == 400
    assert "Simulated payment authorization failed" in pay_res.json()["detail"]

    # 2. Confirm account remains on Free plan
    sub = await client.get("/api/subscription/current", headers=headers)
    assert sub.status_code == 200
    assert sub.json()["plan"]["name"] == "free"

    # 3. Confirm failed transaction recorded for audit log
    tx_res = await db_session.execute(select(PaymentTransaction).filter(PaymentTransaction.status == "failed"))
    tx_list = tx_res.scalars().all()
    assert len(tx_list) >= 1
    failed_tx = tx_list[-1]
    assert failed_tx.last4 == "0002"
    assert failed_tx.status == "failed"


async def test_admin_payment_transactions_view(client: AsyncClient, db_session: AsyncSession):
    token = await create_user_and_get_token(client, db_session, "admin_pay_inspector@example.com", is_admin=True)
    headers = {"Authorization": f"Bearer {token}"}

    res = await client.get("/api/payment/admin/transactions", headers=headers)
    assert res.status_code == 200
    txs = res.json()
    assert isinstance(txs, list)


async def test_duplicate_payment_protection(client: AsyncClient, db_session: AsyncSession):
    token = await create_user_and_get_token(client, db_session, "pay_dup@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "cardholder_name": "Syed Asjad Abbas",
        "card_number": "4242 4242 4242 4242",
        "expiry": "12/28",
        "cvv": "123",
        "plan_name": "premium"
    }

    res1 = await client.post("/api/payment/process", json=payload, headers=headers)
    assert res1.status_code == 200

    res2 = await client.post("/api/payment/process", json=payload, headers=headers)
    assert res2.status_code in (400, 409)
