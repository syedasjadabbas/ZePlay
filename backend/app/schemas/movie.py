import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, HttpUrl, ConfigDict
from app.schemas.genre import GenreResponse

class MovieBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=150)
    description: str = Field(..., min_length=1)
    release_year: int = Field(..., ge=1888, le=2100)
    duration_minutes: int = Field(..., gt=0)
    thumbnail_url: str = Field(..., min_length=1)
    video_url: str = Field(..., min_length=1)

class MovieCreate(MovieBase):
    genre_ids: Optional[List[uuid.UUID]] = Field(default_factory=list)

class MovieUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    release_year: Optional[int] = None
    duration_minutes: Optional[int] = None
    thumbnail_url: Optional[str] = None
    video_url: Optional[str] = None
    genre_ids: Optional[List[uuid.UUID]] = None

class MovieResponse(MovieBase):
    movie_id: uuid.UUID
    genres: List[GenreResponse] = Field(default_factory=list)
    average_rating: float = 0.0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
