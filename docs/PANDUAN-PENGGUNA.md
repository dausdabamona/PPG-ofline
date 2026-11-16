# Panduan Pengguna PPG Sorong v3

Aplikasi PPG Sorong dipakai **tanpa internet**. Data berpindah lewat **berkas yang dikirim di WhatsApp (WA)**. Nama berkas selalu diawali `PPG_…`.

- **Laptop (EXE, "PPG Sorong Admin")** dipakai Admin Daerah, Admin Desa, Admin Kelompok (bila kelompok memakai laptop), dan Petugas Kurikulum. Satu aplikasi untuk semua; perannya ditentukan oleh kode aktivasi.
- **HP (APK, "PPG Sorong")** dipakai pengurus, mubaligh, murid (generus), dan orang tua (wali). Satu HP bisa berisi beberapa profil.
- **Super Admin HP** (bagian 1A): HP petugas pendaftaran seluruh daerah, diaktifkan oleh Admin Daerah. Pusat data tetap laptop Admin Daerah.

Cara membuka berkas PPG dari WA: tekan berkasnya lalu pilih **Buka dengan PPG Sorong**, atau simpan dulu lalu tekan tombol **Buka Berkas** (HP) / **Buka Paket** atau **Impor Setoran** (laptop).

---

## 1. Gambaran alur berjenjang

### 1.1 Data naik (setoran)

```
HP murid ──(Setor Belajar)──► HP mubaligh
HP pengurus / HP mubaligh ──(Setor ke Kelompok/Desa)──► EXE Kelompok (bila ada) ──(Setor ke Desa)──► EXE Desa
EXE Desa ──(Setor ke Daerah)──► EXE Daerah
```

### 1.2 Data turun (paket, materi, kurikulum)

```
EXE Kurikulum ──(berkas Kurikulum)──► EXE Daerah
EXE Daerah ──(Paket + Berkas Materi)──► EXE Desa
EXE Desa ──(Paket, materi ikut di dalamnya)──► HP pengurus / HP mubaligh / EXE Kelompok
HP mubaligh atau EXE Desa/Kelompok ──(Balasan)──► HP murid / HP orang tua
```

Catatan penting:

- Tujuan setor HP sudah tertanam di tokennya. Nama tombolnya menyesuaikan, mis. **Setor ke Desa Klasaman** atau **Setor ke Kelompok Klasaman 1**.
- Sejak v3, **berkas materi dari daerah ikut otomatis di dalam paket desa**. HP dan EXE kelompok cukup membuka paket dari desa.
- Setoran bersifat kumulatif: bila satu berkas hilang, setoran berikutnya tetap membawa datanya. Berkas yang dibuka dua kali tidak menggandakan data.

### 1.3 Unduh aplikasi (rilis uji terbaru)

Halaman unduhan: **<https://github.com/dausdabamona/PPG-ofline/releases/tag/uji-terbaru>**

| Berkas | Untuk |
|---|---|
| `PPG-Sorong.apk` | HP Android (pengurus, mubaligh, murid, orang tua) |
| `PPG Sorong Admin-Setup-….exe` atau `…Portable….exe` | Laptop Windows (daerah, desa, kelompok, kurikulum) |

Memasang di laptop Windows:

1. Jalankan berkas `.exe` yang diunduh.
2. Bila muncul layar biru **"Windows melindungi PC Anda"**, klik **Info lainnya** → **Tetap jalankan**.
3. Buka **PPG Sorong Admin** dari menu Start.

Memasang di HP Android:

1. Unduh `PPG-Sorong.apk` di HP (atau kirim lewat WA ke diri sendiri), lalu buka berkasnya.
2. Bila diminta, izinkan **Instal dari sumber tidak dikenal** untuk aplikasi yang membuka berkas (Chrome, WA, atau File).
3. Tekan **Instal**. Bila Play Protect bertanya, pilih **Tetap instal**.
4. Buka **PPG Sorong** → isi **Nama HP ini** (mis. "HP Bu Aminah") → tekan **Lanjut**.

---

## 1A. Super Admin HP: pendaftaran awal

**Super Admin HP** adalah HP petugas pendaftaran untuk **seluruh daerah**, atas izin Admin Daerah. Pusat data tetap **satu laptop Admin Daerah**. Super Admin HP **tidak** membuat organisasi dan **tidak** memegang kunci organisasi; ia hanya mendaftarkan perangkat dan mengajukan data, lalu menyetor ke Admin Daerah. Boleh ada beberapa Super Admin HP (mis. 3 HP); semuanya setara dan masing-masing menyetor ke Admin Daerah.

Super Admin HP bisa: menerbitkan token untuk **pengurus, mubaligh, orang tua (wali), murid (generus), EXE Desa, EXE Kelompok, dan EXE Kurikulum** (tidak bisa membuat Super Admin HP lain); menambah generus, wilayah, dan pengajian; mengimpor setoran HP yang ia daftarkan; mengirim paket dan balasan; serta **Setor ke Daerah**.

### 1A.1 Langkah di laptop Admin Daerah

1. Minta petugas mengirim **Kode Perangkat Super Admin** dari HP-nya (lihat 1A.2 langkah 1–4).
2. Menu **Perangkat & Token** → tempel di kotak **Kode Perangkat**.
3. **Untuk**: pilih **Super Admin HP (pendaftaran seluruh daerah)**. **Wilayah tugas**: pilih daerah. Isi **Nama pemegang** dan **Masa berlaku (hari)**.
4. Tekan **Terbitkan token** → tunjukkan QR ke HP petugas, atau tekan **Salin token** lalu kirim lewat WA.
5. Menu **Kirim Paket** → tekan **Paket Super Admin HP (seluruh daerah)** → kirim berkas `PPG_PAKET_…` ke petugas. Paket ini membawa daftar wilayah, generus, dan kunci kelompok.
6. Setiap menerima setoran Super Admin HP: menu **Impor Setoran** → **Pilih berkas setoran**. Generus, wilayah, dan pengajian yang ditambahkan Super Admin HP **langsung disetujui** ("usulan Super Admin HP disetujui otomatis"); semua perangkat yang ia daftarkan muncul di **Perangkat & Token**.
7. Bila HP Super Admin hilang atau tugasnya selesai: **Perangkat & Token** → baris Super Admin HP → **Cabut**. Setoran dan token baru dari HP itu ditolak sesudahnya; perangkat yang sudah ia daftarkan sebelumnya tetap berlaku.

### 1A.2 Langkah di HP petugas

1. Buka **PPG Sorong**. Di layar pertama tekan **Aktifkan sebagai Super Admin HP** (bila HP sudah dipakai profil biasa: layar **Kode Perangkat** → kartu **Super Admin HP** → tombol yang sama).
2. Isi **Nama HP ini**, **Kata sandi Super Admin** (minimal 8 karakter), dan **Ulangi kata sandi** → tekan **Buat kunci Super Admin**. Catat kata sandinya — **tidak bisa dipulihkan**.
3. Muncul **Kode Perangkat Super Admin** (QR). Tekan **Kirim lewat WA** atau **Salin**, kirim ke Admin Daerah.
4. Setelah token diterima: tekan **Pindai QR Token** (arahkan ke QR di laptop) atau **Tempel Token** → tempel di **Token Super Admin** → **Aktifkan Super Admin**.
5. Menu **Sinkron** → **Buka Paket / Impor Setoran** → pilih berkas paket dari Admin Daerah.

Menu Super Admin (bawah layar): **Beranda · Daftarkan · Data · Sinkron · Lainnya**.

