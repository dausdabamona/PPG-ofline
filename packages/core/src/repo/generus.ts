// Repositori generus & jamaah (master, milik admin).
import type { Db } from '../db'
import { GalatPpg } from '../galat'
import { tanggalHariIni, tanggalSah, umurPada } from '../waktu'
import { ambilRekaman, pastikanAdmin, sisipkanRekaman, tandaTanya, ubahRekaman, type RekamanDasar } from './umum'
import { ambilWilayah } from './wilayah'

/**
 * Jenjang generus (§16): PAUD, Caberawit A (SD 1–3), B (SD 4–6 masih Iqro'), C (SD 4–6 sudah Al-Qur'an),
 * Pra Remaja (Generus 1), Remaja (Generus 2), Pra Nikah (Generus 3). `caberawit` = nilai lama (sebelum juknis 2025),
 * tetap sah dan cocok dengan Caberawit A/B/C (J-T1), tetapi tidak ditawarkan lagi.
 */
export type KategoriGenerus = 'paud' | 'caberawit_a' | 'caberawit_b' | 'caberawit_c' | 'praremaja' | 'remaja' | 'pranikah' | 'caberawit'
/** Pilihan jenjang (urut). */
export const KATEGORI_GENERUS: readonly KategoriGenerus[] = ['paud', 'caberawit_a', 'caberawit_b', 'caberawit_c', 'praremaja', 'remaja', 'pranikah']
/** Semua nilai kategori yang sah (termasuk `caberawit` lama). */
export const KATEGORI_SAH: readonly KategoriGenerus[] = [...KATEGORI_GENERUS, 'caberawit']

/** Kelompok besar jenjang: caberawit_a/b/c → 'caberawit'. */
export function jenjangInduk(k: string): string {
  return k.startsWith('caberawit') ? 'caberawit' : k
}

/** J-T1: apakah dua kategori cocok (sama; atau salah satunya `caberawit` lama dan yang lain Caberawit A/B/C). */
export function kategoriCocok(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  if (a === b) return true
  return (a === 'caberawit' || b === 'caberawit') && jenjangInduk(a) === jenjangInduk(b)
}

const ALIAS_KATEGORI: Record<string, KategoriGenerus> = {
  paud: 'paud', prasd: 'paud',
  caberawita: 'caberawit_a', cba: 'caberawit_a', caberawit1: 'caberawit_a',
  caberawitb: 'caberawit_b', cbb: 'caberawit_b', caberawit2: 'caberawit_b',
  caberawitc: 'caberawit_c', cbc: 'caberawit_c', caberowot: 'caberawit_c', caberawit3: 'caberawit_c',
  caberawit: 'caberawit',
  praremaja: 'praremaja', generus1: 'praremaja', gen1: 'praremaja', g1: 'praremaja', smp: 'praremaja',
  remaja: 'remaja', generus2: 'remaja', gen2: 'remaja', g2: 'remaja', sma: 'remaja',
  pranikah: 'pranikah', generus3: 'pranikah', gen3: 'pranikah', g3: 'pranikah',
}

/** Teks kategori lapangan (CSV/Excel: "Caberawit A", "CB B", "Generus 1", "pra nikah") → kode jenjang; null bila tidak dikenal. */
export function normalKategori(teks: string): KategoriGenerus | null {
  const t = teks.toLowerCase().replace(/(cabe|cb)\s*rawit/g, 'caberawit').replace(/[^a-z0-9]/g, '')
  return ALIAS_KATEGORI[t] ?? null
}

/** Jenjang sebelumnya (untuk "sisa target jenjang sebelumnya", J-T15). */
export function jenjangSebelumnya(k: string): KategoriGenerus | null {
  const i = KATEGORI_GENERUS.indexOf(k as KategoriGenerus)
  return i > 0 ? KATEGORI_GENERUS[i - 1]! : null
}

