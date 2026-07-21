from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.user import User
from app.models.profile import Profile
from app.schemas.profile import ProfileCreate, ProfileResponse, ProfileUpdate
from app.api import deps

router = APIRouter()

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
    """Create a new profile. Max 4 profiles per account limit enforced."""
    # Count profiles
    count_result = await db.execute(
        select(func.count(Profile.profile_id)).filter(Profile.user_id == current_user.user_id)
    )
    count = count_result.scalar() or 0
    if count >= 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum profile limit of 4 reached for this account."
        )
    
    db_profile = Profile(
        user_id=current_user.user_id,
        display_name=profile_in.display_name,
        avatar_url=profile_in.avatar_url,
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
    
    await db.delete(profile)
    await db.commit()
    return None
