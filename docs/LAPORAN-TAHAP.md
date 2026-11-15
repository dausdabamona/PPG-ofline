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

---

## Fase 4 — Pemeriksaan akhir (2026-11-14)

Pemeriksa independen membaca rencana (T1–T37), laporan Fase 1–3, README core, seluruh `apps/desktop/src` dan `apps/mobile/src`, lalu
memperbaiki dua sisa masalah besar Fase 3 dan mencari cacat nyata di kedua aplikasi. Setiap cacat direproduksi dulu dengan test yang
**gagal** (dicek dengan menyembunyikan perbaikannya), baru diperbaiki.

### Sisa masalah Fase 3 yang diselesaikan
- **QR berseri (T38)** — token generus/wali ±3,7 KB kini bisa dipindai: `core/qr-seri.ts` (`pecahQr`, `uraiBagianQr`, `susunQr`,
  `pengumpulQrBaru`, `tambahBagianQr`), format `PPGQ1|<id>|<ke>/<dari>|<potongan>`, ≤ 800 karakter per bagian (QR versi ≤ 20). Token
  ±3,7 KB = 5 QR. APK mubaligh (Terbitkan Token) dan EXE (Perangkat & Token) menampilkan QR bergantian tiap 1,5 detik + Sebelumnya /
  Jeda / Berikutnya; pemindai APK mengumpulkan bagian dalam urutan bebas ("2 dari 5 bagian QR terbaca"), lalu mengisi token. Kirim lewat WA
  + Tempel tetap ada (kotak tempel juga menerima bagian-bagian QR). Kode Perangkat (±0,3 KB) tetap satu QR polos — kompatibel.
  Diuji: core (pecah/susun/pengumpul), **jsQR sungguhan mendekode setiap bagian** yang dirender 3 px/modul (`apps/mobile/test/qr-seri.test.ts`),
  UI jsdom (navigasi, ganti otomatis, tempel bagian), Chrome headless 360×740 (QR 1→2 berganti).
- **Cadangan HP terenkripsi (T39)** — `core/cadangan-hp.ts`: `"PPGCB1" | garam | iterasi | secretbox(PBKDF2(sandi), gzip(db))`.
  "Cadangkan data HP" wajib kata sandi (≥ 6 karakter, diulang); pulihkan meminta sandi (salah → "Kata sandi cadangan salah"); berkas lain
  ditolak sebelum ditanya sandi; cadangan polos lama tetap bisa dipulihkan dengan saran membuat cadangan baru. Diuji: core (kunci rahasia
  tidak terbaca di berkas, sandi salah/terpotong/lemah), UI jsdom, Chrome headless (berkas unduhan berawalan `PPGCB1`).

### Temuan pemeriksaan & perbaikan

| # | Tingkat | Temuan | Perbaikan | Test |
|---|---|---|---|---|
| 1 | **Sedang** | EXE: admin yang lupa kata sandi di laptop yang sama tidak punya jalan keluar — "Pulihkan dari cadangan" hanya ada saat database kosong; harus menghapus berkas `%APPDATA%` secara manual | Layar Masuk: **Lupa kata sandi?** → `.ppgkey` + sandi cadangan + sandi baru (`imporCadanganKunci` pada DB yang sama); data utuh | `apps/desktop/test/pemeriksaan-akhir.test.tsx` |
| 2 | **Sedang** | APK: tombol kembali Android menutup aplikasi dari layar mana pun (termasuk saat jendela token/PIN terbuka) | T40: tombol kembali menutup jendela → menekan "Kembali" halaman → bila tidak ada, aplikasi diperkecil (`App.minimizeApp`) | `pemeriksaan-akhir.test.tsx`, `alur-mubaligh-generus.test.tsx` |
| 3 | Sedang | Pengingat Setor Belajar untuk profil generus di HP yang juga memegang profil mubaligh/pengurus dihitung dari **Setor Data** mubaligh, sehingga catatan anak bisa tertahan tanpa pengingat | `infoSinkronHp` + `hariSejakBelajar`/`perluPengingatBelajar`; indikator memakai nilai sesuai peran | `packages/core/test/fase4.test.ts` |
| 4 | Ringan | Spanduk "Sedang mondok" tampil juga untuk pengurus/mubaligh yang dibekukan admin | Teks "Profil ini dibekukan admin — pencatatan dihentikan sementara" untuk pengurus/mubaligh | `pemeriksaan-akhir.test.tsx` |
| 5 | Ringan | Daftar "Token yang sudah diterbitkan" menampilkan kode mentah `aktif`/`dibekukan`/`kedaluwarsa` | Label Bahasa Indonesia (`LABEL_STATUS_TOKEN`) | `pemeriksaan-akhir.test.tsx` |
| 6 | Ringan | EXE Impor Setoran hanya menerima `*.ppg`; berkas WA yang namanya diubah (mis. tanpa ekstensi) tidak bisa dipilih | Filter tambahan "Semua berkas" (isi tetap divalidasi core) | — (dialog Electron) |
| 7 | Ringan | Jendela serah terima belum mengingatkan bahwa mubaligh baru harus segera mengirim Balasan (sisa risiko Fase 1b) | Pesan sukses serah terima (EXE) + keterangan di layar Kirim Balasan (APK) + panduan | — |

