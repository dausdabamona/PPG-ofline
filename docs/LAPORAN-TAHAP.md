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
