# @ppg/core

Seluruh logika bisnis PPG Sorong v2/v3 (offline-first) tanpa UI: kriptografi, token & rantai kepercayaan berjenjang, berkas `.ppg`,
database sql.js, penggabungan data, alur sinkron via WA (kelompok → desa → daerah), kurikulum & pertemuan, siklus hidup generus/mubaligh, laporan.
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
| token | `buatKodePerangkat`, `bacaKodePerangkat`, `tandaTanganiToken`, `uraiToken`, `periksaToken`, `statusPencabutan`, `bukaRahasiaToken`, `tandaTanganiKunciSetor`, `kunciSetorSah`, tipe `PayloadToken`, `RahasiaToken`, `Role`, `Hak` |
| berkas | `kemasBerkas`, `bacaBerkas`, `bacaHeader`, `periksaBerkas`, `kompresJson`, `dekompresJson`, `slug`, tipe `HeaderBerkas`, `BerkasKeluar` |
| gabung | `gabungRekaman`, `gabungSemua` |
| qr-seri (Fase 4) | `pecahQr(teks, {maks?})`, `uraiBagianQr`, `susunQr(daftar)`, `pengumpulQrBaru`, `tambahBagianQr(pengumpul, teks)`, `AWALAN_QR_SERI`, `MAKS_BAGIAN_QR` |
| cadangan-hp (Fase 4) | `buatCadanganHp(db, sandi)`, `bukaCadanganHp(bytes, sandi)`, `enkripsiCadanganHp`, `jenisCadanganHp`, `PANJANG_SANDI_CADANGAN_MIN` |
| admin | `inisialisasiAdmin`, `bukaKunciAdmin`, `gantiSandiAdmin`, `eksporCadanganKunci`, `imporCadanganKunci`, `terbitkanToken`, `cabutPerangkat`, `bekukanPerangkat`, `cairkanPerangkat`, `gantiKunciKelompok` (ikut mengganti kunci umum), `gantiKunciUmumKelompok`, `daftarKunciSetor`, `kunciUmumKelompok`, `kunciUmumKelompokVersi`, `setujuiUsulan`, `tolakUsulan`, `imporGenerusCsv`, `kelompokBerpenerima` |
| perangkat (HP) | `inisialisasiPerangkat`, `kodePerangkatSaya`, `ambilIdentitas`, `aktifkanProfil`, `daftarProfil`, `ambilProfil`, `profilAktif`, `pilihProfil`, `aturPin`, `hapusProfil`, `terbitkanTokenGenerus`, `statusProfil` |
| siklus | `pindahKelompok`, `ubahStatus`, `serahTerimaMubaligh`, `statusSetorAkhir`, `setorAkhir`, `tokenMilikGenerusSaja` |
| sinkron | `buatSetor(db, {setorAkhir?, semua?})`, `imporSetor`, `jumlahBelumDisetor`, `buatPaket`, `terapkanPaket`, `versiPaketTerpasang`, `buatBelajar`, `imporBelajar`, `jumlahBelumDisetorBelajar(db, kelompokId?)`, `konfirmasiBelajar`, `daftarDiajukan`, `sahkan`, `simakLangsung`, `buatBalasan`, `terapkanBalasan`, `daftarPenerimaBalasan`, `buatJadwal`, `terapkanJadwal`, `buatMateri`, `terapkanMateri`, `bukaBerkasApaSaja`, `imporBanyak`, `daftarRiwayatImpor`, `berkasLebihBaru` |
| kueri (layar UI) | `ringkasanBerandaAdmin`, `ringkasanKelompok`, `infoSinkronHp`, `pohonWilayah`, `cariGenerus`, `generusProfil`, `daftarPerangkatRinci`, `statusPerangkat`, `daftarDiajukanRinci`, `materiGenerus`, `jadwalPekan`, `namaHari`, `lembarPresensi`, `laporanWaKelompok` — lihat §11 di bawah |
| laporan | `laporanPekanan`, `teksWaLaporanPekanan`, `tautanWa`, `normalNoHp`, `rekapPresensi`, `rekapKemajuan` |
| **instalasi (v3)** | `inisialisasiExe(db, {sandi, label})`, `bukaKunciExe`, `kunciExeTerbuka`, `kunciExeWajib`, `kunciExe` (kunci dari memori), `gantiSandiExe`, `aktifkanExe(db, kunci, token)`, `profilExe`, `infoInstalasi`, `terbitkanTokenBawah` (EXE desa), `kelompokSaya`, `simpanKunciTitipan`/`ambilKunciTitipan`, tipe `KunciExe`, `KunciPemegang` (= `KunciAdmin \| KunciExe`), `adalahKunciExe`; repo: `peranInstalasi`, `adalahExe` |
| **rantai (v3)** | `periksaTokenDb(db, token, {denganDikenal?})`, `opsiPeriksaDb`, `wilayahMencakupDb`, `idRantaiPenerbit`, `wilayahRantaiPenerbit`; token: `rantaiPenerbit`, `hakBawaan`, `HAK_DARI_DESA`, `ROLE_EXE`, opsi `wilayahMencakup` |
| **kurikulum & jadwal (v3)** | `tetapkanTarget`, `daftarTarget`, `idTarget`, `periodeAktif`, `aturPeriodeAktif`, `periodeDariTanggal`, `periodeSah`, `aturJadwalSetor`, `hapusJadwalSetor`, `jadwalSetorUntuk`, `daftarJadwalSetor`, `pastikanPengelolaKurikulum`; sinkron: `buatKurikulum`, `imporKurikulum`, `jumlahSuntinganKurikulum` |
| **pertemuan (v3)** | `bukaPertemuan`, `aturMateriPertemuan`, `ambilPertemuan`, `daftarPertemuan`, `absenPertemuan`, `tandaiTuntas`; pengajian: `kategoriGenerus` (kelas), `kategoriKelas` |
| **kueri v3** | `materiPerluDituntaskan`, `saranMateriPertemuan`, `lembarAbsenPertemuan`, `progresKelas`, `pertemuanBerikutnya`, `statusSetor`, `hitungTenggat`, `pengingatSetor`, `ringkasanBerandaExe`, `rekapCapaian` (Fase 6: % tuntas target per kelas/kelompok/desa/generus); sinkron: `tujuanSetor`, `jumlahBelumSampaiDaerah`; `infoSinkronHp().belumSampaiDaerah` |
| kurikulum | `seedKurikulum`, `targetMateriBerikutnya`, `PEMETAAN_MATERI`, `idMateri` |
| repo master (admin) | wilayah: `tambahWilayah`, `ubahWilayah`, `hapusWilayah`, `daftarWilayah`, `turunanWilayah`, `leluhurWilayah`, `kelompokDalamWilayah`; generus/jamaah: `tambahGenerus`, `ubahGenerus`, `daftarGenerus`, `ambilGenerus`, `tambahJamaah`, `ubahJamaah`, `daftarJamaah`, `kategoriDariUmur`; pengajian: `tambahPengajian`, `ubahPengajian`, `hapusPengajian`, `daftarPengajian`, `pengajianUntukKelompok`; materi: `tambahBidang`, `tambahKategori`, `tambahMateri`, `ubahMateri`, `aturLampiranMateri`, `daftarBidang`, `daftarKategoriMateri`, `daftarMateri`, `ambilMateri`; koreksi: `buatKoreksi`, `daftarKoreksi` |
| repo kegiatan (HP/admin) | `catatPresensi`, `catatPresensiMassal`, `daftarPresensi`; `catatKemajuan`, `daftarKemajuan`; `catatPenilaianAkhlaq`, `daftarPenilaianAkhlaq`, `ASPEK_AKHLAQ`; `tambahJadwalTambahan`, `ubahJadwalTambahan`, `batalkanJadwalTambahan`, `daftarJadwalTambahan`; `ajukanUsulan`, `daftarUsulan`; `daftarPerangkat`, `daftarPencabutan` |

