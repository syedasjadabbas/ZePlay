import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, DateTime, ForeignKey, UniqueConstraint, UUID
from sqlalchemy.orm import relationship
from app.database import Base

class Rating(Base):
    __tablename__ = "ratings"

    rating_id = Column(
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

    score = Column(Integer, nullable=False)  # 1 to 5 stars

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

    __table_args__ = (
        UniqueConstraint("profile_id", "movie_id", name="uq_profile_movie_rating"),
    )

    user = relationship("User")
    profile = relationship("Profile")
    movie = relationship("Movie")
