// Fase 8 — alur nyata lintas aplikasi v3, berbasis BYTE BERKAS (setiap berkas ditulis ke disk lalu dibaca ulang seperti
// dikirim lewat WA): daerah EXE → desa EXE → HP mubaligh → satu HP keluarga (pengurus + wali + 2 anak) → absen dengan
// materi & tuntas → setor HP → desa → daerah; kurikulum EXE → daerah → desa (materi ikut paket otomatis) → HP.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  absenPertemuan,
  aktifkanExe,
  aktifkanProfil,
  aturJadwalSetor,
  aturPeriodeAktif,
  bukaBerkasApaSaja,
  bukaDb,
  bukaKunciExe,
  bukaPertemuan,
  buatBalasan,
  buatBelajar,
  buatKurikulum,
  buatMateri,
  buatPaket,
  buatSetor,
  catatKemajuan,
  daftarDiajukan,
  daftarKemajuan,
  daftarMateri,
  daftarPresensi,
  daftarProfil,
  imporBanyak,
  inisialisasiExe,
  laporanPekanan,
  lembarAbsenPertemuan,
  materiPerluDituntaskan,
  pilihProfil,
  profilAktif,
  sahkan,
  saranMateriPertemuan,
  siapkanKripto,
  simpanDb,
  statusSetor,
  tambahGenerus,
  tambahPengajian,
  tambahWilayah,
  terbitkanToken,
  terbitkanTokenBawah,
  terbitkanTokenGenerus,
  tetapkanTarget,
  uraiToken,
  type Db,
  type Generus,
  type KunciAdmin,
  type KunciExe,
  type Wilayah,
} from '../src/index'
import { buatAdmin, buatHp, lepasJam, maju, pasangJam } from './bantu'

await siapkanKripto()

const folder = mkdtempSync(join(tmpdir(), 'ppg-alur-nyata-'))
let nomor = 0
/** "Kirim lewat WA": tulis berkas ke disk lalu baca ulang byte-nya. */
function kirim(b: { nama: string; bytes: Uint8Array }): Uint8Array {
  const jalur = join(folder, `${String(++nomor).padStart(2, '0')}-${b.nama}`)
  writeFileSync(jalur, b.bytes)
  return new Uint8Array(readFileSync(jalur))
}
/** Kode/token teks dikirim lewat WA (spasi & baris baru ikut tertempel). */
const tempel = (teks: string) => `  ${teks.slice(0, 40)}\n${teks.slice(40)}  `

const SANDI_EXE = 'sandi-laptop-desa'

let daerah: { db: Db; kunci: KunciAdmin }
let desa: { db: Db; kunci: KunciExe }
let kur: { db: Db; kunci: KunciExe }
let hpM: { db: Db; kode: string; id: string }
let hpF: { db: Db; kode: string; id: string }
let D: Wilayah, desaK: Wilayah, K1: Wilayah
let ali: Generus, ani: Generus, budi: Generus
let kelas: string
let target: string[]
let profilM: string

beforeAll(() => pasangJam('2026-11-16T01:00:00.000Z'))
afterAll(() => {
  lepasJam()
  rmSync(folder, { recursive: true, force: true })
})

