import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, UUID, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    log_id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    action = Column(String, nullable=False, index=True) # e.g. "admin_promotion", "admin_removal", "video_upload", "video_deletion", "subscription_change"
    details = Column(Text, nullable=True) # JSON or detailed description
    metadata_json = Column(Text, nullable=True)
    performed_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.user_id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True
    )

    # Relationship to user
    user = relationship("User")
