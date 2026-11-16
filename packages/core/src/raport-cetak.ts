// §19 (Fase 13) / §20 (Fase 14) — cetak Raport (Laporan Hasil Belajar) resmi: data (dipakai tampilan cetak EXE) dan PDF A4
// (dibuat offline di HP & EXE dengan `pdf-sederhana`). Halaman 1 ringkas: kop, identitas, Tri Sukses Generus + Nilai Akhir,
// Karakter Luhur, keaktifan, catatan mubaligh, tanda tangan. Lampiran: Rincian Penguasaan Materi per aspek/subbagian.
import type { Db } from './db'
import { GalatPpg } from './galat'
import { HALAMAN_PER_JUZ, LABEL_JENJANG, raporGenerus, type ItemRapor } from './juknis'
import { ambangPredikat, predikatAngka, type AmbangPredikat } from './tri-sukses'
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
  /** Persen tertulis ("85,7"), "belum dinilai", atau "—" bila belum ditetapkan Kurikulum. */
  persen: string
  belumDitetapkan: boolean
  belumDinilai: boolean
  catatan: string | null
}

/** Satu baris tabel ringkas Tri Sukses Generus (§20.4). */
export interface BarisTriSuksesCetak {
  label: string
  /** 'aspek' = baris utama; 'sub' = Alim / Faqih di bawah Alim-Faqih; 'akhir' = Nilai Akhir. */
  jenis: 'aspek' | 'sub' | 'akhir'
  nilai: string
  predikat: string
}

export interface BarisKarakterCetak {
  nama: string
  predikat: string
  catatan: string
}

/** Kelompok lampiran "Rincian Penguasaan Materi" per subbagian. */
export interface LampiranRaportCetak {
  judul: string
  nilai: string
  predikat: string
  baris: BarisRaportCetak[]
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
  /** §20.4: ringkas Tri Sukses Generus (Alim-Faqih [Alim, Faqih], Akhlaqul Karimah, Mandiri, Nilai Akhir). */
  triSukses: BarisTriSuksesCetak[]
  /** §20.3: Karakter Luhur. */
  karakter: { targetJenjang: string | null; tali: BarisKarakterCetak[]; thobiat: BarisKarakterCetak[]; pendukung: string[] }
  catatanMubaligh: string | null
  /** Lampiran per subbagian (urut §20.1). */
  lampiran: LampiranRaportCetak[]
  /** Semua baris lampiran (nomor berurutan). */
  baris: BarisRaportCetak[]
  /** Nilai Akhir tertulis. */
  total: string
  keaktifan: string
  keteranganRumus: string
  catatanBelumDitetapkan: string | null
  sisaSebelumnya: { jenjang: string; materi: string[] } | null
  tandaTangan: { mubaligh: string; ki: string; wali: string }
  tempatTanggal: string
}

/** "Juz 30", "Juz 21–30" (berurutan), selain itu daftar. */
function teksJuz(juz: number[]): string {
  if (juz.length > 1 && juz.every((j, i) => i === 0 || j === juz[i - 1]! + 1)) return `Juz ${juz[0]}–${juz[juz.length - 1]}`
  return `Juz ${juz.join(', ')}`
}

function teksTarget(i: ItemRapor): string {
  const m = i.materi
  if (m.cara === 'keaktifan') return `${m.target ?? ''} kali/bulan`
  if (m.cara === 'subjektif') return 'maks. 75'
  if (m.cara === 'juz') return teksJuz(m.rincian.juz ?? [])
  if (m.cara === 'kitab') return `${(m.rincian.kitab ?? []).length} kitab`
  return m.target === null ? '' : `${m.target} ${m.satuan ?? ''}`.trim()
}

function teksDikuasai(i: ItemRapor): string {
  const m = i.materi
  if (!i.input || !i.dinilai) return ''
  if (m.cara === 'subjektif') return angka(i.input.nilai ?? null)
  if (m.cara === 'juz' || m.cara === 'kitab') {
    const isi = Object.values(i.input.rincian ?? {}).filter((x): x is number => typeof x === 'number')
    const hlm = isi.reduce((s, x) => s + x, 0)
    return m.cara === 'juz' ? `${hlm} dari ${(m.rincian.juz ?? []).length * HALAMAN_PER_JUZ} hlm` : `${hlm} hlm`
  }
  return angka(i.input.dikuasai ?? null)
}

