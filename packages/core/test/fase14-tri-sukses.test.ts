// §20 (Fase 14) — Raport Tri Sukses Generus (Alim-Faqih: Alim & Faqih, Akhlaqul Karimah, Mandiri) + Karakter Luhur:
// rumus aspek, belum dinilai ≠ 0, nilai akhir, predikat K17, pemetaan K18, K09 baru, validasi hak penilaian sikap,
// sinkron SETOR/BALASAN/PAKET, migrasi v6 → v7, data cetak.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  aktifkanExe,
  aktifkanProfil,
  alasanPenilaianKarakterTidakSah,
  ambangPredikat,
  aturCatatanSholat,
  buatBalasan,
  buatKurikulum,
  buatMateri,
  buatPaket,
  buatSetor,
  bukaDb,
  catatKeaktifan,
  catatPresensi,
  daftarButirKurikulum,
  dataRaportCetak,
  hitungTriSukses,
  idMateriEvaluasi,
  idPenilaianKarakter,
  imporKurikulum,
  imporSetor,
  inisialisasiExe,
  migrasi,
  pemetaanAspek,
  PEMETAAN_SEMENTARA,
  predikatAngka,
  raporGenerus,
  raporPdf,
  rekapPenguasaan,
  simpanDb,
  simpanEvaluasi,
  simpanPenilaianKarakter,
  tambahGenerus,
  tambahMateriEvaluasi,
  terapkanBalasan,
  terapkanMateri,
  terapkanPaket,
  terbitkanToken,
  terbitkanTokenGenerus,
  tetapkanButirKurikulum,
  ubahGenerus,
  VERSI_SKEMA,
  type Db,
} from '../src/index'
import { buatDunia, buatHp, lepasJam, pasangJam, SANDI, type Dunia } from './bantu'

const EVL = idMateriEvaluasi
const P = '2026-S1'

beforeAll(() => pasangJam('2026-11-25T01:00:00.000Z'))
afterAll(() => lepasJam())

async function dunia() {
  const d = await buatDunia()
  const a = d.admin.db
  ubahGenerus(a, d.g[0]!.id, { kategori: 'praremaja', wali_nama: 'Ortu Ali' })
  ubahGenerus(a, d.g[1]!.id, { kategori: 'caberawit_b' })
  ubahGenerus(a, d.g[2]!.id, { kategori: 'paud' })
  d.segarkan()
  terapkanMateri(d.mubaligh.db, buatMateri(a, d.admin.kunci).bytes)
  return { d, a, m: d.mubaligh.db, ali: d.g[0]!, budi: d.g[1]!, citra: d.g[2]! }
}

async function exeKurikulum(w: Dunia): Promise<Db> {
  const db = await bukaDb()
  const { kodePerangkat, kunci } = await inisialisasiExe(db, { sandi: SANDI, label: 'EXE Kurikulum' })
  await aktifkanExe(db, kunci, terbitkanToken(w.admin.db, w.admin.kunci, { kodePerangkat, role: 'kurikulum', nama: 'Tim Kurikulum', wilayahId: w.daerah.id }))
  terapkanMateri(db, buatMateri(w.admin.db, w.admin.kunci).bytes)
  return db
}

const butir = (kode: string, persen: number | null) => ({ materi: { kode, cara: kode === 'keaktifan' ? 'keaktifan' : 'hitungan' }, persen })

