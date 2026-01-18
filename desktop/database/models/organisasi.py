"""
Model Organisasi: Musyawarah, Kegiatan, KakakAsuh, LimaUnsur
Tracking aktivitas organisasi dan mentoring
"""
from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Text, CheckConstraint, Index
from sqlalchemy.orm import relationship
from datetime import datetime, date

from .base import Base, TimestampMixin, SyncMixin


class Musyawarah(Base, TimestampMixin, SyncMixin):
    """
    Musyawarah/rapat organisasi
    """
    __tablename__ = 'musyawarah'

    id = Column(Integer, primary_key=True, autoincrement=True)
    wilayah_id = Column(Integer, ForeignKey('wilayah.id'), nullable=True, index=True)

    jenis = Column(
        String(20),
        CheckConstraint("jenis IN ('internal', 'umum')"),
        default='internal'
    )

    tanggal = Column(Date, nullable=False, index=True)
    lokasi = Column(String(255))
    catatan = Column(Text)

    # Relationships
    wilayah = relationship("Wilayah")
    peserta = relationship("MusyawarahPeserta", back_populates="musyawarah", cascade="all, delete-orphan")
    hasil = relationship("MusyawarahHasil", back_populates="musyawarah", cascade="all, delete-orphan")

    @property
    def jumlah_peserta(self) -> int:
        return len(self.peserta)

    @property
    def jumlah_hasil(self) -> int:
        return len(self.hasil)

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'wilayah_id': self.wilayah_id,
            'jenis': self.jenis,
            'tanggal': self.tanggal.isoformat() if self.tanggal else None,
            'lokasi': self.lokasi,
            'catatan': self.catatan,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'sync_id': self.sync_id,
        }

    def __repr__(self):
        return f"<Musyawarah(id={self.id}, tanggal='{self.tanggal}', jenis='{self.jenis}')>"


class MusyawarahPeserta(Base, SyncMixin):
    """
    Peserta musyawarah
    """
    __tablename__ = 'musyawarah_peserta'

    id = Column(Integer, primary_key=True, autoincrement=True)
    musyawarah_id = Column(Integer, ForeignKey('musyawarah.id'), nullable=False, index=True)
    jamaah_id = Column(Integer, ForeignKey('jamaah.id'), nullable=False, index=True)

    # Relationships
    musyawarah = relationship("Musyawarah", back_populates="peserta")
    jamaah = relationship("Jamaah")

    __table_args__ = (
        Index('idx_musyawarah_peserta_unique', 'musyawarah_id', 'jamaah_id', unique=True),
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'musyawarah_id': self.musyawarah_id,
            'jamaah_id': self.jamaah_id,
            'sync_id': self.sync_id,
        }


class MusyawarahHasil(Base, SyncMixin):
    """
    Hasil/keputusan musyawarah
    """
    __tablename__ = 'musyawarah_hasil'

    id = Column(Integer, primary_key=True, autoincrement=True)
    musyawarah_id = Column(Integer, ForeignKey('musyawarah.id'), nullable=False, index=True)
    urutan = Column(Integer, default=0)
    isi = Column(Text, nullable=False)

    # Relationships
    musyawarah = relationship("Musyawarah", back_populates="hasil")

    __table_args__ = (
        Index('idx_musyawarah_hasil_urutan', 'musyawarah_id', 'urutan'),
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'musyawarah_id': self.musyawarah_id,
            'urutan': self.urutan,
            'isi': self.isi,
            'sync_id': self.sync_id,
        }


class Kegiatan(Base, TimestampMixin, SyncMixin):
    """
    Kegiatan organisasi
    """
    __tablename__ = 'kegiatan'

    id = Column(Integer, primary_key=True, autoincrement=True)
    wilayah_id = Column(Integer, ForeignKey('wilayah.id'), nullable=True, index=True)

    nama = Column(String(255), nullable=False)
    tanggal_mulai = Column(Date, index=True)
    tanggal_selesai = Column(Date)
    lokasi = Column(String(255))
    deskripsi = Column(Text)

    status = Column(
        String(20),
        CheckConstraint("status IN ('rencana', 'berlangsung', 'selesai', 'batal')"),
        default='rencana'
    )

    # Relationships
    wilayah = relationship("Wilayah")
    peserta = relationship("PesertaKegiatan", back_populates="kegiatan", cascade="all, delete-orphan")

    @property
    def jumlah_peserta(self) -> int:
        return len(self.peserta)

    @property
    def durasi_hari(self) -> int | None:
        """Hitung durasi kegiatan dalam hari"""
        if not self.tanggal_mulai or not self.tanggal_selesai:
            return None
        return (self.tanggal_selesai - self.tanggal_mulai).days + 1

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'wilayah_id': self.wilayah_id,
            'nama': self.nama,
            'tanggal_mulai': self.tanggal_mulai.isoformat() if self.tanggal_mulai else None,
            'tanggal_selesai': self.tanggal_selesai.isoformat() if self.tanggal_selesai else None,
            'lokasi': self.lokasi,
            'deskripsi': self.deskripsi,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'sync_id': self.sync_id,
        }

    def __repr__(self):
        return f"<Kegiatan(nama='{self.nama}', status='{self.status}')>"


