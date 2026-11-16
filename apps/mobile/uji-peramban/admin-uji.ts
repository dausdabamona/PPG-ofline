// Admin tiruan untuk uji asap peramban (dibundel rolldown → .cjs untuk Node).
// v3: target kurikulum caberawit (3 materi), kelas caberawit hari ini, jadwal setor kelompok → HP "terlambat".
import {
  aktifkanProfil,
  aturJadwalSetor,
  buatBalasan,
  bukaDb,
  inisialisasiPerangkat,
  terapkanPaket,
  terbitkanTokenGenerus,
  idMateriEvaluasi,
  simpanEvaluasi,
  simpanPenilaianKarakter,
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
  const anak = ['Ahmad', 'Aisyah', 'Bilal', 'Fatimah'].map((nama, i) =>
    // §16: Ahmad sudah Caberawit C (juknis); lainnya masih "caberawit" lama (perlu ditetapkan)
    tambahGenerus(db, { kelompokId: k1.id, nama, jenisKelamin: i % 2 ? 'P' : 'L', kategori: i === 0 ? 'caberawit_c' : 'caberawit', mulai: '2026-01-01', waliNama: 'Pak Fauzi', waliNoHp: '081234567890' }),
  )
  // §20 (Fase 14): nilai & Karakter Luhur contoh untuk Ahmad (data dummy) — sebagian butir sengaja belum dinilai
  const C = (k: string) => idMateriEvaluasi('caberawit_c', k)
  const ahmad = anak[0]!.id
  for (const [k, isi] of [
    ['makna_quran', { rincian: { '30': 14 } }],
    ['tajwid', { dikuasai: 22 }],
    ['keilmuan', { dikuasai: 12 }],
    ['surat', { dikuasai: 38 }],
    ['doa_sorong', { dikuasai: 30 }],
    ['dalil_sorong', { dikuasai: 20 }],
    ['kefahaman', { dikuasai: 21 }],
    ['praktik_ibadah', { dikuasai: 12 }],
    ['wudhu_sholat', { nilai: 72 }],
    ['kualitas_bacaan', { nilai: 65 }],
    ['akhlak', { dikuasai: 11 }],
    ['adab', { dikuasai: 88 }],
    ['nasehat_bpi', { dikuasai: 60 }],
    ['kemandirian', { dikuasai: 15 }],
    ['asad', { nilai: 60 }],
  ] as const)
    simpanEvaluasi(db, { generusId: ahmad, materiEvaluasiId: C(k), ...isi })
  for (const [butir, predikat, catatan] of [
    ['agungkan', 'baik', null],
    ['sungguh', 'baik', 'Hadir pengajian hampir setiap pekan.'],
    ['doa', 'cukup', 'Doa sebelum belajar perlu diingatkan.'],
    ['amanah', 'baik', null],
    ['mujhid_muzhid', 'cukup', null],
    ['kompak', 'baik', null],
    ['kerja_sama', 'baik', 'Mau membantu merapikan tempat ngaji.'],
  ] as const)
    simpanPenilaianKarakter(db, { generusId: ahmad, butir, predikat, catatan })
  tambahGenerus(db, { kelompokId: k1.id, nama: 'Zaid', jenisKelamin: 'L', kategori: 'praremaja', mulai: '2026-01-01' })
  const dow = new Date(`${tanggalHariIni()}T00:00:00`).getDay()
  for (let h = 0; h < 7; h++) tambahPengajian(db, { wilayahId: k1.id, nama: 'Pengajian Umum', hari: h, jam: '16:00' })
  tambahPengajian(db, { wilayahId: k1.id, nama: 'Kelas Caberawit', hari: dow, jam: '19:00', kategoriGenerus: ['caberawit'] })
  const m = daftarMateri(db, { kategoriGenerus: 'caberawit' }).slice(0, 3)
  tetapkanTarget(db, { periode: periodeAktif(db), kategoriGenerus: 'caberawit', materiIds: m.map((x) => x.id) })
  aturJadwalSetor(db, { tingkatAsal: 'kelompok', pola: 'pekanan', hari: (dow + 3) % 7, jam: '21:00' })
  // §21 (Fase 15): BK Kelompok Klasaman 1 aktif di HP lain (nomor WA contoh) → info BK & kontak ikut paket
  const hpBk = await bukaDb()
  const ib = await inisialisasiPerangkat(hpBk, 'HP BK Contoh')
  terbitkanToken(db, kunci, { kodePerangkat: ib.kodePerangkat, role: 'pengurus', nama: 'BK Contoh', penugasan: [{ jabatan: 'bk', wilayah_id: k1.id }], kontakBk: '081211112222' })
  // mubaligh tiruan (HP lain, core) untuk menerbitkan token & balasan orang tua di konteks peramban kedua
  const hpM = await bukaDb()
  const im = await inisialisasiPerangkat(hpM, 'HP Mubaligh Contoh')
  const pm = await aktifkanProfil(hpM, terbitkanToken(db, kunci, { kodePerangkat: im.kodePerangkat, role: 'mubaligh', nama: 'Ust. Contoh', wilayahId: k1.id }))
  return {
    // §21: pengurus BK Kelompok Klasaman 1 + Sarpras Desa Klasaman (rangkap) → wilayah token desa
    tokenBk: (kode: string) =>
      terbitkanToken(db, kunci, { kodePerangkat: kode, role: 'pengurus', nama: 'Pengurus BK', penugasan: [{ jabatan: 'bk', wilayah_id: k1.id }, { jabatan: 'sarpras', wilayah_id: ds.id }] }),
    paketDesa: () => buatPaket(db, ds.id, kunci),
    tokenWali: (kode: string) => {
      terapkanPaket(hpM, buatPaket(db, k1.id, kunci).bytes)
      return terbitkanTokenGenerus(hpM, pm.id, { kodePerangkat: kode, role: 'wali', generusIds: [ahmad], nama: 'Pak Fauzi' })
    },
    balasanWali: (perangkatId: string) => buatBalasan(hpM, perangkatId),
    tokenMubaligh: (kode: string) => terbitkanToken(db, kunci, { kodePerangkat: kode, role: 'mubaligh', nama: 'Ust. Hasan', wilayahId: k1.id }),
    tokenExeDesa: (kode: string) => terbitkanToken(db, kunci, { kodePerangkat: kode, role: 'admin', nama: 'Admin Desa', wilayahId: ds.id }),
    paket: () => buatPaket(db, k1.id, kunci),
    materi: () => buatMateri(db, kunci),
    // §17: pengurus daerah berjabatan (ketua + bendahara; §18: + sekretaris & kurikulum untuk musyawarah/penetapan) dan paket seluruh daerah
    tokenPengurusJabatan: (kode: string) =>
      terbitkanToken(db, kunci, { kodePerangkat: kode, role: 'pengurus', nama: 'Bendahara PPG', wilayahId: d.id, jabatan: ['ketua', 'sekretaris', 'bendahara', 'kurikulum'] }),
    paketDaerah: () => buatPaket(db, d.id, kunci),
  }
}
