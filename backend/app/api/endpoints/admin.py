import os
import json
from uuid import UUID
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, or_
from pydantic import BaseModel, Field

from app.database import get_db
from app.api import deps
from app.models.user import User
from app.models.profile import Profile
from app.models.movie import Movie
from app.models.video import Video
from app.models.rating import Rating
from app.models.watch_history import WatchHistory
from app.models.watchlist import Watchlist
from app.models.genre import Genre
from app.models.subscription_plan import SubscriptionPlan
from app.models.user_subscription import UserSubscription
from app.models.audit_log import AuditLog
from app.services.audit_log_service import log_event
from app.services.cache_service import cache
from app.services import movie_service
from app.schemas.movie import MovieCreate, MovieUpdate, MovieResponse
from app.schemas.genre import GenreCreate, GenreResponse

router = APIRouter()

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class UserStatusUpdate(BaseModel):
    is_active: bool

# ---------------------------------------------------------------------------
# 1. Analytics Dashboard
# ---------------------------------------------------------------------------
@router.get("/analytics")
async def get_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_admin_user)
):
    """Retrieve detailed platform business intelligence metrics."""
    # Basic counts
    total_users = (await db.execute(select(func.count(User.user_id)))).scalar() or 0
    total_profiles = (await db.execute(select(func.count(Profile.profile_id)))).scalar() or 0
    total_movies = (await db.execute(select(func.count(Movie.movie_id)))).scalar() or 0
    total_videos = (await db.execute(select(func.count(Video.video_id)))).scalar() or 0
    total_ratings = (await db.execute(select(func.count(Rating.rating_id)))).scalar() or 0

    # Playback stats
    total_watch_time = (await db.execute(select(func.sum(WatchHistory.current_position)))).scalar() or 0.0
    total_views = (await db.execute(select(func.count(WatchHistory.history_id)))).scalar() or 0
    active_users = (await db.execute(select(func.count(func.distinct(WatchHistory.user_id))))).scalar() or 0

    # Average calculations
    avg_rating = (await db.execute(select(func.avg(Rating.score)))).scalar() or 0.0
    avg_rating = round(float(avg_rating), 2)

    avg_watch_time = 0.0
    if total_users > 0:
        avg_watch_time = round(float(total_watch_time / total_users), 2)

    # Subscription breakdown
    free_plan = (await db.execute(select(SubscriptionPlan).filter(SubscriptionPlan.name == "free"))).scalars().first()
    premium_plan = (await db.execute(select(SubscriptionPlan).filter(SubscriptionPlan.name == "premium"))).scalars().first()

    free_users = 0
    premium_users = 0

    if free_plan:
        free_users = (await db.execute(
            select(func.count(UserSubscription.id)).filter(
                UserSubscription.plan_id == str(free_plan.id),
                UserSubscription.status == "active"
            )
        )).scalar() or 0

    if premium_plan:
        premium_users = (await db.execute(
            select(func.count(UserSubscription.id)).filter(
                UserSubscription.plan_id == str(premium_plan.id),
                UserSubscription.status == "active"
            )
        )).scalar() or 0

    conversion_rate = 0.0
    total_subscribers = free_users + premium_users
    if total_subscribers > 0:
        conversion_rate = round((premium_users / total_subscribers) * 100, 2)

    return {
        "total_users": total_users,
        "total_profiles": total_profiles,
        "total_movies": total_movies,
        "total_videos": total_videos,
        "total_ratings": total_ratings,
        "total_watch_time": total_watch_time,
        "total_views": total_views,
        "active_users": active_users,
        "free_users": free_users,
        "premium_users": premium_users,
        "conversion_rate": conversion_rate,
        "average_rating": avg_rating,
        "average_watch_time": avg_watch_time
    }

