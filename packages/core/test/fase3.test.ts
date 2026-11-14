// Tambahan kecil core untuk aplikasi HP (Fase 3).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ajukanUsulan, ambilGenerus, buatSetor, daftarGenerus, daftarUsulan, daftarWilayah, imporSetor, setujuiUsulan } from '../src/index'
import { buatDunia, lepasJam, pasangJam, type Dunia } from './bantu'

describe('Fase 3 — PAKET membawa seluruh pohon wilayah', () => {
  let d: Dunia
  beforeAll(async () => {
    pasangJam('2026-11-02T01:00:00.000Z')
    d = await buatDunia()
  })
  afterAll(() => lepasJam())

  it('HP mubaligh mengenal kelompok lain sehingga bisa mengusulkan pindah kelompok', () => {
    const kelompok = daftarWilayah(d.mubaligh.db, { tingkat: 'kelompok' }).map((w) => w.id)
    expect(kelompok).toContain(d.k1.id)
    expect(kelompok).toContain(d.k2.id)
    // data generus kelompok lain tetap tidak ikut
    expect(daftarGenerus(d.mubaligh.db, { kelompokId: d.k2.id })).toHaveLength(0)

    const g = d.g[0]!
    ajukanUsulan(d.mubaligh.db, { jenis: 'pindah_kelompok', kelompokId: d.k1.id, data: { generus_id: g.id, kelompok_tujuan_id: d.k2.id, tanggal: '2026-11-02' } })
    const r = imporSetor(d.admin.db, buatSetor(d.mubaligh.db).bytes, d.admin.kunci)
    expect(r.usulanBaru).toBe(1)
    const u = daftarUsulan(d.admin.db, { status: 'menunggu' })[0]!
    setujuiUsulan(d.admin.db, u.id)
    expect(ambilGenerus(d.admin.db, g.id)?.kelompok_id).toBe(d.k2.id)
  })
})