const teksNilai = (n: number | null) => (n === null ? 'belum dinilai' : angka(n))

/** Data raport siap cetak (satu anak, satu periode) — §20.4: halaman ringkas + lampiran rincian. */
export function dataRaportCetak(db: Db, generusId: string, o: { periode: string; tanggalCetak?: string }): RaportCetak {
  const g = ambilGenerus(db, generusId)
  const r = raporGenerus(db, generusId, { periode: o.periode, tanggal: o.tanggalCetak })
  if (!g || !r) throw new GalatPpg('TIDAK_DITEMUKAN', 'Generus tidak ditemukan.')
  const daerahId = [g.kelompok_id, ...leluhurWilayah(db, g.kelompok_id)].find((id) => ambilWilayah(db, id)?.tingkat === 'daerah')
  const daerah = daerahId ? ambilWilayah(db, daerahId)!.nama : 'Sorong'
  const pred = (n: number | null) => predikatAngka(n, r.ambang) ?? '—'
  const t = r.triSukses
  let no = 0
  const lampiran: LampiranRaportCetak[] = t.bagian
    .filter((b) => b.items.length)
    .map((b) => ({
      judul: b.judul,
      nilai: teksNilai(b.nilai),
      predikat: pred(b.nilai),
      baris: b.items.map((i) => ({
        no: ++no,
        materi: i.materi.nama,
        target: teksTarget(i),
        dikuasai: i.belumDitetapkan ? '' : teksDikuasai(i),
        persen: i.belumDitetapkan ? '—' : i.persen === null ? 'belum dinilai' : angka(i.persen),
        belumDitetapkan: i.belumDitetapkan,
        belumDinilai: !i.belumDitetapkan && i.persen === null,
        catatan: i.dariPeriode ? `nilai dari ${teksSemester(i.dariPeriode)}` : null,
      })),
    }))
  const kp = r.keaktifan?.persen ?? null
  const nBulan = r.keaktifan?.bulan.filter((b) => b.dihitungDalamRata).length ?? 0
  const tgl = o.tanggalCetak ?? tanggalHariIni()
  const k = r.karakter
  const kar = (l: { nama: string; label: string | null; catatan: string | null }[]): BarisKarakterCetak[] =>
    l.map((x) => ({ nama: x.nama, predikat: x.label ?? 'belum dinilai', catatan: x.catatan ?? '' }))
  const pendukung: string[] = []
  if (kp !== null) pendukung.push(`Keaktifan pengajian semester ${angka(kp)} % (rata-rata ${nBulan} bulan) — data pendukung "Mempersungguh hidayah".`)
  if (r.pendukung.mandiriHari > 0) pendukung.push(`Kegiatan mandiri tercatat & disahkan (kode B/TH/QR/HD): ${r.pendukung.mandiriHari} hari.`)
  if (r.pendukung.sholat)
    pendukung.push(`Catatan sholat 5 waktu diisi orang tua di HP: ${r.pendukung.sholat.hari} hari tercatat, rata-rata ${angka(r.pendukung.sholat.rataWaktu)} waktu/hari — keterangan, tidak dinilai.`)
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
    triSukses: [
      { label: '1. Alim-Faqih', jenis: 'aspek', nilai: teksNilai(t.alimFaqih), predikat: pred(t.alimFaqih) },
      { label: 'Alim (mankul & hafalan)', jenis: 'sub', nilai: teksNilai(t.alim), predikat: pred(t.alim) },
      { label: 'Faqih (kefahaman & praktik ibadah)', jenis: 'sub', nilai: teksNilai(t.faqih), predikat: pred(t.faqih) },
      { label: '2. Akhlaqul Karimah', jenis: 'aspek', nilai: teksNilai(t.akhlak), predikat: pred(t.akhlak) },
      { label: '3. Mandiri', jenis: 'aspek', nilai: teksNilai(t.mandiri), predikat: pred(t.mandiri) },
      { label: 'NILAI AKHIR', jenis: 'akhir', nilai: teksNilai(t.nilaiAkhir), predikat: pred(t.nilaiAkhir) },
    ],
    karakter: { targetJenjang: k?.targetJenjang ?? null, tali: kar(k?.tali ?? []), thobiat: kar(k?.thobiat ?? []), pendukung },
    catatanMubaligh: k?.catatanMubaligh ?? null,
    lampiran,
    baris: lampiran.flatMap((l) => l.baris),
    total: r.total === null ? '—' : angka(r.total),
    keaktifan: kp === null ? 'Belum ada data keaktifan semester ini.' : `${angka(kp)} % (rata-rata ${nBulan} bulan)`,
    keteranganRumus:
      t.rumus === 'rata_materi'
        ? 'Nilai Akhir = rata-rata semua butir materi yang dinilai (ditetapkan Kurikulum, K09). Butir "belum dinilai" tidak ikut dihitung.'
        : 'Nilai subbagian = rata-rata butir yang dinilai; Alim, Faqih = rata-rata subbagiannya; Alim-Faqih = rata-rata Alim & Faqih; Nilai Akhir = rata-rata 3 aspek Tri Sukses Generus (bobot sama). Butir "belum dinilai" tidak ikut dihitung; keaktifan tidak masuk nilai.',
    catatanBelumDitetapkan: r.belumDitetapkan.length ? `Materi ${r.belumDitetapkan.join(', ')} belum ditetapkan Kurikulum — tidak ikut dihitung.` : null,
    sisaSebelumnya: r.sisaSebelumnya
      ? { jenjang: LABEL_JENJANG[r.sisaSebelumnya.jenjang] ?? r.sisaSebelumnya.jenjang, materi: r.sisaSebelumnya.items.map((i) => `${i.materi.nama} (${angka(i.persen)} %)`) }
      : null,
    tandaTangan: { mubaligh: namaMubalighKelompok(db, g.kelompok_id) ?? '', ki: '', wali: g.wali_nama ?? '' },
    tempatTanggal: `${daerah}, ${teksTanggalPanjang(tgl)}`,
  }
}