class PesertaKegiatan(Base, SyncMixin):
    """
    Peserta kegiatan
    """
    __tablename__ = 'peserta_kegiatan'

    id = Column(Integer, primary_key=True, autoincrement=True)
    kegiatan_id = Column(Integer, ForeignKey('kegiatan.id'), nullable=False, index=True)
    jamaah_id = Column(Integer, ForeignKey('jamaah.id'), nullable=False, index=True)
    status = Column(String(20))  # terdaftar, hadir, tidak_hadir

    # Relationships
    kegiatan = relationship("Kegiatan", back_populates="peserta")
    jamaah = relationship("Jamaah")

    __table_args__ = (
        Index('idx_peserta_kegiatan_unique', 'kegiatan_id', 'jamaah_id', unique=True),
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'kegiatan_id': self.kegiatan_id,
            'jamaah_id': self.jamaah_id,
            'status': self.status,
            'sync_id': self.sync_id,
        }


class KakakAsuh(Base, SyncMixin):
    """
    Sistem mentoring kakak asuh
    """
    __tablename__ = 'kakak_asuh'

    id = Column(Integer, primary_key=True, autoincrement=True)
    jamaah_id = Column(Integer, ForeignKey('jamaah.id'), nullable=False, index=True)  # Adik asuh
    mentor_id = Column(Integer, ForeignKey('jamaah.id'), nullable=False, index=True)  # Kakak asuh

    status = Column(
        String(20),
        CheckConstraint("status IN ('aktif', 'nonaktif', 'selesai')"),
        default='aktif'
    )

    tanggal_mulai = Column(Date, default=date.today)
    tanggal_selesai = Column(Date, nullable=True)
    catatan = Column(Text)

    # Relationships
    jamaah = relationship("Jamaah", foreign_keys=[jamaah_id])
    mentor = relationship("Jamaah", foreign_keys=[mentor_id])

    __table_args__ = (
        Index('idx_kakak_asuh_aktif', 'jamaah_id', 'status'),
    )

    @property
    def durasi_bulan(self) -> int | None:
        """Hitung durasi mentoring dalam bulan"""
        end = self.tanggal_selesai or date.today()
        if not self.tanggal_mulai:
            return None
        return (end.year - self.tanggal_mulai.year) * 12 + (end.month - self.tanggal_mulai.month)

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'jamaah_id': self.jamaah_id,
            'mentor_id': self.mentor_id,
            'status': self.status,
            'tanggal_mulai': self.tanggal_mulai.isoformat() if self.tanggal_mulai else None,
            'tanggal_selesai': self.tanggal_selesai.isoformat() if self.tanggal_selesai else None,
            'catatan': self.catatan,
            'sync_id': self.sync_id,
        }

    def __repr__(self):
        return f"<KakakAsuh(jamaah_id={self.jamaah_id}, mentor_id={self.mentor_id}, status='{self.status}')>"


class LimaUnsur(Base, SyncMixin):
    """
    Penilaian 5 unsur organisasi
    """
    __tablename__ = 'lima_unsur'

    id = Column(Integer, primary_key=True, autoincrement=True)
    wilayah_id = Column(Integer, ForeignKey('wilayah.id'), nullable=True, index=True)
    tahun_ajaran_id = Column(Integer, ForeignKey('tahun_ajaran.id'), nullable=True)

    unsur = Column(String(50), nullable=False)  # Nama unsur yang dinilai
    nilai = Column(Integer, default=0)  # Nilai/skor
    catatan = Column(Text)

    # Relationships
    wilayah = relationship("Wilayah")
    tahun_ajaran = relationship("TahunAjaran")

    __table_args__ = (
        Index('idx_lima_unsur_wilayah', 'wilayah_id', 'tahun_ajaran_id'),
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'wilayah_id': self.wilayah_id,
            'tahun_ajaran_id': self.tahun_ajaran_id,
            'unsur': self.unsur,
            'nilai': self.nilai,
            'catatan': self.catatan,
            'sync_id': self.sync_id,
        }

    def __repr__(self):
        return f"<LimaUnsur(unsur='{self.unsur}', nilai={self.nilai})>"
