// Platform palsu untuk uji jsdom: database di memori, antrean berkas "dipilih", catatan berkas/teks/tautan "dibagikan".
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import type { BerkasKirim, BerkasMasuk, Platform } from '../src/platform'

const require = createRequire(import.meta.url)
const wasm = readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm'))

export interface PlatformPalsu extends Platform {
  db: Uint8Array | null
  jumlahSimpan: number
  /** Berkas yang dikembalikan pada panggilan pilihBerkas berikutnya (FIFO). */
  antreanBuka: BerkasMasuk[][]
  dibagikan: BerkasKirim[]
  teks: string[]
  tautan: string[]
  pdf: string[]
  disalin: string[]
  /** Picu peristiwa "aplikasi ke latar belakang". */
  keLatar: () => void
  /** Kirim berkas seolah dibuka dari WA (intent). */
  kirimIntent: (b: BerkasMasuk) => void
}

export function buatPlatformPalsu(awal: Uint8Array | null = null): PlatformPalsu {
  const latar = new Set<() => void>()
  const masuk = new Set<(b: BerkasMasuk) => void>()
  const p: PlatformPalsu = {
    jenis: 'web',
    db: awal,
    jumlahSimpan: 0,
    antreanBuka: [],
    dibagikan: [],
    teks: [],
    tautan: [],
    pdf: [],
    disalin: [],
    keLatar: () => latar.forEach((f) => f()),
    kirimIntent: (b) => masuk.forEach((f) => f(b)),
    async opsiSqlJs() {
      return { wasmBinary: new Uint8Array(wasm) }
    },
    async muatDb() {
      return p.db ? new Uint8Array(p.db) : null
    },
    async simpanDb(b) {
      p.db = new Uint8Array(b)
      p.jumlahSimpan++
    },
    saatLatarBelakang(fn) {
      latar.add(fn)
      return () => latar.delete(fn)
    },
    async pilihBerkas() {
      return p.antreanBuka.shift() ?? []
    },
    saatBerkasMasuk(fn) {
      masuk.add(fn)
      return () => masuk.delete(fn)
    },
    async bagikanBerkas(daftar) {
      for (const b of daftar) p.dibagikan.push({ nama: b.nama, bytes: new Uint8Array(b.bytes) })
    },
    async bagikanTeks(t) {
      p.teks.push(t)
    },
    bukaTautan(url) {
      p.tautan.push(url)
    },
    async bukaPdf(nama) {
      p.pdf.push(nama)
    },
    async salinTeks(t) {
      p.disalin.push(t)
    },
  }
  return p
}