Hal yang diperiksa dan **tidak** cacat: profil generus hanya melihat datanya sendiri (Materiku/Catat memakai `generus_ids` profil aktif,
Jadwal per kelompok); wali hanya anak-anak di tokennya (`generusProfil`) — HP wali tidak menerima data generus lain (dibuktikan di uji
ujung-ke-ujung: `laporanPekanan` Citra = null di HP wali); PIN diminta saat aplikasi dibuka bila > 1 profil; pembekuan mondok
menghentikan pencatatan di core (`catatKemajuan` melempar, `simakLangsung` menolak generus tidak aktif, `lembarPresensi`/Terbitkan Token
hanya generus aktif, BELAJAR dari profil beku ditolak mubaligh) dan di UI (tombol nonaktif + spanduk); Buka Berkas menerima semua jenis
(PAKET/BALASAN/JADWAL/MATERI/BELAJAR, SETOR → pesan "untuk admin"; berkas rusak → pesan ramah) dari tombol maupun intent WA; data
disimpan 500 ms setelah perubahan + saat ke latar belakang + segera setelah membuka berkas/aktivasi; EXE menyimpan sebelum jendela
ditutup; semua tombol APK ≥ 44 px (Chrome 360×740, termasuk jendela token).

### Uji ujung-ke-ujung lintas aplikasi (C)
`packages/core/test/ujung-ke-ujung.test.ts` — satu siklus dengan fungsi yang sama yang dipanggil UI: admin (pengaturan awal, ekspor
`.ppgkey`, wilayah, **impor CSV dari berkas**, pengajian, materi) → pengurus & mubaligh (Kode Perangkat & token lewat berkas teks /
**QR berseri** dipindai acak dengan bagian ganda) → paket + materi (`imporBanyak`, seperti tombol Buka Berkas) → mubaligh menerbitkan token
2 generus di satu HP (PIN) + wali → presensi pengurus → Setor Data keduanya → admin Impor Setoran (impor ulang = `sudahPernah`) → paket →
Balasan ke semua (berkas yang bukan untuk HP itu ditolak dengan pesan) → generus catat 2 profil → Setor Belajar → mubaligh sahkan/tolak →
Balasan → **wali** melihat laporan pekanan (hanya anaknya) + teks/tautan WA → Setor Data → **admin rekap** (Ali 1 disahkan, Budi 0;
hadir 2) → mondok (admin → paket → balasan → profil Ali beku, Budi tetap) → **cadangan HP terenkripsi** dipulihkan di "HP baru" dan lanjut
Setor Belajar → laptop admin baru dipulihkan dari `.ppgkey`, lalu menerima setoran. Setiap berkas ditulis ke folder sementara dan dibaca
ulang sebagai byte; setiap database disimpan ke berkas dan dibuka ulang di antara langkah.

