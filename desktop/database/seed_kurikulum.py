"""
Seed Data Kurikulum PPG
Berdasarkan kurikulum standar Pendidikan Pengajian Generus
"""

# Bidang Materi PPG
BIDANG_MATERI = [
    {'nama': 'Al-Quran', 'urutan': 1},
    {'nama': 'Hadits', 'urutan': 2},
    {'nama': 'Aqidah', 'urutan': 3},
    {'nama': 'Akhlaq', 'urutan': 4},
    {'nama': 'Fiqih', 'urutan': 5},
    {'nama': 'Tarikh', 'urutan': 6},
    {'nama': 'Doa Harian', 'urutan': 7},
]

# Kategori Materi per Bidang
KATEGORI_MATERI = {
    'Al-Quran': [
        {'kode': 'JUZ30', 'nama': 'Juz 30 (Juz Amma)', 'urutan': 1},
        {'kode': 'JUZ29', 'nama': 'Juz 29', 'urutan': 2},
        {'kode': 'JUZ28', 'nama': 'Juz 28', 'urutan': 3},
        {'kode': 'TAJWID', 'nama': 'Tajwid', 'urutan': 4},
        {'kode': 'TAHSIN', 'nama': 'Tahsin', 'urutan': 5},
    ],
    'Hadits': [
        {'kode': 'HAD-ARBAIN', 'nama': 'Hadits Arbain Nawawi', 'urutan': 1},
        {'kode': 'HAD-PILIHAN', 'nama': 'Hadits Pilihan', 'urutan': 2},
        {'kode': 'HAD-ADAB', 'nama': 'Hadits Adab', 'urutan': 3},
    ],
    'Aqidah': [
        {'kode': 'AQD-IMAN', 'nama': 'Rukun Iman', 'urutan': 1},
        {'kode': 'AQD-ISLAM', 'nama': 'Rukun Islam', 'urutan': 2},
        {'kode': 'AQD-IHSAN', 'nama': 'Ihsan', 'urutan': 3},
    ],
    'Akhlaq': [
        {'kode': 'AKH-MAHMUDAH', 'nama': 'Akhlaq Mahmudah', 'urutan': 1},
        {'kode': 'AKH-MAZMUMAH', 'nama': 'Akhlaq Mazmumah', 'urutan': 2},
        {'kode': 'AKH-ADAB', 'nama': 'Adab Islami', 'urutan': 3},
    ],
    'Fiqih': [
        {'kode': 'FIQ-THAHARAH', 'nama': 'Thaharah (Bersuci)', 'urutan': 1},
        {'kode': 'FIQ-SHALAT', 'nama': 'Shalat', 'urutan': 2},
        {'kode': 'FIQ-PUASA', 'nama': 'Puasa', 'urutan': 3},
        {'kode': 'FIQ-ZAKAT', 'nama': 'Zakat', 'urutan': 4},
        {'kode': 'FIQ-HAJI', 'nama': 'Haji & Umrah', 'urutan': 5},
        {'kode': 'FIQ-MUAMALAH', 'nama': 'Muamalah', 'urutan': 6},
    ],
    'Tarikh': [
        {'kode': 'TAR-NABI', 'nama': 'Sirah Nabawiyah', 'urutan': 1},
        {'kode': 'TAR-SAHABAT', 'nama': 'Kisah Sahabat', 'urutan': 2},
        {'kode': 'TAR-ANBIYA', 'nama': 'Kisah Para Nabi', 'urutan': 3},
    ],
    'Doa Harian': [
        {'kode': 'DOA-HARIAN', 'nama': 'Doa Sehari-hari', 'urutan': 1},
        {'kode': 'DOA-SHALAT', 'nama': 'Doa dalam Shalat', 'urutan': 2},
        {'kode': 'DZIKIR', 'nama': 'Dzikir & Wirid', 'urutan': 3},
    ],
}

