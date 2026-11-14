# Laporan Tahap Pembangunan PPG Sorong v2

Setiap fase menambahkan bagian di bawah: apa yang dibuat, hasil uji (angka), keputusan otonom baru, sisa masalah.

---

## Fase 1 — packages/core (2026-11-14)

### Yang dibuat
- **Workspace npm** di akar: `package.json` (private, workspaces `packages/*`, `apps/*`; skrip `test`, `typecheck`, `build`, `coverage` per workspace dengan `--workspaces --if-present` — aman walau `apps/` belum ada), `tsconfig.base.json` (TS strict, ESM, `moduleResolution: Bundler`).
- **`packages/core` (@ppg/core)** dikonsumsi langsung dari source (`main`/`types`/`exports` → `src/index.ts`). Dependensi: `sql.js` 1.16, `libsodium-wrappers` 0.8, `fflate` 0.8; dev: `vitest` 5.1, `@vitest/coverage-v8`, `typescript` 5.9, `@types/sql.js`, `@types/node`. Tanpa binary native/postinstall.
- Modul §2: `ids`, `waktu`, `crypto` (+ `sha256`), `token`, `berkas`, `skema`, `db`, `repo/*` (umum, wilayah, generus+jamaah, pengajian, materi, koreksi, presensi, kemajuan, penilaian, jadwal-tambahan, usulan, perangkat, profil, kegiatan-umum), `gabung`, `sinkron/*` (setor, paket, belajar, balasan, jadwal, materi, pengirim, umum, index), `admin`, `perangkat`, `siklus`, `laporan`, `kurikulum`, `csv`, `galat`.
- `bukaDb(bytes?, { locateFile?, wasmBinary? })` jalan di Node (uji) dan siap untuk browser; ikut menyiapkan libsodium.
- Kurikulum lama ter-seed otomatis saat `inisialisasiAdmin`: 5 bidang, 24 kategori, **420 materi** (pemetaan `materi_mapping` sama persis dengan `desktop/database/seed_kurikulum.py`, termasuk ALM-HDD = daftar dalil GBMTPG).
- `packages/core/README.md`: daftar API publik + contoh tiap alur.
- `docs/RENCANA-IMPLEMENTASI.md` diperbarui (T10–T21, §4, §5, §6.3, §7, §8, §9).

### Hasil uji
- `npm test`: **13 berkas, 86 test lulus** (0 gagal). `npm run typecheck`: bersih.
- `test/skenario-lengkap.test.ts`: 18 langkah §13 lulus — 7 aktor, masing-masing satu database (admin, pengurus, mubaligh lama, mubaligh baru, HP generus 2 profil, HP wali, HP lain/penyusup), berkas berpindah sebagai byte.
- Test unit: kripto (vektor SHA-256 & PBKDF2 dibanding Node crypto), token & rantai (semua pelanggaran rantai), berkas, gabung, laporan, siklus, csv, admin, perangkat, repo, dasar (waktu/ids/db), keamanan sinkron (rekaman dimanipulasi di DB HP ditolak admin/mubaligh).
- Cakupan (`@vitest/coverage-v8`): **statements 95,2 %, branches 86,9 %, functions 99,1 %, lines 97,7 %** (target > 85 % terpenuhi).

### Keputusan otonom baru (dicatat juga di tabel T rencana)
- **T10 — PAKET beramplop per penerima** (pengganti kunci wilayah): menutup celah mubaligh/pengurus tercabut yang masih bisa membuka paket berikutnya.
- **T11 — `perangkat`/`pencabutan` per token**, bukan per HP: syarat agar mondok kakak tidak membekukan adik di HP yang sama.
- **T12 — token generus dari penerbit tercabut wajib terdaftar**: mencegah pemalsuan tanggal terbit oleh mubaligh tercabut (diuji dengan memundurkan jam).
- **T13 — admin memeriksa pemilik rekaman, hak `sahkan`, dan status usulan**.
- **T14** aturan JADWAL lama; **T15** heuristik bentrok; **T16** pindah kelompok/keluar mencabut token generus lama; **T17** id kurikulum tetap; **T18** CSV fleksibel (kategori dari umur, DD/MM/YYYY, `;`); **T19** rentang riwayat `[mulai, selesai)`; **T20** SHA-256 murni TS; **T21** `urut` = seq tertinggi yang dibawa.
- Tambahan kecil: `buatBelajar(db, { kelompokId? })` (profil lintas kelompok), `gantiSandiAdmin`, `imporBanyak(db, daftar, kunciAdmin?)`, `daftarPenerimaBalasan`, `jumlahBelumDisetor(Belajar)`, `PetaRiwayat`; pencatatan kegiatan di HP otomatis memeriksa profil berwenang; presensi/penilaian dideduplikasi per kunci alami saat dibaca; berkas yang sama diimpor ulang → `sudahPernah: true` (berdasar SHA-256 berkas).

