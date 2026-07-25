import os
import logging
import asyncio
from typing import Optional, Dict
from app.config import settings

logger = logging.getLogger(__name__)

CONTENT_TYPE_MAP: Dict[str, str] = {
    ".m3u8": "application/vnd.apple.mpegurl",
    ".ts": "video/mp2t",
    ".mp4": "video/mp4",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".json": "application/json",
}

def get_content_type(file_path_or_key: str) -> str:
    """Returns appropriate MIME type based on file extension."""
    ext = os.path.splitext(file_path_or_key)[1].lower()
    return CONTENT_TYPE_MAP.get(ext, "application/octet-stream")

def sanitize_key(key: str) -> str:
    """
    Sanitizes object keys and protects against path traversal attempts.
    Rejects keys containing '..' or invalid control characters.
    """
    if ".." in key or "\0" in key:
        raise ValueError(f"Invalid object key '{key}': Path traversal detected.")
    
    # Normalize slashes and trim leading slashes
    clean_key = key.replace("\\", "/").lstrip("/")
    if not clean_key:
        raise ValueError("Object key cannot be empty.")
    return clean_key

class S3StorageService:
    """
    S3-Compatible Object Storage Service.
    Supports AWS S3, MinIO, Cloudflare R2, and custom S3-compatible endpoints.
    """
    def __init__(self):
        self.bucket_name = getattr(settings, "S3_BUCKET", None) or getattr(settings, "S3_BUCKET_NAME", None)
        self.endpoint_url = getattr(settings, "S3_ENDPOINT_URL", None)
        self.cdn_base_url = getattr(settings, "CDN_BASE_URL", None) or getattr(settings, "CLOUDFRONT_URL", None)
        self.s3_client = None
        self._initialize_client()

    def _initialize_client(self):
        """Initializes boto3 S3 client if S3 configuration is present."""
        if not self.bucket_name:
            logger.info("S3 bucket not configured. S3 storage service inactive.")
            return

        try:
            import boto3
            from botocore.config import Config

            extra_args = {}
            if self.endpoint_url:
                extra_args["endpoint_url"] = self.endpoint_url
                # MinIO path-style addressing support
                extra_args["config"] = Config(s3={"addressing_style": "path"})

            self.s3_client = boto3.client(
                "s3",
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID or os.environ.get("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or os.environ.get("AWS_SECRET_ACCESS_KEY"),
                region_name=settings.AWS_REGION or os.environ.get("AWS_REGION", "us-east-1"),
                **extra_args
            )
            logger.info(f"S3 Client initialized successfully (Bucket: {self.bucket_name}, Endpoint: {self.endpoint_url or 'AWS'})")
        except Exception as e:
            logger.warning(f"Failed to initialize S3 client: {e}. Operating in fallback mode.")

    def get_url(self, key: str) -> str:
        """Returns public/CDN URL for a given object key."""
        clean_k = sanitize_key(key)
        if self.cdn_base_url:
            return f"{self.cdn_base_url.rstrip('/')}/{clean_k}"
        if self.endpoint_url:
            return f"{self.endpoint_url.rstrip('/')}/{self.bucket_name}/{clean_k}"
        return f"https://{self.bucket_name}.s3.amazonaws.com/{clean_k}"

    async def exists(self, key: str) -> bool:
        """Checks if an object exists in S3 storage."""
        if not self.s3_client or not self.bucket_name:
            return False
        clean_k = sanitize_key(key)

        def _head():
            try:
                self.s3_client.head_object(Bucket=self.bucket_name, Key=clean_k)
                return True
            except Exception:
                return False

        return await asyncio.to_thread(_head)

    async def upload_file(self, local_path: str, key: str, content_type: Optional[str] = None) -> Optional[str]:
        """Uploads a local file to S3 with correct content type header."""
        if not self.s3_client or not self.bucket_name:
            return None
        clean_k = sanitize_key(key)
        ctype = content_type or get_content_type(local_path)

        def _upload():
            extra_args = {"ContentType": ctype}
            self.s3_client.upload_file(local_path, self.bucket_name, clean_k, ExtraArgs=extra_args)

        try:
            await asyncio.to_thread(_upload)
            return self.get_url(clean_k)
        except Exception as e:
            logger.error(f"S3 upload error for key '{clean_k}': {e}")
            return None

    async def upload_bytes(self, data: bytes, key: str, content_type: Optional[str] = None) -> Optional[str]:
        """Uploads raw bytes to S3 object key."""
        if not self.s3_client or not self.bucket_name:
            return None
        clean_k = sanitize_key(key)
        ctype = content_type or get_content_type(clean_k)

        def _put():
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=clean_k,
                Body=data,
                ContentType=ctype
            )

        try:
            await asyncio.to_thread(_put)
            return self.get_url(clean_k)
        except Exception as e:
            logger.error(f"S3 put_object error for key '{clean_k}': {e}")
            return None

    async def delete_object(self, key: str) -> bool:
        """Deletes an object from S3 storage."""
        if not self.s3_client or not self.bucket_name:
            return False
        clean_k = sanitize_key(key)

        def _delete():
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=clean_k)

        try:
            await asyncio.to_thread(_delete)
            return True
        except Exception as e:
            logger.error(f"S3 delete_object error for key '{clean_k}': {e}")
            return False

    async def upload_directory(self, local_dir: str, key_prefix: str) -> bool:
        """Recursively uploads an entire directory (e.g. HLS variants) to S3."""
        if not self.s3_client or not self.bucket_name:
            return False

        clean_prefix = sanitize_key(key_prefix)

        def _upload_dir():
            for root, _, files in os.walk(local_dir):
                for file in files:
                    local_file_path = os.path.join(root, file)
                    rel_path = os.path.relpath(local_file_path, local_dir)
                    s3_key = f"{clean_prefix.rstrip('/')}/{rel_path.replace(os.sep, '/')}"
                    ctype = get_content_type(file)
                    
                    self.s3_client.upload_file(
                        local_file_path,
                        self.bucket_name,
                        s3_key,
                        ExtraArgs={"ContentType": ctype}
                    )

        try:
            await asyncio.to_thread(_upload_dir)
            return True
        except Exception as e:
            logger.error(f"S3 directory upload error for prefix '{clean_prefix}': {e}")
            return False

# Global S3 storage service singleton instance
s3_storage = S3StorageService()
