import os
import uuid
import re
from typing import Optional, Tuple, AsyncGenerator
from uuid import UUID
from fastapi import UploadFile, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.video import Video
from app.models.movie import Movie
from app.config import settings

def get_storage_path() -> str:
    """Returns absolute path to the local video storage directory and ensures it exists."""
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    storage_dir = os.path.join(base_dir, settings.STORAGE_DIR)
    os.makedirs(storage_dir, exist_ok=True)
    return storage_dir

async def save_uploaded_video(
    db: AsyncSession,
    file: UploadFile,
    movie_id: Optional[UUID] = None
) -> Video:
    """
    Saves an uploaded video file to local storage in chunks,
    extracts metadata, and creates a database Video record.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must have a valid filename."
        )

    # Validate mime type
    mime_type = file.content_type or "video/mp4"
    if not (mime_type.startswith("video/") or mime_type in ["application/x-mpegURL", "application/octet-stream"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file content type '{mime_type}'. Must be a video file."
        )

    # Validate attached movie if provided
    if movie_id:
        movie_result = await db.execute(select(Movie).filter(Movie.movie_id == movie_id))
        movie = movie_result.scalars().first()
        if not movie:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Movie with ID {movie_id} not found."
            )

    # Generate unique filename on disk
    ext = os.path.splitext(file.filename)[1].lower() or ".mp4"
    unique_filename = f"{uuid.uuid4()}{ext}"
    storage_dir = get_storage_path()
    file_path = os.path.join(storage_dir, unique_filename)

    # Save to disk in 1MB chunks
    file_size = 0
    chunk_size = 1024 * 1024  # 1MB
    try:
        with open(file_path, "wb") as out_file:
            while chunk := await file.read(chunk_size):
                out_file.write(chunk)
                file_size += len(chunk)
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to write video file to storage: {str(e)}"
        )

    container_format = ext.lstrip(".") or "mp4"

    # Create Video record
    db_video = Video(
        movie_id=movie_id,
        filename=unique_filename,
        original_filename=file.filename,
        storage_path=file_path,
        file_size_bytes=file_size,
        mime_type=mime_type,
        format=container_format,
        status="READY"
    )
    db.add(db_video)
    await db.commit()
    await db.refresh(db_video)

    # Also update movie video_url if movie_id attached
    if movie_id:
        movie_result = await db.execute(select(Movie).filter(Movie.movie_id == movie_id))
        movie = movie_result.scalars().first()
        if movie:
            movie.video_url = f"/api/videos/{db_video.video_id}/stream"
            await db.commit()

    return db_video

def parse_range_header(range_header: str, file_size: int) -> Tuple[int, int]:
    """Parses standard HTTP Range header string (e.g. 'bytes=0-1024')."""
    match = re.match(r"bytes=(\d*)-(\d*)", range_header)
    if not match:
        return 0, file_size - 1

    start_str, end_str = match.groups()
    start = int(start_str) if start_str else 0
    end = int(end_str) if end_str else file_size - 1

    if start >= file_size:
        raise HTTPException(
            status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
            detail="Requested range out of bounds."
        )

    end = min(end, file_size - 1)
    return start, end

async def ranged_file_generator(file_path: str, start: int, end: int, chunk_size: int = 1024 * 512) -> AsyncGenerator[bytes, None]:
    """Asynchronous generator that yields byte chunks for range requests."""
    with open(file_path, "rb") as file:
        file.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            bytes_to_read = min(remaining, chunk_size)
            data = file.read(bytes_to_read)
            if not data:
                break
            remaining -= len(data)
            yield data

def stream_video(video: Video, range_header: Optional[str] = None) -> StreamingResponse:
    """
    Constructs a FastAPI StreamingResponse supporting HTTP 206 Partial Content range streaming
    for HTML5 video player seeking and partial chunk loading.
    """
    if not os.path.exists(video.storage_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video asset file not found on disk."
        )

    file_size = os.path.getsize(video.storage_path)

    if range_header:
        start, end = parse_range_header(range_header, file_size)
        content_length = end - start + 1
        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": video.mime_type,
        }
        return StreamingResponse(
            ranged_file_generator(video.storage_path, start, end),
            status_code=status.HTTP_206_PARTIAL_CONTENT,
            headers=headers
        )

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
        "Content-Type": video.mime_type,
    }
    return StreamingResponse(
        ranged_file_generator(video.storage_path, 0, file_size - 1),
        status_code=status.HTTP_200_OK,
        headers=headers
    )

async def get_video_by_id(db: AsyncSession, video_id: UUID) -> Video:
    """Fetches a Video record by ID or raises 404."""
    result = await db.execute(select(Video).filter(Video.video_id == video_id))
    video = result.scalars().first()
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video record not found."
        )
    return video

async def delete_video_asset(db: AsyncSession, video_id: UUID) -> bool:
    """Deletes a Video record and removes its physical file from disk."""
    video = await get_video_by_id(db, video_id)
    
    # Remove file from storage if present
    if os.path.exists(video.storage_path):
        try:
            os.remove(video.storage_path)
        except Exception:
            pass

    await db.delete(video)
    await db.commit()
    return True
