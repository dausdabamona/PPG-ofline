// §19 (Fase 13) — cetakan Laporan Bulanan format lembar & Raport resmi: susunan halaman, judul lembar daerah, kolom
// tanggal 1–31 / urutan, ringkasan Iqro', absensi pengurus, penyaksian; ekspor Excel bertata letak sama.
// Data dummy (tanpa nama asli). Bila PPG_CONTOH_CETAK=<folder> diisi, HTML contoh ditulis ke folder itu untuk uji visual
// (lihat uji-peramban/uji-cetak.mjs).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  aktifkanProfil,
  aturJam,
  bukaDb,
  buatPaket,
  catatKeaktifan,
  catatPresensi,
  dataRaportCetak,
  idMateriEvaluasi,
  inisialisasiAdmin,
  inisialisasiPerangkat,
  isiLaporanKosong,
  lembarLaporanWilayah,
  simpanEvaluasi,
  simpanLaporanBulanan,
  tambahGenerus,
  tambahPengajian,
  tambahWilayah,
  terapkanPaket,
  terbitkanToken,
  type Db,
  type KategoriGenerus,
} from '@ppg/core'
import { LembarLaporan, LembarRaport, susunHalaman } from '../src/komponen/lembar-laporan'
import { buatExcelLembar } from '../src/utils/excel-lembar'

beforeAll(() => aturJam(() => new Date('2026-11-05T01:00:00.000Z')))
afterAll(() => aturJam(null))

const NAMA = ['Ahmad Contoh', 'Bilal Contoh', 'Citra Contoh', 'Dina Contoh', 'Erik Contoh', 'Fina Contoh', 'Gani Contoh', 'Hana Contoh', 'Ilham Contoh', 'Juni Contoh', 'Kiki Contoh', 'Lina Contoh', 'Mira Contoh', 'Nur Contoh']

