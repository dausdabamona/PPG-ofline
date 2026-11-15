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
| T32 | (Fase 3) PAKET membawa **seluruh pohon wilayah** (`wilayah`: nama/kode saja); data generus & kegiatan tetap dibatasi wilayah paket | HP mubaligh harus bisa memilih kelompok tujuan untuk usulan `pindah_kelompok` (sebelumnya hanya mengenal rantai kelompoknya sendiri) |
| T33 | (Fase 3) APK: semua berkas keluar (SETOR/BELAJAR/BALASAN/JADWAL, cadangan HP) ditulis ke `Directory.Cache` lalu dibuka lewat lembar **Share** (WA, Drive, …); PDF materi juga lewat Share ("Buka dengan…"); tautan wa.me dibuka dengan navigasi `location.href` (Capacitor meneruskan host luar ke aplikasi luar) | Tanpa plugin tambahan (FileOpener/AppLauncher) dan tanpa izin penyimpanan Android 11+ |
| T34 | (Fase 3) Intent berkas: VIEW (`application/octet-stream`, dan `*/*` + `pathPattern .*\\.ppg`) dan SEND (`application/octet-stream`); `MainActivity` mengubah SEND menjadi VIEW sehingga `@capacitor/app` (`appUrlOpen`/`getLaunchUrl`) meneruskannya; isi dibaca `Filesystem.readFile` (URI `content://`) | Satu jalur untuk "Buka dengan" dan "Kirim ke" dari WA |
| T35 | (Fase 3, diubah Fase 4) DB HP disimpan ke IndexedDB (`idb-keyval`, kunci `ppg-hp-db`) di native maupun peramban; jeda 500 ms + saat `appStateChange` (native) / `visibilitychange`/`pagehide` (peramban). Cadangan HP = berkas `PPG_CADANGAN_HP_<tanggal>.ppgdb` **terenkripsi kata sandi cadangan** (T39) | Satu mekanisme di kedua platform; pemulihan memeriksa berkas adalah DB HP (bukan admin) |
| T36 | (Fase 3, diubah Fase 4) QR digambar sebagai SVG dari `QRCode.create` (tanpa kanvas); pemindai `getUserMedia` + `jsqr` (dimuat dinamis, bingkai diperkecil ke lebar 640 px, tiap 200 ms) dengan cadangan tempel teks. Token generus/wali (±3,7 KB) tampil sebagai **QR berseri** (T38); Kode Perangkat (±0,3 KB) tetap satu QR | Ringan untuk HP 2 GB |
| T37 | (Fase 3) Nama HP diminta sekali saat pertama dibuka (label Kode Perangkat). CSP ketat disisipkan hanya pada hasil build (plugin Vite) karena server dev memerlukan skrip inline | Admin/mubaligh tahu HP siapa; dev server tetap jalan |
| T38 | (Fase 4) **QR berseri** `PPGQ1\|<id 8 huruf>\|<ke>/<dari>\|<potongan>`, tiap bagian ≤ 800 karakter (QR versi ≤ 20, 97 modul). Teks ≤ 800 karakter tetap satu QR polos. Layar (APK mubaligh & EXE) menampilkan bagian bergantian tiap 1,5 detik + Sebelumnya/Jeda/Berikutnya; pemindai mengumpulkan bagian (urutan bebas, ganda diabaikan, seri baru memulai ulang) dan menampilkan "2 dari 5 terbaca". Fungsi murni di core (`qr-seri.ts`) | Token generus/wali ±3,7 KB tidak muat satu QR yang bisa dipindai kamera HP murah; tanpa mengubah format token |
| T39 | (Fase 4) **Cadangan HP terenkripsi**: `"PPGCB1" \| garam 16 \| iterasi u32 BE \| secretbox(PBKDF2-SHA256 210.000×(sandi), gzip(db))`, sandi minimal 6 karakter, wajib saat "Cadangkan data HP"; cadangan polos lama tetap bisa dipulihkan (`core/cadangan-hp.ts`) | Berkas cadangan dikirim ke WA/Drive dan memuat kunci rahasia perangkat & kunci kelompok |
| T40 | (Fase 4) Tombol kembali Android: menutup jendela yang terbuka, lalu tombol "Kembali" halaman; bila tidak ada, aplikasi **diperkecil** (`App.minimizeApp`), bukan ditutup. `infoSinkronHp` menambah `hariSejakBelajar`/`perluPengingatBelajar` untuk profil generus di HP bersama | Sebelumnya tombol kembali menutup aplikasi; pengingat Setor Belajar di HP mubaligh+generus dihitung dari Setor Data |

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
| KURIKULUM (v3) | EXE kurikulum → daerah | `segelKe(admin_box_pub)` | kunci perangkat kurikulum |

v3: SETOR dienkripsi ke `atas_box_pub` token (EXE kelompok/desa) bila ada, header `penerima_perangkat_id`; PAKET boleh dibuat EXE desa/kelompok (penanda tangan = perangkat EXE, `token_pengirim` di isi); BALASAN boleh dari EXE desa/kelompok (§14.3).

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

**v3 (Fase 6):** EXE yang sama dipakai semua tingkat (§14). Pengaturan awal: *Buat organisasi baru (Admin Daerah)* · *Aktifkan dengan kode
(Desa / Kelompok / Kurikulum)* · *Pulihkan dari cadangan*. Menu per peran (kepala menampilkan "Admin Desa · Klasaman" dst.):

| Peran | Menu |
|---|---|
| Daerah | Beranda (status setor tiap desa) · Wilayah · Generus & Jamaah · Pengajian (kelas) · Materi · Target Capaian · Perangkat & Token (+ EXE desa/kelompok/kurikulum) · Jadwal Setor · Impor Setoran (+ KURIKULUM) · Usulan · Koreksi · Kirim Paket (+ semua desa) · Rekap & Laporan (+ capaian) · Pengaturan |
| Desa | Beranda (status setor tiap kelompok + Setor ke Daerah) · Setor ke Daerah · Impor Setoran · Buka Paket · Kirim Paket · Perangkat & Token · Generus & Data (lihat + usulan) · Rekap & Laporan · Pengaturan |
| Kelompok | Beranda (status setor tiap HP) · Absen Pertemuan · Impor Setoran · Setor ke Desa · Buka Paket · Rekap & Laporan · Pengaturan |
| Kurikulum | Beranda (Buat berkas Kurikulum) · Materi · Target Capaian · Buka Berkas Materi · Pengaturan |