/** Teks predikat angka untuk ambang K17 (keterangan di cetakan). */
export function teksAmbang(a: AmbangPredikat): string {
  return `Predikat: ≥ ${a.sangat_baik} Sangat Baik · ${a.baik}–${a.sangat_baik - 1} Baik · ${a.cukup}–${a.baik - 1} Cukup · < ${a.cukup} Perlu Bimbingan.`
}

// ---------------- PDF ----------------

const TEAL: Warna = [15, 118, 110]
const TEAL_MUDA: Warna = [204, 236, 232]
const IVORY: Warna = [255, 248, 231]
const ABU: Warna = [110, 110, 110]
const GARIS: Warna = [150, 150, 150]

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
  return 124
}

/** Penulis halaman berurutan: halaman baru (dengan kop) bila ruang tidak cukup. */
class Alur {
  h: HalamanPdf
  y: number
  readonly kiri = 48
  readonly lebar: number
  constructor(
    private readonly dok: DokumenPdf,
    private readonly d: RaportCetak,
  ) {
    this.h = dok.tambahHalaman()
    this.lebar = this.h.lebar - 96
    this.y = kop(this.h, d)
  }
  baru(): void {
    this.h.teks(this.h.lebar / 2, this.h.tinggi - 30, 'bersambung ke halaman berikutnya', { ukuran: 8, rata: 'tengah', warna: ABU })
    this.kaki()
    this.h = this.dok.tambahHalaman()
    this.y = kop(this.h, this.d)
  }
  ruang(t: number, bawah = 40): void {
    if (this.y + t > this.h.tinggi - bawah) this.baru()
  }
  kaki(): void {
    this.h.teks(this.h.lebar / 2, this.h.tinggi - 18, 'Dicetak dari aplikasi PPG Sorong', { ukuran: 7, rata: 'tengah', warna: ABU })
  }
  /** Paragraf kecil dibungkus. */
  paragraf(t: string, o: { ukuran?: number; warna?: Warna; huruf?: 'biasa' | 'tebal' } = {}): void {
    const u = o.ukuran ?? 8.5
    for (const s of bungkusTeks(t, u, this.lebar, o.huruf)) {
      this.ruang(u + 4)
      this.y += u + 1 // garis dasar teks
      this.h.teks(this.kiri, this.y, s, { ukuran: u, warna: o.warna ?? ABU, huruf: o.huruf })
      this.y += 1.5
    }
  }
}

