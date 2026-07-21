from uuid import UUID
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from app.models.watchlist import Watchlist
from app.models.profile import Profile
from app.models.movie import Movie
from app.schemas.watchlist import WatchlistAdd

async def verify_profile_ownership(db: AsyncSession, user_id: UUID, profile_id: UUID) -> bool:
    """Verifies that the given profile belongs to the authenticated user."""
    result = await db.execute(
        select(Profile).filter(Profile.profile_id == profile_id, Profile.user_id == user_id)
    )
    return result.scalars().first() is not None

async def add_to_watchlist(
    db: AsyncSession,
    user_id: UUID,
    watchlist_in: WatchlistAdd
) -> Watchlist:
    """
    Adds a movie to profile's watchlist.
    If already exists, returns the existing record.
    """
    if not await verify_profile_ownership(db, user_id, watchlist_in.profile_id):
        raise ValueError("Profile does not belong to the current user.")

    # Check movie exists
    movie_res = await db.execute(select(Movie).filter(Movie.movie_id == watchlist_in.movie_id))
    if not movie_res.scalars().first():
        raise ValueError("Movie not found.")

    # Check existing watchlist entry
    existing_res = await db.execute(
        select(Watchlist).filter(
            Watchlist.profile_id == watchlist_in.profile_id,
            Watchlist.movie_id == watchlist_in.movie_id
        )
    )
    existing = existing_res.scalars().first()
    if existing:
        # Reload with movie relationship
        query = (
            select(Watchlist)
            .options(selectinload(Watchlist.movie).selectinload(Movie.genres))
            .filter(Watchlist.watchlist_id == existing.watchlist_id)
        )
        res = await db.execute(query)
        return res.scalars().first()

    now_utc = datetime.now(timezone.utc)
    item = Watchlist(
        user_id=user_id,
        profile_id=watchlist_in.profile_id,
        movie_id=watchlist_in.movie_id,
        created_at=now_utc
    )
    db.add(item)
    await db.commit()

    query = (
        select(Watchlist)
        .options(selectinload(Watchlist.movie).selectinload(Movie.genres))
        .filter(Watchlist.watchlist_id == item.watchlist_id)
    )
    res = await db.execute(query)
    return res.scalars().first()

async def remove_from_watchlist(
    db: AsyncSession,
    user_id: UUID,
    profile_id: UUID,
    movie_id: UUID
) -> bool:
    """Removes a movie from profile's watchlist."""
    if not await verify_profile_ownership(db, user_id, profile_id):
        raise ValueError("Profile does not belong to the current user.")

    result = await db.execute(
        select(Watchlist).filter(
            Watchlist.profile_id == profile_id,
            Watchlist.movie_id == movie_id,
            Watchlist.user_id == user_id
        )
    )
    item = result.scalars().first()
    if not item:
        return False

    await db.delete(item)
    await db.commit()
    return True

async def get_profile_watchlist(
    db: AsyncSession,
    user_id: UUID,
    profile_id: UUID
) -> List[Watchlist]:
    """Retrieves all saved watchlist movies for a profile ordered by created_at DESC."""
    if not await verify_profile_ownership(db, user_id, profile_id):
        raise ValueError("Profile does not belong to the current user.")

    query = (
        select(Watchlist)
        .options(selectinload(Watchlist.movie).selectinload(Movie.genres))
        .filter(Watchlist.profile_id == profile_id)
        .order_by(Watchlist.created_at.desc())
    )
    result = await db.execute(query)
    return result.scalars().all()

async def check_in_watchlist(
    db: AsyncSession,
    user_id: UUID,
    profile_id: UUID,
    movie_id: UUID
) -> dict:
    """Checks whether a movie is saved in profile's watchlist."""
    if not await verify_profile_ownership(db, user_id, profile_id):
        raise ValueError("Profile does not belong to the current user.")

    result = await db.execute(
        select(Watchlist).filter(
            Watchlist.profile_id == profile_id,
            Watchlist.movie_id == movie_id
        )
    )
    item = result.scalars().first()
    if item:
        return {"is_in_watchlist": True, "watchlist_id": item.watchlist_id}
    return {"is_in_watchlist": False, "watchlist_id": None}
