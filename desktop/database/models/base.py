"""
Base Model dan Mixin Classes
"""
from sqlalchemy import Column, DateTime, String
from sqlalchemy.orm import declarative_base
from datetime import datetime
import uuid

Base = declarative_base()

def generate_sync_id() -> str:
    """Generate UUID untuk sinkronisasi antar device"""
    return str(uuid.uuid4())


class TimestampMixin:
    """Mixin untuk created_at dan updated_at"""
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)


class SyncMixin:
    """Mixin untuk sync_id dan last_sync"""
    sync_id = Column(String(36), unique=True, default=generate_sync_id, nullable=False, index=True)
    last_sync = Column(DateTime, nullable=True)

    def mark_synced(self):
        """Tandai record sudah di-sync"""
        self.last_sync = datetime.now()
