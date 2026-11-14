// Pembantu bersama alur sinkron.
import { bacaBerkas, type BerkasTerbaca, type HeaderBerkas, type JenisBerkas } from '../berkas'
import { sha256Hex } from '../crypto'
import type { Db } from '../db'
import { GalatPpg } from '../galat'
import { ulid } from '../ids'
import { ambilMeta } from '../repo/umum'
import { sekarangIso } from '../waktu'

/** Kunci publik admin yang dipasang di HP (T2); melempar BELUM_AKTIVASI. */
export function kunciAdminTerpasang(db: Db): { orgId: string; signPub: string; boxPub: string } {
  const orgId = ambilMeta(db, 'org_id')
  const signPub = ambilMeta(db, 'admin_sign_pub')
  const boxPub = ambilMeta(db, 'admin_box_pub')
  if (!orgId || !signPub || !boxPub) {
    throw new GalatPpg('BELUM_AKTIVASI', 'HP ini belum diaktifkan. Tempel token dari admin/mubaligh terlebih dahulu.')
  }
  return { orgId, signPub, boxPub }
}

/** Baca berkas, pastikan jenis & organisasi cocok. */
export function bacaBerkasJenis(db: Db, bytes: Uint8Array, jenis: JenisBerkas): BerkasTerbaca {
  const b = bacaBerkas(bytes)
  if (b.header.jenis !== jenis) {
    throw new GalatPpg('JENIS_BERKAS_SALAH', `Berkas ini berjenis ${b.header.jenis}, bukan ${jenis}.`)
  }
  const org = ambilMeta(db, 'org_id')
  if (org && b.header.org_id !== org) throw new GalatPpg('ORG_BERBEDA', 'Berkas ini dari organisasi lain.')
  return b
}

/** Sidik (SHA-256) berkas untuk deteksi impor ganda. */
export function sidikBerkas(bytes: Uint8Array): string {
  return sha256Hex(bytes)
}

/** Ringkasan impor terdahulu untuk sidik yang sama, bila ada. */
export function imporTerdahulu<T>(db: Db, sidik: string): T | undefined {
  const r = db.nilai<string>('SELECT ringkasan_json FROM riwayat_impor WHERE sidik = ? LIMIT 1', [sidik])
  return r ? (JSON.parse(r) as T) : undefined
}

/** Catat riwayat impor. */
export function catatImpor(db: Db, header: HeaderBerkas, ringkasan: unknown, sidik: string, namaBerkas?: string): void {
  db.jalankan('INSERT INTO riwayat_impor (id, jenis, nama_berkas, pengirim, tanggal, ringkasan_json, sidik) VALUES (?, ?, ?, ?, ?, ?, ?)', [
    ulid(),
    header.jenis,
    namaBerkas ?? null,
    header.pengirim_perangkat_id,
    sekarangIso(),
    JSON.stringify(ringkasan),
    sidik,
  ])
}

/** Daftar riwayat impor terbaru. */
export function daftarRiwayatImpor(db: Db, batas = 100): { id: string; jenis: string; nama_berkas: string | null; pengirim: string; tanggal: string; ringkasan: unknown }[] {
  return db
    .kueri<{ id: string; jenis: string; nama_berkas: string | null; pengirim: string; tanggal: string; ringkasan_json: string }>(
      'SELECT * FROM riwayat_impor ORDER BY tanggal DESC LIMIT ?',
      [batas],
    )
    .map(({ ringkasan_json, ...r }) => ({ ...r, ringkasan: JSON.parse(ringkasan_json ?? 'null') }))
}
