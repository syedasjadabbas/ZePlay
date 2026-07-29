from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
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
    include_synthetic: bool = Query(default=False, description="Whether to include benchmark synthetic records in results"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """Retrieve trending catalog titles."""
    res = await recommendation_service.get_trending_movies(db=db, limit=limit, include_synthetic=include_synthetic)
    await db.close()
    if isinstance(res, Response):
        return res
    return res

@router.get("/popular", response_model=List[MovieResponse])
async def get_popular(
    limit: int = 10,
    include_synthetic: bool = Query(default=False, description="Whether to include benchmark synthetic records in results"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """Retrieve popular movies ranked by view counts and popularity scores."""
    res = await recommendation_service.get_popular_movies(db=db, limit=limit, include_synthetic=include_synthetic)
    await db.close()
    if isinstance(res, Response):
        return res
    return res

@router.get("/recently-added", response_model=List[MovieResponse])
async def get_recently_added(
    limit: int = 10,
    include_synthetic: bool = Query(default=False, description="Whether to include benchmark synthetic records in results"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """Retrieve recently added catalog titles and new releases."""
    res = await recommendation_service.get_recently_added_movies(db=db, limit=limit, include_synthetic=include_synthetic)
    await db.close()
    return res

@router.get("/personalized", response_model=List[MovieResponse])
async def get_personalized(
    profile_id: UUID,
    limit: int = 10,
    include_synthetic: bool = Query(default=False, description="Whether to include benchmark synthetic records in results"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Retrieve personalized movie recommendations tailored to profile watch history and genre preferences.
    """
    res = await recommendation_service.get_personalized_recommendations(
        db=db, user_id=current_user.user_id, profile_id=profile_id, limit=limit, include_synthetic=include_synthetic
    )
    await db.close()
    return res

@router.get("/because-you-watched", response_model=BecauseYouWatchedResponse)
async def get_because_you_watched(
    profile_id: UUID,
    limit: int = 10,
    include_synthetic: bool = Query(default=False, description="Whether to include benchmark synthetic records in results"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Retrieve recommendations cluster based on profile's most recently watched title.
    """
    res = await recommendation_service.get_because_you_watched(
        db=db, user_id=current_user.user_id, profile_id=profile_id, limit=limit, include_synthetic=include_synthetic
    )
    await db.close()
    if isinstance(res, Response):
        return res
    because_movie, recommendations = res
    return BecauseYouWatchedResponse(
        because_movie=because_movie,
        recommendations=recommendations
    )

@router.get("/similar/{movie_id}", response_model=List[MovieResponse])
async def get_similar(
    movie_id: UUID,
    limit: int = 10,
    include_synthetic: bool = Query(default=False, description="Whether to include benchmark synthetic records in results"),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """Retrieve similar movies based on shared genres and metadata."""
    res = await recommendation_service.get_similar_movies(db=db, movie_id=movie_id, limit=limit, include_synthetic=include_synthetic)
    await db.close()
    return res

@router.post("/track-view/{movie_id}", response_model=MovieStatsResponse)
async def track_view(
    movie_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """Increment movie view count and recalculate popularity stats."""
    return await recommendation_service.track_movie_view(db, movie_id=movie_id)
