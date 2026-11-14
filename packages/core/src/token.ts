// Kode Perangkat, token bertanda tangan, dan rantai kepercayaan (§4).
import {
  bukaSegel,
  dariB64url,
  dariUtf8,
  keB64url,
  keUtf8,
  periksaTandaTangan,
  tandaTangani,
  type PasanganKunci,
} from './crypto'
import { GalatPpg } from './galat'
import { sekarangIso } from './waktu'

export type Role = 'pengurus' | 'mubaligh' | 'generus' | 'wali'
export type TingkatToken = 'daerah' | 'desa' | 'kelompok'
export type Hak = 'catat' | 'lihat' | 'sahkan' | 'terbit_generus' | 'setor_belajar'

export const ROLE: readonly Role[] = ['pengurus', 'mubaligh', 'generus', 'wali']
export const HAK: readonly Hak[] = ['catat', 'lihat', 'sahkan', 'terbit_generus', 'setor_belajar']

/** Hak bawaan per role. */
export const HAK_BAWAAN: Record<Role, Hak[]> = {
  pengurus: ['catat', 'lihat'],
  mubaligh: ['catat', 'lihat', 'sahkan', 'terbit_generus'],
  generus: ['catat', 'lihat', 'setor_belajar'],
  wali: ['lihat'],
}

const HAK_DELEGASI: readonly Hak[] = ['catat', 'lihat', 'setor_belajar']

export interface PayloadToken {
  v: 1
  token_id: string
  org_id: string
  admin_sign_pub: string
  admin_box_pub: string
  perangkat_id: string
  device_sign_pub: string
  device_box_pub: string
  role: Role
  nama: string
  tingkat: TingkatToken
  wilayah_id: string
  generus_ids?: string[]
  hak: Hak[]
  terbit: string
  berlaku_sampai: string
  rahasia?: string
  penerbit?: string
}

/** Satu versi kunci kelompok setor (X25519). `rahasia` hanya dipegang mubaligh. */
export interface KunciSetor {
  versi: number
  publik: string
  rahasia?: string
  /**
   * Tanda tangan admin (b64url) atas `PPGKS1.<org_id>.<kelompok_id>.<versi>.<publik>` (Fase 1b).
   * HP generus/wali hanya memakai kunci bertanda tangan sah, sehingga mubaligh (atau mubaligh yang sudah
   * dicabut) tidak bisa menyisipkan kunci setor palsu untuk menyadap BELAJAR.
   */
  tt?: string
}

function pesanKunciSetor(orgId: string, kelompokId: string, versi: number, publik: string): Uint8Array {
  return keUtf8(`PPGKS1.${orgId}.${kelompokId}.${versi}.${publik}`)
}

/** Admin menandatangani kunci setor publik satu kelompok. */
export function tandaTanganiKunciSetor(orgId: string, kelompokId: string, k: Pick<KunciSetor, 'versi' | 'publik'>, rahasiaAdmin: Uint8Array): string {
  return keB64url(tandaTangani(pesanKunciSetor(orgId, kelompokId, k.versi, k.publik), rahasiaAdmin))
}

/** Apakah kunci setor bertanda tangan sah admin untuk kelompok itu. Tidak pernah melempar. */
export function kunciSetorSah(k: KunciSetor | undefined, o: { orgId: string; kelompokId: string; adminSignPub: string }): boolean {
  if (!k || typeof k.versi !== 'number' || typeof k.publik !== 'string' || typeof k.tt !== 'string') return false
  try {
    return periksaTandaTangan(pesanKunciSetor(o.orgId, o.kelompokId, k.versi, k.publik), dariB64url(k.tt), dariB64url(o.adminSignPub))
  } catch {
    return false
  }
}

export interface RahasiaToken {
  /** Tidak dipakai lagi sejak T10 (PAKET memakai amplop per penerima); dipertahankan agar kompatibel. */
  kunci_wilayah?: Record<string, string>
  kunci_kelompok_setor?: KunciSetor[]
  kunci_umum_kelompok?: string
  /** Versi kunci umum kelompok (naik saat serah terima / ganti kunci kelompok). Tidak ada = 1. */
  kunci_umum_versi?: number
}

export interface DataKodePerangkat {
  perangkat_id: string
  sign_pub: string
  box_pub: string
  label: string
  dibuat_pada: string
}

const AWALAN_KODE = 'PPGD1.'
const AWALAN_TOKEN = 'PPGT1.'

