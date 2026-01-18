"""
Seed Data Kurikulum PPG Sorong
Berdasarkan dokumen Laporan Lengkap Proyek PPG Sorong
Struktur: Pilar Tri-Sukses > Bidang > Kategori > Materi Item
"""

# ============================================================
# BIDANG MATERI PPG (5 Bidang)
# ============================================================
BIDANG_MATERI = [
    {'nama': 'Alim', 'urutan': 1, 'deskripsi': 'Hafalan dan keilmuan dasar (surat, doa, dalil, tajwid)'},
    {'nama': 'Faqih', 'urutan': 2, 'deskripsi': 'Pemahaman dan praktek ibadah'},
    {'nama': 'Akhlaq', 'urutan': 3, 'deskripsi': 'Adab, tatakrama, dan 6 Thobiat Luhur'},
    {'nama': 'Kemandirian', 'urutan': 4, 'deskripsi': 'Keterampilan hidup dan ASAD Beladiri'},
    {'nama': 'Keaktifan', 'urutan': 5, 'deskripsi': 'Kehadiran dan partisipasi pengajian'},
]

# ============================================================
# KATEGORI MATERI per BIDANG
# ============================================================
KATEGORI_MATERI = {
    'Alim': [
        {'kode': 'ALM-IQR', 'nama': 'Iqro/Tilawaty', 'urutan': 1, 'tipe': 'hafalan'},
        {'kode': 'ALM-MKQ', 'nama': 'Makna Quran', 'urutan': 2, 'tipe': 'hafalan'},
        {'kode': 'ALM-MKH', 'nama': 'Makna Hadits', 'urutan': 3, 'tipe': 'hafalan'},
        {'kode': 'ALM-HFS', 'nama': 'Hafalan Surat', 'urutan': 4, 'tipe': 'hafalan'},
        {'kode': 'ALM-HDG', 'nama': 'Hafalan Doa GBMTPG', 'urutan': 5, 'tipe': 'hafalan'},
        {'kode': 'ALM-HDS', 'nama': 'Hafalan Doa Generus Sorong', 'urutan': 6, 'tipe': 'hafalan'},
        {'kode': 'ALM-HDL', 'nama': 'Hafalan Dalil GBMTPG', 'urutan': 7, 'tipe': 'hafalan'},
        {'kode': 'ALM-HDD', 'nama': 'Hafalan Dalil Generus Sorong', 'urutan': 8, 'tipe': 'hafalan'},
        {'kode': 'ALM-KLM', 'nama': 'Keilmuan GBMTPG', 'urutan': 9, 'tipe': 'checklist'},
        {'kode': 'ALM-TJW', 'nama': 'Tajwid', 'urutan': 10, 'tipe': 'checklist'},
        {'kode': 'ALM-TDR', 'nama': 'Tadarus Al-Quran', 'urutan': 11, 'tipe': 'hafalan'},
        {'kode': 'ALM-KBC', 'nama': 'Kualitas Bacaan', 'urutan': 12, 'tipe': 'level'},
        {'kode': 'ALM-PGN', 'nama': 'Praktek Pegon', 'urutan': 13, 'tipe': 'level'},
    ],
    'Faqih': [
        {'kode': 'FQH-KFH', 'nama': 'Kefahaman Agama GBMTPG', 'urutan': 1, 'tipe': 'checklist'},
        {'kode': 'FQH-PIB', 'nama': 'Praktek Ibadah GBMTPG', 'urutan': 2, 'tipe': 'checklist'},
        {'kode': 'FQH-PWS', 'nama': 'Praktek Wudhu Sholat', 'urutan': 3, 'tipe': 'level'},
        {'kode': 'FQH-4TK', 'nama': '4 Tali Keimanan', 'urutan': 4, 'tipe': 'level'},
        {'kode': 'FQH-NBP', 'nama': 'Nasehat Bernomor BPI', 'urutan': 5, 'tipe': 'hafalan'},
        {'kode': 'FQH-PJZ', 'nama': 'Praktek Perawatan Jenazah', 'urutan': 6, 'tipe': 'level'},
    ],
    'Akhlaq': [
        {'kode': 'AKH-6TL', 'nama': '6 Thobiat Luhur', 'urutan': 1, 'tipe': 'level'},
        {'kode': 'AKH-ADB', 'nama': 'Adab/Tatakrama', 'urutan': 2, 'tipe': 'checklist'},
    ],
    'Kemandirian': [
        {'kode': 'KMD-GBM', 'nama': 'Kemandirian GBMTPG', 'urutan': 1, 'tipe': 'checklist'},
        {'kode': 'KMD-ASD', 'nama': 'ASAD Beladiri', 'urutan': 2, 'tipe': 'level'},
    ],
    'Keaktifan': [
        {'kode': 'KAK-BLN', 'nama': 'Keaktifan Bulanan', 'urutan': 1, 'tipe': 'hafalan'},
    ],
}

