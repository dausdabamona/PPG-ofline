// Pembantu uji: jam terkendali, pembuatan DB admin & HP.
import {
  aktifkanProfil,
  aturJam,
  bukaDb,
  inisialisasiAdmin,
  inisialisasiPerangkat,
  simpanDb,
  type Db,
  type KunciAdmin,
} from '../src/index'

let kini = new Date('2026-11-01T01:00:00.000Z')

/** Pasang jam uji mulai ISO tertentu. */
export function pasangJam(iso: string): void {
  kini = new Date(iso)
  aturJam(() => new Date(kini.getTime()))
}

/** Majukan jam uji. */
export function maju(menit: number): void {
  kini = new Date(kini.getTime() + menit * 60_000)
}

/** Majukan jam ke tanggal tertentu (jam 10.00 WIT = 01.00Z). */
export function keTanggal(tanggal: string, jamUtc = '01:00'): void {
  kini = new Date(`${tanggal}T${jamUtc}:00.000Z`)
}

export function lepasJam(): void {
  aturJam(null)
}

export const SANDI = 'sandi-admin-123'

export async function buatAdmin(nama = 'PPG Sorong'): Promise<{ db: Db; kunci: KunciAdmin }> {
  const db = await bukaDb()
  const kunci = await inisialisasiAdmin(db, { sandi: SANDI, namaOrganisasi: nama })
  return { db, kunci }
}

export async function buatHp(label: string): Promise<{ db: Db; kode: string; id: string }> {
  const db = await bukaDb()
  const { identitas, kodePerangkat } = await inisialisasiPerangkat(db, label)
  return { db, kode: kodePerangkat, id: identitas.id }
}

/** Simpan lalu buka ulang (meniru aplikasi ditutup/dibuka). */
export async function bukaUlang(db: Db): Promise<Db> {
  return bukaDb(simpanDb(db))
}

export { aktifkanProfil }

import {
  aktifkanProfil as aktifkan,
  buatMateri,
  buatPaket,
  tambahGenerus,
  tambahWilayah,
  terapkanMateri,
  terapkanPaket,
  terbitkanToken,
  type Generus,
  type Profil,
  type Wilayah,
} from '../src/index'

export interface Dunia {
  admin: { db: Db; kunci: KunciAdmin }
  mubaligh: { db: Db; kode: string; id: string; profil: Profil }
  daerah: Wilayah
  desa: Wilayah
  k1: Wilayah
  k2: Wilayah
  g: Generus[]
  /** Kirim paket K1 terbaru ke HP mubaligh. */
  segarkan: () => void
}

/** Admin + 1 daerah/1 desa/2 kelompok + 3 generus K1 + mubaligh K1 (paket & materi terpasang). */
export async function buatDunia(): Promise<Dunia> {
  const admin = await buatAdmin()
  const daerah = tambahWilayah(admin.db, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
  const desa = tambahWilayah(admin.db, { tingkat: 'desa', nama: 'Klasaman', kode: 'KLS', indukId: daerah.id })
  const k1 = tambahWilayah(admin.db, { tingkat: 'kelompok', nama: 'Klasaman 1', kode: 'K1', indukId: desa.id })
  const k2 = tambahWilayah(admin.db, { tingkat: 'kelompok', nama: 'Klasaman 2', kode: 'K2', indukId: desa.id })
  const g = ['Ali', 'Budi', 'Citra'].map((nama, i) =>
    tambahGenerus(admin.db, { kelompokId: k1.id, nama, jenisKelamin: i === 2 ? 'P' : 'L', kategori: 'caberawit', mulai: '2026-10-01', waliNoHp: '0812000000' + i }),
  )
  const hp = await buatHp('HP Mubaligh')
  const profil = await aktifkan(hp.db, terbitkanToken(admin.db, admin.kunci, { kodePerangkat: hp.kode, role: 'mubaligh', nama: 'Ust. Hasan', wilayahId: k1.id }))
  const segarkan = () => terapkanPaket(hp.db, buatPaket(admin.db, k1.id, admin.kunci).bytes)
  segarkan()
  terapkanMateri(hp.db, buatMateri(admin.db, admin.kunci).bytes)
  return { admin, mubaligh: { ...hp, profil }, daerah, desa, k1, k2, g, segarkan }
}
