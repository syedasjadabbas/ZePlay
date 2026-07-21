from datetime import datetime, timezone
from typing import List, Optional, Dict, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from sqlalchemy.orm import selectinload
from app.models.movie import Movie
from app.models.genre import Genre
from app.models.movie_stats import MovieStats
from app.models.watch_history import WatchHistory

async def track_movie_view(db: AsyncSession, movie_id: UUID) -> MovieStats:
    """Increment view count and recalculate popularity score for a movie."""
    res = await db.execute(select(MovieStats).filter(MovieStats.movie_id == movie_id))
    stats = res.scalars().first()

    now = datetime.now(timezone.utc)
    if not stats:
        stats = MovieStats(
            movie_id=movie_id,
            view_count=1,
            watch_count=0,
            popularity_score=1.5,
            last_viewed_at=now,
            updated_at=now
        )
        db.add(stats)
    else:
        stats.view_count += 1
        stats.popularity_score = (stats.view_count * 1.5) + (stats.watch_count * 2.5)
        stats.last_viewed_at = now
        stats.updated_at = now

    await db.commit()
    await db.refresh(stats)
    return stats

async def increment_watch_count(db: AsyncSession, movie_id: UUID) -> None:
    """Increment watch count when user streams a movie."""
    res = await db.execute(select(MovieStats).filter(MovieStats.movie_id == movie_id))
    stats = res.scalars().first()
    now = datetime.now(timezone.utc)
    if not stats:
        stats = MovieStats(
            movie_id=movie_id,
            view_count=1,
            watch_count=1,
            popularity_score=4.0,
            last_viewed_at=now,
            updated_at=now
        )
        db.add(stats)
    else:
        stats.watch_count += 1
        stats.popularity_score = (stats.view_count * 1.5) + (stats.watch_count * 2.5)
        stats.updated_at = now
    await db.commit()

async def get_trending_movies(db: AsyncSession, limit: int = 10) -> List[Movie]:
    """Retrieve trending movies sorted by popularity score and creation recency."""
    query = (
        select(Movie)
        .options(selectinload(Movie.genres))
        .outerjoin(MovieStats, Movie.movie_id == MovieStats.movie_id)
        .order_by(
            desc(func.coalesce(MovieStats.popularity_score, 0.0)),
            desc(Movie.created_at)
        )
        .limit(limit)
    )
    res = await db.execute(query)
    return list(res.scalars().unique().all())

async def get_popular_movies(db: AsyncSession, limit: int = 10) -> List[Movie]:
    """Retrieve popular movies sorted by total view counts."""
    query = (
        select(Movie)
        .options(selectinload(Movie.genres))
        .outerjoin(MovieStats, Movie.movie_id == MovieStats.movie_id)
        .order_by(
            desc(func.coalesce(MovieStats.view_count, 0)),
            desc(func.coalesce(MovieStats.popularity_score, 0.0)),
            desc(Movie.release_year)
        )
        .limit(limit)
    )
    res = await db.execute(query)
    return list(res.scalars().unique().all())

async def get_recently_added_movies(db: AsyncSession, limit: int = 10) -> List[Movie]:
    """Retrieve newest releases and catalog additions."""
    query = (
        select(Movie)
        .options(selectinload(Movie.genres))
        .order_by(desc(Movie.created_at), desc(Movie.release_year))
        .limit(limit)
    )
    res = await db.execute(query)
    return list(res.scalars().unique().all())