v3: `imporSetor(db, bytes, kunci)` dan `buatPaket(db, wilayahId, kunci)` menerima `KunciAdmin` (EXE daerah) **atau** `KunciExe`
(EXE desa/kelompok); `imporBanyak(db, daftar, kunci?)` di EXE daerah juga mengimpor berkas `KURIKULUM`. Role token bertambah
`admin` (EXE desa/kelompok) dan `kurikulum`; hak bertambah `terbit_bawah`.

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

### 11. Kueri untuk layar UI (tanpa SQL di aplikasi)

| Layar | Fungsi |
|---|---|
| EXE Beranda | `ringkasanBerandaAdmin(db, { hariTerlambat? })` → jumlah generus aktif/mondok, token aktif per role, usulan menunggu, `setoranPerKelompok[]` (`terakhir_setor`, `hari_sejak`, `terlambat` bila > 14 hari / belum pernah) |
| EXE Wilayah | `pohonWilayah(db)` → daerah → desa → kelompok (`anak[]`) |
| EXE Generus · APK Generus (mubaligh) | `cariGenerus(db, { wilayahId?, kelompokId?, kategori?, status?, cari? })` → generus + `kelompok_nama` |
| EXE Perangkat & Token | `daftarPerangkatRinci(db, { wilayahId?, role?, status? })` → token + `status` (`aktif`/`dibekukan`/`dicabut`/`kedaluwarsa`) + `wilayah_nama`; `statusPerangkat(p)` |
| APK indikator setor | `infoSinkronHp(db)` → `belumDisetor`, `belumDisetorBelajar`, `terakhirSetor/Belajar/Paket/Balasan`, `hariSejakSetor`, `perluPengingat` (> 7 hari); untuk profil generus di HP bersama: `hariSejakBelajar`, `perluPengingatBelajar` |
| APK Beranda mubaligh/pengurus | `ringkasanKelompok(db, kelompokId)` |
| APK Setoran Generus | `daftarDiajukanRinci(db, kelompokId)` → kemajuan diajukan + `generus_nama`, `materi_nama`, `materi_tipe`, `kategori_nama`, `bidang_nama` |
| APK Materiku · Kemajuan wali | `materiGenerus(db, generusId)` → `bidang[].kategori[].materi[]` dengan `status` (`belum`/`diajukan`/`ditolak`/`sedang`/`selesai`), `kemajuan`, `target`, `ada_lampiran`; `ringkasan` |
| APK Jadwal | `jadwalPekan(db, kelompokId, tanggalAcuan?)` → acara Ahad–Sabtu (rutin + tambahan, `dibatalkan`) |
| APK/EXE Presensi | `lembarPresensi(db, { kelompokId, tanggal, pengajianId?, jadwalTambahanId? })` → generus aktif & anggota pada tanggal itu + status tercatat |
| APK Laporan Pekanan + WA | `laporanWaKelompok(db, kelompokId, tanggal?)` → `laporan`, `teks`, `tautan` wa.me (null bila nomor wali kosong) |
| APK Wali | `generusProfil(db, profilId)` lalu `laporanPekanan` / `materiGenerus` per anak |

