from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class VideoBase(BaseModel):
    filename: str
    original_filename: str
    file_size_bytes: int
    mime_type: str
    duration_seconds: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    status: str = "uploaded"
    format: str = "mp4"
    master_playlist_url: Optional[str] = None
    error_message: Optional[str] = None

class VideoCreate(BaseModel):
    movie_id: Optional[UUID] = None

class VideoResponse(VideoBase):
    video_id: UUID
    movie_id: Optional[UUID] = None
    storage_path: str
    playback_url: str
    hls_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class VideoStreamInfo(BaseModel):
    video_id: UUID
    filename: str
    mime_type: str
    file_size_bytes: int
    playback_url: str
    hls_url: Optional[str] = None
    status: str
    format: str