# Materi Item - Juz 30 (Juz Amma) - 37 Surat
MATERI_JUZ_30 = [
    {'nomor': 1, 'nama': 'An-Naba (78)', 'tipe': 'hafalan'},
    {'nomor': 2, 'nama': 'An-Naziat (79)', 'tipe': 'hafalan'},
    {'nomor': 3, 'nama': 'Abasa (80)', 'tipe': 'hafalan'},
    {'nomor': 4, 'nama': 'At-Takwir (81)', 'tipe': 'hafalan'},
    {'nomor': 5, 'nama': 'Al-Infitar (82)', 'tipe': 'hafalan'},
    {'nomor': 6, 'nama': 'Al-Mutaffifin (83)', 'tipe': 'hafalan'},
    {'nomor': 7, 'nama': 'Al-Insyiqaq (84)', 'tipe': 'hafalan'},
    {'nomor': 8, 'nama': 'Al-Buruj (85)', 'tipe': 'hafalan'},
    {'nomor': 9, 'nama': 'At-Tariq (86)', 'tipe': 'hafalan'},
    {'nomor': 10, 'nama': 'Al-Ala (87)', 'tipe': 'hafalan'},
    {'nomor': 11, 'nama': 'Al-Ghasyiyah (88)', 'tipe': 'hafalan'},
    {'nomor': 12, 'nama': 'Al-Fajr (89)', 'tipe': 'hafalan'},
    {'nomor': 13, 'nama': 'Al-Balad (90)', 'tipe': 'hafalan'},
    {'nomor': 14, 'nama': 'Asy-Syams (91)', 'tipe': 'hafalan'},
    {'nomor': 15, 'nama': 'Al-Lail (92)', 'tipe': 'hafalan'},
    {'nomor': 16, 'nama': 'Ad-Duha (93)', 'tipe': 'hafalan'},
    {'nomor': 17, 'nama': 'Al-Insyirah (94)', 'tipe': 'hafalan'},
    {'nomor': 18, 'nama': 'At-Tin (95)', 'tipe': 'hafalan'},
    {'nomor': 19, 'nama': 'Al-Alaq (96)', 'tipe': 'hafalan'},
    {'nomor': 20, 'nama': 'Al-Qadr (97)', 'tipe': 'hafalan'},
    {'nomor': 21, 'nama': 'Al-Bayyinah (98)', 'tipe': 'hafalan'},
    {'nomor': 22, 'nama': 'Az-Zalzalah (99)', 'tipe': 'hafalan'},
    {'nomor': 23, 'nama': 'Al-Adiyat (100)', 'tipe': 'hafalan'},
    {'nomor': 24, 'nama': 'Al-Qariah (101)', 'tipe': 'hafalan'},
    {'nomor': 25, 'nama': 'At-Takatsur (102)', 'tipe': 'hafalan'},
    {'nomor': 26, 'nama': 'Al-Asr (103)', 'tipe': 'hafalan'},
    {'nomor': 27, 'nama': 'Al-Humazah (104)', 'tipe': 'hafalan'},
    {'nomor': 28, 'nama': 'Al-Fil (105)', 'tipe': 'hafalan'},
    {'nomor': 29, 'nama': 'Quraisy (106)', 'tipe': 'hafalan'},
    {'nomor': 30, 'nama': 'Al-Maun (107)', 'tipe': 'hafalan'},
    {'nomor': 31, 'nama': 'Al-Kautsar (108)', 'tipe': 'hafalan'},
    {'nomor': 32, 'nama': 'Al-Kafirun (109)', 'tipe': 'hafalan'},
    {'nomor': 33, 'nama': 'An-Nasr (110)', 'tipe': 'hafalan'},
    {'nomor': 34, 'nama': 'Al-Lahab (111)', 'tipe': 'hafalan'},
    {'nomor': 35, 'nama': 'Al-Ikhlas (112)', 'tipe': 'hafalan'},
    {'nomor': 36, 'nama': 'Al-Falaq (113)', 'tipe': 'hafalan'},
    {'nomor': 37, 'nama': 'An-Nas (114)', 'tipe': 'hafalan'},
]

