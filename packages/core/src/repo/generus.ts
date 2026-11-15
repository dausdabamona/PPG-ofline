// Repositori generus & jamaah (master, milik admin).
import type { Db } from '../db'
import { GalatPpg } from '../galat'
import { tanggalHariIni, tanggalSah, umurPada } from '../waktu'
import { ambilRekaman, pastikanAdmin, sisipkanRekaman, tandaTanya, ubahRekaman, type RekamanDasar } from './umum'
import { ambilWilayah } from './wilayah'

export type KategoriGenerus = 'paud' | 'caberawit' | 'praremaja' | 'remaja' | 'pranikah'
export const KATEGORI_GENERUS: readonly KategoriGenerus[] = ['paud', 'caberawit', 'praremaja', 'remaja', 'pranikah']

export type StatusGenerus = 'aktif' | 'mondok' | 'pindah' | 'lulus_menikah' | 'keluar'
export const STATUS_GENERUS: readonly StatusGenerus[] = ['aktif', 'mondok', 'pindah', 'lulus_menikah', 'keluar']

export interface Generus extends RekamanDasar {
  kelompok_id: string
  nama: string
  jenis_kelamin: 'L' | 'P'
  tanggal_lahir: string | null
  kategori: KategoriGenerus
  status: StatusGenerus
  wali_nama: string | null
  wali_no_hp: string | null
}

export interface Jamaah extends RekamanDasar {
  kelompok_id: string
  nama: string
  jenis_kelamin: 'L' | 'P'
  tanggal_lahir: string | null
  no_hp: string | null
  status: string | null
}

export interface DataGenerusBaru {
  kelompokId: string
  nama: string
  jenisKelamin: 'L' | 'P'
  tanggalLahir?: string | null
  kategori?: KategoriGenerus | null
  waliNama?: string | null
  waliNoHp?: string | null
  /** Tanggal mulai keanggotaan & status aktif (bawaan: hari ini). */
  mulai?: string
  /** Id tetap (Fase 9: id usulan Super Admin HP); bawaan ULID baru. */
  id?: string
}

/** Kategori bawaan menurut umur: <6 paud, 6–12 caberawit, 13–15 praremaja, 16–18 remaja, ≥19 pranikah. */
export function kategoriDariUmur(tanggalLahir: string, acuan: string = tanggalHariIni()): KategoriGenerus {
  const u = umurPada(tanggalLahir, acuan)
  if (u < 6) return 'paud'
  if (u <= 12) return 'caberawit'
  if (u <= 15) return 'praremaja'
  if (u <= 18) return 'remaja'
  return 'pranikah'
}

function pastikanKelompok(db: Db, id: string): void {
  const w = ambilWilayah(db, id)
  if (!w || w.dihapus || w.tingkat !== 'kelompok') throw new GalatPpg('KELOMPOK_TIDAK_SAH', 'Kelompok tidak ditemukan.')
}

/** Validasi data generus baru; kembalikan kategori final. */
export function validasiGenerus(db: Db, d: DataGenerusBaru): KategoriGenerus {
  if (!d.nama?.trim()) throw new GalatPpg('NAMA_KOSONG', 'Nama generus wajib diisi.')
  if (d.jenisKelamin !== 'L' && d.jenisKelamin !== 'P') throw new GalatPpg('JK_TIDAK_SAH', 'Jenis kelamin harus L atau P.')
  if (d.tanggalLahir && !tanggalSah(d.tanggalLahir)) throw new GalatPpg('TANGGAL_TIDAK_SAH', 'Tanggal lahir harus berformat YYYY-MM-DD.')
  pastikanKelompok(db, d.kelompokId)
  let kategori = d.kategori ?? null
  if (!kategori) {
    if (!d.tanggalLahir) throw new GalatPpg('KATEGORI_KOSONG', 'Kategori wajib diisi bila tanggal lahir kosong.')
    kategori = kategoriDariUmur(d.tanggalLahir)
  }
  if (!KATEGORI_GENERUS.includes(kategori)) throw new GalatPpg('KATEGORI_TIDAK_SAH', `Kategori ${kategori} tidak dikenal.`)
  return kategori
}

/** Tambah generus (admin) + riwayat keanggotaan & status aktif. */
export function tambahGenerus(db: Db, d: DataGenerusBaru): Generus {
  pastikanAdmin(db)
  const kategori = validasiGenerus(db, d)
  const mulai = d.mulai ?? tanggalHariIni()
  return db.transaksi(() => {
    const g = sisipkanRekaman<Generus>(db, 'generus', {
      kelompok_id: d.kelompokId,
      nama: d.nama.trim(),
      jenis_kelamin: d.jenisKelamin,
      tanggal_lahir: d.tanggalLahir || null,
      kategori,
      status: 'aktif',
      wali_nama: d.waliNama?.trim() || null,
      wali_no_hp: d.waliNoHp?.trim() || null,
    }, d.id ? { id: d.id } : {})
    sisipkanRekaman(db, 'riwayat_keanggotaan', { generus_id: g.id, kelompok_id: d.kelompokId, mulai, selesai: null })
    sisipkanRekaman(db, 'riwayat_status', { generus_id: g.id, status: 'aktif', mulai, selesai: null, keterangan: null })
    return g
  })
}