Lainnya sudah tersedia: `daftarUsulan`, `daftarKoreksi`, `daftarRiwayatImpor`, `daftarPenerimaBalasan`, `daftarProfil`, `daftarPengajian`, `daftarMateri`, `rekapPresensi`, `rekapKemajuan`, `kelompokBerpenerima`.

### 12. Alur berjenjang v3 (kelompok → desa → daerah)

Satu aplikasi EXE untuk semua tingkat; perannya ditentukan kode aktivasi. EXE daerah = admin lama (`KunciAdmin`).
EXE desa/kelompok/kurikulum memakai `KunciExe` (kunci perangkat dienkripsi kata sandi lokal; buka dengan `bukaKunciExe`
setiap kali aplikasi dibuka — tanpa itu fungsi yang menandatangani melempar `EXE_TERKUNCI`).

```ts
// --- EXE desa (pengaturan awal "Aktifkan dengan kode") ---
const dbDesa = await bukaDb()
const { kodePerangkat, kunci: kDesa } = await inisialisasiExe(dbDesa, { sandi: 'sandi-desa-1', label: 'EXE Desa Klasaman' })
// daerah:
aturJadwalSetor(dbDaerah, { tingkatAsal: 'kelompok', pola: 'pekanan', hari: 0, jam: '21:00' }) // kelompok→desa tiap Ahad
aturJadwalSetor(dbDaerah, { tingkatAsal: 'desa', pola: 'bulanan', tanggal: 5, jam: '12:00' })  // desa→daerah tiap tgl 5
const tokDesa = terbitkanToken(dbDaerah, kunciDaerah, { kodePerangkat, role: 'admin', nama: 'Admin Desa', wilayahId: desa.id })
const tokKur = terbitkanToken(dbDaerah, kunciDaerah, { kodePerangkat: kodeKur, role: 'kurikulum', nama: 'Tim Kurikulum', wilayahId: daerah.id })
// EXE desa:
await aktifkanExe(dbDesa, kDesa, tokDesa)                          // peranInstalasi(dbDesa) === 'desa'
// sesi berikutnya: const kDesa = await bukaKunciExe(dbDesa, 'sandi-desa-1')

// --- kurikulum (EXE kurikulum) → daerah ---
terapkanMateri(dbKur, berkasMateriDaerah)                          // materi dasar dari daerah
aturPeriodeAktif(dbKur, '2026-S1')                                 // S1 = Jul–Des, S2 = Jan–Jun (tahun ajaran)
tetapkanTarget(dbKur, { periode: '2026-S1', kategoriGenerus: 'caberawit', materiIds })
imporKurikulum(dbDaerah, buatKurikulum(dbKur).bytes, kunciDaerah) // atau imporBanyak(dbDaerah, [...], kunciDaerah)
const materi = buatMateri(dbDaerah, kunciDaerah)                   // MATERI kini membawa target & periode aktif

// --- turun: daerah → desa → HP/EXE kelompok ---
terapkanPaket(dbDesa, buatPaket(dbDaerah, desa.id, kunciDaerah).bytes) // + kunci kelompok titipan untuk desa
terapkanMateri(dbDesa, materi.bytes)                               // MATERI daerah diteruskan apa adanya ke bawah
const tokM = terbitkanTokenBawah(dbDesa, kDesa, { kodePerangkat: kodeHp, role: 'mubaligh', nama: 'Ust. Ahmad', wilayahId: k1.id })
const tokK2 = terbitkanTokenBawah(dbDesa, kDesa, { kodePerangkat: kodeExeK2, role: 'admin', nama: 'Admin K2', wilayahId: k2.id })
terapkanPaket(hpMubaligh, buatPaket(dbDesa, k1.id, kDesa).bytes)    // ditandatangani EXE desa, diverifikasi lewat rantai
// DI_LUAR_WILAYAH bila wilayahId di luar desa; EXE kelompok tidak berhak menerbitkan token.

// --- pertemuan & absen (HP mubaligh / EXE kelompok) ---
tambahPengajian(dbDaerah, { wilayahId: k1.id, nama: 'Kelas Caberawit', hari: 1, jam: '19:00', kategoriGenerus: ['caberawit'] })
const saran = saranMateriPertemuan(hp, k1.id, undefined, { pengajianId })  // materi target yang paling banyak belum tuntas
const p = bukaPertemuan(hp, { kelompokId: k1.id, tanggal: '2026-11-16', pengajianId, materiIds: [saran[0]!.materi_id] })
lembarAbsenPertemuan(hp, p.id)                                     // generus aktif sesuai kelas + status tuntas per materi
absenPertemuan(hp, p.id, [{ generusId: ali, status: 'hadir', tuntas: [saran[0]!.materi_id] }, { generusId: budi, status: 'alpa' }])
progresKelas(hp, k1.id, 'caberawit')                               // capaian tiap generus
// HP generus/wali (setelah MATERI + BALASAN):
materiPerluDituntaskan(hpGenerus, ali)                             // { total, tuntas, persen, perluDituntaskan[], pertemuanBerikutnya }

// --- naik: HP → EXE kelompok/desa → daerah (SETOR gabungan) ---
const s = buatSetor(hp)                    // tujuan = atas_box_pub token (header.penerima_perangkat_id); token lama → daerah
imporSetor(dbDesa, s.bytes, kDesa)         // atau bukaBerkasApaSaja(dbDesa, bytes) / imporBanyak(dbDesa, [...])
imporSetor(dbDaerah, buatSetor(dbDesa).bytes, kunciDaerah) // rekaman asli + token, konfirmasi & pencabutan di bawahnya
// konfirmasi bertahap: paket daerah → desa → HP membawa `konfirmasi` (diterima tingkat atas) dan `konfirmasi_daerah`
infoSinkronHp(hp)                          // { belumDisetor, belumSampaiDaerah, ... }

// --- status setor & beranda ---
statusSetor(dbDaerah, daerah.id)           // per desa: tenggatBerikutnya, terakhirSetor, terlambat
statusSetor(dbDesa, desa.id)               // per kelompok
pengingatSetor(hp)                         // { tujuan: { nama: 'Desa Klasaman' }, tenggatBerikutnya, terlambat, tampilkanTombol }
ringkasanBerandaExe(db)                    // sesuai peran: daerah / desa / kelompok / kurikulum

// --- pencabutan berantai ---
cabutPerangkat(dbDaerah, tokenId)          // daerah bisa mencabut semua perangkat (juga terbitan desa)
terapkanPaket(dbDesa, buatPaket(dbDaerah, desa.id, kunciDaerah).bytes)
terapkanBalasan(hpGenerus, buatBalasan(dbDesa, hpGenerusId).bytes) // EXE desa/kelompok boleh mengirim BALASAN
cabutPerangkat(dbDesa, tokenId)            // EXE desa: hanya token yang rantai penerbitnya melewati EXE itu
```