---

## 12. Aplikasi Mobile (APK) — `apps/mobile`

React 19 + Vite + Capacitor 7, `appId: id.ppgsorong.app`, `appName: PPG Sorong`. Satu APK untuk semua role. Bisa dijalankan di browser biasa untuk uji (lapisan `platform.ts`: native = Filesystem + Share; web = unduh blob + `<input type=file multiple>`).

Penyimpanan: DB sql.js diekspor ke IndexedDB (`idb-keyval`) setelah setiap perubahan (debounce 500 ms) dan saat app ke latar belakang.

Alur & layar:
- **Awal (belum ada profil)**: Kode Perangkat (QR besar + teks + tombol "Kirim lewat WA"), tombol "Tempel Token" / "Pindai QR Token" (v3: pemindai native `@capacitor-mlkit/barcode-scanning` di APK, `getUserMedia` + `jsqr` di peramban; cadangan: tempel teks). Kode aktivasi EXE yang ditempel di HP → "Kode ini untuk aplikasi laptop (EXE)".
- **Pilih Profil** (bila >1; PIN bila diset) + "Tambah Profil".
- Navigasi bawah sesuai role (v3, Fase 7 — menggantikan daftar di bawah untuk mubaligh/generus/wali; lihat V-T29): **Mubaligh** Absen · Jadwal · Materi · Lainnya; **Pengurus** Beranda · Absen · Data · Rekap · Sinkron; **Generus** Target · Materiku · Catat · Jadwal · Setor; **Wali** Target · Laporan · Kemajuan · Kehadiran · Berkas.
- Navigasi bawah sesuai role (v2, arsip):
  - **Pengurus**: Beranda · Presensi · Data (lihat master, ajukan usulan generus baru) · Rekap · Sinkron (Setor Data, Buka Berkas)
  - **Mubaligh**: Beranda · Setoran Generus (impor massal, daftar diajukan → sahkan/tolak + catatan) · Simak Langsung · Generus (detail, ajukan ubah status/pindah) · Lainnya (Presensi, Terbitkan Token generus/wali via pindai QR atau tempel Kode Perangkat → tampil QR token, Jadwal Tambahan + bagikan berkas jadwal, Laporan Pekanan + kirim WA per wali, Buat Balasan per perangkat, Setor Data, Setor Akhir, Buka Berkas)
  - **Generus**: Materiku (per bidang/kategori, status, target berikutnya, buka teks/PDF) · Catat Kemajuan · Jadwal · Setor (Setor Belajar, Buka Berkas). Profil dibekukan → spanduk "Sedang mondok — pencatatan dihentikan sementara".
  - **Wali**: Laporan Pekanan tiap anak · Kemajuan · Kehadiran · Buka Berkas
- Indikator "Ada N data belum disetor" + pengingat bila > 7 hari sejak setor terakhir (generus: sejak Setor Belajar terakhir).
- Cadangkan data HP wajib kata sandi (T39); token panjang tampil sebagai QR berseri (T38).
- Semua tombol ≥ 44 px, teks besar, tanpa istilah teknis ("berkas", bukan "payload").

Android: izin `CAMERA`; intent-filter agar berkas `.ppg` dari WA bisa dibuka dengan "PPG Sorong" (MIME `application/octet-stream` + pola path `.*\\.ppg`), diteruskan ke `bukaBerkasApaSaja`.

---

## 13. Pengujian & definisi selesai

- `packages/core`: vitest, target cakupan logika > 85 %. Wajib ada **`test/skenario-lengkap.test.ts`** yang mensimulasikan: admin init → wilayah 1 daerah/2 desa/3 kelompok → impor CSV generus → aktivasi pengurus kelompok & mubaligh → mubaligh terbitkan token 2 generus di **satu HP** (multi-profil) + 1 wali → generus setor belajar → mubaligh impor, sahkan 1 tolak 1, simak langsung 1 → presensi → mubaligh setor → admin impor (idempoten bila diimpor 2×) → paket → mubaligh terapkan → balasan → wali lihat laporan pekanan → teks WA → generus mondok (dibekukan, tidak dihitung presensi) → aktif lagi → pindah kelompok (rekap per periode benar) → serah terima mubaligh (kunci baru; mubaligh lama dicabut dan tidak bisa membuka BELAJAR baru; mubaligh baru bisa membuka BELAJAR versi lama dan baru) → token palsu/diubah ditolak → token diteruskan ke HP lain tidak bisa dipakai → paket lama tidak menimpa paket baru → berkas hilang lalu setoran berikutnya tetap membawa data (kumulatif).
- Desktop & mobile: `tsc --noEmit` bersih, `vite build` sukses, vitest untuk komponen/alur utama (jsdom).
- CI: `.github/workflows/build-apk.yml` (ubuntu, Java 21, Android SDK, `npx cap sync android`, `./gradlew assembleDebug`, unggah APK) dan `.github/workflows/build-exe.yml` (windows-latest, electron-builder, unggah EXE); keduanya menjalankan `npm test` dulu.
- Setiap fase menambahkan bagian ke `docs/LAPORAN-TAHAP.md`: apa yang dibuat, hasil uji (angka), keputusan otonom baru, sisa masalah.

---

## 14. Versi 3 — Pelaporan berjenjang, kurikulum, mubaligh sederhana (hasil uji Pak Fir, 15 Nov 2026)

