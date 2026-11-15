// Skenario lengkap v3 (§14): pelaporan berjenjang kelompok → desa → daerah, EXE per tingkat, kurikulum, pertemuan.
// Satu database per aktor; berkas berpindah sebagai byte (meniru kiriman WA).
import { gunzipSync } from 'fflate'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  absenPertemuan,
  aktifkanExe,
  aktifkanProfil,
  aturJadwalSetor,
  aturPeriodeAktif,
  bukaDb,
  bukaKunciAdmin,
  bukaKunciExe,
  bukaPertemuan,
  buatBalasan,
  buatKurikulum,
  buatMateri,
  buatPaket,
  buatSetor,
  bukaBerkasApaSaja,
  cabutPerangkat,
  daftarKemajuan,
  daftarMateri,
  daftarPerangkat,
  daftarPertemuan,
  daftarPresensi,
  daftarTarget,
  dariUtf8,
  imporBanyak,
  imporKurikulum,
  imporSetor,
  infoSinkronHp,
  inisialisasiExe,
  jumlahBelumDisetor,
  jumlahBelumSampaiDaerah,
  keB64url,
  lembarAbsenPertemuan,
  materiPerluDituntaskan,
  migrasi,
  peranInstalasi,
  periksaToken,
  periksaTokenDb,
  pengingatSetor,
  progresKelas,
  ringkasanBerandaExe,
  saranMateriPertemuan,
  simpanDb,
  statusSetor,
  tambahGenerus,
  tambahPengajian,
  tambahWilayah,
  tandaTanganiToken,
  terapkanBalasan,
  terapkanMateri,
  terapkanPaket,
  terbitkanToken,
  terbitkanTokenBawah,
  terbitkanTokenGenerus,
  tetapkanTarget,
  uraiToken,
  VERSI_SKEMA,
  wilayahMencakupDb,
  type Db,
  type Generus,
  type KunciAdmin,
  type KunciExe,
  type Profil,
  type Wilayah,
} from '../src/index'
import { buatAdmin, buatHp, keTanggal, lepasJam, maju, pasangJam, SANDI } from './bantu'

const SANDI_EXE = 'sandi-exe-desa-1'

interface Exe {
  db: Db
  kunci: KunciExe
  kode: string
  id: string
  token?: string
}

async function buatExe(label: string): Promise<Exe> {
  const db = await bukaDb()
  const { kodePerangkat, kunci } = await inisialisasiExe(db, { sandi: SANDI_EXE, label })
  return { db, kunci, kode: kodePerangkat, id: kunci.perangkatId }
}

// ----- aktor -----
let daerah: { db: Db; kunci: KunciAdmin }
let exeA: Exe // EXE desa A
let exeB: Exe // EXE desa B
let exeA2: Exe // EXE kelompok A2
let exeKur: Exe // EXE kurikulum
let hpM: { db: Db; kode: string; id: string } // HP mubaligh A1
let hpG: { db: Db; kode: string; id: string } // HP generus Ali
let hpW: { db: Db; kode: string; id: string } // HP wali Ali

// ----- data -----
let D: Wilayah, desaA: Wilayah, desaB: Wilayah, A1: Wilayah, A2: Wilayah, B1: Wilayah
let ali: Generus, budi: Generus, citra: Generus, dodi: Generus
let kelasA1: string, kelasA2: string
let target: string[]
let materiBytes: Uint8Array
let profilM: Profil
let tokenM: string

beforeAll(() => pasangJam('2026-11-16T01:00:00.000Z'))
afterAll(() => lepasJam())

