"""
Model Pengajian, JadwalRutin, KelasPengajian, TanggalSkip
Manajemen sesi pembelajaran dan jadwal
"""
from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, Time, ForeignKey, Text, CheckConstraint, Index
from sqlalchemy.orm import relationship
from datetime import datetime, date, time

from .base import Base, TimestampMixin, SyncMixin


class Pengajian(Base, TimestampMixin, SyncMixin):
    """
    Sesi pengajian individual - setiap pertemuan
    """
    __tablename__ = 'pengajian'

    id = Column(Integer, primary_key=True, autoincrement=True)
    wilayah_id = Column(Integer, ForeignKey('wilayah.id'), nullable=True, index=True)
    jenjang_id = Column(Integer, ForeignKey('jenjang.id'), nullable=True, index=True)
    jadwal_rutin_id = Column(Integer, ForeignKey('jadwal_rutin.id'), nullable=True)

    tanggal = Column(Date, nullable=False, index=True)
    waktu_mulai = Column(Time)
    waktu_selesai = Column(Time)
    materi_pokok = Column(Text)
    penyaji_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    catatan = Column(Text)

    status = Column(
        String(20),
        CheckConstraint("status IN ('terlaksana', 'batal', 'ditunda')"),
        default='terlaksana'
    )

    # Relationships
    wilayah = relationship("Wilayah", back_populates="pengajian")
    jenjang = relationship("Jenjang", back_populates="pengajian")
    jadwal_rutin = relationship("JadwalRutin", back_populates="pengajian_instances")
    penyaji = relationship("Users")
    presensi = relationship("KeaktifanPengajian", back_populates="pengajian", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_pengajian_tanggal', 'tanggal', 'wilayah_id'),
        Index('idx_pengajian_wilayah_jenjang', 'wilayah_id', 'jenjang_id', 'tanggal'),
    )

    @property
    def durasi_menit(self) -> int | None:
        """Hitung durasi dalam menit"""
        if not self.waktu_mulai or not self.waktu_selesai:
            return None
        start = datetime.combine(date.today(), self.waktu_mulai)
        end = datetime.combine(date.today(), self.waktu_selesai)
        return int((end - start).total_seconds() / 60)

    @property
    def jumlah_hadir(self) -> int:
        """Hitung jumlah yang hadir"""
        return sum(1 for p in self.presensi if p.status == 'hadir')

    @property
    def jumlah_total(self) -> int:
        """Total peserta presensi"""
        return len(self.presensi)

    @property
    def persentase_hadir(self) -> float:
        """Persentase kehadiran"""
        if self.jumlah_total == 0:
            return 0.0
        return (self.jumlah_hadir / self.jumlah_total) * 100

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'wilayah_id': self.wilayah_id,
            'jenjang_id': self.jenjang_id,
            'jadwal_rutin_id': self.jadwal_rutin_id,
            'tanggal': self.tanggal.isoformat() if self.tanggal else None,
            'waktu_mulai': self.waktu_mulai.isoformat() if self.waktu_mulai else None,
            'waktu_selesai': self.waktu_selesai.isoformat() if self.waktu_selesai else None,
            'materi_pokok': self.materi_pokok,
            'penyaji_id': self.penyaji_id,
            'catatan': self.catatan,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'sync_id': self.sync_id,
        }

    def __repr__(self):
        return f"<Pengajian(id={self.id}, tanggal='{self.tanggal}', status='{self.status}')>"


class JadwalRutin(Base, SyncMixin):
    """
    Jadwal pengajian rutin mingguan
    """
    __tablename__ = 'jadwal_rutin'

    id = Column(Integer, primary_key=True, autoincrement=True)
    wilayah_id = Column(Integer, ForeignKey('wilayah.id'), nullable=True, index=True)
    jenjang_id = Column(Integer, ForeignKey('jenjang.id'), nullable=True)

    nama = Column(String(100))
    hari = Column(
        String(10),
        CheckConstraint("hari IN ('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu')"),
        nullable=False
    )
    jam = Column(Time, nullable=False)
    is_aktif = Column(Boolean, default=True, nullable=False)

    # Relationships
    wilayah = relationship("Wilayah", back_populates="jadwal_rutin")
    jenjang = relationship("Jenjang", back_populates="jadwal_rutin")
    pengajian_instances = relationship("Pengajian", back_populates="jadwal_rutin")

    __table_args__ = (
        Index('idx_jadwal_rutin_aktif', 'wilayah_id', 'is_aktif'),
    )

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'wilayah_id': self.wilayah_id,
            'jenjang_id': self.jenjang_id,
            'nama': self.nama,
            'hari': self.hari,
            'jam': self.jam.isoformat() if self.jam else None,
            'is_aktif': self.is_aktif,
            'sync_id': self.sync_id,
        }

    def __repr__(self):
        return f"<JadwalRutin(nama='{self.nama}', hari='{self.hari}', jam='{self.jam}')>"