Hasil uji Pak Fir: QR pendaftaran tidak berfungsi (kode teks berfungsi); menu mubaligh terlalu banyak; pelaporan harus berjenjang kelompok → desa → daerah; tiap tingkat boleh memakai EXE; kendali penuh di admin daerah; ada jadwal sinkron; perlu role kurikulum.

### 14.1 Keputusan terkunci v3 (dijawab Pak Fir)

| Kode | Keputusan |
|---|---|
| V1 | Tingkat **kelompok boleh memakai HP atau EXE**; desa dan daerah memakai EXE. Satu aplikasi EXE untuk semua tingkat; perannya ditentukan kode aktivasi |
| V2 | **Jadwal setor + pengingat**: admin daerah menetapkan tenggat per tingkat (mis. kelompok→desa tiap Ahad, desa→daerah tiap tanggal 5); aplikasi mengingatkan dan menandai yang terlambat. Tanpa tutup buku |
| V3 | Kode aktivasi HP pengurus/mubaligh diterbitkan **admin desa** (EXE desa) untuk wilayahnya, atas izin daerah. Daerah tetap melihat dan bisa mencabut semua perangkat |
| V4 | **Mubaligh memilih materi per pertemuan** dari kurikulum (aplikasi menyarankan materi berikutnya); murid & orang tua melihat **"Materi yang perlu dituntaskan"** |
| V5 | Role baru **Kurikulum**: bertanggung jawab menetapkan **target capaian materi** (materi wajib tuntas per kategori generus per periode/semester) |

### 14.2 Keputusan teknis v3 (diambil pengarah; agen boleh menyempurnakan dengan mencatat)

- **Hierarki EXE.** EXE punya peran instalasi: `daerah` (akar, = admin lama, memegang kunci induk organisasi), `desa`, `kelompok`, `kurikulum`. EXE baru (bukan daerah) saat pengaturan awal memilih "Aktifkan dengan kode": tampilkan Kode Perangkat EXE → tingkat atas menerbitkan token (daerah → desa/kurikulum; desa → kelompok-EXE) → tempel. Kata sandi lokal tetap melindungi kunci perangkat EXE itu.
- **Rantai kepercayaan berjenjang.** Token boleh ditandatangani oleh admin daerah ATAU oleh perangkat EXE desa yang tokennya (dari daerah) memiliki hak `terbit_bawah` untuk wilayah desa itu; berlaku juga rantai sampai generus/wali (daerah → desa → mubaligh → generus). `periksaToken` menelusuri rantai sampai kunci daerah, memeriksa wilayah anak ⊆ wilayah penerbit, dan pencabutan di setiap mata rantai.
- **Alur naik.** HP kelompok menyetor ke **tingkat atas langsungnya** (EXE kelompok bila ada, jika tidak EXE desa): berkas SETOR dienkripsi ke `atas_box_pub` dari token HP. EXE kelompok/desa mengimpor, menggabung, lalu menyusun **SETOR gabungan** ke atas (rekaman asli apa adanya + daftar perangkat & token di bawahnya + konfirmasi), ditandatangani EXE itu. Daerah menerima rekaman dari perangkat mana pun yang berada di bawah wilayah pengirim (aturan wewenang T13 diperluas ke rantai).
- **Alur turun.** Daerah membuat PAKET untuk tiap EXE desa (seluruh data desa + master + kurikulum + target + jadwal setor + pencabutan); EXE desa menerapkan lalu membuat PAKET untuk EXE kelompok/HP di bawahnya (ditandatangani desa, dikunci per penerima aktif seperti T10). HP memverifikasi tanda tangan penerbit paket lewat rantai.
- **Jadwal setor.** Master baru `jadwal_setor(id, tingkat_asal 'kelompok'|'desa', pola 'pekanan'|'bulanan', hari 0–6 NULL, tanggal 1–28 NULL, jam)` milik daerah. Kueri `statusSetor(db, wilayahId)` → tenggat berikutnya, setor terakhir, `terlambat` per wilayah bawahan. Ditampilkan di beranda EXE tiap tingkat dan HP pengurus/mubaligh (pengingat).
- **Kurikulum.** Tabel `target_capaian(id, periode 'YYYY-S1'|'YYYY-S2', kategori_generus, materi_id, urutan)` + `periode_aktif` di meta master. Role `kurikulum` (token dari daerah, EXE) mengelola materi & target lalu menghasilkan berkas `KURIKULUM` (ditandatangani perangkat kurikulum, berantai ke daerah) yang dikirim ke daerah; daerah mengimpornya ke master lalu ikut turun lewat PAKET/MATERI. Admin daerah juga boleh mengelola kurikulum sendiri.
- **Materi yang perlu dituntaskan.** Kueri `materiPerluDituntaskan(db, generusId)` = target periode aktif untuk kategori generus − materi yang sudah disahkan; beserta persentase capaian. Kueri `saranMateriPertemuan(db, kelompokId, kategori?)` = materi target berikutnya yang paling banyak belum tuntas di kelas itu.
- **Kelas = pengajian rutin per kategori.** `pengajian` mendapat kolom `kategori_generus` (NULL = semua). Absen pertemuan menampilkan hanya generus aktif dengan kategori itu.
- **Pertemuan & materi ajar.** Tabel kegiatan `pertemuan(id, kelompok_id, pengajian_id NULL, jadwal_tambahan_id NULL, tanggal, materi_ids_json, catatan)` milik mubaligh/pengurus pencatat; presensi merujuk `pertemuan_id`. Saat absen, mubaligh dapat menandai materi pertemuan **tuntas** per generus → `kemajuan_belajar` sumber mubaligh, langsung disahkan.
- **Mubaligh sederhana.** Navigasi bawah mubaligh: **Absen** (pilih pertemuan/kelas → pilih materi hari ini dengan saran → tandai hadir → centang yang tuntas) · **Jadwal** · **Materi** (target kurikulum per kelas + progres tiap generus) · **Lainnya** (setoran generus, token, balasan, laporan pekanan WA, setor ke atas, buka berkas). Satu ketukan besar "Setor ke Desa" muncul di Absen bila mendekati tenggat.
- **Murid & orang tua.** Layar pertama = "Materi yang perlu dituntaskan" (daftar + bilah persentase + jadwal pertemuan berikutnya). Pencatatan mandiri murid tetap ada di menu kedua.
- **QR.** Ganti pemindai `getUserMedia`+`jsqr` dengan pemindai **native** Capacitor (pilih plugin resmi/terawat yang kompatibel Capacitor 7, mis. `@capacitor/barcode-scanner` atau `@capacitor-mlkit/barcode-scanning`; pilih yang build-nya pasti lolos di CI dan berfungsi offline), minta izin kamera saat runtime, dan pertahankan QR berseri (T38). Tampilan QR: ukuran besar, kontras tinggi, error correction M, latar putih dengan quiet zone. Tetap ada cadangan tempel kode.
- **Migrasi.** Skema naik versi; database v2 (daerah lama) dimigrasikan otomatis: admin lama = EXE `daerah`, token lama tetap berlaku.

