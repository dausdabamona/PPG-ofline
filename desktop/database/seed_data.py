"""
Seed Data - Data Awal Sistem PPG Sorong
"""
from sqlalchemy.orm import Session
from datetime import date

from .models import (
    Jenjang, Role, Resource, RolePermission, Users, TahunAjaran,
    BidangMateri, KategoriMateri, MateriItem, Wilayah
)


def seed_initial_data(session: Session):
    """Seed semua data awal yang diperlukan sistem"""

    # Cek apakah sudah ada data
    if session.query(Jenjang).first():
        print("Data sudah ada, skip seeding...")
        return

    print("Seeding data awal...")

    # 1. Seed Jenjang
    seed_jenjang(session)

    # 2. Seed Role
    seed_roles(session)

    # 3. Seed Resource
    seed_resources(session)

    # 4. Seed Role Permissions
    seed_permissions(session)

    # 5. Seed Default Admin User
    seed_admin_user(session)

    # 6. Seed Tahun Ajaran
    seed_tahun_ajaran(session)

    # 7. Seed Bidang Materi & Kurikulum Dasar
    seed_kurikulum(session)

    # 8. Seed Wilayah Contoh
    seed_wilayah_contoh(session)

    session.commit()
    print("Seeding selesai!")


def seed_jenjang(session: Session):
    """Seed data jenjang pendidikan"""
    jenjang_data = [
        {'kode': 'BATITA', 'nama': 'Batita', 'usia_mulai': 0, 'usia_sampai': 2, 'urutan': 1},
        {'kode': 'BALITA', 'nama': 'Balita', 'usia_mulai': 2, 'usia_sampai': 5, 'urutan': 2},
        {'kode': 'CABERAWIT', 'nama': 'Caberawit', 'usia_mulai': 5, 'usia_sampai': 8, 'urutan': 3},
        {'kode': 'PRAREMAJA', 'nama': 'Pra-Remaja', 'usia_mulai': 8, 'usia_sampai': 12, 'urutan': 4},
        {'kode': 'REMAJA', 'nama': 'Remaja', 'usia_mulai': 12, 'usia_sampai': 17, 'urutan': 5},
        {'kode': 'DEWASA', 'nama': 'Dewasa', 'usia_mulai': 17, 'usia_sampai': 99, 'urutan': 6},
    ]

    for data in jenjang_data:
        session.add(Jenjang(**data))

    print(f"  - {len(jenjang_data)} jenjang ditambahkan")


def seed_roles(session: Session):
    """Seed data role"""
    role_data = [
        {'kode': 'super_admin', 'nama': 'Super Administrator', 'level': 1},
        {'kode': 'admin', 'nama': 'Administrator', 'level': 2},
        {'kode': 'muballigh', 'nama': 'Muballigh', 'level': 3},
        {'kode': 'operator', 'nama': 'Operator', 'level': 4},
        {'kode': 'viewer', 'nama': 'Viewer', 'level': 5},
    ]

    for data in role_data:
        session.add(Role(**data))

    print(f"  - {len(role_data)} role ditambahkan")


def seed_resources(session: Session):
    """Seed data resource (menu/fitur)"""
    resource_data = [
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
        {'kode': 'sync', 'nama': 'Sinkronisasi', 'urutan': 11},
        {'kode': 'settings', 'nama': 'Pengaturan', 'urutan': 12},
    ]

    for data in resource_data:
        session.add(Resource(**data))

    print(f"  - {len(resource_data)} resource ditambahkan")


