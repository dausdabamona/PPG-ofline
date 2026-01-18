"""
Pengaturan Page - Halaman pengaturan aplikasi dengan Import/Export Excel
"""
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QGroupBox, QComboBox, QFileDialog, QMessageBox, QProgressBar,
    QTabWidget, QScrollArea, QFrame, QGridLayout, QCheckBox,
    QLineEdit, QSpinBox, QTextEdit
)
from PyQt6.QtCore import Qt, QThread, pyqtSignal
from PyQt6.QtGui import QFont
from sqlalchemy.orm import Session
from datetime import datetime
import os

from .base_page import BasePage
from services.excel_service import ExcelService
from database.models import Wilayah, Jenjang
from config import COLORS, DATA_DIR


class ExportWorker(QThread):
    """Worker thread for export operations"""
    finished = pyqtSignal(bool, str)
    progress = pyqtSignal(int)

    def __init__(self, excel_service: ExcelService, export_type: str, filepath: str, **kwargs):
        super().__init__()
        self.excel_service = excel_service
        self.export_type = export_type
        self.filepath = filepath
        self.kwargs = kwargs

    def run(self):
        try:
            self.progress.emit(30)

            if self.export_type == 'all':
                success = self.excel_service.export_all(self.filepath)
            elif self.export_type == 'jamaah':
                success = self.excel_service.export_jamaah(
                    self.filepath,
                    wilayah_id=self.kwargs.get('wilayah_id')
                )
            elif self.export_type == 'wilayah':
                success = self.excel_service.export_wilayah(self.filepath)
            elif self.export_type == 'kurikulum':
                success = self.excel_service.export_kurikulum(self.filepath)
            elif self.export_type == 'pengajian':
                success = self.excel_service.export_pengajian(self.filepath)
            elif self.export_type == 'presensi':
                success = self.excel_service.export_presensi(self.filepath)
            else:
                success = False

            self.progress.emit(100)
            self.finished.emit(success, self.filepath if success else "Export gagal")
        except Exception as e:
            self.finished.emit(False, str(e))


class ImportWorker(QThread):
    """Worker thread for import operations"""
    finished = pyqtSignal(bool, str, dict)
    progress = pyqtSignal(int)

    def __init__(self, excel_service: ExcelService, import_type: str, filepath: str):
        super().__init__()
        self.excel_service = excel_service
        self.import_type = import_type
        self.filepath = filepath

    def run(self):
        try:
            self.progress.emit(30)

            if self.import_type == 'all':
                result = self.excel_service.import_all(self.filepath)
            elif self.import_type == 'jamaah':
                result = self.excel_service.import_jamaah(self.filepath)
            elif self.import_type == 'wilayah':
                result = self.excel_service.import_wilayah(self.filepath)
            elif self.import_type == 'kurikulum':
                result = self.excel_service.import_kurikulum(self.filepath)
            else:
                result = {'success': False, 'errors': ['Tipe import tidak valid']}

            self.progress.emit(100)
            self.finished.emit(result.get('success', False), "", result)
        except Exception as e:
            self.finished.emit(False, str(e), {})


