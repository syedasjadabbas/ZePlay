import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, UUID
from sqlalchemy.orm import relationship
from app.database import Base

class MovieStats(Base):
    __tablename__ = "movie_stats"

    stats_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    movie_id = Column(
        UUID(as_uuid=True),
        ForeignKey("movies.movie_id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True
    )
    view_count = Column(Integer, default=0, nullable=False)
    watch_count = Column(Integer, default=0, nullable=False)
    popularity_score = Column(Float, default=0.0, nullable=False)
    last_viewed_at = Column(
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

    movie = relationship("Movie", backref="stats", lazy="selectin")
