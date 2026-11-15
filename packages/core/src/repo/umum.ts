// Pembantu umum repositori: meta, nomor urut lokal, identitas pencatat, simpan/ubah rekaman tersinkron.
import type { BarisSql, Db, NilaiSql } from '../db'
import { GalatPpg } from '../galat'
import { ulid } from '../ids'
import { kolomLengkap, TABEL_SINKRON, type NamaTabelSinkron } from '../skema'
import { sekarangIso } from '../waktu'

/** Penanda perangkat_id untuk rekaman buatan admin. */
export const ID_ADMIN = 'ADMIN'

/** Ambil nilai meta (teks) atau undefined. */
export function ambilMeta(db: Db, kunci: string): string | undefined {
  const v = db.nilai<string | null>('SELECT nilai FROM meta WHERE kunci = ?', [kunci])
  return v ?? undefined
}

/** Simpan nilai meta (null = hapus). */
export function aturMeta(db: Db, kunci: string, nilai: string | number | null): void {
  if (nilai === null) db.jalankan('DELETE FROM meta WHERE kunci = ?', [kunci])
  else db.jalankan('INSERT OR REPLACE INTO meta (kunci, nilai) VALUES (?, ?)', [kunci, String(nilai)])
}

/** Ambil meta angka (default 0). */
export function ambilMetaAngka(db: Db, kunci: string, bawaan = 0): number {
  const v = ambilMeta(db, kunci)
  return v === undefined ? bawaan : Number(v)
}

/** Naikkan `meta.seq` dan kembalikan nilai barunya (§6: setiap tulis lokal). */
export function seqBerikut(db: Db): number {
  const n = ambilMetaAngka(db, 'seq') + 1
  aturMeta(db, 'seq', n)
  return n
}

/** Apakah database ini milik admin (EXE). */
export function adalahAdmin(db: Db): boolean {
  return ambilMeta(db, 'peran_db') === 'admin'
}

/** Apakah database ini EXE bawah (desa/kelompok/kurikulum) — v3. */
export function adalahExe(db: Db): boolean {
  return ambilMeta(db, 'peran_db') === 'exe'
}

/**
 * Peran instalasi (v3): 'daerah' (admin lama), 'desa', 'kelompok', 'kurikulum', 'hp', atau null (EXE belum diaktifkan / DB kosong).
 * Fase 9: 'super_hp' = database Super Admin HP (instalasi jenis EXE di dalam APK, token admin tingkat daerah).
 */
export type PeranInstalasi = 'daerah' | 'desa' | 'kelompok' | 'kurikulum' | 'hp' | 'super_hp'
export function peranInstalasi(db: Db): PeranInstalasi | null {
  const peran = ambilMeta(db, 'peran_db')
  if (peran === 'admin') return 'daerah'
  if (peran === 'hp') return 'hp'
  if (peran === 'exe') {
    const p = ambilMeta(db, 'peran_instalasi')
    return p === 'desa' || p === 'kelompok' || p === 'kurikulum' || p === 'super_hp' ? p : null
  }
  return null
}

/** perangkat_id pencatat lokal: 'ADMIN' di EXE, id identitas di HP. */
export function idPerangkatLokal(db: Db): string {
  if (adalahAdmin(db)) return ID_ADMIN
  const id = db.nilai<string>('SELECT id FROM identitas_perangkat LIMIT 1')
  if (!id) throw new GalatPpg('PERANGKAT_BELUM_SIAP', 'Perangkat belum diinisialisasi.')
  return id
}

/** Pastikan pemanggil adalah admin (data master hanya diubah admin, K5). */
export function pastikanAdmin(db: Db): void {
  if (!adalahAdmin(db)) {
    throw new GalatPpg('HANYA_ADMIN', 'Data master hanya bisa diubah oleh admin. Dari HP, ajukan sebagai usulan.')
  }
}

/** Pengelola kurikulum (V5): EXE daerah atau EXE kurikulum. */
export function pastikanPengelolaKurikulum(db: Db): void {
  if (adalahAdmin(db)) return
  if (ambilMeta(db, 'peran_db') === 'exe' && ambilMeta(db, 'peran_instalasi') === 'kurikulum') return
  throw new GalatPpg('HANYA_KURIKULUM', 'Kurikulum hanya dikelola di EXE daerah atau EXE kurikulum.')
}

/** Cap waktu yang dijamin lebih besar dari `sebelum` (agar last-writer-wins selalu maju). */
export function capWaktuSetelah(sebelum?: string | null): string {
  const kini = sekarangIso()
  if (!sebelum || kini > sebelum) return kini
  return new Date(new Date(sebelum).getTime() + 1).toISOString()
}

export type Rekaman = Record<string, NilaiSql> & { id: string }

