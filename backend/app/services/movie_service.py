import logging
import uuid
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, or_
from sqlalchemy.orm import selectinload
from app.models.movie import Movie
from app.models.genre import Genre
from app.schemas.movie import MovieCreate, MovieUpdate
from app.schemas.genre import GenreCreate

logger = logging.getLogger("ZePlay.CatalogService")

def dispatch_index_event(action: str, movie_id: uuid.UUID) -> None:
    """Mock events pipeline. Can hook into Elasticsearch or Kafka in Sprint 5."""
    logger.info(f"[INDEX SIGNAL] Action: {action.upper()} | Movie ID: {movie_id}")

async def get_genres(db: AsyncSession) -> List[Genre]:
    """Retrieve all available genres."""
    result = await db.execute(select(Genre).order_by(Genre.name))
    return list(result.scalars().all())

async def create_genre(db: AsyncSession, genre_in: GenreCreate) -> Genre:
    """Create a new genre category."""
    # Check duplicate name
    existing_result = await db.execute(select(Genre).filter(Genre.name == genre_in.name))
    existing = existing_result.scalars().first()
    if existing:
        return existing
    
    db_genre = Genre(name=genre_in.name)
    db.add(db_genre)
    await db.commit()
    await db.refresh(db_genre)
    return db_genre

async def get_movies(
    db: AsyncSession, 
    genre_name: Optional[str] = None, 
    limit: int = 50, 
    offset: int = 0
) -> List[Movie]:
    """Retrieve list of movies, optionally filtered by genre name."""
    query = select(Movie).options(selectinload(Movie.genres))
    
    if genre_name:
        query = query.join(Movie.genres).filter(Genre.name.ilike(genre_name))
        
    query = query.order_by(Movie.title).offset(offset).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())

async def get_movie_by_id(db: AsyncSession, movie_id: uuid.UUID) -> Optional[Movie]:
    """Retrieve detailed movie object by ID."""
    result = await db.execute(
        select(Movie)
        .options(selectinload(Movie.genres))
        .filter(Movie.movie_id == movie_id)
    )
    return result.scalars().first()

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
    
    # Resolve genres relationships
    if movie_in.genre_ids:
        genres_result = await db.execute(
            select(Genre).filter(Genre.genre_id.in_(movie_in.genre_ids))
        )
        db_movie.genres = list(genres_result.scalars().all())
        
    db.add(db_movie)
    await db.commit()
    await db.refresh(db_movie)
    
    # Trigger search index sync signal
    dispatch_index_event("create", db_movie.movie_id)
    return db_movie

async def update_movie(db: AsyncSession, movie_id: uuid.UUID, movie_in: MovieUpdate) -> Optional[Movie]:
    """Update movie catalog metadata and association categories."""
    db_movie = await get_movie_by_id(db, movie_id)
    if not db_movie:
        return None
        
    update_data = movie_in.model_dump(exclude_unset=True)
    
    # Handle genres association list replacement
    if "genre_ids" in update_data:
        genre_ids = update_data.pop("genre_ids")
        if genre_ids is not None:
            genres_result = await db.execute(
                select(Genre).filter(Genre.genre_id.in_(genre_ids))
            )
            db_movie.genres = list(genres_result.scalars().all())
            
    # Apply standard attributes changes
    for field, value in update_data.items():
        setattr(db_movie, field, value)
        
    await db.commit()
    await db.refresh(db_movie)
    
    # Trigger search index update signal
    dispatch_index_event("update", db_movie.movie_id)
    return db_movie

async def delete_movie(db: AsyncSession, movie_id: uuid.UUID) -> bool:
    """Delete a movie from datastore."""
    db_movie = await get_movie_by_id(db, movie_id)
    if not db_movie:
        return False
        
    await db.delete(db_movie)
    await db.commit()
    
    # Trigger search index deletion signal
    dispatch_index_event("delete", movie_id)
    return True

async def search_movies(
    db: AsyncSession,
    q: Optional[str] = None,
    genre_name: Optional[str] = None,
    year: Optional[int] = None,
    sort_by: Optional[str] = "relevance",
    limit: int = 50,
    offset: int = 0
) -> List[Movie]:
    """
    Multi-field catalog search querying title, description, genre name, and release year.
    """
    query = select(Movie).options(selectinload(Movie.genres))
    
    if q and q.strip():
        search_term = f"%{q.strip()}%"
        conditions = [
            Movie.title.ilike(search_term),
            Movie.description.ilike(search_term),
            Movie.genres.any(Genre.name.ilike(search_term))
        ]
        if q.strip().isdigit():
            conditions.append(Movie.release_year == int(q.strip()))
            
        query = query.filter(or_(*conditions))
        
    if genre_name and genre_name.strip():
        query = query.join(Movie.genres).filter(Genre.name.ilike(genre_name.strip()))
        
    if year:
        query = query.filter(Movie.release_year == year)
        
    if sort_by == "year_desc":
        query = query.order_by(Movie.release_year.desc(), Movie.title)
    elif sort_by == "title":
        query = query.order_by(Movie.title)
    else:
        query = query.order_by(Movie.created_at.desc())

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().unique().all())

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
    return list(result.scalars().unique().all())
