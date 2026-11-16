// §19 (Fase 13) — K16 target keaktifan per jenjang (Kurikulum), data sekolah & Iqro' generus, dan data cetakan laporan
// bulanan format lembar (sampul, lembar keaktifan per jenjang, absensi pengurus, hasil musyawaroh, penyaksian).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  ajukanUsulan,
  aktifkanExe,
  aktifkanProfil,
  ambilGenerus,
  bukaDb,
  buatKurikulum,
  buatMateri,
  buatPaket,
  buatSetor,
  catatKeaktifan,
  catatPresensi,
  daftarButirKurikulum,
  daftarUsulan,
  idMateriEvaluasi,
  imporGenerusCsv,
  imporKurikulum,
  imporSetor,
  inisialisasiExe,
  kejarTarget,
  keaktifanBulan,
  labelIqro,
  lembarLaporanBulanan,
  lembarLaporanWilayah,
  migrasi,
  VERSI_SKEMA,
  normalIqro,
  rekapKeaktifanBulan,
  ringkasTargetKeaktifan,
  saranJenjangIqro,
  simpanCatatan,
  simpanDb,
  simpanEvaluasi,
  simpanLaporanBulanan,
  isiLaporanKosong,
  tambahGenerus,
  tambahPengajian,
  tambahWilayah,
  targetKeaktifan,
  terapkanMateri,
  terapkanPaket,
  terbitkanToken,
  tetapkanButirKurikulum,
  ubahGenerus,
  dataRaportCetak,
  alasanMateriEvaluasiTidakSah,
  generusUntukRaport,
  raporPdf,
  lebarTeks,
  bungkusTeks,
  DokumenPdf,
  type Db,
} from '../src/index'
import { buatAdmin, buatDunia, buatHp, keTanggal, lepasJam, maju, pasangJam, SANDI } from './bantu'

beforeAll(() => pasangJam('2026-11-10T01:00:00.000Z'))
afterAll(() => lepasJam())

async function exeKurikulum(admin: { db: Db; kunci: Parameters<typeof terbitkanToken>[1] }, daerahId: string): Promise<Db> {
  const db = await bukaDb()
  const { kodePerangkat, kunci } = await inisialisasiExe(db, { sandi: SANDI, label: 'EXE Kurikulum' })
  await aktifkanExe(db, kunci, terbitkanToken(admin.db, admin.kunci, { kodePerangkat, role: 'kurikulum', nama: 'Tim Kurikulum', wilayahId: daerahId }))
  terapkanMateri(db, buatMateri(admin.db, admin.kunci).bytes)
  return db
}

