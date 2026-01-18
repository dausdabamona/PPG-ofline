"""
StatCard - Card untuk menampilkan statistik
"""
from PyQt6.QtWidgets import QFrame, QVBoxLayout, QHBoxLayout, QLabel
from PyQt6.QtCore import Qt
from config import COLORS


class StatCard(QFrame):
    """
    Card component untuk menampilkan statistik
    """

    def __init__(
        self,
        title: str,
        value: str | int,
        subtitle: str = None,
        icon: str = None,
        color: str = None,
        parent=None
    ):
        super().__init__(parent)
        self._title = title
        self._value = str(value)
        self._subtitle = subtitle
        self._icon = icon
        self._color = color or COLORS['primary']

        self._setup_ui()

    def _setup_ui(self):
        self.setStyleSheet(f"""
            QFrame {{
                background-color: {COLORS['surface']};
                border: 1px solid {COLORS['border']};
                border-radius: 12px;
                padding: 8px;
            }}
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(8)

        # Header with icon
        header = QHBoxLayout()

        title_label = QLabel(self._title)
        title_label.setStyleSheet(f"""
            color: {COLORS['text_secondary']};
            font-size: 14px;
            font-weight: 500;
        """)
        header.addWidget(title_label)

        if self._icon:
            icon_label = QLabel(self._icon)
            icon_label.setStyleSheet(f"""
                color: {self._color};
                font-size: 20px;
            """)
            header.addWidget(icon_label)

        header.addStretch()
        layout.addLayout(header)

        # Value
        self._value_label = QLabel(self._value)
        self._value_label.setStyleSheet(f"""
            color: {COLORS['text_primary']};
            font-size: 32px;
            font-weight: bold;
        """)
        layout.addWidget(self._value_label)

        # Subtitle
        if self._subtitle:
            self._subtitle_label = QLabel(self._subtitle)
            self._subtitle_label.setStyleSheet(f"""
                color: {COLORS['text_secondary']};
                font-size: 13px;
            """)
            layout.addWidget(self._subtitle_label)

        layout.addStretch()

    def set_value(self, value: str | int):
        """Update value"""
        self._value = str(value)
        self._value_label.setText(self._value)

    def set_subtitle(self, subtitle: str):
        """Update subtitle"""
        if hasattr(self, '_subtitle_label'):
            self._subtitle_label.setText(subtitle)

    def get_value(self) -> str:
        """Get current value"""
        return self._value
