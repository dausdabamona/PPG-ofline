#!/usr/bin/env python3
"""
Build Script untuk membuat executable PPG Sorong
Menggunakan PyInstaller
"""
import PyInstaller.__main__
import os
import sys
import shutil

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, 'dist')
BUILD_DIR = os.path.join(BASE_DIR, 'build')

def clean_build():
    """Bersihkan folder build sebelumnya"""
    for folder in [DIST_DIR, BUILD_DIR]:
        if os.path.exists(folder):
            shutil.rmtree(folder)
            print(f"Cleaned: {folder}")

def build_exe():
    """Build executable menggunakan PyInstaller"""

    # PyInstaller arguments
    args = [
        'main.py',                          # Entry point
        '--name=PPG-Sorong',                # Nama executable
        '--onefile',                        # Single file executable
        '--windowed',                       # No console window (GUI app)
        '--clean',                          # Clean cache

        # Add data files
        '--add-data=assets:assets',         # Include assets folder

        # Hidden imports (modules yang mungkin tidak terdeteksi)
        '--hidden-import=PyQt6.QtCore',
        '--hidden-import=PyQt6.QtWidgets',
        '--hidden-import=PyQt6.QtGui',
        '--hidden-import=sqlalchemy.dialects.sqlite',
        '--hidden-import=bcrypt',

        # Exclude unnecessary modules to reduce size
        '--exclude-module=matplotlib',
        '--exclude-module=numpy',
        '--exclude-module=pandas',
        '--exclude-module=tkinter',

        # Output directory
        f'--distpath={DIST_DIR}',
        f'--workpath={BUILD_DIR}',

        # Spec file location
        f'--specpath={BASE_DIR}',
    ]

    # Add icon if exists
    icon_path = os.path.join(BASE_DIR, 'assets', 'icons', 'app.ico')
    if os.path.exists(icon_path):
        args.append(f'--icon={icon_path}')

    print("Building executable...")
    print(f"Arguments: {' '.join(args)}")

    PyInstaller.__main__.run(args)

    print(f"\nBuild complete! Executable at: {os.path.join(DIST_DIR, 'PPG-Sorong.exe')}")

def create_portable_package():
    """Buat paket portable dengan database dan config"""
    portable_dir = os.path.join(DIST_DIR, 'PPG-Sorong-Portable')
    os.makedirs(portable_dir, exist_ok=True)

    # Copy executable
    exe_path = os.path.join(DIST_DIR, 'PPG-Sorong.exe')
    if os.path.exists(exe_path):
        shutil.copy(exe_path, portable_dir)

    # Create data folder
    data_dir = os.path.join(portable_dir, 'data')
    os.makedirs(data_dir, exist_ok=True)

    # Create backups folder
    backup_dir = os.path.join(portable_dir, 'backups')
    os.makedirs(backup_dir, exist_ok=True)

    # Create README
    readme_content = """# PPG Sorong - Portable Edition

## Cara Penggunaan
1. Jalankan PPG-Sorong.exe
2. Database akan otomatis dibuat di folder 'data'
3. Backup file (.ppg) akan disimpan di folder 'backups'

## Login Default
- Username: admin
- Password: admin123

## Catatan
- Jangan hapus folder 'data' (berisi database)
- Backup data secara berkala

## Support
Hubungi administrator untuk bantuan.
"""
    with open(os.path.join(portable_dir, 'README.txt'), 'w') as f:
        f.write(readme_content)

    print(f"Portable package created at: {portable_dir}")

if __name__ == '__main__':
    if '--clean' in sys.argv:
        clean_build()

    build_exe()
    create_portable_package()
