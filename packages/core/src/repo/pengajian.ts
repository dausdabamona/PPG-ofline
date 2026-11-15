// Repositori pengajian (jadwal rutin, master admin).
import type { Db } from '../db'
import { GalatPpg } from '../galat'
import { pastikanAdmin, sisipkanRekaman, tandaTanya, ubahRekaman, hapusRekaman, type RekamanDasar } from './umum'
import { ambilWilayah, leluhurWilayah } from './wilayah'
import { KATEGORI_GENERUS, type KategoriGenerus } from './generus'

export interface Pengajian extends RekamanDasar {
  wilayah_id: string
  nama: string
  jenis: string | null
  hari: number | null
  jam: string | null
  tempat: string | null
  /** v3: kelas — kategori generus (csv) yang diajar pengajian ini; NULL = semua kategori. */
  kategori_generus: string | null
}

/** Kategori generus kelas sebuah pengajian (null = semua). */
export function kategoriKelas(p: Pick<Pengajian, 'kategori_generus'> | null | undefined): string[] | null {
  if (!p?.kategori_generus) return null
  const l = p.kategori_generus.split(',').map((x) => x.trim()).filter(Boolean)
  return l.length ? l : null
}

function csvKategori(k: readonly string[] | null | undefined): string | null {
  if (!k || !k.length) return null
  for (const x of k) if (!KATEGORI_GENERUS.includes(x as KategoriGenerus)) throw new GalatPpg('KATEGORI_TIDAK_SAH', `Kategori ${x} tidak dikenal.`)
  return [...new Set(k)].join(',')
}

function validasi(hari: number | null | undefined, jam: string | null | undefined): void {
  if (hari !== null && hari !== undefined && !(Number.isInteger(hari) && hari >= 0 && hari <= 6)) {
    throw new GalatPpg('HARI_TIDAK_SAH', 'Hari harus 0 (Ahad) sampai 6 (Sabtu).')
  }
  if (jam && !/^([01]\d|2[0-3]):[0-5]\d$/.test(jam)) throw new GalatPpg('JAM_TIDAK_SAH', 'Jam harus berformat HH:MM.')
}

/** Tambah pengajian rutin (admin). */
export function tambahPengajian(
  db: Db,
  d: {
    wilayahId: string
    nama: string
    jenis?: string | null
    hari?: number | null
    jam?: string | null
    tempat?: string | null
    /** v3: kelas — kategori generus yang diajar (kosong = semua). */
    kategoriGenerus?: KategoriGenerus[] | null
  },
): Pengajian {
  pastikanAdmin(db)
  if (!ambilWilayah(db, d.wilayahId)) throw new GalatPpg('WILAYAH_TIDAK_SAH', 'Wilayah tidak ditemukan.')
  if (!d.nama?.trim()) throw new GalatPpg('NAMA_KOSONG', 'Nama pengajian wajib diisi.')
  validasi(d.hari, d.jam)
  return sisipkanRekaman<Pengajian>(db, 'pengajian', {
    wilayah_id: d.wilayahId,
    nama: d.nama.trim(),
    jenis: d.jenis ?? null,
    hari: d.hari ?? null,
    jam: d.jam ?? null,
    tempat: d.tempat ?? null,
    kategori_generus: csvKategori(d.kategoriGenerus),
  })
}

/** Ubah pengajian (admin). */
export function ubahPengajian(
  db: Db,
  id: string,
  p: Partial<Pick<Pengajian, 'nama' | 'jenis' | 'hari' | 'jam' | 'tempat'>> & { kategoriGenerus?: KategoriGenerus[] | null },
): Pengajian {
  pastikanAdmin(db)
  validasi(p.hari, p.jam)
  const { kategoriGenerus, ...sisa } = p
  const u: Record<string, unknown> = { ...sisa }
  if (kategoriGenerus !== undefined) u.kategori_generus = csvKategori(kategoriGenerus)
  return ubahRekaman<Pengajian>(db, 'pengajian', id, u)
}

/** Hapus lunak pengajian (admin). */
export function hapusPengajian(db: Db, id: string): Pengajian {
  pastikanAdmin(db)
  return hapusRekaman<Pengajian>(db, 'pengajian', id)
}

/** Daftar pengajian untuk sekumpulan wilayah (urut hari, jam). */
export function daftarPengajian(db: Db, wilayahIds?: string[]): Pengajian[] {
  if (!wilayahIds) return db.kueri<Pengajian>('SELECT * FROM pengajian WHERE dihapus = 0 ORDER BY hari, jam, nama')
  if (wilayahIds.length === 0) return []
  return db.kueri<Pengajian>(
    `SELECT * FROM pengajian WHERE dihapus = 0 AND wilayah_id IN (${tandaTanya(wilayahIds.length)}) ORDER BY hari, jam, nama`,
    wilayahIds,
  )
}

/** Pengajian yang berlaku bagi kelompok: milik kelompok + desa + daerah induknya. */
export function pengajianUntukKelompok(db: Db, kelompokId: string): Pengajian[] {
  return daftarPengajian(db, [kelompokId, ...leluhurWilayah(db, kelompokId)])
}
