"""
Model Kurikulum: BidangMateri, KategoriMateri, MateriItem, TargetJenjang
Struktur materi pembelajaran dan target per jenjang
"""
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, CheckConstraint, Index
from sqlalchemy.orm import relationship

from .base import Base, SyncMixin


class BidangMateri(Base, SyncMixin):
    """
    Bidang utama materi pembelajaran
    Contoh: Al-Quran, Hadits, Aqidah, Fiqih, Akhlaq
    """
    __tablename__ = 'bidang_materi'

    id = Column(Integer, primary_key=True, autoincrement=True)
    nama = Column(String(100), nullable=False)
    urutan = Column(Integer, default=0)
    is_aktif = Column(Boolean, default=True, nullable=False)

    # Relationships
    kategori = relationship("KategoriMateri", back_populates="bidang", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_bidang_materi_aktif', 'is_aktif', 'urutan'),
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'nama': self.nama,
            'urutan': self.urutan,
            'is_aktif': self.is_aktif,
            'sync_id': self.sync_id,
        }

    def __repr__(self):
        return f"<BidangMateri(nama='{self.nama}')>"


class KategoriMateri(Base, SyncMixin):
    """
    Kategori dalam bidang materi
    Contoh dalam Al-Quran: Juz 30, Surah Pendek, Surah Pilihan
    """
    __tablename__ = 'kategori_materi'

    id = Column(Integer, primary_key=True, autoincrement=True)
    bidang_id = Column(Integer, ForeignKey('bidang_materi.id'), nullable=True, index=True)
    nama = Column(String(100), nullable=False)
    kode = Column(String(20))
    urutan = Column(Integer, default=0)
    is_aktif = Column(Boolean, default=True, nullable=False)

    # Relationships
    bidang = relationship("BidangMateri", back_populates="kategori")
    materi_item = relationship("MateriItem", back_populates="kategori", cascade="all, delete-orphan")
    target_jenjang = relationship("TargetJenjang", back_populates="kategori")

    __table_args__ = (
        Index('idx_kategori_materi_bidang', 'bidang_id', 'urutan'),
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'bidang_id': self.bidang_id,
            'nama': self.nama,
            'kode': self.kode,
            'urutan': self.urutan,
            'is_aktif': self.is_aktif,
            'sync_id': self.sync_id,
        }

    def __repr__(self):
        return f"<KategoriMateri(nama='{self.nama}')>"


class MateriItem(Base, SyncMixin):
    """
    Item materi individual yang harus dikuasai
    Contoh: Surah Al-Fatihah, Surah An-Nas, dst
    """
    __tablename__ = 'materi_item'

    id = Column(Integer, primary_key=True, autoincrement=True)
    kategori_id = Column(Integer, ForeignKey('kategori_materi.id'), nullable=True, index=True)
    nama = Column(String(255), nullable=False)
    nomor = Column(String(20))  # Nomor urut dalam kategori
    tipe = Column(
        String(20),
        CheckConstraint("tipe IN ('hafalan', 'level', 'checklist', 'status')"),
        default='hafalan'
    )
    is_aktif = Column(Boolean, default=True, nullable=False)

    # Relationships
    kategori = relationship("KategoriMateri", back_populates="materi_item")
    progress = relationship("ProgressJamaah", back_populates="materi_item")

    __table_args__ = (
        Index('idx_materi_item_kategori', 'kategori_id', 'is_aktif'),
    )

    @property
    def nama_lengkap(self) -> str:
        """Nama dengan nomor jika ada"""
        if self.nomor:
            return f"{self.nomor}. {self.nama}"
        return self.nama

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'kategori_id': self.kategori_id,
            'nama': self.nama,
            'nomor': self.nomor,
            'tipe': self.tipe,
            'is_aktif': self.is_aktif,
            'sync_id': self.sync_id,
        }

    def __repr__(self):
        return f"<MateriItem(nama='{self.nama}', tipe='{self.tipe}')>"


class TargetJenjang(Base, SyncMixin):
    """
    Target capaian materi per jenjang
    Contoh: Jenjang Caberawit harus hafal 10 surah pendek
    """
    __tablename__ = 'target_jenjang'

    id = Column(Integer, primary_key=True, autoincrement=True)
    jenjang_id = Column(Integer, ForeignKey('jenjang.id'), nullable=True, index=True)
    kategori_id = Column(Integer, ForeignKey('kategori_materi.id'), nullable=True, index=True)
    target_jumlah = Column(Integer, default=0)

    # Relationships
    jenjang = relationship("Jenjang", back_populates="target_jenjang")
    kategori = relationship("KategoriMateri", back_populates="target_jenjang")

    __table_args__ = (
        Index('idx_target_jenjang_kategori', 'jenjang_id', 'kategori_id', unique=True),
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'jenjang_id': self.jenjang_id,
            'kategori_id': self.kategori_id,
            'target_jumlah': self.target_jumlah,
            'sync_id': self.sync_id,
        }

    def __repr__(self):
        return f"<TargetJenjang(jenjang_id={self.jenjang_id}, kategori_id={self.kategori_id}, target={self.target_jumlah})>"