- **Data → Generus**: pilih **Kelompok** → **+ Tambah generus** → isi **Nama generus**, jenis kelamin, **Kategori**, **Nama orang tua**, **No. HP orang tua**, dan (bila tahu) **Sekolah**, **Kelas sekolah**, **Jilid Iqro' / Al-Qur'an** → **Simpan generus**. Anak baru bertanda **Baru** dan **langsung bisa dipilih** saat membuat token orang tua/murid. Tekan **Ubah** pada generus untuk **Ajukan status** (mis. mondok) atau **Ajukan pindah**.
- **Data → Wilayah** (desa/kelompok baru) → **Ajukan wilayah**; **Data → Pengajian / kelas** → **Ajukan pengajian**. Semua tambahan ini disetujui otomatis saat setoran HP ini sampai di Admin Daerah. Token untuk kelompok baru bisa diterbitkan setelah paket berikutnya dari Daerah dibuka.
- **Daftarkan**: pilih **Peran** (Pengurus, Mubaligh, Orang tua, Murid, EXE Desa, EXE Kelompok, EXE Kurikulum) → pilih kelompok/desa → (orang tua: centang semua anaknya; murid: pilih satu anak) → isi nama → untuk pengurus/mubaligh pilih **Setoran HP itu dikirim ke** (**HP Super Admin ini** atau **Langsung ke Admin Daerah (laptop)**) → **Pindai QR Kode Perangkat** atau tempel di **Kode Perangkat** → **Terbitkan token**. Token tampil sebagai QR bergantian (penerima menekan **Pindai QR Token**), atau tekan **Kirim lewat WA** / **Salin token**. Token EXE ditempel di laptop (menu "Aktifkan dengan kode").
- **Sinkron**: **Setor ke Daerah** (kirim berkas `PPG_SETOR_…` ke Admin Daerah; **Kirim ulang semua data** bila berkas sebelumnya hilang) · **Buka Paket / Impor Setoran** (paket Daerah dan setoran HP pengurus/mubaligh yang Anda daftarkan; boleh banyak berkas) · **Kirim Paket** (pilih **Wilayah paket**, atau **Paket semua kelompok**) · **Kirim Balasan** ke HP murid/orang tua.
- **Lainnya → Perangkat**: perangkat yang didaftarkan HP ini → **Bekukan**, **Cairkan**, **Cabut**. Pencabutan sampai ke Daerah lewat **Setor ke Daerah**.
- **Lainnya → Pengaturan**: **Ganti sandi**; **Cadangkan data Super Admin** (simpan di **dua tempat**, mis. Google Drive dan HP lain) dan **Pulihkan cadangan Super Admin**.
- **Kunci sekarang** atau tombol nama di kanan atas menutup Super Admin. Aplikasi **terkunci otomatis** bila ditinggal di latar belakang lebih dari **10 menit**; buka lagi dengan **Kata sandi Super Admin** → **Buka Super Admin**.

### 1A.3 HP Super Admin yang juga dipakai profil biasa

Data Super Admin disimpan **terpisah** dari profil biasa (pengurus/mubaligh/orang tua) di HP yang sama. **Lainnya → Kembali ke profil biasa** membuka layar **Pilih Profil**; di sana ada kartu **Super Admin HP** (bertanda **Sandi**) untuk masuk lagi. Bila token Super Admin tertempel di **Tempel Token** profil biasa, aplikasi menjelaskan bahwa kode itu untuk Super Admin HP.

---

## 2. Admin Daerah (laptop)

### 2.1 Pengaturan awal (sekali saja)

1. Buka aplikasi → pilih tab **Buat organisasi baru (Admin Daerah)**.
2. Isi **Nama organisasi**, **Kata sandi admin** (minimal 8 karakter), dan **Ulangi kata sandi** → tekan **Buat database admin**.
3. Lain kali, buka aplikasi → isi **Kata sandi admin** → tekan **Masuk**.

### 2.2 Cadangan kunci — WAJIB di 2 tempat

1. Menu **Pengaturan** → bagian **Cadangan kunci admin**.
2. Isi **Kata sandi cadangan** dan **Ulangi kata sandi cadangan** (boleh berbeda dari kata sandi admin).
3. Tekan **Ekspor cadangan kunci** → simpan berkas `PPG_KUNCI_ADMIN_….ppgkey`.
4. Simpan berkas itu di **dua tempat berbeda**, mis. flashdisk **dan** Google Drive / WA "pesan untuk diri sendiri".
5. Tulis kata sandi cadangan di buku catatan yang aman.
6. Setiap bulan: **Pengaturan** → **Simpan cadangan database** ke flashdisk.

Tanpa berkas `.ppgkey`, bila laptop rusak atau kata sandi lupa, semua laptop desa dan semua HP harus diaktifkan ulang dari awal.

### 2.3 Wilayah

1. Menu **Wilayah** → **+ Tambah daerah** → isi nama dan kode singkat (mis. `SRG`) → **Simpan**.
2. Pada baris daerah tekan **+ Desa** → isi → **Simpan**. Ulangi untuk tiap desa.
3. Pada baris desa tekan **+ Kelompok** → isi nama dan kode (mis. `K1`) → **Simpan**. Kode kelompok dipakai di berkas CSV.

### 2.4 Data generus (CSV)

1. Menu **Generus & Jamaah** → **Unduh templat CSV** → buka di Excel.
2. Isi satu baris per generus: `nama`, `jenis_kelamin` (L/P), `tanggal_lahir` (boleh `DD/MM/YYYY`), `kategori` (boleh kosong, dihitung dari umur), `kelompok_kode`, `wali_nama`, `wali_no_hp`.
   Kolom tambahan (boleh kosong): `sekolah` (mis. SD Negeri 1), `kelas_sekolah` (mis. 4), `iqro` (`Iqro 1` … `Iqro 6`, atau `Al-Qur'an`).
   Data ini dipakai di cetakan lembar keaktifan (kolom **NAMA + UMUR + IQRO'**, **Sekolah/Kelas**, ringkasan **IQRO' 1 : … ORG**).
3. Simpan sebagai **CSV** → tekan **Impor CSV** → pilih berkasnya.
4. Baris yang gagal tampil dengan alasannya. Perbaiki baris itu lalu impor lagi.
5. Satu per satu: **+ Tambah generus** (isian **Sekolah**, **Kelas sekolah**, **Jilid Iqro' / Al-Qur'an** ada di formulir tambah/ubah).
   Pindah kelompok dan ubah status lewat tombol **Pindah** dan **Status** di baris generus.
6. Tanda kuning **saran Caberawit C (Al-Qur'an)** / **saran Caberawit B (Iqro' …)**: jenjang tidak cocok dengan jilid bacaannya
   (B = masih Iqro', C = sudah Al-Qur'an). Periksa lalu ubah jenjangnya bila perlu.

### 2.5 Pengajian = kelas per kategori

1. Menu **Pengajian** → **+ Tambah pengajian**.
2. Pilih **Wilayah** (kelompok), isi **Nama pengajian** (mis. "Kelas Caberawit"), **Hari**, **Jam**, **Tempat**.
3. Di bagian **Kelas — kategori generus**, centang kategori kelas itu (PAUD, Caberawit, Praremaja, Remaja, Pranikah). Kosongkan bila pengajian untuk semua generus.
4. Tekan **Simpan**. Saat absen, hanya generus kategori yang dicentang yang tampil.

### 2.6 Jadwal setor

1. Menu **Jadwal Setor**.
2. Bagian **Kelompok → Desa**: pilih pola **Pekanan (tiap hari tertentu)**, pilih hari (mis. Ahad), isi batas jam → **Simpan jadwal Kelompok → Desa**.
3. Bagian **Desa → Daerah**: pilih **Bulanan (tiap tanggal tertentu)**, pilih tanggal (1–28, mis. 5), isi batas jam → **Simpan jadwal Desa → Daerah**.
4. Jadwal ikut turun lewat paket. HP dan laptop desa/kelompok akan mengingatkan dan menandai **Terlambat** (merah) bila lewat tenggat. Jam yang dipakai adalah jam di perangkat masing-masing (WIT untuk Sorong).

