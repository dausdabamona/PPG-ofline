// v3 — kurikulum (V5): target capaian per kategori generus per periode, periode aktif, dan jadwal setor (V2).
import type { Db } from '../db'
import { GalatPpg } from '../galat'
import { KATEGORI_SAH, kategoriCocok, type KategoriGenerus } from './generus'
import { ambilMateri, daftarMateri, type MateriLengkap } from './materi'
import { ambilRekaman, pastikanAdmin, pastikanPengelolaKurikulum, sisipkanRekaman, ubahRekaman, type RekamanDasar } from './umum'
export { pastikanPengelolaKurikulum }
import { tanggalHariIni } from '../waktu'


// ---------------- periode ----------------

const POLA_PERIODE = /^\d{4}-S[12]$/

/** Apakah teks periode berbentuk 'YYYY-S1' / 'YYYY-S2'. */
export function periodeSah(p: unknown): p is string {
  return typeof p === 'string' && POLA_PERIODE.test(p)
}

/**
 * Periode menurut tanggal (tahun ajaran, V-T): Juli–Desember = `<tahun>-S1`, Januari–Juni = `<tahun−1>-S2`.
 * Mis. 2026-11-15 → '2026-S1', 2027-03-01 → '2026-S2'.
 */
export function periodeDariTanggal(tanggal: string = tanggalHariIni()): string {
  const y = Number(tanggal.slice(0, 4))
  const m = Number(tanggal.slice(5, 7))
  return m >= 7 ? `${y}-S1` : `${y - 1}-S2`
}

/** Periode aktif (master `pengaturan.periode_aktif`; bila belum diatur: periode tanggal hari ini). */
export function periodeAktif(db: Db, tanggal?: string): string {
  const r = ambilRekaman<{ isi: string | null; dihapus: number }>(db, 'pengaturan', 'periode_aktif')
  return r && !r.dihapus && periodeSah(r.isi) ? r.isi : periodeDariTanggal(tanggal)
}

/** Atur periode aktif (EXE daerah / kurikulum). */
export function aturPeriodeAktif(db: Db, periode: string): void {
  pastikanPengelolaKurikulum(db)
  if (!periodeSah(periode)) throw new GalatPpg('PERIODE_TIDAK_SAH', 'Periode harus berbentuk YYYY-S1 atau YYYY-S2.')
  if (ambilRekaman(db, 'pengaturan', 'periode_aktif')) ubahRekaman(db, 'pengaturan', 'periode_aktif', { isi: periode, dihapus: 0 })
  else sisipkanRekaman(db, 'pengaturan', { isi: periode }, { id: 'periode_aktif' })
}

// ---------------- target capaian ----------------

export interface TargetCapaian extends RekamanDasar {
  periode: string
  kategori_generus: KategoriGenerus
  materi_id: string
  urutan: number
}

/** Id tetap target (sama di semua instalasi): `TGT-<periode>-<kategori>-<materi_id>`. */
export const idTarget = (periode: string, kategori: string, materiId: string) => `TGT-${periode}-${kategori}-${materiId}`

/**
 * Tetapkan target capaian (V5): daftar materi wajib tuntas untuk satu kategori generus pada satu periode, berurutan.
 * Menggantikan daftar sebelumnya (materi yang tidak lagi ada di daftar dihapus lunak).
 */
export function tetapkanTarget(db: Db, o: { periode: string; kategoriGenerus: KategoriGenerus; materiIds: string[] }): TargetCapaian[] {
  pastikanPengelolaKurikulum(db)
  if (!periodeSah(o.periode)) throw new GalatPpg('PERIODE_TIDAK_SAH', 'Periode harus berbentuk YYYY-S1 atau YYYY-S2.')
  if (!KATEGORI_SAH.includes(o.kategoriGenerus)) throw new GalatPpg('KATEGORI_TIDAK_SAH', 'Kategori generus tidak dikenal.')
  const ids = [...new Set(o.materiIds)]
  for (const mid of ids) {
    const m = ambilMateri(db, mid)
    if (!m || m.dihapus) throw new GalatPpg('MATERI_TIDAK_ADA', `Materi ${mid} tidak ditemukan.`)
  }
  return db.transaksi(() => {
    const ada = db.kueri<TargetCapaian>('SELECT * FROM target_capaian WHERE periode = ? AND kategori_generus = ?', [o.periode, o.kategoriGenerus])
    for (const t of ada) if (!ids.includes(t.materi_id) && !t.dihapus) ubahRekaman(db, 'target_capaian', t.id, { dihapus: 1 })
    return ids.map((mid, i) => {
      const id = idTarget(o.periode, o.kategoriGenerus, mid)
      const lama = ada.find((t) => t.id === id)
      const isi = { periode: o.periode, kategori_generus: o.kategoriGenerus, materi_id: mid, urutan: i + 1 }
      if (!lama) return sisipkanRekaman<TargetCapaian>(db, 'target_capaian', isi, { id })
      if (lama.dihapus || lama.urutan !== i + 1) return ubahRekaman<TargetCapaian>(db, 'target_capaian', id, { ...isi, dihapus: 0 })
      return lama
    })
  })
}

export interface ItemTargetMateri extends MateriLengkap {
  urutan_target: number
  kategori_target: KategoriGenerus
}

