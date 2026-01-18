"""
Sidebar Component - Navigation menu
"""
from PyQt6.QtWidgets import (
    QFrame, QVBoxLayout, QPushButton, QLabel, QWidget, QSpacerItem, QSizePolicy
)
from PyQt6.QtCore import pyqtSignal, Qt
from PyQt6.QtGui import QIcon

from config import COLORS, APP_NAME


class Sidebar(QFrame):
    """
    Sidebar navigation component
    """
    page_changed = pyqtSignal(str)

    MENU_ITEMS = [
        ('dashboard', 'Dashboard', 'dashboard'),
        ('generus', 'Data Generus', 'generus'),
        ('pengajian', 'Pengajian', 'pengajian'),
        ('presensi', 'Presensi', 'presensi'),
        ('penilaian', 'Penilaian', 'penilaian'),
        ('kurikulum', 'Kurikulum', 'kurikulum'),
        ('wilayah', 'Wilayah', 'wilayah'),
        ('laporan', 'Laporan', 'laporan'),
        ('sync', 'Sinkronisasi', 'sync'),
        ('settings', 'Pengaturan', 'settings'),
    ]

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("sidebar")
        self.setFixedWidth(250)
        self._buttons = {}
        self._current_page = None
        self._setup_ui()

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Logo
        logo = QLabel(APP_NAME)
        logo.setObjectName("sidebarLogo")
        logo.setAlignment(Qt.AlignmentFlag.AlignCenter)
        logo.setStyleSheet(f"""
            padding: 24px 20px;
            color: white;
            font-size: 20px;
            font-weight: bold;
            background-color: {COLORS['primary']};
        """)
        layout.addWidget(logo)

        # Menu items
        for key, label, _ in self.MENU_ITEMS:
            btn = QPushButton(f"  {label}")
            btn.setCheckable(True)
            btn.setObjectName(f"menuBtn_{key}")
            btn.setCursor(Qt.CursorShape.PointingHandCursor)
            btn.setStyleSheet(f"""
                QPushButton {{
                    text-align: left;
                    padding: 14px 24px;
                    border: none;
                    color: #9ca3af;
                    font-size: 14px;
                    background-color: transparent;
                }}
                QPushButton:hover {{
                    background-color: #374151;
                    color: white;
                }}
                QPushButton:checked {{
                    background-color: {COLORS['primary']};
                    color: white;
                    font-weight: 500;
                }}
            """)
            btn.clicked.connect(lambda checked, k=key: self._on_button_clicked(k))
            layout.addWidget(btn)
            self._buttons[key] = btn

        # Spacer
        layout.addSpacerItem(
            QSpacerItem(20, 40, QSizePolicy.Policy.Minimum, QSizePolicy.Policy.Expanding)
        )

        # Version info
        version_label = QLabel("v1.0.0")
        version_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        version_label.setStyleSheet("color: #6b7280; padding: 16px; font-size: 12px;")
        layout.addWidget(version_label)

    def _on_button_clicked(self, page_key: str):
        self.set_current_page(page_key)
        self.page_changed.emit(page_key)

    def set_current_page(self, page_key: str):
        """Set current active page"""
        self._current_page = page_key
        for key, btn in self._buttons.items():
            btn.setChecked(key == page_key)

    def get_current_page(self) -> str:
        """Get current page key"""
        return self._current_page

    def set_menu_enabled(self, page_key: str, enabled: bool):
        """Enable/disable menu item"""
        if page_key in self._buttons:
            self._buttons[page_key].setEnabled(enabled)

    def set_menu_visible(self, page_key: str, visible: bool):
        """Show/hide menu item"""
        if page_key in self._buttons:
            self._buttons[page_key].setVisible(visible)
