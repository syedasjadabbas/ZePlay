from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.movie import MovieResponse

class WatchlistAdd(BaseModel):
    profile_id: UUID
    movie_id: UUID

class WatchlistResponse(BaseModel):
    watchlist_id: UUID
    user_id: UUID
    profile_id: UUID
    movie_id: UUID
    created_at: datetime

    movie: Optional[MovieResponse] = None

    model_config = ConfigDict(from_attributes=True)

class WatchlistStatusResponse(BaseModel):
    is_in_watchlist: bool
    watchlist_id: Optional[UUID] = None
