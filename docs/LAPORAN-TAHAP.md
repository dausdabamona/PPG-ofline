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