/** Tabel sederhana: kolom lebar tetap; baris membungkus teks di kolom `bungkus`. */
function tabel(
  a: Alur,
  kolom: { judul: string; lebar: number; rata?: 'kiri' | 'tengah' }[],
  baris: { sel: string[]; tebal?: boolean; latar?: Warna; abu?: boolean; masuk?: number }[],
  bungkus: number,
): void {
  const xs = kolom.reduce<number[]>((acc, k, i) => [...acc, (acc[i] ?? a.kiri) + k.lebar], [a.kiri])
  const kepala = () => {
    a.h.kotak(a.kiri, a.y, a.lebar, 17, { isi: TEAL, garis: TEAL })
    kolom.forEach((k, i) => a.h.teks(xs[i]! + (k.rata === 'kiri' ? 4 : k.lebar / 2), a.y + 11.5, k.judul, { ukuran: 8.5, huruf: 'tebal', rata: k.rata === 'kiri' ? 'kiri' : 'tengah', warna: [255, 255, 255] }))
    a.y += 17
  }
  a.ruang(17 + 15)
  kepala()
  baris.forEach((b, n) => {
    const huruf = b.tebal ? 'tebal' : 'biasa'
    const isi = b.sel.map((s, i) => (i === bungkus ? bungkusTeks(s, 8.5, kolom[i]!.lebar - 8 - (b.masuk ?? 0), huruf) : [s]))
    const lain = b.sel.map((s, i) => (i !== bungkus && kolom[i]!.rata === 'kiri' ? bungkusTeks(s, 8, kolom[i]!.lebar - 8) : null))
    const nBaris = Math.max(isi[bungkus]!.length, ...lain.map((l) => l?.length ?? 1))
    const t = Math.max(15, nBaris * 10.5 + 4.5)
    if (a.y + t > a.h.tinggi - 40) {
      a.baru()
      kepala()
    }
    if (b.latar) a.h.kotak(a.kiri, a.y, a.lebar, t, { isi: b.latar, garis: null })
    else if (n % 2 === 1) a.h.kotak(a.kiri, a.y, a.lebar, t, { isi: [246, 251, 250], garis: null })
    const warna: Warna = b.abu ? ABU : [0, 0, 0]
    kolom.forEach((k, i) => {
      const daftar = i === bungkus ? isi[i]! : (lain[i] ?? [b.sel[i] ?? ''])
      daftar.forEach((s, j) => {
        const x = k.rata === 'kiri' ? xs[i]! + 4 + (i === bungkus ? (b.masuk ?? 0) : 0) : xs[i]! + k.lebar / 2
        a.h.teks(x, a.y + 11 + j * 10.5, s, { ukuran: i === bungkus ? 8.5 : 8, rata: k.rata === 'kiri' ? 'kiri' : 'tengah', huruf, warna })
      })
    })
    for (const x of xs) a.h.garis(x, a.y, x, a.y + t, { tebal: 0.4, warna: GARIS })
    a.h.garis(a.kiri, a.y + t, a.kiri + a.lebar, a.y + t, { tebal: 0.4, warna: GARIS })
    a.y += t
  })
}

function judulBagian(a: Alur, t: string, kanan?: string): void {
  a.ruang(40)
  a.y += 6
  a.h.teks(a.kiri, a.y + 8, t, { ukuran: 10, huruf: 'tebal', warna: TEAL })
  if (kanan) a.h.teks(a.kiri + a.lebar, a.y + 8, kanan, { ukuran: 8.5, rata: 'kanan', warna: ABU })
  a.y += 14
}

