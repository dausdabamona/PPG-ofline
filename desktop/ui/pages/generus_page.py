"""
Generus Page - Halaman data generus
"""
from PyQt6.QtWidgets import (
    QHBoxLayout, QVBoxLayout, QComboBox, QLabel, QMessageBox
)
from PyQt6.QtCore import Qt
from sqlalchemy.orm import Session
from datetime import date

from .base_page import BasePage
from ..components.table_widget import DataTableWidget
from ..components.form_dialog import FormDialog
from services.jamaah_service import JamaahService
from services.wilayah_service import WilayahService, JenjangService
from config import COLORS


class GenerusPage(BasePage):
    """
    Halaman Data Generus dengan:
    - Tabel data generus
    - Filter wilayah & jenjang
    - CRUD operations
    """

    def __init__(self, session: Session, parent=None):
        super().__init__(session, parent)
        self.jamaah_service = JamaahService(session)
        self.wilayah_service = WilayahService(session)
        self.jenjang_service = JenjangService(session)
        self._setup_ui()

    def _setup_ui(self):
        # Header with add button
        self.set_header(
            "Data Generus",
            "Kelola data santri/generus yang belum menikah",
            actions=[
                {'label': '+ Tambah Generus', 'callback': self._on_add, 'primary': True}
            ]
        )

        # Filters row
        filter_layout = QHBoxLayout()

        # Wilayah filter
        filter_layout.addWidget(QLabel("Wilayah:"))
        self.wilayah_combo = QComboBox()
        self.wilayah_combo.setMinimumWidth(200)
        self.wilayah_combo.currentIndexChanged.connect(self._on_filter_changed)
        filter_layout.addWidget(self.wilayah_combo)

        # Jenjang filter
        filter_layout.addWidget(QLabel("Jenjang:"))
        self.jenjang_combo = QComboBox()
        self.jenjang_combo.setMinimumWidth(150)
        self.jenjang_combo.currentIndexChanged.connect(self._on_filter_changed)
        filter_layout.addWidget(self.jenjang_combo)

        filter_layout.addStretch()
        self.add_layout(filter_layout)

        # Table
        columns = [
            {'key': 'nama', 'label': 'Nama', 'width': 200},
            {'key': 'jenis_kelamin', 'label': 'L/P', 'width': 50, 'align': 'center',
             'formatter': lambda v, r: 'L' if v == 'L' else 'P' if v == 'P' else '-'},
            {'key': 'umur', 'label': 'Umur', 'width': 60, 'align': 'center',
             'formatter': lambda v, r: f"{v} th" if v else '-'},
            {'key': 'jenjang_nama', 'label': 'Jenjang', 'width': 120},
            {'key': 'wilayah_nama', 'label': 'Wilayah', 'width': 150},
            {'key': 'phone', 'label': 'Telepon', 'width': 120},
        ]

        self.table = DataTableWidget(columns, show_search=True, show_actions=True)
        self.table.row_double_clicked.connect(self._on_view)
        self.table.action_clicked.connect(self._on_action)
        self.add_widget(self.table)

        # Load filter options
        self._load_filters()

    def _load_filters(self):
        """Load filter options"""
        # Wilayah
        self.wilayah_combo.clear()
        self.wilayah_combo.addItem("Semua Wilayah", None)
        for w in self.wilayah_service.get_flat_list():
            self.wilayah_combo.addItem(w['display'], w['id'])

        # Jenjang
        self.jenjang_combo.clear()
        self.jenjang_combo.addItem("Semua Jenjang", None)
        for j in self.jenjang_service.get_all_active():
            self.jenjang_combo.addItem(j.nama, j.id)

    def refresh(self):
        """Refresh table data"""
        wilayah_id = self.wilayah_combo.currentData()
        jenjang_id = self.jenjang_combo.currentData()

        data = self.jamaah_service.get_generus(
            wilayah_id=wilayah_id,
            jenjang_id=jenjang_id
        )
        self.table.set_data(data)

    def _on_filter_changed(self):
        """Handle filter change"""
        self.refresh()

    def _on_add(self):
        """Handle add button click"""
        fields = self._get_form_fields()
        dialog = FormDialog("Tambah Generus", fields, parent=self)

        if dialog.exec():
            data = dialog.get_data()
            try:
                # Separate jamaah data and enrollment data
                wilayah_id = data.pop('wilayah_id', None)
                jenjang_id = data.pop('jenjang_id', None)

                self.jamaah_service.create_with_enrollment(
                    jamaah_data=data,
                    wilayah_id=wilayah_id,
                    jenjang_id=jenjang_id
                )
                self.session.commit()
                self.refresh()
                QMessageBox.information(self, "Sukses", "Data generus berhasil ditambahkan!")
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", f"Gagal menyimpan data: {str(e)}")

    def _on_view(self, row_data: dict):
        """Handle view/double-click"""
        self._on_edit(row_data)

    def _on_action(self, action: str, row_data: dict):
        """Handle table action buttons"""
        if action == 'edit':
            self._on_edit(row_data)
        elif action == 'delete':
            self._on_delete(row_data)

    def _on_edit(self, row_data: dict):
        """Handle edit"""
        fields = self._get_form_fields()
        dialog = FormDialog("Edit Generus", fields, data=row_data, parent=self)

        if dialog.exec():
            data = dialog.get_data()
            try:
                jamaah_id = row_data['id']
                wilayah_id = data.pop('wilayah_id', None)
                jenjang_id = data.pop('jenjang_id', None)

                # Update jamaah
                self.jamaah_service.update(jamaah_id, data)

                # Update enrollment if changed
                if wilayah_id and wilayah_id != row_data.get('wilayah_id'):
                    self.jamaah_service.pindah_wilayah(jamaah_id, wilayah_id)

                if jenjang_id and jenjang_id != row_data.get('jenjang_id'):
                    self.jamaah_service.naik_jenjang(jamaah_id, jenjang_id)

                self.session.commit()
                self.refresh()
                QMessageBox.information(self, "Sukses", "Data generus berhasil diperbarui!")
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", f"Gagal memperbarui data: {str(e)}")

    def _on_delete(self, row_data: dict):
        """Handle delete"""
        reply = QMessageBox.question(
            self,
            "Konfirmasi Hapus",
            f"Yakin ingin menghapus data {row_data['nama']}?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )

        if reply == QMessageBox.StandardButton.Yes:
            try:
                self.jamaah_service.delete(row_data['id'], soft=True)
                self.session.commit()
                self.refresh()
                QMessageBox.information(self, "Sukses", "Data berhasil dihapus!")
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", f"Gagal menghapus data: {str(e)}")

    def _get_form_fields(self) -> list:
        """Get form field definitions"""
        # Wilayah options
        wilayah_options = [(w['id'], w['display']) for w in self.wilayah_service.get_flat_list()]

        # Jenjang options
        jenjang_options = [(j.id, j.nama) for j in self.jenjang_service.get_all_active()]

        return [
            {'key': 'nama', 'label': 'Nama Lengkap', 'type': 'text', 'required': True, 'max_length': 255},
            {'key': 'nama_panggilan', 'label': 'Nama Panggilan', 'type': 'text', 'max_length': 100},
            {'key': 'jenis_kelamin', 'label': 'Jenis Kelamin', 'type': 'select', 'required': True,
             'options': [('L', 'Laki-laki'), ('P', 'Perempuan')], 'allow_empty': False},
            {'key': 'tanggal_lahir', 'label': 'Tanggal Lahir', 'type': 'date'},
            {'key': 'tempat_lahir', 'label': 'Tempat Lahir', 'type': 'text', 'max_length': 100},
            {'key': 'wilayah_id', 'label': 'Wilayah', 'type': 'select', 'required': True,
             'options': wilayah_options},
            {'key': 'jenjang_id', 'label': 'Jenjang', 'type': 'select',
             'options': jenjang_options},
            {'key': 'phone', 'label': 'No. Telepon', 'type': 'phone'},
            {'key': 'alamat_lengkap', 'label': 'Alamat', 'type': 'textarea'},
        ]
