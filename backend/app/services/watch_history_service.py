from uuid import UUID
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from app.models.watch_history import WatchHistory
from app.models.profile import Profile
from app.models.movie import Movie
from app.models.video import Video
from app.schemas.watch_history import ProgressUpdate

async def verify_profile_ownership(db: AsyncSession, user_id: UUID, profile_id: UUID) -> bool:
    """Verifies that the given profile belongs to the authenticated user."""
    result = await db.execute(
        select(Profile).filter(Profile.profile_id == profile_id, Profile.user_id == user_id)
    )
    return result.scalars().first() is not None

async def upsert_playback_progress(
    db: AsyncSession,
    user_id: UUID,
    progress_in: ProgressUpdate
) -> WatchHistory:
    """
    Saves or updates playback progress position for a profile and movie asset.
    Calculates percentage_watched and updates last_watched timestamp.
    """
    # Verify profile ownership
    if not await verify_profile_ownership(db, user_id, progress_in.profile_id):
        raise ValueError("Profile does not belong to the current user.")

    # Calculate percentage
    duration = max(progress_in.duration, 1.0)
    percentage = min(max((progress_in.current_position / duration) * 100.0, 0.0), 100.0)

    # Check for existing watch history record
    result = await db.execute(
        select(WatchHistory).filter(
            WatchHistory.profile_id == progress_in.profile_id,
            WatchHistory.movie_id == progress_in.movie_id
        )
    )
    existing = result.scalars().first()

    now_utc = datetime.now(timezone.utc)

    if existing:
        existing.current_position = progress_in.current_position
        existing.duration = duration
        existing.percentage_watched = percentage
        existing.last_watched = now_utc
        if progress_in.video_id:
            existing.video_id = progress_in.video_id
        history_record = existing
    else:
        history_record = WatchHistory(
            user_id=user_id,
            profile_id=progress_in.profile_id,
            movie_id=progress_in.movie_id,
            video_id=progress_in.video_id,
            current_position=progress_in.current_position,
            duration=duration,
            percentage_watched=percentage,
            last_watched=now_utc,
            created_at=now_utc
        )
        db.add(history_record)

    await db.commit()
    
    # Reload with relationships
    query = (
        select(WatchHistory)
        .options(selectinload(WatchHistory.movie), selectinload(WatchHistory.video))
        .filter(WatchHistory.history_id == history_record.history_id)
    )
    res = await db.execute(query)
    return res.scalars().first()

async def get_continue_watching_list(
    db: AsyncSession,
    user_id: UUID,
    profile_id: UUID,
    limit: int = 10
) -> List[WatchHistory]:
    """
    Retrieves in-progress media items for a profile (e.g., between 0.5% and 95% completed),
    sorted by last_watched DESC.
    """
    if not await verify_profile_ownership(db, user_id, profile_id):
        raise ValueError("Profile does not belong to the current user.")

    query = (
        select(WatchHistory)
        .options(selectinload(WatchHistory.movie), selectinload(WatchHistory.video))
        .filter(
            WatchHistory.profile_id == profile_id,
            WatchHistory.percentage_watched >= 0.5,
            WatchHistory.percentage_watched < 95.0
        )
        .order_by(WatchHistory.last_watched.desc())
        .limit(limit)
    )
    result = await db.execute(query)
    return result.scalars().all()

async def get_item_progress(
    db: AsyncSession,
    user_id: UUID,
    profile_id: UUID,
    movie_id: UUID
) -> Optional[WatchHistory]:
    """Retrieves saved progress record for a specific profile and movie."""
    if not await verify_profile_ownership(db, user_id, profile_id):
        raise ValueError("Profile does not belong to the current user.")

    query = (
        select(WatchHistory)
        .options(selectinload(WatchHistory.movie), selectinload(WatchHistory.video))
        .filter(
            WatchHistory.profile_id == profile_id,
            WatchHistory.movie_id == movie_id
        )
    )
    result = await db.execute(query)
    return result.scalars().first()

async def get_full_watch_history(
    db: AsyncSession,
    user_id: UUID,
    profile_id: UUID
) -> List[WatchHistory]:
    """Retrieves complete timeline of watch history for a profile."""
    if not await verify_profile_ownership(db, user_id, profile_id):
        raise ValueError("Profile does not belong to the current user.")

    query = (
        select(WatchHistory)
        .options(selectinload(WatchHistory.movie), selectinload(WatchHistory.video))
        .filter(WatchHistory.profile_id == profile_id)
        .order_by(WatchHistory.last_watched.desc())
    )
    result = await db.execute(query)
    return result.scalars().all()

async def delete_watch_history_item(
    db: AsyncSession,
    user_id: UUID,
    history_id: UUID
) -> bool:
    """Deletes an item from watch history ensuring user ownership."""
    result = await db.execute(
        select(WatchHistory).filter(
            WatchHistory.history_id == history_id,
            WatchHistory.user_id == user_id
        )
    )
    item = result.scalars().first()
    if not item:
        return False

    await db.delete(item)
    await db.commit()
    return True
