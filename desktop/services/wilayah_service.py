"""
Wilayah Service - Business logic untuk struktur wilayah
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_

from database.models import Wilayah, Jenjang, TahunAjaran
from .base_service import BaseService


class WilayahService(BaseService[Wilayah]):
    """
    Service untuk mengelola struktur wilayah hierarkis
    """

    def __init__(self, session: Session):
        super().__init__(session, Wilayah)

    def get_tree(self, root_id: int = None) -> List[Dict[str, Any]]:
        """
        Get wilayah dalam format tree
        Returns: List of dict dengan children nested
        """
        if root_id:
            roots = self.session.query(Wilayah).filter(
                Wilayah.id == root_id,
                Wilayah.is_aktif == True
            ).all()
        else:
            # Get root nodes (no parent)
            roots = self.session.query(Wilayah).filter(
                Wilayah.parent_id == None,
                Wilayah.is_aktif == True
            ).order_by(Wilayah.nama).all()

        return [self._build_tree_node(w) for w in roots]

    def _build_tree_node(self, wilayah: Wilayah) -> Dict[str, Any]:
        """Build single tree node with children recursively"""
        children = self.session.query(Wilayah).filter(
            Wilayah.parent_id == wilayah.id,
            Wilayah.is_aktif == True
        ).order_by(Wilayah.nama).all()

        return {
            'id': wilayah.id,
            'kode': wilayah.kode,
            'nama': wilayah.nama,
            'tingkat': wilayah.tingkat,
            'full_path': wilayah.full_path,
            'sync_id': wilayah.sync_id,
            'children': [self._build_tree_node(c) for c in children]
        }

    def get_by_tingkat(self, tingkat: str) -> List[Wilayah]:
        """Get wilayah by tingkat (daerah/desa/kelompok)"""
        return self.session.query(Wilayah).filter(
            Wilayah.tingkat == tingkat,
            Wilayah.is_aktif == True
        ).order_by(Wilayah.nama).all()

    def get_daerah(self) -> List[Wilayah]:
        """Get semua daerah"""
        return self.get_by_tingkat('daerah')

    def get_desa(self, daerah_id: int = None) -> List[Wilayah]:
        """Get semua desa, optional filter by daerah"""
        query = self.session.query(Wilayah).filter(
            Wilayah.tingkat == 'desa',
            Wilayah.is_aktif == True
        )
        if daerah_id:
            query = query.filter(Wilayah.parent_id == daerah_id)
        return query.order_by(Wilayah.nama).all()

    def get_kelompok(self, desa_id: int = None) -> List[Wilayah]:
        """Get semua kelompok, optional filter by desa"""
        query = self.session.query(Wilayah).filter(
            Wilayah.tingkat == 'kelompok',
            Wilayah.is_aktif == True
        )
        if desa_id:
            query = query.filter(Wilayah.parent_id == desa_id)
        return query.order_by(Wilayah.nama).all()

    def get_children(self, parent_id: int) -> List[Wilayah]:
        """Get direct children of a wilayah"""
        return self.session.query(Wilayah).filter(
            Wilayah.parent_id == parent_id,
            Wilayah.is_aktif == True
        ).order_by(Wilayah.nama).all()

    def get_all_descendants(self, wilayah_id: int, include_self: bool = True) -> List[Wilayah]:
        """Get all descendants recursively"""
        wilayah = self.get_by_id(wilayah_id)
        if not wilayah:
            return []
        return wilayah.get_all_children(include_self=include_self)

    def get_ancestors(self, wilayah_id: int) -> List[Wilayah]:
        """Get all ancestors (parent chain) from root to parent"""
        wilayah = self.get_by_id(wilayah_id)
        if not wilayah:
            return []

        ancestors = []
        current = wilayah.parent
        while current:
            ancestors.insert(0, current)
            current = current.parent
        return ancestors

    def create_with_validation(self, data: Dict[str, Any]) -> Wilayah:
        """Create wilayah with validation"""
        # Validate kode uniqueness
        if data.get('kode'):
            existing = self.session.query(Wilayah).filter(
                Wilayah.kode == data['kode']
            ).first()
            if existing:
                raise ValueError(f"Kode wilayah '{data['kode']}' sudah digunakan")

        # Validate parent tingkat
        if data.get('parent_id'):
            parent = self.get_by_id(data['parent_id'])
            if not parent:
                raise ValueError("Parent wilayah tidak ditemukan")

            # Validate hierarchy
            tingkat = data.get('tingkat')
            valid_child = {
                'daerah': 'desa',
                'desa': 'kelompok',
            }
            if parent.tingkat not in valid_child or valid_child[parent.tingkat] != tingkat:
                raise ValueError(f"Tidak dapat menambah {tingkat} di bawah {parent.tingkat}")

        return self.create(data)

    def move_to_parent(self, wilayah_id: int, new_parent_id: int) -> Wilayah:
        """Move wilayah to new parent"""
        wilayah = self.get_by_id(wilayah_id)
        if not wilayah:
            raise ValueError("Wilayah tidak ditemukan")

        new_parent = self.get_by_id(new_parent_id)
        if not new_parent:
            raise ValueError("Parent baru tidak ditemukan")

        # Validate hierarchy
        valid_child = {
            'daerah': 'desa',
            'desa': 'kelompok',
        }
        if new_parent.tingkat not in valid_child or valid_child[new_parent.tingkat] != wilayah.tingkat:
            raise ValueError(f"Tidak dapat memindahkan {wilayah.tingkat} ke bawah {new_parent.tingkat}")

        wilayah.parent_id = new_parent_id
        self.session.flush()
        return wilayah

    def get_flat_list(self, with_indent: bool = True) -> List[Dict[str, Any]]:
        """
        Get flat list of wilayah dengan indentasi untuk dropdown
        """
        result = []

        def add_node(wilayah: Wilayah, level: int):
            indent = "  " * level if with_indent else ""
            result.append({
                'id': wilayah.id,
                'display': f"{indent}{wilayah.nama}",
                'nama': wilayah.nama,
                'tingkat': wilayah.tingkat,
                'level': level,
                'kode': wilayah.kode,
            })
            for child in self.get_children(wilayah.id):
                add_node(child, level + 1)

        for root in self.get_by_tingkat('daerah'):
            add_node(root, 0)

        return result


class JenjangService(BaseService[Jenjang]):
    """
    Service untuk mengelola jenjang pendidikan
    """

    def __init__(self, session: Session):
        super().__init__(session, Jenjang)

    def get_all_active(self) -> List[Jenjang]:
        """Get semua jenjang aktif"""
        return self.session.query(Jenjang).filter(
            Jenjang.is_aktif == True
        ).order_by(Jenjang.urutan).all()

    def get_by_age(self, age: int) -> Optional[Jenjang]:
        """Get jenjang berdasarkan umur"""
        return Jenjang.get_by_age(self.session, age)

    def get_by_kode(self, kode: str) -> Optional[Jenjang]:
        """Get jenjang by kode"""
        return self.session.query(Jenjang).filter(
            Jenjang.kode == kode
        ).first()


class TahunAjaranService(BaseService[TahunAjaran]):
    """
    Service untuk mengelola tahun ajaran
    """

    def __init__(self, session: Session):
        super().__init__(session, TahunAjaran)

    def get_active(self) -> Optional[TahunAjaran]:
        """Get tahun ajaran yang aktif"""
        return TahunAjaran.get_active(self.session)

    def set_active(self, tahun_ajaran_id: int) -> TahunAjaran:
        """Set tahun ajaran sebagai aktif (nonaktifkan yang lain)"""
        # Nonaktifkan semua
        self.session.query(TahunAjaran).update({TahunAjaran.is_aktif: False})

        # Aktifkan yang dipilih
        tahun = self.get_by_id(tahun_ajaran_id)
        if tahun:
            tahun.is_aktif = True
            self.session.flush()

        return tahun

    def get_all_ordered(self) -> List[TahunAjaran]:
        """Get semua tahun ajaran ordered by kode desc"""
        return self.session.query(TahunAjaran).order_by(
            TahunAjaran.kode.desc()
        ).all()