# ============================================================
# MATERI ITEM - HAFALAN SURAT (Juz 30 / Juz Amma - 37 Surat)
# ============================================================
MATERI_HAFALAN_SURAT = [
    # Surat pendek yang biasa dihafal (urut dari belakang)
    {'nomor': 1, 'nama': 'Al-Fatihah (1)', 'tipe': 'hafalan', 'ayat': 7, 'tempat': 'Makkah'},
    {'nomor': 2, 'nama': 'An-Nas (114)', 'tipe': 'hafalan', 'ayat': 6, 'tempat': 'Madinah'},
    {'nomor': 3, 'nama': 'Al-Falaq (113)', 'tipe': 'hafalan', 'ayat': 5, 'tempat': 'Madinah'},
    {'nomor': 4, 'nama': 'Al-Ikhlas (112)', 'tipe': 'hafalan', 'ayat': 4, 'tempat': 'Makkah'},
    {'nomor': 5, 'nama': 'Al-Lahab (111)', 'tipe': 'hafalan', 'ayat': 5, 'tempat': 'Makkah'},
    {'nomor': 6, 'nama': 'An-Nasr (110)', 'tipe': 'hafalan', 'ayat': 3, 'tempat': 'Madinah'},
    {'nomor': 7, 'nama': 'Al-Kafirun (109)', 'tipe': 'hafalan', 'ayat': 6, 'tempat': 'Makkah'},
    {'nomor': 8, 'nama': 'Al-Kautsar (108)', 'tipe': 'hafalan', 'ayat': 3, 'tempat': 'Makkah'},
    {'nomor': 9, 'nama': 'Al-Maun (107)', 'tipe': 'hafalan', 'ayat': 7, 'tempat': 'Makkah'},
    {'nomor': 10, 'nama': 'Quraisy (106)', 'tipe': 'hafalan', 'ayat': 4, 'tempat': 'Makkah'},
    {'nomor': 11, 'nama': 'Al-Fil (105)', 'tipe': 'hafalan', 'ayat': 5, 'tempat': 'Makkah'},
    {'nomor': 12, 'nama': 'Al-Humazah (104)', 'tipe': 'hafalan', 'ayat': 9, 'tempat': 'Makkah'},
    {'nomor': 13, 'nama': 'Al-Asr (103)', 'tipe': 'hafalan', 'ayat': 3, 'tempat': 'Makkah'},
    {'nomor': 14, 'nama': 'At-Takatsur (102)', 'tipe': 'hafalan', 'ayat': 8, 'tempat': 'Makkah'},
    {'nomor': 15, 'nama': 'Al-Qariah (101)', 'tipe': 'hafalan', 'ayat': 11, 'tempat': 'Makkah'},
    {'nomor': 16, 'nama': 'Al-Adiyat (100)', 'tipe': 'hafalan', 'ayat': 11, 'tempat': 'Makkah'},
    {'nomor': 17, 'nama': 'Az-Zalzalah (99)', 'tipe': 'hafalan', 'ayat': 8, 'tempat': 'Madinah'},
    {'nomor': 18, 'nama': 'Al-Bayyinah (98)', 'tipe': 'hafalan', 'ayat': 8, 'tempat': 'Madinah'},
    {'nomor': 19, 'nama': 'Al-Qadr (97)', 'tipe': 'hafalan', 'ayat': 5, 'tempat': 'Makkah'},
    {'nomor': 20, 'nama': 'Al-Alaq (96)', 'tipe': 'hafalan', 'ayat': 19, 'tempat': 'Makkah'},
    {'nomor': 21, 'nama': 'At-Tin (95)', 'tipe': 'hafalan', 'ayat': 8, 'tempat': 'Makkah'},
    {'nomor': 22, 'nama': 'Al-Insyirah (94)', 'tipe': 'hafalan', 'ayat': 8, 'tempat': 'Makkah'},
    {'nomor': 23, 'nama': 'Ad-Dhuha (93)', 'tipe': 'hafalan', 'ayat': 11, 'tempat': 'Makkah'},
    {'nomor': 24, 'nama': 'Al-Lail (92)', 'tipe': 'hafalan', 'ayat': 21, 'tempat': 'Makkah'},
    {'nomor': 25, 'nama': 'Asy-Syams (91)', 'tipe': 'hafalan', 'ayat': 15, 'tempat': 'Makkah'},
    {'nomor': 26, 'nama': 'Al-Balad (90)', 'tipe': 'hafalan', 'ayat': 20, 'tempat': 'Makkah'},
    {'nomor': 27, 'nama': 'Al-Fajr (89)', 'tipe': 'hafalan', 'ayat': 30, 'tempat': 'Makkah'},
    {'nomor': 28, 'nama': 'Al-Ghasyiyah (88)', 'tipe': 'hafalan', 'ayat': 26, 'tempat': 'Makkah'},
    {'nomor': 29, 'nama': 'Al-Ala (87)', 'tipe': 'hafalan', 'ayat': 19, 'tempat': 'Makkah'},
    {'nomor': 30, 'nama': 'At-Tariq (86)', 'tipe': 'hafalan', 'ayat': 17, 'tempat': 'Makkah'},
    {'nomor': 31, 'nama': 'Al-Buruj (85)', 'tipe': 'hafalan', 'ayat': 22, 'tempat': 'Makkah'},
    {'nomor': 32, 'nama': 'Al-Insyiqaq (84)', 'tipe': 'hafalan', 'ayat': 25, 'tempat': 'Makkah'},
    {'nomor': 33, 'nama': 'Al-Mutaffifin (83)', 'tipe': 'hafalan', 'ayat': 36, 'tempat': 'Makkah'},
    {'nomor': 34, 'nama': 'Al-Infitar (82)', 'tipe': 'hafalan', 'ayat': 19, 'tempat': 'Makkah'},
    {'nomor': 35, 'nama': 'At-Takwir (81)', 'tipe': 'hafalan', 'ayat': 29, 'tempat': 'Makkah'},
    {'nomor': 36, 'nama': 'Abasa (80)', 'tipe': 'hafalan', 'ayat': 42, 'tempat': 'Makkah'},
    {'nomor': 37, 'nama': 'An-Naziat (79)', 'tipe': 'hafalan', 'ayat': 46, 'tempat': 'Makkah'},
    {'nomor': 38, 'nama': 'An-Naba (78)', 'tipe': 'hafalan', 'ayat': 40, 'tempat': 'Makkah'},
    # Surat tambahan untuk target 45 surat
    {'nomor': 39, 'nama': 'Al-Mursalat (77)', 'tipe': 'hafalan', 'ayat': 50, 'tempat': 'Makkah'},
    {'nomor': 40, 'nama': 'Al-Insan (76)', 'tipe': 'hafalan', 'ayat': 31, 'tempat': 'Madinah'},
    {'nomor': 41, 'nama': 'Al-Qiyamah (75)', 'tipe': 'hafalan', 'ayat': 40, 'tempat': 'Makkah'},
    {'nomor': 42, 'nama': 'Al-Muddatstsir (74)', 'tipe': 'hafalan', 'ayat': 56, 'tempat': 'Makkah'},
    {'nomor': 43, 'nama': 'Al-Muzzammil (73)', 'tipe': 'hafalan', 'ayat': 20, 'tempat': 'Makkah'},
    {'nomor': 44, 'nama': 'Al-Jin (72)', 'tipe': 'hafalan', 'ayat': 28, 'tempat': 'Makkah'},
    {'nomor': 45, 'nama': 'Nuh (71)', 'tipe': 'hafalan', 'ayat': 28, 'tempat': 'Makkah'},
]