Aturan rantai (`periksaToken`): token akar ditandatangani daerah (pengurus, mubaligh, `admin` desa/kelompok, `kurikulum`);
EXE desa ber-hak `terbit_bawah` menandatangani pengurus/mubaligh/EXE kelompok di wilayahnya (`wilayahMencakup`); mubaligh
menandatangani generus/wali. Di tiap mata rantai: tanda tangan, masa berlaku, wilayah ⊆ penerbit, penerbit tidak dicabut
sebelum anak terbit (bila sudah dicabut, anak wajib terdaftar — `denganDikenal`). HP yang belum punya pohon wilayah
melewati pemeriksaan wilayah; EXE desa & daerah selalu memeriksanya.

### Catatan Fase 3

- PAKET membawa seluruh pohon wilayah (nama & kode) agar HP bisa memilih kelompok tujuan usulan pindah (`daftarWilayah(db, { tingkat: 'kelompok' })`). Data generus/kegiatan tetap per wilayah paket (T32).

### Catatan Fase 4

**QR berseri** — token generus/wali (±3,7 KB) tidak muat satu QR yang mudah dipindai. `pecahQr` memecah teks > 800 karakter
menjadi bagian `PPGQ1|<id>|<ke>/<dari>|<potongan>` (QR versi ≤ 20); teks pendek dikembalikan apa adanya (satu QR).
Pemindai menyimpan `PengumpulQr` dan memanggil `tambahBagianQr` untuk setiap hasil pindai → `status`: `tunggal` | `bagian`
(tampilkan `terbaca` dari `total`) | `lengkap` (`hasil` = teks utuh) | `bukan`. Bagian dari seri lain (id beda) memulai ulang.