describe('K16 — target keaktifan bulanan per jenjang (Kurikulum)', () => {
  it('butir K16 Sementara 20 (Pra Nikah 16); EXE Kurikulum menetapkan 24 → semua hitungan memakai target baru; tersebar ke daerah & HP', async () => {
    const admin = await buatAdmin()
    const daerah = tambahWilayah(admin.db, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
    const desa = tambahWilayah(admin.db, { tingkat: 'desa', nama: 'Desa Uji', kode: 'DU', indukId: daerah.id })
    const kel = tambahWilayah(admin.db, { tingkat: 'kelompok', nama: 'Kelompok Uji', kode: 'KU', indukId: desa.id })
    const k16 = daftarButirKurikulum(admin.db).find((b) => b.kode === 'K16')!
    expect(k16).toMatchObject({ status: 'sementara', bentuk: 'angka' })
    expect(k16.sumber).toMatch(/24/)
    expect(k16.isian).toHaveLength(7)
    expect(k16.isian.find((i) => i.kunci === idMateriEvaluasi('pranikah', 'keaktifan'))!.nilai).toBe(16)
    expect(k16.isian.find((i) => i.kunci === idMateriEvaluasi('paud', 'keaktifan'))!.nilai).toBe(20)
    expect(ringkasTargetKeaktifan(admin.db)).toBe('20 kali/bulan (Pra Nikah 16)')

    const g = tambahGenerus(admin.db, { kelompokId: kel.id, nama: 'Anak Uji', jenisKelamin: 'L', kategori: 'caberawit_a', mulai: '2026-10-01' })
    for (let d = 1; d <= 12; d++) catatKeaktifan(admin.db, { generusId: g.id, tanggal: `2026-10-${String(d).padStart(2, '0')}`, kode: 'B', sebagai: 'pencatat' })
    expect(keaktifanBulan(admin.db, g.id, '2026-10').persen).toBe(60)

    const kur = await exeKurikulum(admin, daerah.id)
    const nilai = (t: number, pn: number) => Object.fromEntries(k16.isian.map((i) => [i.kunci, i.kunci.includes('pranikah') ? pn : t]))
    expect(() => tetapkanButirKurikulum(kur, 'K16', { nilai: nilai(0, 16) })).toThrow(/1–31/)
    expect(() => tetapkanButirKurikulum(kur, 'K16', { nilai: nilai(32, 16) })).toThrow(/1–31/)
    expect(() => tetapkanButirKurikulum(kur, 'K16', { nilai: { ...nilai(24, 16), [idMateriEvaluasi('paud', 'keaktifan')]: null } })).toThrow(/1–31/)
    expect(tetapkanButirKurikulum(kur, 'K16', { nilai: nilai(24, 16), catatan: 'ikut lembar 24 kolom' }).status).toBe('ditetapkan')
    expect(targetKeaktifan(kur, 'caberawit_b')).toBe(24)
    // review keamanan: berkas KURIKULUM / suntingan Materi Evaluasi juga dibatasi 1–31
    expect(alasanMateriEvaluasiTidakSah({ id: idMateriEvaluasi('paud', 'keaktifan'), jenjang: 'paud', kode: 'keaktifan', nama: 'Keaktifan', cara: 'keaktifan', target: 40 })).toMatch(/1–31/)
    expect(ringkasTargetKeaktifan(kur)).toBe('24 kali/bulan (Pra Nikah 16)')

    imporKurikulum(admin.db, buatKurikulum(kur).bytes, admin.kunci)
    expect(daftarButirKurikulum(admin.db).find((b) => b.kode === 'K16')).toMatchObject({ status: 'ditetapkan', penetapan: { oleh: 'Tim Kurikulum' } })
    expect(targetKeaktifan(admin.db, 'paud')).toBe(24)
    expect(keaktifanBulan(admin.db, g.id, '2026-10').persen).toBe(50)
    expect(rekapKeaktifanBulan(admin.db, { wilayahId: desa.id, bulan: '2026-10' }).baris[0]).toMatchObject({ target: 24, persen: 50 })
    // kejar target (mulai tanggal 20) memakai target 24
    keTanggal('2026-11-21')
    for (let d = 1; d <= 20; d++) catatKeaktifan(admin.db, { generusId: g.id, tanggal: `2026-11-${String(d).padStart(2, '0')}`, kode: 'B', sebagai: 'pencatat' })
    expect(kejarTarget(admin.db, g.id)).toMatchObject({ target: 24, jumlah: 20, kurang: 4 })

    // HP pengurus menerima lewat MATERI/PAKET
    const hp = await buatHp('HP Pengurus')
    await aktifkanProfil(hp.db, terbitkanToken(admin.db, admin.kunci, { kodePerangkat: hp.kode, role: 'pengurus', nama: 'Pengurus', wilayahId: daerah.id }))
    terapkanPaket(hp.db, buatPaket(admin.db, daerah.id, admin.kunci).bytes)
    expect(targetKeaktifan(hp.db, 'remaja')).toBe(24)
    expect(targetKeaktifan(hp.db, 'pranikah')).toBe(16)
    expect(daftarButirKurikulum(hp.db).find((b) => b.kode === 'K16')!.status).toBe('ditetapkan')
    keTanggal('2026-11-10')
  })

  it('target berbeda per jenjang → ringkasan menyebut tiap jenjang', async () => {
    const admin = await buatAdmin()
    const daerah = tambahWilayah(admin.db, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
    const kur = await exeKurikulum(admin, daerah.id)
    const k16 = daftarButirKurikulum(kur).find((b) => b.kode === 'K16')!
    tetapkanButirKurikulum(kur, 'K16', { nilai: Object.fromEntries(k16.isian.map((i) => [i.kunci, i.kunci.includes('paud') ? 12 : i.kunci.includes('pranikah') ? 16 : 20])) })
    expect(ringkasTargetKeaktifan(kur)).toBe('PAUD 12 · Caberawit A–Remaja 20 · Pra Nikah 16 kali/bulan')
  })
})

describe("Data generus: sekolah, kelas sekolah, jilid Iqro'", () => {
  it("normalIqro/labelIqro, tambah & ubah generus, validasi, saran jenjang B/C", async () => {
    expect(['Iqro 3', "IQRO' 3", '3', 'iqro3', 'Jilid 3'].map(normalIqro)).toEqual(['3', '3', '3', '3', '3'])
    expect(["Al-Qur'an", 'Alquran', 'QURAN', 'AQ', 'Al Quran'].map(normalIqro)).toEqual(Array(5).fill('alquran'))
    expect(normalIqro('')).toBeNull()
    expect(normalIqro('Iqro 7')).toBeUndefined()
    expect(labelIqro('4')).toBe("Iqro' 4")
    expect(labelIqro('alquran')).toBe("Al-Qur'an")
    expect(labelIqro(null)).toBe('')

    const admin = await buatAdmin()
    const daerah = tambahWilayah(admin.db, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
    const desa = tambahWilayah(admin.db, { tingkat: 'desa', nama: 'Desa Uji', kode: 'DU', indukId: daerah.id })
    const kel = tambahWilayah(admin.db, { tingkat: 'kelompok', nama: 'Kelompok Uji', kode: 'KU', indukId: desa.id })
    const g = tambahGenerus(admin.db, { kelompokId: kel.id, nama: 'Anak', jenisKelamin: 'P', kategori: 'caberawit_b', sekolah: 'SD Negeri Contoh', kelasSekolah: '5', iqro: 'alquran' })
    expect(ambilGenerus(admin.db, g.id)).toMatchObject({ sekolah: 'SD Negeri Contoh', kelas_sekolah: '5', iqro: 'alquran' })
    expect(saranJenjangIqro(ambilGenerus(admin.db, g.id)!)).toBe('caberawit_c')
    expect(() => tambahGenerus(admin.db, { kelompokId: kel.id, nama: 'X', jenisKelamin: 'L', kategori: 'paud', iqro: '9' })).toThrow(/Iqro/)
    ubahGenerus(admin.db, g.id, { kategori: 'caberawit_c', iqro: '5' })
    expect(saranJenjangIqro(ambilGenerus(admin.db, g.id)!)).toBe('caberawit_b')
    ubahGenerus(admin.db, g.id, { iqro: 'alquran', sekolah: null })
    expect(saranJenjangIqro(ambilGenerus(admin.db, g.id)!)).toBeNull()
    expect(ambilGenerus(admin.db, g.id)!.sekolah).toBeNull()
    expect(() => ubahGenerus(admin.db, g.id, { iqro: 'tujuh' })).toThrow(/Iqro/)
    expect(() => ubahGenerus(admin.db, g.id, { sekolah: 'x'.repeat(101) })).toThrow(/100/)
  })

  it('impor CSV dengan kolom opsional sekolah, kelas_sekolah, iqro', async () => {
    const admin = await buatAdmin()
    const daerah = tambahWilayah(admin.db, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
    const desa = tambahWilayah(admin.db, { tingkat: 'desa', nama: 'Desa Uji', kode: 'DU', indukId: daerah.id })
    tambahWilayah(admin.db, { tingkat: 'kelompok', nama: 'Kelompok Uji', kode: 'KU', indukId: desa.id })
    const csv = [
      'nama,jenis_kelamin,tanggal_lahir,kategori,kelompok_kode,wali_nama,wali_no_hp,sekolah,kelas_sekolah,iqro',
      'Anak Satu,L,2018-03-01,Caberawit A,KU,Ortu Satu,,SD Contoh,2,Iqro 2',
      "Anak Dua,P,2015-03-01,Caberawit C,KU,,,MI Contoh,5,Al-Qur'an",
      'Anak Tiga,L,2015-03-01,Caberawit B,KU,,,,,Iqro 9',
    ].join('\n')
    const h = imporGenerusCsv(admin.db, csv)
    expect(h.berhasil).toBe(2)
    expect(h.gagal).toEqual([{ baris: 4, alasan: expect.stringMatching(/Iqro/) }])
    expect(ambilGenerus(admin.db, h.generusIds[0]!)).toMatchObject({ sekolah: 'SD Contoh', kelas_sekolah: '2', iqro: '2' })
    expect(ambilGenerus(admin.db, h.generusIds[1]!)!.iqro).toBe('alquran')
    // CSV lama tanpa kolom baru tetap diterima
    expect(imporGenerusCsv(admin.db, 'nama,jenis_kelamin,kategori,kelompok_kode\nAnak Empat,L,PAUD,KU').berhasil).toBe(1)
  })

  it('migrasi v5 → v6 menambah kolom tanpa kehilangan data', async () => {
    const admin = await buatAdmin()
    const daerah = tambahWilayah(admin.db, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
    const desa = tambahWilayah(admin.db, { tingkat: 'desa', nama: 'Desa Uji', kode: 'DU', indukId: daerah.id })
    const kel = tambahWilayah(admin.db, { tingkat: 'kelompok', nama: 'Kelompok Uji', kode: 'KU', indukId: desa.id })
    const g = tambahGenerus(admin.db, { kelompokId: kel.id, nama: 'Lama', jenisKelamin: 'L', kategori: 'paud' })
    for (const k of ['iqro', 'kelas_sekolah', 'sekolah']) admin.db.jalankanSkrip(`ALTER TABLE generus DROP COLUMN ${k};`)
    admin.db.jalankan(`UPDATE meta SET nilai = '5' WHERE kunci = 'versi_skema'`)
    const db = await bukaDb(simpanDb(admin.db))
    migrasi(db)
    expect(db.nilai<string>(`SELECT nilai FROM meta WHERE kunci = 'versi_skema'`)).toBe(String(VERSI_SKEMA))
    expect(ambilGenerus(db, g.id)).toMatchObject({ nama: 'Lama', sekolah: null, iqro: null })
  })

  it("mubaligh memperbarui jilid Iqro' → usulan disetujui otomatis di daerah; sekolah tetap menunggu admin; turun lewat paket", async () => {
    const w = await buatDunia()
    const [ali, budi] = w.g
    ubahGenerus(w.admin.db, ali!.id, { kategori: 'caberawit_b' })
    ubahGenerus(w.admin.db, budi!.id, { kategori: 'caberawit_b' })
    w.segarkan()
    ajukanUsulan(w.mubaligh.db, { jenis: 'ubah_generus', kelompokId: w.k1.id, data: { generus_id: ali!.id, perubahan: { iqro: '4' } } })
    ajukanUsulan(w.mubaligh.db, { jenis: 'ubah_generus', kelompokId: w.k1.id, data: { generus_id: budi!.id, perubahan: { kategori: 'caberawit_c', iqro: 'alquran' } } })
    ajukanUsulan(w.mubaligh.db, { jenis: 'ubah_generus', kelompokId: w.k1.id, data: { generus_id: budi!.id, perubahan: { sekolah: 'SD Contoh', kelas_sekolah: '4' } } })
    maju(1)
    const r = imporSetor(w.admin.db, buatSetor(w.mubaligh.db).bytes, w.admin.kunci)
    expect(r.usulanOtomatis).toBe(2)
    expect(ambilGenerus(w.admin.db, ali!.id)!.iqro).toBe('4')
    expect(ambilGenerus(w.admin.db, budi!.id)).toMatchObject({ kategori: 'caberawit_c', iqro: 'alquran', sekolah: null })
    expect(daftarUsulan(w.admin.db, { status: 'menunggu' })).toHaveLength(1)
    // usulan Iqro' tidak sah tidak disetujui otomatis
    ajukanUsulan(w.mubaligh.db, { jenis: 'ubah_generus', kelompokId: w.k1.id, data: { generus_id: ali!.id, perubahan: { iqro: '8' } } })
    maju(1)
    imporSetor(w.admin.db, buatSetor(w.mubaligh.db).bytes, w.admin.kunci)
    expect(ambilGenerus(w.admin.db, ali!.id)!.iqro).toBe('4')
    w.segarkan()
    expect(ambilGenerus(w.mubaligh.db, budi!.id)).toMatchObject({ iqro: 'alquran', kategori: 'caberawit_c' })
  })
})

describe('Data cetakan laporan bulanan format lembar', () => {
  async function siapkan() {
    const w = await buatDunia()
    const db = w.admin.db
    const [ali, budi, citra] = w.g
    ubahGenerus(db, ali!.id, { kategori: 'caberawit_a', iqro: '2', tanggal_lahir: '2018-05-01', sekolah: 'SD Contoh', kelas_sekolah: '2', wali_nama: 'Ortu Ali' })
    ubahGenerus(db, budi!.id, { kategori: 'caberawit_b', iqro: '5' })
    ubahGenerus(db, citra!.id, { kategori: 'caberawit_c', iqro: 'alquran' })
    const pemuda = tambahGenerus(db, { kelompokId: w.k1.id, nama: 'Dodi', jenisKelamin: 'L', kategori: 'praremaja', mulai: '2026-09-01' })
    const nikah = tambahGenerus(db, { kelompokId: w.k1.id, nama: 'Eka', jenisKelamin: 'P', kategori: 'pranikah', mulai: '2026-09-01' })
    tambahGenerus(db, { kelompokId: w.k2.id, nama: 'Fajar', jenisKelamin: 'L', kategori: 'paud', iqro: '1' })
    // pengajian rutin kelompok: Senin (1) & Kamis (4) untuk semua jenjang
    const pj = tambahPengajian(db, { wilayahId: w.k1.id, nama: 'Pengajian rutin', hari: 1, jam: '16:00' })
    tambahPengajian(db, { wilayahId: w.k1.id, nama: 'Pengajian Kamis', hari: 4, jam: '16:00' })
    // Oktober 2026: 1 Okt = Kamis; 5 Okt = Senin
    catatPresensi(db, { kelompokId: w.k1.id, tanggal: '2026-10-05', generusId: ali!.id, pengajianId: pj.id, status: 'hadir' })
    catatKeaktifan(db, { generusId: ali!.id, tanggal: '2026-10-05', kode: 'B', sebagai: 'pencatat' })
    catatKeaktifan(db, { generusId: ali!.id, tanggal: '2026-10-03', kode: 'B', sebagai: 'pencatat' })
    catatKeaktifan(db, { generusId: ali!.id, tanggal: '2026-10-07', kode: 'IZ', sebagai: 'pencatat' })
    for (const t of ['2026-10-01', '2026-10-02', '2026-10-08']) catatKeaktifan(db, { generusId: pemuda.id, tanggal: t, kode: t === '2026-10-02' ? 'MK' : 'KL', sebagai: 'pencatat' })
    catatKeaktifan(db, { generusId: nikah.id, tanggal: '2026-10-12', kode: 'T', sebagai: 'pencatat' })
    // evaluasi semester lalu (2026-S2 = Jan–Jun 2027? tidak — periode berjalan Okt 2026 = 2026-S1, belum ada; semester sebelumnya 2025-S2)
    simpanEvaluasi(db, { generusId: citra!.id, materiEvaluasiId: idMateriEvaluasi('caberawit_c', 'surat'), dikuasai: 45, periode: '2025-S2' })
    const isi = isiLaporanKosong()
    isi.mus5 = { terlaksana: false, tanggal: null, catatan: null }
    isi.musMuda.kelompok = { terlaksana: true, tanggal: '2026-10-10', catatan: 'Ngaji rutin sepekan sekali' }
    isi.nunggoni = [
      { nama: 'Bp. Contoh', unsur: '4S Kelompok', tanggal: '2026-10-04' },
      { nama: 'Ust. Tamu', unsur: 'MS', tanggal: '2026-10-11' },
    ]
    simpanLaporanBulanan(db, { kelompokId: w.k1.id, bulan: '2026-10', isi })
    return { w, db, ali: ali!, budi: budi!, citra: citra!, pemuda, nikah }
  }

  it('sampul, 7 blok jenjang berjudul lembar daerah, kolom tanggal 1–31 + urutan, persen, Iqro, libur, Peng. Materi, Total', async () => {
    const { w, db, ali, citra, pemuda, nikah } = await siapkan()
    const l = lembarLaporanBulanan(db, { kelompokId: w.k1.id, bulan: '2026-10' })
    expect(l.kelompok.nama).toBe('Klasaman 1')
    expect(l.desa?.nama).toBe('Klasaman')
    expect(l.teksBulan).toBe('OKTOBER 2026')
    expect(l.mubaligh).toBe('Ust. Hasan')
    expect(l.blok.map((b) => b.jenjang)).toEqual(['paud', 'caberawit_a', 'caberawit_b', 'caberawit_c', 'praremaja', 'remaja', 'pranikah'])
    expect(l.blok.map((b) => `${b.judul}${b.sub ? ` ${b.sub}` : ''}`)).toEqual([
      'PRESENSI KEAKTIFAN PAUD',
      'PRESENSI KEAKTIFAN CB. RAWIT A (Kelas 1 sampai Kelas 3)',
      'PRESENSI KEAKTIFAN CB. RAWIT B (Kelas 4-6, yg masih baca IQRO)',
      "PRESENSI KEAKTIFAN CB. RAWIT C (Usia SD yang sudah baca Al Qur'an)",
      'PRESENSI KEAKTIFAN Pra REMAJA (Usia SMP)',
      'PRESENSI KEAKTIFAN REMAJA (Usia SMA)',
      'PRESENSI KEAKTIFAN Pra NIKAH (Usia Pasca SMA)',
    ])
    const a = l.blok[1]!
    expect(a).toMatchObject({ target: 20, jumlahSlot: 24, hari: 31, kecil: true })
    const bAli = a.baris.find((b) => b.generus_id === ali.id)!
    expect(bAli).toMatchObject({ no: 1, nama: 'Ali', jk: 'L', umur: 8, iqro: "Iqro' 2", sekolah: 'SD Contoh', kelasSekolah: '2', orangTua: 'Ortu Ali', jumlah: 2, persenKeaktifan: 10 })
    expect(bAli.perTanggal).toHaveLength(31)
    expect(bAli.perTanggal[2]).toBe('B')
    expect(bAli.perTanggal[4]).toBe('AB')
    expect(bAli.perTanggal[6]).toBe('IZ')
    expect(bAli.urutan).toEqual(['B', 'AB'])
    expect(a.ringkasIqro).toEqual([0, 1, 0, 0, 0, 0])
    expect(a.total.keaktifan).toBe(10)
    // libur: hari selain Senin/Kamis tanpa kegiatan di jenjang itu; 3 Okt (Sabtu) ada kegiatan → bukan libur
    expect(a.libur[0]).toBe(false) // Kamis 1 Okt
    expect(a.libur[1]).toBe(true) // Jumat 2 Okt
    expect(a.libur[2]).toBe(false) // Sabtu 3 Okt, ada B
    expect(a.libur[4]).toBe(false) // Senin 5 Okt
    // Pra Remaja: kode besar, tanpa ringkasan Iqro
    const pr = l.blok[4]!
    expect(pr.ringkasIqro).toBeNull()
    expect(pr.baris[0]).toMatchObject({ generus_id: pemuda.id, urutan: ['KL', 'MK', 'KL'], jumlah: 3, persenKeaktifan: 15 })
    // Pra Nikah: target 16, slot 16
    const pn = l.blok[6]!
    expect(pn).toMatchObject({ target: 16, jumlahSlot: 16 })
    expect(pn.baris[0]).toMatchObject({ generus_id: nikah.id, persenKeaktifan: 6.25 })
    // Peng. Materi dari evaluasi semester terakhir; kosong bila belum
    const c = l.blok[3]!.baris.find((b) => b.generus_id === citra.id)!
    expect(c.persenMateri).not.toBeNull()
    expect(c.periodeMateri).toBe('2025-S2')
    expect(bAli.persenMateri).toBeNull()
    expect(l.blok[3]!.total.materi).toBe(c.persenMateri)
    // blok kosong tetap ada (untuk diisi tangan)
    expect(l.blok[0]!.baris).toEqual([])
    expect(l.blok[0]!.total.keaktifan).toBeNull()
  })

  it('slot urutan mengikuti target K16 bila > 24, dan jumlah hari aktif terbanyak', async () => {
    const { w, db, ali } = await siapkan()
    for (let d = 1; d <= 26; d++) catatKeaktifan(db, { generusId: ali.id, tanggal: `2026-10-${String(d).padStart(2, '0')}`, kode: 'B', sebagai: 'pencatat' })
    expect(lembarLaporanBulanan(db, { kelompokId: w.k1.id, bulan: '2026-10' }).blok[1]!.jumlahSlot).toBe(26)
  })

  it('absensi pengurus (NUNGGONI laporan + catatan pengurus), hasil musyawaroh, penyaksian (MT & Kord PPG Desa)', async () => {
    const { w, db } = await siapkan()
    const hp = await buatHp('HP PJ Desa')
    await aktifkanProfil(hp.db, terbitkanToken(db, w.admin.kunci, { kodePerangkat: hp.kode, role: 'pengurus', nama: 'Bp. Koordinator', wilayahId: w.desa.id, jabatan: ['pj_desa'] }))
    terapkanPaket(hp.db, buatPaket(db, w.desa.id, w.admin.kunci).bytes)
    simpanCatatan(hp.db, { wilayahId: w.desa.id, jenis: 'nunggoni', tanggal: '2026-10-18', isi: { kelompok_id: w.k1.id, kelas: 'Caberawit', temuan: '' } })
    // ganda (nama + tanggal sama) dibuang
    simpanCatatan(hp.db, { wilayahId: w.desa.id, jenis: 'nunggoni', tanggal: '2026-10-18', isi: { kelompok_id: w.k1.id, kelas: 'Caberawit', temuan: 'ulang' } })
    maju(1)
    imporSetor(db, buatSetor(hp.db).bytes, w.admin.kunci)
    const l = lembarLaporanBulanan(db, { kelompokId: w.k1.id, bulan: '2026-10' })
    expect(l.nunggoni).toEqual([
      { tanggal: '2026-10-04', hari: 4, nama: 'Bp. Contoh', dapukan: '4S Kelompok' },
      { tanggal: '2026-10-11', hari: 11, nama: 'Ust. Tamu', dapukan: 'MS' },
      { tanggal: '2026-10-18', hari: 18, nama: 'Bp. Koordinator', dapukan: 'Penanggung Jawab Program Desa' },
    ])
    expect(l.musyawarah).toEqual({
      mudaMudi: { terlaksana: true, hasil: 'Ngaji rutin sepekan sekali' },
      limaUnsur: { terlaksana: false, hasil: '' },
    })
    expect(l.penyaksian.kelompok.map((x) => x.jabatan)).toEqual(['KI KELOMPOK', 'Wkl KI KELOMPOK', 'PENEROBOS KELOMPOK', 'MT KELOMPOK'])
    expect(l.penyaksian.kelompok.find((x) => x.jabatan === 'MT KELOMPOK')!.nama).toBe('Ust. Hasan')
    expect(l.penyaksian.desa.map((x) => x.jabatan)).toEqual(['KI DESA', 'Wkl KI DESA', 'PENEROBOS DESA', 'MUBALEGH DESA', 'KORD PPG DESA'])
    expect(l.penyaksian.desa.find((x) => x.jabatan === 'KORD PPG DESA')!.nama).toBe('Bp. Koordinator')
    expect(l.penyaksian.desa.find((x) => x.jabatan === 'KI DESA')!.nama).toBe('')
    expect(l.catatanPenyaksian).toMatch(/AMSHOL/)
  })

  it('gabungan desa/daerah: semua kelompok urut; bulan tidak sah ditolak', async () => {
    const { w, db } = await siapkan()
    const semua = lembarLaporanWilayah(db, { wilayahId: w.desa.id, bulan: '2026-10' })
    expect(semua.map((x) => x.kelompok.nama)).toEqual(['Klasaman 1', 'Klasaman 2'])
    expect(semua[1]!.mubaligh).toBeNull()
    expect(semua[1]!.blok[0]!.baris.map((b) => b.nama)).toEqual(['Fajar'])
    expect(semua[1]!.blok[0]!.ringkasIqro).toEqual([1, 0, 0, 0, 0, 0])
    expect(lembarLaporanWilayah(db, { wilayahId: w.daerah.id, bulan: '2026-10' })).toHaveLength(2)
    expect(lembarLaporanWilayah(db, { wilayahId: w.k2.id, bulan: '2026-10' })).toHaveLength(1)
    expect(() => lembarLaporanBulanan(db, { kelompokId: w.k1.id, bulan: '2026-13' })).toThrow(/YYYY-MM/)
    expect(() => lembarLaporanBulanan(db, { kelompokId: w.desa.id, bulan: '2026-10' })).toThrow(/Kelompok/)
  })
})

describe('Cetak raport resmi (PDF offline, satu anak per halaman)', () => {
  it('data raport: kop daerah, identitas, target/dikuasai/%, TOTAL, keaktifan, catatan belum ditetapkan, tanda tangan', async () => {
    const w = await buatDunia()
    const db = w.admin.db
    const [ali, budi] = w.g
    ubahGenerus(db, ali!.id, { kategori: 'caberawit_c', wali_nama: 'Ortu Ali' })
    ubahGenerus(db, budi!.id, { kategori: 'caberawit_b' })
    simpanEvaluasi(db, { generusId: ali!.id, materiEvaluasiId: idMateriEvaluasi('caberawit_c', 'surat'), dikuasai: 45, periode: '2026-S1' })
    catatKeaktifan(db, { generusId: ali!.id, tanggal: '2026-10-05', kode: 'A', sebagai: 'pencatat' })
    const d = dataRaportCetak(db, ali!.id, { periode: '2026-S1', tanggalCetak: '2026-11-30' })
    expect(d.kop).toEqual({ organisasi: 'PENGGERAK PEMBINA GENERUS (PPG)', daerah: 'DAERAH SORONG' })
    expect(d).toMatchObject({ nama: 'Ali', jenjang: 'Caberawit C', kelompok: 'Klasaman 1', desa: 'Klasaman', semester: 'Semester 1 (Juli–Desember 2026)' })
    const surat = d.baris.find((b) => /surat/i.test(b.materi))!
    expect(surat.dikuasai).toBe('45')
    expect(surat.target).toMatch(/^\d+ /)
    // §20: keaktifan tidak lagi baris materi (data pendukung); butir belum dinilai ditulis "belum dinilai"
    expect(d.baris.some((b) => b.materi === 'Keaktifan')).toBe(false)
    expect(d.baris.find((b) => /Kefahaman/.test(b.materi))).toMatchObject({ persen: 'belum dinilai', belumDinilai: true })
    expect(d.catatanBelumDitetapkan).toMatch(/belum ditetapkan Kurikulum/)
    expect(d.baris.find((b) => b.belumDitetapkan)!.persen).toBe('—')
    expect(d.keaktifan).toMatch(/%/)
    expect(d.tandaTangan).toEqual({ mubaligh: 'Ust. Hasan', ki: '', wali: 'Ortu Ali' })
    expect(d.tempatTanggal).toBe('Sorong, 30 November 2026')
  })

  it('PDF sah: halaman ringkas + lampiran per anak, teks terbaca, huruf WinAnsi', async () => {
    const w = await buatDunia()
    const db = w.admin.db
    for (const g of w.g) ubahGenerus(db, g.id, { kategori: 'caberawit_a' })
    const pdf = raporPdf(db, { generusIds: w.g.map((g) => g.id), periode: '2026-S1' })
    const teks = new TextDecoder('latin1').decode(pdf)
    expect(teks.startsWith('%PDF-1.4')).toBe(true)
    // §20.4: per anak halaman ringkas + lampiran
    expect(teks).toContain('/Count 6')
    expect(teks.trimEnd().endsWith('%%EOF')).toBe(true)
    // xref menunjuk tepat ke objek
    const xref = Number(/startxref\n(\d+)/.exec(teks)![1])
    expect(teks.slice(xref, xref + 4)).toBe('xref')
    const off = [...teks.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]))
    off.forEach((o, i) => expect(teks.slice(o, o + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`))
    expect(() => raporPdf(db, { generusIds: [], periode: '2026-S1' })).toThrow(/minimal/)
    // pilihan cetak semua: per wilayah / jenjang / kelas
    ubahGenerus(db, w.g[2]!.id, { kategori: 'praremaja' })
    expect(generusUntukRaport(db, { wilayahId: w.desa.id }).map((g) => g.nama)).toEqual(['Ali', 'Budi', 'Citra'])
    expect(generusUntukRaport(db, { wilayahId: w.k1.id, jenjang: 'praremaja' }).map((g) => g.nama)).toEqual(['Citra'])
    const kelas = tambahPengajian(db, { wilayahId: w.k1.id, nama: 'Kelas Caberawit', kategoriGenerus: ['caberawit_a', 'caberawit_b'] })
    expect(generusUntukRaport(db, { wilayahId: w.k1.id, pengajianId: kelas.id }).map((g) => g.nama)).toEqual(['Ali', 'Budi'])
    expect(generusUntukRaport(db, { wilayahId: w.k2.id })).toEqual([])
  })

  it('penulis PDF: lebar & bungkus teks, karakter khusus', () => {
    expect(lebarTeks('AAA', 10)).toBeCloseTo(20.01, 1)
    expect(bungkusTeks('satu dua tiga empat lima enam', 10, 60)).toEqual(['satu dua tiga', 'empat lima', 'enam'])
    const dok = new DokumenPdf('Uji')
    dok.tambahHalaman(true).teks(10, 10, "Al-Qur'an – (uji) \\ ·")
    const t = new TextDecoder('latin1').decode(dok.bytes())
    expect(t).toContain('/MediaBox [0 0 842 595]')
  })
})
