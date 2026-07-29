import logging
import uuid
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, or_, func
from sqlalchemy.orm import selectinload
from app.models.movie import Movie
from app.models.genre import Genre
from app.models.rating import Rating
from app.schemas.movie import MovieCreate, MovieUpdate
from app.schemas.genre import GenreCreate

from app.services.cache_service import cache

logger = logging.getLogger("ZePlay.CatalogService")

def dispatch_index_event(action: str, movie_id: uuid.UUID) -> None:
    """Mock events pipeline. Can hook into Elasticsearch or Kafka in Sprint 5."""
    logger.info(f"[INDEX SIGNAL] Action: {action.upper()} | Movie ID: {movie_id}")

async def get_genres(db: AsyncSession) -> List[Genre]:
    """Retrieve all available genres (Cache First)."""
    cache_key = "catalog:genres:all"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    result = await db.execute(select(Genre).order_by(Genre.name))
    genres = list(result.scalars().all())
    serializable = [{"genre_id": str(g.genre_id), "name": g.name} for g in genres]
    await cache.set(cache_key, serializable, ttl=600)
    return genres

async def create_genre(db: AsyncSession, genre_in: GenreCreate) -> Genre:
    """Create a new genre category."""
    existing_result = await db.execute(select(Genre).filter(Genre.name == genre_in.name))
    existing = existing_result.scalars().first()
    if existing:
        return existing
    db_genre = Genre(name=genre_in.name)
    db.add(db_genre)
    await db.commit()
    await db.refresh(db_genre)
    await cache.invalidate_pattern("catalog:genres:*")
    return db_genre

async def get_movies(
    db: AsyncSession,
    genre_name: Optional[str] = None,
    sort_by: Optional[str] = "title",
    year_range: Optional[str] = None,
    limit: int = 40,
    offset: int = 0
) -> List[Movie]:
    """
    Retrieve paginated catalog movies with optional genre, year_range, and sort_by filters.
    All filtering is server-side. Cache keyed by all params (TTL=300s).
    """
    cache_key = (
        f"catalog:movies:{genre_name or 'all'}:{sort_by or 'title'}"
        f":{year_range or 'all'}:{limit}:{offset}"
    )
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

async def populate_movie_ratings(db: AsyncSession, movies: List[Movie]) -> None:
    if not movies:
        return
    movie_ids = [m.movie_id for m in movies if m is not None]
    if not movie_ids:
        return
    res = await db.execute(
        select(Rating.movie_id, func.avg(Rating.score))
        .filter(Rating.movie_id.in_(movie_ids))
        .group_by(Rating.movie_id)
    )
    avg_map = {row[0]: round(float(row[1] or 0.0), 1) for row in res.all()}
    for m in movies:
        if m is not None:
            m.average_rating = avg_map.get(m.movie_id, 0.0)

async def get_movies(
    db: AsyncSession,
    genre_name: Optional[str] = None,
    sort_by: Optional[str] = "title",
    year_range: Optional[str] = None,
    limit: int = 40,
    offset: int = 0
) -> List[Movie]:
    """
    Retrieve paginated catalog movies with optional genre, year_range, and sort_by filters.
    All filtering is server-side. Cache keyed by all params (TTL=300s).
    """
    cache_key = (
        f"catalog:movies:{genre_name or 'all'}:{sort_by or 'title'}"
        f":{year_range or 'all'}:{limit}:{offset}"
    )
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    query = select(Movie).options(selectinload(Movie.genres))

    if genre_name:
        query = query.join(Movie.genres).filter(Genre.name.ilike(genre_name))

    # Year range filter (server-side)
    if year_range == "2020s":
        query = query.filter(Movie.release_year >= 2020)
    elif year_range == "2010s":
        query = query.filter(Movie.release_year >= 2010, Movie.release_year <= 2019)
    elif year_range == "classic":
        query = query.filter(Movie.release_year < 2010)

    # Sort order
    if sort_by == "year_desc":
        query = query.order_by(Movie.release_year.desc(), Movie.title)
    elif sort_by == "year_asc":
        query = query.order_by(Movie.release_year.asc(), Movie.title)
    else:
        query = query.order_by(Movie.title)

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    movies = list(result.scalars().unique().all())

    await populate_movie_ratings(db, movies)

    serializable = [
        {
            "movie_id": str(m.movie_id),
            "title": m.title,
            "description": m.description,
            "release_year": m.release_year,
            "duration_minutes": m.duration_minutes,
            "thumbnail_url": m.thumbnail_url,
            "video_url": m.video_url,
            "average_rating": getattr(m, "average_rating", 0.0),
            "is_generated": bool(m.is_generated),
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "updated_at": m.updated_at.isoformat() if m.updated_at else None,
            "genres": [{"genre_id": str(g.genre_id), "name": g.name} for g in (m.genres or [])]
        }
        for m in movies
    ]
    await cache.set(cache_key, serializable, ttl=300)
    return movies

