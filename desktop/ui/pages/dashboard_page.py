"""
Dashboard Page - Halaman utama dengan statistik
"""
from PyQt6.QtWidgets import (
    QHBoxLayout, QVBoxLayout, QFrame, QLabel, QGridLayout,
    QTableWidget, QTableWidgetItem, QHeaderView
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont
from sqlalchemy.orm import Session
from datetime import date, datetime

from .base_page import BasePage
from ..components.stat_card import StatCard
from services.jamaah_service import JamaahService
from services.pengajian_service import PengajianService
from services.presensi_service import PresensiService
from config import COLORS


class DashboardPage(BasePage):
    """
    Dashboard dengan:
    - Statistik generus
    - Grafik kehadiran
    - Pengajian terbaru
    - Quick actions
    """

    def __init__(self, session: Session, parent=None):
        super().__init__(session, parent)
        self.jamaah_service = JamaahService(session)
        self.pengajian_service = PengajianService(session)
        self.presensi_service = PresensiService(session)
        self._setup_ui()

    def _setup_ui(self):
        # Header
        self.set_header(
            "Dashboard",
            f"Selamat datang di Sistem PPG Sorong - {date.today().strftime('%d %B %Y')}"
        )

        # Stats cards row
        stats_layout = QHBoxLayout()
        stats_layout.setSpacing(16)

        self.stat_total = StatCard("Total Generus", "0", "Jamaah aktif", color=COLORS['primary'])
        self.stat_laki = StatCard("Laki-laki", "0", "Ikhwan", color=COLORS['info'])
        self.stat_perempuan = StatCard("Perempuan", "0", "Akhwat", color=COLORS['warning'])
        self.stat_pengajian = StatCard("Pengajian Bulan Ini", "0", "Sesi", color=COLORS['success'])

        stats_layout.addWidget(self.stat_total)
        stats_layout.addWidget(self.stat_laki)
        stats_layout.addWidget(self.stat_perempuan)
        stats_layout.addWidget(self.stat_pengajian)

        self.add_layout(stats_layout)

        # Content row
        content_layout = QHBoxLayout()
        content_layout.setSpacing(16)

        # Left: Stats per jenjang
        left_card = self._create_jenjang_card()
        content_layout.addWidget(left_card, 1)

        # Right: Recent pengajian
        right_card = self._create_recent_pengajian_card()
        content_layout.addWidget(right_card, 1)

        self.add_layout(content_layout)
        self.add_stretch()

    def _create_jenjang_card(self) -> QFrame:
        """Create stats per jenjang card"""
        card = QFrame()
        card.setStyleSheet(f"""
            QFrame {{
                background-color: {COLORS['surface']};
                border: 1px solid {COLORS['border']};
                border-radius: 12px;
            }}
        """)

        layout = QVBoxLayout(card)
        layout.setContentsMargins(20, 20, 20, 20)

        title = QLabel("Generus per Jenjang")
        title.setFont(QFont('Segoe UI', 16, QFont.Weight.Bold))
        layout.addWidget(title)

        self.jenjang_table = QTableWidget()
        self.jenjang_table.setColumnCount(3)
        self.jenjang_table.setHorizontalHeaderLabels(['Jenjang', 'Jumlah', 'Persentase'])
        self.jenjang_table.horizontalHeader().setStretchLastSection(True)
        self.jenjang_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.jenjang_table.verticalHeader().setVisible(False)
        self.jenjang_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        layout.addWidget(self.jenjang_table)

        return card

    def _create_recent_pengajian_card(self) -> QFrame:
        """Create recent pengajian card"""
        card = QFrame()
        card.setStyleSheet(f"""
            QFrame {{
                background-color: {COLORS['surface']};
                border: 1px solid {COLORS['border']};
                border-radius: 12px;
            }}
        """)

        layout = QVBoxLayout(card)
        layout.setContentsMargins(20, 20, 20, 20)

        title = QLabel("Pengajian Terakhir")
        title.setFont(QFont('Segoe UI', 16, QFont.Weight.Bold))
        layout.addWidget(title)

        self.pengajian_table = QTableWidget()
        self.pengajian_table.setColumnCount(4)
        self.pengajian_table.setHorizontalHeaderLabels(['Tanggal', 'Wilayah', 'Hadir', 'Status'])
        self.pengajian_table.horizontalHeader().setStretchLastSection(True)
        self.pengajian_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        self.pengajian_table.verticalHeader().setVisible(False)
        self.pengajian_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        layout.addWidget(self.pengajian_table)

        return card

    def refresh(self):
        """Refresh dashboard data"""
        try:
            # Get statistics
            stats = self.jamaah_service.get_statistics()

            # Update stat cards
            self.stat_total.set_value(stats['total'])
            self.stat_laki.set_value(stats['laki_laki'])
            self.stat_perempuan.set_value(stats['perempuan'])

            # Pengajian bulan ini
            today = date.today()
            pengajian_summary = self.pengajian_service.get_summary_by_month(
                today.year, today.month
            )
            self.stat_pengajian.set_value(pengajian_summary['total'])

            # Update jenjang table
            self.jenjang_table.setRowCount(len(stats['per_jenjang']))
            total = stats['total'] or 1  # Avoid division by zero

            for i, j in enumerate(stats['per_jenjang']):
                self.jenjang_table.setItem(i, 0, QTableWidgetItem(j['jenjang_nama']))
                self.jenjang_table.setItem(i, 1, QTableWidgetItem(str(j['jumlah'])))
                persen = (j['jumlah'] / total * 100)
                self.jenjang_table.setItem(i, 2, QTableWidgetItem(f"{persen:.1f}%"))

            # Update recent pengajian
            recent = self.pengajian_service.get_by_date_range(
                date(today.year, today.month, 1),
                today
            )[:10]

            self.pengajian_table.setRowCount(len(recent))
            for i, p in enumerate(recent):
                self.pengajian_table.setItem(i, 0, QTableWidgetItem(
                    p.tanggal.strftime('%d/%m/%Y') if p.tanggal else '-'
                ))
                self.pengajian_table.setItem(i, 1, QTableWidgetItem(
                    p.wilayah.nama if p.wilayah else '-'
                ))
                self.pengajian_table.setItem(i, 2, QTableWidgetItem(
                    f"{p.jumlah_hadir}/{p.jumlah_total}"
                ))
                self.pengajian_table.setItem(i, 3, QTableWidgetItem(p.status or '-'))

        except Exception as e:
            print(f"Error refreshing dashboard: {e}")
