"""
Pengajian Page - Halaman manajemen pengajian dan jadwal
"""
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QTabWidget, QPushButton, QLabel,
    QMessageBox, QComboBox, QDateEdit, QTableWidget, QTableWidgetItem,
    QHeaderView, QAbstractItemView, QGroupBox, QFormLayout, QTimeEdit,
    QCheckBox
)
from PyQt6.QtCore import Qt, QDate, QTime
from sqlalchemy.orm import Session
from datetime import date, time, timedelta

from .base_page import BasePage
from ..components.form_dialog import FormDialog
from ..components.table_widget import DataTableWidget
from services import WilayahService, JenjangService, PengajianService
from database.models import Pengajian, JadwalRutin, Wilayah, Jenjang
from config import COLORS, HARI_LIST


class PengajianPage(BasePage):
    """
    Halaman Manajemen Pengajian
    - Tab Jadwal Rutin: jadwal mingguan
    - Tab Sesi Pengajian: daftar sesi yang terlaksana
    """

    def __init__(self, session: Session, parent=None):
        super().__init__(session, parent)
        self.wilayah_service = WilayahService(session)
        self.jenjang_service = JenjangService(session)
        self.pengajian_service = PengajianService(session)
        self._setup_ui()

    def _setup_ui(self):
        self.set_header(
            "Manajemen Pengajian",
            "Kelola jadwal rutin dan sesi pengajian"
        )

        # Tabs
        tabs = QTabWidget()

        # Tab 1: Jadwal Rutin
        jadwal_tab = QWidget()
        jadwal_layout = QVBoxLayout(jadwal_tab)
        self._setup_jadwal_tab(jadwal_layout)
        tabs.addTab(jadwal_tab, "Jadwal Rutin")

        # Tab 2: Sesi Pengajian
        sesi_tab = QWidget()
        sesi_layout = QVBoxLayout(sesi_tab)
        self._setup_sesi_tab(sesi_layout)
        tabs.addTab(sesi_tab, "Sesi Pengajian")

        self.add_widget(tabs)

    def _setup_jadwal_tab(self, layout: QVBoxLayout):
        """Setup tab jadwal rutin"""
        # Toolbar
        toolbar = QHBoxLayout()

        add_btn = QPushButton("+ Tambah Jadwal")
        add_btn.setStyleSheet(f"background-color: {COLORS['primary']}; color: white; padding: 8px 16px;")
        add_btn.clicked.connect(self._on_add_jadwal)
        toolbar.addWidget(add_btn)

        # Filter wilayah
        toolbar.addWidget(QLabel("Wilayah:"))
        self.jadwal_wilayah_combo = QComboBox()
        self.jadwal_wilayah_combo.setMinimumWidth(200)
        self.jadwal_wilayah_combo.currentIndexChanged.connect(self._load_jadwal)
        toolbar.addWidget(self.jadwal_wilayah_combo)

        toolbar.addStretch()
        layout.addLayout(toolbar)

        # Table jadwal
        self.jadwal_table = QTableWidget()
        self.jadwal_table.setColumnCount(6)
        self.jadwal_table.setHorizontalHeaderLabels(['Hari', 'Jam', 'Nama', 'Wilayah', 'Jenjang', 'Aksi'])
        self.jadwal_table.horizontalHeader().setStretchLastSection(True)
        self.jadwal_table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.jadwal_table.setAlternatingRowColors(True)
        layout.addWidget(self.jadwal_table)

    def _setup_sesi_tab(self, layout: QVBoxLayout):
        """Setup tab sesi pengajian"""
        # Toolbar
        toolbar = QHBoxLayout()

        add_btn = QPushButton("+ Catat Pengajian")
        add_btn.setStyleSheet(f"background-color: {COLORS['primary']}; color: white; padding: 8px 16px;")
        add_btn.clicked.connect(self._on_add_sesi)
        toolbar.addWidget(add_btn)

        generate_btn = QPushButton("Generate dari Jadwal")
        generate_btn.setStyleSheet(f"background-color: {COLORS['info']}; color: white; padding: 8px 16px;")
        generate_btn.clicked.connect(self._on_generate_sesi)
        toolbar.addWidget(generate_btn)

        # Filter
        toolbar.addWidget(QLabel("Wilayah:"))
        self.sesi_wilayah_combo = QComboBox()
        self.sesi_wilayah_combo.setMinimumWidth(200)
        self.sesi_wilayah_combo.currentIndexChanged.connect(self._load_sesi)
        toolbar.addWidget(self.sesi_wilayah_combo)

        toolbar.addWidget(QLabel("Tanggal:"))
        self.sesi_date_start = QDateEdit()
        self.sesi_date_start.setCalendarPopup(True)
        self.sesi_date_start.setDate(QDate.currentDate().addDays(-30))
        self.sesi_date_start.dateChanged.connect(self._load_sesi)
        toolbar.addWidget(self.sesi_date_start)

        toolbar.addWidget(QLabel("s/d"))
        self.sesi_date_end = QDateEdit()
        self.sesi_date_end.setCalendarPopup(True)
        self.sesi_date_end.setDate(QDate.currentDate())
        self.sesi_date_end.dateChanged.connect(self._load_sesi)
        toolbar.addWidget(self.sesi_date_end)

        toolbar.addStretch()
        layout.addLayout(toolbar)

        # Table sesi
        columns = [
            {'key': 'tanggal', 'label': 'Tanggal', 'width': 100},
            {'key': 'waktu', 'label': 'Waktu', 'width': 80},
            {'key': 'wilayah_nama', 'label': 'Wilayah', 'width': 150},
            {'key': 'jenjang_nama', 'label': 'Jenjang', 'width': 100},
            {'key': 'materi_pokok', 'label': 'Materi', 'width': 200},
            {'key': 'status', 'label': 'Status', 'width': 80},
        ]
        self.sesi_table = DataTableWidget(columns, show_search=True, show_actions=True)
        self.sesi_table.action_clicked.connect(self._on_sesi_action)
        layout.addWidget(self.sesi_table)

    def refresh(self):
        """Refresh all data"""
        self._load_wilayah_combos()
        self._load_jadwal()
        self._load_sesi()

    def _load_wilayah_combos(self):
        """Load wilayah options to combos"""
        wilayah_list = self.wilayah_service.get_flat_list()

        for combo in [self.jadwal_wilayah_combo, self.sesi_wilayah_combo]:
            combo.clear()
            combo.addItem("Semua Wilayah", None)
            for w in wilayah_list:
                combo.addItem(w['display'], w['id'])

    def _load_jadwal(self):
        """Load jadwal rutin"""
        self.jadwal_table.setRowCount(0)

        wilayah_id = self.jadwal_wilayah_combo.currentData()

        query = self.session.query(JadwalRutin).filter(JadwalRutin.is_aktif == True)
        if wilayah_id:
            query = query.filter(JadwalRutin.wilayah_id == wilayah_id)

        jadwal_list = query.order_by(JadwalRutin.hari, JadwalRutin.jam).all()

        self.jadwal_table.setRowCount(len(jadwal_list))

        for row, jadwal in enumerate(jadwal_list):
            self.jadwal_table.setItem(row, 0, QTableWidgetItem(jadwal.hari))
            self.jadwal_table.setItem(row, 1, QTableWidgetItem(jadwal.jam.strftime('%H:%M') if jadwal.jam else '-'))
            self.jadwal_table.setItem(row, 2, QTableWidgetItem(jadwal.nama or '-'))
            self.jadwal_table.setItem(row, 3, QTableWidgetItem(jadwal.wilayah.nama if jadwal.wilayah else '-'))
            self.jadwal_table.setItem(row, 4, QTableWidgetItem(jadwal.jenjang.nama if jadwal.jenjang else '-'))

            # Action buttons
            action_widget = QWidget()
            action_layout = QHBoxLayout(action_widget)
            action_layout.setContentsMargins(4, 2, 4, 2)

            edit_btn = QPushButton("Edit")
            edit_btn.setMaximumWidth(50)
            edit_btn.clicked.connect(lambda checked, j=jadwal: self._on_edit_jadwal(j))
            action_layout.addWidget(edit_btn)

            delete_btn = QPushButton("Hapus")
            delete_btn.setMaximumWidth(50)
            delete_btn.setStyleSheet(f"background-color: {COLORS['error']}; color: white;")
            delete_btn.clicked.connect(lambda checked, j=jadwal: self._on_delete_jadwal(j))
            action_layout.addWidget(delete_btn)

            self.jadwal_table.setCellWidget(row, 5, action_widget)

    def _load_sesi(self):
        """Load sesi pengajian"""
        wilayah_id = self.sesi_wilayah_combo.currentData()
        start_date = self.sesi_date_start.date().toPyDate()
        end_date = self.sesi_date_end.date().toPyDate()

        query = self.session.query(Pengajian).filter(
            Pengajian.tanggal >= start_date,
            Pengajian.tanggal <= end_date
        )
        if wilayah_id:
            query = query.filter(Pengajian.wilayah_id == wilayah_id)

        sesi_list = query.order_by(Pengajian.tanggal.desc()).all()

        data = []
        for sesi in sesi_list:
            data.append({
                'id': sesi.id,
                'tanggal': sesi.tanggal.strftime('%d/%m/%Y') if sesi.tanggal else '-',
                'waktu': sesi.waktu_mulai.strftime('%H:%M') if sesi.waktu_mulai else '-',
                'wilayah_nama': sesi.wilayah.nama if sesi.wilayah else '-',
                'jenjang_nama': sesi.jenjang.nama if sesi.jenjang else '-',
                'materi_pokok': sesi.materi_pokok or '-',
                'status': sesi.status or 'terlaksana',
            })

        self.sesi_table.set_data(data)

    def _on_add_jadwal(self):
        """Tambah jadwal rutin"""
        wilayah_options = [(w['id'], w['display']) for w in self.wilayah_service.get_flat_list()]
        jenjang_options = [(j.id, j.nama) for j in self.jenjang_service.get_all_active()]

        fields = [
            {'key': 'nama', 'label': 'Nama Jadwal', 'type': 'text'},
            {'key': 'hari', 'label': 'Hari', 'type': 'select', 'required': True,
             'options': [(h, h) for h in HARI_LIST]},
            {'key': 'jam', 'label': 'Jam', 'type': 'text', 'placeholder': 'HH:MM', 'required': True},
            {'key': 'wilayah_id', 'label': 'Wilayah', 'type': 'select', 'options': wilayah_options},
            {'key': 'jenjang_id', 'label': 'Jenjang', 'type': 'select', 'options': jenjang_options},
        ]

        dialog = FormDialog("Tambah Jadwal Rutin", fields, parent=self)
        if dialog.exec():
            data = dialog.get_data()
            try:
                # Parse jam
                jam_str = data.pop('jam', '00:00')
                parts = jam_str.split(':')
                jam = time(int(parts[0]), int(parts[1]) if len(parts) > 1 else 0)

                jadwal = JadwalRutin(jam=jam, **data)
                self.session.add(jadwal)
                self.session.commit()
                self._load_jadwal()
                QMessageBox.information(self, "Sukses", "Jadwal berhasil ditambahkan!")
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", str(e))

    def _on_edit_jadwal(self, jadwal):
        """Edit jadwal rutin"""
        wilayah_options = [(w['id'], w['display']) for w in self.wilayah_service.get_flat_list()]
        jenjang_options = [(j.id, j.nama) for j in self.jenjang_service.get_all_active()]

        fields = [
            {'key': 'nama', 'label': 'Nama Jadwal', 'type': 'text'},
            {'key': 'hari', 'label': 'Hari', 'type': 'select', 'required': True,
             'options': [(h, h) for h in HARI_LIST]},
            {'key': 'jam', 'label': 'Jam', 'type': 'text', 'placeholder': 'HH:MM', 'required': True},
            {'key': 'wilayah_id', 'label': 'Wilayah', 'type': 'select', 'options': wilayah_options},
            {'key': 'jenjang_id', 'label': 'Jenjang', 'type': 'select', 'options': jenjang_options},
        ]

        data = {
            'nama': jadwal.nama,
            'hari': jadwal.hari,
            'jam': jadwal.jam.strftime('%H:%M') if jadwal.jam else '',
            'wilayah_id': jadwal.wilayah_id,
            'jenjang_id': jadwal.jenjang_id,
        }

        dialog = FormDialog("Edit Jadwal Rutin", fields, data=data, parent=self)
        if dialog.exec():
            new_data = dialog.get_data()
            try:
                jam_str = new_data.pop('jam', '00:00')
                parts = jam_str.split(':')
                jadwal.jam = time(int(parts[0]), int(parts[1]) if len(parts) > 1 else 0)
                jadwal.nama = new_data['nama']
                jadwal.hari = new_data['hari']
                jadwal.wilayah_id = new_data['wilayah_id']
                jadwal.jenjang_id = new_data['jenjang_id']
                self.session.commit()
                self._load_jadwal()
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", str(e))

    def _on_delete_jadwal(self, jadwal):
        """Hapus jadwal rutin"""
        reply = QMessageBox.question(
            self, "Konfirmasi", f"Hapus jadwal '{jadwal.nama or jadwal.hari}'?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        if reply == QMessageBox.StandardButton.Yes:
            try:
                jadwal.is_aktif = False
                self.session.commit()
                self._load_jadwal()
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", str(e))

    def _on_add_sesi(self):
        """Tambah sesi pengajian"""
        wilayah_options = [(w['id'], w['display']) for w in self.wilayah_service.get_flat_list()]
        jenjang_options = [(j.id, j.nama) for j in self.jenjang_service.get_all_active()]

        fields = [
            {'key': 'tanggal', 'label': 'Tanggal', 'type': 'date', 'required': True},
            {'key': 'waktu_mulai', 'label': 'Waktu Mulai', 'type': 'text', 'placeholder': 'HH:MM'},
            {'key': 'waktu_selesai', 'label': 'Waktu Selesai', 'type': 'text', 'placeholder': 'HH:MM'},
            {'key': 'wilayah_id', 'label': 'Wilayah', 'type': 'select', 'required': True, 'options': wilayah_options},
            {'key': 'jenjang_id', 'label': 'Jenjang', 'type': 'select', 'options': jenjang_options},
            {'key': 'materi_pokok', 'label': 'Materi Pokok', 'type': 'textarea'},
            {'key': 'status', 'label': 'Status', 'type': 'select',
             'options': [('terlaksana', 'Terlaksana'), ('batal', 'Batal'), ('ditunda', 'Ditunda')]},
        ]

        dialog = FormDialog("Catat Pengajian", fields, parent=self)
        if dialog.exec():
            data = dialog.get_data()
            try:
                # Parse time
                for field in ['waktu_mulai', 'waktu_selesai']:
                    if data.get(field):
                        parts = data[field].split(':')
                        data[field] = time(int(parts[0]), int(parts[1]) if len(parts) > 1 else 0)
                    else:
                        data[field] = None

                pengajian = Pengajian(**data)
                self.session.add(pengajian)
                self.session.commit()
                self._load_sesi()
                QMessageBox.information(self, "Sukses", "Pengajian berhasil dicatat!")
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", str(e))

    def _on_generate_sesi(self):
        """Generate sesi dari jadwal rutin"""
        # TODO: Implement generate
        QMessageBox.information(
            self, "Info",
            "Fitur generate sesi dari jadwal rutin akan segera tersedia."
        )

    def _on_sesi_action(self, action: str, row_data: dict):
        """Handle sesi table action"""
        if action == 'edit':
            sesi = self.session.query(Pengajian).get(row_data['id'])
            if sesi:
                self._edit_sesi(sesi)
        elif action == 'delete':
            self._delete_sesi(row_data)

    def _edit_sesi(self, sesi):
        """Edit sesi pengajian"""
        wilayah_options = [(w['id'], w['display']) for w in self.wilayah_service.get_flat_list()]
        jenjang_options = [(j.id, j.nama) for j in self.jenjang_service.get_all_active()]

        fields = [
            {'key': 'tanggal', 'label': 'Tanggal', 'type': 'date', 'required': True},
            {'key': 'waktu_mulai', 'label': 'Waktu Mulai', 'type': 'text', 'placeholder': 'HH:MM'},
            {'key': 'waktu_selesai', 'label': 'Waktu Selesai', 'type': 'text', 'placeholder': 'HH:MM'},
            {'key': 'wilayah_id', 'label': 'Wilayah', 'type': 'select', 'required': True, 'options': wilayah_options},
            {'key': 'jenjang_id', 'label': 'Jenjang', 'type': 'select', 'options': jenjang_options},
            {'key': 'materi_pokok', 'label': 'Materi Pokok', 'type': 'textarea'},
            {'key': 'status', 'label': 'Status', 'type': 'select',
             'options': [('terlaksana', 'Terlaksana'), ('batal', 'Batal'), ('ditunda', 'Ditunda')]},
        ]

        data = {
            'tanggal': sesi.tanggal,
            'waktu_mulai': sesi.waktu_mulai.strftime('%H:%M') if sesi.waktu_mulai else '',
            'waktu_selesai': sesi.waktu_selesai.strftime('%H:%M') if sesi.waktu_selesai else '',
            'wilayah_id': sesi.wilayah_id,
            'jenjang_id': sesi.jenjang_id,
            'materi_pokok': sesi.materi_pokok,
            'status': sesi.status,
        }

        dialog = FormDialog("Edit Pengajian", fields, data=data, parent=self)
        if dialog.exec():
            new_data = dialog.get_data()
            try:
                for field in ['waktu_mulai', 'waktu_selesai']:
                    if new_data.get(field):
                        parts = new_data[field].split(':')
                        new_data[field] = time(int(parts[0]), int(parts[1]) if len(parts) > 1 else 0)
                    else:
                        new_data[field] = None

                sesi.tanggal = new_data['tanggal']
                sesi.waktu_mulai = new_data['waktu_mulai']
                sesi.waktu_selesai = new_data['waktu_selesai']
                sesi.wilayah_id = new_data['wilayah_id']
                sesi.jenjang_id = new_data['jenjang_id']
                sesi.materi_pokok = new_data['materi_pokok']
                sesi.status = new_data['status']
                self.session.commit()
                self._load_sesi()
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", str(e))

    def _delete_sesi(self, row_data: dict):
        """Hapus sesi pengajian"""
        reply = QMessageBox.question(
            self, "Konfirmasi", "Hapus sesi pengajian ini?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )
        if reply == QMessageBox.StandardButton.Yes:
            try:
                sesi = self.session.query(Pengajian).get(row_data['id'])
                if sesi:
                    self.session.delete(sesi)
                    self.session.commit()
                    self._load_sesi()
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", str(e))
