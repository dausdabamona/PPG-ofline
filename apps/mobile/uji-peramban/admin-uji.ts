// Admin tiruan untuk uji asap peramban (dibundel rolldown → .mjs untuk Node).
import { bukaDb, buatMateri, buatPaket, inisialisasiAdmin, tambahGenerus, tambahPengajian, tambahWilayah, terbitkanToken } from '@ppg/core'

export async function siapkan() {
  const db = await bukaDb()
  const kunci = await inisialisasiAdmin(db, { sandi: 'sandi-admin-123', namaOrganisasi: 'PPG Sorong Uji' })
  const d = tambahWilayah(db, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
  const ds = tambahWilayah(db, { tingkat: 'desa', nama: 'Klasaman', kode: 'KLS', indukId: d.id })
  const k1 = tambahWilayah(db, { tingkat: 'kelompok', nama: 'Klasaman 1', kode: 'K1', indukId: ds.id })
  tambahWilayah(db, { tingkat: 'kelompok', nama: 'Klasaman 2', kode: 'K2', indukId: ds.id })
  for (const [i, nama] of ['Ahmad', 'Aisyah', 'Bilal', 'Fatimah'].entries()) {
    tambahGenerus(db, { kelompokId: k1.id, nama, jenisKelamin: i % 2 ? 'P' : 'L', kategori: 'caberawit', mulai: '2026-01-01', waliNama: 'Pak Fauzi', waliNoHp: '081234567890' })
  }
  for (let h = 0; h < 7; h++) tambahPengajian(db, { wilayahId: k1.id, nama: 'Pengajian Caberawit', hari: h, jam: '16:00' })
  return {
    tokenMubaligh: (kode: string) => terbitkanToken(db, kunci, { kodePerangkat: kode, role: 'mubaligh', nama: 'Ust. Hasan', wilayahId: k1.id }),
    paket: () => buatPaket(db, k1.id, kunci),
    materi: () => buatMateri(db, kunci),
  }
}
