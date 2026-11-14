# @ppg/core

Seluruh logika bisnis PPG Sorong v2 (offline-first) tanpa UI: kriptografi, token & rantai kepercayaan, berkas `.ppg`,
database sql.js, penggabungan data, alur sinkron via WA, siklus hidup generus/mubaligh, laporan.
Kontrak teknis: `docs/RENCANA-IMPLEMENTASI.md`.

Paket dipakai **langsung dari source TypeScript** (`"main"`/`"exports"` → `src/index.ts`); Vite di `apps/*` tidak perlu build terpisah.

```ts
import { bukaDb, simpanDb /* … */ } from '@ppg/core'
```

## Aturan umum

- Semua fungsi menulis ke `Db` secara sinkron, kecuali yang memakai PBKDF2/inisialisasi (ditandai `async`).
- `await bukaDb(...)` sekaligus menyiapkan libsodium, jadi semua fungsi sinkron aman dipanggil sesudahnya.
- Galat bisnis selalu `GalatPpg { kode, pesan }` — tampilkan `pesan` (Bahasa Indonesia) ke pengguna, pakai `kode` untuk logika UI.
- Berkas keluar berbentuk `BerkasKeluar { nama, bytes, header }` — simpan/bagikan `bytes` dengan nama `nama`.
- Database disimpan oleh aplikasi: `simpanDb(db)` → `Uint8Array` (EXE: berkas `userData`; APK: IndexedDB). Pakai `db.saatBerubah(fn)` untuk simpan otomatis (debounce).
- WebCrypto (`crypto.subtle`) dibutuhkan untuk PBKDF2: tersedia di Node 22, Electron renderer, dan WebView Capacitor (`https://localhost`).

### sql.js di browser

```ts
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url'
const db = await bukaDb(bytesTersimpan /* atau undefined */, { locateFile: () => wasmUrl })
// atau: { wasmBinary: await (await fetch(wasmUrl)).arrayBuffer() }
```

## Daftar API publik

| Modul | Fungsi / tipe utama |
|---|---|
| db | `bukaDb(bytes?, {locateFile?, wasmBinary?})`, `simpanDb(db)`, `Db` (`kueri`, `satu`, `nilai`, `jalankan`, `transaksi`, `saatBerubah`, `ekspor`, `tutup`), `siapkanSqlJs` |
| galat | `GalatPpg`, `adalahGalatPpg(e, kode?)` |
| waktu | `sekarangIso`, `tanggalHariIni`, `awalPekan`, `akhirPekan`, `tambahHari`, `tanggalDariIso`, `formatTanggal`, `umurPada`, `aturJam` (uji) |
| ids | `ulid()` |
| crypto | `siapkanKripto`, `buatPasanganTandaTangan`, `buatPasanganKotak`, `tandaTangani`, `periksaTandaTangan`, `segelKe`, `bukaSegel`, `enkripsiRahasia`, `dekripsiRahasia`, `kunciAcak32`, `turunkanKunciSandi`, `keB64url`, `dariB64url`, `sha256Hex` |
| token | `buatKodePerangkat`, `bacaKodePerangkat`, `tandaTanganiToken`, `uraiToken`, `periksaToken`, `statusPencabutan`, `bukaRahasiaToken`, tipe `PayloadToken`, `RahasiaToken`, `Role`, `Hak` |
| berkas | `kemasBerkas`, `bacaBerkas`, `bacaHeader`, `periksaBerkas`, `kompresJson`, `dekompresJson`, `slug`, tipe `HeaderBerkas`, `BerkasKeluar` |
| gabung | `gabungRekaman`, `gabungSemua` |
| admin | `inisialisasiAdmin`, `bukaKunciAdmin`, `gantiSandiAdmin`, `eksporCadanganKunci`, `imporCadanganKunci`, `terbitkanToken`, `cabutPerangkat`, `bekukanPerangkat`, `cairkanPerangkat`, `gantiKunciKelompok`, `daftarKunciSetor`, `kunciUmumKelompok`, `setujuiUsulan`, `tolakUsulan`, `imporGenerusCsv`, `kelompokBerpenerima` |
| perangkat (HP) | `inisialisasiPerangkat`, `kodePerangkatSaya`, `ambilIdentitas`, `aktifkanProfil`, `daftarProfil`, `ambilProfil`, `profilAktif`, `pilihProfil`, `aturPin`, `hapusProfil`, `terbitkanTokenGenerus`, `statusProfil` |
| siklus | `pindahKelompok`, `ubahStatus`, `serahTerimaMubaligh`, `statusSetorAkhir`, `setorAkhir`, `tokenMilikGenerusSaja` |
| sinkron | `buatSetor`, `imporSetor`, `jumlahBelumDisetor`, `buatPaket`, `terapkanPaket`, `versiPaketTerpasang`, `buatBelajar`, `imporBelajar`, `jumlahBelumDisetorBelajar`, `daftarDiajukan`, `sahkan`, `simakLangsung`, `buatBalasan`, `terapkanBalasan`, `daftarPenerimaBalasan`, `buatJadwal`, `terapkanJadwal`, `buatMateri`, `terapkanMateri`, `bukaBerkasApaSaja`, `imporBanyak`, `daftarRiwayatImpor` |
| laporan | `laporanPekanan`, `teksWaLaporanPekanan`, `tautanWa`, `normalNoHp`, `rekapPresensi`, `rekapKemajuan` |
| kurikulum | `seedKurikulum`, `targetMateriBerikutnya`, `PEMETAAN_MATERI`, `idMateri` |
| repo master (admin) | wilayah: `tambahWilayah`, `ubahWilayah`, `hapusWilayah`, `daftarWilayah`, `turunanWilayah`, `leluhurWilayah`, `kelompokDalamWilayah`; generus/jamaah: `tambahGenerus`, `ubahGenerus`, `daftarGenerus`, `ambilGenerus`, `tambahJamaah`, `ubahJamaah`, `daftarJamaah`, `kategoriDariUmur`; pengajian: `tambahPengajian`, `ubahPengajian`, `hapusPengajian`, `daftarPengajian`, `pengajianUntukKelompok`; materi: `tambahBidang`, `tambahKategori`, `tambahMateri`, `ubahMateri`, `aturLampiranMateri`, `daftarBidang`, `daftarKategoriMateri`, `daftarMateri`, `ambilMateri`; koreksi: `buatKoreksi`, `daftarKoreksi` |
| repo kegiatan (HP/admin) | `catatPresensi`, `catatPresensiMassal`, `daftarPresensi`; `catatKemajuan`, `daftarKemajuan`; `catatPenilaianAkhlaq`, `daftarPenilaianAkhlaq`, `ASPEK_AKHLAQ`; `tambahJadwalTambahan`, `ubahJadwalTambahan`, `batalkanJadwalTambahan`, `daftarJadwalTambahan`; `ajukanUsulan`, `daftarUsulan`; `daftarPerangkat`, `daftarPencabutan` |

