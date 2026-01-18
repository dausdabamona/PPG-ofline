"""
Main Window - Window utama aplikasi
"""
from PyQt6.QtWidgets import (
    QMainWindow, QWidget, QHBoxLayout, QStackedWidget,
    QMessageBox, QStatusBar, QLabel
)
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QCloseEvent
from sqlalchemy.orm import Session

from .components.sidebar import Sidebar
from .pages.dashboard_page import DashboardPage
from .pages.generus_page import GenerusPage
from .pages.wilayah_page import WilayahPage
from .pages.kurikulum_page import KurikulumPage
from .pages.pengajian_page import PengajianPage
from .pages.presensi_page import PresensiPage
from .pages.penilaian_page import PenilaianPage
from .pages.laporan_page import LaporanPage
from .pages.pengaturan_page import PengaturanPage
from .pages.base_page import BasePage
from .styles.theme import MAIN_STYLESHEET
from config import APP_NAME, APP_VERSION, COLORS, WINDOW_MIN_WIDTH, WINDOW_MIN_HEIGHT


class PlaceholderPage(BasePage):
    """Placeholder untuk halaman yang belum diimplementasi"""
    def __init__(self, title: str, session: Session, parent=None):
        super().__init__(session, parent)
        self.set_header(title, "Halaman ini sedang dalam pengembangan")


class MainWindow(QMainWindow):
    """
    Window utama aplikasi PPG Sorong
    """

    def __init__(self, session: Session):
        super().__init__()
        self.session = session
        self._current_page = None
        self._pages = {}

        self._setup_ui()
        self._setup_pages()
        self._connect_signals()

        # Show dashboard by default
        self._show_page('dashboard')

    def _setup_ui(self):
        """Setup UI utama"""
        self.setWindowTitle(f"{APP_NAME} v{APP_VERSION}")
        self.setMinimumSize(WINDOW_MIN_WIDTH, WINDOW_MIN_HEIGHT)

        # Apply stylesheet
        self.setStyleSheet(MAIN_STYLESHEET)

        # Central widget
        central = QWidget()
        self.setCentralWidget(central)

        # Main layout
        layout = QHBoxLayout(central)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Sidebar
        self.sidebar = Sidebar()
        layout.addWidget(self.sidebar)

        # Content area
        self.content = QStackedWidget()
        self.content.setObjectName("contentArea")
        layout.addWidget(self.content, 1)

        # Status bar
        self._setup_status_bar()

    def _setup_status_bar(self):
        """Setup status bar"""
        status_bar = QStatusBar()
        self.setStatusBar(status_bar)

        # Version info
        version_label = QLabel(f"v{APP_VERSION}")
        version_label.setStyleSheet(f"color: {COLORS['text_secondary']}; padding: 4px 8px;")
        status_bar.addPermanentWidget(version_label)

        # Status message
        self.status_message = QLabel("Siap")
        status_bar.addWidget(self.status_message)

    def _setup_pages(self):
        """Setup semua halaman"""
        # Dashboard
        self._pages['dashboard'] = DashboardPage(self.session)
        self.content.addWidget(self._pages['dashboard'])

        # Generus
        self._pages['generus'] = GenerusPage(self.session)
        self.content.addWidget(self._pages['generus'])

        # Wilayah
        self._pages['wilayah'] = WilayahPage(self.session)
        self.content.addWidget(self._pages['wilayah'])

        # Kurikulum
        self._pages['kurikulum'] = KurikulumPage(self.session)
        self.content.addWidget(self._pages['kurikulum'])

        # Pengajian
        self._pages['pengajian'] = PengajianPage(self.session)
        self.content.addWidget(self._pages['pengajian'])

        # Presensi
        self._pages['presensi'] = PresensiPage(self.session)
        self.content.addWidget(self._pages['presensi'])

        # Penilaian
        self._pages['penilaian'] = PenilaianPage(self.session)
        self.content.addWidget(self._pages['penilaian'])

        # Laporan
        self._pages['laporan'] = LaporanPage(self.session)
        self.content.addWidget(self._pages['laporan'])

        # Pengaturan (Import/Export Excel)
        self._pages['settings'] = PengaturanPage(self.session)
        self.content.addWidget(self._pages['settings'])

        # Placeholder page for sync (akan diimplementasi saat mobile app)
        placeholders = [
            ('sync', 'Sinkronisasi'),
        ]

        for key, title in placeholders:
            page = PlaceholderPage(title, self.session)
            self._pages[key] = page
            self.content.addWidget(page)

    def _connect_signals(self):
        """Connect signals"""
        self.sidebar.page_changed.connect(self._show_page)

    def _show_page(self, page_key: str):
        """Show page by key"""
        if page_key not in self._pages:
            return

        # Hide current page
        if self._current_page and hasattr(self._pages.get(self._current_page), 'on_hide'):
            self._pages[self._current_page].on_hide()

        # Show new page
        self._current_page = page_key
        page = self._pages[page_key]
        self.content.setCurrentWidget(page)
        self.sidebar.set_current_page(page_key)

        # Trigger on_show
        if hasattr(page, 'on_show'):
            page.on_show()

        # Update status
        self.status_message.setText(f"Halaman: {page_key.title()}")

    def refresh_current_page(self):
        """Refresh halaman saat ini"""
        if self._current_page and self._current_page in self._pages:
            self._pages[self._current_page].refresh()

    def get_current_page(self) -> str:
        """Get current page key"""
        return self._current_page

    def set_status(self, message: str):
        """Set status bar message"""
        self.status_message.setText(message)

    def closeEvent(self, event: QCloseEvent):
        """Handle window close"""
        reply = QMessageBox.question(
            self,
            "Konfirmasi Keluar",
            "Yakin ingin keluar dari aplikasi?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No
        )

        if reply == QMessageBox.StandardButton.Yes:
            # Cleanup
            try:
                self.session.commit()
            except:
                self.session.rollback()
            finally:
                self.session.close()
            event.accept()
        else:
            event.ignore()
