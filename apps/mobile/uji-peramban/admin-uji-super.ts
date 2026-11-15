// Admin Daerah tiruan untuk uji asap Super Admin HP di peramban (dibundel rolldown → .cjs untuk Node).
import { buatMateri, buatPaket, bukaDb, imporSetor, inisialisasiAdmin, tambahGenerus, tambahWilayah, terbitkanToken } from '@ppg/core'

export async function siapkan() {
  const db = await bukaDb()
  const kunci = await inisialisasiAdmin(db, { sandi: 'sandi-admin-123', namaOrganisasi: 'PPG Sorong Uji' })
  const d = tambahWilayah(db, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
  const ds = tambahWilayah(db, { tingkat: 'desa', nama: 'Klasaman', kode: 'KLS', indukId: d.id })
  const k1 = tambahWilayah(db, { tingkat: 'kelompok', nama: 'Klasaman 1', kode: 'K1', indukId: ds.id })
  tambahGenerus(db, { kelompokId: k1.id, nama: 'Ahmad', jenisKelamin: 'L', kategori: 'caberawit', mulai: '2026-01-01', waliNama: 'Pak Fauzi', waliNoHp: '081234567890' })
  return {
    k1: k1.id,
    tokenSuper: (kode: string) => terbitkanToken(db, kunci, { kodePerangkat: kode, role: 'admin', nama: 'Pak Fir', wilayahId: d.id }),
    paket: () => buatPaket(db, d.id, kunci),
    materi: () => buatMateri(db, kunci),
    impor: (bytes: Uint8Array) => imporSetor(db, bytes, kunci),
  }
}
