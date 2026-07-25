import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "ZePlay API"
    DATABASE_URL: str
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 11520

    # Production Database Connection Pooling Settings
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800

    # Resend email and frontend settings
    EMAIL_PROVIDER: str = "resend"
    EMAIL_FROM: str = "noreply@zeploy.tech"
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "onboarding@resend.dev"
    FRONTEND_URL: str = "https://ze-play.vercel.app"

    # SMTP email settings (Gmail SMTP)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""

    # Google OAuth/OpenID Settings
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Storage settings
    STORAGE_DIR: str = "storage/videos"
    STORAGE_BACKEND: str = "local"  # "local" or "s3"
    S3_BUCKET: str = ""
    S3_BUCKET_NAME: str = ""        # Alias for backward compatibility
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    S3_ENDPOINT_URL: str = ""       # For MinIO / S3-compatible endpoints
    CDN_BASE_URL: str = ""          # CDN URL prefix for public asset distribution
    CLOUDFRONT_URL: str = ""        # Alias for CloudFront
    MOCK_S3: bool = False

    # Redis cache settings
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_ENABLED: bool = True


    # Pydantic v2 configuration to find the .env file
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        case_sensitive=True,
        extra="ignore"
    )

    def __init__(self, **values):
        super().__init__(**values)
        # Synchronize bucket & CDN aliases
        if not self.S3_BUCKET and self.S3_BUCKET_NAME:
            self.S3_BUCKET = self.S3_BUCKET_NAME
        elif self.S3_BUCKET and not self.S3_BUCKET_NAME:
            self.S3_BUCKET_NAME = self.S3_BUCKET

        if not self.CDN_BASE_URL and self.CLOUDFRONT_URL:
            self.CDN_BASE_URL = self.CLOUDFRONT_URL
        elif self.CDN_BASE_URL and not self.CLOUDFRONT_URL:
            self.CLOUDFRONT_URL = self.CDN_BASE_URL

        # Validate S3 backend configuration in production mode
        if self.STORAGE_BACKEND.lower() == "s3" and not self.MOCK_S3:
            if not self.S3_BUCKET or not self.AWS_ACCESS_KEY_ID or not self.AWS_SECRET_ACCESS_KEY:
                raise ValueError(
                    "STORAGE_BACKEND is set to 's3' but required S3 configuration "
                    "(S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) is missing."
                )

        # Parse and resolve relative SQLite database URLs to absolute paths
        if self.DATABASE_URL.startswith("sqlite"):
            # Find backend folder (parent of app folder where this config.py resides)
            backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            
            for prefix in ["sqlite+aiosqlite:///", "sqlite:///"]:
                if self.DATABASE_URL.startswith(prefix):
                    db_path = self.DATABASE_URL[len(prefix):]
                    clean_path = db_path
                    if clean_path.startswith("./"):
                        clean_path = clean_path[2:]
                    elif clean_path.startswith(".\\"):
                        clean_path = clean_path[2:]
                    
                    if clean_path == ":memory:":
                        break
                    
                    if not os.path.isabs(clean_path):
                        abs_path = os.path.abspath(os.path.join(backend_dir, clean_path))
                    else:
                        abs_path = os.path.abspath(clean_path)
                    
                    abs_path_str = abs_path.replace("\\", "/")
                    self.DATABASE_URL = f"{prefix}{abs_path_str}"
                    break


settings = Settings()

