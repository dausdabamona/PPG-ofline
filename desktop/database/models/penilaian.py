"""
Model Penilaian: ProgressJamaah, PenilaianAkhlaq
Tracking progress pembelajaran dan penilaian akhlaq
"""
from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey, Text, CheckConstraint, Index
from sqlalchemy.orm import relationship
from datetime import datetime, date

from .base import Base, TimestampMixin, SyncMixin


class ProgressJamaah(Base, TimestampMixin, SyncMixin):
    """
    Progress penguasaan materi per jamaah
    Tracking hafalan dan pencapaian materi
    """
    __tablename__ = 'progress_jamaah'

    id = Column(Integer, primary_key=True, autoincrement=True)
    jamaah_id = Column(Integer, ForeignKey('jamaah.id'), nullable=False, index=True)
    materi_item_id = Column(Integer, ForeignKey('materi_item.id'), nullable=False, index=True)

    status = Column(
        String(20),
        CheckConstraint("status IN ('belum', 'sedang', 'selesai', 'lulus')"),
        default='belum',
        nullable=False
    )

    nilai = Column(Numeric(5, 2), nullable=True)  # Nilai 0-100
    catatan = Column(Text)

    tanggal_mulai = Column(Date, nullable=True)
    tanggal_selesai = Column(Date, nullable=True)

    # Periode penilaian
    periode_bulan = Column(Integer, nullable=True)  # 1-12
    periode_tahun = Column(Integer, nullable=True)

    # Relationships
    jamaah = relationship("Jamaah", back_populates="progress")
    materi_item = relationship("MateriItem", back_populates="progress")

    __table_args__ = (
        Index('idx_progress_jamaah_materi', 'jamaah_id', 'materi_item_id'),
        Index('idx_progress_periode', 'periode_tahun', 'periode_bulan'),
        Index('idx_progress_status', 'status'),
    )

    @property
    def is_completed(self) -> bool:
        """Cek apakah materi sudah selesai"""
        return self.status in ('selesai', 'lulus')

    @property
    def nilai_huruf(self) -> str | None:
        """Convert nilai angka ke huruf"""
        if self.nilai is None:
            return None
        nilai = float(self.nilai)
        if nilai >= 90:
            return 'A'
        elif nilai >= 80:
            return 'B'
        elif nilai >= 70:
            return 'C'
        elif nilai >= 60:
            return 'D'
        else:
            return 'E'

    @property
    def status_display(self) -> str:
        """Status dalam format display"""
        status_map = {
            'belum': 'Belum Mulai',
            'sedang': 'Sedang Belajar',
            'selesai': 'Selesai',
            'lulus': 'Lulus',
        }
        return status_map.get(self.status, self.status)

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'jamaah_id': self.jamaah_id,
            'materi_item_id': self.materi_item_id,
            'status': self.status,
            'nilai': float(self.nilai) if self.nilai else None,
            'catatan': self.catatan,
            'tanggal_mulai': self.tanggal_mulai.isoformat() if self.tanggal_mulai else None,
            'tanggal_selesai': self.tanggal_selesai.isoformat() if self.tanggal_selesai else None,
            'periode_bulan': self.periode_bulan,
            'periode_tahun': self.periode_tahun,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'sync_id': self.sync_id,
        }

    def __repr__(self):
        return f"<ProgressJamaah(jamaah_id={self.jamaah_id}, materi_id={self.materi_item_id}, status='{self.status}')>"