async def get_movie_by_id(db: AsyncSession, movie_id: uuid.UUID) -> Optional[Movie]:
    """Retrieve detailed movie object by ID (Cache First)."""
    cache_key = f"catalog:movies:detail:{movie_id}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    result = await db.execute(
        select(Movie)
        .options(selectinload(Movie.genres))
        .filter(Movie.movie_id == movie_id)
    )
    movie = result.scalars().first()
    if not movie:
        return None
        
    await populate_movie_ratings(db, [movie])

    serializable = {
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
    await cache.set(cache_key, serializable, ttl=300)
    return movie

async def create_movie(db: AsyncSession, movie_in: MovieCreate) -> Movie:
    """Create a movie entry, resolving relationship genres list."""
    db_movie = Movie(
        title=movie_in.title,
        description=movie_in.description,
        release_year=movie_in.release_year,
        duration_minutes=movie_in.duration_minutes,
        thumbnail_url=movie_in.thumbnail_url,
        video_url=movie_in.video_url
    )
    if movie_in.genre_ids:
        genres_result = await db.execute(
            select(Genre).filter(Genre.genre_id.in_(movie_in.genre_ids))
        )
        db_movie.genres = list(genres_result.scalars().all())
    db.add(db_movie)
    await db.commit()
    await db.refresh(db_movie)
    await cache.invalidate_pattern("catalog:*")
    await cache.invalidate_pattern("rec:*")
    dispatch_index_event("create", db_movie.movie_id)
    return db_movie

async def get_movie_by_id_orm(db: AsyncSession, movie_id: uuid.UUID) -> Optional[Movie]:
    """Retrieve detailed movie ORM model instance for database updates/deletes."""
    result = await db.execute(
        select(Movie)
        .options(selectinload(Movie.genres))
        .filter(Movie.movie_id == movie_id)
    )
    return result.scalars().first()

async def update_movie(db: AsyncSession, movie_id: uuid.UUID, movie_in: MovieUpdate) -> Optional[Movie]:
    """Update movie catalog metadata and association categories."""
    db_movie = await get_movie_by_id_orm(db, movie_id)
    if not db_movie:
        return None
    update_data = movie_in.model_dump(exclude_unset=True)
    if "genre_ids" in update_data:
        genre_ids = update_data.pop("genre_ids")
        if genre_ids is not None:
            genres_result = await db.execute(
                select(Genre).filter(Genre.genre_id.in_(genre_ids))
            )
            db_movie.genres = list(genres_result.scalars().all())
    for field, value in update_data.items():
        setattr(db_movie, field, value)
    await db.commit()
    await db.refresh(db_movie)
    await cache.invalidate_pattern("catalog:*")
    await cache.invalidate_pattern("rec:*")
    dispatch_index_event("update", db_movie.movie_id)
    return db_movie

async def delete_movie(db: AsyncSession, movie_id: uuid.UUID) -> bool:
    """Delete a movie from datastore."""
    db_movie = await get_movie_by_id_orm(db, movie_id)
    if not db_movie:
        return False
    await db.delete(db_movie)
    await db.commit()
    await cache.invalidate_pattern("catalog:*")
    await cache.invalidate_pattern("rec:*")
    dispatch_index_event("delete", movie_id)
    return True

async def search_movies(
    db: AsyncSession,
    q: Optional[str] = None,
    genre_name: Optional[str] = None,
    year: Optional[int] = None,
    year_range: Optional[str] = None,
    sort_by: Optional[str] = "relevance",
    limit: int = 40,
    offset: int = 0
) -> List[Movie]:
    """
    Multi-field catalog search querying title, genre name, and release year.
    Results are cached in Redis by parameter key (TTL=90s).
    Description ILIKE removed — too expensive at 100K rows.
    """
    q_clean = q.strip().lower() if q and q.strip() else ""
    genre_clean = genre_name.strip().lower() if genre_name and genre_name.strip() else ""
    cache_key = (
        f"catalog:search:{q_clean}:{genre_clean}:{year or ''}"
        f":{year_range or ''}:{sort_by}:{limit}:{offset}"
    )
    cached = await cache.get(cache_key)
    if cached is not None:
        return cached

    query = select(Movie).options(selectinload(Movie.genres))

    if q_clean:
        search_term = f"%{q_clean}%"
        conditions = [
            Movie.title.ilike(search_term),
            Movie.genres.any(Genre.name.ilike(search_term))
        ]
        if q_clean.isdigit():
            conditions.append(Movie.release_year == int(q_clean))
        query = query.filter(or_(*conditions))

    if genre_clean:
        query = query.join(Movie.genres).filter(Genre.name.ilike(genre_clean))

    if year:
        query = query.filter(Movie.release_year == year)

    if year_range == "2020s":
        query = query.filter(Movie.release_year >= 2020)
    elif year_range == "2010s":
        query = query.filter(Movie.release_year >= 2010, Movie.release_year <= 2019)
    elif year_range == "classic":
        query = query.filter(Movie.release_year < 2010)

    if sort_by == "year_desc":
        query = query.order_by(Movie.release_year.desc(), Movie.title)
    elif sort_by == "title":
        query = query.order_by(Movie.title)
    else:
        query = query.order_by(Movie.created_at.desc())

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    movies = list(result.scalars().unique().all())

    await populate_movie_ratings(db, movies)

    serialized = [
        {
            "movie_id": str(m.movie_id),
            "title": m.title,
            "description": m.description,
            "release_year": m.release_year,
            "duration_minutes": m.duration_minutes,
            "thumbnail_url": m.thumbnail_url,
            "video_url": m.video_url,
            "average_rating": getattr(m, "average_rating", 0.0),
            "is_generated": bool(m.is_generated),
            "created_at": m.created_at.isoformat() if m.created_at else None,
            "updated_at": m.updated_at.isoformat() if m.updated_at else None,
            "genres": [{"genre_id": str(g.genre_id), "name": g.name} for g in (m.genres or [])]
        }
        for m in movies
    ]
    await cache.set(cache_key, serialized, ttl=90)
    return movies

async def get_search_suggestions(
    db: AsyncSession,
    q: str,
    limit: int = 5
) -> List[Movie]:
    """Quick search suggestions query for live auto-complete."""
    if not q or not q.strip():
        return []
    search_term = f"%{q.strip()}%"
    conditions = [
        Movie.title.ilike(search_term),
        Movie.genres.any(Genre.name.ilike(search_term))
    ]
    if q.strip().isdigit():
        conditions.append(Movie.release_year == int(q.strip()))

    query = (
        select(Movie)
        .options(selectinload(Movie.genres))
        .filter(or_(*conditions))
        .order_by(Movie.title)
        .limit(limit)
    )
    result = await db.execute(query)
    movies = list(result.scalars().unique().all())

    await populate_movie_ratings(db, movies)
    return movies

