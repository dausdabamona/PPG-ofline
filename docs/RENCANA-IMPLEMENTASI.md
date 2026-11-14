# Rencana Implementasi PPG Sorong v2 — Offline-First (APK + EXE, Sinkron via WA)

Dokumen ini adalah **kontrak teknis tunggal** untuk semua agen pembangun. Spesifikasi produk lengkap ada di Project claude.ai `claude/spesifikasi-ppg-offline.md` (v2); ringkasan keputusannya ada di §1. Jika ada yang bertentangan, dokumen ini yang berlaku untuk kode.

Pemilik: Firdaus Dabamona ("Pak Fir"). Bahasa UI, komentar logika bisnis, pesan error: **Bahasa Indonesia**. Konvensi: kebab-case file, PascalCase komponen, camelCase fungsi, snake_case tabel/kolom, SCREAMING_SNAKE konstanta. Tema **terang teal–ivory** (hindari tema gelap). Target: Android low-end, tanpa internet.

---

## 1. Ringkasan keputusan (terkunci)

| Kode | Keputusan |
|---|---|
| K1 | Database lokal di tiap HP; satu admin memegang EXE sebagai pusat data |
| K2 | Role memakai token bertanda tangan digital (Ed25519) |
| K3 | Semua perpindahan data lewat file `.ppg` yang dikirim via WhatsApp |
| K4 | Dua arah: HP → Admin (SETOR), Admin → HP (PAKET) |
| K5 | Data master milik admin; data kegiatan milik pencatat; koreksi = catatan, bukan timpa |
| K6 | Master baru dari HP = **usulan** sampai disetujui admin |
| K7 | Generus menyetor kemajuan belajar ke mubaligh (BELAJAR); mubaligh **mengesahkan**; hanya yang disahkan masuk rekap resmi |
| K8 | Token generus & wali diterbitkan **mubaligh** (delegasi, hak `terbit_generus`), hanya untuk kelompoknya |
| K9 | Setoran generus dienkripsi ke **kunci kelompok setor** (pasangan X25519; generus hanya pegang publik) |
| K10 | Pindah kelompok: kemajuan ikut generus; rekap per periode keanggotaan |
| K11 | Mondok: token dibekukan, tidak dihitung presensi; aktif lagi setelah kembali |
| K12 | **Satu mubaligh = satu kelompok** |
| K13 | Multi-profil di satu HP (kakak-adik, HP orang tua, HP bersama kelompok), PIN 4 angka opsional per profil; satu file setor untuk semua profil di HP itu |
| K14 | Generus tanpa HP: mode **Simak Langsung** di HP mubaligh (langsung berstatus disahkan) |
| K15 | Materi tampil di HP generus (daftar baku dari admin, teks + PDF; **audio menyusul**, di luar lingkup v2) |
| K16 | Jadwal rutin = master admin; jadwal tambahan dibuat mubaligh, dikirim satu file ke grup WA kelompok (dienkripsi kunci umum kelompok) |
| K17 | Role **Wali** (orang tua): laporan pekanan otomatis di APK (dari data BALASAN) + cadangan **teks WA** yang dibuat mubaligh (tautan wa.me, kirim satu per satu) |

### Keputusan teknis otonom (diambil agen pembangun, dicatat untuk Pak Fir)