### Belum sempurna / catatan untuk fase berikut
- PAKET selalu berisi **seluruh** data wilayah (bukan inkremental). Untuk ±300 generus × 1 tahun presensi perkiraan < 1 MB setelah gzip; bila membesar, batasi kegiatan ke N bulan terakhir.
- `kunci_umum_kelompok` (JADWAL) tidak dirotasi saat serah terima; mubaligh lama masih bisa membaca jadwal (data tidak sensitif).
- Rekaman yang ditolak admin tetap dianggap terkonfirmasi (tidak dikirim ulang); penolakan dilaporkan di ringkasan impor untuk ditindaklanjuti lewat koreksi.
- Kunci rahasia di HP (identitas & kunci kelompok) disimpan polos di database lokal (IndexedDB); PIN profil hanya kunci antarsaudara (SHA-256 bergaram, 4 digit), bukan enkripsi.
- Waktu `terbit`/`dibuat_pada` berasal dari jam perangkat; jam HP yang salah dapat membuat token tampak kedaluwarsa/berlaku.
- Kedaluwarsa token pengirim SETOR dinilai saat impor (setoran yang dibuat sebelum habis masa berlaku tetapi diimpor sesudahnya ditolak; datanya ikut setoran berikutnya setelah token diperpanjang).
- Uji browser (Vite + wasm `locateFile`) baru diverifikasi lewat opsi `wasmBinary` di Node; uji nyata menyusul di fase apps.

---

## Fase 1b — Pemeriksaan core (2026-11-14)

Pemeriksa independen membaca rencana, laporan Fase 1, README, seluruh `packages/core/src` dan test-nya, lalu mencari cacat nyata. Setiap cacat direproduksi dulu dengan test yang **gagal** (`test/pemeriksaan.test.ts`), baru diperbaiki pada akar masalahnya.

### Temuan & perbaikan

