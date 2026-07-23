import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, BigInteger, Integer, Float, DateTime, UUID, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class Video(Base):
    __tablename__ = "videos"

    video_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    movie_id = Column(
        UUID(as_uuid=True),
        ForeignKey("movies.movie_id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    filename = Column(String, nullable=False, unique=True)
    original_filename = Column(String, nullable=False)
    storage_path = Column(String, nullable=False)
    file_size_bytes = Column(BigInteger, nullable=False)
    mime_type = Column(String, nullable=False)
    
    # Metadata fields
    duration_seconds = Column(Float, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    
    # Processing status & stream format (HLS-ready)
    status = Column(String, default="uploaded", nullable=False)  # uploaded, processing, completed, failed
    format = Column(String, default="mp4", nullable=False)       # mp4, webm, hls
    master_playlist_url = Column(String, nullable=True)         # HLS manifest URL
    hls_path = Column(String, nullable=True)                    # Directory path containing HLS playlist & segments
    error_message = Column(String, nullable=True)                # Failure reason if processing fails
    processing_progress = Column(Float, default=0.0, nullable=False) # 0.0 to 100.0

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    movie = relationship("Movie", back_populates="videos")