| Kode | Keputusan | Alasan |
|---|---|---|
| T1 | **sql.js** (SQLite WebAssembly) dipakai di APK **dan** EXE, menggantikan better-sqlite3 / capacitor-sqlite | Satu skema & satu logika untuk dua aplikasi; tanpa modul native; bisa diuji penuh di Node |
| T2 | Kunci publik admin **dipasang saat aktivasi pertama** (tertera di token) | Satu APK untuk semua; tidak perlu build ulang per admin |
| T3 | APK & EXE dibangun di **GitHub Actions** (repo `dausdabamona/PPG-ofline`, branch `claude/ppg-offline-v2`) | Lingkungan pembangun tidak bisa mengunduh Android SDK/Electron |
| T4 | Kurikulum awal diambil dari aplikasi lama (`desktop/database/seed_kurikulum.py`) → `packages/core/src/data/kurikulum-sumber.json` | Data domain yang sudah disusun Pak Fir |
| T5 | Kategori generus: `paud`, `caberawit`, `praremaja`, `remaja`, `pranikah` | Mengikuti aplikasi lama |
| T6 | Status kemajuan per materi: `sedang`, `selesai`; nilai 0–100 opsional; untuk materi tipe `level`, kolom `level` 1–5 | Mengikuti tipe materi lama (hafalan/checklist/level) |
| T7 | Kunci privat admin di EXE dienkripsi dengan **kata sandi admin** (PBKDF2-SHA256 210.000 iterasi + secretbox) | Laptop bisa dipakai orang lain |
| T8 | Folder Python lama `desktop/` dibiarkan (arsip), workflow lamanya diganti | Tidak menghapus pekerjaan lama |
| T9 | Impor generus massal di EXE lewat **CSV** | Admin tidak mengetik ratusan nama satu per satu |
| T10 | **PAKET memakai amplop per penerima**: isi dienkripsi kunci berkas acak, kunci itu disegel (`segelKe`) ke `box_pub` tiap perangkat pengurus/mubaligh **aktif** yang wilayahnya = wilayah paket atau di atasnya (header `kunci_penerima`). `kunci_wilayah` tidak dipakai lagi | Celah: dengan kunci wilayah tetap, mubaligh/pengurus yang sudah dicabut masih bisa membuka paket berikutnya. Dengan amplop, perangkat dicabut otomatis tidak bisa membuka paket baru, tanpa rotasi kunci |
| T11 | Tabel `perangkat` & `pencabutan` berbasis **token** (`perangkat.id = token_id`, `pencabutan.token_id`) | Satu HP bisa memegang beberapa token (K13); membekukan token kakak yang mondok tidak boleh membekukan adiknya di HP yang sama |
| T12 | Bila penerbit (mubaligh) sudah dicabut, token generus/wali hanya diterima bila **terdaftar** (pernah dilaporkan lewat SETOR → ikut PAKET) | Mencegah mubaligh tercabut memalsukan tanggal `terbit` (memundurkan jam HP) untuk menerbitkan token baru |
| T13 | Admin menolak rekaman kegiatan yang `perangkat_id`-nya bukan pengirim (kecuali `kemajuan_belajar` yang diteruskan mubaligh berhak `sahkan`), kemajuan berstatus disahkan/ditolak dari pengirim tanpa hak `sahkan`, dan usulan yang statusnya diubah perangkat | Data kegiatan milik pencatat (K5); hanya admin yang memutus usulan |
| T14 | Berkas JADWAL lama ditolak: dari pengirim sama bila `versi` ≤ terpasang; dari pengirim lain (mubaligh baru) bila `dibuat_pada` ≤ terpasang | Nomor versi mubaligh baru mulai dari 1 lagi setelah serah terima |
| T15 | `log_bentrok` hanya bila isi berbeda, lokal pernah ditulis di sini (`seq_lokal > 0`) **dan** pemenang tidak punya `versi` lebih tinggi | Membedakan suntingan bersamaan dari sekadar gema data lama |
| T16 | Pindah kelompok mencabut token generus yang terikat kelompok lama; mubaligh kelompok baru menerbitkan token baru. Status `pindah`/`keluar`/`lulus_menikah` mencabut token | Token generus terikat `wilayah_id` kelompok penerbit |
| T17 | Id kurikulum tetap: `BDG-<urutan>`, `KAT-<kode>`, `MAT-<kode>-<nnn>` | Sama di semua instalasi (pulih dari cadangan tidak menggandakan materi) |
| T18 | CSV generus: kategori kosong → dihitung dari umur (<6 paud, 6–12 caberawit, 13–15 praremaja, 16–18 remaja, ≥19 pranikah); tanggal boleh `DD/MM/YYYY`; pemisah `,`/`;` otomatis; kolom `mulai` opsional | Data Excel lapangan |
| T19 | Riwayat keanggotaan/status: `mulai` inklusif, `selesai` eksklusif. Laporan pekanan berstatus mondok bila status pada **tanggal acuan** = mondok | Definisi tegas untuk rekap per periode |
| T20 | SHA-256 diimplementasikan murni TS (`sha256.ts`) | `libsodium-wrappers` standar tidak menyediakan `crypto_hash_sha256` |
| T21 | `urut` SETOR/BELAJAR = max(`meta.seq`, seq tertinggi rekaman yang dibawa) | Konfirmasi selalu menutup semua rekaman yang terkirim |
| T22 | (Fase 1b) Kunci setor publik **ditandatangani admin** (`KunciSetor.tt` atas `PPGKS1.<org>.<kelompok>.<versi>.<publik>`); HP generus/wali hanya memakai kunci bertanda tangan sah (saat aktivasi, BALASAN, dan `buatBelajar`) | Tanpa ini mubaligh (termasuk yang sudah dicabut) bisa menyisipkan kunci versi tinggi miliknya lewat BALASAN dan menyadap semua BELAJAR berikutnya |
| T23 | (Fase 1b) **Kunci umum kelompok berversi** dan diganti bersama `gantiKunciKelompok` (jadi juga saat serah terima). Disebar lewat PAKET (`kunci_umum`, amplop per penerima tingkat kelompok) dan BALASAN (`kunci_umum`); `terapkanJadwal` mencoba semua kunci profil kelompok. Skema v2: kolom `kunci_umum_kelompok.versi` | Mubaligh lama tidak bisa membaca jadwal baru |
| T24 | (Fase 1b) BALASAN & JADWAL membawa pencabutan **semua token mubaligh kelompok**. HP generus/wali menerima beku/cair hanya untuk tokennya sendiri, `cabut` untuk token mana pun. BALASAN hanya boleh berisi data generus penerima, rantai wilayah kelompoknya, jadwal kelompoknya, koreksi untuk HP itu; JADWAL hanya pengajian kelompok+induk dan jadwal tambahan kelompok | HP generus tidak pernah tahu mubaligh lama dicabut; berkas mubaligh tidak boleh menimpa materi/generus lain |
| T25 | (Fase 1b) Admin menolak presensi/kemajuan/penilaian untuk generus yang **bukan anggota kelompok rekaman pada tanggal kegiatan** (riwayat keanggotaan admin; penilaian: bulan `periode`) atau tidak dikenal | Mencegah kelompok A mencatat/mengesahkan generus kelompok B dengan menulis `kelompok_id` A |
| T26 | (Fase 1b) Konfirmasi BELAJAR **per kelompok** (`meta.konfirmasi_belajar_seq:<kelompok>`); `urut` BELAJAR tidak melewati catatan profil kelompok yang sedang dibekukan/kedaluwarsa (`min seq tertunda − 1`) | HP multi-kelompok dan kakak yang mondok tidak kehilangan catatan |
| T27 | (Fase 1b) PAKET/MATERI diterima bila `versi` **atau** `dibuat_pada` lebih baru dari yang terpasang (`meta.paket_dibuat:<w>`, `materi_dibuat`); master dari admin menang bila `versi` ≥ lokal **atau** `diubah_pada` lebih baru; `buatSetor(db, { semua: true })` mengirim ulang semua data | Admin yang memulihkan database dari cadangan (versi mundur) tidak membuat semua HP menolak paket selamanya; berkas lama tetap ditolak |
| T28 | (Fase 1b) Modul `kueri.ts` (kueri layar UI) dan `meta.terakhir_setor` / `terakhir_belajar` ditulis saat berkas dibuat | Agen UI tidak menulis SQL sendiri |
| T29 | (Fase 2) Renderer EXE dimuat dari protokol khusus **`app://`** (standard + secure + fetch) dengan CSP ketat (`script-src 'self' 'wasm-unsafe-eval'`), bukan `file://` | `fetch` wasm sql.js tidak berjalan di `file://`; `app://` juga konteks aman untuk WebCrypto (PBKDF2) |
| T30 | (Fase 2) IPC tambahan selain 4 kanal §11: `berkas:simpanKeFolder` (Kirim Paket "semua kelompok" → satu dialog folder), `aplikasi:folderData`, dan sinyal tutup `aplikasi:akanTutup`/`aplikasi:siapTutup` (simpan terakhir sebelum jendela ditutup) | Tanpa itu admin harus menekan dialog simpan per kelompok; penutupan jendela tidak boleh kehilangan perubahan dalam jeda debounce |
| T31 | (Fase 2) Semua paket desktop di `devDependencies` (dibundel Vite), main/preload dibangun terpisah ke `dist-electron/*.cjs` (preload satu berkas tanpa chunk bersama — syarat preload `sandbox`) | electron-builder tidak perlu mengemas `node_modules`; workspace `@ppg/core` (symlink) tidak ikut dikemas |

