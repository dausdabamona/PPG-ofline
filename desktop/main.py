#!/usr/bin/env python3
"""
PPG Sorong Desktop Application
Sistem Manajemen Pembinaan Generasi Penerus

Entry point aplikasi desktop
"""
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from PyQt6.QtWidgets import QApplication, QSplashScreen, QMessageBox
from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QPixmap, QFont

from config import APP_NAME, APP_VERSION, DATABASE_PATH
from database import init_database
from database.connection import SessionLocal
from ui import MainWindow


def show_splash(app: QApplication) -> QSplashScreen:
    """Show splash screen while loading"""
    # Create simple splash (could use image later)
    splash_pix = QPixmap(400, 200)
    splash_pix.fill(Qt.GlobalColor.white)

    splash = QSplashScreen(splash_pix)
    splash.setFont(QFont('Segoe UI', 14))
    splash.showMessage(
        f"\n\n{APP_NAME}\nv{APP_VERSION}\n\nMemuat...",
        Qt.AlignmentFlag.AlignCenter,
        Qt.GlobalColor.darkGreen
    )
    splash.show()
    app.processEvents()

    return splash


def main():
    """Main entry point"""
    # Create application
    app = QApplication(sys.argv)
    app.setApplicationName(APP_NAME)
    app.setApplicationVersion(APP_VERSION)
    app.setStyle('Fusion')  # Use Fusion style for consistent look

    # Show splash
    splash = show_splash(app)

    try:
        # Initialize database
        splash.showMessage(
            f"\n\n{APP_NAME}\nv{APP_VERSION}\n\nInisialisasi database...",
            Qt.AlignmentFlag.AlignCenter,
            Qt.GlobalColor.darkGreen
        )
        app.processEvents()

        init_database()

        # Create session
        splash.showMessage(
            f"\n\n{APP_NAME}\nv{APP_VERSION}\n\nMemuat antarmuka...",
            Qt.AlignmentFlag.AlignCenter,
            Qt.GlobalColor.darkGreen
        )
        app.processEvents()

        # Create session directly (avoid context manager
        # since sys.exit raises SystemExit which bypasses commit/rollback)
        session = SessionLocal()

        # Create main window
        window = MainWindow(session)

        # Close splash and show window
        splash.finish(window)
        window.showMaximized()

        # Run application
        try:
            exit_code = app.exec()
        finally:
            session.close()

        sys.exit(exit_code)

    except Exception as e:
        splash.close()
        QMessageBox.critical(
            None,
            "Error",
            f"Gagal memulai aplikasi:\n{str(e)}"
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
