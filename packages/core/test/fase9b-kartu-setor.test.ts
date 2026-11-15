// Fase 9b — perbaikan kartu setor: hitungan "sudah dikirim, menunggu konfirmasi" vs "belum dikirim",
// dan aturan terlambat (tanpa data → bukan terlambat; belum pernah setor → kuning sampai tenggat pertama setelah aktivasi).
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  absenPertemuan,
  aktifkanExe,
  aktifkanProfil,
  aturJadwalSetor,
  bukaDb,
  bukaPertemuan,
  buatMateri,
  buatPaket,
  buatSetor,
  imporSetor,
  inisialisasiExe,
  pengingatSetor,
  ringkasanBerandaExe,
  siapkanKripto,
  statusSetor,
  tambahGenerus,
  tambahWilayah,
  terapkanMateri,
  terapkanPaket,
  terbitkanToken,
  terbitkanTokenBawah,
} from '../src/index'
import { buatAdmin, buatHp, keTanggal, lepasJam, pasangJam } from './bantu'

await siapkanKripto()

async function dunia() {
  const daerah = await buatAdmin()
  const D = tambahWilayah(daerah.db, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
  const desaA = tambahWilayah(daerah.db, { tingkat: 'desa', nama: 'Desa A', kode: 'DA', indukId: D.id })
  const A1 = tambahWilayah(daerah.db, { tingkat: 'kelompok', nama: 'A1', kode: 'A1', indukId: desaA.id })
  const A2 = tambahWilayah(daerah.db, { tingkat: 'kelompok', nama: 'A2', kode: 'A2', indukId: desaA.id })
  const ali = tambahGenerus(daerah.db, { kelompokId: A1.id, nama: 'Ali', jenisKelamin: 'L', kategori: 'caberawit', mulai: '2026-10-01' })
  // kelompok → desa tiap Sabtu 21.00 (16 Nov 2026 = Senin → tenggat pertama Sabtu 21 Nov)
  aturJadwalSetor(daerah.db, { tingkatAsal: 'kelompok', pola: 'pekanan', hari: 6, jam: '21:00' })
  const db = await bukaDb()
  const { kodePerangkat, kunci } = await inisialisasiExe(db, { sandi: 'sandi-exe-123', label: 'EXE' })
  await aktifkanExe(db, kunci, terbitkanToken(daerah.db, daerah.kunci, { kodePerangkat, role: 'admin', nama: 'Admin', wilayahId: desaA.id }))
  const exeA = { db, kunci }
  terapkanPaket(exeA.db, buatPaket(daerah.db, desaA.id, daerah.kunci).bytes)
  terapkanMateri(exeA.db, buatMateri(daerah.db, daerah.kunci).bytes)
  const hp = await buatHp('HP Mubaligh')
  await aktifkanProfil(hp.db, terbitkanTokenBawah(exeA.db, exeA.kunci, { kodePerangkat: hp.kode, role: 'mubaligh', nama: 'Ust. A', wilayahId: A1.id }))
  terapkanPaket(hp.db, buatPaket(exeA.db, A1.id, exeA.kunci).bytes)
  return { daerah, desaA, A1, A2, ali, exeA, hp }
}

function absen(w: Awaited<ReturnType<typeof dunia>>, tanggal: string) {
  const p = bukaPertemuan(w.hp.db, { kelompokId: w.A1.id, tanggal })
  absenPertemuan(w.hp.db, p.id, [{ generusId: w.ali.id, status: 'hadir' }])
}

beforeEach(() => pasangJam('2026-11-16T01:00:00.000Z'))
afterAll(() => lepasJam())

describe('Fase 9b — pengingatSetor (kartu "Setor ke Desa")', () => {
  it('tanpa data: bukan terlambat, keadaan "kosong", tanpa tombol — juga setelah tenggat pertama lewat', async () => {
    const w = await dunia()
    expect(pengingatSetor(w.hp.db)).toMatchObject({ belumDisetor: 0, belumDikirim: 0, menungguKonfirmasi: 0, terlambat: false, keadaan: 'kosong', tampilkanTombol: false })
    keTanggal('2026-12-10')
    expect(pengingatSetor(w.hp.db)).toMatchObject({ terlambat: false, keadaan: 'kosong', tampilkanTombol: false })
  })

  it('belum pernah setor + ada data: kuning (belumAdaSetoran) sampai tenggat pertama setelah aktivasi, lalu terlambat', async () => {
    const w = await dunia()
    absen(w, '2026-11-16')
    const a = pengingatSetor(w.hp.db)!
    expect(a.belumDikirim).toBeGreaterThan(0)
    expect(a).toMatchObject({ terlambat: false, belumAdaSetoran: true, keadaan: 'belum_dikirim', tampilkanTombol: true })
    keTanggal('2026-11-22') // tenggat pertama (Sabtu 21 Nov 21.00) lewat
    expect(pengingatSetor(w.hp.db)).toMatchObject({ terlambat: true, belumAdaSetoran: true, tampilkanTombol: true })
  })

  it('tepat setelah Setor: data dihitung "sudah dikirim, menunggu konfirmasi", bukan "belum dikirim"; konfirmasi desa mengosongkan', async () => {
    const w = await dunia()
    absen(w, '2026-11-16')
    const n = pengingatSetor(w.hp.db)!.belumDikirim
    const berkas = buatSetor(w.hp.db)
    expect(pengingatSetor(w.hp.db)).toMatchObject({
      belumDisetor: n,
      belumDikirim: 0,
      menungguKonfirmasi: n,
      keadaan: 'menunggu_konfirmasi',
      terlambat: false,
      belumAdaSetoran: false,
      tampilkanTombol: false,
    })
    // data baru setelah setor = belum dikirim lagi (yang lama tetap menunggu konfirmasi)
    absen(w, '2026-11-17')
    const b = pengingatSetor(w.hp.db)!
    expect(b.menungguKonfirmasi).toBe(n)
    expect(b.belumDikirim).toBeGreaterThan(0)
    expect(b.keadaan).toBe('belum_dikirim')
    // desa menerima + paket desa membawa konfirmasi → yang sudah dikirim tidak menunggu lagi
    imporSetor(w.exeA.db, berkas.bytes, w.exeA.kunci)
    terapkanPaket(w.hp.db, buatPaket(w.exeA.db, w.A1.id, w.exeA.kunci).bytes)
    const c = pengingatSetor(w.hp.db)!
    expect(c.menungguKonfirmasi).toBe(0)
    expect(c.belumDikirim).toBe(b.belumDikirim)
    buatSetor(w.hp.db)
    imporSetor(w.exeA.db, buatSetor(w.hp.db).bytes, w.exeA.kunci)
    terapkanPaket(w.hp.db, buatPaket(w.exeA.db, w.A1.id, w.exeA.kunci).bytes)
    expect(pengingatSetor(w.hp.db)).toMatchObject({ belumDisetor: 0, belumDikirim: 0, menungguKonfirmasi: 0, keadaan: 'semua_disetor' })
  })
})

describe('Fase 9b — statusSetor (beranda EXE)', () => {
  it('HP/kelompok yang belum pernah setor: "belum ada setoran" (bukan terlambat) sampai tenggat pertama setelah aktivasi', async () => {
    const w = await dunia()
    const hpKel = statusSetor(w.exeA.db, w.A1.id)
    expect(hpKel).toHaveLength(1)
    expect(hpKel[0]).toMatchObject({ terakhirSetor: null, belumAdaSetoran: true, terlambat: false })
    expect(statusSetor(w.exeA.db, w.desaA.id).map((x) => [x.nama, x.belumAdaSetoran, x.terlambat])).toEqual([
      ['A1', true, false],
      ['A2', true, false],
    ])
    expect(ringkasanBerandaExe(w.exeA.db).statusSetorBawahan.some((x) => x.terlambat)).toBe(false)
    keTanggal('2026-11-22')
    expect(statusSetor(w.exeA.db, w.A1.id)[0]).toMatchObject({ belumAdaSetoran: true, terlambat: true })
    expect(statusSetor(w.exeA.db, w.desaA.id).every((x) => x.terlambat)).toBe(true)
  })

  it('setelah setor pertama: belumAdaSetoran false', async () => {
    const w = await dunia()
    absen(w, '2026-11-16')
    imporSetor(w.exeA.db, buatSetor(w.hp.db).bytes, w.exeA.kunci)
    expect(statusSetor(w.exeA.db, w.A1.id)[0]).toMatchObject({ belumAdaSetoran: false, terlambat: false })
  })
})