---

## 2. Struktur repositori

```
/                         npm workspaces (Node 22, TypeScript strict, ESM)
├── package.json          workspaces: ["packages/*", "apps/*"]; skrip: test, build, typecheck
├── tsconfig.base.json
├── packages/core/        @ppg/core — SEMUA logika bisnis, tanpa UI
│   ├── src/
│   │   ├── index.ts      ekspor publik
│   │   ├── ids.ts        ulid()
│   │   ├── waktu.ts      sekarangIso(), tanggalHariIni(), awalPekan(), dll.
│   │   ├── crypto.ts     pembungkus libsodium + PBKDF2
│   │   ├── token.ts      kode perangkat, token, rantai kepercayaan
│   │   ├── berkas.ts     format biner .ppg (kemas/buka)
│   │   ├── skema.ts      DDL + migrasi
│   │   ├── db.ts         pembungkus sql.js (bukaDb, simpan, kueri, transaksi)
│   │   ├── repo/         CRUD per tabel (wilayah, generus, jamaah, pengajian, materi, presensi, kemajuan, usulan, koreksi, perangkat, ...)
│   │   ├── gabung.ts     aturan penggabungan rekaman
│   │   ├── sinkron/      setor.ts, paket.ts, belajar.ts, balasan.ts, jadwal.ts, materi.ts
│   │   ├── admin.ts      inisialisasi admin, terbit token, cabut/bekukan, ganti kunci kelompok, cadangan kunci
│   │   ├── perangkat.ts  inisialisasi HP, profil, aktivasi, PIN
│   │   ├── siklus.ts     pindah kelompok, ubah status (mondok/aktif/...), serah terima mubaligh
│   │   ├── laporan.ts    laporan pekanan, teks WA, rekap presensi & kemajuan
│   │   ├── kurikulum.ts  seed kurikulum dari JSON, target materi berikutnya
│   │   └── data/kurikulum-sumber.json
│   └── test/             vitest; termasuk test/skenario-lengkap.test.ts
├── apps/desktop/         EXE admin — Electron + React 19 + Vite
└── apps/mobile/          APK — React 19 + Vite + Capacitor 7
```

Dependensi inti (versi stabil terbaru yang kompatibel): `sql.js`, `libsodium-wrappers`, `fflate`, `vitest`, `typescript`. Desktop: `electron`, `electron-builder`, `exceljs`. Mobile: `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/filesystem`, `@capacitor/share`, `qrcode`, `jsqr`, `idb-keyval`.

`.gitignore` repo menolak `lib/` (warisan Python) — **jangan memberi nama folder `lib`**; pakai `utils/` atau `src/repo/`.

---

## 3. Kriptografi (`crypto.ts`)

Semua fungsi async-aman: panggil `await siapkanKripto()` sekali (memanggil `sodium.ready`).

| Fungsi | Isi |
|---|---|
| `buatPasanganTandaTangan()` | Ed25519 → `{ publik, rahasia }` (Uint8Array) |
| `buatPasanganKotak()` | X25519 → `{ publik, rahasia }` |
| `tandaTangani(pesan, rahasia)` / `periksaTandaTangan(pesan, sig, publik)` | detached |
| `segelKe(publikX25519, data)` / `bukaSegel(data, pasangan)` | `crypto_box_seal` |
| `enkripsiRahasia(kunci32, data)` / `dekripsiRahasia(kunci32, data)` | secretbox, nonce acak 24 byte di depan |
| `kunciAcak32()` | 32 byte acak |
| `turunkanKunciSandi(sandi, garam)` | PBKDF2-SHA256 210.000 iterasi via WebCrypto → 32 byte |
| `keB64url` / `dariB64url`, `sha256Hex` | utilitas |

Galat dekripsi/verifikasi dilempar sebagai `GalatPpg` dengan `kode` (mis. `TANDA_TANGAN_TIDAK_SAH`, `TIDAK_BISA_DIBUKA`) dan `pesan` Bahasa Indonesia.

---

## 4. Identitas, token, rantai kepercayaan (`token.ts`)

### 4.1 Kode Perangkat
Teks `PPGD1.<b64url(JSON)>`, JSON: `{ perangkat_id (ULID), sign_pub, box_pub (b64url), label, dibuat_pada }`. Ditampilkan sebagai QR + teks.

### 4.2 Token
Teks `PPGT1.<b64url(JSON payload)>.<b64url(tanda tangan atas string "PPGT1.<b64url payload>")>`.

