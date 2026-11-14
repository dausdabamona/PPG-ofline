// Platform palsu untuk uji renderer tanpa Electron: menyimpan db di memori, antrean berkas "dibuka", daftar berkas "disimpan".
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import type { BerkasDibuka, BerkasDisimpan, FilterBerkas, Platform } from '../src/platform'

const require = createRequire(import.meta.url)

export interface PlatformPalsu extends Platform {
  db: Uint8Array | null
  jumlahSimpanDb: number
  /** Berkas yang akan dikembalikan pada panggilan bukaBanyak berikutnya (FIFO). */
  antreanBuka: BerkasDibuka[][]
  filterTerakhir: FilterBerkas[] | null
  tersimpan: BerkasDisimpan[]
  disalin: string[]
  penutup: (() => Promise<void>) | null
}

export function buatPlatformPalsu(awal: Uint8Array | null = null): PlatformPalsu {
  const wasm = readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm'))
  const p: PlatformPalsu = {
    db: awal,
    jumlahSimpanDb: 0,
    antreanBuka: [],
    filterTerakhir: null,
    tersimpan: [],
    disalin: [],
    penutup: null,
    async muatDb() {
      return p.db ? new Uint8Array(p.db) : null
    },
    async simpanDb(bytes) {
      p.db = new Uint8Array(bytes)
      p.jumlahSimpanDb++
    },
    async bukaBanyak(filter) {
      p.filterTerakhir = filter
      return p.antreanBuka.shift() ?? []
    },
    async simpanBerkas(nama, bytes) {
      p.tersimpan.push({ nama, bytes: new Uint8Array(bytes) })
      return `/uji/${nama}`
    },
    async simpanKeFolder(daftar) {
      for (const b of daftar) p.tersimpan.push({ nama: b.nama, bytes: new Uint8Array(b.bytes) })
      return '/uji'
    },
    saatAkanTutup(fn) {
      p.penutup = fn
    },
    async folderData() {
      return '/uji/userData'
    },
    async salinTeks(t) {
      p.disalin.push(t)
    },
    async opsiSqlJs() {
      return { wasmBinary: new Uint8Array(wasm) }
    },
  }
  return p
}
