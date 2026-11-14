# Panduan Pengguna PPG Sorong

Aplikasi PPG Sorong dipakai **tanpa internet**. Data berpindah lewat **berkas yang dikirim di WhatsApp (WA)**:

- **Admin** memegang aplikasi komputer (**PPG Sorong Admin**, berkas EXE) — pusat semua data.
- **Pengurus, mubaligh, generus, dan orang tua (wali)** memakai aplikasi HP (**PPG Sorong**, berkas APK). Satu HP bisa dipakai beberapa orang (profil).

Alur besarnya:

```
Admin ──(Paket)──► Pengurus/Mubaligh ──(Balasan)──► Generus/Wali
Admin ◄──(Setor)── Pengurus/Mubaligh ◄──(Setor Belajar)── Generus
```

Nama berkas selalu diawali `PPG_…`. Bila menerima berkas PPG di WA, tekan berkasnya lalu pilih **Buka dengan PPG Sorong**, atau simpan dulu lalu buka lewat tombol **Buka Berkas** di aplikasi.

---

## 1. Mengunduh aplikasi

### Dari GitHub Actions (versi uji terbaru)
1. Buka `https://github.com/dausdabamona/PPG-ofline` → tab **Actions**.
2. Pilih proses terbaru yang bertanda centang hijau: **Build APK (Capacitor)** untuk HP, **Build EXE Admin (Electron)** untuk komputer.
3. Gulir ke bawah ke bagian **Artifacts**, unduh **PPG-Sorong-APK** (HP) atau **PPG-Sorong-Admin-Windows** (komputer). Hasilnya berkas ZIP — ekstrak dulu.
4. **Penting:** berkas di Artifacts **hilang setelah 30 hari**. Untuk rilis yang tetap tersimpan, buat tag versi (contoh `v0.1.0`):
   `git tag v0.1.0 && git push origin v0.1.0` — workflow otomatis membuat halaman **Releases** berisi APK dan EXE yang tidak kedaluwarsa.

### Memasang di komputer admin (Windows)
1. Jalankan `PPG Sorong Admin-Setup-0.1.0.exe` (atau versi `Portable` bila tidak ingin dipasang).
2. Bila muncul layar biru **"Windows protected your PC" / "Windows melindungi PC Anda"** (SmartScreen), klik **Info lainnya / More info** → **Tetap jalankan / Run anyway**. Peringatan ini muncul karena aplikasi belum bertanda tangan resmi; aman bila berkas diunduh dari repo di atas.
3. Ikuti langkah pemasangan, lalu buka **PPG Sorong Admin** dari menu Start.

### Memasang di HP Android
1. Kirim `app-debug.apk` ke HP (lewat WA ke diri sendiri, kabel, atau Google Drive), lalu buka berkasnya.
2. Bila muncul peringatan, buka **Setelan** → izinkan **Instal dari sumber tidak dikenal / Install unknown apps** untuk aplikasi yang dipakai membuka berkas (WA, File, atau Chrome).
3. Kembali dan tekan **Instal**. Bila Play Protect bertanya, pilih **Tetap instal**.
4. Buka **PPG Sorong**, isi **Nama HP ini** (mis. "HP Bu Aminah"), tekan **Lanjut**.

---

## 2. Admin (komputer)

### 2.1 Pengaturan awal (sekali saja)
1. Buka aplikasi → tab **Buat admin baru** → isi **Nama organisasi** dan **Kata sandi admin** (minimal 8 karakter) → simpan.
2. **WAJIB — cadangan kunci admin di 2 tempat.** Menu **Pengaturan** → **Cadangan kunci admin** → isi **Kata sandi cadangan** (boleh berbeda dari sandi admin) → **Ekspor cadangan kunci**. Simpan berkas `PPG_KUNCI_ADMIN_….ppgkey` di **dua tempat berbeda** (mis. flashdisk + Google Drive/WA ke diri sendiri), dan catat sandi cadangannya di buku.
   Tanpa berkas ini, bila laptop rusak atau sandi lupa, **semua HP harus diaktifkan ulang dari nol**.
3. **Pengaturan** → **Simpan cadangan database** secara berkala (mis. tiap bulan) ke flashdisk. Aplikasi juga menyimpan salinan harian otomatis di folder data.

### 2.2 Wilayah
1. Menu **Wilayah** → **+ Tambah daerah** (nama + kode singkat, mis. `SRG`).
2. Di bawah daerah tambahkan **desa**, lalu di bawah desa tambahkan **kelompok**. Kode kelompok (mis. `K1`) dipakai di berkas CSV.