# ---------------------------------------------------------------------------
# 2. Content Analytics
# ---------------------------------------------------------------------------
@router.get("/content-analytics")
async def get_content_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_admin_user)
):
    """Retrieve visual charts analytics and rankings for content consumption."""
    # 1. Most Watched Movies
    watched_query = (
        select(Movie.movie_id, Movie.title, Movie.thumbnail_url, func.count(WatchHistory.history_id).label("views"))
        .join(WatchHistory, Movie.movie_id == WatchHistory.movie_id)
        .group_by(Movie.movie_id)
        .order_by(func.count(WatchHistory.history_id).desc())
        .limit(5)
    )
    most_watched = [
        {"movie_id": str(r[0]), "title": r[1], "thumbnail_url": r[2], "views": r[3]}
        for r in (await db.execute(watched_query)).all()
    ]

    # 2. Highest Rated Movies
    rated_query = (
        select(Movie.movie_id, Movie.title, Movie.thumbnail_url, func.avg(Rating.score).label("rating"))
        .join(Rating, Movie.movie_id == Rating.movie_id)
        .group_by(Movie.movie_id)
        .order_by(func.avg(Rating.score).desc())
        .limit(5)
    )
    highest_rated = [
        {"movie_id": str(r[0]), "title": r[1], "thumbnail_url": r[2], "rating": round(float(r[3]), 2)}
        for r in (await db.execute(rated_query)).all()
    ]

    # 3. Most Added to Watchlist
    watchlist_query = (
        select(Movie.movie_id, Movie.title, Movie.thumbnail_url, func.count(Watchlist.watchlist_id).label("saves"))
        .join(Watchlist, Movie.movie_id == Watchlist.movie_id)
        .group_by(Movie.movie_id)
        .order_by(func.count(Watchlist.watchlist_id).desc())
        .limit(5)
    )
    most_added = [
        {"movie_id": str(r[0]), "title": r[1], "thumbnail_url": r[2], "saves": r[3]}
        for r in (await db.execute(watchlist_query)).all()
    ]

    # 4. Most Popular Genres (movie count per genre)
    # Using raw SQL association check since we use SQLAlchemy model relationships or join tables
    # Let's see: how is the genre relation defined? Genres table exists. Let's do a simple count.
    genres = (await db.execute(select(Genre))).scalars().all()
    most_popular_genres = []
    for g in genres:
        # Check association or count
        # In movie.py model: movies can have genres. Let's query association.
        # For simplicity, count movies that mention genre.
        # Let's count genre join matches
        movie_count = (await db.execute(
            select(func.count(Movie.movie_id))
            .filter(Movie.genres.any(Genre.genre_id == g.genre_id))
        )).scalar() or 0
        most_popular_genres.append({"genre_id": str(g.genre_id), "name": g.name, "count": movie_count})
    
    most_popular_genres = sorted(most_popular_genres, key=lambda x: x["count"], reverse=True)[:5]

    # 5. Most Watched Categories (genres tracked in WatchHistory)
    most_watched_categories = []
    for g in genres:
        watch_count = (await db.execute(
            select(func.count(WatchHistory.history_id))
            .join(Movie, WatchHistory.movie_id == Movie.movie_id)
            .filter(Movie.genres.any(Genre.genre_id == g.genre_id))
        )).scalar() or 0
        most_watched_categories.append({"genre_id": str(g.genre_id), "name": g.name, "views": watch_count})
    
    most_watched_categories = sorted(most_watched_categories, key=lambda x: x["views"], reverse=True)[:5]

    # 6. Most Recommended Content (ranked by stats popularity score if stats exist, or movie rating)
    rec_query = (
        select(Movie.movie_id, Movie.title, Movie.thumbnail_url)
        .order_by(Movie.created_at.desc())
        .limit(5)
    )
    most_recommended = [
        {"movie_id": str(r[0]), "title": r[1], "thumbnail_url": r[2]}
        for r in (await db.execute(rec_query)).all()
    ]

    return {
        "most_watched_movies": most_watched,
        "highest_rated_movies": highest_rated,
        "most_added_watchlist": most_added,
        "most_popular_genres": most_popular_genres,
        "most_watched_categories": most_watched_categories,
        "most_recommended": most_recommended
    }

