from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.watchlist import WatchlistAdd, WatchlistResponse, WatchlistStatusResponse
from app.services import watchlist_service
from app.api import deps

router = APIRouter()

def build_watchlist_response(item) -> dict:
    """Helper to structure Watchlist model with full nested movie & genres payload."""
    movie_dict = None
    if item.movie:
        genres_list = (
            [{"genre_id": g.genre_id, "name": g.name} for g in item.movie.genres]
            if hasattr(item.movie, "genres") and item.movie.genres
            else []
        )
        movie_dict = {
            "movie_id": item.movie.movie_id,
            "title": item.movie.title,
            "description": item.movie.description,
            "release_year": item.movie.release_year,
            "duration_minutes": item.movie.duration_minutes,
            "thumbnail_url": item.movie.thumbnail_url,
            "video_url": item.movie.video_url,
            "genres": genres_list,
            "created_at": item.movie.created_at,
            "updated_at": item.movie.updated_at
        }

    return {
        "watchlist_id": item.watchlist_id,
        "user_id": item.user_id,
        "profile_id": item.profile_id,
        "movie_id": item.movie_id,
        "created_at": item.created_at,
        "movie": movie_dict
    }

@router.post("/", response_model=WatchlistResponse, status_code=status.HTTP_201_CREATED)
async def add_to_watchlist(
    watchlist_in: WatchlistAdd,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Adds a movie to the specified profile's watchlist.
    """
    try:
        item = await watchlist_service.add_to_watchlist(db, current_user.user_id, watchlist_in)
        return build_watchlist_response(item)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )

@router.get("/", response_model=List[WatchlistResponse])
async def get_watchlist(
    profile_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Retrieves all saved watchlist items for the specified profile.
    """
    try:
        items = await watchlist_service.get_profile_watchlist(db, current_user.user_id, profile_id)
        return [build_watchlist_response(item) for item in items]
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )

@router.get("/check/{movie_id}", response_model=WatchlistStatusResponse)
async def check_watchlist(
    movie_id: UUID,
    profile_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Checks if a movie is present in the specified profile's watchlist.
    """
    try:
        return await watchlist_service.check_in_watchlist(db, current_user.user_id, profile_id, movie_id)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )

@router.delete("/{movie_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_watchlist(
    movie_id: UUID,
    profile_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Removes a movie from the specified profile's watchlist.
    """
    try:
        success = await watchlist_service.remove_from_watchlist(
            db, current_user.user_id, profile_id, movie_id
        )
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Watchlist entry not found or unauthorized."
            )
        return None
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )
