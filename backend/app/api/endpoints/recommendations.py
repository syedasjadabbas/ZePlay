from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.movie import MovieResponse
from app.schemas.recommendation import BecauseYouWatchedResponse, MovieStatsResponse
from app.services import recommendation_service
from app.api import deps

router = APIRouter()

@router.get("/trending", response_model=List[MovieResponse])
async def get_trending(
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """Retrieve trending catalog titles."""
    return await recommendation_service.get_trending_movies(db, limit=limit)

@router.get("/popular", response_model=List[MovieResponse])
async def get_popular(
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """Retrieve popular movies ranked by view counts and popularity scores."""
    return await recommendation_service.get_popular_movies(db, limit=limit)

@router.get("/recently-added", response_model=List[MovieResponse])
async def get_recently_added(
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """Retrieve recently added catalog titles and new releases."""
    return await recommendation_service.get_recently_added_movies(db, limit=limit)

@router.get("/personalized", response_model=List[MovieResponse])
async def get_personalized(
    profile_id: UUID,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Retrieve personalized movie recommendations tailored to profile watch history and genre preferences.
    """
    return await recommendation_service.get_personalized_recommendations(
        db, user_id=current_user.user_id, profile_id=profile_id, limit=limit
    )

@router.get("/because-you-watched", response_model=BecauseYouWatchedResponse)
async def get_because_you_watched(
    profile_id: UUID,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Retrieve recommendations cluster based on profile's most recently watched title.
    """
    because_movie, recommendations = await recommendation_service.get_because_you_watched(
        db, user_id=current_user.user_id, profile_id=profile_id, limit=limit
    )
    return BecauseYouWatchedResponse(
        because_movie=because_movie,
        recommendations=recommendations
    )

@router.get("/similar/{movie_id}", response_model=List[MovieResponse])
async def get_similar(
    movie_id: UUID,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """Retrieve similar movies based on shared genres and metadata."""
    return await recommendation_service.get_similar_movies(db, movie_id=movie_id, limit=limit)

@router.post("/track-view/{movie_id}", response_model=MovieStatsResponse)
async def track_view(
    movie_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """Increment movie view count and recalculate popularity stats."""
    return await recommendation_service.track_movie_view(db, movie_id=movie_id)
