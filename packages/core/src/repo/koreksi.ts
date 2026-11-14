// Koreksi: catatan admin atas rekaman kegiatan (K5 — koreksi = catatan, bukan timpa).
import type { Db } from '../db'
import { GalatPpg } from '../galat'
import { infoTabel, type NamaTabelSinkron } from '../skema'
import { tanggalHariIni } from '../waktu'
import { ambilRekaman, pastikanAdmin, sisipkanRekaman, tandaTanya, type RekamanDasar } from './umum'

export interface Koreksi extends RekamanDasar {
  tabel: string
  rekaman_id: string
  untuk_perangkat_id: string
  catatan: string
  tanggal: string
}

/** Buat koreksi atas rekaman kegiatan; ditujukan ke perangkat pencatat aslinya (admin). */
export function buatKoreksi(db: Db, d: { tabel: NamaTabelSinkron; rekamanId: string; catatan: string }): Koreksi {
  pastikanAdmin(db)
  if (infoTabel(d.tabel)?.jenis !== 'kegiatan') throw new GalatPpg('TABEL_TIDAK_SAH', 'Koreksi hanya untuk data kegiatan.')
  const rek = ambilRekaman(db, d.tabel, d.rekamanId)
  if (!rek) throw new GalatPpg('TIDAK_DITEMUKAN', 'Rekaman yang dikoreksi tidak ditemukan.')
  if (!d.catatan?.trim()) throw new GalatPpg('CATATAN_KOSONG', 'Isi catatan koreksi.')
  return sisipkanRekaman<Koreksi>(db, 'koreksi', {
    tabel: d.tabel,
    rekaman_id: d.rekamanId,
    untuk_perangkat_id: rek.perangkat_id,
    catatan: d.catatan.trim(),
    tanggal: tanggalHariIni(),
  })
}

/** Daftar koreksi (opsional untuk perangkat tertentu). */
export function daftarKoreksi(db: Db, untukPerangkatIds?: string[]): Koreksi[] {
  if (!untukPerangkatIds) return db.kueri<Koreksi>('SELECT * FROM koreksi WHERE dihapus = 0 ORDER BY tanggal DESC')
  if (untukPerangkatIds.length === 0) return []
  return db.kueri<Koreksi>(
    `SELECT * FROM koreksi WHERE dihapus = 0 AND untuk_perangkat_id IN (${tandaTanya(untukPerangkatIds.length)}) ORDER BY tanggal DESC`,
    untukPerangkatIds,
  )
}