Payload:
```ts
type Role = 'pengurus' | 'mubaligh' | 'generus' | 'wali'
type Tingkat = 'daerah' | 'desa' | 'kelompok'
type Hak = 'catat' | 'lihat' | 'sahkan' | 'terbit_generus' | 'setor_belajar'
interface PayloadToken {
  v: 1
  token_id: string
  org_id: string            // id instalasi admin
  admin_sign_pub: string    // dipasang HP saat aktivasi pertama (T2)
  admin_box_pub: string
  perangkat_id: string
  device_sign_pub: string
  device_box_pub: string
  role: Role
  nama: string
  tingkat: Tingkat          // generus/wali/mubaligh = 'kelompok'
  wilayah_id: string        // kelompok_id untuk generus/wali/mubaligh
  generus_ids?: string[]    // generus: [1 id]; wali: anak-anaknya
  hak: Hak[]
  terbit: string            // ISO
  berlaku_sampai: string    // ISO
  rahasia?: string          // b64url segelKe(device_box_pub, JSON RahasiaToken)
  penerbit?: string         // token mubaligh utuh (hanya generus/wali)
}
interface RahasiaToken {
  kunci_wilayah?: Record<string, string>              // wilayah_id → kunci32 (pengurus/mubaligh)
  kunci_kelompok_setor?: { versi: number; publik: string; rahasia?: string; tt?: string }[] // rahasia hanya untuk mubaligh; tt = tanda tangan admin (T22)
  kunci_umum_kelompok?: string                         // semua anggota kelompok (jadwal tambahan)
  kunci_umum_versi?: number                            // T23
}
```

- Pengurus/mubaligh: ditandatangani **kunci tanda tangan admin**.
- Generus/wali: ditandatangani **kunci tanda tangan perangkat mubaligh**, `penerbit` berisi token mubaligh.
- `periksaToken(teks, { adminSignPub, sekarang, pencabutan })` → `{ sah: true, payload } | { sah: false, alasan }`. Untuk generus/wali periksa juga: token penerbit sah, role mubaligh, punya hak `terbit_generus`, `wilayah_id` sama, `terbit` generus ≤ `berlaku_sampai` penerbit, dan penerbit tidak dicabut **sebelum** `terbit` generus.
- Kedaluwarsa: token kedaluwarsa tetap bisa membaca data lokal, tetapi tidak bisa mencatat/menyetor.
- ~~Kunci wilayah~~ (diganti T10): PAKET dibuat per wilayah dan bisa dibuka setiap perangkat aktif yang wilayah tokennya sama dengan atau di atas wilayah paket. Pengurus/mubaligh kelompok menerima `kunci_umum_kelompok` (JADWAL); mubaligh menerima semua versi `kunci_kelompok_setor` beserta rahasianya.
- Bila penerbit token generus/wali sudah dicabut, token itu hanya diterima bila terdaftar (`tokenDikenal`, T12).
- `periksaToken` mengembalikan `{ sah:false, kode, alasan, payload? }`; kode `KEDALUWARSA`/`DIBEKUKAN`/`DICABUT` tetap membawa `payload` agar data lokal bisa dibaca.

---

## 5. Format berkas `.ppg` (`berkas.ts`)

Biner: `"PPG1"` (4 byte ASCII) | `u32 BE panjang header` | header JSON UTF-8 | isi | tanda tangan Ed25519 64 byte atas semua byte sebelumnya.

Header (terbuka, tanpa data pribadi):
```ts
interface HeaderBerkas {
  jenis: 'SETOR' | 'PAKET' | 'BELAJAR' | 'BALASAN' | 'JADWAL' | 'MATERI'
  versi_format: 1
  org_id: string
  pengirim_perangkat_id: string   // 'ADMIN' untuk berkas admin
  dibuat_pada: string
  wilayah_id?: string
  urut?: number        // SETOR/BELAJAR: seq tertinggi yang dibawa
  versi?: number       // PAKET/MATERI/JADWAL: nomor versi
  versi_kunci?: number // BELAJAR: versi kunci kelompok setor
  penerima_perangkat_id?: string  // BALASAN
  kunci_penerima?: Record<string, string> // PAKET (T10): perangkat_id → b64url(segelKe(box_pub, kunci berkas))
}
```

Isi = `gzip(JSON)` (fflate) lalu dienkripsi:

| Jenis | Arah | Enkripsi | Penanda tangan |
|---|---|---|---|
| SETOR | pengurus/mubaligh → admin | `segelKe(admin_box_pub)` | kunci perangkat pengirim |
| PAKET | admin → pengurus/mubaligh | `enkripsiRahasia(kunci berkas acak)`; kunci berkas disegel per penerima aktif di `kunci_penerima` (T10) | admin |
| BELAJAR | generus → mubaligh | `segelKe(kunci_kelompok_setor.publik versi n)` | kunci perangkat generus |
| BALASAN | mubaligh → HP generus/wali | `segelKe(device_box_pub penerima)` | kunci perangkat mubaligh |
| JADWAL | mubaligh → grup WA kelompok | `enkripsiRahasia(kunci_umum_kelompok)` | kunci perangkat mubaligh |
| MATERI | admin → semua | tanpa enkripsi (gzip saja) | admin |

Isi SETOR/BELAJAR selalu menyertakan `tokens: string[]` (token semua profil pengirim) agar penerima bisa memeriksa rantai dan mencocokkan `perangkat_id` dengan penanda tangan.

Nama berkas: `PPG_SETOR_<kelompok-slug>_<YYYYMMDD>_<urut>.ppg`, `PPG_PAKET_<wilayah-slug>_v<versi>.ppg`, `PPG_BELAJAR_<nama-slug>_<YYYYMMDD>.ppg`, `PPG_BALASAN_<nama-slug>_<YYYYMMDD>.ppg`, `PPG_JADWAL_<kelompok-slug>_v<versi>.ppg`, `PPG_MATERI_v<versi>.ppg`.

---

## 6. Skema database (`skema.ts`)

SQLite via sql.js. `PRAGMA foreign_keys = OFF` (data tiba tidak berurutan). Tabel **tersinkron** wajib punya kolom sinkron:

