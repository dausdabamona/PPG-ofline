"""
Presensi Service - Business logic untuk kehadiran
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from datetime import date
import calendar

from database.models import (
    KeaktifanPengajian, Pengajian, Jamaah, Enrollment,
    Wilayah, Jenjang
)
from .base_service import BaseService


class PresensiService(BaseService[KeaktifanPengajian]):
    """
    Service untuk mengelola presensi/kehadiran
    """

    def __init__(self, session: Session):
        super().__init__(session, KeaktifanPengajian)

    def get_by_pengajian(self, pengajian_id: int) -> List[KeaktifanPengajian]:
        """Get semua presensi untuk pengajian tertentu"""
        return self.session.query(KeaktifanPengajian).filter(
            KeaktifanPengajian.pengajian_id == pengajian_id
        ).all()

    def get_by_jamaah(
        self,
        jamaah_id: int,
        start_date: date = None,
        end_date: date = None
    ) -> List[KeaktifanPengajian]:
        """Get presensi jamaah dalam rentang waktu"""
        query = self.session.query(KeaktifanPengajian).join(
            Pengajian, KeaktifanPengajian.pengajian_id == Pengajian.id
        ).filter(
            KeaktifanPengajian.jamaah_id == jamaah_id
        )

        if start_date:
            query = query.filter(Pengajian.tanggal >= start_date)
        if end_date:
            query = query.filter(Pengajian.tanggal <= end_date)

        return query.order_by(Pengajian.tanggal.desc()).all()

    def bulk_create_presensi(
        self,
        pengajian_id: int,
        presensi_list: List[Dict[str, Any]]
    ) -> List[KeaktifanPengajian]:
        """
        Create presensi massal untuk satu pengajian
        presensi_list: [{'jamaah_id': 1, 'status': 'hadir', 'keterangan': '...'}, ...]
        """
        # Delete existing presensi for this pengajian
        self.session.query(KeaktifanPengajian).filter(
            KeaktifanPengajian.pengajian_id == pengajian_id
        ).delete()

        # Create new
        created = []
        for data in presensi_list:
            presensi = KeaktifanPengajian(
                pengajian_id=pengajian_id,
                jamaah_id=data['jamaah_id'],
                status=data['status'],
                keterangan=data.get('keterangan')
            )
            self.session.add(presensi)
            created.append(presensi)

        self.session.flush()
        return created

    def get_rekap_jamaah(
        self,
        jamaah_id: int,
        year: int,
        month: int = None
    ) -> Dict[str, Any]:
        """
        Get rekapitulasi kehadiran jamaah
        """
        query = self.session.query(KeaktifanPengajian).join(
            Pengajian, KeaktifanPengajian.pengajian_id == Pengajian.id
        ).filter(
            KeaktifanPengajian.jamaah_id == jamaah_id,
            func.extract('year', Pengajian.tanggal) == year
        )

        if month:
            query = query.filter(func.extract('month', Pengajian.tanggal) == month)

        presensi_list = query.all()

        total = len(presensi_list)
        hadir = sum(1 for p in presensi_list if p.status == 'hadir')
        izin = sum(1 for p in presensi_list if p.status == 'izin')
        sakit = sum(1 for p in presensi_list if p.status == 'sakit')
        alpa = sum(1 for p in presensi_list if p.status == 'alpa')

        return {
            'jamaah_id': jamaah_id,
            'year': year,
            'month': month,
            'total': total,
            'hadir': hadir,
            'izin': izin,
            'sakit': sakit,
            'alpa': alpa,
            'persentase_hadir': (hadir / total * 100) if total > 0 else 0,
        }

    def get_rekap_bulanan(
        self,
        year: int,
        month: int,
        wilayah_id: int = None,
        jenjang_id: int = None
    ) -> List[Dict[str, Any]]:
        """
        Get rekapitulasi bulanan per jamaah
        """
        # Get generus yang aktif
        query = self.session.query(Jamaah, Enrollment).join(
            Enrollment, Jamaah.id == Enrollment.jamaah_id
        ).filter(
            Jamaah.status_aktif == True,
            Jamaah.status_pernikahan == 'belum_menikah',
            Enrollment.status == 'aktif'
        )

        if wilayah_id:
            wilayah = self.session.query(Wilayah).get(wilayah_id)
            if wilayah:
                wilayah_ids = [w.id for w in wilayah.get_all_children(include_self=True)]
                query = query.filter(Enrollment.wilayah_id.in_(wilayah_ids))

        if jenjang_id:
            query = query.filter(Enrollment.jenjang_id == jenjang_id)

        result = []
        for jamaah, enrollment in query.order_by(Jamaah.nama).all():
            rekap = self.get_rekap_jamaah(jamaah.id, year, month)
            rekap['nama'] = jamaah.nama
            rekap['jenjang_id'] = enrollment.jenjang_id
            result.append(rekap)

        return result

    def get_rekap_pengajian(self, pengajian_id: int) -> Dict[str, Any]:
        """Get rekap presensi untuk satu pengajian"""
        pengajian = self.session.query(Pengajian).get(pengajian_id)
        if not pengajian:
            return None

        presensi_list = self.get_by_pengajian(pengajian_id)

        return {
            'pengajian_id': pengajian_id,
            'tanggal': pengajian.tanggal.isoformat(),
            'total': len(presensi_list),
            'hadir': sum(1 for p in presensi_list if p.status == 'hadir'),
            'izin': sum(1 for p in presensi_list if p.status == 'izin'),
            'sakit': sum(1 for p in presensi_list if p.status == 'sakit'),
            'alpa': sum(1 for p in presensi_list if p.status == 'alpa'),
        }

    def get_jamaah_tidak_hadir(
        self,
        pengajian_id: int
    ) -> List[Dict[str, Any]]:
        """Get daftar jamaah yang tidak hadir"""
        presensi_list = self.session.query(KeaktifanPengajian).filter(
            KeaktifanPengajian.pengajian_id == pengajian_id,
            KeaktifanPengajian.status != 'hadir'
        ).all()

        result = []
        for p in presensi_list:
            result.append({
                'jamaah_id': p.jamaah_id,
                'nama': p.jamaah.nama,
                'status': p.status,
                'keterangan': p.keterangan,
            })

        return result

    def get_statistik_kehadiran(
        self,
        year: int,
        month: int = None,
        wilayah_id: int = None
    ) -> Dict[str, Any]:
        """Get statistik kehadiran overall"""
        query = self.session.query(KeaktifanPengajian).join(
            Pengajian, KeaktifanPengajian.pengajian_id == Pengajian.id
        ).filter(
            func.extract('year', Pengajian.tanggal) == year
        )

        if month:
            query = query.filter(func.extract('month', Pengajian.tanggal) == month)

        if wilayah_id:
            wilayah = self.session.query(Wilayah).get(wilayah_id)
            if wilayah:
                wilayah_ids = [w.id for w in wilayah.get_all_children(include_self=True)]
                query = query.filter(Pengajian.wilayah_id.in_(wilayah_ids))

        presensi_list = query.all()

        total = len(presensi_list)
        hadir = sum(1 for p in presensi_list if p.status == 'hadir')

        # Per bulan jika tidak filter bulan spesifik
        monthly_stats = []
        if not month:
            for m in range(1, 13):
                month_presensi = [
                    p for p in presensi_list
                    if p.pengajian.tanggal.month == m
                ]
                if month_presensi:
                    monthly_stats.append({
                        'month': m,
                        'total': len(month_presensi),
                        'hadir': sum(1 for p in month_presensi if p.status == 'hadir'),
                    })

        return {
            'year': year,
            'month': month,
            'total': total,
            'hadir': hadir,
            'persentase': (hadir / total * 100) if total > 0 else 0,
            'monthly_stats': monthly_stats,
        }
