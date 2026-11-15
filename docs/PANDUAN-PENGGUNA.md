# Panduan Pengguna PPG Sorong v3

Aplikasi PPG Sorong dipakai **tanpa internet**. Data berpindah lewat **berkas yang dikirim di WhatsApp (WA)**. Nama berkas selalu diawali `PPG_…`.

- **Laptop (EXE, "PPG Sorong Admin")** dipakai Admin Daerah, Admin Desa, Admin Kelompok (bila kelompok memakai laptop), dan Petugas Kurikulum. Satu aplikasi untuk semua; perannya ditentukan oleh kode aktivasi.
- **HP (APK, "PPG Sorong")** dipakai pengurus, mubaligh, murid (generus), dan orang tua (wali). Satu HP bisa berisi beberapa profil.

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
3. Simpan sebagai **CSV** → tekan **Impor CSV** → pilih berkasnya.
4. Baris yang gagal tampil dengan alasannya. Perbaiki baris itu lalu impor lagi.
5. Satu per satu: **+ Tambah generus**. Pindah kelompok dan ubah status lewat tombol **Pindah** dan **Status** di baris generus.

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
5. Kirim paket setiap selesai impor setoran, menyetujui usulan, mengubah data, atau mengimpor kurikulum.

### 2.11 Beranda: status setor

1. Menu **Beranda** → tabel **Status setor tiap desa**.
2. Tiap desa tampil dengan jadwal, tenggat berikutnya, setor terakhir, dan lencana **Tepat waktu** (hijau) atau **Terlambat** (merah).
3. Hubungi desa yang terlambat.

### 2.12 Rekap & Excel

1. Menu **Rekap & Laporan** → pilih wilayah dan rentang tanggal.
2. Lihat kartu **Capaian target** (per desa, kelompok, kelas) serta presensi dan kemajuan.
3. Tekan **Ekspor Excel**. Rekap hanya memuat materi yang sudah **disahkan**.

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

---

## 7. Pengurus (HP)

Menu bawah: **Beranda · Absen · Data · Rekap · Sinkron**.

1. Aktivasi seperti 6.1 (token dari Admin Desa).
2. **Beranda**: kartu pengingat **Setor ke …** dan ringkasan generus.
3. **Absen**: seperti 6.2, tanpa centang tuntas (hanya kehadiran).
4. **Data**: lihat generus → **+ Usulkan generus baru** bila ada anak baru.
5. **Rekap**: kehadiran dan kemajuan wilayah Anda.
6. **Sinkron** → **Setor ke …** → kirim berkasnya; buka paket baru dari desa lewat **Buka Berkas**.

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
7. Kakak-adik di satu HP: **Profil & HP** → **+ Tambah Profil** untuk anak berikutnya (lihat bagian 8).

---

## 10. Orang tua / wali (HP)

Menu bawah: **Target · Laporan · Kemajuan · Kehadiran · Berkas**.

1. Kirim **Kode Perangkat** ke mubaligh → terima token → **Aktifkan**.
2. Setiap pekan buka berkas Balasan dari mubaligh: **Berkas** → **Buka Berkas**.
3. **Target**: materi yang perlu dituntaskan anak. Punya beberapa anak: pilih nama di **Pilih anak**.
4. **Laporan**: laporan pekanan (geser pekan dengan **‹** / **›**).
5. **Kemajuan** dan **Kehadiran** (60 hari terakhir) per anak.

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