### 2.7 Aktivasi EXE Desa dan EXE Kurikulum

1. Admin desa / petugas kurikulum memasang EXE, memilih **Aktifkan dengan kode**, lalu mengirim **Kode Perangkat EXE** lewat WA (lihat 3.1).
2. Di laptop daerah: menu **Perangkat & Token** → bagian **Terbitkan token / kode aktivasi**.
3. Tempel di kotak **Kode Perangkat**.
4. Pada **Untuk**, pilih **EXE Desa (aplikasi laptop desa)** atau **EXE Kurikulum (tim kurikulum)**.
5. Pilih **Wilayah tugas** (desanya; untuk kurikulum: daerah), isi **Nama pemegang** → tekan **Terbitkan token**.
6. Tekan **Salin token** → tempel di WA ke admin desa / petugas kurikulum.
7. Segera buat paket untuk desa itu (2.10) dan kirim berkas materi (2.9).

Daerah juga bisa menerbitkan token HP pengurus/mubaligh dan **EXE Kelompok** langsung bila desa belum punya laptop.

### 2.8 Impor kurikulum dan setoran

1. Kumpulkan berkas `PPG_SETOR_….ppg` dari desa dan `PPG_KURIKULUM_….ppg` dari petugas kurikulum ke satu folder.
2. Menu **Impor Setoran** → **Pilih berkas setoran** → pilih semua sekaligus.
3. Baca **Ringkasan impor**. "Setoran gabungan" berarti setoran dari EXE desa. "Sudah pernah diimpor" berarti datanya sudah masuk.
4. Bila ada rekaman ditolak, baca alasannya; perbaiki lewat **Koreksi** bila perlu.
5. Periksa menu **Usulan** → **Setujui** atau **Tolak** usulan dari desa/HP.

### 2.9 Materi

1. Menu **Materi**: kurikulum dasar sudah terisi. Tambah materi/PDF bila perlu.
2. Tekan **Buat Berkas Materi** → simpan `PPG_MATERI_v….ppg`.
3. Kirim berkas itu ke admin desa (bersama paket). Desa meneruskannya otomatis di paket ke bawah.

### 2.10 Kirim paket

1. Menu **Kirim Paket**.
2. Untuk semua laptop desa: tekan **Paket semua desa (EXE desa)** → pilih folder.
3. Untuk satu wilayah: pilih **Wilayah** → **Buat & simpan paket**.
4. Kirim tiap berkas `PPG_PAKET_….ppg` ke admin desa yang sesuai.
   Untuk HP Super Admin: tekan **Paket Super Admin HP (seluruh daerah)** dan kirim ke tiap Super Admin HP (lihat 1A.1).
5. Kirim paket setiap selesai impor setoran, menyetujui usulan, mengubah data, atau mengimpor kurikulum.

### 2.11 Beranda: status setor

1. Menu **Beranda** → tabel **Status setor tiap desa**.
2. Tiap desa tampil dengan jadwal, tenggat berikutnya, setor terakhir, dan lencana **Tepat waktu** (hijau) atau **Terlambat** (merah).
3. Hubungi desa yang terlambat.

### 2.12 Rekap & Excel

1. Menu **Rekap & Laporan** → pilih wilayah dan rentang tanggal.
2. Lihat kartu **Capaian target** (per desa, kelompok, kelas) serta presensi dan kemajuan.
3. Tekan **Ekspor Excel**. Rekap hanya memuat materi yang sudah **disahkan**.

### 2.12a Evaluasi & Keaktifan (Juknis 2025)

Menu **Evaluasi & Keaktifan** (juga di EXE desa dan kelompok):
- **Rekap Penguasaan Materi** → pilih **Wilayah** (kelompok/desa/daerah), **Semester**, dan jenjang → tabel No · Nama · kolom tiap
  materi · TOTAL, rata-rata, ringkasan per desa/kelompok → **Ekspor Excel** (lembar per kelompok + ringkasan) atau **Cetak / PDF**.
- **Keaktifan Bulanan** → pilih **Bulan** → rata-rata per kelompok dan daftar anak (merah = di bawah 50%, bahan musyawarah).
- **Laporan Bulanan** → Musyawaroh 5 Unsur, Muda/i, NUNGGONI tiap kelompok (**Isi/ubah** bila kelompok melapor lewat kertas).
- **Cetak Laporan Bulanan (format lembar)** → pilih **Wilayah** (kelompok; atau desa/daerah = gabungan semua kelompok seperti
  "LapGen Desa …") dan **Bulan** → **Format lembar**: **Kolom tanggal 1–31** (bawaan — kode kegiatan ditulis di tanggal kejadiannya,
  hari libur diarsir, ada JK, Sekolah/Kelas, Orang Tua, Iqro'/Qur'an) atau **Urutan kegiatan 1–24** (Pra Nikah 1–16, seperti lembar
  daerah) → **Pratinjau & Cetak / PDF** atau **Ekspor Excel**. Isi per kelompok:
  1. Sampul **LAPORAN GENERUS KELOMPOK … / BULAN … / Ust. <mubaligh>**.
  2. Lembar kuning **PRESENSI KEAKTIFAN** per jenjang (PAUD, CB. RAWIT A/B/C, Pra REMAJA, REMAJA, Pra NIKAH), dua jenjang per halaman
     bila muat, dengan **% Keaktifan** (target Kurikulum K16), **% Peng. Materi** (TOTAL evaluasi semester terakhir), baris **IQRO' 1–6 : … ORG**
     dan **Total**. Jenjang tanpa anak tetap dicetak kosong untuk diisi tangan.
  3. **Absensi Pengurus & Mubaligh-Mubalighot Peduli** (NUNGGONI bulan itu per tanggal, kolom **Paraf** kosong untuk ditandatangani),
     **Laporan Hasil Musyawaroh** (Muda-Mudi & 5 Unsur dari Laporan Bulanan), dan kotak **PENYAKSIAN** (KI/Wkl KI/Penerobos/MT Kelompok,
     KI/Wkl KI/Penerobos/Mubaligh/Kord PPG Desa). Nama MT diambil dari token mubaligh kelompok, Kord PPG Desa dari pengurus **PJ Desa**;
     yang lain ditulis tangan.

  Saat dialog cetak muncul pilih printer, atau **Simpan sebagai PDF / Microsoft Print to PDF**. Ukuran kertas A4 (lembar lanskap, lembar
  pengurus tegak) sudah diatur otomatis.
- **Laporan Hasil Belajar** (raport):
  - **Cetak semua raport** → pilih **Kelompok** (atau semua kelompok di wilayah) dan **Jenjang / kelas** → **Pratinjau & Cetak semua**
    (satu anak per halaman A4) atau **Simpan PDF**. Isi raport: kop **PPG Daerah** + logo, identitas anak, tabel **Materi · Target ·
    Dikuasai · %**, **TOTAL**, keaktifan semester, catatan materi yang belum ditetapkan Kurikulum, dan kolom tanda tangan **MT/Mubaligh
    Kelompok**, **KI Kelompok**, **Orang Tua/Wali**.
  - **Raport satu anak** → pilih generus → **Cetak / PDF** atau **Simpan PDF**.
- **Generus & Jamaah**: tanda kuning **tetapkan A/B/C** / **saran umur — cek** → buka generus, pilih jenjang yang benar.

### 2.13 Mencabut perangkat

1. Menu **Perangkat & Token** → **Daftar perangkat (token)**.
2. Pada baris perangkat tekan **Bekukan** (sementara), **Cairkan**, atau **Cabut** (permanen).
3. Kirim paket ke wilayahnya agar pencabutan sampai ke bawah.

