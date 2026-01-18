"""
Pages Package - Application pages/screens
"""
from .base_page import BasePage
from .dashboard_page import DashboardPage
from .generus_page import GenerusPage
from .wilayah_page import WilayahPage
from .kurikulum_page import KurikulumPage
from .pengajian_page import PengajianPage
from .presensi_page import PresensiPage

__all__ = [
    'BasePage',
    'DashboardPage',
    'GenerusPage',
    'WilayahPage',
    'KurikulumPage',
    'PengajianPage',
    'PresensiPage',
]