describe('Alur nyata v3 lintas aplikasi (berkas sungguhan)', () => {
  it('1. Admin Daerah: wilayah, generus, kelas caberawit, jadwal setor', async () => {
    daerah = await buatAdmin()
    D = tambahWilayah(daerah.db, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
    desaK = tambahWilayah(daerah.db, { tingkat: 'desa', nama: 'Klasaman', kode: 'KLS', indukId: D.id })
    K1 = tambahWilayah(daerah.db, { tingkat: 'kelompok', nama: 'Klasaman 1', kode: 'K1', indukId: desaK.id })
    const g = (nama: string) => tambahGenerus(daerah.db, { kelompokId: K1.id, nama, jenisKelamin: 'L', kategori: 'caberawit', mulai: '2026-10-01' })
    ali = g('Ali')
    ani = g('Ani')
    budi = g('Budi')
    kelas = tambahPengajian(daerah.db, { wilayahId: K1.id, nama: 'Kelas Caberawit', hari: 1, jam: '19:00', kategoriGenerus: ['caberawit'] }).id
    aturJadwalSetor(daerah.db, { tingkatAsal: 'kelompok', pola: 'pekanan', hari: 0 })
    aturJadwalSetor(daerah.db, { tingkatAsal: 'desa', pola: 'bulanan', tanggal: 5 })
  })

  it('2. Petugas Kurikulum: aktivasi EXE → buka materi daerah → target S1 → berkas Kurikulum → daerah', async () => {
    const db = await bukaDb()
    const { kodePerangkat, kunci } = await inisialisasiExe(db, { sandi: SANDI_EXE, label: 'Laptop Kurikulum' })
    const kode = terbitkanToken(daerah.db, daerah.kunci, { kodePerangkat: tempel(kodePerangkat), role: 'kurikulum', nama: 'Tim Kurikulum', wilayahId: D.id })
    await aktifkanExe(db, kunci, tempel(kode))
    kur = { db, kunci }
    bukaBerkasApaSaja(kur.db, kirim(buatMateri(daerah.db, daerah.kunci)))
    target = daftarMateri(kur.db, { kategoriGenerus: 'caberawit' }).slice(0, 3).map((m) => m.id)
    expect(target).toHaveLength(3)
    aturPeriodeAktif(kur.db, '2026-S1')
    tetapkanTarget(kur.db, { periode: '2026-S1', kategoriGenerus: 'caberawit', materiIds: target })
    const hasil = imporBanyak(daerah.db, [kirim(buatKurikulum(kur.db))], daerah.kunci)
    expect(hasil[0]!.galat).toBeFalsy()
  })

  it('3. Admin Desa: aktivasi EXE dengan kode → buka paket daerah (materi + target ikut) → laptop ditutup & dibuka', async () => {
    const db = await bukaDb()
    const { kodePerangkat, kunci } = await inisialisasiExe(db, { sandi: SANDI_EXE, label: 'Laptop Desa Klasaman' })
    const kode = terbitkanToken(daerah.db, daerah.kunci, { kodePerangkat: tempel(kodePerangkat), role: 'admin', nama: 'Admin Desa', wilayahId: desaK.id })
    await aktifkanExe(db, kunci, tempel(kode))
    const r = imporBanyak(db, [kirim(buatPaket(daerah.db, desaK.id, daerah.kunci)), kirim(buatMateri(daerah.db, daerah.kunci))])
    expect(r.every((x) => !x.galat)).toBe(true)
    // laptop ditutup → dibuka lagi dengan kata sandi
    const ulang = await bukaDb(simpanDb(db))
    desa = { db: ulang, kunci: await bukaKunciExe(ulang, SANDI_EXE) }
    expect(daftarMateri(desa.db).length).toBeGreaterThan(0)
  })

  it('4. Desa mengaktifkan HP mubaligh & HP keluarga (profil pengurus); paket desa membawa materi otomatis', async () => {
    hpM = await buatHp('HP Ust. Ahmad')
    hpF = await buatHp('HP Pak Hasan')
    const tokM = terbitkanTokenBawah(desa.db, desa.kunci, { kodePerangkat: tempel(hpM.kode), role: 'mubaligh', nama: 'Ust. Ahmad', wilayahId: K1.id })
    const tokP = terbitkanTokenBawah(desa.db, desa.kunci, { kodePerangkat: tempel(hpF.kode), role: 'pengurus', nama: 'Pak Hasan', wilayahId: K1.id })
    profilM = (await aktifkanProfil(hpM.db, tempel(tokM))).id
    await aktifkanProfil(hpF.db, tempel(tokP))
    const paket = kirim(buatPaket(desa.db, K1.id, desa.kunci))
    for (const hp of [hpM, hpF]) {
      const r = bukaBerkasApaSaja(hp.db, paket).ringkasan as { materiDiterapkan?: number }
      expect(r.materiDiterapkan).toBeGreaterThan(0)
      expect(daftarMateri(hp.db, { kategoriGenerus: 'caberawit' }).map((m) => m.id)).toEqual(expect.arrayContaining(target))
    }
  })

  it('5. Satu HP keluarga: profil wali (2 anak) + profil tiap anak dari mubaligh; balasan pertama', async () => {
    const terbit = (role: 'generus' | 'wali', ids: string[], nama: string) =>
      terbitkanTokenGenerus(hpM.db, profilM, { kodePerangkat: tempel(hpF.kode), role, generusIds: ids, nama })
    await aktifkanProfil(hpF.db, tempel(terbit('wali', [ali.id, ani.id], 'Pak Hasan (wali)')))
    await aktifkanProfil(hpF.db, tempel(terbit('generus', [ali.id], 'Ali')))
    await aktifkanProfil(hpF.db, tempel(terbit('generus', [ani.id], 'Ani')))
    const profil = daftarProfil(hpF.db)
    expect(profil.map((p) => p.role).sort()).toEqual(['generus', 'generus', 'pengurus', 'wali'])
    expect(profilAktif(hpF.db)!.role).toBe('pengurus') // profil pertama tetap aktif
    bukaBerkasApaSaja(hpF.db, kirim(buatBalasan(hpM.db, hpF.id)))
    for (const g of [ali, ani]) expect(materiPerluDituntaskan(hpF.db, g.id)).toMatchObject({ periode: '2026-S1', total: 3, tuntas: 0 })
  })

  it('6. Ali mencatat sendiri di HP keluarga → Setor Belajar → mubaligh mengesahkan', () => {
    const pAli = daftarProfil(hpF.db, 'generus').find((p) => p.generus_ids[0] === ali.id)!
    pilihProfil(hpF.db, pAli.id)
    catatKemajuan(hpF.db, pAli.id, { materiId: target[1]!, status: 'selesai' })
    const r = bukaBerkasApaSaja(hpM.db, kirim(buatBelajar(hpF.db))).ringkasan as { hasil: { ditambah: number } }
    expect(r.hasil.ditambah).toBe(1)
    const diajukan = daftarDiajukan(hpM.db, K1.id)
    expect(diajukan.map((k) => k.generus_id)).toEqual([ali.id])
    sahkan(hpM.db, diajukan[0]!.id, { keputusan: 'disahkan' })
  })

  it('7. Mubaligh: Absen dengan materi hari ini (saran) & tandai tuntas', () => {
    const saran = saranMateriPertemuan(hpM.db, K1.id, undefined, { pengajianId: kelas })
    expect(saran[0]!.materi_id).toBe(target[0])
    const p = bukaPertemuan(hpM.db, { kelompokId: K1.id, tanggal: '2026-11-16', pengajianId: kelas, materiIds: [target[0]!] })
    expect(lembarAbsenPertemuan(hpM.db, p.id)!.baris.map((b) => b.nama).sort()).toEqual(['Ali', 'Ani', 'Budi'])
    expect(
      absenPertemuan(hpM.db, p.id, [
        { generusId: ali.id, status: 'hadir', tuntas: [target[0]!] },
        { generusId: ani.id, status: 'hadir' },
        { generusId: budi.id, status: 'alpa' },
      ]),
    ).toEqual({ presensi: 3, tuntas: 1 })
  })

  it('8. Balasan ke HP keluarga: anak melihat materi perlu dituntaskan, wali melihat laporan kedua anak', () => {
    bukaBerkasApaSaja(hpF.db, kirim(buatBalasan(hpM.db, hpF.id)))
    expect(materiPerluDituntaskan(hpF.db, ali.id)).toMatchObject({ total: 3, tuntas: 2 })
    expect(materiPerluDituntaskan(hpF.db, ali.id)!.perluDituntaskan.map((m) => m.materi_id)).toEqual([target[2]])
    expect(materiPerluDituntaskan(hpF.db, ani.id)).toMatchObject({ total: 3, tuntas: 0 })
    const lapAli = laporanPekanan(hpF.db, ali.id, '2026-11-16')!
    const lapAni = laporanPekanan(hpF.db, ani.id, '2026-11-16')!
    expect(lapAli).toBeTruthy()
    expect(lapAni).toBeTruthy()
    // profil Budi (bukan anak keluarga ini) tidak pernah sampai ke HP keluarga
    expect(hpF.db.nilai('SELECT COUNT(*) FROM presensi WHERE generus_id = ?', [budi.id])).toBe(0)
  })

  it('9. HP mubaligh & HP keluarga (pengurus) setor ke desa → desa setor gabungan ke daerah', () => {
    maju(60)
    const pPengurus = daftarProfil(hpF.db, 'pengurus')[0]!
    pilihProfil(hpF.db, pPengurus.id)
    const sM = buatSetor(hpM.db)
    const sF = buatSetor(hpF.db)
    expect(uraiToken(tokenSaya(hpM.db)).payload.atas_perangkat_id).toBe(desa.kunci.perangkatId)
    const r = imporBanyak(desa.db, [kirim(sM), kirim(sF)], desa.kunci)
    for (const x of r) {
      expect(x.galat).toBeFalsy()
      expect((x.ringkasan as { ditolak: unknown[] }).ditolak).toEqual([])
    }
    expect(statusSetor(desa.db, desaK.id)[0]).toMatchObject({ wilayah_id: K1.id, terlambat: false })
    maju(60)
    const rD = imporBanyak(daerah.db, [kirim(buatSetor(desa.db))], daerah.kunci)[0]!
    expect(rD.galat).toBeFalsy()
    expect(rD.ringkasan).toMatchObject({ gabungan: true, ditolak: [] })
    expect(daftarPresensi(daerah.db, { kelompokIds: [K1.id] }).map((p) => [p.generus_id, p.status]).sort()).toEqual(
      [[ali.id, 'hadir'], [ani.id, 'hadir'], [budi.id, 'alpa']].sort(),
    )
    const sah = daftarKemajuan(daerah.db, { statusSah: 'disahkan' }).filter((k) => k.generus_id === ali.id).map((k) => k.materi_id).sort()
    expect(sah).toEqual([target[0], target[1]].sort())
    expect(statusSetor(daerah.db, D.id).find((s) => s.wilayah_id === desaK.id)).toMatchObject({ terlambat: false })
  })

  it('10. Kurikulum memperbarui target → daerah → desa → HP (materi & target turun otomatis lewat paket)', () => {
    maju(60)
    const baru = daftarMateri(kur.db, { kategoriGenerus: 'caberawit' }).slice(0, 4).map((m) => m.id)
    tetapkanTarget(kur.db, { periode: '2026-S1', kategoriGenerus: 'caberawit', materiIds: baru })
    expect(imporBanyak(daerah.db, [kirim(buatKurikulum(kur.db))], daerah.kunci)[0]!.berhasil).toBe(true)
    // daerah mengirim MATERI baru + paket; desa cukup membuka keduanya, lalu Kirim Paket ke kelompok
    expect(imporBanyak(desa.db, [kirim(buatMateri(daerah.db, daerah.kunci)), kirim(buatPaket(daerah.db, desaK.id, daerah.kunci))]).every((x) => x.berhasil)).toBe(true)
    bukaBerkasApaSaja(hpM.db, kirim(buatPaket(desa.db, K1.id, desa.kunci)))
    expect(materiPerluDituntaskan(hpM.db, ali.id)).toMatchObject({ total: 4, tuntas: 2 })
    bukaBerkasApaSaja(hpF.db, kirim(buatBalasan(hpM.db, hpF.id)))
    expect(materiPerluDituntaskan(hpF.db, ani.id)).toMatchObject({ total: 4, tuntas: 0 })
  })
})

function tokenSaya(db: Db): string {
  return daftarProfil(db)[0]!.token
}