/** Kolom bersama setiap rekaman tersinkron (untuk antarmuka entitas). */
export interface RekamanDasar {
  id: string
  perangkat_id: string
  dibuat_pada: string
  diubah_pada: string
  dihapus: number
  versi: number
  seq_lokal: number
}

/** Ambil satu rekaman tersinkron menurut id. */
export function ambilRekaman<T = Rekaman>(db: Db, tabel: NamaTabelSinkron, id: string): T | undefined {
  return db.satu<T>(`SELECT * FROM ${tabel} WHERE id = ?`, [id])
}

function kolomIsi(tabel: NamaTabelSinkron): readonly string[] {
  return TABEL_SINKRON[tabel].kolom
}

/**
 * Sisipkan rekaman baru di tabel tersinkron dengan kolom sinkron terisi.
 * `id` boleh diberikan (mis. kurikulum ber-id tetap); bila tidak, ULID baru.
 */
export function sisipkanRekaman<T = Rekaman>(
  db: Db,
  tabel: NamaTabelSinkron,
  data: Record<string, unknown>,
  opsi: { id?: string; perangkatId?: string } = {},
): T {
  const kini = sekarangIso()
  const rek: Record<string, NilaiSql> = { id: opsi.id ?? (data.id as string | undefined) ?? ulid() }
  for (const k of kolomIsi(tabel)) rek[k] = normalNilai(data[k])
  rek.perangkat_id = opsi.perangkatId ?? idPerangkatLokal(db)
  rek.dibuat_pada = kini
  rek.diubah_pada = kini
  rek.dihapus = 0
  rek.versi = 1
  rek.seq_lokal = seqBerikut(db)
  tulisBaris(db, tabel, rek)
  return rek as unknown as T
}

/** Ubah sebagian kolom isi rekaman; naikkan versi, diubah_pada, seq_lokal. */
export function ubahRekaman<T = Rekaman>(
  db: Db,
  tabel: NamaTabelSinkron,
  id: string,
  perubahan: Record<string, unknown>,
): T {
  const lama = ambilRekaman<Rekaman>(db, tabel, id)
  if (!lama) throw new GalatPpg('TIDAK_DITEMUKAN', `Data ${tabel} tidak ditemukan.`)
  const baru: Record<string, NilaiSql> = { ...lama }
  const izin = new Set<string>([...kolomIsi(tabel), 'dihapus'])
  for (const [k, v] of Object.entries(perubahan)) {
    if (!izin.has(k)) throw new GalatPpg('KOLOM_TIDAK_SAH', `Kolom ${k} tidak bisa diubah.`)
    baru[k] = normalNilai(v)
  }
  baru.versi = Number(lama.versi) + 1
  baru.diubah_pada = capWaktuSetelah(lama.diubah_pada as string)
  baru.seq_lokal = seqBerikut(db)
  tulisBaris(db, tabel, baru)
  return baru as unknown as T
}

/** Hapus lunak (dihapus = 1). */
export function hapusRekaman<T = Rekaman>(db: Db, tabel: NamaTabelSinkron, id: string): T {
  return ubahRekaman<T>(db, tabel, id, { dihapus: 1 })
}

/** Tulis baris lengkap (INSERT OR REPLACE) — dipakai juga oleh penggabungan. */
export function tulisBaris(db: Db, tabel: NamaTabelSinkron, rek: Record<string, NilaiSql>): void {
  const kolom = kolomLengkap(tabel)
  const nilai = kolom.map((k) => normalNilai(rek[k]))
  db.jalankan(
    `INSERT OR REPLACE INTO ${tabel} (${kolom.join(', ')}) VALUES (${kolom.map(() => '?').join(', ')})`,
    nilai,
  )
}

/** Ubah nilai JS ke nilai SQL (boolean → 0/1, undefined → null, objek → JSON). */
export function normalNilai(v: unknown): NilaiSql {
  if (v === undefined || v === null) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v === 'number' || typeof v === 'string' || v instanceof Uint8Array) return v
  return JSON.stringify(v)
}

/** Rekaman tanpa kolom lokal `seq_lokal` (untuk dikirim). */
export function tanpaSeq(rek: BarisSql): BarisSql {
  const { seq_lokal: _s, ...sisa } = rek
  return sisa
}

/** Urai JSON dengan nilai cadangan. */
export function uraiJson<T>(teks: unknown, cadangan: T): T {
  if (typeof teks !== 'string' || teks === '') return cadangan
  try {
    return JSON.parse(teks) as T
  } catch {
    return cadangan
  }
}

/** Placeholder '?, ?, ?' untuk klausa IN. */
export function tandaTanya(n: number): string {
  return Array.from({ length: n }, () => '?').join(', ')
}
