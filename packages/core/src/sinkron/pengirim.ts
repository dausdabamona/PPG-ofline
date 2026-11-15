// Verifikasi pengirim berkas mubaligh/EXE (BALASAN/JADWAL) di HP penerima.
import { periksaBerkas, type BerkasTerbaca } from '../berkas'
import { dariB64url } from '../crypto'
import type { Db } from '../db'
import { GalatPpg } from '../galat'
import { wilayahRantaiPenerbit } from '../rantai'
import { daftarPencabutan } from '../repo/perangkat'
import { daftarProfil } from '../repo/profil'
import { periksaToken, type PayloadToken } from '../token'
import { rantaiWilayah } from './balasan'
import { kunciAdminTerpasang } from './umum'

/**
 * Pastikan berkas ditandatangani perangkat mubaligh sah untuk kelompok: token mubaligh pengirim
 * sah lewat rantai sampai admin daerah, tidak dicabut (per catatan lokal), kelompok cocok, perangkat cocok.
 * Kedaluwarsa tidak menghalangi (berkas tetap boleh dibaca).
 * `bolehExe` (v3, BALASAN): pengirim juga boleh EXE desa/kelompok (role admin) yang wilayahnya memuat kelompok itu.
 */
export function periksaPengirimMubaligh(db: Db, b: BerkasTerbaca, tokenPengirim: unknown, kelompokId: string, o: { bolehExe?: boolean } = {}): PayloadToken {
  const admin = kunciAdminTerpasang(db)
  if (typeof tokenPengirim !== 'string') throw new GalatPpg('PENGIRIM_TIDAK_SAH', 'Berkas tidak memuat token pengirim.')
  const h = periksaToken(tokenPengirim, { adminSignPub: admin.signPub, pencabutan: daftarPencabutan(db), abaikanKedaluwarsa: true })
  if (!h.sah && h.kode !== 'DIBEKUKAN') throw new GalatPpg('PENGIRIM_TIDAK_SAH', `Pengirim berkas tidak sah: ${h.alasan}`)
  const p = h.payload!
  const mubaligh = p.role === 'mubaligh' && p.wilayah_id === kelompokId
  const exe = !!o.bolehExe && p.role === 'admin' && h.sah && wilayahTerpercaya(db, kelompokId).has(p.wilayah_id)
  if (!mubaligh && !exe) throw new GalatPpg('PENGIRIM_TIDAK_SAH', 'Pengirim bukan mubaligh (atau EXE desa/kelompok) kelompok ini.')
  if (p.perangkat_id !== b.header.pengirim_perangkat_id || !periksaBerkas(b, dariB64url(p.device_sign_pub))) {
    throw new GalatPpg('TANDA_TANGAN_TIDAK_SAH', 'Tanda tangan berkas tidak sah.')
  }
  return p
}

/**
 * Wilayah yang dipercaya memuat kelompok di HP generus/wali: rantai wilayah lokal + wilayah penerbit dalam rantai
 * token profil kelompok itu (mis. desa yang menerbitkan token mubaligh penerbit — tertanda daerah).
 */
function wilayahTerpercaya(db: Db, kelompokId: string): Set<string> {
  const hasil = rantaiWilayah(db, kelompokId)
  for (const p of daftarProfil(db).filter((x) => x.wilayah_id === kelompokId)) for (const w of wilayahRantaiPenerbit(p.token)) hasil.add(w)
  return hasil
}
