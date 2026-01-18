"""
Model Enrollment dan AnggotaKelas
Pendaftaran dan keanggotaan jamaah
"""
from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, ForeignKey, Text, CheckConstraint, Index
from sqlalchemy.orm import relationship
from datetime import datetime, date

from .base import Base, TimestampMixin, SyncMixin


class Enrollment(Base, TimestampMixin, SyncMixin):
    """
    Pendaftaran jamaah ke wilayah dan jenjang tertentu
    Satu jamaah bisa punya multiple enrollment (pindah, naik jenjang)
    """
    __tablename__ = 'enrollment'

    id = Column(Integer, primary_key=True, autoincrement=True)
    jamaah_id = Column(Integer, ForeignKey('jamaah.id'), nullable=False, index=True)
    wilayah_id = Column(Integer, ForeignKey('wilayah.id'), nullable=False, index=True)
    jenjang_id = Column(Integer, ForeignKey('jenjang.id'), nullable=True)
    tahun_ajaran_id = Column(Integer, ForeignKey('tahun_ajaran.id'), nullable=True)

    status = Column(
        String(20),
        CheckConstraint("status IN ('aktif', 'nonaktif', 'pindah', 'selesai', 'lulus', 'keluar')"),
        default='aktif',
        nullable=False,
        index=True
    )

    tanggal_mulai = Column(Date, default=date.today)
    tanggal_selesai = Column(Date, nullable=True)
    keterangan = Column(Text)

    # Relationships
    jamaah = relationship("Jamaah", back_populates="enrollments")
    wilayah = relationship("Wilayah", back_populates="enrollments")
    jenjang = relationship("Jenjang", back_populates="enrollments")
    tahun_ajaran = relationship("TahunAjaran", back_populates="enrollments")

    __table_args__ = (
        Index('idx_enrollment_aktif', 'jamaah_id', 'status'),
        Index('idx_enrollment_wilayah_jenjang', 'wilayah_id', 'jenjang_id', 'status'),
    )

    @property
    def is_active(self) -> bool:
        """Cek apakah enrollment masih aktif"""
        return self.status == 'aktif'

    def deactivate(self, reason: str = 'nonaktif'):
        """Nonaktifkan enrollment"""
        self.status = reason
        self.tanggal_selesai = date.today()

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'jamaah_id': self.jamaah_id,
            'wilayah_id': self.wilayah_id,
            'jenjang_id': self.jenjang_id,
            'tahun_ajaran_id': self.tahun_ajaran_id,
            'status': self.status,
            'tanggal_mulai': self.tanggal_mulai.isoformat() if self.tanggal_mulai else None,
            'tanggal_selesai': self.tanggal_selesai.isoformat() if self.tanggal_selesai else None,
            'keterangan': self.keterangan,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'sync_id': self.sync_id,
        }

    def __repr__(self):
        return f"<Enrollment(jamaah_id={self.jamaah_id}, wilayah_id={self.wilayah_id}, status='{self.status}')>"


class AnggotaKelas(Base, SyncMixin):
    """
    Keanggotaan jamaah dalam kelas pengajian
    """
    __tablename__ = 'anggota_kelas'

    id = Column(Integer, primary_key=True, autoincrement=True)
    kelas_id = Column(Integer, ForeignKey('kelas_pengajian.id'), nullable=False, index=True)
    jamaah_id = Column(Integer, ForeignKey('jamaah.id'), nullable=False, index=True)

    status = Column(
        String(20),
        CheckConstraint("status IN ('aktif', 'keluar')"),
        default='aktif'
    )

    tanggal_bergabung = Column(Date, default=date.today)
    tanggal_keluar = Column(Date, nullable=True)

    # Relationships
    kelas = relationship("KelasPengajian", back_populates="anggota")
    jamaah = relationship("Jamaah")

    __table_args__ = (
        Index('idx_anggota_kelas_status', 'kelas_id', 'status'),
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'kelas_id': self.kelas_id,
            'jamaah_id': self.jamaah_id,
            'status': self.status,
            'tanggal_bergabung': self.tanggal_bergabung.isoformat() if self.tanggal_bergabung else None,
            'tanggal_keluar': self.tanggal_keluar.isoformat() if self.tanggal_keluar else None,
            'sync_id': self.sync_id,
        }

    def __repr__(self):
        return f"<AnggotaKelas(kelas_id={self.kelas_id}, jamaah_id={self.jamaah_id})>"
