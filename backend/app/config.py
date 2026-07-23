import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "ZePlay API"
    DATABASE_URL: str
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 11520
    
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

    # Storage settings
    STORAGE_DIR: str = "storage/videos"
    S3_BUCKET_NAME: str = ""
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    CLOUDFRONT_URL: str = ""
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

