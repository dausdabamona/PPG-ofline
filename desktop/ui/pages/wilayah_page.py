"""
Wilayah Page - Halaman manajemen wilayah hierarkis
Daerah > Desa > Kelompok
"""
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QTreeWidget, QTreeWidgetItem,
    QPushButton, QLabel, QMessageBox, QMenu, QFrame, QSplitter,
    QFormLayout, QLineEdit, QComboBox, QGroupBox
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QAction
from sqlalchemy.orm import Session

from .base_page import BasePage
from ..components.form_dialog import FormDialog
from services import WilayahService
from database.models import Wilayah
from config import COLORS


class WilayahPage(BasePage):
    """
    Halaman Manajemen Wilayah dengan Tree View
    Struktur: Daerah > Desa > Kelompok
    """

    def __init__(self, session: Session, parent=None):
        super().__init__(session, parent)
        self.wilayah_service = WilayahService(session)
        self._selected_wilayah = None
        self._setup_ui()

    def _setup_ui(self):
        self.set_header(
            "Manajemen Wilayah",
            "Kelola struktur wilayah: Daerah > Desa > Kelompok"
        )

        # Main content with splitter
        splitter = QSplitter(Qt.Orientation.Horizontal)

        # Left panel - Tree view
        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        left_layout.setContentsMargins(0, 0, 0, 0)

        # Tree toolbar
        tree_toolbar = QHBoxLayout()

        add_daerah_btn = QPushButton("+ Daerah")
        add_daerah_btn.setStyleSheet(f"background-color: {COLORS['primary']}; color: white; padding: 8px 16px;")
        add_daerah_btn.clicked.connect(lambda: self._on_add('daerah'))
        tree_toolbar.addWidget(add_daerah_btn)

        refresh_btn = QPushButton("Refresh")
        refresh_btn.clicked.connect(self.refresh)
        tree_toolbar.addWidget(refresh_btn)

        tree_toolbar.addStretch()
        left_layout.addLayout(tree_toolbar)

        # Tree widget
        self.tree = QTreeWidget()
        self.tree.setHeaderLabels(['Nama Wilayah', 'Kode', 'Tingkat'])
        self.tree.setColumnWidth(0, 250)
        self.tree.setColumnWidth(1, 100)
        self.tree.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.tree.customContextMenuRequested.connect(self._show_context_menu)
        self.tree.itemClicked.connect(self._on_item_selected)
        self.tree.setAlternatingRowColors(True)
        left_layout.addWidget(self.tree)

        splitter.addWidget(left_panel)

        # Right panel - Detail view
        right_panel = QFrame()
        right_panel.setFrameStyle(QFrame.Shape.StyledPanel)
        right_panel.setStyleSheet(f"background-color: {COLORS['surface']}; border-radius: 8px;")
        right_layout = QVBoxLayout(right_panel)

        # Detail header
        self.detail_title = QLabel("Pilih Wilayah")
        self.detail_title.setStyleSheet("font-size: 18px; font-weight: bold; padding: 10px;")
        right_layout.addWidget(self.detail_title)

        # Detail info
        detail_group = QGroupBox("Informasi Wilayah")
        detail_form = QFormLayout(detail_group)

        self.lbl_kode = QLabel("-")
        self.lbl_nama = QLabel("-")
        self.lbl_tingkat = QLabel("-")
        self.lbl_parent = QLabel("-")
        self.lbl_jumlah_anak = QLabel("-")
        self.lbl_jumlah_generus = QLabel("-")

        detail_form.addRow("Kode:", self.lbl_kode)
        detail_form.addRow("Nama:", self.lbl_nama)
        detail_form.addRow("Tingkat:", self.lbl_tingkat)
        detail_form.addRow("Parent:", self.lbl_parent)
        detail_form.addRow("Sub-Wilayah:", self.lbl_jumlah_anak)
        detail_form.addRow("Jumlah Generus:", self.lbl_jumlah_generus)

        right_layout.addWidget(detail_group)

        # Action buttons
        action_layout = QHBoxLayout()

        self.btn_add_child = QPushButton("+ Tambah Sub-Wilayah")
        self.btn_add_child.setStyleSheet(f"background-color: {COLORS['primary']}; color: white; padding: 8px 16px;")
        self.btn_add_child.clicked.connect(self._on_add_child)
        self.btn_add_child.setEnabled(False)
        action_layout.addWidget(self.btn_add_child)

        self.btn_edit = QPushButton("Edit")
        self.btn_edit.setStyleSheet(f"background-color: {COLORS['info']}; color: white; padding: 8px 16px;")
        self.btn_edit.clicked.connect(self._on_edit)
        self.btn_edit.setEnabled(False)
        action_layout.addWidget(self.btn_edit)

        self.btn_delete = QPushButton("Hapus")
        self.btn_delete.setStyleSheet(f"background-color: {COLORS['error']}; color: white; padding: 8px 16px;")
        self.btn_delete.clicked.connect(self._on_delete)
        self.btn_delete.setEnabled(False)
        action_layout.addWidget(self.btn_delete)

        action_layout.addStretch()
        right_layout.addLayout(action_layout)

        right_layout.addStretch()
        splitter.addWidget(right_panel)

        # Set splitter sizes
        splitter.setSizes([400, 300])

        self.add_widget(splitter)

    def refresh(self):
        """Load dan tampilkan tree wilayah"""
        self.tree.clear()
        self._selected_wilayah = None
        self._update_detail_panel()

        tree_data = self.wilayah_service.get_tree()
        for node in tree_data:
            self._add_tree_node(node, None)

        self.tree.expandAll()

    def _add_tree_node(self, node: dict, parent_item: QTreeWidgetItem):
        """Tambah node ke tree secara rekursif"""
        if parent_item:
            item = QTreeWidgetItem(parent_item)
        else:
            item = QTreeWidgetItem(self.tree)

        item.setText(0, node['nama'])
        item.setText(1, node.get('kode', ''))
        item.setText(2, node['tingkat'].capitalize())
        item.setData(0, Qt.ItemDataRole.UserRole, node)

        # Set icon/color based on tingkat
        tingkat = node['tingkat']
        if tingkat == 'daerah':
            item.setBackground(0, COLORS['primary_light'] if hasattr(COLORS, 'get') else Qt.GlobalColor.transparent)

        for child in node.get('children', []):
            self._add_tree_node(child, item)

    def _on_item_selected(self, item: QTreeWidgetItem, column: int):
        """Handle item selection"""
        node = item.data(0, Qt.ItemDataRole.UserRole)
        if node:
            self._selected_wilayah = self.wilayah_service.get_by_id(node['id'])
            self._update_detail_panel()

    def _update_detail_panel(self):
        """Update panel detail berdasarkan wilayah terpilih"""
        if not self._selected_wilayah:
            self.detail_title.setText("Pilih Wilayah")
            self.lbl_kode.setText("-")
            self.lbl_nama.setText("-")
            self.lbl_tingkat.setText("-")
            self.lbl_parent.setText("-")
            self.lbl_jumlah_anak.setText("-")
            self.lbl_jumlah_generus.setText("-")
            self.btn_add_child.setEnabled(False)
            self.btn_edit.setEnabled(False)
            self.btn_delete.setEnabled(False)
            return

        w = self._selected_wilayah
        self.detail_title.setText(w.nama)
        self.lbl_kode.setText(w.kode or "-")
        self.lbl_nama.setText(w.nama)
        self.lbl_tingkat.setText(w.tingkat.capitalize())
        self.lbl_parent.setText(w.parent.nama if w.parent else "-")

        # Count children
        children = self.wilayah_service.get_children(w.id)
        self.lbl_jumlah_anak.setText(str(len(children)))

        # Count generus (from enrollments)
        generus_count = len(w.enrollments) if hasattr(w, 'enrollments') else 0
        self.lbl_jumlah_generus.setText(str(generus_count))

        # Enable/disable buttons
        can_add_child = w.tingkat in ['daerah', 'desa']
        self.btn_add_child.setEnabled(can_add_child)
        if can_add_child:
            next_level = 'Desa' if w.tingkat == 'daerah' else 'Kelompok'
            self.btn_add_child.setText(f"+ Tambah {next_level}")

        self.btn_edit.setEnabled(True)
        self.btn_delete.setEnabled(len(children) == 0)

    def _show_context_menu(self, position):
        """Show right-click context menu"""
        item = self.tree.itemAt(position)
        if not item:
            return

        node = item.data(0, Qt.ItemDataRole.UserRole)
        if not node:
            return

        menu = QMenu()

        # Add child action
        if node['tingkat'] in ['daerah', 'desa']:
            next_level = 'Desa' if node['tingkat'] == 'daerah' else 'Kelompok'
            add_action = QAction(f"Tambah {next_level}", self)
            add_action.triggered.connect(lambda: self._on_add_child_for(node))
            menu.addAction(add_action)

        # Edit action
        edit_action = QAction("Edit", self)
        edit_action.triggered.connect(lambda: self._on_edit_for(node))
        menu.addAction(edit_action)

        # Delete action
        delete_action = QAction("Hapus", self)
        delete_action.triggered.connect(lambda: self._on_delete_for(node))
        menu.addAction(delete_action)

        menu.exec(self.tree.mapToGlobal(position))

    def _on_add(self, tingkat: str, parent_id: int = None):
        """Tambah wilayah baru"""
        tingkat_label = {'daerah': 'Daerah', 'desa': 'Desa', 'kelompok': 'Kelompok'}

        fields = [
            {'key': 'kode', 'label': 'Kode', 'type': 'text', 'required': True, 'max_length': 50},
            {'key': 'nama', 'label': 'Nama', 'type': 'text', 'required': True, 'max_length': 100},
        ]

        dialog = FormDialog(f"Tambah {tingkat_label.get(tingkat, tingkat)}", fields, parent=self)

        if dialog.exec():
            data = dialog.get_data()
            data['tingkat'] = tingkat
            data['parent_id'] = parent_id

            try:
                self.wilayah_service.create_with_validation(data)
                self.session.commit()
                self.refresh()
                QMessageBox.information(self, "Sukses", f"{tingkat_label.get(tingkat)} berhasil ditambahkan!")
            except ValueError as e:
                QMessageBox.warning(self, "Validasi Gagal", str(e))
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", f"Gagal menyimpan: {str(e)}")

    def _on_add_child(self):
        """Tambah sub-wilayah dari selected"""
        if not self._selected_wilayah:
            return

        tingkat_map = {'daerah': 'desa', 'desa': 'kelompok'}
        new_tingkat = tingkat_map.get(self._selected_wilayah.tingkat)
        if new_tingkat:
            self._on_add(new_tingkat, self._selected_wilayah.id)

    def _on_add_child_for(self, node: dict):
        """Tambah sub-wilayah dari context menu"""
        tingkat_map = {'daerah': 'desa', 'desa': 'kelompok'}
        new_tingkat = tingkat_map.get(node['tingkat'])
        if new_tingkat:
            self._on_add(new_tingkat, node['id'])

    def _on_edit(self):
        """Edit selected wilayah"""
        if self._selected_wilayah:
            self._on_edit_for({'id': self._selected_wilayah.id})

    def _on_edit_for(self, node: dict):
        """Edit wilayah dari context menu"""
        wilayah = self.wilayah_service.get_by_id(node['id'])
        if not wilayah:
            return

        fields = [
            {'key': 'kode', 'label': 'Kode', 'type': 'text', 'required': True, 'max_length': 50},
            {'key': 'nama', 'label': 'Nama', 'type': 'text', 'required': True, 'max_length': 100},
        ]

        data = {'kode': wilayah.kode, 'nama': wilayah.nama}
        dialog = FormDialog(f"Edit {wilayah.tingkat.capitalize()}", fields, data=data, parent=self)

        if dialog.exec():
            new_data = dialog.get_data()
            try:
                self.wilayah_service.update(wilayah.id, new_data)
                self.session.commit()
                self.refresh()
                QMessageBox.information(self, "Sukses", "Wilayah berhasil diperbarui!")
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", f"Gagal memperbarui: {str(e)}")

    def _on_delete(self):
        """Delete selected wilayah"""
        if self._selected_wilayah:
            self._on_delete_for({'id': self._selected_wilayah.id, 'nama': self._selected_wilayah.nama})

    def _on_delete_for(self, node: dict):
        """Delete wilayah dari context menu"""
        # Check children
        children = self.wilayah_service.get_children(node['id'])
        if children:
            QMessageBox.warning(
                self,
                "Tidak Dapat Menghapus",
                f"Wilayah '{node['nama']}' masih memiliki {len(children)} sub-wilayah.\n"
                "Hapus sub-wilayah terlebih dahulu."
            )
            return

        reply = QMessageBox.question(
            self,
            "Konfirmasi Hapus",
            f"Yakin ingin menghapus wilayah '{node['nama']}'?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )

        if reply == QMessageBox.StandardButton.Yes:
            try:
                self.wilayah_service.delete(node['id'])
                self.session.commit()
                self.refresh()
                QMessageBox.information(self, "Sukses", "Wilayah berhasil dihapus!")
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", f"Gagal menghapus: {str(e)}")