# Materi Item - Doa Sehari-hari
MATERI_DOA_HARIAN = [
    {'nomor': 1, 'nama': 'Doa Bangun Tidur', 'tipe': 'hafalan'},
    {'nomor': 2, 'nama': 'Doa Sebelum Tidur', 'tipe': 'hafalan'},
    {'nomor': 3, 'nama': 'Doa Masuk Kamar Mandi', 'tipe': 'hafalan'},
    {'nomor': 4, 'nama': 'Doa Keluar Kamar Mandi', 'tipe': 'hafalan'},
    {'nomor': 5, 'nama': 'Doa Sebelum Makan', 'tipe': 'hafalan'},
    {'nomor': 6, 'nama': 'Doa Sesudah Makan', 'tipe': 'hafalan'},
    {'nomor': 7, 'nama': 'Doa Keluar Rumah', 'tipe': 'hafalan'},
    {'nomor': 8, 'nama': 'Doa Masuk Rumah', 'tipe': 'hafalan'},
    {'nomor': 9, 'nama': 'Doa Masuk Masjid', 'tipe': 'hafalan'},
    {'nomor': 10, 'nama': 'Doa Keluar Masjid', 'tipe': 'hafalan'},
    {'nomor': 11, 'nama': 'Doa Bercermin', 'tipe': 'hafalan'},
    {'nomor': 12, 'nama': 'Doa Memakai Pakaian', 'tipe': 'hafalan'},
    {'nomor': 13, 'nama': 'Doa Melepas Pakaian', 'tipe': 'hafalan'},
    {'nomor': 14, 'nama': 'Doa Naik Kendaraan', 'tipe': 'hafalan'},
    {'nomor': 15, 'nama': 'Doa Bepergian', 'tipe': 'hafalan'},
    {'nomor': 16, 'nama': 'Doa Ketika Hujan', 'tipe': 'hafalan'},
    {'nomor': 17, 'nama': 'Doa Setelah Hujan', 'tipe': 'hafalan'},
    {'nomor': 18, 'nama': 'Doa Ketika Bersin', 'tipe': 'hafalan'},
    {'nomor': 19, 'nama': 'Doa Menjenguk Orang Sakit', 'tipe': 'hafalan'},
    {'nomor': 20, 'nama': 'Doa Untuk Kedua Orang Tua', 'tipe': 'hafalan'},
    {'nomor': 21, 'nama': 'Doa Sebelum Belajar', 'tipe': 'hafalan'},
    {'nomor': 22, 'nama': 'Doa Sesudah Belajar', 'tipe': 'hafalan'},
    {'nomor': 23, 'nama': 'Doa Memohon Ilmu Bermanfaat', 'tipe': 'hafalan'},
    {'nomor': 24, 'nama': 'Doa Ketika Marah', 'tipe': 'hafalan'},
    {'nomor': 25, 'nama': 'Doa Ketika Takut', 'tipe': 'hafalan'},
]