class PenilaianAkhlaq(Base, SyncMixin):
    """
    Penilaian akhlaq bulanan per jamaah
    Mencakup berbagai aspek perilaku dan ibadah
    """
    __tablename__ = 'penilaian_akhlaq'

    id = Column(Integer, primary_key=True, autoincrement=True)
    jamaah_id = Column(Integer, ForeignKey('jamaah.id'), nullable=False, index=True)

    # Periode
    periode_bulan = Column(Integer, nullable=False)  # 1-12
    periode_tahun = Column(Integer, nullable=False)

    # Penilaian Ibadah (A/B/C/D)
    sholat_wajib = Column(String(5))
    sholat_jamaah = Column(String(5))
    puasa = Column(String(5))
    tilawah = Column(String(5))

    # Penilaian Adab
    birrul_walidain = Column(String(5))
    adab_makan = Column(String(5))
    adab_tidur = Column(String(5))
    adab_berbicara = Column(String(5))

    # Penilaian Karakter
    kebersihan = Column(String(5))
    kedisiplinan = Column(String(5))
    kejujuran = Column(String(5))
    tanggung_jawab = Column(String(5))

    catatan = Column(Text)
    created_at = Column(DateTime, default=datetime.now, nullable=False)

    # Relationships
    jamaah = relationship("Jamaah", back_populates="penilaian_akhlaq")

    __table_args__ = (
        Index('idx_penilaian_akhlaq_periode', 'periode_tahun', 'periode_bulan'),
        Index('idx_penilaian_akhlaq_jamaah', 'jamaah_id', 'periode_tahun', 'periode_bulan', unique=True),
    )

    ASPEK_IBADAH = ['sholat_wajib', 'sholat_jamaah', 'puasa', 'tilawah']
    ASPEK_ADAB = ['birrul_walidain', 'adab_makan', 'adab_tidur', 'adab_berbicara']
    ASPEK_KARAKTER = ['kebersihan', 'kedisiplinan', 'kejujuran', 'tanggung_jawab']
    ALL_ASPEK = ASPEK_IBADAH + ASPEK_ADAB + ASPEK_KARAKTER

    @property
    def periode_display(self) -> str:
        """Format periode untuk display"""
        bulan_nama = [
            '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ]
        return f"{bulan_nama[self.periode_bulan]} {self.periode_tahun}"

    @property
    def rata_rata_ibadah(self) -> float | None:
        """Hitung rata-rata nilai ibadah"""
        return self._calculate_average(self.ASPEK_IBADAH)

    @property
    def rata_rata_adab(self) -> float | None:
        """Hitung rata-rata nilai adab"""
        return self._calculate_average(self.ASPEK_ADAB)

    @property
    def rata_rata_karakter(self) -> float | None:
        """Hitung rata-rata nilai karakter"""
        return self._calculate_average(self.ASPEK_KARAKTER)

    @property
    def rata_rata_total(self) -> float | None:
        """Hitung rata-rata semua aspek"""
        return self._calculate_average(self.ALL_ASPEK)

    def _calculate_average(self, aspek_list: list) -> float | None:
        """Helper untuk menghitung rata-rata"""
        nilai_map = {'A': 4, 'B': 3, 'C': 2, 'D': 1}
        values = []
        for aspek in aspek_list:
            val = getattr(self, aspek)
            if val and val in nilai_map:
                values.append(nilai_map[val])
        if not values:
            return None
        return sum(values) / len(values)

    def get_nilai_huruf_rata2(self, avg: float) -> str:
        """Convert rata-rata ke nilai huruf"""
        if avg >= 3.5:
            return 'A'
        elif avg >= 2.5:
            return 'B'
        elif avg >= 1.5:
            return 'C'
        else:
            return 'D'

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'jamaah_id': self.jamaah_id,
            'periode_bulan': self.periode_bulan,
            'periode_tahun': self.periode_tahun,
            'sholat_wajib': self.sholat_wajib,
            'sholat_jamaah': self.sholat_jamaah,
            'puasa': self.puasa,
            'tilawah': self.tilawah,
            'birrul_walidain': self.birrul_walidain,
            'adab_makan': self.adab_makan,
            'adab_tidur': self.adab_tidur,
            'adab_berbicara': self.adab_berbicara,
            'kebersihan': self.kebersihan,
            'kedisiplinan': self.kedisiplinan,
            'kejujuran': self.kejujuran,
            'tanggung_jawab': self.tanggung_jawab,
            'catatan': self.catatan,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'sync_id': self.sync_id,
        }

    def __repr__(self):
        return f"<PenilaianAkhlaq(jamaah_id={self.jamaah_id}, periode='{self.periode_display}')>"