# ============================================================
# MATERI ITEM - HAFALAN DOA GBMTPG (11 Doa)
# ============================================================
MATERI_DOA_GBMTPG = [
    {'nomor': 1, 'nama': 'Doa Sebelum Makan', 'tipe': 'hafalan'},
    {'nomor': 2, 'nama': 'Doa Sesudah Makan', 'tipe': 'hafalan'},
    {'nomor': 3, 'nama': 'Doa Sebelum Tidur', 'tipe': 'hafalan'},
    {'nomor': 4, 'nama': 'Doa Bangun Tidur', 'tipe': 'hafalan'},
    {'nomor': 5, 'nama': 'Doa Masuk Masjid', 'tipe': 'hafalan'},
    {'nomor': 6, 'nama': 'Doa Keluar Masjid', 'tipe': 'hafalan'},
    {'nomor': 7, 'nama': 'Doa Masuk WC', 'tipe': 'hafalan'},
    {'nomor': 8, 'nama': 'Doa Keluar WC', 'tipe': 'hafalan'},
    {'nomor': 9, 'nama': 'Doa Kedua Orang Tua', 'tipe': 'hafalan'},
    {'nomor': 10, 'nama': 'Doa Kebaikan Dunia Akhirat', 'tipe': 'hafalan'},
    {'nomor': 11, 'nama': 'Asmaul Husna', 'tipe': 'hafalan'},
]

# ============================================================
# MATERI ITEM - HAFALAN DOA GENERUS SORONG (39 Doa)
# ============================================================
MATERI_DOA_GENERUS_SORONG = [
    {'nomor': 1, 'nama': 'Doa Sebelum Makan', 'tipe': 'hafalan'},
    {'nomor': 2, 'nama': 'Doa Sesudah Makan', 'tipe': 'hafalan'},
    {'nomor': 3, 'nama': 'Doa Sebelum Tidur', 'tipe': 'hafalan'},
    {'nomor': 4, 'nama': 'Doa Bangun Tidur', 'tipe': 'hafalan'},
    {'nomor': 5, 'nama': 'Doa Masuk Masjid', 'tipe': 'hafalan'},
    {'nomor': 6, 'nama': 'Doa Keluar Masjid', 'tipe': 'hafalan'},
    {'nomor': 7, 'nama': 'Doa Masuk Rumah', 'tipe': 'hafalan'},
    {'nomor': 8, 'nama': 'Doa Keluar Rumah', 'tipe': 'hafalan'},
    {'nomor': 9, 'nama': 'Doa Masuk WC', 'tipe': 'hafalan'},
    {'nomor': 10, 'nama': 'Doa Keluar WC', 'tipe': 'hafalan'},
    {'nomor': 11, 'nama': 'Doa Bercermin', 'tipe': 'hafalan'},
    {'nomor': 12, 'nama': 'Doa Memakai Pakaian', 'tipe': 'hafalan'},
    {'nomor': 13, 'nama': 'Doa Melepas Pakaian', 'tipe': 'hafalan'},
    {'nomor': 14, 'nama': 'Doa Naik Kendaraan', 'tipe': 'hafalan'},
    {'nomor': 15, 'nama': 'Doa Bepergian', 'tipe': 'hafalan'},
    {'nomor': 16, 'nama': 'Doa Ketika Hujan Turun', 'tipe': 'hafalan'},
    {'nomor': 17, 'nama': 'Doa Setelah Hujan', 'tipe': 'hafalan'},
    {'nomor': 18, 'nama': 'Doa Ketika Petir', 'tipe': 'hafalan'},
    {'nomor': 19, 'nama': 'Doa Ketika Bersin', 'tipe': 'hafalan'},
    {'nomor': 20, 'nama': 'Doa Menjenguk Orang Sakit', 'tipe': 'hafalan'},
    {'nomor': 21, 'nama': 'Doa Mohon Kesembuhan', 'tipe': 'hafalan'},
    {'nomor': 22, 'nama': 'Doa Kedua Orang Tua', 'tipe': 'hafalan'},
    {'nomor': 23, 'nama': 'Doa Kebaikan Dunia Akhirat', 'tipe': 'hafalan'},
    {'nomor': 24, 'nama': 'Doa Sebelum Belajar', 'tipe': 'hafalan'},
    {'nomor': 25, 'nama': 'Doa Sesudah Belajar', 'tipe': 'hafalan'},
    {'nomor': 26, 'nama': 'Doa Mohon Ilmu Bermanfaat', 'tipe': 'hafalan'},
    {'nomor': 27, 'nama': 'Doa Ketika Marah', 'tipe': 'hafalan'},
    {'nomor': 28, 'nama': 'Doa Ketika Takut', 'tipe': 'hafalan'},
    {'nomor': 29, 'nama': 'Doa Ketika Gelisah', 'tipe': 'hafalan'},
    {'nomor': 30, 'nama': 'Doa Pagi Hari', 'tipe': 'hafalan'},
    {'nomor': 31, 'nama': 'Doa Sore Hari', 'tipe': 'hafalan'},
    {'nomor': 32, 'nama': 'Doa Sebelum Wudhu', 'tipe': 'hafalan'},
    {'nomor': 33, 'nama': 'Doa Sesudah Wudhu', 'tipe': 'hafalan'},
    {'nomor': 34, 'nama': 'Doa Iftitah', 'tipe': 'hafalan'},
    {'nomor': 35, 'nama': 'Doa Qunut', 'tipe': 'hafalan'},
    {'nomor': 36, 'nama': 'Doa Tahiyat Awal', 'tipe': 'hafalan'},
    {'nomor': 37, 'nama': 'Doa Tahiyat Akhir', 'tipe': 'hafalan'},
    {'nomor': 38, 'nama': 'Doa Setelah Sholat', 'tipe': 'hafalan'},
    {'nomor': 39, 'nama': 'Doa Penutup Majlis', 'tipe': 'hafalan'},
]

