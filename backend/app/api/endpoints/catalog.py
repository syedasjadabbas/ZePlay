from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.movie import MovieResponse
from app.schemas.genre import GenreResponse
from app.services import movie_service
from app.api import deps
from app.services.cache_service import cache
from fastapi.responses import Response

router = APIRouter()

@router.get("/movies", response_model=List[MovieResponse])
async def list_movies(
    genre: Optional[str] = None,
    sort_by: Optional[str] = "title",
    year_range: Optional[str] = None,
    cursor: Optional[str] = None,
    limit: int = Query(default=40, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    include_synthetic: bool = Query(default=False, description="Whether to include benchmark synthetic records in results"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Retrieve catalog list of movies with server-side filtering.
    Supports genre, sort_by, year_range (all / 2020s / 2010s / classic), cursor, limit, offset.
    By default, only real curated catalogue movies (is_generated=False) are returned.
    """
    res = await movie_service.get_movies(
        db=db,
        genre_name=genre,
        sort_by=sort_by,
        year_range=year_range,
        cursor=cursor,
        limit=limit,
        offset=offset,
        include_synthetic=include_synthetic
    )
    await db.close()
    if isinstance(res, Response):
        return res
    return res

@router.get("/movies/{movie_id}", response_model=MovieResponse)
async def get_movie(
    movie_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """Retrieve detailed metadata records for a single movie entry."""
    db_movie = await movie_service.get_movie_by_id(db=db, movie_id=movie_id)
    await db.close()
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
    res = await movie_service.get_genres(db=db)
    await db.close()
    return res

@router.get("/search", response_model=List[MovieResponse])
async def search_catalog(
    q: Optional[str] = None,
    genre: Optional[str] = None,
    year: Optional[int] = None,
    year_range: Optional[str] = None,
    sort_by: Optional[str] = "relevance",
    cursor: Optional[str] = None,
    limit: int = Query(default=40, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    include_synthetic: bool = Query(default=False, description="Whether to include benchmark synthetic records in results"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Search catalog movies across title, genre name, and release year.
    Results are paginated. Supports cursor and offset pagination.
    By default, only real curated catalogue movies (is_generated=False) are returned.
    """
    res = await movie_service.search_movies(
        db=db,
        q=q,
        genre_name=genre,
        year=year,
        year_range=year_range,
        sort_by=sort_by,
        cursor=cursor,
        limit=limit,
        offset=offset,
        include_synthetic=include_synthetic
    )
    if isinstance(res, Response):
        return res
    return res

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
    res = await movie_service.get_search_suggestions(db=db, q=q, limit=limit)
    if isinstance(res, Response):
        return res
    return res