export type StatusGenerus = 'aktif' | 'mondok' | 'pindah' | 'lulus_menikah' | 'keluar'
export const STATUS_GENERUS: readonly StatusGenerus[] = ['aktif', 'mondok', 'pindah', 'lulus_menikah', 'keluar']

export interface Generus extends RekamanDasar {
  kelompok_id: string
  nama: string
  jenis_kelamin: 'L' | 'P'
  tanggal_lahir: string | null
  kategori: KategoriGenerus
  status: StatusGenerus
  /** v4: 1 = jenjang hasil saran umur, perlu dicek mubaligh/admin. */
  kategori_saran?: number | null
  wali_nama: string | null
  wali_no_hp: string | null
  /** v6 (§19): nama sekolah, kelas sekolah, jilid Iqro' ('1'–'6') atau 'alquran'. Kosong = belum diketahui. */
  sekolah?: string | null
  kelas_sekolah?: string | null
  iqro?: string | null
}

/** Nilai jilid Iqro' yang sah (§19, J-C12). */
export const JILID_IQRO = ['1', '2', '3', '4', '5', '6', 'alquran'] as const
export type JilidIqro = (typeof JILID_IQRO)[number]
/** Panjang maksimum teks sekolah / kelas sekolah. */
export const PANJANG_SEKOLAH = 100

/** Teks lapangan ("Iqro 3", "IQRO' 3", "3", "Al-Qur'an", "AQ") → kode jilid; null = kosong; undefined = tidak dikenal. */
export function normalIqro(teks: string | null | undefined): JilidIqro | null | undefined {
  const t = String(teks ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!t) return null
  if (['alquran', 'quran', 'aq', 'alquraan', 'qur', 'quraan'].includes(t)) return 'alquran'
  const m = /^(?:iqro|iqra|jilid)?([1-6])$/.exec(t)
  return m ? (m[1] as JilidIqro) : undefined
}

/** Label jilid untuk tampilan & cetakan. */
export function labelIqro(v: string | null | undefined): string {
  if (!v) return ''
  return v === 'alquran' ? "Al-Qur'an" : `Iqro' ${v}`
}

/**
 * Saran jenjang dari jilid Iqro' (J-C13): Caberawit B yang sudah Al-Qur'an → C; Caberawit C yang masih Iqro' → B.
 * Hanya saran — jenjang tetap ditetapkan admin/mubaligh.
 */
export function saranJenjangIqro(g: Pick<Generus, 'kategori' | 'iqro'>): KategoriGenerus | null {
  if (!g.iqro) return null
  if (g.kategori === 'caberawit_b' && g.iqro === 'alquran') return 'caberawit_c'
  if (g.kategori === 'caberawit_c' && g.iqro !== 'alquran') return 'caberawit_b'
  return null
}

function periksaDataSekolah(d: { sekolah?: unknown; kelas_sekolah?: unknown; iqro?: unknown }): void {
  if (d.iqro !== undefined && d.iqro !== null && d.iqro !== '' && !(JILID_IQRO as readonly unknown[]).includes(d.iqro)) {
    throw new GalatPpg('IQRO_TIDAK_SAH', "Jilid Iqro' harus 1–6 atau Al-Qur'an.")
  }
  for (const [k, v] of [['Sekolah', d.sekolah], ['Kelas sekolah', d.kelas_sekolah]] as const) {
    if (v !== undefined && v !== null && (typeof v !== 'string' || v.length > PANJANG_SEKOLAH)) throw new GalatPpg('TEKS_TERLALU_PANJANG', `${k} maksimal ${PANJANG_SEKOLAH} huruf.`)
  }
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
  /** v6 (§19) */
  sekolah?: string | null
  kelasSekolah?: string | null
  iqro?: string | null
  /** Tanggal mulai keanggotaan & status aktif (bawaan: hari ini). */
  mulai?: string
  /** Id tetap (Fase 9: id usulan Super Admin HP); bawaan ULID baru. */
  id?: string
}

