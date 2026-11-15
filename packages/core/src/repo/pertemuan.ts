// v3 — pertemuan kelas (V4): materi yang diajarkan per pertemuan, presensi per pertemuan, tandai materi tuntas.
import type { Db } from '../db'
import { GalatPpg } from '../galat'
import { materiSelesaiDisahkan } from '../kurikulum'
import { tanggalSah, sekarangIso } from '../waktu'
import { ambilGenerus } from './generus'
import { pastikanPencatat } from './kegiatan-umum'
import type { KemajuanBelajar } from './kemajuan'
import { ambilMateri } from './materi'
import { ambilRekaman, idPerangkatLokal, sisipkanRekaman, ubahRekaman, uraiJson, type RekamanDasar } from './umum'
import { catatPresensi, STATUS_PRESENSI, type StatusPresensi } from './presensi'

export interface Pertemuan extends RekamanDasar {
  kelompok_id: string
  pengajian_id: string | null
  jadwal_tambahan_id: string | null
  tanggal: string
  materi_ids_json: string
  catatan: string | null
}

export interface PertemuanRinci extends Pertemuan {
  materi_ids: string[]
}

function rinci(p: Pertemuan): PertemuanRinci {
  return { ...p, materi_ids: uraiJson<string[]>(p.materi_ids_json, []) }
}

/** Ambil pertemuan (dengan materi_ids). */
export function ambilPertemuan(db: Db, id: string): PertemuanRinci | undefined {
  const p = ambilRekaman<Pertemuan>(db, 'pertemuan', id)
  return p ? rinci(p) : undefined
}

function pastikanMateri(db: Db, ids: string[]): string[] {
  const u = [...new Set(ids)]
  for (const id of u) {
    const m = ambilMateri(db, id)
    if (!m || m.dihapus) throw new GalatPpg('MATERI_TIDAK_ADA', 'Materi tidak ditemukan. Buka berkas materi terbaru dulu.')
  }
  return u
}

/**
 * Buka (atau perbarui) pertemuan kelas: kelompok, tanggal, pengajian rutin / jadwal tambahan, materi yang diajarkan hari itu.
 * Satu pertemuan per (pencatat, kelompok, tanggal, pengajian, jadwal tambahan). Di HP butuh profil pengurus/mubaligh/EXE berwenang.
 */
export function bukaPertemuan(
  db: Db,
  d: { kelompokId: string; tanggal: string; pengajianId?: string | null; jadwalTambahanId?: string | null; materiIds?: string[]; catatan?: string | null },
): PertemuanRinci {
  if (!tanggalSah(d.tanggal)) throw new GalatPpg('TANGGAL_TIDAK_SAH', 'Tanggal pertemuan tidak sah.')
  pastikanPencatat(db, d.kelompokId, ['pengurus', 'mubaligh', 'admin'])
  const materi = pastikanMateri(db, d.materiIds ?? [])
  const saya = idPerangkatLokal(db)
  const ada = db.satu<Pertemuan>(
    `SELECT * FROM pertemuan WHERE perangkat_id = ? AND kelompok_id = ? AND tanggal = ? AND IFNULL(pengajian_id, '') = ? AND IFNULL(jadwal_tambahan_id, '') = ?`,
    [saya, d.kelompokId, d.tanggal, d.pengajianId ?? '', d.jadwalTambahanId ?? ''],
  )
  if (ada) {
    const p: Record<string, unknown> = { materi_ids_json: JSON.stringify(materi), dihapus: 0 }
    if (d.catatan !== undefined) p.catatan = d.catatan
    return rinci(ubahRekaman<Pertemuan>(db, 'pertemuan', ada.id, p))
  }
  return rinci(
    sisipkanRekaman<Pertemuan>(db, 'pertemuan', {
      kelompok_id: d.kelompokId,
      pengajian_id: d.pengajianId ?? null,
      jadwal_tambahan_id: d.jadwalTambahanId ?? null,
      tanggal: d.tanggal,
      materi_ids_json: JSON.stringify(materi),
      catatan: d.catatan ?? null,
    }),
  )
}

/** Ganti materi pertemuan (mubaligh memilih materi hari ini). */
export function aturMateriPertemuan(db: Db, pertemuanId: string, materiIds: string[]): PertemuanRinci {
  const p = ambilPertemuan(db, pertemuanId)
  if (!p || p.dihapus) throw new GalatPpg('TIDAK_DITEMUKAN', 'Pertemuan tidak ditemukan.')
  pastikanPencatat(db, p.kelompok_id, ['pengurus', 'mubaligh', 'admin'])
  return rinci(ubahRekaman<Pertemuan>(db, 'pertemuan', p.id, { materi_ids_json: JSON.stringify(pastikanMateri(db, materiIds)) }))
}

