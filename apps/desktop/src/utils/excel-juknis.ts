// §16 — ekspor Excel juknis: Rekap Penguasaan Materi (format lembar juknis), keaktifan bulanan, laporan bulanan.
import type { BarisRekapLaporanBulanan, RekapKeaktifanBulan, RekapPenguasaan } from '@ppg/core'

const TEAL = 'FF0F766E'

async function bukuBaru() {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'PPG Sorong Admin'
  wb.created = new Date()
  return wb
}

function gayaKepala(row: import('exceljs').Row): void {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  row.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } }
  })
}

const angka = (n: number | null) => (n === null ? '' : n)

/** §20.5: kolom ringkas per aspek Tri Sukses Generus. */
const KOLOM_ASPEK = ['Alim-Faqih', 'Akhlaqul Karimah', 'Mandiri', 'Nilai Akhir']
export const legendaRekap = (rumus: RekapPenguasaan['rumus']) =>
  `Nilai dalam persen. bd = belum dinilai (tidak ikut rata-rata); kosong = belum ditetapkan Kurikulum. Nilai Akhir = ${
    rumus === 'rata_materi' ? 'rata-rata semua butir materi yang dinilai' : 'rata-rata 3 aspek Tri Sukses Generus (Alim-Faqih, Akhlaqul Karimah, Mandiri)'
  } (Kurikulum K09); keaktifan tidak masuk nilai.`

/** Rekap Penguasaan Materi satu jenjang: lembar per kelompok seperti lembar juknis + ringkasan per kelompok/desa. */
export async function buatExcelPenguasaan(r: RekapPenguasaan, judul: string): Promise<Uint8Array> {
  const wb = await bukuBaru()
  const tulisTabel = (nama: string, baris: RekapPenguasaan['baris']) => {
    const ws = wb.addWorksheet(nama.slice(0, 31))
    ws.addRow([judul])
    ws.getRow(1).font = { bold: true, size: 13 }
    ws.addRow([`Kelompok/Desa: ${nama}`])
    const h = ws.addRow(['No', 'Nama', ...r.kolom.map((m, i) => `${i + 1}. ${m.nama}`), ...KOLOM_ASPEK])
    gayaKepala(h)
    h.height = 90
    // §20.5: sel belum dinilai = "bd"; kolom ringkas per aspek Tri Sukses + Nilai Akhir
    baris.forEach((b, i) => ws.addRow([i + 1, b.nama, ...b.nilai.map((v, k) => (b.belumDinilai[k] ? 'bd' : angka(v))), angka(b.alimFaqih), angka(b.akhlak), angka(b.mandiri), angka(b.total)]))
    ws.addRow([])
    ws.addRow([legendaRekap(r.rumus)]).font = { italic: true }
    if (r.materiBelumDitetapkan.length) {
      ws.addRow([`Catatan: materi ${r.materiBelumDitetapkan.join(', ')} belum ditetapkan Kurikulum — kolom kosong dan tidak ikut dihitung.`]).font = { italic: true }
    }
    ws.getColumn(1).width = 5
    ws.getColumn(2).width = 28
    for (let i = 0; i < r.kolom.length + KOLOM_ASPEK.length; i++) ws.getColumn(3 + i).width = 11
    ws.views = [{ state: 'frozen', ySplit: 3, xSplit: 2 }]
  }
  const perKel = new Map<string, RekapPenguasaan['baris']>()
  for (const b of r.baris) perKel.set(b.kelompok_id, [...(perKel.get(b.kelompok_id) ?? []), b])
  for (const [, l] of perKel) tulisTabel(l[0]!.kelompok, l)
  const ring = wb.addWorksheet('Ringkasan')
  ring.addRow([`${judul} — ringkasan`]).font = { bold: true, size: 13 }
  gayaKepala(ring.addRow(['Tingkat', 'Nama', 'Jumlah generus', ...r.kolom.map((m) => m.nama), ...KOLOM_ASPEK.map((k) => `Rata-rata ${k}`)]))
  const aspek = (x: { rataAspek: RekapPenguasaan['rataAspek']; rataTotal: number | null }) => [angka(x.rataAspek.alimFaqih), angka(x.rataAspek.akhlak), angka(x.rataAspek.mandiri), angka(x.rataTotal)]
  for (const d of r.perDesa) ring.addRow(['Desa', d.nama, d.jumlah, ...d.rata.map(angka), ...aspek(d)])
  for (const k of r.perKelompok) ring.addRow(['Kelompok', k.nama, k.jumlah, ...k.rata.map(angka), ...aspek(k)])
  ring.addRow(['Wilayah', 'Seluruh', r.baris.length, ...r.rata.map(angka), ...aspek(r)]).font = { bold: true }
  ring.addRow([legendaRekap(r.rumus)]).font = { italic: true }
  if (r.materiBelumDitetapkan.length) ring.addRow([`Catatan: materi ${r.materiBelumDitetapkan.join(', ')} belum ditetapkan Kurikulum — tidak ikut dihitung.`]).font = { italic: true }
  ring.getColumn(2).width = 24
  return new Uint8Array(await wb.xlsx.writeBuffer())
}

