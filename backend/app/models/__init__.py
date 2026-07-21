from app.database import Base
from app.models.user import User
from app.models.profile import Profile
from app.models.genre import Genre, movie_genres
from app.models.movie import Movie
from app.models.video import Video
from app.models.watch_history import WatchHistory
from app.models.movie_stats import MovieStats
from app.models.watchlist import Watchlist
from app.models.email_verification_token import EmailVerificationToken
from app.models.password_reset_token import PasswordResetToken
from app.models.rating import Rating

__all__ = [
    "Base", 
    "User", 
    "Profile", 
    "Genre", 
    "movie_genres", 
    "Movie", 
    "Video",
    "WatchHistory",
    "MovieStats",
    "Watchlist",
    "EmailVerificationToken", 
    "PasswordResetToken",
    "Rating"
]


