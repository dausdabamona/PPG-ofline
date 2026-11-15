// §16 — Juknis Pembinaan & Evaluasi Hasil Belajar Generus 2025 (Fase 10): rumus persen, batas 75 %, keaktifan 1/hari,
// migrasi caberawit, rapor & rekap, sinkron (BELAJAR/SETOR/PAKET/BALASAN) dan wewenang.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  aktifkanProfil,
  alasanEvaluasiTidakSah,
  ajukanUsulan,
  ambilGenerus,
  ambilLaporanBulanan,
  ambilMateriEvaluasi,
  aturBulanEvaluasi,
  bukaDb,
  bulanEvaluasi,
  buatBalasan,
  buatBelajar,
  buatMateri,
  buatPaket,
  buatSetor,
  catatKeaktifan,
  catatPresensi,
  daftarMateriEvaluasi,
  hitungPersenMateri,
  hitungTotal,
  idEvaluasi,
  idMateriEvaluasi,
  imporBelajar,
  imporSetor,
  kategoriCocok,
  kategoriDariUmur,
  keaktifanBulan,
  keaktifanMenunggu,
  keaktifanPeriode,
  kejarTarget,
  kejarTargetKelompok,
  migrasi,
  normalKategori,
  pecahCaberawitLama,
  persenKeaktifan,
  raporGenerus,
  rekapKeaktifanBulan,
  rekapLaporanBulanan,
  rekapPenguasaan,
  sahkanKeaktifan,
  SEED_JUKNIS_2025,
  simpanEvaluasi,
  simpanLaporanBulanan,
  tambahGenerus,
  terapkanBalasan,
  terapkanMateri,
  terapkanPaket,
  terbitkanTokenGenerus,
  ubahGenerus,
  ubahMateriEvaluasi,
  type Generus,
} from '../src/index'
import { buatDunia, buatHp, keTanggal, lepasJam, pasangJam, type Dunia } from './bantu'

const EVL = idMateriEvaluasi

beforeAll(() => pasangJam('2026-11-25T01:00:00.000Z'))
afterAll(() => lepasJam())

describe('Seed juknis 2025', () => {
  it('jumlah butir per jenjang mengikuti Lembar Evaluasi', () => {
    const n = Object.fromEntries(Object.entries(SEED_JUKNIS_2025).map(([j, l]) => [j, l.length]))
    expect(n).toEqual({ paud: 14, caberawit_a: 14, caberawit_b: 14, caberawit_c: 22, praremaja: 21, remaja: 22, pranikah: 22 })
    const cari = (j: string, k: string) => SEED_JUKNIS_2025[j]!.find((m) => m.kode === k)!
    expect(cari('paud', 'iqro').target).toBe(35)
    expect(cari('caberawit_a', 'iqro').target).toBe(131)
    expect(cari('caberawit_b', 'iqro').target).toBe(195)
    expect(cari('caberawit_a', 'surat').target).toBe(18)
    expect(cari('caberawit_c', 'surat').target).toBe(45)
    expect(cari('remaja', 'surat').target).toBe(51)
    expect(cari('paud', 'doa_sorong').target).toBe(12)
    expect(cari('caberawit_c', 'doa_sorong').target).toBe(39)
    expect(cari('praremaja', 'dalil_sorong').target).toBe(34)
    expect(cari('caberawit_c', 'hadits').target).toBe(9)
    expect(cari('praremaja', 'hadits').target).toBe(21)
    expect(cari('remaja', 'hadits').target).toBe(27)
    expect(cari('pranikah', 'hadits').target).toBe(30)
    expect(cari('remaja', 'makna_quran').rincian!.juz).toHaveLength(20)
    expect(cari('pranikah', 'keaktifan').target).toBe(16)
    expect(cari('remaja', 'keilmuan').target).toBeNull() // juknis tidak menyebut angka → Kurikulum
    expect(cari('paud', 'thoharoh')).toMatchObject({ cara: 'subjektif', target: 75 })
    expect(cari('caberawit_b', 'wudhu_sholat')).toMatchObject({ cara: 'hitungan', target: 8 })
    expect(cari('caberawit_c', 'wudhu_sholat')).toMatchObject({ cara: 'subjektif' })
  })
})