def seed_permissions(session: Session):
    """Seed permissions untuk setiap role"""
    session.flush()  # Pastikan role dan resource sudah ada ID-nya

    # Ambil role dan resource
    roles = {r.kode: r for r in session.query(Role).all()}
    resources = {r.kode: r for r in session.query(Resource).all()}

    # Super Admin - Full access semua
    for resource in resources.values():
        session.add(RolePermission(
            role_id=roles['super_admin'].id,
            resource_id=resource.id,
            can_view=True,
            can_create=True,
            can_edit=True,
            can_delete=True
        ))

    # Admin - Full access kecuali settings dan users
    for kode, resource in resources.items():
        if kode in ['settings']:
            can_create = can_edit = can_delete = False
        else:
            can_create = can_edit = can_delete = True

        session.add(RolePermission(
            role_id=roles['admin'].id,
            resource_id=resource.id,
            can_view=True,
            can_create=can_create,
            can_edit=can_edit,
            can_delete=can_delete
        ))

    # Muballigh - CRUD data pengajian dan presensi
    muballigh_access = {
        'dashboard': ('V', False, False, False),
        'generus': ('V', False, False, False),
        'jamaah': ('V', False, False, False),
        'pengajian': ('VCED', True, True, True),
        'presensi': ('VCED', True, True, True),
        'penilaian': ('VCED', True, True, True),
        'kurikulum': ('V', False, False, False),
        'wilayah': ('V', False, False, False),
        'laporan': ('V', False, False, False),
        'sync': ('V', True, False, False),
    }
    for kode, (_, can_create, can_edit, can_delete) in muballigh_access.items():
        if kode in resources:
            session.add(RolePermission(
                role_id=roles['muballigh'].id,
                resource_id=resources[kode].id,
                can_view=True,
                can_create=can_create,
                can_edit=can_edit,
                can_delete=can_delete
            ))

    # Operator - Input data, tidak bisa hapus
    operator_access = {
        'dashboard': ('V', False, False, False),
        'generus': ('VCE', True, True, False),
        'jamaah': ('VCE', True, True, False),
        'pengajian': ('VCE', True, True, False),
        'presensi': ('VCE', True, True, False),
        'penilaian': ('VCE', True, True, False),
        'wilayah': ('V', False, False, False),
        'laporan': ('V', False, False, False),
        'sync': ('V', True, False, False),
    }
    for kode, (_, can_create, can_edit, can_delete) in operator_access.items():
        if kode in resources:
            session.add(RolePermission(
                role_id=roles['operator'].id,
                resource_id=resources[kode].id,
                can_view=True,
                can_create=can_create,
                can_edit=can_edit,
                can_delete=can_delete
            ))

    # Viewer - Hanya lihat
    viewer_resources = ['dashboard', 'generus', 'jamaah', 'pengajian', 'presensi', 'laporan']
    for kode in viewer_resources:
        if kode in resources:
            session.add(RolePermission(
                role_id=roles['viewer'].id,
                resource_id=resources[kode].id,
                can_view=True,
                can_create=False,
                can_edit=False,
                can_delete=False
            ))

    print("  - Role permissions dikonfigurasi")


def seed_admin_user(session: Session):
    """Seed default admin user"""
    session.flush()

    # Cek apakah sudah ada admin
    if session.query(Users).filter(Users.username == 'admin').first():
        return

    from .models import UserRole

    admin = Users(
        nama='Administrator',
        username='admin',
        phone='',
        email='admin@ppgsorong.local',
    )
    admin.set_password('admin123')  # Default password

    session.add(admin)
    session.flush()

    # Assign super_admin role
    super_admin_role = session.query(Role).filter(Role.kode == 'super_admin').first()
    if super_admin_role:
        session.add(UserRole(
            user_id=admin.id,
            role_id=super_admin_role.id,
            is_aktif=True
        ))

    print("  - Admin user dibuat (username: admin, password: admin123)")


def seed_tahun_ajaran(session: Session):
    """Seed tahun ajaran aktif"""
    current_year = date.today().year
    next_year = current_year + 1

    tahun = TahunAjaran(
        kode=f"{current_year}/{next_year}",
        nama=f"Tahun Ajaran {current_year}/{next_year}",
        tanggal_mulai=date(current_year, 7, 1),
        tanggal_selesai=date(next_year, 6, 30),
        is_aktif=True
    )
    session.add(tahun)
    print(f"  - Tahun ajaran {current_year}/{next_year} ditambahkan")