### Panduan pengguna (D)
`docs/PANDUAN-PENGGUNA.md`: unduh dari GitHub Actions (Artifacts kedaluwarsa 30 hari → buat tag `v0.1.0` untuk rilis permanen),
SmartScreen "Info lainnya → Tetap jalankan", izin "instal dari sumber tidak dikenal", langkah Admin (cadangan kunci WAJIB di 2 tempat,
wilayah, CSV, aktivasi, impor setoran, usulan, paket, materi, rekap/Excel, serah terima + pesan Balasan pada hari serah terima, lupa sandi),
Mubaligh, Pengurus, Generus, Wali, cadangan HP, jadwal rutin, dan "Jika terjadi masalah".

### Hasil uji akhir
- `npm test`: core **18 berkas / 111 test**, desktop **5 / 11**, mobile **4 / 6** — **128 test lulus**, 0 gagal (Fase 3: 115).
- Cakupan core: statements 95,6 %, branches 87,1 %, functions 99,0 %, lines 97,9 %.
- `npm run typecheck` bersih (3 workspace); `npm run build` sukses (semua workspace); `npx cap sync android` berhasil.
- Chrome headless: uji asap APK 360×740 (diperluas: QR berseri berganti, cadangan terenkripsi) **0 galat konsol, 0 tombol < 44 px**;
  uji asap EXE **0 galat konsol**. (`playwright-core` dipasang di luar repo; tidak ada dependensi baru, `package-lock.json` tidak berubah.)

### Perubahan desain
T35 & T36 diubah; **T38** QR berseri, **T39** cadangan HP terenkripsi, **T40** tombol kembali Android + pengingat belajar (lihat rencana).
API core baru: `qr-seri`, `cadangan-hp`, field `InfoSinkronHp.hariSejakBelajar/perluPengingatBelajar` (README §Catatan Fase 4).

### Sisa masalah (jujur)
- **Belum diuji di HP & Windows nyata**: pemindaian QR berseri dengan kamera sungguhan (diuji hanya jsQR pada gambar sempurna — layar
  silau/kamera buruk bisa lebih lambat; jalur Tempel tetap ada), `minimizeApp`, Share/intent dari WA, EXE hasil electron-builder.
- **Kunci di HP tetap polos** di IndexedDB (hanya berkas cadangan yang dienkripsi). Orang yang memegang HP tak terkunci bisa membaca
  datanya. PIN profil hanya kunci antarsaudara; token yang sama bisa ditempel ulang dengan PIN baru (dipakai untuk "lupa PIN").
- Jendela sesudah serah terima (Fase 1b) tetap ada sampai HP generus membuka Balasan pertama mubaligh baru — kini diingatkan di UI & panduan.
- Penyimpanan HP saat ke latar belakang bersifat asinkron; bila Android mematikan aplikasi tepat dalam jeda < 0,5 detik setelah
  perubahan terakhir, perubahan itu bisa hilang.
- Ikon/splash bawaan, APK debug & EXE tanpa tanda tangan (SmartScreen/Play Protect memperingatkan), PAKET tidak inkremental,
  jam perangkat menentukan waktu — sama seperti fase sebelumnya.

---

## Fase 5 — Core v3: pelaporan berjenjang, kurikulum, pertemuan (2026-11-15)

Implementasi bagian inti (`packages/core`) dari §14 rencana (keputusan V1–V5 Pak Fir). UI v3 dikerjakan agen lain.