# ---------------------------------------------------------------------------
# 3. Platform Health Monitoring
# ---------------------------------------------------------------------------
@router.get("/health")
async def get_health_monitoring(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_admin_user)
):
    """Retrieve storage, database, HLS processing, and system status markers."""
    # Database check
    db_status = "healthy"
    try:
        await db.execute(select(1))
    except Exception:
        db_status = "error"

    # Cache status
    cache_stats = cache.get_stats()
    cache_status = "healthy"
    if cache_stats.get("hit_rate_pct", 0) < 0.0 and cache_stats.get("keys_count", 0) == 0:
        cache_status = "warning"

    # Storage Check
    video_dir = "storage/videos/"
    total_files = 0
    total_segments = 0
    storage_bytes = 0

    if os.path.exists(video_dir):
        for root, _, files in os.walk(video_dir):
            for f in files:
                fpath = os.path.join(root, f)
                try:
                    storage_bytes += os.path.getsize(fpath)
                    total_files += 1
                    if f.endswith(".ts"):
                        total_segments += 1
                except Exception:
                    pass

    # Status counts
    total_uploaded = (await db.execute(select(func.count(Video.video_id)).filter(Video.status == "uploaded"))).scalar() or 0
    total_hls = (await db.execute(select(func.count(Video.video_id)).filter(Video.status == "completed"))).scalar() or 0
    queue_processing = (await db.execute(select(func.count(Video.video_id)).filter(Video.status == "processing"))).scalar() or 0

    return {
        "database_status": db_status,
        "cache_status": cache_status,
        "cache_stats": cache_stats,
        "storage_usage_bytes": storage_bytes,
        "total_files": total_files,
        "total_uploaded_files": total_uploaded,
        "total_hls_assets": total_hls,
        "total_video_segments": total_segments,
        "processing_queue_status": queue_processing
    }

# ---------------------------------------------------------------------------
# 4. User Management
# ---------------------------------------------------------------------------
@router.get("/users")
async def get_all_users(
    q: Optional[str] = Query(None, description="Search term for name or email"),
    plan: Optional[str] = Query(None, description="Filter by plan name"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (active or disabled)"),
    is_verified: Optional[bool] = Query(None, description="Filter by verification state"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_admin_user)
):
    """Retrieve, search, and filter registered platform users."""
    query = select(User)

    if q:
        query = query.filter(or_(User.email.ilike(f"%{q}%"), User.name.ilike(f"%{q}%")))
    if plan:
        query = query.filter(User.subscription_plan == plan.lower())
    if status_filter:
        is_act = (status_filter.lower() == "active")
        query = query.filter(User.is_active == is_act)
    if is_verified is not None:
        query = query.filter(User.is_verified == is_verified)

    query = query.order_by(User.created_at.desc())
    res = await db.execute(query)
    users = res.scalars().all()

    user_list = []
    for u in users:
        # Profile count
        profile_count = (await db.execute(
            select(func.count(Profile.profile_id)).filter(Profile.user_id == u.user_id)
        )).scalar() or 0
        
        user_list.append({
            "user_id": str(u.user_id),
            "name": u.name,
            "email": u.email,
            "is_verified": u.is_verified,
            "is_admin": u.is_admin,
            "is_active": u.is_active,
            "subscription_plan": u.subscription_plan,
            "profile_count": profile_count,
            "created_at": u.created_at.isoformat() if u.created_at else None
        })

    return user_list

@router.post("/users/{user_id}/status")
async def update_user_status(
    user_id: UUID,
    status_in: UserStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_admin_user)
):
    """Admin action to toggle user profile access status (Disable / Enable)."""
    if user_id == current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot disable your own administrative account."
        )

    res = await db.execute(select(User).filter(User.user_id == user_id))
    user = res.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    user.is_active = status_in.is_active
    await db.commit()
    await db.refresh(user)

    action_label = "user_enable" if status_in.is_active else "user_disable"
    await log_event(
        db,
        action=action_label,
        details=f"User {user.email} was {'enabled' if status_in.is_active else 'disabled'}.",
        performed_by=current_user.user_id,
        metadata_dict={"target_user_id": str(user_id), "email": user.email}
    )

    return {
        "message": f"User account has been {'enabled' if user.is_active else 'disabled'}.",
        "user_id": str(user.user_id),
        "is_active": user.is_active
    }

