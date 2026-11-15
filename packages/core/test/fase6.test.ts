// Fase 6 (EXE v3): kueri tambahan untuk layar Rekap — capaian target per kelas / kelompok / desa.
import { describe, expect, it } from 'vitest'
import { absenPertemuan, bukaPertemuan, daftarMateri, rekapCapaian, tambahGenerus, tambahWilayah, tetapkanTarget } from '../src/index'
import { buatAdmin } from './bantu'

describe('rekapCapaian', () => {
  it('menghitung persentase tuntas per kelas, kelompok, desa, dan wilayah', async () => {
    const { db } = await buatAdmin()
    const d = tambahWilayah(db, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
    const ds = tambahWilayah(db, { tingkat: 'desa', nama: 'Klasaman', kode: 'KLS', indukId: d.id })
    const k1 = tambahWilayah(db, { tingkat: 'kelompok', nama: 'Klasaman 1', kode: 'K1', indukId: ds.id })
    const k2 = tambahWilayah(db, { tingkat: 'kelompok', nama: 'Klasaman 2', kode: 'K2', indukId: ds.id })
    const g = (kelompokId: string, nama: string, kategori: 'caberawit' | 'remaja') =>
      tambahGenerus(db, { kelompokId, nama, jenisKelamin: 'L', kategori, mulai: '2026-10-01' })
    const ali = g(k1.id, 'Ali', 'caberawit')
    g(k1.id, 'Budi', 'caberawit')
    g(k1.id, 'Rudi', 'remaja')
    const dodi = g(k2.id, 'Dodi', 'caberawit')
    const m = daftarMateri(db).slice(0, 4).map((x) => x.id)
    tetapkanTarget(db, { periode: '2026-S1', kategoriGenerus: 'caberawit', materiIds: m.slice(0, 2) })
    // remaja tanpa target → total 0

    const p1 = bukaPertemuan(db, { kelompokId: k1.id, tanggal: '2026-11-10', materiIds: m.slice(0, 2) })
    absenPertemuan(db, p1.id, [{ generusId: ali.id, status: 'hadir', tuntas: m.slice(0, 2) }])
    const p2 = bukaPertemuan(db, { kelompokId: k2.id, tanggal: '2026-11-10', materiIds: [m[0]!] })
    absenPertemuan(db, p2.id, [{ generusId: dodi.id, status: 'hadir', tuntas: [m[0]!] }])

    const r = rekapCapaian(db, { wilayahId: d.id, periode: '2026-S1', tanggal: '2026-11-15' })
    expect(r.periode).toBe('2026-S1')
    // pasangan: K1 caberawit 2 generus × 2 materi = 4 (Ali 2 tuntas), K2 1 × 2 = 2 (Dodi 1)
    expect(r.wilayah).toMatchObject({ jumlahGenerus: 4, tuntas: 3, total: 6, persen: 50 })
    expect(r.perDesa).toEqual([expect.objectContaining({ wilayah_id: ds.id, tuntas: 3, total: 6, persen: 50 })])
    const kel1 = r.perKelompok.find((x) => x.wilayah_id === k1.id)!
    expect(kel1).toMatchObject({ jumlahGenerus: 3, tuntas: 2, total: 4, persen: 50 })
    expect(r.perKelompok.find((x) => x.wilayah_id === k2.id)).toMatchObject({ tuntas: 1, total: 2, persen: 50 })
    const kelas = r.perKelas.filter((x) => x.kelompok_id === k1.id)
    expect(kelas.map((x) => [x.kategori, x.jumlahGenerus, x.total, x.persen])).toEqual([
      ['caberawit', 2, 4, 50],
      ['remaja', 1, 0, 0],
    ])
    expect(r.perGenerus.find((x) => x.generus_id === ali.id)).toMatchObject({ tuntas: 2, total: 2, persen: 100, kelompok_nama: 'Klasaman 1' })

    // wilayah kelompok saja
    const rk = rekapCapaian(db, { wilayahId: k2.id, periode: '2026-S1', tanggal: '2026-11-15' })
    expect(rk.perKelompok).toHaveLength(1)
    expect(rk.wilayah).toMatchObject({ tuntas: 1, total: 2, persen: 50 })
    // periode tanpa target
    expect(rekapCapaian(db, { wilayahId: d.id, periode: '2026-S2', tanggal: '2026-11-15' }).wilayah.total).toBe(0)
  })
})
