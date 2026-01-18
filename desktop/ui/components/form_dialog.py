"""
FormDialog - Reusable form dialog component
"""
from PyQt6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QFormLayout, QLineEdit,
    QTextEdit, QComboBox, QDateEdit, QSpinBox, QDoubleSpinBox,
    QCheckBox, QPushButton, QLabel, QWidget, QScrollArea, QFrame,
    QMessageBox
)
from PyQt6.QtCore import Qt, QDate, pyqtSignal
from PyQt6.QtGui import QFont

from typing import List, Dict, Any, Callable
from datetime import date
from config import COLORS


class FormDialog(QDialog):
    """
    Reusable form dialog with dynamic field generation

    Usage:
        fields = [
            {'key': 'nama', 'label': 'Nama', 'type': 'text', 'required': True},
            {'key': 'tanggal_lahir', 'label': 'Tanggal Lahir', 'type': 'date'},
            {'key': 'jenis_kelamin', 'label': 'Jenis Kelamin', 'type': 'select',
             'options': [('L', 'Laki-laki'), ('P', 'Perempuan')]},
        ]
        dialog = FormDialog("Tambah Data", fields)
        if dialog.exec():
            data = dialog.get_data()
    """
    form_submitted = pyqtSignal(dict)

    def __init__(
        self,
        title: str,
        fields: List[Dict[str, Any]],
        data: Dict[str, Any] = None,
        parent=None
    ):
        super().__init__(parent)
        self._title = title
        self._fields = fields
        self._data = data or {}
        self._inputs = {}
        self._validators = {}

        self._setup_ui()
        self._load_data()

    def _setup_ui(self):
        self.setWindowTitle(self._title)
        self.setMinimumWidth(500)
        self.setModal(True)

        layout = QVBoxLayout(self)
        layout.setSpacing(20)

        # Title
        title_label = QLabel(self._title)
        title_label.setFont(QFont('Segoe UI', 18, QFont.Weight.Bold))
        layout.addWidget(title_label)

        # Scrollable form area
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)

        form_widget = QWidget()
        form_layout = QFormLayout(form_widget)
        form_layout.setSpacing(16)
        form_layout.setContentsMargins(0, 0, 0, 0)

        for field in self._fields:
            widget = self._create_field_widget(field)
            if widget:
                label = QLabel(field['label'])
                if field.get('required'):
                    label.setText(f"{field['label']} *")
                label.setStyleSheet(f"color: {COLORS['text_secondary']}; font-weight: 500;")

                form_layout.addRow(label, widget)
                self._inputs[field['key']] = widget

        scroll.setWidget(form_widget)
        layout.addWidget(scroll, 1)

        # Buttons
        button_layout = QHBoxLayout()
        button_layout.addStretch()

        cancel_btn = QPushButton("Batal")
        cancel_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {COLORS['surface']};
                color: {COLORS['text_primary']};
                border: 1px solid {COLORS['border']};
                padding: 10px 24px;
            }}
            QPushButton:hover {{
                background-color: {COLORS['background']};
            }}
        """)
        cancel_btn.clicked.connect(self.reject)
        button_layout.addWidget(cancel_btn)

        save_btn = QPushButton("Simpan")
        save_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {COLORS['primary']};
                color: white;
                padding: 10px 24px;
            }}
            QPushButton:hover {{
                background-color: {COLORS['primary_dark']};
            }}
        """)
        save_btn.clicked.connect(self._on_submit)
        button_layout.addWidget(save_btn)

        layout.addLayout(button_layout)

    def _create_field_widget(self, field: Dict[str, Any]) -> QWidget:
        """Create input widget based on field type"""
        field_type = field.get('type', 'text')
        placeholder = field.get('placeholder', '')

        if field_type == 'text':
            widget = QLineEdit()
            widget.setPlaceholderText(placeholder)
            if field.get('max_length'):
                widget.setMaxLength(field['max_length'])

        elif field_type == 'textarea':
            widget = QTextEdit()
            widget.setPlaceholderText(placeholder)
            widget.setMaximumHeight(100)

        elif field_type == 'number':
            widget = QSpinBox()
            widget.setMinimum(field.get('min', 0))
            widget.setMaximum(field.get('max', 999999))

        elif field_type == 'decimal':
            widget = QDoubleSpinBox()
            widget.setMinimum(field.get('min', 0))
            widget.setMaximum(field.get('max', 999999))
            widget.setDecimals(field.get('decimals', 2))

        elif field_type == 'date':
            widget = QDateEdit()
            widget.setCalendarPopup(True)
            widget.setDate(QDate.currentDate())

        elif field_type == 'select':
            widget = QComboBox()
            options = field.get('options', [])
            if field.get('allow_empty', True):
                widget.addItem('-- Pilih --', None)
            for opt in options:
                if isinstance(opt, tuple):
                    widget.addItem(opt[1], opt[0])
                else:
                    widget.addItem(str(opt), opt)

        elif field_type == 'checkbox':
            widget = QCheckBox(field.get('checkbox_label', ''))

        elif field_type == 'phone':
            widget = QLineEdit()
            widget.setPlaceholderText(placeholder or '08xxxxxxxxxx')

        elif field_type == 'email':
            widget = QLineEdit()
            widget.setPlaceholderText(placeholder or 'email@example.com')

        else:
            widget = QLineEdit()
            widget.setPlaceholderText(placeholder)

        # Store validator
        if field.get('validator'):
            self._validators[field['key']] = field['validator']

        return widget

    def _load_data(self):
        """Load initial data into form"""
        for key, value in self._data.items():
            if key not in self._inputs:
                continue

            widget = self._inputs[key]

            if isinstance(widget, QLineEdit):
                widget.setText(str(value) if value else '')

            elif isinstance(widget, QTextEdit):
                widget.setPlainText(str(value) if value else '')

            elif isinstance(widget, QSpinBox) or isinstance(widget, QDoubleSpinBox):
                widget.setValue(value if value else 0)

            elif isinstance(widget, QDateEdit):
                if value:
                    if isinstance(value, str):
                        value = date.fromisoformat(value)
                    widget.setDate(QDate(value.year, value.month, value.day))

            elif isinstance(widget, QComboBox):
                index = widget.findData(value)
                if index >= 0:
                    widget.setCurrentIndex(index)

            elif isinstance(widget, QCheckBox):
                widget.setChecked(bool(value))

    def get_data(self) -> Dict[str, Any]:
        """Get form data as dictionary"""
        data = {}

        for key, widget in self._inputs.items():
            if isinstance(widget, QLineEdit):
                value = widget.text().strip()
                data[key] = value if value else None

            elif isinstance(widget, QTextEdit):
                value = widget.toPlainText().strip()
                data[key] = value if value else None

            elif isinstance(widget, QSpinBox):
                data[key] = widget.value()

            elif isinstance(widget, QDoubleSpinBox):
                data[key] = widget.value()

            elif isinstance(widget, QDateEdit):
                qdate = widget.date()
                data[key] = date(qdate.year(), qdate.month(), qdate.day())

            elif isinstance(widget, QComboBox):
                data[key] = widget.currentData()

            elif isinstance(widget, QCheckBox):
                data[key] = widget.isChecked()

        return data

    def _validate(self) -> bool:
        """Validate form data"""
        for field in self._fields:
            key = field['key']
            widget = self._inputs.get(key)
            if not widget:
                continue

            # Required validation
            if field.get('required'):
                data = self.get_data()
                value = data.get(key)
                if value is None or value == '' or value == []:
                    QMessageBox.warning(
                        self,
                        "Validasi Gagal",
                        f"{field['label']} wajib diisi!"
                    )
                    widget.setFocus()
                    return False

            # Custom validator
            if key in self._validators:
                data = self.get_data()
                error = self._validators[key](data.get(key), data)
                if error:
                    QMessageBox.warning(self, "Validasi Gagal", error)
                    widget.setFocus()
                    return False

        return True

    def _on_submit(self):
        """Handle form submission"""
        if self._validate():
            data = self.get_data()
            self.form_submitted.emit(data)
            self.accept()

    def set_field_value(self, key: str, value: Any):
        """Set value for specific field"""
        if key in self._inputs:
            self._data[key] = value
            self._load_data()

    def set_field_options(self, key: str, options: List):
        """Update options for select field"""
        if key in self._inputs:
            widget = self._inputs[key]
            if isinstance(widget, QComboBox):
                current = widget.currentData()
                widget.clear()
                widget.addItem('-- Pilih --', None)
                for opt in options:
                    if isinstance(opt, tuple):
                        widget.addItem(opt[1], opt[0])
                    else:
                        widget.addItem(str(opt), opt)
                # Restore selection
                index = widget.findData(current)
                if index >= 0:
                    widget.setCurrentIndex(index)