Di HP, fungsi pencatatan kegiatan otomatis memeriksa ada profil berwenang (role, hak, wilayah, belum kedaluwarsa/dibekukan/dicabut). Data master hanya bisa diubah di database admin (`HANYA_ADMIN`); dari HP gunakan `ajukanUsulan`.

## Contoh alur

### 1. Admin: inisialisasi & masuk

```ts
const db = await bukaDb()
const kunci = await inisialisasiAdmin(db, { sandi: 'sandi-kuat-123', namaOrganisasi: 'PPG Sorong' }) // kurikulum ter-seed
// sesi berikutnya:
const kunci2 = await bukaKunciAdmin(await bukaDb(bytesDb), 'sandi-kuat-123') // GalatPpg SANDI_SALAH bila salah
const cad = await eksporCadanganKunci(db, kunci, 'sandi-cadangan') // cad.nama = PPG_KUNCI_ADMIN_YYYYMMDD.ppgkey
```

### 2. Admin: wilayah, CSV, pengajian

```ts
const d = tambahWilayah(db, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
const ds = tambahWilayah(db, { tingkat: 'desa', nama: 'Klasaman', kode: 'KLS', indukId: d.id })
const k1 = tambahWilayah(db, { tingkat: 'kelompok', nama: 'Klasaman 1', kode: 'K1', indukId: ds.id })
const hasil = imporGenerusCsv(db, teksCsv) // { berhasil, generusIds, gagal: [{ baris, alasan }] }
tambahPengajian(db, { wilayahId: k1.id, nama: 'Caberawit', hari: 0, jam: '16:00' })
```

### 3. Terbit token & aktivasi

```ts
// HP (pertama kali):
const hp = await bukaDb()
const { kodePerangkat } = await inisialisasiPerangkat(hp, 'HP Ust. Hasan') // tampilkan sebagai QR/teks
// Admin:
const token = terbitkanToken(db, kunci, { kodePerangkat, role: 'mubaligh', nama: 'Ust. Hasan', wilayahId: k1.id })
// HP:
const profil = await aktifkanProfil(hp, token, { pin: '1234' /* opsional */ })
// Mubaligh menerbitkan token generus/wali untuk HP lain (setelah paket pertama diterapkan):
const tg = terbitkanTokenGenerus(hp, profil.id, { kodePerangkat: kodeHpGenerus, role: 'generus', generusIds: [gid], nama: 'Ahmad' })
// HP generus multi-profil: aktifkanProfil berulang; pilihProfil(hp, id, pin?)
```