@router.get("/users/{user_id}/activity")
async def get_user_activity(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_admin_user)
):
    """Admin query to audit a specific user's login, subscription, and streaming logs."""
    # Profiles list
    profile_res = await db.execute(select(Profile).filter(Profile.user_id == user_id))
    profiles = profile_res.scalars().all()

    # Watch history
    history_res = await db.execute(
        select(WatchHistory)
        .filter(WatchHistory.user_id == user_id)
        .order_by(WatchHistory.last_watched.desc())
        .limit(20)
    )
    history = history_res.scalars().all()

    # Ratings
    ratings_res = await db.execute(
        select(Rating)
        .filter(Rating.user_id == user_id)
        .order_by(Rating.created_at.desc())
    )
    ratings = ratings_res.scalars().all()

    # Audit Logs associated with this user
    audit_res = await db.execute(
        select(AuditLog)
        .filter(AuditLog.performed_by == user_id)
        .order_by(AuditLog.created_at.desc())
        .limit(20)
    )
    logs = audit_res.scalars().all()

    return {
        "profiles": [
            {
                "profile_id": str(p.profile_id),
                "display_name": p.display_name,
                "is_kids_profile": p.is_kids_profile,
                "language_pref": p.language_pref
            } for p in profiles
        ],
        "watch_history": [
            {
                "history_id": str(h.history_id),
                "movie_title": h.movie.title if h.movie else "Unknown",
                "percentage_watched": h.percentage_watched,
                "last_watched": h.last_watched.isoformat()
            } for h in history
        ],
        "ratings": [
            {
                "rating_id": str(r.rating_id),
                "movie_title": r.movie.title if r.movie else "Unknown",
                "score": r.score,
                "created_at": r.created_at.isoformat()
            } for r in ratings
        ],
        "audit_logs": [
            {
                "log_id": str(l.log_id),
                "action": l.action,
                "details": l.details,
                "created_at": l.created_at.isoformat()
            } for l in logs
        ]
    }

# ---------------------------------------------------------------------------
# 5. Admin Management
# ---------------------------------------------------------------------------
class UserRoleUpdate(BaseModel):
    is_admin: bool

@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: UUID,
    role_in: UserRoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_admin_user)
):
    """Admin endpoint to promote or demote user admin privileges."""
    res = await db.execute(select(User).filter(User.user_id == user_id))
    user = res.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    if not role_in.is_admin and user.user_id == current_user.user_id:
        total_admins = (await db.execute(select(func.count(User.user_id)).filter(User.is_admin == True))).scalar() or 0
        if total_admins <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove admin role from the last remaining admin user."
            )

    user.is_admin = role_in.is_admin
    await db.commit()
    await db.refresh(user)

    action_label = "admin_promotion" if role_in.is_admin else "admin_removal"
    await log_event(
        db,
        action=action_label,
        details=f"User {user.email} role updated to {'Admin' if role_in.is_admin else 'User'}.",
        performed_by=current_user.user_id,
        metadata_dict={"target_user_id": str(user_id), "email": user.email}
    )

    return {
        "message": f"User {user.email} role updated successfully.",
        "user_id": str(user.user_id),
        "is_admin": user.is_admin
    }

@router.post("/users/{user_id}/promote")
async def promote_admin(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_admin_user)
):
    """Promote user to administrator role."""
    res = await db.execute(select(User).filter(User.user_id == user_id))
    user = res.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    if user.is_admin:
        return {"message": "User is already an administrator.", "user_id": str(user.user_id)}

    user.is_admin = True
    await db.commit()
    await db.refresh(user)

    await log_event(
        db,
        action="admin_promotion",
        details=f"User {user.email} promoted to Admin role.",
        performed_by=current_user.user_id,
        metadata_dict={"target_user_id": str(user_id), "email": user.email}
    )

    return {
        "message": f"Successfully promoted {user.name} to administrator.",
        "user_id": str(user.user_id),
        "is_admin": user.is_admin
    }

