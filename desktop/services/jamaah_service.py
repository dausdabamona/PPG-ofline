"""
Jamaah Service - Business logic untuk data jamaah/generus
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_
from datetime import date

from database.models import Jamaah, Enrollment, Jenjang, Wilayah
from .base_service import BaseService


class JamaahService(BaseService[Jamaah]):
    """
    Service untuk mengelola data jamaah dan generus
    """

    def __init__(self, session: Session):
        super().__init__(session, Jamaah)

    def get_all_active(
        self,
        search: str = None,
        jenis_kelamin: str = None,
        order_by: str = 'nama'
    ) -> List[Jamaah]:
        """Get all active jamaah with optional filters"""
        query = self.session.query(Jamaah).filter(Jamaah.status_aktif == True)

        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Jamaah.nama.ilike(search_term),
                    Jamaah.nama_panggilan.ilike(search_term),
                    Jamaah.phone.ilike(search_term)
                )
            )

        if jenis_kelamin:
            query = query.filter(Jamaah.jenis_kelamin == jenis_kelamin)

        return query.order_by(Jamaah.nama).all()

    def get_generus(
        self,
        wilayah_id: int = None,
        jenjang_id: int = None,
        search: str = None,
        include_inactive: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Get generus (jamaah belum menikah) dengan info enrollment
        Returns: List of dict dengan gabungan data jamaah dan enrollment
        """
        query = self.session.query(
            Jamaah, Enrollment, Jenjang, Wilayah
        ).join(
            Enrollment, Jamaah.id == Enrollment.jamaah_id
        ).outerjoin(
            Jenjang, Enrollment.jenjang_id == Jenjang.id
        ).outerjoin(
            Wilayah, Enrollment.wilayah_id == Wilayah.id
        ).filter(
            Jamaah.status_pernikahan == 'belum_menikah',
            Enrollment.status == 'aktif'
        )

        if not include_inactive:
            query = query.filter(Jamaah.status_aktif == True)

        if wilayah_id:
            # Include children wilayah
            wilayah = self.session.query(Wilayah).get(wilayah_id)
            if wilayah:
                wilayah_ids = [w.id for w in wilayah.get_all_children(include_self=True)]
                query = query.filter(Enrollment.wilayah_id.in_(wilayah_ids))

        if jenjang_id:
            query = query.filter(Enrollment.jenjang_id == jenjang_id)

        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Jamaah.nama.ilike(search_term),
                    Jamaah.nama_panggilan.ilike(search_term)
                )
            )

        results = []
        for jamaah, enrollment, jenjang, wilayah in query.order_by(Jamaah.nama).all():
            data = jamaah.to_dict()
            data.update({
                'enrollment_id': enrollment.id,
                'enrollment_status': enrollment.status,
                'jenjang_id': jenjang.id if jenjang else None,
                'jenjang_nama': jenjang.nama if jenjang else '-',
                'jenjang_kode': jenjang.kode if jenjang else None,
                'wilayah_id': wilayah.id if wilayah else None,
                'wilayah_nama': wilayah.nama if wilayah else '-',
                'wilayah_full_path': wilayah.full_path if wilayah else '-',
            })
            results.append(data)

        return results

    def get_by_wilayah(self, wilayah_id: int, include_children: bool = True) -> List[Jamaah]:
        """Get jamaah berdasarkan wilayah"""
        query = self.session.query(Jamaah).join(
            Enrollment, Jamaah.id == Enrollment.jamaah_id
        ).filter(
            Jamaah.status_aktif == True,
            Enrollment.status == 'aktif'
        )

        if include_children:
            wilayah = self.session.query(Wilayah).get(wilayah_id)
            if wilayah:
                wilayah_ids = [w.id for w in wilayah.get_all_children(include_self=True)]
                query = query.filter(Enrollment.wilayah_id.in_(wilayah_ids))
        else:
            query = query.filter(Enrollment.wilayah_id == wilayah_id)

        return query.order_by(Jamaah.nama).all()

    def get_by_jenjang(self, jenjang_id: int) -> List[Jamaah]:
        """Get jamaah berdasarkan jenjang"""
        return self.session.query(Jamaah).join(
            Enrollment, Jamaah.id == Enrollment.jamaah_id
        ).filter(
            Jamaah.status_aktif == True,
            Enrollment.status == 'aktif',
            Enrollment.jenjang_id == jenjang_id
        ).order_by(Jamaah.nama).all()

    def get_family(self, jamaah_id: int) -> Dict[str, Any]:
        """Get family relationships untuk jamaah"""
        jamaah = self.get_by_id(jamaah_id)
        if not jamaah:
            return None

        # Get children
        children = self.session.query(Jamaah).filter(
            or_(
                Jamaah.ayah_id == jamaah_id,
                Jamaah.ibu_id == jamaah_id
            ),
            Jamaah.status_aktif == True
        ).all()

        # Get siblings (same parents)
        siblings = []
        if jamaah.ayah_id or jamaah.ibu_id:
            sibling_query = self.session.query(Jamaah).filter(
                Jamaah.id != jamaah_id,
                Jamaah.status_aktif == True
            )
            if jamaah.ayah_id and jamaah.ibu_id:
                sibling_query = sibling_query.filter(
                    or_(
                        Jamaah.ayah_id == jamaah.ayah_id,
                        Jamaah.ibu_id == jamaah.ibu_id
                    )
                )
            elif jamaah.ayah_id:
                sibling_query = sibling_query.filter(Jamaah.ayah_id == jamaah.ayah_id)
            else:
                sibling_query = sibling_query.filter(Jamaah.ibu_id == jamaah.ibu_id)

            siblings = sibling_query.all()

        return {
            'jamaah': jamaah.to_dict(),
            'ayah': jamaah.ayah.to_dict() if jamaah.ayah else None,
            'ibu': jamaah.ibu.to_dict() if jamaah.ibu else None,
            'pasangan': jamaah.pasangan.to_dict() if jamaah.pasangan else None,
            'children': [c.to_dict() for c in children],
            'siblings': [s.to_dict() for s in siblings],
        }

    def auto_assign_jenjang(self, jamaah_id: int) -> Optional[int]:
        """
        Auto assign jenjang berdasarkan umur
        Returns: jenjang_id yang sesuai
        """
        jamaah = self.get_by_id(jamaah_id)
        if not jamaah or jamaah.umur is None:
            return None

        jenjang = Jenjang.get_by_age(self.session, jamaah.umur)
        return jenjang.id if jenjang else None

    def create_with_enrollment(
        self,
        jamaah_data: Dict[str, Any],
        wilayah_id: int,
        jenjang_id: int = None,
        tahun_ajaran_id: int = None
    ) -> Jamaah:
        """
        Create jamaah beserta enrollment-nya
        """
        # Create jamaah
        jamaah = self.create(jamaah_data)

        # Auto assign jenjang if not provided
        if not jenjang_id and jamaah.umur:
            jenjang_id = self.auto_assign_jenjang(jamaah.id)

        # Create enrollment
        enrollment = Enrollment(
            jamaah_id=jamaah.id,
            wilayah_id=wilayah_id,
            jenjang_id=jenjang_id,
            tahun_ajaran_id=tahun_ajaran_id,
            status='aktif',
            tanggal_mulai=date.today()
        )
        self.session.add(enrollment)
        self.session.flush()

        return jamaah

    def pindah_wilayah(
        self,
        jamaah_id: int,
        new_wilayah_id: int,
        keterangan: str = None
    ) -> Enrollment:
        """
        Pindahkan jamaah ke wilayah baru
        - Nonaktifkan enrollment lama
        - Buat enrollment baru
        """
        # Nonaktifkan enrollment lama
        old_enrollment = self.session.query(Enrollment).filter(
            Enrollment.jamaah_id == jamaah_id,
            Enrollment.status == 'aktif'
        ).first()

        if old_enrollment:
            old_enrollment.status = 'pindah'
            old_enrollment.tanggal_selesai = date.today()
            old_enrollment.keterangan = keterangan or 'Pindah wilayah'

        # Buat enrollment baru
        new_enrollment = Enrollment(
            jamaah_id=jamaah_id,
            wilayah_id=new_wilayah_id,
            jenjang_id=old_enrollment.jenjang_id if old_enrollment else None,
            tahun_ajaran_id=old_enrollment.tahun_ajaran_id if old_enrollment else None,
            status='aktif',
            tanggal_mulai=date.today(),
            keterangan=f'Pindah dari {old_enrollment.wilayah.nama}' if old_enrollment else None
        )
        self.session.add(new_enrollment)
        self.session.flush()

        return new_enrollment

    def naik_jenjang(self, jamaah_id: int, new_jenjang_id: int) -> bool:
        """
        Naikkan jenjang jamaah
        """
        enrollment = self.session.query(Enrollment).filter(
            Enrollment.jamaah_id == jamaah_id,
            Enrollment.status == 'aktif'
        ).first()

        if not enrollment:
            return False

        enrollment.jenjang_id = new_jenjang_id
        self.session.flush()
        return True

    def get_statistics(self, wilayah_id: int = None) -> Dict[str, Any]:
        """
        Get statistik jamaah/generus
        """
        base_query = self.session.query(Jamaah).join(
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
                base_query = base_query.filter(Enrollment.wilayah_id.in_(wilayah_ids))

        # Total
        total = base_query.count()

        # Per jenis kelamin
        laki = base_query.filter(Jamaah.jenis_kelamin == 'L').count()
        perempuan = base_query.filter(Jamaah.jenis_kelamin == 'P').count()

        # Per jenjang
        jenjang_stats = []
        for jenjang in self.session.query(Jenjang).filter(Jenjang.is_aktif == True).order_by(Jenjang.urutan).all():
            count = base_query.filter(Enrollment.jenjang_id == jenjang.id).count()
            jenjang_stats.append({
                'jenjang_id': jenjang.id,
                'jenjang_nama': jenjang.nama,
                'jumlah': count
            })

        return {
            'total': total,
            'laki_laki': laki,
            'perempuan': perempuan,
            'per_jenjang': jenjang_stats
        }
