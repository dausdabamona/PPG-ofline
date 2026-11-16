// §21.2–21.4 (Fase 15) — info bidang bertanda tangan daerah yang ikut PAKET (dan diteruskan EXE desa/kelompok apa adanya):
// kunci publik konseling & keuangan tiap wilayah, perangkat BK aktif per wilayah (amplop berkas RUJUKAN), daftar kerabat BK
// (J-BJ5), serta kontak WA BK per wilayah (juga ikut BALASAN ke HP orang tua/generus). Ditandatangani admin daerah agar EXE
// perantara tidak bisa menukar kunci publik (menyadap rujukan) atau nomor BK.
import { kunciPublikBidangSemua, metaKontakBk, type KunciAdmin } from './admin'
import { dariB64url, keB64url, keUtf8, periksaTandaTangan, tandaTangani } from './crypto'
import type { Db } from './db'
import { penugasanDari, type BidangRahasia } from './kepengurusan'
import { bacaIsiKebijakan, idDaerah } from './kebijakan'
import { daftarPerangkat, type PerangkatTerdaftar } from './repo/perangkat'
import { ambilMeta, aturMeta } from './repo/umum'
import { uraiToken } from './token'
import { sekarangIso } from './waktu'

export interface DataInfoBidang {
  v: 1
  dibuat_pada: string
  /** wilayah_id → kunci publik terbaru tiap bidang rahasia. */
  kunci: Record<string, Partial<Record<BidangRahasia, { versi: number; publik: string }>>>
  /** wilayah_id → perangkat pemegang penugasan BK aktif (amplop berkas RUJUKAN; penanda "ada BK aktif"). */
  bk: Record<string, { perangkat_id: string; box_pub: string }[]>
  /** wilayah_id → generus yang termasuk kerabat BK wilayah itu (J-BJ5, dilewati saat menentukan tujuan rujukan). */
  kerabat: Record<string, string[]>
}

export interface DataKontakBk {
  v: 1
  dibuat_pada: string
  /** wilayah_id → nomor WA BK (format 62…), tanpa nama. */
  kontak: Record<string, string[]>
}

/** Data bertanda tangan admin daerah (teks JSON + tanda tangan). */
export interface BlobBertanda {
  data: string
  tt: string
}

const AWALAN = { info: 'PPGIB1.', kontak: 'PPGKB1.' } as const
type JenisBlob = keyof typeof AWALAN

export function tandaTanganiBlob(jenis: JenisBlob, data: unknown, rahasiaAdmin: Uint8Array): BlobBertanda {
  const teks = JSON.stringify(data)
  return { data: teks, tt: keB64url(tandaTangani(keUtf8(AWALAN[jenis] + teks), rahasiaAdmin)) }
}

/** Buka blob bertanda tangan; null bila bentuk/tanda tangan tidak sah. Tidak pernah melempar. */
export function bukaBlob<T extends { v: 1; dibuat_pada: string }>(jenis: JenisBlob, blob: unknown, adminSignPub: string): T | null {
  if (!blob || typeof blob !== 'object') return null
  const b = blob as Partial<BlobBertanda>
  if (typeof b.data !== 'string' || typeof b.tt !== 'string' || b.data.length > 2_000_000) return null
  try {
    if (!periksaTandaTangan(keUtf8(AWALAN[jenis] + b.data), dariB64url(b.tt), dariB64url(adminSignPub))) return null
    const d = JSON.parse(b.data) as T
    return d && d.v === 1 && typeof d.dibuat_pada === 'string' ? d : null
  } catch {
    return null
  }
}

const META = { info: 'info_bidang', kontak: 'kontak_bk' } as const

/** Simpan blob bila sah & tidak lebih lama dari yang terpasang. Kembalikan true bila tersimpan. */
export function simpanBlob(db: Db, jenis: JenisBlob, blob: unknown): boolean {
  const pub = ambilMeta(db, 'admin_sign_pub')
  if (!pub) return false
  const baru = bukaBlob(jenis, blob, pub)
  if (!baru) return false
  const lama = ambilBlob(db, jenis)
  if (lama && lama.data.dibuat_pada > baru.dibuat_pada) return false
  aturMeta(db, META[jenis], JSON.stringify(blob))
  return true
}

/** Blob terpasang (sudah diperiksa ulang tanda tangannya). */
export function ambilBlob(db: Db, jenis: JenisBlob): { blob: BlobBertanda; data: DataInfoBidang & DataKontakBk } | null {
  const pub = ambilMeta(db, 'admin_sign_pub')
  const t = ambilMeta(db, META[jenis])
  if (!pub || !t) return null
  try {
    const blob = JSON.parse(t) as BlobBertanda
    const data = bukaBlob<DataInfoBidang & DataKontakBk>(jenis, blob, pub)
    return data ? { blob, data } : null
  } catch {
    return null
  }
}