describe('Rumus Tri Sukses Generus (§20.2)', () => {
  it('subbagian = rata-rata butir dinilai; Alim/Faqih = rata-rata subbagian; Alim-Faqih = rata-rata keduanya; Nilai Akhir = rata-rata 3 aspek', () => {
    const t = hitungTriSukses(
      [
        butir('keaktifan', 100), // data pendukung, tidak masuk aspek
        butir('makna_quran', 60),
        butir('hadits', null), // belum dinilai / belum ditetapkan
        butir('surat', 100),
        butir('doa_sorong', 80),
        butir('kefahaman', 50),
        butir('wudhu_sholat', 70),
        butir('thoharoh', 50),
        butir('akhlak', 90),
        butir('adab', null),
        butir('asad', 40),
      ],
      { ...PEMETAAN_SEMENTARA },
    )
    expect(t.bagian.map((b) => [b.kode, b.nilai])).toEqual([
      ['alim_mankul', 60],
      ['alim_hafalan', 90],
      ['faqih_kefahaman', 50],
      ['faqih_praktik', 60],
      ['akhlak', 90],
      ['mandiri', 40],
    ])
    expect(t).toMatchObject({ alim: 75, faqih: 55, alimFaqih: 65, akhlak: 90, mandiri: 40 })
    // (65 + 90 + 40) ÷ 3 = 65
    expect(t.nilaiAkhir).toBe(65)
    expect(t.bagian.flatMap((b) => b.items).some((i) => i.materi.kode === 'keaktifan')).toBe(false)
    // aspek tanpa nilai tidak ikut; semua kosong → null
    expect(hitungTriSukses([butir('surat', 80)], {}).nilaiAkhir).toBe(80)
    expect(hitungTriSukses([butir('surat', null), butir('keaktifan', 90)], {}).nilaiAkhir).toBeNull()
    // K09 rata_materi: rata-rata semua butir dinilai tanpa keaktifan
    expect(hitungTriSukses([butir('surat', 100), butir('akhlak', 50), butir('asad', 60), butir('keaktifan', 0)], {}, 'rata_materi').nilaiAkhir).toBe(70)
  })

  it('predikat angka K17: batas ≥ 85 / 70 / 55, null = belum dinilai', () => {
    expect([85, 84.96, 84.94, 70, 69.9, 55, 54.9, 0].map((n) => predikatAngka(n))).toEqual([
      'Sangat Baik',
      'Sangat Baik', // dibulatkan satu desimal = 85,0
      'Baik',
      'Baik',
      'Cukup',
      'Cukup',
      'Perlu Bimbingan',
      'Perlu Bimbingan',
    ])
    expect(predikatAngka(null)).toBeNull()
  })
})

