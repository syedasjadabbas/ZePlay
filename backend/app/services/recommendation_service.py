from datetime import datetime, timezone
from typing import List, Optional, Dict, Tuple, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from sqlalchemy.orm import selectinload, joinedload
from app.models.movie import Movie
from app.models.genre import Genre
from app.models.movie_stats import MovieStats
from app.models.watch_history import WatchHistory
from app.models.rating import Rating
from app.services.cache_service import cache

async def populate_average_ratings(db: AsyncSession, movies: List[Movie]) -> None:
    if not movies:
        return
    movie_ids = [m.movie_id for m in movies if m is not None]
    if not movie_ids:
        return
    avg_res = await db.execute(
        select(Rating.movie_id, func.avg(Rating.score))
        .filter(Rating.movie_id.in_(movie_ids))
        .group_by(Rating.movie_id)
    )
    avg_map = {row[0]: round(float(row[1] or 0.0), 1) for row in avg_res.all()}
    for m in movies:
        if m is not None:
            m.average_rating = avg_map.get(m.movie_id, 0.0)

def serialize_movie(movie: Movie) -> dict:
    if movie is None:
        return {}
    return {
        "movie_id": str(movie.movie_id),
        "title": movie.title,
        "description": movie.description,
        "release_year": movie.release_year,
        "duration_minutes": movie.duration_minutes,
        "thumbnail_url": movie.thumbnail_url,
        "video_url": movie.video_url,
        "average_rating": getattr(movie, "average_rating", 0.0),
        "is_generated": bool(movie.is_generated),
        "created_at": movie.created_at.isoformat() if movie.created_at else None,
        "updated_at": movie.updated_at.isoformat() if movie.updated_at else None,
        "genres": [{"genre_id": str(g.genre_id), "name": g.name} for g in (movie.genres or [])]
    }

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

async def get_trending_movies(db: Optional[AsyncSession] = None, limit: int = 10, as_response: bool = True, include_synthetic: bool = False) -> Any:
    """Retrieve trending movies sorted by popularity score and creation recency (Cache First)."""
    from fastapi.responses import Response
    import json

    cache_key = f"rec:trending:{limit}:{include_synthetic}"
    cached_raw = await cache.get_raw(cache_key)
    if cached_raw is not None:
        if as_response:
            return Response(content=cached_raw, media_type="application/json")
        return json.loads(cached_raw)

    from app.database import SessionLocal

    async def _fetch(session: AsyncSession):
        query = (
            select(Movie)
            .options(joinedload(Movie.genres))
            .outerjoin(MovieStats, Movie.movie_id == MovieStats.movie_id)
        )
        if not include_synthetic:
            query = query.filter(Movie.is_generated == False)

        query = (
            query.order_by(
                desc(func.coalesce(MovieStats.popularity_score, 0.0)),
                desc(Movie.created_at)
            )
            .limit(limit)
        )
        res = await session.execute(query)
        movies = list(res.scalars().unique().all())
        await populate_average_ratings(session, movies)

        serialized = [serialize_movie(m) for m in movies]
        json_str = json.dumps(serialized)
        await cache.set_raw(cache_key, json_str, ttl=180)
        if as_response:
            return Response(content=json_str, media_type="application/json")
        return serialized

    if db is not None:
        return await _fetch(db)
    else:
        async with SessionLocal() as session:
            return await _fetch(session)

async def get_popular_movies(db: Optional[AsyncSession] = None, limit: int = 10, as_response: bool = True, include_synthetic: bool = False) -> Any:
    """Retrieve popular movies sorted by total view counts (Cache First)."""
    from fastapi.responses import Response
    import json

    cache_key = f"rec:popular:{limit}:{include_synthetic}"
    cached_raw = await cache.get_raw(cache_key)
    if cached_raw is not None:
        if as_response:
            return Response(content=cached_raw, media_type="application/json")
        return json.loads(cached_raw)

    from app.database import SessionLocal

    async def _fetch(session: AsyncSession):
        query = (
            select(Movie)
            .options(joinedload(Movie.genres))
            .outerjoin(MovieStats, Movie.movie_id == MovieStats.movie_id)
        )
        if not include_synthetic:
            query = query.filter(Movie.is_generated == False)

        query = (
            query.order_by(
                desc(func.coalesce(MovieStats.view_count, 0)),
                desc(func.coalesce(MovieStats.popularity_score, 0.0)),
                desc(Movie.release_year)
            )
            .limit(limit)
        )
        res = await session.execute(query)
        movies = list(res.scalars().unique().all())
        await populate_average_ratings(session, movies)

        serialized = [serialize_movie(m) for m in movies]
        json_str = json.dumps(serialized)
        await cache.set_raw(cache_key, json_str, ttl=180)
        if as_response:
            return Response(content=json_str, media_type="application/json")
        return serialized

    if db is not None:
        return await _fetch(db)
    else:
        async with SessionLocal() as session:
            return await _fetch(session)