```sql
perangkat_id TEXT NOT NULL,   -- pencatat asli
dibuat_pada TEXT NOT NULL,
diubah_pada TEXT NOT NULL,
dihapus INTEGER NOT NULL DEFAULT 0,
versi INTEGER NOT NULL DEFAULT 1,
seq_lokal INTEGER NOT NULL DEFAULT 0   -- TIDAK ikut dikirim; >0 berarti perlu diteruskan dalam setoran berikutnya
```

### 6.1 Master (pemilik: admin)
- `wilayah(id PK, tingkat, nama, kode, induk_id)`
- `jamaah(id PK, kelompok_id, nama, jenis_kelamin 'L'|'P', tanggal_lahir, no_hp, status)`
- `generus(id PK, kelompok_id, nama, jenis_kelamin, tanggal_lahir, kategori, status 'aktif'|'mondok'|'pindah'|'lulus_menikah'|'keluar', wali_nama, wali_no_hp)`
- `riwayat_keanggotaan(id PK, generus_id, kelompok_id, mulai, selesai NULL)`
- `riwayat_status(id PK, generus_id, status, mulai, selesai NULL, keterangan)`
- `pengajian(id PK, wilayah_id, nama, jenis, hari INTEGER 0=Ahad..6, jam TEXT 'HH:MM', tempat)` — jadwal rutin
- `bidang_materi(id PK, nama, urutan)`, `kategori_materi(id PK, bidang_id, kode, nama, urutan, tipe)`, `materi(id PK, kategori_id, nomor INTEGER, nama, tipe 'hafalan'|'checklist'|'level', kategori_generus TEXT NULL /* csv, NULL = semua */, isi_teks TEXT NULL, lampiran_pdf_b64 TEXT NULL, lampiran_nama TEXT NULL)`
- `penugasan_mubaligh(id PK, perangkat_mubaligh_id, kelompok_id, mulai, selesai NULL)`
- `koreksi(id PK, tabel, rekaman_id, untuk_perangkat_id, catatan, tanggal)`

### 6.2 Kegiatan (pemilik: pencatat)
- `presensi(id PK, kelompok_id, pengajian_id NULL, jadwal_tambahan_id NULL, tanggal, generus_id, status 'hadir'|'izin'|'sakit'|'alpa')` — UNIQUE (tanggal, generus_id, pengajian_id, jadwal_tambahan_id) ditangani di logika
- `kemajuan_belajar(id PK, generus_id, kelompok_id, materi_id, status 'sedang'|'selesai', nilai INTEGER NULL, level INTEGER NULL, tanggal, sumber 'generus'|'mubaligh', status_sah 'diajukan'|'disahkan'|'ditolak', disahkan_oleh NULL, disahkan_pada NULL, catatan_generus NULL, catatan_mubaligh NULL)`
- `penilaian_akhlaq(id PK, generus_id, kelompok_id, periode 'YYYY-MM', aspek, nilai 1..5)` — aspek: sholat_wajib, sholat_jamaah, puasa, tilawah, birrul_walidain, adab_makan, adab_tidur, adab_berbicara, kebersihan, kedisiplinan, kejujuran, tanggung_jawab
- `jadwal_tambahan(id PK, kelompok_id, tanggal, jam, judul, keterangan, dibatalkan INTEGER 0)` — pemilik mubaligh
- `usulan(id PK, jenis 'tambah_generus'|'ubah_generus'|'tambah_jamaah'|'pindah_kelompok'|'ubah_status', data_json, status 'menunggu'|'disetujui'|'ditolak', alasan NULL, kelompok_id)`

### 6.3 Lokal (tidak tersinkron, tanpa kolom sinkron)
- `meta(kunci PK, nilai)` — mis. `seq`, `org_id`, `admin_sign_pub`, `admin_box_pub`, `konfirmasi_seq`, `konfirmasi_belajar_seq:<kelompok>` (T26), `versi_paket:<wilayah>`, `paket_dibuat:<wilayah>`, `versi_materi`, `materi_dibuat` (T27), `jadwal:<kelompok>`, `terakhir_setor`, `terakhir_belajar`, `terakhir_paket`, `terakhir_balasan`
- `identitas_perangkat(id PK, sign_pub, sign_rahasia, box_pub, box_rahasia, label)` — HP; admin menyimpan kuncinya terenkripsi sandi di `meta`
- `profil(id PK, token_id, token TEXT, role, nama, wilayah_id, tingkat, generus_ids_json, pin_hash NULL, pin_garam NULL, rahasia_json, dibekukan INTEGER, dicabut_pada NULL, aktif INTEGER, berlaku_sampai, dibuat_pada)` — HP
- `perangkat(id PK = token_id, perangkat_id, label, role, tingkat, wilayah_id, nama, token_id, token, sign_pub, box_pub, generus_ids_json, seq_diterima INTEGER, dicabut_pada NULL, dibekukan INTEGER, diterbitkan_oleh, berlaku_sampai, setor_akhir_urut NULL, terakhir_setor NULL, dibuat_pada)` — **satu baris per token** (T11); admin (semua pengurus/mubaligh + generus/wali yang dilaporkan mubaligh), HP mubaligh/pengurus (token di wilayahnya, dari PAKET + yang diterbitkan sendiri)
- `pencabutan(id PK, token_id, perangkat_id, jenis 'cabut'|'beku'|'cair', tanggal ISO)` — juga ikut dibagikan dalam PAKET/BALASAN; cabut permanen, beku/cair memakai catatan terakhir
- `kunci_kelompok(kelompok_id, versi, publik, rahasia_terenkripsi, dibuat_pada, PK(kelompok_id, versi))` — admin
- `kunci_umum_kelompok(kelompok_id PK, kunci_terenkripsi, versi)` — admin (dienkripsi kunci induk admin; `versi` sejak skema v2, T23). Tabel `kunci_wilayah` dihapus (T10)
- `log_bentrok(id, tabel, rekaman_id, lama_json, baru_json, tanggal)`, `riwayat_impor(id, jenis, nama_berkas, pengirim, tanggal, ringkasan_json)`