describe('Raport: belum dinilai ≠ 0 %, pemetaan GBMTPG, Karakter Luhur', () => {
  it('belum dinilai tidak ikut; hitungan 0 dikuasai = 0 % dinilai; subjektif tanpa nilai = belum dinilai; Iqro\' di Mankul', async () => {
    const { m, ali, budi } = await dunia()
    simpanEvaluasi(m, { generusId: budi.id, materiEvaluasiId: EVL('caberawit_b', 'iqro'), dikuasai: 195, periode: P })
    simpanEvaluasi(m, { generusId: budi.id, materiEvaluasiId: EVL('caberawit_b', 'kefahaman'), dikuasai: 0, periode: P })
    simpanEvaluasi(m, { generusId: budi.id, materiEvaluasiId: EVL('caberawit_b', 'thoharoh'), nilai: null, periode: P })
    simpanEvaluasi(m, { generusId: budi.id, materiEvaluasiId: EVL('caberawit_b', 'asad'), nilai: 60, periode: P })
    const r = raporGenerus(m, budi.id, { periode: P })!
    const cari = (k: string) => r.items.find((i) => i.materi.kode === k)!
    expect(cari('iqro')).toMatchObject({ persen: 100, dinilai: true })
    expect(cari('kefahaman')).toMatchObject({ persen: 0, dinilai: true })
    expect(cari('thoharoh')).toMatchObject({ persen: null, dinilai: false })
    expect(cari('surat')).toMatchObject({ persen: null, dinilai: false })
    expect(cari('keaktifan').persen).toBe(0) // keaktifan = data nyata (bulan aktif tanpa kehadiran), tidak masuk aspek
    expect(r.triSukses.bagian.find((b) => b.kode === 'alim_mankul')!.items.map((i) => i.materi.kode)).toContain('iqro')
    // Alim = Mankul 100 (hafalan belum); Faqih = Kefahaman 0 (praktik belum); Alim-Faqih 50; Mandiri 60 → (50 + 60) ÷ 2 = 55
    expect(r.triSukses).toMatchObject({ alim: 100, faqih: 0, alimFaqih: 50, akhlak: null, mandiri: 60, nilaiAkhir: 55 })
    expect(r.total).toBe(55)
    // ASAD Beladiri di Mandiri, kefahaman di Faqih (GBMTPG Pusat 2022)
    expect(pemetaanAspek(m)).toMatchObject({ asad: 'mandiri', kefahaman: 'faqih_kefahaman', tajwid: 'alim_mankul', pegon: 'faqih_praktik', nasehat_bpi: 'akhlak' })
    // Pra Remaja tanpa nilai: Nilai Akhir null; keaktifan tidak mengisi nilai
    catatKeaktifan(m, { generusId: ali.id, tanggal: '2026-11-03', kode: 'MK', sebagai: 'pencatat' })
    const ra = raporGenerus(m, ali.id, { periode: P })!
    expect(ra.total).toBeNull()
    expect(ra.pendukung.keaktifan).toBeGreaterThan(0)
  })

  it('Karakter Luhur: mubaligh menilai predikat sikap + catatan; validasi; target jenjang GBMTPG; data pendukung; tidak masuk persen', async () => {
    const { d, a, m, ali, citra } = await dunia()
    simpanEvaluasi(m, { generusId: ali.id, materiEvaluasiId: EVL('praremaja', 'surat'), dikuasai: 45, periode: P })
    const sebelum = raporGenerus(m, ali.id, { periode: P })!.total
    simpanPenilaianKarakter(m, { generusId: ali.id, butir: 'syukur', predikat: 'baik', periode: P })
    simpanPenilaianKarakter(m, { generusId: ali.id, butir: 'jujur', predikat: 'perlu_bimbingan', catatan: 'Perlu dibiasakan berkata benar saat bermain.', periode: P })
    simpanPenilaianKarakter(m, { generusId: ali.id, butir: 'jujur', predikat: 'cukup', catatan: 'Mulai membaik.', periode: P }) // ulang = perbarui
    simpanPenilaianKarakter(m, { generusId: ali.id, butir: 'catatan', predikat: null, catatan: 'Rajin hadir; tingkatkan hafalan dalil.', periode: P })
    expect(() => simpanPenilaianKarakter(m, { generusId: ali.id, butir: 'sombong', predikat: 'baik', periode: P })).toThrow(/tidak dikenal/)
    expect(() => simpanPenilaianKarakter(m, { generusId: ali.id, butir: 'rukun', predikat: 'sangat_baik' as never, periode: P })).toThrow(/Baik, Cukup/)
    expect(() => simpanPenilaianKarakter(m, { generusId: ali.id, butir: 'rukun', predikat: 'baik', catatan: 'x'.repeat(301), periode: P })).toThrow(/300/)
    expect(() => simpanPenilaianKarakter(m, { generusId: ali.id, butir: 'catatan', predikat: null, catatan: 'x'.repeat(1001), periode: P })).toThrow(/1000/)
    // sholat lokal (diisi orang tua di HP) + kegiatan mandiri → data pendukung, bukan nilai
    aturCatatanSholat(m, ali.id, '2026-11-01', ['SB', 'ZH', 'AS', 'MG', 'IS'])
    aturCatatanSholat(m, ali.id, '2026-11-02', ['SB', 'MG', 'IS'])
    catatKeaktifan(m, { generusId: ali.id, tanggal: '2026-11-04', kode: 'QR', sebagai: 'pencatat' })
    catatPresensi(m, { kelompokId: d.k1.id, generusId: ali.id, tanggal: '2026-11-05', status: 'hadir' })
    const r = raporGenerus(m, ali.id, { periode: P })!
    expect(r.total).toBe(sebelum)
    expect(r.karakter).toMatchObject({ targetJenjang: 'Terbiasa', catatanMubaligh: 'Rajin hadir; tingkatkan hafalan dalil.', penilai: 'Ust. Hasan', dinilai: 2 })
    expect(r.karakter!.tali.map((t) => t.nama)).toEqual(['Bersyukur atas hidayah', 'Mengagungkan hidayah', 'Mempersungguh hidayah', 'Senantiasa berdoa'])
    expect(r.karakter!.thobiat.map((t) => t.nama)).toEqual(['Jujur', 'Amanah', 'Mujhid-muzhid', 'Rukun', 'Kompak', 'Kerja sama yang baik'])
    expect(r.karakter!.thobiat[0]).toMatchObject({ predikat: 'cukup', label: 'Cukup', catatan: 'Mulai membaik.' })
    expect(r.karakter!.tali[1]).toMatchObject({ predikat: null, label: null })
    expect(r.pendukung).toMatchObject({ sholat: { hari: 2, rataWaktu: 4 }, mandiriHari: 1 })
    expect(r.pendukung.keaktifan).toBeGreaterThan(0)
    expect(raporGenerus(m, citra.id, { periode: P })!.karakter!.targetJenjang).toBe('Mengenal')
    // hapus: predikat & catatan kosong
    simpanPenilaianKarakter(m, { generusId: ali.id, butir: 'syukur', predikat: null, periode: P })
    expect(raporGenerus(m, ali.id, { periode: P })!.karakter!.tali[0]!.predikat).toBeNull()
    // perangkat tanpa hak sahkan / kelompok lain tidak bisa menilai
    const hp = await buatHp('HP Ali')
    await aktifkanProfil(hp.db, terbitkanTokenGenerus(m, d.mubaligh.profil.id, { kodePerangkat: hp.kode, role: 'generus', generusIds: [ali.id], nama: 'Ali' }))
    terapkanBalasan(hp.db, buatBalasan(m, hp.id).bytes)
    expect(() => simpanPenilaianKarakter(hp.db, { generusId: ali.id, butir: 'rukun', predikat: 'baik', periode: P })).toThrow()
    // BALASAN → HP murid/orang tua melihat Karakter Luhur anaknya
    expect(raporGenerus(hp.db, ali.id, { periode: P })!.karakter).toMatchObject({ catatanMubaligh: 'Rajin hadir; tingkatkan hafalan dalil.', dinilai: 1 })
    const lain = tambahGenerus(a, { kelompokId: d.k2.id, nama: 'Zaid', jenisKelamin: 'L', kategori: 'paud' })
    void lain
    expect(alasanPenilaianKarakterTidakSah({ id: 'x', generus_id: ali.id, periode: P, butir: 'jujur', predikat: 'baik', tanggal: '2026-11-25' })).toMatch(/Id/)
  })

  it('SETOR: daerah menerima penilaian karakter mubaligh; pemalsuan (predikat, kelompok lain, penulis tanpa hak) ditolak; turun lewat PAKET', async () => {
    const { d, a, m, ali } = await dunia()
    simpanPenilaianKarakter(m, { generusId: ali.id, butir: 'amanah', predikat: 'baik', catatan: 'Menjaga barang teman.', periode: P })
    simpanPenilaianKarakter(m, { generusId: ali.id, butir: 'catatan', predikat: null, catatan: 'Semangat.', periode: P })
    const r = imporSetor(a, buatSetor(m).bytes, d.admin.kunci)
    expect(r.ditolak).toEqual([])
    expect(r.perTabel.penilaian_karakter?.ditambah).toBe(2)
    expect(raporGenerus(a, ali.id, { periode: P })!.karakter!.thobiat[1]!.label).toBe('Baik')
    // pemalsuan lewat SQL langsung di HP mubaligh
    const id = idPenilaianKarakter(ali.id, P, 'amanah')
    m.jalankan(`UPDATE penilaian_karakter SET predikat = 'istimewa', seq_lokal = 900 WHERE id = ?`, [id])
    m.jalankan(`UPDATE meta SET nilai = '900' WHERE kunci = 'seq'`)
    const r2 = imporSetor(a, buatSetor(m).bytes, d.admin.kunci)
    expect(r2.ditolak.map((x) => x.alasan)).toEqual([expect.stringMatching(/Predikat/)])
    // generus kelompok lain (K2) → di luar wilayah mubaligh K1
    const zaid = tambahGenerus(a, { kelompokId: d.k2.id, nama: 'Zaid', jenisKelamin: 'L', kategori: 'paud' })
    const idz = idPenilaianKarakter(zaid.id, P, 'rukun')
    m.jalankan(
      `INSERT INTO penilaian_karakter SELECT '${idz}', '${zaid.id}', '${d.k2.id}', periode, 'rukun', 'baik', NULL, tanggal, penilai, perangkat_id, dibuat_pada, diubah_pada, 0, 1, 901 FROM penilaian_karakter WHERE id = ?`,
      [idPenilaianKarakter(ali.id, P, 'catatan')],
    )
    m.jalankan(`UPDATE meta SET nilai = '901' WHERE kunci = 'seq'`)
    const r3 = imporSetor(a, buatSetor(m).bytes, d.admin.kunci)
    expect(r3.ditolak.some((x) => x.id === idz && /luar wilayah/.test(x.alasan))).toBe(true)
    // pengurus kelompok (tanpa hak sahkan) tidak bisa menulis karakter yang sah di penerima
    const hp = await buatHp('HP Pengurus')
    await aktifkanProfil(hp.db, terbitkanToken(a, d.admin.kunci, { kodePerangkat: hp.kode, role: 'pengurus', nama: 'Pengurus', wilayahId: d.k1.id }))
    terapkanPaket(hp.db, buatPaket(a, d.k1.id, d.admin.kunci).bytes)
    expect(() => simpanPenilaianKarakter(hp.db, { generusId: ali.id, butir: 'kompak', predikat: 'baik', periode: P })).toThrow(/berwenang/)
    // PAKET membawa penilaian karakter ke HP pengurus kelompok
    expect(raporGenerus(hp.db, ali.id, { periode: P })!.karakter!.catatanMubaligh).toBe('Semangat.')
  })
})