### 14.3 Keputusan teknis otonom v3 (agen pembangun core, Fase 5)

| Kode | Keputusan | Alasan |
|---|---|---|
| V-T1 | Role token baru **`admin`** (EXE desa/kelompok; `tingkat` menentukan) dan **`kurikulum`** (tingkat daerah, hak `lihat`); hak baru **`terbit_bawah`** hanya untuk EXE desa bertoken akar dari daerah. EXE desa menerbitkan pengurus/mubaligh (HP) dan EXE kelompok dengan hak ⊆ `HAK_DARI_DESA`; EXE kelompok (hak `catat`, `lihat`, `sahkan`) tidak menerbitkan token | Satu aturan rantai untuk semua tingkat; kendali penerbitan tetap di desa (V3) |
| V-T2 | `periksaToken` menelusuri rantai rekursif (maks 3 penerbit) sampai kunci daerah. Wilayah anak ⊆ penerbit diperiksa lewat opsi `wilayahMencakup` (pohon wilayah lokal dari daerah); **dilewati bila wilayah tidak dikenal** (HP yang belum punya pohon). EXE desa & daerah selalu memeriksa (`opsiPeriksaDb`). Pencabutan per mata rantai mengikuti T12: token anak yang terbit sebelum penerbitnya dicabut tetap berlaku bila terdaftar | HP baru tidak punya pohon wilayah saat aktivasi; penegakan pasti terjadi di tingkat yang menerima datanya. Mencabut EXE desa tidak mematikan semua HP desa itu |
| V-T3 | EXE bawah: `peran_db = 'exe'`, `peran_instalasi` (`desa`/`kelompok`/`kurikulum`), token EXE disimpan sebagai profil. Kunci rahasia identitas di `identitas_perangkat` berawalan `enc:` (secretbox kunci induk; kunci induk dibungkus PBKDF2-SHA256 210.000×sandi), dibuka ke memori per `Db` (`bukaKunciExe`); `ambilIdentitas` melempar `EXE_TERKUNCI` | Fungsi HP (aktivasi, setor, balasan) dipakai ulang tanpa duplikasi; laptop desa bisa dipakai orang lain |
| V-T4 | **Kunci kelompok titipan**: PAKET daerah membawa `kunci_titipan` per EXE penerima (semua versi kunci setor + rahasia + `tt`, dan kunci umum, untuk tiap kelompok di wilayah EXE), disimpan terenkripsi kunci induk EXE (tabel lokal `kunci_titipan`). EXE desa memakainya untuk token mubaligh, PAKET mubaligh, dan BALASAN | Mubaligh terbitan desa butuh kunci setor bertanda tangan daerah (T22); kunci baru hasil serah terima ikut turun |
| V-T5 | Tujuan SETOR = `atas_box_pub`/`atas_perangkat_id` di token (tertanda penerbit); header SETOR `penerima_perangkat_id` (`'ADMIN'` = daerah). Penerima lain menolak dengan `BUKAN_PENERIMA_SETOR`. Token terbitan desa: atas = EXE kelompok aktif di kelompok itu saat terbit, selain itu EXE desa. Token lama tanpa atas → daerah | Alur naik ke tingkat atas langsung tanpa konfigurasi di HP; berkas yang salah kirim mendapat pesan jelas |
| V-T6 | **SETOR gabungan** (EXE desa/kelompok): rekaman asli apa adanya + `perangkat_bawah` (semua token terdaftar), `konfirmasi_bawah` (`{perangkat: {seq, terakhir, setor_akhir?}}`), `pencabutan`. Wewenang di penerima: rekaman kegiatan milik pengirim atau perangkat bertoken terdaftar di wilayah pengirim; dari token yang dicabut hanya bila `diubah_pada` < saat dicabut; pengesahan bila ada token ber-hak `sahkan` di kelompok itu; T25 tetap. Pencabutan dari EXE diterima hanya untuk token yang rantai penerbitnya melewati EXE pengirim. Setor Akhir mubaligh ikut naik (serah terima di daerah tanpa `paksa`) | Aturan T13 diperluas ke rantai; data yang dicatat sebelum pencabutan tidak hilang |
| V-T7 | **Konfirmasi bertahap**: EXE mencatat `jejak_setor(perangkat, urut, seq_lokal)` saat impor; daerah mengonfirmasi seq EXE (`konfirmasi_seq` = `konfirmasi_daerah_seq` di EXE desa); PAKET EXE membawa `konfirmasi` (sudah diterima EXE itu) dan `konfirmasi_daerah` (urut perangkat yang seq-nya sudah dikonfirmasi daerah). HP: `infoSinkronHp().belumSampaiDaerah` | HP tahu datanya sudah sampai desa lalu daerah tanpa jalur langsung ke daerah |
| V-T8 | PAKET dari EXE: `token_pengirim` di isi (diverifikasi rantai setelah dekripsi, sebelum diterapkan); versi monoton **per penerbit** (`versi_paket:<pengirim>:<wilayah>`); tabel materi ditolak dari paket EXE (materi hanya lewat berkas MATERI daerah yang **diteruskan apa adanya**); generus/jamaah/kegiatan di luar wilayah pengirim ditolak; target, periode, jadwal setor ikut | EXE tidak bisa memalsukan materi; HP menerima paket dari desa dan EXE kelompok tanpa bentrok nomor versi |
| V-T9 | **BALASAN boleh dari EXE desa/kelompok** (role `admin` yang wilayahnya ada di rantai wilayah tepercaya kelompok: pohon lokal + wilayah penerbit dalam rantai token profil). BALASAN & MATERI membawa `target_capaian` & `pengaturan.periode_aktif` | Pencabutan mubaligh sampai ke HP generus lewat desa; menutup "jendela sesudah serah terima" (Fase 1b) bila desa mengirim BALASAN |
| V-T10 | Periode `YYYY-S1` = Juli–Desember, `YYYY-S2` = Januari–Juni tahun berikutnya (tahun ajaran YYYY/YYYY+1). Periode aktif = master `pengaturan` id `periode_aktif`; bila kosong dihitung dari tanggal | Format §14 tidak menyebut bulan; pengajian generus mengikuti tahun ajaran sekolah |
| V-T11 | Kolom master baru: `jadwal_setor.tanggal_bulan` (INTEGER) dan `pengaturan.isi`, bukan `tanggal`/`nilai` (tipe kolom ditentukan per nama di skema; `tanggal` = TEXT, `nilai` = INTEGER). Satu jadwal per tingkat asal (id `JS-kelompok`/`JS-desa`), jam bawaan 23:59 waktu lokal perangkat. **Terlambat** = tidak ada setoran pada periode yang berakhir di tenggat terakhir (pekanan: 7 hari; bulanan: 1 bulan); tanpa jadwal tidak pernah terlambat | Definisi tegas & sederhana; tanpa tutup buku (V2) |
| V-T12 | Id target tetap `TGT-<periode>-<kategori>-<materi>`; `tetapkanTarget` mengganti seluruh daftar satu (periode, kategori) (yang dibuang → hapus lunak). EXE kurikulum boleh menyunting bidang/kategori/materi & target/periode (`pastikanPengelolaKurikulum`; galat `HANYA_KURIKULUM`). Berkas `KURIKULUM` kumulatif (semua rekaman ber-`seq_lokal` > 0), disegel ke kunci kotak daerah; daerah menggabung sebagai sumber berwenang | Tidak ganda antar-instalasi; berkas hilang tidak menghilangkan suntingan |
| V-T13 | Pertemuan: satu per (pencatat, kelompok, tanggal, pengajian, jadwal tambahan). Presensi pertemuan memakai kunci alami lama + kolom `pertemuan_id`. Tuntas hanya untuk materi pertemuan & generus hadir, butuh hak `sahkan` (mubaligh, EXE kelompok, atau daerah); materi yang sudah disahkan tuntas tidak dicatat ulang | Rekap presensi lama tetap benar; tidak ada pengesahan ganda |
| V-T14 | Kolom baru pada tabel lama (`pengajian.kategori_generus`, `presensi.pertemuan_id`) diletakkan di akhir tabel untuk DB baru, sama dengan hasil `ALTER TABLE` migrasi v2 → v3 | Urutan kolom sama di semua database |
| V-T15 | `saranMateriPertemuan` mengurutkan "belum tuntas terbanyak", lalu urutan target | Sesuai §14; materi yang sudah dituntaskan sebagian kelas turun peringkat |
| V-T16 | EXE desa hanya boleh mencabut/membekukan token yang rantai penerbitnya melewati EXE itu; daerah tetap bisa mencabut semua | Kendali penuh di daerah (V3) |
| V-T17 | Daerah membuat `penugasan_mubaligh` untuk token mubaligh terbitan desa ketika pertama kali dilaporkan lewat SETOR gabungan | Serah terima & rekap mubaligh di daerah tetap berjalan |
| V-T18 | HP menolak token EXE (`TOKEN_UNTUK_EXE`), EXE menolak token HP (`TOKEN_UNTUK_HP`); `aktifkanExe` menolak peran/wilayah berbeda dari aktivasi pertama (`PERAN_BERBEDA`) | Satu APK & satu EXE, peran ditentukan kode aktivasi (V1) |
| V-T19 | Skema **v3**: tabel master `jadwal_setor`, `target_capaian`, `pengaturan`; kegiatan `pertemuan`; lokal `jejak_setor`, `kunci_titipan`; kolom `perangkat.terakhir_lapor`. Migrasi otomatis v2 → v3 menandai admin lama `peran_instalasi = 'daerah'`; format token (`v: 1`) dan berkas (`versi_format: 1`) tidak berubah — token & berkas lama tetap berlaku (diuji dengan fixtur database & SETOR buatan kode v2) | Pembaruan aplikasi tanpa aktivasi ulang |
| V-T20 | (Fase 6) **Satu EXE, menu per peran** (tabel §11 v3). Nama produk & berkas data tetap (`PPG Sorong Admin`, `userData/ppg-admin.db`) untuk semua peran; database v2 langsung terbuka sebagai daerah. EXE kelompok tidak punya Kirim Paket (HP kelompok menerima paket dari desa); EXE desa tidak mengubah master — Generus & Data hanya lihat + usulan (`ajukanUsulan`, ikut SETOR gabungan) | Pembaruan aplikasi tanpa pindah berkas; kendali master tetap di daerah (V3) |
| V-T21 | (Fase 6) "Aktifkan dengan kode" dua langkah: (1) nama laptop + kata sandi → `inisialisasiExe` (DB langsung disimpan), (2) layar aktivasi menampilkan Kode Perangkat EXE (teks + QR + Salin + simpan .txt) dan kotak tempel token → `aktifkanExe`. EXE yang belum diaktifkan, setelah kata sandi, selalu kembali ke layar aktivasi. Kata sandi EXE bawah **tidak bisa dipulihkan** (tidak ada .ppgkey): pulihkan dari cadangan database + sandinya, atau pasang ulang & minta kode aktivasi baru | Laptop desa bisa ditutup di antara kirim kode dan terima token; kunci perangkat EXE hanya terlindung sandi lokal (V-T3) |
| V-T22 | (Fase 6) Impor Setoran dan Buka Paket memakai jalur yang sama (`imporBanyak`, core mengarahkan menurut jenis berkas); daerah mengimpor berkas KURIKULUM di Impor Setoran. Tombol "Setor ke Desa/Daerah" = `buatSetor` (kumulatif) + "Kirim ulang semua data" (`semua: true`) | Pengguna tidak perlu tahu jenis berkas; berkas yang salah tujuan mendapat pesan core |
| V-T23 | (Fase 6) Target Capaian disunting di layar (urut naik/turun, buang, tambah dari bidang/kategori materi yang sesuai kategori generus, salin dari periode lain) lalu disimpan sekali (`tetapkanTarget`); periode yang ditawarkan = periode aktif ±2 semester. EXE kurikulum harus membuka berkas MATERI daerah dulu (materi dasar) | Satu penyimpanan = satu daftar berurutan; salin tidak langsung menimpa |
| V-T24 | (Fase 6) Kueri core baru **`rekapCapaian(db, {wilayahId, periode?})`**: kelas = kategori generus di satu kelompok; persen = pasangan (generus × materi target) tuntas disahkan ÷ seluruh pasangan; tingkat kelas/kelompok/desa/wilayah + per generus. Rekap EXE menampilkan & mengekspor 3 lembar Excel tambahan (Capaian per Wilayah/Kelas/Generus) | Persentase gabungan tidak bias kelas kecil; dibangun di atas `progresKelas` |
| V-T25 | (Fase 6) QR di EXE: koreksi galat **M**, zona tenang 4 modul, 320 px (§14.2); bagian QR berseri tetap ≤ 800 karakter. Tombol kecil EXE juga ≥ 44 px | Ketentuan §14.2 dan konvensi tombol |
| V-T26 | (Fase 7) **Pemindai QR native = `@capacitor-mlkit/barcode-scanning` ~7.5** (Capawesome, Capacitor 7): `startScan` dengan model ML Kit **dibundel** di APK (tanpa unduhan model, tanpa internet), kamera di belakang WebView (latar dibuat tembus pandang, kelas `pemindai-native`), event `barcodesScanned` menerima setiap QR selama sesi terbuka sehingga bagian QR berseri yang berganti terkumpul dalam satu sesi ("2 dari 7 terbaca"). Izin kamera diminta saat menekan Pindai (`checkPermissions` → `requestPermissions`); ditolak → pesan ramah + Coba lagi + Buka Pengaturan + tempel. Meta-data `barcode_ui` ditambahkan sesuai petunjuk plugin (modul Google itu tidak dipakai). Peramban/uji: kamera web lama (`getUserMedia` + jsQR) | Dibanding `@capacitor/barcode-scanner` 2.x (resmi): plugin itu mewajibkan **minSdk 26** (HP Android 6–7 tidak bisa memasang APK), menambah Kotlin + Jetpack Compose + ZXing + ML Kit sekaligus (APK lebih besar, risiko versi Kotlin di Gradle CI), dan satu pindai per panggilan (layar pemindai dibuka-tutup per bagian QR). ML Kit: minSdk 23 tetap, Java saja, AGP 8.7.2 sama dengan aplikasi |
| V-T27 | (Fase 7) **Tampilan QR HP**: koreksi galat M, zona tenang 4 modul, hitam murni di atas putih murni, lebar ≥ 280 px (≤ 340 px), tombol **Layar penuh** (latar putih, QR sebesar layar, ajakan menaikkan kecerahan — tanpa plugin kecerahan). Bagian QR berseri di HP **≤ 600 karakter** (`MAKS_BAGIAN_QR_HP`) → QR versi ≤ 20 (≤ 97 modul) dengan koreksi M; token generus ±3,7 KB = 7 QR. QR asing yang ikut tertangkap kamera tidak menghapus bagian yang sudah terkumpul | ECC M dengan 800 karakter butuh versi ±24 (113 modul) — terlalu rapat untuk kamera HP murah; pengumpul core menerima ukuran bagian apa pun (EXE tetap 800) |
| V-T28 | (Fase 7) **Absen**: pilih pertemuan (acara hari itu dari `jadwalPekan` + "Pertemuan lain") → "Materi hari ini" (saran `saranMateriPertemuan` maks 3 + seluruh target kelas, disaring kategori kelas atau kategori generus aktif) → **Lanjut** memanggil `bukaPertemuan` (materi tersimpan; bisa diubah lagi) → `lembarAbsenPertemuan` → **Simpan** = `absenPertemuan` (tuntas lewat `tandaiTuntas`). Centang Tuntas hanya untuk profil ber-hak `sahkan` (mubaligh; pengurus hanya kehadiran), nonaktif bila tidak hadir; materi yang sudah tuntas tampil sebagai tanda ✓. Pertemuan yang pernah dibuka HP ini pada tanggal & jadwal yang sama memuat ulang materinya | Daftar hadir membutuhkan id pertemuan; pertemuan tanpa absen tetap sah (tidak merusak rekap) |
| V-T29 | (Fase 7) **Navigasi v3**: mubaligh Absen · Jadwal (rutin + tambahan + bagikan) · Materi (`progresKelas` per kategori) · Lainnya (Setoran Generus, Simak Langsung, Generus, Terbitkan Token, Kirim Balasan, Laporan Pekanan, Setor ke …, Buka Berkas); pengurus Presensi lama diganti Absen; generus & wali layar pertama **Target** ("Materi yang perlu dituntaskan"), wali tab kedua Laporan. Mengetuk ulang menu yang aktif kembali ke awal menu itu. Indikator "Ada N data belum disetor" disembunyikan di Absen dan Beranda pengurus (diganti kartu pengingat); tombolnya untuk mubaligh menuju Absen | §14; satu sumber pengingat per layar |
| V-T30 | (Fase 7) **Kartu pengingat setor** "Setor ke {tujuanSetor}" di atas Absen (dan Beranda pengurus): tenggat berikutnya (hari, tanggal, jam), Terlambat (merah) / < 24 jam (kuning), jumlah data belum disetor; tombol besar **Setor sekarang** bila `pengingatSetor().tampilkanTombol` — atau, tanpa jadwal setor, bila > 7 hari dan ada data (`infoSinkronHp.perluPengingat`) — langsung `buatSetor` + lembar bagikan WA. Semua tombol/judul setor memakai nama tujuan ("Setor ke Desa Klasaman"; token lama → "Setor ke Daerah") | V2: satu ketukan saat mendekati tenggat |
| V-T31 | (Fase 7) Kode aktivasi `admin`/`kurikulum` di HP (galat core `TOKEN_UNTUK_EXE`, V-T18) → toast + spanduk **"Kode ini untuk aplikasi laptop (EXE), bukan untuk HP."** dengan penjelasan ke mana kode itu ditempel. Profil ber-peran EXE (tidak bisa dibuat lewat core) mendapat layar info, bukan menu kosong | V1: satu APK, peran dari kode; pesan jelas untuk pengguna awam |
| V-T32 | (Fase 8) **Bukti wilayah**: token yang diterbitkan EXE desa untuk kelompok membawa `bukti_wilayah` = tanda tangan admin daerah atas `PPGWB1.<org>.<kelompok>.<desa>`. Daerah menyertakan bukti untuk semua kelompok di wilayah paket bila penerimanya EXE (`IsiPaket.bukti_wilayah`); EXE desa menyimpannya (meta `bukti_wilayah:<kelompok>`) setelah memverifikasi, dan `terbitkanTokenBawah` menolak tanpa bukti (`BUKTI_WILAYAH_TIDAK_ADA`). `periksaToken` opsi `wajibBuktiWilayah`: **wajib** di HP dan EXE kelompok (`wajibBuktiWilayahDb`), tidak wajib di EXE daerah/desa (pohon wilayah dari daerah); bukti yang ada tetapi salah selalu ditolak | Menutup celah V-T2: HP baru tanpa pohon wilayah (atau dengan pohon dari paket desa) tidak bisa dibohongi token rakitan desa lain; daerah tetap satu-satunya sumber kebenaran wilayah |
| V-T33 | (Fase 8) **Materi ikut paket desa**: EXE menyimpan salinan berkas MATERI daerah terakhir (meta `berkas_materi`) dan menyertakannya di setiap PAKET EXE (`materi_daerah`, apa adanya); penerima menerapkannya lewat `terapkanMateri` (tanda tangan daerah, versi monoton; gagal/lama diabaikan) sebelum isi paket. MATERI identik yang sudah terpasang → `sudahPernah`, bukan galat | Desa tidak lagi meneruskan berkas materi secara manual; berkas yang terlewat ikut di paket berikutnya |
| V-T34 | (Fase 8) **Kirim Balasan di EXE desa/kelompok** (menu baru `balasan`): daftar `daftarPenerimaBalasan`, **Buat Balasan** per HP atau **Buat balasan semua HP** (folder) | Sisa Fase 6; pencabutan mubaligh sampai HP murid tanpa menunggu mubaligh baru |
| V-T35 | (Fase 8) HP: isi tab dipasang ulang saat profil berganti (`key` memuat id profil) | Tidak ada keadaan formulir/tampilan profil lain yang terbawa pada HP keluarga |

