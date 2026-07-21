from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.schemas.movie import MovieCreate, MovieUpdate, MovieResponse
from app.schemas.genre import GenreCreate, GenreResponse
from app.services import movie_service
from app.models.movie import Movie
from app.models.video import Video
from app.models.user import User
from app.api import deps

router = APIRouter()

@router.get("/stats")
async def get_system_stats(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_admin_user)
):
    """Admin endpoint to retrieve overall system stats for the Admin Dashboard."""
    total_users = (await db.execute(select(func.count(User.user_id)))).scalar() or 0
    total_admins = (await db.execute(select(func.count(User.user_id)).filter(User.is_admin == True))).scalar() or 0
    total_movies = (await db.execute(select(func.count(Movie.movie_id)))).scalar() or 0
    total_videos = (await db.execute(select(func.count(Video.video_id)))).scalar() or 0
    total_storage = (await db.execute(select(func.sum(Video.file_size_bytes)))).scalar() or 0

    return {
        "total_users": total_users,
        "total_admins": total_admins,
        "total_movies": total_movies,
        "total_videos": total_videos,
        "total_storage_bytes": total_storage
    }

@router.post("/movies", response_model=MovieResponse, status_code=status.HTTP_201_CREATED)
async def create_movie(
    movie_in: MovieCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_admin_user)
):
    """Admin endpoint to ingest a new movie entry."""
    return await movie_service.create_movie(db, movie_in)

@router.put("/movies/{movie_id}", response_model=MovieResponse)
async def update_movie(
    movie_id: UUID,
    movie_in: MovieUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_admin_user)
):
    """Admin endpoint to update movie metadata records."""
    updated = await movie_service.update_movie(db, movie_id, movie_in)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movie not found."
        )
    return updated

@router.delete("/movies/{movie_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_movie(
    movie_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_admin_user)
):
    """Admin endpoint to delete a movie from catalog."""
    deleted = await movie_service.delete_movie(db, movie_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movie not found."
        )
    return None

@router.post("/genres", response_model=GenreResponse, status_code=status.HTTP_201_CREATED)
async def create_genre(
    genre_in: GenreCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_admin_user)
):
    """Admin endpoint to register a new genre category."""
    return await movie_service.create_genre(db, genre_in)