describe('Perlu Ditetapkan Kurikulum: K09 baru, K17 ambang, K18 pemetaan', () => {
  it('nilai sementara; Kurikulum memindahkan butir antar aspek & mengubah ambang → tersebar ke daerah & HP; isian tidak sah ditolak', async () => {
    const { d, a, m, budi } = await dunia()
    const awal = daftarButirKurikulum(a)
    expect(awal.find((b) => b.kode === 'K09')).toMatchObject({ status: 'sementara', nilai: 'rata_aspek' })
    expect(awal.find((b) => b.kode === 'K17')).toMatchObject({ status: 'sementara', nilai: { sangat_baik: 85, baik: 70, cukup: 55 } })
    const k18 = awal.find((b) => b.kode === 'K18')!
    expect(k18).toMatchObject({ status: 'sementara', bentuk: 'pemetaan' })
    expect(k18.opsi.map(([k]) => k)).toEqual(['alim_mankul', 'alim_hafalan', 'faqih_kefahaman', 'faqih_praktik', 'akhlak', 'mandiri'])
    expect(k18.isian.find((i) => i.kunci === 'asad')!.nilai).toBe('mandiri')
    expect(k18.isian.some((i) => i.kunci === 'keaktifan')).toBe(false)
    expect(k18.sumber).toMatch(/GBMTPG Pembina Generus Pusat 2022/)

    const kur = await exeKurikulum(d)
    expect(() => tetapkanButirKurikulum(kur, 'K17', { nilai: { sangat_baik: 70, baik: 80, cukup: 50 } })).toThrow(/menurun/)
    expect(() => tetapkanButirKurikulum(kur, 'K18', { nilai: { ...pemetaanAspek(kur), keaktifan: 'mandiri' } })).toThrow(/Keaktifan/)
    expect(() => tetapkanButirKurikulum(kur, 'K18', { nilai: { asad: 'olahraga' } })).toThrow(/tidak dikenal/)
    expect(() => tetapkanButirKurikulum(kur, 'K09', { nilai: 'rata_rata' })).toThrow(/Pilihan/)
    tetapkanButirKurikulum(kur, 'K17', { nilai: { sangat_baik: 90, baik: 75, cukup: 60 } })
    tetapkanButirKurikulum(kur, 'K18', { nilai: { ...pemetaanAspek(kur), asad: 'akhlak' } })
    tetapkanButirKurikulum(kur, 'K09')
    imporKurikulum(a, buatKurikulum(kur).bytes, d.admin.kunci)
    expect(daftarButirKurikulum(a).filter((b) => ['K09', 'K17', 'K18'].includes(b.kode)).map((b) => b.status)).toEqual(['ditetapkan', 'ditetapkan', 'ditetapkan'])
    terapkanMateri(m, buatMateri(a, d.admin.kunci).bytes)
    expect(ambangPredikat(m)).toEqual({ sangat_baik: 90, baik: 75, cukup: 60 })
    simpanEvaluasi(m, { generusId: budi.id, materiEvaluasiId: EVL('caberawit_b', 'asad'), nilai: 60, periode: P })
    const r = raporGenerus(m, budi.id, { periode: P })!
    expect(r.triSukses).toMatchObject({ akhlak: 60, mandiri: null })
    expect(predikatAngka(r.triSukses.akhlak, r.ambang)).toBe('Cukup')
    // rekap ikut pemetaan & K17
    imporSetor(a, buatSetor(m).bytes, d.admin.kunci)
    const rk = rekapPenguasaan(a, { wilayahId: d.k1.id, jenjang: 'caberawit_b', periode: P })
    expect(rk.baris[0]).toMatchObject({ akhlak: 60, mandiri: null, total: 60 })
    expect(rk.rataAspek).toEqual({ alimFaqih: null, akhlak: 60, mandiri: null })
    expect(rk.ambang.sangat_baik).toBe(90)
  })

  it('K09 lama (rata_rata) dibaca rata_aspek dan menjadi Sementara (berubah); materi baru tak terpetakan → Alim · Mankul', async () => {
    const { d, a } = await dunia()
    a.jalankan(
      `INSERT INTO pengaturan (id, isi, perangkat_id, dibuat_pada, diubah_pada, dihapus, versi, seq_lokal) VALUES ('kur:K09', ?, 'ADMIN', '2026-11-01', '2026-11-01', 0, 1, 0)`,
      [JSON.stringify({ kode: 'K09', nilai: 'rata_rata', oleh: 'Lama', pada: '2026-11-01T00:00:00.000Z', catatan: null, riwayat: [] })],
    )
    expect(daftarButirKurikulum(a).find((b) => b.kode === 'K09')).toMatchObject({ nilai: 'rata_aspek', status: 'sementara', berubah: true })
    const kur = await exeKurikulum(d)
    tambahMateriEvaluasi(kur, { jenjang: 'praremaja', kode: 'khitobah', nama: 'Praktik Khitobah', cara: 'subjektif', target: 75 })
    expect(pemetaanAspek(kur).khitobah).toBe('alim_mankul')
    expect(daftarButirKurikulum(kur).find((b) => b.kode === 'K18')!.isian.find((i) => i.kunci === 'khitobah')).toMatchObject({ label: 'Praktik Khitobah', nilai: 'alim_mankul' })
  })
})

