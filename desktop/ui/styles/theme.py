"""
Theme dan Styling untuk aplikasi PPG Sorong
"""
from config import COLORS

# Main Application Stylesheet
MAIN_STYLESHEET = f"""
/* Global Styles */
QMainWindow {{
    background-color: {COLORS['background']};
}}

QWidget {{
    font-family: 'Segoe UI', 'Arial', sans-serif;
    font-size: 14px;
    color: {COLORS['text_primary']};
}}

/* Sidebar Styles */
#sidebar {{
    background-color: {COLORS['secondary']};
    border: none;
}}

#sidebar QPushButton {{
    text-align: left;
    padding: 12px 20px;
    border: none;
    color: #9ca3af;
    font-size: 14px;
    background-color: transparent;
}}

#sidebar QPushButton:hover {{
    background-color: #374151;
    color: white;
}}

#sidebar QPushButton:checked {{
    background-color: {COLORS['primary']};
    color: white;
}}

#sidebarLogo {{
    padding: 20px;
    color: white;
    font-size: 18px;
    font-weight: bold;
    background-color: {COLORS['primary']};
}}

/* Content Area */
#contentArea {{
    background-color: {COLORS['background']};
    padding: 20px;
}}

/* Cards */
.card {{
    background-color: {COLORS['surface']};
    border: 1px solid {COLORS['border']};
    border-radius: 8px;
    padding: 16px;
}}

QFrame[class="card"] {{
    background-color: {COLORS['surface']};
    border: 1px solid {COLORS['border']};
    border-radius: 8px;
}}

/* Buttons */
QPushButton {{
    background-color: {COLORS['primary']};
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-weight: 500;
}}

QPushButton:hover {{
    background-color: {COLORS['primary_dark']};
}}

QPushButton:pressed {{
    background-color: {COLORS['primary_dark']};
}}

QPushButton:disabled {{
    background-color: #9ca3af;
}}

QPushButton[class="secondary"] {{
    background-color: {COLORS['surface']};
    color: {COLORS['text_primary']};
    border: 1px solid {COLORS['border']};
}}

QPushButton[class="secondary"]:hover {{
    background-color: {COLORS['background']};
}}

QPushButton[class="danger"] {{
    background-color: {COLORS['error']};
}}

QPushButton[class="danger"]:hover {{
    background-color: #b91c1c;
}}

/* Input Fields */
QLineEdit, QTextEdit, QPlainTextEdit {{
    background-color: {COLORS['surface']};
    border: 1px solid {COLORS['border']};
    border-radius: 6px;
    padding: 8px 12px;
    color: {COLORS['text_primary']};
}}

QLineEdit:focus, QTextEdit:focus, QPlainTextEdit:focus {{
    border-color: {COLORS['primary']};
}}

QLineEdit:disabled, QTextEdit:disabled {{
    background-color: {COLORS['background']};
    color: {COLORS['text_secondary']};
}}

/* ComboBox */
QComboBox {{
    background-color: {COLORS['surface']};
    border: 1px solid {COLORS['border']};
    border-radius: 6px;
    padding: 8px 12px;
    min-width: 150px;
}}

QComboBox:focus {{
    border-color: {COLORS['primary']};
}}

QComboBox::drop-down {{
    border: none;
    width: 30px;
}}

QComboBox::down-arrow {{
    image: none;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 5px solid {COLORS['text_secondary']};
    margin-right: 10px;
}}

QComboBox QAbstractItemView {{
    background-color: {COLORS['surface']};
    border: 1px solid {COLORS['border']};
    selection-background-color: {COLORS['primary']};
    selection-color: white;
}}

/* Tables */
QTableWidget, QTableView {{
    background-color: {COLORS['surface']};
    border: 1px solid {COLORS['border']};
    border-radius: 8px;
    gridline-color: {COLORS['border']};
}}

QTableWidget::item, QTableView::item {{
    padding: 8px;
}}

QTableWidget::item:selected, QTableView::item:selected {{
    background-color: {COLORS['primary']};
    color: white;
}}

QHeaderView::section {{
    background-color: {COLORS['background']};
    color: {COLORS['text_primary']};
    padding: 10px;
    border: none;
    border-bottom: 1px solid {COLORS['border']};
    font-weight: 600;
}}

/* Tree View */
QTreeView {{
    background-color: {COLORS['surface']};
    border: 1px solid {COLORS['border']};
    border-radius: 8px;
}}

QTreeView::item {{
    padding: 6px;
}}

QTreeView::item:selected {{
    background-color: {COLORS['primary']};
    color: white;
}}

QTreeView::branch:has-children:!has-siblings:closed,
QTreeView::branch:closed:has-children:has-siblings {{
    border-image: none;
}}

/* Scrollbars */
QScrollBar:vertical {{
    background-color: {COLORS['background']};
    width: 12px;
    border-radius: 6px;
}}

QScrollBar::handle:vertical {{
    background-color: #c4c4c4;
    border-radius: 6px;
    min-height: 30px;
}}

QScrollBar::handle:vertical:hover {{
    background-color: #a0a0a0;
}}

QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
    height: 0px;
}}

QScrollBar:horizontal {{
    background-color: {COLORS['background']};
    height: 12px;
    border-radius: 6px;
}}

QScrollBar::handle:horizontal {{
    background-color: #c4c4c4;
    border-radius: 6px;
    min-width: 30px;
}}

/* Tab Widget */
QTabWidget::pane {{
    border: 1px solid {COLORS['border']};
    border-radius: 8px;
    background-color: {COLORS['surface']};
}}

QTabBar::tab {{
    background-color: {COLORS['background']};
    color: {COLORS['text_secondary']};
    padding: 10px 20px;
    border: none;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
}}

QTabBar::tab:selected {{
    background-color: {COLORS['surface']};
    color: {COLORS['primary']};
    font-weight: 600;
}}

QTabBar::tab:hover:!selected {{
    background-color: {COLORS['border']};
}}

/* Labels */
QLabel {{
    color: {COLORS['text_primary']};
}}

QLabel[class="title"] {{
    font-size: 24px;
    font-weight: bold;
    color: {COLORS['text_primary']};
}}

QLabel[class="subtitle"] {{
    font-size: 16px;
    color: {COLORS['text_secondary']};
}}

QLabel[class="label"] {{
    font-size: 14px;
    font-weight: 500;
    color: {COLORS['text_secondary']};
    margin-bottom: 4px;
}}

/* Date Edit */
QDateEdit {{
    background-color: {COLORS['surface']};
    border: 1px solid {COLORS['border']};
    border-radius: 6px;
    padding: 8px 12px;
}}

QDateEdit:focus {{
    border-color: {COLORS['primary']};
}}

/* Spin Box */
QSpinBox, QDoubleSpinBox {{
    background-color: {COLORS['surface']};
    border: 1px solid {COLORS['border']};
    border-radius: 6px;
    padding: 8px 12px;
}}

/* Check Box */
QCheckBox {{
    spacing: 8px;
}}

QCheckBox::indicator {{
    width: 18px;
    height: 18px;
    border: 2px solid {COLORS['border']};
    border-radius: 4px;
    background-color: {COLORS['surface']};
}}

QCheckBox::indicator:checked {{
    background-color: {COLORS['primary']};
    border-color: {COLORS['primary']};
}}

/* Radio Button */
QRadioButton {{
    spacing: 8px;
}}

QRadioButton::indicator {{
    width: 18px;
    height: 18px;
    border: 2px solid {COLORS['border']};
    border-radius: 9px;
    background-color: {COLORS['surface']};
}}

QRadioButton::indicator:checked {{
    background-color: {COLORS['primary']};
    border-color: {COLORS['primary']};
}}

/* Group Box */
QGroupBox {{
    font-weight: 600;
    border: 1px solid {COLORS['border']};
    border-radius: 8px;
    margin-top: 12px;
    padding-top: 12px;
}}

QGroupBox::title {{
    subcontrol-origin: margin;
    left: 12px;
    padding: 0 8px;
}}

/* Message Box */
QMessageBox {{
    background-color: {COLORS['surface']};
}}

/* Progress Bar */
QProgressBar {{
    background-color: {COLORS['background']};
    border: none;
    border-radius: 4px;
    height: 8px;
    text-align: center;
}}

QProgressBar::chunk {{
    background-color: {COLORS['primary']};
    border-radius: 4px;
}}

/* Tool Tip */
QToolTip {{
    background-color: {COLORS['secondary']};
    color: white;
    border: none;
    padding: 8px;
    border-radius: 4px;
}}

/* Status Bar */
QStatusBar {{
    background-color: {COLORS['surface']};
    border-top: 1px solid {COLORS['border']};
}}

/* Menu Bar */
QMenuBar {{
    background-color: {COLORS['surface']};
    border-bottom: 1px solid {COLORS['border']};
}}

QMenuBar::item {{
    padding: 8px 12px;
}}

QMenuBar::item:selected {{
    background-color: {COLORS['background']};
}}

QMenu {{
    background-color: {COLORS['surface']};
    border: 1px solid {COLORS['border']};
}}

QMenu::item {{
    padding: 8px 24px;
}}

QMenu::item:selected {{
    background-color: {COLORS['primary']};
    color: white;
}}

QMenu::separator {{
    height: 1px;
    background-color: {COLORS['border']};
    margin: 4px 0;
}}
"""

# Specific component styles
STAT_CARD_STYLE = f"""
QFrame {{
    background-color: {COLORS['surface']};
    border: 1px solid {COLORS['border']};
    border-radius: 12px;
    padding: 16px;
}}
"""

SIDEBAR_STYLE = f"""
QFrame {{
    background-color: {COLORS['secondary']};
    border: none;
}}
"""