# ============================================================
# MATERI ITEM - HAFALAN DALIL (34 Dalil)
# ============================================================
MATERI_DALIL = [
    {'nomor': 1, 'nama': 'Dalil Bersuci/Thaharah', 'tipe': 'hafalan'},
    {'nomor': 2, 'nama': 'Dalil Wudhu', 'tipe': 'hafalan'},
    {'nomor': 3, 'nama': 'Dalil Tayammum', 'tipe': 'hafalan'},
    {'nomor': 4, 'nama': 'Dalil Sholat', 'tipe': 'hafalan'},
    {'nomor': 5, 'nama': 'Dalil Sholat Berjamaah', 'tipe': 'hafalan'},
    {'nomor': 6, 'nama': 'Dalil Sholat Jumat', 'tipe': 'hafalan'},
    {'nomor': 7, 'nama': 'Dalil Puasa', 'tipe': 'hafalan'},
    {'nomor': 8, 'nama': 'Dalil Puasa Ramadhan', 'tipe': 'hafalan'},
    {'nomor': 9, 'nama': 'Dalil Zakat', 'tipe': 'hafalan'},
    {'nomor': 10, 'nama': 'Dalil Zakat Fitrah', 'tipe': 'hafalan'},
    {'nomor': 11, 'nama': 'Dalil Haji', 'tipe': 'hafalan'},
    {'nomor': 12, 'nama': 'Dalil Umrah', 'tipe': 'hafalan'},
    {'nomor': 13, 'nama': 'Dalil Birrul Walidain', 'tipe': 'hafalan'},
    {'nomor': 14, 'nama': 'Dalil Silaturrahim', 'tipe': 'hafalan'},
    {'nomor': 15, 'nama': 'Dalil Menuntut Ilmu', 'tipe': 'hafalan'},
    {'nomor': 16, 'nama': 'Dalil Menjaga Lisan', 'tipe': 'hafalan'},
    {'nomor': 17, 'nama': 'Dalil Kejujuran', 'tipe': 'hafalan'},
    {'nomor': 18, 'nama': 'Dalil Amanah', 'tipe': 'hafalan'},
    {'nomor': 19, 'nama': 'Dalil Sabar', 'tipe': 'hafalan'},
    {'nomor': 20, 'nama': 'Dalil Syukur', 'tipe': 'hafalan'},
    {'nomor': 21, 'nama': 'Dalil Tawakkal', 'tipe': 'hafalan'},
    {'nomor': 22, 'nama': 'Dalil Ikhlas', 'tipe': 'hafalan'},
    {'nomor': 23, 'nama': 'Dalil Taubat', 'tipe': 'hafalan'},
    {'nomor': 24, 'nama': 'Dalil Larangan Riba', 'tipe': 'hafalan'},
    {'nomor': 25, 'nama': 'Dalil Jual Beli', 'tipe': 'hafalan'},
    {'nomor': 26, 'nama': 'Dalil Menutup Aurat', 'tipe': 'hafalan'},
    {'nomor': 27, 'nama': 'Dalil Menjaga Pandangan', 'tipe': 'hafalan'},
    {'nomor': 28, 'nama': 'Dalil Larangan Zina', 'tipe': 'hafalan'},
    {'nomor': 29, 'nama': 'Dalil Persaudaraan', 'tipe': 'hafalan'},
    {'nomor': 30, 'nama': 'Dalil Tolong Menolong', 'tipe': 'hafalan'},
    {'nomor': 31, 'nama': 'Dalil Larangan Ghibah', 'tipe': 'hafalan'},
    {'nomor': 32, 'nama': 'Dalil Larangan Hasad', 'tipe': 'hafalan'},
    {'nomor': 33, 'nama': 'Dalil Larangan Sombong', 'tipe': 'hafalan'},
    {'nomor': 34, 'nama': 'Dalil Hari Kiamat', 'tipe': 'hafalan'},
]

