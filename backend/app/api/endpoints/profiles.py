from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from app.database import get_db
from app.models.user import User
from app.models.profile import Profile
from app.models.watch_history import WatchHistory
from app.models.watchlist import Watchlist
from app.models.user_subscription import UserSubscription
from app.models.subscription_plan import SubscriptionPlan
from app.schemas.profile import ProfileCreate, ProfileResponse, ProfileUpdate
from app.api import deps

router = APIRouter()


async def _get_profile_limit(db: AsyncSession, user: User) -> int:
    """Return the maximum number of profiles allowed for the user's active plan."""
    sub_result = await db.execute(
        select(UserSubscription).filter(
            UserSubscription.user_id == str(user.user_id),
            UserSubscription.status == "active"
        )
    )
    sub = sub_result.scalars().first()
    if sub and sub.plan:
        return sub.plan.max_profiles
    # Fallback to legacy field if active subscription model is missing or cancelled
    if user.subscription_plan == "premium":
        return 4
    return 1


@router.get("/", response_model=List[ProfileResponse])
async def get_profiles(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve all profiles for the current user account."""
    result = await db.execute(
        select(Profile).filter(Profile.user_id == current_user.user_id)
    )
    return result.scalars().all()

@router.post("/", response_model=ProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_profile(
    profile_in: ProfileCreate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new profile. Limit enforced based on user's active subscription plan."""
    # Count existing profiles
    count_result = await db.execute(
        select(func.count(Profile.profile_id)).filter(Profile.user_id == current_user.user_id)
    )
    count = count_result.scalar() or 0

    max_profiles = await _get_profile_limit(db, current_user)

    if count >= max_profiles:
        if max_profiles <= 1:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Upgrade to Premium to create additional profiles."
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum profile limit of {max_profiles} reached for this account."
        )

    db_profile = Profile(
        user_id=current_user.user_id,
        display_name=profile_in.display_name,
        avatar_url=profile_in.avatar_url or "🍿",
        is_kids_profile=profile_in.is_kids_profile or False,
        language_pref=profile_in.language_pref or "en"
    )
    db.add(db_profile)
    await db.commit()
    await db.refresh(db_profile)
    return db_profile


@router.put("/{profile_id}", response_model=ProfileResponse)
async def update_profile(
    profile_id: UUID,
    profile_in: ProfileUpdate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update profile metadata (e.g., display name, kids restriction)."""
    # Fetch profile and verify ownership
    result = await db.execute(
        select(Profile).filter(
            Profile.profile_id == profile_id,
            Profile.user_id == current_user.user_id
        )
    )
    profile = result.scalars().first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found or access denied."
        )
    
    # Apply updates
    update_data = profile_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)
    
    await db.commit()
    await db.refresh(profile)
    return profile

@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile(
    profile_id: UUID,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a profile from the account."""
    # Fetch profile and verify ownership first
    result = await db.execute(
        select(Profile).filter(
            Profile.profile_id == profile_id,
            Profile.user_id == current_user.user_id
        )
    )
    profile = result.scalars().first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found or access denied."
        )

    # Check profile count for this account
    count_result = await db.execute(
        select(func.count(Profile.profile_id)).filter(Profile.user_id == current_user.user_id)
    )
    count = count_result.scalar() or 0
    if count <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the last remaining profile on your account."
        )

    # Clean up dependent records explicitly
    await db.execute(delete(WatchHistory).filter(WatchHistory.profile_id == profile_id))
    await db.execute(delete(Watchlist).filter(Watchlist.profile_id == profile_id))

    await db.delete(profile)
    await db.commit()
    return None

