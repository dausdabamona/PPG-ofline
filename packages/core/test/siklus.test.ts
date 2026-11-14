import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  aktifkanProfil,
  ajukanUsulan,
  buatSetor,
  daftarGenerus,
  daftarJamaah,
  daftarPerangkat,
  daftarUsulan,
  ambilGenerus,
  imporSetor,
  pindahKelompok,
  serahTerimaMubaligh,
  setujuiUsulan,
  statusSetorAkhir,
  terbitkanTokenGenerus,
  tokenMilikGenerusSaja,
  tolakUsulan,
  ubahStatus,
} from '../src/index'
import { buatDunia, buatHp, keTanggal, lepasJam, pasangJam, type Dunia } from './bantu'

let d: Dunia
let tokenWali = ''
beforeAll(async () => {
  pasangJam('2026-11-02T01:00:00.000Z')
  d = await buatDunia()
  const hpA = await buatHp('HP Ali')
  const hpW = await buatHp('HP Wali')
  await aktifkanProfil(hpA.db, terbitkanTokenGenerus(d.mubaligh.db, d.mubaligh.profil.id, { kodePerangkat: hpA.kode, role: 'generus', generusIds: [d.g[0]!.id], nama: 'Ali' }))
  tokenWali = terbitkanTokenGenerus(d.mubaligh.db, d.mubaligh.profil.id, { kodePerangkat: hpW.kode, role: 'wali', generusIds: [d.g[0]!.id, d.g[1]!.id], nama: 'Wali' })
  terbitkanTokenGenerus(d.mubaligh.db, d.mubaligh.profil.id, { kodePerangkat: hpW.kode, role: 'wali', generusIds: [d.g[0]!.id], nama: 'Wali Ali saja' })
  imporSetor(d.admin.db, buatSetor(d.mubaligh.db).bytes, d.admin.kunci)
})
afterAll(() => lepasJam())