### 2.3 Data generus (impor CSV)
1. Menu **Generus & Jamaah** → **Unduh templat CSV**, buka di Excel.
2. Isi satu baris per generus: `nama`, `jenis_kelamin` (L/P), `tanggal_lahir` (boleh `DD/MM/YYYY`), `kategori` (boleh kosong → dihitung dari umur), `kelompok_kode`, `wali_nama`, `wali_no_hp`.
3. Simpan sebagai **CSV** → **Impor CSV** → pilih berkasnya. Baris yang gagal ditampilkan beserta alasannya; perbaiki lalu impor lagi baris itu.
4. Generus satu per satu: **+ Tambah generus**. Pindah kelompok dan ubah status (mondok/aktif/lulus/keluar) lewat tombol di baris generus.

### 2.4 Pengajian & materi
1. Menu **Pengajian**: isi jadwal rutin (hari, jam, tempat) per kelompok/desa.
2. Menu **Materi**: kurikulum sudah terisi. Tambah bacaan atau PDF bila perlu → **Buat Berkas Materi** → kirim berkas `PPG_MATERI_v….ppg` ke grup WA pengurus/mubaligh/generus.

### 2.5 Aktivasi pengurus & mubaligh
1. Minta orangnya memasang APK dan mengirimkan **Kode Perangkat** lewat WA (layar pertama aplikasi HP → **Kirim lewat WA**).
2. Menu **Perangkat & Token** → tempel Kode Perangkat → pilih **Peran** (mubaligh: satu kelompok; pengurus: kelompok/desa/daerah), **Wilayah tugas**, **Nama pemegang** → **Terbitkan token**.
3. Kirim token: tekan **Salin token** lalu tempel di WA ke orangnya (dia memilih **Tempel Token**), atau tunjukkan layar komputer agar dia memilih **Pindai QR Token**. Token yang panjang tampil sebagai **beberapa QR yang berganti otomatis** — tahan kamera HP sampai tertulis semua bagian terbaca.
4. Segera **Kirim Paket** (2.8) untuk wilayahnya agar HP-nya berisi data.

### 2.6 Impor setoran
1. Kumpulkan berkas `PPG_SETOR_….ppg` dari WA pengurus/mubaligh (simpan ke satu folder).
2. Menu **Impor Setoran** → **Pilih berkas setoran** → pilih semua sekaligus. Ringkasan per berkas tampil; berkas yang sama diimpor dua kali tidak menggandakan data.
3. Bila ada "rekaman ditolak", baca alasannya dan buat **Koreksi** bila perlu.

### 2.7 Usulan
Generus baru, pindah kelompok, atau ubah status dari HP masuk sebagai **usulan**. Menu **Usulan** → **Setujui** atau **Tolak** (isi alasan). Hasilnya sampai ke HP lewat paket berikutnya.

### 2.8 Kirim paket
Menu **Kirim Paket** → pilih wilayah → **Buat & simpan paket**, atau **Paket semua kelompok** (pilih folder). Kirim tiap berkas `PPG_PAKET_….ppg` ke pengurus/mubaligh wilayah itu. Kirim paket setiap selesai impor setoran, menyetujui usulan, atau mengubah data.

### 2.9 Rekap & Excel
Menu **Rekap & Laporan** → pilih wilayah dan rentang tanggal → lihat kehadiran & kemajuan → **Ekspor Excel**. Rekap resmi hanya memuat materi yang sudah **disahkan** mubaligh.

### 2.10 Serah terima mubaligh (ganti mubaligh kelompok)
1. Mubaligh lama: HP → **Lainnya → Setor Data → Pilihan lain → Setor Akhir** → kirim berkasnya ke admin.
2. Admin: **Impor Setoran** berkas Setor Akhir itu.
3. **Perangkat & Token** → **Serah terima mubaligh** pada kelompok itu → pilih mubaligh lama → **Jalankan serah terima** (bila HP lama hilang: centang opsi paksa). Token lama dicabut dan kunci kelompok diganti.
4. Terbitkan token untuk mubaligh baru (2.5), lalu **Kirim Paket** kelompok itu.
5. **Pesan penting untuk mubaligh baru:** pada **hari serah terima itu juga**, buka **Lainnya → Kirim Balasan → Kirim Balasan ke semua** dan kirim berkasnya ke setiap HP generus/wali. Sampai Balasan ini dibuka, HP generus masih mempercayai mubaligh lama.