/** Daftar target periode (opsional per kategori), urut kategori lalu urutan, beserta data materi. */
export function daftarTarget(db: Db, o: { periode?: string; kategoriGenerus?: string | string[] } = {}): ItemTargetMateri[] {
  const periode = o.periode ?? periodeAktif(db)
  const kat = o.kategoriGenerus === undefined ? null : Array.isArray(o.kategoriGenerus) ? o.kategoriGenerus : [o.kategoriGenerus]
  const materi = new Map(daftarMateri(db).map((m) => [m.id, m]))
  return db
    .kueri<TargetCapaian>('SELECT * FROM target_capaian WHERE periode = ? AND dihapus = 0 ORDER BY kategori_generus, urutan', [periode])
    .filter((t) => !kat || kat.some((k) => kategoriCocok(k, t.kategori_generus)))
    .flatMap((t) => {
      const m = materi.get(t.materi_id)
      return m ? [{ ...m, urutan_target: Number(t.urutan), kategori_target: t.kategori_generus }] : []
    })
}

// ---------------- jadwal setor (V2) ----------------

export type TingkatAsalSetor = 'kelompok' | 'desa'
export type PolaSetor = 'pekanan' | 'bulanan'

export interface JadwalSetor extends RekamanDasar {
  tingkat_asal: TingkatAsalSetor
  pola: PolaSetor
  /** 0 = Ahad … 6 = Sabtu (pekanan). */
  hari: number | null
  /** 1–28 (bulanan). */
  tanggal_bulan: number | null
  /** 'HH:MM' batas waktu pada hari tenggat (bawaan 23:59). */
  jam: string | null
}

/**
 * Atur jadwal setor satu tingkat (admin daerah, V2): mis. kelompok→desa tiap Ahad (`pekanan`, hari 0),
 * desa→daerah tiap tanggal 5 (`bulanan`, tanggal 5). Satu jadwal per tingkat asal (id tetap `JS-<tingkat>`).
 */
export function aturJadwalSetor(
  db: Db,
  o: { tingkatAsal: TingkatAsalSetor; pola: PolaSetor; hari?: number | null; tanggal?: number | null; jam?: string | null },
): JadwalSetor {
  pastikanAdmin(db)
  if (o.tingkatAsal !== 'kelompok' && o.tingkatAsal !== 'desa') throw new GalatPpg('TINGKAT_TIDAK_SAH', 'Jadwal setor untuk tingkat kelompok atau desa.')
  if (o.pola === 'pekanan') {
    if (!(Number.isInteger(o.hari) && o.hari! >= 0 && o.hari! <= 6)) throw new GalatPpg('HARI_TIDAK_SAH', 'Hari harus 0 (Ahad) sampai 6 (Sabtu).')
  } else if (o.pola === 'bulanan') {
    if (!(Number.isInteger(o.tanggal) && o.tanggal! >= 1 && o.tanggal! <= 28)) throw new GalatPpg('TANGGAL_TIDAK_SAH', 'Tanggal setor bulanan 1–28.')
  } else throw new GalatPpg('POLA_TIDAK_SAH', 'Pola jadwal setor: mingguan atau bulanan.')
  if (o.jam && !/^([01]\d|2[0-3]):[0-5]\d$/.test(o.jam)) throw new GalatPpg('JAM_TIDAK_SAH', 'Jam harus berformat HH:MM.')
  const id = `JS-${o.tingkatAsal}`
  const isi = {
    tingkat_asal: o.tingkatAsal,
    pola: o.pola,
    hari: o.pola === 'pekanan' ? o.hari : null,
    tanggal_bulan: o.pola === 'bulanan' ? o.tanggal : null,
    jam: o.jam ?? null,
  }
  if (ambilRekaman(db, 'jadwal_setor', id)) return ubahRekaman<JadwalSetor>(db, 'jadwal_setor', id, { ...isi, dihapus: 0 })
  return sisipkanRekaman<JadwalSetor>(db, 'jadwal_setor', isi, { id })
}

/** Hapus jadwal setor satu tingkat (admin daerah). */
export function hapusJadwalSetor(db: Db, tingkatAsal: TingkatAsalSetor): void {
  pastikanAdmin(db)
  if (ambilRekaman(db, 'jadwal_setor', `JS-${tingkatAsal}`)) ubahRekaman(db, 'jadwal_setor', `JS-${tingkatAsal}`, { dihapus: 1 })
}

/** Jadwal setor untuk tingkat asal (atau undefined). */
export function jadwalSetorUntuk(db: Db, tingkatAsal: TingkatAsalSetor): JadwalSetor | undefined {
  const j = db.satu<JadwalSetor>('SELECT * FROM jadwal_setor WHERE tingkat_asal = ? AND dihapus = 0 ORDER BY diubah_pada DESC LIMIT 1', [tingkatAsal])
  if (!j) return undefined
  return { ...j, hari: j.hari === null ? null : Number(j.hari), tanggal_bulan: j.tanggal_bulan === null ? null : Number(j.tanggal_bulan) }
}

/** Semua jadwal setor aktif. */
export function daftarJadwalSetor(db: Db): JadwalSetor[] {
  return (['kelompok', 'desa'] as const).map((t) => jadwalSetorUntuk(db, t)).filter((j): j is JadwalSetor => !!j)
}
