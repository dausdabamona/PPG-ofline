// Platform palsu untuk uji jsdom: database di memori, antrean berkas "dipilih", catatan berkas/teks/tautan "dibagikan".
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { KELAS_PEMINDAI_NATIVE, type BerkasKirim, type BerkasMasuk, type IzinKamera, type PemindaiNative, type Platform } from '../src/platform'

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
  /** Tekan tombol kembali Android; true bila ditangani aplikasi, false bila aplikasi akan diperkecil. */
  tekanKembali: () => boolean
}

/** Pemindai native palsu: uji mengatur jawaban izin dan "mengarahkan kamera" ke isi QR dengan `pindai`. */
export interface PemindaiPalsu extends PemindaiNative {
  /** Jawaban dialog izin kamera berikutnya. */
  izin: IzinKamera
  dimintaIzin: number
  aktif: boolean
  jumlahMulai: number
  bukaPengaturanKe: number
  /** Kamera "melihat" QR berisi teks ini (diabaikan bila pemindai tidak aktif). */
  pindai: (teks: string) => void
}

export function buatPemindaiPalsu(): PemindaiPalsu {
  let hasil: ((t: string) => void) | null = null
  const pm: PemindaiPalsu = {
    izin: 'diizinkan',
    dimintaIzin: 0,
    aktif: false,
    jumlahMulai: 0,
    bukaPengaturanKe: 0,
    async mintaIzin() {
      pm.dimintaIzin++
      return pm.izin
    },
    async mulai(fn) {
      hasil = fn
      pm.aktif = true
      pm.jumlahMulai++
      document.documentElement.classList.add(KELAS_PEMINDAI_NATIVE)
    },
    async berhenti() {
      hasil = null
      pm.aktif = false
      document.documentElement.classList.remove(KELAS_PEMINDAI_NATIVE)
    },
    async bukaPengaturan() {
      pm.bukaPengaturanKe++
    },
    pindai(t) {
      if (pm.aktif && hasil) hasil(t)
    },
  }
  return pm
}

export function buatPlatformPalsu(awal: Uint8Array | null = null, opsi: { pemindai?: PemindaiPalsu } = {}): PlatformPalsu & { pemindai?: PemindaiPalsu } {
  const latar = new Set<() => void>()
  const masuk = new Set<(b: BerkasMasuk) => void>()
  const kembali = new Set<() => boolean>()
  const p: PlatformPalsu & { pemindai?: PemindaiPalsu } = {
    jenis: opsi.pemindai ? 'native' : 'web',
    pemindai: opsi.pemindai,
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
    tekanKembali: () => [...kembali].some((f) => f()),
    saatTombolKembali(fn) {
      kembali.add(fn)
      return () => kembali.delete(fn)
    },
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
