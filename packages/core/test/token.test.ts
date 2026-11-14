import { beforeAll, describe, expect, it } from 'vitest'
import {
  bacaKodePerangkat,
  buatKodePerangkat,
  buatPasanganKotak,
  buatPasanganTandaTangan,
  bukaRahasiaToken,
  keB64url,
  keUtf8,
  periksaToken,
  segelKe,
  siapkanKripto,
  statusPencabutan,
  tandaTanganiToken,
  uraiToken,
  type PasanganKunci,
  type PayloadToken,
} from '../src/index'

let admin: PasanganKunci
let adminBox: PasanganKunci
let hpM: { s: PasanganKunci; b: PasanganKunci }
let hpG: { s: PasanganKunci; b: PasanganKunci }
let ADMIN = ''

beforeAll(async () => {
  await siapkanKripto()
  admin = buatPasanganTandaTangan()
  adminBox = buatPasanganKotak()
  hpM = { s: buatPasanganTandaTangan(), b: buatPasanganKotak() }
  hpG = { s: buatPasanganTandaTangan(), b: buatPasanganKotak() }
  ADMIN = keB64url(admin.publik)
})

function dasar(p: Partial<PayloadToken>, hp: { s: PasanganKunci; b: PasanganKunci }): PayloadToken {
  return {
    v: 1,
    token_id: 'T-' + Math.random().toString(36).slice(2),
    org_id: 'ORG',
    admin_sign_pub: ADMIN,
    admin_box_pub: keB64url(adminBox.publik),
    perangkat_id: 'HP-' + keB64url(hp.s.publik).slice(0, 6),
    device_sign_pub: keB64url(hp.s.publik),
    device_box_pub: keB64url(hp.b.publik),
    role: 'pengurus',
    nama: 'Uji',
    tingkat: 'kelompok',
    wilayah_id: 'K1',
    hak: ['catat', 'lihat'],
    terbit: '2026-01-01T00:00:00.000Z',
    berlaku_sampai: '2027-01-01T00:00:00.000Z',
    ...p,
  }
}

function tokenMubaligh(p: Partial<PayloadToken> = {}): { teks: string; payload: PayloadToken } {
  const payload = dasar({ role: 'mubaligh', hak: ['catat', 'lihat', 'sahkan', 'terbit_generus'], ...p }, hpM)
  return { teks: tandaTanganiToken(payload, admin.rahasia), payload }
}

function tokenGenerus(penerbit: string, p: Partial<PayloadToken> = {}, penanda = hpM.s.rahasia): { teks: string; payload: PayloadToken } {
  const payload = dasar({ role: 'generus', hak: ['catat', 'lihat', 'setor_belajar'], generus_ids: ['G1'], penerbit, terbit: '2026-02-01T00:00:00.000Z', ...p }, hpG)
  return { teks: tandaTanganiToken(payload, penanda), payload }
}

const SEKARANG = '2026-06-01T00:00:00.000Z'
const opsi = (o: Partial<Parameters<typeof periksaToken>[1]> = {}) => ({ adminSignPub: ADMIN, sekarang: SEKARANG, ...o })