# ============================================================
# MATERI ITEM - TAJWID (30 Materi)
# ============================================================
MATERI_TAJWID = [
    {'nomor': 1, 'nama': 'Pengertian Tajwid', 'tipe': 'checklist'},
    {'nomor': 2, 'nama': 'Hukum Mempelajari Tajwid', 'tipe': 'checklist'},
    {'nomor': 3, 'nama': 'Makharijul Huruf - Halq', 'tipe': 'checklist'},
    {'nomor': 4, 'nama': 'Makharijul Huruf - Lisan', 'tipe': 'checklist'},
    {'nomor': 5, 'nama': 'Makharijul Huruf - Syafatain', 'tipe': 'checklist'},
    {'nomor': 6, 'nama': 'Makharijul Huruf - Jauf', 'tipe': 'checklist'},
    {'nomor': 7, 'nama': 'Makharijul Huruf - Khaisyum', 'tipe': 'checklist'},
    {'nomor': 8, 'nama': 'Sifatul Huruf - Hams & Jahr', 'tipe': 'checklist'},
    {'nomor': 9, 'nama': 'Sifatul Huruf - Syiddah & Rakhawah', 'tipe': 'checklist'},
    {'nomor': 10, 'nama': 'Sifatul Huruf - Isti\'la & Istifal', 'tipe': 'checklist'},
    {'nomor': 11, 'nama': 'Hukum Nun Mati/Tanwin - Izhar', 'tipe': 'checklist'},
    {'nomor': 12, 'nama': 'Hukum Nun Mati/Tanwin - Idgham', 'tipe': 'checklist'},
    {'nomor': 13, 'nama': 'Hukum Nun Mati/Tanwin - Iqlab', 'tipe': 'checklist'},
    {'nomor': 14, 'nama': 'Hukum Nun Mati/Tanwin - Ikhfa', 'tipe': 'checklist'},
    {'nomor': 15, 'nama': 'Hukum Mim Mati - Ikhfa Syafawi', 'tipe': 'checklist'},
    {'nomor': 16, 'nama': 'Hukum Mim Mati - Idgham Mimi', 'tipe': 'checklist'},
    {'nomor': 17, 'nama': 'Hukum Mim Mati - Izhar Syafawi', 'tipe': 'checklist'},
    {'nomor': 18, 'nama': 'Qalqalah Sughra', 'tipe': 'checklist'},
    {'nomor': 19, 'nama': 'Qalqalah Kubra', 'tipe': 'checklist'},
    {'nomor': 20, 'nama': 'Mad Thabi\'i (Asli)', 'tipe': 'checklist'},
    {'nomor': 21, 'nama': 'Mad Wajib Muttashil', 'tipe': 'checklist'},
    {'nomor': 22, 'nama': 'Mad Jaiz Munfashil', 'tipe': 'checklist'},
    {'nomor': 23, 'nama': 'Mad Lazim', 'tipe': 'checklist'},
    {'nomor': 24, 'nama': 'Mad Aridh Lissukun', 'tipe': 'checklist'},
    {'nomor': 25, 'nama': 'Mad Iwadh', 'tipe': 'checklist'},
    {'nomor': 26, 'nama': 'Mad Badal', 'tipe': 'checklist'},
    {'nomor': 27, 'nama': 'Waqaf dan Ibtida', 'tipe': 'checklist'},
    {'nomor': 28, 'nama': 'Tanda-tanda Waqaf', 'tipe': 'checklist'},
    {'nomor': 29, 'nama': 'Gharib - Saktah', 'tipe': 'checklist'},
    {'nomor': 30, 'nama': 'Gharib - Imalah', 'tipe': 'checklist'},
]