# Materi Item - Hadits Arbain Nawawi (40 Hadits)
MATERI_HADITS_ARBAIN = [
    {'nomor': 1, 'nama': 'Hadits 1: Niat', 'tipe': 'hafalan'},
    {'nomor': 2, 'nama': 'Hadits 2: Islam, Iman, Ihsan', 'tipe': 'hafalan'},
    {'nomor': 3, 'nama': 'Hadits 3: Rukun Islam', 'tipe': 'hafalan'},
    {'nomor': 4, 'nama': 'Hadits 4: Penciptaan Manusia', 'tipe': 'hafalan'},
    {'nomor': 5, 'nama': 'Hadits 5: Bid\'ah', 'tipe': 'hafalan'},
    {'nomor': 6, 'nama': 'Hadits 6: Halal dan Haram', 'tipe': 'hafalan'},
    {'nomor': 7, 'nama': 'Hadits 7: Agama adalah Nasihat', 'tipe': 'hafalan'},
    {'nomor': 8, 'nama': 'Hadits 8: Kesucian Darah Muslim', 'tipe': 'hafalan'},
    {'nomor': 9, 'nama': 'Hadits 9: Larangan yang Ditinggalkan', 'tipe': 'hafalan'},
    {'nomor': 10, 'nama': 'Hadits 10: Makanan Halal', 'tipe': 'hafalan'},
    {'nomor': 11, 'nama': 'Hadits 11: Meninggalkan Syubhat', 'tipe': 'hafalan'},
    {'nomor': 12, 'nama': 'Hadits 12: Meninggalkan yang Tidak Bermanfaat', 'tipe': 'hafalan'},
    {'nomor': 13, 'nama': 'Hadits 13: Mencintai Saudara', 'tipe': 'hafalan'},
    {'nomor': 14, 'nama': 'Hadits 14: Kesucian Darah Muslim (2)', 'tipe': 'hafalan'},
    {'nomor': 15, 'nama': 'Hadits 15: Berkata Baik atau Diam', 'tipe': 'hafalan'},
    {'nomor': 16, 'nama': 'Hadits 16: Larangan Marah', 'tipe': 'hafalan'},
    {'nomor': 17, 'nama': 'Hadits 17: Berbuat Baik', 'tipe': 'hafalan'},
    {'nomor': 18, 'nama': 'Hadits 18: Takwa dan Akhlak Baik', 'tipe': 'hafalan'},
    {'nomor': 19, 'nama': 'Hadits 19: Menjaga Diri dari Allah', 'tipe': 'hafalan'},
    {'nomor': 20, 'nama': 'Hadits 20: Malu', 'tipe': 'hafalan'},
    {'nomor': 21, 'nama': 'Hadits 21: Istiqamah', 'tipe': 'hafalan'},
    {'nomor': 22, 'nama': 'Hadits 22: Jalan Menuju Surga', 'tipe': 'hafalan'},
    {'nomor': 23, 'nama': 'Hadits 23: Bersuci Setengah Iman', 'tipe': 'hafalan'},
    {'nomor': 24, 'nama': 'Hadits 24: Mengharamkan Kezaliman', 'tipe': 'hafalan'},
    {'nomor': 25, 'nama': 'Hadits 25: Sedekah', 'tipe': 'hafalan'},
    {'nomor': 26, 'nama': 'Hadits 26: Sedekah Setiap Ruas', 'tipe': 'hafalan'},
    {'nomor': 27, 'nama': 'Hadits 27: Kebaikan dan Dosa', 'tipe': 'hafalan'},
    {'nomor': 28, 'nama': 'Hadits 28: Wasiat Nabi', 'tipe': 'hafalan'},
    {'nomor': 29, 'nama': 'Hadits 29: Pintu-pintu Kebaikan', 'tipe': 'hafalan'},
    {'nomor': 30, 'nama': 'Hadits 30: Batasan Allah', 'tipe': 'hafalan'},
    {'nomor': 31, 'nama': 'Hadits 31: Zuhud', 'tipe': 'hafalan'},
    {'nomor': 32, 'nama': 'Hadits 32: Tidak Boleh Menyakiti', 'tipe': 'hafalan'},
    {'nomor': 33, 'nama': 'Hadits 33: Bukti dan Sumpah', 'tipe': 'hafalan'},
    {'nomor': 34, 'nama': 'Hadits 34: Amar Makruf Nahi Munkar', 'tipe': 'hafalan'},
    {'nomor': 35, 'nama': 'Hadits 35: Persaudaraan Muslim', 'tipe': 'hafalan'},
    {'nomor': 36, 'nama': 'Hadits 36: Membantu Sesama', 'tipe': 'hafalan'},
    {'nomor': 37, 'nama': 'Hadits 37: Kebaikan dan Keburukan', 'tipe': 'hafalan'},
    {'nomor': 38, 'nama': 'Hadits 38: Wali Allah', 'tipe': 'hafalan'},
    {'nomor': 39, 'nama': 'Hadits 39: Kesalahan dan Kelupaan', 'tipe': 'hafalan'},
    {'nomor': 40, 'nama': 'Hadits 40: Menjadi Asing', 'tipe': 'hafalan'},
    {'nomor': 41, 'nama': 'Hadits 41: Mengikuti Rasulullah', 'tipe': 'hafalan'},
    {'nomor': 42, 'nama': 'Hadits 42: Ampunan Allah', 'tipe': 'hafalan'},
]