describe('Cetak raport §20.4 & migrasi v7', () => {
  it('data cetak: ringkas Tri Sukses (Alim-Faqih → Alim, Faqih) + Nilai Akhir, Karakter Luhur, lampiran per subbagian; PDF 2 halaman/anak', async () => {
    const { a, ali, budi } = await dunia()
    simpanEvaluasi(a, { generusId: ali.id, materiEvaluasiId: EVL('praremaja', 'surat'), dikuasai: 45, periode: P })
    simpanEvaluasi(a, { generusId: ali.id, materiEvaluasiId: EVL('praremaja', 'akhlak'), dikuasai: 13, periode: P })
    simpanPenilaianKarakter(a, { generusId: ali.id, butir: 'rukun', predikat: 'baik', catatan: 'Akur dengan teman.', periode: P })
    simpanPenilaianKarakter(a, { generusId: ali.id, butir: 'catatan', predikat: null, catatan: 'Pertahankan.', periode: P })
    const d = dataRaportCetak(a, ali.id, { periode: P, tanggalCetak: '2026-11-25' })
    expect(d.triSukses.map((b) => [b.label, b.jenis, b.nilai, b.predikat])).toEqual([
      ['1. Alim-Faqih', 'aspek', '100', 'Sangat Baik'],
      ['Alim (mankul & hafalan)', 'sub', '100', 'Sangat Baik'],
      ['Faqih (kefahaman & praktik ibadah)', 'sub', 'belum dinilai', '—'],
      ['2. Akhlaqul Karimah', 'aspek', '100', 'Sangat Baik'],
      ['3. Mandiri', 'aspek', 'belum dinilai', '—'],
      ['NILAI AKHIR', 'akhir', '100', 'Sangat Baik'],
    ])
    expect(d.karakter.targetJenjang).toBe('Terbiasa')
    expect(d.karakter.thobiat.find((x) => x.nama === 'Rukun')).toEqual({ nama: 'Rukun', predikat: 'Baik', catatan: 'Akur dengan teman.' })
    expect(d.karakter.tali[0]!.predikat).toBe('belum dinilai')
    expect(d.catatanMubaligh).toBe('Pertahankan.')
    expect(d.lampiran.map((l) => l.judul)).toEqual(['Alim — Mankul', 'Alim — Hafalan', 'Faqih — Kefahaman', 'Faqih — Praktik Ibadah', 'Akhlaqul Karimah', 'Mandiri'])
    expect(d.lampiran.find((l) => l.judul === 'Mandiri')!.baris.map((b) => b.materi)).toEqual(['Kemandirian sesuai GBMTPG', 'ASAD Beladiri Jurus 1–7'])
    expect(d.baris.map((b) => b.no)).toEqual(d.baris.map((_, i) => i + 1))
    expect(d.total).toBe('100')
    expect(d.keteranganRumus).toMatch(/3 aspek Tri Sukses Generus/)
    const pdf = new TextDecoder('latin1').decode(raporPdf(a, { generusIds: [ali.id, budi.id], periode: P }))
    expect(pdf).toContain('/Count 4')
  })

  it('migrasi v6 → v7 menambah tabel penilaian_karakter tanpa kehilangan data', async () => {
    const { a, ali } = await dunia()
    a.jalankanSkrip('DROP TABLE penilaian_karakter;')
    a.jalankan(`UPDATE meta SET nilai = '6' WHERE kunci = 'versi_skema'`)
    const db = await bukaDb(simpanDb(a))
    migrasi(db)
    expect(db.nilai<string>(`SELECT nilai FROM meta WHERE kunci = 'versi_skema'`)).toBe(String(VERSI_SKEMA))
    expect(VERSI_SKEMA).toBe(7)
    simpanPenilaianKarakter(db, { generusId: ali.id, butir: 'kompak', predikat: 'cukup', periode: P })
    expect(raporGenerus(db, ali.id, { periode: P })!.karakter!.thobiat[4]!.label).toBe('Cukup')
  })
})
