import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime, UUID
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.genre import movie_genres

class Movie(Base):
    __tablename__ = "movies"

    movie_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    title = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=False)
    release_year = Column(Integer, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    thumbnail_url = Column(String, nullable=False)
    video_url = Column(String, nullable=False)
    
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

    # Many-to-many relationship with Genre
    genres = relationship(
        "Genre",
        secondary=movie_genres,
        backref="movies",
        lazy="selectin"
    )

    # One-to-many relationship with Video assets
    videos = relationship(
        "Video",
        back_populates="movie",
        lazy="selectin",
        cascade="all, delete-orphan"
    )

    def to_search_document(self) -> dict:
        """Serialize movie attributes for indexing inside Elasticsearch."""
        return {
            "id": str(self.movie_id),
            "title": self.title,
            "description": self.description,
            "genres": [genre.name for genre in self.genres],
            "release_year": self.release_year,
            "duration_minutes": self.duration_minutes
        }