# ============================================================
# MATERI ITEM - KEFAHAMAN AGAMA GBMTPG (35 Materi)
# ============================================================
MATERI_KEFAHAMAN_AGAMA = [
    {'nomor': 1, 'nama': 'Rukun Islam', 'tipe': 'checklist'},
    {'nomor': 2, 'nama': 'Rukun Iman', 'tipe': 'checklist'},
    {'nomor': 3, 'nama': 'Pengertian Syahadat', 'tipe': 'checklist'},
    {'nomor': 4, 'nama': 'Makna Syahadat', 'tipe': 'checklist'},
    {'nomor': 5, 'nama': 'Pengertian Sholat', 'tipe': 'checklist'},
    {'nomor': 6, 'nama': 'Syarat Sah Sholat', 'tipe': 'checklist'},
    {'nomor': 7, 'nama': 'Syarat Wajib Sholat', 'tipe': 'checklist'},
    {'nomor': 8, 'nama': 'Rukun Sholat', 'tipe': 'checklist'},
    {'nomor': 9, 'nama': 'Sunnah Sholat', 'tipe': 'checklist'},
    {'nomor': 10, 'nama': 'Hal Membatalkan Sholat', 'tipe': 'checklist'},
    {'nomor': 11, 'nama': 'Waktu-waktu Sholat', 'tipe': 'checklist'},
    {'nomor': 12, 'nama': 'Pengertian Puasa', 'tipe': 'checklist'},
    {'nomor': 13, 'nama': 'Syarat Wajib Puasa', 'tipe': 'checklist'},
    {'nomor': 14, 'nama': 'Rukun Puasa', 'tipe': 'checklist'},
    {'nomor': 15, 'nama': 'Hal Membatalkan Puasa', 'tipe': 'checklist'},
    {'nomor': 16, 'nama': 'Sunnah Puasa', 'tipe': 'checklist'},
    {'nomor': 17, 'nama': 'Pengertian Zakat', 'tipe': 'checklist'},
    {'nomor': 18, 'nama': 'Jenis-jenis Zakat', 'tipe': 'checklist'},
    {'nomor': 19, 'nama': 'Mustahiq Zakat', 'tipe': 'checklist'},
    {'nomor': 20, 'nama': 'Nisab Zakat', 'tipe': 'checklist'},
    {'nomor': 21, 'nama': 'Pengertian Haji', 'tipe': 'checklist'},
    {'nomor': 22, 'nama': 'Syarat Wajib Haji', 'tipe': 'checklist'},
    {'nomor': 23, 'nama': 'Rukun Haji', 'tipe': 'checklist'},
    {'nomor': 24, 'nama': 'Wajib Haji', 'tipe': 'checklist'},
    {'nomor': 25, 'nama': 'Larangan Ihram', 'tipe': 'checklist'},
    {'nomor': 26, 'nama': 'Iman kepada Allah', 'tipe': 'checklist'},
    {'nomor': 27, 'nama': 'Iman kepada Malaikat', 'tipe': 'checklist'},
    {'nomor': 28, 'nama': 'Iman kepada Kitab', 'tipe': 'checklist'},
    {'nomor': 29, 'nama': 'Iman kepada Rasul', 'tipe': 'checklist'},
    {'nomor': 30, 'nama': 'Iman kepada Hari Akhir', 'tipe': 'checklist'},
    {'nomor': 31, 'nama': 'Iman kepada Qadha Qadar', 'tipe': 'checklist'},
    {'nomor': 32, 'nama': '25 Nabi dan Rasul', 'tipe': 'checklist'},
    {'nomor': 33, 'nama': '10 Malaikat dan Tugasnya', 'tipe': 'checklist'},
    {'nomor': 34, 'nama': '4 Kitab Allah', 'tipe': 'checklist'},
    {'nomor': 35, 'nama': 'Tanda-tanda Hari Kiamat', 'tipe': 'checklist'},
]

# ============================================================
# MATERI ITEM - PRAKTEK IBADAH GBMTPG (20 Materi)
# ============================================================
MATERI_PRAKTEK_IBADAH = [
    {'nomor': 1, 'nama': 'Praktek Wudhu', 'tipe': 'checklist'},
    {'nomor': 2, 'nama': 'Praktek Tayammum', 'tipe': 'checklist'},
    {'nomor': 3, 'nama': 'Praktek Sholat Subuh', 'tipe': 'checklist'},
    {'nomor': 4, 'nama': 'Praktek Sholat Dzuhur', 'tipe': 'checklist'},
    {'nomor': 5, 'nama': 'Praktek Sholat Ashar', 'tipe': 'checklist'},
    {'nomor': 6, 'nama': 'Praktek Sholat Maghrib', 'tipe': 'checklist'},
    {'nomor': 7, 'nama': 'Praktek Sholat Isya', 'tipe': 'checklist'},
    {'nomor': 8, 'nama': 'Praktek Sholat Berjamaah', 'tipe': 'checklist'},
    {'nomor': 9, 'nama': 'Praktek Sholat Dhuha', 'tipe': 'checklist'},
    {'nomor': 10, 'nama': 'Praktek Sholat Tahajud', 'tipe': 'checklist'},
    {'nomor': 11, 'nama': 'Praktek Sholat Rawatib', 'tipe': 'checklist'},
    {'nomor': 12, 'nama': 'Praktek Sholat Jenazah', 'tipe': 'checklist'},
    {'nomor': 13, 'nama': 'Praktek Sholat Ied', 'tipe': 'checklist'},
    {'nomor': 14, 'nama': 'Praktek Sholat Tarawih', 'tipe': 'checklist'},
    {'nomor': 15, 'nama': 'Praktek Sujud Sahwi', 'tipe': 'checklist'},
    {'nomor': 16, 'nama': 'Praktek Sujud Tilawah', 'tipe': 'checklist'},
    {'nomor': 17, 'nama': 'Praktek Dzikir Pagi Petang', 'tipe': 'checklist'},
    {'nomor': 18, 'nama': 'Praktek Tilawah Al-Quran', 'tipe': 'checklist'},
    {'nomor': 19, 'nama': 'Praktek Adzan', 'tipe': 'checklist'},
    {'nomor': 20, 'nama': 'Praktek Iqamah', 'tipe': 'checklist'},
]

# ============================================================
# MATERI ITEM - 6 THOBIAT LUHUR
# ============================================================
MATERI_6_THOBIAT = [
    {'nomor': 1, 'nama': 'Shiddiq (Kejujuran)', 'tipe': 'level'},
    {'nomor': 2, 'nama': 'Amanah (Dapat Dipercaya)', 'tipe': 'level'},
    {'nomor': 3, 'nama': 'Tabligh (Menyampaikan)', 'tipe': 'level'},
    {'nomor': 4, 'nama': 'Fathonah (Cerdas)', 'tipe': 'level'},
    {'nomor': 5, 'nama': 'Sabar', 'tipe': 'level'},
    {'nomor': 6, 'nama': 'Syukur', 'tipe': 'level'},
]

