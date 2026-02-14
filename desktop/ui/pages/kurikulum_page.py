"""
Kurikulum Page - Halaman manajemen kurikulum dan materi
Bidang > Kategori > Materi Item
"""
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QTreeWidget, QTreeWidgetItem,
    QPushButton, QLabel, QMessageBox, QMenu, QSplitter,
    QTableWidget, QTableWidgetItem, QAbstractItemView
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QAction, QColor
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
        self._selected_bidang_id = None
        self._selected_kategori_id = None
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
        add_bidang_btn = QPushButton("+ Tambah Bidang")
        add_bidang_btn.setStyleSheet(f"background-color: {COLORS['primary']}; color: white; padding: 8px 16px;")
        add_bidang_btn.clicked.connect(self._on_add_bidang)
        toolbar.addWidget(add_bidang_btn)

        refresh_btn = QPushButton("Refresh")
        refresh_btn.clicked.connect(self.refresh)
        toolbar.addWidget(refresh_btn)

        toolbar.addStretch()
        left_layout.addLayout(toolbar)

        # Tree for Bidang & Kategori
        self.tree = QTreeWidget()
        self.tree.setHeaderLabels(['Nama', 'Kode', 'Jumlah'])
        self.tree.setColumnWidth(0, 200)
        self.tree.setColumnWidth(1, 80)
        self.tree.itemClicked.connect(self._on_tree_clicked)
        self.tree.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.tree.customContextMenuRequested.connect(self._show_tree_menu)
        self.tree.setAlternatingRowColors(True)
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
        self.materi_table.setHorizontalHeaderLabels(['No', 'Nama Materi', 'Tipe', 'Kategori', 'Aksi'])
        self.materi_table.horizontalHeader().setStretchLastSection(True)
        self.materi_table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.materi_table.setAlternatingRowColors(True)
        self.materi_table.setColumnWidth(0, 50)
        self.materi_table.setColumnWidth(1, 250)
        self.materi_table.setColumnWidth(2, 80)
        self.materi_table.setColumnWidth(3, 100)
        right_layout.addWidget(self.materi_table)

        splitter.addWidget(right_panel)
        splitter.setSizes([300, 500])

        self.add_widget(splitter)

    def refresh(self):
        """Load data kurikulum"""
        self.tree.clear()
        self._selected_bidang_id = None
        self._selected_kategori_id = None
        self._update_materi_table()

        try:
            # Load bidang
            bidang_list = self.session.query(BidangMateri).filter(
                BidangMateri.is_aktif == True
            ).order_by(BidangMateri.urutan).all()

            for bidang in bidang_list:
                bidang_item = QTreeWidgetItem(self.tree)
                bidang_item.setText(0, bidang.nama)
                bidang_item.setText(1, "")

                # Count kategori
                kategori_count = len([k for k in bidang.kategori if k.is_aktif])
                bidang_item.setText(2, f"{kategori_count} kategori")

                bidang_item.setData(0, Qt.ItemDataRole.UserRole, {'type': 'bidang', 'id': bidang.id})
                bidang_item.setBackground(0, QColor('#d1fae5'))

                # Load kategori
                for kategori in bidang.kategori:
                    if kategori.is_aktif:
                        kat_item = QTreeWidgetItem(bidang_item)
                        kat_item.setText(0, kategori.nama)
                        kat_item.setText(1, kategori.kode or "")

                        # Count materi
                        materi_count = self.session.query(MateriItem).filter(
                            MateriItem.kategori_id == kategori.id,
                            MateriItem.is_aktif == True
                        ).count()
                        kat_item.setText(2, f"{materi_count} materi")

                        kat_item.setData(0, Qt.ItemDataRole.UserRole, {'type': 'kategori', 'id': kategori.id})

            self.tree.expandAll()
        except Exception as e:
            print(f"Error loading kurikulum: {e}")

    def _on_tree_clicked(self, item: QTreeWidgetItem, column: int):
        """Handle tree item click"""
        data = item.data(0, Qt.ItemDataRole.UserRole)
        if not data:
            return

        if data['type'] == 'bidang':
            self._selected_bidang_id = data['id']
            self._selected_kategori_id = None
            bidang = self.session.query(BidangMateri).get(data['id'])
            self.kategori_label.setText(f"Bidang: {bidang.nama if bidang else '-'}")
            self.add_materi_btn.setEnabled(False)
            self._update_materi_table()
        elif data['type'] == 'kategori':
            self._selected_kategori_id = data['id']
            kategori = self.session.query(KategoriMateri).get(data['id'])
            self.kategori_label.setText(f"Kategori: {kategori.nama if kategori else '-'}")
            self.add_materi_btn.setEnabled(True)
            self._update_materi_table()

    def _update_materi_table(self):
        """Update tabel materi"""
        self.materi_table.setRowCount(0)

        if not self._selected_kategori_id:
            return

        try:
            materi_list = self.session.query(MateriItem).filter(
                MateriItem.kategori_id == self._selected_kategori_id,
                MateriItem.is_aktif == True
            ).order_by(MateriItem.nomor).all()

            self.materi_table.setRowCount(len(materi_list))

            for row, materi in enumerate(materi_list):
                self.materi_table.setItem(row, 0, QTableWidgetItem(materi.nomor or str(row + 1)))
                self.materi_table.setItem(row, 1, QTableWidgetItem(materi.nama))
                self.materi_table.setItem(row, 2, QTableWidgetItem(materi.tipe or "-"))
                self.materi_table.setItem(row, 3, QTableWidgetItem(materi.kategori.nama if materi.kategori else "-"))

                # Action buttons - store materi ID
                materi_id = materi.id
                action_widget = QWidget()
                action_layout = QHBoxLayout(action_widget)
                action_layout.setContentsMargins(4, 2, 4, 2)

                edit_btn = QPushButton("Edit")
                edit_btn.setMaximumWidth(50)
                edit_btn.clicked.connect(lambda checked, mid=materi_id: self._on_edit_materi(mid))
                action_layout.addWidget(edit_btn)

                delete_btn = QPushButton("Hapus")
                delete_btn.setMaximumWidth(50)
                delete_btn.setStyleSheet(f"background-color: {COLORS['error']}; color: white;")
                delete_btn.clicked.connect(lambda checked, mid=materi_id: self._on_delete_materi(mid))
                action_layout.addWidget(delete_btn)

                self.materi_table.setCellWidget(row, 4, action_widget)
        except Exception as e:
            print(f"Error loading materi: {e}")

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
            add_kat.triggered.connect(lambda: self._on_add_kategori(data['id']))
            menu.addAction(add_kat)

            edit_action = QAction("Edit Bidang", self)
            edit_action.triggered.connect(lambda: self._on_edit_bidang(data['id']))
            menu.addAction(edit_action)

            delete_action = QAction("Hapus Bidang", self)
            delete_action.triggered.connect(lambda: self._on_delete_bidang(data['id']))
            menu.addAction(delete_action)

        elif data['type'] == 'kategori':
            add_materi = QAction("Tambah Materi", self)
            add_materi.triggered.connect(lambda: self._on_add_materi_for(data['id']))
            menu.addAction(add_materi)

            edit_action = QAction("Edit Kategori", self)
            edit_action.triggered.connect(lambda: self._on_edit_kategori(data['id']))
            menu.addAction(edit_action)

            delete_action = QAction("Hapus Kategori", self)
            delete_action.triggered.connect(lambda: self._on_delete_kategori(data['id']))
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
                bidang = BidangMateri(nama=data['nama'], urutan=data.get('urutan', 0))
                self.session.add(bidang)
                self.session.commit()
                self.refresh()
                QMessageBox.information(self, "Sukses", "Bidang berhasil ditambahkan!")
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", str(e))

    def _on_edit_bidang(self, bidang_id: int):
        """Edit bidang"""
        bidang = self.session.query(BidangMateri).get(bidang_id)
        if not bidang:
            return

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
                bidang.urutan = new_data.get('urutan', 0)
                self.session.commit()
                self.refresh()
                QMessageBox.information(self, "Sukses", "Bidang berhasil diperbarui!")
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", str(e))

    def _on_delete_bidang(self, bidang_id: int):
        """Hapus bidang"""
        bidang = self.session.query(BidangMateri).get(bidang_id)
        if not bidang:
            return

        reply = QMessageBox.question(
            self, "Konfirmasi", f"Hapus bidang '{bidang.nama}'?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        if reply == QMessageBox.StandardButton.Yes:
            try:
                bidang.is_aktif = False
                self.session.commit()
                self.refresh()
                QMessageBox.information(self, "Sukses", "Bidang berhasil dihapus!")
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", str(e))

    def _on_add_kategori(self, bidang_id: int):
        """Tambah kategori ke bidang"""
        bidang = self.session.query(BidangMateri).get(bidang_id)
        if not bidang:
            return

        fields = [
            {'key': 'nama', 'label': 'Nama Kategori', 'type': 'text', 'required': True},
            {'key': 'kode', 'label': 'Kode', 'type': 'text'},
            {'key': 'urutan', 'label': 'Urutan', 'type': 'number'},
        ]

        dialog = FormDialog(f"Tambah Kategori - {bidang.nama}", fields, parent=self)
        if dialog.exec():
            data = dialog.get_data()
            try:
                kategori = KategoriMateri(
                    bidang_id=bidang_id,
                    nama=data['nama'],
                    kode=data.get('kode'),
                    urutan=data.get('urutan', 0)
                )
                self.session.add(kategori)
                self.session.commit()
                self.refresh()
                QMessageBox.information(self, "Sukses", "Kategori berhasil ditambahkan!")
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", str(e))

    def _on_edit_kategori(self, kategori_id: int):
        """Edit kategori"""
        kategori = self.session.query(KategoriMateri).get(kategori_id)
        if not kategori:
            return

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
                kategori.kode = new_data.get('kode')
                kategori.urutan = new_data.get('urutan', 0)
                self.session.commit()
                self.refresh()
                QMessageBox.information(self, "Sukses", "Kategori berhasil diperbarui!")
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", str(e))

    def _on_delete_kategori(self, kategori_id: int):
        """Hapus kategori"""
        kategori = self.session.query(KategoriMateri).get(kategori_id)
        if not kategori:
            return

        reply = QMessageBox.question(
            self, "Konfirmasi", f"Hapus kategori '{kategori.nama}'?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        if reply == QMessageBox.StandardButton.Yes:
            try:
                kategori.is_aktif = False
                self.session.commit()
                self.refresh()
                QMessageBox.information(self, "Sukses", "Kategori berhasil dihapus!")
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", str(e))

    def _on_add_materi(self):
        """Tambah materi item ke kategori terpilih"""
        if self._selected_kategori_id:
            self._on_add_materi_for(self._selected_kategori_id)

    def _on_add_materi_for(self, kategori_id: int):
        """Tambah materi item"""
        kategori = self.session.query(KategoriMateri).get(kategori_id)
        if not kategori:
            QMessageBox.warning(self, "Error", "Kategori tidak ditemukan!")
            return

        fields = [
            {'key': 'nama', 'label': 'Nama Materi', 'type': 'text', 'required': True},
            {'key': 'nomor', 'label': 'Nomor', 'type': 'text', 'placeholder': 'Contoh: 1, 2, 3...'},
            {'key': 'tipe', 'label': 'Tipe', 'type': 'select',
             'options': [('hafalan', 'Hafalan'), ('level', 'Level'), ('checklist', 'Checklist'), ('status', 'Status')]},
        ]

        dialog = FormDialog(f"Tambah Materi - {kategori.nama}", fields, parent=self)
        if dialog.exec():
            data = dialog.get_data()
            try:
                materi = MateriItem(
                    kategori_id=kategori_id,
                    nama=data['nama'],
                    nomor=data.get('nomor'),
                    tipe=data.get('tipe')
                )
                self.session.add(materi)
                self.session.commit()
                self._selected_kategori_id = kategori_id
                self._update_materi_table()
                self.refresh()
                QMessageBox.information(self, "Sukses", "Materi berhasil ditambahkan!")
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", str(e))

    def _on_edit_materi(self, materi_id: int):
        """Edit materi item"""
        materi = self.session.query(MateriItem).get(materi_id)
        if not materi:
            return

        fields = [
            {'key': 'nama', 'label': 'Nama Materi', 'type': 'text', 'required': True},
            {'key': 'nomor', 'label': 'Nomor', 'type': 'text'},
            {'key': 'tipe', 'label': 'Tipe', 'type': 'select',
             'options': [('hafalan', 'Hafalan'), ('level', 'Level'), ('checklist', 'Checklist'), ('status', 'Status')]},
        ]

        data = {'nama': materi.nama, 'nomor': materi.nomor, 'tipe': materi.tipe}
        dialog = FormDialog("Edit Materi", fields, data=data, parent=self)
        if dialog.exec():
            new_data = dialog.get_data()
            try:
                materi.nama = new_data['nama']
                materi.nomor = new_data.get('nomor')
                materi.tipe = new_data.get('tipe')
                self.session.commit()
                self._update_materi_table()
                QMessageBox.information(self, "Sukses", "Materi berhasil diperbarui!")
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", str(e))

    def _on_delete_materi(self, materi_id: int):
        """Hapus materi item"""
        materi = self.session.query(MateriItem).get(materi_id)
        if not materi:
            return

        reply = QMessageBox.question(
            self, "Konfirmasi", f"Hapus materi '{materi.nama}'?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        if reply == QMessageBox.StandardButton.Yes:
            try:
                materi.is_aktif = False
                self.session.commit()
                self._update_materi_table()
                QMessageBox.information(self, "Sukses", "Materi berhasil dihapus!")
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", str(e))
