"""
Model Wilayah, Jenjang, dan TahunAjaran
Struktur organisasi dan pengajaran
"""
from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, ForeignKey, CheckConstraint, Index
from sqlalchemy.orm import relationship
from datetime import datetime, date

from .base import Base, TimestampMixin, SyncMixin


class Wilayah(Base, TimestampMixin, SyncMixin):
    """
    Struktur wilayah hierarkis: Daerah -> Desa -> Kelompok
    """
    __tablename__ = 'wilayah'

    id = Column(Integer, primary_key=True, autoincrement=True)
    kode = Column(String(20), unique=True, index=True)
    nama = Column(String(100), nullable=False)
    tingkat = Column(
        String(20),
        CheckConstraint("tingkat IN ('daerah', 'desa', 'kelompok')"),
        nullable=False
    )
    parent_id = Column(Integer, ForeignKey('wilayah.id'), nullable=True)
    is_aktif = Column(Boolean, default=True, nullable=False)

    # Self-referential relationship
    parent = relationship("Wilayah", remote_side=[id], backref="children")

    # Relationships
    enrollments = relationship("Enrollment", back_populates="wilayah")
    pengajian = relationship("Pengajian", back_populates="wilayah")
    jadwal_rutin = relationship("JadwalRutin", back_populates="wilayah")
    kelas_pengajian = relationship("KelasPengajian", back_populates="wilayah")

    __table_args__ = (
        Index('idx_wilayah_tingkat', 'tingkat', 'is_aktif'),
        Index('idx_wilayah_parent', 'parent_id'),
    )

    @property
    def full_path(self) -> str:
        """Dapatkan full path dari root ke wilayah ini"""
        parts = [self.nama]
        current = self.parent
        while current:
            parts.insert(0, current.nama)
            current = current.parent
        return " > ".join(parts)

    @property
    def level(self) -> int:
        """Hitung level kedalaman (0 = root)"""
        level = 0
        current = self.parent
        while current:
            level += 1
            current = current.parent
        return level

    def get_all_children(self, include_self=False) -> list:
        """Dapatkan semua children recursively"""
        result = [self] if include_self else []
        for child in self.children:
            result.extend(child.get_all_children(include_self=True))
        return result

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'kode': self.kode,
            'nama': self.nama,
            'tingkat': self.tingkat,
            'parent_id': self.parent_id,
            'is_aktif': self.is_aktif,
            'full_path': self.full_path,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'sync_id': self.sync_id,
        }

    def __repr__(self):
        return f"<Wilayah(id={self.id}, nama='{self.nama}', tingkat='{self.tingkat}')>"


class Jenjang(Base, SyncMixin):
    """
    Jenjang pendidikan berdasarkan usia
    Batita, Balita, Caberawit, Pra-Remaja, Remaja, Dewasa
    """
    __tablename__ = 'jenjang'

    id = Column(Integer, primary_key=True, autoincrement=True)
    kode = Column(String(20), unique=True, nullable=False, index=True)
    nama = Column(String(50), nullable=False)
    usia_mulai = Column(Integer, nullable=False)
    usia_sampai = Column(Integer, nullable=False)
    urutan = Column(Integer, default=0)
    is_aktif = Column(Boolean, default=True, nullable=False)

    # Relationships
    enrollments = relationship("Enrollment", back_populates="jenjang")
    pengajian = relationship("Pengajian", back_populates="jenjang")
    jadwal_rutin = relationship("JadwalRutin", back_populates="jenjang")
    target_jenjang = relationship("TargetJenjang", back_populates="jenjang")

    __table_args__ = (
        Index('idx_jenjang_usia', 'usia_mulai', 'usia_sampai'),
    )

    @staticmethod
    def get_by_age(session, age: int) -> 'Jenjang | None':
        """Dapatkan jenjang berdasarkan umur"""
        return session.query(Jenjang).filter(
            Jenjang.usia_mulai <= age,
            Jenjang.usia_sampai >= age,
            Jenjang.is_aktif == True
        ).order_by(Jenjang.urutan).first()

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'kode': self.kode,
            'nama': self.nama,
            'usia_mulai': self.usia_mulai,
            'usia_sampai': self.usia_sampai,
            'urutan': self.urutan,
            'is_aktif': self.is_aktif,
            'sync_id': self.sync_id,
        }

    def __repr__(self):
        return f"<Jenjang(kode='{self.kode}', nama='{self.nama}', usia={self.usia_mulai}-{self.usia_sampai})>"


class TahunAjaran(Base, SyncMixin):
    """
    Tahun Ajaran untuk periode pembelajaran
    """
    __tablename__ = 'tahun_ajaran'

    id = Column(Integer, primary_key=True, autoincrement=True)
    kode = Column(String(20), nullable=False, unique=True, index=True)  # contoh: 2024/2025
    nama = Column(String(100))
    tanggal_mulai = Column(Date)
    tanggal_selesai = Column(Date)
    is_aktif = Column(Boolean, default=False, nullable=False)

    # Relationships
    enrollments = relationship("Enrollment", back_populates="tahun_ajaran")
    kelas_pengajian = relationship("KelasPengajian", back_populates="tahun_ajaran")

    __table_args__ = (
        Index('idx_tahun_ajaran_aktif', 'is_aktif'),
    )

    @staticmethod
    def get_active(session) -> 'TahunAjaran | None':
        """Dapatkan tahun ajaran yang aktif"""
        return session.query(TahunAjaran).filter(
            TahunAjaran.is_aktif == True
        ).first()

    @property
    def is_current(self) -> bool:
        """Cek apakah tahun ajaran saat ini berlangsung"""
        if not self.tanggal_mulai or not self.tanggal_selesai:
            return self.is_aktif
        today = date.today()
        return self.tanggal_mulai <= today <= self.tanggal_selesai

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'kode': self.kode,
            'nama': self.nama,
            'tanggal_mulai': self.tanggal_mulai.isoformat() if self.tanggal_mulai else None,
            'tanggal_selesai': self.tanggal_selesai.isoformat() if self.tanggal_selesai else None,
            'is_aktif': self.is_aktif,
            'sync_id': self.sync_id,
        }

    def __repr__(self):
        status = "AKTIF" if self.is_aktif else ""
        return f"<TahunAjaran(kode='{self.kode}' {status})>"