# ============================================================
# MATERI ITEM - 4 TALI KEIMANAN
# ============================================================
MATERI_4_TALI_KEIMANAN = [
    {'nomor': 1, 'nama': 'Iman kepada Allah', 'tipe': 'level'},
    {'nomor': 2, 'nama': 'Iman kepada Malaikat', 'tipe': 'level'},
    {'nomor': 3, 'nama': 'Iman kepada Kitab', 'tipe': 'level'},
    {'nomor': 4, 'nama': 'Iman kepada Rasul', 'tipe': 'level'},
]

# ============================================================
# MATERI ITEM - ADAB/TATAKRAMA (120 Materi)
# ============================================================
MATERI_ADAB = [
    {'nomor': 1, 'nama': 'Adab kepada Allah', 'tipe': 'checklist'},
    {'nomor': 2, 'nama': 'Adab kepada Rasulullah', 'tipe': 'checklist'},
    {'nomor': 3, 'nama': 'Adab kepada Al-Quran', 'tipe': 'checklist'},
    {'nomor': 4, 'nama': 'Adab kepada Orang Tua', 'tipe': 'checklist'},
    {'nomor': 5, 'nama': 'Adab kepada Guru/Ustadz', 'tipe': 'checklist'},
    {'nomor': 6, 'nama': 'Adab kepada Orang yang Lebih Tua', 'tipe': 'checklist'},
    {'nomor': 7, 'nama': 'Adab kepada Teman Sebaya', 'tipe': 'checklist'},
    {'nomor': 8, 'nama': 'Adab kepada yang Lebih Muda', 'tipe': 'checklist'},
    {'nomor': 9, 'nama': 'Adab kepada Tetangga', 'tipe': 'checklist'},
    {'nomor': 10, 'nama': 'Adab kepada Tamu', 'tipe': 'checklist'},
    {'nomor': 11, 'nama': 'Adab Makan dan Minum', 'tipe': 'checklist'},
    {'nomor': 12, 'nama': 'Adab Tidur', 'tipe': 'checklist'},
    {'nomor': 13, 'nama': 'Adab Bangun Tidur', 'tipe': 'checklist'},
    {'nomor': 14, 'nama': 'Adab Berpakaian', 'tipe': 'checklist'},
    {'nomor': 15, 'nama': 'Adab Berbicara', 'tipe': 'checklist'},
    {'nomor': 16, 'nama': 'Adab Mendengarkan', 'tipe': 'checklist'},
    {'nomor': 17, 'nama': 'Adab Bertanya', 'tipe': 'checklist'},
    {'nomor': 18, 'nama': 'Adab Menjawab', 'tipe': 'checklist'},
    {'nomor': 19, 'nama': 'Adab dalam Majelis', 'tipe': 'checklist'},
    {'nomor': 20, 'nama': 'Adab di Masjid', 'tipe': 'checklist'},
    {'nomor': 21, 'nama': 'Adab di Sekolah', 'tipe': 'checklist'},
    {'nomor': 22, 'nama': 'Adab di Rumah', 'tipe': 'checklist'},
    {'nomor': 23, 'nama': 'Adab di Jalan', 'tipe': 'checklist'},
    {'nomor': 24, 'nama': 'Adab di Kendaraan', 'tipe': 'checklist'},
    {'nomor': 25, 'nama': 'Adab Masuk Rumah Orang', 'tipe': 'checklist'},
    {'nomor': 26, 'nama': 'Adab Bersin', 'tipe': 'checklist'},
    {'nomor': 27, 'nama': 'Adab Menguap', 'tipe': 'checklist'},
    {'nomor': 28, 'nama': 'Adab Berpakaian Ihram', 'tipe': 'checklist'},
    {'nomor': 29, 'nama': 'Adab Mengucapkan Salam', 'tipe': 'checklist'},
    {'nomor': 30, 'nama': 'Adab Menjawab Salam', 'tipe': 'checklist'},
    {'nomor': 31, 'nama': 'Adab Berjabat Tangan', 'tipe': 'checklist'},
    {'nomor': 32, 'nama': 'Adab Meminta Izin', 'tipe': 'checklist'},
    {'nomor': 33, 'nama': 'Adab Berkunjung', 'tipe': 'checklist'},
    {'nomor': 34, 'nama': 'Adab Menerima Tamu', 'tipe': 'checklist'},
    {'nomor': 35, 'nama': 'Adab Memberi dan Menerima', 'tipe': 'checklist'},
]

