// §19 (Fase 13) — cetak Raport (Laporan Hasil Belajar) resmi: data baris (dipakai tampilan cetak EXE) dan PDF A4 satu anak
// per halaman (dibuat offline di HP & EXE dengan `pdf-sederhana`). Kop PPG Daerah + logo aplikasi, identitas anak, tabel
// materi · target · dikuasai · %, TOTAL, keaktifan semester, catatan materi belum ditetapkan, kolom tanda tangan.
import type { Db } from './db'
import { GalatPpg } from './galat'
import { HALAMAN_PER_JUZ, LABEL_JENJANG, raporGenerus, type ItemRapor, type Rapor } from './juknis'
import { namaMubalighKelompok } from './lembar-laporan'
import { DokumenPdf, bungkusTeks, lebarTeks, type HalamanPdf, type Warna } from './pdf-sederhana'
import { ambilGenerus, daftarGenerus, KATEGORI_GENERUS, kategoriCocok, type Generus } from './repo/generus'
import { kategoriKelas } from './repo/pengajian'
import { ambilRekaman } from './repo/umum'
import { kelompokDalamWilayah } from './repo/wilayah'
import { ambilWilayah, leluhurWilayah } from './repo/wilayah'
import { tanggalHariIni } from './waktu'

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

/** "Semester 1 (Juli–Desember 2026)". */
export function teksSemester(periode: string): string {
  const y = Number(periode.slice(0, 4))
  return periode.endsWith('S1') ? `Semester 1 (Juli–Desember ${y})` : `Semester 2 (Januari–Juni ${y + 1})`
}

export function teksTanggalPanjang(t: string): string {
  return `${Number(t.slice(8, 10))} ${NAMA_BULAN[Number(t.slice(5, 7)) - 1]} ${t.slice(0, 4)}`
}

const angka = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(Math.round(n * 10) / 10).replace('.', ','))

export interface BarisRaportCetak {
  no: number
  materi: string
  target: string
  dikuasai: string
  /** Persen tertulis ("85,7"), "—" bila belum ditetapkan Kurikulum. */
  persen: string
  belumDitetapkan: boolean
  catatan: string | null
}

export interface RaportCetak {
  generus_id: string
  kop: { organisasi: string; daerah: string }
  nama: string
  jenisKelamin: string
  jenjang: string
  kelompok: string
  desa: string
  semester: string
  periode: string
  baris: BarisRaportCetak[]
  total: string
  keaktifan: string
  catatanBelumDitetapkan: string | null
  sisaSebelumnya: { jenjang: string; materi: string[] } | null
  tandaTangan: { mubaligh: string; ki: string; wali: string }
  tempatTanggal: string
}

function teksTarget(i: ItemRapor): string {
  const m = i.materi
  if (m.cara === 'keaktifan') return `${m.target ?? ''} kali/bulan`
  if (m.cara === 'subjektif') return 'maks. 75'
  if (m.cara === 'juz') return `Juz ${(m.rincian.juz ?? []).join(', ')}`
  if (m.cara === 'kitab') return `${(m.rincian.kitab ?? []).length} kitab`
  return m.target === null ? '' : `${m.target} ${m.satuan ?? ''}`.trim()
}

function teksDikuasai(i: ItemRapor, r: Rapor): string {
  const m = i.materi
  if (m.cara === 'keaktifan') {
    const b = r.keaktifan?.bulan.filter((x) => x.dihitungDalamRata) ?? []
    return b.length ? `rata-rata ${b.length} bulan` : '—'
  }
  if (!i.input) return '—'
  if (m.cara === 'subjektif') return angka(i.input.nilai ?? null) || '—'
  if (m.cara === 'juz' || m.cara === 'kitab') {
    const isi = Object.values(i.input.rincian ?? {}).filter((x): x is number => typeof x === 'number')
    const hlm = isi.reduce((s, x) => s + x, 0)
    return m.cara === 'juz' ? `${hlm} dari ${(m.rincian.juz ?? []).length * HALAMAN_PER_JUZ} hlm` : `${hlm} hlm`
  }
  return angka(i.input.dikuasai ?? null) || '—'
}

