// Cadangan data HP (.ppgdb) terenkripsi kata sandi. Database HP berisi kunci rahasia perangkat & kunci kelompok,
// jadi berkas cadangan yang dikirim ke WA/Drive wajib dikunci sandi.
// Format: "PPGCB1" | garam 16 byte | iterasi u32 BE | secretbox(PBKDF2(sandi), gzip(database)).
import { gunzipSync, gzipSync } from 'fflate'
import { byteAcak, dekripsiRahasia, enkripsiRahasia, ITERASI_PBKDF2, keUtf8, siapkanKripto, turunkanKunciSandi } from './crypto'
import type { Db } from './db'
import { GalatPpg } from './galat'
import { tanggalRingkas } from './waktu'

const MAGIS = keUtf8('PPGCB1')
const SQLITE = keUtf8('SQLite format 3\0')
export const PANJANG_SANDI_CADANGAN_MIN = 6

function awalanSama(b: Uint8Array, awalan: Uint8Array): boolean {
  if (b.length < awalan.length) return false
  for (let i = 0; i < awalan.length; i++) if (b[i] !== awalan[i]) return false
  return true
}

/** 'terenkripsi' = cadangan Fase 4; 'lama' = database polos (cadangan sebelum Fase 4); 'bukan' = berkas lain. */
export function jenisCadanganHp(bytes: Uint8Array): 'terenkripsi' | 'lama' | 'bukan' {
  if (awalanSama(bytes, MAGIS)) return 'terenkripsi'
  if (awalanSama(bytes, SQLITE)) return 'lama'
  return 'bukan'
}

/** Enkripsi bytes database HP dengan kata sandi cadangan. */
export async function enkripsiCadanganHp(dbBytes: Uint8Array, sandi: string): Promise<Uint8Array> {
  if (!sandi || sandi.length < PANJANG_SANDI_CADANGAN_MIN) {
    throw new GalatPpg('SANDI_LEMAH', `Kata sandi cadangan minimal ${PANJANG_SANDI_CADANGAN_MIN} karakter.`)
  }
  await siapkanKripto()
  const garam = byteAcak(16)
  const kunci = await turunkanKunciSandi(sandi, garam, ITERASI_PBKDF2)
  const isi = enkripsiRahasia(kunci, gzipSync(dbBytes))
  const out = new Uint8Array(MAGIS.length + 16 + 4 + isi.length)
  out.set(MAGIS, 0)
  out.set(garam, MAGIS.length)
  new DataView(out.buffer).setUint32(MAGIS.length + 16, ITERASI_PBKDF2, false)
  out.set(isi, MAGIS.length + 20)
  return out
}

/** Buat berkas cadangan HP terenkripsi: `PPG_CADANGAN_HP_<YYYYMMDD>.ppgdb`. */
export async function buatCadanganHp(db: Db, sandi: string): Promise<{ nama: string; bytes: Uint8Array }> {
  const bytes = await enkripsiCadanganHp(db.ekspor(), sandi)
  return { nama: `PPG_CADANGAN_HP_${tanggalRingkas()}.ppgdb`, bytes }
}

/**
 * Buka berkas cadangan HP → bytes database. Cadangan lama (polos, sebelum Fase 4) dikembalikan apa adanya.
 * Galat: BUKAN_CADANGAN, SANDI_SALAH (sandi salah atau berkas rusak).
 */
export async function bukaCadanganHp(bytes: Uint8Array, sandi: string): Promise<Uint8Array> {
  const jenis = jenisCadanganHp(bytes)
  if (jenis === 'lama') return bytes
  if (jenis === 'bukan') throw new GalatPpg('BUKAN_CADANGAN', 'Berkas ini bukan cadangan data HP PPG Sorong.')
  const awal = MAGIS.length
  if (bytes.length < awal + 20 + 40) throw new GalatPpg('SANDI_SALAH', 'Berkas cadangan rusak atau terpotong.')
  await siapkanKripto()
  const garam = bytes.slice(awal, awal + 16)
  const iterasi = new DataView(bytes.buffer, bytes.byteOffset).getUint32(awal + 16, false)
  if (iterasi < 1000 || iterasi > 10_000_000) throw new GalatPpg('SANDI_SALAH', 'Berkas cadangan rusak.')
  const kunci = await turunkanKunciSandi(sandi, garam, iterasi)
  let gz: Uint8Array
  try {
    gz = dekripsiRahasia(kunci, bytes.subarray(awal + 20))
  } catch {
    throw new GalatPpg('SANDI_SALAH', 'Kata sandi cadangan salah, atau berkas rusak.')
  }
  try {
    return gunzipSync(gz)
  } catch {
    throw new GalatPpg('SANDI_SALAH', 'Berkas cadangan rusak.')
  }
}