# ============================================================
# MATERI ITEM - KEMANDIRIAN GBMTPG (25 Materi)
# ============================================================
MATERI_KEMANDIRIAN = [
    {'nomor': 1, 'nama': 'Mandi Sendiri', 'tipe': 'checklist'},
    {'nomor': 2, 'nama': 'Memakai Baju Sendiri', 'tipe': 'checklist'},
    {'nomor': 3, 'nama': 'Makan Sendiri', 'tipe': 'checklist'},
    {'nomor': 4, 'nama': 'Merapikan Tempat Tidur', 'tipe': 'checklist'},
    {'nomor': 5, 'nama': 'Menyapu Lantai', 'tipe': 'checklist'},
    {'nomor': 6, 'nama': 'Mencuci Piring', 'tipe': 'checklist'},
    {'nomor': 7, 'nama': 'Mencuci Pakaian Sendiri', 'tipe': 'checklist'},
    {'nomor': 8, 'nama': 'Menyetrika Pakaian', 'tipe': 'checklist'},
    {'nomor': 9, 'nama': 'Memasak Nasi', 'tipe': 'checklist'},
    {'nomor': 10, 'nama': 'Memasak Lauk Sederhana', 'tipe': 'checklist'},
    {'nomor': 11, 'nama': 'Mengatur Keuangan', 'tipe': 'checklist'},
    {'nomor': 12, 'nama': 'Menabung', 'tipe': 'checklist'},
    {'nomor': 13, 'nama': 'Belanja Kebutuhan', 'tipe': 'checklist'},
    {'nomor': 14, 'nama': 'Menjaga Kesehatan', 'tipe': 'checklist'},
    {'nomor': 15, 'nama': 'Olahraga Teratur', 'tipe': 'checklist'},
    {'nomor': 16, 'nama': 'Berkomunikasi Baik', 'tipe': 'checklist'},
    {'nomor': 17, 'nama': 'Menyelesaikan Masalah', 'tipe': 'checklist'},
    {'nomor': 18, 'nama': 'Mengambil Keputusan', 'tipe': 'checklist'},
    {'nomor': 19, 'nama': 'Bekerja dalam Tim', 'tipe': 'checklist'},
    {'nomor': 20, 'nama': 'Memimpin Kelompok', 'tipe': 'checklist'},
    {'nomor': 21, 'nama': 'Berbicara di Depan Umum', 'tipe': 'checklist'},
    {'nomor': 22, 'nama': 'Menulis dengan Baik', 'tipe': 'checklist'},
    {'nomor': 23, 'nama': 'Menggunakan Teknologi', 'tipe': 'checklist'},
    {'nomor': 24, 'nama': 'Berwirausaha Sederhana', 'tipe': 'checklist'},
    {'nomor': 25, 'nama': 'Menolong Orang Lain', 'tipe': 'checklist'},
]

# ============================================================
# MATERI ITEM - ASAD BELADIRI (7 Jurus)
# ============================================================
MATERI_ASAD = [
    {'nomor': 1, 'nama': 'Jurus 1 - Dasar', 'tipe': 'level'},
    {'nomor': 2, 'nama': 'Jurus 2 - Pertahanan', 'tipe': 'level'},
    {'nomor': 3, 'nama': 'Jurus 3 - Serangan', 'tipe': 'level'},
    {'nomor': 4, 'nama': 'Jurus 4 - Kombinasi', 'tipe': 'level'},
    {'nomor': 5, 'nama': 'Jurus 5 - Lanjutan', 'tipe': 'level'},
    {'nomor': 6, 'nama': 'Jurus 6 - Mahir', 'tipe': 'level'},
    {'nomor': 7, 'nama': 'Jurus 7 - Master', 'tipe': 'level'},
]

# ============================================================
# MATERI ITEM - NASEHAT BERNOMOR BPI (95 Nasehat)
# ============================================================
MATERI_NASEHAT_BPI = [
    {'nomor': i, 'nama': f'Nasehat BPI {i}', 'tipe': 'hafalan'}
    for i in range(1, 96)
]

# ============================================================
# FUNGSI SEED DATABASE
# ============================================================
def seed_kurikulum(session):
    """Seed data kurikulum ke database"""
    from database.models import BidangMateri, KategoriMateri, MateriItem

    print("Seeding kurikulum data PPG Sorong...")

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
                KategoriMateri.kode == kat_data['kode']
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

    # Mapping kategori kode ke materi list
    materi_mapping = {
        'ALM-HFS': MATERI_HAFALAN_SURAT,
        'ALM-HDG': MATERI_DOA_GBMTPG,
        'ALM-HDS': MATERI_DOA_GENERUS_SORONG,
        'ALM-HDL': MATERI_DALIL,
        'ALM-HDD': MATERI_DALIL,  # Sama dengan GBMTPG
        'ALM-TJW': MATERI_TAJWID,
        'FQH-KFH': MATERI_KEFAHAMAN_AGAMA,
        'FQH-PIB': MATERI_PRAKTEK_IBADAH,
        'FQH-4TK': MATERI_4_TALI_KEIMANAN,
        'FQH-NBP': MATERI_NASEHAT_BPI,
        'AKH-6TL': MATERI_6_THOBIAT,
        'AKH-ADB': MATERI_ADAB,
        'KMD-GBM': MATERI_KEMANDIRIAN,
        'KMD-ASD': MATERI_ASAD,
    }

    # Seed Materi Items
    total_materi = 0
    for kode_kategori, materi_list in materi_mapping.items():
        kategori_id = kategori_map.get(kode_kategori)
        if not kategori_id:
            continue

        for mat_data in materi_list:
            existing = session.query(MateriItem).filter(
                MateriItem.kategori_id == kategori_id,
                MateriItem.nomor == str(mat_data['nomor'])
            ).first()

            if not existing:
                materi = MateriItem(
                    kategori_id=kategori_id,
                    nomor=str(mat_data['nomor']),
                    nama=mat_data['nama'],
                    tipe=mat_data.get('tipe', 'hafalan'),
                    is_aktif=True
                )
                session.add(materi)
                total_materi += 1

    session.commit()
    print(f"Kurikulum seeding completed! Total: {total_materi} materi items")


if __name__ == '__main__':
    from database.connection import get_session
    with get_session() as session:
        seed_kurikulum(session)
