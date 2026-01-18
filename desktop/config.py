"""
Konfigurasi Aplikasi PPG Sorong Desktop
"""
import os
from pathlib import Path

# Base Paths
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
BACKUP_DIR = BASE_DIR / "backups"
ASSETS_DIR = BASE_DIR / "assets"
REPORTS_DIR = BASE_DIR / "reports"

# Pastikan direktori ada
DATA_DIR.mkdir(exist_ok=True)
BACKUP_DIR.mkdir(exist_ok=True)

# Database Configuration
DATABASE_NAME = "ppg_main.db"
DATABASE_PATH = DATA_DIR / DATABASE_NAME
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

# Application Info
APP_NAME = "PPG Sorong"
APP_VERSION = "1.0.0"
APP_DESCRIPTION = "Sistem Manajemen Pembinaan Generasi Penerus"

# Sync Configuration
SYNC_FILE_EXTENSION = ".ppg"
SYNC_VERSION = "1.0"

# Device Configuration
import uuid
DEVICE_ID_FILE = DATA_DIR / ".device_id"

def get_device_id() -> str:
    """Generate atau ambil device ID unik"""
    if DEVICE_ID_FILE.exists():
        return DEVICE_ID_FILE.read_text().strip()

    device_id = str(uuid.uuid4())[:8]
    DEVICE_ID_FILE.write_text(device_id)
    return device_id

DEVICE_ID = get_device_id()

# UI Configuration
WINDOW_MIN_WIDTH = 1200
WINDOW_MIN_HEIGHT = 800
SIDEBAR_WIDTH = 250

# Theme Colors (Tailwind-inspired)
COLORS = {
    'primary': '#059669',       # Emerald-600
    'primary_dark': '#047857', # Emerald-700
    'primary_light': '#10b981', # Emerald-500
    'secondary': '#1f2937',     # Gray-800
    'background': '#f3f4f6',    # Gray-100
    'surface': '#ffffff',       # White
    'text_primary': '#111827',  # Gray-900
    'text_secondary': '#6b7280', # Gray-500
    'border': '#e5e7eb',        # Gray-200
    'error': '#dc2626',         # Red-600
    'warning': '#f59e0b',       # Amber-500
    'success': '#10b981',       # Emerald-500
    'info': '#3b82f6',          # Blue-500
}

# Jenjang Default (untuk seed data)
JENJANG_DEFAULT = [
    {'kode': 'BATITA', 'nama': 'Batita', 'usia_mulai': 0, 'usia_sampai': 2, 'urutan': 1},
    {'kode': 'BALITA', 'nama': 'Balita', 'usia_mulai': 2, 'usia_sampai': 5, 'urutan': 2},
    {'kode': 'CABERAWIT', 'nama': 'Caberawit', 'usia_mulai': 5, 'usia_sampai': 8, 'urutan': 3},
    {'kode': 'PRAREMAJA', 'nama': 'Pra-Remaja', 'usia_mulai': 8, 'usia_sampai': 12, 'urutan': 4},
    {'kode': 'REMAJA', 'nama': 'Remaja', 'usia_mulai': 12, 'usia_sampai': 17, 'urutan': 5},
    {'kode': 'DEWASA', 'nama': 'Dewasa', 'usia_mulai': 17, 'usia_sampai': 99, 'urutan': 6},
]

# Role Default
ROLE_DEFAULT = [
    {'kode': 'super_admin', 'nama': 'Super Administrator', 'level': 1},
    {'kode': 'admin', 'nama': 'Administrator', 'level': 2},
    {'kode': 'muballigh', 'nama': 'Muballigh', 'level': 3},
    {'kode': 'operator', 'nama': 'Operator', 'level': 4},
    {'kode': 'viewer', 'nama': 'Viewer', 'level': 5},
]

# Resource Default (Menu/Fitur)
RESOURCE_DEFAULT = [
    {'kode': 'dashboard', 'nama': 'Dashboard', 'urutan': 1},
    {'kode': 'generus', 'nama': 'Data Generus', 'urutan': 2},
    {'kode': 'jamaah', 'nama': 'Data Jamaah', 'urutan': 3},
    {'kode': 'pengajian', 'nama': 'Pengajian', 'urutan': 4},
    {'kode': 'presensi', 'nama': 'Presensi', 'urutan': 5},
    {'kode': 'penilaian', 'nama': 'Penilaian', 'urutan': 6},
    {'kode': 'kurikulum', 'nama': 'Kurikulum', 'urutan': 7},
    {'kode': 'wilayah', 'nama': 'Wilayah', 'urutan': 8},
    {'kode': 'laporan', 'nama': 'Laporan', 'urutan': 9},
    {'kode': 'users', 'nama': 'Manajemen User', 'urutan': 10},
    {'kode': 'settings', 'nama': 'Pengaturan', 'urutan': 11},
]

# Status Kehadiran
STATUS_KEHADIRAN = ['hadir', 'izin', 'sakit', 'alpa']

# Status Enrollment
STATUS_ENROLLMENT = ['aktif', 'nonaktif', 'pindah', 'selesai', 'lulus', 'keluar']

# Status Pernikahan
STATUS_PERNIKAHAN = ['belum_menikah', 'menikah', 'cerai']

# Fase Kehidupan
FASE_KEHIDUPAN = ['paud', 'caberawit', 'praremaja', 'remaja', 'pranikah', 'nikah', 'orangtua', 'lansia']

# Tingkat Wilayah
TINGKAT_WILAYAH = ['daerah', 'desa', 'kelompok']

# Hari dalam seminggu
HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

# Nilai Akhlaq
NILAI_AKHLAQ = ['A', 'B', 'C', 'D']

# Tipe Materi
TIPE_MATERI = ['hafalan', 'level', 'checklist', 'status']

# Status Progress
STATUS_PROGRESS = ['belum', 'sedang', 'selesai', 'lulus']