export function ambilInfoBidang(db: Db): DataInfoBidang | null {
  return ambilBlob(db, 'info')?.data ?? null
}

export function ambilKontakBk(db: Db): DataKontakBk | null {
  return ambilBlob(db, 'kontak')?.data ?? null
}

// ---------------------------------------------------------------------------------------------------------------------
// Penyusunan di EXE Daerah
// ---------------------------------------------------------------------------------------------------------------------

/** Token pengurus aktif (tidak dicabut, tidak dibekukan, belum kedaluwarsa) yang memegang penugasan BK, per wilayah. */
export function tokenBkAktif(db: Db, kini: string = sekarangIso()): Map<string, PerangkatTerdaftar[]> {
  const out = new Map<string, PerangkatTerdaftar[]>()
  for (const t of daftarPerangkat(db, { role: 'pengurus', aktifSaja: true })) {
    if (t.dibekukan || (t.berlaku_sampai && t.berlaku_sampai < kini)) continue
    let pn
    try {
      pn = penugasanDari(uraiToken(t.token).payload)
    } catch {
      continue
    }
    for (const p of pn) if (p.jabatan === 'bk') out.set(p.wilayah_id, [...(out.get(p.wilayah_id) ?? []), t])
  }
  return out
}

/** J-BJ5: kerabat BK = generus yang token generus/wali-nya terdaftar pada perangkat_id yang sama dengan token BK. */
export function kerabatBk(db: Db, bk: Map<string, PerangkatTerdaftar[]> = tokenBkAktif(db)): Record<string, string[]> {
  const anak = daftarPerangkat(db, { role: ['generus', 'wali'], aktifSaja: true })
  const out: Record<string, string[]> = {}
  for (const [w, daftar] of bk) {
    const hp = new Set(daftar.map((t) => t.perangkat_id))
    const ids = [...new Set(anak.filter((a) => hp.has(a.perangkat_id)).flatMap((a) => a.generus_ids))]
    if (ids.length) out[w] = ids
  }
  return out
}

/** Info bidang bertanda tangan untuk paket daerah. */
export function buatInfoBidang(db: Db, kunci: KunciAdmin): BlobBertanda {
  const bk = tokenBkAktif(db)
  const data: DataInfoBidang = {
    v: 1,
    dibuat_pada: sekarangIso(),
    kunci: kunciPublikBidangSemua(db, kunci),
    bk: Object.fromEntries([...bk].map(([w, l]) => [w, [...new Map(l.map((t) => [t.perangkat_id, { perangkat_id: t.perangkat_id, box_pub: t.box_pub }])).values()]])),
    kerabat: kerabatBk(db, bk),
  }
  return tandaTanganiBlob('info', data, kunci.tandaTangan.rahasia)
}

/**
 * Kontak BK per wilayah: kebijakan M09 `kontak_bk` bila Ditetapkan Musyawarah untuk wilayah itu, selain itu nomor yang diisi
 * Admin Daerah saat menerbitkan token BK yang masih aktif (J-BJ9).
 */
export function kontakBkWilayah(db: Db): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const [w, l] of tokenBkAktif(db)) {
    const nomor = [...new Set(l.map((t) => ambilMeta(db, metaKontakBk(t.id))).filter((x): x is string => !!x))]
    if (nomor.length) out[w] = nomor
  }
  const d = idDaerah(db)
  const ditetapkan = d ? (bacaIsiKebijakan(db, 'kontak_bk', d)?.nilai as Record<string, string> | undefined) : undefined
  for (const [w, n] of Object.entries(ditetapkan ?? {})) if (n) out[w] = [n]
  return out
}

export function buatKontakBk(db: Db, kunci: KunciAdmin): BlobBertanda {
  const data: DataKontakBk = { v: 1, dibuat_pada: sekarangIso(), kontak: kontakBkWilayah(db) }
  return tandaTanganiBlob('kontak', data, kunci.tandaTangan.rahasia)
}

/** Kunci publik bidang terbaru satu wilayah dari info bidang terpasang (HP/EXE bawah). */
export function kunciPublikInfo(db: Db, bidang: BidangRahasia, wilayahId: string): { versi: number; publik: string } | undefined {
  return ambilInfoBidang(db)?.kunci[wilayahId]?.[bidang]
}
