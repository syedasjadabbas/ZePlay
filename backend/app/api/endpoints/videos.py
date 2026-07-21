import os
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, File, UploadFile, Form, Header, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.schemas.video import VideoResponse, VideoStreamInfo
from app.services import video_storage_service, video_processing_service
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
        "created_at": video.created_at,
        "updated_at": video.updated_at
    }

@router.post("/admin/upload", response_model=VideoResponse, status_code=status.HTTP_201_CREATED)
async def upload_video(
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
    # Process video into HLS VOD package
    processed_video = await video_processing_service.process_video_to_hls(db, video.video_id)
    return build_video_response(processed_video)

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
    db: AsyncSession = Depends(get_db)
):
    """
    Stream raw video asset using HTTP 206 Partial Content range requests (MP4 Fallback).
    """
    video = await video_storage_service.get_video_by_id(db, video_id)
    return video_storage_service.stream_video(video, range_header=range)

@router.get("/{video_id}/hls/master.m3u8")
async def get_hls_master_playlist(
    video_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Serves the HLS master/variant playlist file (.m3u8) for adaptive video playback.
    """
    video = await video_storage_service.get_video_by_id(db, video_id)
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

@router.get("/{video_id}/hls/{segment_name}")
async def get_hls_segment(
    video_id: UUID,
    segment_name: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Serves individual MPEG-TS video segment chunk files (.ts) for HLS streaming.
    """
    video = await video_storage_service.get_video_by_id(db, video_id)
    video_dir = os.path.dirname(video.storage_path)
    hls_dir = video.hls_path or os.path.join(video_dir, f"{video.video_id}_hls")
    segment_path = os.path.join(hls_dir, segment_name)

    if not os.path.exists(segment_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"HLS segment '{segment_name}' not found."
        )

    return FileResponse(
        segment_path,
        media_type="video/MP2T",
        filename=segment_name
    )

@router.delete("/admin/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_video(
    video_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_admin_user)
):
    """Admin endpoint to delete a video asset and its physical HLS directory on disk."""
    video = await video_storage_service.get_video_by_id(db, video_id)
    
    # Remove HLS directory if present
    if video.hls_path and os.path.exists(video.hls_path):
        try:
            shutil.rmtree(video.hls_path)
        except Exception:
            pass

    await video_storage_service.delete_video_asset(db, video_id)
    return None