function keJsonB64(obj: unknown): string {
  return keB64url(keUtf8(JSON.stringify(obj)))
}

function dariJsonB64<T>(s: string, kode: string, pesan: string): T {
  try {
    return JSON.parse(dariUtf8(dariB64url(s))) as T
  } catch {
    throw new GalatPpg(kode, pesan)
  }
}

function bersihkan(teks: string): string {
  return teks.replace(/\s+/g, '')
}

/** Kode Perangkat → teks `PPGD1.<b64url(JSON)>` (untuk QR / dikirim lewat WA). */
export function buatKodePerangkat(data: DataKodePerangkat): string {
  return AWALAN_KODE + keJsonB64(data)
}

/** Urai teks Kode Perangkat; melempar KODE_PERANGKAT_TIDAK_SAH. */
export function bacaKodePerangkat(teks: string): DataKodePerangkat {
  const t = bersihkan(teks)
  const pesan = 'Kode Perangkat tidak sah. Salin ulang dari HP yang bersangkutan.'
  if (!t.startsWith(AWALAN_KODE)) throw new GalatPpg('KODE_PERANGKAT_TIDAK_SAH', pesan)
  const d = dariJsonB64<DataKodePerangkat>(t.slice(AWALAN_KODE.length), 'KODE_PERANGKAT_TIDAK_SAH', pesan)
  if (
    typeof d?.perangkat_id !== 'string' ||
    typeof d.sign_pub !== 'string' ||
    typeof d.box_pub !== 'string' ||
    dariB64url(d.sign_pub).length !== 32 ||
    dariB64url(d.box_pub).length !== 32
  ) {
    throw new GalatPpg('KODE_PERANGKAT_TIDAK_SAH', pesan)
  }
  return { ...d, label: String(d.label ?? ''), dibuat_pada: String(d.dibuat_pada ?? '') }
}

/** Tanda tangani payload → teks token `PPGT1.<payload>.<sig>`. */
export function tandaTanganiToken(payload: PayloadToken, rahasiaTandaTangan: Uint8Array): string {
  const bagian = AWALAN_TOKEN + keJsonB64(payload)
  const sig = tandaTangani(keUtf8(bagian), rahasiaTandaTangan)
  return `${bagian}.${keB64url(sig)}`
}

export interface TokenTerurai {
  payload: PayloadToken
  bagianTertanda: string
  sig: Uint8Array
  teks: string
}

/** Urai token TANPA memeriksa tanda tangan; melempar TOKEN_TIDAK_SAH bila bentuknya rusak. */
export function uraiToken(teks: string): TokenTerurai {
  const t = bersihkan(teks)
  const pesan = 'Token tidak sah atau rusak. Minta token baru.'
  if (!t.startsWith(AWALAN_TOKEN)) throw new GalatPpg('TOKEN_TIDAK_SAH', pesan)
  const bagian = t.split('.')
  if (bagian.length !== 3) throw new GalatPpg('TOKEN_TIDAK_SAH', pesan)
  const payload = dariJsonB64<PayloadToken>(bagian[1]!, 'TOKEN_TIDAK_SAH', pesan)
  let sig: Uint8Array
  try {
    sig = dariB64url(bagian[2]!)
  } catch {
    throw new GalatPpg('TOKEN_TIDAK_SAH', pesan)
  }
  if (!bentukPayloadSah(payload)) throw new GalatPpg('TOKEN_TIDAK_SAH', pesan)
  return { payload, bagianTertanda: `${bagian[0]}.${bagian[1]}`, sig, teks: t }
}

function bentukPayloadSah(p: PayloadToken): boolean {
  const teks = (x: unknown) => typeof x === 'string' && x.length > 0
  return (
    p !== null &&
    typeof p === 'object' &&
    p.v === 1 &&
    teks(p.token_id) &&
    teks(p.org_id) &&
    teks(p.admin_sign_pub) &&
    teks(p.admin_box_pub) &&
    teks(p.perangkat_id) &&
    teks(p.device_sign_pub) &&
    teks(p.device_box_pub) &&
    ROLE.includes(p.role) &&
    typeof p.nama === 'string' &&
    ['daerah', 'desa', 'kelompok'].includes(p.tingkat) &&
    teks(p.wilayah_id) &&
    Array.isArray(p.hak) &&
    p.hak.every((h) => HAK.includes(h)) &&
    teks(p.terbit) &&
    teks(p.berlaku_sampai) &&
    (p.generus_ids === undefined || (Array.isArray(p.generus_ids) && p.generus_ids.every(teks)))
  )
}

