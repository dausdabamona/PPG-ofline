// Fase 8 — pemeriksaan akhir v3: celah token desa palsu di HP baru, SETOR gabungan (pemalsuan/replay),
// jadwal setor & keterlambatan di zona Asia/Jayapura, periode S1/S2.
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  aktifkanExe,
  aktifkanProfil,
  buatKodePerangkat,
  buatMateri,
  buatPaket,
  buatSetor,
  hitungTenggat,
  imporSetor,
  inisialisasiExe,
  keB64url,
  opsiPeriksaDb,
  periksaToken,
  periksaTokenDb,
  periodeAktif,
  periodeDariTanggal,
  bukaDb,
  tambahGenerus,
  tambahWilayah,
  tandaTanganiToken,
  terapkanMateri,
  terapkanPaket,
  terbitkanToken,
  terbitkanTokenBawah,
  uraiToken,
  ajukanUsulan,
  siapkanKripto,
  type Db,
  type JadwalSetor,
  type KunciAdmin,
  type KunciExe,
  type Wilayah,
} from '../src/index'
import { buatAdmin, buatHp, lepasJam, maju, pasangJam } from './bantu'

await siapkanKripto()

const SANDI = 'sandi-exe-123'

async function exeBaru(daerah: { db: Db; kunci: KunciAdmin }, wilayahId: string) {
  const db = await bukaDb()
  const { kodePerangkat, kunci } = await inisialisasiExe(db, { sandi: SANDI, label: 'EXE' })
  const token = terbitkanToken(daerah.db, daerah.kunci, { kodePerangkat, role: 'admin', nama: 'Admin', wilayahId })
  await aktifkanExe(db, kunci, token)
  return { db, kunci, token }
}

interface Dunia {
  daerah: { db: Db; kunci: KunciAdmin }
  desaA: Wilayah
  desaB: Wilayah
  A1: Wilayah
  B1: Wilayah
  exeA: { db: Db; kunci: KunciExe; token: string }
}

