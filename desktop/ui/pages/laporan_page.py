"""
Laporan Page - Halaman laporan dan statistik
"""
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QTabWidget, QPushButton, QLabel,
    QMessageBox, QComboBox, QTableWidget, QTableWidgetItem, QHeaderView,
    QGroupBox, QFormLayout, QDateEdit, QFrame, QGridLayout, QProgressBar,
    QFileDialog, QScrollArea
)
from PyQt6.QtCore import Qt, QDate
from PyQt6.QtGui import QFont
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from typing import Optional
import os

from .base_page import BasePage
from ..components.stat_card import StatCard
from services import (
    WilayahService, JenjangService, ProgressService,
    PenilaianAkhlaqService, PresensiService, ExcelService
)
from database.models import (
    Jamaah, Enrollment, BidangMateri, KategoriMateri, MateriItem,
    ProgressJamaah, PenilaianAkhlaq, Pengajian, KeaktifanPengajian, Wilayah
)
from config import COLORS


class LaporanPage(BasePage):
    """
    Halaman Laporan
    - Tab Laporan Progress: rekap progress per wilayah/jenjang
    - Tab Laporan Presensi: statistik kehadiran
    - Tab Laporan Penilaian: rekap penilaian akhlaq
    - Tab Statistik: dashboard statistik umum
    """

    def __init__(self, session: Session, parent=None):
        super().__init__(session, parent)
        self.wilayah_service = WilayahService(session)
        self.jenjang_service = JenjangService(session)
        self.progress_service = ProgressService(session)
        self.akhlaq_service = PenilaianAkhlaqService(session)
        self.presensi_service = PresensiService(session)
        self.excel_service = ExcelService(session)
        self._setup_ui()

    def _setup_ui(self):
        self.set_header(
            "Laporan",
            "Laporan dan statistik data PPG"
        )

        # Tabs
        tabs = QTabWidget()

        # Tab 1: Laporan Progress
        progress_tab = QWidget()
        progress_layout = QVBoxLayout(progress_tab)
        self._setup_progress_report_tab(progress_layout)
        tabs.addTab(progress_tab, "Laporan Progress")

        # Tab 2: Laporan Presensi
        presensi_tab = QWidget()
        presensi_layout = QVBoxLayout(presensi_tab)
        self._setup_presensi_report_tab(presensi_layout)
        tabs.addTab(presensi_tab, "Laporan Presensi")

        # Tab 3: Laporan Penilaian
        penilaian_tab = QWidget()
        penilaian_layout = QVBoxLayout(penilaian_tab)
        self._setup_penilaian_report_tab(penilaian_layout)
        tabs.addTab(penilaian_tab, "Laporan Penilaian")

        # Tab 4: Statistik
        stats_tab = QWidget()
        stats_layout = QVBoxLayout(stats_tab)
        self._setup_statistics_tab(stats_layout)
        tabs.addTab(stats_tab, "Statistik")

        self.add_widget(tabs)

    def _setup_progress_report_tab(self, layout: QVBoxLayout):
        """Setup tab laporan progress"""
        # Filter
        filter_layout = QHBoxLayout()

        filter_layout.addWidget(QLabel("Wilayah:"))
        self.progress_wilayah_combo = QComboBox()
        self.progress_wilayah_combo.setMinimumWidth(200)
        self.progress_wilayah_combo.currentIndexChanged.connect(self._load_progress_report)
        filter_layout.addWidget(self.progress_wilayah_combo)

        filter_layout.addWidget(QLabel("Jenjang:"))
        self.progress_jenjang_combo = QComboBox()
        self.progress_jenjang_combo.setMinimumWidth(150)
        self.progress_jenjang_combo.currentIndexChanged.connect(self._load_progress_report)
        filter_layout.addWidget(self.progress_jenjang_combo)

        filter_layout.addWidget(QLabel("Bidang:"))
        self.progress_bidang_combo = QComboBox()
        self.progress_bidang_combo.setMinimumWidth(150)
        self.progress_bidang_combo.currentIndexChanged.connect(self._load_progress_report)
        filter_layout.addWidget(self.progress_bidang_combo)

        export_btn = QPushButton("Export Excel")
        export_btn.clicked.connect(self._export_progress_report)
        filter_layout.addWidget(export_btn)

        filter_layout.addStretch()
        layout.addLayout(filter_layout)

        # Summary stats
        stats_layout = QHBoxLayout()
        self.progress_stat_total = StatCard("Total Generus", "0", color=COLORS['info'])
        self.progress_stat_completed = StatCard("Rata-rata Selesai", "0%", color=COLORS['success'])
        self.progress_stat_target = StatCard("Mencapai Target", "0", color=COLORS['primary'])
        stats_layout.addWidget(self.progress_stat_total)
        stats_layout.addWidget(self.progress_stat_completed)
        stats_layout.addWidget(self.progress_stat_target)
        layout.addLayout(stats_layout)

        # Table
        self.progress_report_table = QTableWidget()
        self.progress_report_table.setAlternatingRowColors(True)
        layout.addWidget(self.progress_report_table)

    def _setup_presensi_report_tab(self, layout: QVBoxLayout):
        """Setup tab laporan presensi"""
        # Filter
        filter_layout = QHBoxLayout()

        filter_layout.addWidget(QLabel("Wilayah:"))
        self.presensi_wilayah_combo = QComboBox()
        self.presensi_wilayah_combo.setMinimumWidth(200)
        self.presensi_wilayah_combo.currentIndexChanged.connect(self._load_presensi_report)
        filter_layout.addWidget(self.presensi_wilayah_combo)

        filter_layout.addWidget(QLabel("Bulan:"))
        self.presensi_month = QComboBox()
        self.presensi_month.addItems([
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ])
        self.presensi_month.setCurrentIndex(date.today().month - 1)
        self.presensi_month.currentIndexChanged.connect(self._load_presensi_report)
        filter_layout.addWidget(self.presensi_month)

        filter_layout.addWidget(QLabel("Tahun:"))
        self.presensi_year = QComboBox()
        current_year = date.today().year
        for y in range(current_year - 2, current_year + 2):
            self.presensi_year.addItem(str(y), y)
        self.presensi_year.setCurrentText(str(current_year))
        self.presensi_year.currentIndexChanged.connect(self._load_presensi_report)
        filter_layout.addWidget(self.presensi_year)

        export_btn = QPushButton("Export Excel")
        export_btn.clicked.connect(self._export_presensi_report)
        filter_layout.addWidget(export_btn)

        filter_layout.addStretch()
        layout.addLayout(filter_layout)

        # Summary stats
        stats_layout = QHBoxLayout()
        self.presensi_stat_total = StatCard("Total Pengajian", "0", color=COLORS['info'])
        self.presensi_stat_hadir = StatCard("Rata-rata Hadir", "0%", color=COLORS['success'])
        self.presensi_stat_izin = StatCard("Rata-rata Izin", "0%", color=COLORS['warning'])
        self.presensi_stat_alpa = StatCard("Rata-rata Alpa", "0%", color=COLORS['error'])
        stats_layout.addWidget(self.presensi_stat_total)
        stats_layout.addWidget(self.presensi_stat_hadir)
        stats_layout.addWidget(self.presensi_stat_izin)
        stats_layout.addWidget(self.presensi_stat_alpa)
        layout.addLayout(stats_layout)

        # Table
        self.presensi_report_table = QTableWidget()
        self.presensi_report_table.setAlternatingRowColors(True)
        layout.addWidget(self.presensi_report_table)

    def _setup_penilaian_report_tab(self, layout: QVBoxLayout):
        """Setup tab laporan penilaian akhlaq"""
        # Filter
        filter_layout = QHBoxLayout()

        filter_layout.addWidget(QLabel("Wilayah:"))
        self.penilaian_wilayah_combo = QComboBox()
        self.penilaian_wilayah_combo.setMinimumWidth(200)
        self.penilaian_wilayah_combo.currentIndexChanged.connect(self._load_penilaian_report)
        filter_layout.addWidget(self.penilaian_wilayah_combo)

        filter_layout.addWidget(QLabel("Tahun:"))
        self.penilaian_year = QComboBox()
        current_year = date.today().year
        for y in range(current_year - 2, current_year + 2):
            self.penilaian_year.addItem(str(y), y)
        self.penilaian_year.setCurrentText(str(current_year))
        self.penilaian_year.currentIndexChanged.connect(self._load_penilaian_report)
        filter_layout.addWidget(self.penilaian_year)

        export_btn = QPushButton("Export Excel")
        export_btn.clicked.connect(self._export_penilaian_report)
        filter_layout.addWidget(export_btn)

        filter_layout.addStretch()
        layout.addLayout(filter_layout)

        # Table
        self.penilaian_report_table = QTableWidget()
        self.penilaian_report_table.setAlternatingRowColors(True)
        layout.addWidget(self.penilaian_report_table)

    def _setup_statistics_tab(self, layout: QVBoxLayout):
        """Setup tab statistik umum"""
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)

        content = QWidget()
        content_layout = QVBoxLayout(content)

        # Generus Stats
        generus_group = QGroupBox("Statistik Generus")
        generus_layout = QGridLayout(generus_group)

        self.stat_total_generus = StatCard("Total Generus", "0", color=COLORS['primary'])
        self.stat_generus_laki = StatCard("Laki-laki", "0", color=COLORS['info'])
        self.stat_generus_perempuan = StatCard("Perempuan", "0", color=COLORS['warning'])
        self.stat_generus_aktif = StatCard("Aktif", "0", color=COLORS['success'])

        generus_layout.addWidget(self.stat_total_generus, 0, 0)
        generus_layout.addWidget(self.stat_generus_laki, 0, 1)
        generus_layout.addWidget(self.stat_generus_perempuan, 0, 2)
        generus_layout.addWidget(self.stat_generus_aktif, 0, 3)

        content_layout.addWidget(generus_group)

        # Wilayah Stats
        wilayah_group = QGroupBox("Statistik per Wilayah")
        wilayah_layout = QVBoxLayout(wilayah_group)

        self.wilayah_stats_table = QTableWidget()
        self.wilayah_stats_table.setColumnCount(5)
        self.wilayah_stats_table.setHorizontalHeaderLabels([
            'Wilayah', 'Total Generus', 'Laki-laki', 'Perempuan', 'Aktif'
        ])
        self.wilayah_stats_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.wilayah_stats_table.setAlternatingRowColors(True)
        wilayah_layout.addWidget(self.wilayah_stats_table)

        content_layout.addWidget(wilayah_group)

        # Jenjang Stats
        jenjang_group = QGroupBox("Statistik per Jenjang")
        jenjang_layout = QVBoxLayout(jenjang_group)

        self.jenjang_stats_table = QTableWidget()
        self.jenjang_stats_table.setColumnCount(4)
        self.jenjang_stats_table.setHorizontalHeaderLabels([
            'Jenjang', 'Total', 'Laki-laki', 'Perempuan'
        ])
        self.jenjang_stats_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.jenjang_stats_table.setAlternatingRowColors(True)
        jenjang_layout.addWidget(self.jenjang_stats_table)

        content_layout.addWidget(jenjang_group)

        content_layout.addStretch()
        scroll.setWidget(content)
        layout.addWidget(scroll)

    def refresh(self):
        """Refresh all data"""
        self._load_wilayah_combos()
        self._load_jenjang_combo()
        self._load_bidang_combo()
        self._load_progress_report()
        self._load_presensi_report()
        self._load_penilaian_report()
        self._load_statistics()

    def _load_wilayah_combos(self):
        """Load wilayah ke semua combo"""
        wilayah_list = self.wilayah_service.get_flat_list()

        combos = [
            self.progress_wilayah_combo,
            self.presensi_wilayah_combo,
            self.penilaian_wilayah_combo
        ]

        for combo in combos:
            combo.blockSignals(True)
            combo.clear()
            combo.addItem("Semua Wilayah", None)
            for w in wilayah_list:
                combo.addItem(w['display'], w['id'])
            combo.blockSignals(False)

    def _load_jenjang_combo(self):
        """Load jenjang"""
        jenjang_list = self.jenjang_service.get_all()

        self.progress_jenjang_combo.blockSignals(True)
        self.progress_jenjang_combo.clear()
        self.progress_jenjang_combo.addItem("Semua Jenjang", None)
        for j in jenjang_list:
            self.progress_jenjang_combo.addItem(j.nama, j.id)
        self.progress_jenjang_combo.blockSignals(False)

    def _load_bidang_combo(self):
        """Load bidang materi"""
        bidang_list = self.session.query(BidangMateri).filter(
            BidangMateri.is_aktif == True
        ).order_by(BidangMateri.urutan).all()

        self.progress_bidang_combo.blockSignals(True)
        self.progress_bidang_combo.clear()
        self.progress_bidang_combo.addItem("Semua Bidang", None)
        for b in bidang_list:
            self.progress_bidang_combo.addItem(b.nama, b.id)
        self.progress_bidang_combo.blockSignals(False)

    def _load_progress_report(self):
        """Load laporan progress"""
        wilayah_id = self.progress_wilayah_combo.currentData()
        jenjang_id = self.progress_jenjang_combo.currentData()
        bidang_id = self.progress_bidang_combo.currentData()

        # Get generus list
        query = self.session.query(Jamaah, Enrollment).join(
            Enrollment, Jamaah.id == Enrollment.jamaah_id
        ).filter(
            Jamaah.status_aktif == True,
            Jamaah.status_pernikahan == 'belum_menikah',
            Enrollment.status == 'aktif'
        )

        if wilayah_id:
            query = query.filter(Enrollment.wilayah_id == wilayah_id)
        if jenjang_id:
            query = query.filter(Enrollment.jenjang_id == jenjang_id)

        generus_list = query.order_by(Jamaah.nama).all()

        # Get kategori for bidang
        kat_query = self.session.query(KategoriMateri).filter(
            KategoriMateri.is_aktif == True
        )
        if bidang_id:
            kat_query = kat_query.filter(KategoriMateri.bidang_id == bidang_id)
        kategori_list = kat_query.order_by(KategoriMateri.urutan).all()

        # Build headers
        headers = ['No', 'Nama', 'Jenjang'] + [k.nama[:15] for k in kategori_list] + ['Total %']
        self.progress_report_table.setColumnCount(len(headers))
        self.progress_report_table.setHorizontalHeaderLabels(headers)
        self.progress_report_table.setRowCount(len(generus_list))

        total_percentage = 0
        target_reached = 0

        for row, (jamaah, enrollment) in enumerate(generus_list):
            # No
            self.progress_report_table.setItem(row, 0, QTableWidgetItem(str(row + 1)))

            # Nama
            self.progress_report_table.setItem(row, 1, QTableWidgetItem(jamaah.nama))

            # Jenjang
            jenjang_nama = enrollment.jenjang.nama if enrollment.jenjang else '-'
            self.progress_report_table.setItem(row, 2, QTableWidgetItem(jenjang_nama))

            # Progress per kategori
            total_materi = 0
            total_selesai = 0

            for col, kategori in enumerate(kategori_list, start=3):
                # Count materi
                materi_count = self.session.query(MateriItem).filter(
                    MateriItem.kategori_id == kategori.id,
                    MateriItem.is_aktif == True
                ).count()

                # Count completed
                completed = self.session.query(ProgressJamaah).join(
                    MateriItem, ProgressJamaah.materi_item_id == MateriItem.id
                ).filter(
                    ProgressJamaah.jamaah_id == jamaah.id,
                    MateriItem.kategori_id == kategori.id,
                    ProgressJamaah.status.in_(['selesai', 'lulus'])
                ).count()

                percentage = (completed / materi_count * 100) if materi_count > 0 else 0
                item = QTableWidgetItem(f"{completed}/{materi_count}")
                item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)

                # Color coding
                if percentage >= 80:
                    item.setBackground(Qt.GlobalColor.green)
                elif percentage >= 50:
                    item.setBackground(Qt.GlobalColor.yellow)
                elif percentage > 0:
                    item.setBackground(Qt.GlobalColor.cyan)

                self.progress_report_table.setItem(row, col, item)

                total_materi += materi_count
                total_selesai += completed

            # Total percentage
            row_percentage = (total_selesai / total_materi * 100) if total_materi > 0 else 0
            total_item = QTableWidgetItem(f"{row_percentage:.1f}%")
            total_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.progress_report_table.setItem(row, len(headers) - 1, total_item)

            total_percentage += row_percentage
            if row_percentage >= 80:
                target_reached += 1

        # Update stats
        avg_percentage = (total_percentage / len(generus_list)) if generus_list else 0
        self.progress_stat_total.set_value(str(len(generus_list)))
        self.progress_stat_completed.set_value(f"{avg_percentage:.1f}%")
        self.progress_stat_target.set_value(str(target_reached))

    def _load_presensi_report(self):
        """Load laporan presensi"""
        wilayah_id = self.presensi_wilayah_combo.currentData()
        bulan = self.presensi_month.currentIndex() + 1
        tahun = self.presensi_year.currentData() or date.today().year

        # Get date range
        first_day = date(tahun, bulan, 1)
        if bulan == 12:
            last_day = date(tahun + 1, 1, 1) - timedelta(days=1)
        else:
            last_day = date(tahun, bulan + 1, 1) - timedelta(days=1)

        # Get pengajian in month
        query = self.session.query(Pengajian).filter(
            Pengajian.tanggal >= first_day,
            Pengajian.tanggal <= last_day
        )
        if wilayah_id:
            query = query.filter(Pengajian.wilayah_id == wilayah_id)

        pengajian_list = query.order_by(Pengajian.tanggal).all()

        # Get unique dates
        dates = sorted(set(p.tanggal for p in pengajian_list))

        # Get all jamaah who have attendance
        jamaah_ids = set()
        for p in pengajian_list:
            for presensi in p.presensi:
                jamaah_ids.add(presensi.jamaah_id)

        jamaah_list = self.session.query(Jamaah).filter(
            Jamaah.id.in_(jamaah_ids)
        ).order_by(Jamaah.nama).all() if jamaah_ids else []

        # Setup headers
        headers = ['No', 'Nama'] + [d.strftime('%d') for d in dates] + ['H', 'I', 'S', 'A', '%']
        self.presensi_report_table.setColumnCount(len(headers))
        self.presensi_report_table.setHorizontalHeaderLabels(headers)
        self.presensi_report_table.setRowCount(len(jamaah_list))

        # Build presensi map
        presensi_map = {}
        for p in pengajian_list:
            for presensi in p.presensi:
                key = (presensi.jamaah_id, p.tanggal)
                presensi_map[key] = presensi.status

        total_hadir = 0
        total_izin = 0
        total_sakit = 0
        total_alpa = 0
        total_records = 0

        for row, jamaah in enumerate(jamaah_list):
            # No
            self.presensi_report_table.setItem(row, 0, QTableWidgetItem(str(row + 1)))

            # Nama
            self.presensi_report_table.setItem(row, 1, QTableWidgetItem(jamaah.nama))

            # Attendance per date
            hadir = izin = sakit = alpa = 0
            for col, tanggal in enumerate(dates, start=2):
                status = presensi_map.get((jamaah.id, tanggal), '-')
                if status == 'hadir':
                    display = 'H'
                    hadir += 1
                    total_hadir += 1
                elif status == 'izin':
                    display = 'I'
                    izin += 1
                    total_izin += 1
                elif status == 'sakit':
                    display = 'S'
                    sakit += 1
                    total_sakit += 1
                elif status == 'alpa':
                    display = 'A'
                    alpa += 1
                    total_alpa += 1
                else:
                    display = '-'

                item = QTableWidgetItem(display)
                item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                self.presensi_report_table.setItem(row, col, item)

            # Summary
            base_col = len(dates) + 2
            for i, val in enumerate([hadir, izin, sakit, alpa]):
                item = QTableWidgetItem(str(val))
                item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                self.presensi_report_table.setItem(row, base_col + i, item)

            # Percentage
            total = hadir + izin + sakit + alpa
            percentage = (hadir / total * 100) if total > 0 else 0
            pct_item = QTableWidgetItem(f"{percentage:.0f}%")
            pct_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.presensi_report_table.setItem(row, base_col + 4, pct_item)

            total_records += total

        # Update stats
        self.presensi_stat_total.set_value(str(len(pengajian_list)))

        if total_records > 0:
            self.presensi_stat_hadir.set_value(f"{total_hadir/total_records*100:.1f}%")
            self.presensi_stat_izin.set_value(f"{total_izin/total_records*100:.1f}%")
            self.presensi_stat_alpa.set_value(f"{(total_sakit+total_alpa)/total_records*100:.1f}%")
        else:
            self.presensi_stat_hadir.set_value("0%")
            self.presensi_stat_izin.set_value("0%")
            self.presensi_stat_alpa.set_value("0%")

    def _load_penilaian_report(self):
        """Load laporan penilaian akhlaq tahunan"""
        wilayah_id = self.penilaian_wilayah_combo.currentData()
        tahun = self.penilaian_year.currentData() or date.today().year

        # Get generus list
        query = self.session.query(Jamaah, Enrollment).join(
            Enrollment, Jamaah.id == Enrollment.jamaah_id
        ).filter(
            Jamaah.status_aktif == True,
            Jamaah.status_pernikahan == 'belum_menikah',
            Enrollment.status == 'aktif'
        )

        if wilayah_id:
            query = query.filter(Enrollment.wilayah_id == wilayah_id)

        generus_list = query.order_by(Jamaah.nama).all()

        # Setup headers - monthly averages
        bulan_nama = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
        headers = ['No', 'Nama', 'Jenjang'] + bulan_nama + ['Rata-rata']
        self.penilaian_report_table.setColumnCount(len(headers))
        self.penilaian_report_table.setHorizontalHeaderLabels(headers)
        self.penilaian_report_table.setRowCount(len(generus_list))

        for row, (jamaah, enrollment) in enumerate(generus_list):
            # No
            self.penilaian_report_table.setItem(row, 0, QTableWidgetItem(str(row + 1)))

            # Nama
            self.penilaian_report_table.setItem(row, 1, QTableWidgetItem(jamaah.nama))

            # Jenjang
            jenjang_nama = enrollment.jenjang.nama if enrollment.jenjang else '-'
            self.penilaian_report_table.setItem(row, 2, QTableWidgetItem(jenjang_nama))

            # Monthly penilaian
            yearly_total = 0
            yearly_count = 0

            for bulan in range(1, 13):
                penilaian = self.session.query(PenilaianAkhlaq).filter(
                    PenilaianAkhlaq.jamaah_id == jamaah.id,
                    PenilaianAkhlaq.periode_tahun == tahun,
                    PenilaianAkhlaq.periode_bulan == bulan
                ).first()

                if penilaian and penilaian.rata_rata_total:
                    avg = penilaian.rata_rata_total
                    display = f"{avg:.1f}"
                    yearly_total += avg
                    yearly_count += 1
                else:
                    display = '-'

                item = QTableWidgetItem(display)
                item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                self.penilaian_report_table.setItem(row, bulan + 2, item)

            # Yearly average
            if yearly_count > 0:
                yearly_avg = yearly_total / yearly_count
                avg_item = QTableWidgetItem(f"{yearly_avg:.2f}")

                # Color coding
                if yearly_avg >= 3.5:
                    avg_item.setBackground(Qt.GlobalColor.green)
                elif yearly_avg >= 2.5:
                    avg_item.setBackground(Qt.GlobalColor.cyan)
                elif yearly_avg >= 1.5:
                    avg_item.setBackground(Qt.GlobalColor.yellow)
                else:
                    avg_item.setBackground(Qt.GlobalColor.red)
            else:
                avg_item = QTableWidgetItem('-')

            avg_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.penilaian_report_table.setItem(row, 15, avg_item)

    def _load_statistics(self):
        """Load statistik umum"""
        # Total generus
        total_query = self.session.query(func.count(Jamaah.id)).filter(
            Jamaah.status_aktif == True,
            Jamaah.status_pernikahan == 'belum_menikah'
        )
        total_generus = total_query.scalar() or 0
        self.stat_total_generus.set_value(str(total_generus))

        # By gender
        laki_count = self.session.query(func.count(Jamaah.id)).filter(
            Jamaah.status_aktif == True,
            Jamaah.status_pernikahan == 'belum_menikah',
            Jamaah.jenis_kelamin == 'L'
        ).scalar() or 0
        self.stat_generus_laki.set_value(str(laki_count))

        perempuan_count = self.session.query(func.count(Jamaah.id)).filter(
            Jamaah.status_aktif == True,
            Jamaah.status_pernikahan == 'belum_menikah',
            Jamaah.jenis_kelamin == 'P'
        ).scalar() or 0
        self.stat_generus_perempuan.set_value(str(perempuan_count))

        # Active in enrollment
        aktif_count = self.session.query(func.count(func.distinct(Enrollment.jamaah_id))).join(
            Jamaah, Enrollment.jamaah_id == Jamaah.id
        ).filter(
            Jamaah.status_aktif == True,
            Jamaah.status_pernikahan == 'belum_menikah',
            Enrollment.status == 'aktif'
        ).scalar() or 0
        self.stat_generus_aktif.set_value(str(aktif_count))

        # Stats per wilayah
        self._load_wilayah_stats()

        # Stats per jenjang
        self._load_jenjang_stats()

    def _load_wilayah_stats(self):
        """Load statistik per wilayah"""
        wilayah_list = self.session.query(Wilayah).filter(
            Wilayah.tingkat == 'kelompok',
            Wilayah.is_aktif == True
        ).order_by(Wilayah.nama).all()

        self.wilayah_stats_table.setRowCount(len(wilayah_list))

        for row, wilayah in enumerate(wilayah_list):
            self.wilayah_stats_table.setItem(row, 0, QTableWidgetItem(wilayah.nama))

            # Get stats
            base_query = self.session.query(func.count(func.distinct(Jamaah.id))).join(
                Enrollment, Jamaah.id == Enrollment.jamaah_id
            ).filter(
                Jamaah.status_pernikahan == 'belum_menikah',
                Enrollment.wilayah_id == wilayah.id
            )

            total = base_query.scalar() or 0
            laki = base_query.filter(Jamaah.jenis_kelamin == 'L').scalar() or 0
            perempuan = base_query.filter(Jamaah.jenis_kelamin == 'P').scalar() or 0
            aktif = base_query.filter(
                Jamaah.status_aktif == True,
                Enrollment.status == 'aktif'
            ).scalar() or 0

            for col, val in enumerate([total, laki, perempuan, aktif], start=1):
                item = QTableWidgetItem(str(val))
                item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                self.wilayah_stats_table.setItem(row, col, item)

    def _load_jenjang_stats(self):
        """Load statistik per jenjang"""
        jenjang_list = self.jenjang_service.get_all()

        self.jenjang_stats_table.setRowCount(len(jenjang_list))

        for row, jenjang in enumerate(jenjang_list):
            self.jenjang_stats_table.setItem(row, 0, QTableWidgetItem(jenjang.nama))

            # Get stats
            base_query = self.session.query(func.count(func.distinct(Jamaah.id))).join(
                Enrollment, Jamaah.id == Enrollment.jamaah_id
            ).filter(
                Jamaah.status_aktif == True,
                Jamaah.status_pernikahan == 'belum_menikah',
                Enrollment.status == 'aktif',
                Enrollment.jenjang_id == jenjang.id
            )

            total = base_query.scalar() or 0
            laki = base_query.filter(Jamaah.jenis_kelamin == 'L').scalar() or 0
            perempuan = base_query.filter(Jamaah.jenis_kelamin == 'P').scalar() or 0

            for col, val in enumerate([total, laki, perempuan], start=1):
                item = QTableWidgetItem(str(val))
                item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                self.jenjang_stats_table.setItem(row, col, item)

    def _export_progress_report(self):
        """Export laporan progress ke Excel"""
        filepath, _ = QFileDialog.getSaveFileName(
            self,
            "Export Laporan Progress",
            f"laporan_progress_{date.today().isoformat()}.xlsx",
            "Excel Files (*.xlsx)"
        )

        if filepath:
            try:
                self._export_table_to_excel(self.progress_report_table, filepath, "Laporan Progress")
                QMessageBox.information(self, "Sukses", f"Laporan berhasil di-export ke:\n{filepath}")
            except Exception as e:
                QMessageBox.critical(self, "Error", f"Gagal export: {e}")

    def _export_presensi_report(self):
        """Export laporan presensi ke Excel"""
        filepath, _ = QFileDialog.getSaveFileName(
            self,
            "Export Laporan Presensi",
            f"laporan_presensi_{date.today().isoformat()}.xlsx",
            "Excel Files (*.xlsx)"
        )

        if filepath:
            try:
                self._export_table_to_excel(self.presensi_report_table, filepath, "Laporan Presensi")
                QMessageBox.information(self, "Sukses", f"Laporan berhasil di-export ke:\n{filepath}")
            except Exception as e:
                QMessageBox.critical(self, "Error", f"Gagal export: {e}")

    def _export_penilaian_report(self):
        """Export laporan penilaian ke Excel"""
        filepath, _ = QFileDialog.getSaveFileName(
            self,
            "Export Laporan Penilaian",
            f"laporan_penilaian_{date.today().isoformat()}.xlsx",
            "Excel Files (*.xlsx)"
        )

        if filepath:
            try:
                self._export_table_to_excel(self.penilaian_report_table, filepath, "Laporan Penilaian")
                QMessageBox.information(self, "Sukses", f"Laporan berhasil di-export ke:\n{filepath}")
            except Exception as e:
                QMessageBox.critical(self, "Error", f"Gagal export: {e}")

    def _export_table_to_excel(self, table: QTableWidget, filepath: str, title: str):
        """Export QTableWidget to Excel"""
        from openpyxl import Workbook
        from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
        from openpyxl.utils import get_column_letter

        wb = Workbook()
        ws = wb.active
        ws.title = title

        # Header style
        header_fill = PatternFill(start_color="1a5f2b", end_color="1a5f2b", fill_type="solid")
        header_font = Font(bold=True, color="FFFFFF")
        cell_border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )

        # Write headers
        for col in range(table.columnCount()):
            cell = ws.cell(row=1, column=col + 1)
            cell.value = table.horizontalHeaderItem(col).text() if table.horizontalHeaderItem(col) else ''
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = cell_border

        # Write data
        for row in range(table.rowCount()):
            for col in range(table.columnCount()):
                item = table.item(row, col)
                cell = ws.cell(row=row + 2, column=col + 1)
                cell.value = item.text() if item else ''
                cell.border = cell_border
                cell.alignment = Alignment(vertical="center")

        # Auto-width
        for column in ws.columns:
            max_length = 0
            column_letter = get_column_letter(column[0].column)
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            ws.column_dimensions[column_letter].width = adjusted_width

        wb.save(filepath)