# Materi Item - Fiqih Thaharah
MATERI_THAHARAH = [
    {'nomor': 1, 'nama': 'Pengertian Thaharah', 'tipe': 'checklist'},
    {'nomor': 2, 'nama': 'Macam-macam Air', 'tipe': 'checklist'},
    {'nomor': 3, 'nama': 'Najis dan Macamnya', 'tipe': 'checklist'},
    {'nomor': 4, 'nama': 'Cara Menghilangkan Najis', 'tipe': 'checklist'},
    {'nomor': 5, 'nama': 'Istinja', 'tipe': 'checklist'},
    {'nomor': 6, 'nama': 'Wudhu - Rukun', 'tipe': 'checklist'},
    {'nomor': 7, 'nama': 'Wudhu - Sunnah', 'tipe': 'checklist'},
    {'nomor': 8, 'nama': 'Wudhu - Pembatal', 'tipe': 'checklist'},
    {'nomor': 9, 'nama': 'Tayammum', 'tipe': 'checklist'},
    {'nomor': 10, 'nama': 'Mandi Wajib', 'tipe': 'checklist'},
    {'nomor': 11, 'nama': 'Mandi Sunnah', 'tipe': 'checklist'},
    {'nomor': 12, 'nama': 'Haid dan Nifas', 'tipe': 'checklist'},
]

# Materi Item - Fiqih Shalat
MATERI_SHALAT = [
    {'nomor': 1, 'nama': 'Pengertian Shalat', 'tipe': 'checklist'},
    {'nomor': 2, 'nama': 'Syarat Sah Shalat', 'tipe': 'checklist'},
    {'nomor': 3, 'nama': 'Syarat Wajib Shalat', 'tipe': 'checklist'},
    {'nomor': 4, 'nama': 'Rukun Shalat', 'tipe': 'checklist'},
    {'nomor': 5, 'nama': 'Sunnah Shalat', 'tipe': 'checklist'},
    {'nomor': 6, 'nama': 'Hal yang Membatalkan Shalat', 'tipe': 'checklist'},
    {'nomor': 7, 'nama': 'Waktu-waktu Shalat', 'tipe': 'checklist'},
    {'nomor': 8, 'nama': 'Shalat Berjamaah', 'tipe': 'checklist'},
    {'nomor': 9, 'nama': 'Shalat Jumat', 'tipe': 'checklist'},
    {'nomor': 10, 'nama': 'Shalat Sunnah Rawatib', 'tipe': 'checklist'},
    {'nomor': 11, 'nama': 'Shalat Dhuha', 'tipe': 'checklist'},
    {'nomor': 12, 'nama': 'Shalat Tahajud', 'tipe': 'checklist'},
    {'nomor': 13, 'nama': 'Shalat Tarawih', 'tipe': 'checklist'},
    {'nomor': 14, 'nama': 'Shalat Ied', 'tipe': 'checklist'},
    {'nomor': 15, 'nama': 'Shalat Jenazah', 'tipe': 'checklist'},
    {'nomor': 16, 'nama': 'Shalat Jamak dan Qashar', 'tipe': 'checklist'},
    {'nomor': 17, 'nama': 'Sujud Sahwi', 'tipe': 'checklist'},
    {'nomor': 18, 'nama': 'Sujud Tilawah', 'tipe': 'checklist'},
    {'nomor': 19, 'nama': 'Sujud Syukur', 'tipe': 'checklist'},
    {'nomor': 20, 'nama': 'Bacaan dalam Shalat', 'tipe': 'hafalan'},
]

# Materi Item - Akhlaq Mahmudah
MATERI_AKHLAQ_MAHMUDAH = [
    {'nomor': 1, 'nama': 'Jujur (Shidiq)', 'tipe': 'checklist'},
    {'nomor': 2, 'nama': 'Amanah', 'tipe': 'checklist'},
    {'nomor': 3, 'nama': 'Sabar', 'tipe': 'checklist'},
    {'nomor': 4, 'nama': 'Syukur', 'tipe': 'checklist'},
    {'nomor': 5, 'nama': 'Tawadhu (Rendah Hati)', 'tipe': 'checklist'},
    {'nomor': 6, 'nama': 'Ikhlas', 'tipe': 'checklist'},
    {'nomor': 7, 'nama': 'Qanaah', 'tipe': 'checklist'},
    {'nomor': 8, 'nama': 'Tawakal', 'tipe': 'checklist'},
    {'nomor': 9, 'nama': 'Dermawan', 'tipe': 'checklist'},
    {'nomor': 10, 'nama': 'Pemaaf', 'tipe': 'checklist'},
    {'nomor': 11, 'nama': 'Kasih Sayang', 'tipe': 'checklist'},
    {'nomor': 12, 'nama': 'Birrul Walidain', 'tipe': 'checklist'},
    {'nomor': 13, 'nama': 'Silaturrahim', 'tipe': 'checklist'},
    {'nomor': 14, 'nama': 'Tolong Menolong', 'tipe': 'checklist'},
    {'nomor': 15, 'nama': 'Menghormati Guru', 'tipe': 'checklist'},
]