/** Data raport siap cetak (satu anak, satu periode). */
export function dataRaportCetak(db: Db, generusId: string, o: { periode: string; tanggalCetak?: string }): RaportCetak {
  const g = ambilGenerus(db, generusId)
  const r = raporGenerus(db, generusId, { periode: o.periode })
  if (!g || !r) throw new GalatPpg('TIDAK_DITEMUKAN', 'Generus tidak ditemukan.')
  const daerahId = [g.kelompok_id, ...leluhurWilayah(db, g.kelompok_id)].find((id) => ambilWilayah(db, id)?.tingkat === 'daerah')
  const daerah = daerahId ? ambilWilayah(db, daerahId)!.nama : 'Sorong'
  const baris = r.items.map((i, n) => ({
    no: n + 1,
    materi: i.materi.nama,
    target: teksTarget(i),
    dikuasai: i.belumDitetapkan ? '' : teksDikuasai(i, r),
    persen: i.belumDitetapkan || i.persen === null ? '—' : angka(i.persen),
    belumDitetapkan: i.belumDitetapkan,
    catatan: i.dariPeriode ? `nilai dari ${teksSemester(i.dariPeriode)}` : null,
  }))
  const kp = r.keaktifan?.persen ?? null
  const tgl = o.tanggalCetak ?? tanggalHariIni()
  return {
    generus_id: g.id,
    kop: { organisasi: 'PENGGERAK PEMBINA GENERUS (PPG)', daerah: `DAERAH ${daerah.toUpperCase()}` },
    nama: g.nama,
    jenisKelamin: g.jenis_kelamin === 'P' ? 'Perempuan' : 'Laki-laki',
    jenjang: r.jenjang ? (LABEL_JENJANG[r.jenjang] ?? r.jenjang) : 'Caberawit (jenjang perlu ditetapkan)',
    kelompok: r.generus.kelompok ?? '',
    desa: r.generus.desa ?? '',
    semester: teksSemester(o.periode),
    periode: o.periode,
    baris,
    total: r.total === null ? '—' : angka(r.total),
    keaktifan: kp === null ? 'Belum ada data keaktifan semester ini.' : `${angka(kp)} % (rata-rata ${r.keaktifan!.bulan.filter((b) => b.dihitungDalamRata).length} bulan)`,
    catatanBelumDitetapkan: r.belumDitetapkan.length ? `Materi ${r.belumDitetapkan.join(', ')} belum ditetapkan Kurikulum — tidak ikut dihitung di TOTAL.` : null,
    sisaSebelumnya: r.sisaSebelumnya
      ? { jenjang: LABEL_JENJANG[r.sisaSebelumnya.jenjang] ?? r.sisaSebelumnya.jenjang, materi: r.sisaSebelumnya.items.map((i) => `${i.materi.nama} (${angka(i.persen)} %)`) }
      : null,
    tandaTangan: { mubaligh: namaMubalighKelompok(db, g.kelompok_id) ?? '', ki: '', wali: g.wali_nama ?? '' },
    tempatTanggal: `${daerah}, ${teksTanggalPanjang(tgl)}`,
  }
}

// ---------------- PDF ----------------

const TEAL: Warna = [15, 118, 110]
const TEAL_MUDA: Warna = [204, 236, 232]
const IVORY: Warna = [255, 248, 231]
const ABU: Warna = [110, 110, 110]

/** Logo aplikasi (tunas di atas kitab, versi warna datar dari logo.svg 1024 × 1024). */
export function gambarLogoPdf(h: HalamanPdf, x: number, y: number, ukuran: number): void {
  const s = ukuran / 1024
  const r = 224
  h.lintasan(`M${r} 0 L${1024 - r} 0 C${1024 - r / 2} 0 1024 ${r / 2} 1024 ${r} L1024 ${1024 - r} C1024 ${1024 - r / 2} ${1024 - r / 2} 1024 ${1024 - r} 1024 L${r} 1024 C${r / 2} 1024 0 ${1024 - r / 2} 0 ${1024 - r} L0 ${r} C0 ${r / 2} ${r / 2} 0 ${r} 0 Z`, x, y, s, { isi: [17, 141, 129] })
  h.lintasan('M512 640 C512 560 512 470 512 380', x, y, s, { garis: [244, 201, 93], tebal: 34 * s })
  h.lintasan('M512 470 C440 470 370 420 352 330 C440 322 505 370 512 470 Z', x, y, s, { isi: [250, 216, 128] })
  h.lintasan('M512 410 C580 410 650 362 670 268 C580 262 518 312 512 410 Z', x, y, s, { isi: [250, 216, 128] })
  h.lintasan('M512 218 L528 262 L574 262 L537 290 L551 334 L512 308 L473 334 L487 290 L450 262 L496 262 Z', x, y, s, { isi: IVORY })
  h.lintasan('M512 660 C430 610 320 596 206 612 L206 806 C320 790 430 804 512 852 Z', x, y, s, { isi: IVORY })
  h.lintasan('M512 660 C594 610 704 596 818 612 L818 806 C704 790 594 804 512 852 Z', x, y, s, { isi: [243, 233, 210] })
}

