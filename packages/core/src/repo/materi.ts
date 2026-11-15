// Repositori kurikulum: bidang → kategori → materi (master admin).
import { kategoriCocok } from './generus'
import type { Db } from '../db'
import { keB64url } from '../crypto'
import { GalatPpg } from '../galat'
import type { KategoriGenerus } from './generus'
import { ambilRekaman, pastikanPengelolaKurikulum, sisipkanRekaman, ubahRekaman, type RekamanDasar } from './umum'

export type TipeMateri = 'hafalan' | 'checklist' | 'level'
export const TIPE_MATERI: readonly TipeMateri[] = ['hafalan', 'checklist', 'level']

export interface BidangMateri extends RekamanDasar {
  nama: string
  urutan: number
}
export interface KategoriMateri extends RekamanDasar {
  bidang_id: string
  kode: string
  nama: string
  urutan: number
  tipe: TipeMateri
}
export interface Materi extends RekamanDasar {
  kategori_id: string
  nomor: number
  nama: string
  tipe: TipeMateri
  kategori_generus: string | null
  isi_teks: string | null
  lampiran_pdf_b64: string | null
  lampiran_nama: string | null
}

/** Materi lengkap dengan nama kategori & bidang (untuk tampilan). */
export interface MateriLengkap extends Materi {
  kategori_nama: string
  kategori_kode: string
  kategori_urutan: number
  bidang_id: string
  bidang_nama: string
  bidang_urutan: number
}

function pastikanTipe(t: string): void {
  if (!TIPE_MATERI.includes(t as TipeMateri)) throw new GalatPpg('TIPE_TIDAK_SAH', `Tipe materi ${t} tidak dikenal.`)
}

/** Tambah bidang materi (admin). */
export function tambahBidang(db: Db, d: { nama: string; urutan: number; id?: string }): BidangMateri {
  pastikanPengelolaKurikulum(db)
  return sisipkanRekaman<BidangMateri>(db, 'bidang_materi', { nama: d.nama, urutan: d.urutan }, { id: d.id })
}

/** Tambah kategori materi (admin). */
export function tambahKategori(
  db: Db,
  d: { bidangId: string; kode: string; nama: string; urutan: number; tipe: TipeMateri; id?: string },
): KategoriMateri {
  pastikanPengelolaKurikulum(db)
  pastikanTipe(d.tipe)
  if (!ambilRekaman(db, 'bidang_materi', d.bidangId)) throw new GalatPpg('BIDANG_TIDAK_ADA', 'Bidang materi tidak ditemukan.')
  return sisipkanRekaman<KategoriMateri>(
    db,
    'kategori_materi',
    { bidang_id: d.bidangId, kode: d.kode, nama: d.nama, urutan: d.urutan, tipe: d.tipe },
    { id: d.id },
  )
}

/** Ubah kategori kurikulum menjadi teks csv untuk kolom kategori_generus (null = semua). */
function csvKategori(k?: KategoriGenerus[] | null): string | null {
  return k && k.length ? k.join(',') : null
}

/** Tambah materi (admin). `kategoriGenerus` kosong = berlaku untuk semua kategori. */
export function tambahMateri(
  db: Db,
  d: {
    kategoriId: string
    nomor: number
    nama: string
    tipe: TipeMateri
    kategoriGenerus?: KategoriGenerus[] | null
    isiTeks?: string | null
    id?: string
  },
): Materi {
  pastikanPengelolaKurikulum(db)
  pastikanTipe(d.tipe)
  if (!ambilRekaman(db, 'kategori_materi', d.kategoriId)) throw new GalatPpg('KATEGORI_TIDAK_ADA', 'Kategori materi tidak ditemukan.')
  return sisipkanRekaman<Materi>(
    db,
    'materi',
    {
      kategori_id: d.kategoriId,
      nomor: d.nomor,
      nama: d.nama,
      tipe: d.tipe,
      kategori_generus: csvKategori(d.kategoriGenerus),
      isi_teks: d.isiTeks ?? null,
      lampiran_pdf_b64: null,
      lampiran_nama: null,
    },
    { id: d.id },
  )
}

