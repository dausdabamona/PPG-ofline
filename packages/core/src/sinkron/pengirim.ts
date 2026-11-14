// Verifikasi pengirim berkas mubaligh (BALASAN/JADWAL) di HP penerima.
import { periksaBerkas, type BerkasTerbaca } from '../berkas'
import { dariB64url } from '../crypto'
import type { Db } from '../db'
import { GalatPpg } from '../galat'
import { daftarPencabutan } from '../repo/perangkat'
import { periksaToken, type PayloadToken } from '../token'
import { kunciAdminTerpasang } from './umum'

/**
 * Pastikan berkas ditandatangani perangkat mubaligh sah untuk kelompok: token mubaligh pengirim
 * ditandatangani admin, tidak dicabut (per catatan lokal), kelompok cocok, perangkat cocok.
 * Kedaluwarsa tidak menghalangi (berkas tetap boleh dibaca).
 */
export function periksaPengirimMubaligh(db: Db, b: BerkasTerbaca, tokenPengirim: unknown, kelompokId: string): PayloadToken {
  const admin = kunciAdminTerpasang(db)
  if (typeof tokenPengirim !== 'string') throw new GalatPpg('PENGIRIM_TIDAK_SAH', 'Berkas tidak memuat token pengirim.')
  const h = periksaToken(tokenPengirim, { adminSignPub: admin.signPub, pencabutan: daftarPencabutan(db), abaikanKedaluwarsa: true })
  if (!h.sah && h.kode !== 'DIBEKUKAN') throw new GalatPpg('PENGIRIM_TIDAK_SAH', `Pengirim berkas tidak sah: ${h.alasan}`)
  const p = h.payload!
  if (p.role !== 'mubaligh' || p.wilayah_id !== kelompokId) throw new GalatPpg('PENGIRIM_TIDAK_SAH', 'Pengirim bukan mubaligh kelompok ini.')
  if (p.perangkat_id !== b.header.pengirim_perangkat_id || !periksaBerkas(b, dariB64url(p.device_sign_pub))) {
    throw new GalatPpg('TANDA_TANGAN_TIDAK_SAH', 'Tanda tangan berkas tidak sah.')
  }
  return p
}