function identitas(a: Alur, d: RaportCetak, judul: string): void {
  a.h.teks(a.h.lebar / 2, a.y, judul, { ukuran: 13, huruf: 'tebal', rata: 'tengah' })
  a.y += 14
  a.h.teks(a.h.lebar / 2, a.y, d.semester, { ukuran: 10, rata: 'tengah' })
  a.y += 18
  const id: [string, string][] = [
    ['Nama', d.nama],
    ['Jenis kelamin', d.jenisKelamin],
    ['Jenjang', d.jenjang],
    ['Kelompok', d.kelompok],
    ['Desa', d.desa],
    ['Semester', d.periode.endsWith('S1') ? 'Semester 1' : 'Semester 2'],
  ]
  for (let i = 0; i < id.length; i += 2) {
    for (let k = 0; k < 2; k++) {
      const p = id[i + k]
      if (!p) continue
      const x = a.kiri + k * (a.lebar / 2)
      a.h.teks(x, a.y, p[0], { ukuran: 9.5, warna: ABU })
      a.h.teks(x + 70, a.y, ':', { ukuran: 9.5 })
      a.h.teks(x + 78, a.y, p[1], { ukuran: 9.5, huruf: k === 0 && i === 0 ? 'tebal' : 'biasa' })
    }
    a.y += 14
  }
}