/** Ubah materi (admin). */
export function ubahMateri(
  db: Db,
  id: string,
  p: { nama?: string; nomor?: number; tipe?: TipeMateri; kategoriGenerus?: KategoriGenerus[] | null; isiTeks?: string | null; dihapus?: boolean },
): Materi {
  pastikanPengelolaKurikulum(db)
  const u: Record<string, unknown> = {}
  if (p.nama !== undefined) u.nama = p.nama
  if (p.nomor !== undefined) u.nomor = p.nomor
  if (p.tipe !== undefined) {
    pastikanTipe(p.tipe)
    u.tipe = p.tipe
  }
  if (p.kategoriGenerus !== undefined) u.kategori_generus = csvKategori(p.kategoriGenerus)
  if (p.isiTeks !== undefined) u.isi_teks = p.isiTeks
  if (p.dihapus !== undefined) u.dihapus = p.dihapus ? 1 : 0
  return ubahRekaman<Materi>(db, 'materi', id, u)
}

/** Pasang/lepas lampiran PDF materi (admin). Batas 5 MB per berkas. */
export function aturLampiranMateri(db: Db, id: string, lampiran: { nama: string; bytes: Uint8Array } | null): Materi {
  pastikanPengelolaKurikulum(db)
  if (lampiran && lampiran.bytes.length > 5 * 1024 * 1024) {
    throw new GalatPpg('LAMPIRAN_TERLALU_BESAR', 'Lampiran PDF maksimal 5 MB agar mudah dikirim lewat WA.')
  }
  return ubahRekaman<Materi>(db, 'materi', id, {
    lampiran_pdf_b64: lampiran ? keB64url(lampiran.bytes) : null,
    lampiran_nama: lampiran ? lampiran.nama : null,
  })
}

/** Daftar bidang (urut). */
export function daftarBidang(db: Db): BidangMateri[] {
  return db.kueri<BidangMateri>('SELECT * FROM bidang_materi WHERE dihapus = 0 ORDER BY urutan, nama')
}

/** Daftar kategori (opsional per bidang). */
export function daftarKategoriMateri(db: Db, bidangId?: string): KategoriMateri[] {
  if (bidangId) return db.kueri<KategoriMateri>('SELECT * FROM kategori_materi WHERE dihapus = 0 AND bidang_id = ? ORDER BY urutan', [bidangId])
  return db.kueri<KategoriMateri>('SELECT * FROM kategori_materi WHERE dihapus = 0 ORDER BY urutan')
}

/** Apakah materi berlaku untuk kategori generus tertentu. */
export function materiBerlakuUntuk(m: Pick<Materi, 'kategori_generus'>, kategori: string): boolean {
  if (!m.kategori_generus) return true
  return m.kategori_generus.split(',').some((x) => kategoriCocok(x.trim(), kategori))
}

/**
 * Daftar materi lengkap (dengan nama kategori & bidang), urut bidang → kategori → nomor.
 * Kolom lampiran_pdf_b64 tidak diambil kecuali `denganLampiran`.
 */
export function daftarMateri(
  db: Db,
  filter: { kategoriId?: string; kategoriGenerus?: string; denganLampiran?: boolean } = {},
): MateriLengkap[] {
  const kolomLampiran = filter.denganLampiran ? 'm.lampiran_pdf_b64' : 'NULL AS lampiran_pdf_b64'
  const s = ['m.dihapus = 0', 'k.dihapus = 0', 'b.dihapus = 0']
  const p: string[] = []
  if (filter.kategoriId) {
    s.push('m.kategori_id = ?')
    p.push(filter.kategoriId)
  }
  const baris = db.kueri<MateriLengkap>(
    `SELECT m.id, m.kategori_id, m.nomor, m.nama, m.tipe, m.kategori_generus, m.isi_teks, ${kolomLampiran}, m.lampiran_nama,
            m.perangkat_id, m.dibuat_pada, m.diubah_pada, m.dihapus, m.versi, m.seq_lokal,
            k.nama AS kategori_nama, k.kode AS kategori_kode, k.urutan AS kategori_urutan,
            b.id AS bidang_id, b.nama AS bidang_nama, b.urutan AS bidang_urutan
     FROM materi m JOIN kategori_materi k ON k.id = m.kategori_id JOIN bidang_materi b ON b.id = k.bidang_id
     WHERE ${s.join(' AND ')}
     ORDER BY b.urutan, k.urutan, m.nomor`,
    p,
  )
  return filter.kategoriGenerus ? baris.filter((m) => materiBerlakuUntuk(m, filter.kategoriGenerus!)) : baris
}

/** Ambil satu materi lengkap (termasuk lampiran). */
export function ambilMateri(db: Db, id: string): Materi | undefined {
  return ambilRekaman<Materi>(db, 'materi', id)
}
