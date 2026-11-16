// §19 (Fase 13, J-C10) — ekspor Excel Laporan Bulanan format lembar dengan tata letak sama seperti cetakan: lembar kerja
// Sampul, satu lembar kerja per halaman cetak (dua jenjang bila muat), dan Pengurus (absensi, musyawaroh, penyaksian).
import type { BlokLembar, FormatLembar, LembarLaporanKelompok } from '@ppg/core'
import { susunHalaman } from '../komponen/lembar-laporan'

type Ws = import('exceljs').Worksheet
type Cell = import('exceljs').Cell

const KUNING = 'FFF7D917'
const KUNING_MUDA = 'FFFFF6C4'
const ABU = 'FFEEF3F6'
const BIRU = 'FFBCD7EE'
const GARIS = 'FFD98C8C'

const SINGKAT: Record<string, string> = {
  paud: 'PAUD',
  caberawit_a: 'CB A',
  caberawit_b: 'CB B',
  caberawit_c: 'CB C',
  praremaja: 'PRA REMAJA',
  remaja: 'REMAJA',
  pranikah: 'PRA NIKAH',
}

const garis = (warna = GARIS) => ({ style: 'thin' as const, color: { argb: warna } })
function bingkai(c: Cell, warna = GARIS): void {
  c.border = { top: garis(warna), left: garis(warna), bottom: garis(warna), right: garis(warna) }
}
function isi(c: Cell, argb: string): void {
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}
const persen = (n: number | null) => (n === null ? '' : Math.round(n) / 100)

function namaUnik(dipakai: Set<string>, nama: string): string {
  let n = nama.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31)
  let i = 2
  while (dipakai.has(n.toLowerCase())) n = `${nama.slice(0, 27)} ${i++}`
  dipakai.add(n.toLowerCase())
  return n
}

/** Tulis satu blok jenjang mulai baris `r`; kembalikan baris sesudahnya. */
function tulisBlok(ws: Ws, l: LembarLaporanKelompok, b: BlokLembar, format: FormatLembar, r: number): number {
  const tanggal = format === 'tanggal'
  const kiri = tanggal ? ['NO', 'NAMA', 'JK', 'UMUR', 'SEKOLAH / KELAS', 'ORANG TUA', "IQRO' / QUR'AN"] : b.kecil ? ['NO', 'NAMA', 'UMUR', "IQRO'"] : ['NO', 'NAMA', 'UMUR']
  const nSlot = tanggal ? b.hari : b.jumlahSlot
  const nKol = kiri.length + nSlot + 2
  // pita judul
  ws.mergeCells(r, 1, r, nKol)
  const pita = ws.getCell(r, 1)
  pita.value = `${b.judul}${b.sub ? ` ${b.sub}` : ''}        # KLP : ${l.kelompok.nama.toUpperCase()}   BULAN : ${l.teksBulan}`
  pita.font = { bold: true, size: 12, color: { argb: 'FF3B3B3B' } }
  isi(pita, KUNING)
  ws.getRow(r).height = 20
  // kepala 2 baris
  const r1 = r + 1
  const r2 = r + 2
  kiri.forEach((t, i) => {
    ws.mergeCells(r1, i + 1, r2, i + 1)
    const c = ws.getCell(r1, i + 1)
    c.value = t
  })
  ws.mergeCells(r1, kiri.length + 1, r1, kiri.length + nSlot)
  ws.getCell(r1, kiri.length + 1).value = tanggal
    ? `TARGET KEAKTIFAN ( kode kegiatan ditulis pada tanggal pelaksanaan; kolom arsir = libur ) · target ${b.target} kali/bulan`
    : `TARGET KEAKTIFAN ( isi sesuai kode kegiatan yg dilaksanakan > lihat penjelasan ) · target ${b.target} kali/bulan`
  for (let i = 0; i < nSlot; i++) ws.getCell(r2, kiri.length + 1 + i).value = i + 1
  for (const [j, t] of [
    [nKol - 1, '% Keaktifan'],
    [nKol, '% Peng. Materi'],
  ] as const) {
    ws.mergeCells(r1, j, r2, j)
    ws.getCell(r1, j).value = t
  }
  for (const rr of [r1, r2]) {
    for (let c = 1; c <= nKol; c++) {
      const sel = ws.getCell(rr, c)
      isi(sel, tanggal && rr === r2 && c > kiri.length && c <= kiri.length + nSlot && b.libur[c - kiri.length - 1] ? 'FFF3C4CF' : ABU)
      sel.font = { bold: true, size: 8 }
      sel.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      bingkai(sel, 'FF5A5A5A')
    }
  }
  ws.getRow(r1).height = 26
  // isi
  let rr = r2 + 1
  const nBaris = Math.max(b.baris.length, 10)
  for (let n = 0; n < nBaris; n++) {
    const x = b.baris[n]
    const nilai: (string | number)[] = x
      ? tanggal
        ? [x.no, x.nama, x.jk, x.umur ?? '', [x.sekolah, x.kelasSekolah ? `Kelas ${x.kelasSekolah}` : ''].filter(Boolean).join(' '), x.orangTua ?? '', x.iqro]
        : b.kecil
          ? [x.no, x.nama, x.umur ?? '', x.iqroKode === 'alquran' ? 'AQ' : (x.iqroKode ?? '')]
          : [x.no, x.nama, x.umur ?? '']
      : [n + 1]
    const slot = x ? (tanggal ? x.perTanggal : Array.from({ length: nSlot }, (_, i) => x.urutan[i] ?? '')) : []
    const baris = ws.getRow(rr)
    for (let c = 1; c <= nKol; c++) {
      const sel = baris.getCell(c)
      if (c <= kiri.length) sel.value = nilai[c - 1] ?? ''
      else if (c <= kiri.length + nSlot) sel.value = slot[c - kiri.length - 1] ?? ''
      else if (x) {
        sel.value = persen(c === nKol - 1 ? x.persenKeaktifan : x.persenMateri)
        sel.numFmt = '0%'
      }
      sel.font = { size: c > kiri.length && c <= kiri.length + nSlot ? 7 : 8, bold: c > kiri.length && c <= kiri.length + nSlot, color: { argb: c > kiri.length ? 'FF1D3F8F' : 'FF111111' } }
      sel.alignment = { horizontal: c === 2 || (tanggal && (c === 5 || c === 6)) ? 'left' : 'center', vertical: 'middle', shrinkToFit: true }
      if (tanggal && c > kiri.length && c <= kiri.length + nSlot && b.libur[c - kiri.length - 1]) sel.fill = { type: 'pattern', pattern: 'lightUp', fgColor: { argb: 'FFE7A0B0' } }
      bingkai(sel)
    }
    baris.height = 15
    rr++
  }
  // kaki: IQRO' 1–6 & Total
  const kaki = ws.getRow(rr)
  ws.mergeCells(rr, 1, rr, nKol - 2)
  kaki.getCell(1).value = b.ringkasIqro
    ? `${b.ringkasIqro.map((n, i) => `IQRO' ${i + 1} : ${n || '…'} ORG`).join('     ')}          Total`
    : 'Total'
  kaki.getCell(1).alignment = { horizontal: b.ringkasIqro ? 'left' : 'right' }
  kaki.getCell(nKol - 1).value = persen(b.total.keaktifan)
  kaki.getCell(nKol).value = persen(b.total.materi)
  for (let c = 1; c <= nKol; c++) {
    const sel = kaki.getCell(c)
    isi(sel, KUNING_MUDA)
    sel.font = { bold: true, size: 8, color: { argb: c >= nKol - 1 ? 'FF1D3F8F' : 'FFB5651D' } }
    if (c >= nKol - 1) {
      sel.numFmt = '0%'
      sel.alignment = { horizontal: 'center' }
    }
    bingkai(sel, 'FF5A5A5A')
  }
  return rr + 2
}