/** Daftar pertemuan kelompok (urut tanggal), opsional rentang. */
export function daftarPertemuan(db: Db, kelompokId: string, o: { mulai?: string; selesai?: string } = {}): PertemuanRinci[] {
  const s = ['kelompok_id = ?', 'dihapus = 0']
  const p: string[] = [kelompokId]
  if (o.mulai) {
    s.push('tanggal >= ?')
    p.push(o.mulai)
  }
  if (o.selesai) {
    s.push('tanggal <= ?')
    p.push(o.selesai)
  }
  return db.kueri<Pertemuan>(`SELECT * FROM pertemuan WHERE ${s.join(' AND ')} ORDER BY tanggal, diubah_pada`, p).map(rinci)
}

/**
 * Tandai satu materi tuntas untuk satu generus (dari pertemuan): `kemajuan_belajar` sumber mubaligh, status selesai,
 * langsung disahkan (V4). Bila sudah disahkan selesai sebelumnya, tidak dicatat ulang (kembalikan null).
 */
export function tandaiTuntas(db: Db, d: { generusId: string; materiId: string; tanggal: string; kelompokId?: string; catatan?: string | null }): KemajuanBelajar | null {
  const g = ambilGenerus(db, d.generusId)
  if (!g || g.dihapus) throw new GalatPpg('GENERUS_TIDAK_ADA', 'Generus tidak ditemukan.')
  if (g.status !== 'aktif') throw new GalatPpg('GENERUS_TIDAK_AKTIF', `${g.nama} tidak berstatus aktif.`)
  const kelompokId = d.kelompokId ?? g.kelompok_id
  const m = pastikanPencatat(db, kelompokId, ['mubaligh', 'admin'], 'sahkan')
  pastikanMateri(db, [d.materiId])
  if (materiSelesaiDisahkan(db, g.id).has(d.materiId)) return null
  return sisipkanRekaman<KemajuanBelajar>(db, 'kemajuan_belajar', {
    generus_id: g.id,
    kelompok_id: kelompokId,
    materi_id: d.materiId,
    status: 'selesai',
    nilai: null,
    level: null,
    tanggal: d.tanggal,
    sumber: 'mubaligh',
    status_sah: 'disahkan',
    disahkan_oleh: m?.nama ?? 'Admin',
    disahkan_pada: sekarangIso(),
    catatan_generus: null,
    catatan_mubaligh: d.catatan ?? null,
  })
}

export interface IsianAbsen {
  generusId: string
  status: StatusPresensi
  /** Materi pertemuan yang dituntaskan generus ini (hanya bila hadir). */
  tuntas?: string[]
}

/**
 * Absen pertemuan (layar "Absen" mubaligh): presensi tiap generus terikat pertemuan + tandai materi tuntas per generus
 * (hanya materi pertemuan, hanya yang hadir). Satu transaksi. Mengembalikan jumlah presensi & materi tuntas baru.
 */
export function absenPertemuan(db: Db, pertemuanId: string, daftar: IsianAbsen[]): { presensi: number; tuntas: number } {
  const p = ambilPertemuan(db, pertemuanId)
  if (!p || p.dihapus) throw new GalatPpg('TIDAK_DITEMUKAN', 'Pertemuan tidak ditemukan.')
  for (const x of daftar) if (!STATUS_PRESENSI.includes(x.status)) throw new GalatPpg('STATUS_TIDAK_SAH', 'Status presensi tidak dikenal.')
  return db.transaksi(() => {
    let tuntas = 0
    for (const x of daftar) {
      catatPresensi(db, {
        kelompokId: p.kelompok_id,
        generusId: x.generusId,
        tanggal: p.tanggal,
        status: x.status,
        pengajianId: p.pengajian_id,
        jadwalTambahanId: p.jadwal_tambahan_id,
        pertemuanId: p.id,
      })
      for (const mid of x.tuntas ?? []) {
        if (!p.materi_ids.includes(mid)) throw new GalatPpg('MATERI_BUKAN_PERTEMUAN', 'Materi tuntas harus salah satu materi pertemuan ini.')
        if (x.status !== 'hadir') throw new GalatPpg('TIDAK_HADIR', 'Materi hanya bisa dituntaskan generus yang hadir.')
        if (tandaiTuntas(db, { generusId: x.generusId, materiId: mid, tanggal: p.tanggal, kelompokId: p.kelompok_id })) tuntas++
      }
    }
    return { presensi: daftar.length, tuntas }
  })
}
