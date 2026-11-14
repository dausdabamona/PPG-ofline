import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  catatPresensi,
  daftarMateri,
  laporanPekanan,
  normalNoHp,
  rekapKemajuan,
  rekapPresensi,
  simakLangsung,
  tautanWa,
  teksWaLaporanPekanan,
  ubahMateri,
  ubahStatus,
  type LaporanPekanan,
} from '../src/index'
import { buatDunia, keTanggal, lepasJam, pasangJam, type Dunia } from './bantu'

let d: Dunia
beforeAll(async () => {
  pasangJam('2026-11-02T01:00:00.000Z') // Senin
  d = await buatDunia()
})
afterAll(() => lepasJam())

describe('laporan', () => {
  it('laporan pekanan: pekan Ahad–Sabtu, presensi, disahkan, target berikutnya, catatan', () => {
    const db = d.mubaligh.db
    const [ali] = d.g
    const m = daftarMateri(db)
    catatPresensi(db, { kelompokId: d.k1.id, generusId: ali!.id, tanggal: '2026-11-01', status: 'hadir' })
    catatPresensi(db, { kelompokId: d.k1.id, generusId: ali!.id, tanggal: '2026-11-04', status: 'sakit' })
    catatPresensi(db, { kelompokId: d.k1.id, generusId: ali!.id, tanggal: '2026-11-08', status: 'hadir' }) // pekan berikutnya
    simakLangsung(db, { generusId: ali!.id, materiId: m[0]!.id, status: 'selesai', nilai: 95, catatan: 'Mantap' })
    simakLangsung(db, { generusId: ali!.id, materiId: m[1]!.id, status: 'sedang' })
    const l = laporanPekanan(db, ali!.id, '2026-11-05') as Extract<LaporanPekanan, { mondok: false }>
    expect(l.pekan).toEqual({ mulai: '2026-11-01', selesai: '2026-11-07' })
    expect(l.presensi).toEqual({ hadir: 1, izin: 0, sakit: 1, alpa: 0, total: 2 })
    expect(l.materiDisahkan.map((x) => x.materi_id)).toEqual([m[0]!.id, m[1]!.id])
    // target: materi[0] selesai → bukan target; materi[1] baru 'sedang' → masih target
    expect(l.targetBerikutnya.map((t) => t.materi_id)).toEqual([m[1]!.id, m[2]!.id, m[3]!.id])
    expect(l.catatanMubaligh).toEqual([`${m[0]!.nama}: Mantap`])
    const teks = teksWaLaporanPekanan(l)
    expect(teks).toMatch(/^Assalamu'alaikum/)
    expect(teks).toContain('hadir 1, izin 0, sakit 1, alpa 0 (dari 2 pertemuan)')
    expect(teks).toContain('nilai 95')
    expect(teks).toContain('1 Nov 2026 – 7 Nov 2026')
    expect(teks).not.toContain('Budi')
    expect(laporanPekanan(db, 'TIDAK-ADA', '2026-11-05')).toBeNull()
    const kosong = laporanPekanan(db, d.g[1]!.id, '2026-11-05') as Extract<LaporanPekanan, { mondok: false }>
    expect(teksWaLaporanPekanan(kosong)).toContain('belum ada catatan')
  })

  it('materi khusus kategori tidak menjadi target kategori lain', () => {
    const m = daftarMateri(d.admin.db)
    ubahMateri(d.admin.db, m[0]!.id, { kategoriGenerus: ['remaja'] })
    d.segarkan()
    const l = laporanPekanan(d.admin.db, d.g[2]!.id, '2026-11-05') as Extract<LaporanPekanan, { mondok: false }>
    expect(l.targetBerikutnya.map((t) => t.materi_id)).not.toContain(m[0]!.id)
    ubahMateri(d.admin.db, m[0]!.id, { kategoriGenerus: null })
  })

  it('mondok → laporan { mondok: true } dan presensi tidak dihitung', async () => {
    keTanggal('2026-11-10')
    ubahStatus(d.admin.db, d.g[1]!.id, 'mondok', '2026-11-10')
    catatPresensi(d.admin.db, { kelompokId: d.k1.id, generusId: d.g[1]!.id, tanggal: '2026-11-11', status: 'alpa' })
    catatPresensi(d.admin.db, { kelompokId: d.k1.id, generusId: d.g[1]!.id, tanggal: '2026-11-09', status: 'hadir' })
    const l = laporanPekanan(d.admin.db, d.g[1]!.id, '2026-11-12')!
    expect(l.mondok).toBe(true)
    expect(teksWaLaporanPekanan(l)).toContain('sedang mondok')
    const r = rekapPresensi(d.admin.db, { wilayahId: d.desa.id, mulai: '2026-11-01', selesai: '2026-11-30' })
    expect(r.perGenerus.find((x) => x.generus_id === d.g[1]!.id)).toMatchObject({ hadir: 1, alpa: 0, total: 1, persen_hadir: 100 })
  })

  it('rekap kemajuan per bidang', () => {
    const r = rekapKemajuan(d.mubaligh.db, { wilayahId: d.k1.id })
    const ali = r.find((x) => x.generus_id === d.g[0]!.id)!
    expect(ali.disahkan).toBe(1)
    expect(ali.total).toBe(420)
    expect(ali.perBidang.find((b) => b.bidang === 'Alim')!.disahkan).toBe(1)
    expect(ali.persen).toBeCloseTo(0.2, 1)
  })

  it('nomor WA', () => {
    expect(normalNoHp('0812-3456-7890')).toBe('6281234567890')
    expect(normalNoHp('+62 812 3456 7890')).toBe('6281234567890')
    expect(normalNoHp('812 3456 7890')).toBe('6281234567890')
    expect(normalNoHp('6281234567890')).toBe('6281234567890')
    expect(normalNoHp('123')).toBe('')
    expect(tautanWa('08123456789', 'a b&c')).toBe('https://wa.me/628123456789?text=a%20b%26c')
  })
})