/** Catatan pencabutan/pembekuan per token. */
export interface CatatanPencabutan {
  token_id: string
  jenis: 'cabut' | 'beku' | 'cair'
  tanggal: string
}

/** Status pencabutan token: cabut bersifat permanen; beku/cair memakai catatan terakhir. */
export function statusPencabutan(
  daftar: readonly CatatanPencabutan[] | undefined,
  tokenId: string,
): { dicabutPada: string | null; dibekukan: boolean } {
  let dicabutPada: string | null = null
  let beku: CatatanPencabutan | null = null
  for (const c of daftar ?? []) {
    if (c.token_id !== tokenId) continue
    if (c.jenis === 'cabut') {
      if (!dicabutPada || c.tanggal < dicabutPada) dicabutPada = c.tanggal
    } else if (!beku || c.tanggal >= beku.tanggal) {
      beku = c
    }
  }
  return { dicabutPada, dibekukan: beku?.jenis === 'beku' }
}

export interface OpsiPeriksaToken {
  /** Kunci tanda tangan admin yang dipercaya (b64url). */
  adminSignPub: string
  /** Waktu acuan ISO (bawaan: sekarang). */
  sekarang?: string
  pencabutan?: readonly CatatanPencabutan[]
  /** Lewati pemeriksaan kedaluwarsa (untuk membaca data lama). */
  abaikanKedaluwarsa?: boolean
  /**
   * Token generus/wali yang dikenal (terdaftar). Bila diberikan dan penerbitnya sudah dicabut,
   * token yang TIDAK terdaftar ditolak (mencegah mubaligh tercabut memalsukan tanggal terbit).
   */
  tokenDikenal?: ReadonlySet<string>
}

export type KodeTolakToken =
  | 'TOKEN_TIDAK_SAH'
  | 'TANDA_TANGAN_TIDAK_SAH'
  | 'ADMIN_BERBEDA'
  | 'RANTAI_TIDAK_SAH'
  | 'DICABUT'
  | 'KEDALUWARSA'
  | 'DIBEKUKAN'

export type HasilPeriksaToken =
  | { sah: true; payload: PayloadToken }
  | { sah: false; kode: KodeTolakToken; alasan: string; payload?: PayloadToken }

function tolak(kode: KodeTolakToken, alasan: string, payload?: PayloadToken): HasilPeriksaToken {
  return payload ? { sah: false, kode, alasan, payload } : { sah: false, kode, alasan }
}

/**
 * Periksa token lengkap: bentuk, tanda tangan, rantai penerbit (generus/wali), pencabutan,
 * kedaluwarsa, pembekuan. Tidak pernah melempar.
 * Hasil `sah:false` dengan kode KEDALUWARSA/DIBEKUKAN tetap membawa `payload` (data lokal tetap bisa dibaca).
 */
export function periksaToken(teks: string, opsi: OpsiPeriksaToken): HasilPeriksaToken {
  let t: TokenTerurai
  try {
    t = uraiToken(teks)
  } catch {
    return tolak('TOKEN_TIDAK_SAH', 'Token rusak atau bukan token PPG.')
  }
  const p = t.payload
  const sekarang = opsi.sekarang ?? sekarangIso()
  if (p.admin_sign_pub !== opsi.adminSignPub) {
    return tolak('ADMIN_BERBEDA', 'Token ini diterbitkan oleh admin/organisasi lain.')
  }
  const delegasi = p.role === 'generus' || p.role === 'wali'
  if (!delegasi) {
    if (p.penerbit) return tolak('TOKEN_TIDAK_SAH', 'Token pengurus/mubaligh tidak boleh berpenerbit.')
    if (!periksaTandaTangan(keUtf8(t.bagianTertanda), t.sig, dariB64url(p.admin_sign_pub))) {
      return tolak('TANDA_TANGAN_TIDAK_SAH', 'Tanda tangan token tidak sah (token palsu atau telah diubah).')
    }
    if (p.role === 'mubaligh' && p.tingkat !== 'kelompok') {
      return tolak('TOKEN_TIDAK_SAH', 'Token mubaligh harus untuk satu kelompok.')
    }
  } else {
    const r = periksaRantai(t, opsi)
    if (r) return r
  }
  const st = statusPencabutan(opsi.pencabutan, p.token_id)
  if (st.dicabutPada && st.dicabutPada <= sekarang) return tolak('DICABUT', 'Token ini sudah dicabut admin.', p)
  if (!opsi.abaikanKedaluwarsa && sekarang > p.berlaku_sampai) {
    return tolak('KEDALUWARSA', 'Masa berlaku token sudah habis. Minta perpanjangan token.', p)
  }
  if (st.dibekukan) return tolak('DIBEKUKAN', 'Token sedang dibekukan (mis. sedang mondok).', p)
  return { sah: true, payload: p }
}

