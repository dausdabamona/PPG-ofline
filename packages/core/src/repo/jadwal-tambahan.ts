// Jadwal tambahan kelompok (K16), dibuat mubaligh.
import type { Db } from '../db'
import { GalatPpg } from '../galat'
import { tanggalSah } from '../waktu'
import { pastikanPencatat } from './kegiatan-umum'
import { ambilRekaman, sisipkanRekaman, ubahRekaman, type RekamanDasar } from './umum'

export interface JadwalTambahan extends RekamanDasar {
  kelompok_id: string
  tanggal: string
  jam: string | null
  judul: string
  keterangan: string | null
  dibatalkan: number
}

/** Buat jadwal tambahan (mubaligh kelompok). */
export function tambahJadwalTambahan(
  db: Db,
  d: { kelompokId: string; tanggal: string; jam?: string | null; judul: string; keterangan?: string | null },
): JadwalTambahan {
  if (!tanggalSah(d.tanggal)) throw new GalatPpg('TANGGAL_TIDAK_SAH', 'Tanggal tidak sah.')
  if (d.jam && !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.jam)) throw new GalatPpg('JAM_TIDAK_SAH', 'Jam harus berformat HH:MM.')
  if (!d.judul?.trim()) throw new GalatPpg('JUDUL_KOSONG', 'Judul jadwal wajib diisi.')
  pastikanPencatat(db, d.kelompokId, ['mubaligh'])
  return sisipkanRekaman<JadwalTambahan>(db, 'jadwal_tambahan', {
    kelompok_id: d.kelompokId,
    tanggal: d.tanggal,
    jam: d.jam ?? null,
    judul: d.judul.trim(),
    keterangan: d.keterangan ?? null,
    dibatalkan: 0,
  })
}

/** Ubah jadwal tambahan. */
export function ubahJadwalTambahan(
  db: Db,
  id: string,
  p: Partial<Pick<JadwalTambahan, 'tanggal' | 'jam' | 'judul' | 'keterangan'>>,
): JadwalTambahan {
  const j = ambilRekaman<JadwalTambahan>(db, 'jadwal_tambahan', id)
  if (!j) throw new GalatPpg('TIDAK_DITEMUKAN', 'Jadwal tidak ditemukan.')
  if (p.tanggal !== undefined && !tanggalSah(p.tanggal)) throw new GalatPpg('TANGGAL_TIDAK_SAH', 'Tanggal tidak sah.')
  pastikanPencatat(db, j.kelompok_id, ['mubaligh'])
  return ubahRekaman<JadwalTambahan>(db, 'jadwal_tambahan', id, p)
}

/** Batalkan jadwal tambahan (tetap tersimpan dengan tanda dibatalkan). */
export function batalkanJadwalTambahan(db: Db, id: string): JadwalTambahan {
  const j = ambilRekaman<JadwalTambahan>(db, 'jadwal_tambahan', id)
  if (!j) throw new GalatPpg('TIDAK_DITEMUKAN', 'Jadwal tidak ditemukan.')
  pastikanPencatat(db, j.kelompok_id, ['mubaligh'])
  return ubahRekaman<JadwalTambahan>(db, 'jadwal_tambahan', id, { dibatalkan: 1 })
}

/** Daftar jadwal tambahan kelompok (opsional mulai tanggal tertentu). */
export function daftarJadwalTambahan(db: Db, kelompokId: string, opsi: { mulai?: string; termasukBatal?: boolean } = {}): JadwalTambahan[] {
  const s = ['dihapus = 0', 'kelompok_id = ?']
  const p: string[] = [kelompokId]
  if (opsi.mulai) {
    s.push('tanggal >= ?')
    p.push(opsi.mulai)
  }
  if (!opsi.termasukBatal) s.push('dibatalkan = 0')
  return db.kueri<JadwalTambahan>(`SELECT * FROM jadwal_tambahan WHERE ${s.join(' AND ')} ORDER BY tanggal, jam`, p)
}