### 4. Setor (HP → admin) & impor

```ts
const setor = buatSetor(hp) // kumulatif: semua yang belum dikonfirmasi admin
const ringkasan = imporSetor(db, setor.bytes, kunci, setor.nama)
// { pengirim, perTabel, total, usulanBaru, tokenDilaporkan, ditolak: [{ tabel, id, alasan }], sudahPernah }
const banyak = imporBanyak(db, berkasDipilih /* [{ nama, bytes }] */, kunci)
jumlahBelumDisetor(hp) // untuk indikator "Ada N data belum disetor"
```

### 5. Paket (admin → HP)

```ts
const paket = buatPaket(db, k1.id, kunci) // { nama, bytes, versi, penerima }
// di HP pengurus/mubaligh (satu berkas untuk semua penerima wilayah itu):
const r = terapkanPaket(hp, paket.bytes) // PAKET_LAMA bila versi ≤ terpasang; BUKAN_PENERIMA bila HP dicabut
// atau, dari intent "Buka dengan PPG Sorong":
bukaBerkasApaSaja(hp, bytes)
```

### 6. Belajar → sahkan → balasan

```ts
// HP generus:
catatKemajuan(hpG, profilId, { materiId, status: 'selesai', nilai: 90 })
const belajar = buatBelajar(hpG) // satu berkas untuk semua profil generus di HP ini
// HP mubaligh:
imporBelajar(hp, belajar.bytes) // atau imporBanyak(hp, [...])
for (const k of daftarDiajukan(hp, k1.id)) sahkan(hp, k.id, { keputusan: 'disahkan', catatan: 'Lancar' })
simakLangsung(hp, { generusId, materiId, status: 'selesai' }) // generus tanpa HP
const bal = buatBalasan(hp, perangkatGenerusId) // daftarPenerimaBalasan(hp) untuk memilih
// HP generus/wali:
terapkanBalasan(hpG, bal.bytes) // perbarui status, kunci, beku/cair profil
```

### 7. Jadwal tambahan

```ts
tambahJadwalTambahan(hp, { kelompokId: k1.id, tanggal: '2026-11-04', jam: '19:00', judul: 'Muroja’ah' })
const j = buatJadwal(hp) // bagikan ke grup WA kelompok
terapkanJadwal(hpAnggota, j.bytes)
```

### 8. Materi

```ts
aturLampiranMateri(db, materiId, { nama: 'tajwid.pdf', bytes: pdfBytes }) // maks 5 MB
const m = buatMateri(db, kunci) // PPG_MATERI_v<n>.ppg, tanpa enkripsi, bertanda tangan admin
terapkanMateri(hp, m.bytes)
daftarMateri(hp, { kategoriGenerus: 'caberawit' }) // urut bidang → kategori → nomor
targetMateriBerikutnya(hp, generusId) // maks 3
```

### 9. Laporan

```ts
const lap = laporanPekanan(hpWali, generusId, tanggalHariIni()) // { mondok: true } bila sedang mondok
const teks = teksWaLaporanPekanan(lap!)
const url = tautanWa(generus.wali_no_hp!, teks) // https://wa.me/62…?text=…
rekapPresensi(db, { wilayahId: ds.id, mulai: '2026-11-01', selesai: '2026-11-30' }) // perGenerus (per periode keanggotaan) & perKelompok
rekapKemajuan(db, { wilayahId: ds.id }) // per generus, per bidang
```

### 10. Siklus hidup

```ts
ubahStatus(db, generusId, 'mondok', '2026-11-08', 'Pondok') // token generus dibekukan (via PAKET → BALASAN)
ubahStatus(db, generusId, 'aktif', '2026-12-01')
pindahKelompok(db, generusId, k2.id, '2026-11-20')
setujuiUsulan(db, usulanId) / tolakUsulan(db, usulanId, 'alasan')
// serah terima mubaligh:
const akhir = setorAkhir(hpMubalighLama); imporSetor(db, akhir.bytes, kunci)
statusSetorAkhir(db, perangkatLamaId) // { lengkap }
serahTerimaMubaligh(db, kunci, { kelompokId: k1.id, perangkatLamaId }) // cabut + kunci kelompok baru
```

## Pengujian

```bash
npm test               # vitest (semua workspace)
npm run coverage -w @ppg/core
npm run typecheck
```

`test/skenario-lengkap.test.ts` menjalankan skenario §13 dengan satu database per aktor.
