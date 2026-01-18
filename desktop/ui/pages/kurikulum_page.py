"""
Kurikulum Page - Halaman manajemen kurikulum dan materi
Bidang > Kategori > Materi Item
"""
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QTreeWidget, QTreeWidgetItem,
    QPushButton, QLabel, QMessageBox, QMenu, QFrame, QSplitter,
    QFormLayout, QGroupBox, QComboBox, QTableWidget, QTableWidgetItem,
    QHeaderView, QAbstractItemView
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QAction
from sqlalchemy.orm import Session

from .base_page import BasePage
from ..components.form_dialog import FormDialog
from database.models import BidangMateri, KategoriMateri, MateriItem
from config import COLORS


class KurikulumPage(BasePage):
    """
    Halaman Manajemen Kurikulum
    Struktur: Bidang > Kategori > Materi Item
    """

    def __init__(self, session: Session, parent=None):
        super().__init__(session, parent)
        self._selected_bidang = None
        self._selected_kategori = None
        self._setup_ui()

    def _setup_ui(self):
        self.set_header(
            "Manajemen Kurikulum",
            "Kelola bidang materi, kategori, dan item materi pembelajaran"
        )

        # Main splitter
        splitter = QSplitter(Qt.Orientation.Horizontal)

        # Left panel - Bidang & Kategori tree
        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        left_layout.setContentsMargins(0, 0, 0, 0)

        # Toolbar
        toolbar = QHBoxLayout()
        add_bidang_btn = QPushButton("+ Bidang")
        add_bidang_btn.setStyleSheet(f"background-color: {COLORS['primary']}; color: white; padding: 8px 16px;")
        add_bidang_btn.clicked.connect(self._on_add_bidang)
        toolbar.addWidget(add_bidang_btn)
        toolbar.addStretch()
        left_layout.addLayout(toolbar)

        # Tree for Bidang & Kategori
        self.tree = QTreeWidget()
        self.tree.setHeaderLabels(['Nama', 'Kode'])
        self.tree.setColumnWidth(0, 200)
        self.tree.itemClicked.connect(self._on_tree_clicked)
        self.tree.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.tree.customContextMenuRequested.connect(self._show_tree_menu)
        left_layout.addWidget(self.tree)

        splitter.addWidget(left_panel)

        # Right panel - Materi items
        right_panel = QWidget()
        right_layout = QVBoxLayout(right_panel)
        right_layout.setContentsMargins(0, 0, 0, 0)

        # Kategori info
        self.kategori_label = QLabel("Pilih kategori untuk melihat materi")
        self.kategori_label.setStyleSheet("font-size: 16px; font-weight: bold; padding: 10px;")
        right_layout.addWidget(self.kategori_label)

        # Materi toolbar
        materi_toolbar = QHBoxLayout()
        self.add_materi_btn = QPushButton("+ Tambah Materi")
        self.add_materi_btn.setStyleSheet(f"background-color: {COLORS['primary']}; color: white; padding: 8px 16px;")
        self.add_materi_btn.clicked.connect(self._on_add_materi)
        self.add_materi_btn.setEnabled(False)
        materi_toolbar.addWidget(self.add_materi_btn)
        materi_toolbar.addStretch()
        right_layout.addLayout(materi_toolbar)

        # Materi table
        self.materi_table = QTableWidget()
        self.materi_table.setColumnCount(5)
        self.materi_table.setHorizontalHeaderLabels(['No', 'Nama Materi', 'Tipe', 'Target', 'Aksi'])
        self.materi_table.horizontalHeader().setStretchLastSection(True)
        self.materi_table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.materi_table.setAlternatingRowColors(True)
        right_layout.addWidget(self.materi_table)

        splitter.addWidget(right_panel)
        splitter.setSizes([300, 500])

        self.add_widget(splitter)

    def refresh(self):
        """Load data kurikulum"""
        self.tree.clear()
        self._selected_bidang = None
        self._selected_kategori = None
        self._update_materi_table()

        # Load bidang
        bidang_list = self.session.query(BidangMateri).filter(
            BidangMateri.is_aktif == True
        ).order_by(BidangMateri.urutan).all()

        for bidang in bidang_list:
            bidang_item = QTreeWidgetItem(self.tree)
            bidang_item.setText(0, bidang.nama)
            bidang_item.setText(1, "")
            bidang_item.setData(0, Qt.ItemDataRole.UserRole, {'type': 'bidang', 'id': bidang.id, 'data': bidang})

            # Load kategori
            for kategori in bidang.kategori:
                if kategori.is_aktif:
                    kat_item = QTreeWidgetItem(bidang_item)
                    kat_item.setText(0, kategori.nama)
                    kat_item.setText(1, kategori.kode or "")
                    kat_item.setData(0, Qt.ItemDataRole.UserRole, {'type': 'kategori', 'id': kategori.id, 'data': kategori})

        self.tree.expandAll()

    def _on_tree_clicked(self, item: QTreeWidgetItem, column: int):
        """Handle tree item click"""
        data = item.data(0, Qt.ItemDataRole.UserRole)
        if not data:
            return

        if data['type'] == 'bidang':
            self._selected_bidang = data['data']
            self._selected_kategori = None
            self.kategori_label.setText(f"Bidang: {data['data'].nama}")
            self.add_materi_btn.setEnabled(False)
            self._update_materi_table()
        elif data['type'] == 'kategori':
            self._selected_kategori = data['data']
            self.kategori_label.setText(f"Kategori: {data['data'].nama}")
            self.add_materi_btn.setEnabled(True)
            self._update_materi_table()

    def _update_materi_table(self):
        """Update tabel materi"""
        self.materi_table.setRowCount(0)

        if not self._selected_kategori:
            return

        materi_list = self.session.query(MateriItem).filter(
            MateriItem.kategori_id == self._selected_kategori.id,
            MateriItem.is_aktif == True
        ).order_by(MateriItem.nomor).all()

        self.materi_table.setRowCount(len(materi_list))

        for row, materi in enumerate(materi_list):
            self.materi_table.setItem(row, 0, QTableWidgetItem(materi.nomor or str(row + 1)))
            self.materi_table.setItem(row, 1, QTableWidgetItem(materi.nama))
            self.materi_table.setItem(row, 2, QTableWidgetItem(materi.tipe or "-"))
            self.materi_table.setItem(row, 3, QTableWidgetItem(materi.target_capaian or "-"))

            # Action buttons
            action_widget = QWidget()
            action_layout = QHBoxLayout(action_widget)
            action_layout.setContentsMargins(4, 2, 4, 2)

            edit_btn = QPushButton("Edit")
            edit_btn.setMaximumWidth(50)
            edit_btn.clicked.connect(lambda checked, m=materi: self._on_edit_materi(m))
            action_layout.addWidget(edit_btn)

            delete_btn = QPushButton("Hapus")
            delete_btn.setMaximumWidth(50)
            delete_btn.setStyleSheet(f"background-color: {COLORS['error']}; color: white;")
            delete_btn.clicked.connect(lambda checked, m=materi: self._on_delete_materi(m))
            action_layout.addWidget(delete_btn)

            self.materi_table.setCellWidget(row, 4, action_widget)

    def _show_tree_menu(self, position):
        """Show context menu for tree"""
        item = self.tree.itemAt(position)
        if not item:
            return

        data = item.data(0, Qt.ItemDataRole.UserRole)
        if not data:
            return

        menu = QMenu()

        if data['type'] == 'bidang':
            add_kat = QAction("Tambah Kategori", self)
            add_kat.triggered.connect(lambda: self._on_add_kategori(data['data']))
            menu.addAction(add_kat)

            edit_action = QAction("Edit Bidang", self)
            edit_action.triggered.connect(lambda: self._on_edit_bidang(data['data']))
            menu.addAction(edit_action)

        elif data['type'] == 'kategori':
            edit_action = QAction("Edit Kategori", self)
            edit_action.triggered.connect(lambda: self._on_edit_kategori(data['data']))
            menu.addAction(edit_action)

            delete_action = QAction("Hapus Kategori", self)
            delete_action.triggered.connect(lambda: self._on_delete_kategori(data['data']))
            menu.addAction(delete_action)

        menu.exec(self.tree.mapToGlobal(position))

    def _on_add_bidang(self):
        """Tambah bidang baru"""
        fields = [
            {'key': 'nama', 'label': 'Nama Bidang', 'type': 'text', 'required': True},
            {'key': 'urutan', 'label': 'Urutan', 'type': 'number'},
        ]

        dialog = FormDialog("Tambah Bidang Materi", fields, parent=self)
        if dialog.exec():
            data = dialog.get_data()
            try:
                bidang = BidangMateri(**data)
                self.session.add(bidang)
                self.session.commit()
                self.refresh()
                QMessageBox.information(self, "Sukses", "Bidang berhasil ditambahkan!")
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", str(e))

    def _on_edit_bidang(self, bidang):
        """Edit bidang"""
        fields = [
            {'key': 'nama', 'label': 'Nama Bidang', 'type': 'text', 'required': True},
            {'key': 'urutan', 'label': 'Urutan', 'type': 'number'},
        ]

        data = {'nama': bidang.nama, 'urutan': bidang.urutan or 0}
        dialog = FormDialog("Edit Bidang Materi", fields, data=data, parent=self)
        if dialog.exec():
            new_data = dialog.get_data()
            try:
                bidang.nama = new_data['nama']
                bidang.urutan = new_data['urutan']
                self.session.commit()
                self.refresh()
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", str(e))

    def _on_add_kategori(self, bidang):
        """Tambah kategori ke bidang"""
        fields = [
            {'key': 'nama', 'label': 'Nama Kategori', 'type': 'text', 'required': True},
            {'key': 'kode', 'label': 'Kode', 'type': 'text'},
            {'key': 'urutan', 'label': 'Urutan', 'type': 'number'},
        ]

        dialog = FormDialog(f"Tambah Kategori - {bidang.nama}", fields, parent=self)
        if dialog.exec():
            data = dialog.get_data()
            try:
                kategori = KategoriMateri(bidang_id=bidang.id, **data)
                self.session.add(kategori)
                self.session.commit()
                self.refresh()
                QMessageBox.information(self, "Sukses", "Kategori berhasil ditambahkan!")
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", str(e))

    def _on_edit_kategori(self, kategori):
        """Edit kategori"""
        fields = [
            {'key': 'nama', 'label': 'Nama Kategori', 'type': 'text', 'required': True},
            {'key': 'kode', 'label': 'Kode', 'type': 'text'},
            {'key': 'urutan', 'label': 'Urutan', 'type': 'number'},
        ]

        data = {'nama': kategori.nama, 'kode': kategori.kode, 'urutan': kategori.urutan or 0}
        dialog = FormDialog("Edit Kategori", fields, data=data, parent=self)
        if dialog.exec():
            new_data = dialog.get_data()
            try:
                kategori.nama = new_data['nama']
                kategori.kode = new_data['kode']
                kategori.urutan = new_data['urutan']
                self.session.commit()
                self.refresh()
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", str(e))

    def _on_delete_kategori(self, kategori):
        """Hapus kategori"""
        reply = QMessageBox.question(
            self, "Konfirmasi", f"Hapus kategori '{kategori.nama}'?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        if reply == QMessageBox.StandardButton.Yes:
            try:
                kategori.is_aktif = False
                self.session.commit()
                self.refresh()
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", str(e))

    def _on_add_materi(self):
        """Tambah materi item"""
        if not self._selected_kategori:
            return

        fields = [
            {'key': 'nama', 'label': 'Nama Materi', 'type': 'text', 'required': True},
            {'key': 'nomor', 'label': 'Nomor', 'type': 'text'},
            {'key': 'tipe', 'label': 'Tipe', 'type': 'select',
             'options': [('hafalan', 'Hafalan'), ('level', 'Level'), ('checklist', 'Checklist'), ('status', 'Status')]},
            {'key': 'target_capaian', 'label': 'Target Capaian', 'type': 'text'},
        ]

        dialog = FormDialog(f"Tambah Materi - {self._selected_kategori.nama}", fields, parent=self)
        if dialog.exec():
            data = dialog.get_data()
            try:
                materi = MateriItem(kategori_id=self._selected_kategori.id, **data)
                self.session.add(materi)
                self.session.commit()
                self._update_materi_table()
                QMessageBox.information(self, "Sukses", "Materi berhasil ditambahkan!")
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", str(e))

    def _on_edit_materi(self, materi):
        """Edit materi item"""
        fields = [
            {'key': 'nama', 'label': 'Nama Materi', 'type': 'text', 'required': True},
            {'key': 'nomor', 'label': 'Nomor', 'type': 'text'},
            {'key': 'tipe', 'label': 'Tipe', 'type': 'select',
             'options': [('hafalan', 'Hafalan'), ('level', 'Level'), ('checklist', 'Checklist'), ('status', 'Status')]},
            {'key': 'target_capaian', 'label': 'Target Capaian', 'type': 'text'},
        ]

        data = {'nama': materi.nama, 'nomor': materi.nomor, 'tipe': materi.tipe, 'target_capaian': materi.target_capaian}
        dialog = FormDialog("Edit Materi", fields, data=data, parent=self)
        if dialog.exec():
            new_data = dialog.get_data()
            try:
                materi.nama = new_data['nama']
                materi.nomor = new_data['nomor']
                materi.tipe = new_data['tipe']
                materi.target_capaian = new_data['target_capaian']
                self.session.commit()
                self._update_materi_table()
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", str(e))

    def _on_delete_materi(self, materi):
        """Hapus materi item"""
        reply = QMessageBox.question(
            self, "Konfirmasi", f"Hapus materi '{materi.nama}'?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        if reply == QMessageBox.StandardButton.Yes:
            try:
                materi.is_aktif = False
                self.session.commit()
                self._update_materi_table()
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", str(e))