describe('Rumus persen (juknis)', () => {
  const m = (j: string, k: string) => {
    const s = SEED_JUKNIS_2025[j]!.find((x) => x.kode === k)!
    return { nama: s.nama, cara: s.cara, target: s.target, rincian: s.rincian ?? {} }
  }
  it("hitungan: Iqro' 1 30/35 = 85,7 %; Caberawit A 65/131; surat 10/45", () => {
    expect(hitungPersenMateri(m('paud', 'iqro'), { dikuasai: 30 })).toBe(85.7)
    expect(hitungPersenMateri(m('caberawit_a', 'iqro'), { dikuasai: 65 })).toBe(49.6)
    expect(hitungPersenMateri(m('caberawit_c', 'surat'), { dikuasai: 10 })).toBe(22.2)
    // centang butir = jumlah dikuasai
    expect(hitungPersenMateri(m('paud', 'surat'), { rincian: { butir: [0, 1, 2] } })).toBe(42.9)
    // lebih dari target (target diturunkan kemudian) dibatasi
    expect(hitungPersenMateri({ ...m('paud', 'iqro'), target: 20 }, { dikuasai: 30 })).toBe(100)
  })
  it('juz: contoh Generus 1 (juz 21: 4, juz 22: 6, juz 30: 15 halaman) = 125 % ÷ 10 = 12,5 %', () => {
    expect(hitungPersenMateri(m('praremaja', 'makna_quran'), { rincian: { '21': 4, '22': 6, '30': 15 } })).toBe(12.5)
    expect(hitungPersenMateri(m('caberawit_c', 'makna_quran'), { rincian: { '30': 4 } })).toBe(20)
  })
  it('kitab: contoh Caberawit C (K. Sholah 50/151 + K. Nawafil 50/98) ÷ 9 kitab ≈ 9,3 %', () => {
    expect(hitungPersenMateri(m('caberawit_c', 'hadits'), { rincian: { '0': 50, '2': 50 } })).toBe(9.3)
    // contoh Generus 1: + Materi Pegon 10/19 + Materi Bacaan 20/37 → 190,7 % ÷ 21 ≈ 9,1 %
    expect(hitungPersenMateri(m('praremaja', 'hadits'), { rincian: { '0': 50, '2': 50, '7': 10, '8': 20 } })).toBe(9.1)
  })
  it('subjektif: maks 75 %, < 1 ditolak; dikuasai > target ditolak; halaman juz > 20 ditolak', () => {
    expect(alasanEvaluasiTidakSah(m('paud', 'thoharoh'), { nilai: 76 })).toMatch(/75/)
    expect(alasanEvaluasiTidakSah(m('paud', 'thoharoh'), { nilai: 0 })).toMatch(/1–75/)
    expect(alasanEvaluasiTidakSah(m('paud', 'thoharoh'), { nilai: 75 })).toBeNull()
    expect(hitungPersenMateri(m('paud', 'thoharoh'), { nilai: 90 })).toBe(75)
    expect(alasanEvaluasiTidakSah(m('paud', 'iqro'), { dikuasai: 36 })).toMatch(/melebihi target 35/)
    expect(alasanEvaluasiTidakSah(m('praremaja', 'makna_quran'), { rincian: { '21': 21 } })).toMatch(/paling banyak 20/)
    expect(alasanEvaluasiTidakSah(m('praremaja', 'makna_quran'), { rincian: { '5': 3 } })).toMatch(/bukan target/)
    expect(alasanEvaluasiTidakSah(m('caberawit_c', 'hadits'), { rincian: { '0': 152 } })).toMatch(/paling banyak 151/)
    expect(alasanEvaluasiTidakSah(m('caberawit_c', 'hadits'), { rincian: { '1': 3 } })).toMatch(/belum diisi Kurikulum/)
    expect(alasanEvaluasiTidakSah(m('remaja', 'keilmuan'), { dikuasai: 3 })).toMatch(/belum ditetapkan/)
    expect(alasanEvaluasiTidakSah(m('paud', 'keaktifan'), { dikuasai: 3 })).toMatch(/lembar kontrol/)
  })
  it('TOTAL = rata-rata tanpa bobot; materi tanpa target tidak ikut', () => {
    expect(hitungTotal([100, 50, 0, null])).toBe(50)
    expect(hitungTotal([null])).toBeNull()
  })
  it('keaktifan: 20 kali → 5 % per kali; Pra Nikah 16 kali → 6,25 %; lebih dari target = 100 %', () => {
    expect(persenKeaktifan(1, 20)).toBe(5)
    expect(persenKeaktifan(1, 16)).toBe(6.25)
    expect(persenKeaktifan(25, 20)).toBe(100)
  })
})

