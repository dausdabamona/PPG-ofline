"""
Wilayah Page - Halaman manajemen wilayah hierarkis
Daerah (Pengurus PPG) > Desa (5 Unsur) > Kelompok (5 Unsur)
"""
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QTreeWidget, QTreeWidgetItem,
    QPushButton, QLabel, QMessageBox, QMenu, QFrame, QSplitter,
    QFormLayout, QGroupBox, QTableWidget, QTableWidgetItem, QTabWidget
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QAction, QColor
from sqlalchemy.orm import Session

from .base_page import BasePage
from ..components.form_dialog import FormDialog
from database.models import Wilayah
from config import COLORS


class WilayahPage(BasePage):
    """
    Halaman Manajemen Wilayah dengan Tree View
    Struktur: Daerah (Pengurus PPG) > Desa (5 Unsur) > Kelompok (5 Unsur)
    """

    def __init__(self, session: Session, parent=None):
        super().__init__(session, parent)
        self._selected_wilayah_id = None
        self._setup_ui()

    def _setup_ui(self):
        self.set_header(
            "Manajemen Wilayah",
            "Kelola struktur wilayah: Daerah (Pengurus PPG) > Desa (5 Unsur) > Kelompok (5 Unsur)"
        )

        # Main content with splitter
        splitter = QSplitter(Qt.Orientation.Horizontal)

        # Left panel - Tree view
        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        left_layout.setContentsMargins(0, 0, 0, 0)

        # Tree toolbar
        tree_toolbar = QHBoxLayout()

        add_daerah_btn = QPushButton("+ Tambah Daerah")
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
        self.tree.setHeaderLabels(['Nama Wilayah', 'Kode', 'Tingkat', 'Organisasi'])
        self.tree.setColumnWidth(0, 200)
        self.tree.setColumnWidth(1, 80)
        self.tree.setColumnWidth(2, 80)
        self.tree.setColumnWidth(3, 100)
        self.tree.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.tree.customContextMenuRequested.connect(self._show_context_menu)
        self.tree.itemClicked.connect(self._on_item_selected)
        self.tree.itemDoubleClicked.connect(self._on_item_double_clicked)
        self.tree.setAlternatingRowColors(True)
        left_layout.addWidget(self.tree)

        splitter.addWidget(left_panel)

        # Right panel - Detail view with tabs
        right_panel = QFrame()
        right_panel.setFrameStyle(QFrame.Shape.StyledPanel)
        right_panel.setStyleSheet(f"background-color: {COLORS['surface']};")
        right_layout = QVBoxLayout(right_panel)

        # Detail header
        self.detail_title = QLabel("Pilih Wilayah")
        self.detail_title.setStyleSheet("font-size: 18px; font-weight: bold; padding: 10px;")
        right_layout.addWidget(self.detail_title)

        # Tabs for info and organization
        self.tabs = QTabWidget()

        # Tab 1: Info Wilayah
        info_tab = QWidget()
        info_layout = QVBoxLayout(info_tab)

        detail_group = QGroupBox("Informasi Wilayah")
        detail_form = QFormLayout(detail_group)

        self.lbl_kode = QLabel("-")
        self.lbl_nama = QLabel("-")
        self.lbl_tingkat = QLabel("-")
        self.lbl_parent = QLabel("-")
        self.lbl_jumlah_anak = QLabel("-")
        self.lbl_jumlah_generus = QLabel("-")
        self.lbl_organisasi = QLabel("-")

        detail_form.addRow("Kode:", self.lbl_kode)
        detail_form.addRow("Nama:", self.lbl_nama)
        detail_form.addRow("Tingkat:", self.lbl_tingkat)
        detail_form.addRow("Parent:", self.lbl_parent)
        detail_form.addRow("Sub-Wilayah:", self.lbl_jumlah_anak)
        detail_form.addRow("Jumlah Generus:", self.lbl_jumlah_generus)
        detail_form.addRow("Tipe Organisasi:", self.lbl_organisasi)

        info_layout.addWidget(detail_group)

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
        info_layout.addLayout(action_layout)
        info_layout.addStretch()

        self.tabs.addTab(info_tab, "Info Wilayah")

        # Tab 2: Struktur Organisasi
        org_tab = QWidget()
        org_layout = QVBoxLayout(org_tab)

        self.org_title = QLabel("Struktur Organisasi")
        self.org_title.setStyleSheet("font-size: 14px; font-weight: bold;")
        org_layout.addWidget(self.org_title)

        self.org_table = QTableWidget()
        self.org_table.setColumnCount(3)
        self.org_table.setHorizontalHeaderLabels(['Jabatan', 'Nama', 'Kontak'])
        self.org_table.horizontalHeader().setStretchLastSection(True)
        self.org_table.setAlternatingRowColors(True)
        org_layout.addWidget(self.org_table)

        self.tabs.addTab(org_tab, "Organisasi")

        right_layout.addWidget(self.tabs)
        splitter.addWidget(right_panel)

        # Set splitter sizes
        splitter.setSizes([450, 350])

        self.add_widget(splitter)

    def refresh(self):
        """Load dan tampilkan tree wilayah"""
        self.tree.clear()
        self._selected_wilayah_id = None
        self._update_detail_panel()

        try:
            # Get all daerah (root)
            daerah_list = self.session.query(Wilayah).filter(
                Wilayah.tingkat == 'daerah',
                Wilayah.is_aktif == True
            ).order_by(Wilayah.nama).all()

            for daerah in daerah_list:
                self._add_tree_node(daerah, None)

            self.tree.expandAll()
        except Exception as e:
            print(f"Error loading wilayah: {e}")

    def _add_tree_node(self, wilayah: Wilayah, parent_item: QTreeWidgetItem):
        """Tambah node ke tree secara rekursif"""
        if parent_item:
            item = QTreeWidgetItem(parent_item)
        else:
            item = QTreeWidgetItem(self.tree)

        item.setText(0, wilayah.nama)
        item.setText(1, wilayah.kode or "")
        item.setText(2, wilayah.tingkat.capitalize())

        # Set organisasi type
        org_type = self._get_org_type(wilayah.tingkat)
        item.setText(3, org_type)

        # Store only ID
        item.setData(0, Qt.ItemDataRole.UserRole, wilayah.id)

        # Set color based on tingkat
        if wilayah.tingkat == 'daerah':
            item.setBackground(0, QColor('#d1fae5'))  # Light green
        elif wilayah.tingkat == 'desa':
            item.setBackground(0, QColor('#e0f2fe'))  # Light blue

        # Add children
        try:
            children = self.session.query(Wilayah).filter(
                Wilayah.parent_id == wilayah.id,
                Wilayah.is_aktif == True
            ).order_by(Wilayah.nama).all()

            for child in children:
                self._add_tree_node(child, item)
        except Exception as e:
            print(f"Error loading children: {e}")

    def _get_org_type(self, tingkat: str) -> str:
        """Get organization type based on tingkat"""
        org_map = {
            'daerah': 'Pengurus PPG',
            'desa': '5 Unsur',
            'kelompok': '5 Unsur'
        }
        return org_map.get(tingkat, '-')

    def _get_org_structure(self, tingkat: str) -> list:
        """Get organization structure based on tingkat"""
        if tingkat == 'daerah':
            return [
                ('Ketua', ''),
                ('Wakil Ketua', ''),
                ('Sekretaris', ''),
                ('Bendahara', ''),
                ('Koordinator Wilayah', ''),
                ('Koordinator Kurikulum', ''),
                ('Koordinator Sarana', ''),
            ]
        else:  # desa or kelompok - 5 Unsur
            return [
                ('Penanggung Jawab', ''),
                ('Ketua', ''),
                ('Sekretaris', ''),
                ('Bendahara', ''),
                ('Muballigh', ''),
            ]

    def _get_selected_wilayah(self):
        """Get selected wilayah from database"""
        if self._selected_wilayah_id:
            return self.session.query(Wilayah).get(self._selected_wilayah_id)
        return None

    def _on_item_selected(self, item: QTreeWidgetItem, column: int):
        """Handle item selection"""
        wilayah_id = item.data(0, Qt.ItemDataRole.UserRole)
        if wilayah_id:
            self._selected_wilayah_id = wilayah_id
            self._update_detail_panel()

    def _on_item_double_clicked(self, item: QTreeWidgetItem, column: int):
        """Handle double click to edit"""
        self._on_edit()

    def _update_detail_panel(self):
        """Update panel detail berdasarkan wilayah terpilih"""
        w = self._get_selected_wilayah()

        if not w:
            self.detail_title.setText("Pilih Wilayah")
            self.lbl_kode.setText("-")
            self.lbl_nama.setText("-")
            self.lbl_tingkat.setText("-")
            self.lbl_parent.setText("-")
            self.lbl_jumlah_anak.setText("-")
            self.lbl_jumlah_generus.setText("-")
            self.lbl_organisasi.setText("-")
            self.btn_add_child.setEnabled(False)
            self.btn_edit.setEnabled(False)
            self.btn_delete.setEnabled(False)
            self.org_table.setRowCount(0)
            return

        self.detail_title.setText(w.nama)
        self.lbl_kode.setText(w.kode or "-")
        self.lbl_nama.setText(w.nama)
        self.lbl_tingkat.setText(w.tingkat.capitalize())
        self.lbl_parent.setText(w.parent.nama if w.parent else "-")
        self.lbl_organisasi.setText(self._get_org_type(w.tingkat))

        # Count children
        children_count = self.session.query(Wilayah).filter(
            Wilayah.parent_id == w.id,
            Wilayah.is_aktif == True
        ).count()
        self.lbl_jumlah_anak.setText(str(children_count))

        # Count generus (from enrollments)
        generus_count = len(w.enrollments) if w.enrollments else 0
        self.lbl_jumlah_generus.setText(str(generus_count))

        # Enable/disable buttons
        can_add_child = w.tingkat in ['daerah', 'desa']
        self.btn_add_child.setEnabled(can_add_child)
        if can_add_child:
            next_level = 'Desa' if w.tingkat == 'daerah' else 'Kelompok'
            self.btn_add_child.setText(f"+ Tambah {next_level}")

        self.btn_edit.setEnabled(True)
        self.btn_delete.setEnabled(children_count == 0)

        # Update organization table
        self._update_org_table(w.tingkat)

    def _update_org_table(self, tingkat: str):
        """Update organization structure table"""
        org_structure = self._get_org_structure(tingkat)
        self.org_table.setRowCount(len(org_structure))

        org_type = self._get_org_type(tingkat)
        self.org_title.setText(f"Struktur {org_type}")

        for row, (jabatan, nama) in enumerate(org_structure):
            self.org_table.setItem(row, 0, QTableWidgetItem(jabatan))
            self.org_table.setItem(row, 1, QTableWidgetItem(nama))
            self.org_table.setItem(row, 2, QTableWidgetItem(""))

    def _show_context_menu(self, position):
        """Show right-click context menu"""
        item = self.tree.itemAt(position)
        if not item:
            return

        wilayah_id = item.data(0, Qt.ItemDataRole.UserRole)
        if not wilayah_id:
            return

        wilayah = self.session.query(Wilayah).get(wilayah_id)
        if not wilayah:
            return

        self._selected_wilayah_id = wilayah_id

        menu = QMenu()

        # Add child action
        if wilayah.tingkat in ['daerah', 'desa']:
            next_level = 'Desa' if wilayah.tingkat == 'daerah' else 'Kelompok'
            add_action = QAction(f"Tambah {next_level}", self)
            add_action.triggered.connect(lambda: self._on_add(
                'desa' if wilayah.tingkat == 'daerah' else 'kelompok',
                wilayah.id
            ))
            menu.addAction(add_action)

        # Edit action
        edit_action = QAction("Edit", self)
        edit_action.triggered.connect(self._on_edit)
        menu.addAction(edit_action)

        # Delete action
        delete_action = QAction("Hapus", self)
        delete_action.triggered.connect(self._on_delete)
        menu.addAction(delete_action)

        menu.exec(self.tree.mapToGlobal(position))

    def _on_add(self, tingkat: str, parent_id: int = None):
        """Tambah wilayah baru"""
        tingkat_label = {
            'daerah': 'Daerah (Pengurus PPG)',
            'desa': 'Desa (5 Unsur)',
            'kelompok': 'Kelompok (5 Unsur)'
        }

        fields = [
            {'key': 'kode', 'label': 'Kode Wilayah', 'type': 'text', 'required': True,
             'max_length': 20, 'placeholder': 'Contoh: SRG-01'},
            {'key': 'nama', 'label': 'Nama Wilayah', 'type': 'text', 'required': True,
             'max_length': 100, 'placeholder': 'Nama wilayah'},
        ]

        dialog = FormDialog(f"Tambah {tingkat_label.get(tingkat, tingkat)}", fields, parent=self)

        if dialog.exec():
            data = dialog.get_data()

            try:
                # Check kode uniqueness
                existing = self.session.query(Wilayah).filter(
                    Wilayah.kode == data['kode']
                ).first()
                if existing:
                    QMessageBox.warning(self, "Validasi Gagal", f"Kode '{data['kode']}' sudah digunakan!")
                    return

                wilayah = Wilayah(
                    kode=data['kode'],
                    nama=data['nama'],
                    tingkat=tingkat,
                    parent_id=parent_id
                )
                self.session.add(wilayah)
                self.session.commit()
                self.refresh()
                QMessageBox.information(self, "Sukses", f"{tingkat.capitalize()} berhasil ditambahkan!")
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", f"Gagal menyimpan: {str(e)}")

    def _on_add_child(self):
        """Tambah sub-wilayah dari selected"""
        w = self._get_selected_wilayah()
        if not w:
            return

        tingkat_map = {'daerah': 'desa', 'desa': 'kelompok'}
        new_tingkat = tingkat_map.get(w.tingkat)
        if new_tingkat:
            self._on_add(new_tingkat, w.id)

    def _on_edit(self):
        """Edit selected wilayah"""
        w = self._get_selected_wilayah()
        if not w:
            QMessageBox.warning(self, "Peringatan", "Pilih wilayah yang akan diedit!")
            return

        tingkat_label = {
            'daerah': 'Daerah (Pengurus PPG)',
            'desa': 'Desa (5 Unsur)',
            'kelompok': 'Kelompok (5 Unsur)'
        }

        fields = [
            {'key': 'kode', 'label': 'Kode Wilayah', 'type': 'text', 'required': True, 'max_length': 20},
            {'key': 'nama', 'label': 'Nama Wilayah', 'type': 'text', 'required': True, 'max_length': 100},
        ]

        data = {'kode': w.kode, 'nama': w.nama}
        dialog = FormDialog(f"Edit {tingkat_label.get(w.tingkat, w.tingkat)}", fields, data=data, parent=self)

        if dialog.exec():
            new_data = dialog.get_data()
            try:
                # Check kode uniqueness (exclude current)
                if new_data['kode'] != w.kode:
                    existing = self.session.query(Wilayah).filter(
                        Wilayah.kode == new_data['kode'],
                        Wilayah.id != w.id
                    ).first()
                    if existing:
                        QMessageBox.warning(self, "Validasi Gagal", f"Kode '{new_data['kode']}' sudah digunakan!")
                        return

                w.kode = new_data['kode']
                w.nama = new_data['nama']
                self.session.commit()
                self.refresh()
                QMessageBox.information(self, "Sukses", "Wilayah berhasil diperbarui!")
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", f"Gagal memperbarui: {str(e)}")

    def _on_delete(self):
        """Delete selected wilayah"""
        w = self._get_selected_wilayah()
        if not w:
            QMessageBox.warning(self, "Peringatan", "Pilih wilayah yang akan dihapus!")
            return

        # Check children
        children_count = self.session.query(Wilayah).filter(
            Wilayah.parent_id == w.id,
            Wilayah.is_aktif == True
        ).count()

        if children_count > 0:
            QMessageBox.warning(
                self,
                "Tidak Dapat Menghapus",
                f"Wilayah '{w.nama}' masih memiliki {children_count} sub-wilayah.\n"
                "Hapus sub-wilayah terlebih dahulu."
            )
            return

        reply = QMessageBox.question(
            self,
            "Konfirmasi Hapus",
            f"Yakin ingin menghapus wilayah '{w.nama}'?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )

        if reply == QMessageBox.StandardButton.Yes:
            try:
                w.is_aktif = False
                self.session.commit()
                self._selected_wilayah_id = None
                self.refresh()
                QMessageBox.information(self, "Sukses", "Wilayah berhasil dihapus!")
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", f"Gagal menghapus: {str(e)}")
