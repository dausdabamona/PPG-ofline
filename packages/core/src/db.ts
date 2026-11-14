// Pembungkus sql.js: satu API untuk Node (uji), Electron renderer, dan WebView Android.
import initSqlJs from 'sql.js'
import type { Database, SqlJsStatic, SqlValue } from 'sql.js'
import { GalatPpg } from './galat'

export type NilaiSql = string | number | null | Uint8Array
export type BarisSql = Record<string, NilaiSql>

/** Opsi inisialisasi sql.js. Di browser beri `locateFile` (URL berkas .wasm) atau `wasmBinary`. */
export interface OpsiSqlJs {
  locateFile?: (namaBerkas: string) => string
  wasmBinary?: ArrayBuffer | Uint8Array
}

let janjiSql: Promise<SqlJsStatic> | null = null

/** Siapkan modul sql.js (di-cache; opsi hanya dipakai pada panggilan pertama). */
export function siapkanSqlJs(opsi: OpsiSqlJs = {}): Promise<SqlJsStatic> {
  if (!janjiSql) {
    const konfigurasi: Record<string, unknown> = {}
    if (opsi.locateFile) konfigurasi.locateFile = opsi.locateFile
    if (opsi.wasmBinary) konfigurasi.wasmBinary = opsi.wasmBinary
    janjiSql = initSqlJs(konfigurasi as Parameters<typeof initSqlJs>[0]).catch((e: unknown) => {
      janjiSql = null
      throw e
    })
  }
  return janjiSql
}

/** Database lokal PPG (sql.js) dengan pembantu kueri dan transaksi. */
export class Db {
  readonly sql: Database
  private kedalaman = 0
  private pendengar = new Set<() => void>()
  private berubah = false

  constructor(sql: Database) {
    this.sql = sql
  }

  /** Jalankan pernyataan tanpa hasil. */
  jalankan(perintah: string, param: NilaiSql[] | Record<string, NilaiSql> = []): void {
    this.sql.run(perintah, param as SqlValue[])
    this.tandaiBerubah(perintah)
  }

  /** Jalankan beberapa pernyataan sekaligus (DDL). */
  jalankanSkrip(skrip: string): void {
    this.sql.exec(skrip)
    this.tandaiBerubah('X')
  }

  /** Kueri → array baris objek. */
  kueri<T = BarisSql>(perintah: string, param: NilaiSql[] | Record<string, NilaiSql> = []): T[] {
    const st = this.sql.prepare(perintah)
    try {
      st.bind(param as SqlValue[])
      const hasil: T[] = []
      while (st.step()) hasil.push(st.getAsObject() as T)
      return hasil
    } finally {
      st.free()
    }
  }

  /** Kueri satu baris (atau undefined). */
  satu<T = BarisSql>(perintah: string, param: NilaiSql[] | Record<string, NilaiSql> = []): T | undefined {
    return this.kueri<T>(perintah, param)[0]
  }

  /** Nilai kolom pertama baris pertama. */
  nilai<T = NilaiSql>(perintah: string, param: NilaiSql[] | Record<string, NilaiSql> = []): T | undefined {
    const st = this.sql.prepare(perintah)
    try {
      st.bind(param as SqlValue[])
      return st.step() ? (st.get()[0] as T) : undefined
    } finally {
      st.free()
    }
  }

  /** Jalankan fn dalam transaksi (bersarang memakai SAVEPOINT). Rollback bila melempar. */
  transaksi<T>(fn: () => T): T {
    const nama = `sp${this.kedalaman}`
    this.sql.run(this.kedalaman === 0 ? 'BEGIN' : `SAVEPOINT ${nama}`)
    this.kedalaman++
    try {
      const hasil = fn()
      this.kedalaman--
      this.sql.run(this.kedalaman === 0 ? 'COMMIT' : `RELEASE ${nama}`)
      if (this.kedalaman === 0) this.kabari()
      return hasil
    } catch (e) {
      this.kedalaman--
      if (this.kedalaman === 0) {
        this.sql.run('ROLLBACK')
        this.berubah = false
      } else {
        this.sql.run(`ROLLBACK TO ${nama}`)
        this.sql.run(`RELEASE ${nama}`)
      }
      throw e
    }
  }

  /** Daftarkan pendengar perubahan (mis. simpan ke IndexedDB dengan debounce). Kembalikan fungsi lepas. */
  saatBerubah(fn: () => void): () => void {
    this.pendengar.add(fn)
    return () => this.pendengar.delete(fn)
  }

  /** Ekspor seluruh database sebagai byte (untuk disimpan ke berkas/IndexedDB). */
  ekspor(): Uint8Array {
    if (this.kedalaman > 0) throw new GalatPpg('DB_SIBUK', 'Tidak bisa menyimpan saat transaksi berjalan.')
    return this.sql.export()
  }

  /** Tutup database. */
  tutup(): void {
    this.sql.close()
  }

  private tandaiBerubah(perintah: string): void {
    if (/^\s*(select|pragma)/i.test(perintah)) return
    this.berubah = true
    if (this.kedalaman === 0) this.kabari()
  }

  private kabari(): void {
    if (!this.berubah) return
    this.berubah = false
    for (const fn of this.pendengar) {
      try {
        fn()
      } catch {
        // pendengar tidak boleh menggagalkan penulisan
      }
    }
  }
}

/**
 * Buka database: kosong (bytes tidak diberikan) atau dari byte hasil `simpanDb`.
 * Skema dibuat/dimigrasikan otomatis (lihat skema.ts) oleh pemanggil `bukaDbPpg`.
 */
export async function bukaDbMentah(bytes?: Uint8Array, opsi: OpsiSqlJs = {}): Promise<Db> {
  const SQL = await siapkanSqlJs(opsi)
  let sql: Database
  try {
    sql = bytes && bytes.length > 0 ? new SQL.Database(bytes) : new SQL.Database()
    sql.exec('PRAGMA foreign_keys = OFF')
    sql.exec('SELECT count(*) FROM sqlite_master') // paksa baca header: berkas rusak terdeteksi di sini
  } catch (e) {
    throw new GalatPpg('DB_RUSAK', 'Berkas database tidak bisa dibuka atau rusak.', e)
  }
  return new Db(sql)
}

/** Ekspor database ke byte. */
export function simpanDb(db: Db): Uint8Array {
  return db.ekspor()
}

import { migrasi } from './skema'
import { siapkanKripto } from './crypto'

/**
 * Buka database PPG: kosong (tanpa `bytes`) atau dari byte tersimpan; skema dibuat/dimigrasikan otomatis.
 * Pustaka kripto ikut disiapkan, sehingga semua fungsi sinkron aman dipanggil sesudahnya.
 * Di Node tidak perlu opsi; di browser beri `{ locateFile: () => urlWasm }` atau `{ wasmBinary }`.
 */
export async function bukaDb(bytes?: Uint8Array, opsi: OpsiSqlJs = {}): Promise<Db> {
  await siapkanKripto()
  const db = await bukaDbMentah(bytes, opsi)
  migrasi(db)
  return db
}