describe('Jenjang', () => {
  it('saran umur, alias CSV, dan pencocokan caberawit lama', () => {
    expect(kategoriDariUmur('2018-07-12', '2026-11-25')).toBe('caberawit_a')
    expect(kategoriDariUmur('2015-01-01', '2026-11-25')).toBe('caberawit_b')
    expect(kategoriDariUmur('2012-01-01', '2026-11-25')).toBe('praremaja')
    expect(normalKategori('Caberawit A')).toBe('caberawit_a')
    expect(normalKategori('CB Rawit C')).toBe('caberawit_c')
    expect(normalKategori('Generus 3')).toBe('pranikah')
    expect(normalKategori('xyz')).toBeNull()
    expect(kategoriCocok('caberawit', 'caberawit_b')).toBe(true)
    expect(kategoriCocok('caberawit_a', 'caberawit_b')).toBe(false)
    expect(kategoriCocok('paud', 'paud')).toBe(true)
  })
  it('migrasi v3 → v4 di daerah: caberawit lama → saran umur (A/B), ditandai perlu dicek, versi naik', async () => {
    const d = await buatDunia()
    const db = d.admin.db
    const muda = tambahGenerus(db, { kelompokId: d.k1.id, nama: 'Muda', jenisKelamin: 'L', tanggalLahir: '2019-01-01', kategori: 'caberawit' })
    const tua = tambahGenerus(db, { kelompokId: d.k1.id, nama: 'Tua', jenisKelamin: 'L', tanggalLahir: '2015-01-01', kategori: 'caberawit' })
    // tiru database v3: hapus tabel v4 & kembalikan versi skema
    db.jalankanSkrip(`DROP TABLE materi_evaluasi; DROP TABLE keaktifan; DROP TABLE evaluasi_semester; DROP TABLE laporan_bulanan; DROP TABLE catatan_sholat;
      UPDATE meta SET nilai = '3' WHERE kunci = 'versi_skema';`)
    const versiLama = ambilGenerus(db, tua.id)!.versi
    migrasi(db)
    expect(ambilGenerus(db, muda.id)).toMatchObject({ kategori: 'caberawit_a', kategori_saran: 1 })
    expect(ambilGenerus(db, tua.id)).toMatchObject({ kategori: 'caberawit_b', kategori_saran: 1, versi: versiLama + 1 })
    // generus buatDunia tanpa tanggal lahir → Caberawit A
    expect(ambilGenerus(db, d.g[0]!.id)!.kategori).toBe('caberawit_a')
    expect(daftarMateriEvaluasi(db, 'praremaja')).toHaveLength(21)
    // idempoten
    expect(pecahCaberawitLama(db)).toBe(0)
    // turun ke HP lewat paket (master menang karena versi naik)
    d.segarkan()
    expect(ambilGenerus(d.mubaligh.db, tua.id)!.kategori).toBe('caberawit_b')
    // menetapkan jenjang menghapus tanda saran
    expect(ubahGenerus(db, tua.id, { kategori: 'caberawit_c' }).kategori_saran).toBeNull()
  })
  it('HP/EXE bawah tidak menulis ulang master saat migrasi', async () => {
    const d = await buatDunia()
    const hp = d.mubaligh.db
    hp.jalankan(`UPDATE meta SET nilai = '3' WHERE kunci = 'versi_skema'`)
    hp.jalankan(`UPDATE generus SET kategori = 'caberawit'`)
    migrasi(hp)
    expect(ambilGenerus(hp, d.g[0]!.id)!.kategori).toBe('caberawit')
  })
})