def seed_kurikulum(session: Session):
    """Seed struktur kurikulum dasar"""
    session.flush()

    # Bidang Materi
    bidang_data = [
        {'nama': 'Al-Quran', 'urutan': 1},
        {'nama': 'Hadits', 'urutan': 2},
        {'nama': 'Aqidah', 'urutan': 3},
        {'nama': 'Fiqih', 'urutan': 4},
        {'nama': 'Akhlaq', 'urutan': 5},
        {'nama': 'Doa Harian', 'urutan': 6},
    ]

    bidang_objs = {}
    for data in bidang_data:
        b = BidangMateri(**data)
        session.add(b)
        bidang_objs[data['nama']] = b

    session.flush()

    # Kategori dan Materi untuk Al-Quran
    alquran = bidang_objs['Al-Quran']

    # Kategori: Juz Amma
    juz_amma = KategoriMateri(
        bidang_id=alquran.id,
        nama='Juz Amma (Juz 30)',
        kode='JUZ30',
        urutan=1
    )
    session.add(juz_amma)
    session.flush()

    # Surah-surah dalam Juz Amma (sebagian)
    surah_juz_amma = [
        ('An-Naba', '78'), ('An-Naziat', '79'), ('Abasa', '80'),
        ('At-Takwir', '81'), ('Al-Infitar', '82'), ('Al-Muthaffifin', '83'),
        ('Al-Insyiqaq', '84'), ('Al-Buruj', '85'), ('At-Tariq', '86'),
        ('Al-Ala', '87'), ('Al-Ghasyiyah', '88'), ('Al-Fajr', '89'),
        ('Al-Balad', '90'), ('Asy-Syams', '91'), ('Al-Lail', '92'),
        ('Ad-Duha', '93'), ('Asy-Syarh', '94'), ('At-Tin', '95'),
        ('Al-Alaq', '96'), ('Al-Qadr', '97'), ('Al-Bayyinah', '98'),
        ('Az-Zalzalah', '99'), ('Al-Adiyat', '100'), ('Al-Qariah', '101'),
        ('At-Takasur', '102'), ('Al-Asr', '103'), ('Al-Humazah', '104'),
        ('Al-Fil', '105'), ('Quraisy', '106'), ('Al-Maun', '107'),
        ('Al-Kausar', '108'), ('Al-Kafirun', '109'), ('An-Nasr', '110'),
        ('Al-Lahab', '111'), ('Al-Ikhlas', '112'), ('Al-Falaq', '113'),
        ('An-Nas', '114'),
    ]

    for nama, nomor in surah_juz_amma:
        session.add(MateriItem(
            kategori_id=juz_amma.id,
            nama=f'Surah {nama}',
            nomor=nomor,
            tipe='hafalan'
        ))

    # Kategori Doa Harian
    doa = bidang_objs['Doa Harian']
    doa_kat = KategoriMateri(
        bidang_id=doa.id,
        nama='Doa Sehari-hari',
        kode='DOA',
        urutan=1
    )
    session.add(doa_kat)
    session.flush()

    doa_list = [
        'Doa Sebelum Makan', 'Doa Sesudah Makan',
        'Doa Sebelum Tidur', 'Doa Bangun Tidur',
        'Doa Masuk Masjid', 'Doa Keluar Masjid',
        'Doa Masuk Rumah', 'Doa Keluar Rumah',
        'Doa Masuk Kamar Mandi', 'Doa Keluar Kamar Mandi',
        'Doa Bercermin', 'Doa Memakai Pakaian',
        'Doa Kedua Orang Tua', 'Doa Kebaikan Dunia Akhirat',
    ]

    for i, nama in enumerate(doa_list, 1):
        session.add(MateriItem(
            kategori_id=doa_kat.id,
            nama=nama,
            nomor=str(i),
            tipe='hafalan'
        ))

    print(f"  - Kurikulum dasar ditambahkan ({len(surah_juz_amma)} surah, {len(doa_list)} doa)")


def seed_wilayah_contoh(session: Session):
    """Seed wilayah contoh"""
    # Daerah
    sorong = Wilayah(
        kode='SORONG',
        nama='Sorong',
        tingkat='daerah'
    )
    session.add(sorong)
    session.flush()

    # Desa
    desa_data = [
        {'kode': 'SORONG-01', 'nama': 'Desa Klademak', 'parent_id': sorong.id},
        {'kode': 'SORONG-02', 'nama': 'Desa Malaingkedi', 'parent_id': sorong.id},
    ]

    desa_objs = []
    for data in desa_data:
        d = Wilayah(**data, tingkat='desa')
        session.add(d)
        desa_objs.append(d)

    session.flush()

    # Kelompok
    kelompok_data = [
        {'kode': 'SORONG-01-A', 'nama': 'Kelompok Al-Ikhlas', 'parent_id': desa_objs[0].id},
        {'kode': 'SORONG-01-B', 'nama': 'Kelompok Ar-Rahman', 'parent_id': desa_objs[0].id},
        {'kode': 'SORONG-02-A', 'nama': 'Kelompok Al-Amin', 'parent_id': desa_objs[1].id},
    ]

    for data in kelompok_data:
        session.add(Wilayah(**data, tingkat='kelompok'))

    print(f"  - Wilayah contoh ditambahkan (1 daerah, 2 desa, 3 kelompok)")