### Yang dibuat
- **Instalasi EXE berjenjang** (`instalasi.ts`): `inisialisasiExe` (kunci perangkat EXE dienkripsi kata sandi lokal), `bukaKunciExe`, `aktifkanExe` (peran dari token: desa/kelompok/kurikulum), `gantiSandiExe`, `infoInstalasi`, `terbitkanTokenBawah` (EXE desa → pengurus/mubaligh/EXE kelompok di wilayahnya), kunci kelompok titipan. EXE daerah = admin lama.
- **Rantai kepercayaan berjenjang** (`token.ts`, `rantai.ts`): role `admin`/`kurikulum`, hak `terbit_bawah`, verifikasi rekursif sampai kunci daerah, wilayah anak ⊆ penerbit, pencabutan & masa berlaku di setiap mata rantai, `periksaTokenDb`.
- **Alur naik**: SETOR ke tingkat atas langsung (`atas_box_pub`), impor di EXE kelompok/desa, **SETOR gabungan** ke daerah (rekaman asli + token, konfirmasi, pencabutan, Setor Akhir di bawahnya) dengan wewenang berantai; idempoten; konfirmasi bertahap (`jejak_setor`, `konfirmasi_daerah`, `belumSampaiDaerah`).
- **Alur turun**: PAKET daerah → EXE desa (+ kunci titipan), EXE desa/kelompok → EXE kelompok/HP (bertanda tangan EXE, amplop per penerima aktif, versi per penerbit); MATERI daerah diteruskan apa adanya; BALASAN dari EXE (pencabutan mubaligh sampai HP generus).
- **Jadwal setor** (`repo/target.ts`, `kueri-berjenjang.ts`): `aturJadwalSetor`, `statusSetor` (per desa/kelompok/HP: tenggat, setor terakhir, terlambat), `pengingatSetor` (tombol "Setor ke Desa").
- **Kurikulum**: `tetapkanTarget`, `periodeAktif`/`aturPeriodeAktif`, berkas `KURIKULUM` (`buatKurikulum` → `imporKurikulum`), target ikut MATERI/PAKET/BALASAN.
- **Kelas & pertemuan** (`repo/pertemuan.ts`): `pengajian.kategori_generus`, tabel `pertemuan`, `bukaPertemuan`, `absenPertemuan` (presensi per pertemuan + tandai tuntas → kemajuan sumber mubaligh disahkan).
- **Kueri**: `materiPerluDituntaskan`, `saranMateriPertemuan`, `lembarAbsenPertemuan`, `progresKelas`, `statusSetor`, `pengingatSetor`, `ringkasanBerandaExe` (daerah/desa/kelompok/kurikulum), `tujuanSetor`.
- **Skema v3** + migrasi otomatis v2 → v3 (admin lama = daerah).
- Dokumen: README core (API v3 + contoh alur berjenjang §12), rencana §14.3 (V-T1–V-T19), laporan ini.

### Hasil uji
- `npm test`: core **20 berkas / 143 test** (sebelumnya 18 / 111), desktop 5 / 11, mobile 4 / 6 — **160 test lulus**, 0 gagal. `npm run typecheck` bersih (3 workspace); `npm run build` sukses.
- Cakupan core: statements 94,7 %, branches 87,0 %, functions 98,6 %, lines 97,5 %.
- `test/skenario-berjenjang.test.ts` (14 langkah, satu DB per aktor): daerah init → aktivasi EXE desa A & B + EXE kurikulum → kurikulum menetapkan target 2026-S1 → daerah impor & paket ke desa → desa A mengaktifkan HP mubaligh A1 & EXE kelompok A2 → mubaligh menerbitkan token generus + wali → absen pertemuan dengan materi + tuntas → HP generus: materi perlu dituntaskan 3 → 2 → A1 & A2 setor ke desa A → setor gabungan ke daerah (daerah melihat A1 & A2; konfirmasi turun sampai HP) → desa B terlambat (bulanan tgl 5) → daerah mencabut mubaligh A1, pencabutan sampai HP generus lewat BALASAN desa → desa A tidak bisa menerbitkan token untuk desa B (juga token rakitan ditolak) → token buatan EXE desa yang dicabut ditolak (termasuk jam dimundurkan) → migrasi DB v2 dari **fixtur buatan kode v2** (database admin, HP mubaligh, HP generus, berkas SETOR lama).
- `test/berjenjang.test.ts` (18 test): aturan rantai (wilayah, hak, peran, tingkat, tanda tangan, pencabutan bertingkat, rantai terlalu panjang), instalasi EXE (sandi, aktivasi, peran berbeda), batas penerbitan EXE desa, wewenang SETOR gabungan (perangkat asing, sesudah dicabut, hak sahkan), 3 tingkat HP → EXE kelompok → desa → daerah, serah terima mubaligh terbitan desa, PAKET EXE, kurikulum & periode, tenggat/status setor, pertemuan & kueri kelas.