/** Dunia dengan generus berjenjang juknis + HP murid Ali. */
async function duniaJuknis() {
  const d = await buatDunia()
  const a = d.admin.db
  for (const g of d.g) ubahGenerus(a, g.id, { kategori: 'caberawit_c' })
  const remaja = tambahGenerus(a, { kelompokId: d.k1.id, nama: 'Rina', jenisKelamin: 'P', kategori: 'pranikah', mulai: '2026-07-01' })
  d.segarkan()
  terapkanMateri(d.mubaligh.db, buatMateri(a, d.admin.kunci).bytes)
  const hp = await buatHp('HP Ali')
  const murid = await aktifkanProfil(hp.db, terbitkanTokenGenerus(d.mubaligh.db, d.mubaligh.profil.id, { kodePerangkat: hp.kode, role: 'generus', generusIds: [d.g[0]!.id], nama: 'Ali' }))
  terapkanBalasan(hp.db, buatBalasan(d.mubaligh.db, hp.id).bytes)
  return { d, a, hp, murid, ali: d.g[0]! as Generus, budi: d.g[1]!, remaja }
}

describe('Keaktifan (lembar kontrol)', () => {
  it('maks 1 per hari; presensi hadir = A; murid diajukan dihitung setelah disahkan; izin tidak dihitung', async () => {
    const { d, hp, ali } = await duniaJuknis()
    const m = d.mubaligh.db
    catatPresensi(m, { kelompokId: d.k1.id, generusId: ali.id, tanggal: '2026-11-02', status: 'hadir' })
    catatKeaktifan(m, { generusId: ali.id, tanggal: '2026-11-02', kode: 'B', sebagai: 'pencatat' }) // hari sama → tetap 1
    catatKeaktifan(m, { generusId: ali.id, tanggal: '2026-11-03', kode: 'IZ', sebagai: 'pencatat' })
    expect(() => catatKeaktifan(m, { generusId: ali.id, tanggal: '2026-11-26', kode: 'B', sebagai: 'pencatat' })).toThrow(/masa depan/)
    // murid (HP sendiri): lembar kontrol mandiri → diajukan
    expect(() => catatKeaktifan(hp.db, { generusId: ali.id, tanggal: '2026-11-04', kode: 'A', sebagai: 'murid' })).toThrow(/absen/)
    catatKeaktifan(hp.db, { generusId: ali.id, tanggal: '2026-11-04', kode: 'B', sebagai: 'murid' })
    catatKeaktifan(hp.db, { generusId: ali.id, tanggal: '2026-11-05', kode: 'B', keterangan: 'Surat An Naba 20x + Iqro hal 5', sebagai: 'murid' })
    // Caberawit C memakai kode PAUD–Caberawit (A, B); kode generus (MK, QR, …) ditolak
    expect(() => catatKeaktifan(m, { generusId: ali.id, tanggal: '2026-11-05', kode: 'MK', sebagai: 'pencatat' })).toThrow(/tidak berlaku/)
    const imp = imporBelajar(m, buatBelajar(hp.db).bytes)
    expect(imp.hasil.ditambah).toBe(2)
    let k = keaktifanBulan(m, ali.id, '2026-11')
    expect(k).toMatchObject({ jumlah: 1, target: 20, persen: 5, menunggu: 2 })
    const menunggu = keaktifanMenunggu(m, d.k1.id)
    expect(menunggu.map((x) => x.tanggal)).toEqual(['2026-11-04', '2026-11-05'])
    sahkanKeaktifan(m, menunggu[0]!.id, 'disahkan')
    sahkanKeaktifan(m, menunggu[1]!.id, 'ditolak')
    k = keaktifanBulan(m, ali.id, '2026-11')
    expect(k).toMatchObject({ jumlah: 2, persen: 10, menunggu: 0 })
    expect(k.hari.find((h) => h.tanggal === '2026-11-03')).toMatchObject({ izin: true, dihitung: false })
    // balasan → HP murid melihat yang sudah disahkan
    terapkanBalasan(hp.db, buatBalasan(m, hp.id).bytes)
    expect(keaktifanBulan(hp.db, ali.id, '2026-11').jumlah).toBe(2)
    // kejar target (tanggal 25, kurang 18, sisa 6 hari → tidak terkejar)
    expect(kejarTarget(m, ali.id, '2026-11-25')).toMatchObject({ kurang: 18, sisaHari: 6, terkejar: false })
    expect(kejarTarget(m, ali.id, '2026-11-10')).toBeNull()
    expect(kejarTargetKelompok(m, d.k1.id, '2026-11-25').map((x) => x.nama)).toContain('Ali')
  })
  it('Pra Nikah target 16; semester = rata-rata bulanan (bulan sebelum terdaftar tidak dihitung)', async () => {
    const { d, remaja } = await duniaJuknis()
    const m = d.mubaligh.db
    for (let i = 1; i <= 16; i++) catatKeaktifan(m, { generusId: remaja.id, tanggal: `2026-10-${String(i).padStart(2, '0')}`, kode: 'KL', sebagai: 'pencatat' })
    const per = keaktifanPeriode(m, remaja.id, '2026-S1', { tanggal: '2026-11-25' })
    expect(per.bulan.map((b) => [b.bulan, b.persen])).toEqual([
      ['2026-07', 0], ['2026-08', 0], ['2026-09', 0], ['2026-10', 100], ['2026-11', 0],
    ])
    expect(per.persen).toBe(20) // (0+0+0+100+0)/5
  })
  it('keaktifan murid naik ke daerah lewat setor mubaligh; mubaligh lain tidak bisa mengesahkan', async () => {
    const { d, a, hp, ali } = await duniaJuknis()
    const m = d.mubaligh.db
    catatKeaktifan(hp.db, { generusId: ali.id, tanggal: '2026-11-06', kode: 'B', sebagai: 'murid' })
    imporBelajar(m, buatBelajar(hp.db).bytes)
    sahkanKeaktifan(m, keaktifanMenunggu(m, d.k1.id)[0]!.id, 'disahkan')
    const r = imporSetor(a, buatSetor(m).bytes, d.admin.kunci)
    expect(r.ditolak).toEqual([])
    expect(r.perTabel.keaktifan?.ditambah).toBe(1)
    expect(keaktifanBulan(a, ali.id, '2026-11').jumlah).toBe(1)
    // pengurus kelompok (tanpa hak sahkan) tidak bisa mengirim keaktifan disahkan
    const p = await buatHp('HP Pengurus')
    await aktifkanProfil(p.db, (await import('../src/index')).terbitkanToken(a, d.admin.kunci, { kodePerangkat: p.kode, role: 'pengurus', nama: 'Pengurus', wilayahId: d.k1.id }))
    terapkanPaket(p.db, buatPaket(a, d.k1.id, d.admin.kunci).bytes)
    expect(() => catatKeaktifan(p.db, { generusId: ali.id, tanggal: '2026-11-07', kode: 'B', sebagai: 'pencatat' })).toThrow(/berwenang/)
  })
})

