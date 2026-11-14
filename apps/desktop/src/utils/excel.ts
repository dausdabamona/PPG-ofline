// Ekspor rekap ke Excel (exceljs): tulis buffer, lalu disimpan lewat platform (berkas:simpan).
import type { BarisRekapKemajuan, RekapPresensi } from '@ppg/core'

export interface DataEksporRekap {
  judul: string
  wilayah: string
  presensi: RekapPresensi
  kemajuan: BarisRekapKemajuan[]
  namaKelompok: Map<string, string>
}

const TEAL = 'FF0F766E'

export async function buatExcelRekap(d: DataEksporRekap): Promise<Uint8Array> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'PPG Sorong Admin'
  wb.created = new Date()

  const kepala = (ws: import('exceljs').Worksheet, kolom: { header: string; key: string; width: number }[]) => {
    ws.columns = kolom
    ws.insertRow(1, [`${d.judul} — ${d.wilayah}`])
    ws.insertRow(2, [`Periode ${d.presensi.mulai} s.d. ${d.presensi.selesai}`])
    ws.getRow(1).font = { bold: true, size: 13 }
    const h = ws.getRow(3)
    h.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    h.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } }
    })
    ws.views = [{ state: 'frozen', ySplit: 3 }]
  }

  const k = wb.addWorksheet('Presensi per Kelompok')
  kepala(k, [
    { header: 'Kelompok', key: 'nama', width: 28 },
    { header: 'Hadir', key: 'hadir', width: 10 },
    { header: 'Izin', key: 'izin', width: 10 },
    { header: 'Sakit', key: 'sakit', width: 10 },
    { header: 'Alpa', key: 'alpa', width: 10 },
    { header: 'Total', key: 'total', width: 10 },
    { header: '% Hadir', key: 'persen_hadir', width: 10 },
  ])
  for (const r of d.presensi.perKelompok) k.addRow(r)

  const g = wb.addWorksheet('Presensi per Generus')
  kepala(g, [
    { header: 'Nama', key: 'nama', width: 28 },
    { header: 'Kelompok', key: 'kelompok', width: 24 },
    { header: 'Hadir', key: 'hadir', width: 10 },
    { header: 'Izin', key: 'izin', width: 10 },
    { header: 'Sakit', key: 'sakit', width: 10 },
    { header: 'Alpa', key: 'alpa', width: 10 },
    { header: 'Total', key: 'total', width: 10 },
    { header: '% Hadir', key: 'persen_hadir', width: 10 },
  ])
  for (const r of d.presensi.perGenerus) g.addRow({ ...r, kelompok: d.namaKelompok.get(r.kelompok_id) ?? r.kelompok_id })

  const m = wb.addWorksheet('Kemajuan')
  const bidang = [...new Map(d.kemajuan.flatMap((r) => r.perBidang.map((b) => [b.bidang_id, b.bidang] as const))).entries()]
  kepala(m, [
    { header: 'Nama', key: 'nama', width: 28 },
    { header: 'Kelompok', key: 'kelompok', width: 24 },
    { header: 'Kategori', key: 'kategori', width: 12 },
    ...bidang.map(([id, nama]) => ({ header: `${nama} (disahkan/total)`, key: `b_${id}`, width: 22 })),
    { header: 'Disahkan', key: 'disahkan', width: 10 },
    { header: 'Total materi', key: 'total', width: 12 },
    { header: '% Selesai', key: 'persen', width: 10 },
  ])
  for (const r of d.kemajuan) {
    const baris: Record<string, unknown> = { nama: r.nama, kelompok: d.namaKelompok.get(r.kelompok_id) ?? r.kelompok_id, kategori: r.kategori, disahkan: r.disahkan, total: r.total, persen: r.persen }
    for (const b of r.perBidang) baris[`b_${b.bidang_id}`] = `${b.disahkan}/${b.total}`
    m.addRow(baris)
  }

  const buf = await wb.xlsx.writeBuffer()
  return new Uint8Array(buf as ArrayBuffer)
}
