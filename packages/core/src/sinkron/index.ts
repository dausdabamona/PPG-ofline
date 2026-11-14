// Pintu masuk tunggal membuka berkas apa saja di HP, plus impor massal.
import type { KunciAdmin } from '../admin'
import { bacaHeader, type JenisBerkas } from '../berkas'
import type { Db } from '../db'
import { adalahGalatPpg, GalatPpg } from '../galat'
import { daftarProfil } from '../repo/profil'
import { adalahAdmin } from '../repo/umum'
import { terapkanBalasan } from './balasan'
import { imporBelajar, type RingkasanImporBelajar } from './belajar'
import { terapkanJadwal } from './jadwal'
import { terapkanMateri } from './materi'
import { terapkanPaket, type RingkasanTerapkan } from './paket'
import { imporSetor, type RingkasanImporSetor } from './setor'

export type RingkasanBerkas = RingkasanTerapkan | RingkasanImporBelajar | RingkasanImporSetor

/**
 * Buka berkas .ppg apa saja di HP: baca header lalu arahkan ke fungsi yang cocok.
 * Pesan jelas bila berkas bukan untuk HP ini (mis. SETOR → untuk admin).
 */
export function bukaBerkasApaSaja(db: Db, bytes: Uint8Array, namaBerkas?: string): { jenis: JenisBerkas; ringkasan: RingkasanBerkas } {
  const h = bacaHeader(bytes)
  if (adalahAdmin(db)) {
    throw new GalatPpg('DB_ADMIN', 'Di aplikasi admin, gunakan menu Impor Setoran (imporSetor).')
  }
  switch (h.jenis) {
    case 'PAKET':
      return { jenis: h.jenis, ringkasan: terapkanPaket(db, bytes, namaBerkas) }
    case 'BALASAN':
      return { jenis: h.jenis, ringkasan: terapkanBalasan(db, bytes, namaBerkas) }
    case 'JADWAL':
      return { jenis: h.jenis, ringkasan: terapkanJadwal(db, bytes, namaBerkas) }
    case 'MATERI':
      return { jenis: h.jenis, ringkasan: terapkanMateri(db, bytes, namaBerkas) }
    case 'BELAJAR':
      if (!daftarProfil(db, 'mubaligh').length) {
        throw new GalatPpg('BERKAS_UNTUK_MUBALIGH', 'Berkas setoran belajar ini dibuka di HP mubaligh, bukan di HP ini.')
      }
      return { jenis: h.jenis, ringkasan: imporBelajar(db, bytes, namaBerkas) }
    case 'SETOR':
      throw new GalatPpg('BERKAS_UNTUK_ADMIN', 'Berkas setoran ini untuk admin. Kirim ke admin lewat WA.')
  }
}

export interface HasilImporBanyak {
  nama?: string
  berhasil: boolean
  jenis?: JenisBerkas
  ringkasan?: RingkasanBerkas
  galat?: { kode: string; pesan: string }
}

/**
 * Impor banyak berkas sekaligus. Di HP: setiap berkas lewat bukaBerkasApaSaja.
 * Di admin: berkas SETOR diimpor dengan `kunciAdmin`. Galat per berkas tidak menghentikan berkas lain.
 */
export function imporBanyak(
  db: Db,
  daftar: (Uint8Array | { nama?: string; bytes: Uint8Array })[],
  kunciAdmin?: KunciAdmin,
): HasilImporBanyak[] {
  return daftar.map((x) => {
    const bytes = x instanceof Uint8Array ? x : x.bytes
    const nama = x instanceof Uint8Array ? undefined : x.nama
    try {
      if (adalahAdmin(db)) {
        if (!kunciAdmin) throw new GalatPpg('KUNCI_ADMIN_DIBUTUHKAN', 'Buka kunci admin dulu.')
        const h = bacaHeader(bytes)
        if (h.jenis !== 'SETOR') throw new GalatPpg('JENIS_BERKAS_SALAH', `Admin hanya mengimpor berkas SETOR (ini ${h.jenis}).`)
        return { nama, berhasil: true, jenis: 'SETOR', ringkasan: imporSetor(db, bytes, kunciAdmin, nama) }
      }
      const r = bukaBerkasApaSaja(db, bytes, nama)
      return { nama, berhasil: true, jenis: r.jenis, ringkasan: r.ringkasan }
    } catch (e) {
      const galat = adalahGalatPpg(e) ? { kode: e.kode, pesan: e.pesan } : { kode: 'GALAT', pesan: String(e) }
      return { nama, berhasil: false, galat }
    }
  })
}