function lebarKolom(ws: Ws, format: FormatLembar, blok: BlokLembar[]): void {
  const b = blok[0]!
  const tanggal = format === 'tanggal'
  const kiri = tanggal ? [4, 22, 3.5, 5, 15, 15, 9] : b.kecil ? [4, 30, 5, 5] : [4, 30, 5]
  const nSlot = Math.max(...blok.map((x) => (tanggal ? x.hari : x.jumlahSlot)))
  kiri.forEach((w, i) => (ws.getColumn(i + 1).width = w))
  for (let i = 0; i < nSlot; i++) ws.getColumn(kiri.length + 1 + i).width = tanggal ? 3.6 : 4.4
  ws.getColumn(kiri.length + nSlot + 1).width = 9
  ws.getColumn(kiri.length + nSlot + 2).width = 9
}

function tulisSampul(ws: Ws, l: LembarLaporanKelompok): void {
  ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1, horizontalCentered: true, verticalCentered: true }
  ws.getColumn(1).width = 110
  const teks = ['LAPORAN GENERUS KELOMPOK', l.kelompok.nama.toUpperCase(), `BULAN ${l.teksBulan}`, `Ust. ${l.mubaligh ?? '.......................................'}`]
  teks.forEach((t, i) => {
    const r = ws.getRow(6 + i)
    r.getCell(1).value = t
    r.getCell(1).font = { size: 28 }
    r.getCell(1).alignment = { horizontal: 'center' }
    r.height = 40
  })
}

