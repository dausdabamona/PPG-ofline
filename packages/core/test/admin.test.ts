import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  aktifkanProfil,
  bekukanPerangkat,
  bukaDb,
  bukaKunciAdmin,
  buatPaket,
  cabutPerangkat,
  cairkanPerangkat,
  daftarKunciSetor,
  daftarPerangkat,
  eksporCadanganKunci,
  gantiKunciKelompok,
  gantiSandiAdmin,
  imporBanyak,
  imporCadanganKunci,
  imporGenerusCsv,
  imporSetor,
  inisialisasiAdmin,
  inisialisasiPerangkat,
  kelompokBerpenerima,
  keUtf8,
  kunciUmumKelompok,
  terapkanPaket,
  terbitkanToken,
  uraiToken,
} from '../src/index'
import { buatDunia, buatHp, lepasJam, pasangJam, SANDI, type Dunia } from './bantu'

let d: Dunia
beforeAll(async () => {
  pasangJam('2026-11-02T01:00:00.000Z')
  d = await buatDunia()
})
afterAll(() => lepasJam())

describe('admin', () => {
  it('inisialisasi: validasi & tidak bisa dua kali', async () => {
    const db = await bukaDb()
    await expect(inisialisasiAdmin(db, { sandi: 'pendek', namaOrganisasi: 'X' })).rejects.toThrow(/minimal 8/)
    await expect(inisialisasiAdmin(db, { sandi: SANDI, namaOrganisasi: ' ' })).rejects.toThrow(/Nama organisasi/)
    await expect(inisialisasiAdmin(d.admin.db, { sandi: SANDI, namaOrganisasi: 'X' })).rejects.toMatchObject({ kode: 'SUDAH_DIINISIALISASI' })
    const hp = await bukaDb()
    await inisialisasiPerangkat(hp, 'HP')
    await expect(inisialisasiAdmin(hp, { sandi: SANDI, namaOrganisasi: 'X' })).rejects.toMatchObject({ kode: 'BUKAN_DB_ADMIN' })
    await expect(bukaKunciAdmin(hp, SANDI)).rejects.toMatchObject({ kode: 'BUKAN_DB_ADMIN' })
    await expect(inisialisasiPerangkat(d.admin.db, 'HP')).rejects.toMatchObject({ kode: 'DB_ADMIN' })
  })

  it('buka kunci: sandi salah ditolak; ganti sandi', async () => {
    await expect(bukaKunciAdmin(d.admin.db, 'salah-sandi')).rejects.toMatchObject({ kode: 'SANDI_SALAH' })
    const k = await bukaKunciAdmin(d.admin.db, SANDI)
    expect(k.orgId).toBe(d.admin.kunci.orgId)
    await gantiSandiAdmin(d.admin.db, SANDI, 'sandi-baru-456')
    await expect(bukaKunciAdmin(d.admin.db, SANDI)).rejects.toMatchObject({ kode: 'SANDI_SALAH' })
    await expect(gantiSandiAdmin(d.admin.db, 'sandi-baru-456', 'x')).rejects.toMatchObject({ kode: 'SANDI_LEMAH' })
    await gantiSandiAdmin(d.admin.db, 'sandi-baru-456', SANDI)
  })

  it('cadangan kunci: pulihkan ke database baru dan tetap bisa membuat paket yang dibuka HP', async () => {
    await expect(eksporCadanganKunci(d.admin.db, d.admin.kunci, 'pendek')).rejects.toMatchObject({ kode: 'SANDI_LEMAH' })
    gantiKunciKelompok(d.admin.db, d.admin.kunci, d.k1.id)
    const c = await eksporCadanganKunci(d.admin.db, d.admin.kunci, 'cadangan-rahasia')
    expect(c.nama).toMatch(/^PPG_KUNCI_ADMIN_\d{8}\.ppgkey$/)
    const baru = await bukaDb()
    await expect(imporCadanganKunci(baru, c.bytes, 'salah-sandi')).rejects.toMatchObject({ kode: 'SANDI_SALAH' })
    await expect(imporCadanganKunci(baru, keUtf8('bukan'), 'x')).rejects.toMatchObject({ kode: 'BERKAS_TIDAK_SAH' })
    const k = await imporCadanganKunci(baru, c.bytes, 'cadangan-rahasia', 'sandi-pulih-1')
    expect(k.orgId).toBe(d.admin.kunci.orgId)
    expect(daftarKunciSetor(baru, k, d.k1.id, true)).toEqual(daftarKunciSetor(d.admin.db, d.admin.kunci, d.k1.id, true))
    expect(kunciUmumKelompok(baru, k, d.k1.id)).toBe(kunciUmumKelompok(d.admin.db, d.admin.kunci, d.k1.id))
    await bukaKunciAdmin(baru, 'sandi-pulih-1')
    const lain = await buatDunia()
    await expect(imporCadanganKunci(lain.admin.db, c.bytes, 'cadangan-rahasia')).rejects.toMatchObject({ kode: 'ORG_BERBEDA' })
    const hp = await bukaDb()
    await inisialisasiPerangkat(hp, 'HP')
    await expect(imporCadanganKunci(hp, c.bytes, 'cadangan-rahasia')).rejects.toMatchObject({ kode: 'BUKAN_DB_ADMIN' })
  })

  it('terbitkan token: validasi role, tingkat, K12, hak, masa berlaku', async () => {
    const hp = await buatHp('HP Baru')
    const o = { kodePerangkat: hp.kode, nama: 'Ust. Ahmad', wilayahId: d.k2.id }
    expect(() => terbitkanToken(d.admin.db, d.admin.kunci, { ...o, role: 'generus' as never })).toThrow(/mubaligh/)
    expect(() => terbitkanToken(d.admin.db, d.admin.kunci, { ...o, role: 'mubaligh', wilayahId: d.desa.id })).toThrow(/satu kelompok/)
    expect(() => terbitkanToken(d.admin.db, d.admin.kunci, { ...o, role: 'pengurus', tingkat: 'desa' })).toThrow(/Tingkat/)
    expect(() => terbitkanToken(d.admin.db, d.admin.kunci, { ...o, role: 'pengurus', wilayahId: 'X' })).toThrow(/Wilayah/)
    expect(() => terbitkanToken(d.admin.db, d.admin.kunci, { ...o, role: 'pengurus', nama: '' })).toThrow(/Nama/)
    expect(() => terbitkanToken(d.admin.db, d.admin.kunci, { ...o, role: 'pengurus', hak: ['terbit_generus'] })).toThrow(/pengurus/)
    expect(() => terbitkanToken(d.admin.db, d.admin.kunci, { ...o, role: 'pengurus', hak: ['apa' as never] })).toThrow(/Hak/)
    expect(() => terbitkanToken(d.admin.db, d.admin.kunci, { ...o, role: 'pengurus', berlakuHari: 0 })).toThrow(/Masa berlaku/)
    expect(() => terbitkanToken(d.admin.db, d.admin.kunci, { ...o, role: 'pengurus', kodePerangkat: 'x' })).toThrow(/Kode Perangkat/)
    expect(() => terbitkanToken(d.mubaligh.db, d.admin.kunci, { ...o, role: 'pengurus' })).toThrow(/admin/)
    // K12: HP mubaligh K1 tidak bisa jadi mubaligh K2
    expect(() => terbitkanToken(d.admin.db, d.admin.kunci, { ...o, role: 'mubaligh', kodePerangkat: d.mubaligh.kode })).toThrow(/K12/)
    const t = terbitkanToken(d.admin.db, d.admin.kunci, { ...o, role: 'pengurus', berlakuHari: 30 })
    const p = uraiToken(t).payload
    expect(p.tingkat).toBe('kelompok')
    expect(new Date(p.berlaku_sampai).getTime() - new Date(p.terbit).getTime()).toBe(30 * 86_400_000)
    const pd = uraiToken(terbitkanToken(d.admin.db, d.admin.kunci, { ...o, role: 'pengurus', wilayahId: d.desa.id })).payload
    expect(pd.rahasia).toBeUndefined() // pengurus desa tidak memegang kunci kelompok
    expect(kelompokBerpenerima(d.admin.db, d.desa.id)).toEqual(expect.arrayContaining([d.k1.id, d.k2.id]))
  })

  it('cabut/bekukan/cairkan idempoten; perangkat dicabut bukan penerima paket', async () => {
    const hp = await buatHp('HP Pengurus K2')
    const t = terbitkanToken(d.admin.db, d.admin.kunci, { kodePerangkat: hp.kode, role: 'pengurus', nama: 'Bu Sari', wilayahId: d.k2.id })
    await aktifkanProfil(hp.db, t)
    const id = uraiToken(t).payload.token_id
    bekukanPerangkat(d.admin.db, id)
    bekukanPerangkat(d.admin.db, id)
    cairkanPerangkat(d.admin.db, id)
    cairkanPerangkat(d.admin.db, id)
    expect(d.admin.db.nilai('SELECT COUNT(*) FROM pencabutan WHERE token_id = ?', [id])).toBe(2)
    const p1 = buatPaket(d.admin.db, d.k2.id, d.admin.kunci)
    expect(Object.keys(p1.header.kunci_penerima!)).toContain(hp.id)
    cabutPerangkat(d.admin.db, id)
    cabutPerangkat(d.admin.db, id)
    expect(() => cabutPerangkat(d.admin.db, 'X')).toThrow(/tidak ditemukan/)
    expect(daftarPerangkat(d.admin.db, { aktifSaja: true }).map((x) => x.id)).not.toContain(id)
    // paket lama (masih untuk HP ini) bisa diterapkan; paket baru tidak lagi
    terapkanPaket(hp.db, p1.bytes)
    const p2 = buatPaket(d.admin.db, d.k1.id, d.admin.kunci)
    expect(Object.keys(p2.header.kunci_penerima!)).not.toContain(hp.id)
  })

  it('impor CSV: kolom wajib & validasi baris', () => {
    expect(() => imporGenerusCsv(d.admin.db, 'nama,kelompok_kode\nA,K1')).toThrow(/jenis_kelamin/)
    const h = imporGenerusCsv(
      d.admin.db,
      [
        'nama;jenis_kelamin;tanggal_lahir;kategori;kelompok_kode;mulai',
        'A;X;;caberawit;K1;',
        'B;L;31/02/2015;caberawit;K1;',
        'C;Perempuan;;dewasa;K1;',
        'D;L;;;K1;',
        'E;Laki-laki;2015-01-01;;K1;kemarin',
        'F;P;;remaja;KLS;',
        'G;lk;01-02-2010;;K2;2026-01-01',
      ].join('\n'),
    )
    expect(h.berhasil).toBe(1)
    expect(h.gagal.map((g) => g.baris)).toEqual([2, 3, 4, 5, 6, 7])
    expect(h.gagal[3]!.alasan).toMatch(/Kategori wajib/)
    expect(() => imporGenerusCsv(d.mubaligh.db, 'a')).toThrow(/admin/)
  })

  it('imporBanyak di admin: hanya SETOR, galat per berkas', () => {
    const paket = buatPaket(d.admin.db, d.k1.id, d.admin.kunci)
    const r = imporBanyak(d.admin.db, [paket.bytes, { nama: 'rusak.ppg', bytes: new Uint8Array(3) }], d.admin.kunci)
    expect(r.map((x) => x.galat?.kode)).toEqual(['JENIS_BERKAS_SALAH', 'BERKAS_TIDAK_SAH'])
    expect(imporBanyak(d.admin.db, [paket.bytes])[0]!.galat?.kode).toBe('KUNCI_ADMIN_DIBUTUHKAN')
    expect(() => imporSetor(d.mubaligh.db, paket.bytes, d.admin.kunci)).toThrow(/admin/)
  })
})
