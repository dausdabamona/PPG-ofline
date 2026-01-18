"""
SQLAlchemy Models - PPG Sorong Desktop
Semua model database dengan relasi lengkap
"""
from .base import Base, generate_sync_id, TimestampMixin, SyncMixin
from .jamaah import Jamaah, FaseKehidupan
from .wilayah import Wilayah, Jenjang, TahunAjaran
from .enrollment import Enrollment, AnggotaKelas
from .pengajian import Pengajian, JadwalRutin, KelasPengajian, KelasTingkat, TanggalSkip
from .presensi import KeaktifanPengajian
from .kurikulum import BidangMateri, KategoriMateri, MateriItem, TargetJenjang
from .penilaian import ProgressJamaah, PenilaianAkhlaq
from .organisasi import Musyawarah, MusyawarahPeserta, MusyawarahHasil, Kegiatan, PesertaKegiatan, KakakAsuh, LimaUnsur
from .security import Users, Role, Resource, RolePermission, UserRole
from .sync import SyncLog, SyncConflict

__all__ = [
    # Base
    'Base', 'generate_sync_id', 'TimestampMixin', 'SyncMixin',
    # Jamaah
    'Jamaah', 'FaseKehidupan',
    # Wilayah
    'Wilayah', 'Jenjang', 'TahunAjaran',
    # Enrollment
    'Enrollment', 'AnggotaKelas',
    # Pengajian
    'Pengajian', 'JadwalRutin', 'KelasPengajian', 'KelasTingkat', 'TanggalSkip',
    # Presensi
    'KeaktifanPengajian',
    # Kurikulum
    'BidangMateri', 'KategoriMateri', 'MateriItem', 'TargetJenjang',
    # Penilaian
    'ProgressJamaah', 'PenilaianAkhlaq',
    # Organisasi
    'Musyawarah', 'MusyawarahPeserta', 'MusyawarahHasil', 'Kegiatan', 'PesertaKegiatan', 'KakakAsuh', 'LimaUnsur',
    # Security
    'Users', 'Role', 'Resource', 'RolePermission', 'UserRole',
    # Sync
    'SyncLog', 'SyncConflict',
]
