import json
from typing import Optional, Any, Dict
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog

async def log_event(
    db: AsyncSession,
    action: str,
    details: str,
    performed_by: Optional[UUID] = None,
    metadata_dict: Optional[Dict[str, Any]] = None
) -> AuditLog:
    """Creates a new audit log entry in the database."""
    metadata_json = None
    if metadata_dict is not None:
        try:
            metadata_json = json.dumps(metadata_dict)
        except Exception:
            metadata_json = str(metadata_dict)

    log_entry = AuditLog(
        action=action,
        details=details,
        performed_by=performed_by,
        metadata_json=metadata_json
    )
    db.add(log_entry)
    await db.commit()
    await db.refresh(log_entry)
    return log_entry