function kop(h: HalamanPdf, d: RaportCetak): number {
  const kiri = 48
  const kanan = h.lebar - 48
  gambarLogoPdf(h, kiri, 36, 58)
  const tengah = (kiri + 70 + kanan) / 2
  h.teks(tengah, 54, d.kop.organisasi, { ukuran: 13, huruf: 'tebal', rata: 'tengah', warna: TEAL })
  h.teks(tengah, 72, d.kop.daerah, { ukuran: 16, huruf: 'tebal', rata: 'tengah', warna: TEAL })
  h.teks(tengah, 88, 'Pembinaan & Evaluasi Hasil Belajar Generus', { ukuran: 9, rata: 'tengah', warna: ABU })
  h.garis(kiri, 102, kanan, 102, { tebal: 2, warna: TEAL })
  h.garis(kiri, 105, kanan, 105, { tebal: 0.6, warna: TEAL })
  return 128
}

function halamanRaport(dok: DokumenPdf, d: RaportCetak): void {
  let h = dok.tambahHalaman()
  const kiri = 48
  const lebar = h.lebar - 96
  let y = kop(h, d)
  h.teks(h.lebar / 2, y, 'LAPORAN HASIL BELAJAR GENERUS', { ukuran: 13, huruf: 'tebal', rata: 'tengah' })
  y += 15
  h.teks(h.lebar / 2, y, d.semester, { ukuran: 10, rata: 'tengah' })
  y += 20
  const id: [string, string][] = [
    ['Nama', d.nama],
    ['Jenis kelamin', d.jenisKelamin],
    ['Jenjang', d.jenjang],
    ['Kelompok', d.kelompok],
    ['Desa', d.desa],
    ['Semester', d.semester],
  ]
  for (let i = 0; i < id.length; i += 2) {
    for (let k = 0; k < 2; k++) {
      const p = id[i + k]
      if (!p) continue
      const x = kiri + k * (lebar / 2)
      h.teks(x, y, p[0], { ukuran: 9.5, warna: ABU })
      h.teks(x + 70, y, ':', { ukuran: 9.5 })
      h.teks(x + 78, y, p[1], { ukuran: 9.5, huruf: k === 0 && i === 0 ? 'tebal' : 'biasa' })
    }
    y += 15
  }
  y += 6
  // tabel: No · Materi · Target · Dikuasai · %
  const kol = [24, lebar - 24 - 92 - 92 - 48, 92, 92, 48]
  const xs = kol.reduce<number[]>((a, w, i) => [...a, (a[i] ?? kiri) + w], [kiri])
  const kepala = (hh: HalamanPdf, yy: number) => {
    hh.kotak(kiri, yy, lebar, 18, { isi: TEAL, garis: TEAL })
    ;['No', 'Materi', 'Target', 'Dikuasai', '%'].forEach((t, i) => hh.teks(xs[i]! + kol[i]! / 2, yy + 12.5, t, { ukuran: 9, huruf: 'tebal', rata: 'tengah', warna: [255, 255, 255] }))
    return yy + 18
  }
  y = kepala(h, y)
  const batasBawah = h.tinggi - 200
  d.baris.forEach((b, n) => {
    const baris = bungkusTeks(b.materi + (b.catatan ? ` (${b.catatan})` : ''), 8.5, kol[1]! - 8)
    const t = Math.max(15, baris.length * 10.5 + 4.5)
    if (y + t > batasBawah && n < d.baris.length) {
      h.teks(h.lebar / 2, h.tinggi - 30, 'bersambung ke halaman berikutnya', { ukuran: 8, rata: 'tengah', warna: ABU })
      h = dok.tambahHalaman()
      y = kepala(h, kop(h, d))
    }
    if (n % 2 === 1) h.kotak(kiri, y, lebar, t, { isi: [246, 251, 250] })
    baris.forEach((s, i) => h.teks(xs[1]! + 4, y + 11 + i * 10.5, s, { ukuran: 8.5, warna: b.belumDitetapkan ? ABU : [0, 0, 0] }))
    h.teks(xs[0]! + kol[0]! / 2, y + 11, String(b.no), { ukuran: 8.5, rata: 'tengah' })
    h.teks(xs[2]! + kol[2]! / 2, y + 11, b.target, { ukuran: 8, rata: 'tengah' })
    h.teks(xs[3]! + kol[3]! / 2, y + 11, b.dikuasai, { ukuran: 8, rata: 'tengah' })
    h.teks(xs[4]! + kol[4]! / 2, y + 11, b.persen, { ukuran: 8.5, rata: 'tengah', huruf: 'tebal' })
    for (const x of xs) h.garis(x, y, x, y + t, { tebal: 0.4, warna: [150, 150, 150] })
    h.garis(kiri, y + t, kiri + lebar, y + t, { tebal: 0.4, warna: [150, 150, 150] })
    y += t
  })
  h.kotak(kiri, y, lebar, 20, { isi: TEAL_MUDA, garis: TEAL })
  h.teks(xs[1]! + 4, y + 13.5, 'TOTAL PENGUASAAN MATERI', { ukuran: 9.5, huruf: 'tebal' })
  h.teks(xs[4]! + kol[4]! / 2, y + 13.5, d.total, { ukuran: 10, huruf: 'tebal', rata: 'tengah' })
  y += 32
  h.teks(kiri, y, 'Keaktifan semester:', { ukuran: 9.5, huruf: 'tebal' })
  h.teks(kiri + lebarTeks('Keaktifan semester: ', 9.5, 'tebal'), y, d.keaktifan, { ukuran: 9.5 })
  y += 14
  for (const c of [d.catatanBelumDitetapkan, d.sisaSebelumnya ? `Belum tuntas dari ${d.sisaSebelumnya.jenjang}: ${d.sisaSebelumnya.materi.join(', ')}.` : null]) {
    if (!c) continue
    for (const s of bungkusTeks(`Catatan: ${c}`, 8.5, lebar)) {
      h.teks(kiri, y, s, { ukuran: 8.5, warna: ABU })
      y += 11
    }
  }
  // tanda tangan
  y = Math.max(y + 18, h.tinggi - 175)
  h.teks(kiri + lebar, y, d.tempatTanggal, { ukuran: 9.5, rata: 'kanan' })
  y += 18
  const ttd: [string, string][] = [
    ['MT / Mubaligh Kelompok', d.tandaTangan.mubaligh],
    ['KI Kelompok', d.tandaTangan.ki],
    ['Orang Tua / Wali', d.tandaTangan.wali],
  ]
  const lk = lebar / 3
  ttd.forEach(([j, n], i) => {
    const cx = kiri + lk * i + lk / 2
    h.teks(cx, y, j, { ukuran: 9.5, rata: 'tengah' })
    h.garis(cx - lk / 2 + 14, y + 66, cx + lk / 2 - 14, y + 66, { tebal: 0.6, putus: !n })
    if (n) h.teks(cx, y + 62, n, { ukuran: 9.5, huruf: 'tebal', rata: 'tengah' })
  })
  h.teks(h.lebar / 2, h.tinggi - 24, 'Dicetak dari aplikasi PPG Sorong', { ukuran: 7, rata: 'tengah', warna: ABU })
}