function periksaRantai(t: TokenTerurai, opsi: OpsiPeriksaToken): HasilPeriksaToken | null {
  const p = t.payload
  if (!p.penerbit) return tolak('RANTAI_TIDAK_SAH', 'Token generus/wali wajib memuat token mubaligh penerbit.')
  let pen: TokenTerurai
  try {
    pen = uraiToken(p.penerbit)
  } catch {
    return tolak('RANTAI_TIDAK_SAH', 'Token penerbit rusak.')
  }
  const q = pen.payload
  if (q.role !== 'mubaligh' || q.penerbit) return tolak('RANTAI_TIDAK_SAH', 'Penerbit token bukan mubaligh.')
  if (q.admin_sign_pub !== opsi.adminSignPub || q.org_id !== p.org_id || q.admin_box_pub !== p.admin_box_pub) {
    return tolak('RANTAI_TIDAK_SAH', 'Penerbit berasal dari organisasi lain.')
  }
  if (!periksaTandaTangan(keUtf8(pen.bagianTertanda), pen.sig, dariB64url(opsi.adminSignPub))) {
    return tolak('RANTAI_TIDAK_SAH', 'Token mubaligh penerbit tidak sah.')
  }
  if (!q.hak.includes('terbit_generus')) return tolak('RANTAI_TIDAK_SAH', 'Mubaligh penerbit tidak berhak menerbitkan token generus.')
  if (q.wilayah_id !== p.wilayah_id || p.tingkat !== 'kelompok') {
    return tolak('RANTAI_TIDAK_SAH', 'Token generus/wali harus untuk kelompok mubaligh penerbit.')
  }
  if (p.terbit > q.berlaku_sampai || p.terbit < q.terbit) {
    return tolak('RANTAI_TIDAK_SAH', 'Token diterbitkan di luar masa berlaku token mubaligh.')
  }
  const stPen = statusPencabutan(opsi.pencabutan, q.token_id)
  if (stPen.dicabutPada) {
    if (stPen.dicabutPada <= p.terbit) return tolak('RANTAI_TIDAK_SAH', 'Token diterbitkan setelah mubaligh penerbit dicabut.')
    if (opsi.tokenDikenal && !opsi.tokenDikenal.has(p.token_id)) {
      return tolak('RANTAI_TIDAK_SAH', 'Penerbit sudah dicabut dan token ini tidak pernah dilaporkan. Minta token baru ke mubaligh.')
    }
  }
  if (!periksaTandaTangan(keUtf8(t.bagianTertanda), t.sig, dariB64url(q.device_sign_pub))) {
    return tolak('TANDA_TANGAN_TIDAK_SAH', 'Tanda tangan token tidak sah (token palsu atau telah diubah).')
  }
  if (!p.hak.every((h) => HAK_DELEGASI.includes(h))) return tolak('RANTAI_TIDAK_SAH', 'Token generus/wali memuat hak yang tidak diizinkan.')
  const ids = p.generus_ids ?? []
  if (p.role === 'generus' && ids.length !== 1) return tolak('TOKEN_TIDAK_SAH', 'Token generus harus untuk tepat satu generus.')
  if (p.role === 'wali' && ids.length < 1) return tolak('TOKEN_TIDAK_SAH', 'Token wali harus memuat minimal satu anak.')
  if (p.role === 'wali' && p.hak.includes('setor_belajar')) return tolak('RANTAI_TIDAK_SAH', 'Wali tidak menyetor kemajuan belajar.')
  return null
}

/** Buka bagian `rahasia` token dengan pasangan kunci kotak perangkat. */
export function bukaRahasiaToken(payload: PayloadToken, pasanganKotak: PasanganKunci): RahasiaToken {
  if (!payload.rahasia) return {}
  const b = bukaSegel(dariB64url(payload.rahasia), pasanganKotak)
  try {
    return JSON.parse(dariUtf8(b)) as RahasiaToken
  } catch {
    throw new GalatPpg('TIDAK_BISA_DIBUKA', 'Bagian rahasia token rusak.')
  }
}