# Materi Item - Aqidah Rukun Iman
MATERI_RUKUN_IMAN = [
    {'nomor': 1, 'nama': 'Iman kepada Allah', 'tipe': 'checklist'},
    {'nomor': 2, 'nama': 'Iman kepada Malaikat', 'tipe': 'checklist'},
    {'nomor': 3, 'nama': 'Iman kepada Kitab-kitab Allah', 'tipe': 'checklist'},
    {'nomor': 4, 'nama': 'Iman kepada Rasul-rasul Allah', 'tipe': 'checklist'},
    {'nomor': 5, 'nama': 'Iman kepada Hari Akhir', 'tipe': 'checklist'},
    {'nomor': 6, 'nama': 'Iman kepada Qada dan Qadar', 'tipe': 'checklist'},
    {'nomor': 7, 'nama': 'Nama-nama Allah (Asmaul Husna)', 'tipe': 'hafalan'},
    {'nomor': 8, 'nama': 'Sifat-sifat Allah', 'tipe': 'checklist'},
    {'nomor': 9, 'nama': 'Nama-nama Malaikat dan Tugasnya', 'tipe': 'checklist'},
    {'nomor': 10, 'nama': '25 Nabi dan Rasul', 'tipe': 'hafalan'},
]

# Materi Item - Tarikh Sirah Nabawiyah
MATERI_SIRAH = [
    {'nomor': 1, 'nama': 'Kelahiran Nabi Muhammad SAW', 'tipe': 'checklist'},
    {'nomor': 2, 'nama': 'Masa Kanak-kanak Nabi', 'tipe': 'checklist'},
    {'nomor': 3, 'nama': 'Masa Remaja dan Dewasa Nabi', 'tipe': 'checklist'},
    {'nomor': 4, 'nama': 'Pernikahan Nabi', 'tipe': 'checklist'},
    {'nomor': 5, 'nama': 'Turunnya Wahyu Pertama', 'tipe': 'checklist'},
    {'nomor': 6, 'nama': 'Dakwah Sembunyi-sembunyi', 'tipe': 'checklist'},
    {'nomor': 7, 'nama': 'Dakwah Terang-terangan', 'tipe': 'checklist'},
    {'nomor': 8, 'nama': 'Hijrah ke Habasyah', 'tipe': 'checklist'},
    {'nomor': 9, 'nama': 'Isra dan Miraj', 'tipe': 'checklist'},
    {'nomor': 10, 'nama': 'Hijrah ke Madinah', 'tipe': 'checklist'},
    {'nomor': 11, 'nama': 'Pembangunan Masjid Nabawi', 'tipe': 'checklist'},
    {'nomor': 12, 'nama': 'Perang Badar', 'tipe': 'checklist'},
    {'nomor': 13, 'nama': 'Perang Uhud', 'tipe': 'checklist'},
    {'nomor': 14, 'nama': 'Perang Khandaq', 'tipe': 'checklist'},
    {'nomor': 15, 'nama': 'Perjanjian Hudaibiyah', 'tipe': 'checklist'},
    {'nomor': 16, 'nama': 'Fathu Makkah', 'tipe': 'checklist'},
    {'nomor': 17, 'nama': 'Haji Wada', 'tipe': 'checklist'},
    {'nomor': 18, 'nama': 'Wafatnya Nabi Muhammad SAW', 'tipe': 'checklist'},
]

