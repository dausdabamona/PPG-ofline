# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller Spec File untuk PPG Sorong Desktop
"""
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# Collect semua PyQt6 modules
pyqt6_hiddenimports = collect_submodules('PyQt6')

# Collect PyQt6 data files
pyqt6_datas = collect_data_files('PyQt6', include_py_files=True)

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=pyqt6_datas,
    hiddenimports=[
        *pyqt6_hiddenimports,
        'PyQt6.QtCore',
        'PyQt6.QtWidgets',
        'PyQt6.QtGui',
        'PyQt6.sip',
        'sqlalchemy',
        'sqlalchemy.dialects.sqlite',
        'sqlalchemy.sql.default_comparator',
        'sqlalchemy.orm',
        'sqlalchemy.ext.declarative',
        'bcrypt',
        'bcrypt._bcrypt',
        'PIL',
        'PIL._tkinter_finder',
        'reportlab',
        'reportlab.graphics',
        'openpyxl',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'numpy',
        'pandas',
        'scipy',
        'cv2',
        'torch',
        'tensorflow',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='PPG-Sorong',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