```ts
const bagian = pecahQr(token)            // tampilkan bergantian tiap 1,5 detik
let p = pengumpulQrBaru()
const r = tambahBagianQr(p, hasilPindai) // r.pengumpul → simpan; r.status === 'lengkap' → aktifkanProfil(db, r.hasil!)
susunQr(daftarBagian)                    // susun sekaligus (urutan bebas)
```

**Cadangan HP terenkripsi** — `.ppgdb` = `"PPGCB1" | garam 16 | iterasi u32 | secretbox(PBKDF2-SHA256(sandi), gzip(db))`.
Sandi minimal 6 karakter (`SANDI_LEMAH`), sandi salah/berkas rusak → `SANDI_SALAH`, berkas lain → `BUKAN_CADANGAN`.
Cadangan polos lama (sebelum Fase 4) masih bisa dipulihkan (`jenisCadanganHp` → `'lama'`).

```ts
const c = await buatCadanganHp(db, 'sandi-keluarga') // { nama: PPG_CADANGAN_HP_YYYYMMDD.ppgdb, bytes }
const dbBytes = await bukaCadanganHp(c.bytes, 'sandi-keluarga')
```

### Catatan keamanan (Fase 1b)

- Kunci setor kelompok bertanda tangan admin (`tt`); HP generus/wali mengabaikan kunci tanpa tanda tangan sah.
- `gantiKunciKelompok`/`serahTerimaMubaligh` juga mengganti **kunci umum kelompok** (JADWAL). Kunci baru tiba ke pengurus/mubaligh lewat PAKET dan ke generus/wali lewat BALASAN mubaligh baru — kirim BALASAN ke semua HP segera setelah serah terima.
- BALASAN/JADWAL membawa pencabutan token mubaligh kelompok, sehingga berkas mubaligh lama ditolak.
- Setelah admin memulihkan database dari cadangan: PAKET/MATERI baru tetap diterima (cap waktu lebih baru); minta HP mengirim `buatSetor(db, { semua: true })` agar data yang hilang di admin terisi lagi.

## Pengujian

```bash
npm test               # vitest (semua workspace)
npm run coverage -w @ppg/core
npm run typecheck
```

`test/skenario-lengkap.test.ts` menjalankan skenario §13 dengan satu database per aktor. `test/skenario-berjenjang.test.ts` (v3)
menjalankan skenario §14 (daerah → EXE desa/kelompok/kurikulum → HP mubaligh/generus/wali → setor gabungan → status terlambat →
pencabutan berantai → migrasi database v2 dari fixtur `test/fixtur/v2-*.gz` yang dibuat kode v2). `test/berjenjang.test.ts` menguji unit v3. `test/ujung-ke-ujung.test.ts` (Fase 4)
menjalankan satu siklus admin → pengurus/mubaligh → generus → wali → admin dengan berkas yang ditulis ke disk lalu dibaca ulang
(meniru WA), database tiap aplikasi disimpan/dibuka ulang, token lewat QR berseri, dan cadangan HP terenkripsi. `test/pemeriksaan.test.ts` berisi reproduksi cacat Fase 1b; `test/kueri.test.ts` menguji kueri UI dan memastikan `src/` tidak mengimpor modul bawaan Node.