export async function buatExcelKeaktifan(r: RekapKeaktifanBulan, judul: string, labelJenjang: (k: string) => string): Promise<Uint8Array> {
  const wb = await bukuBaru()
  const ws = wb.addWorksheet('Keaktifan')
  ws.addRow([judul]).font = { bold: true, size: 13 }
  gayaKepala(ws.addRow(['No', 'Nama', 'Kelompok', 'Jenjang', 'Jumlah', 'Target', '%', 'Menunggu disahkan']))
  r.baris.forEach((b, i) => ws.addRow([i + 1, b.nama, b.kelompok, labelJenjang(b.jenjang), b.jumlah, b.target, b.persen, b.menunggu]))
  ws.getColumn(2).width = 28
  ws.getColumn(3).width = 22
  ws.getColumn(4).width = 18
  const k = wb.addWorksheet('Per Kelompok')
  gayaKepala(k.addRow(['Kelompok', 'Generus', 'Rata-rata %', 'Mencapai target']))
  for (const x of r.perKelompok) k.addRow([x.nama, x.jumlah, x.rataPersen ?? '', x.tercapai])
  k.getColumn(1).width = 24
  return new Uint8Array(await wb.xlsx.writeBuffer())
}

const ya = (b: boolean | null) => (b === true ? 'Terlaksana' : b === false ? 'Tidak' : '—')

export async function buatExcelLaporanBulanan(rows: BarisRekapLaporanBulanan[], judul: string): Promise<Uint8Array> {
  const wb = await bukuBaru()
  const ws = wb.addWorksheet('Laporan Bulanan')
  ws.addRow([judul]).font = { bold: true, size: 13 }
  gayaKepala(ws.addRow(['Desa', 'Kelompok', 'Laporan', 'Mus. 5 Unsur', 'Hasil Mus. 5 Unsur', 'Muda/i Kelompok', 'Muda/i Desa', 'Muda/i Daerah', 'NUNGGONI', 'Catatan']))
  for (const r of rows) {
    ws.addRow([r.desa ?? '', r.kelompok, r.ada ? 'Ada' : 'Belum', ya(r.mus5), r.isi.mus5?.catatan ?? '', ya(r.musMuda.kelompok), ya(r.musMuda.desa), ya(r.musMuda.daerah), r.jumlahNunggoni, r.isi.catatan ?? ''])
  }
  const n = wb.addWorksheet('NUNGGONI')
  gayaKepala(n.addRow(['Desa', 'Kelompok', 'Nama', 'Unsur', 'Tanggal', 'Kelas', 'Temuan/Saran']))
  for (const r of rows) for (const x of r.isi.nunggoni) n.addRow([r.desa ?? '', r.kelompok, x.nama, x.unsur, x.tanggal ?? '', x.kelas ?? '', x.temuan ?? ''])
  for (const w of [ws, n]) for (let i = 1; i <= 10; i++) w.getColumn(i).width = 18
  return new Uint8Array(await wb.xlsx.writeBuffer())
}