async def get_recently_added_movies(db: Optional[AsyncSession] = None, limit: int = 10, include_synthetic: bool = False) -> List[Movie]:
    """Retrieve newest releases and catalog additions (Cache First)."""
    cache_key = f"rec:recently_added:{limit}:{include_synthetic}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    from app.database import SessionLocal

    async def _fetch(session: AsyncSession):
        query = (
            select(Movie)
            .options(joinedload(Movie.genres))
        )
        if not include_synthetic:
            query = query.filter(Movie.is_generated == False)

        query = (
            query.order_by(desc(Movie.created_at), desc(Movie.release_year))
            .limit(limit)
        )
        res = await session.execute(query)
        movies = list(res.scalars().unique().all())
        await populate_average_ratings(session, movies)

        serialized = [serialize_movie(m) for m in movies]
        await cache.set(cache_key, serialized, ttl=180)
        return movies

    if db is not None:
        return await _fetch(db)
    else:
        async with SessionLocal() as session:
            return await _fetch(session)

    if db is not None:
        return await _fetch(db)
    else:
        async with SessionLocal() as session:
            return await _fetch(session)

async def get_personalized_recommendations(
    db: Optional[AsyncSession] = None,
    user_id: Optional[UUID] = None,
    profile_id: Optional[UUID] = None,
    limit: int = 10,
    include_synthetic: bool = False
) -> List[Movie]:
    """
    Rule-based personalized recommendations based on active profile's genre preferences (Cache First).
    """
    cache_key = f"rec:personalized:{profile_id}:{limit}:{include_synthetic}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    from app.database import SessionLocal

    async def _fetch(session: AsyncSession):
        from app.models.genre import movie_genres

        # 1. Fetch watched movie IDs and matching genre IDs in a single direct query
        wh_res = await session.execute(
            select(movie_genres.c.genre_id, WatchHistory.movie_id)
            .select_from(WatchHistory)
            .join(movie_genres, WatchHistory.movie_id == movie_genres.c.movie_id)
            .filter(WatchHistory.user_id == user_id, WatchHistory.profile_id == profile_id)
        )
        rows = wh_res.all()

        watched_movie_ids = {r[1] for r in rows}

        # Extract genre counts
        genre_counts: Dict[UUID, int] = {}
        for g_id, _ in rows:
            genre_counts[g_id] = genre_counts.get(g_id, 0) + 1

        # Fallback to popular if no watch history
        if not genre_counts:
            return await get_popular_movies(db=session, limit=limit, include_synthetic=include_synthetic)

        # Top genre IDs
        top_genre_ids = [g_id for g_id, _ in sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)[:3]]

        # 2. Select movies matching top genres
        rec_query = (
            select(Movie)
            .options(joinedload(Movie.genres))
            .join(Movie.genres)
            .filter(Genre.genre_id.in_(top_genre_ids))
        )
        if not include_synthetic:
            rec_query = rec_query.filter(Movie.is_generated == False)
        if watched_movie_ids:
            rec_query = rec_query.filter(Movie.movie_id.not_in(watched_movie_ids))

        rec_query = (
            rec_query.order_by(
                desc(Movie.release_year),
                desc(Movie.title)
            )
            .limit(limit)
        )
        res = await session.execute(rec_query)
        recommendations = list(res.scalars().unique().all())

        # Fill remaining count with popular movies if recommendations list is small
        if len(recommendations) < limit:
            already_included = {m.movie_id for m in recommendations} | watched_movie_ids
            fill_query = (
                select(Movie)
                .options(joinedload(Movie.genres))
            )
            if not include_synthetic:
                fill_query = fill_query.filter(Movie.is_generated == False)
            if already_included:
                fill_query = fill_query.filter(Movie.movie_id.not_in(already_included))

            fill_query = fill_query.order_by(
                desc(Movie.release_year),
                desc(Movie.title)
            ).limit(limit - len(recommendations))

            fill_res = await session.execute(fill_query)
            fill_movies = list(fill_res.scalars().unique().all())
            recommendations.extend(fill_movies)

        from fastapi.responses import Response
        import json

        final_recs = recommendations[:limit]
        await populate_average_ratings(session, final_recs)
        serialized = [serialize_movie(m) for m in final_recs]
        json_str = json.dumps(serialized)
        await cache.set_raw(cache_key, json_str, ttl=120)
        return Response(content=json_str, media_type="application/json")

    if db is not None:
        return await _fetch(db)
    else:
        async with SessionLocal() as session:
            return await _fetch(session)

