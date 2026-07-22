from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.user import User
from app.models.profile import Profile
from app.models.movie import Movie
from app.models.rating import Rating
from app.schemas.rating import RatingCreate, RatingResponse, MovieRatingStatsResponse
from app.api import deps

router = APIRouter()

@router.post("/movie/{movie_id}", response_model=RatingResponse)
async def rate_movie(
    movie_id: UUID,
    rating_in: RatingCreate,
    profile_id: UUID = Query(...),
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Submit or update a rating score (1-5 stars) for a movie by active profile."""
    # 1. Verify profile ownership
    prof_res = await db.execute(
        select(Profile).filter(Profile.profile_id == profile_id, Profile.user_id == current_user.user_id)
    )
    if not prof_res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found or access denied."
        )

    # 2. Verify movie existence
    movie_res = await db.execute(select(Movie).filter(Movie.movie_id == movie_id))
    if not movie_res.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movie not found."
        )

    # 3. Check existing rating
    existing_res = await db.execute(
        select(Rating).filter(Rating.profile_id == profile_id, Rating.movie_id == movie_id)
    )
    rating_record = existing_res.scalars().first()

    if rating_record:
        rating_record.score = rating_in.score
    else:
        rating_record = Rating(
            user_id=current_user.user_id,
            profile_id=profile_id,
            movie_id=movie_id,
            score=rating_in.score
        )
        db.add(rating_record)

    await db.commit()
    await db.refresh(rating_record)

    # Invalidate catalog & recommendation caches
    from app.services.cache_service import cache
    await cache.invalidate_pattern("catalog:*")
    await cache.invalidate_pattern("rec:*")

    return rating_record


@router.get("/movie/{movie_id}", response_model=MovieRatingStatsResponse)
async def get_movie_ratings(
    movie_id: UUID,
    profile_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve average rating score and total count for a movie, optionally including user score."""
    stats_res = await db.execute(
        select(
            func.coalesce(func.avg(Rating.score), 0.0),
            func.count(Rating.rating_id)
        ).filter(Rating.movie_id == movie_id)
    )
    avg_score, total_count = stats_res.first()
    avg_score_val = round(float(avg_score or 0.0), 1)

    user_score = None
    if profile_id:
        user_res = await db.execute(
            select(Rating.score).filter(Rating.profile_id == profile_id, Rating.movie_id == movie_id)
        )
        user_score = user_res.scalar()

    return MovieRatingStatsResponse(
        movie_id=movie_id,
        average_rating=avg_score_val,
        total_ratings=total_count or 0,
        user_rating=user_score
    )
