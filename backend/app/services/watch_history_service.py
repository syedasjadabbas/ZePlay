from uuid import UUID
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import joinedload
from app.models.watch_history import WatchHistory
from app.models.profile import Profile
from app.models.movie import Movie
from app.models.video import Video
from app.schemas.watch_history import ProgressUpdate
from app.services.cache_service import cache

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
    Saves or updates video playback progress for a profile.
    Automatically calculates percentage_watched and updates last_watched timestamp.
    """
    if not await verify_profile_ownership(db, user_id, progress_in.profile_id):
        raise ValueError("Profile does not belong to the current user.")

    # Check movie exists
    movie_res = await db.execute(select(Movie).filter(Movie.movie_id == progress_in.movie_id))
    if not movie_res.scalars().first():
        raise ValueError("Movie not found.")

    # Check optional video record
    if progress_in.video_id:
        video_res = await db.execute(select(Video).filter(Video.video_id == progress_in.video_id))
        if not video_res.scalars().first():
            raise ValueError("Video record not found.")

    now_utc = datetime.now(timezone.utc)
    percentage = (progress_in.current_position / progress_in.duration * 100.0) if progress_in.duration > 0 else 0.0

    # Query existing history record
    query_existing = select(WatchHistory).filter(
        WatchHistory.profile_id == progress_in.profile_id,
        WatchHistory.movie_id == progress_in.movie_id
    )
    res_existing = await db.execute(query_existing)
    history_record = res_existing.scalars().first()

    if history_record:
        history_record.current_position = progress_in.current_position
        history_record.duration = progress_in.duration
        history_record.percentage_watched = round(percentage, 2)
        history_record.last_watched = now_utc
        if progress_in.video_id:
            history_record.video_id = progress_in.video_id
    else:
        history_record = WatchHistory(
            user_id=user_id,
            profile_id=progress_in.profile_id,
            movie_id=progress_in.movie_id,
            video_id=progress_in.video_id,
            current_position=progress_in.current_position,
            duration=progress_in.duration,
            percentage_watched=round(percentage, 2),
            last_watched=now_utc
        )
        db.add(history_record)

    await db.commit()
    
    # Invalidate recommendation cache for profile
    await cache.invalidate_pattern(f"rec:personalized:{progress_in.profile_id}:*")
    await cache.invalidate_pattern(f"rec:because_you_watched:{progress_in.profile_id}:*")

    # Reload with relationships
    query = (
        select(WatchHistory)
        .options(joinedload(WatchHistory.movie), joinedload(WatchHistory.video))
        .filter(WatchHistory.history_id == history_record.history_id)
    )
    res = await db.execute(query)
    return res.scalars().unique().first()

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
        .options(joinedload(WatchHistory.movie), joinedload(WatchHistory.video))
        .filter(
            WatchHistory.profile_id == profile_id,
            WatchHistory.percentage_watched >= 0.5,
            WatchHistory.percentage_watched < 95.0
        )
        .order_by(WatchHistory.last_watched.desc())
        .limit(limit)
    )
    result = await db.execute(query)
    return list(result.scalars().unique().all())

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
        .options(joinedload(WatchHistory.movie), joinedload(WatchHistory.video))
        .filter(
            WatchHistory.profile_id == profile_id,
            WatchHistory.movie_id == movie_id
        )
    )
    result = await db.execute(query)
    return result.scalars().unique().first()

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
        .options(joinedload(WatchHistory.movie), joinedload(WatchHistory.video))
        .filter(WatchHistory.profile_id == profile_id)
        .order_by(WatchHistory.last_watched.desc())
    )
    result = await db.execute(query)
    return list(result.scalars().unique().all())

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