describe('siklus hidup', () => {
  it('mondok membekukan token yang hanya memegang generus itu; aktif mencairkan', () => {
    const ali = d.g[0]!.id
    expect(tokenMilikGenerusSaja(d.admin.db, ali)).toHaveLength(2)
    ubahStatus(d.admin.db, ali, 'mondok', '2026-11-03')
    const t = daftarPerangkat(d.admin.db, { role: ['generus', 'wali'] })
    expect(t.filter((x) => x.dibekukan).map((x) => x.nama).sort()).toEqual(['Ali', 'Wali Ali saja'])
    expect(t.find((x) => x.nama === 'Wali')!.dibekukan).toBe(false)
    expect(() => ubahStatus(d.admin.db, ali, 'mondok', '2026-11-04')).toThrow(/sudah berstatus/)
    expect(() => ubahStatus(d.admin.db, ali, 'aktif', '2026-11-01')).toThrow(/lebih awal/)
    ubahStatus(d.admin.db, ali, 'aktif', '2026-11-05')
    expect(daftarPerangkat(d.admin.db, { role: ['generus', 'wali'] }).some((x) => x.dibekukan)).toBe(false)
    const riwayat = d.admin.db.kueri<{ status: string; mulai: string; selesai: string | null }>(
      'SELECT status, mulai, selesai FROM riwayat_status WHERE generus_id = ? ORDER BY mulai',
      [ali],
    )
    expect(riwayat).toEqual([
      { status: 'aktif', mulai: '2026-10-01', selesai: '2026-11-03' },
      { status: 'mondok', mulai: '2026-11-03', selesai: '2026-11-05' },
      { status: 'aktif', mulai: '2026-11-05', selesai: null },
    ])
  })

  it('lulus_menikah mencabut token; status tidak dikenal ditolak', () => {
    const budi = d.g[1]!.id
    expect(() => ubahStatus(d.admin.db, budi, 'hilang' as never, '2026-11-06')).toThrow(/tidak dikenal/)
    expect(() => ubahStatus(d.admin.db, 'X', 'mondok', '2026-11-06')).toThrow(/tidak ditemukan/)
    expect(() => ubahStatus(d.admin.db, budi, 'mondok', 'kemarin')).toThrow(/Tanggal/)
    ubahStatus(d.admin.db, budi, 'lulus_menikah', '2026-11-06')
    // token wali (2 anak) tidak dicabut karena masih memegang Ali
    expect(daftarPerangkat(d.admin.db, { role: 'wali' }).find((x) => x.nama === 'Wali')!.dicabut_pada).toBeNull()
    expect(tokenWali).toBeTruthy()
  })

  it('pindah kelompok: validasi & riwayat', () => {
    const citra = d.g[2]!.id
    expect(() => pindahKelompok(d.admin.db, citra, d.k1.id, '2026-11-07')).toThrow(/sudah berada/)
    expect(() => pindahKelompok(d.admin.db, citra, d.desa.id, '2026-11-07')).toThrow(/tujuan/)
    expect(() => pindahKelompok(d.admin.db, 'X', d.k2.id, '2026-11-07')).toThrow(/tidak ditemukan/)
    expect(() => pindahKelompok(d.admin.db, citra, d.k2.id, '2026-13-01')).toThrow(/Tanggal/)
    pindahKelompok(d.admin.db, citra, d.k2.id, '2026-11-07')
    expect(ambilGenerus(d.admin.db, citra)!.kelompok_id).toBe(d.k2.id)
    expect(d.admin.db.nilai('SELECT COUNT(*) FROM riwayat_keanggotaan WHERE generus_id = ?', [citra])).toBe(2)
  })

  it('usulan semua jenis: setujui & tolak', () => {
    d.segarkan()
    const db = d.mubaligh.db
    const ali = d.g[0]!.id
    ajukanUsulan(db, { jenis: 'ubah_generus', kelompokId: d.k1.id, data: { generus_id: ali, perubahan: { wali_nama: 'Pak Ali' } } })
    ajukanUsulan(db, { jenis: 'tambah_jamaah', kelompokId: d.k1.id, data: { nama: 'Bu Ani', jenis_kelamin: 'P' } })
    ajukanUsulan(db, { jenis: 'ubah_status', kelompokId: d.k1.id, data: { generus_id: ali, status: 'mondok', tanggal: '2026-11-08' } })
    ajukanUsulan(db, { jenis: 'pindah_kelompok', kelompokId: d.k1.id, data: { generus_id: ali, kelompok_tujuan_id: d.k2.id, tanggal: '2026-11-09' } })
    ajukanUsulan(db, { jenis: 'tambah_generus', kelompokId: d.k1.id, data: { nama: 'Zaid', jenis_kelamin: 'L', kategori: 'paud' } })
    expect(() => ajukanUsulan(db, { jenis: 'tambah_generus', kelompokId: d.k1.id, data: { nama: '' } })).toThrow(/wajib/)
    expect(() => ajukanUsulan(db, { jenis: 'lain' as never, kelompokId: d.k1.id, data: {} })).toThrow(/tidak dikenal/)
    expect(() => ajukanUsulan(db, { jenis: 'tambah_jamaah', kelompokId: d.k2.id, data: { nama: 'X', jenis_kelamin: 'L' } })).toThrow(/berwenang/)
    keTanggal('2026-11-08')
    const r = imporSetor(d.admin.db, buatSetor(db).bytes, d.admin.kunci)
    expect(r.usulanBaru).toBe(5)
    const u = daftarUsulan(d.admin.db, { status: 'menunggu' })
    const per = (j: string) => u.find((x) => x.jenis === j)!.id
    setujuiUsulan(d.admin.db, per('ubah_generus'))
    setujuiUsulan(d.admin.db, per('tambah_jamaah'))
    setujuiUsulan(d.admin.db, per('ubah_status'))
    setujuiUsulan(d.admin.db, per('pindah_kelompok'))
    expect(() => tolakUsulan(d.admin.db, per('tambah_generus'), ' ')).toThrow(/alasan/)
    tolakUsulan(d.admin.db, per('tambah_generus'), 'Data belum lengkap')
    expect(() => setujuiUsulan(d.admin.db, per('tambah_generus'))).toThrow(/sudah diputuskan/)
    expect(() => tolakUsulan(d.admin.db, per('tambah_generus'), 'x')).toThrow(/sudah diputuskan/)
    expect(() => setujuiUsulan(d.admin.db, 'X')).toThrow(/tidak ditemukan/)
    expect(() => setujuiUsulan(d.mubaligh.db, per('ubah_generus'))).toThrow(/admin/)
    const a = ambilGenerus(d.admin.db, ali)!
    expect(a).toMatchObject({ wali_nama: 'Pak Ali', status: 'mondok', kelompok_id: d.k2.id })
    expect(daftarJamaah(d.admin.db, { kelompokIds: [d.k1.id] }).map((j) => j.nama)).toEqual(['Bu Ani'])
    expect(daftarGenerus(d.admin.db).map((g) => g.nama)).not.toContain('Zaid')
    d.segarkan()
    expect(daftarUsulan(db, { status: 'ditolak' })[0]!.alasan).toBe('Data belum lengkap')
  })

  it('serah terima: wajib Setor Akhir kecuali paksa', () => {
    const st = statusSetorAkhir(d.admin.db, d.mubaligh.id)
    expect(st).toMatchObject({ adaSetorAkhir: false, lengkap: false })
    expect(() => statusSetorAkhir(d.admin.db, 'X')).toThrow(/tidak ditemukan/)
    expect(() => serahTerimaMubaligh(d.admin.db, d.admin.kunci, { kelompokId: d.k2.id, perangkatLamaId: d.mubaligh.id })).toThrow(/tidak ditemukan/)
    const r = serahTerimaMubaligh(d.admin.db, d.admin.kunci, { kelompokId: d.k1.id, perangkatLamaId: d.mubaligh.profil.token_id, paksa: true })
    expect(r.versiKunciBaru).toBe(2)
    expect(r.tokenDicabut).toEqual([d.mubaligh.profil.token_id])
    expect(d.admin.db.nilai('SELECT selesai FROM penugasan_mubaligh WHERE kelompok_id = ?', [d.k1.id])).toBe('2026-11-08')
  })
})
