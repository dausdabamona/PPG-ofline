"""
Model Sync: SyncLog, SyncConflict
Tracking sinkronisasi dan konflik data
"""
from sqlalchemy import Column, Integer, String, DateTime, Text, CheckConstraint, Index
from datetime import datetime

from .base import Base


class SyncLog(Base):
    """
    Log operasi sinkronisasi
    """
    __tablename__ = 'sync_log'

    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(String(100), index=True)
    device_name = Column(String(100))

    sync_type = Column(
        String(20),
        CheckConstraint("sync_type IN ('export', 'import', 'merge')"),
        nullable=False
    )

    sync_time = Column(DateTime, default=datetime.now, nullable=False, index=True)
    records_count = Column(Integer, default=0)
    file_name = Column(String(255))
    file_size = Column(Integer)  # bytes

    status = Column(
        String(20),
        CheckConstraint("status IN ('success', 'failed', 'partial')"),
        default='success'
    )

    notes = Column(Text)
    error_message = Column(Text)

    __table_args__ = (
        Index('idx_sync_log_device', 'device_id', 'sync_time'),
    )

    @property
    def status_display(self) -> str:
        status_map = {
            'success': 'Berhasil',
            'failed': 'Gagal',
            'partial': 'Sebagian',
        }
        return status_map.get(self.status, self.status)

    @property
    def sync_type_display(self) -> str:
        type_map = {
            'export': 'Ekspor',
            'import': 'Impor',
            'merge': 'Gabung',
        }
        return type_map.get(self.sync_type, self.sync_type)

    @property
    def file_size_display(self) -> str:
        """Format file size untuk display"""
        if not self.file_size:
            return '-'
        if self.file_size < 1024:
            return f"{self.file_size} B"
        elif self.file_size < 1024 * 1024:
            return f"{self.file_size / 1024:.1f} KB"
        else:
            return f"{self.file_size / (1024 * 1024):.2f} MB"

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'device_id': self.device_id,
            'device_name': self.device_name,
            'sync_type': self.sync_type,
            'sync_time': self.sync_time.isoformat() if self.sync_time else None,
            'records_count': self.records_count,
            'file_name': self.file_name,
            'file_size': self.file_size,
            'status': self.status,
            'notes': self.notes,
            'error_message': self.error_message,
        }

    def __repr__(self):
        return f"<SyncLog(id={self.id}, type='{self.sync_type}', status='{self.status}')>"


class SyncConflict(Base):
    """
    Konflik yang terjadi saat sinkronisasi
    """
    __tablename__ = 'sync_conflict'

    id = Column(Integer, primary_key=True, autoincrement=True)
    table_name = Column(String(50), nullable=False, index=True)
    record_sync_id = Column(String(36), nullable=False, index=True)

    local_data = Column(Text)  # JSON string
    remote_data = Column(Text)  # JSON string

    resolution = Column(
        String(20),
        CheckConstraint("resolution IN ('keep_local', 'keep_remote', 'merged', 'pending')"),
        default='pending'
    )

    created_at = Column(DateTime, default=datetime.now, nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(Integer)  # user_id yang menyelesaikan

    __table_args__ = (
        Index('idx_sync_conflict_pending', 'resolution'),
        Index('idx_sync_conflict_record', 'table_name', 'record_sync_id'),
    )

    @property
    def is_resolved(self) -> bool:
        return self.resolution != 'pending'

    @property
    def resolution_display(self) -> str:
        resolution_map = {
            'keep_local': 'Pakai Data Lokal',
            'keep_remote': 'Pakai Data Remote',
            'merged': 'Digabung Manual',
            'pending': 'Menunggu',
        }
        return resolution_map.get(self.resolution, self.resolution)

    def resolve(self, resolution: str, resolved_by: int = None):
        """Resolve conflict"""
        self.resolution = resolution
        self.resolved_at = datetime.now()
        self.resolved_by = resolved_by

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'table_name': self.table_name,
            'record_sync_id': self.record_sync_id,
            'local_data': self.local_data,
            'remote_data': self.remote_data,
            'resolution': self.resolution,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'resolved_by': self.resolved_by,
        }

    def __repr__(self):
        return f"<SyncConflict(table='{self.table_name}', sync_id='{self.record_sync_id}', resolution='{self.resolution}')>"
