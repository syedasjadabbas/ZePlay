from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.watch_history import ProgressUpdate, WatchHistoryResponse
from app.services import watch_history_service
from app.api import deps

router = APIRouter()

def build_history_response(item) -> dict:
    """Helper to structure WatchHistory model with movie playback URLs."""
    movie_dict = None
    if item.movie:
        movie_dict = {
            "movie_id": item.movie.movie_id,
            "title": item.movie.title,
            "description": item.movie.description,
            "release_year": item.movie.release_year,
            "duration_minutes": item.movie.duration_minutes,
            "thumbnail_url": item.movie.thumbnail_url,
            "video_url": item.movie.video_url,
            "created_at": item.movie.created_at,
            "updated_at": item.movie.updated_at
        }

    video_dict = None
    if item.video:
        hls_url = item.video.master_playlist_url if (item.video.master_playlist_url and item.video.status == "completed") else None
        video_dict = {
            "video_id": item.video.video_id,
            "movie_id": item.video.movie_id,
            "filename": item.video.filename,
            "original_filename": item.video.original_filename,
            "storage_path": item.video.storage_path,
            "file_size_bytes": item.video.file_size_bytes,
            "mime_type": item.video.mime_type,
            "duration_seconds": item.video.duration_seconds,
            "width": item.video.width,
            "height": item.video.height,
            "status": item.video.status,
            "format": item.video.format,
            "master_playlist_url": item.video.master_playlist_url,
            "playback_url": f"/api/videos/{item.video.video_id}/stream",
            "hls_url": hls_url,
            "error_message": item.video.error_message,
            "created_at": item.video.created_at,
            "updated_at": item.video.updated_at
        }

    return {
        "history_id": item.history_id,
        "user_id": item.user_id,
        "profile_id": item.profile_id,
        "movie_id": item.movie_id,
        "video_id": item.video_id,
        "current_position": item.current_position,
        "duration": item.duration,
        "percentage_watched": item.percentage_watched,
        "last_watched": item.last_watched,
        "created_at": item.created_at,
        "movie": movie_dict,
        "video": video_dict
    }

@router.post("/progress", response_model=WatchHistoryResponse)
async def update_progress(
    progress_in: ProgressUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Saves or updates current video playback progress for a profile.
    Automatically updates percentage_watched and last_watched timestamp.
    """
    try:
        item = await watch_history_service.upsert_playback_progress(
            db, current_user.user_id, progress_in
        )
        return build_history_response(item)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )

@router.get("/continue-watching", response_model=List[WatchHistoryResponse])
async def get_continue_watching(
    profile_id: UUID = Query(...),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Returns active Continue Watching items for the specified profile (in-progress content).
    """
    try:
        items = await watch_history_service.get_continue_watching_list(
            db, current_user.user_id, profile_id, limit=limit
        )
        return [build_history_response(item) for item in items]
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )

@router.get("/progress/{movie_id}", response_model=Optional[WatchHistoryResponse])
async def get_progress(
    movie_id: UUID,
    profile_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Fetches stored watch history & progress position for a single movie and profile.
    """
    try:
        item = await watch_history_service.get_item_progress(
            db, current_user.user_id, profile_id, movie_id
        )
        if not item:
            return None
        return build_history_response(item)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )

@router.get("/", response_model=List[WatchHistoryResponse])
async def get_watch_history(
    profile_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Retrieves complete watch history log for the specified profile.
    """
    try:
        items = await watch_history_service.get_full_watch_history(
            db, current_user.user_id, profile_id
        )
        return [build_history_response(item) for item in items]
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err)
        )

@router.delete("/{history_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_history_entry(
    history_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Removes an item from watch history.
    """
    success = await watch_history_service.delete_watch_history_item(
        db, current_user.user_id, history_id
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Watch history item not found or unauthorized."
        )
    return None
