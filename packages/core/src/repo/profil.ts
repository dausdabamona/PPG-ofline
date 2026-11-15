// Akses data profil di HP (multi-profil, K13) dan pemeriksaan wewenang pencatatan lokal.
import type { Db } from '../db'
import { GalatPpg } from '../galat'
import type { Hak, PayloadToken, RahasiaToken, Role } from '../token'
import { uraiToken } from '../token'
import { sekarangIso } from '../waktu'
import { tandaTanya, uraiJson } from './umum'
import { wilayahMencakup } from './wilayah'

export interface Profil {
  id: string
  token_id: string
  token: string
  role: Role
  nama: string
  wilayah_id: string
  tingkat: PayloadToken['tingkat']
  generus_ids: string[]
  hak: Hak[]
  rahasia: RahasiaToken
  dibekukan: boolean
  dicabut_pada: string | null
  aktif: boolean
  berlaku_sampai: string
  ada_pin: boolean
  dibuat_pada: string
}

interface BarisProfil {
  id: string
  token_id: string
  token: string
  role: Role
  nama: string
  wilayah_id: string
  tingkat: PayloadToken['tingkat']
  generus_ids_json: string
  pin_hash: string | null
  pin_garam: string | null
  rahasia_json: string
  dibekukan: number
  dicabut_pada: string | null
  aktif: number
  berlaku_sampai: string
  dibuat_pada: string
}

function dariBaris(b: BarisProfil): Profil {
  let hak: Hak[] = []
  try {
    hak = uraiToken(b.token).payload.hak
  } catch {
    hak = []
  }
  return {
    id: b.id,
    token_id: b.token_id,
    token: b.token,
    role: b.role,
    nama: b.nama,
    wilayah_id: b.wilayah_id,
    tingkat: b.tingkat,
    generus_ids: uraiJson<string[]>(b.generus_ids_json, []),
    hak,
    rahasia: uraiJson<RahasiaToken>(b.rahasia_json, {}),
    dibekukan: !!b.dibekukan,
    dicabut_pada: b.dicabut_pada,
    aktif: !!b.aktif,
    berlaku_sampai: b.berlaku_sampai,
    ada_pin: !!b.pin_hash,
    dibuat_pada: b.dibuat_pada,
  }
}

/** Baris mentah profil (termasuk hash PIN) — internal. */
export function barisProfil(db: Db, id: string): BarisProfil | undefined {
  return db.satu<BarisProfil>('SELECT * FROM profil WHERE id = ?', [id])
}

/** Daftar semua profil di HP ini (urut dibuat). */
export function daftarProfil(db: Db, role?: Role | Role[]): Profil[] {
  if (role) {
    const r = Array.isArray(role) ? role : [role]
    return db.kueri<BarisProfil>(`SELECT * FROM profil WHERE role IN (${tandaTanya(r.length)}) ORDER BY dibuat_pada`, r).map(dariBaris)
  }
  return db.kueri<BarisProfil>('SELECT * FROM profil ORDER BY dibuat_pada').map(dariBaris)
}

/** Ambil profil menurut id. */
export function ambilProfil(db: Db, id: string): Profil | undefined {
  const b = barisProfil(db, id)
  return b ? dariBaris(b) : undefined
}

/** Profil yang sedang dipilih (aktif), bila ada. */
export function profilAktif(db: Db): Profil | undefined {
  const b = db.satu<BarisProfil>('SELECT * FROM profil WHERE aktif = 1 LIMIT 1')
  return b ? dariBaris(b) : undefined
}

/** Simpan bagian rahasia profil (kunci kelompok). */
export function simpanRahasiaProfil(db: Db, id: string, rahasia: RahasiaToken): void {
  db.jalankan('UPDATE profil SET rahasia_json = ? WHERE id = ?', [JSON.stringify(rahasia), id])
}

export type KodeStatusProfil = 'DICABUT' | 'DIBEKUKAN' | 'KEDALUWARSA'

/** Status profil: boleh mencatat/menyetor atau tidak (beserta alasan). Membaca data selalu boleh. */
export function statusProfil(p: Profil, sekarang: string = sekarangIso()): { bolehMencatat: boolean; kode?: KodeStatusProfil; alasan?: string } {
  if (p.dicabut_pada) return { bolehMencatat: false, kode: 'DICABUT', alasan: 'Token profil ini sudah dicabut admin.' }
  if (p.dibekukan) return { bolehMencatat: false, kode: 'DIBEKUKAN', alasan: 'Sedang mondok — pencatatan dihentikan sementara.' }
  if (sekarang > p.berlaku_sampai) return { bolehMencatat: false, kode: 'KEDALUWARSA', alasan: 'Masa berlaku token habis. Minta perpanjangan.' }
  return { bolehMencatat: true }
}

/** Lempar bila profil tidak boleh mencatat. */
export function pastikanProfilBolehMencatat(p: Profil): void {
  const st = statusProfil(p)
  if (!st.bolehMencatat) throw new GalatPpg(st.kode!, st.alasan!)
}

/**
 * Cari profil di HP ini yang berwenang mencatat untuk kelompok tertentu (role & hak sesuai, token berlaku).
 * Dipakai oleh fungsi pencatatan kegiatan di HP.
 */
export function cariProfilPencatat(db: Db, kelompokId: string, role: Role[], hak: Hak = 'catat'): Profil {
  // profil tingkat daerah (Super Admin HP, pengurus daerah) mencakup seluruh wilayah, termasuk yang belum ada di pohon lokal
  const kandidat = daftarProfil(db, role).filter((p) => p.hak.includes(hak) && (p.tingkat === 'daerah' || wilayahMencakup(db, p.wilayah_id, kelompokId)))
  if (kandidat.length === 0) {
    throw new GalatPpg('TIDAK_BERWENANG', 'Tidak ada profil di HP ini yang berwenang untuk kelompok tersebut.')
  }
  const boleh = kandidat.find((p) => statusProfil(p).bolehMencatat)
  if (!boleh) pastikanProfilBolehMencatat(kandidat[0]!)
  return boleh!
}
