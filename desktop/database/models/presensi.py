"""
Model KeaktifanPengajian (Presensi)
Tracking kehadiran jamaah di pengajian
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, CheckConstraint, Index
from sqlalchemy.orm import relationship
from datetime import datetime

from .base import Base, SyncMixin


class KeaktifanPengajian(Base, SyncMixin):
    """
    Presensi kehadiran jamaah di setiap sesi pengajian
    """
    __tablename__ = 'keaktifan_pengajian'

    id = Column(Integer, primary_key=True, autoincrement=True)
    pengajian_id = Column(Integer, ForeignKey('pengajian.id'), nullable=False, index=True)
    jamaah_id = Column(Integer, ForeignKey('jamaah.id'), nullable=False, index=True)

    status = Column(
        String(10),
        CheckConstraint("status IN ('hadir', 'izin', 'sakit', 'alpa')"),
        nullable=False
    )
    keterangan = Column(Text)
    created_at = Column(DateTime, default=datetime.now, nullable=False)

    # Relationships
    pengajian = relationship("Pengajian", back_populates="presensi")
    jamaah = relationship("Jamaah", back_populates="keaktifan")

    __table_args__ = (
        Index('idx_keaktifan_pengajian_jamaah', 'pengajian_id', 'jamaah_id', unique=True),
        Index('idx_keaktifan_status', 'status'),
    )

    @property
    def is_hadir(self) -> bool:
        """Cek apakah hadir"""
        return self.status == 'hadir'

    @property
    def status_display(self) -> str:
        """Status dalam format display"""
        status_map = {
            'hadir': 'Hadir',
            'izin': 'Izin',
            'sakit': 'Sakit',
            'alpa': 'Alpa',
        }
        return status_map.get(self.status, self.status)

    @property
    def status_color(self) -> str:
        """Warna untuk status (untuk UI)"""
        color_map = {
            'hadir': '#10b981',  # green
            'izin': '#f59e0b',   # amber
            'sakit': '#3b82f6',  # blue
            'alpa': '#ef4444',   # red
        }
        return color_map.get(self.status, '#6b7280')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'pengajian_id': self.pengajian_id,
            'jamaah_id': self.jamaah_id,
            'status': self.status,
            'keterangan': self.keterangan,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'sync_id': self.sync_id,
        }

    def __repr__(self):
        return f"<KeaktifanPengajian(pengajian_id={self.pengajian_id}, jamaah_id={self.jamaah_id}, status='{self.status}')>"
