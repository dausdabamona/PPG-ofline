"""
Penilaian Page - Halaman penilaian progress dan akhlaq generus
"""
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QTabWidget, QPushButton, QLabel,
    QMessageBox, QComboBox, QTableWidget, QTableWidgetItem, QHeaderView,
    QGroupBox, QFormLayout, QSpinBox, QTextEdit, QDialog, QGridLayout,
    QRadioButton, QButtonGroup, QProgressBar, QFrame, QScrollArea
)
from PyQt6.QtCore import Qt, QDate
from PyQt6.QtGui import QFont
from sqlalchemy.orm import Session
from datetime import date

from .base_page import BasePage
from ..components.stat_card import StatCard
from services import (
    WilayahService, JenjangService, ProgressService, PenilaianAkhlaqService
)
from database.models import (
    Jamaah, Enrollment, BidangMateri, KategoriMateri, MateriItem,
    ProgressJamaah, PenilaianAkhlaq
)
from config import COLORS


class PenilaianPage(BasePage):
    """
    Halaman Penilaian
    - Tab Progress Materi: tracking hafalan dan materi
    - Tab Penilaian Akhlaq: penilaian bulanan karakter
    """

    def __init__(self, session: Session, parent=None):
        super().__init__(session, parent)
        self.wilayah_service = WilayahService(session)
        self.jenjang_service = JenjangService(session)
        self.progress_service = ProgressService(session)
        self.akhlaq_service = PenilaianAkhlaqService(session)
        self._current_jamaah_id = None
        self._setup_ui()

    def _setup_ui(self):
        self.set_header(
            "Penilaian",
            "Kelola penilaian progress dan akhlaq generus"
        )

        # Tabs
        tabs = QTabWidget()

        # Tab 1: Progress Materi
        progress_tab = QWidget()
        progress_layout = QVBoxLayout(progress_tab)
        self._setup_progress_tab(progress_layout)
        tabs.addTab(progress_tab, "Progress Materi")

        # Tab 2: Penilaian Akhlaq
        akhlaq_tab = QWidget()
        akhlaq_layout = QVBoxLayout(akhlaq_tab)
        self._setup_akhlaq_tab(akhlaq_layout)
        tabs.addTab(akhlaq_tab, "Penilaian Akhlaq")

        self.add_widget(tabs)

    def _setup_progress_tab(self, layout: QVBoxLayout):
        """Setup tab progress materi"""
        # Filter section
        filter_group = QGroupBox("Pilih Generus")
        filter_layout = QHBoxLayout(filter_group)

        filter_layout.addWidget(QLabel("Wilayah:"))
        self.progress_wilayah_combo = QComboBox()
        self.progress_wilayah_combo.setMinimumWidth(200)
        self.progress_wilayah_combo.currentIndexChanged.connect(self._load_generus_list)
        filter_layout.addWidget(self.progress_wilayah_combo)

        filter_layout.addWidget(QLabel("Jenjang:"))
        self.progress_jenjang_combo = QComboBox()
        self.progress_jenjang_combo.setMinimumWidth(150)
        self.progress_jenjang_combo.currentIndexChanged.connect(self._load_generus_list)
        filter_layout.addWidget(self.progress_jenjang_combo)

        filter_layout.addWidget(QLabel("Generus:"))
        self.progress_generus_combo = QComboBox()
        self.progress_generus_combo.setMinimumWidth(200)
        self.progress_generus_combo.currentIndexChanged.connect(self._on_generus_selected)
        filter_layout.addWidget(self.progress_generus_combo)

        filter_layout.addStretch()
        layout.addWidget(filter_group)

        # Summary cards
        summary_layout = QHBoxLayout()
        self.stat_total_materi = StatCard("Total Materi", "0", color=COLORS['info'])
        self.stat_selesai = StatCard("Selesai", "0", color=COLORS['success'])
        self.stat_sedang = StatCard("Sedang Belajar", "0", color=COLORS['warning'])
        self.stat_belum = StatCard("Belum Mulai", "0", color=COLORS['text_secondary'])

        summary_layout.addWidget(self.stat_total_materi)
        summary_layout.addWidget(self.stat_selesai)
        summary_layout.addWidget(self.stat_sedang)
        summary_layout.addWidget(self.stat_belum)
        layout.addLayout(summary_layout)

        # Progress by bidang/kategori
        self.progress_scroll = QScrollArea()
        self.progress_scroll.setWidgetResizable(True)
        self.progress_scroll.setFrameShape(QFrame.Shape.NoFrame)

        self.progress_container = QWidget()
        self.progress_container_layout = QVBoxLayout(self.progress_container)
        self.progress_scroll.setWidget(self.progress_container)
        layout.addWidget(self.progress_scroll, 1)

    def _setup_akhlaq_tab(self, layout: QVBoxLayout):
        """Setup tab penilaian akhlaq"""
        # Filter section
        filter_layout = QHBoxLayout()

        filter_layout.addWidget(QLabel("Wilayah:"))
        self.akhlaq_wilayah_combo = QComboBox()
        self.akhlaq_wilayah_combo.setMinimumWidth(200)
        self.akhlaq_wilayah_combo.currentIndexChanged.connect(self._load_akhlaq_table)
        filter_layout.addWidget(self.akhlaq_wilayah_combo)

        filter_layout.addWidget(QLabel("Bulan:"))
        self.akhlaq_month = QComboBox()
        self.akhlaq_month.addItems([
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ])
        self.akhlaq_month.setCurrentIndex(date.today().month - 1)
        self.akhlaq_month.currentIndexChanged.connect(self._load_akhlaq_table)
        filter_layout.addWidget(self.akhlaq_month)

        filter_layout.addWidget(QLabel("Tahun:"))
        self.akhlaq_year = QComboBox()
        current_year = date.today().year
        for y in range(current_year - 2, current_year + 2):
            self.akhlaq_year.addItem(str(y), y)
        self.akhlaq_year.setCurrentText(str(current_year))
        self.akhlaq_year.currentIndexChanged.connect(self._load_akhlaq_table)
        filter_layout.addWidget(self.akhlaq_year)

        filter_layout.addStretch()
        layout.addLayout(filter_layout)

        # Akhlaq table
        self.akhlaq_table = QTableWidget()
        self.akhlaq_table.setAlternatingRowColors(True)
        self.akhlaq_table.cellDoubleClicked.connect(self._edit_akhlaq)
        layout.addWidget(self.akhlaq_table)

        # Buttons
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()

        add_btn = QPushButton("Input Penilaian")
        add_btn.setStyleSheet(f"background-color: {COLORS['primary']}; color: white; padding: 10px 20px;")
        add_btn.clicked.connect(self._show_input_akhlaq_dialog)
        btn_layout.addWidget(add_btn)

        layout.addLayout(btn_layout)

    def refresh(self):
        """Refresh all data"""
        self._load_wilayah_combos()
        self._load_jenjang_combo()
        self._load_generus_list()
        self._load_akhlaq_table()

    def _load_wilayah_combos(self):
        """Load wilayah ke semua combo"""
        wilayah_list = self.wilayah_service.get_flat_list()

        for combo in [self.progress_wilayah_combo, self.akhlaq_wilayah_combo]:
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

    def _load_generus_list(self):
        """Load daftar generus"""
        self.progress_generus_combo.blockSignals(True)
        self.progress_generus_combo.clear()

        wilayah_id = self.progress_wilayah_combo.currentData()
        jenjang_id = self.progress_jenjang_combo.currentData()

        # Get active generus
        query = self.session.query(Jamaah).join(
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

        self.progress_generus_combo.addItem("-- Pilih Generus --", None)
        for g in generus_list:
            self.progress_generus_combo.addItem(g.nama, g.id)

        self.progress_generus_combo.blockSignals(False)
        self._on_generus_selected()

    def _on_generus_selected(self):
        """Handle generus selection"""
        jamaah_id = self.progress_generus_combo.currentData()
        self._current_jamaah_id = jamaah_id

        if not jamaah_id:
            self._clear_progress_view()
            return

        self._load_progress_view(jamaah_id)

    def _clear_progress_view(self):
        """Clear progress view"""
        self.stat_total_materi.set_value("0")
        self.stat_selesai.set_value("0")
        self.stat_sedang.set_value("0")
        self.stat_belum.set_value("0")

        # Clear container
        while self.progress_container_layout.count():
            child = self.progress_container_layout.takeAt(0)
            if child.widget():
                child.widget().deleteLater()

    def _load_progress_view(self, jamaah_id: int):
        """Load progress view for jamaah"""
        self._clear_progress_view()

        # Get summary
        summary = self.progress_service.get_progress_summary(jamaah_id)

        total = 0
        selesai = 0
        sedang = 0
        belum = 0

        # Build progress by bidang
        for bidang_nama, bidang_data in summary.items():
            # Create bidang group
            bidang_group = QGroupBox(bidang_nama)
            bidang_layout = QVBoxLayout(bidang_group)

            for kat_data in bidang_data['kategori']:
                # Category row
                kat_layout = QHBoxLayout()

                # Category name
                kat_label = QLabel(kat_data['kategori_nama'])
                kat_label.setMinimumWidth(200)
                kat_layout.addWidget(kat_label)

                # Progress bar
                progress_bar = QProgressBar()
                progress_bar.setMaximum(kat_data['total'])
                progress_bar.setValue(kat_data['completed'])
                progress_bar.setFormat(f"{kat_data['completed']}/{kat_data['total']}")
                progress_bar.setStyleSheet(f"""
                    QProgressBar {{
                        border: 1px solid {COLORS['border']};
                        border-radius: 4px;
                        text-align: center;
                        height: 20px;
                    }}
                    QProgressBar::chunk {{
                        background-color: {COLORS['success']};
                        border-radius: 3px;
                    }}
                """)
                kat_layout.addWidget(progress_bar, 1)

                # Detail button
                detail_btn = QPushButton("Detail")
                detail_btn.setProperty('kategori_id', kat_data['kategori_id'])
                detail_btn.setProperty('kategori_nama', kat_data['kategori_nama'])
                detail_btn.clicked.connect(self._show_kategori_detail)
                kat_layout.addWidget(detail_btn)

                bidang_layout.addLayout(kat_layout)

                # Update totals
                total += kat_data['total']
                selesai += kat_data['completed']

            self.progress_container_layout.addWidget(bidang_group)

        # Get sedang count
        sedang_list = self.session.query(ProgressJamaah).filter(
            ProgressJamaah.jamaah_id == jamaah_id,
            ProgressJamaah.status == 'sedang'
        ).count()
        sedang = sedang_list
        belum = total - selesai - sedang

        # Update stats
        self.stat_total_materi.set_value(str(total))
        self.stat_selesai.set_value(str(selesai))
        self.stat_sedang.set_value(str(sedang))
        self.stat_belum.set_value(str(max(0, belum)))

        self.progress_container_layout.addStretch()

    def _show_kategori_detail(self):
        """Show detail dialog for kategori"""
        btn = self.sender()
        kategori_id = btn.property('kategori_id')
        kategori_nama = btn.property('kategori_nama')

        if not self._current_jamaah_id:
            return

        dialog = KategoriDetailDialog(
            self.session,
            self._current_jamaah_id,
            kategori_id,
            kategori_nama,
            self.progress_service,
            self
        )
        if dialog.exec():
            self._load_progress_view(self._current_jamaah_id)

    def _load_akhlaq_table(self):
        """Load penilaian akhlaq table"""
        wilayah_id = self.akhlaq_wilayah_combo.currentData()
        bulan = self.akhlaq_month.currentIndex() + 1
        tahun = self.akhlaq_year.currentData()

        if not tahun:
            tahun = date.today().year

        # Get data
        rekap = self.akhlaq_service.get_rekap_bulanan(tahun, bulan, wilayah_id)

        # Setup columns
        headers = [
            'No', 'Nama', 'Sholat Wajib', 'Sholat Jamaah', 'Puasa', 'Tilawah',
            'Birrul W.', 'Adab Makan', 'Adab Tidur', 'Adab Bicara',
            'Kebersihan', 'Disiplin', 'Jujur', 'Tanggung Jawab', 'Rata-rata'
        ]

        self.akhlaq_table.setColumnCount(len(headers))
        self.akhlaq_table.setHorizontalHeaderLabels(headers)
        self.akhlaq_table.setRowCount(len(rekap))

        for row, data in enumerate(rekap):
            # No
            self.akhlaq_table.setItem(row, 0, QTableWidgetItem(str(row + 1)))

            # Nama
            item = QTableWidgetItem(data['nama'])
            item.setData(Qt.ItemDataRole.UserRole, data['jamaah_id'])
            self.akhlaq_table.setItem(row, 1, item)

            # Aspek values
            aspek_cols = [
                'sholat_wajib', 'sholat_jamaah', 'puasa', 'tilawah',
                'birrul_walidain', 'adab_makan', 'adab_tidur', 'adab_berbicara',
                'kebersihan', 'kedisiplinan', 'kejujuran', 'tanggung_jawab'
            ]

            for col, aspek in enumerate(aspek_cols, start=2):
                nilai = data.get(aspek, '-') or '-'
                item = QTableWidgetItem(nilai)
                item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)

                # Color coding
                if nilai == 'A':
                    item.setBackground(Qt.GlobalColor.green)
                elif nilai == 'B':
                    item.setBackground(Qt.GlobalColor.cyan)
                elif nilai == 'C':
                    item.setBackground(Qt.GlobalColor.yellow)
                elif nilai == 'D':
                    item.setBackground(Qt.GlobalColor.red)

                self.akhlaq_table.setItem(row, col, item)

            # Rata-rata
            avg = data.get('rata_rata_total')
            if avg:
                avg_display = f"{avg:.2f}"
            else:
                avg_display = '-'
            avg_item = QTableWidgetItem(avg_display)
            avg_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.akhlaq_table.setItem(row, 14, avg_item)

        # Adjust columns
        self.akhlaq_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)

    def _edit_akhlaq(self, row: int, col: int):
        """Edit penilaian akhlaq"""
        item = self.akhlaq_table.item(row, 1)
        if not item:
            return

        jamaah_id = item.data(Qt.ItemDataRole.UserRole)
        jamaah_nama = item.text()
        bulan = self.akhlaq_month.currentIndex() + 1
        tahun = self.akhlaq_year.currentData() or date.today().year

        dialog = PenilaianAkhlaqDialog(
            self.session,
            jamaah_id,
            jamaah_nama,
            tahun,
            bulan,
            self.akhlaq_service,
            self
        )
        if dialog.exec():
            self._load_akhlaq_table()

    def _show_input_akhlaq_dialog(self):
        """Show dialog to select generus and input penilaian"""
        # Get selected wilayah
        wilayah_id = self.akhlaq_wilayah_combo.currentData()
        bulan = self.akhlaq_month.currentIndex() + 1
        tahun = self.akhlaq_year.currentData() or date.today().year

        # Get generus list
        query = self.session.query(Jamaah).join(
            Enrollment, Jamaah.id == Enrollment.jamaah_id
        ).filter(
            Jamaah.status_aktif == True,
            Jamaah.status_pernikahan == 'belum_menikah',
            Enrollment.status == 'aktif'
        )

        if wilayah_id:
            query = query.filter(Enrollment.wilayah_id == wilayah_id)

        generus_list = query.order_by(Jamaah.nama).all()

        if not generus_list:
            QMessageBox.information(self, "Info", "Tidak ada generus aktif.")
            return

        # Show selection dialog
        dialog = SelectGenerusDialog(generus_list, self)
        if dialog.exec():
            selected = dialog.get_selected()
            if selected:
                jamaah = selected
                penilaian_dialog = PenilaianAkhlaqDialog(
                    self.session,
                    jamaah.id,
                    jamaah.nama,
                    tahun,
                    bulan,
                    self.akhlaq_service,
                    self
                )
                if penilaian_dialog.exec():
                    self._load_akhlaq_table()