describe('token & rantai kepercayaan', () => {
  it('token pengurus sah; diubah / admin lain / bentuk rusak ditolak', () => {
    const p = dasar({}, hpM)
    const teks = tandaTanganiToken(p, admin.rahasia)
    expect(periksaToken(teks, opsi())).toEqual({ sah: true, payload: p })
    const t = uraiToken(teks)
    const diubah = `PPGT1.${keB64url(keUtf8(JSON.stringify({ ...p, role: 'mubaligh' })))}.${teks.split('.')[2]}`
    expect(periksaToken(diubah, opsi())).toMatchObject({ sah: false, kode: 'TANDA_TANGAN_TIDAK_SAH' })
    expect(periksaToken(teks, opsi({ adminSignPub: keB64url(buatPasanganTandaTangan().publik) }))).toMatchObject({ kode: 'ADMIN_BERBEDA' })
    expect(periksaToken('sampah', opsi())).toMatchObject({ kode: 'TOKEN_TIDAK_SAH' })
    expect(periksaToken(`PPGT1.${keB64url(keUtf8('{"v":2}'))}.AAAA`, opsi())).toMatchObject({ kode: 'TOKEN_TIDAK_SAH' })
    expect(t.payload.nama).toBe('Uji')
    // spasi/baris baru dari WA diabaikan
    expect(periksaToken(teks.slice(0, 20) + '\n ' + teks.slice(20), opsi()).sah).toBe(true)
    // ditandatangani bukan oleh admin
    expect(periksaToken(tandaTanganiToken(p, hpM.s.rahasia), opsi())).toMatchObject({ kode: 'TANDA_TANGAN_TIDAK_SAH' })
  })

  it('mubaligh wajib tingkat kelompok; pengurus tidak boleh berpenerbit', () => {
    expect(periksaToken(tokenMubaligh({ tingkat: 'desa' }).teks, opsi())).toMatchObject({ kode: 'TOKEN_TIDAK_SAH' })
    const p = dasar({ penerbit: 'x' }, hpM)
    expect(periksaToken(tandaTanganiToken(p, admin.rahasia), opsi())).toMatchObject({ kode: 'TOKEN_TIDAK_SAH' })
  })

  it('kedaluwarsa, dicabut, dibekukan → membawa payload; abaikanKedaluwarsa', () => {
    const { teks, payload } = tokenMubaligh({ berlaku_sampai: '2026-03-01T00:00:00.000Z' })
    const h = periksaToken(teks, opsi())
    expect(h).toMatchObject({ sah: false, kode: 'KEDALUWARSA', payload })
    expect(periksaToken(teks, opsi({ abaikanKedaluwarsa: true })).sah).toBe(true)
    const m = tokenMubaligh()
    const cabut = [{ token_id: m.payload.token_id, jenis: 'cabut' as const, tanggal: '2026-05-01T00:00:00.000Z' }]
    expect(periksaToken(m.teks, opsi({ pencabutan: cabut }))).toMatchObject({ kode: 'DICABUT' })
    expect(periksaToken(m.teks, opsi({ pencabutan: cabut, sekarang: '2026-04-01T00:00:00.000Z' })).sah).toBe(true)
    const beku = [
      { token_id: m.payload.token_id, jenis: 'beku' as const, tanggal: '2026-04-01T00:00:00.000Z' },
      { token_id: m.payload.token_id, jenis: 'cair' as const, tanggal: '2026-04-10T00:00:00.000Z' },
      { token_id: m.payload.token_id, jenis: 'beku' as const, tanggal: '2026-04-20T00:00:00.000Z' },
    ]
    expect(periksaToken(m.teks, opsi({ pencabutan: beku }))).toMatchObject({ kode: 'DIBEKUKAN' })
    expect(periksaToken(m.teks, opsi({ pencabutan: beku.slice(0, 2) })).sah).toBe(true)
  })

  it('statusPencabutan: cabut permanen, beku/cair memakai catatan terakhir', () => {
    expect(statusPencabutan([], 'X')).toEqual({ dicabutPada: null, dibekukan: false })
    expect(
      statusPencabutan(
        [
          { token_id: 'X', jenis: 'cabut', tanggal: '2026-05-02' },
          { token_id: 'X', jenis: 'cabut', tanggal: '2026-05-01' },
          { token_id: 'Y', jenis: 'beku', tanggal: '2026-05-01' },
        ],
        'X',
      ),
    ).toEqual({ dicabutPada: '2026-05-01', dibekukan: false })
  })

  it('rantai generus sah dan semua pelanggaran rantai ditolak', () => {
    const m = tokenMubaligh()
    const g = tokenGenerus(m.teks)
    expect(periksaToken(g.teks, opsi()).sah).toBe(true)
    // tanpa penerbit
    expect(periksaToken(tokenGenerus('').teks, opsi())).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
    // penerbit rusak
    expect(periksaToken(tokenGenerus('PPGT1.x.y').teks, opsi())).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
    // penerbit bukan mubaligh
    const pengurus = tandaTanganiToken(dasar({}, hpM), admin.rahasia)
    expect(periksaToken(tokenGenerus(pengurus).teks, opsi())).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
    // mubaligh tanpa hak terbit_generus
    expect(periksaToken(tokenGenerus(tokenMubaligh({ hak: ['catat'] }).teks).teks, opsi())).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
    // kelompok berbeda
    expect(periksaToken(tokenGenerus(m.teks, { wilayah_id: 'K2' }).teks, opsi())).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
    // terbit setelah masa berlaku penerbit / sebelum penerbit terbit
    expect(periksaToken(tokenGenerus(m.teks, { terbit: '2027-02-01T00:00:00.000Z', berlaku_sampai: '2028-01-01T00:00:00.000Z' }).teks, opsi({ sekarang: '2027-03-01T00:00:00.000Z' }))).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
    expect(periksaToken(tokenGenerus(m.teks, { terbit: '2025-12-01T00:00:00.000Z' }).teks, opsi())).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
    // ditandatangani perangkat lain (bukan perangkat mubaligh penerbit)
    expect(periksaToken(tokenGenerus(m.teks, {}, hpG.s.rahasia).teks, opsi())).toMatchObject({ kode: 'TANDA_TANGAN_TIDAK_SAH' })
    // penerbit palsu (tidak ditandatangani admin)
    const mPalsu = tandaTanganiToken(m.payload, hpM.s.rahasia)
    expect(periksaToken(tokenGenerus(mPalsu).teks, opsi())).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
    // hak berlebih, jumlah generus salah, wali menyetor
    expect(periksaToken(tokenGenerus(m.teks, { hak: ['sahkan'] }).teks, opsi())).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
    expect(periksaToken(tokenGenerus(m.teks, { generus_ids: ['G1', 'G2'] }).teks, opsi())).toMatchObject({ kode: 'TOKEN_TIDAK_SAH' })
    expect(periksaToken(tokenGenerus(m.teks, { role: 'wali', generus_ids: [] }).teks, opsi())).toMatchObject({ kode: 'TOKEN_TIDAK_SAH' })
    expect(periksaToken(tokenGenerus(m.teks, { role: 'wali', generus_ids: ['G1'], hak: ['lihat', 'setor_belajar'] }).teks, opsi())).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
    expect(periksaToken(tokenGenerus(m.teks, { role: 'wali', generus_ids: ['G1', 'G2'], hak: ['lihat'] }).teks, opsi()).sah).toBe(true)
    // org berbeda
    expect(periksaToken(tokenGenerus(m.teks, { org_id: 'LAIN' }).teks, opsi())).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
  })

  it('penerbit dicabut: token terbit sebelum pencabutan tetap sah, sesudahnya ditolak; tokenDikenal', () => {
    const m = tokenMubaligh()
    const g = tokenGenerus(m.teks, { terbit: '2026-02-01T00:00:00.000Z' })
    const cabut = [{ token_id: m.payload.token_id, jenis: 'cabut' as const, tanggal: '2026-03-01T00:00:00.000Z' }]
    expect(periksaToken(g.teks, opsi({ pencabutan: cabut })).sah).toBe(true)
    const gTelat = tokenGenerus(m.teks, { terbit: '2026-04-01T00:00:00.000Z' })
    expect(periksaToken(gTelat.teks, opsi({ pencabutan: cabut }))).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
    expect(periksaToken(g.teks, opsi({ pencabutan: cabut, tokenDikenal: new Set() }))).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
    expect(periksaToken(g.teks, opsi({ pencabutan: cabut, tokenDikenal: new Set([g.payload.token_id]) })).sah).toBe(true)
  })

  it('kode perangkat & rahasia token', () => {
    const kode = buatKodePerangkat({ perangkat_id: 'HP1', sign_pub: keB64url(hpG.s.publik), box_pub: keB64url(hpG.b.publik), label: 'HP', dibuat_pada: 'x' })
    expect(kode.startsWith('PPGD1.')).toBe(true)
    expect(bacaKodePerangkat(` ${kode}\n`).perangkat_id).toBe('HP1')
    expect(() => bacaKodePerangkat('PPGD1.xxx')).toThrow(/Kode Perangkat/)
    expect(() => bacaKodePerangkat('lain')).toThrow(/Kode Perangkat/)
    const salahPanjang = buatKodePerangkat({ perangkat_id: 'HP1', sign_pub: 'AAAA', box_pub: 'AAAA', label: '', dibuat_pada: '' })
    expect(() => bacaKodePerangkat(salahPanjang)).toThrow(/Kode Perangkat/)
    const rahasia = keB64url(segelKe(hpG.b.publik, keUtf8(JSON.stringify({ kunci_umum_kelompok: 'abc' }))))
    const p = dasar({ rahasia }, hpG)
    expect(bukaRahasiaToken(p, hpG.b)).toEqual({ kunci_umum_kelompok: 'abc' })
    expect(() => bukaRahasiaToken(p, hpM.b)).toThrow(/tidak bisa dibuka/)
    expect(bukaRahasiaToken(dasar({}, hpG), hpG.b)).toEqual({})
  })
})