/**
 * Saran jenjang menurut umur (J-T3): <6 PAUD, 6–9 Caberawit A, 10–12 Caberawit B, 13–15 Pra Remaja, 16–18 Remaja,
 * ≥19 Pra Nikah. Caberawit C tidak pernah disarankan (ditentukan kemampuan baca Al-Qur'an).
 */
export function kategoriDariUmur(tanggalLahir: string, acuan: string = tanggalHariIni()): KategoriGenerus {
  const u = umurPada(tanggalLahir, acuan)
  if (u < 6) return 'paud'
  if (u <= 9) return 'caberawit_a'
  if (u <= 12) return 'caberawit_b'
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
  return validasiGenerusRinci(db, d).kategori
}

function validasiGenerusRinci(db: Db, d: DataGenerusBaru): { kategori: KategoriGenerus; saran: boolean } {
  if (!d.nama?.trim()) throw new GalatPpg('NAMA_KOSONG', 'Nama generus wajib diisi.')
  if (d.jenisKelamin !== 'L' && d.jenisKelamin !== 'P') throw new GalatPpg('JK_TIDAK_SAH', 'Jenis kelamin harus L atau P.')
  if (d.tanggalLahir && !tanggalSah(d.tanggalLahir)) throw new GalatPpg('TANGGAL_TIDAK_SAH', 'Tanggal lahir harus berformat YYYY-MM-DD.')
  pastikanKelompok(db, d.kelompokId)
  let kategori = d.kategori ?? null
  let saran = false
  if (!kategori) {
    if (!d.tanggalLahir) throw new GalatPpg('KATEGORI_KOSONG', 'Kategori wajib diisi bila tanggal lahir kosong.')
    kategori = kategoriDariUmur(d.tanggalLahir)
    saran = true
  }
  if (!KATEGORI_SAH.includes(kategori)) throw new GalatPpg('KATEGORI_TIDAK_SAH', `Kategori ${kategori} tidak dikenal.`)
  periksaDataSekolah({ sekolah: d.sekolah?.trim() || null, kelas_sekolah: d.kelasSekolah?.trim() || null, iqro: d.iqro || null })
  return { kategori, saran }
}

/** Tambah generus (admin) + riwayat keanggotaan & status aktif. */
export function tambahGenerus(db: Db, d: DataGenerusBaru): Generus {
  pastikanAdmin(db)
  const { kategori, saran } = validasiGenerusRinci(db, d)
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
      kategori_saran: saran ? 1 : null,
      sekolah: d.sekolah?.trim() || null,
      kelas_sekolah: d.kelasSekolah?.trim() || null,
      iqro: d.iqro || null,
    }, d.id ? { id: d.id } : {})
    sisipkanRekaman(db, 'riwayat_keanggotaan', { generus_id: g.id, kelompok_id: d.kelompokId, mulai, selesai: null })
    sisipkanRekaman(db, 'riwayat_status', { generus_id: g.id, status: 'aktif', mulai, selesai: null, keterangan: null })
    return g
  })
}

const KOLOM_UBAH_GENERUS = ['nama', 'jenis_kelamin', 'tanggal_lahir', 'kategori', 'wali_nama', 'wali_no_hp', 'sekolah', 'kelas_sekolah', 'iqro'] as const

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
    p[k] = (k === 'sekolah' || k === 'kelas_sekolah' || k === 'iqro') && typeof v === 'string' ? v.trim() || null : v
  }
  periksaDataSekolah(p)
  if (p.kategori !== undefined && !KATEGORI_SAH.includes(p.kategori as KategoriGenerus)) {
    throw new GalatPpg('KATEGORI_TIDAK_SAH', 'Kategori tidak dikenal.')
  }
  // J-T3: jenjang yang ditetapkan eksplisit tidak lagi berstatus "saran umur"
  if (p.kategori !== undefined) p.kategori_saran = null
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