### Perilaku lama yang berubah (dicatat)
- `Role`/`Hak` bertambah `admin`, `kurikulum`, `terbit_bawah` → `apps/mobile/src/kerangka.tsx` mendapat entri kosong untuk peran EXE (perbaikan minimal agar terkompilasi).
- Token pengurus/mubaligh **boleh** berpenerbit (EXE desa); penerbit rusak tetap `TOKEN_TIDAK_SAH`. Teks alasan rantai disamakan ("…penerbitnya dicabut", "…masa berlaku token penerbit").
- `imporSetor(db, bytes, kunci)` & `buatPaket(db, wilayah, kunci)` menerima `KunciAdmin | KunciExe`; SETOR v3 membawa `penerima_perangkat_id` dan ditolak bila sampai di tingkat yang salah. Penerima PAKET daerah kini juga EXE (role `admin`).
- Fungsi materi (`tambahBidang/Kategori/Materi`, `ubahMateri`, `aturLampiranMateri`) memakai `pastikanPengelolaKurikulum` (daerah **atau** EXE kurikulum); galat di HP kini `HANYA_KURIKULUM` (dulu `HANYA_ADMIN`).
- MATERI & BALASAN membawa `target_capaian` + `pengaturan`; `InfoSinkronHp` bertambah `belumSampaiDaerah`; `RingkasanImporSetor` bertambah `gabungan`, `perangkatBawah`, `pencabutanDiterima`.
- `test/pemeriksaan.test.ts`: INSERT mentah presensi ditambah satu nilai (`pertemuan_id`) karena skema v3. Semua uji keamanan T10–T40 lain tidak diubah dan lulus.

### Sisa masalah (jujur)
- **HP yang belum punya pohon wilayah** menerima token rakitan EXE desa untuk kelompok desa lain saat aktivasi (pemeriksaan wilayah dilewati); setorannya ditolak EXE desa & daerah, jadi tidak ada data yang masuk — tetapi HP itu bisa "tampak aktif".
- **Rekaman tidak ditandatangani per rekaman**: daerah mempercayai EXE desa untuk rekaman di wilayahnya (EXE desa bisa merakit rekaman atas nama perangkat di bawahnya). Kunci kelompok titipan juga membuat EXE desa bisa membuka BELAJAR kelompoknya (sesuai kewenangan desa).
- Tujuan SETOR HP tertanam di token saat terbit: bila EXE kelompok baru diaktifkan, HP lama tetap menyetor ke EXE desa (tetap diterima) sampai tokennya diperbarui.
- Berkas `KURIKULUM` kumulatif tanpa konfirmasi balik (suntingan lama ikut terkirim ulang; impor tetap idempoten).
- Tenggat & keterlambatan dihitung dengan jam lokal perangkat (jam HP/laptop yang salah memengaruhi status).
- PAKET desa tetap tidak inkremental; MATERI tetap satu berkas besar (termasuk PDF).
- Belum ada UI v3 (beranda per tingkat, pengaturan "Aktifkan dengan kode", Absen mubaligh, layar Materi yang perlu dituntaskan, QR native) — dikerjakan agen UI.

---

## Fase 6 — EXE v3: satu EXE untuk semua tingkat (`apps/desktop`, 2026-11-15)

Mengubah `apps/desktop` menjadi satu EXE untuk daerah, desa, kelompok, dan kurikulum (§14) memakai API core v3. Aplikasi tidak memuat SQL;
satu kueri kecil ditambahkan ke core (`rekapCapaian`, dengan test).

### Yang dibuat
- **Pengaturan awal** tiga pilihan: *Buat organisasi baru (Admin Daerah)*, *Aktifkan dengan kode (Desa / Kelompok / Kurikulum)* — nama laptop +
  kata sandi aplikasi → layar aktivasi dengan **Kode Perangkat EXE** (teks + QR + Salin + simpan .txt) dan kotak tempel kode aktivasi —, dan
  *Pulihkan dari cadangan* (daerah: `.ppgkey` + `.db`; EXE bawah: `.db` + kata sandi aplikasi). Masuk memakai kata sandi admin (daerah) atau
  kata sandi aplikasi (EXE bawah); kunci aplikasi/kunci otomatis juga mengosongkan kunci EXE dari memori. **Database v2 terbuka sebagai daerah**
  tanpa langkah tambahan (diuji dengan fixtur v2).