---

## 15. Super Admin HP — pendaftaran awal dari HP (Fase 9, 15 Nov 2026)

### 15.1 Keputusan Pak Fir (terkunci, revisi akhir)

| Kode | Keputusan |
|---|---|
| S1 | **Pusat/server tetap satu EXE Admin Daerah** (laptop). HP **tidak** membuat organisasi, **tidak** memegang kunci induk, dan **tidak** ada fitur "pindahkan ke laptop" |
| S2 | Beberapa HP (saat ini 3) boleh menjadi **Super Admin HP**, semuanya **setara** di bawah EXE Daerah. Diaktifkan seperti biasa: Kode Perangkat → token dari EXE Daerah (**Perangkat & Token** → Untuk: **Super Admin HP (pendaftaran seluruh daerah)**). Daerah bisa mencabutnya |
| S3 | Menu Super Admin HP: terbitkan token **semua peran** (pengurus, mubaligh, orang tua, murid, EXE desa/kelompok/kurikulum) **kecuali Super Admin HP lain**; daftar & cabut perangkat terbitannya; tambah generus/wilayah/pengajian (nama anak baru langsung bisa dipilih untuk token orang tua/murid); impor setoran HP di bawahnya; kirim paket & balasan; **Setor ke Daerah** (setor gabungan) & buka paket dari Daerah |
| S4 | Kunci perangkat Super Admin HP dilindungi **kata sandi wajib** (min. 8), terkunci otomatis bila di latar belakang > 10 menit |