class KategoriDetailDialog(QDialog):
    """Dialog untuk detail dan input progress per kategori"""

    def __init__(
        self,
        session: Session,
        jamaah_id: int,
        kategori_id: int,
        kategori_nama: str,
        progress_service: ProgressService,
        parent=None
    ):
        super().__init__(parent)
        self.session = session
        self.jamaah_id = jamaah_id
        self.kategori_id = kategori_id
        self.kategori_nama = kategori_nama
        self.progress_service = progress_service
        self._setup_ui()
        self._load_data()

    def _setup_ui(self):
        self.setWindowTitle(f"Progress: {self.kategori_nama}")
        self.setMinimumSize(700, 500)
        self.setModal(True)

        layout = QVBoxLayout(self)

        # Title
        title = QLabel(f"Progress Materi: {self.kategori_nama}")
        title.setFont(QFont('Segoe UI', 14, QFont.Weight.Bold))
        layout.addWidget(title)

        # Table
        self.table = QTableWidget()
        self.table.setColumnCount(5)
        self.table.setHorizontalHeaderLabels(['No', 'Materi', 'Status', 'Nilai', 'Aksi'])
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.Stretch)
        self.table.setAlternatingRowColors(True)
        layout.addWidget(self.table)

        # Quick actions
        action_layout = QHBoxLayout()

        set_all_selesai = QPushButton("Semua Selesai")
        set_all_selesai.setStyleSheet(f"background-color: {COLORS['success']}; color: white; padding: 8px 16px;")
        set_all_selesai.clicked.connect(self._set_all_selesai)
        action_layout.addWidget(set_all_selesai)

        action_layout.addStretch()

        close_btn = QPushButton("Tutup")
        close_btn.clicked.connect(self.accept)
        action_layout.addWidget(close_btn)

        layout.addLayout(action_layout)

    def _load_data(self):
        """Load materi and progress"""
        # Get all materi in kategori
        materi_list = self.session.query(MateriItem).filter(
            MateriItem.kategori_id == self.kategori_id,
            MateriItem.is_aktif == True
        ).order_by(MateriItem.nomor, MateriItem.id).all()

        # Get progress
        progress_map = {
            p.materi_item_id: p
            for p in self.progress_service.get_by_jamaah_kategori(self.jamaah_id, self.kategori_id)
        }

        self.table.setRowCount(len(materi_list))
        self._status_combos = {}

        for row, materi in enumerate(materi_list):
            # No
            self.table.setItem(row, 0, QTableWidgetItem(str(row + 1)))

            # Nama materi
            self.table.setItem(row, 1, QTableWidgetItem(materi.nama_lengkap))

            # Status combo
            progress = progress_map.get(materi.id)
            status_combo = QComboBox()
            status_combo.addItems(['Belum', 'Sedang', 'Selesai', 'Lulus'])

            if progress:
                status_map = {'belum': 0, 'sedang': 1, 'selesai': 2, 'lulus': 3}
                status_combo.setCurrentIndex(status_map.get(progress.status, 0))

            status_combo.setProperty('materi_id', materi.id)
            status_combo.currentIndexChanged.connect(self._on_status_changed)
            self.table.setCellWidget(row, 2, status_combo)
            self._status_combos[materi.id] = status_combo

            # Nilai
            nilai = progress.nilai if progress and progress.nilai else ''
            nilai_item = QTableWidgetItem(str(nilai) if nilai else '-')
            nilai_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            self.table.setItem(row, 3, nilai_item)

            # Aksi
            edit_btn = QPushButton("Edit")
            edit_btn.setProperty('materi_id', materi.id)
            edit_btn.setProperty('materi_nama', materi.nama)
            edit_btn.clicked.connect(self._edit_progress)
            self.table.setCellWidget(row, 4, edit_btn)

    def _on_status_changed(self):
        """Handle status change"""
        combo = self.sender()
        materi_id = combo.property('materi_id')
        status_map = {0: 'belum', 1: 'sedang', 2: 'selesai', 3: 'lulus'}
        status = status_map[combo.currentIndex()]

        try:
            self.progress_service.update_progress(
                self.jamaah_id,
                materi_id,
                status
            )
            self.session.commit()
        except Exception as e:
            self.session.rollback()
            QMessageBox.critical(self, "Error", str(e))

    def _edit_progress(self):
        """Edit progress dengan nilai"""
        btn = self.sender()
        materi_id = btn.property('materi_id')
        materi_nama = btn.property('materi_nama')

        # Get current progress
        progress = self.session.query(ProgressJamaah).filter(
            ProgressJamaah.jamaah_id == self.jamaah_id,
            ProgressJamaah.materi_item_id == materi_id
        ).first()

        dialog = EditProgressDialog(progress, materi_nama, self)
        if dialog.exec():
            data = dialog.get_data()
            try:
                self.progress_service.update_progress(
                    self.jamaah_id,
                    materi_id,
                    data['status'],
                    data.get('nilai'),
                    data.get('catatan')
                )
                self.session.commit()
                self._load_data()
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", str(e))

    def _set_all_selesai(self):
        """Set semua materi ke selesai"""
        reply = QMessageBox.question(
            self,
            "Konfirmasi",
            "Set semua materi ke status Selesai?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )

        if reply == QMessageBox.StandardButton.Yes:
            try:
                for materi_id, combo in self._status_combos.items():
                    self.progress_service.update_progress(
                        self.jamaah_id,
                        materi_id,
                        'selesai'
                    )
                    combo.setCurrentIndex(2)  # Selesai

                self.session.commit()
                QMessageBox.information(self, "Sukses", "Semua materi telah di-set ke Selesai!")
            except Exception as e:
                self.session.rollback()
                QMessageBox.critical(self, "Error", str(e))


class EditProgressDialog(QDialog):
    """Dialog untuk edit progress dengan nilai"""

    def __init__(self, progress: ProgressJamaah, materi_nama: str, parent=None):
        super().__init__(parent)
        self.progress = progress
        self.materi_nama = materi_nama
        self._setup_ui()

    def _setup_ui(self):
        self.setWindowTitle("Edit Progress")
        self.setMinimumWidth(400)
        self.setModal(True)

        layout = QVBoxLayout(self)

        # Title
        title = QLabel(self.materi_nama)
        title.setFont(QFont('Segoe UI', 12, QFont.Weight.Bold))
        layout.addWidget(title)

        # Form
        form_layout = QFormLayout()

        # Status
        self.status_combo = QComboBox()
        self.status_combo.addItems(['Belum', 'Sedang', 'Selesai', 'Lulus'])
        if self.progress:
            status_map = {'belum': 0, 'sedang': 1, 'selesai': 2, 'lulus': 3}
            self.status_combo.setCurrentIndex(status_map.get(self.progress.status, 0))
        form_layout.addRow("Status:", self.status_combo)

        # Nilai
        self.nilai_spin = QSpinBox()
        self.nilai_spin.setRange(0, 100)
        if self.progress and self.progress.nilai:
            self.nilai_spin.setValue(int(self.progress.nilai))
        form_layout.addRow("Nilai (0-100):", self.nilai_spin)

        # Catatan
        self.catatan_edit = QTextEdit()
        self.catatan_edit.setMaximumHeight(80)
        if self.progress and self.progress.catatan:
            self.catatan_edit.setPlainText(self.progress.catatan)
        form_layout.addRow("Catatan:", self.catatan_edit)

        layout.addLayout(form_layout)

        # Buttons
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()

        cancel_btn = QPushButton("Batal")
        cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(cancel_btn)

        save_btn = QPushButton("Simpan")
        save_btn.setStyleSheet(f"background-color: {COLORS['primary']}; color: white;")
        save_btn.clicked.connect(self.accept)
        btn_layout.addWidget(save_btn)

        layout.addLayout(btn_layout)

    def get_data(self) -> dict:
        status_map = {0: 'belum', 1: 'sedang', 2: 'selesai', 3: 'lulus'}
        return {
            'status': status_map[self.status_combo.currentIndex()],
            'nilai': self.nilai_spin.value() if self.nilai_spin.value() > 0 else None,
            'catatan': self.catatan_edit.toPlainText().strip() or None
        }


class PenilaianAkhlaqDialog(QDialog):
    """Dialog untuk input penilaian akhlaq"""

    def __init__(
        self,
        session: Session,
        jamaah_id: int,
        jamaah_nama: str,
        tahun: int,
        bulan: int,
        akhlaq_service: PenilaianAkhlaqService,
        parent=None
    ):
        super().__init__(parent)
        self.session = session
        self.jamaah_id = jamaah_id
        self.jamaah_nama = jamaah_nama
        self.tahun = tahun
        self.bulan = bulan
        self.akhlaq_service = akhlaq_service
        self._setup_ui()
        self._load_data()

    def _setup_ui(self):
        bulan_nama = [
            '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ]
        self.setWindowTitle(f"Penilaian Akhlaq: {self.jamaah_nama}")
        self.setMinimumSize(600, 500)
        self.setModal(True)

        layout = QVBoxLayout(self)

        # Title
        title = QLabel(f"Penilaian Akhlaq - {bulan_nama[self.bulan]} {self.tahun}")
        title.setFont(QFont('Segoe UI', 14, QFont.Weight.Bold))
        layout.addWidget(title)

        subtitle = QLabel(f"Generus: {self.jamaah_nama}")
        subtitle.setStyleSheet(f"color: {COLORS['text_secondary']};")
        layout.addWidget(subtitle)

        # Scroll area for form
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)

        form_widget = QWidget()
        form_layout = QVBoxLayout(form_widget)

        # Aspek groups
        self._radio_groups = {}

        # Ibadah
        ibadah_group = QGroupBox("Penilaian Ibadah")
        ibadah_layout = QGridLayout(ibadah_group)
        ibadah_aspek = [
            ('sholat_wajib', 'Sholat Wajib'),
            ('sholat_jamaah', 'Sholat Berjamaah'),
            ('puasa', 'Puasa'),
            ('tilawah', 'Tilawah')
        ]
        self._add_aspek_grid(ibadah_layout, ibadah_aspek)
        form_layout.addWidget(ibadah_group)

        # Adab
        adab_group = QGroupBox("Penilaian Adab")
        adab_layout = QGridLayout(adab_group)
        adab_aspek = [
            ('birrul_walidain', 'Birrul Walidain'),
            ('adab_makan', 'Adab Makan'),
            ('adab_tidur', 'Adab Tidur'),
            ('adab_berbicara', 'Adab Berbicara')
        ]
        self._add_aspek_grid(adab_layout, adab_aspek)
        form_layout.addWidget(adab_group)

        # Karakter
        karakter_group = QGroupBox("Penilaian Karakter")
        karakter_layout = QGridLayout(karakter_group)
        karakter_aspek = [
            ('kebersihan', 'Kebersihan'),
            ('kedisiplinan', 'Kedisiplinan'),
            ('kejujuran', 'Kejujuran'),
            ('tanggung_jawab', 'Tanggung Jawab')
        ]
        self._add_aspek_grid(karakter_layout, karakter_aspek)
        form_layout.addWidget(karakter_group)

        # Catatan
        catatan_group = QGroupBox("Catatan")
        catatan_layout = QVBoxLayout(catatan_group)
        self.catatan_edit = QTextEdit()
        self.catatan_edit.setMaximumHeight(80)
        catatan_layout.addWidget(self.catatan_edit)
        form_layout.addWidget(catatan_group)

        scroll.setWidget(form_widget)
        layout.addWidget(scroll, 1)

        # Buttons
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()

        cancel_btn = QPushButton("Batal")
        cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(cancel_btn)

        save_btn = QPushButton("Simpan")
        save_btn.setStyleSheet(f"background-color: {COLORS['primary']}; color: white;")
        save_btn.clicked.connect(self._save)
        btn_layout.addWidget(save_btn)

        layout.addLayout(btn_layout)

    def _add_aspek_grid(self, layout: QGridLayout, aspek_list: list):
        """Add aspek items to grid layout"""
        # Header
        layout.addWidget(QLabel("Aspek"), 0, 0)
        for col, nilai in enumerate(['A', 'B', 'C', 'D'], start=1):
            label = QLabel(nilai)
            label.setAlignment(Qt.AlignmentFlag.AlignCenter)
            layout.addWidget(label, 0, col)

        for row, (key, label) in enumerate(aspek_list, start=1):
            layout.addWidget(QLabel(label), row, 0)

            button_group = QButtonGroup(self)
            self._radio_groups[key] = button_group

            for col, nilai in enumerate(['A', 'B', 'C', 'D'], start=1):
                radio = QRadioButton()
                radio.setProperty('nilai', nilai)
                button_group.addButton(radio, col)

                container = QWidget()
                container_layout = QHBoxLayout(container)
                container_layout.setContentsMargins(0, 0, 0, 0)
                container_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)
                container_layout.addWidget(radio)

                layout.addWidget(container, row, col)

    def _load_data(self):
        """Load existing penilaian"""
        penilaian = self.session.query(PenilaianAkhlaq).filter(
            PenilaianAkhlaq.jamaah_id == self.jamaah_id,
            PenilaianAkhlaq.periode_tahun == self.tahun,
            PenilaianAkhlaq.periode_bulan == self.bulan
        ).first()

        if penilaian:
            for key, group in self._radio_groups.items():
                nilai = getattr(penilaian, key, None)
                if nilai:
                    nilai_map = {'A': 1, 'B': 2, 'C': 3, 'D': 4}
                    button = group.button(nilai_map.get(nilai, 0))
                    if button:
                        button.setChecked(True)

            if penilaian.catatan:
                self.catatan_edit.setPlainText(penilaian.catatan)

    def _save(self):
        """Save penilaian"""
        nilai_dict = {}
        for key, group in self._radio_groups.items():
            checked = group.checkedButton()
            if checked:
                nilai_dict[key] = checked.property('nilai')

        nilai_dict['catatan'] = self.catatan_edit.toPlainText().strip() or None

        try:
            self.akhlaq_service.update_nilai(
                self.jamaah_id,
                self.tahun,
                self.bulan,
                nilai_dict
            )
            self.session.commit()
            self.accept()
        except Exception as e:
            self.session.rollback()
            QMessageBox.critical(self, "Error", str(e))


