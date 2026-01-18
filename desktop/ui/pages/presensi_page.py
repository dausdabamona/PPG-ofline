"""
Presensi Page - Halaman manajemen kehadiran pengajian
"""
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QTabWidget, QPushButton, QLabel,
    QMessageBox, QComboBox, QDateEdit, QTableWidget, QTableWidgetItem,
    QHeaderView, QAbstractItemView, QGroupBox, QFormLayout, QFrame,
    QGridLayout, QCheckBox, QButtonGroup, QRadioButton
)
from PyQt6.QtCore import Qt, QDate
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta

from .base_page import BasePage
from ..components.stat_card import StatCard
from services import WilayahService, JenjangService, PresensiService
from database.models import Pengajian, KeaktifanPengajian, Jamaah, Enrollment, Wilayah
from config import COLORS, STATUS_KEHADIRAN


class PresensiPage(BasePage):
    """
    Halaman Manajemen Presensi
    - Tab Input Presensi: input kehadiran per sesi
    - Tab Rekap: rekap bulanan
    """

    def __init__(self, session: Session, parent=None):
        super().__init__(session, parent)
        self.wilayah_service = WilayahService(session)
        self.jenjang_service = JenjangService(session)
        self.presensi_service = PresensiService(session)
        self._current_pengajian = None
        self._setup_ui()

    def _setup_ui(self):
        self.set_header(
            "Presensi Pengajian",
            "Kelola kehadiran peserta pengajian"
        )

        # Tabs
        tabs = QTabWidget()

        # Tab 1: Input Presensi
        input_tab = QWidget()
        input_layout = QVBoxLayout(input_tab)
        self._setup_input_tab(input_layout)
        tabs.addTab(input_tab, "Input Presensi")

        # Tab 2: Rekap Bulanan
        rekap_tab = QWidget()
        rekap_layout = QVBoxLayout(rekap_tab)
        self._setup_rekap_tab(rekap_layout)
        tabs.addTab(rekap_tab, "Rekap Bulanan")

        self.add_widget(tabs)

    def _setup_input_tab(self, layout: QVBoxLayout):
        """Setup tab input presensi"""
        # Filter section
        filter_group = QGroupBox("Pilih Sesi Pengajian")
        filter_layout = QHBoxLayout(filter_group)

        filter_layout.addWidget(QLabel("Wilayah:"))
        self.input_wilayah_combo = QComboBox()
        self.input_wilayah_combo.setMinimumWidth(200)
        self.input_wilayah_combo.currentIndexChanged.connect(self._load_pengajian_list)
        filter_layout.addWidget(self.input_wilayah_combo)

        filter_layout.addWidget(QLabel("Tanggal:"))
        self.input_date = QDateEdit()
        self.input_date.setCalendarPopup(True)
        self.input_date.setDate(QDate.currentDate())
        self.input_date.dateChanged.connect(self._load_pengajian_list)
        filter_layout.addWidget(self.input_date)

        filter_layout.addWidget(QLabel("Sesi:"))
        self.pengajian_combo = QComboBox()
        self.pengajian_combo.setMinimumWidth(200)
        self.pengajian_combo.currentIndexChanged.connect(self._on_pengajian_selected)
        filter_layout.addWidget(self.pengajian_combo)

        filter_layout.addStretch()
        layout.addWidget(filter_group)

        # Stats
        stats_layout = QHBoxLayout()
        self.stat_hadir = StatCard("Hadir", "0", color=COLORS['success'])
        self.stat_izin = StatCard("Izin", "0", color=COLORS['warning'])
        self.stat_sakit = StatCard("Sakit", "0", color=COLORS['info'])
        self.stat_alpa = StatCard("Alpa", "0", color=COLORS['error'])

        stats_layout.addWidget(self.stat_hadir)
        stats_layout.addWidget(self.stat_izin)
        stats_layout.addWidget(self.stat_sakit)
        stats_layout.addWidget(self.stat_alpa)
        layout.addLayout(stats_layout)

        # Quick actions
        quick_layout = QHBoxLayout()

        set_all_hadir = QPushButton("Semua Hadir")
        set_all_hadir.setStyleSheet(f"background-color: {COLORS['success']}; color: white; padding: 8px 16px;")
        set_all_hadir.clicked.connect(lambda: self._set_all_status('hadir'))
        quick_layout.addWidget(set_all_hadir)

        save_btn = QPushButton("Simpan Presensi")
        save_btn.setStyleSheet(f"background-color: {COLORS['primary']}; color: white; padding: 8px 16px;")
        save_btn.clicked.connect(self._save_presensi)
        quick_layout.addWidget(save_btn)

        quick_layout.addStretch()
        layout.addLayout(quick_layout)

        # Presensi table
        self.presensi_table = QTableWidget()
        self.presensi_table.setColumnCount(6)
        self.presensi_table.setHorizontalHeaderLabels(['No', 'Nama', 'Jenjang', 'Hadir', 'Izin', 'Sakit/Alpa'])
        self.presensi_table.horizontalHeader().setStretchLastSection(True)
        self.presensi_table.setAlternatingRowColors(True)
        self.presensi_table.setColumnWidth(0, 50)
        self.presensi_table.setColumnWidth(1, 200)
        self.presensi_table.setColumnWidth(2, 100)
        layout.addWidget(self.presensi_table)

    def _setup_rekap_tab(self, layout: QVBoxLayout):
        """Setup tab rekap bulanan"""
        # Filter
        filter_layout = QHBoxLayout()

        filter_layout.addWidget(QLabel("Wilayah:"))
        self.rekap_wilayah_combo = QComboBox()
        self.rekap_wilayah_combo.setMinimumWidth(200)
        self.rekap_wilayah_combo.currentIndexChanged.connect(self._load_rekap)
        filter_layout.addWidget(self.rekap_wilayah_combo)

        filter_layout.addWidget(QLabel("Bulan:"))
        self.rekap_month = QComboBox()
        self.rekap_month.addItems([
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ])
        self.rekap_month.setCurrentIndex(date.today().month - 1)
        self.rekap_month.currentIndexChanged.connect(self._load_rekap)
        filter_layout.addWidget(self.rekap_month)

        filter_layout.addWidget(QLabel("Tahun:"))
        self.rekap_year = QComboBox()
        current_year = date.today().year
        for y in range(current_year - 2, current_year + 2):
            self.rekap_year.addItem(str(y), y)
        self.rekap_year.setCurrentText(str(current_year))
        self.rekap_year.currentIndexChanged.connect(self._load_rekap)
        filter_layout.addWidget(self.rekap_year)

        export_btn = QPushButton("Export Excel")
        export_btn.clicked.connect(self._export_rekap)
        filter_layout.addWidget(export_btn)

        filter_layout.addStretch()
        layout.addLayout(filter_layout)

        # Rekap table
        self.rekap_table = QTableWidget()
        self.rekap_table.setAlternatingRowColors(True)
        layout.addWidget(self.rekap_table)

    def refresh(self):
        """Refresh all data"""
        self._load_wilayah_combos()
        self._load_pengajian_list()
        self._load_rekap()

    def _load_wilayah_combos(self):
        """Load wilayah ke semua combo"""
        wilayah_list = self.wilayah_service.get_flat_list()

        for combo in [self.input_wilayah_combo, self.rekap_wilayah_combo]:
            combo.clear()
            combo.addItem("Semua Wilayah", None)
            for w in wilayah_list:
                combo.addItem(w['display'], w['id'])

    def _load_pengajian_list(self):
        """Load daftar pengajian untuk tanggal terpilih"""
        self.pengajian_combo.clear()
        self._current_pengajian = None

        wilayah_id = self.input_wilayah_combo.currentData()
        tanggal = self.input_date.date().toPyDate()

        query = self.session.query(Pengajian).filter(Pengajian.tanggal == tanggal)
        if wilayah_id:
            query = query.filter(Pengajian.wilayah_id == wilayah_id)

        pengajian_list = query.all()

        if not pengajian_list:
            self.pengajian_combo.addItem("Tidak ada pengajian", None)
            self._clear_presensi_table()
            return

        for p in pengajian_list:
            label = f"{p.waktu_mulai.strftime('%H:%M') if p.waktu_mulai else '-'} - {p.wilayah.nama if p.wilayah else '-'}"
            self.pengajian_combo.addItem(label, p.id)

    def _on_pengajian_selected(self):
        """Handle pengajian selection"""
        pengajian_id = self.pengajian_combo.currentData()
        if not pengajian_id:
            self._clear_presensi_table()
            return

        self._current_pengajian = self.session.query(Pengajian).get(pengajian_id)
        self._load_presensi_table()

    def _load_presensi_table(self):
        """Load presensi untuk pengajian terpilih"""
        if not self._current_pengajian:
            return

        self.presensi_table.setRowCount(0)

        # Get peserta dari enrollment di wilayah ini
        wilayah_id = self._current_pengajian.wilayah_id

        peserta = self.session.query(Jamaah).join(
            Enrollment, Jamaah.id == Enrollment.jamaah_id
        ).filter(
            Enrollment.wilayah_id == wilayah_id,
            Enrollment.status == 'aktif',
            Jamaah.status_aktif == True
        ).order_by(Jamaah.nama).all()

        # Get existing presensi
        existing = {
            p.jamaah_id: p for p in self._current_pengajian.presensi
        }

        self.presensi_table.setRowCount(len(peserta))

        self._presensi_radios = {}

        for row, jamaah in enumerate(peserta):
            # No
            self.presensi_table.setItem(row, 0, QTableWidgetItem(str(row + 1)))

            # Nama
            self.presensi_table.setItem(row, 1, QTableWidgetItem(jamaah.nama))

            # Jenjang
            enrollment = next((e for e in jamaah.enrollments if e.wilayah_id == wilayah_id and e.status == 'aktif'), None)
            jenjang = enrollment.jenjang.nama if enrollment and enrollment.jenjang else '-'
            self.presensi_table.setItem(row, 2, QTableWidgetItem(jenjang))

            # Radio buttons for status
            radio_group = QButtonGroup(self)
            self._presensi_radios[jamaah.id] = radio_group

            current_status = existing.get(jamaah.id)
            current_status_val = current_status.status if current_status else None

            for col, status in enumerate(['hadir', 'izin', 'sakit'], start=3):
                radio = QRadioButton()
                radio.setProperty('jamaah_id', jamaah.id)
                radio.setProperty('status', status)

                if current_status_val == status:
                    radio.setChecked(True)
                elif current_status_val == 'alpa' and status == 'sakit':
                    # Group alpa with sakit
                    pass
                elif not current_status_val and status == 'hadir':
                    radio.setChecked(True)

                radio_group.addButton(radio)

                container = QWidget()
                container_layout = QHBoxLayout(container)
                container_layout.setContentsMargins(0, 0, 0, 0)
                container_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)
                container_layout.addWidget(radio)

                self.presensi_table.setCellWidget(row, col, container)

        self._update_stats()

    def _clear_presensi_table(self):
        """Clear presensi table"""
        self.presensi_table.setRowCount(0)
        self._presensi_radios = {}
        self._update_stats()

    def _update_stats(self):
        """Update statistik presensi"""
        counts = {'hadir': 0, 'izin': 0, 'sakit': 0, 'alpa': 0}

        for jamaah_id, radio_group in getattr(self, '_presensi_radios', {}).items():
            checked = radio_group.checkedButton()
            if checked:
                status = checked.property('status')
                if status in counts:
                    counts[status] += 1

        self.stat_hadir.set_value(str(counts['hadir']))
        self.stat_izin.set_value(str(counts['izin']))
        self.stat_sakit.set_value(str(counts['sakit']))
        self.stat_alpa.set_value(str(counts['alpa']))

    def _set_all_status(self, status: str):
        """Set semua peserta ke status tertentu"""
        for jamaah_id, radio_group in getattr(self, '_presensi_radios', {}).items():
            for button in radio_group.buttons():
                if button.property('status') == status:
                    button.setChecked(True)
                    break

        self._update_stats()

    def _save_presensi(self):
        """Simpan presensi"""
        if not self._current_pengajian:
            QMessageBox.warning(self, "Peringatan", "Pilih sesi pengajian terlebih dahulu!")
            return

        try:
            # Delete existing presensi
            self.session.query(KeaktifanPengajian).filter(
                KeaktifanPengajian.pengajian_id == self._current_pengajian.id
            ).delete()

            # Insert new
            for jamaah_id, radio_group in self._presensi_radios.items():
                checked = radio_group.checkedButton()
                if checked:
                    status = checked.property('status')
                    presensi = KeaktifanPengajian(
                        pengajian_id=self._current_pengajian.id,
                        jamaah_id=jamaah_id,
                        status=status
                    )
                    self.session.add(presensi)

            self.session.commit()
            QMessageBox.information(self, "Sukses", "Presensi berhasil disimpan!")

        except Exception as e:
            self.session.rollback()
            QMessageBox.critical(self, "Error", str(e))

    def _load_rekap(self):
        """Load rekap bulanan"""
        wilayah_id = self.rekap_wilayah_combo.currentData()
        bulan = self.rekap_month.currentIndex() + 1
        tahun = self.rekap_year.currentData()

        if not tahun:
            tahun = date.today().year

        # Get first and last day of month
        first_day = date(tahun, bulan, 1)
        if bulan == 12:
            last_day = date(tahun + 1, 1, 1) - timedelta(days=1)
        else:
            last_day = date(tahun, bulan + 1, 1) - timedelta(days=1)

        # Get all pengajian in the month
        query = self.session.query(Pengajian).filter(
            Pengajian.tanggal >= first_day,
            Pengajian.tanggal <= last_day
        )
        if wilayah_id:
            query = query.filter(Pengajian.wilayah_id == wilayah_id)

        pengajian_list = query.order_by(Pengajian.tanggal).all()

        if not pengajian_list:
            self.rekap_table.setRowCount(0)
            self.rekap_table.setColumnCount(0)
            return

        # Get unique dates
        dates = sorted(set(p.tanggal for p in pengajian_list))

        # Get all jamaah
        jamaah_ids = set()
        for p in pengajian_list:
            for presensi in p.presensi:
                jamaah_ids.add(presensi.jamaah_id)

        jamaah_list = self.session.query(Jamaah).filter(
            Jamaah.id.in_(jamaah_ids)
        ).order_by(Jamaah.nama).all()

        # Setup table
        self.rekap_table.setColumnCount(len(dates) + 4)

        headers = ['No', 'Nama', 'Jenjang'] + [d.strftime('%d') for d in dates] + ['Total']
        self.rekap_table.setHorizontalHeaderLabels(headers)

        self.rekap_table.setRowCount(len(jamaah_list))

        # Build presensi map
        presensi_map = {}
        for p in pengajian_list:
            for presensi in p.presensi:
                key = (presensi.jamaah_id, p.tanggal)
                presensi_map[key] = presensi.status

        # Fill table
        for row, jamaah in enumerate(jamaah_list):
            self.rekap_table.setItem(row, 0, QTableWidgetItem(str(row + 1)))
            self.rekap_table.setItem(row, 1, QTableWidgetItem(jamaah.nama))

            # Get jenjang
            enrollment = next((e for e in jamaah.enrollments if e.status == 'aktif'), None)
            jenjang = enrollment.jenjang.nama if enrollment and enrollment.jenjang else '-'
            self.rekap_table.setItem(row, 2, QTableWidgetItem(jenjang))

            # Fill dates
            total_hadir = 0
            for col, tanggal in enumerate(dates, start=3):
                status = presensi_map.get((jamaah.id, tanggal), '-')
                if status == 'hadir':
                    display = 'H'
                    total_hadir += 1
                elif status == 'izin':
                    display = 'I'
                elif status == 'sakit':
                    display = 'S'
                elif status == 'alpa':
                    display = 'A'
                else:
                    display = '-'

                item = QTableWidgetItem(display)
                item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                self.rekap_table.setItem(row, col, item)

            # Total
            total_item = QTableWidgetItem(str(total_hadir))
            total_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.rekap_table.setItem(row, len(dates) + 3, total_item)

    def _export_rekap(self):
        """Export rekap ke Excel"""
        QMessageBox.information(
            self, "Info",
            "Fitur export Excel akan segera tersedia."
        )