function tulisPengurus(ws: Ws, l: LembarLaporanKelompok): void {
  ws.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1, horizontalCentered: true }
  const lebar = [4.5, 14, 12, 10]
  for (let g = 0; g < 3; g++) lebar.forEach((w, i) => (ws.getColumn(g * 4 + i + 1).width = w))
  const judul = (r: number, t: string, o: { size?: number; argb?: string; fill?: string } = {}) => {
    ws.mergeCells(r, 1, r, 12)
    const c = ws.getCell(r, 1)
    c.value = t
    c.font = { bold: true, size: o.size ?? 10, color: { argb: o.argb ?? 'FF111111' } }
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    if (o.fill) isi(c, o.fill)
  }
  judul(1, 'ABSENSI PENGURUS & MUBALIGH - MUBALIGHOT PEDULI', { size: 12 })
  judul(2, '(semua Pengurus & Mubaligh - Mubalighot yang mendampingi Kegiatan Belajar Mengajar Generus)', { size: 9 })
  judul(3, `KELOMPOK : ${l.kelompok.nama.toUpperCase()}   #   BULAN : ${l.teksBulan}`, { fill: KUNING, argb: 'FFC0392B' })
  const akhir = l.blok[0]?.hari ?? 31
  const awal = [1, 11, 21]
  for (let g = 0; g < 3; g++) {
    ;['TGL', 'NAMA', 'DAPUKAN', 'PARAF'].forEach((t, i) => {
      const c = ws.getCell(5, g * 4 + i + 1)
      c.value = t
      c.font = { bold: true, size: 8 }
      c.alignment = { horizontal: 'center' }
      isi(c, BIRU)
      bingkai(c, 'FF7A9CC6')
    })
    const sampai = g === 2 ? akhir : awal[g]! + 9
    for (let t = awal[g]!; t <= sampai; t++) {
      const r = 6 + (t - awal[g]!)
      const n = l.nunggoni.filter((x) => x.hari === t)
      const v = [t, n.map((x) => x.nama).join('\n'), n.map((x) => x.dapukan).join('\n'), '']
      v.forEach((x, i) => {
        const c = ws.getCell(r, g * 4 + i + 1)
        c.value = x
        c.font = { size: 8 }
        c.alignment = { horizontal: i === 0 ? 'center' : 'left', vertical: 'middle', wrapText: true }
        bingkai(c, 'FF7A9CC6')
      })
      ws.getRow(r).height = 26
    }
  }
  let r = 6 + 11 + 1
  const ya = (v: boolean | null) => (v === true ? 'Ya' : v === false ? 'Belum' : '……')
  judul(r++, 'LAPORAN HASIL MUSYAWAROH', { fill: KUNING, argb: 'FFC0392B' })
  for (const [t, m] of [
    ['Musyawaroh Muda - Mudi Terlaksana', l.musyawarah.mudaMudi],
    ['Musyawaroh 5 Unsur Terlaksana', l.musyawarah.limaUnsur],
  ] as const) {
    ws.mergeCells(r, 1, r, 12)
    ws.getCell(r, 1).value = `${t} : ${ya(m.terlaksana)}     Hasil Musyawaroh : ${m.hasil || '-'}`
    ws.getCell(r, 1).alignment = { wrapText: true, vertical: 'top' }
    ws.getRow(r).height = 36
    r++
  }
  r++
  judul(r++, 'PENYAKSIAN')
  judul(r++, l.catatanPenyaksian, { size: 7 })
  ws.getRow(r - 1).height = 22
  for (const baris of [l.penyaksian.kelompok, l.penyaksian.desa]) {
    const per = 12 / baris.length
    baris.forEach((x, i) => {
      const a = Math.round(i * per) + 1
      const z = Math.round((i + 1) * per)
      ws.mergeCells(r, a, r, z)
      ws.mergeCells(r + 1, a, r + 1, z)
      const atas = ws.getCell(r, a)
      atas.value = x.jabatan
      atas.alignment = { horizontal: 'center', vertical: 'top' }
      atas.font = { size: 8 }
      const bawah = ws.getCell(r + 1, a)
      bawah.value = x.nama.toUpperCase()
      bawah.alignment = { horizontal: 'center', vertical: 'bottom' }
      bawah.font = { size: 8, bold: true }
      for (let c = a; c <= z; c++) {
        ws.getCell(r, c).border = { top: garis('FF555555'), left: c === a ? garis('FF555555') : undefined, right: c === z ? garis('FF555555') : undefined }
        ws.getCell(r + 1, c).border = { bottom: garis('FF555555'), left: c === a ? garis('FF555555') : undefined, right: c === z ? garis('FF555555') : undefined }
      }
    })
    ws.getRow(r).height = 34
    ws.getRow(r + 1).height = 34
    r += 2
  }
}

/** Buku Excel laporan bulanan format lembar (satu atau banyak kelompok). */
export async function buatExcelLembar(data: LembarLaporanKelompok[], format: FormatLembar): Promise<Uint8Array> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'PPG Sorong Admin'
  wb.created = new Date()
  const dipakai = new Set<string>()
  for (const l of data) {
    const awalan = l.kelompok.kode || l.kelompok.nama.slice(0, 8)
    tulisSampul(wb.addWorksheet(namaUnik(dipakai, `${awalan} Sampul`)), l)
    for (const hal of susunHalaman(l.blok)) {
      const ws = wb.addWorksheet(namaUnik(dipakai, `${awalan} ${hal.map((b) => SINGKAT[b.jenjang]).join('-')}`))
      ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1, horizontalCentered: true, margins: { left: 0.25, right: 0.25, top: 0.3, bottom: 0.3, header: 0, footer: 0 } }
      lebarKolom(ws, format, hal)
      let r = 1
      for (const b of hal) r = tulisBlok(ws, l, b, format, r)
    }
    tulisPengurus(wb.addWorksheet(namaUnik(dipakai, `${awalan} Pengurus`)), l)
  }
  return new Uint8Array(await wb.xlsx.writeBuffer())
}
