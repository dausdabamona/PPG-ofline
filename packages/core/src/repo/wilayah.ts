// Repositori wilayah: daerah → desa → kelompok (master, milik admin).
import type { Db } from '../db'
import { GalatPpg } from '../galat'
import { ambilRekaman, hapusRekaman, pastikanAdmin, sisipkanRekaman, ubahRekaman, type RekamanDasar } from './umum'

export type Tingkat = 'daerah' | 'desa' | 'kelompok'
export const TINGKAT: readonly Tingkat[] = ['daerah', 'desa', 'kelompok']

export interface Wilayah extends RekamanDasar {
  tingkat: Tingkat
  nama: string
  kode: string | null
  induk_id: string | null
}

const INDUK_DARI: Record<Tingkat, Tingkat | null> = { daerah: null, desa: 'daerah', kelompok: 'desa' }

/** Tambah wilayah (admin). Desa wajib berinduk daerah; kelompok wajib berinduk desa. */
export function tambahWilayah(
  db: Db,
  data: { tingkat: Tingkat; nama: string; kode?: string | null; indukId?: string | null },
): Wilayah {
  pastikanAdmin(db)
  validasiWilayah(db, data.tingkat, data.nama, data.kode ?? null, data.indukId ?? null)
  return sisipkanRekaman<Wilayah>(db, 'wilayah', {
    tingkat: data.tingkat,
    nama: data.nama.trim(),
    kode: data.kode?.trim() || null,
    induk_id: data.indukId ?? null,
  })
}

function validasiWilayah(db: Db, tingkat: Tingkat, nama: string, kode: string | null, indukId: string | null, kecuali?: string): void {
  if (!TINGKAT.includes(tingkat)) throw new GalatPpg('TINGKAT_TIDAK_SAH', 'Tingkat wilayah tidak dikenal.')
  if (!nama || !nama.trim()) throw new GalatPpg('NAMA_KOSONG', 'Nama wilayah wajib diisi.')
  const butuh = INDUK_DARI[tingkat]
  if (butuh === null) {
    if (indukId) throw new GalatPpg('INDUK_TIDAK_SAH', 'Daerah tidak memiliki induk.')
  } else {
    const induk = indukId ? ambilWilayah(db, indukId) : undefined
    if (!induk || induk.dihapus) throw new GalatPpg('INDUK_TIDAK_SAH', `Wilayah ${tingkat} wajib memiliki induk ${butuh}.`)
    if (induk.tingkat !== butuh) throw new GalatPpg('INDUK_TIDAK_SAH', `Induk ${tingkat} harus berupa ${butuh}.`)
  }
  if (kode && kode.trim()) {
    const ada = db.satu<{ id: string }>('SELECT id FROM wilayah WHERE kode = ? AND dihapus = 0 AND id != ?', [kode.trim(), kecuali ?? ''])
    if (ada) throw new GalatPpg('KODE_GANDA', `Kode wilayah ${kode} sudah dipakai.`)
  }
}

/** Ubah nama/kode wilayah (admin). */
export function ubahWilayah(db: Db, id: string, perubahan: { nama?: string; kode?: string | null }): Wilayah {
  pastikanAdmin(db)
  const w = ambilWilayah(db, id)
  if (!w) throw new GalatPpg('TIDAK_DITEMUKAN', 'Wilayah tidak ditemukan.')
  validasiWilayah(db, w.tingkat, perubahan.nama ?? w.nama, perubahan.kode === undefined ? w.kode : perubahan.kode, w.induk_id, id)
  const p: Record<string, unknown> = {}
  if (perubahan.nama !== undefined) p.nama = perubahan.nama.trim()
  if (perubahan.kode !== undefined) p.kode = perubahan.kode?.trim() || null
  return ubahRekaman<Wilayah>(db, 'wilayah', id, p)
}

/** Hapus lunak wilayah (admin); ditolak bila masih punya anak aktif. */
export function hapusWilayah(db: Db, id: string): Wilayah {
  pastikanAdmin(db)
  const anak = db.nilai<number>('SELECT COUNT(*) FROM wilayah WHERE induk_id = ? AND dihapus = 0', [id]) ?? 0
  if (anak > 0) throw new GalatPpg('MASIH_ADA_ANAK', 'Hapus dulu wilayah di bawahnya.')
  return hapusRekaman<Wilayah>(db, 'wilayah', id)
}

/** Ambil wilayah menurut id. */
export function ambilWilayah(db: Db, id: string): Wilayah | undefined {
  return ambilRekaman<Wilayah>(db, 'wilayah', id)
}

/** Cari wilayah menurut kode (tidak terhapus). */
export function cariWilayahKode(db: Db, kode: string): Wilayah | undefined {
  return db.satu<Wilayah>('SELECT * FROM wilayah WHERE kode = ? AND dihapus = 0', [kode.trim()])
}

/** Daftar wilayah (opsional per tingkat/induk), urut nama. */
export function daftarWilayah(db: Db, filter: { tingkat?: Tingkat; indukId?: string; termasukDihapus?: boolean } = {}): Wilayah[] {
  const syarat: string[] = []
  const p: string[] = []
  if (!filter.termasukDihapus) syarat.push('dihapus = 0')
  if (filter.tingkat) {
    syarat.push('tingkat = ?')
    p.push(filter.tingkat)
  }
  if (filter.indukId) {
    syarat.push('induk_id = ?')
    p.push(filter.indukId)
  }
  return db.kueri<Wilayah>(`SELECT * FROM wilayah ${syarat.length ? 'WHERE ' + syarat.join(' AND ') : ''} ORDER BY nama`, p)
}

/** Id wilayah itu sendiri + semua turunannya. */
export function turunanWilayah(db: Db, id: string): string[] {
  const hasil = [id]
  for (let i = 0; i < hasil.length; i++) {
    const anak = db.kueri<{ id: string }>('SELECT id FROM wilayah WHERE induk_id = ?', [hasil[i]!])
    for (const a of anak) if (!hasil.includes(a.id)) hasil.push(a.id)
  }
  return hasil
}

/** Id leluhur wilayah (induk, induk dari induk, …) tanpa dirinya. */
export function leluhurWilayah(db: Db, id: string): string[] {
  const hasil: string[] = []
  let w = ambilWilayah(db, id)
  while (w?.induk_id && !hasil.includes(w.induk_id)) {
    hasil.push(w.induk_id)
    w = ambilWilayah(db, w.induk_id)
  }
  return hasil
}

/** Id kelompok di dalam wilayah (termasuk dirinya bila kelompok). */
export function kelompokDalamWilayah(db: Db, id: string): string[] {
  const ids = turunanWilayah(db, id)
  return ids.filter((x) => ambilWilayah(db, x)?.tingkat === 'kelompok')
}

/** Apakah wilayah `anakId` berada di dalam (atau sama dengan) `wilayahId`. */
export function wilayahMencakup(db: Db, wilayahId: string, anakId: string): boolean {
  return wilayahId === anakId || leluhurWilayah(db, anakId).includes(wilayahId)
}
