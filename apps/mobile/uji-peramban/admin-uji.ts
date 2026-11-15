// Admin tiruan untuk uji asap peramban (dibundel rolldown → .cjs untuk Node).
// v3: target kurikulum caberawit (3 materi), kelas caberawit hari ini, jadwal setor kelompok → HP "terlambat".
import {
  aturJadwalSetor,
  bukaDb,
  buatMateri,
  buatPaket,
  daftarMateri,
  inisialisasiAdmin,
  periodeAktif,
  tambahGenerus,
  tambahPengajian,
  tambahWilayah,
  tanggalHariIni,
  terbitkanToken,
  tetapkanTarget,
} from '@ppg/core'

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
  tambahGenerus(db, { kelompokId: k1.id, nama: 'Zaid', jenisKelamin: 'L', kategori: 'praremaja', mulai: '2026-01-01' })
  const dow = new Date(`${tanggalHariIni()}T00:00:00`).getDay()
  for (let h = 0; h < 7; h++) tambahPengajian(db, { wilayahId: k1.id, nama: 'Pengajian Umum', hari: h, jam: '16:00' })
  tambahPengajian(db, { wilayahId: k1.id, nama: 'Kelas Caberawit', hari: dow, jam: '19:00', kategoriGenerus: ['caberawit'] })
  const m = daftarMateri(db, { kategoriGenerus: 'caberawit' }).slice(0, 3)
  tetapkanTarget(db, { periode: periodeAktif(db), kategoriGenerus: 'caberawit', materiIds: m.map((x) => x.id) })
  aturJadwalSetor(db, { tingkatAsal: 'kelompok', pola: 'pekanan', hari: (dow + 3) % 7, jam: '21:00' })
  return {
    tokenMubaligh: (kode: string) => terbitkanToken(db, kunci, { kodePerangkat: kode, role: 'mubaligh', nama: 'Ust. Hasan', wilayahId: k1.id }),
    tokenExeDesa: (kode: string) => terbitkanToken(db, kunci, { kodePerangkat: kode, role: 'admin', nama: 'Admin Desa', wilayahId: ds.id }),
    paket: () => buatPaket(db, k1.id, kunci),
    materi: () => buatMateri(db, kunci),
  }
}
