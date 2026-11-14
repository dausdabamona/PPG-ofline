import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  aktifkanProfil,
  aturPin,
  buatBalasan,
  buatBelajar,
  buatJadwal,
  buatSetor,
  bukaBerkasApaSaja,
  catatKemajuan,
  catatPenilaianAkhlaq,
  daftarMateri,
  daftarPenerimaBalasan,
  daftarPenilaianAkhlaq,
  daftarProfil,
  hapusProfil,
  imporBanyak,
  imporBelajar,
  inisialisasiPerangkat,
  kodePerangkatSaya,
  pilihProfil,
  profilAktif,
  sahkan,
  simakLangsung,
  statusProfil,
  terapkanBalasan,
  terapkanJadwal,
  terapkanMateri,
  terbitkanToken,
  terbitkanTokenGenerus,
  ubahStatus,
  buatMateri,
} from '../src/index'
import { buatDunia, buatHp, keTanggal, lepasJam, pasangJam, type Dunia } from './bantu'

let d: Dunia
beforeAll(async () => {
  pasangJam('2026-11-02T01:00:00.000Z')
  d = await buatDunia()
})
afterAll(() => lepasJam())

describe('perangkat & profil', () => {
  it('inisialisasi idempoten; kode perangkat tetap', async () => {
    const hp = await buatHp('HP A')
    const lagi = await inisialisasiPerangkat(hp.db, 'nama lain')
    expect(lagi.identitas.id).toBe(hp.id)
    expect(kodePerangkatSaya(hp.db)).toBe(hp.kode)
  })

  it('perpanjangan token mengganti profil lama (PIN tetap); PIN atur/hapus; hapus profil', async () => {
    const hp = await buatHp('HP Ali')
    const o = { kodePerangkat: hp.kode, role: 'generus' as const, generusIds: [d.g[0]!.id], nama: 'Ali' }
    const p1 = await aktifkanProfil(hp.db, terbitkanTokenGenerus(d.mubaligh.db, d.mubaligh.profil.id, o), { pin: '1111' })
    await expect(aktifkanProfil(hp.db, terbitkanTokenGenerus(d.mubaligh.db, d.mubaligh.profil.id, o), { pin: '12' })).rejects.toThrow(/4 angka/)
    const p2 = await aktifkanProfil(hp.db, terbitkanTokenGenerus(d.mubaligh.db, d.mubaligh.profil.id, { ...o, berlakuHari: 30 }))
    expect(p2.id).toBe(p1.id)
    expect(p2.token_id).not.toBe(p1.token_id)
    expect(p2.ada_pin).toBe(true)
    expect(daftarProfil(hp.db)).toHaveLength(1)
    expect(profilAktif(hp.db)?.id).toBe(p1.id)
    expect(() => pilihProfil(hp.db, p1.id)).toThrow(/Masukkan PIN/)
    expect(() => pilihProfil(hp.db, 'X')).toThrow(/tidak ditemukan/)
    expect(() => aturPin(hp.db, p1.id, '2222', '0000')).toThrow(/PIN lama salah/)
    aturPin(hp.db, p1.id, '2222', '1111')
    expect(pilihProfil(hp.db, p1.id, '2222').aktif).toBe(true)
    aturPin(hp.db, p1.id, null, '2222')
    expect(pilihProfil(hp.db, p1.id).aktif).toBe(true)
    expect(() => aturPin(hp.db, p1.id, 'abcd')).toThrow(/4 angka/)
    expect(() => aturPin(hp.db, 'X', '1234')).toThrow(/tidak ditemukan/)
    hapusProfil(hp.db, p1.id)
    expect(daftarProfil(hp.db)).toHaveLength(0)
  })

  it('terbitkan token generus: validasi', async () => {
    const hp = await buatHp('HP X')
    const t = (o: Record<string, unknown>) => () =>
      terbitkanTokenGenerus(d.mubaligh.db, d.mubaligh.profil.id, { kodePerangkat: hp.kode, role: 'generus', generusIds: [d.g[0]!.id], nama: 'X', ...o } as never)
    expect(t({ role: 'pengurus' })).toThrow(/generus atau wali/)
    expect(t({ generusIds: [d.g[0]!.id, d.g[1]!.id] })).toThrow(/tepat satu/)
    expect(t({ role: 'wali', generusIds: [] })).toThrow(/minimal satu/)
    expect(t({ generusIds: ['X'] })).toThrow(/tidak ditemukan/)
    expect(t({ nama: ' ' })).toThrow(/Nama/)
    expect(() => terbitkanTokenGenerus(d.mubaligh.db, 'X', { kodePerangkat: hp.kode, role: 'generus', generusIds: [d.g[0]!.id], nama: 'X' })).toThrow(/mubaligh/)
  })

  it('catat kemajuan: validasi tipe materi & profil', async () => {
    const hp = await buatHp('HP Budi')
    const p = await aktifkanProfil(hp.db, terbitkanTokenGenerus(d.mubaligh.db, d.mubaligh.profil.id, { kodePerangkat: hp.kode, role: 'generus', generusIds: [d.g[1]!.id], nama: 'Budi' }))
    expect(() => catatKemajuan(hp.db, p.id, { materiId: 'MAT-ALM-HFS-001', status: 'selesai' })).toThrow(/Buka berkas materi/)
    terapkanMateri(hp.db, buatMateri(d.admin.db, d.admin.kunci).bytes)
    const level = daftarMateri(hp.db).find((m) => m.tipe === 'level')!.id
    const hafalan = 'MAT-ALM-HFS-001'
    expect(() => catatKemajuan(hp.db, p.id, { materiId: hafalan, status: 'beres' as never })).toThrow(/sedang/)
    expect(() => catatKemajuan(hp.db, p.id, { materiId: hafalan, status: 'selesai', nilai: 101 })).toThrow(/0–100/)
    expect(() => catatKemajuan(hp.db, p.id, { materiId: hafalan, status: 'selesai', level: 2 })).toThrow(/tipe level/)
    expect(() => catatKemajuan(hp.db, p.id, { materiId: level, status: 'selesai', level: 6 })).toThrow(/1–5/)
    expect(() => catatKemajuan(hp.db, p.id, { materiId: hafalan, status: 'selesai', tanggal: '2026/11/01' })).toThrow(/Tanggal/)
    expect(() => catatKemajuan(hp.db, 'X', { materiId: hafalan, status: 'selesai' })).toThrow(/profil generus/)
    const k1 = catatKemajuan(hp.db, p.id, { materiId: level, status: 'sedang', level: 2 })
    const k2 = catatKemajuan(hp.db, p.id, { materiId: level, status: 'selesai', level: 3 })
    expect(k2.id).toBe(k1.id) // masih diajukan → diperbarui
    expect(k2.versi).toBe(2)
    // mubaligh menyahkan dengan koreksi nilai level
    imporBelajar(d.mubaligh.db, buatBelajar(hp.db).bytes)
    expect(() => sahkan(d.mubaligh.db, k1.id, { keputusan: 'oke' as never })).toThrow(/Keputusan/)
    expect(() => sahkan(d.mubaligh.db, 'X', { keputusan: 'disahkan' })).toThrow(/tidak ditemukan/)
    expect(() => sahkan(d.mubaligh.db, k1.id, { keputusan: 'disahkan', level: 9 })).toThrow(/1–5/)
    expect(sahkan(d.mubaligh.db, k1.id, { keputusan: 'disahkan', level: 4 }).level).toBe(4)
    // penerima balasan tercantum
    expect(daftarPenerimaBalasan(d.mubaligh.db).map((x) => x.perangkatId)).toContain(hp.id)
    terapkanBalasan(hp.db, buatBalasan(d.mubaligh.db, hp.id).bytes)
    // catat lagi materi yang sudah disahkan → rekaman baru
    expect(catatKemajuan(hp.db, p.id, { materiId: level, status: 'selesai', level: 5 }).id).not.toBe(k1.id)
    expect(() => buatBalasan(d.mubaligh.db, 'TIDAK-ADA')).toThrow(/tidak terdaftar/)
  })

  it('profil kedaluwarsa: boleh baca, tidak boleh setor', async () => {
    const hp = await buatHp('HP Pengurus')
    const p = await aktifkanProfil(hp.db, terbitkanToken(d.admin.db, d.admin.kunci, { kodePerangkat: hp.kode, role: 'pengurus', nama: 'Pak A', wilayahId: d.k1.id, berlakuHari: 1 }))
    expect(statusProfil(p).bolehMencatat).toBe(true)
    keTanggal('2026-11-10')
    expect(statusProfil(p)).toMatchObject({ bolehMencatat: false, kode: 'KEDALUWARSA' })
    expect(() => buatSetor(hp.db)).toThrow(/Masa berlaku/)
    keTanggal('2026-11-02')
    const hp2 = await buatHp('HP Kosong')
    expect(() => buatSetor(hp2.db)).toThrow(/belum diaktifkan/)
    await aktifkanProfil(hp2.db, terbitkanTokenGenerus(d.mubaligh.db, d.mubaligh.profil.id, { kodePerangkat: hp2.kode, role: 'generus', generusIds: [d.g[2]!.id], nama: 'Citra' }))
    expect(() => buatSetor(hp2.db)).toThrow(/pengurus\/mubaligh/)
    expect(() => buatJadwal(hp2.db)).toThrow(/mubaligh/)
    // token kedaluwarsa tidak bisa diaktifkan
    keTanggal('2026-11-10')
    const hp3 = await buatHp('HP Telat')
    const t = terbitkanToken(d.admin.db, d.admin.kunci, { kodePerangkat: hp3.kode, role: 'pengurus', nama: 'Pak B', wilayahId: d.k1.id, berlakuHari: 1 })
    keTanggal('2026-11-12')
    await expect(aktifkanProfil(hp3.db, t)).rejects.toMatchObject({ kode: 'KEDALUWARSA' })
    keTanggal('2026-11-02')
  })

  it('bukaBerkasApaSaja: pesan jelas untuk berkas yang bukan untuk HP ini', async () => {
    const hpG = await buatHp('HP G')
    await aktifkanProfil(hpG.db, terbitkanTokenGenerus(d.mubaligh.db, d.mubaligh.profil.id, { kodePerangkat: hpG.kode, role: 'generus', generusIds: [d.g[0]!.id], nama: 'Ali' }))
    terapkanMateri(hpG.db, buatMateri(d.admin.db, d.admin.kunci).bytes)
    catatKemajuan(hpG.db, daftarProfil(hpG.db)[0]!.id, { materiId: 'MAT-ALM-HFS-002', status: 'selesai' })
    const belajar = buatBelajar(hpG.db)
    expect(() => bukaBerkasApaSaja(hpG.db, belajar.bytes)).toThrow(/HP mubaligh/)
    expect(() => bukaBerkasApaSaja(d.mubaligh.db, buatSetor(d.mubaligh.db).bytes)).toThrow(/untuk admin/)
    expect(() => bukaBerkasApaSaja(d.admin.db, belajar.bytes)).toThrow(/Impor Setoran/)
    expect(bukaBerkasApaSaja(d.mubaligh.db, belajar.bytes).jenis).toBe('BELAJAR')
    const jadwal = buatJadwal(d.mubaligh.db)
    const r = imporBanyak(hpG.db, [jadwal.bytes, jadwal.bytes])
    expect(r.map((x) => x.berhasil)).toEqual([true, false])
    // jadwal kelompok lain tidak terbuka di HP luar kelompok
    const luar = await buatHp('HP Luar')
    await aktifkanProfil(luar.db, terbitkanToken(d.admin.db, d.admin.kunci, { kodePerangkat: luar.kode, role: 'pengurus', nama: 'X', wilayahId: d.k2.id }))
    expect(() => terapkanJadwal(luar.db, jadwal.bytes)).toThrow(/kelompok lain/)
  })

  it('mubaligh tidak menerima BELAJAR generus mondok; simak langsung generus tidak aktif ditolak', async () => {
    const hp = await buatHp('HP Citra')
    const p = await aktifkanProfil(hp.db, terbitkanTokenGenerus(d.mubaligh.db, d.mubaligh.profil.id, { kodePerangkat: hp.kode, role: 'generus', generusIds: [d.g[2]!.id], nama: 'Citra' }))
    terapkanMateri(hp.db, buatMateri(d.admin.db, d.admin.kunci).bytes)
    catatKemajuan(hp.db, p.id, { materiId: 'MAT-ALM-HFS-003', status: 'selesai' })
    const b = buatBelajar(hp.db)
    keTanggal('2026-11-05')
    ubahStatus(d.admin.db, d.g[2]!.id, 'mondok', '2026-11-05')
    d.segarkan()
    const r = imporBelajar(d.mubaligh.db, b.bytes)
    expect(r.hasil.ditolak[0]!.alasan).toMatch(/mondok/)
    expect(() => simakLangsung(d.mubaligh.db, { generusId: d.g[2]!.id, materiId: 'MAT-ALM-HFS-003', status: 'selesai' })).toThrow(/tidak berstatus aktif/)
    expect(() => simakLangsung(d.mubaligh.db, { generusId: 'X', materiId: 'MAT-ALM-HFS-003', status: 'selesai' })).toThrow(/tidak ditemukan/)
  })

  it('penilaian akhlaq: validasi & dedup per aspek', () => {
    const db = d.mubaligh.db
    const g = d.g[0]!.id
    const o = { generusId: g, kelompokId: d.k1.id, periode: '2026-11', aspek: 'kejujuran' as const, nilai: 4 }
    catatPenilaianAkhlaq(db, o)
    catatPenilaianAkhlaq(db, { ...o, nilai: 5 })
    expect(daftarPenilaianAkhlaq(db, { generusIds: [g], periode: '2026-11' })).toEqual([expect.objectContaining({ nilai: 5, versi: 2 })])
    expect(() => catatPenilaianAkhlaq(db, { ...o, aspek: 'x' as never })).toThrow(/Aspek/)
    expect(() => catatPenilaianAkhlaq(db, { ...o, periode: '2026-13' })).toThrow(/Periode/)
    expect(() => catatPenilaianAkhlaq(db, { ...o, nilai: 0 })).toThrow(/1–5/)
    expect(daftarPenilaianAkhlaq(db, { generusIds: [] })).toEqual([])
  })
})