/** PDF raport A4 tegak, satu anak per halaman (bersambung bila materi sangat panjang). */
export function raporPdf(db: Db, o: { generusIds: string[]; periode: string; tanggalCetak?: string }): Uint8Array {
  if (!o.generusIds.length) throw new GalatPpg('DATA_KOSONG', 'Pilih minimal satu generus.')
  const dok = new DokumenPdf('Laporan Hasil Belajar Generus')
  for (const id of o.generusIds) halamanRaport(dok, dataRaportCetak(db, id, o))
  return dok.bytes()
}

/**
 * Generus aktif untuk "Cetak semua raport" (§19): satu wilayah (kelompok/desa/daerah), opsional satu jenjang atau satu
 * kelas (pengajian rutin berkategori). Urut kelompok, jenjang, nama.
 */
export function generusUntukRaport(db: Db, o: { wilayahId: string; jenjang?: string | null; pengajianId?: string | null }): Generus[] {
  const kelas = o.pengajianId ? kategoriKelas(ambilRekaman<{ kategori_generus: string | null }>(db, 'pengajian', o.pengajianId)) : null
  const urutKel = new Map(kelompokDalamWilayah(db, o.wilayahId).map((id) => [id, ambilWilayah(db, id)?.nama ?? '']))
  return daftarGenerus(db, { kelompokIds: [...urutKel.keys()], status: 'aktif' })
    .filter((g) => !o.jenjang || kategoriCocok(g.kategori, o.jenjang))
    .filter((g) => !kelas || kelas.some((k) => kategoriCocok(g.kategori, k)))
    .sort(
      (a, b) =>
        urutKel.get(a.kelompok_id)!.localeCompare(urutKel.get(b.kelompok_id)!) ||
        KATEGORI_GENERUS.indexOf(a.kategori) - KATEGORI_GENERUS.indexOf(b.kategori) ||
        a.nama.localeCompare(b.nama),
    )
}
