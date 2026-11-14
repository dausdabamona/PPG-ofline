// Daftar token terdaftar (tabel `perangkat`, satu baris per token) dan catatan pencabutan/pembekuan.
import type { Db } from '../db'
import { ulid } from '../ids'
import { statusPencabutan, type CatatanPencabutan, type PayloadToken } from '../token'
import { sekarangIso } from '../waktu'
import { tandaTanya, uraiJson } from './umum'

export interface PerangkatTerdaftar {
  /** = token_id */
  id: string
  perangkat_id: string
  label: string | null
  role: PayloadToken['role']
  tingkat: PayloadToken['tingkat']
  wilayah_id: string
  nama: string
  token_id: string
  token: string
  sign_pub: string
  box_pub: string
  generus_ids: string[]
  seq_diterima: number
  dicabut_pada: string | null
  dibekukan: boolean
  diterbitkan_oleh: string | null
  berlaku_sampai: string | null
  setor_akhir_urut: number | null
  terakhir_setor: string | null
  dibuat_pada: string
}

interface BarisPerangkat extends Omit<PerangkatTerdaftar, 'generus_ids' | 'dibekukan'> {
  generus_ids_json: string
  dibekukan: number
}

function dariBaris(b: BarisPerangkat): PerangkatTerdaftar {
  const { generus_ids_json, ...sisa } = b
  return { ...sisa, generus_ids: uraiJson<string[]>(generus_ids_json, []), dibekukan: !!b.dibekukan }
}