`seq_lokal`: setiap tulis lokal (termasuk impor BELAJAR di HP mubaligh) menaikkan `meta.seq` dan memberi nilai itu ke rekaman. Menerapkan PAKET/BALASAN/JADWAL/MATERI memberi `seq_lokal = 0`.

---

## 7. Aturan penggabungan (`gabung.ts`)

`gabungRekaman(db, tabel, rekamanMasuk, { sumber: 'admin' | 'perangkat', seqLokalBaru })` mengembalikan `{ ditambah, diperbarui, diabaikan, bentrok }`.

| Kelompok tabel | Aturan |
|---|---|
| Master, sumber admin | Rekaman admin menang bila `versi` ≥ lokal atau `diubah_pada` lebih baru (T27) |
| Master, sumber perangkat | **Ditolak** (perangkat hanya boleh lewat `usulan`) |
| Kegiatan | Last-writer-wins pada `diubah_pada` (seri → `perangkat_id` leksikografis); bila keduanya berbeda isi dan lokal punya `seq_lokal > 0` → catat `log_bentrok` |
| `kemajuan_belajar` | Rekaman `disahkan`/`ditolak` tidak bisa ditimpa versi `diajukan`; perangkat generus hanya boleh mengubah rekaman miliknya yang masih `diajukan` |
| Hapus | `dihapus = 1` diperlakukan sebagai perubahan biasa |

Admin juga memeriksa **wewenang**: rekaman dari perangkat harus berada dalam `wilayah_id` token pengirim; generus hanya untuk `generus_ids`-nya; aturan pemilik & status usulan (T13); generus anggota kelompok rekaman pada tanggal kegiatan (T25). HP generus/wali memeriksa isi BALASAN/JADWAL menurut T24. Bentrok dicatat menurut T15. Presensi dan penilaian akhlaq dideduplikasi saat dibaca: per kunci alami dipilih rekaman dengan `diubah_pada` terbesar (seri → `perangkat_id`).

---

## 8. Alur sinkron (`sinkron/`)

| Fungsi | Pemanggil | Ringkas |
|---|---|---|
| `buatSetor(db)` | HP pengurus/mubaligh | Semua rekaman tersinkron dengan `seq_lokal > konfirmasi_seq` + usulan + daftar perangkat generus/wali yang diterbitkan (untuk dicatat admin). Header `urut` = seq tertinggi. |
| `imporSetor(dbAdmin, bytes, kunciAdmin)` | EXE | Verifikasi tanda tangan & token, tolak perangkat dicabut, gabung, catat `perangkat.seq_diterima`, kembalikan ringkasan (masuk, usulan, bentrok, ditolak + alasan). Idempoten. |
| `buatPaket(dbAdmin, wilayahId, kunciAdmin)` | EXE | Untuk wilayah: master (rantai wilayah, generus anggota **atau pernah anggota** — agar HP kelompok lama tahu generus sudah pindah —, jamaah, pengajian, riwayat, penugasan), kegiatan di wilayah itu (+ kemajuan/penilaian milik generusnya dari kelompok lama), koreksi untuk perangkat di wilayah, daftar token wilayah, pencabutan, `konfirmasi: {perangkat_id: seq}`, semua versi kunci kelompok setor (disegel per perangkat mubaligh aktif), amplop T10, `versi` naik. |
| `terapkanPaket(db, bytes)` | HP | Tolak bila versi **dan** `dibuat_pada` ≤ terpasang (T27); perbarui kunci umum kelompok (T23); gabung sebagai sumber admin; perbarui `konfirmasi_seq`, kunci, pencabutan; bila profil tercabut/dibekukan, tandai profil. |
| `buatBelajar(db, { kelompokId? })` | HP generus | Untuk semua profil generus di HP: `kemajuan_belajar` milik profil dengan `seq_lokal > konfirmasi_belajar_seq`. Satu berkas (bila profil dari beberapa kelompok, wajib pilih `kelompokId`). |
| `imporBelajar(dbMubaligh, bytes)` | HP mubaligh | Verifikasi rantai token, enkripsi versi kunci, generus milik kelompok, profil tidak dibekukan; simpan `diajukan`; beri `seq_lokal` baru. Impor massal: `imporBanyak(db, [bytes])`. |
| `sahkan(db, kemajuanId, { keputusan, catatan })` | HP mubaligh | `disahkan`/`ditolak`, isi `disahkan_oleh` (nama mubaligh), `disahkan_pada`. |
| `simakLangsung(db, data)` | HP mubaligh | Buat `kemajuan_belajar` sumber mubaligh, langsung `disahkan`. |
| `buatBalasan(dbMubaligh, perangkatPenerimaId)` | HP mubaligh | Untuk semua generus_ids di perangkat itu (profil generus + anak profil wali): kemajuan, presensi, penilaian akhlaq, koreksi, pengajian & jadwal kelompok, status generus, pencabutan/pembekuan perangkat itu **dan token mubaligh kelompok** (T24), `konfirmasi_belajar_seq` (per kelompok, T26), kunci kelompok setor terbaru (publik + `tt`, T22), kunci umum kelompok (T23). |
| `terapkanBalasan(db, bytes)` | HP generus/wali | Gabung; perbarui konfirmasi & kunci publik; bekukan/cairkan profil. |
| `buatJadwal(dbMubaligh)` / `terapkanJadwal(db, bytes)` | mubaligh / semua anggota | Pengajian rutin kelompok + jadwal tambahan; versi naik; aturan berkas lama T14. Isi BALASAN/JADWAL membawa `token_pengirim` (token mubaligh) untuk diverifikasi penerima. |
| `buatMateri(dbAdmin)` / `terapkanMateri(db, bytes)` | admin / semua | Bidang, kategori, materi (termasuk PDF base64). |
| `bukaBerkasApaSaja(db, bytes)` | HP | Baca header → arahkan ke fungsi terapkan/impor yang cocok; pesan jelas bila berkas bukan untuk HP ini. |