# Materi Item - Tajwid
MATERI_TAJWID = [
    {'nomor': 1, 'nama': 'Makharijul Huruf', 'tipe': 'checklist'},
    {'nomor': 2, 'nama': 'Sifatul Huruf', 'tipe': 'checklist'},
    {'nomor': 3, 'nama': 'Hukum Nun Mati dan Tanwin', 'tipe': 'checklist'},
    {'nomor': 4, 'nama': 'Hukum Mim Mati', 'tipe': 'checklist'},
    {'nomor': 5, 'nama': 'Idgham', 'tipe': 'checklist'},
    {'nomor': 6, 'nama': 'Iqlab', 'tipe': 'checklist'},
    {'nomor': 7, 'nama': 'Ikhfa', 'tipe': 'checklist'},
    {'nomor': 8, 'nama': 'Izhar', 'tipe': 'checklist'},
    {'nomor': 9, 'nama': 'Qalqalah', 'tipe': 'checklist'},
    {'nomor': 10, 'nama': 'Mad (Panjang Pendek)', 'tipe': 'checklist'},
    {'nomor': 11, 'nama': 'Waqaf dan Ibtida', 'tipe': 'checklist'},
    {'nomor': 12, 'nama': 'Gharib (Bacaan Asing)', 'tipe': 'checklist'},
]

# Fungsi untuk seed database
def seed_kurikulum(session):
    """Seed data kurikulum ke database"""
    from database.models import BidangMateri, KategoriMateri, MateriItem

    print("Seeding kurikulum data...")

    # Seed Bidang Materi
    bidang_map = {}
    for bidang_data in BIDANG_MATERI:
        existing = session.query(BidangMateri).filter(
            BidangMateri.nama == bidang_data['nama']
        ).first()

        if not existing:
            bidang = BidangMateri(
                nama=bidang_data['nama'],
                urutan=bidang_data['urutan'],
                is_aktif=True
            )
            session.add(bidang)
            session.flush()
            bidang_map[bidang_data['nama']] = bidang.id
            print(f"  + Bidang: {bidang_data['nama']}")
        else:
            bidang_map[bidang_data['nama']] = existing.id

    # Seed Kategori Materi
    kategori_map = {}
    for bidang_nama, kategori_list in KATEGORI_MATERI.items():
        bidang_id = bidang_map.get(bidang_nama)
        if not bidang_id:
            continue

        for kat_data in kategori_list:
            existing = session.query(KategoriMateri).filter(
                KategoriMateri.bidang_id == bidang_id,
                KategoriMateri.nama == kat_data['nama']
            ).first()

            if not existing:
                kategori = KategoriMateri(
                    bidang_id=bidang_id,
                    kode=kat_data['kode'],
                    nama=kat_data['nama'],
                    urutan=kat_data['urutan'],
                    is_aktif=True
                )
                session.add(kategori)
                session.flush()
                kategori_map[kat_data['kode']] = kategori.id
                print(f"    + Kategori: {kat_data['nama']}")
            else:
                kategori_map[kat_data['kode']] = existing.id

    # Seed Materi Items
    materi_mapping = {
        'JUZ30': MATERI_JUZ_30,
        'DOA-HARIAN': MATERI_DOA_HARIAN,
        'HAD-ARBAIN': MATERI_HADITS_ARBAIN,
        'FIQ-THAHARAH': MATERI_THAHARAH,
        'FIQ-SHALAT': MATERI_SHALAT,
        'AKH-MAHMUDAH': MATERI_AKHLAQ_MAHMUDAH,
        'AQD-IMAN': MATERI_RUKUN_IMAN,
        'TAR-NABI': MATERI_SIRAH,
        'TAJWID': MATERI_TAJWID,
    }

    for kode_kategori, materi_list in materi_mapping.items():
        kategori_id = kategori_map.get(kode_kategori)
        if not kategori_id:
            continue

        for mat_data in materi_list:
            existing = session.query(MateriItem).filter(
                MateriItem.kategori_id == kategori_id,
                MateriItem.nomor == mat_data['nomor']
            ).first()

            if not existing:
                materi = MateriItem(
                    kategori_id=kategori_id,
                    nomor=mat_data['nomor'],
                    nama=mat_data['nama'],
                    tipe=mat_data['tipe'],
                    is_aktif=True
                )
                session.add(materi)

    session.commit()
    print("Kurikulum seeding completed!")


if __name__ == '__main__':
    from database.connection import get_session
    session = get_session()
    seed_kurikulum(session)
    session.close()