async def get_personalized_recommendations(
    db: AsyncSession,
    user_id: UUID,
    profile_id: UUID,
    limit: int = 10
) -> List[Movie]:
    """
    Rule-based personalized recommendations based on active profile's genre preferences.
    """
    # 1. Fetch profile watch history
    wh_query = (
        select(WatchHistory)
        .options(selectinload(WatchHistory.movie).selectinload(Movie.genres))
        .filter(WatchHistory.user_id == user_id, WatchHistory.profile_id == profile_id)
    )
    wh_res = await db.execute(wh_query)
    history_items = list(wh_res.scalars().all())

    watched_movie_ids = {h.movie_id for h in history_items}

    # Extract genre counts
    genre_counts: Dict[UUID, int] = {}
    for item in history_items:
        if item.movie and item.movie.genres:
            for g in item.movie.genres:
                genre_counts[g.genre_id] = genre_counts.get(g.genre_id, 0) + 1

    # Fallback to popular if no watch history
    if not genre_counts:
        return await get_popular_movies(db, limit=limit)

    # Top genre IDs
    top_genre_ids = [g_id for g_id, _ in sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)[:3]]

    # 2. Select movies matching top genres
    rec_query = (
        select(Movie)
        .options(selectinload(Movie.genres))
        .join(Movie.genres)
        .outerjoin(MovieStats, Movie.movie_id == MovieStats.movie_id)
        .filter(Genre.genre_id.in_(top_genre_ids))
    )
    if watched_movie_ids:
        rec_query = rec_query.filter(Movie.movie_id.not_in(watched_movie_ids))

    rec_query = (
        rec_query.order_by(
            desc(func.coalesce(MovieStats.popularity_score, 0.0)),
            desc(Movie.release_year)
        )
        .limit(limit)
    )
    res = await db.execute(rec_query)
    recommendations = list(res.scalars().unique().all())

    # Fill remaining count with popular movies if recommendations list is small
    if len(recommendations) < limit:
        already_included = {m.movie_id for m in recommendations} | watched_movie_ids
        fill_query = (
            select(Movie)
            .options(selectinload(Movie.genres))
            .outerjoin(MovieStats, Movie.movie_id == MovieStats.movie_id)
        )
        if already_included:
            fill_query = fill_query.filter(Movie.movie_id.not_in(already_included))

        fill_query = fill_query.order_by(
            desc(func.coalesce(MovieStats.view_count, 0)),
            desc(Movie.release_year)
        ).limit(limit - len(recommendations))

        fill_res = await db.execute(fill_query)
        fill_movies = list(fill_res.scalars().unique().all())
        recommendations.extend(fill_movies)

    return recommendations[:limit]

async def get_because_you_watched(
    db: AsyncSession,
    user_id: UUID,
    profile_id: UUID,
    limit: int = 10
) -> Tuple[Optional[Movie], List[Movie]]:
    """
    Returns (because_movie, recommendations) based on profile's most recently watched movie.
    """
    # Find most recently watched movie
    last_wh_query = (
        select(WatchHistory)
        .options(selectinload(WatchHistory.movie).selectinload(Movie.genres))
        .filter(WatchHistory.user_id == user_id, WatchHistory.profile_id == profile_id)
        .order_by(desc(WatchHistory.last_watched))
        .limit(1)
    )
    last_wh_res = await db.execute(last_wh_query)
    last_wh = last_wh_res.scalars().first()

    if not last_wh or not last_wh.movie:
        return None, []

    because_movie = last_wh.movie
    genre_ids = [g.genre_id for g in because_movie.genres]

    if not genre_ids:
        return because_movie, []

    rec_query = (
        select(Movie)
        .options(selectinload(Movie.genres))
        .join(Movie.genres)
        .outerjoin(MovieStats, Movie.movie_id == MovieStats.movie_id)
        .filter(Genre.genre_id.in_(genre_ids), Movie.movie_id != because_movie.movie_id)
        .order_by(
            desc(func.coalesce(MovieStats.popularity_score, 0.0)),
            desc(Movie.release_year)
        )
        .limit(limit)
    )
    res = await db.execute(rec_query)
    recommendations = list(res.scalars().unique().all())

    return because_movie, recommendations

async def get_similar_movies(
    db: AsyncSession,
    movie_id: UUID,
    limit: int = 10
) -> List[Movie]:
    """Find similar movies sharing genres and release proximity."""
    movie_res = await db.execute(
        select(Movie).options(selectinload(Movie.genres)).filter(Movie.movie_id == movie_id)
    )
    target_movie = movie_res.scalars().first()

    if not target_movie or not target_movie.genres:
        return []

    genre_ids = [g.genre_id for g in target_movie.genres]

    query = (
        select(Movie)
        .options(selectinload(Movie.genres))
        .join(Movie.genres)
        .outerjoin(MovieStats, Movie.movie_id == MovieStats.movie_id)
        .filter(Genre.genre_id.in_(genre_ids), Movie.movie_id != movie_id)
        .order_by(
            desc(func.coalesce(MovieStats.popularity_score, 0.0)),
            desc(Movie.release_year)
        )
        .limit(limit)
    )
    res = await db.execute(query)
    return list(res.scalars().unique().all())
