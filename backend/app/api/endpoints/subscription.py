import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.user import User
from app.models.profile import Profile
from app.models.subscription_plan import SubscriptionPlan
from app.models.user_subscription import UserSubscription
from app.schemas.subscription import (
    SubscriptionPlanResponse,
    UserSubscriptionResponse,
    UpgradeRequest,
    DowngradeRequest,
)
from app.api import deps
from app.services.audit_log_service import log_event

router = APIRouter()


# ---------------------------------------------------------------------------
# Helper: fetch the named plan or raise 404
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# Helper: get or create user subscription (safe for legacy users)
# ---------------------------------------------------------------------------
async def _get_or_create_subscription(db: AsyncSession, user: User) -> UserSubscription:
    """Return the user's active subscription. Creates a Free one if missing."""
    result = await db.execute(
        select(UserSubscription).filter(UserSubscription.user_id == user.user_id)
    )
    sub = result.scalars().first()
    if sub:
        return sub

    # Auto-create Free subscription for legacy users that predate Sprint 9
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


# ---------------------------------------------------------------------------
# GET /api/subscription/plans
# ---------------------------------------------------------------------------
@router.get("/plans", response_model=List[SubscriptionPlanResponse])
async def list_plans(db: AsyncSession = Depends(get_db)):
    """Return all available subscription plans."""
    result = await db.execute(select(SubscriptionPlan).order_by(SubscriptionPlan.name))
    return result.scalars().all()


# ---------------------------------------------------------------------------
# GET /api/subscription/current
# ---------------------------------------------------------------------------
@router.get("/current", response_model=UserSubscriptionResponse)
async def get_current_subscription(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the current user's active subscription with plan details."""
    if current_user.is_admin:
        premium_plan = await _get_plan_by_name(db, "premium")
        # Return a synthetic subscription object for admins with valid UUID fields
        admin_uuid = uuid.uuid5(uuid.NAMESPACE_DNS, f"admin-{current_user.user_id}")
        return UserSubscription(
            id=admin_uuid,
            user_id=current_user.user_id,
            plan_id=premium_plan.id,
            status="Administrator Account",
            start_date=current_user.created_at,
            end_date=None,
            auto_renew=True,
            created_at=current_user.created_at,
            updated_at=current_user.created_at,
            plan=premium_plan
        )
        
    sub = await _get_or_create_subscription(db, current_user)
    return sub


# ---------------------------------------------------------------------------
# POST /api/subscription/upgrade
# ---------------------------------------------------------------------------
@router.post("/upgrade", response_model=UserSubscriptionResponse)
async def upgrade_subscription(
    upgrade_in: UpgradeRequest = UpgradeRequest(),
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upgrade user's subscription to the specified plan (default: premium)."""
    if current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin accounts do not participate in subscriptions."
        )

    new_plan = await _get_plan_by_name(db, upgrade_in.plan_name)
    sub = await _get_or_create_subscription(db, current_user)

    if sub.plan.name == new_plan.name and sub.status == "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You are already on the '{new_plan.name}' plan."
        )

    sub.plan_id = new_plan.id
    sub.status = "active"
    sub.start_date = datetime.now(timezone.utc)
    sub.end_date = None
    sub.updated_at = datetime.now(timezone.utc)

    # Keep legacy column in sync
    current_user.subscription_plan = new_plan.name

    await db.commit()
    await db.refresh(sub)

    await log_event(
        db,
        action="subscription_upgrade",
        details=f"Subscription upgraded to '{new_plan.name}'.",
        performed_by=current_user.user_id,
        metadata_dict={"plan_name": new_plan.name}
    )
    return sub


# ---------------------------------------------------------------------------
# POST /api/subscription/downgrade
# ---------------------------------------------------------------------------
@router.post("/downgrade", response_model=UserSubscriptionResponse)
async def downgrade_subscription(
    downgrade_in: DowngradeRequest = DowngradeRequest(),
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Downgrade user's subscription (default: free). Validates profile count."""
    if current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin accounts do not participate in subscriptions."
        )

    new_plan = await _get_plan_by_name(db, downgrade_in.plan_name)

    # Count existing profiles
    count_result = await db.execute(
        select(func.count(Profile.profile_id)).filter(
            Profile.user_id == current_user.user_id
        )
    )
    profile_count = count_result.scalar() or 0

    if profile_count > new_plan.max_profiles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot downgrade to '{new_plan.name}': you have {profile_count} profile(s) "
                f"but the plan allows a maximum of {new_plan.max_profiles}. "
                f"Please delete {profile_count - new_plan.max_profiles} profile(s) first."
            )
        )

    sub = await _get_or_create_subscription(db, current_user)

    if sub.plan.name == new_plan.name and sub.status == "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"You are already on the '{new_plan.name}' plan."
        )

    sub.plan_id = new_plan.id
    sub.status = "active"
    sub.start_date = datetime.now(timezone.utc)
    sub.end_date = None
    sub.updated_at = datetime.now(timezone.utc)

    # Keep legacy column in sync
    current_user.subscription_plan = new_plan.name

    await db.commit()
    await db.refresh(sub)

    await log_event(
        db,
        action="subscription_downgrade",
        details=f"Subscription downgraded to '{new_plan.name}'.",
        performed_by=current_user.user_id,
        metadata_dict={"plan_name": new_plan.name}
    )
    return sub


# ---------------------------------------------------------------------------
# POST /api/subscription/cancel
# ---------------------------------------------------------------------------
@router.post("/cancel", response_model=UserSubscriptionResponse)
async def cancel_subscription(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel the current user's subscription (sets status to 'cancelled')."""
    if current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin accounts do not participate in subscriptions."
        )

    sub = await _get_or_create_subscription(db, current_user)

    if sub.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your subscription is already cancelled."
        )

    sub.status = "cancelled"
    sub.auto_renew = False
    sub.end_date = datetime.now(timezone.utc)
    sub.updated_at = datetime.now(timezone.utc)

    # Keep legacy column in sync
    current_user.subscription_plan = "free"

    await db.commit()
    await db.refresh(sub)

    await log_event(
        db,
        action="subscription_cancel",
        details="Subscription cancelled.",
        performed_by=current_user.user_id,
        metadata_dict={}
    )
    return sub
