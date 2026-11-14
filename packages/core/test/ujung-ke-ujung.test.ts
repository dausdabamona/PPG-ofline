// Uji ujung-ke-ujung lintas aplikasi (Fase 4): satu siklus admin (EXE) → pengurus & mubaligh (APK) → generus → wali → admin,
// memakai fungsi yang sama dengan yang dipanggil UI. Setiap berkas .ppg, token, Kode Perangkat, CSV, cadangan kunci admin
// dan cadangan HP DITULIS ke folder sementara lalu DIBACA ULANG sebagai byte (meniru kirim/terima lewat WA), dan setiap
// database aplikasi disimpan ke berkas lalu dibuka ulang di antara langkah (meniru aplikasi ditutup/dibuka).
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  aktifkanProfil,
  bukaCadanganHp,
  bukaDb,
  bukaKunciAdmin,
  buatBalasan,
  buatBelajar,
  buatCadanganHp,
  buatMateri,
  buatPaket,
  buatSetor,
  catatKemajuan,
  catatPresensiMassal,
  daftarDiajukanRinci,
  daftarGenerus,
  daftarPenerimaBalasan,
  daftarProfil,
  eksporCadanganKunci,
  imporBanyak,
  imporCadanganKunci,
  imporGenerusCsv,
  inisialisasiAdmin,
  inisialisasiPerangkat,
  jenisCadanganHp,
  kodePerangkatSaya,
  laporanPekanan,
  laporanWaKelompok,
  lembarPresensi,
  pecahQr,
  pengumpulQrBaru,
  pilihProfil,
  rekapKemajuan,
  rekapPresensi,
  sahkan,
  simpanDb,
  statusProfil,
  susunQr,
  tambahBagianQr,
  tambahPengajian,
  tambahWilayah,
  targetMateriBerikutnya,
  terbitkanToken,
  terbitkanTokenGenerus,
  ubahStatus,
  type Db,
  type HasilImporBanyak,
  type KunciAdmin,
} from '../src/index'
import { lepasJam, maju, pasangJam } from './bantu'

let folder: string
let nomor = 0

/** "Kirim lewat WA": tulis byte ke berkas, kembalikan berkas yang dibaca ulang dari disk. */
function kirim(nama: string, bytes: Uint8Array): { nama: string; bytes: Uint8Array } {
  const jalur = join(folder, `${String(++nomor).padStart(3, '0')}_${nama}`)
  writeFileSync(jalur, bytes)
  return { nama, bytes: new Uint8Array(readFileSync(jalur)) }
}
/** Teks (token, Kode Perangkat) lewat WA sebagai pesan teks. */
function kirimTeks(nama: string, teks: string): string {
  return new TextDecoder().decode(kirim(`${nama}.txt`, new TextEncoder().encode(teks)).bytes)
}
/** Tutup lalu buka ulang aplikasi: database disimpan ke berkas, dibaca ulang. */
async function bukaUlang(nama: string, db: Db): Promise<Db> {
  const jalur = join(folder, `db_${nama}.sqlite`)
  writeFileSync(jalur, simpanDb(db))
  db.tutup()
  return bukaDb(new Uint8Array(readFileSync(jalur)))
}
/** Token panjang lewat QR berseri: bagian dipindai dalam urutan acak (dengan bagian yang terbaca dua kali). */
function lewatQrBerseri(token: string): string {
  const bagian = pecahQr(token)
  const acak = [...bagian.slice(1).reverse(), bagian[1] ?? bagian[0]!, bagian[0]!]
  let p = pengumpulQrBaru()
  let hasil: string | undefined
  for (const b of acak) {
    const r = tambahBagianQr(p, b)
    p = r.pengumpul
    if (r.status === 'lengkap' || r.status === 'tunggal') hasil = r.hasil
  }
  expect(hasil).toBe(token)
  return hasil!
}
function semuaBerhasil(h: HasilImporBanyak[]): void {
  for (const x of h) expect(x.galat?.pesan ?? 'ok', x.nama).toBe('ok')
}

