// @vitest-environment node
// Uji penyimpanan proses utama: simpan atomik, cadangan harian, perampingan cadangan.
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FOLDER_CADANGAN, NAMA_DB, muatDb, rampingkanCadangan, simpanDbAtomik } from '../electron/penyimpanan'

const isi = (n: number) => new Uint8Array(200).fill(n)

describe('penyimpanan database admin', () => {
  it('muat null bila belum ada; simpan atomik; cadangan sekali per hari', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ppg-'))
    expect(muatDb(dir)).toBeNull()
    expect(simpanDbAtomik(dir, isi(1), new Date(2026, 10, 14))).toBeNull() // belum ada db lama → tanpa cadangan
    expect(muatDb(dir)).toEqual(isi(1))
    const c = simpanDbAtomik(dir, isi(2), new Date(2026, 10, 14, 9))
    expect(c).toBe(join(dir, FOLDER_CADANGAN, 'ppg-admin-20261114.db'))
    expect(new Uint8Array(readFileSync(c!))).toEqual(isi(1))
    expect(simpanDbAtomik(dir, isi(3), new Date(2026, 10, 14, 15))).toBeNull() // hari yang sama: cadangan tidak ditimpa
    expect(new Uint8Array(readFileSync(c!))).toEqual(isi(1))
    expect(simpanDbAtomik(dir, isi(4), new Date(2026, 10, 15))).toBe(join(dir, FOLDER_CADANGAN, 'ppg-admin-20261115.db'))
    expect(muatDb(dir)).toEqual(isi(4))
    expect(existsSync(join(dir, `${NAMA_DB}.tmp`))).toBe(false)
  })

  it('menolak data kosong/rusak dan merampingkan cadangan lama', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ppg-'))
    expect(() => simpanDbAtomik(dir, new Uint8Array(3))).toThrow()
    const cad = join(dir, FOLDER_CADANGAN)
    mkdirSync(cad, { recursive: true })
    for (let i = 1; i <= 35; i++) writeFileSync(join(cad, `ppg-admin-202610${String(i).padStart(2, '0')}.db`), 'x')
    writeFileSync(join(cad, 'catatan.txt'), 'biarkan')
    rampingkanCadangan(cad, 30)
    const sisa = readdirSync(cad).filter((n) => n.endsWith('.db'))
    expect(sisa).toHaveLength(30)
    expect(sisa.sort()[0]).toBe('ppg-admin-20261006.db')
    expect(readdirSync(cad)).toContain('catatan.txt')
  })
})