---

## 3. Admin Desa (laptop)

### 3.1 Aktivasi dengan kode

1. Pasang EXE → buka → pilih tab **Aktifkan dengan kode (Desa / Kelompok / Kurikulum)**.
2. Isi **Nama laptop ini** (mis. "EXE Desa Klasaman"), **Kata sandi aplikasi**, dan **Ulangi kata sandi aplikasi** → tekan **Buat Kode Perangkat**.
3. Tekan **Salin kode** (atau **Simpan ke berkas**) → kirim lewat WA ke Admin Daerah.
4. Setelah menerima kode aktivasi dari daerah: tempel di kotak **Kode aktivasi** → tekan **Aktifkan**.
5. Laptop boleh ditutup di antara langkah 3 dan 4. Saat dibuka lagi: isi **Kata sandi aplikasi** → **Masuk** → layar aktivasi muncul kembali.
6. Kata sandi aplikasi **tidak bisa dipulihkan**. Catat baik-baik, dan rutin **Pengaturan** → **Simpan cadangan database**.

### 3.2 Buka paket dari daerah

1. Menu **Buka Paket** → **Pilih berkas paket** → pilih `PPG_PAKET_…` dan `PPG_MATERI_…` dari daerah sekaligus.
2. Kepala aplikasi kini menampilkan "Admin Desa · nama desa".

### 3.3 Aktivasi HP pengurus/mubaligh dan EXE kelompok

1. Minta orangnya mengirim **Kode Perangkat** (HP: layar **Kode Perangkat** → **Kirim lewat WA**; laptop kelompok: lihat 4.1).
2. Menu **Perangkat & Token** → bagian **Terbitkan kode aktivasi di desa ini**.
3. Tempel di **Kode Perangkat**. Pada **Untuk**, pilih **Mubaligh (HP, satu kelompok)**, **Pengurus (HP, kelompok/desa/daerah)**, atau **EXE Kelompok (aplikasi laptop kelompok)**.
4. Pilih **Wilayah tugas** (hanya wilayah desa ini), isi **Nama pemegang** → **Terbitkan token**.
5. Tekan **Salin token** dan kirim lewat WA, atau tunjukkan QR di layar laptop agar dipindai HP.
6. Bila muncul pesan "Data kelompok ini belum lengkap dari daerah", buka paket terbaru dari daerah dulu.

### 3.4 Kirim paket ke bawah

1. Menu **Kirim Paket** → **Paket semua kelompok** (pilih folder), atau pilih **Wilayah** → **Buat & simpan paket**.
2. Kirim tiap `PPG_PAKET_…` ke grup WA kelompoknya. Berkas materi daerah sudah ikut di dalamnya.

### 3.5 Impor setoran dari HP dan EXE kelompok

1. Kumpulkan `PPG_SETOR_…` dari HP pengurus/mubaligh dan EXE kelompok.
2. Menu **Impor Setoran** → **Pilih berkas setoran** → pilih semuanya.
3. Menu **Beranda** → tabel **Status setor tiap kelompok** menunjukkan yang tepat waktu dan terlambat.

### 3.6 Setor ke Daerah

1. Menu **Setor ke Daerah** → tekan **Setor ke Daerah** → simpan `PPG_SETOR_….ppg`.
2. Kirim berkas itu lewat WA ke Admin Daerah sebelum tenggat (mis. tiap tanggal 5).
3. Bila daerah meminta: buka **Pilihan lain** → **Kirim ulang semua data**.

### 3.7 Kirim Balasan ke HP murid/orang tua

Dipakai bila mubaligh berhalangan atau sesudah token mubaligh dicabut.

1. Menu **Kirim Balasan**.
2. Tekan **Buat Balasan** pada HP yang dituju, atau **Buat balasan semua HP** (pilih folder).
3. Kirim tiap `PPG_BALASAN_…` ke HP yang namanya tertera.

### 3.8 Generus & data

Menu **Generus & Data** hanya untuk melihat. Perubahan diajukan lewat **+ Usulkan generus baru**, **Usulkan pindah**, atau **Usulkan status**; usulan ikut setoran ke daerah.

---

## 4. Kelompok (laptop / EXE Kelompok)

### 4.1 Aktivasi

1. Ikuti langkah 3.1, tetapi kirim **Kode Perangkat EXE** ke **Admin Desa** (atau daerah).
2. Tempel kode aktivasi di **Kode aktivasi** → **Aktifkan**.
3. Menu **Buka Paket** → **Pilih berkas paket** → pilih `PPG_PAKET_…` dari desa.

### 4.2 Absen Pertemuan

1. Menu **Absen Pertemuan** → isi **Tanggal pertemuan** → pilih **Kelas / pengajian** → **Buka pertemuan**.
2. Bagian **2. Materi hari ini**: tekan **+ Pakai** pada saran, atau pilih **Materi lain dari target** → **Tambahkan materi**.
3. Bagian **3. Kehadiran & materi tuntas**: tekan **Semua hadir**, ubah yang izin/sakit/alpa.
4. Centang materi yang **tuntas** per generus (hanya generus yang hadir).
5. Tekan **Simpan absen**.

### 4.3 Setor, balasan, rekap

1. **Impor Setoran**: berkas setoran dari HP di kelompok ini.
2. **Setor ke Desa** → tekan **Setor ke Desa** → kirim berkasnya ke admin desa.
3. **Kirim Balasan**: seperti 3.7.
4. **Rekap & Laporan**: capaian kelompok + **Ekspor Excel**.
5. **Evaluasi & Keaktifan** → **Cetak Laporan Bulanan (format lembar)** dan **Laporan Hasil Belajar → Cetak semua raport**: kelompok
   mencetak laporan bulanan & raport sendiri (lihat 2.12a).

---

## 5. Petugas Kurikulum (laptop / EXE Kurikulum)

### 5.1 Aktivasi dan materi dasar

1. Ikuti langkah 3.1, kirim Kode Perangkat EXE ke **Admin Daerah**.
2. Setelah aktif: menu **Buka Berkas Materi** → **Pilih berkas materi** → pilih `PPG_MATERI_…` dari daerah.

### 5.2 Target per semester

Periode: **S1 = Juli–Desember**, **S2 = Januari–Juni** tahun berikutnya (mis. "2026-S1" = Juli–Desember 2026; "2026-S2" = Januari–Juni 2027).

1. Menu **Target Capaian** → pilih **Periode** dan **Kategori generus**.
2. Di **Tambah materi ke target**: pilih **Bidang materi** dan **Kategori materi** → **+ Tambah** per materi, atau **Tambah semua di kategori ini**.
3. Atur urutan dengan **↑ Naik** / **↓ Turun**; hapus dengan **Buang**.
4. Tekan **Simpan target**. Ulangi untuk kategori lain.
5. Untuk menyalin dari semester lalu: pilih **Salin dari periode** → periksa → **Simpan target**.
6. Tekan **Jadikan periode aktif** untuk semester yang sedang berjalan.

### 5.2a Materi Evaluasi (Juknis 2025)

Menu **Materi Evaluasi** (EXE kurikulum & daerah): pilih jenjang → **Ubah** untuk mengganti nama, **target** (materi GBMTPG
Generus 2/3 masih "Belum ditetapkan"), daftar butir, atau **halaman terakhir kitab** hadits. **Bulan evaluasi semester** (bawaan
November & Mei) → **Simpan**. Perubahan ikut berkas Kurikulum → daerah → berkas Materi ke semua HP.

### 5.2b Perlu Ditetapkan Kurikulum (Fase 12)