class SelectGenerusDialog(QDialog):
    """Dialog untuk memilih generus"""

    def __init__(self, generus_list: list, parent=None):
        super().__init__(parent)
        self.generus_list = generus_list
        self._selected = None
        self._setup_ui()

    def _setup_ui(self):
        self.setWindowTitle("Pilih Generus")
        self.setMinimumSize(400, 300)
        self.setModal(True)

        layout = QVBoxLayout(self)

        # Search
        self.search_edit = QComboBox()
        self.search_edit.setEditable(True)
        self.search_edit.setMinimumWidth(350)
        self.search_edit.addItem("-- Pilih Generus --", None)
        for g in self.generus_list:
            self.search_edit.addItem(g.nama, g)
        layout.addWidget(self.search_edit)

        layout.addStretch()

        # Buttons
        btn_layout = QHBoxLayout()
        btn_layout.addStretch()

        cancel_btn = QPushButton("Batal")
        cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(cancel_btn)

        select_btn = QPushButton("Pilih")
        select_btn.setStyleSheet(f"background-color: {COLORS['primary']}; color: white;")
        select_btn.clicked.connect(self._on_select)
        btn_layout.addWidget(select_btn)

        layout.addLayout(btn_layout)

    def _on_select(self):
        self._selected = self.search_edit.currentData()
        if self._selected:
            self.accept()
        else:
            QMessageBox.warning(self, "Peringatan", "Pilih generus terlebih dahulu!")

    def get_selected(self):
        return self._selected