/** Desa contoh dengan 2 kelompok dan anak di semua jenjang (data dummy, acak tetap). */
async function desaContoh(): Promise<{ db: Db; desaId: string; generus: string[] }> {
  const db = await bukaDb()
  const kunci = await inisialisasiAdmin(db, { sandi: 'sandi-admin-123', namaOrganisasi: 'PPG Contoh' })
  const d = tambahWilayah(db, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
  const ds = tambahWilayah(db, { tingkat: 'desa', nama: 'Desa Contoh', kode: 'DC', indukId: d.id })
  const generus: string[] = []
  let acak = 7
  const r = () => (acak = (acak * 1103515245 + 12345) % 2147483648) / 2147483648
  const susunan: [KategoriGenerus, number][] = [['paud', 3], ['caberawit_a', 6], ['caberawit_b', 5], ['caberawit_c', 4], ['praremaja', 4], ['remaja', 3], ['pranikah', 5]]
  for (const [nk, kode] of [['Contoh Satu', 'CS1'], ['Contoh Dua', 'CS2']] as const) {
    const k = tambahWilayah(db, { tingkat: 'kelompok', nama: nk, kode, indukId: ds.id })
    const hp = await bukaDb()
    const { kodePerangkat } = await inisialisasiPerangkat(hp, 'HP MT')
    await aktifkanProfil(hp, terbitkanToken(db, kunci, { kodePerangkat, role: 'mubaligh', nama: `Mubaligh ${nk}`, wilayahId: k.id }))
    terapkanPaket(hp, buatPaket(db, k.id, kunci).bytes)
    tambahPengajian(db, { wilayahId: k.id, nama: 'Pengajian rutin', hari: 1, jam: '16:00' })
    tambahPengajian(db, { wilayahId: k.id, nama: 'Pengajian rutin 2', hari: 3, jam: '16:00' })
    tambahPengajian(db, { wilayahId: k.id, nama: 'Pengajian rutin 3', hari: 5, jam: '16:00' })
    let i = 0
    for (const [jenjang, n] of susunan) {
      for (let x = 0; x < (nk === 'Contoh Dua' ? Math.ceil(n / 2) : n); x++) {
        const nama = `${NAMA[i++ % NAMA.length]!.split(' ')[0]} ${String.fromCharCode(65 + x)}.`
        const kecil = jenjang === 'paud' || jenjang.startsWith('caberawit')
        const g = tambahGenerus(db, {
          kelompokId: k.id,
          nama,
          jenisKelamin: x % 2 ? 'P' : 'L',
          kategori: jenjang,
          tanggalLahir: `${2021 - ['paud', 'caberawit_a', 'caberawit_b', 'caberawit_c', 'praremaja', 'remaja', 'pranikah'].indexOf(jenjang) * 3}-0${(x % 9) + 1}-15`,
          sekolah: kecil ? 'SD Contoh' : jenjang === 'praremaja' ? 'SMP Contoh' : jenjang === 'remaja' ? 'SMA Contoh' : null,
          kelasSekolah: kecil ? String((x % 6) + 1) : null,
          iqro: jenjang === 'caberawit_c' ? 'alquran' : kecil ? String((x % 6) + 1) : 'alquran',
          waliNama: `Ortu ${nama}`,
          mulai: '2026-09-01',
        })
        generus.push(g.id)
        const rajin = r()
        for (let t = 1; t <= 31; t++) {
          const tgl = `2026-10-${String(t).padStart(2, '0')}`
          const dow = new Date(`${tgl}T00:00:00Z`).getUTCDay()
          if ([1, 3, 5].includes(dow) && r() < rajin + 0.2) catatPresensi(db, { kelompokId: k.id, tanggal: tgl, generusId: g.id, status: 'hadir' })
          if (r() < rajin * 0.5) {
            const kode = kecil ? 'B' : (['KL', 'MK', 'T', 'MS', 'QR', 'HD'] as const)[Math.floor(r() * 6)]!
            catatKeaktifan(db, { generusId: g.id, tanggal: tgl, kode, sebagai: 'pencatat' })
          }
        }
        if (r() < 0.6) {
          simpanEvaluasi(db, { generusId: g.id, materiEvaluasiId: idMateriEvaluasi(jenjang, kecil && jenjang !== 'caberawit_c' ? 'adab' : 'surat'), dikuasai: 5, periode: '2025-S2' })
        }
      }
    }
    const isi = isiLaporanKosong()
    isi.mus5 = { terlaksana: false, tanggal: null, catatan: null }
    isi.musMuda.kelompok = { terlaksana: true, tanggal: '2026-10-10', catatan: '1. Ngaji tambahan sekali sepekan. 2. Ngaji dari rumah ke rumah.' }
    isi.nunggoni = [
      { nama: 'Bp. Pengurus A', unsur: '4S Kelompok', tanggal: '2026-10-04' },
      { nama: 'Bp. Pengurus B', unsur: '4S Kelompok', tanggal: '2026-10-10' },
      { nama: 'Bp. Pengurus A', unsur: '4S Kelompok', tanggal: '2026-10-18' },
      { nama: 'Ust. Tamu', unsur: 'MS', tanggal: '2026-10-25' },
    ]
    simpanLaporanBulanan(db, { kelompokId: k.id, bulan: '2026-10', isi })
  }
  return { db, desaId: ds.id, generus }
}

function tulisContoh(nama: string, isi: string): void {
  const dir = process.env.PPG_CONTOH_CETAK
  if (!dir) return
  mkdirSync(dir, { recursive: true })
  const css = readFileSync(join(__dirname, '../src/komponen/lembar-laporan.css'), 'utf8')
  const logo = readFileSync(join(__dirname, '../public/logo.svg'), 'utf8')
  writeFileSync(join(dir, 'logo.svg'), logo)
  writeFileSync(join(dir, nama), `<!doctype html><html lang="id"><head><meta charset="utf-8"><style>body{margin:0;background:#fff}${css}</style></head><body>${isi}</body></html>`)
}

describe('Cetakan laporan bulanan format lembar', () => {
  it('gabungan desa: sampul + lembar per jenjang (kolom tanggal 1–31 bawaan) + pengurus; urutan sebagai alternatif; Excel', async () => {
    const { db, desaId } = await desaContoh()
    const data = lembarLaporanWilayah(db, { wilayahId: desaId, bulan: '2026-10' })
    expect(data).toHaveLength(2)
    // dua blok kecil per halaman bila muat
    expect(susunHalaman(data[0]!.blok).map((h) => h.map((b) => b.jenjang))).toEqual([
      ['paud', 'caberawit_a'],
      ['caberawit_b', 'caberawit_c'],
      ['praremaja', 'remaja'],
      ['pranikah'],
    ])
    const html = renderToStaticMarkup(<LembarLaporan data={data} format="tanggal" />)
    for (const t of ['LAPORAN GENERUS KELOMPOK', 'CONTOH SATU', 'BULAN OKTOBER 2026', 'Ust. Mubaligh Contoh Satu', 'PRESENSI KEAKTIFAN CB. RAWIT B', '(Kelas 4-6, yg masih baca IQRO)', '# KLP : CONTOH DUA', 'IQRO&#x27; / QUR&#x27;AN', 'ORANG TUA', 'SEKOLAH / KELAS', 'ABSENSI PENGURUS &amp; MUBALIGH - MUBALIGHOT PEDULI', 'LAPORAN HASIL MUSYAWAROH', 'PENYAKSIAN', 'AMSHOL', 'KORD PPG DESA', 'Bp. Pengurus A'])
      expect(html).toContain(t)
    expect(html).toContain('lb-libur')
    expect((html.match(/class="lb-halaman lb-sampul"/g) ?? []).length).toBe(2)
    const urutan = renderToStaticMarkup(<LembarLaporan data={data} format="urutan" />)
    expect(urutan).toContain("NAMA + UMUR + IQRO&#x27;")
    expect(urutan).toMatch(/<th>24<\/th>/)
    expect(urutan).not.toMatch(/<th>25<\/th>/)
    tulisContoh('lembar-tanggal.html', html)
    tulisContoh('lembar-urutan.html', urutan)
    // Excel bertata letak sama
    const xlsx = await buatExcelLembar(data, 'tanggal')
    const { default: ExcelJS } = await import('exceljs')
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(xlsx as unknown as ArrayBuffer)
    const nama = wb.worksheets.map((w) => w.name)
    expect(nama).toContain('CS1 Sampul')
    expect(nama).toContain('CS1 PAUD-CB A')
    expect(nama).toContain('CS2 Pengurus')
    const ws = wb.getWorksheet('CS1 CB B-CB C')!
    expect(String(ws.getCell('A1').value)).toContain('PRESENSI KEAKTIFAN CB. RAWIT B')
    expect(ws.pageSetup.orientation).toBe('landscape')
    if (process.env.PPG_CONTOH_CETAK) writeFileSync(join(process.env.PPG_CONTOH_CETAK, 'laporan-bulanan-contoh.xlsx'), xlsx)
  })

  it('raport resmi: kop, identitas, tabel, TOTAL, tanda tangan — satu anak per halaman', async () => {
    const { db, generus } = await desaContoh()
    const data = generus.slice(14, 17).map((id) => dataRaportCetak(db, id, { periode: '2026-S1', tanggalCetak: '2026-12-20' }))
    const html = renderToStaticMarkup(<LembarRaport data={data} logo="logo.svg" />)
    expect((html.match(/rp-halaman/g) ?? []).length).toBe(3)
    for (const t of ['PENGGERAK PEMBINA GENERUS (PPG)', 'DAERAH SORONG', 'LAPORAN HASIL BELAJAR GENERUS', 'Semester 1 (Juli–Desember 2026)', 'TOTAL PENGUASAAN MATERI', 'MT / Mubaligh Kelompok', 'KI Kelompok', 'Orang Tua / Wali', 'Sorong, 20 Desember 2026'])
      expect(html).toContain(t)
    tulisContoh('raport.html', html)
  })
})
