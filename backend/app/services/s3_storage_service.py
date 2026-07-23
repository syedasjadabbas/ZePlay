import logging
import os
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)

class S3StorageService:
    def __init__(self):
        self.bucket_name = getattr(settings, "S3_BUCKET_NAME", None)
        self.s3_client = None
        self._initialize_client()

    def _initialize_client(self):
        """Conditionally load boto3 to prevent crashes if it is missing."""
        if not self.bucket_name:
            logger.info("S3 storage bucket not configured. Falling back to local VPS disk.")
            return

        try:
            import boto3
            self.s3_client = boto3.client(
                "s3",
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID or os.environ.get("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or os.environ.get("AWS_SECRET_ACCESS_KEY"),
                region_name=settings.AWS_REGION or os.environ.get("AWS_REGION", "us-east-1")
            )
            logger.info(f"AWS S3 Client initialized for bucket: {self.bucket_name}")
        except Exception as e:
            logger.warning(f"Failed to initialize S3 client: {e}. Falling back to local storage.")

    async def upload_file(self, local_path: str, s3_key: str) -> Optional[str]:
        """Uploads a file to S3 and returns its public URL or CDN path."""
        if not self.s3_client or not self.bucket_name:
            return None

        try:
            # Execute upload blocking task inside execution threads
            import asyncio
            def _upload():
                self.s3_client.upload_file(local_path, self.bucket_name, s3_key)
            
            await asyncio.to_thread(_upload)
            
            # Form public/CDN access URL
            cdn_url = getattr(settings, "CLOUDFRONT_URL", None)
            if cdn_url:
                return f"{cdn_url.rstrip('/')}/{s3_key}"
            return f"https://{self.bucket_name}.s3.amazonaws.com/{s3_key}"
        except Exception as e:
            logger.error(f"S3 upload error for key '{s3_key}': {e}")
            return None

    async def upload_directory(self, local_dir: str, s3_prefix: str) -> bool:
        """Uploads an entire directory (like HLS segments) to S3 recursively."""
        if not self.s3_client or not self.bucket_name:
            return False

        try:
            import asyncio
            def _upload_dir():
                for root, _, files in os.walk(local_dir):
                    for file in files:
                        local_file_path = os.path.join(root, file)
                        # Construct S3 key relative to the directory structure
                        rel_path = os.path.relpath(local_file_path, local_dir)
                        # Replace OS path separators with forward slashes for S3 keys
                        s3_key = f"{s3_prefix.rstrip('/')}/{rel_path.replace(os.sep, '/')}"
                        
                        # Determine MIME type based on extension
                        content_type = None
                        if file.endswith(".m3u8"):
                            content_type = "application/x-mpegURL"
                        elif file.endswith(".ts"):
                            content_type = "video/MP2T"
                        
                        extra_args = {}
                        if content_type:
                            extra_args["ContentType"] = content_type
                            
                        self.s3_client.upload_file(
                            local_file_path,
                            self.bucket_name,
                            s3_key,
                            ExtraArgs=extra_args
                        )
            
            await asyncio.to_thread(_upload_dir)
            return True
        except Exception as e:
            logger.error(f"S3 directory upload error for prefix '{s3_prefix}': {e}")
            return False


# Global S3 storage service singleton
s3_storage = S3StorageService()