---

## 9. Admin, perangkat, siklus hidup

`admin.ts`:
- `inisialisasiAdmin(db, { sandi, namaOrganisasi })`: buat org_id, kunci tanda tangan & kotak admin, kunci induk (acak) → semua rahasia dienkripsi kunci induk; kunci induk dienkripsi `turunkanKunciSandi(sandi)`. Seed kurikulum.
- `bukaKunciAdmin(db, sandi)` → objek kunci di memori (galat jelas bila sandi salah).
- `eksporCadanganKunci(db, sandiCadangan)` / `imporCadanganKunci(...)` → berkas `PPG_KUNCI_ADMIN_<tanggal>.ppgkey`.
- `terbitkanToken(db, kunci, { kodePerangkat, role, nama, tingkat, wilayahId, hak, berlakuHari })` → teks token; catat `perangkat`; untuk mubaligh buat `penugasan_mubaligh` dan sertakan kunci kelompok setor (semua versi, termasuk rahasia), kunci wilayah, kunci umum kelompok.
- `cabutPerangkat`, `bekukanPerangkat`, `cairkanPerangkat`.
- `gantiKunciKelompok(db, kunci, kelompokId)` → versi baru.
- `setujuiUsulan(db, usulanId)` / `tolakUsulan(db, usulanId, alasan)` — menerapkan isi usulan ke master (`tambah_generus` membuat generus + riwayat_keanggotaan; `pindah_kelompok` → §siklus; `ubah_status` → §siklus).
- `imporGenerusCsv(db, teksCsv)` — kolom: nama, jenis_kelamin, tanggal_lahir, kategori, kelompok_kode, wali_nama, wali_no_hp; laporan baris gagal.

`perangkat.ts`:
- `inisialisasiPerangkat(db, label)` → identitas + `kodePerangkat()`.
- `aktifkanProfil(db, teksToken, { pin? })` → periksa token (pasang kunci admin pertama kali, tolak org_id berbeda), buka `rahasia`, simpan profil.
- `daftarProfil`, `pilihProfil(db, id, pin?)`, `hapusProfil`.
- `terbitkanTokenGenerus(db, profilMubaligh, { kodePerangkat, role: 'generus'|'wali', generusIds, nama })` → teks token (ditandatangani kunci perangkat mubaligh, `penerbit` = token mubaligh, `rahasia` berisi kunci kelompok setor publik + kunci umum kelompok). Catat di `perangkat` HP mubaligh; ikut dilaporkan dalam SETOR.

`siklus.ts`:
- `pindahKelompok(db, generusId, kelompokTujuanId, tanggal)` — tutup & buka `riwayat_keanggotaan`, ubah `generus.kelompok_id`, cabut token generus kelompok lama (T16).
- `ubahStatus(db, generusId, status, tanggal, keterangan)` — tutup & buka `riwayat_status`; `mondok` → bekukan semua perangkat generus/wali yang hanya memegang generus itu; `aktif` → cairkan; `lulus_menikah`/`keluar` → cabut token generus.
- `serahTerimaMubaligh(db, kunci, { kelompokId, perangkatLamaId, paksa? })` — prasyarat: `seq_diterima` mubaligh lama ≥ urut Setor Akhirnya (fungsi `statusSetorAkhir`; `paksa` untuk HP hilang); cabut token lama, tutup penugasan; `gantiKunciKelompok` (kunci setor **dan** kunci umum kelompok, T23). Sesudahnya mubaligh baru mengirim BALASAN ke semua HP generus/wali agar kunci umum baru & pencabutan mubaligh lama tersebar. `perangkatLamaId` boleh token_id atau perangkat_id.
- HP mubaligh: `setorAkhir(db)` = `buatSetor` dengan penanda `setor_akhir: true` di isi.

---

## 10. Laporan (`laporan.ts`)

- `laporanPekanan(db, generusId, tanggalAcuan)` → pekan Ahad–Sabtu yang memuat tanggal acuan: `{ generus, kelompok, pekan: {mulai, selesai}, presensi: {hadir, izin, sakit, alpa, total}, materiDisahkan: [...], materiDiajukan: [...], targetBerikutnya: [...] (maks 3, materi belum disahkan sesuai kategori generus, urut bidang→kategori→nomor), catatanMubaligh: [...] }`. Generus berstatus mondok pada pekan itu → `{ mondok: true }`.
- `teksWaLaporanPekanan(laporan)` → teks ringkas Bahasa Indonesia, diawali salam "Assalamu'alaikum", tanpa data generus lain.
- `tautanWa(noHp, teks)` → `https://wa.me/62…?text=…` (ubah 08… → 628…).
- `rekapPresensi(db, { wilayahId, mulai, selesai })` → per generus & per kelompok; hanya menghitung hari ketika generus **aktif** dan **anggota kelompok itu** (pakai riwayat).
- `rekapKemajuan(db, { wilayahId })` → per generus: jumlah materi disahkan per bidang, persentase terhadap materi sesuai kategori.

---

## 11. Aplikasi Desktop (EXE admin) — `apps/desktop`

Electron (main + preload, `contextIsolation: true`) + renderer React 19/Vite yang memakai `@ppg/core` langsung (sql.js di renderer). IPC minimal: `db:muat`, `db:simpan(bytes)` (berkas `userData/ppg-admin.db`, simpan atomik + cadangan otomatis harian `userData/cadangan/`), `berkas:bukaBanyak(filter)` → `[{nama, bytes}]`, `berkas:simpan(namaSaran, bytes)`.