### 15.2 Rancangan

- **Token.** Role `admin`, tingkat `daerah`, wilayah = daerah, hak `catat`, `lihat`, `terbit_bawah` (`HAK_SUPER_HP`), ditandatangani admin daerah
  (`terbitkanToken`). `adalahTokenSuperHp(payload)` mengenalinya. Rantai yang ada diperluas (satu sumber, `token.ts`): penerbit Super Admin
  HP boleh menerbitkan `pengurus` (tingkat apa pun), `mubaligh`, `admin` desa (boleh `terbit_bawah`) / kelompok (boleh `sahkan`),
  `kurikulum` (daerah), dan **`generus`/`wali`** (delegasi — sebelumnya hanya mubaligh). Token admin tingkat daerah yang penerbitnya bukan
  daerah ditolak (`RANTAI_TIDAK_SAH`).
- **Instalasi.** Super Admin HP = database jenis EXE (`inisialisasiExe`, kunci identitas `enc:` dibungkus PBKDF2 sandi) **di dalam APK**,
  `peran_instalasi = 'super_hp'`, diaktifkan `aktifkanExe(db, kunci, token, { superHp: true })`. Semua fungsi EXE desa dipakai ulang:
  `terbitkanTokenBawah`, `buatSetor` (setor gabungan), `imporSetor`/`imporBanyak`, `buatPaket`, `buatBalasan`, `cabut/bekukan/cairkanPerangkat`.
