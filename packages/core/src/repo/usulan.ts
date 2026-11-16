// Usulan perubahan master dari HP (K6): menunggu sampai disetujui admin.
import type { Db } from '../db'
import { GalatPpg } from '../galat'
import { ulid } from '../ids'
import { pastikanPencatat } from './kegiatan-umum'
import { ambilRekaman, sisipkanRekaman, tandaTanya, uraiJson, type RekamanDasar } from './umum'

export type JenisUsulan =
  | 'tambah_generus'
  | 'ubah_generus'
  | 'tambah_jamaah'
  | 'pindah_kelompok'
  | 'ubah_status'
  /** Fase 9 (Super Admin HP): wilayah baru di bawah `kelompok_id` (= induk). */
  | 'tambah_wilayah'
  /** Fase 9 (Super Admin HP): pengajian/kelas rutin baru untuk wilayah `kelompok_id`. */
  | 'tambah_pengajian'
  /** §18 (Fase 12): HP jabatan Bidang Kurikulum menetapkan butir "Perlu Ditetapkan Kurikulum" — `kelompok_id` = wilayah token. */
  | 'tetapkan_kurikulum'
export const JENIS_USULAN: readonly JenisUsulan[] = [
  'tambah_generus',
  'ubah_generus',
  'tambah_jamaah',
  'pindah_kelompok',
  'ubah_status',
  'tambah_wilayah',
  'tambah_pengajian',
  'tetapkan_kurikulum',
]
/** Jenis usulan yang membuat rekaman baru: id-nya ditetapkan saat diajukan (`data.id`) dan dipakai daerah saat disetujui. */
const USULAN_REKAMAN_BARU: readonly JenisUsulan[] = ['tambah_generus', 'tambah_wilayah', 'tambah_pengajian']
export type StatusUsulan = 'menunggu' | 'disetujui' | 'ditolak'

export interface Usulan extends RekamanDasar {
  jenis: JenisUsulan
  data_json: string
  status: StatusUsulan
  alasan: string | null
  kelompok_id: string
}

/**
 * Bentuk `data` per jenis:
 * - tambah_generus: { nama, jenis_kelamin, tanggal_lahir?, kategori?, wali_nama?, wali_no_hp? }
 * - ubah_generus: { generus_id, perubahan: { nama?, jenis_kelamin?, tanggal_lahir?, kategori?, wali_nama?, wali_no_hp? } }
 * - tambah_jamaah: { nama, jenis_kelamin, tanggal_lahir?, no_hp? }
 * - pindah_kelompok: { generus_id, kelompok_tujuan_id, tanggal }
 * - ubah_status: { generus_id, status, tanggal, keterangan? }
 * - tambah_wilayah (Fase 9): { tingkat: 'desa'|'kelompok', nama, kode? } — `kelompokId` = induknya
 * - tambah_pengajian (Fase 9): { nama, jenis?, hari?, jam?, tempat?, kategori_generus?: string[] } — `kelompokId` = wilayahnya
 * Jenis tambah_* mendapat `data.id` (ULID) bila belum ada: rekaman yang dibuat daerah saat menyetujui memakai id itu.
 */
export function ajukanUsulan(db: Db, d: { jenis: JenisUsulan; kelompokId: string; data: Record<string, unknown> }): Usulan {
  if (!JENIS_USULAN.includes(d.jenis)) throw new GalatPpg('JENIS_TIDAK_SAH', 'Jenis usulan tidak dikenal.')
  const wajib: Record<JenisUsulan, string[]> = {
    tambah_generus: ['nama', 'jenis_kelamin'],
    ubah_generus: ['generus_id', 'perubahan'],
    tambah_jamaah: ['nama', 'jenis_kelamin'],
    pindah_kelompok: ['generus_id', 'kelompok_tujuan_id', 'tanggal'],
    ubah_status: ['generus_id', 'status', 'tanggal'],
    tambah_wilayah: ['tingkat', 'nama'],
    tambah_pengajian: ['nama'],
    tetapkan_kurikulum: ['kode'],
  }
  for (const k of wajib[d.jenis]) {
    if (d.data[k] === undefined || d.data[k] === null || d.data[k] === '') throw new GalatPpg('DATA_KURANG', `Isian ${k} wajib diisi.`)
  }
  if (d.jenis === 'tambah_wilayah' && d.data.tingkat !== 'desa' && d.data.tingkat !== 'kelompok') {
    throw new GalatPpg('TINGKAT_TIDAK_SAH', 'Wilayah baru berupa desa atau kelompok.')
  }
  pastikanPencatat(db, d.kelompokId, ['pengurus', 'mubaligh', 'admin'])
  const data = USULAN_REKAMAN_BARU.includes(d.jenis) && typeof d.data.id !== 'string' ? { ...d.data, id: ulid() } : d.data
  return sisipkanRekaman<Usulan>(db, 'usulan', {
    jenis: d.jenis,
    data_json: JSON.stringify(data),
    status: 'menunggu',
    alasan: null,
    kelompok_id: d.kelompokId,
  })
}

/** Ambil usulan + data terurai. */
export function ambilUsulan(db: Db, id: string): (Usulan & { data: Record<string, unknown> }) | undefined {
  const u = ambilRekaman<Usulan>(db, 'usulan', id)
  return u ? { ...u, data: uraiJson<Record<string, unknown>>(u.data_json, {}) } : undefined
}

/** Daftar usulan (filter status/kelompok). */
export function daftarUsulan(db: Db, f: { status?: StatusUsulan; kelompokIds?: string[] } = {}): (Usulan & { data: Record<string, unknown> })[] {
  const s = ['dihapus = 0']
  const p: string[] = []
  if (f.status) {
    s.push('status = ?')
    p.push(f.status)
  }
  if (f.kelompokIds) {
    if (!f.kelompokIds.length) return []
    s.push(`kelompok_id IN (${tandaTanya(f.kelompokIds.length)})`)
    p.push(...f.kelompokIds)
  }
  return db
    .kueri<Usulan>(`SELECT * FROM usulan WHERE ${s.join(' AND ')} ORDER BY dibuat_pada`, p)
    .map((u) => ({ ...u, data: uraiJson<Record<string, unknown>>(u.data_json, {}) }))
}
