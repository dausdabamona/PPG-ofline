// Format biner berkas .ppg (§5): "PPG1" | u32 BE panjang header | header JSON | isi | tanda tangan 64 byte.
import { gunzipSync, gzipSync } from 'fflate'
import { dariUtf8, keUtf8, periksaTandaTangan, tandaTangani } from './crypto'
import { GalatPpg } from './galat'

export type JenisBerkas = 'SETOR' | 'PAKET' | 'BELAJAR' | 'BALASAN' | 'JADWAL' | 'MATERI'
export const JENIS_BERKAS: readonly JenisBerkas[] = ['SETOR', 'PAKET', 'BELAJAR', 'BALASAN', 'JADWAL', 'MATERI']

export interface HeaderBerkas {
  jenis: JenisBerkas
  versi_format: 1
  org_id: string
  /** 'ADMIN' untuk berkas admin. */
  pengirim_perangkat_id: string
  dibuat_pada: string
  wilayah_id?: string
  urut?: number
  versi?: number
  versi_kunci?: number
  penerima_perangkat_id?: string
  /** PAKET (T10): kunci berkas tersegel per perangkat penerima → b64url(segelKe(box_pub, kunci32)). */
  kunci_penerima?: Record<string, string>
}

export interface BerkasTerbaca {
  header: HeaderBerkas
  /** Isi (masih terenkripsi, kecuali MATERI). */
  isi: Uint8Array
  /** Semua byte yang ditandatangani. */
  tertanda: Uint8Array
  sig: Uint8Array
}

/** Berkas siap simpan/kirim. */
export interface BerkasKeluar {
  nama: string
  bytes: Uint8Array
  header: HeaderBerkas
}

const MAGIS = keUtf8('PPG1')
const BATAS_HEADER = 1024 * 1024

/** Rakit berkas .ppg dan tanda tangani dengan kunci rahasia Ed25519 pengirim. */
export function kemasBerkas(header: HeaderBerkas, isi: Uint8Array, rahasiaTandaTangan: Uint8Array): Uint8Array {
  const h = keUtf8(JSON.stringify(header))
  const panjang = 4 + 4 + h.length + isi.length
  const out = new Uint8Array(panjang + 64)
  out.set(MAGIS, 0)
  new DataView(out.buffer).setUint32(4, h.length, false)
  out.set(h, 8)
  out.set(isi, 8 + h.length)
  const sig = tandaTangani(out.subarray(0, panjang), rahasiaTandaTangan)
  out.set(sig, panjang)
  return out
}

/** Urai berkas .ppg (tanpa memeriksa tanda tangan); melempar BERKAS_TIDAK_SAH. */
export function bacaBerkas(bytes: Uint8Array): BerkasTerbaca {
  const salah = () => new GalatPpg('BERKAS_TIDAK_SAH', 'Berkas ini bukan berkas PPG atau rusak.')
  if (!(bytes instanceof Uint8Array) || bytes.length < 8 + 2 + 64) throw salah()
  for (let i = 0; i < 4; i++) if (bytes[i] !== MAGIS[i]) throw salah()
  const pjg = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(4, false)
  if (pjg > BATAS_HEADER || 8 + pjg + 64 > bytes.length) throw salah()
  let header: HeaderBerkas
  try {
    header = JSON.parse(dariUtf8(bytes.subarray(8, 8 + pjg))) as HeaderBerkas
  } catch {
    throw salah()
  }
  if (
    !header ||
    typeof header !== 'object' ||
    !JENIS_BERKAS.includes(header.jenis) ||
    header.versi_format !== 1 ||
    typeof header.org_id !== 'string' ||
    typeof header.pengirim_perangkat_id !== 'string'
  ) {
    throw salah()
  }
  const akhir = bytes.length - 64
  return {
    header,
    isi: bytes.subarray(8 + pjg, akhir),
    tertanda: bytes.subarray(0, akhir),
    sig: bytes.subarray(akhir),
  }
}

/** Baca header saja (untuk menentukan jenis berkas). */
export function bacaHeader(bytes: Uint8Array): HeaderBerkas {
  return bacaBerkas(bytes).header
}

/** Periksa tanda tangan berkas dengan kunci publik Ed25519 pengirim. */
export function periksaBerkas(b: BerkasTerbaca, publik: Uint8Array): boolean {
  return periksaTandaTangan(b.tertanda, b.sig, publik)
}

/** JSON → gzip. */
export function kompresJson(obj: unknown): Uint8Array {
  return gzipSync(keUtf8(JSON.stringify(obj)), { level: 6 })
}

/** gzip → JSON; melempar BERKAS_TIDAK_SAH. */
export function dekompresJson<T>(bytes: Uint8Array): T {
  try {
    return JSON.parse(dariUtf8(gunzipSync(bytes))) as T
  } catch {
    throw new GalatPpg('BERKAS_TIDAK_SAH', 'Isi berkas rusak.')
  }
}

/** Slug untuk nama berkas: huruf kecil, angka, tanda hubung. */
export function slug(teks: string): string {
  const s = teks
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return s || 'tanpa-nama'
}
