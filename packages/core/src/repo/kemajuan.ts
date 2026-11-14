// Kemajuan belajar generus (K7): diajukan generus → disahkan/ditolak mubaligh.
import type { Db } from '../db'
import { GalatPpg } from '../galat'
import { tanggalHariIni, tanggalSah } from '../waktu'
import { ambilMateri } from './materi'
import { ambilProfil, pastikanProfilBolehMencatat } from './profil'
import { idPerangkatLokal, sisipkanRekaman, tandaTanya, ubahRekaman, type RekamanDasar } from './umum'

export type StatusKemajuan = 'sedang' | 'selesai'
export type StatusSah = 'diajukan' | 'disahkan' | 'ditolak'

export interface KemajuanBelajar extends RekamanDasar {
  generus_id: string
  kelompok_id: string
  materi_id: string
  status: StatusKemajuan
  nilai: number | null
  level: number | null
  tanggal: string
  sumber: 'generus' | 'mubaligh'
  status_sah: StatusSah
  disahkan_oleh: string | null
  disahkan_pada: string | null
  catatan_generus: string | null
  catatan_mubaligh: string | null
  perangkat_id: string
  diubah_pada: string
  dihapus: number
}

export interface DataKemajuan {
  materiId: string
  status: StatusKemajuan
  nilai?: number | null
  level?: number | null
  tanggal?: string
  catatan?: string | null
}

/** Validasi isian kemajuan terhadap tipe materi (T6). */
export function validasiKemajuan(db: Db, d: DataKemajuan): void {
  if (d.status !== 'sedang' && d.status !== 'selesai') throw new GalatPpg('STATUS_TIDAK_SAH', 'Status harus "sedang" atau "selesai".')
  if (d.tanggal !== undefined && !tanggalSah(d.tanggal)) throw new GalatPpg('TANGGAL_TIDAK_SAH', 'Tanggal tidak sah.')
  const m = ambilMateri(db, d.materiId)
  if (!m || m.dihapus) throw new GalatPpg('MATERI_TIDAK_ADA', 'Materi tidak ditemukan. Buka berkas materi terbaru dulu.')
  if (d.nilai !== undefined && d.nilai !== null && !(Number.isInteger(d.nilai) && d.nilai >= 0 && d.nilai <= 100)) {
    throw new GalatPpg('NILAI_TIDAK_SAH', 'Nilai harus bilangan bulat 0–100.')
  }
  if (d.level !== undefined && d.level !== null) {
    if (m.tipe !== 'level') throw new GalatPpg('LEVEL_TIDAK_SAH', 'Level hanya untuk materi bertipe level.')
    if (!(Number.isInteger(d.level) && d.level >= 1 && d.level <= 5)) throw new GalatPpg('LEVEL_TIDAK_SAH', 'Level harus 1–5.')
  }
}

/**
 * Generus mencatat kemajuan (HP generus, profil tertentu). Rekaman milik profil yang masih
 * `diajukan` untuk materi yang sama diperbarui; selainnya dibuat rekaman baru.
 */
export function catatKemajuan(db: Db, profilId: string, d: DataKemajuan): KemajuanBelajar {
  const p = ambilProfil(db, profilId)
  if (!p || p.role !== 'generus') throw new GalatPpg('PROFIL_TIDAK_SAH', 'Pilih profil generus terlebih dahulu.')
  pastikanProfilBolehMencatat(p)
  if (!p.hak.includes('catat')) throw new GalatPpg('TIDAK_BERWENANG', 'Profil ini tidak berhak mencatat.')
  validasiKemajuan(db, d)
  const generusId = p.generus_ids[0]!
  const saya = idPerangkatLokal(db)
  const ada = db.satu<KemajuanBelajar>(
    `SELECT * FROM kemajuan_belajar WHERE generus_id = ? AND materi_id = ? AND perangkat_id = ? AND status_sah = 'diajukan' AND dihapus = 0
     ORDER BY diubah_pada DESC LIMIT 1`,
    [generusId, d.materiId, saya],
  )
  const isi = {
    status: d.status,
    nilai: d.nilai ?? null,
    level: d.level ?? null,
    tanggal: d.tanggal ?? tanggalHariIni(),
    catatan_generus: d.catatan ?? null,
  }
  if (ada) return ubahRekaman<KemajuanBelajar>(db, 'kemajuan_belajar', ada.id, isi)
  return sisipkanRekaman<KemajuanBelajar>(db, 'kemajuan_belajar', {
    generus_id: generusId,
    kelompok_id: p.wilayah_id,
    materi_id: d.materiId,
    ...isi,
    sumber: 'generus',
    status_sah: 'diajukan',
    disahkan_oleh: null,
    disahkan_pada: null,
    catatan_mubaligh: null,
  })
}

/** Daftar kemajuan dengan filter (yang terhapus tidak diambil). */
export function daftarKemajuan(
  db: Db,
  f: { generusIds?: string[]; kelompokId?: string; statusSah?: StatusSah; materiId?: string } = {},
): KemajuanBelajar[] {
  const s = ['dihapus = 0']
  const p: string[] = []
  if (f.generusIds) {
    if (!f.generusIds.length) return []
    s.push(`generus_id IN (${tandaTanya(f.generusIds.length)})`)
    p.push(...f.generusIds)
  }
  if (f.kelompokId) {
    s.push('kelompok_id = ?')
    p.push(f.kelompokId)
  }
  if (f.statusSah) {
    s.push('status_sah = ?')
    p.push(f.statusSah)
  }
  if (f.materiId) {
    s.push('materi_id = ?')
    p.push(f.materiId)
  }
  return db.kueri<KemajuanBelajar>(`SELECT * FROM kemajuan_belajar WHERE ${s.join(' AND ')} ORDER BY tanggal, diubah_pada`, p)
}
