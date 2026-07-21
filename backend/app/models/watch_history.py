import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, Float, DateTime, ForeignKey, UniqueConstraint, UUID
from sqlalchemy.orm import relationship
from app.database import Base

class WatchHistory(Base):
    __tablename__ = "watch_history"

    history_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    profile_id = Column(
        UUID(as_uuid=True),
        ForeignKey("profiles.profile_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    movie_id = Column(
        UUID(as_uuid=True),
        ForeignKey("movies.movie_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    video_id = Column(
        UUID(as_uuid=True),
        ForeignKey("videos.video_id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )

    current_position = Column(Float, default=0.0, nullable=False)   # In seconds
    duration = Column(Float, default=0.0, nullable=False)           # Total asset duration in seconds
    percentage_watched = Column(Float, default=0.0, nullable=False) # (current_position / duration) * 100

    last_watched = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True
    )
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Unique constraint per profile + movie pair
    __table_args__ = (
        UniqueConstraint("profile_id", "movie_id", name="uq_profile_movie_watch_history"),
    )

    # Relationships
    user = relationship("User")
    profile = relationship("Profile")
    movie = relationship("Movie")
    video = relationship("Video")
