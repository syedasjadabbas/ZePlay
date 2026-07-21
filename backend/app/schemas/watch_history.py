from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.movie import MovieResponse
from app.schemas.video import VideoResponse

class ProgressUpdate(BaseModel):
    profile_id: UUID
    movie_id: UUID
    video_id: Optional[UUID] = None
    current_position: float = Field(..., ge=0.0, description="Current playback position in seconds")
    duration: float = Field(..., ge=0.0, description="Total duration of media asset in seconds")

class WatchHistoryResponse(BaseModel):
    history_id: UUID
    user_id: UUID
    profile_id: UUID
    movie_id: UUID
    video_id: Optional[UUID] = None
    current_position: float
    duration: float
    percentage_watched: float
    last_watched: datetime
    created_at: datetime

    movie: Optional[MovieResponse] = None
    video: Optional[VideoResponse] = None

    model_config = ConfigDict(from_attributes=True)