class PengaturanPage(BasePage):
    """Halaman pengaturan aplikasi"""

    def __init__(self, session: Session, parent=None):
        super().__init__(session, parent)
        self.excel_service = ExcelService(session)
        self._worker = None
        self._setup_ui()

    def _setup_ui(self):
        """Setup UI components"""
        self.set_header("Pengaturan", "Import/Export data dan konfigurasi aplikasi")

        # Create tab widget
        tabs = QTabWidget()
        tabs.setStyleSheet(f"""
            QTabWidget::pane {{
                border: 1px solid {COLORS['border']};
                background: {COLORS['surface']};
                border-radius: 8px;
            }}
            QTabBar::tab {{
                background: {COLORS['bg_tertiary']};
                color: {COLORS['text_secondary']};
                padding: 10px 20px;
                margin-right: 2px;
                border-top-left-radius: 8px;
                border-top-right-radius: 8px;
            }}
            QTabBar::tab:selected {{
                background: {COLORS['primary']};
                color: white;
            }}
        """)

        # Tab 1: Export Data
        tabs.addTab(self._create_export_tab(), "Export Data")

        # Tab 2: Import Data
        tabs.addTab(self._create_import_tab(), "Import Data")

        # Tab 3: Backup & Restore
        tabs.addTab(self._create_backup_tab(), "Backup & Restore")

        # Tab 4: Pengaturan Umum
        tabs.addTab(self._create_settings_tab(), "Pengaturan Umum")

        self.content_layout.addWidget(tabs)

    def _create_export_tab(self) -> QWidget:
        """Create export tab"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setSpacing(16)

        # === Export Semua Data ===
        all_group = self._create_group_box("Export Semua Data (Backup Lengkap)")
        all_layout = QVBoxLayout(all_group)

        desc = QLabel("Export semua data ke satu file Excel dengan multiple sheets.\n"
                      "Cocok untuk backup lengkap atau migrasi data.")
        desc.setStyleSheet(f"color: {COLORS['text_secondary']}; margin-bottom: 10px;")
        all_layout.addWidget(desc)

        btn_export_all = QPushButton("Export Semua Data")
        btn_export_all.setStyleSheet(self._get_primary_button_style())
        btn_export_all.clicked.connect(lambda: self._do_export('all'))
        all_layout.addWidget(btn_export_all)

        layout.addWidget(all_group)

        # === Export Per Modul ===
        module_group = self._create_group_box("Export Per Modul")
        module_layout = QGridLayout(module_group)

        modules = [
            ("Data Generus", "jamaah", "Export data jamaah/generus"),
            ("Data Wilayah", "wilayah", "Export struktur wilayah"),
            ("Kurikulum", "kurikulum", "Export bidang, kategori, dan materi"),
            ("Pengajian", "pengajian", "Export data sesi pengajian"),
            ("Presensi", "presensi", "Export data kehadiran"),
        ]

        for idx, (label, key, tooltip) in enumerate(modules):
            row = idx // 2
            col = (idx % 2) * 2

            lbl = QLabel(label)
            lbl.setToolTip(tooltip)
            module_layout.addWidget(lbl, row, col)

            btn = QPushButton("Export")
            btn.setStyleSheet(self._get_secondary_button_style())
            btn.clicked.connect(lambda checked, k=key: self._do_export(k))
            module_layout.addWidget(btn, row, col + 1)

        layout.addWidget(module_group)

        # === Export Generus Per Kelompok ===
        kelompok_group = self._create_group_box("Export Generus Per Kelompok")
        kelompok_layout = QHBoxLayout(kelompok_group)

        kelompok_layout.addWidget(QLabel("Pilih Kelompok:"))

        self.export_wilayah_combo = QComboBox()
        self.export_wilayah_combo.setMinimumWidth(250)
        self._load_wilayah_combo(self.export_wilayah_combo)
        kelompok_layout.addWidget(self.export_wilayah_combo)

        btn_export_kelompok = QPushButton("Export")
        btn_export_kelompok.setStyleSheet(self._get_secondary_button_style())
        btn_export_kelompok.clicked.connect(self._export_generus_kelompok)
        kelompok_layout.addWidget(btn_export_kelompok)

        kelompok_layout.addStretch()

        layout.addWidget(kelompok_group)

        # Progress bar
        self.export_progress = QProgressBar()
        self.export_progress.setVisible(False)
        layout.addWidget(self.export_progress)

        layout.addStretch()
        return widget

    def _create_import_tab(self) -> QWidget:
        """Create import tab"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setSpacing(16)

        # Warning
        warning = QLabel("⚠️ PERHATIAN: Import data akan menambah/memperbarui data yang ada. "
                         "Pastikan file Excel sesuai format yang benar.")
        warning.setStyleSheet(f"""
            background: #fef3c7;
            color: #92400e;
            padding: 12px;
            border-radius: 8px;
            font-weight: bold;
        """)
        warning.setWordWrap(True)
        layout.addWidget(warning)

        # === Import Semua Data ===
        all_group = self._create_group_box("Import Semua Data (Restore Backup)")
        all_layout = QVBoxLayout(all_group)

        desc = QLabel("Import data dari file backup Excel (hasil export semua data).\n"
                      "Data akan ditambahkan jika belum ada, atau diperbarui jika sync_id cocok.")
        desc.setStyleSheet(f"color: {COLORS['text_secondary']}; margin-bottom: 10px;")
        all_layout.addWidget(desc)

        btn_import_all = QPushButton("Import Semua Data")
        btn_import_all.setStyleSheet(self._get_primary_button_style())
        btn_import_all.clicked.connect(lambda: self._do_import('all'))
        all_layout.addWidget(btn_import_all)

        layout.addWidget(all_group)

        # === Import Per Modul ===
        module_group = self._create_group_box("Import Per Modul")
        module_layout = QGridLayout(module_group)

        modules = [
            ("Data Generus", "jamaah", "Import data jamaah/generus"),
            ("Data Wilayah", "wilayah", "Import struktur wilayah"),
            ("Kurikulum", "kurikulum", "Import bidang, kategori, dan materi"),
        ]

        for idx, (label, key, tooltip) in enumerate(modules):
            row = idx // 2
            col = (idx % 2) * 3

            lbl = QLabel(label)
            lbl.setToolTip(tooltip)
            module_layout.addWidget(lbl, row, col)

            btn_import = QPushButton("Import")
            btn_import.setStyleSheet(self._get_secondary_button_style())
            btn_import.clicked.connect(lambda checked, k=key: self._do_import(k))
            module_layout.addWidget(btn_import, row, col + 1)

            btn_template = QPushButton("Template")
            btn_template.setStyleSheet(self._get_outline_button_style())
            btn_template.clicked.connect(lambda checked, k=key: self._download_template(k))
            module_layout.addWidget(btn_template, row, col + 2)

        layout.addWidget(module_group)

        # Progress bar
        self.import_progress = QProgressBar()
        self.import_progress.setVisible(False)
        layout.addWidget(self.import_progress)

        # Import result
        self.import_result = QTextEdit()
        self.import_result.setReadOnly(True)
        self.import_result.setMaximumHeight(150)
        self.import_result.setVisible(False)
        self.import_result.setStyleSheet(f"""
            QTextEdit {{
                background: {COLORS['bg_tertiary']};
                border: 1px solid {COLORS['border']};
                border-radius: 8px;
                padding: 8px;
                font-family: monospace;
            }}
        """)
        layout.addWidget(self.import_result)

        layout.addStretch()
        return widget

    def _create_backup_tab(self) -> QWidget:
        """Create backup & restore tab"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setSpacing(16)

        # === Backup Database ===
        backup_group = self._create_group_box("Backup Database")
        backup_layout = QVBoxLayout(backup_group)

        desc = QLabel("Backup seluruh database SQLite ke file .ppg\n"
                      "File backup bisa dikirim via WhatsApp untuk sinkronisasi dengan device lain.")
        desc.setStyleSheet(f"color: {COLORS['text_secondary']}; margin-bottom: 10px;")
        backup_layout.addWidget(desc)

        btn_row = QHBoxLayout()

        btn_backup = QPushButton("Backup Database (.ppg)")
        btn_backup.setStyleSheet(self._get_primary_button_style())
        btn_backup.clicked.connect(self._backup_database)
        btn_row.addWidget(btn_backup)

        btn_backup_excel = QPushButton("Backup ke Excel (.xlsx)")
        btn_backup_excel.setStyleSheet(self._get_secondary_button_style())
        btn_backup_excel.clicked.connect(lambda: self._do_export('all'))
        btn_row.addWidget(btn_backup_excel)

        btn_row.addStretch()
        backup_layout.addLayout(btn_row)

        layout.addWidget(backup_group)

        # === Restore Database ===
        restore_group = self._create_group_box("Restore Database")
        restore_layout = QVBoxLayout(restore_group)

        warning = QLabel("⚠️ Restore akan mengganti seluruh database!\n"
                         "Pastikan backup data yang ada terlebih dahulu.")
        warning.setStyleSheet(f"""
            background: #fee2e2;
            color: #991b1b;
            padding: 12px;
            border-radius: 8px;
        """)
        restore_layout.addWidget(warning)

        btn_restore = QPushButton("Restore dari File .ppg")
        btn_restore.setStyleSheet(f"""
            QPushButton {{
                background: #dc2626;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-weight: bold;
            }}
            QPushButton:hover {{
                background: #b91c1c;
            }}
        """)
        btn_restore.clicked.connect(self._restore_database)
        restore_layout.addWidget(btn_restore)

        layout.addWidget(restore_group)

        # === Auto Backup ===
        auto_group = self._create_group_box("Auto Backup")
        auto_layout = QGridLayout(auto_group)

        self.auto_backup_check = QCheckBox("Aktifkan auto backup")
        auto_layout.addWidget(self.auto_backup_check, 0, 0, 1, 2)

        auto_layout.addWidget(QLabel("Interval (hari):"), 1, 0)
        self.backup_interval = QSpinBox()
        self.backup_interval.setRange(1, 30)
        self.backup_interval.setValue(7)
        auto_layout.addWidget(self.backup_interval, 1, 1)

        auto_layout.addWidget(QLabel("Simpan di:"), 2, 0)
        self.backup_path = QLineEdit()
        self.backup_path.setText(os.path.join(DATA_DIR, "backups"))
        self.backup_path.setReadOnly(True)
        auto_layout.addWidget(self.backup_path, 2, 1)

        btn_browse = QPushButton("Browse")
        btn_browse.clicked.connect(self._browse_backup_path)
        auto_layout.addWidget(btn_browse, 2, 2)

        layout.addWidget(auto_group)

        layout.addStretch()
        return widget

    def _create_settings_tab(self) -> QWidget:
        """Create settings tab"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        layout.setSpacing(16)

        # === Pengaturan Aplikasi ===
        app_group = self._create_group_box("Pengaturan Aplikasi")
        app_layout = QGridLayout(app_group)

        app_layout.addWidget(QLabel("Nama Daerah:"), 0, 0)
        self.daerah_name = QLineEdit()
        self.daerah_name.setPlaceholderText("Contoh: PPG Sorong")
        app_layout.addWidget(self.daerah_name, 0, 1)

        app_layout.addWidget(QLabel("Tahun Ajaran Aktif:"), 1, 0)
        self.tahun_ajaran_combo = QComboBox()
        self.tahun_ajaran_combo.addItem("2024/2025")
        self.tahun_ajaran_combo.addItem("2025/2026")
        app_layout.addWidget(self.tahun_ajaran_combo, 1, 1)

        layout.addWidget(app_group)

        # === Info Database ===
        db_group = self._create_group_box("Informasi Database")
        db_layout = QGridLayout(db_group)

        stats = self._get_database_stats()
        row = 0
        for label, value in stats.items():
            db_layout.addWidget(QLabel(f"{label}:"), row, 0)
            val_label = QLabel(str(value))
            val_label.setStyleSheet(f"font-weight: bold; color: {COLORS['primary']};")
            db_layout.addWidget(val_label, row, 1)
            row += 1

        btn_refresh = QPushButton("Refresh")
        btn_refresh.clicked.connect(self.refresh)
        db_layout.addWidget(btn_refresh, row, 0, 1, 2)

        layout.addWidget(db_group)

        # === Tentang Aplikasi ===
        about_group = self._create_group_box("Tentang Aplikasi")
        about_layout = QVBoxLayout(about_group)

        about_text = """
<h3>Sistem Manajemen PPG Sorong</h3>
<p>Aplikasi desktop untuk manajemen data PPG (Pendidikan Pengajian Generus)</p>
<p><b>Versi:</b> 1.0.0</p>
<p><b>Teknologi:</b> Python, PyQt6, SQLite</p>
<p><b>Dikembangkan untuk:</b> PPG Daerah Sorong</p>
        """
        about_label = QLabel(about_text)
        about_label.setTextFormat(Qt.TextFormat.RichText)
        about_layout.addWidget(about_label)

        layout.addWidget(about_group)

        layout.addStretch()
        return widget

    def _create_group_box(self, title: str) -> QGroupBox:
        """Create styled group box"""
        group = QGroupBox(title)
        group.setStyleSheet(f"""
            QGroupBox {{
                font-weight: bold;
                font-size: 14px;
                border: 1px solid {COLORS['border']};
                border-radius: 8px;
                margin-top: 12px;
                padding-top: 12px;
                background: {COLORS['surface']};
            }}
            QGroupBox::title {{
                subcontrol-origin: margin;
                left: 16px;
                padding: 0 8px;
                color: {COLORS['primary']};
            }}
        """)
        return group

    def _get_primary_button_style(self) -> str:
        return f"""
            QPushButton {{
                background: {COLORS['primary']};
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-weight: bold;
                font-size: 13px;
            }}
            QPushButton:hover {{
                background: {COLORS['primary_dark']};
            }}
            QPushButton:disabled {{
                background: {COLORS['bg_tertiary']};
                color: {COLORS['text_disabled']};
            }}
        """

    def _get_secondary_button_style(self) -> str:
        return f"""
            QPushButton {{
                background: {COLORS['bg_tertiary']};
                color: {COLORS['text_primary']};
                border: 1px solid {COLORS['border']};
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 12px;
            }}
            QPushButton:hover {{
                background: {COLORS['border']};
            }}
        """

    def _get_outline_button_style(self) -> str:
        return f"""
            QPushButton {{
                background: transparent;
                color: {COLORS['primary']};
                border: 1px solid {COLORS['primary']};
                padding: 8px 16px;
                border-radius: 6px;
                font-size: 12px;
            }}
            QPushButton:hover {{
                background: {COLORS['primary']};
                color: white;
            }}
        """

    def _load_wilayah_combo(self, combo: QComboBox):
        """Load wilayah ke combo box"""
        combo.clear()
        combo.addItem("-- Semua Wilayah --", None)

        # Group by tingkat
        for tingkat in ['daerah', 'desa', 'kelompok']:
            wilayah_list = self.session.query(Wilayah).filter(
                Wilayah.tingkat == tingkat,
                Wilayah.is_aktif == True
            ).order_by(Wilayah.nama).all()

            for w in wilayah_list:
                prefix = "  " if tingkat == 'desa' else "    " if tingkat == 'kelompok' else ""
                combo.addItem(f"{prefix}{w.nama} ({tingkat})", w.id)

    def _get_database_stats(self) -> dict:
        """Get database statistics"""
        from database.models import Jamaah, Enrollment, Pengajian, KeaktifanPengajian

        stats = {}
        try:
            stats['Total Jamaah'] = self.session.query(Jamaah).count()
            stats['Jamaah Aktif'] = self.session.query(Jamaah).filter(Jamaah.status_aktif == True).count()
            stats['Generus (Belum Menikah)'] = self.session.query(Jamaah).filter(
                Jamaah.status_pernikahan == 'belum_menikah',
                Jamaah.status_aktif == True
            ).count()
            stats['Total Wilayah'] = self.session.query(Wilayah).count()
            stats['Kelompok Aktif'] = self.session.query(Wilayah).filter(
                Wilayah.tingkat == 'kelompok',
                Wilayah.is_aktif == True
            ).count()
            stats['Total Pengajian'] = self.session.query(Pengajian).count()
            stats['Total Presensi'] = self.session.query(KeaktifanPengajian).count()
        except Exception as e:
            stats['Error'] = str(e)

        return stats

    def _do_export(self, export_type: str):
        """Execute export operation"""
        # Get save path
        default_name = f"ppg_export_{export_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        filepath, _ = QFileDialog.getSaveFileName(
            self,
            f"Export {export_type.title()}",
            os.path.join(DATA_DIR, default_name),
            "Excel Files (*.xlsx)"
        )

        if not filepath:
            return

        # Show progress
        self.export_progress.setVisible(True)
        self.export_progress.setValue(0)

        # Start worker
        self._worker = ExportWorker(self.excel_service, export_type, filepath)
        self._worker.progress.connect(self.export_progress.setValue)
        self._worker.finished.connect(self._on_export_finished)
        self._worker.start()

    def _on_export_finished(self, success: bool, message: str):
        """Handle export finished"""
        self.export_progress.setVisible(False)

        if success:
            QMessageBox.information(
                self,
                "Export Berhasil",
                f"Data berhasil di-export ke:\n{message}"
            )
        else:
            QMessageBox.warning(
                self,
                "Export Gagal",
                f"Terjadi kesalahan:\n{message}"
            )

    def _export_generus_kelompok(self):
        """Export generus per kelompok"""
        wilayah_id = self.export_wilayah_combo.currentData()

        # Get save path
        wilayah_name = self.export_wilayah_combo.currentText().strip()
        default_name = f"generus_{wilayah_name.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d')}.xlsx"
        filepath, _ = QFileDialog.getSaveFileName(
            self,
            "Export Generus Per Kelompok",
            os.path.join(DATA_DIR, default_name),
            "Excel Files (*.xlsx)"
        )

        if not filepath:
            return

        # Show progress
        self.export_progress.setVisible(True)
        self.export_progress.setValue(0)

        # Start worker
        self._worker = ExportWorker(
            self.excel_service, 'jamaah', filepath,
            wilayah_id=wilayah_id
        )
        self._worker.progress.connect(self.export_progress.setValue)
        self._worker.finished.connect(self._on_export_finished)
        self._worker.start()

    def _do_import(self, import_type: str):
        """Execute import operation"""
        # Confirm
        reply = QMessageBox.question(
            self,
            "Konfirmasi Import",
            f"Yakin ingin import data {import_type}?\n"
            "Data yang sudah ada akan diperbarui jika sync_id cocok.",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )

        if reply != QMessageBox.StandardButton.Yes:
            return

        # Get file path
        filepath, _ = QFileDialog.getOpenFileName(
            self,
            f"Import {import_type.title()}",
            DATA_DIR,
            "Excel Files (*.xlsx *.xls)"
        )

        if not filepath:
            return

        # Show progress
        self.import_progress.setVisible(True)
        self.import_progress.setValue(0)
        self.import_result.setVisible(False)

        # Start worker
        self._worker = ImportWorker(self.excel_service, import_type, filepath)
        self._worker.progress.connect(self.import_progress.setValue)
        self._worker.finished.connect(self._on_import_finished)
        self._worker.start()

    def _on_import_finished(self, success: bool, error: str, result: dict):
        """Handle import finished"""
        self.import_progress.setVisible(False)
        self.import_result.setVisible(True)

        if success:
            text = "Import berhasil!\n\n"
            if 'imported' in result:
                if isinstance(result['imported'], dict):
                    for key, count in result['imported'].items():
                        text += f"- {key}: {count} data\n"
                else:
                    text += f"- Total: {result['imported']} data\n"

            if result.get('skipped'):
                text += f"\nDiskip: {result['skipped']} baris\n"

            if result.get('errors'):
                text += f"\nErrors ({len(result['errors'])}):\n"
                for err in result['errors'][:5]:  # Show first 5 errors
                    text += f"  - {err}\n"
                if len(result['errors']) > 5:
                    text += f"  ... dan {len(result['errors']) - 5} error lainnya\n"

            self.import_result.setText(text)
            QMessageBox.information(self, "Import Berhasil", "Data berhasil diimport!")
        else:
            self.import_result.setText(f"Import gagal!\n\n{error}\n\n{result.get('errors', [])}")
            QMessageBox.warning(self, "Import Gagal", f"Terjadi kesalahan:\n{error}")

    def _download_template(self, module: str):
        """Download template Excel for import"""
        default_name = f"template_{module}.xlsx"
        filepath, _ = QFileDialog.getSaveFileName(
            self,
            f"Download Template {module.title()}",
            os.path.join(DATA_DIR, default_name),
            "Excel Files (*.xlsx)"
        )

        if not filepath:
            return

        success = self.excel_service.get_template(module, filepath)

        if success:
            QMessageBox.information(
                self,
                "Template Berhasil Dibuat",
                f"Template tersimpan di:\n{filepath}"
            )
        else:
            QMessageBox.warning(
                self,
                "Gagal Membuat Template",
                "Terjadi kesalahan saat membuat template."
            )

    def _backup_database(self):
        """Backup database to .ppg file"""
        from services.sync_service import SyncService

        default_name = f"backup_ppg_{datetime.now().strftime('%Y%m%d_%H%M%S')}.ppg"
        filepath, _ = QFileDialog.getSaveFileName(
            self,
            "Backup Database",
            os.path.join(DATA_DIR, default_name),
            "PPG Backup Files (*.ppg)"
        )

        if not filepath:
            return

        try:
            sync_service = SyncService(self.session)
            success = sync_service.create_backup(filepath)

            if success:
                QMessageBox.information(
                    self,
                    "Backup Berhasil",
                    f"Database berhasil dibackup ke:\n{filepath}\n\n"
                    "File ini bisa dikirim via WhatsApp untuk sync."
                )
            else:
                QMessageBox.warning(self, "Backup Gagal", "Terjadi kesalahan saat backup.")
        except Exception as e:
            QMessageBox.warning(self, "Backup Gagal", f"Error: {str(e)}")

    def _restore_database(self):
        """Restore database from .ppg file"""
        # Double confirm
        reply = QMessageBox.warning(
            self,
            "Peringatan!",
            "Restore akan MENGGANTI SELURUH database yang ada!\n\n"
            "Pastikan Anda sudah backup data yang ada.\n\n"
            "Lanjutkan?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )

        if reply != QMessageBox.StandardButton.Yes:
            return

        filepath, _ = QFileDialog.getOpenFileName(
            self,
            "Restore Database",
            DATA_DIR,
            "PPG Backup Files (*.ppg)"
        )

        if not filepath:
            return

        try:
            from services.sync_service import SyncService
            sync_service = SyncService(self.session)
            success = sync_service.restore_backup(filepath)

            if success:
                QMessageBox.information(
                    self,
                    "Restore Berhasil",
                    "Database berhasil di-restore.\n\n"
                    "Aplikasi akan di-restart."
                )
                # TODO: Restart application
            else:
                QMessageBox.warning(self, "Restore Gagal", "Terjadi kesalahan saat restore.")
        except Exception as e:
            QMessageBox.warning(self, "Restore Gagal", f"Error: {str(e)}")

    def _browse_backup_path(self):
        """Browse backup folder"""
        folder = QFileDialog.getExistingDirectory(
            self,
            "Pilih Folder Backup",
            self.backup_path.text()
        )
        if folder:
            self.backup_path.setText(folder)

    def refresh(self):
        """Refresh page data"""
        self._load_wilayah_combo(self.export_wilayah_combo)
