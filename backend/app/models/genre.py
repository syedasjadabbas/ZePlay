import uuid
from sqlalchemy import Column, String, Table, ForeignKey, UUID
from app.database import Base

# Many-to-many association table linking movies and genres
movie_genres = Table(
    "movie_genres",
    Base.metadata,
    Column(
        "movie_id", 
        UUID(as_uuid=True), 
        ForeignKey("movies.movie_id", ondelete="CASCADE"), 
        primary_key=True
    ),
    Column(
        "genre_id", 
        UUID(as_uuid=True), 
        ForeignKey("genres.genre_id", ondelete="CASCADE"), 
        primary_key=True
    )
)

class Genre(Base):
    __tablename__ = "genres"

    genre_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    name = Column(String, unique=True, index=True, nullable=False)