describe('Evaluasi semester, raport & rekap', () => {
  it('mubaligh menilai → raport (TOTAL, sisa jenjang sebelumnya) → setor → rekap daerah; nilai palsu ditolak', async () => {
    const { d, a, hp, ali, budi } = await duniaJuknis()
    const m = d.mubaligh.db
    const C = (k: string) => EVL('caberawit_c', k)
    simpanEvaluasi(m, { generusId: ali.id, materiEvaluasiId: C('surat'), dikuasai: 45 })
    simpanEvaluasi(m, { generusId: ali.id, materiEvaluasiId: C('thoharoh'), nilai: 75 })
    simpanEvaluasi(m, { generusId: ali.id, materiEvaluasiId: C('makna_quran'), rincian: { '30': 10 } })
    expect(() => simpanEvaluasi(m, { generusId: ali.id, materiEvaluasiId: C('thoharoh'), nilai: 80 })).toThrow(/75/)
    expect(() => simpanEvaluasi(m, { generusId: ali.id, materiEvaluasiId: C('surat'), dikuasai: 46 })).toThrow(/melebihi/)
    // sisa target jenjang sebelumnya (Caberawit B): Iqro' 1–6 baru 100/195
    simpanEvaluasi(m, { generusId: ali.id, materiEvaluasiId: EVL('caberawit_b', 'iqro'), dikuasai: 100 })
    // generus belum boleh dinilai materi jenjang di atasnya
    expect(() => simpanEvaluasi(m, { generusId: ali.id, materiEvaluasiId: EVL('praremaja', 'surat'), dikuasai: 1 })).toThrow(/di atas/)
    // murid tidak bisa menilai
    expect(() => simpanEvaluasi(hp.db, { generusId: ali.id, materiEvaluasiId: C('surat'), dikuasai: 1 })).toThrow()
    const rp = raporGenerus(m, ali.id, { periode: '2026-S1' })!
    expect(rp.items).toHaveLength(22)
    expect(rp.items.find((i) => i.materi.kode === 'surat')!.persen).toBe(100)
    expect(rp.items.find((i) => i.materi.kode === 'makna_quran')!.persen).toBe(50)
    // (100 + 75 + 50) ÷ 22 materi (keaktifan 0, lainnya belum dinilai = 0)
    expect(rp.total).toBe(10.2)
    expect(rp.sisaSebelumnya).toMatchObject({ jenjang: 'caberawit_b' })
    expect(rp.sisaSebelumnya!.items.map((i) => [i.materi.kode, i.persen])).toEqual([['iqro', 51.3]])
    // semester berikutnya memakai nilai terakhir sebagai cadangan
    expect(raporGenerus(m, ali.id, { periode: '2026-S2' })!.items.find((i) => i.materi.kode === 'surat')).toMatchObject({ persen: 100, dariPeriode: '2026-S1' })

    const r = imporSetor(a, buatSetor(m).bytes, d.admin.kunci)
    expect(r.ditolak).toEqual([])
    expect(r.perTabel.evaluasi_semester?.ditambah).toBe(4)
    const rk = rekapPenguasaan(a, { wilayahId: d.daerah.id, jenjang: 'caberawit_c', periode: '2026-S1' })
    expect(rk.kolom).toHaveLength(22)
    expect(rk.baris.map((b) => b.nama)).toEqual(['Ali', 'Budi', 'Citra'])
    expect(rk.baris[0]!.total).toBe(10.2)
    expect(rk.perKelompok).toHaveLength(1)
    expect(rk.perDesa[0]!.nama).toBe('Klasaman')

    // pemalsuan di HP mubaligh (lewat SQL langsung): 90 % subjektif & generus kelompok lain → ditolak daerah
    const palsu = m.satu<Record<string, unknown>>(`SELECT * FROM evaluasi_semester WHERE materi_evaluasi_id = ?`, [C('thoharoh')])!
    m.jalankan(`UPDATE evaluasi_semester SET nilai = 90, seq_lokal = 999 WHERE id = ?`, [palsu.id as string])
    m.jalankan(`UPDATE meta SET nilai = '999' WHERE kunci = 'seq'`)
    const r2 = imporSetor(a, buatSetor(m).bytes, d.admin.kunci)
    expect(r2.ditolak.map((x) => x.alasan)).toEqual([expect.stringMatching(/75/)])
    const lain = tambahGenerus(a, { kelompokId: d.k2.id, nama: 'Zaid', jenisKelamin: 'L', kategori: 'caberawit_c' })
    void budi
    m.jalankan(
      `INSERT INTO evaluasi_semester SELECT '${idEvaluasi(lain.id, '2026-S1', C('surat'))}', '${lain.id}', kelompok_id, periode, jenjang, materi_evaluasi_id, 3, nilai, rincian_json, tanggal, penguji, perangkat_id, dibuat_pada, diubah_pada, dihapus, versi, 1000 FROM evaluasi_semester WHERE materi_evaluasi_id = ?`,
      [C('surat')],
    )
    m.jalankan(`UPDATE meta SET nilai = '1000' WHERE kunci = 'seq'`)
    const r3 = imporSetor(a, buatSetor(m).bytes, d.admin.kunci)
    expect(r3.ditolak.some((x) => /bukan anggota|tidak dikenal/.test(x.alasan))).toBe(true)
  })

  it('Kurikulum mengubah target & halaman kitab; bulan evaluasi bawaan Mei/November', async () => {
    const { a } = await duniaJuknis()
    expect(bulanEvaluasi(a)).toEqual({ S1: 11, S2: 5 })
    aturBulanEvaluasi(a, { S1: 12, S2: 6 })
    expect(bulanEvaluasi(a)).toEqual({ S1: 12, S2: 6 })
    expect(() => aturBulanEvaluasi(a, { S1: 3, S2: 6 })).toThrow(/Juli/)
    const id = EVL('remaja', 'keilmuan')
    expect(ubahMateriEvaluasi(a, id, { target: 18 }).target).toBe(18)
    const h = ambilMateriEvaluasi(a, EVL('caberawit_c', 'hadits'))!
    const kitab = h.rincian.kitab!.map((k, i) => (i === 1 ? { ...k, halaman: 60 } : k))
    expect(ubahMateriEvaluasi(a, h.id, { rincian: { kitab } }).rincian.kitab![1]!.halaman).toBe(60)
    expect(() => ubahMateriEvaluasi(a, EVL('paud', 'thoharoh'), { target: 80 })).toThrow(/75/)
  })

  it('jenjang: usulan mubaligh yang hanya mengubah kategori disetujui otomatis di daerah', async () => {
    const { d, a, budi } = await duniaJuknis()
    ajukanUsulan(d.mubaligh.db, { jenis: 'ubah_generus', kelompokId: d.k1.id, data: { generus_id: budi.id, perubahan: { kategori: 'caberawit_b' } } })
    ajukanUsulan(d.mubaligh.db, { jenis: 'ubah_generus', kelompokId: d.k1.id, data: { generus_id: budi.id, perubahan: { nama: 'Budi S' } } })
    const r = imporSetor(a, buatSetor(d.mubaligh.db).bytes, d.admin.kunci)
    expect(r.usulanOtomatis).toBe(1)
    expect(ambilGenerus(a, budi.id)).toMatchObject({ kategori: 'caberawit_b', nama: 'Budi' })
  })
})

