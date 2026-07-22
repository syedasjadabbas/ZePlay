from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.movie import MovieResponse
from app.schemas.genre import GenreResponse
from app.services import movie_service
from app.api import deps
from app.services.cache_service import cache

router = APIRouter()

@router.get("/movies", response_model=List[MovieResponse])
async def list_movies(
    genre: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """Retrieve catalog list of movies, with optional filtering by genre."""
    return await movie_service.get_movies(db, genre_name=genre, limit=limit, offset=offset)

@router.get("/movies/{movie_id}", response_model=MovieResponse)
async def get_movie(
    movie_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.verify_user_entitlement)
):
    """Retrieve detailed metadata records for a single movie entry."""
    db_movie = await movie_service.get_movie_by_id(db, movie_id)
    if not db_movie:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movie not found in catalog."
        )
    return db_movie

@router.get("/genres", response_model=List[GenreResponse])
async def list_genres(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """Retrieve all available genres."""
    return await movie_service.get_genres(db)

@router.get("/search", response_model=List[MovieResponse])
async def search_catalog(
    q: Optional[str] = None,
    genre: Optional[str] = None,
    year: Optional[int] = None,
    sort_by: Optional[str] = "relevance",
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Search catalog movies across title, description, genre, and release year.
    """
    return await movie_service.search_movies(
        db, q=q, genre_name=genre, year=year, sort_by=sort_by, limit=limit, offset=offset
    )

@router.get("/search/suggestions", response_model=List[MovieResponse])
async def search_suggestions(
    q: str,
    limit: int = 5,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Fast search suggestions endpoint for live auto-complete dropdown.
    """
    cache_key = f"suggestions:{q.lower().strip()}:{limit}"
    cached_data = await cache.get(cache_key)
    if cached_data is not None:
        return cached_data

    suggestions = await movie_service.get_search_suggestions(db, q=q, limit=limit)
    
    # Serialize suggestions list to dictionaries to store in cache safely
    from fastapi.encoders import jsonable_encoder
    serialized = jsonable_encoder(suggestions)
    await cache.set(cache_key, serialized, ttl=300)
    
    return suggestions
