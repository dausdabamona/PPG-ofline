"""
Pengajian Service - Business logic untuk pengajian dan jadwal
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from datetime import date, time, timedelta
import calendar

from database.models import (
    Pengajian, JadwalRutin, KelasPengajian, KelasTingkat,
    TanggalSkip, Wilayah, Jenjang, KeaktifanPengajian
)
from .base_service import BaseService


class PengajianService(BaseService[Pengajian]):
    """
    Service untuk mengelola pengajian
    """

    def __init__(self, session: Session):
        super().__init__(session, Pengajian)

    def get_by_date_range(
        self,
        start_date: date,
        end_date: date,
        wilayah_id: int = None,
        jenjang_id: int = None
    ) -> List[Pengajian]:
        """Get pengajian dalam rentang tanggal"""
        query = self.session.query(Pengajian).filter(
            Pengajian.tanggal >= start_date,
            Pengajian.tanggal <= end_date
        )

        if wilayah_id:
            wilayah = self.session.query(Wilayah).get(wilayah_id)
            if wilayah:
                wilayah_ids = [w.id for w in wilayah.get_all_children(include_self=True)]
                query = query.filter(Pengajian.wilayah_id.in_(wilayah_ids))

        if jenjang_id:
            query = query.filter(Pengajian.jenjang_id == jenjang_id)

        return query.order_by(Pengajian.tanggal.desc(), Pengajian.waktu_mulai).all()

    def get_by_month(
        self,
        year: int,
        month: int,
        wilayah_id: int = None,
        jenjang_id: int = None
    ) -> List[Pengajian]:
        """Get pengajian dalam bulan tertentu"""
        start_date = date(year, month, 1)
        last_day = calendar.monthrange(year, month)[1]
        end_date = date(year, month, last_day)

        return self.get_by_date_range(start_date, end_date, wilayah_id, jenjang_id)

    def generate_from_jadwal_rutin(
        self,
        year: int,
        month: int,
        wilayah_id: int = None
    ) -> List[Pengajian]:
        """
        Generate pengajian otomatis dari jadwal rutin untuk bulan tertentu
        Skip tanggal libur
        """
        # Get jadwal rutin
        query = self.session.query(JadwalRutin).filter(JadwalRutin.is_aktif == True)
        if wilayah_id:
            query = query.filter(JadwalRutin.wilayah_id == wilayah_id)

        jadwal_list = query.all()

        # Map hari ke number
        hari_map = {
            'Senin': 0, 'Selasa': 1, 'Rabu': 2, 'Kamis': 3,
            'Jumat': 4, 'Sabtu': 5, 'Minggu': 6
        }

        # Get tanggal skip
        start_date = date(year, month, 1)
        last_day = calendar.monthrange(year, month)[1]
        end_date = date(year, month, last_day)

        skip_dates = set(
            ts.tanggal for ts in self.session.query(TanggalSkip).filter(
                TanggalSkip.tanggal >= start_date,
                TanggalSkip.tanggal <= end_date,
                TanggalSkip.is_aktif == True
            ).all()
        )

        # Get existing pengajian dates
        existing = set(
            p.tanggal for p in self.session.query(Pengajian).filter(
                Pengajian.tanggal >= start_date,
                Pengajian.tanggal <= end_date
            ).all()
        )

        generated = []

        for jadwal in jadwal_list:
            hari_num = hari_map.get(jadwal.hari)
            if hari_num is None:
                continue

            # Find all dates in month matching this day
            current = start_date
            while current <= end_date:
                if current.weekday() == hari_num:
                    # Check if not skipped and not existing
                    if current not in skip_dates:
                        # Check if not already created
                        exists = self.session.query(Pengajian).filter(
                            Pengajian.tanggal == current,
                            Pengajian.jadwal_rutin_id == jadwal.id
                        ).first()

                        if not exists:
                            pengajian = Pengajian(
                                wilayah_id=jadwal.wilayah_id,
                                jenjang_id=jadwal.jenjang_id,
                                jadwal_rutin_id=jadwal.id,
                                tanggal=current,
                                waktu_mulai=jadwal.jam,
                                status='terlaksana'
                            )
                            self.session.add(pengajian)
                            generated.append(pengajian)

                current += timedelta(days=1)

        self.session.flush()
        return generated

    def get_summary_by_month(
        self,
        year: int,
        month: int,
        wilayah_id: int = None
    ) -> Dict[str, Any]:
        """Get summary statistik pengajian bulan tertentu"""
        pengajian_list = self.get_by_month(year, month, wilayah_id)

        total = len(pengajian_list)
        terlaksana = sum(1 for p in pengajian_list if p.status == 'terlaksana')
        batal = sum(1 for p in pengajian_list if p.status == 'batal')
        ditunda = sum(1 for p in pengajian_list if p.status == 'ditunda')

        # Kehadiran
        total_hadir = 0
        total_peserta = 0
        for p in pengajian_list:
            total_hadir += p.jumlah_hadir
            total_peserta += p.jumlah_total

        return {
            'total': total,
            'terlaksana': terlaksana,
            'batal': batal,
            'ditunda': ditunda,
            'total_hadir': total_hadir,
            'total_peserta': total_peserta,
            'persentase_hadir': (total_hadir / total_peserta * 100) if total_peserta > 0 else 0,
        }


class JadwalRutinService(BaseService[JadwalRutin]):
    """
    Service untuk mengelola jadwal rutin
    """

    def __init__(self, session: Session):
        super().__init__(session, JadwalRutin)

    def get_by_wilayah(self, wilayah_id: int) -> List[JadwalRutin]:
        """Get jadwal rutin by wilayah"""
        return self.session.query(JadwalRutin).filter(
            JadwalRutin.wilayah_id == wilayah_id,
            JadwalRutin.is_aktif == True
        ).order_by(JadwalRutin.hari, JadwalRutin.jam).all()

    def get_by_hari(self, hari: str) -> List[JadwalRutin]:
        """Get jadwal rutin by hari"""
        return self.session.query(JadwalRutin).filter(
            JadwalRutin.hari == hari,
            JadwalRutin.is_aktif == True
        ).order_by(JadwalRutin.jam).all()

    def get_today_schedule(self, wilayah_id: int = None) -> List[JadwalRutin]:
        """Get jadwal hari ini"""
        hari_list = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
        hari_ini = hari_list[date.today().weekday()]

        query = self.session.query(JadwalRutin).filter(
            JadwalRutin.hari == hari_ini,
            JadwalRutin.is_aktif == True
        )

        if wilayah_id:
            query = query.filter(JadwalRutin.wilayah_id == wilayah_id)

        return query.order_by(JadwalRutin.jam).all()


class KelasPengajianService(BaseService[KelasPengajian]):
    """
    Service untuk mengelola kelas pengajian
    """

    def __init__(self, session: Session):
        super().__init__(session, KelasPengajian)

    def get_by_wilayah(self, wilayah_id: int) -> List[KelasPengajian]:
        """Get kelas by wilayah"""
        return self.session.query(KelasPengajian).filter(
            KelasPengajian.wilayah_id == wilayah_id,
            KelasPengajian.is_aktif == True
        ).order_by(KelasPengajian.nama).all()

    def get_with_member_count(self, wilayah_id: int = None) -> List[Dict[str, Any]]:
        """Get kelas dengan jumlah anggota"""
        query = self.session.query(KelasPengajian).filter(
            KelasPengajian.is_aktif == True
        )

        if wilayah_id:
            query = query.filter(KelasPengajian.wilayah_id == wilayah_id)

        result = []
        for kelas in query.all():
            data = kelas.to_dict()
            data['jumlah_anggota'] = kelas.jumlah_anggota
            result.append(data)

        return result


class TanggalSkipService(BaseService[TanggalSkip]):
    """
    Service untuk mengelola tanggal libur
    """

    def __init__(self, session: Session):
        super().__init__(session, TanggalSkip)

    def get_by_year(self, year: int) -> List[TanggalSkip]:
        """Get tanggal skip dalam tahun tertentu"""
        start = date(year, 1, 1)
        end = date(year, 12, 31)
        return self.session.query(TanggalSkip).filter(
            TanggalSkip.tanggal >= start,
            TanggalSkip.tanggal <= end,
            TanggalSkip.is_aktif == True
        ).order_by(TanggalSkip.tanggal).all()

    def is_skipped(self, tanggal: date) -> bool:
        """Check apakah tanggal adalah hari libur"""
        return TanggalSkip.is_skipped(self.session, tanggal)

    def add_range(self, start: date, end: date, keterangan: str) -> List[TanggalSkip]:
        """Add range of skip dates"""
        added = []
        current = start
        while current <= end:
            if not self.is_skipped(current):
                skip = TanggalSkip(
                    tanggal=current,
                    keterangan=keterangan
                )
                self.session.add(skip)
                added.append(skip)
            current += timedelta(days=1)

        self.session.flush()
        return added