- **Menu per peran** (`src/menu.ts`), kepala menampilkan peran & wilayah ("Admin Desa · Klasaman"):
  - **Daerah**: semua menu lama + **Jadwal Setor** (kelompok→desa pekanan, desa→daerah bulanan; simpan/hapus), **Target Capaian**,
    Perangkat & Token menerbitkan juga **EXE Desa / EXE Kelompok / EXE Kurikulum**, Beranda dengan **status setor tiap desa** (jadwal,
    tenggat berikutnya, setor terakhir, merah "Terlambat" / hijau "Tepat waktu"), Impor Setoran juga menerima berkas **KURIKULUM**, Kirim Paket
    + "Paket semua desa (EXE desa)", Materi membawa target.
  - **Desa**: Beranda (status setor tiap kelompok + kartu **Setor ke Daerah** dengan tombol besar & tenggat), Setor ke Daerah, Impor Setoran
    (HP & EXE kelompok), Buka Paket (PAKET + MATERI daerah), Kirim Paket (hanya wilayah desa; catatan meneruskan MATERI apa adanya),
    Perangkat & Token (`terbitkanTokenBawah`: mubaligh/pengurus/EXE kelompok di desanya; cabut/bekukan hanya token yang rantainya lewat EXE ini),
    Generus & Data (lihat + **usulan** generus baru/status/pindah), Rekap & Excel wilayah desa.
  - **Kelompok**: Beranda (status setor tiap HP + Setor ke Desa), **Absen Pertemuan** (tanggal + kelas → buka pertemuan → materi hari ini dari
    **saran** / daftar target → kehadiran per generus → centang **tuntas** per materi, hanya yang hadir; materi yang sudah tuntas ditandai),
    Impor Setoran HP, Setor ke Desa, Buka Paket, Rekap kelompok.
  - **Kurikulum**: Beranda (periode aktif, jumlah target, suntingan belum dikirim, tombol **Buat berkas Kurikulum**), Materi (sunting; tombol
    berkas Kurikulum), **Target Capaian** (periode S1/S2 × kategori generus, tambah/urut/buang, **salin dari periode lain**, jadikan periode
    aktif), Buka Berkas Materi.
- **Pengajian = kelas**: formulir punya centang kategori generus; kolom "Kelas (kategori)".
- **Rekap**: kartu **Capaian target** (wilayah, per desa, per kelompok, per kelas) + Excel 3 lembar baru (Capaian per Wilayah/Kelas/Generus).
  Core: `rekapCapaian` (`packages/core/test/fase6.test.ts`).
- Komponen bersama `komponen/setor.tsx` (kartu setor ke atas, tabel status setor); `PilihWilayah` mendapat `akar` (EXE desa/kelompok hanya
  melihat wilayahnya). QR: koreksi galat M, zona tenang 4 modul, 320 px; tombol kecil kini ≥ 44 px. Tema teal–ivory, toast, status
  memuat/kosong/galat tetap.

### Hasil uji
- `npm test`: core **21 berkas / 144 test**, desktop **6 / 15**, mobile **4 / 6** — **165 test lulus**, 0 gagal (Fase 5: 160).
  `npm run typecheck` bersih (3 workspace); `npm run build` sukses.