function halamanRaport(dok: DokumenPdf, d: RaportCetak, ambang: string): void {
  const a = new Alur(dok, d)
  identitas(a, d, 'LAPORAN HASIL BELAJAR GENERUS')
  // --- Tri Sukses Generus ---
  judulBagian(a, 'A. TRI SUKSES GENERUS', 'Alim-Faqih · Akhlaqul Karimah · Mandiri')
  tabel(
    a,
    [
      { judul: 'Aspek', lebar: a.lebar - 90 - 120, rata: 'kiri' },
      { judul: 'Nilai', lebar: 90 },
      { judul: 'Predikat', lebar: 120 },
    ],
    d.triSukses.map((b) => ({
      sel: [b.label, b.nilai, b.predikat],
      tebal: b.jenis !== 'sub',
      masuk: b.jenis === 'sub' ? 14 : 0,
      latar: b.jenis === 'akhir' ? TEAL_MUDA : undefined,
      abu: b.nilai === 'belum dinilai',
    })),
    0,
  )
  a.y += 3
  a.paragraf(`${ambang} Rincian tiap materi pada Lampiran.`, { ukuran: 7.5 })
  // --- Karakter Luhur ---
  judulBagian(a, 'B. KARAKTER LUHUR', d.karakter.targetJenjang ? `Target jenjang: ${d.karakter.targetJenjang}` : undefined)
  const kolom = [
    { judul: '4 Tali Keimanan', lebar: 150, rata: 'kiri' as const },
    { judul: 'Predikat', lebar: 80 },
    { judul: 'Catatan', lebar: a.lebar - 230, rata: 'kiri' as const },
  ]
  tabel(a, kolom, d.karakter.tali.map((b) => ({ sel: [b.nama, b.predikat, b.catatan], abu: b.predikat === 'belum dinilai' })), 0)
  if (d.karakter.pendukung.length) {
    a.y += 3
    a.paragraf(`Data pendukung: ${d.karakter.pendukung.join(' ')}`, { ukuran: 7.5 })
  }
  a.y += 4
  tabel(a, [{ ...kolom[0]!, judul: '6 Thobiat Luhur (praktik sehari-hari)' }, kolom[1]!, kolom[2]!], d.karakter.thobiat.map((b) => ({ sel: [b.nama, b.predikat, b.catatan], abu: b.predikat === 'belum dinilai' })), 0)
  a.y += 3
  a.paragraf('Predikat sikap dinilai mubaligh: Baik · Cukup · Perlu Bimbingan. Tidak dihitung ke Nilai Akhir.', { ukuran: 7.5 })
  // --- keaktifan & catatan ---
  a.ruang(36)
  a.y += 16
  a.h.teks(a.kiri, a.y, 'C. Keaktifan semester:', { ukuran: 9.5, huruf: 'tebal', warna: TEAL })
  a.h.teks(a.kiri + lebarTeks('C. Keaktifan semester: ', 9.5, 'tebal'), a.y, d.keaktifan, { ukuran: 9.5 })
  a.y += 16
  a.h.teks(a.kiri, a.y, 'D. Catatan mubaligh:', { ukuran: 9.5, huruf: 'tebal', warna: TEAL })
  a.y += 2
  a.paragraf(d.catatanMubaligh ?? '—', { ukuran: 9, warna: [0, 0, 0] })
  // --- tanda tangan ---
  a.ruang(120, 30)
  a.y = Math.max(a.y + 10, Math.min(a.h.tinggi - 140, a.y + 30))
  a.h.teks(a.kiri + a.lebar, a.y, d.tempatTanggal, { ukuran: 9.5, rata: 'kanan' })
  a.y += 16
  const ttd: [string, string][] = [
    ['MT / Mubaligh Kelompok', d.tandaTangan.mubaligh],
    ['KI Kelompok', d.tandaTangan.ki],
    ['Orang Tua / Wali', d.tandaTangan.wali],
  ]
  const lk = a.lebar / 3
  ttd.forEach(([j, n], i) => {
    const cx = a.kiri + lk * i + lk / 2
    a.h.teks(cx, a.y, j, { ukuran: 9.5, rata: 'tengah' })
    a.h.garis(cx - lk / 2 + 14, a.y + 62, cx + lk / 2 - 14, a.y + 62, { tebal: 0.6, putus: !n })
    if (n) a.h.teks(cx, a.y + 58, n, { ukuran: 9.5, huruf: 'tebal', rata: 'tengah' })
  })
  a.kaki()
  // --- Lampiran ---
  const l = new Alur(dok, d)
  identitas(l, d, 'LAMPIRAN — RINCIAN PENGUASAAN MATERI')
  const kol = [
    { judul: 'No', lebar: 24 },
    { judul: 'Materi', lebar: l.lebar - 24 - 96 - 88 - 62, rata: 'kiri' as const },
    { judul: 'Target', lebar: 96 },
    { judul: 'Dikuasai', lebar: 88 },
    { judul: '%', lebar: 62 },
  ]
  if (!d.lampiran.length) l.paragraf('Jenjang belum ditetapkan atau daftar materi evaluasi belum ada.')
  for (const g of d.lampiran) {
    judulBagian(l, g.judul, `nilai ${g.nilai}${g.predikat !== '—' ? ` · ${g.predikat}` : ''}`)
    tabel(l, kol, g.baris.map((b) => ({ sel: [String(b.no), b.materi + (b.catatan ? ` (${b.catatan})` : ''), b.target, b.dikuasai, b.persen], abu: b.belumDitetapkan || b.belumDinilai })), 1)
  }
  l.y += 6
  for (const c of [
    d.catatanBelumDitetapkan,
    d.sisaSebelumnya ? `Belum tuntas dari ${d.sisaSebelumnya.jenjang}: ${d.sisaSebelumnya.materi.join(', ')}.` : null,
    d.keteranganRumus,
    'Nilai praktik penguji dibatasi 75% (juknis). "belum dinilai" = belum diuji; "—" = belum ditetapkan Kurikulum.',
  ])
    if (c) l.paragraf(`Catatan: ${c}`)
  l.kaki()
}

/** PDF raport A4 tegak (§20.4): per anak halaman 1 ringkas + lampiran rincian (bersambung bila materi panjang). */
export function raporPdf(db: Db, o: { generusIds: string[]; periode: string; tanggalCetak?: string }): Uint8Array {
  if (!o.generusIds.length) throw new GalatPpg('DATA_KOSONG', 'Pilih minimal satu generus.')
  const dok = new DokumenPdf('Laporan Hasil Belajar Generus')
  const ambang = teksAmbang(ambangPredikat(db)).replace(/≥/g, '>=') // ≥ tidak ada di WinAnsi
  for (const id of o.generusIds) halamanRaport(dok, dataRaportCetak(db, id, o), ambang)
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