beforeAll(() => {
  folder = mkdtempSync(join(tmpdir(), 'ppg-e2e-'))
  pasangJam('2026-11-02T01:00:00.000Z') // Senin
})
afterAll(() => {
  lepasJam()
  rmSync(folder, { recursive: true, force: true })
})

describe('ujung ke ujung: admin → pengurus/mubaligh → generus → wali → admin', () => {
  it('satu siklus penuh dengan berkas nyata', async () => {
    // ---------- EXE admin: pengaturan awal, cadangan kunci, wilayah, CSV, pengajian, materi
    let admin = await bukaDb()
    let kunci: KunciAdmin = await inisialisasiAdmin(admin, { sandi: 'sandi-admin-123', namaOrganisasi: 'PPG Sorong' })
    const cadKunci = kirim('PPG_KUNCI_ADMIN.ppgkey', (await eksporCadanganKunci(admin, kunci, 'cadangan-kunci-1')).bytes)
    const daerah = tambahWilayah(admin, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
    const desa = tambahWilayah(admin, { tingkat: 'desa', nama: 'Klasaman', kode: 'KLS', indukId: daerah.id })
    const k1 = tambahWilayah(admin, { tingkat: 'kelompok', nama: 'Klasaman 1', kode: 'K1', indukId: desa.id })
    tambahWilayah(admin, { tingkat: 'kelompok', nama: 'Klasaman 2', kode: 'K2', indukId: desa.id })
    const csv = kirimTeks(
      'generus.csv',
      'nama;jenis_kelamin;tanggal_lahir;kategori;kelompok_kode;wali_nama;wali_no_hp\n' +
        'Ali;L;01/02/2016;;K1;Pak Fauzi;081234567890\nBudi;L;2017-05-05;caberawit;K1;Pak Fauzi;081234567890\nCitra;P;2015-03-03;;K1;Bu Aminah;\n',
    )
    const csvHasil = imporGenerusCsv(admin, csv)
    expect(csvHasil.berhasil).toBe(3)
    const cari = (n: string) => daftarGenerus(admin, { kelompokId: k1.id }).find((g) => g.nama === n)!
    const ali = cari('Ali')
    const budi = cari('Budi')
    const citra = cari('Citra')
    for (let hari = 0; hari < 7; hari++) tambahPengajian(admin, { wilayahId: k1.id, nama: 'Pengajian Caberawit', hari, jam: '16:00' })
    const materi = buatMateri(admin, kunci)
    admin = await bukaUlang('admin', admin)
    kunci = await bukaKunciAdmin(admin, 'sandi-admin-123')

    // ---------- APK pengurus & mubaligh: Kode Perangkat → token admin (lewat QR berseri bila panjang) → aktivasi
    let hpPengurus = await bukaDb()
    await inisialisasiPerangkat(hpPengurus, 'HP Pak Rahmat')
    let hpMubaligh = await bukaDb()
    await inisialisasiPerangkat(hpMubaligh, 'HP Ust. Hasan')
    const tPengurus = terbitkanToken(admin, kunci, {
      kodePerangkat: kirimTeks('kode-pengurus', kodePerangkatSaya(hpPengurus)),
      role: 'pengurus',
      nama: 'Pak Rahmat',
      wilayahId: k1.id,
    })
    const tMubaligh = terbitkanToken(admin, kunci, {
      kodePerangkat: kirimTeks('kode-mubaligh', kodePerangkatSaya(hpMubaligh)),
      role: 'mubaligh',
      nama: 'Ust. Hasan',
      wilayahId: k1.id,
    })
    await aktifkanProfil(hpPengurus, lewatQrBerseri(tPengurus))
    const pM = await aktifkanProfil(hpMubaligh, susunQr(kirimTeks('token-mubaligh', pecahQr(tMubaligh).join('\n')).split('\n')))
    const p1 = buatPaket(admin, k1.id, kunci)
    const paket1 = kirim(p1.nama, p1.bytes)
    const fMateri = kirim(materi.nama, materi.bytes)
    semuaBerhasil(imporBanyak(hpPengurus, [paket1, fMateri]))
    semuaBerhasil(imporBanyak(hpMubaligh, [paket1, fMateri]))
    hpPengurus = await bukaUlang('pengurus', hpPengurus)
    hpMubaligh = await bukaUlang('mubaligh', hpMubaligh)
    expect(lembarPresensi(hpPengurus, { kelompokId: k1.id, tanggal: '2026-11-02' })).toHaveLength(3)

    // ---------- Mubaligh menerbitkan token generus (Ali & Budi di satu HP) + wali; token ±3,7 KB lewat QR berseri
    let hpGenerus = await bukaDb()
    await inisialisasiPerangkat(hpGenerus, 'HP Keluarga Fauzi')
    let hpWali = await bukaDb()
    await inisialisasiPerangkat(hpWali, 'HP Pak Fauzi')
    const kodeG = kirimTeks('kode-generus', kodePerangkatSaya(hpGenerus))
    const tAli = terbitkanTokenGenerus(hpMubaligh, pM.id, { kodePerangkat: kodeG, role: 'generus', generusIds: [ali.id], nama: 'Ali' })
    const tBudi = terbitkanTokenGenerus(hpMubaligh, pM.id, { kodePerangkat: kodeG, role: 'generus', generusIds: [budi.id], nama: 'Budi' })
    const tWali = terbitkanTokenGenerus(hpMubaligh, pM.id, {
      kodePerangkat: kirimTeks('kode-wali', kodePerangkatSaya(hpWali)),
      role: 'wali',
      generusIds: [ali.id, budi.id],
      nama: 'Pak Fauzi',
    })
    expect(tAli.length).toBeGreaterThan(2000)
    expect(pecahQr(tAli).length).toBeGreaterThan(1)
    const pAli = await aktifkanProfil(hpGenerus, lewatQrBerseri(tAli), { pin: '1234' })
    const pBudi = await aktifkanProfil(hpGenerus, kirimTeks('token-budi', tBudi)) // cadangan: Tempel Token dari WA
    const pWali = await aktifkanProfil(hpWali, lewatQrBerseri(tWali))
    hpMubaligh = await bukaUlang('mubaligh', hpMubaligh)

    // ---------- Pengurus mengisi presensi; pengurus & mubaligh Setor Data → admin Impor Setoran
    catatPresensiMassal(hpPengurus, {
      kelompokId: k1.id,
      tanggal: '2026-11-02',
      daftar: [
        { generusId: ali.id, status: 'hadir' },
        { generusId: budi.id, status: 'izin' },
        { generusId: citra.id, status: 'hadir' },
      ],
    })
    hpPengurus = await bukaUlang('pengurus', hpPengurus)
    const setorP = buatSetor(hpPengurus)
    const setorM = buatSetor(hpMubaligh)
    const masuk1 = [kirim(setorP.nama, setorP.bytes), kirim(setorM.nama, setorM.bytes)]
    semuaBerhasil(imporBanyak(admin, masuk1, kunci))
    expect(imporBanyak(admin, masuk1, kunci).every((h) => (h.ringkasan as { sudahPernah?: boolean }).sudahPernah)).toBe(true)

    // ---------- Admin → paket → mubaligh → Balasan ke HP generus & wali
    maju(60)
    semuaBerhasil(imporBanyak(hpMubaligh, [kirim('PPG_PAKET_K1_v2.ppg', buatPaket(admin, k1.id, kunci).bytes)]))
    const penerima = daftarPenerimaBalasan(hpMubaligh)
    expect(penerima).toHaveLength(2)
    const balasan1 = penerima.map((x) => {
      const b = buatBalasan(hpMubaligh, x.perangkatId)
      return kirim(b.nama, b.bytes)
    })
    // berkas yang bukan untuknya ditolak dengan pesan, yang lain tetap terbuka
    const hG = imporBanyak(hpGenerus, [...balasan1, fMateri])
    expect(hG.filter((h) => h.berhasil)).toHaveLength(2)
    const hW = imporBanyak(hpWali, balasan1)
    expect(hW.filter((h) => h.berhasil)).toHaveLength(1)
    expect(hW.find((h) => !h.berhasil)!.galat!.pesan).toBeTruthy()
    hpGenerus = await bukaUlang('generus', hpGenerus)
    hpWali = await bukaUlang('wali', hpWali)

    // ---------- Generus mencatat kemajuan (dua profil) → Setor Belajar → mubaligh sahkan/tolak
    const mAli = targetMateriBerikutnya(hpGenerus, ali.id)[0]!
    const mBudi = targetMateriBerikutnya(hpGenerus, budi.id)[0]!
    pilihProfil(hpGenerus, pAli.id, '1234')
    catatKemajuan(hpGenerus, pAli.id, { materiId: mAli.id, status: 'selesai', nilai: 90, catatan: 'Sudah hafal' })
    pilihProfil(hpGenerus, pBudi.id)
    catatKemajuan(hpGenerus, pBudi.id, { materiId: mBudi.id, status: 'sedang' })
    hpGenerus = await bukaUlang('generus', hpGenerus)
    const belajar = buatBelajar(hpGenerus, { kelompokId: k1.id })
    semuaBerhasil(imporBanyak(hpMubaligh, [kirim(belajar.nama, belajar.bytes)]))
    const diajukan = daftarDiajukanRinci(hpMubaligh, k1.id)
    expect(diajukan.map((k) => k.generus_nama).sort()).toEqual(['Ali', 'Budi'])
    sahkan(hpMubaligh, diajukan.find((k) => k.generus_id === ali.id)!.id, { keputusan: 'disahkan', catatan: 'Lancar' })
    sahkan(hpMubaligh, diajukan.find((k) => k.generus_id === budi.id)!.id, { keputusan: 'ditolak', catatan: 'Ulangi' })
    hpMubaligh = await bukaUlang('mubaligh', hpMubaligh)

    // ---------- Balasan → wali melihat laporan pekanan Ali (hanya anaknya); teks WA dari mubaligh
    maju(60)
    const balasan2 = daftarPenerimaBalasan(hpMubaligh).map((x) => {
      const b = buatBalasan(hpMubaligh, x.perangkatId)
      return kirim(b.nama, b.bytes)
    })
    imporBanyak(hpGenerus, balasan2)
    imporBanyak(hpWali, balasan2)
    hpWali = await bukaUlang('wali', hpWali)
    const lap = laporanPekanan(hpWali, ali.id, '2026-11-02')!
    if (lap.mondok) throw new Error('Ali belum mondok')
    const lapAli = lap
    expect(lapAli.presensi.hadir).toBe(1)
    expect(lapAli.materiDisahkan.map((m) => m.materi_id)).toEqual([mAli.id])
    expect(lapAli.catatanMubaligh.some((c) => c.includes('Lancar'))).toBe(true)
    expect(laporanPekanan(hpWali, citra.id, '2026-11-02')).toBeNull() // data generus lain tidak ada di HP wali
    expect(daftarProfil(hpWali)[0]!.generus_ids.sort()).toEqual([ali.id, budi.id].sort())
    expect(pWali.role).toBe('wali')
    const wa = laporanWaKelompok(hpMubaligh, k1.id, '2026-11-02').find((l) => l.generus_id === ali.id)!
    expect(wa.tautan).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=/)
    expect(wa.teks).not.toContain('Budi')

    // ---------- Mubaligh Setor Data → admin: rekap resmi hanya memuat yang disahkan
    const setor2 = buatSetor(hpMubaligh)
    semuaBerhasil(imporBanyak(admin, [kirim(setor2.nama, setor2.bytes)], kunci))
    admin = await bukaUlang('admin', admin)
    kunci = await bukaKunciAdmin(admin, 'sandi-admin-123')
    const rekap = rekapKemajuan(admin, { wilayahId: k1.id })
    const totalDisahkan = (gid: string) => {
      const r = rekap.find((x) => x.generus_id === gid)! as unknown as { perBidang?: Record<string, { disahkan: number }>; total_disahkan?: number }
      return r.total_disahkan ?? Object.values(r.perBidang ?? {}).reduce((a, b) => a + b.disahkan, 0)
    }
    expect(totalDisahkan(ali.id)).toBe(1)
    expect(totalDisahkan(budi.id)).toBe(0)
    const presensiK1 = rekapPresensi(admin, { wilayahId: k1.id, mulai: '2026-11-01', selesai: '2026-11-07' })
    expect(presensiK1.perKelompok[0]!.hadir).toBe(2)

    // ---------- Mondok: admin → paket → mubaligh → balasan → HP generus berhenti mencatat untuk Ali saja
    ubahStatus(admin, ali.id, 'mondok', '2026-11-03', 'Pondok')
    maju(60 * 24)
    semuaBerhasil(imporBanyak(hpMubaligh, [kirim('PPG_PAKET_K1_v3.ppg', buatPaket(admin, k1.id, kunci).bytes)]))
    const balasan3 = daftarPenerimaBalasan(hpMubaligh).map((x) => {
      const b = buatBalasan(hpMubaligh, x.perangkatId)
      return kirim(b.nama, b.bytes)
    })
    imporBanyak(hpGenerus, balasan3)
    hpGenerus = await bukaUlang('generus', hpGenerus)
    const profilG = daftarProfil(hpGenerus)
    expect(statusProfil(profilG.find((p) => p.id === pAli.id)!).kode).toBe('DIBEKUKAN')
    expect(statusProfil(profilG.find((p) => p.id === pBudi.id)!).bolehMencatat).toBe(true)
    expect(() => catatKemajuan(hpGenerus, pAli.id, { materiId: mAli.id, status: 'selesai' })).toThrow()
    expect(laporanPekanan(hpMubaligh, ali.id, '2026-11-04')!.mondok).toBe(true)

    // ---------- HP generus hilang/ganti: cadangan terenkripsi → HP baru → lanjut Setor Belajar
    const cad = kirim('PPG_CADANGAN_HP.ppgdb', (await buatCadanganHp(hpGenerus, 'keluarga-fauzi')).bytes)
    expect(jenisCadanganHp(cad.bytes)).toBe('terenkripsi')
    await expect(bukaCadanganHp(cad.bytes, 'salah-sandi')).rejects.toThrow()
    const hpBaru = await bukaDb(await bukaCadanganHp(cad.bytes, 'keluarga-fauzi'))
    catatKemajuan(hpBaru, pBudi.id, { materiId: mBudi.id, status: 'selesai', nilai: 80 })
    const belajar2 = buatBelajar(hpBaru, { kelompokId: k1.id })
    semuaBerhasil(imporBanyak(hpMubaligh, [kirim(belajar2.nama, belajar2.bytes)]))
    expect(daftarDiajukanRinci(hpMubaligh, k1.id).map((k) => k.generus_nama)).toEqual(['Budi'])

    // ---------- Laptop admin rusak: pulihkan dari cadangan kunci (.ppgkey) + database terakhir
    const adminBaru = await bukaDb(simpanDb(admin))
    const k2 = await imporCadanganKunci(adminBaru, cadKunci.bytes, 'cadangan-kunci-1', 'sandi-baru-456')
    expect(k2.orgId).toBe(kunci.orgId)
    const setor3 = buatSetor(hpMubaligh)
    semuaBerhasil(imporBanyak(adminBaru, [kirim(setor3.nama, setor3.bytes)], k2))
  }, 60_000)
})