const KOLOM_UBAH_GENERUS = ['nama', 'jenis_kelamin', 'tanggal_lahir', 'kategori', 'wali_nama', 'wali_no_hp'] as const

/** Ubah data diri generus (admin). Pindah kelompok & status lewat siklus.ts. */
export function ubahGenerus(db: Db, id: string, perubahan: Partial<Record<(typeof KOLOM_UBAH_GENERUS)[number], string | null>>): Generus {
  pastikanAdmin(db)
  const g = ambilGenerus(db, id)
  if (!g) throw new GalatPpg('TIDAK_DITEMUKAN', 'Generus tidak ditemukan.')
  const p: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(perubahan)) {
    if (!(KOLOM_UBAH_GENERUS as readonly string[]).includes(k)) {
      throw new GalatPpg('KOLOM_TIDAK_SAH', `Kolom ${k} tidak bisa diubah di sini (pakai pindah kelompok / ubah status).`)
    }
    p[k] = v
  }
  if (p.kategori !== undefined && !KATEGORI_GENERUS.includes(p.kategori as KategoriGenerus)) {
    throw new GalatPpg('KATEGORI_TIDAK_SAH', 'Kategori tidak dikenal.')
  }
  if (p.jenis_kelamin !== undefined && p.jenis_kelamin !== 'L' && p.jenis_kelamin !== 'P') {
    throw new GalatPpg('JK_TIDAK_SAH', 'Jenis kelamin harus L atau P.')
  }
  if (p.tanggal_lahir && !tanggalSah(p.tanggal_lahir)) throw new GalatPpg('TANGGAL_TIDAK_SAH', 'Tanggal lahir tidak sah.')
  return ubahRekaman<Generus>(db, 'generus', id, p)
}

/** Ambil generus menurut id. */
export function ambilGenerus(db: Db, id: string): Generus | undefined {
  return ambilRekaman<Generus>(db, 'generus', id)
}

/** Daftar generus dengan filter; urut nama. */
export function daftarGenerus(
  db: Db,
  filter: { kelompokIds?: string[]; kelompokId?: string; kategori?: KategoriGenerus; status?: StatusGenerus; ids?: string[] } = {},
): Generus[] {
  const s: string[] = ['dihapus = 0']
  const p: string[] = []
  const kel = filter.kelompokIds ?? (filter.kelompokId ? [filter.kelompokId] : undefined)
  if (kel) {
    if (kel.length === 0) return []
    s.push(`kelompok_id IN (${tandaTanya(kel.length)})`)
    p.push(...kel)
  }
  if (filter.ids) {
    if (filter.ids.length === 0) return []
    s.push(`id IN (${tandaTanya(filter.ids.length)})`)
    p.push(...filter.ids)
  }
  if (filter.kategori) {
    s.push('kategori = ?')
    p.push(filter.kategori)
  }
  if (filter.status) {
    s.push('status = ?')
    p.push(filter.status)
  }
  return db.kueri<Generus>(`SELECT * FROM generus WHERE ${s.join(' AND ')} ORDER BY nama`, p)
}

/** Tambah jamaah (admin). */
export function tambahJamaah(
  db: Db,
  d: { kelompokId: string; nama: string; jenisKelamin: 'L' | 'P'; tanggalLahir?: string | null; noHp?: string | null; status?: string | null },
): Jamaah {
  pastikanAdmin(db)
  if (!d.nama?.trim()) throw new GalatPpg('NAMA_KOSONG', 'Nama jamaah wajib diisi.')
  if (d.jenisKelamin !== 'L' && d.jenisKelamin !== 'P') throw new GalatPpg('JK_TIDAK_SAH', 'Jenis kelamin harus L atau P.')
  pastikanKelompok(db, d.kelompokId)
  return sisipkanRekaman<Jamaah>(db, 'jamaah', {
    kelompok_id: d.kelompokId,
    nama: d.nama.trim(),
    jenis_kelamin: d.jenisKelamin,
    tanggal_lahir: d.tanggalLahir || null,
    no_hp: d.noHp || null,
    status: d.status ?? 'aktif',
  })
}

/** Ubah jamaah (admin). */
export function ubahJamaah(db: Db, id: string, perubahan: Partial<Pick<Jamaah, 'nama' | 'jenis_kelamin' | 'tanggal_lahir' | 'no_hp' | 'status' | 'kelompok_id'>>): Jamaah {
  pastikanAdmin(db)
  if (perubahan.kelompok_id) pastikanKelompok(db, perubahan.kelompok_id)
  return ubahRekaman<Jamaah>(db, 'jamaah', id, perubahan)
}

/** Daftar jamaah per kelompok. */
export function daftarJamaah(db: Db, filter: { kelompokIds?: string[] } = {}): Jamaah[] {
  if (filter.kelompokIds) {
    if (filter.kelompokIds.length === 0) return []
    return db.kueri<Jamaah>(
      `SELECT * FROM jamaah WHERE dihapus = 0 AND kelompok_id IN (${tandaTanya(filter.kelompokIds.length)}) ORDER BY nama`,
      filter.kelompokIds,
    )
  }
  return db.kueri<Jamaah>('SELECT * FROM jamaah WHERE dihapus = 0 ORDER BY nama')
}