### 2.11 Lupa kata sandi admin
Di layar Masuk tekan **Lupa kata sandi?** → **Pilih berkas .ppgkey** → isi **Kata sandi cadangan kunci** dan **Kata sandi admin baru** → **Pulihkan & masuk**. Data di komputer tetap utuh.

---

## 3. Mubaligh (HP)

1. **Aktivasi:** buka aplikasi → **Kirim lewat WA** (Kode Perangkat ke admin) → terima token → **Tempel Token** (atau **Pindai QR Token**) → **Aktifkan**.
2. **Data dari admin:** buka berkas `PPG_PAKET_…` dan `PPG_MATERI_…` dari WA (**Buka dengan PPG Sorong**, atau **Lainnya → Buka Berkas**).
3. **Token generus/wali:** **Lainnya → Terbitkan Token** → pilih generus (atau centang anak-anak untuk wali) → **Pindai QR Kode Perangkat** HP mereka (atau tempel) → **Terbitkan Token**. Tunjukkan layar: QR berganti sendiri; minta mereka menahan kamera sampai semua bagian terbaca. Cara lain: **Kirim lewat WA** → mereka pilih **Tempel Token**.
4. **Setoran generus:** tab **Setoran** → **Buka berkas setoran** (`PPG_BELAJAR_…`, boleh banyak) → isi catatan → **Sahkan** atau **Tolak**.
5. **Generus tanpa HP:** tab **Simak** → pilih generus & materi → **Simpan & sahkan**.
6. **Presensi:** **Lainnya → Presensi** → pilih pertemuan → **Semua hadir** lalu ubah yang izin/sakit/alpa → **Simpan presensi**.
7. **Kirim Balasan:** **Lainnya → Kirim Balasan → Kirim Balasan ke semua** → kirim tiap berkas ke HP generus/wali yang sesuai.
8. **Jadwal tambahan:** **Lainnya → Jadwal Tambahan** → simpan → **Bagikan ke grup WA**.
9. **Laporan pekanan ke orang tua:** **Lainnya → Laporan Pekanan** → **Kirim WA ke …** per anak.
10. **Setor Data ke admin:** **Lainnya → Setor Data → Setor Data** → kirim berkas `PPG_SETOR_…` ke admin.
11. Usulan generus baru/mondok/pindah: tab **Generus** → pilih nama → ajukan. Usulan ikut Setor Data.

## 4. Pengurus (HP)

1. Aktivasi sama seperti mubaligh (token dari admin), lalu buka berkas paket dari admin.
2. **Presensi** → pilih kelompok (pengurus desa/daerah) dan pertemuan → isi → **Simpan presensi**.
3. **Data** → lihat generus; **+ Usulkan generus baru** bila ada anak baru.
4. **Rekap** → kehadiran dan kemajuan wilayah Anda.
5. **Sinkron → Setor Data** → kirim berkas ke admin. Buka paket baru dari admin lewat **Buka Berkas**.

## 5. Generus (HP)

1. Buka aplikasi → **Kirim lewat WA** atau tunjukkan QR Kode Perangkat ke mubaligh.
2. Terima token: **Pindai QR Token** dan arahkan kamera ke layar mubaligh sampai tertulis semua bagian terbaca (atau **Tempel Token** dari WA) → boleh pasang PIN 4 angka → **Aktifkan**.
3. Kakak-adik di satu HP: **Profil (pojok kanan atas) → + Tambah Profil** untuk anak berikutnya.
4. Buka berkas **Balasan** dan **Materi** dari mubaligh (**Setor → Buka Berkas**).
5. **Materiku**: lihat target ★ dan bacaan. **Catat**: pilih materi → isi → **Simpan catatan**.
6. **Setor → Setor Belajar** → kirim berkas `PPG_BELAJAR_…` ke mubaligh. Satu berkas sudah berisi catatan semua profil di HP itu.
7. Saat mondok, aplikasi menampilkan **"Sedang mondok — pencatatan dihentikan sementara"**; data lama tetap bisa dilihat.

## 6. Wali / orang tua (HP)

1. Kirim Kode Perangkat ke mubaligh, terima token (pindai QR atau tempel) → **Aktifkan**.
2. Buka berkas **Balasan** dari mubaligh setiap pekan (**Berkas → Buka Berkas**).
3. **Laporan**: kehadiran, materi disahkan, catatan mubaligh, target berikutnya. Bila punya beberapa anak, pilih nama anak di atas.
4. **Kemajuan** dan **Kehadiran** (60 hari terakhir) per anak.

