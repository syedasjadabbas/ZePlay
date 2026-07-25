import os
import pytest
from app.config import Settings
from app.services.s3_storage_service import (
    S3StorageService,
    get_content_type,
    sanitize_key,
)

def test_object_key_sanitization_and_path_traversal():
    """Test object key generation and path traversal protection."""
    # Valid keys
    assert sanitize_key("movies/123/hls/master.m3u8") == "movies/123/hls/master.m3u8"
    assert sanitize_key("\\movies\\123\\poster.jpg") == "movies/123/poster.jpg"
    assert sanitize_key("/movies/123/source.mp4") == "movies/123/source.mp4"

    # Path traversal attempts
    with pytest.raises(ValueError, match="Path traversal detected"):
        sanitize_key("movies/../../etc/passwd")

    with pytest.raises(ValueError, match="Path traversal detected"):
        sanitize_key("../movies/secret.key")

    with pytest.raises(ValueError, match="Path traversal detected"):
        sanitize_key("movies/123/\0malicious")

    with pytest.raises(ValueError, match="cannot be empty"):
        sanitize_key("/")

def test_content_type_mapping():
    """Test MIME type mapping for HLS, video, and image formats."""
    assert get_content_type("master.m3u8") == "application/vnd.apple.mpegurl"
    assert get_content_type("480p/segment_000.ts") == "video/mp2t"
    assert get_content_type("video.mp4") == "video/mp4"
    assert get_content_type("poster.jpg") == "image/jpeg"
    assert get_content_type("banner.png") == "image/png"
    assert get_content_type("unknown.xyz") == "application/octet-stream"

def test_config_validation_s3_backend():
    """Test configuration validation when STORAGE_BACKEND=s3."""
    # Missing required S3 config should raise ValueError
    with pytest.raises(ValueError, match="required S3 configuration"):
        Settings(
            DATABASE_URL="sqlite:///test.db",
            JWT_SECRET_KEY="secret",
            STORAGE_BACKEND="s3",
            S3_BUCKET="",
            AWS_ACCESS_KEY_ID="",
            AWS_SECRET_ACCESS_KEY="",
            MOCK_S3=False,
        )

    # Local backend without S3 config should succeed
    s_local = Settings(
        DATABASE_URL="sqlite:///test.db",
        JWT_SECRET_KEY="secret",
        STORAGE_BACKEND="local",
    )
    assert s_local.STORAGE_BACKEND == "local"

def test_s3_storage_service_get_url():
    """Test S3 URL generation with CDN, custom endpoint, and default S3."""
    svc = S3StorageService()
    svc.bucket_name = "zeplay-bucket"
    svc.cdn_base_url = "https://cdn.zeplay.tv"

    url = svc.get_url("movies/123/hls/master.m3u8")
    assert url == "https://cdn.zeplay.tv/movies/123/hls/master.m3u8"

    svc.cdn_base_url = None
    svc.endpoint_url = "http://127.0.0.1:9000"
    url_minio = svc.get_url("movies/123/hls/master.m3u8")
    assert url_minio == "http://127.0.0.1:9000/zeplay-bucket/movies/123/hls/master.m3u8"

    svc.endpoint_url = None
    url_s3 = svc.get_url("movies/123/hls/master.m3u8")
    assert url_s3 == "https://zeplay-bucket.s3.amazonaws.com/movies/123/hls/master.m3u8"
