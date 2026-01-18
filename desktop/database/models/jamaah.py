"""
Model Jamaah dan FaseKehidupan
Tabel utama untuk data anggota jamaah
"""
from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, ForeignKey, Text, CheckConstraint, Index
from sqlalchemy.orm import relationship
from datetime import datetime, date

from .base import Base, TimestampMixin, SyncMixin, generate_sync_id


class Jamaah(Base, TimestampMixin, SyncMixin):
    """
    Tabel utama jamaah - menyimpan semua data personal
    Generus adalah jamaah yang belum menikah
    """
    __tablename__ = 'jamaah'

    id = Column(Integer, primary_key=True, autoincrement=True)
    nama = Column(String(255), nullable=False, index=True)
    nama_panggilan = Column(String(100))
    jenis_kelamin = Column(String(1), CheckConstraint("jenis_kelamin IN ('L', 'P')"))
    tanggal_lahir = Column(Date)
    tempat_lahir = Column(String(100))
    phone = Column(String(20))
    email = Column(String(100))
    alamat_lengkap = Column(Text)
    status_aktif = Column(Boolean, default=True, nullable=False, index=True)

    # Status Pernikahan
    status_pernikahan = Column(
        String(20),
        CheckConstraint("status_pernikahan IN ('belum_menikah', 'menikah', 'cerai')"),
        default='belum_menikah'
    )
    pasangan_id = Column(Integer, ForeignKey('jamaah.id'), nullable=True)
    tanggal_menikah = Column(Date)

    # Hubungan Keluarga
    ayah_id = Column(Integer, ForeignKey('jamaah.id'), nullable=True)
    ibu_id = Column(Integer, ForeignKey('jamaah.id'), nullable=True)

    # Data Tambahan
    golongan_darah = Column(String(5))
    pendidikan_terakhir = Column(String(50))
    pekerjaan = Column(String(100))
    penghasilan_range = Column(String(50))
    foto_url = Column(Text)

    # Audit
    created_by = Column(Integer, ForeignKey('users.id'), nullable=True)

    # Relationships - Self-referential
    pasangan = relationship("Jamaah", foreign_keys=[pasangan_id], remote_side=[id], post_update=True)
    ayah = relationship("Jamaah", foreign_keys=[ayah_id], remote_side=[id])
    ibu = relationship("Jamaah", foreign_keys=[ibu_id], remote_side=[id])

    # Relationships - to other tables
    enrollments = relationship("Enrollment", back_populates="jamaah", cascade="all, delete-orphan")
    fase_kehidupan = relationship("FaseKehidupan", back_populates="jamaah", cascade="all, delete-orphan")
    keaktifan = relationship("KeaktifanPengajian", back_populates="jamaah")
    progress = relationship("ProgressJamaah", back_populates="jamaah")
    penilaian_akhlaq = relationship("PenilaianAkhlaq", back_populates="jamaah")

    # Indexes
    __table_args__ = (
        Index('idx_jamaah_nama_aktif', 'nama', 'status_aktif'),
        Index('idx_jamaah_pernikahan', 'status_pernikahan', 'status_aktif'),
    )

    @property
    def umur(self) -> int | None:
        """Hitung umur berdasarkan tanggal lahir"""
        if not self.tanggal_lahir:
            return None
        today = date.today()
        age = today.year - self.tanggal_lahir.year
        if (today.month, today.day) < (self.tanggal_lahir.month, self.tanggal_lahir.day):
            age -= 1
        return age

    @property
    def is_generus(self) -> bool:
        """Cek apakah jamaah adalah generus (belum menikah)"""
        return self.status_pernikahan == 'belum_menikah'

    @property
    def nama_lengkap(self) -> str:
        """Nama dengan panggilan jika ada"""
        if self.nama_panggilan:
            return f"{self.nama} ({self.nama_panggilan})"
        return self.nama

    def to_dict(self) -> dict:
        """Convert ke dictionary untuk serialization"""
        return {
            'id': self.id,
            'nama': self.nama,
            'nama_panggilan': self.nama_panggilan,
            'jenis_kelamin': self.jenis_kelamin,
            'tanggal_lahir': self.tanggal_lahir.isoformat() if self.tanggal_lahir else None,
            'tempat_lahir': self.tempat_lahir,
            'phone': self.phone,
            'email': self.email,
            'alamat_lengkap': self.alamat_lengkap,
            'status_aktif': self.status_aktif,
            'status_pernikahan': self.status_pernikahan,
            'pasangan_id': self.pasangan_id,
            'tanggal_menikah': self.tanggal_menikah.isoformat() if self.tanggal_menikah else None,
            'ayah_id': self.ayah_id,
            'ibu_id': self.ibu_id,
            'golongan_darah': self.golongan_darah,
            'pendidikan_terakhir': self.pendidikan_terakhir,
            'pekerjaan': self.pekerjaan,
            'penghasilan_range': self.penghasilan_range,
            'foto_url': self.foto_url,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'sync_id': self.sync_id,
            'umur': self.umur,
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'Jamaah':
        """Create instance dari dictionary"""
        # Parse dates
        if data.get('tanggal_lahir') and isinstance(data['tanggal_lahir'], str):
            data['tanggal_lahir'] = date.fromisoformat(data['tanggal_lahir'])
        if data.get('tanggal_menikah') and isinstance(data['tanggal_menikah'], str):
            data['tanggal_menikah'] = date.fromisoformat(data['tanggal_menikah'])

        # Remove computed fields
        data.pop('umur', None)
        data.pop('id', None)

        return cls(**data)

    def __repr__(self):
        return f"<Jamaah(id={self.id}, nama='{self.nama}', umur={self.umur})>"


class FaseKehidupan(Base, SyncMixin):
    """
    Tracking fase kehidupan jamaah
    Setiap jamaah bisa punya multiple fase seiring waktu
    """
    __tablename__ = 'fase_kehidupan'

    id = Column(Integer, primary_key=True, autoincrement=True)
    jamaah_id = Column(Integer, ForeignKey('jamaah.id'), nullable=False, index=True)
    fase = Column(
        String(20),
        CheckConstraint("fase IN ('paud', 'caberawit', 'praremaja', 'remaja', 'pranikah', 'nikah', 'orangtua', 'lansia')"),
        nullable=False
    )
    tanggal_masuk = Column(Date, default=date.today)
    created_at = Column(DateTime, default=datetime.now)

    # Relationships
    jamaah = relationship("Jamaah", back_populates="fase_kehidupan")

    __table_args__ = (
        Index('idx_fase_jamaah', 'jamaah_id', 'fase'),
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'jamaah_id': self.jamaah_id,
            'fase': self.fase,
            'tanggal_masuk': self.tanggal_masuk.isoformat() if self.tanggal_masuk else None,
            'sync_id': self.sync_id,
        }

    def __repr__(self):
        return f"<FaseKehidupan(jamaah_id={self.jamaah_id}, fase='{self.fase}')>"