Hal-hal juknis yang dulu "perlu dikonfirmasi" kini **diserahkan ke Kurikulum**. Menu **Perlu Ditetapkan Kurikulum** berisi 16 butir
(K01–K16): bulan evaluasi, definisi Caberawit A, pembagi keilmuan/adab PAUD, do'a & surat PAUD, surat Caberawit B, nama jurus
ASAD, rumus TOTAL, surat Generus 2 & 3 (51/45), target GBMTPG Generus 2 & 3, halaman kitab hadits, dalil Sorong no. 26 & 28,
butir Caberawit C, cara nilai wudhu & sholat, dan **K16 Target keaktifan bulanan per jenjang**.

**K16 — Target keaktifan.** Juknis menulis **20 kali/bulan (Pra Nikah 16)**, tetapi lembar cetakan daerah berkolom **24** dan semua
kelompok selama ini menghitung % = jumlah ÷ 24. Sampai Kurikulum menetapkan, aplikasi memakai **20 (Pra Nikah 16)** — status
**Sementara**. Tekan **Tetapkan / ubah** → isi angka tiap jenjang (1–31; boleh berbeda per jenjang, mis. 24) → **Simpan & tetapkan**.
Angka ini langsung dipakai semua hitungan: % keaktifan bulanan & semester, raport, rekap, kejar target, reward, dan cetakan lembar.

1. Tiap butir menampilkan **nilai sementara yang sedang dipakai**, **sumber/alasan**, dan status: **Belum ditetapkan** (merah — ada
   isian kosong), **Sementara** (kuning), **Ditetapkan Kurikulum** (hijau, dengan tanggal & nama penetap).
2. Tekan **Tetapkan / ubah** (atau **Isi & tetapkan**) → ubah isian bila perlu → tulis catatan (opsional) → **Simpan & tetapkan**.
   Isian yang masih kosong boleh disimpan sebagian; statusnya tetap "Belum ditetapkan" sampai semua terisi.
