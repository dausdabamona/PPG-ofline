"""
Penilaian Service - Business logic untuk progress dan penilaian akhlaq
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from datetime import date

from database.models import (
    ProgressJamaah, PenilaianAkhlaq, MateriItem, KategoriMateri,
    BidangMateri, Jamaah, Enrollment, Jenjang, Wilayah, TargetJenjang
)
from .base_service import BaseService


class ProgressService(BaseService[ProgressJamaah]):
    """
    Service untuk mengelola progress hafalan/materi
    """

    def __init__(self, session: Session):
        super().__init__(session, ProgressJamaah)

    def get_by_jamaah(self, jamaah_id: int) -> List[ProgressJamaah]:
        """Get semua progress jamaah"""
        return self.session.query(ProgressJamaah).filter(
            ProgressJamaah.jamaah_id == jamaah_id
        ).all()

    def get_by_jamaah_kategori(
        self,
        jamaah_id: int,
        kategori_id: int
    ) -> List[ProgressJamaah]:
        """Get progress jamaah untuk kategori tertentu"""
        return self.session.query(ProgressJamaah).join(
            MateriItem, ProgressJamaah.materi_item_id == MateriItem.id
        ).filter(
            ProgressJamaah.jamaah_id == jamaah_id,
            MateriItem.kategori_id == kategori_id
        ).all()

    def get_progress_summary(self, jamaah_id: int) -> Dict[str, Any]:
        """
        Get ringkasan progress per bidang dan kategori
        """
        progress_list = self.get_by_jamaah(jamaah_id)

        # Get enrollment untuk jenjang
        enrollment = self.session.query(Enrollment).filter(
            Enrollment.jamaah_id == jamaah_id,
            Enrollment.status == 'aktif'
        ).first()

        jenjang_id = enrollment.jenjang_id if enrollment else None

        # Build summary per bidang
        summary = {}
        for bidang in self.session.query(BidangMateri).filter(BidangMateri.is_aktif == True).all():
            bidang_data = {
                'bidang_id': bidang.id,
                'bidang_nama': bidang.nama,
                'kategori': []
            }

            for kategori in self.session.query(KategoriMateri).filter(
                KategoriMateri.bidang_id == bidang.id,
                KategoriMateri.is_aktif == True
            ).all():
                # Count materi in kategori
                total_materi = self.session.query(MateriItem).filter(
                    MateriItem.kategori_id == kategori.id,
                    MateriItem.is_aktif == True
                ).count()

                # Count completed
                completed = sum(
                    1 for p in progress_list
                    if p.materi_item and p.materi_item.kategori_id == kategori.id
                    and p.is_completed
                )

                # Get target if jenjang available
                target = None
                if jenjang_id:
                    target_obj = self.session.query(TargetJenjang).filter(
                        TargetJenjang.jenjang_id == jenjang_id,
                        TargetJenjang.kategori_id == kategori.id
                    ).first()
                    if target_obj:
                        target = target_obj.target_jumlah

                bidang_data['kategori'].append({
                    'kategori_id': kategori.id,
                    'kategori_nama': kategori.nama,
                    'total': total_materi,
                    'completed': completed,
                    'target': target,
                    'persentase': (completed / total_materi * 100) if total_materi > 0 else 0,
                })

            summary[bidang.nama] = bidang_data

        return summary

    def update_progress(
        self,
        jamaah_id: int,
        materi_item_id: int,
        status: str,
        nilai: float = None,
        catatan: str = None
    ) -> ProgressJamaah:
        """Update atau create progress"""
        progress = self.session.query(ProgressJamaah).filter(
            ProgressJamaah.jamaah_id == jamaah_id,
            ProgressJamaah.materi_item_id == materi_item_id
        ).first()

        if progress:
            progress.status = status
            progress.nilai = nilai
            progress.catatan = catatan
            if status in ('selesai', 'lulus') and not progress.tanggal_selesai:
                progress.tanggal_selesai = date.today()
        else:
            progress = ProgressJamaah(
                jamaah_id=jamaah_id,
                materi_item_id=materi_item_id,
                status=status,
                nilai=nilai,
                catatan=catatan,
                tanggal_mulai=date.today() if status == 'sedang' else None,
                tanggal_selesai=date.today() if status in ('selesai', 'lulus') else None,
            )
            self.session.add(progress)

        self.session.flush()
        return progress

    def get_materi_belum_selesai(
        self,
        jamaah_id: int,
        kategori_id: int = None
    ) -> List[MateriItem]:
        """Get daftar materi yang belum selesai"""
        # Get completed materi IDs
        completed_ids = [
            p.materi_item_id for p in self.session.query(ProgressJamaah).filter(
                ProgressJamaah.jamaah_id == jamaah_id,
                ProgressJamaah.status.in_(['selesai', 'lulus'])
            ).all()
        ]

        query = self.session.query(MateriItem).filter(
            MateriItem.is_aktif == True,
            ~MateriItem.id.in_(completed_ids) if completed_ids else True
        )

        if kategori_id:
            query = query.filter(MateriItem.kategori_id == kategori_id)

        return query.all()


class PenilaianAkhlaqService(BaseService[PenilaianAkhlaq]):
    """
    Service untuk mengelola penilaian akhlaq bulanan
    """

    def __init__(self, session: Session):
        super().__init__(session, PenilaianAkhlaq)

    def get_by_jamaah_periode(
        self,
        jamaah_id: int,
        tahun: int,
        bulan: int = None
    ) -> List[PenilaianAkhlaq]:
        """Get penilaian jamaah untuk periode tertentu"""
        query = self.session.query(PenilaianAkhlaq).filter(
            PenilaianAkhlaq.jamaah_id == jamaah_id,
            PenilaianAkhlaq.periode_tahun == tahun
        )

        if bulan:
            query = query.filter(PenilaianAkhlaq.periode_bulan == bulan)

        return query.order_by(PenilaianAkhlaq.periode_bulan).all()

    def get_or_create(
        self,
        jamaah_id: int,
        tahun: int,
        bulan: int
    ) -> PenilaianAkhlaq:
        """Get existing atau create baru"""
        existing = self.session.query(PenilaianAkhlaq).filter(
            PenilaianAkhlaq.jamaah_id == jamaah_id,
            PenilaianAkhlaq.periode_tahun == tahun,
            PenilaianAkhlaq.periode_bulan == bulan
        ).first()

        if existing:
            return existing

        penilaian = PenilaianAkhlaq(
            jamaah_id=jamaah_id,
            periode_tahun=tahun,
            periode_bulan=bulan
        )
        self.session.add(penilaian)
        self.session.flush()
        return penilaian

    def update_nilai(
        self,
        jamaah_id: int,
        tahun: int,
        bulan: int,
        nilai_dict: Dict[str, str]
    ) -> PenilaianAkhlaq:
        """
        Update nilai akhlaq
        nilai_dict: {'sholat_wajib': 'A', 'tilawah': 'B', ...}
        """
        penilaian = self.get_or_create(jamaah_id, tahun, bulan)

        for aspek, nilai in nilai_dict.items():
            if hasattr(penilaian, aspek):
                setattr(penilaian, aspek, nilai)

        self.session.flush()
        return penilaian

    def get_rekap_bulanan(
        self,
        tahun: int,
        bulan: int,
        wilayah_id: int = None,
        jenjang_id: int = None
    ) -> List[Dict[str, Any]]:
        """Get rekap penilaian akhlaq bulanan"""
        # Get generus aktif
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
            penilaian = self.session.query(PenilaianAkhlaq).filter(
                PenilaianAkhlaq.jamaah_id == jamaah.id,
                PenilaianAkhlaq.periode_tahun == tahun,
                PenilaianAkhlaq.periode_bulan == bulan
            ).first()

            data = {
                'jamaah_id': jamaah.id,
                'nama': jamaah.nama,
                'jenjang_id': enrollment.jenjang_id,
            }

            if penilaian:
                data.update(penilaian.to_dict())
                data['rata_rata_ibadah'] = penilaian.rata_rata_ibadah
                data['rata_rata_adab'] = penilaian.rata_rata_adab
                data['rata_rata_karakter'] = penilaian.rata_rata_karakter
                data['rata_rata_total'] = penilaian.rata_rata_total
            else:
                data['penilaian_exists'] = False

            result.append(data)

        return result

    def get_trend_jamaah(
        self,
        jamaah_id: int,
        tahun: int
    ) -> Dict[str, Any]:
        """Get trend penilaian jamaah sepanjang tahun"""
        penilaian_list = self.get_by_jamaah_periode(jamaah_id, tahun)

        trend = {
            'jamaah_id': jamaah_id,
            'tahun': tahun,
            'monthly_data': []
        }

        for p in penilaian_list:
            trend['monthly_data'].append({
                'bulan': p.periode_bulan,
                'rata_rata_ibadah': p.rata_rata_ibadah,
                'rata_rata_adab': p.rata_rata_adab,
                'rata_rata_karakter': p.rata_rata_karakter,
                'rata_rata_total': p.rata_rata_total,
            })

        return trend
