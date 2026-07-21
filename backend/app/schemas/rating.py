import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class RatingCreate(BaseModel):
    score: int = Field(..., ge=1, le=5, description="Rating score from 1 to 5 stars")

class RatingResponse(BaseModel):
    rating_id: uuid.UUID
    profile_id: uuid.UUID
    movie_id: uuid.UUID
    score: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class MovieRatingStatsResponse(BaseModel):
    movie_id: uuid.UUID
    average_rating: float = 0.0
    total_ratings: int = 0
    user_rating: Optional[int] = None