- `apps/desktop/test/exe-v3.test.tsx` (jsdom, UI sungguhan, satu platform palsu & database per laptop):
  1. daerah (jadwal setor, kelas caberawit, token EXE desa dari Kode Perangkat yang dibuat di UI desa, paket desa, berkas materi) → EXE desa
     masuk & aktivasi → menu desa (tanpa Wilayah/Jadwal) → buka paket+materi → terbitkan token mubaligh (opsi wilayah hanya desanya, tanpa
     "EXE Desa") → paket kelompok → HP presensi → **impor setoran** → usulan generus baru → beranda desa (Klasaman 2 tepat waktu, Klasaman 1
     terlambat) → **Setor ke Daerah** → daerah impor ("Setoran gabungan") → beranda daerah: **Klasaman tepat waktu, Malanu terlambat**; DB
     daerah berisi presensi, token mubaligh, usulan, kelas.
  2. EXE kurikulum aktivasi → buka MATERI → target caberawit (tambah 2, ubah urutan, simpan) → salin ke periode berikutnya → jadikan aktif →
     **berkas Kurikulum** → daerah impor di Impor Setoran → Target Capaian daerah memuat urutan & periode aktif yang sama.
  3. EXE kelompok aktivasi dengan token dari EXE desa → buka paket desa + materi → **Absen Pertemuan** (kelas caberawit: generus praremaja
     tidak tampil; saran materi dipakai; Budi alpa → centang tuntas nonaktif; Ali tuntas) → rekap capaian 1/4 = 25 % + Excel (Ali 50 %) →
     Setor ke Desa → EXE desa mengimpor (kemajuan Ali disahkan).
  4. Database admin **v2** (fixtur core) → masuk → Admin Daerah dengan menu & beranda v3.
- **Chrome headless** (`uji-peramban/uji-asap-v3.mjs`, `playwright-core` + Chrome, CSP produksi): empat konteks peramban terpisah (daerah,
  desa, kelompok, kurikulum), kode/token lewat teks, berkas lewat unduhan → pemilih berkas: daerah (wilayah, kelas, jadwal, token EXE desa &
  kurikulum, paket, materi) → desa (aktivasi, buka paket, token EXE kelompok, paket) → kelompok (aktivasi, buka paket, absen, setor) → desa
  (impor, setor ke daerah) → kurikulum (materi, target, berkas) → daerah (impor setoran gabungan + kurikulum; beranda "Klasaman Tepat waktu",
  "Malanu Terlambat"; rekap capaian + Excel) → muat ulang desa → masuk kembali sebagai desa. **0 galat konsol, 0 tombol < 44 px.**
  Uji asap lama (`uji-asap.mjs`) tetap lulus, 0 galat konsol.

### Keputusan otonom baru (V-T20–V-T25 di rencana)
- **V-T20** satu EXE, menu per peran; nama produk/berkas data tetap; desa tanpa ubah master (lihat + usulan); kelompok tanpa Kirim Paket.
- **V-T21** aktivasi dua langkah; EXE belum aktif kembali ke layar aktivasi; kata sandi EXE bawah tidak bisa dipulihkan tanpa cadangan DB.
- **V-T22** Impor Setoran & Buka Paket satu jalur (`imporBanyak`); KURIKULUM diimpor di Impor Setoran daerah.
- **V-T23** penyuntingan target lokal lalu simpan sekali; periode aktif ±2 semester; kurikulum membuka MATERI daerah dulu.
- **V-T24** `rekapCapaian` (persen = pasangan generus × materi target).
- **V-T25** QR EXE ECC M + zona tenang; tombol kecil ≥ 44 px.

### Sisa masalah (jujur)
- **Electron belum dijalankan** di lingkungan ini (seperti Fase 2): yang terverifikasi tsc, vite build, jsdom, dan Chrome headless dengan
  CSP produksi. EXE pertama untuk semua peran dibangun CI.
- EXE desa/kelompok belum punya menu **Kirim Balasan** ke HP generus/wali (core mendukung, V-T9) — pencabutan mubaligh sampai ke HP generus
  lewat Balasan mubaligh baru seperti v2.
- Desa meneruskan berkas MATERI daerah secara manual dari WA (EXE tidak menyimpan salinan berkas MATERI untuk diteruskan).
- Nama EXE di kepala belum ada sebelum paket pertama dibuka (wilayah belum dikenal) — tampil "Admin Desa" saja.
- Panduan pengguna (`docs/PANDUAN-PENGGUNA.md`) belum diperbarui untuk alur v3 (aktivasi EXE desa/kelompok/kurikulum, jadwal setor, absen).
- APK (QR native, layar mubaligh sederhana, "Materi yang perlu dituntaskan") belum dikerjakan di fase ini.