## 7. Cadangan data HP (semua peran)

**Profil (pojok kanan atas) → Cadangkan data HP** → isi **kata sandi cadangan** dua kali (minimal 6 karakter) → simpan berkas `PPG_CADANGAN_HP_….ppgdb` ke Google Drive atau WA "pesan untuk diri sendiri". **Catat sandinya** — tanpa sandi, cadangan tidak bisa dibuka.
Memulihkan (HP baru/rusak): pasang APK → isi nama HP → **Profil → Pulihkan dari cadangan** → pilih berkas → isi sandi → **Pulihkan**.

---

## 8. Jadwal rutin yang disarankan

| Kapan | Siapa | Kegiatan |
|---|---|---|
| Setiap pengajian | Pengurus / mubaligh | Isi presensi |
| Setiap pekan (mis. Sabtu) | Generus | **Setor Belajar** ke mubaligh |
| Setiap pekan (mis. Ahad) | Mubaligh | Buka setoran generus → sahkan/tolak → **Kirim Balasan ke semua** → **Laporan Pekanan** ke orang tua |
| Setiap pekan (mis. Ahad malam) | Pengurus & mubaligh | **Setor Data** ke admin |
| Setiap pekan (mis. Senin) | Admin | **Impor Setoran** → periksa **Usulan** → **Kirim Paket** semua kelompok |
| Setiap bulan | Admin | **Rekap & Laporan → Ekspor Excel**; **Simpan cadangan database** ke flashdisk |
| Setiap bulan | Semua HP | **Cadangkan data HP** |

Aplikasi HP mengingatkan bila ada data belum disetor lebih dari 7 hari. Di Beranda admin, kelompok yang belum setor lebih dari 14 hari ditandai merah.

## 9. Jika terjadi masalah

| Masalah | Yang dilakukan |
|---|---|
| **HP hilang / rusak** | Bila punya cadangan: pasang APK di HP baru → **Pulihkan dari cadangan**. Bila tidak: admin **Cabut** token HP lama (**Perangkat & Token**), lalu aktivasi ulang dari Kode Perangkat HP baru (generus/wali: token baru dari mubaligh). Mubaligh yang HP-nya hilang: admin menjalankan **Serah terima** dengan opsi paksa. |
| **Lupa kata sandi admin** | Layar Masuk → **Lupa kata sandi?** → pakai berkas `.ppgkey` + sandi cadangannya (2.11). Tanpa `.ppgkey`, kunci tidak bisa dipulihkan — karena itu cadangan kunci WAJIB di 2 tempat. |
| **Lupa PIN profil HP** | Minta mubaligh mengirim ulang token anak itu (atau token baru) lewat WA → di HP: **Pilih Profil → + Tambah Profil → Tempel Token**, isi **PIN baru** → **Aktifkan**. Profil yang sama diperbarui dengan PIN baru; catatannya tetap utuh. |
| **Berkas tidak bisa dibuka** | Pastikan berkas dibuka di HP/aplikasi yang tepat (Setor → admin; Belajar → mubaligh; Paket → pengurus/mubaligh; Balasan → HP generus/wali yang dituju). Pesan "sudah pernah dibuka" berarti datanya sudah masuk. Pesan "tidak lebih baru / lebih lama dari yang sudah terpasang" berarti HP sudah memegang berkas yang lebih baru — abaikan, atau minta yang terbaru. Bila WA mengganti nama berkas, tetap bisa dibuka lewat tombol **Buka Berkas**. Pesan "bukan untuk HP ini" pada paket berarti berkas untuk wilayah lain, atau token HP itu sudah dicabut/dibekukan — hubungi admin. |
| **Token kedaluwarsa** ("Masa berlaku profil habis") | Data lama tetap bisa dilihat, tetapi tidak bisa mencatat/menyetor. Kirim Kode Perangkat ke admin (pengurus/mubaligh) atau mubaligh (generus/wali) → terima token baru → **+ Tambah Profil** → aktifkan. Catatan yang belum disetor ikut terkirim setelah token baru aktif. |
| **QR tidak terbaca** | Terangkan layar, dekatkan/jauhkan kamera sampai QR memenuhi bingkai, tekan **Jeda** lalu **Berikutnya** untuk bagian yang belum terbaca. Bila tetap gagal, pakai **Kirim lewat WA** → **Tempel Token**. |
| **Admin memulihkan database lama** | Minta semua pengurus/mubaligh **Setor Data → Pilihan lain → Kirim ulang semua data** agar data yang hilang di admin terisi lagi. |
