// Penyimpanan database admin di disk: tulis atomik + cadangan otomatis harian (§11).
// Modul Node murni (tanpa electron) agar bisa diuji vitest.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const NAMA_DB = 'ppg-admin.db'
export const FOLDER_CADANGAN = 'cadangan'
/** Jumlah cadangan harian yang disimpan (yang lebih lama dihapus). */
export const SIMPAN_CADANGAN = 30

function tanggalRingkas(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`
}

/** Baca database dari folder data; null bila belum ada. */
export function muatDb(folder: string): Uint8Array | null {
  const berkas = join(folder, NAMA_DB)
  if (!existsSync(berkas)) return null
  return new Uint8Array(readFileSync(berkas))
}

/**
 * Simpan database secara atomik (tulis ke .tmp lalu rename). Sebelum menimpa, bila hari ini belum ada
 * cadangan, salinan database lama disimpan ke `cadangan/ppg-admin-YYYYMMDD.db`.
 * Mengembalikan path cadangan yang baru dibuat (bila ada).
 */
export function simpanDbAtomik(folder: string, bytes: Uint8Array, sekarang: Date = new Date()): string | null {
  if (!(bytes instanceof Uint8Array) || bytes.length < 100) throw new Error('Data database tidak sah.')
  mkdirSync(folder, { recursive: true })
  const berkas = join(folder, NAMA_DB)
  let cadangan: string | null = null
  if (existsSync(berkas)) {
    const folderCad = join(folder, FOLDER_CADANGAN)
    mkdirSync(folderCad, { recursive: true })
    const tujuan = join(folderCad, `ppg-admin-${tanggalRingkas(sekarang)}.db`)
    if (!existsSync(tujuan)) {
      copyFileSync(berkas, tujuan)
      cadangan = tujuan
      rampingkanCadangan(folderCad)
    }
  }
  const tmp = `${berkas}.tmp`
  writeFileSync(tmp, bytes)
  renameSync(tmp, berkas)
  return cadangan
}

/** Hapus cadangan harian lama, sisakan `SIMPAN_CADANGAN` terbaru. */
export function rampingkanCadangan(folderCad: string, simpan = SIMPAN_CADANGAN): void {
  const daftar = readdirSync(folderCad)
    .filter((n) => /^ppg-admin-\d{8}\.db$/.test(n))
    .sort()
  for (const n of daftar.slice(0, Math.max(0, daftar.length - simpan))) rmSync(join(folderCad, n), { force: true })
}
