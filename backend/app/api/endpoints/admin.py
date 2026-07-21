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

@router.get("/users")
async def get_all_users(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_admin_user)
):
    """Admin endpoint to list all registered users."""
    res = await db.execute(select(User).order_by(User.created_at.desc()))
    users = res.scalars().all()
    return [
        {
            "user_id": str(u.user_id),
            "name": u.name,
            "email": u.email,
            "is_verified": u.is_verified,
            "is_admin": u.is_admin,
            "subscription_plan": u.subscription_plan,
            "created_at": u.created_at.isoformat() if u.created_at else None
        }
        for u in users
    ]

from pydantic import BaseModel

class UserRoleUpdate(BaseModel):
    is_admin: bool

@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: UUID,
    role_in: UserRoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_admin_user)
):
    """Admin endpoint to promote or demote user admin privileges."""
    res = await db.execute(select(User).filter(User.user_id == user_id))
    user = res.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    if not role_in.is_admin and user.user_id == current_user.user_id:
        total_admins = (await db.execute(select(func.count(User.user_id)).filter(User.is_admin == True))).scalar() or 0
        if total_admins <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove admin role from the last remaining admin user."
            )

    user.is_admin = role_in.is_admin
    await db.commit()
    await db.refresh(user)

    return {
        "message": f"User {user.email} role updated successfully.",
        "user_id": str(user.user_id),
        "is_admin": user.is_admin
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

from app.services.cache_service import cache

@router.post("/genres", response_model=GenreResponse, status_code=status.HTTP_201_CREATED)
async def create_genre(
    genre_in: GenreCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_admin_user)
):
    """Admin endpoint to register a new genre category."""
    return await movie_service.create_genre(db, genre_in)

@router.get("/cache/stats")
async def get_cache_stats(
    current_user = Depends(deps.get_current_admin_user)
):
    """Admin endpoint to retrieve cache performance statistics (hits, misses, hit rate)."""
    return cache.get_stats()

@router.post("/cache/clear")
async def clear_cache(
    current_user = Depends(deps.get_current_admin_user)
):
    """Admin endpoint to clear all cached keys and reset hit/miss counters."""
    await cache.clear_all()
    return {"message": "Cache successfully cleared."}