async def get_because_you_watched(
    db: Optional[AsyncSession] = None,
    user_id: Optional[UUID] = None,
    profile_id: Optional[UUID] = None,
    limit: int = 10,
    include_synthetic: bool = False
) -> Tuple[Optional[Movie], List[Movie]]:
    """
    Returns (because_movie, recommendations) based on profile's most recently watched movie (Cache First).
    """
    cache_key = f"rec:because_you_watched:{profile_id}:{limit}:{include_synthetic}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached.get("because_movie"), cached.get("recommendations", [])

    from app.database import SessionLocal

    async def _fetch(session: AsyncSession):
        # Find most recently watched movie ID
        last_wh_query = (
            select(WatchHistory.movie_id)
            .filter(WatchHistory.user_id == user_id, WatchHistory.profile_id == profile_id)
            .order_by(desc(WatchHistory.last_watched))
            .limit(1)
        )
        last_wh_res = await session.execute(last_wh_query)
        because_movie_id = last_wh_res.scalars().first()

        if not because_movie_id:
            return None, []

        because_movie_res = await session.execute(
            select(Movie).options(joinedload(Movie.genres)).filter(Movie.movie_id == because_movie_id)
        )
        because_movie = because_movie_res.scalars().first()

        if not because_movie:
            return None, []

        genre_ids = [g.genre_id for g in because_movie.genres]

        if not genre_ids:
            return because_movie, []

        rec_query = (
            select(Movie)
            .options(joinedload(Movie.genres))
            .join(Movie.genres)
            .filter(Genre.genre_id.in_(genre_ids), Movie.movie_id != because_movie.movie_id)
        )
        if not include_synthetic:
            rec_query = rec_query.filter(Movie.is_generated == False)

        rec_query = (
            rec_query.order_by(
                desc(Movie.release_year),
                desc(Movie.title)
            )
            .limit(limit)
        )
        res = await session.execute(rec_query)
        recommendations = list(res.scalars().unique().all())
        from fastapi.responses import Response
        import json

        await populate_average_ratings(session, [because_movie] + recommendations)

        serializable = {
            "because_movie": serialize_movie(because_movie),
            "recommendations": [serialize_movie(m) for m in recommendations]
        }
        json_str = json.dumps(serializable)
        await cache.set_raw(cache_key, json_str, ttl=120)
        return Response(content=json_str, media_type="application/json")

    if db is not None:
        return await _fetch(db)
    else:
        async with SessionLocal() as session:
            return await _fetch(session)

async def get_similar_movies(
    db: Optional[AsyncSession] = None,
    movie_id: Optional[UUID] = None,
    limit: int = 10,
    include_synthetic: bool = False
) -> List[Movie]:
    """Find similar movies sharing genres and release proximity (Cache First)."""
    if movie_id is None and isinstance(db, UUID):
        movie_id = db
        db = None

    cache_key = f"rec:similar:{movie_id}:{limit}:{include_synthetic}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    from app.database import SessionLocal

    async def _fetch(session: AsyncSession):
        movie_res = await session.execute(
            select(Movie).options(joinedload(Movie.genres)).filter(Movie.movie_id == movie_id)
        )
        target_movie = movie_res.scalars().first()

        if not target_movie or not target_movie.genres:
            return []

        genre_ids = [g.genre_id for g in target_movie.genres]

        query = (
            select(Movie)
            .options(joinedload(Movie.genres))
            .join(Movie.genres)
            .outerjoin(MovieStats, Movie.movie_id == MovieStats.movie_id)
            .filter(Genre.genre_id.in_(genre_ids), Movie.movie_id != movie_id)
        )
        if not include_synthetic:
            query = query.filter(Movie.is_generated == False)

        query = (
            query.order_by(
                desc(func.coalesce(MovieStats.popularity_score, 0.0)),
                desc(Movie.release_year)
            )
            .limit(limit)
        )
        res = await session.execute(query)
        movies = list(res.scalars().unique().all())
        await populate_average_ratings(session, movies)

        serialized = [serialize_movie(m) for m in movies]
        await cache.set(cache_key, serialized, ttl=300)
        return movies

    if db is not None:
        return await _fetch(db)
    else:
        async with SessionLocal() as session:
            return await _fetch(session)
