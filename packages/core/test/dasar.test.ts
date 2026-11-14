import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import {
  adalahGalatPpg,
  akhirPekan,
  aturJam,
  aturMeta,
  awalPekan,
  bukaDb,
  formatTanggal,
  GalatPpg,
  hariDalamPekan,
  migrasi,
  pastikan,
  PEMETAAN_MATERI,
  sekarangIso,
  selisihHari,
  siapkanSqlJs,
  simpanDb,
  tambahHari,
  tambahHariIso,
  tanggalDariIso,
  tanggalHariIni,
  tanggalRingkas,
  tanggalSah,
  ulid,
  umurPada,
  VERSI_SKEMA,
  kategoriDariUmur,
} from '../src/index'

afterEach(() => aturJam(null))

describe('ids & waktu', () => {
  it('ULID 26 karakter, urut & unik', () => {
    const a = Array.from({ length: 500 }, () => ulid())
    expect(new Set(a).size).toBe(500)
    expect(a.every((x) => /^[0-9A-HJKMNP-TV-Z]{26}$/.test(x))).toBe(true)
    expect([...a].sort()).toEqual(a)
    expect(ulid(0) > '0').toBe(true)
  })

  it('pekan Ahad–Sabtu dan aritmetika tanggal', () => {
    expect(hariDalamPekan('2026-11-01')).toBe(0)
    expect(awalPekan('2026-11-07')).toBe('2026-11-01')
    expect(awalPekan('2026-11-08')).toBe('2026-11-08')
    expect(akhirPekan('2026-11-01')).toBe('2026-11-07')
    expect(tambahHari('2026-12-31', 1)).toBe('2027-01-01')
    expect(selisihHari('2026-11-01', '2026-11-15')).toBe(14)
    expect(tanggalSah('2026-02-29')).toBe(false)
    expect(tanggalSah('2028-02-29')).toBe(true)
    expect(tanggalSah(5)).toBe(false)
    expect(() => tambahHari('x', 1)).toThrow()
    expect(umurPada('2016-11-15', '2026-11-14')).toBe(9)
    expect(umurPada('2016-11-14', '2026-11-14')).toBe(10)
    expect(formatTanggal('2026-08-17')).toBe('17 Agu 2026')
    expect(tambahHariIso('2026-11-01T00:00:00.000Z', 2)).toBe('2026-11-03T00:00:00.000Z')
    expect(kategoriDariUmur('2024-01-01', '2026-11-01')).toBe('paud')
    expect(kategoriDariUmur('2012-01-01', '2026-11-01')).toBe('praremaja')
    expect(kategoriDariUmur('2009-01-01', '2026-11-01')).toBe('remaja')
    expect(kategoriDariUmur('2000-01-01', '2026-11-01')).toBe('pranikah')
  })

  it('jam uji', () => {
    aturJam(() => new Date('2026-11-14T03:00:00.000Z'))
    expect(sekarangIso()).toBe('2026-11-14T03:00:00.000Z')
    expect(tanggalHariIni()).toBe(tanggalDariIso('2026-11-14T03:00:00.000Z'))
    expect(tanggalRingkas('2026-11-14')).toBe('20261114')
    aturJam(null)
    expect(Math.abs(Date.parse(sekarangIso()) - Date.now())).toBeLessThan(1000)
  })

  it('GalatPpg', () => {
    const e = new GalatPpg('KODE', 'pesan')
    expect(adalahGalatPpg(e)).toBe(true)
    expect(adalahGalatPpg(e, 'LAIN')).toBe(false)
    expect(adalahGalatPpg(new Error('x'))).toBe(false)
    expect(() => pastikan(false, 'K', 'p')).toThrow(e.constructor)
    expect(() => pastikan(true, 'K', 'p')).not.toThrow()
  })
})

describe('db & skema', () => {
  it('transaksi: commit, rollback, bersarang (savepoint), pendengar perubahan', async () => {
    const db = await bukaDb()
    let n = 0
    const lepas = db.saatBerubah(() => n++)
    db.saatBerubah(() => {
      throw new Error('pendengar rusak tidak menggagalkan')
    })
    aturMeta(db, 'a', 1)
    expect(n).toBe(1)
    expect(() =>
      db.transaksi(() => {
        aturMeta(db, 'b', 1)
        throw new Error('gagal')
      }),
    ).toThrow('gagal')
    expect(db.nilai('SELECT nilai FROM meta WHERE kunci = ?', ['b'])).toBeUndefined()
    expect(n).toBe(1)
    db.transaksi(() => {
      aturMeta(db, 'c', 1)
      expect(() =>
        db.transaksi(() => {
          aturMeta(db, 'd', 1)
          throw new Error('dalam')
        }),
      ).toThrow('dalam')
      expect(() => db.ekspor()).toThrow(/transaksi/)
    })
    expect(db.nilai('SELECT nilai FROM meta WHERE kunci = ?', ['c'])).toBe('1')
    expect(db.nilai('SELECT nilai FROM meta WHERE kunci = ?', ['d'])).toBeUndefined()
    expect(n).toBe(2)
    db.kueri('SELECT 1')
    expect(n).toBe(2)
    lepas()
    aturMeta(db, 'e', 1)
    expect(n).toBe(2)
    db.tutup()
  })

  it('simpan & buka ulang; database rusak; skema lebih baru ditolak', async () => {
    const db = await bukaDb()
    aturMeta(db, 'x', 'y')
    const b = simpanDb(db)
    const db2 = await bukaDb(b)
    expect(db2.nilai("SELECT nilai FROM meta WHERE kunci = 'x'")).toBe('y')
    expect(db2.nilai("SELECT nilai FROM meta WHERE kunci = 'versi_skema'")).toBe(String(VERSI_SKEMA))
    migrasi(db2) // idempoten
    await expect(bukaDb(new TextEncoder().encode('bukan sqlite sama sekali, hanya teks biasa yang panjang'))).rejects.toMatchObject({ kode: 'DB_RUSAK' })
    aturMeta(db2, 'versi_skema', 99)
    expect(() => migrasi(db2)).toThrow(/lebih baru/)
  })

  it('siapkanSqlJs menerima wasmBinary (seperti di browser) dan di-cache', async () => {
    const req = createRequire(import.meta.url)
    const wasm = readFileSync(req.resolve('sql.js/dist/sql-wasm.wasm'))
    const a = await siapkanSqlJs({ wasmBinary: wasm, locateFile: (f) => f })
    const b = await siapkanSqlJs()
    expect(a).toBe(b)
  })

  it('pemetaan kurikulum sama dengan aplikasi lama (14 kategori)', () => {
    expect(Object.keys(PEMETAAN_MATERI)).toHaveLength(14)
    expect(PEMETAAN_MATERI['ALM-HDD']).toBe(PEMETAAN_MATERI['ALM-HDL'])
  })
})
