import re
import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.payment_transaction import PaymentTransaction
from app.models.subscription_plan import SubscriptionPlan
from app.models.user_subscription import UserSubscription
from app.schemas.payment import SimulatedPaymentRequest, PaymentTransactionResponse
from app.api import deps
from app.services.audit_log_service import log_event

router = APIRouter()


async def _get_plan_by_name(db: AsyncSession, name: str) -> SubscriptionPlan:
    result = await db.execute(
        select(SubscriptionPlan).filter(SubscriptionPlan.name == name.lower())
    )
    plan = result.scalars().first()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subscription plan '{name}' not found."
        )
    return plan


async def _get_or_create_subscription(db: AsyncSession, user: User) -> UserSubscription:
    result = await db.execute(
        select(UserSubscription).filter(UserSubscription.user_id == user.user_id)
    )
    sub = result.scalars().first()
    if sub:
        return sub

    free_plan = await _get_plan_by_name(db, "free")
    sub = UserSubscription(
        user_id=user.user_id,
        plan_id=free_plan.id,
        status="active",
        start_date=datetime.now(timezone.utc),
        auto_renew=True,
    )
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return sub


@router.post("/process", response_model=PaymentTransactionResponse)
async def process_simulated_payment(
    payment_in: SimulatedPaymentRequest,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Process simulated payment checkout for Premium subscription upgrades.
    Validates test card inputs, stores non-sensitive transaction records,
    and activates Premium entitlement upon authorization success.
    """
    if current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrator accounts already have full platform access."
        )

    # Idempotency / Duplicate-Payment Guard
    from app.services.cache_service import cache
    idempotency_key = f"lock:payment:{current_user.user_id}"
    is_locked = await cache.get(idempotency_key)
    if is_locked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payment transaction already in progress. Please wait a moment."
        )
    await cache.set(idempotency_key, "1", ttl=5)

    new_plan = await _get_plan_by_name(db, payment_in.plan_name.lower())
    sub = await _get_or_create_subscription(db, current_user)
    if sub.plan.name == new_plan.name and sub.status == "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You are already on the '{new_plan.name}' plan."
        )
    card_name = payment_in.cardholder_name.strip()
    if len(card_name) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cardholder name must be at least 2 characters long."
        )

    raw_card = payment_in.card_number.replace(" ", "").replace("-", "")
    if not raw_card.isdigit() or len(raw_card) < 13 or len(raw_card) > 19:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid card number format. Please enter a valid test card number."
        )

    cvv_clean = payment_in.cvv.strip()
    if not cvv_clean.isdigit() or len(cvv_clean) not in (3, 4):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="CVV must be 3 or 4 digits."
        )

    exp_clean = payment_in.expiry.strip()
    if not re.match(r"^(0[1-9]|1[0-2])\/([0-9]{2}|[0-9]{4})$", exp_clean):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Expiry date must be in MM/YY or MM/YYYY format."
        )

    last4 = raw_card[-4:]
    card_brand = "Mastercard" if raw_card.startswith("5") else ("Amex" if raw_card.startswith("3") else "Visa")

    # 2. Check for Simulated Payment Failure Card (e.g. ending in 0002 or 4002)
    is_failing_card = last4 in ("0002", "4002") or raw_card.endswith("0002")

    if is_failing_card:
        # Record failed transaction attempt
        failed_tx = PaymentTransaction(
            user_id=current_user.user_id,
            plan_name=payment_in.plan_name.lower(),
            amount=9.99,
            currency="USD",
            status="failed",
            card_brand=card_brand,
            last4=last4,
            created_at=datetime.now(timezone.utc),
        )
        db.add(failed_tx)
        await db.commit()
        await db.refresh(failed_tx)

        await log_event(
            db,
            action="payment_failure",
            details=f"Simulated payment failed for card ending in {last4}.",
            performed_by=current_user.user_id,
            metadata_dict={"last4": last4, "card_brand": card_brand}
        )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Simulated payment authorization failed for card ending in {last4}. Please try valid test card 4242 4242 4242 4242."
        )

    # 3. Successful Payment Execution & Premium Activation
    new_plan = await _get_plan_by_name(db, payment_in.plan_name.lower())
    sub = await _get_or_create_subscription(db, current_user)

    # Update subscription record
    sub.plan_id = new_plan.id
    sub.status = "active"
    sub.start_date = datetime.now(timezone.utc)
    sub.end_date = None
    sub.updated_at = datetime.now(timezone.utc)

    # Keep legacy column in sync
    current_user.subscription_plan = new_plan.name

    # Create payment transaction record
    tx = PaymentTransaction(
        user_id=current_user.user_id,
        plan_name=new_plan.name,
        amount=9.99,
        currency="USD",
        status="success",
        card_brand=card_brand,
        last4=last4,
        created_at=datetime.now(timezone.utc),
    )
    db.add(tx)

    await db.commit()
    await db.refresh(tx)

    await log_event(
        db,
        action="payment_success",
        details=f"Simulated payment of $9.99 approved for plan '{new_plan.name}' (Card ending {last4}).",
        performed_by=current_user.user_id,
        metadata_dict={"plan_name": new_plan.name, "last4": last4, "tx_id": str(tx.id)}
    )

    return PaymentTransactionResponse(
        id=tx.id,
        user_id=tx.user_id,
        user_email=current_user.email,
        plan_name=tx.plan_name,
        amount=tx.amount,
        currency=tx.currency,
        status=tx.status,
        card_brand=tx.card_brand,
        last4=tx.last4,
        created_at=tx.created_at
    )


@router.get("/admin/transactions", response_model=List[PaymentTransactionResponse])
async def list_payment_transactions(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_admin_user),
):
    """Admin endpoint to inspect recent payment transactions."""
    result = await db.execute(
        select(PaymentTransaction, User.email)
        .join(User, PaymentTransaction.user_id == User.user_id)
        .order_by(PaymentTransaction.created_at.desc())
        .limit(100)
    )
    rows = result.all()

    tx_list = []
    for tx, email in rows:
        tx_list.append(
            PaymentTransactionResponse(
                id=tx.id,
                user_id=tx.user_id,
                user_email=email,
                plan_name=tx.plan_name,
                amount=tx.amount,
                currency=tx.currency,
                status=tx.status,
                card_brand=tx.card_brand,
                last4=tx.last4,
                created_at=tx.created_at,
            )
        )
    return tx_list