| # | Tingkat | Temuan | Perbaikan |
|---|---|---|---|
| 1 | **Kritis** | Kunci setor publik di BALASAN/token generus tidak diautentikasi. Mubaligh (atau aplikasinya yang diubah, atau mubaligh yang sudah dicabut) bisa mengirim kunci versi 99 miliknya; HP generus memakai versi tertinggi → semua BELAJAR berikutnya hanya bisa dibuka penyusup, mubaligh sah tidak bisa | T22: admin menandatangani tiap kunci setor (`tt`); HP generus/wali hanya menyimpan & memakai kunci bertanda tangan sah untuk org + kelompoknya |
| 2 | **Kritis** | HP generus/wali tidak pernah menerima pencabutan token mubaligh: setelah serah terima, mubaligh lama tetap diterima sebagai pengirim BALASAN/JADWAL (bisa mencairkan profil mondok, menyisipkan "pengesahan" palsu yang tampil di laporan wali) | T24: BALASAN & JADWAL membawa pencabutan semua token mubaligh kelompok; beku/cair hanya diterima untuk token HP itu sendiri |
| 3 | **Kritis** (sisa masalah Fase 1) | Kunci umum kelompok (JADWAL) tidak pernah diganti: mubaligh lama tetap membaca jadwal baru | T23: kunci umum berversi, diganti di `gantiKunciKelompok` (termasuk serah terima); tersebar via PAKET & BALASAN; skema v2 |
| 4 | Sedang | Admin menerima kegiatan generus kelompok lain asalkan `kelompok_id` ditulis kelompok pengirim → mubaligh K1 bisa "mengesahkan" materi generus K2 dan masuk rekap resmi; presensi sebelum generus terdaftar juga diterima | T25: pemeriksaan keanggotaan pada tanggal kegiatan menurut riwayat admin (`PetaRiwayat.anggotaDalamRentang` untuk penilaian bulanan); generus tak dikenal ditolak |
| 5 | Sedang | `konfirmasi_belajar_seq` satu angka per HP, sedangkan `urut` = `meta.seq` → di HP dengan profil dua kelompok, konfirmasi mubaligh A "menelan" catatan kelompok B (tidak pernah terkirim) | T26: konfirmasi per kelompok; `jumlahBelumDisetorBelajar(db, kelompokId?)` |
| 6 | Sedang | Catatan kakak yang dibekukan (mondok) sebelum sempat disetor ikut terkonfirmasi oleh setoran adiknya di HP yang sama → hilang setelah aktif lagi | T26: `urut` BELAJAR dibatasi `min seq tertunda − 1` |
| 7 | Sedang | Admin memulihkan database dari cadangan → nomor versi paket mundur → semua HP menolak PAKET/MATERI selamanya (`PAKET_LAMA`); suntingan master admin yang dipulihkan juga diabaikan HP (versi lebih rendah) | T27: berkas diterima bila versi **atau** cap waktu lebih baru (berkas lama yang diputar ulang tetap ditolak); master menang juga bila `diubah_pada` lebih baru; `buatSetor(db, { semua: true })` untuk mengisi ulang admin |
| 8 | Ringan | BALASAN diterapkan sebagai "sumber admin" untuk semua tabel: berkas mubaligh rakitan bisa menimpa materi atau menulis data generus lain di HP generus | T24: BALASAN hanya menerima data generus penerima, rantai wilayah kelompoknya, jadwal kelompoknya, koreksi untuk HP itu; JADWAL hanya pengajian kelompok+induk dan jadwal tambahan kelompok |
| 9 | Ringan (API) | UI harus menulis SQL sendiri untuk banyak layar §11–§12 (beranda admin, status token, jadwal pekan, lembar presensi, materi + status, daftar diajukan dengan nama, indikator setor terakhir) | T28: modul `kueri.ts` (14 fungsi, didokumentasikan di README §11); `meta.terakhir_setor/terakhir_belajar` |

Hal yang diperiksa dan **tidak** cacat: tanda tangan berkas mencakup semua byte (magis + panjang + header + isi); token terikat kunci perangkat (tidak bisa dipakai di HP lain); org berbeda ditolak di semua jalur; impor ganda idempoten (sidik SHA-256 + `samaIsi`); urutan berkas acak aman (LWW + `MAX` seq); hasil pengesahan tidak tertimpa versi diajukan; hapus lunak tersinkron; `seq_lokal` = 0 untuk data dari PAKET/BALASAN/JADWAL/MATERI (tidak memantul); laporan pekanan Ahad–Sabtu, target sesuai kategori, teks WA hanya data anak itu, `08… → 628…`; `src/` tidak memakai modul Node (sql.js memilih `sql-wasm-browser.js` lewat `exports.browser`; `bukaDb` menerima `locateFile`/`wasmBinary`).