class KelasPengajian(Base, SyncMixin):
    """
    Kelas pengajian - pengelompokan peserta
    """
    __tablename__ = 'kelas_pengajian'

    id = Column(Integer, primary_key=True, autoincrement=True)
    wilayah_id = Column(Integer, ForeignKey('wilayah.id'), nullable=True, index=True)
    tahun_ajaran_id = Column(Integer, ForeignKey('tahun_ajaran.id'), nullable=True)

    nama = Column(String(100), nullable=False)
    muballigh_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    pendamping_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    keterangan = Column(Text)
    is_aktif = Column(Boolean, default=True, nullable=False)

    # Relationships
    wilayah = relationship("Wilayah", back_populates="kelas_pengajian")
    tahun_ajaran = relationship("TahunAjaran", back_populates="kelas_pengajian")
    muballigh = relationship("Users", foreign_keys=[muballigh_id])
    pendamping = relationship("Users", foreign_keys=[pendamping_id])
    anggota = relationship("AnggotaKelas", back_populates="kelas", cascade="all, delete-orphan")
    tingkat = relationship("KelasTingkat", back_populates="kelas", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_kelas_pengajian_aktif', 'wilayah_id', 'is_aktif'),
    )

    @property
    def jumlah_anggota(self) -> int:
        """Hitung jumlah anggota aktif"""
        return sum(1 for a in self.anggota if a.status == 'aktif')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'wilayah_id': self.wilayah_id,
            'tahun_ajaran_id': self.tahun_ajaran_id,
            'nama': self.nama,
            'muballigh_id': self.muballigh_id,
            'pendamping_id': self.pendamping_id,
            'keterangan': self.keterangan,
            'is_aktif': self.is_aktif,
            'sync_id': self.sync_id,
        }

    def __repr__(self):
        return f"<KelasPengajian(nama='{self.nama}', jumlah_anggota={self.jumlah_anggota})>"


class KelasTingkat(Base, SyncMixin):
    """
    Many-to-Many relationship antara Kelas dan Jenjang
    Satu kelas bisa berisi multiple jenjang
    """
    __tablename__ = 'kelas_tingkat'

    id = Column(Integer, primary_key=True, autoincrement=True)
    kelas_id = Column(Integer, ForeignKey('kelas_pengajian.id'), nullable=False, index=True)
    jenjang_id = Column(Integer, ForeignKey('jenjang.id'), nullable=False, index=True)

    # Relationships
    kelas = relationship("KelasPengajian", back_populates="tingkat")
    jenjang = relationship("Jenjang")

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'kelas_id': self.kelas_id,
            'jenjang_id': self.jenjang_id,
            'sync_id': self.sync_id,
        }


class TanggalSkip(Base, SyncMixin):
    """
    Tanggal libur / skip pengajian
    """
    __tablename__ = 'tanggal_skip'

    id = Column(Integer, primary_key=True, autoincrement=True)
    tanggal = Column(Date, nullable=False, index=True)
    keterangan = Column(String(255))
    is_aktif = Column(Boolean, default=True, nullable=False)

    @staticmethod
    def is_skipped(session, tanggal: date) -> bool:
        """Cek apakah tanggal adalah hari libur"""
        return session.query(TanggalSkip).filter(
            TanggalSkip.tanggal == tanggal,
            TanggalSkip.is_aktif == True
        ).first() is not None

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'tanggal': self.tanggal.isoformat() if self.tanggal else None,
            'keterangan': self.keterangan,
            'is_aktif': self.is_aktif,
            'sync_id': self.sync_id,
        }

    def __repr__(self):
        return f"<TanggalSkip(tanggal='{self.tanggal}', keterangan='{self.keterangan}')>"