- **Data master** tetap hanya ditulis daerah (K5). Super Admin HP mengajukan **usulan** (`tambah_generus`, `tambah_wilayah`,
  `tambah_pengajian`, `ubah_status`, `pindah_kelompok`) dengan **id rekaman yang ditetapkan saat diajukan**; daerah **menyetujui otomatis**
  usulan dari pengirim Super Admin HP saat mengimpor setorannya, memakai id itu. Generus usulan langsung bisa dipilih untuk token
  orang tua/murid (`generusPilihanToken`).
- **APK.** Database Super Admin disimpan di kunci IndexedDB tersendiri `ppg-super-db` (profil biasa tetap `ppg-hp-db`). Layar pertama &
  layar Kode Perangkat: **Aktifkan sebagai Super Admin HP**; layar Pilih Profil: kartu **Super Admin HP** (sandi). Berkas dari WA saat
  mode Super Admin aktif dibuka di database Super Admin.

### 15.3 Keputusan teknis otonom (Fase 9)

| Kode | Keputusan | Alasan |
|---|---|---|
| V-T36 | Super Admin HP = **role `admin` tingkat `daerah`** (bukan role baru); `aktifkanExe` menolak token itu di laptop (`TOKEN_UNTUK_SUPER_HP`) dan Super Admin HP menolak token lain (`TOKEN_BUKAN_SUPER_HP` / `TOKEN_UNTUK_EXE`); profil HP biasa menolaknya (`TOKEN_UNTUK_EXE`, UI mengarahkan ke tombol Super Admin) | Format token tidak berubah (`v: 1`); seluruh mesin EXE desa (rantai, titipan kunci, setor gabungan, paket berpenerbit) langsung berlaku tanpa duplikasi |
| V-T37 | Token terbitan Super Admin HP **tidak membawa `bukti_wilayah`**: wilayah penerbit = daerah (akar, tertanda admin daerah), jadi setiap wilayah organisasi ada di dalamnya; pohon lokal tetap diperiksa bila ada | Bukti wilayah (V-T32) mencegah desa A mengaku kelompok desa B; untuk daerah tidak ada "wilayah lain". Token untuk id wilayah karangan tidak bisa membawa data apa pun (daerah menolak data di luar pohonnya) |
| V-T38 | Tujuan SETOR token pengurus/mubaligh terbitan Super Admin HP = **HP Super Admin itu** (bawaan) atau **langsung daerah** (pilihan **Setoran HP itu dikirim ke**); token EXE desa/kelompok/kurikulum, orang tua, dan murid **tanpa** `atas_*` (EXE → daerah; murid → mubaligh) | Petugas lapangan bisa mengumpulkan setoran HP yang ia daftarkan; laptop desa tidak bergantung pada HP petugas |
| V-T39 | Usulan dari pengirim Super Admin HP **disetujui otomatis** di daerah saat `imporSetor` (urut: wilayah desa → kelompok → pengajian → generus → lainnya); jenis `tambah_*` membawa `data.id` (ULID) yang dipakai `setujuiUsulan` (idempoten bila rekaman sudah ada). Usulan yang gagal diterapkan tetap **menunggu** dan dicatat di `ditolak`. Usulan boleh ber-`kelompok_id` desa/daerah (tambah wilayah/pengajian); paket membawa usulan seluruh `turunan` wilayah | Master tetap hanya ditulis daerah (K5) tanpa antrean persetujuan manual untuk petugas tepercaya; nama anak baru bisa langsung dipakai di token orang tua |
| V-T40 | `cariProfilPencatat`: profil **tingkat daerah** mencakup semua wilayah (termasuk yang belum ada di pohon lokal) | Super Admin HP bisa mengajukan kelompok di desa yang juga baru diajukan |
| V-T41 | PAKET kini juga membawa **pencabutan semua token `admin`** (EXE & Super Admin HP), bukan hanya token di wilayah paket | HP menolak token yang diterbitkan Super Admin HP/EXE desa sesudah dicabut, tanpa menunggu daerah |
| V-T42 | Setor gabungan mencatat token **kurikulum** di `perangkat_bawah` bila rantainya melewati pengirim | EXE kurikulum terbitan Super Admin HP terlihat di daftar perangkat daerah |
| V-T43 | APK: database Super Admin di IndexedDB `ppg-super-db`, kunci di memori hanya selama mode Super Admin terbuka; **kunci otomatis** saat kembali dari latar belakang ≥ 10 menit (`Platform.saatAktifKembali`), tombol **Kunci sekarang**, **Kembali ke profil biasa**. Cadangan Super Admin = `buatCadanganHp` (berkas `PPG_CADANGAN_SUPER_…ppgdb`, sandi cadangan) — kunci perangkat di dalamnya tetap terbungkus sandi Super Admin | Desain paling sederhana yang aman: data & kunci terpisah dari profil biasa tanpa skema baru; HP 2 GB hanya membuka satu database sql.js pada satu waktu |
| V-T44 | EXE Daerah: tombol **Paket Super Admin HP (seluruh daerah)** di Kirim Paket (= paket wilayah daerah; amplop untuk token tingkat daerah: Super Admin HP & pengurus daerah, berisi kunci titipan semua kelompok) | Satu tombol yang jelas untuk petugas |
