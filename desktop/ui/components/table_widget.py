"""
DataTableWidget - Reusable table component with search, pagination
"""
from PyQt6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QTableWidget, QTableWidgetItem,
    QPushButton, QLineEdit, QLabel, QComboBox, QHeaderView, QAbstractItemView,
    QFrame
)
from PyQt6.QtCore import pyqtSignal, Qt
from PyQt6.QtGui import QColor

from typing import List, Dict, Any, Callable
from config import COLORS


class DataTableWidget(QWidget):
    """
    Reusable data table with:
    - Search/filter
    - Sortable columns
    - Row actions (view, edit, delete)
    - Pagination
    """
    row_selected = pyqtSignal(dict)
    row_double_clicked = pyqtSignal(dict)
    action_clicked = pyqtSignal(str, dict)  # action_name, row_data

    def __init__(
        self,
        columns: List[Dict[str, Any]],
        parent=None,
        show_search: bool = True,
        show_actions: bool = True,
        page_size: int = 25
    ):
        """
        Args:
            columns: List of column definitions
                [{'key': 'nama', 'label': 'Nama', 'width': 200, 'sortable': True}, ...]
            show_search: Show search box
            show_actions: Show action buttons column
            page_size: Rows per page
        """
        super().__init__(parent)
        self._columns = columns
        self._show_search = show_search
        self._show_actions = show_actions
        self._page_size = page_size
        self._data = []
        self._filtered_data = []
        self._current_page = 0
        self._sort_column = None
        self._sort_order = Qt.SortOrder.AscendingOrder

        self._setup_ui()

    def _setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(12)

        # Toolbar
        if self._show_search:
            toolbar = QHBoxLayout()

            # Search box
            self._search_input = QLineEdit()
            self._search_input.setPlaceholderText("Cari...")
            self._search_input.setMaximumWidth(300)
            self._search_input.textChanged.connect(self._on_search)
            toolbar.addWidget(self._search_input)

            toolbar.addStretch()

            # Page size selector
            toolbar.addWidget(QLabel("Per halaman:"))
            self._page_size_combo = QComboBox()
            self._page_size_combo.addItems(['10', '25', '50', '100'])
            self._page_size_combo.setCurrentText(str(self._page_size))
            self._page_size_combo.currentTextChanged.connect(self._on_page_size_changed)
            self._page_size_combo.setMaximumWidth(80)
            toolbar.addWidget(self._page_size_combo)

            layout.addLayout(toolbar)

        # Table
        self._table = QTableWidget()
        self._table.setAlternatingRowColors(True)
        self._table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self._table.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self._table.horizontalHeader().setStretchLastSection(True)
        self._table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Interactive)
        self._table.verticalHeader().setVisible(False)
        self._table.setShowGrid(True)
        self._table.setSortingEnabled(False)  # We handle sorting manually

        # Setup columns
        col_count = len(self._columns)
        if self._show_actions:
            col_count += 1

        self._table.setColumnCount(col_count)

        headers = [col['label'] for col in self._columns]
        if self._show_actions:
            headers.append('Aksi')

        self._table.setHorizontalHeaderLabels(headers)

        # Set column widths
        for i, col in enumerate(self._columns):
            if 'width' in col:
                self._table.setColumnWidth(i, col['width'])

        # Connect signals
        self._table.cellClicked.connect(self._on_cell_clicked)
        self._table.cellDoubleClicked.connect(self._on_cell_double_clicked)
        self._table.horizontalHeader().sectionClicked.connect(self._on_header_clicked)

        layout.addWidget(self._table)

        # Pagination
        pagination = QHBoxLayout()

        self._page_info = QLabel()
        pagination.addWidget(self._page_info)

        pagination.addStretch()

        self._prev_btn = QPushButton("Sebelumnya")
        self._prev_btn.clicked.connect(self._prev_page)
        self._prev_btn.setEnabled(False)
        pagination.addWidget(self._prev_btn)

        self._page_label = QLabel("Halaman 1")
        pagination.addWidget(self._page_label)

        self._next_btn = QPushButton("Berikutnya")
        self._next_btn.clicked.connect(self._next_page)
        self._next_btn.setEnabled(False)
        pagination.addWidget(self._next_btn)

        layout.addLayout(pagination)

    def set_data(self, data: List[Dict[str, Any]]):
        """Set table data"""
        self._data = data
        self._filtered_data = data.copy()
        self._current_page = 0
        self._apply_filter()

    def get_data(self) -> List[Dict[str, Any]]:
        """Get current data"""
        return self._data

    def get_selected_row(self) -> Dict[str, Any] | None:
        """Get currently selected row data"""
        row = self._table.currentRow()
        if row >= 0:
            return self._get_row_data(row)
        return None

    def refresh(self):
        """Refresh table display"""
        self._render_table()

    def _apply_filter(self):
        """Apply search filter and sort"""
        search_text = self._search_input.text().lower() if self._show_search else ""

        if search_text:
            self._filtered_data = [
                row for row in self._data
                if any(
                    search_text in str(row.get(col['key'], '')).lower()
                    for col in self._columns
                )
            ]
        else:
            self._filtered_data = self._data.copy()

        # Apply sort
        if self._sort_column is not None:
            col_key = self._columns[self._sort_column]['key']
            reverse = self._sort_order == Qt.SortOrder.DescendingOrder
            self._filtered_data.sort(
                key=lambda x: (x.get(col_key) is None, x.get(col_key, '')),
                reverse=reverse
            )

        self._render_table()

    def _render_table(self):
        """Render table with current page data"""
        start = self._current_page * self._page_size
        end = start + self._page_size
        page_data = self._filtered_data[start:end]

        self._table.setRowCount(len(page_data))

        for row_idx, row_data in enumerate(page_data):
            # Set row height
            self._table.setRowHeight(row_idx, 44)

            for col_idx, col in enumerate(self._columns):
                value = row_data.get(col['key'], '')

                # Format value
                if col.get('formatter'):
                    value = col['formatter'](value, row_data)
                elif value is None:
                    value = '-'

                item = QTableWidgetItem(str(value))
                item.setFlags(item.flags() & ~Qt.ItemFlag.ItemIsEditable)

                # Align
                if col.get('align') == 'center':
                    item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                elif col.get('align') == 'right':
                    item.setTextAlignment(Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter)
                else:
                    item.setTextAlignment(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter)

                self._table.setItem(row_idx, col_idx, item)

            # Action buttons
            if self._show_actions:
                action_widget = self._create_action_buttons(row_data)
                self._table.setCellWidget(row_idx, len(self._columns), action_widget)

        # Update pagination
        total = len(self._filtered_data)
        total_pages = (total + self._page_size - 1) // self._page_size
        current = self._current_page + 1

        self._page_info.setText(f"Menampilkan {start + 1}-{min(end, total)} dari {total}")
        self._page_label.setText(f"Halaman {current} dari {total_pages}")
        self._prev_btn.setEnabled(self._current_page > 0)
        self._next_btn.setEnabled(end < total)

    def _create_action_buttons(self, row_data: Dict) -> QWidget:
        """Create action buttons for a row"""
        widget = QWidget()
        layout = QHBoxLayout(widget)
        layout.setContentsMargins(4, 2, 4, 2)
        layout.setSpacing(4)

        # Edit button
        edit_btn = QPushButton("Edit")
        edit_btn.setMaximumWidth(60)
        edit_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {COLORS['info']};
                color: white;
                padding: 4px 8px;
                font-size: 12px;
            }}
            QPushButton:hover {{
                background-color: #2563eb;
            }}
        """)
        edit_btn.clicked.connect(lambda: self.action_clicked.emit('edit', row_data))
        layout.addWidget(edit_btn)

        # Delete button
        delete_btn = QPushButton("Hapus")
        delete_btn.setMaximumWidth(60)
        delete_btn.setStyleSheet(f"""
            QPushButton {{
                background-color: {COLORS['error']};
                color: white;
                padding: 4px 8px;
                font-size: 12px;
            }}
            QPushButton:hover {{
                background-color: #b91c1c;
            }}
        """)
        delete_btn.clicked.connect(lambda: self.action_clicked.emit('delete', row_data))
        layout.addWidget(delete_btn)

        layout.addStretch()
        return widget

    def _get_row_data(self, row: int) -> Dict[str, Any]:
        """Get data for row index (considering pagination)"""
        actual_idx = self._current_page * self._page_size + row
        if actual_idx < len(self._filtered_data):
            return self._filtered_data[actual_idx]
        return {}

    def _on_search(self, text: str):
        self._current_page = 0
        self._apply_filter()

    def _on_page_size_changed(self, text: str):
        self._page_size = int(text)
        self._current_page = 0
        self._render_table()

    def _on_cell_clicked(self, row: int, col: int):
        data = self._get_row_data(row)
        self.row_selected.emit(data)

    def _on_cell_double_clicked(self, row: int, col: int):
        data = self._get_row_data(row)
        self.row_double_clicked.emit(data)

    def _on_header_clicked(self, col: int):
        """Handle column header click for sorting"""
        if col >= len(self._columns):
            return  # Action column

        if not self._columns[col].get('sortable', True):
            return

        if self._sort_column == col:
            # Toggle order
            if self._sort_order == Qt.SortOrder.AscendingOrder:
                self._sort_order = Qt.SortOrder.DescendingOrder
            else:
                self._sort_order = Qt.SortOrder.AscendingOrder
        else:
            self._sort_column = col
            self._sort_order = Qt.SortOrder.AscendingOrder

        self._apply_filter()

    def _prev_page(self):
        if self._current_page > 0:
            self._current_page -= 1
            self._render_table()

    def _next_page(self):
        total_pages = (len(self._filtered_data) + self._page_size - 1) // self._page_size
        if self._current_page < total_pages - 1:
            self._current_page += 1
            self._render_table()
