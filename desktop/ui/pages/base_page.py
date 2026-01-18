"""
BasePage - Base class untuk semua halaman
"""
from PyQt6.QtWidgets import QWidget, QVBoxLayout, QLabel, QHBoxLayout, QPushButton
from PyQt6.QtCore import Qt
from PyQt6.QtGui import QFont
from sqlalchemy.orm import Session

from config import COLORS


class BasePage(QWidget):
    """
    Base class untuk halaman aplikasi
    Semua halaman harus inherit dari class ini
    """

    def __init__(self, session: Session, parent=None):
        super().__init__(parent)
        self.session = session
        self._title = "Page"
        self._subtitle = ""
        self._setup_base_ui()

    def _setup_base_ui(self):
        """Setup layout dasar"""
        self._main_layout = QVBoxLayout(self)
        self._main_layout.setContentsMargins(24, 24, 24, 24)
        self._main_layout.setSpacing(20)

    def set_header(self, title: str, subtitle: str = None, actions: list = None):
        """
        Setup header halaman

        Args:
            title: Judul halaman
            subtitle: Subjudul (optional)
            actions: List of action buttons [{'label': 'Tambah', 'callback': fn, 'primary': True}]
        """
        self._title = title
        self._subtitle = subtitle

        header_layout = QHBoxLayout()

        # Title section
        title_section = QVBoxLayout()

        title_label = QLabel(title)
        title_label.setFont(QFont('Segoe UI', 24, QFont.Weight.Bold))
        title_label.setStyleSheet(f"color: {COLORS['text_primary']};")
        title_section.addWidget(title_label)

        if subtitle:
            subtitle_label = QLabel(subtitle)
            subtitle_label.setStyleSheet(f"color: {COLORS['text_secondary']}; font-size: 14px;")
            title_section.addWidget(subtitle_label)

        header_layout.addLayout(title_section)
        header_layout.addStretch()

        # Action buttons
        if actions:
            for action in actions:
                btn = QPushButton(action['label'])
                if action.get('primary', False):
                    btn.setStyleSheet(f"""
                        QPushButton {{
                            background-color: {COLORS['primary']};
                            color: white;
                            padding: 10px 20px;
                            font-weight: 500;
                        }}
                        QPushButton:hover {{
                            background-color: {COLORS['primary_dark']};
                        }}
                    """)
                else:
                    btn.setStyleSheet(f"""
                        QPushButton {{
                            background-color: {COLORS['surface']};
                            color: {COLORS['text_primary']};
                            border: 1px solid {COLORS['border']};
                            padding: 10px 20px;
                        }}
                        QPushButton:hover {{
                            background-color: {COLORS['background']};
                        }}
                    """)
                btn.clicked.connect(action['callback'])
                header_layout.addWidget(btn)

        self._main_layout.addLayout(header_layout)

    def add_widget(self, widget: QWidget):
        """Add widget to main layout"""
        self._main_layout.addWidget(widget)

    def add_layout(self, layout):
        """Add layout to main layout"""
        self._main_layout.addLayout(layout)

    def add_stretch(self):
        """Add stretch to main layout"""
        self._main_layout.addStretch()

    def refresh(self):
        """
        Refresh page data
        Override this method in subclasses
        """
        pass

    def on_show(self):
        """
        Called when page is shown
        Override this method in subclasses
        """
        self.refresh()

    def on_hide(self):
        """
        Called when page is hidden
        Override this method in subclasses
        """
        pass
