import os
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, File, UploadFile, Form, Header, HTTPException, status, BackgroundTasks
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.schemas.video import VideoResponse, VideoStreamInfo
from app.services import video_storage_service, video_processing_service
from app.services.audit_log_service import log_event
from app.models.video import Video
from app.api import deps

router = APIRouter()

def build_video_response(video: Video) -> dict:
    """Helper to convert Video model into VideoResponse payload with playback_url and hls_url."""
    hls_url = video.master_playlist_url if (video.master_playlist_url and video.status == "completed") else None
    return {
        "video_id": video.video_id,
        "movie_id": video.movie_id,
        "filename": video.filename,
        "original_filename": video.original_filename,
        "storage_path": video.storage_path,
        "file_size_bytes": video.file_size_bytes,
        "mime_type": video.mime_type,
        "duration_seconds": video.duration_seconds,
        "width": video.width,
        "height": video.height,
        "status": video.status,
        "format": video.format,
        "master_playlist_url": video.master_playlist_url,
        "playback_url": f"/api/videos/{video.video_id}/stream",
        "hls_url": hls_url,
        "error_message": video.error_message,
        "processing_progress": getattr(video, 'processing_progress', 0.0),
        "created_at": video.created_at,
        "updated_at": video.updated_at
    }

@router.post("/admin/upload", response_model=VideoResponse, status_code=status.HTTP_201_CREATED)
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    movie_id: Optional[UUID] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_admin_user)
):
    """
    Admin endpoint to upload a video file to local storage.
    Automatically triggers background HLS segmentation.
    """
    video = await video_storage_service.save_uploaded_video(db, file, movie_id)
    
    # Initialize background task for transcoding and S3 upload
    background_tasks.add_task(
        video_processing_service.process_video_in_background,
        video.video_id
    )
    
    # Update video state in DB immediately to processing
    video.status = "processing"
    await db.commit()
    await db.refresh(video)
    
    await log_event(
        db,
        action="video_upload",
        details=f"Video asset '{video.original_filename}' uploaded and queued for background HLS transcoding.",
        performed_by=current_user.user_id,
        metadata_dict={"video_id": str(video.video_id), "filename": video.filename}
    )
    return build_video_response(video)

@router.post("/admin/{video_id}/process-hls", response_model=VideoResponse)
async def trigger_hls_processing(
    video_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_admin_user)
):
    """Admin endpoint to manually trigger or re-process video asset into HLS stream format."""
    try:
        video = await video_processing_service.process_video_to_hls(db, video_id)
        return build_video_response(video)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(err)
        )

@router.get("", response_model=List[VideoResponse])
async def list_videos(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """List all ingested video assets."""
    result = await db.execute(select(Video).order_by(Video.created_at.desc()))
    videos = result.scalars().all()
    return [build_video_response(v) for v in videos]

@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(
    video_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """Fetch metadata details for a specific video asset."""
    video = await video_storage_service.get_video_by_id(db, video_id)
    return build_video_response(video)

@router.get("/{video_id}/stream")
async def stream_video(
    video_id: UUID,
    range: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.verify_user_entitlement)
):
    """
    Stream raw video asset using HTTP 206 Partial Content range requests (MP4 Fallback).
    """
    video = await video_storage_service.get_video_by_id(db, video_id)
    return video_storage_service.stream_video(video, range_header=range)

@router.get("/{video_id}/hls/master.m3u8")
async def get_hls_master_playlist(
    video_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.verify_user_entitlement)
):
    """
    Serves the HLS master/variant playlist file (.m3u8) for adaptive video playback.
    """
    video = await video_storage_service.get_video_by_id(db, video_id)
    
    # CDN / S3 Redirect integration
    if video.master_playlist_url and video.master_playlist_url.startswith("http"):
        return RedirectResponse(video.master_playlist_url)

    video_dir = os.path.dirname(video.storage_path)
    hls_dir = video.hls_path or os.path.join(video_dir, f"{video.video_id}_hls")
    playlist_path = os.path.join(hls_dir, "master.m3u8")

    if not os.path.exists(playlist_path):
        # Auto-process if not yet processed
        video = await video_processing_service.process_video_to_hls(db, video_id)
        playlist_path = os.path.join(video.hls_path, "master.m3u8")

    if not os.path.exists(playlist_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="HLS master playlist not found."
        )

    return FileResponse(
        playlist_path,
        media_type="application/x-mpegURL",
        filename="master.m3u8"
    )

@router.get("/{video_id}/hls/{file_path:path}")
async def get_hls_file(
    video_id: UUID,
    file_path: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.verify_user_entitlement)
):
    """
    Serves HLS files (variant playlists, segment chunks) supporting multi-bitrate subdirectory layouts.
    """
    video = await video_storage_service.get_video_by_id(db, video_id)
    
    # CDN / S3 Redirect integration
    if video.master_playlist_url and video.master_playlist_url.startswith("http"):
        base_url = video.master_playlist_url.rsplit('/', 1)[0]
        return RedirectResponse(f"{base_url}/{file_path}")

    video_dir = os.path.dirname(video.storage_path)
    hls_dir = video.hls_path or os.path.join(video_dir, f"{video.video_id}_hls")
    target_path = os.path.join(hls_dir, file_path)

    if not os.path.exists(target_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"HLS asset '{file_path}' not found."
        )

    # Resolve media type dynamically
    media_type = "application/x-mpegURL"
    if file_path.endswith(".ts"):
        media_type = "video/MP2T"

    return FileResponse(
        target_path,
        media_type=media_type,
        filename=os.path.basename(file_path)
    )

@router.delete("/admin/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_video(
    video_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_admin_user)
):
    """Admin endpoint to delete a video asset and its physical HLS directory on disk."""
    video = await video_storage_service.get_video_by_id(db, video_id)
    video_filename = video.original_filename
    # Remove HLS directory if present
    if video.hls_path and os.path.exists(video.hls_path):
        try:
            shutil.rmtree(video.hls_path)
        except Exception:
            pass

    await video_storage_service.delete_video_asset(db, video_id)
    await log_event(
        db,
        action="video_delete",
        details=f"Video asset '{video_filename}' deleted.",
        performed_by=current_user.user_id,
        metadata_dict={"video_id": str(video_id), "original_filename": video_filename}
    )
    return None
