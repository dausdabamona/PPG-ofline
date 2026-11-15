// Presensi pengajian (kegiatan, milik pencatat).
import type { Db } from '../db'
import { GalatPpg } from '../galat'
import { tanggalSah } from '../waktu'
import { ambilGenerus } from './generus'
import { pastikanPencatat, pemenangPerKunci } from './kegiatan-umum'
import { idPerangkatLokal, sisipkanRekaman, tandaTanya, ubahRekaman, type RekamanDasar } from './umum'

export type StatusPresensi = 'hadir' | 'izin' | 'sakit' | 'alpa'
export const STATUS_PRESENSI: readonly StatusPresensi[] = ['hadir', 'izin', 'sakit', 'alpa']

export interface Presensi extends RekamanDasar {
  kelompok_id: string
  pengajian_id: string | null
  jadwal_tambahan_id: string | null
  tanggal: string
  generus_id: string
  status: StatusPresensi
  /** v3: pertemuan tempat presensi dicatat (NULL untuk presensi lama). */
  pertemuan_id: string | null
  perangkat_id: string
  diubah_pada: string
  dihapus: number
}

export interface DataPresensi {
  kelompokId: string
  generusId: string
  tanggal: string
  status: StatusPresensi
  pengajianId?: string | null
  jadwalTambahanId?: string | null
  pertemuanId?: string | null
}

/** Kunci alami presensi: (tanggal, generus, pengajian, jadwal tambahan). */
export function kunciPresensi(p: Pick<Presensi, 'tanggal' | 'generus_id' | 'pengajian_id' | 'jadwal_tambahan_id'>): string {
  return `${p.tanggal}|${p.generus_id}|${p.pengajian_id ?? ''}|${p.jadwal_tambahan_id ?? ''}`
}

/** Catat (atau perbarui) presensi satu generus. Di HP butuh profil pengurus/mubaligh berwenang. */
export function catatPresensi(db: Db, d: DataPresensi): Presensi {
  if (!STATUS_PRESENSI.includes(d.status)) throw new GalatPpg('STATUS_TIDAK_SAH', 'Status presensi tidak dikenal.')
  if (!tanggalSah(d.tanggal)) throw new GalatPpg('TANGGAL_TIDAK_SAH', 'Tanggal presensi tidak sah.')
  const g = ambilGenerus(db, d.generusId)
  if (!g) throw new GalatPpg('GENERUS_TIDAK_ADA', 'Generus tidak ditemukan.')
  pastikanPencatat(db, d.kelompokId, ['pengurus', 'mubaligh', 'admin'])
  const saya = idPerangkatLokal(db)
  const ada = db.satu<Presensi>(
    `SELECT * FROM presensi WHERE perangkat_id = ? AND tanggal = ? AND generus_id = ?
       AND IFNULL(pengajian_id, '') = ? AND IFNULL(jadwal_tambahan_id, '') = ?`,
    [saya, d.tanggal, d.generusId, d.pengajianId ?? '', d.jadwalTambahanId ?? ''],
  )
  if (ada) {
    const p: Record<string, unknown> = { status: d.status, kelompok_id: d.kelompokId, dihapus: 0 }
    if (d.pertemuanId !== undefined) p.pertemuan_id = d.pertemuanId
    return ubahRekaman<Presensi>(db, 'presensi', ada.id, p)
  }
  return sisipkanRekaman<Presensi>(db, 'presensi', {
    kelompok_id: d.kelompokId,
    pengajian_id: d.pengajianId ?? null,
    jadwal_tambahan_id: d.jadwalTambahanId ?? null,
    tanggal: d.tanggal,
    generus_id: d.generusId,
    status: d.status,
    pertemuan_id: d.pertemuanId ?? null,
  })
}

/** Catat presensi banyak generus sekaligus untuk satu pertemuan (satu transaksi). */
export function catatPresensiMassal(
  db: Db,
  d: { kelompokId: string; tanggal: string; pengajianId?: string | null; jadwalTambahanId?: string | null; daftar: { generusId: string; status: StatusPresensi }[] },
): Presensi[] {
  return db.transaksi(() =>
    d.daftar.map((x) =>
      catatPresensi(db, {
        kelompokId: d.kelompokId,
        tanggal: d.tanggal,
        pengajianId: d.pengajianId ?? null,
        jadwalTambahanId: d.jadwalTambahanId ?? null,
        generusId: x.generusId,
        status: x.status,
      }),
    ),
  )
}

/** Daftar presensi (sudah dideduplikasi per kunci alami; yang terhapus dibuang). */
export function daftarPresensi(
  db: Db,
  f: { kelompokIds?: string[]; generusIds?: string[]; mulai?: string; selesai?: string; pengajianId?: string } = {},
): Presensi[] {
  const s: string[] = []
  const p: string[] = []
  if (f.kelompokIds) {
    if (!f.kelompokIds.length) return []
    s.push(`kelompok_id IN (${tandaTanya(f.kelompokIds.length)})`)
    p.push(...f.kelompokIds)
  }
  if (f.generusIds) {
    if (!f.generusIds.length) return []
    s.push(`generus_id IN (${tandaTanya(f.generusIds.length)})`)
    p.push(...f.generusIds)
  }
  if (f.mulai) {
    s.push('tanggal >= ?')
    p.push(f.mulai)
  }
  if (f.selesai) {
    s.push('tanggal <= ?')
    p.push(f.selesai)
  }
  if (f.pengajianId) {
    s.push('pengajian_id = ?')
    p.push(f.pengajianId)
  }
  const baris = db.kueri<Presensi>(`SELECT * FROM presensi ${s.length ? 'WHERE ' + s.join(' AND ') : ''} ORDER BY tanggal`, p)
  return pemenangPerKunci(baris, kunciPresensi)
}