/** Daftarkan (atau perbarui) token di tabel perangkat. Kolom lokal (seq_diterima, setor akhir) dipertahankan. */
export function daftarkanToken(
  db: Db,
  payload: PayloadToken,
  teksToken: string,
  opsi: { label?: string | null; diterbitkanOleh?: string | null } = {},
): PerangkatTerdaftar {
  const lama = ambilPerangkat(db, payload.token_id)
  db.jalankan(
    `INSERT OR REPLACE INTO perangkat (id, perangkat_id, label, role, tingkat, wilayah_id, nama, token_id, token, sign_pub, box_pub,
       generus_ids_json, seq_diterima, dicabut_pada, dibekukan, diterbitkan_oleh, berlaku_sampai, setor_akhir_urut, terakhir_setor, dibuat_pada)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.token_id,
      payload.perangkat_id,
      opsi.label ?? lama?.label ?? null,
      payload.role,
      payload.tingkat,
      payload.wilayah_id,
      payload.nama,
      payload.token_id,
      teksToken,
      payload.device_sign_pub,
      payload.device_box_pub,
      JSON.stringify(payload.generus_ids ?? []),
      lama?.seq_diterima ?? 0,
      lama?.dicabut_pada ?? null,
      lama?.dibekukan ? 1 : 0,
      opsi.diterbitkanOleh ?? lama?.diterbitkan_oleh ?? null,
      payload.berlaku_sampai,
      lama?.setor_akhir_urut ?? null,
      lama?.terakhir_setor ?? null,
      lama?.dibuat_pada ?? sekarangIso(),
    ],
  )
  segarkanStatusToken(db, [payload.token_id])
  return ambilPerangkat(db, payload.token_id)!
}

/** Ambil token terdaftar menurut token_id. */
export function ambilPerangkat(db: Db, tokenId: string): PerangkatTerdaftar | undefined {
  const b = db.satu<BarisPerangkat>('SELECT * FROM perangkat WHERE id = ?', [tokenId])
  return b ? dariBaris(b) : undefined
}

/** Daftar token terdaftar dengan filter. */
export function daftarPerangkat(
  db: Db,
  filter: { wilayahIds?: string[]; role?: PayloadToken['role'] | PayloadToken['role'][]; perangkatId?: string; aktifSaja?: boolean } = {},
): PerangkatTerdaftar[] {
  const s: string[] = []
  const p: string[] = []
  if (filter.wilayahIds) {
    if (filter.wilayahIds.length === 0) return []
    s.push(`wilayah_id IN (${tandaTanya(filter.wilayahIds.length)})`)
    p.push(...filter.wilayahIds)
  }
  if (filter.role) {
    const r = Array.isArray(filter.role) ? filter.role : [filter.role]
    s.push(`role IN (${tandaTanya(r.length)})`)
    p.push(...r)
  }
  if (filter.perangkatId) {
    s.push('perangkat_id = ?')
    p.push(filter.perangkatId)
  }
  if (filter.aktifSaja) s.push('dicabut_pada IS NULL')
  const baris = db.kueri<BarisPerangkat>(`SELECT * FROM perangkat ${s.length ? 'WHERE ' + s.join(' AND ') : ''} ORDER BY nama`, p)
  return baris.map(dariBaris)
}

/** Catat pencabutan/pembekuan/pencairan satu token. */
export function catatPencabutan(
  db: Db,
  d: { tokenId: string; perangkatId: string; jenis: CatatanPencabutan['jenis']; tanggal?: string },
): void {
  db.jalankan('INSERT INTO pencabutan (id, token_id, perangkat_id, jenis, tanggal) VALUES (?, ?, ?, ?, ?)', [
    ulid(),
    d.tokenId,
    d.perangkatId,
    d.jenis,
    d.tanggal ?? sekarangIso(),
  ])
  segarkanStatusToken(db, [d.tokenId])
}

export interface BarisPencabutan extends CatatanPencabutan {
  id: string
  perangkat_id: string
}

/** Daftar catatan pencabutan (opsional untuk token tertentu). */
export function daftarPencabutan(db: Db, tokenIds?: string[]): BarisPencabutan[] {
  if (!tokenIds) return db.kueri<BarisPencabutan>('SELECT * FROM pencabutan ORDER BY tanggal')
  if (tokenIds.length === 0) return []
  return db.kueri<BarisPencabutan>(`SELECT * FROM pencabutan WHERE token_id IN (${tandaTanya(tokenIds.length)}) ORDER BY tanggal`, tokenIds)
}

/** Gabungkan catatan pencabutan yang diterima (PAKET/BALASAN); idempoten menurut id. */
export function gabungPencabutan(db: Db, daftar: BarisPencabutan[]): number {
  let baru = 0
  const token = new Set<string>()
  for (const c of daftar) {
    if (!c?.id || !c.token_id || !['cabut', 'beku', 'cair'].includes(c.jenis) || typeof c.tanggal !== 'string') continue
    const ada = db.nilai<string>('SELECT id FROM pencabutan WHERE id = ?', [c.id])
    if (ada) continue
    db.jalankan('INSERT INTO pencabutan (id, token_id, perangkat_id, jenis, tanggal) VALUES (?, ?, ?, ?, ?)', [
      c.id,
      c.token_id,
      c.perangkat_id ?? '',
      c.jenis,
      c.tanggal,
    ])
    token.add(c.token_id)
    baru++
  }
  if (token.size) segarkanStatusToken(db, [...token])
  return baru
}

/** Hitung ulang kolom dicabut_pada/dibekukan di tabel perangkat & profil dari tabel pencabutan. */
export function segarkanStatusToken(db: Db, tokenIds: string[]): void {
  const semua = daftarPencabutan(db, tokenIds)
  for (const id of tokenIds) {
    const st = statusPencabutan(semua, id)
    db.jalankan('UPDATE perangkat SET dicabut_pada = ?, dibekukan = ? WHERE id = ?', [st.dicabutPada, st.dibekukan ? 1 : 0, id])
    db.jalankan('UPDATE profil SET dicabut_pada = ?, dibekukan = ? WHERE token_id = ?', [st.dicabutPada, st.dibekukan ? 1 : 0, id])
  }
}

/** Set token_id yang dikenal (terdaftar) — dipakai untuk pemeriksaan rantai setelah penerbit dicabut. */
export function tokenDikenal(db: Db): Set<string> {
  return new Set(db.kueri<{ id: string }>('SELECT id FROM perangkat').map((x) => x.id))
}

/** Perbarui seq tertinggi yang diterima dari sebuah perangkat (semua tokennya). */
export function catatSeqDiterima(db: Db, perangkatId: string, urut: number): void {
  db.jalankan('UPDATE perangkat SET seq_diterima = MAX(seq_diterima, ?), terakhir_setor = ? WHERE perangkat_id = ?', [
    urut,
    sekarangIso(),
    perangkatId,
  ])
}

/** Seq tertinggi yang diterima dari perangkat (0 bila belum ada). */
export function seqDiterima(db: Db, perangkatId: string): number {
  return db.nilai<number>('SELECT MAX(seq_diterima) FROM perangkat WHERE perangkat_id = ?', [perangkatId]) ?? 0
}