### Test baru
- `test/pemeriksaan.test.ts` — 9 test (8 reproduksi cacat #1–#8, semuanya gagal sebelum perbaikan; 1 regresi pembekuan lewat BALASAN).
- `test/kueri.test.ts` — 6 test kueri UI + 1 test "src/ tidak mengimpor modul bawaan Node / global Node".

### Hasil uji akhir
- `npm test`: **15 berkas, 102 test lulus** (sebelumnya 13 berkas / 86 test). `npm run typecheck`: bersih.
- Cakupan: statements 95,5 %, branches 86,6 %, functions 99,0 %, lines 97,7 %.

### Perubahan desain (dicatat di rencana sebagai T22–T28)
Skema naik ke **v2** (migrasi `ALTER TABLE kunci_umum_kelompok ADD COLUMN versi`). Format isi berkas bertambah field opsional: `KunciSetor.tt`, `RahasiaToken.kunci_umum_versi`, `IsiPaket.kunci_umum`, `IsiBalasan.kunci_umum`, `IsiJadwal.pencabutan`. Meta `konfirmasi_belajar_seq` diganti `konfirmasi_belajar_seq:<kelompok>`.

### Sengaja tidak diperbaiki (alasan)
- **Jendela sesudah serah terima**: sampai HP generus menerima BALASAN pertama dari mubaligh baru, mubaligh lama masih diterima sebagai pengirim (bisa mengirim data tampilan palsu/mencairkan profil — **tidak** bisa lagi menyadap BELAJAR berkat T22). Menutupnya butuh pencabutan bertanda tangan admin yang sampai langsung ke HP generus; tidak ada jalur admin → generus. Mitigasi operasional: mubaligh baru segera mengirim BALASAN ke semua HP (dicatat di README).
- HP mubaligh lama sendiri tidak pernah tahu ia dicabut (bukan penerima PAKET); aplikasinya tetap jalan lokal, tetapi berkasnya ditolak admin dan HP generus yang sudah diperbarui.
- Catatan pencabutan di BALASAN tidak ditandatangani per catatan; mubaligh aktif dipercaya untuk kelompoknya sendiri (dampak terbatas pada kelompoknya).
- Rekaman SETOR yang ditolak admin (wewenang/keanggotaan/token salah satu profil kedaluwarsa) tetap dianggap terkonfirmasi — seperti Fase 1; penolakan tampil di ringkasan impor untuk ditindaklanjuti koreksi. Membedakan penolakan "sementara" butuh seq per rekaman di sisi admin.
- `generus_ids` token wali tidak divalidasi admin terhadap kelompok penerbit — tidak ada jalur kebocoran (HP mubaligh hanya memegang data kelompoknya), jadi dibiarkan.
- Setelah pemulihan cadangan admin, data yang masuk setelah cadangan dibuat hanya kembali bila HP mengirim `buatSetor({ semua: true })` (atau berkas setoran lama diimpor ulang); UI perlu tombol "Setor ulang semua data".
- Sisa catatan Fase 1 lain (PAKET tidak inkremental, kunci rahasia polos di DB HP, jam perangkat) tidak berubah.

---

## Fase 2 — EXE admin (`apps/desktop`, 2026-11-14)

### Yang dibuat
- **Electron 45** (main + preload, `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity`), satu instans saja, izin perangkat ditolak, navigasi/jendela baru diblokir. Renderer dimuat dari protokol `app://` dengan CSP `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; …` (T29).
- **IPC** (`electron/api.ts`, diekspos sebagai `window.ppgAdmin`): `db:muat`, `db:simpan` (tulis `.tmp` → rename atomik; sebelum menimpa, salinan harian `userData/cadangan/ppg-admin-YYYYMMDD.db`, disimpan 30 terbaru — `electron/penyimpanan.ts`), `berkas:bukaBanyak(filter, banyak)`, `berkas:simpan(namaSaran, bytes)`, plus `berkas:simpanKeFolder`, `aplikasi:folderData`, sinyal tutup (T30). Setiap IPC memeriksa asal frame.
- **Renderer React 19 + Vite 8 + TS strict** memakai `@ppg/core` langsung; sql.js build peramban (`sql.js/dist/sql-wasm-browser.wasm?url` — pasangan `sql-wasm-browser.js` yang dipilih Vite lewat `exports.browser`; `sql-wasm.wasm` milik build Node). Semua akses Electron lewat `src/platform.ts` (`platformElectron`, `platformPeramban` untuk uji di browser; uji memakai platform palsu).
- **13 layar §11**, sidebar kiri, tema teal–ivory, tombol ≥ 44 px, toast sukses/galat/info, status memuat/kosong/galat di setiap tampilan data:
  1. Pengaturan awal (buat admin / pulihkan dari `.ppgkey` + `.db` opsional) & Masuk; 2. Beranda (generus aktif/mondok, perangkat aktif, usulan, setoran per kelompok — merah bila > 14 hari); 3. Wilayah (pohon, tambah/ubah/hapus lunak); 4. Generus & Jamaah (filter wilayah/kategori/status/nama, tambah/ubah, impor CSV + ringkasan baris gagal, **unduh templat CSV**, pindah kelompok, ubah status; tab jamaah); 5. Pengajian; 6. Materi (bidang/kategori/materi, isi teks, unggah/lepas PDF, “Buat Berkas Materi”); 7. Perangkat & Token (tempel Kode Perangkat → peran/wilayah/hak/masa berlaku → token teks + QR SVG (`qrcode`) + salin + simpan .txt; daftar + filter; bekukan/cairkan/cabut; ganti kunci kelompok; serah terima mubaligh dengan status Setor Akhir & opsi paksa); 8. Impor Setoran (banyak berkas, ringkasan per berkas & per tabel, rekaman ditolak, riwayat impor); 9. Usulan (uraian mudah dibaca, setujui/tolak + alasan); 10. Koreksi (pilih kelompok/jenis/rentang → catatan koreksi; daftar koreksi); 11. Kirim Paket (satu wilayah atau semua kelompok berpenerima → folder); 12. Rekap & Laporan (presensi per kelompok/generus, kemajuan per bidang, ekspor Excel `exceljs` 3 lembar, dimuat dinamis); 13. Pengaturan (ganti sandi, ekspor/impor cadangan kunci, simpan/pulihkan database).
- DB disimpan otomatis (debounce 800 ms setelah setiap perubahan via `db.saatBerubah`) dan sekali lagi saat jendela ditutup (main menunda `close` sampai renderer selesai menyimpan, maks 5 detik). Kunci admin hanya di memori; **kunci otomatis setelah 30 menit** tanpa input; tombol “Kunci aplikasi”.
- `electron-builder` (di `package.json` → `build`): appId `id.ppgsorong.admin`, productName “PPG Sorong Admin”, Windows `nsis` + `portable`, keluaran `apps/desktop/release`. Skrip: `dev`, `build` (renderer + `build:electron`), `dist:win`, `test`, `typecheck`.
- `.github/workflows/build-exe.yml` diganti: windows-latest, Node 22, `npm ci` → `npm test` → `npm run typecheck` → `npm run dist:win -w apps/desktop` → unggah `release/*.exe` (rilis otomatis bila tag `v*`).

### Hasil uji
- `npm test` (semua workspace): core **15 berkas / 102 test lulus**; desktop **4 berkas / 9 test lulus** (total 111). `npm run typecheck` bersih (renderer + electron). `npm run build -w apps/desktop` sukses (renderer ±0,9 MB + exceljs ±0,9 MB terpisah + wasm 0,7 MB; `main.cjs` 9,7 KB, `preload.cjs` 1,1 KB).
- `test/alur-utama.test.tsx` (jsdom, UI sungguhan + HP mubaligh tiruan dari core): pengaturan awal → tutup/buka → masuk (sandi salah ditolak) → wilayah daerah/desa/kelompok → templat CSV + impor CSV (2 masuk, 1 gagal) → token dari Kode Perangkat (QR tampil, salin) → HP aktivasi → Kirim Paket → HP presensi + usulan → setor → Impor Setoran (1 sah + 1 rusak) → setujui usulan → paket ke-2 (generus baru sampai di HP) → rekap + ekspor Excel (isi lembar diperiksa) → beranda; database tersimpan memuat semua perubahan.
- `test/halaman-lain.test.tsx`: beku/cair/cabut, ganti kunci, serah terima paksa; unggah PDF + berkas MATERI; pengajian; koreksi; status mondok + pindah kelompok + jamaah; ganti sandi, ekspor cadangan kunci & DB lalu pulihkan di instalasi baru dengan sandi baru; kunci otomatis. `test/penyimpanan.test.ts`: simpan atomik, cadangan sekali per hari, perampingan 30.
- **Chrome headless** (Chrome for Testing 153 + `playwright-core`, `uji-peramban/uji-asap.mjs`): `dist/` dilayani dengan CSP produksi yang sama → pengaturan awal (wasm + libsodium + PBKDF2 jalan di bawah CSP), wilayah, materi, muat ulang → masuk, rekap → unduh `.xlsx`, unduh templat CSV; **0 galat konsol**.

### Keputusan otonom baru
- **T29** protokol `app://` + CSP; **T30** IPC tambahan (simpan ke folder, folder data, sinyal tutup); **T31** semua paket desktop sebagai devDependencies + build main/preload terpisah (dicatat di tabel T rencana).
- Tidak ada kueri baru di `@ppg/core`: semua layar cukup dengan API publik (`kueri.ts` T28 + repo); app tidak memuat SQL.
- Impor cadangan kunci di Pengaturan meminta kata sandi admin saat ini dan memakainya sebagai `sandiBaru`, agar `imporCadanganKunci` tidak mengganti sandi admin diam-diam.
- Pulihkan database hanya menerima database admin **organisasi yang sama** dan meminta sandi admin pada cadangan itu.
- Hak token di formulir dibatasi per peran (pengurus: catat/lihat; mubaligh: + sahkan, terbit_generus) sesuai validasi core.
- QR token: SVG, koreksi galat `L`; bila token terlalu panjang untuk QR, tampil pesan dan admin mengirim teks.
- Uji jsdom: `test/siapkan.ts` memasang kembali `Uint8Array`/`ArrayBuffer`/`TextEncoder` asli Node karena jsdom menggantinya dengan realm lain sehingga libsodium menolak data (hanya masalah lingkungan uji).

### Sisa masalah / catatan
- Electron & electron-builder **belum dijalankan** di lingkungan ini (binary tidak bisa diunduh); EXE pertama akan dibangun oleh workflow GitHub Actions. Yang sudah diverifikasi: tsc, vite build, uji jsdom, dan renderer di Chrome headless dengan CSP produksi.
- Belum ada ikon aplikasi (`apps/desktop/build/icon.ico`) — electron-builder memakai ikon Electron bawaan; installer tidak ditandatangani (Windows SmartScreen akan memperingatkan).
- Peringatan ukuran chunk: bundel utama ±0,9 MB (React + core + kurikulum JSON); tidak berpengaruh untuk aplikasi lokal.
- Impor setoran berjalan sinkron di renderer; ratusan berkas besar dapat membekukan UI sesaat (status memuat ditampilkan sebelum mulai).
- Menu “Muat ulang” (Ctrl+R) mengunci aplikasi kembali (kunci hanya di memori); perubahan dalam jeda 800 ms sebelum muat ulang bisa hilang.

### Cara build di Windows
```bash
# Node 22.12+ dan Git terpasang
git clone https://github.com/dausdabamona/PPG-ofline.git && cd PPG-ofline
git checkout claude/ppg-offline-v2
npm ci
npm test && npm run typecheck
npm run dist:win -w apps/desktop      # hasil: apps/desktop/release/PPG Sorong Admin-Setup-0.1.0.exe dan ...-Portable-0.1.0.exe
# pengembangan: npm run dev -w apps/desktop  (Vite :5173 + Electron)
```
Data admin tersimpan di `%APPDATA%\PPG Sorong Admin\ppg-admin.db` (cadangan harian di `cadangan\`).

---

## Fase 3 — APK (`apps/mobile`, 2026-11-14)

### Yang dibuat
- **`apps/mobile` (@ppg/mobile)**: React 19 + Vite 8 + TS strict + Capacitor 7 (`@capacitor/core`, `cli`, `android`, `filesystem`, `share`, `app`) + `qrcode`, `jsqr`, `idb-keyval`. `capacitor.config.ts`: appId `id.ppgsorong.app`, appName `PPG Sorong`, webDir `dist`. sql.js build peramban (`sql-wasm-browser.wasm?url`), CSP ketat disisipkan saat build. Tanpa pustaka UI; CSS sendiri (teal–ivory, huruf 17 px, tombol ≥ 44 px, lembar bawah, navigasi bawah).
- **`src/platform.ts`**: `platformNative` (Filesystem → Cache + Share untuk "Kirim lewat WA"/PDF/cadangan; `appStateChange`; berkas dari intent lewat `appUrlOpen`/`getLaunchUrl` + `Filesystem.readFile`) dan `platformWeb` (IndexedDB, `<input type=file multiple>`, unduhan blob, Web Share/salin) — aplikasi bisa dijalankan & diuji di peramban biasa. Uji memakai platform palsu.
- **Persistensi**: DB diekspor ke IndexedDB (jeda 500 ms setelah setiap perubahan + saat ke latar belakang). "Cadangkan data HP" (`.ppgdb`) & "Pulihkan dari cadangan" (menolak berkas bukan DB HP/DB admin).
- **Layar §12** — Awal: nama HP → Kode Perangkat (QR besar + teks + Kirim lewat WA + Salin), Pindai QR Token (kamera + jsQR, cadangan tempel) / Tempel Token + PIN opsional, Buka Berkas. Pilih Profil (PIN 4 angka) + Tambah Profil. Profil & HP (ganti/tambah/hapus profil, atur/hapus PIN, Kode Perangkat, cadangan).
  - **Pengurus**: Beranda · Presensi (pilih kelompok bila tingkat desa/daerah, pertemuan dari jadwal hari itu, Semua hadir) · Data (cari, rincian, usulan generus baru, daftar usulan) · Rekap (kehadiran per kelompok/generus, kemajuan) · Sinkron (Setor Data, Kirim ulang semua data, Buka Berkas).
  - **Mubaligh**: Beranda · Setoran Generus (impor massal BELAJAR, kartu per generus, catatan + Sahkan/Tolak) · Simak Langsung · Generus (rincian + ajukan ubah status / pindah kelompok / generus baru) · Lainnya (Presensi, Terbitkan Token dari pindai QR / tempel Kode Perangkat → QR/teks token + Kirim WA, Jadwal Tambahan + bagikan berkas jadwal, Laporan Pekanan + "Kirim WA ke wali" via `tautanWa`, Kirim Balasan per HP & "ke semua", Setor Data / Setor Akhir, Buka Berkas).
  - **Generus**: Materiku (ringkasan %, ★ target, per bidang/kategori dengan status, bacaan teks & PDF, catat dari rincian) · Catat Kemajuan (status/nilai/tingkat/pesan) · Jadwal (pekan, maju/mundur) · Setor (Setor Belajar, Buka Berkas). Spanduk "Sedang mondok — pencatatan dihentikan sementara" saat dibekukan (juga dicabut/kedaluwarsa).
  - **Wali**: Laporan Pekanan tiap anak · Kemajuan · Kehadiran (60 hari) · Berkas.
  - Indikator "Ada N data belum disetor" + pengingat > 7 hari (`infoSinkronHp`), toast sukses/galat, status memuat/kosong/galat di tiap tampilan data. "Buka Berkas" universal (`imporBanyak` → `bukaBerkasApaSaja`) dengan kalimat hasil ramah (`pesanHasilBerkas`).
- **Android** (`npx cap add android`, dikomit): izin `CAMERA` (+ `uses-feature` opsional), intent-filter VIEW (`application/octet-stream`; `*/*` + `pathPattern .*\\.ppg`) dan SEND (`application/octet-stream`), `MainActivity` mengubah SEND→VIEW, nama app "PPG Sorong". `npx cap sync android` berhasil lokal (3 plugin).
- **`.github/workflows/build-apk.yml`**: ubuntu-latest, Node 22, Java 21 temurin, `android-actions/setup-android@v3`, `npm ci` → `npm test` → `npm run typecheck` → `npm run build -w apps/mobile` → `npx cap sync android` → `./gradlew assembleDebug` → artifact `PPG-Sorong-APK` (rilis bila tag `v*`). Trigger sama dengan build-exe.yml.
- **Core (kecil)**: PAKET membawa seluruh pohon wilayah (T32) + `test/fase3.test.ts`; README core & rencana (T32–T37) diperbarui.

### Hasil uji
- `npm test`: core **16 berkas / 103 test**, desktop **4 / 9**, mobile **2 / 3** — semua lulus (total 115). `npm run typecheck` bersih (3 workspace). `npm run build -w apps/mobile` sukses (JS ±885 KB / 295 KB gzip, jsQR 130 KB dimuat saat memindai, wasm 688 KB).
- `test/alur-mubaligh-generus.test.tsx` (jsdom, UI sungguhan, admin via core, 3 HP masing-masing platform palsu): aktivasi mubaligh dari token → paket + materi → terbitkan token Ali & Budi untuk **satu HP** + wali (2 anak) → Setor Data (admin menerima 3 token) → Kirim Balasan ke semua → HP generus 2 profil (Ali ber-PIN, PIN salah ditolak) buka balasan + materi → catat kemajuan keduanya → indikator "Ada 2 data belum disetor" → Setor Belajar → mubaligh impor, sahkan Ali (catatan), tolak Budi → Laporan Pekanan → tautan wa.me 62… berisi catatan → balasan wali → wali melihat laporan pekanan Ali + kemajuan + kehadiran → admin set Budi mondok → paket → balasan → HP generus menampilkan spanduk mondok, tombol catat nonaktif, Ali tetap aktif.
- `test/pengurus-dan-lain.test.tsx`: pengurus — berkas rusak & PAKET lewat intent, presensi (Semua hadir + 1 alpa), usulan generus baru, rekap 66,7 %, Setor Data (admin: 3 presensi + 1 usulan), simpan saat latar belakang, cadangkan → pulihkan (berkas salah ditolak). Mubaligh — Simak Langsung, jadwal tambahan + berkas JADWAL, usulan mondok & pindah ke kelompok lain (T32), Setor Akhir (admin: 2 usulan, 1 kemajuan, 1 jadwal).
- **Chrome headless** (Chrome for Testing 153 + `playwright-core`, viewport **360×740** seluler, `uji-peramban/uji-asap.mjs`): `dist/` dengan CSP produksi → sambut → QR Kode Perangkat → aktivasi mubaligh (token dari admin core yang dibundel rolldown) → buka PAKET+MATERI lewat pemilih berkas → beranda → presensi 4 generus → Simak → muat ulang (data tetap dari IndexedDB, indikator setor tampil). **0 galat konsol, 0 tombol terlihat < 44 px**.

### Keputusan otonom baru (T32–T37 di rencana)
- **T32** PAKET membawa seluruh pohon wilayah — satu-satunya perubahan core (agar usulan pindah kelompok dari HP mubaligh mungkin).
- **T33** berkas keluar & PDF lewat Share dari folder Cache; wa.me lewat navigasi luar (tanpa plugin tambahan / izin penyimpanan).
- **T34** SEND→VIEW di `MainActivity`; intent-filter VIEW/SEND.
- **T35** IndexedDB untuk native & peramban; cadangan `.ppgdb` tidak terenkripsi (diperingatkan di UI).
- **T36** QR SVG tanpa kanvas; jsQR dimuat dinamis & bingkai diperkecil; token generus/wali tidak muat QR.
- **T37** nama HP diminta sekali; CSP hanya di build.
- Lainnya: setelah aktivasi, profil baru langsung dipilih; aplikasi meminta Pilih Profil saat dibuka bila > 1 profil atau profil ber-PIN; Setor Belajar memakai `kelompokId` profil aktif (aman untuk HP lintas kelompok, T26); "Kirim ulang semua data" (`buatSetor({ semua: true })`) di bawah "Pilihan lain" untuk kasus pemulihan admin (sisa catatan Fase 1b).

### Sisa masalah / catatan
- **Gradle belum dijalankan** di sini (Google Maven tidak terjangkau); APK pertama dibangun CI. Kode Java `MainActivity` & manifest belum dikompilasi — periksa log workflow pertama.
- Token generus/wali ±3,7 KB (membawa token mubaligh penerbit beserta rahasianya) **melebihi kapasitas QR**; alurnya "Kirim lewat WA" → "Tempel Token". Memperkecil token butuh perubahan format di core (mis. token penerbit tanpa bagian `rahasia`) — belum dilakukan.
- Belum diuji di perangkat nyata: izin kamera WebView, `content://` dari WA lewat `Filesystem.readFile`, lembar Share berkas `.ppg`, pembuka PDF eksternal, tombol kembali Android (belum ditangani khusus — menutup aplikasi).
- Cadangan `.ppgdb` berisi kunci rahasia HP tanpa enkripsi (sama seperti DB di IndexedDB — catatan Fase 1); PIN hanya kunci antarsaudara.
- Ikon & splash masih bawaan Capacitor; APK debug tidak ditandatangani rilis.
- Pemindai belum diuji dengan kamera nyata (jsdom/headless tanpa kamera → jalur cadangan tempel teks).