Halaman (sidebar kiri, tema teal–ivory):
1. **Masuk / Pengaturan awal** (buat sandi admin & nama organisasi; atau pulihkan dari cadangan kunci + cadangan database)
2. **Beranda** — ringkasan: jumlah generus aktif/mondok, perangkat aktif, usulan menunggu, setoran terakhir per kelompok (tanda merah bila > 14 hari)
3. **Wilayah** — pohon daerah → desa → kelompok (tambah/ubah/hapus lunak)
4. **Generus & Jamaah** — tabel + filter kelompok/kategori/status, tambah/ubah, impor CSV, pindah kelompok, ubah status
5. **Pengajian** — jadwal rutin per wilayah
6. **Materi** — bidang/kategori/materi, isi teks, lampiran PDF; tombol "Buat Berkas Materi"
7. **Perangkat & Token** — tempel Kode Perangkat → formulir role/wilayah/hak/masa berlaku → tampil token (teks + QR + salin); daftar perangkat; cabut/bekukan/cairkan; ganti kunci kelompok; serah terima mubaligh
8. **Impor Setoran** — pilih banyak berkas → ringkasan per berkas
9. **Usulan** — setujui/tolak
10. **Koreksi** — buat koreksi atas rekaman kegiatan
11. **Kirim Paket** — pilih wilayah (atau "semua kelompok") → simpan berkas
12. **Rekap & Laporan** — presensi & kemajuan per wilayah/periode, ekspor Excel (`exceljs`)
13. **Pengaturan** — ganti sandi, ekspor/impor cadangan kunci, cadangan/pulihkan database

Build: `electron-builder` target Windows `nsis` + `portable`, nama produk "PPG Sorong Admin".

---

## 12. Aplikasi Mobile (APK) — `apps/mobile`

React 19 + Vite + Capacitor 7, `appId: id.ppgsorong.app`, `appName: PPG Sorong`. Satu APK untuk semua role. Bisa dijalankan di browser biasa untuk uji (lapisan `platform.ts`: native = Filesystem + Share; web = unduh blob + `<input type=file multiple>`).

Penyimpanan: DB sql.js diekspor ke IndexedDB (`idb-keyval`) setelah setiap perubahan (debounce 500 ms) dan saat app ke latar belakang.

Alur & layar:
- **Awal (belum ada profil)**: Kode Perangkat (QR besar + teks + tombol "Kirim lewat WA"), tombol "Tempel Token" / "Pindai QR Token" (kamera via `getUserMedia` + `jsqr`; cadangan: tempel teks).
- **Pilih Profil** (bila >1; PIN bila diset) + "Tambah Profil".
- Navigasi bawah sesuai role:
  - **Pengurus**: Beranda · Presensi · Data (lihat master, ajukan usulan generus baru) · Rekap · Sinkron (Setor Data, Buka Berkas)
  - **Mubaligh**: Beranda · Setoran Generus (impor massal, daftar diajukan → sahkan/tolak + catatan) · Simak Langsung · Generus (detail, ajukan ubah status/pindah) · Lainnya (Presensi, Terbitkan Token generus/wali via pindai QR atau tempel Kode Perangkat → tampil QR token, Jadwal Tambahan + bagikan berkas jadwal, Laporan Pekanan + kirim WA per wali, Buat Balasan per perangkat, Setor Data, Setor Akhir, Buka Berkas)
  - **Generus**: Materiku (per bidang/kategori, status, target berikutnya, buka teks/PDF) · Catat Kemajuan · Jadwal · Setor (Setor Belajar, Buka Berkas). Profil dibekukan → spanduk "Sedang mondok — pencatatan dihentikan sementara".
  - **Wali**: Laporan Pekanan tiap anak · Kemajuan · Kehadiran · Buka Berkas
- Indikator "Ada N data belum disetor" + pengingat bila > 7 hari sejak setor terakhir.
- Semua tombol ≥ 44 px, teks besar, tanpa istilah teknis ("berkas", bukan "payload").

Android: izin `CAMERA`; intent-filter agar berkas `.ppg` dari WA bisa dibuka dengan "PPG Sorong" (MIME `application/octet-stream` + pola path `.*\\.ppg`), diteruskan ke `bukaBerkasApaSaja`.

---

## 13. Pengujian & definisi selesai

- `packages/core`: vitest, target cakupan logika > 85 %. Wajib ada **`test/skenario-lengkap.test.ts`** yang mensimulasikan: admin init → wilayah 1 daerah/2 desa/3 kelompok → impor CSV generus → aktivasi pengurus kelompok & mubaligh → mubaligh terbitkan token 2 generus di **satu HP** (multi-profil) + 1 wali → generus setor belajar → mubaligh impor, sahkan 1 tolak 1, simak langsung 1 → presensi → mubaligh setor → admin impor (idempoten bila diimpor 2×) → paket → mubaligh terapkan → balasan → wali lihat laporan pekanan → teks WA → generus mondok (dibekukan, tidak dihitung presensi) → aktif lagi → pindah kelompok (rekap per periode benar) → serah terima mubaligh (kunci baru; mubaligh lama dicabut dan tidak bisa membuka BELAJAR baru; mubaligh baru bisa membuka BELAJAR versi lama dan baru) → token palsu/diubah ditolak → token diteruskan ke HP lain tidak bisa dipakai → paket lama tidak menimpa paket baru → berkas hilang lalu setoran berikutnya tetap membawa data (kumulatif).
- Desktop & mobile: `tsc --noEmit` bersih, `vite build` sukses, vitest untuk komponen/alur utama (jsdom).
- CI: `.github/workflows/build-apk.yml` (ubuntu, Java 21, Android SDK, `npx cap sync android`, `./gradlew assembleDebug`, unggah APK) dan `.github/workflows/build-exe.yml` (windows-latest, electron-builder, unggah EXE); keduanya menjalankan `npm test` dulu.
- Setiap fase menambahkan bagian ke `docs/LAPORAN-TAHAP.md`: apa yang dibuat, hasil uji (angka), keputusan otonom baru, sisa masalah.
