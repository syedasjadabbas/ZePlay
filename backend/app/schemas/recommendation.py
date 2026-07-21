from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from app.schemas.movie import MovieResponse

class BecauseYouWatchedResponse(BaseModel):
    because_movie: Optional[MovieResponse] = None
    recommendations: List[MovieResponse]

class MovieStatsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    movie_id: UUID
    view_count: int
    watch_count: int
    popularity_score: float