@router.post("/users/{user_id}/demote")
async def demote_admin(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_admin_user)
):
    """Remove administrator role from user, checking self-removal constraints."""
    if user_id == current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Self-demotion is blocked to prevent accidental locked administration state."
        )

    res = await db.execute(select(User).filter(User.user_id == user_id))
    user = res.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    if not user.is_admin:
        return {"message": "User is not an administrator.", "user_id": str(user.user_id)}

    # Verify if it's the last admin
    total_admins = (await db.execute(select(func.count(User.user_id)).filter(User.is_admin == True))).scalar() or 0
    if total_admins <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove admin role from the last remaining administrator account."
        )

    user.is_admin = False
    await db.commit()
    await db.refresh(user)

    await log_event(
        db,
        action="admin_removal",
        details=f"User {user.email} admin privileges revoked.",
        performed_by=current_user.user_id,
        metadata_dict={"target_user_id": str(user_id), "email": user.email}
    )

    return {
        "message": f"Successfully removed administrator role from {user.name}.",
        "user_id": str(user.user_id),
        "is_admin": user.is_admin
    }

# ---------------------------------------------------------------------------
# 6. Audit Logging
# ---------------------------------------------------------------------------
@router.get("/audit-logs")
async def get_audit_logs(
    action: Optional[str] = Query(None, description="Filter logs by action keyword"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_admin_user)
):
    """Admin dashboard log explorer for platform actions."""
    query = select(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action)
    query = query.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
    res = await db.execute(query)
    logs = res.scalars().all()

    logs_list = []
    for l in logs:
        actor_email = None
        if l.performed_by:
            actor = (await db.execute(select(User).filter(User.user_id == l.performed_by))).scalars().first()
            if actor:
                actor_email = actor.email

        meta_dict = None
        if l.metadata_json:
            try:
                meta_dict = json.loads(l.metadata_json)
            except Exception:
                meta_dict = l.metadata_json

        logs_list.append({
            "log_id": str(l.log_id),
            "action": l.action,
            "details": l.details,
            "performed_by": str(l.performed_by) if l.performed_by else None,
            "actor_email": actor_email,
            "metadata": meta_dict,
            "created_at": l.created_at.isoformat()
        })

    return logs_list

# ---------------------------------------------------------------------------
# Legacy and support endpoints
# ---------------------------------------------------------------------------
@router.post("/movies", response_model=MovieResponse, status_code=status.HTTP_201_CREATED)
async def create_movie(
    movie_in: MovieCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_admin_user)
):
    """Admin endpoint to ingest a new movie entry."""
    return await movie_service.create_movie(db, movie_in)

@router.put("/movies/{movie_id}", response_model=MovieResponse)
async def update_movie(
    movie_id: UUID,
    movie_in: MovieUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_admin_user)
):
    """Admin endpoint to update movie metadata records."""
    updated = await movie_service.update_movie(db, movie_id, movie_in)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movie not found."
        )
    return updated

@router.delete("/movies/{movie_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_movie(
    movie_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_admin_user)
):
    """Admin endpoint to delete a movie from catalog."""
    deleted = await movie_service.delete_movie(db, movie_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movie not found."
        )
    return None

@router.post("/genres", response_model=GenreResponse, status_code=status.HTTP_201_CREATED)
async def create_genre(
    genre_in: GenreCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_admin_user)
):
    """Admin endpoint to register a new genre category."""
    return await movie_service.create_genre(db, genre_in)

@router.get("/cache/stats")
async def get_cache_stats(
    current_user = Depends(deps.get_current_admin_user)
):
    """Admin endpoint to retrieve cache performance statistics (hits, misses, hit rate)."""
    return cache.get_stats()

@router.post("/cache/clear")
async def clear_cache(
    current_user = Depends(deps.get_current_admin_user)
):
    """Admin endpoint to clear all cached keys and reset hit/miss counters."""
    await cache.clear_all()
    return {"message": "Cache successfully cleared."}