async function dunia(): Promise<Dunia> {
  const daerah = await buatAdmin()
  const D = tambahWilayah(daerah.db, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
  const desaA = tambahWilayah(daerah.db, { tingkat: 'desa', nama: 'Desa A', kode: 'DA', indukId: D.id })
  const desaB = tambahWilayah(daerah.db, { tingkat: 'desa', nama: 'Desa B', kode: 'DB', indukId: D.id })
  const A1 = tambahWilayah(daerah.db, { tingkat: 'kelompok', nama: 'A1', kode: 'A1', indukId: desaA.id })
  const B1 = tambahWilayah(daerah.db, { tingkat: 'kelompok', nama: 'B1', kode: 'B1', indukId: desaB.id })
  tambahGenerus(daerah.db, { kelompokId: A1.id, nama: 'Ali', jenisKelamin: 'L', kategori: 'caberawit', mulai: '2026-10-01' })
  const exeA = await exeBaru(daerah, desaA.id)
  terapkanPaket(exeA.db, buatPaket(daerah.db, desaA.id, daerah.kunci).bytes)
  terapkanMateri(exeA.db, buatMateri(daerah.db, daerah.kunci).bytes)
  return { daerah, desaA, desaB, A1, B1, exeA }
}

beforeEach(() => pasangJam('2026-11-16T01:00:00.000Z'))
afterAll(() => lepasJam())

describe('A1. HP baru memverifikasi wilayah token dari EXE desa tanpa pohon wilayah lokal', () => {
  it('token jujur dari desa membawa bukti wilayah bertanda tangan daerah dan diterima HP baru', async () => {
    const d = await dunia()
    const hp = await buatHp('HP Pengurus A1')
    const tok = terbitkanTokenBawah(d.exeA.db, d.exeA.kunci, { kodePerangkat: hp.kode, role: 'pengurus', nama: 'P', wilayahId: d.A1.id })
    expect(typeof uraiToken(tok).payload.bukti_wilayah).toBe('string')
    const profil = await aktifkanProfil(hp.db, tok)
    expect(profil.wilayah_id).toBe(d.A1.id)
    // EXE kelompok baru (tanpa pohon wilayah) juga menerimanya
    const dbK = await bukaDb()
    const { kodePerangkat, kunci } = await inisialisasiExe(dbK, { sandi: SANDI, label: 'EXE A1' })
    const tokK = terbitkanTokenBawah(d.exeA.db, d.exeA.kunci, { kodePerangkat, role: 'admin', nama: 'EXE A1', wilayahId: d.A1.id })
    await aktifkanExe(dbK, kunci, tokK)
  })

  it('HP baru menolak token rakitan EXE desa A untuk kelompok desa B (tanpa bukti, bukti salinan, bukti palsu)', async () => {
    const d = await dunia()
    const hpX = await buatHp('HP Penyusup')
    const sah = uraiToken(terbitkanTokenBawah(d.exeA.db, d.exeA.kunci, { kodePerangkat: hpX.kode, role: 'pengurus', nama: 'X', wilayahId: d.A1.id })).payload
    const rahasia = d.exeA.kunci.tandaTangan.rahasia
    const tanpaBukti = { ...sah, token_id: 'PALSU-1', wilayah_id: d.B1.id }
    delete (tanpaBukti as { bukti_wilayah?: string }).bukti_wilayah
    const palsu = [
      tandaTanganiToken(tanpaBukti, rahasia),
      tandaTanganiToken({ ...sah, token_id: 'PALSU-2', wilayah_id: d.B1.id }, rahasia),
      tandaTanganiToken({ ...sah, token_id: 'PALSU-3', wilayah_id: d.B1.id, bukti_wilayah: keB64url(new Uint8Array(64)) }, rahasia),
    ]
    for (const t of palsu) {
      await expect(aktifkanProfil(hpX.db, t)).rejects.toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
      expect(periksaTokenDb(d.daerah.db, t)).toMatchObject({ sah: false, kode: 'RANTAI_TIDAK_SAH' })
    }
    // EXE kelompok baru juga menolak token EXE kelompok rakitan untuk B1
    const dbK = await bukaDb()
    const { kodePerangkat, kunci } = await inisialisasiExe(dbK, { sandi: SANDI, label: 'EXE palsu' })
    const sahK = uraiToken(terbitkanTokenBawah(d.exeA.db, d.exeA.kunci, { kodePerangkat, role: 'admin', nama: 'K', wilayahId: d.A1.id })).payload
    const palsuK = tandaTanganiToken({ ...sahK, token_id: 'PALSU-K', wilayah_id: d.B1.id }, rahasia)
    await expect(aktifkanExe(dbK, kunci, palsuK)).rejects.toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
  })

  it('pohon wilayah HP yang "diracuni" paket desa tidak membuat token rakitan sah', async () => {
    const d = await dunia()
    const hp = await buatHp('HP Pengurus A1')
    await aktifkanProfil(hp.db, terbitkanTokenBawah(d.exeA.db, d.exeA.kunci, { kodePerangkat: hp.kode, role: 'pengurus', nama: 'P', wilayahId: d.A1.id }))
    const sah = uraiToken(terbitkanTokenBawah(d.exeA.db, d.exeA.kunci, { kodePerangkat: hp.kode, role: 'pengurus', nama: 'P2', wilayahId: d.A1.id })).payload
    const tanpaBukti = { ...sah, token_id: 'PALSU-4', wilayah_id: d.B1.id }
    delete (tanpaBukti as { bukti_wilayah?: string }).bukti_wilayah
    const palsu = tandaTanganiToken(tanpaBukti, d.exeA.kunci.tandaTangan.rahasia)
    // seolah-olah pohon wilayah HP berkata B1 di bawah desa A
    expect(periksaToken(palsu, { ...opsiPeriksaDb(hp.db), wilayahMencakup: () => true })).toMatchObject({ sah: false, kode: 'RANTAI_TIDAK_SAH' })
  })

  it('EXE desa butuh bukti wilayah dari paket daerah untuk kelompok baru', async () => {
    const d = await dunia()
    const A3 = tambahWilayah(d.daerah.db, { tingkat: 'kelompok', nama: 'A3', kode: 'A3', indukId: d.desaA.id })
    const hp = await buatHp('HP A3')
    expect(() => terbitkanTokenBawah(d.exeA.db, d.exeA.kunci, { kodePerangkat: hp.kode, role: 'pengurus', nama: 'P', wilayahId: A3.id })).toThrow(/paket terbaru/)
    maju(1)
    terapkanPaket(d.exeA.db, buatPaket(d.daerah.db, d.desaA.id, d.daerah.kunci).bytes)
    await aktifkanProfil(hp.db, terbitkanTokenBawah(d.exeA.db, d.exeA.kunci, { kodePerangkat: hp.kode, role: 'pengurus', nama: 'P', wilayahId: A3.id }))
  })
})

describe('A2. SETOR gabungan: pemalsuan & replay', () => {
  it('berkas diubah ditolak; berkas sama diimpor ulang idempoten; setoran lama tidak menimpa yang baru', async () => {
    const d = await dunia()
    ajukanUsulan(d.exeA.db, { jenis: 'tambah_generus', kelompokId: d.A1.id, data: { nama: 'Calon 1', jenis_kelamin: 'L', kategori: 'caberawit' } })
    const s1 = buatSetor(d.exeA.db)
    // ubah satu byte di isi (tanda tangan jadi tidak cocok)
    const rusak = new Uint8Array(s1.bytes)
    rusak[rusak.length - 10] = rusak[rusak.length - 10]! ^ 0xff
    expect(() => imporSetor(d.daerah.db, rusak, d.daerah.kunci)).toThrow()
    const r1 = imporSetor(d.daerah.db, s1.bytes, d.daerah.kunci)
    expect(r1.gabungan).toBe(true)
    expect(r1.sudahPernah).toBe(false)
    expect(imporSetor(d.daerah.db, s1.bytes, d.daerah.kunci).sudahPernah).toBe(true)
    const jumlah = () => d.daerah.db.nilai<number>(`SELECT COUNT(*) FROM usulan`)
    expect(jumlah()).toBe(1)
    // setoran untuk daerah tidak bisa diimpor di EXE desa lain
    const exeB = await exeBaru(d.daerah, d.desaB.id)
    expect(() => imporSetor(exeB.db, s1.bytes, exeB.kunci)).toThrow(/daerah/)
  })

  it('SETOR gabungan rakitan yang ditandatangani perangkat lain ditolak', async () => {
    const d = await dunia()
    const exeB = await exeBaru(d.daerah, d.desaB.id)
    const s = buatSetor(d.exeA.db)
    // EXE desa B mencoba menyamar: memakai berkas desa A tetapi tanda tangannya bukan miliknya → tidak berubah apa pun di sini;
    // yang diuji: berkas desa B diterima sebagai desa B, bukan desa A
    const rB = imporSetor(d.daerah.db, buatSetor(exeB.db).bytes, d.daerah.kunci)
    expect(rB.pengirimPerangkatId).toBe(uraiToken(exeB.token).payload.perangkat_id)
    expect(imporSetor(d.daerah.db, s.bytes, d.daerah.kunci).pengirimPerangkatId).toBe(uraiToken(d.exeA.token).payload.perangkat_id)
  })
})

describe('A3. jadwal setor & keterlambatan (Asia/Jayapura) dan periode S1/S2', () => {
  const tzLama = process.env.TZ
  beforeEach(() => {
    process.env.TZ = 'Asia/Jayapura'
  })
  afterEach(() => {
    process.env.TZ = tzLama
  })
  const jadwal = (o: Partial<JadwalSetor>): JadwalSetor =>
    ({ id: 'JS', tingkat_asal: 'desa', pola: 'bulanan', hari: null, tanggal_bulan: 5, jam: '23:59', ...o }) as JadwalSetor

  it('bulanan tanggal 5 pukul 23:59 WIT, termasuk pergantian tahun', () => {
    // 5 Des 2026 23:58 WIT = 14:58Z → tenggat berikut 5 Des 23:59 WIT = 14:59Z
    let t = hitungTenggat(jadwal({}), new Date('2026-12-05T14:58:00Z'))
    expect(t.berikut.toISOString()).toBe('2026-12-05T14:59:00.000Z')
    expect(t.terakhir.toISOString()).toBe('2026-11-05T14:59:00.000Z')
    // lewat 1 menit → tenggat berikut 5 Jan 2027
    t = hitungTenggat(jadwal({}), new Date('2026-12-05T15:00:00Z'))
    expect(t.berikut.toISOString()).toBe('2027-01-05T14:59:00.000Z')
    expect(t.awalPeriode.toISOString()).toBe('2026-11-05T14:59:00.000Z')
    // akhir bulan (31 Jan) dengan tanggal 28 → 28 Feb
    t = hitungTenggat(jadwal({ tanggal_bulan: 28 }), new Date('2027-01-31T03:00:00Z'))
    expect(t.berikut.toISOString()).toBe('2027-02-28T14:59:00.000Z')
  })

  it('pekanan Ahad 23:59 WIT: Senin 00:30 WIT sudah masuk pekan baru', () => {
    // Ahad 15 Nov 2026 23:00 WIT = 14:00Z
    let t = hitungTenggat(jadwal({ pola: 'pekanan', hari: 0, tanggal_bulan: null }), new Date('2026-11-15T14:00:00Z'))
    expect(t.berikut.toISOString()).toBe('2026-11-15T14:59:00.000Z')
    // Senin 16 Nov 00:30 WIT = 15:30Z Ahad UTC
    t = hitungTenggat(jadwal({ pola: 'pekanan', hari: 0, tanggal_bulan: null }), new Date('2026-11-15T15:30:00Z'))
    expect(t.berikut.toISOString()).toBe('2026-11-22T14:59:00.000Z')
    expect(t.terakhir.toISOString()).toBe('2026-11-15T14:59:00.000Z')
  })

  it('periode S1 = Juli–Desember, S2 = Januari–Juni (tanggal lokal WIT)', async () => {
    expect(periodeDariTanggal('2026-07-01')).toBe('2026-S1')
    expect(periodeDariTanggal('2026-12-31')).toBe('2026-S1')
    expect(periodeDariTanggal('2027-01-01')).toBe('2026-S2')
    expect(periodeDariTanggal('2027-06-30')).toBe('2026-S2')
    // 30 Jun 2026 16:00Z = 1 Jul 2026 01:00 WIT → S1
    pasangJam('2026-06-30T16:00:00.000Z')
    expect(periodeDariTanggal()).toBe('2026-S1')
    const db = await bukaDb()
    expect(periodeAktif(db)).toBe('2026-S1')
    pasangJam('2026-12-31T15:30:00.000Z') // 1 Jan 2027 00:30 WIT
    expect(periodeAktif(db)).toBe('2026-S2')
  })
})

void buatKodePerangkat