describe('Laporan bulanan kelompok', () => {
  it('Musyawaroh 5 unsur, muda/i, NUNGGONI → setor → rekap daerah; isi tidak sah ditolak', async () => {
    const { d, a } = await duniaJuknis()
    const m = d.mubaligh.db
    const isi = {
      mus5: { terlaksana: true, tanggal: '2026-11-08', catatan: 'Evaluasi absensi Oktober' },
      musMuda: { kelompok: { terlaksana: true }, desa: { terlaksana: false }, daerah: { terlaksana: null } },
      nunggoni: [{ nama: 'Bpk. Contoh', unsur: '4S Kelompok' as const, tanggal: '2026-11-09', kelas: 'Caberawit', temuan: 'Ruangan sempit' }],
    }
    simpanLaporanBulanan(m, { kelompokId: d.k1.id, bulan: '2026-11', isi })
    expect(() => simpanLaporanBulanan(m, { kelompokId: d.k1.id, bulan: '2026-11', isi: { ...isi, nunggoni: [{ nama: 'X', unsur: 'Lain' as never }] } })).toThrow(/tidak dikenal/)
    expect(() => simpanLaporanBulanan(m, { kelompokId: d.k1.id, bulan: '2026-12', isi })).toThrow(/belum berjalan/)
    expect(() => simpanLaporanBulanan(m, { kelompokId: d.k2.id, bulan: '2026-11', isi })).toThrow(/berwenang/)
    const r = imporSetor(a, buatSetor(m).bytes, d.admin.kunci)
    expect(r.perTabel.laporan_bulanan?.ditambah).toBe(1)
    const rk = rekapLaporanBulanan(a, { wilayahId: d.daerah.id, bulan: '2026-11' })
    expect(rk.find((x) => x.kelompok_id === d.k1.id)).toMatchObject({ ada: true, mus5: true, jumlahNunggoni: 1, musMuda: { kelompok: true, desa: false, daerah: null } })
    expect(rk.find((x) => x.kelompok_id === d.k2.id)!.ada).toBe(false)
    expect(ambilLaporanBulanan(a, d.k1.id, '2026-11').isi.nunggoni[0]!.unsur).toBe('4S Kelompok')
    // rekap keaktifan bulan untuk musyawarah (temuan < 50 %)
    keTanggal('2026-11-25')
    const rka = rekapKeaktifanBulan(a, { wilayahId: d.desa.id, bulan: '2026-11' })
    expect(rka.perKelompok[0]!.nama).toBe('Klasaman 1')
    expect(rka.perluPerhatian.length).toBe(rka.baris.length)
  })
})

describe('Database baru', () => {
  it('HP baru tidak punya materi evaluasi sampai berkas MATERI/BALASAN tiba', async () => {
    const db = await bukaDb()
    expect(daftarMateriEvaluasi(db, 'paud')).toEqual([])
  })
})