describe('Skenario berjenjang v3 (§14)', () => {
  it('1. daerah init: wilayah, generus, kelas, jadwal setor', async () => {
    daerah = await buatAdmin()
    expect(peranInstalasi(daerah.db)).toBe('daerah')
    D = tambahWilayah(daerah.db, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
    desaA = tambahWilayah(daerah.db, { tingkat: 'desa', nama: 'Klasaman', kode: 'KLS', indukId: D.id })
    desaB = tambahWilayah(daerah.db, { tingkat: 'desa', nama: 'Malanu', kode: 'MLN', indukId: D.id })
    A1 = tambahWilayah(daerah.db, { tingkat: 'kelompok', nama: 'Klasaman 1', kode: 'A1', indukId: desaA.id })
    A2 = tambahWilayah(daerah.db, { tingkat: 'kelompok', nama: 'Klasaman 2', kode: 'A2', indukId: desaA.id })
    B1 = tambahWilayah(daerah.db, { tingkat: 'kelompok', nama: 'Malanu 1', kode: 'B1', indukId: desaB.id })
    const g = (kelompokId: string, nama: string, kategori: 'caberawit' | 'praremaja') =>
      tambahGenerus(daerah.db, { kelompokId, nama, jenisKelamin: 'L', kategori, mulai: '2026-10-01', waliNoHp: '081234' })
    ali = g(A1.id, 'Ali', 'caberawit')
    budi = g(A1.id, 'Budi', 'caberawit')
    citra = g(A1.id, 'Citra', 'praremaja')
    dodi = g(A2.id, 'Dodi', 'caberawit')
    g(B1.id, 'Eka', 'caberawit')
    kelasA1 = tambahPengajian(daerah.db, { wilayahId: A1.id, nama: 'Kelas Caberawit', hari: 1, jam: '19:00', kategoriGenerus: ['caberawit'] }).id
    kelasA2 = tambahPengajian(daerah.db, { wilayahId: A2.id, nama: 'Kelas Caberawit', hari: 1, jam: '19:00', kategoriGenerus: ['caberawit'] }).id
    aturJadwalSetor(daerah.db, { tingkatAsal: 'kelompok', pola: 'pekanan', hari: 0, jam: '21:00' })
    aturJadwalSetor(daerah.db, { tingkatAsal: 'desa', pola: 'bulanan', tanggal: 5, jam: '12:00' })
  })

  it('2. daerah mengaktifkan EXE desa A & B dan EXE kurikulum (kata sandi lokal melindungi kunci)', async () => {
    exeA = await buatExe('EXE Desa Klasaman')
    exeB = await buatExe('EXE Desa Malanu')
    exeKur = await buatExe('EXE Kurikulum')
    exeA.token = terbitkanToken(daerah.db, daerah.kunci, { kodePerangkat: exeA.kode, role: 'admin', nama: 'Admin Desa Klasaman', wilayahId: desaA.id })
    exeB.token = terbitkanToken(daerah.db, daerah.kunci, { kodePerangkat: exeB.kode, role: 'admin', nama: 'Admin Desa Malanu', wilayahId: desaB.id })
    exeKur.token = terbitkanToken(daerah.db, daerah.kunci, { kodePerangkat: exeKur.kode, role: 'kurikulum', nama: 'Tim Kurikulum', wilayahId: D.id })
    expect(uraiToken(exeA.token).payload.hak).toEqual(['catat', 'lihat', 'terbit_bawah'])
    // kode EXE tidak bisa dipakai di HP
    const hpX = await buatHp('HP X')
    await expect(aktifkanProfil(hpX.db, exeA.token)).rejects.toMatchObject({ kode: 'TOKEN_UNTUK_EXE' })
    for (const e of [exeA, exeB, exeKur]) await aktifkanExe(e.db, e.kunci, e.token!)
    expect(peranInstalasi(exeA.db)).toBe('desa')
    expect(peranInstalasi(exeKur.db)).toBe('kurikulum')
    // kunci perangkat EXE terenkripsi: buka ulang perlu sandi
    const salinan = await bukaDb(simpanDb(exeA.db))
    expect(() => buatSetor(salinan)).toThrow(/terkunci/)
    await expect(bukaKunciExe(salinan, 'salah-sandi-1')).rejects.toMatchObject({ kode: 'SANDI_SALAH' })
    const k = await bukaKunciExe(salinan, SANDI_EXE)
    expect(keB64url(k.tandaTangan.publik)).toBe(keB64url(exeA.kunci.tandaTangan.publik))
    expect(Buffer.from(simpanDb(exeA.db)).toString('latin1')).not.toContain(keB64url(exeA.kunci.tandaTangan.rahasia))
  })

  it('3. kurikulum menetapkan target S1 → berkas KURIKULUM → daerah mengimpor', () => {
    terapkanMateri(exeKur.db, buatMateri(daerah.db, daerah.kunci).bytes)
    target = daftarMateri(exeKur.db, { kategoriGenerus: 'caberawit' })
      .slice(0, 3)
      .map((m) => m.id)
    aturPeriodeAktif(exeKur.db, '2026-S1')
    tetapkanTarget(exeKur.db, { periode: '2026-S1', kategoriGenerus: 'caberawit', materiIds: target })
    expect(ringkasanBerandaExe(exeKur.db).kurikulum).toMatchObject({ periode: '2026-S1', jumlahTarget: 3, suntinganBelumDikirim: 4 })
    const k = buatKurikulum(exeKur.db)
    expect(ringkasanBerandaExe(exeKur.db).kurikulum!.suntinganBelumDikirim).toBe(0)
    const r = imporKurikulum(daerah.db, k.bytes, daerah.kunci)
    expect(r.total.ditambah).toBe(4)
    expect(imporBanyak(daerah.db, [k.bytes], daerah.kunci)[0]!.ringkasan).toMatchObject({ sudahPernah: true })
    expect(daftarTarget(daerah.db).map((t) => t.id)).toEqual(target)
    // EXE desa tidak mengelola kurikulum
    expect(() => tetapkanTarget(exeA.db, { periode: '2026-S1', kategoriGenerus: 'caberawit', materiIds: target })).toThrow(/kurikulum/i)
  })

  it('4. daerah mengirim paket ke desa (+ kunci kelompok titipan) dan MATERI (+ target)', () => {
    materiBytes = buatMateri(daerah.db, daerah.kunci).bytes
    for (const [e, w] of [[exeA, desaA], [exeB, desaB]] as const) {
      const r = terapkanPaket(e.db, buatPaket(daerah.db, w.id, daerah.kunci).bytes)
      expect(r.perTabel.generus?.ditambah).toBeGreaterThan(0)
      terapkanMateri(e.db, materiBytes)
    }
    expect(daftarTarget(exeA.db)).toHaveLength(3)
    // desa B tidak bisa membuka paket desa A
    expect(() => terapkanPaket(exeB.db, buatPaket(daerah.db, desaA.id, daerah.kunci).bytes)).toThrow(/bukan untuk EXE ini/)
  })

  it('5. desa A mengaktifkan HP mubaligh A1 dan EXE kelompok A2; paket desa → bawahnya', async () => {
    hpM = await buatHp('HP Ust. Ahmad')
    tokenM = terbitkanTokenBawah(exeA.db, exeA.kunci, { kodePerangkat: hpM.kode, role: 'mubaligh', nama: 'Ust. Ahmad', wilayahId: A1.id })
    const pm = uraiToken(tokenM).payload
    expect(pm.atas_perangkat_id).toBe(exeA.id)
    expect(uraiToken(pm.penerbit!).payload.role).toBe('admin')
    profilM = await aktifkanProfil(hpM.db, tokenM)
    expect(profilM.rahasia.kunci_kelompok_setor?.[0]?.rahasia).toBeTruthy()
    exeA2 = await buatExe('EXE Kelompok Klasaman 2')
    exeA2.token = terbitkanTokenBawah(exeA.db, exeA.kunci, { kodePerangkat: exeA2.kode, role: 'admin', nama: 'Admin Klasaman 2', wilayahId: A2.id })
    expect(uraiToken(exeA2.token).payload.hak).toEqual(['catat', 'lihat', 'sahkan'])
    await aktifkanExe(exeA2.db, exeA2.kunci, exeA2.token)
    expect(peranInstalasi(exeA2.db)).toBe('kelompok')
    // paket desa (ditandatangani EXE desa, diverifikasi lewat rantai sampai daerah)
    const pA1 = buatPaket(exeA.db, A1.id, exeA.kunci)
    expect(pA1.header.pengirim_perangkat_id).toBe(exeA.id)
    terapkanPaket(hpM.db, pA1.bytes)
    expect(() => terapkanPaket(hpM.db, pA1.bytes)).toThrow(/tidak lebih baru/)
    bukaBerkasApaSaja(exeA2.db, buatPaket(exeA.db, A2.id, exeA.kunci).bytes)
    terapkanMateri(hpM.db, materiBytes)
    terapkanMateri(exeA2.db, materiBytes)
    // paket desa yang dipalsukan (ditandatangani perangkat lain) ditolak
    const palsu = buatPaket(exeA.db, A1.id, { ...exeA.kunci, tandaTangan: exeB.kunci.tandaTangan })
    expect(() => terapkanPaket(hpM.db, palsu.bytes)).toThrow(/Tanda tangan/)
  })

  it('6. mubaligh A1 menerbitkan token generus + wali', async () => {
    hpG = await buatHp('HP Ali')
    hpW = await buatHp('HP Ayah Ali')
    await aktifkanProfil(hpG.db, terbitkanTokenGenerus(hpM.db, profilM.id, { kodePerangkat: hpG.kode, role: 'generus', generusIds: [ali.id], nama: 'Ali' }))
    await aktifkanProfil(hpW.db, terbitkanTokenGenerus(hpM.db, profilM.id, { kodePerangkat: hpW.kode, role: 'wali', generusIds: [ali.id], nama: 'Ayah Ali' }))
    for (const h of [hpG, hpW]) {
      terapkanMateri(h.db, materiBytes)
      terapkanBalasan(h.db, buatBalasan(hpM.db, h.id).bytes)
    }
    const awal = materiPerluDituntaskan(hpG.db, ali.id)!
    expect(awal).toMatchObject({ periode: '2026-S1', adaTarget: true, total: 3, tuntas: 0 })
    expect(awal.perluDituntaskan.map((m) => m.materi_id)).toEqual(target)
    expect(awal.pertemuanBerikutnya).toMatchObject({ tanggal: '2026-11-16', judul: 'Kelas Caberawit' })
  })

  it('7. absen pertemuan dengan materi + tandai tuntas → HP generus melihat materi perlu dituntaskan berkurang', () => {
    const saran = saranMateriPertemuan(hpM.db, A1.id, undefined, { pengajianId: kelasA1 })
    expect(saran[0]).toMatchObject({ materi_id: target[0], belumTuntas: 2, jumlahGenerus: 2 })
    const p = bukaPertemuan(hpM.db, { kelompokId: A1.id, tanggal: '2026-11-16', pengajianId: kelasA1, materiIds: [target[0]!] })
    const lembar = lembarAbsenPertemuan(hpM.db, p.id)!
    expect(lembar.baris.map((b) => b.nama).sort()).toEqual(['Ali', 'Budi']) // Citra (praremaja) bukan kelas ini
    expect(() => absenPertemuan(hpM.db, p.id, [{ generusId: budi.id, status: 'alpa', tuntas: [target[0]!] }])).toThrow(/hadir/)
    expect(absenPertemuan(hpM.db, p.id, [{ generusId: ali.id, status: 'hadir', tuntas: [target[0]!] }, { generusId: budi.id, status: 'alpa' }])).toEqual({ presensi: 2, tuntas: 1 })
    const l2 = lembarAbsenPertemuan(hpM.db, p.id)!
    expect(l2.baris.find((b) => b.generus_id === ali.id)).toMatchObject({ status: 'hadir', tuntas: { [target[0]!]: true } })
    expect(progresKelas(hpM.db, A1.id, 'caberawit').generus.map((g) => [g.nama, g.persen])).toEqual([['Ali', 33.3], ['Budi', 0]])
    // saran berikutnya: materi yang paling banyak belum tuntas (Ali sudah tuntas materi pertama)
    expect(saranMateriPertemuan(hpM.db, A1.id, 'caberawit').map((s) => [s.materi_id, s.belumTuntas])).toEqual([[target[1], 2], [target[2], 2], [target[0], 1]])
    expect(citra.kategori).toBe('praremaja')
    for (const h of [hpG, hpW]) terapkanBalasan(h.db, buatBalasan(hpM.db, h.id).bytes)
    const sesudah = materiPerluDituntaskan(hpG.db, ali.id)!
    expect(sesudah).toMatchObject({ total: 3, tuntas: 1, persen: 33.3 })
    expect(sesudah.perluDituntaskan.map((m) => m.materi_id)).toEqual(target.slice(1))
    expect(materiPerluDituntaskan(hpW.db, ali.id)!.tuntas).toBe(1)
    // EXE kelompok A2 juga mengabsen sendiri
    const pA2 = bukaPertemuan(exeA2.db, { kelompokId: A2.id, tanggal: '2026-11-16', pengajianId: kelasA2, materiIds: [target[0]!] })
    absenPertemuan(exeA2.db, pA2.id, [{ generusId: dodi.id, status: 'hadir', tuntas: [target[0]!] }])
  })

  it('8. A1 (HP) dan A2 (EXE) menyetor ke desa A — tujuan dari token, idempoten', () => {
    maju(60)
    const s = buatSetor(hpM.db)
    expect(s.header.penerima_perangkat_id).toBe(exeA.id)
    expect(() => imporSetor(daerah.db, s.bytes, daerah.kunci)).toThrow(/tingkat lain/)
    expect(() => imporSetor(exeB.db, s.bytes, exeB.kunci)).toThrow(/tingkat lain/)
    const r = imporSetor(exeA.db, s.bytes, exeA.kunci)
    expect(r.ditolak).toEqual([])
    expect(r.tokenDilaporkan).toBe(2)
    expect(r.perTabel.presensi?.ditambah).toBe(2)
    expect(imporSetor(exeA.db, s.bytes, exeA.kunci).sudahPernah).toBe(true)
    const s2 = buatSetor(exeA2.db)
    expect(s2.header.penerima_perangkat_id).toBe(exeA.id)
    const r2 = bukaBerkasApaSaja(exeA.db, s2.bytes).ringkasan
    expect(r2).toMatchObject({ jenis: 'SETOR', gabungan: true })
    expect((r2 as { ditolak: unknown[] }).ditolak).toEqual([])
    // konfirmasi turun: paket desa → HP tahu datanya sudah diterima desa (belum sampai daerah)
    expect(jumlahBelumDisetor(hpM.db)).toBeGreaterThan(0)
    terapkanPaket(hpM.db, buatPaket(exeA.db, A1.id, exeA.kunci).bytes)
    expect(jumlahBelumDisetor(hpM.db)).toBe(0)
    expect(infoSinkronHp(hpM.db).belumSampaiDaerah).toBeGreaterThan(0)
  })

  it('9. desa A menyetor gabungan ke daerah → daerah melihat data A1 & A2', () => {
    maju(60)
    const s = buatSetor(exeA.db)
    expect(s.header.penerima_perangkat_id).toBe('ADMIN')
    const r = imporSetor(daerah.db, s.bytes, daerah.kunci)
    expect(r.gabungan).toBe(true)
    expect(r.ditolak).toEqual([])
    expect(r.perangkatBawah).toBeGreaterThanOrEqual(4) // mubaligh, EXE A2, generus, wali
    const presensi = daftarPresensi(daerah.db, { kelompokIds: [A1.id, A2.id] })
    expect(presensi.map((p) => [p.generus_id, p.status]).sort()).toEqual(
      [[ali.id, 'hadir'], [budi.id, 'alpa'], [dodi.id, 'hadir']].sort(),
    )
    expect(presensi.every((p) => p.pertemuan_id)).toBe(true)
    expect(daftarKemajuan(daerah.db, { statusSah: 'disahkan' }).map((k) => k.generus_id).sort()).toEqual([ali.id, dodi.id].sort())
    expect(daftarPertemuan(daerah.db, A1.id)).toHaveLength(1)
    expect(daftarPerangkat(daerah.db, { wilayahIds: [A1.id] }).map((p) => p.role).sort()).toEqual(['generus', 'mubaligh', 'wali'])
    expect(daerah.db.nilai('SELECT COUNT(*) FROM penugasan_mubaligh WHERE kelompok_id = ?', [A1.id])).toBe(1)
    // konfirmasi bertahap sampai daerah: daerah → desa → HP / EXE kelompok
    terapkanPaket(exeA.db, buatPaket(daerah.db, desaA.id, daerah.kunci).bytes)
    expect(jumlahBelumDisetor(exeA.db)).toBe(0)
    terapkanPaket(hpM.db, buatPaket(exeA.db, A1.id, exeA.kunci).bytes)
    expect(infoSinkronHp(hpM.db).belumSampaiDaerah).toBe(0)
    terapkanPaket(exeA2.db, buatPaket(exeA.db, A2.id, exeA.kunci).bytes)
    expect(jumlahBelumSampaiDaerah(exeA2.db)).toBe(0)
  })

  it('10. status setor & terlambat sesuai jadwal (desa B belum pernah setor)', () => {
    keTanggal('2026-12-06')
    const st = statusSetor(daerah.db, D.id)
    expect(st.find((x) => x.wilayah_id === desaA.id)).toMatchObject({ terlambat: false, jadwal: { pola: 'bulanan', tanggal_bulan: 5 } })
    expect(st.find((x) => x.wilayah_id === desaB.id)).toMatchObject({ terlambat: true, terakhirSetor: null })
    const b = ringkasanBerandaExe(daerah.db)
    expect(b.peran).toBe('daerah')
    expect(b.statusSetorBawahan.filter((x) => x.terlambat).map((x) => x.nama)).toEqual(['Malanu'])
    // desa melihat kelompoknya (pekanan, Ahad 21.00): terakhir setor 16 Nov → periode 22–29 Nov kosong → terlambat
    const sk = statusSetor(exeA.db, desaA.id)
    expect(sk.map((x) => [x.nama, x.terlambat])).toEqual([['Klasaman 1', true], ['Klasaman 2', true]])
    expect(statusSetor(daerah.db, desaA.id).map((x) => x.terakhirSetor !== null)).toEqual([true, true])
    const ing = pengingatSetor(hpM.db)!
    expect(ing).toMatchObject({ terlambat: true, tampilkanTombol: true, tujuan: { perangkatId: exeA.id, nama: 'Desa Klasaman', tingkat: 'desa' } })
    expect(ringkasanBerandaExe(exeA.db)).toMatchObject({ peran: 'desa', wilayah: { id: desaA.id }, generus: { aktif: 4 } })
  })

  it('11. daerah mencabut mubaligh A1 → pencabutan sampai ke HP generus lewat desa', () => {
    const idM = uraiToken(tokenM).payload.token_id
    cabutPerangkat(daerah.db, idM)
    maju(10)
    terapkanPaket(exeA.db, buatPaket(daerah.db, desaA.id, daerah.kunci).bytes)
    expect(daftarPerangkat(exeA.db, { role: 'mubaligh' })[0]!.dicabut_pada).toBeTruthy()
    // paket desa berikutnya tidak lagi untuk HP mubaligh A1
    expect(() => buatPaket(exeA.db, A1.id, exeA.kunci)).toThrow(/Belum ada/)
    // setoran HP mubaligh yang dicabut ditolak desa
    expect(() => imporSetor(exeA.db, buatSetor(hpM.db).bytes, exeA.kunci)).toThrow(/dicabut/)
    const balasanLama = buatBalasan(hpM.db, hpG.id)
    terapkanBalasan(hpG.db, buatBalasan(exeA.db, hpG.id).bytes)
    expect(() => terapkanBalasan(hpG.db, balasanLama.bytes)).toThrow(/tidak sah/)
    expect(materiPerluDituntaskan(hpG.db, ali.id)!.tuntas).toBe(1)
  })

  it('12. desa A tidak bisa menerbitkan token untuk wilayah desa B', async () => {
    const hpX = await buatHp('HP Penyusup')
    expect(() => terbitkanTokenBawah(exeA.db, exeA.kunci, { kodePerangkat: hpX.kode, role: 'mubaligh', nama: 'X', wilayahId: B1.id })).toThrow(/di luar desa/)
    // token rakitan (ditandatangani kunci EXE desa A untuk kelompok desa B)
    const sah = uraiToken(terbitkanTokenBawah(exeA.db, exeA.kunci, { kodePerangkat: hpX.kode, role: 'pengurus', nama: 'X', wilayahId: A1.id })).payload
    const palsu = tandaTanganiToken({ ...sah, token_id: 'PALSU-1', wilayah_id: B1.id }, exeA.kunci.tandaTangan.rahasia)
    expect(periksaTokenDb(daerah.db, palsu)).toMatchObject({ sah: false, kode: 'RANTAI_TIDAK_SAH' })
    expect(periksaTokenDb(exeB.db, palsu)).toMatchObject({ sah: false, kode: 'RANTAI_TIDAK_SAH' })
    expect(periksaToken(palsu, { adminSignPub: uraiToken(palsu).payload.admin_sign_pub, wilayahMencakup: wilayahMencakupDb(hpM.db) })).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
    // HP yang belum punya pohon wilayah bisa memasangnya, tetapi setorannya ditolak desa A (dan daerah)
    await aktifkanProfil(hpX.db, palsu)
    const sx = buatSetor(hpX.db)
    expect(() => imporSetor(exeA.db, sx.bytes, exeA.kunci)).toThrow(/di luar wilayah|tidak sah/)
  })

  it('13. token buatan EXE desa yang dicabut ditolak', async () => {
    // sebelum dicabut: desa B menerbitkan token pengurus B1 dan melaporkannya ke daerah
    const hpP = await buatHp('HP Pengurus B1')
    const tokP = terbitkanTokenBawah(exeB.db, exeB.kunci, { kodePerangkat: hpP.kode, role: 'pengurus', nama: 'Pengurus B1', wilayahId: B1.id })
    imporSetor(daerah.db, buatSetor(exeB.db).bytes, daerah.kunci)
    maju(10)
    cabutPerangkat(daerah.db, uraiToken(exeB.token!).payload.token_id)
    maju(10)
    // sesudah dicabut (EXE desa B belum tahu): token baru ditolak di semua mata rantai
    const hpQ = await buatHp('HP Baru B1')
    const tokQ = terbitkanTokenBawah(exeB.db, exeB.kunci, { kodePerangkat: hpQ.kode, role: 'pengurus', nama: 'Baru', wilayahId: B1.id })
    expect(periksaTokenDb(daerah.db, tokQ)).toMatchObject({ sah: false, kode: 'RANTAI_TIDAK_SAH' })
    // memundurkan jam EXE (tanggal terbit dipalsukan) tetap ditolak: token tidak pernah dilaporkan sebelum dicabut (T12)
    pasangJam('2026-12-05T00:00:00.000Z')
    const tokMundur = terbitkanTokenBawah(exeB.db, exeB.kunci, { kodePerangkat: hpQ.kode, role: 'pengurus', nama: 'Mundur', wilayahId: B1.id })
    keTanggal('2026-12-06', '03:00')
    expect(periksaTokenDb(daerah.db, tokMundur, { denganDikenal: true })).toMatchObject({ sah: false, kode: 'RANTAI_TIDAK_SAH' })
    // token yang sudah dilaporkan sebelum pencabutan tetap berlaku
    expect(periksaTokenDb(daerah.db, tokP, { denganDikenal: true }).sah).toBe(true)
    // setoran gabungan EXE desa B ditolak; paket daerah tidak lagi untuk EXE desa B
    expect(() => imporSetor(daerah.db, buatSetor(exeB.db).bytes, daerah.kunci)).toThrow(/dicabut/)
    expect(() => buatPaket(daerah.db, desaB.id, daerah.kunci)).toThrow(/Belum ada/)
  })

  it('14. migrasi DB v2 → v3: admin lama = daerah, token & berkas lama tetap berlaku', async () => {
    const baca = (n: string) => gunzipSync(readFileSync(new URL(`./fixtur/${n}`, import.meta.url)))
    const info = JSON.parse(dariUtf8(baca('v2-info.json.gz'))) as Record<string, string>
    const lama = await bukaDb(baca('v2-admin.db.gz'))
    expect(lama.nilai('SELECT nilai FROM meta WHERE kunci = ?', ['versi_skema'])).toBe(String(VERSI_SKEMA))
    expect(peranInstalasi(lama)).toBe('daerah')
    migrasi(lama) // idempoten
    const kunci = await bukaKunciAdmin(lama, info.sandi!)
    expect(lama.nilai(`SELECT COUNT(*) FROM pragma_table_info('pengajian') WHERE name = 'kategori_generus'`)).toBe(1)
    expect(lama.nilai(`SELECT COUNT(*) FROM pragma_table_info('presensi') WHERE name = 'pertemuan_id'`)).toBe(1)
    // token lama tetap sah
    expect(periksaTokenDb(lama, info.token!).sah).toBe(true)
    // SETOR lama (dibuat aplikasi v2) tetap bisa diimpor
    const r = imporSetor(lama, baca('v2-setor.ppg.gz'), kunci)
    expect(r.perTabel.presensi?.ditambah).toBe(1)
    // HP v2 dimigrasikan: tetap menyetor ke daerah, menerima paket, dan meneruskan balasan ke HP generus v2
    const hpLama = await bukaDb(baca('v2-hp-mubaligh.db.gz'))
    const hpGLama = await bukaDb(baca('v2-hp-generus.db.gz'))
    expect(peranInstalasi(hpLama)).toBe('hp')
    const s = buatSetor(hpLama)
    expect(s.header.penerima_perangkat_id).toBe('ADMIN')
    imporSetor(lama, s.bytes, kunci)
    terapkanPaket(hpLama, buatPaket(lama, info.kelompok!, kunci).bytes)
    expect(jumlahBelumDisetor(hpLama)).toBe(0)
    expect(infoSinkronHp(hpLama).belumSampaiDaerah).toBe(0)
    terapkanBalasan(hpGLama, buatBalasan(hpLama, info.hpGId!).bytes)
    // fitur v3 di database lama: jadwal setor & kelas
    aturJadwalSetor(lama, { tingkatAsal: 'desa', pola: 'bulanan', tanggal: 5 })
    expect(tambahPengajian(lama, { wilayahId: info.kelompok!, nama: 'Kelas', kategoriGenerus: ['caberawit'] }).kategori_generus).toBe('caberawit')
  })
})