3. Butir daftar (do'a/surat) diubah di **Materi Evaluasi**, lalu kembali ke sini → **Tetapkan nilai ini**.
4. **Riwayat** menampilkan semua penetapan sebelumnya.
5. Kirim lewat **Buat berkas Kurikulum** → daerah mengimpor → turun ke semua HP lewat Berkas Materi/paket.

Penting: **materi yang belum ditetapkan** (mis. target GBMTPG Generus 2 & 3, hadits yang halaman kitabnya belum lengkap) **tidak ikut
dihitung di TOTAL**. Raport dan rekap menuliskan "Materi … belum ditetapkan Kurikulum". Bila Admin Daerah mengubah materi sesudah
ditetapkan, butir kembali **Sementara** dengan tanda "Berubah sesudah ditetapkan".

Pengurus HP berjabatan **Bidang Kurikulum** punya menu yang sama: **Bidang → Perlu Ditetapkan Kurikulum → Tetapkan**. Penetapan dari HP
berstatus **Diajukan ke Daerah**; kirim lewat **Setor ke Daerah**, daerah menerapkannya otomatis, lalu statusnya berubah setelah paket
berikutnya dibuka. EXE Daerah hanya **melihat** daftar ini (menu **Perlu Ditetapkan Kurikulum**).

### 5.3 Materi dan berkas Kurikulum

1. Menu **Materi**: tambah atau ubah materi bila perlu (**+ Bidang**, **+ Kategori**, **+ Materi**, **Unggah PDF**).
2. Tekan **Buat berkas Kurikulum** (di Beranda, Materi, atau Target Capaian) → kirim `PPG_KURIKULUM_…` ke Admin Daerah.
3. Daerah mengimpornya di **Impor Setoran**, lalu membuat Berkas Materi dan paket baru. Target turun sampai HP murid lewat desa.

---

## 6. Mubaligh (HP)

Menu bawah: **Absen · Jadwal · Materi · Lainnya**.

### 6.1 Aktivasi

1. Buka aplikasi → layar **Kode Perangkat** → **Kirim lewat WA** ke Admin Desa.
2. Terima token → tekan **Tempel Token** (atau **Pindai QR Token**) → **Aktifkan**.
3. Buka paket dari desa: **Lainnya → Buka Berkas** → pilih `PPG_PAKET_…`. Materi ikut di dalamnya.

### 6.2 Absen dengan materi dan tuntas

1. Menu **Absen** → bagian **1. Pilih pertemuan**: pilih kelas hari ini (atau **Pertemuan lain**).
2. Bagian **2. Materi hari ini**: tekan **Pakai saran pertama**, atau centang materi dari daftar target.
3. Tekan **Lanjut: isi kehadiran**.
4. Tekan **Semua hadir**, lalu ubah yang **Izin**, **Sakit**, atau **Alpa**.
5. Centang **Tuntas** pada materi yang sudah dikuasai tiap anak (hanya yang hadir).
6. Tekan **Simpan absen**.
7. Bila kartu **Setor ke …** di atas Absen berwarna kuning/merah, tekan **Setor sekarang** → kirim berkasnya lewat WA.

### 6.3 Jadwal

1. Menu **Jadwal**: jadwal rutin dan tambahan pekan ini.
2. Tambah jadwal tambahan → **Simpan jadwal** → **Bagikan ke grup WA**.

### 6.4 Materi

Menu **Materi**: target semester per kelas, capaian tiap generus, dan materi yang belum tuntas per anak.

### 6.5 Lainnya

1. **Setoran Generus** → **Buka berkas setoran (bisa banyak)** (`PPG_BELAJAR_…`) → **Sahkan** atau **Tolak**.
2. **Simak Langsung** → untuk generus tanpa HP → **Simpan & sahkan**.
3. **Generus** → data dan usulan (**+ Usulkan generus baru**, **Ajukan pindah kelompok**, **Ajukan ubah status (mondok/aktif/…)**).
4. **Terbitkan Token** → pilih **Generus** atau **Orang tua (wali)** → pilih anak → isi **Nama pemegang token** → **Pindai QR Kode Perangkat** HP mereka (atau tempel) → **Terbitkan Token**.
5. **Kirim Balasan** → **Kirim Balasan ke semua (… HP)** atau **Kirim** per HP.
6. **Laporan Pekanan** → kirim WA ke orang tua.
7. **Setor ke …** → tombol **Setor ke …**; **Setor Akhir** (di **Pilihan lain**) hanya saat serah terima tugas.
8. **Buka Berkas** → paket dari desa, setoran generus, dan berkas lain.

### 6.6 Keaktifan (Lembar Kontrol) — Juknis 2025

Target keaktifan ditetapkan **Kurikulum (butir K16)**; sementara **20 kali sebulan** (Pra Nikah **16**) — angka yang berlaku tampil di
bawah judul layar **Keaktifan**. Satu hari dihitung **satu kali** walau ada beberapa kegiatan.

- Hadir di pengajian (Absen) otomatis tercatat **A** (pengajian desa = DS, daerah = DR). Izin tidak dihitung.
- **Lainnya → Keaktifan**:
  - **Ajuan murid menunggu disahkan**: lembar kontrol murid ikut di setoran belajar (`PPG_BELAJAR_…`) → **Sahkan** / **Tolak**.
    Hanya yang disahkan yang dihitung.
  - **+ Catat kegiatan** → pilih tanggal dan kode (PAUD–Caberawit: B mandiri; Generus 1–3: MK, KL, T, MS, DS, MR, DR, AA, AS, TH, QR, HD;
    IZ = izin) → **Pilih semua** atau centang anak → **Simpan**.
  - **Kejar target bulan ini** (mulai tanggal 20): anak yang keaktifannya masih kurang, beserta sisa hari.
  - **Lembar kontrol per anak** → **Lihat**.

### 6.7 Evaluasi Semester

Evaluasi penguasaan materi tiap **Mei** dan **November** (bisa diubah Kurikulum).

1. **Lainnya → Evaluasi Semester** → pilih **Semester** dan (opsional) **Jenjang** → ketuk tombol nilai di samping nama anak.
2. Bila ada tanda **jenjang perlu dicek** / "Caberawit (perlu ditetapkan)": pilih jenjang di **Tetapkan jenjang** → **Ajukan jenjang**
   (Caberawit **B** = masih Iqro', **C** = sudah Al-Qur'an). Berlaku setelah Setor sampai daerah.
3. Ketuk **Nilai** pada materi:
   - hafalan/doa/surat yang ada daftarnya → **centang** yang dikuasai;
   - materi GBMTPG/Iqro' → isi **jumlah dikuasai** (tidak boleh melebihi target);
   - Makna Al-Qur'an → halaman makna **penuh** per juz (0–20);
   - Hadits → halaman makna penuh per kitab (sampai halaman terakhir kitab);
   - Praktik (thoharoh, wudhu & sholat C–G3, ASAD, kualitas bacaan, pegon, jenazah) → nilai penguji **1–75%** (lebih dari 75 ditolak).
4. **TOTAL** = rata-rata semua materi; yang belum dinilai = 0%. Nilai semester lalu dipakai sampai dinilai ulang ("Nilai dari …").
5. **Raport** → Laporan Hasil Belajar anak → **Simpan PDF / Cetak** (PDF dibuat di HP tanpa internet; terbuka di aplikasi pembaca
   PDF — pilih menu **Cetak** di sana untuk printer/Print service Android) atau **Bagikan PDF (WA)** ke orang tua. Jangan lupa **Setor**
   dan **Kirim Balasan** agar orang tua melihatnya di HP-nya.
6. **Semua raport kelas ini**: di daftar Evaluasi Semester pilih **Jenjang** (kosong = semua) → **PDF semua raport / Cetak** atau
   **Bagikan PDF (WA)** — satu PDF, satu anak per halaman A4 (kop PPG Daerah, tabel materi, TOTAL, keaktifan, tanda tangan MT, KI
   Kelompok, Orang Tua/Wali).
7. **Jilid Iqro' / Al-Qur'an**: di halaman anak pilih **Jilid sekarang** → **Ajukan jilid Iqro'**. Disetujui otomatis setelah Setor sampai
   daerah. Bila jilid tidak cocok dengan jenjang, muncul **Saran jenjang** (Caberawit B = masih Iqro', C = sudah Al-Qur'an).
   Rincian generus (**Lainnya → Generus**) menampilkan sekolah, kelas, dan jilid.

### 6.8 Laporan Bulanan

**Lainnya → Laporan Bulanan** → pilih bulan (**‹ / ›**) → isi **Musyawaroh 5 Unsur** (Terlaksana/Tidak + tanggal + hasil),
**Muda/i kelompok/desa/daerah**, daftar **NUNGGONI** (nama, unsur, tanggal, kelas, temuan/saran → **+ Tambah ke daftar**) →
**Simpan laporan**. Laporan ikut terkirim saat **Setor**.

---

## 7. Pengurus (HP)

Menu bawah: **Beranda · Absen · Data · Rekap · Sinkron**.

1. Aktivasi seperti 6.1 (token dari Admin Desa).
2. **Beranda**: kartu pengingat **Setor ke …** dan ringkasan generus.
3. **Absen**: seperti 6.2, tanpa centang tuntas (hanya kehadiran).
4. **Data**: lihat generus (termasuk sekolah & jilid Iqro') → **+ Usulkan generus baru** bila ada anak baru (isian sekolah, kelas,
   jilid Iqro' ikut). Pengurus **kelompok**: kartu **Raport semua generus kelompok (PDF)** → **PDF semua raport / Cetak** atau
   **Bagikan PDF (WA)** — untuk kelompok yang tidak punya laptop.
5. **Rekap**: kehadiran dan kemajuan wilayah Anda.
6. **Sinkron** → **Setor ke …** → kirim berkasnya; buka paket baru dari desa lewat **Buka Berkas**.
7. Pengurus kelompok: **Beranda → Laporan Bulanan (Musyawaroh & NUNGGONI)** — sama seperti 6.8.

### 7A. Pengurus PPG per jabatan/bidang

Admin Daerah menerbitkan token pengurus berjabatan: **Perangkat & Token** → Untuk **Pengurus** → Wilayah (daerah untuk pengurus
daerah, desa untuk PJ desa, kelompok untuk PJ kelompok) → centang **Jabatan / bidang PPG** (boleh lebih dari satu, mis. Wakil Ketua +
Tenaga Pendidik) → **Terbitkan token**. Orang tua yang juga pengurus: tambah profil kedua di HP yang sama (bagian 8).

Di HP, menu bawah pengurus berjabatan: **Beranda · Bidang · Data · Sinkron** (PJ kelompok juga **Absen**). Menu **Bidang** hanya
berisi tugas jabatan Anda:

| Jabatan | Yang dikerjakan di HP |
|---|---|
| Ketua / Wakil | **Ringkasan PPG** (keaktifan, kelompok belum lapor, NUNGGONI, jumlah kasus BK, saldo), rekap; **Musyawarah & Kebijakan** → **Sahkan** notulen; Ketua memberi **mandat** ke Wakil (7B) |
| Sekretaris | **Musyawarah & Kebijakan** (notulen berbutir keputusan, undangan & hasil WA — 7B), rekap keaktifan → **Bagikan ke grup WA**, database generus per jenjang & mubaligh, pengingat kelompok yang belum lapor |
| Bendahara | **Keuangan**: + Buku kas (pemasukan/pengeluaran, rupiah bulat), tabungan desa (target = kebijakan musyawarah; sebelum ditetapkan dipakai nilai sementara Sorong 700.000 & Aimas 600.000), **Konfirmasi** dana masuk dari penggalang dana |
| Penggalang Dana | + Dana masuk (wali/aghniya/lain) → masuk kas setelah dikonfirmasi bendahara |
| Kurikulum | **Perlu Ditetapkan Kurikulum** (5.2b) dan **Reward Hasil Belajar**: santri terbaik per jenjang, kelompok & desa terbaik (jumlah juara & bobot skor = kebijakan musyawarah) |
| Tenaga Pendidik | Data mubaligh/mubalighot (tugasan/setempat), kebutuhan pengajar, program SDM, rekap **Kontrol Keaktifan MT** |
| Sarana & Prasarana | Inventaris per kelompok (kondisi, tanggal cek), usulan pengadaan |
| Muda/i & Kepramukaan | 10 group pembinaan, agenda (LDK, CAI, pengajian muda/i daerah, …) → **Catat hadir** = keaktifan MR/DR/AA/AS peserta |
| Olahraga & Seni · Kemandirian · Keputrian | Agenda program; kemandirian juga data lulus/dropout, bakat & minat, info kerja; keputrian hanya generus putri |
| Bimbingan Konseling | Catatan konseling — **hanya BK yang bisa membaca** (ketua melihat jumlah kasus saja) |
| Tahfidz | Peserta, **ujian** (centang surat yang lulus, 2 penguji, poin otomatis), peringkat |
| PJ Desa / PJ Kelompok | Pengingat akhir bulan "kejar absensi & laporan", temuan keaktifan < 50%; laporan KBM bulanan kelompok; notulen musyawarah desa/5 unsur wilayahnya |
| Semua | **NUNGGONI** — catat setelah menunggui 1 KBM (Semua Pengurus & Mubaligh Peduli) |

Semua catatan ikut **Setor** seperti biasa. Mubaligh mengisi **Lainnya → Kontrol Keaktifan MT** (sholat subuh/tahajud/dhuha, kolom
hafalan, tadarus) setiap hari; diperiksa pengajian MT minggu pertama.

Di EXE Daerah/Desa: menu **Kepengurusan** — daftar pengurus berjabatan, ringkasan bidang, keuangan & tabungan desa, reward, kontrol MT,
tahfidz, catatan bidang. Bila bendahara/BK lama dicabut: **Ganti kunci keuangan/konseling**, lalu **Kirim Paket** seluruh daerah.

### 7B. Musyawarah & Kebijakan (Fase 12)

Kebijakan yang bukan urusan kurikulum diputuskan lewat **musyawaroh**. Daftar kebijakan (**Register Kebijakan**): M01 tabungan bulanan
tiap desa, M02 rumus skor reward, M03 jumlah juara reward, M04 hak baca keuangan, M05 jadwal musyawarah rutin (sebulan sekali: ganjil
bersama, genap PPG muda/i), M06 kebutuhan dana kegiatan, M07 tanggal pengingat laporan. Status: **Sementara** (nilai sementara masih
dipakai), **Belum ditetapkan** (mis. tabungan Fakfak & Kaimana), **Ditetapkan Musyawarah** (nomor & tanggal musyawarah, pengesah).

Alur:

1. **Sekretaris** (HP): **Bidang → Musyawarah & Kebijakan**. Kartu **Agenda berikutnya & undangan** sudah memuat "kebijakan yang masih
   sementara" sebagai usulan agenda → isi tanggal/jam/tempat → **Kirim undangan + agenda ke WA**.
2. Sesudah musyawarah: **+ Tulis notulen** → jenis (rutin bersama / PPG muda/i / desa / 5 unsur), tanggal, peserta, agenda, uraian →
   **+ Butir keputusan**. Bila keputusan mengubah kebijakan, pilih di **Mengubah kebijakan** lalu isi nilai barunya (untuk tabungan
   desa pilih desanya) → **Simpan notulen** → **Setor ke Daerah**.
3. **Ketua** (HP): buka paket terbaru → **Musyawarah & Kebijakan** → **Sahkan** pada notulen → **Setor ke Daerah**. Wakil Ketua hanya
   bisa mengesahkan bila Ketua memberi **mandat** (**Beri mandat pengesahan ke Wakil Ketua**, mulai–sampai, paling lama 1 tahun).
4. **EXE Daerah** menerapkan keputusan yang sudah disahkan **otomatis saat Impor Setoran** (ringkasan impor: "N keputusan musyawarah
   diterapkan") → **Kirim Paket** agar kebijakan baru sampai ke semua HP pengurus.
5. **Hasil WA**: tombol di tiap notulen (HP) atau **Salin hasil WA** (EXE) — berisi keputusan dan status pengesahan.

Aturan yang dijaga aplikasi:

- Tanpa pengesahan Ketua, keputusan tetap **usulan** (nilai lama tetap dipakai).
- Notulen yang diubah sesudah disahkan **tidak diterapkan** sampai disahkan ulang; notulen yang sudah disahkan tidak bisa diubah.
- Musyawarah **desa** (dicatat PJ Desa) hanya boleh mengubah kebijakan lingkup desanya; musyawarah kelompok/5 unsur tidak mengubah
  kebijakan.
- Bila **hak baca keuangan** berubah, kunci keuangan diganti otomatis: catatan kas baru hanya terbaca jabatan yang diputuskan.
  Penggalang dana yang tidak lagi membaca tetap bisa mencatat dana masuk.

Di EXE Daerah/Desa: menu **Musyawarah & Kebijakan** (desa: **Musyawarah Desa**) — ringkasan (kebijakan sementara, notulen menunggu
pengesahan, musyawarah terakhir & berikutnya), undangan WA, **Register Kebijakan** (+ **Riwayat**), daftar notulen. Beranda Daerah/Desa
dan Beranda HP Ketua/Sekretaris menampilkan kartu **Musyawarah & kebijakan**.

---

## 8. Satu HP untuk orang tua yang juga pengurus

Contoh: Pak Hasan pengurus kelompok, punya anak Ali dan Ani. Satu HP berisi **4 profil**: Pengurus, Wali (orang tua), Ali, Ani.

### 8.1 Menyiapkan profil

1. Pasang APK → isi **Nama HP ini** (mis. "HP Pak Hasan") → **Lanjut**.
2. Kirim **Kode Perangkat** ke Admin Desa → terima token pengurus → **Tempel Token** → **Aktifkan**. Profil pertama: Pengurus.
3. Kirim **Kode Perangkat yang sama** ke mubaligh. Minta mubaligh menerbitkan 3 token untuk HP ini: satu **Orang tua (wali)** dengan centang Ali dan Ani, satu **Generus** Ali, satu **Generus** Ani.
4. Di HP: ketuk nama profil di pojok kanan atas → **Profil & HP** → **+ Tambah Profil**.
5. **Tempel Token** (atau **Pindai QR Token**) untuk token wali → isi **PIN 4 angka** bila perlu → **Aktifkan**.
6. Ulangi langkah 4–5 untuk token Ali dan token Ani.
7. Di **Profil & HP**, bagian **Profil di HP ini** kini menampilkan 4 profil.

Kode Perangkat ada juga di **Profil & HP** → kartu **Kode Perangkat** (**Kirim lewat WA** / **Salin**).

### 8.2 Ganti profil

1. Ketuk nama profil di pojok kanan atas → **Ganti profil**.
2. Layar **Pilih Profil**: ketuk nama yang akan memakai HP (isi PIN bila diminta).
3. Menu bawah berganti sesuai profil: Pengurus (Beranda, Absen, …), Wali (Target, Laporan, …), anak (Target, Materiku, …).
4. Pasang PIN pada profil pengurus agar data kelompok terjaga: **Profil & HP** → **Pasang PIN**.

### 8.3 Anak mencatat dan Setor Belajar dari HP yang sama

1. **Ganti profil** → pilih Ali.
2. Menu **Catat** → pilih materi → isi → **Simpan catatan**.
3. Ganti ke profil Ani dan lakukan hal yang sama bila perlu.
4. Menu **Setor** → **Setor Belajar** → kirim `PPG_BELAJAR_…` ke mubaligh. Satu berkas membawa catatan semua anak di HP ini.

### 8.4 Laporan anak di profil wali

1. Setelah mubaligh mengirim Balasan: buka berkasnya (**Berkas** → **Buka Berkas**, dari profil mana saja).
2. **Ganti profil** → pilih profil wali.
3. Menu **Target**: "Materi yang perlu dituntaskan"; pilih **Ali** atau **Ani** di bagian **Pilih anak**.
4. Menu **Laporan**: laporan pekanan tiap anak; **Kemajuan** dan **Kehadiran** per anak.

### 8.5 Tugas pengurus tetap jalan

Profil Pengurus menerima paket desa dan menyetor ke desa seperti biasa (bagian 7). Catatan belajar anak yang sudah disetor ke mubaligh boleh ikut terbawa di setoran pengurus; data tidak menjadi ganda.

---

## 9. Murid / generus (HP)

Menu bawah: **Target · Materiku · Catat · Jadwal · Setor**.

1. Pasang APK → kirim **Kode Perangkat** ke mubaligh (**Kirim lewat WA**, atau tunjukkan QR).
2. Terima token: **Pindai QR Token** (arahkan kamera ke layar mubaligh sampai semua bagian terbaca) atau **Tempel Token** → boleh isi PIN → **Aktifkan**.
3. Buka berkas Balasan dari mubaligh: **Setor** → **Buka Berkas**.
4. Menu **Target**: "Materi yang perlu dituntaskan" — persentase, daftar materi berurutan, yang **✓ Sudah tuntas**, dan pertemuan berikutnya.
5. Menu **Catat** (atau **Catat yang sudah kupelajari** di Target) → pilih materi → **Simpan catatan**.
6. Menu **Setor** → **Setor Belajar** → kirim berkasnya ke mubaligh.
7. **Lembar Kontrol (keaktifan)**: di **Target** ada kartu **Keaktifan bulan ini** → **Isi Lembar Kontrol** → ketuk **+** pada tanggal →
   pilih kegiatan (mis. **B** mengulang hafalan 20 kali + baca Iqro'/Qur'an disimak 1 halaman; Generus: **TH**, **QR**, **HD**, …) →
   **Simpan**. Tanda kuning "B?" = menunggu disahkan mubaligh; hijau = sudah dihitung. Kirim lewat **Setor Belajar**.
   Kolom **SB ZH AS MG IS** = catatan sholat 5 waktu untuk diri sendiri/orang tua (tidak dinilai, tidak dikirim).
8. Mulai tanggal 20, bila keaktifan belum mencapai target (sementara 20 kali; ditetapkan Kurikulum) muncul kartu **Kejar target
   keaktifan!** — isi lembar kontrol setiap hari.
9. **Laporan Hasil Belajar** (di Target): nilai penguasaan materi per semester dan TOTAL → **Simpan PDF / Cetak** atau **Bagikan PDF (WA)**.
10. Kakak-adik di satu HP: **Profil & HP** → **+ Tambah Profil** untuk anak berikutnya (lihat bagian 8).

---

## 10. Orang tua / wali (HP)

Menu bawah: **Target · Laporan · Kemajuan · Kehadiran · Berkas**.

1. Kirim **Kode Perangkat** ke mubaligh → terima token → **Aktifkan**.
2. Setiap pekan buka berkas Balasan dari mubaligh: **Berkas** → **Buka Berkas**.
3. **Target**: materi yang perlu dituntaskan anak. Punya beberapa anak: pilih nama di **Pilih anak**.
4. **Laporan**: laporan pekanan (geser pekan dengan **‹** / **›**).
5. **Kemajuan** dan **Kehadiran** (60 hari terakhir) per anak.
6. Di **Target**: kartu **Kejar target** (mulai tanggal 20), **Keaktifan bulan ini** → **Lihat Lembar Kontrol** (orang tua boleh
   mencentang sholat 5 waktu sebagai catatan di HP ini), dan **Laporan Hasil Belajar** (**Simpan PDF / Cetak** raport anak sendiri).
   Bila banyak kolom kosong menjelang akhir bulan,
   bantu anak mengaji di rumah atau hubungi mubaligh.

---

## 11. Jadwal rutin

| Kapan | Siapa | Kegiatan |
|---|---|---|
| Setiap pertemuan | Mubaligh / pengurus / EXE kelompok | **Absen** dengan materi hari ini dan centang tuntas |
| Setiap pekan (mis. Sabtu) | Murid | **Setor Belajar** ke mubaligh |
| Setiap pekan (mis. Ahad) | Mubaligh | **Setoran Generus** → sahkan → **Kirim Balasan ke semua** → **Laporan Pekanan** |
| Sesuai jadwal setor (mis. tiap Ahad) | HP pengurus & mubaligh, EXE kelompok | **Setor ke Kelompok/Desa** |
| Sesudah menerima setoran | Admin Desa | **Impor Setoran** → periksa **Beranda** |
| Bulanan (mis. sebelum tanggal 5) | Admin Desa | **Setor ke Daerah** |
| Bulanan (sesudah tanggal 5) | Admin Daerah | **Impor Setoran** → **Usulan** → **Kirim Paket** semua desa → **Beranda** (status setor) |
| Sesudah paket daerah datang | Admin Desa | **Buka Paket** → **Kirim Paket** semua kelompok |
| Awal semester (Juli & Januari) | Petugas Kurikulum | **Target Capaian** periode baru → **Jadikan periode aktif** → **Buat berkas Kurikulum** |
| Bulanan | Semua laptop | **Pengaturan → Simpan cadangan database** |
| Bulanan | Semua HP | **Profil & HP → Cadangkan data HP** |

---

## 12. Jika terjadi masalah

### 12.1 QR tidak terbaca

1. Saat pertama menekan **Pindai**, izinkan **kamera**. Bila sudah ditolak: tekan **Buka Pengaturan** → izinkan Kamera → kembali → **Coba lagi**.
2. Di HP/laptop yang menampilkan QR: tekan **⛶ Layar penuh** dan **naikkan kecerahan layar** sampai penuh.
3. Pegang kamera tegak lurus, sejarak 20–30 cm, sampai QR memenuhi bingkai. Token panjang terdiri dari beberapa QR yang berganti sendiri — tahan sampai tertulis semua bagian terbaca (mis. "7 dari 7").
4. Bila tetap gagal: pilih **Kirim lewat WA** / **Salin** di pengirim, lalu **Tempel Token** di penerima.

### 12.2 Masalah lain

| Masalah | Yang dilakukan |
|---|---|
| Pesan "Kode ini untuk aplikasi laptop (EXE), bukan untuk HP." | Kode itu untuk laptop desa/kelompok/kurikulum. Tempel di laptop pada **Aktifkan dengan kode**. Untuk HP, minta token pengurus/mubaligh dari Admin Desa. |
| Pesan "Wilayah token berada di luar wilayah EXE desa penerbitnya" | Token itu tidak sah untuk kelompok tersebut. Minta Admin Desa menerbitkan ulang setelah membuka paket terbaru dari daerah. |
| HP aktif dengan token dari desa sebelum pembaruan v3 ini, lalu muncul pesan "pengirim tidak sah" | Minta Admin Desa menerbitkan token baru untuk HP itu (Kode Perangkat sama) → **+ Tambah Profil** → **Aktifkan**. Catatan lama tetap utuh. |
| Pesan "Data kelompok ini belum lengkap dari daerah" saat desa menerbitkan token | Admin Desa: **Buka Paket** terbaru dari daerah, lalu terbitkan lagi. |
| Berkas "Sudah pernah diimpor" atau "tidak lebih baru" | Datanya sudah masuk / perangkat sudah memegang berkas yang lebih baru. Abaikan. |
| Pesan "bukan untuk HP ini" / "bukan untuk EXE ini" | Berkas untuk wilayah atau perangkat lain, atau token perangkat ini sudah dicabut. Hubungi admin di atasnya. |
| Pesan setoran "ditujukan ke tingkat lain" | Kirim berkas ke tujuan yang tertulis di tombol **Setor ke …** (kelompok/desa). |
| Desa/kelompok tampil **Terlambat** | Lakukan **Setor ke …** sekarang. Periksa jam dan tanggal HP/laptop sudah benar (WIT). |
| Lupa kata sandi Admin Daerah | Layar Masuk → **Lupa kata sandi?** → pilih berkas `.ppgkey` → isi **Kata sandi cadangan kunci** dan **Kata sandi admin baru** → **Pulihkan & masuk**. |
| Lupa kata sandi aplikasi laptop desa/kelompok/kurikulum | Tidak bisa dipulihkan. Pasang ulang → **Pulihkan dari cadangan** (database + kata sandinya), atau **Aktifkan dengan kode** baru dari tingkat atas. |
| Lupa PIN profil HP | Minta token ulang dari penerbitnya → **+ Tambah Profil** → **Tempel Token** → isi PIN baru → **Aktifkan**. |
| HP hilang / rusak | Dengan cadangan: pasang APK → **Profil & HP** → **Pulihkan dari cadangan**. Tanpa cadangan: admin **Cabut** token lama, lalu aktivasi ulang dari Kode Perangkat HP baru. |
| Token kedaluwarsa ("Masa berlaku profil habis") | Kirim Kode Perangkat ke penerbit token → terima token baru → **+ Tambah Profil** → **Aktifkan**. |
| Daerah memulihkan database lama | Minta desa **Setor ke Daerah → Pilihan lain → Kirim ulang semua data**. |
