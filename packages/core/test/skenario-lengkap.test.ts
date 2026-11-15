// Skenario lengkap §13: satu database per aktor, berkas berpindah sebagai byte (meniru kiriman WA).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  aktifkanProfil,
  ajukanUsulan,
  bacaHeader,
  buatBalasan,
  buatBelajar,
  buatJadwal,
  buatKoreksi,
  buatMateri,
  buatPaket,
  buatSetor,
  bukaBerkasApaSaja,
  catatKemajuan,
  catatPresensi,
  catatPresensiMassal,
  daftarDiajukan,
  daftarGenerus,
  daftarKemajuan,
  daftarKoreksi,
  daftarMateri,
  daftarPerangkat,
  daftarProfil,
  daftarUsulan,
  dariB64url,
  dariUtf8,
  imporBanyak,
  imporBelajar,
  imporGenerusCsv,
  imporSetor,
  jumlahBelumDisetor,
  jumlahBelumDisetorBelajar,
  keB64url,
  keUtf8,
  laporanPekanan,
  pilihProfil,
  rekapKemajuan,
  rekapPresensi,
  sahkan,
  serahTerimaMubaligh,
  setorAkhir,
  setujuiUsulan,
  simakLangsung,
  statusSetorAkhir,
  tambahJadwalTambahan,
  tambahPengajian,
  tambahWilayah,
  tautanWa,
  teksWaLaporanPekanan,
  terapkanBalasan,
  terapkanJadwal,
  terapkanMateri,
  terapkanPaket,
  terbitkanToken,
  terbitkanTokenGenerus,
  ubahStatus,
  pindahKelompok,
  uraiToken,
  type Db,
  type Generus,
  type KunciAdmin,
  type Profil,
  type Wilayah,
} from '../src/index'
import { buatAdmin, buatHp, bukaUlang, keTanggal, lepasJam, maju, pasangJam } from './bantu'

// ----- aktor -----
let admin: { db: Db; kunci: KunciAdmin }
let pengurus: { db: Db; kode: string; id: string }
let mubaligh: { db: Db; kode: string; id: string }
let mubalighBaru: { db: Db; kode: string; id: string }
let hpGenerus: { db: Db; kode: string; id: string }
let hpWali: { db: Db; kode: string; id: string }
let hpLain: { db: Db; kode: string; id: string }

// ----- data -----
let daerah: Wilayah
let desaA: Wilayah
let desaB: Wilayah
let k1: Wilayah
let k2: Wilayah
let k3: Wilayah
let g1: Generus // kakak (punya HP bersama)
let g2: Generus // adik (HP yang sama)
let g3: Generus // tanpa HP → simak langsung
let pengajianK1: string
let tokenG2 = ''
let profilMubaligh: Profil
let profilG1: Profil
let profilG2: Profil
let materiA: string
let materiB: string
let materiC: string
let paketV2: Uint8Array

const mat = (db: Db, i: number) => daftarMateri(db)[i]!.id

beforeAll(() => pasangJam('2026-11-01T01:00:00.000Z')) // Ahad
afterAll(() => lepasJam())

describe('Skenario lengkap PPG Sorong v2 (§13)', () => {
  it('1. admin init + wilayah 1 daerah / 2 desa / 3 kelompok', async () => {
    admin = await buatAdmin()
    const db = admin.db
    daerah = tambahWilayah(db, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
    desaA = tambahWilayah(db, { tingkat: 'desa', nama: 'Klasaman', kode: 'KLS', indukId: daerah.id })
    desaB = tambahWilayah(db, { tingkat: 'desa', nama: 'Remu', kode: 'RMU', indukId: daerah.id })
    k1 = tambahWilayah(db, { tingkat: 'kelompok', nama: 'Klasaman 1', kode: 'K1', indukId: desaA.id })
    k2 = tambahWilayah(db, { tingkat: 'kelompok', nama: 'Klasaman 2', kode: 'K2', indukId: desaA.id })
    k3 = tambahWilayah(db, { tingkat: 'kelompok', nama: 'Remu 1', kode: 'K3', indukId: desaB.id })
    pengajianK1 = tambahPengajian(db, { wilayahId: k1.id, nama: 'Pengajian Caberawit', jenis: 'rutin', hari: 0, jam: '16:00', tempat: 'Masjid' }).id
    tambahPengajian(db, { wilayahId: desaA.id, nama: 'Pengajian Desa', hari: 5, jam: '19:30' })
    expect(daftarMateri(db).length).toBe(420) // kurikulum lama ter-seed
  })

  it('2. impor CSV generus (baris salah dilaporkan, lainnya masuk)', () => {
    const csv = [
      'nama,jenis_kelamin,tanggal_lahir,kategori,kelompok_kode,wali_nama,wali_no_hp,mulai',
      'Ahmad Fauzi,L,2016-03-10,caberawit,K1,Pak Fauzi,081234567890,2026-10-01',
      'Aisyah Fauzi,P,12/07/2018,,K1,Pak Fauzi,081234567890,2026-10-01',
      '"Bilal, Jr",L,2015-01-01,caberawit,K1,Bu Bilal,0812-1111-2222,2026-10-01',
      'Salah Kode,L,2015-01-01,caberawit,ZZ,,,',
      'Citra,P,2010-05-05,praremaja,K3,,,2026-10-01',
    ].join('\n')
    const h = imporGenerusCsv(admin.db, csv)
    expect(h.berhasil).toBe(4)
    expect(h.gagal).toEqual([{ baris: 5, alasan: expect.stringContaining('ZZ') }])
    const semua = daftarGenerus(admin.db, { kelompokId: k1.id })
    g1 = semua.find((g) => g.nama === 'Ahmad Fauzi')!
    g2 = semua.find((g) => g.nama === 'Aisyah Fauzi')!
    g3 = semua.find((g) => g.nama === 'Bilal, Jr')!
    expect(g2.kategori).toBe('caberawit_a') // diturunkan dari umur (J-T3: saran Caberawit A)
    expect(g2.kategori_saran).toBe(1)
  })

  it('3. aktivasi pengurus kelompok & mubaligh, paket & materi pertama', async () => {
    pengurus = await buatHp('HP Pengurus K1')
    mubaligh = await buatHp('HP Ust. Hasan')
    const tP = terbitkanToken(admin.db, admin.kunci, { kodePerangkat: pengurus.kode, role: 'pengurus', nama: 'Pak Rudi', wilayahId: k1.id })
    const tM = terbitkanToken(admin.db, admin.kunci, { kodePerangkat: mubaligh.kode, role: 'mubaligh', nama: 'Ust. Hasan', wilayahId: k1.id })
    await aktifkanProfil(pengurus.db, tP)
    profilMubaligh = await aktifkanProfil(mubaligh.db, tM)
    expect(profilMubaligh.rahasia.kunci_kelompok_setor?.[0]?.rahasia).toBeTruthy()

    const paket = buatPaket(admin.db, k1.id, admin.kunci)
    expect(paket.penerima).toBe(2) // satu berkas untuk pengurus & mubaligh kelompok
    terapkanPaket(pengurus.db, paket.bytes)
    const r = terapkanPaket(mubaligh.db, paket.bytes)
    expect(r.perTabel.generus?.ditambah).toBe(3)
    expect(daftarGenerus(mubaligh.db, { kelompokId: k1.id })).toHaveLength(3)
    // data kelompok lain tidak ikut
    expect(daftarGenerus(mubaligh.db, { kelompokId: k3.id })).toHaveLength(0)

    const materi = buatMateri(admin.db, admin.kunci)
    expect(terapkanMateri(mubaligh.db, materi.bytes).total.ditambah).toBeGreaterThan(400)
    materiA = mat(mubaligh.db, 0)
    materiB = mat(mubaligh.db, 1)
    materiC = mat(mubaligh.db, 2)
  })

  it('4. mubaligh menerbitkan token 2 generus di SATU HP (multi-profil) + 1 wali', async () => {
    hpGenerus = await buatHp('HP Keluarga Fauzi')
    hpWali = await buatHp('HP Pak Fauzi')
    const t1 = terbitkanTokenGenerus(mubaligh.db, profilMubaligh.id, { kodePerangkat: hpGenerus.kode, role: 'generus', generusIds: [g1.id], nama: g1.nama })
    tokenG2 = terbitkanTokenGenerus(mubaligh.db, profilMubaligh.id, { kodePerangkat: hpGenerus.kode, role: 'generus', generusIds: [g2.id], nama: g2.nama })
    const tw = terbitkanTokenGenerus(mubaligh.db, profilMubaligh.id, { kodePerangkat: hpWali.kode, role: 'wali', generusIds: [g1.id, g2.id], nama: 'Pak Fauzi' })
    profilG1 = await aktifkanProfil(hpGenerus.db, t1, { pin: '1234' })
    profilG2 = await aktifkanProfil(hpGenerus.db, tokenG2)
    await aktifkanProfil(hpWali.db, tw)
    expect(daftarProfil(hpGenerus.db)).toHaveLength(2)
    expect(() => pilihProfil(hpGenerus.db, profilG1.id, '0000')).toThrow(/PIN salah/)
    expect(pilihProfil(hpGenerus.db, profilG1.id, '1234').aktif).toBe(true)
    // berkas materi admin diteruskan mubaligh ke grup WA
    const materi = buatMateri(admin.db, admin.kunci)
    terapkanMateri(hpGenerus.db, materi.bytes)
    terapkanMateri(hpWali.db, materi.bytes)
    expect(daftarPerangkat(mubaligh.db, { role: ['generus', 'wali'] })).toHaveLength(3)
  })

  it('5. generus setor belajar (satu berkas untuk semua profil)', () => {
    maju(60)
    catatKemajuan(hpGenerus.db, profilG1.id, { materiId: materiA, status: 'selesai', nilai: 90 })
    catatKemajuan(hpGenerus.db, profilG1.id, { materiId: materiB, status: 'selesai' })
    catatKemajuan(hpGenerus.db, profilG2.id, { materiId: materiA, status: 'sedang', catatan: 'baru separuh' })
    expect(jumlahBelumDisetorBelajar(hpGenerus.db)).toBe(3)
    const b = buatBelajar(hpGenerus.db)
    expect(b.jumlah).toBe(3)
    expect(b.nama).toMatch(/^PPG_BELAJAR_.+\.ppg$/)
    expect(bacaHeader(b.bytes).versi_kunci).toBe(1)
    // isi tidak terbaca tanpa kunci kelompok
    expect(Buffer.from(b.bytes).toString('latin1')).not.toContain('Ahmad')
    ;(globalThis as Record<string, unknown>).__belajar1 = b.bytes
  })

  it('6. mubaligh impor, sahkan 1, tolak 1, simak langsung 1', () => {
    maju(60)
    const bytes = (globalThis as Record<string, unknown>).__belajar1 as Uint8Array
    const r = imporBelajar(mubaligh.db, bytes)
    expect(r.hasil.ditambah).toBe(3)
    expect(imporBelajar(mubaligh.db, bytes).sudahPernah).toBe(true)
    const diajukan = daftarDiajukan(mubaligh.db, k1.id)
    expect(diajukan).toHaveLength(3)
    const kA = diajukan.find((k) => k.generus_id === g1.id && k.materi_id === materiA)!
    const kB = diajukan.find((k) => k.generus_id === g1.id && k.materi_id === materiB)!
    sahkan(mubaligh.db, kA.id, { keputusan: 'disahkan', catatan: 'Bacaan lancar' })
    sahkan(mubaligh.db, kB.id, { keputusan: 'ditolak', catatan: 'Ulangi makhraj' })
    expect(() => sahkan(mubaligh.db, kA.id, { keputusan: 'ditolak' })).toThrow(/sudah diputuskan/)
    const s = simakLangsung(mubaligh.db, { generusId: g3.id, materiId: materiA, status: 'selesai', nilai: 80 })
    expect(s.status_sah).toBe('disahkan')
    expect(s.disahkan_oleh).toBe('Ust. Hasan')
  })

  it('7. presensi oleh mubaligh & pengurus', () => {
    catatPresensiMassal(mubaligh.db, {
      kelompokId: k1.id,
      tanggal: '2026-11-01',
      pengajianId: pengajianK1,
      daftar: [
        { generusId: g1.id, status: 'hadir' },
        { generusId: g2.id, status: 'izin' },
        { generusId: g3.id, status: 'hadir' },
      ],
    })
    catatPresensi(pengurus.db, { kelompokId: k1.id, generusId: g1.id, tanggal: '2026-11-06', status: 'hadir' })
    // pengurus mengusulkan generus baru
    ajukanUsulan(pengurus.db, { jenis: 'tambah_generus', kelompokId: k1.id, data: { nama: 'Daud', jenis_kelamin: 'L', tanggal_lahir: '2017-02-02' } })
    // pengurus tidak bisa mengubah master langsung
    expect(() => tambahWilayah(pengurus.db, { tingkat: 'daerah', nama: 'X' })).toThrow(/admin/)
  })

  it('8. mubaligh & pengurus setor → admin impor (idempoten bila 2×)', () => {
    maju(60)
    const sm = buatSetor(mubaligh.db)
    expect(sm.nama).toMatch(/^PPG_SETOR_klasaman-1_\d{8}_\d+\.ppg$/)
    const r1 = imporSetor(admin.db, sm.bytes, admin.kunci)
    expect(r1.ditolak).toEqual([])
    expect(r1.perTabel.kemajuan_belajar?.ditambah).toBe(4)
    expect(r1.perTabel.presensi?.ditambah).toBe(3)
    expect(r1.tokenDilaporkan).toBe(3)
    const r2 = imporSetor(admin.db, sm.bytes, admin.kunci)
    expect(r2.sudahPernah).toBe(true)
    // setoran dibuat ulang (isi sama, berkas berbeda) → tidak ada yang bertambah
    const sm2 = buatSetor(mubaligh.db)
    const r3 = imporSetor(admin.db, sm2.bytes, admin.kunci)
    expect(r3.sudahPernah).toBe(false)
    expect(r3.total.ditambah).toBe(0)
    expect(r3.total.diperbarui).toBe(0)

    const sp = buatSetor(pengurus.db)
    const rp = imporSetor(admin.db, sp.bytes, admin.kunci)
    expect(rp.usulanBaru).toBe(1)
    const u = daftarUsulan(admin.db, { status: 'menunggu' })[0]!
    setujuiUsulan(admin.db, u.id)
    expect(daftarGenerus(admin.db, { kelompokId: k1.id }).map((g) => g.nama)).toContain('Daud')
    // admin tahu kemajuan yang disahkan
    expect(daftarKemajuan(admin.db, { statusSah: 'disahkan' })).toHaveLength(2)
  })

  it('9. paket → mubaligh terapkan (konfirmasi, data pengurus, usulan disetujui)', () => {
    maju(30)
    const pres = daftarKemajuan(admin.db, { generusIds: [g1.id] })[0]!
    buatKoreksi(admin.db, { tabel: 'kemajuan_belajar', rekamanId: pres.id, catatan: 'Periksa tanggal' })
    const p = buatPaket(admin.db, k1.id, admin.kunci)
    paketV2 = p.bytes
    expect(jumlahBelumDisetor(mubaligh.db)).toBeGreaterThan(0)
    terapkanPaket(mubaligh.db, p.bytes)
    expect(jumlahBelumDisetor(mubaligh.db)).toBe(0)
    terapkanPaket(pengurus.db, p.bytes)
    expect(jumlahBelumDisetor(pengurus.db)).toBe(0)
    expect(daftarUsulan(pengurus.db)[0]!.status).toBe('disetujui')
    expect(daftarGenerus(mubaligh.db, { kelompokId: k1.id }).map((g) => g.nama)).toContain('Daud')
    // koreksi ditujukan ke perangkat pencatat asli (HP generus) dan ikut paket kelompoknya
    expect(daftarKoreksi(mubaligh.db, [hpGenerus.id])).toHaveLength(1)
    expect(daftarKoreksi(mubaligh.db, [mubaligh.id])).toHaveLength(0)
  })

  it('10. balasan → HP generus & wali; wali lihat laporan pekanan + teks WA', () => {
    maju(30)
    const bal = buatBalasan(mubaligh.db, hpGenerus.id)
    const r = terapkanBalasan(hpGenerus.db, bal.bytes)
    expect(r.total.diperbarui).toBeGreaterThanOrEqual(2)
    const milikG1 = daftarKemajuan(hpGenerus.db, { generusIds: [g1.id] })
    expect(milikG1.find((k) => k.materi_id === materiA)?.status_sah).toBe('disahkan')
    expect(milikG1.find((k) => k.materi_id === materiB)?.status_sah).toBe('ditolak')
    expect(jumlahBelumDisetorBelajar(hpGenerus.db)).toBe(0)
    expect(buatBelajar(hpGenerus.db).jumlah).toBe(0)
    // balasan untuk HP lain tidak bisa dibuka
    expect(() => terapkanBalasan(hpWali.db, bal.bytes)).toThrow(/HP lain/)

    const balW = buatBalasan(mubaligh.db, hpWali.id)
    terapkanBalasan(hpWali.db, balW.bytes)
    const lap = laporanPekanan(hpWali.db, g1.id, '2026-11-01')!
    expect(lap.mondok).toBe(false)
    if (lap.mondok) throw new Error()
    expect(lap.pekan).toEqual({ mulai: '2026-11-01', selesai: '2026-11-07' })
    // 1 Nov (mubaligh, pengajian rutin) + 6 Nov (pengurus)
    expect(lap.presensi).toEqual({ hadir: 2, izin: 0, sakit: 0, alpa: 0, total: 2 })
    expect(lap.materiDisahkan.map((m) => m.materi_id)).toEqual([materiA])
    expect(lap.catatanMubaligh.join()).toContain('Bacaan lancar')
    expect(lap.targetBerikutnya).toHaveLength(3)
    expect(lap.targetBerikutnya.map((t) => t.materi_id)).not.toContain(materiA)
    const teks = teksWaLaporanPekanan(lap)
    expect(teks.startsWith("Assalamu'alaikum")).toBe(true)
    expect(teks).toContain('Ahmad Fauzi')
    expect(teks).not.toContain('Aisyah')
    expect(tautanWa('0812-3456-7890', teks)).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=Assalamu/)
  })

  it('11. jadwal tambahan dibagikan ke grup kelompok', () => {
    tambahJadwalTambahan(mubaligh.db, { kelompokId: k1.id, tanggal: '2026-11-04', jam: '19:00', judul: 'Muroja’ah bersama' })
    const j = buatJadwal(mubaligh.db)
    const r = terapkanJadwal(hpGenerus.db, j.bytes)
    expect(r.perTabel.jadwal_tambahan?.ditambah).toBe(1)
    expect(() => terapkanJadwal(hpGenerus.db, j.bytes)).toThrow(/lebih lama/)
    expect(bukaBerkasApaSaja(hpWali.db, buatJadwal(mubaligh.db).bytes).jenis).toBe('JADWAL')
  })

  it('12. generus mondok: dibekukan, tidak dihitung presensi; lalu aktif lagi', async () => {
    keTanggal('2026-11-08')
    ubahStatus(admin.db, g1.id, 'mondok', '2026-11-08', 'Pondok Kediri')
    const p = buatPaket(admin.db, k1.id, admin.kunci)
    terapkanPaket(mubaligh.db, p.bytes)
    terapkanPaket(pengurus.db, p.bytes)
    const r = terapkanBalasan(hpGenerus.db, buatBalasan(mubaligh.db, hpGenerus.id).bytes)
    expect(r.profilTerdampak).toEqual([expect.objectContaining({ id: profilG1.id, dibekukan: true })])
    expect(() => catatKemajuan(hpGenerus.db, profilG1.id, { materiId: materiC, status: 'sedang' })).toThrow(/mondok/)
    // profil adik tetap bisa mencatat & menyetor
    catatKemajuan(hpGenerus.db, profilG2.id, { materiId: materiB, status: 'selesai' })
    const b = buatBelajar(hpGenerus.db)
    expect(b.jumlah).toBe(1)
    expect(uraiToken(profilG1.token).payload.generus_ids).toEqual([g1.id])
    // presensi g1 saat mondok dicatat (keliru) → tidak dihitung
    catatPresensi(mubaligh.db, { kelompokId: k1.id, generusId: g1.id, tanggal: '2026-11-08', pengajianId: pengajianK1, status: 'alpa' })
    catatPresensi(mubaligh.db, { kelompokId: k1.id, generusId: g2.id, tanggal: '2026-11-08', pengajianId: pengajianK1, status: 'hadir' })
    const lap = laporanPekanan(mubaligh.db, g1.id, '2026-11-09')!
    expect(lap.mondok).toBe(true)
    expect(teksWaLaporanPekanan(lap)).toContain('sedang mondok')

    keTanggal('2026-11-15')
    ubahStatus(admin.db, g1.id, 'aktif', '2026-11-15')
    // setoran mubaligh dulu agar presensi 8 Nov sampai ke admin
    imporSetor(admin.db, buatSetor(mubaligh.db).bytes, admin.kunci)
    const p2 = buatPaket(admin.db, k1.id, admin.kunci)
    terapkanPaket(mubaligh.db, p2.bytes)
    terapkanPaket(pengurus.db, p2.bytes)
    terapkanBalasan(hpGenerus.db, buatBalasan(mubaligh.db, hpGenerus.id).bytes)
    expect(daftarProfil(hpGenerus.db).find((x) => x.id === profilG1.id)!.dibekukan).toBe(false)
    catatKemajuan(hpGenerus.db, profilG1.id, { materiId: materiC, status: 'sedang' })
    catatPresensi(mubaligh.db, { kelompokId: k1.id, generusId: g1.id, tanggal: '2026-11-15', pengajianId: pengajianK1, status: 'hadir' })

    const rekap = rekapPresensi(mubaligh.db, { wilayahId: k1.id, mulai: '2026-11-01', selesai: '2026-11-30' })
    const rg1 = rekap.perGenerus.find((x) => x.generus_id === g1.id)!
    expect(rg1).toMatchObject({ hadir: 3, alpa: 0, total: 3 }) // 1, 6, 15 Nov; 8 Nov (mondok) tidak dihitung
  })

  it('13. pindah kelompok: rekap per periode keanggotaan benar', async () => {
    keTanggal('2026-11-16')
    pindahKelompok(admin.db, g2.id, k2.id, '2026-11-20')
    catatPresensi(admin.db, { kelompokId: k2.id, generusId: g2.id, tanggal: '2026-11-22', status: 'hadir' })
    catatPresensi(admin.db, { kelompokId: k2.id, generusId: g2.id, tanggal: '2026-11-29', status: 'sakit' })
    // presensi di kelompok lama setelah pindah → tidak dihitung
    catatPresensi(admin.db, { kelompokId: k1.id, generusId: g2.id, tanggal: '2026-11-22', pengajianId: pengajianK1, status: 'hadir' })
    imporSetor(admin.db, buatSetor(mubaligh.db).bytes, admin.kunci)
    const rekap = rekapPresensi(admin.db, { wilayahId: desaA.id, mulai: '2026-11-01', selesai: '2026-11-30' })
    const baris = rekap.perGenerus.filter((x) => x.generus_id === g2.id)
    const diK1 = baris.find((x) => x.kelompok_id === k1.id)!
    const diK2 = baris.find((x) => x.kelompok_id === k2.id)!
    expect(diK1).toMatchObject({ hadir: 1, izin: 1, total: 2 }) // 1 & 8 Nov
    expect(diK2).toMatchObject({ hadir: 1, sakit: 1, total: 2 })
    expect(rekap.perKelompok.find((k) => k.kelompok_id === k2.id)?.total).toBe(2)
    // kemajuan ikut generus: paket K2 memuat kemajuan g2 yang dicatat di K1
    const hpK2 = await buatHp('HP Pengurus K2')
    await aktifkanProfil(hpK2.db, terbitkanToken(admin.db, admin.kunci, { kodePerangkat: hpK2.kode, role: 'pengurus', nama: 'Bu Sari', wilayahId: k2.id }))
    terapkanPaket(hpK2.db, buatPaket(admin.db, k2.id, admin.kunci).bytes)
    expect(daftarGenerus(hpK2.db, { kelompokId: k2.id }).map((g) => g.id)).toContain(g2.id)
    expect(daftarKemajuan(hpK2.db, { generusIds: [g2.id] }).some((k) => k.kelompok_id === k1.id)).toBe(true)
    // HP kelompok lama melihat g2 sudah pindah (bukan lagi anggota K1)
    terapkanPaket(mubaligh.db, buatPaket(admin.db, k1.id, admin.kunci).bytes)
    expect(daftarGenerus(mubaligh.db, { kelompokId: k1.id }).map((g) => g.id)).not.toContain(g2.id)
    // token generus lama (terikat K1) dicabut
    expect(daftarPerangkat(admin.db, { role: 'generus' }).find((p) => p.generus_ids[0] === g2.id)?.dicabut_pada).toBeTruthy()
    const rk = rekapKemajuan(admin.db, { wilayahId: k1.id }).find((x) => x.generus_id === g1.id)!
    expect(rk.disahkan).toBe(1)
    expect(rk.total).toBe(420)
  })

  it('14. serah terima mubaligh: kunci baru, mubaligh lama tercabut', async () => {
    keTanggal('2026-11-21')
    mubalighBaru = await buatHp('HP Ust. Yusuf')
    const tB = terbitkanToken(admin.db, admin.kunci, { kodePerangkat: mubalighBaru.kode, role: 'mubaligh', nama: 'Ust. Yusuf', wilayahId: k1.id })
    const pB = await aktifkanProfil(mubalighBaru.db, tB)
    expect(pB.rahasia.kunci_kelompok_setor?.map((k) => k.versi)).toEqual([1])

    // generus menyetor BELAJAR versi kunci 1 (sebelum serah terima) — dibuka mubaligh baru nanti
    const belajarV1 = buatBelajar(hpGenerus.db)
    expect(belajarV1.header.versi_kunci).toBe(1)

    expect(() => serahTerimaMubaligh(admin.db, admin.kunci, { kelompokId: k1.id, perangkatLamaId: mubaligh.id })).toThrow(/Setor Akhir/)
    const akhir = setorAkhir(mubaligh.db)
    expect(akhir.nama).toContain('SETOR_AKHIR')
    imporSetor(admin.db, akhir.bytes, admin.kunci)
    expect(statusSetorAkhir(admin.db, mubaligh.id).lengkap).toBe(true)
    const st = serahTerimaMubaligh(admin.db, admin.kunci, { kelompokId: k1.id, perangkatLamaId: mubaligh.id })
    expect(st.versiKunciBaru).toBe(2)

    maju(10)
    const p = buatPaket(admin.db, k1.id, admin.kunci)
    expect(() => terapkanPaket(mubaligh.db, p.bytes)).toThrow(/bukan untuk HP ini/)
    terapkanPaket(mubalighBaru.db, p.bytes)
    terapkanMateri(mubalighBaru.db, buatMateri(admin.db, admin.kunci).bytes)
    const pB2 = daftarProfil(mubalighBaru.db, 'mubaligh')[0]!
    expect(pB2.rahasia.kunci_kelompok_setor?.map((k) => k.versi)).toEqual([1, 2])

    // mubaligh baru membuka BELAJAR versi lama (token generus diterbitkan mubaligh lama, dikenal lewat paket)
    const r1 = imporBelajar(mubalighBaru.db, belajarV1.bytes)
    expect(r1.hasil.ditambah + r1.hasil.diperbarui).toBeGreaterThan(0)

    // balasan mubaligh baru membawa kunci publik versi 2
    terapkanBalasan(hpGenerus.db, buatBalasan(mubalighBaru.db, hpGenerus.id).bytes)
    maju(5)
    catatKemajuan(hpGenerus.db, profilG1.id, { materiId: materiC, status: 'selesai', nilai: 70 })
    const belajarV2 = buatBelajar(hpGenerus.db)
    expect(belajarV2.header.versi_kunci).toBe(2)
    expect(() => imporBelajar(mubaligh.db, belajarV2.bytes)).toThrow(/versi 2 tidak dimiliki/)
    const r2 = imporBelajar(mubalighBaru.db, belajarV2.bytes)
    expect(r2.hasil.ditambah + r2.hasil.diperbarui).toBe(1)

    // setoran mubaligh lama setelah dicabut ditolak admin
    expect(() => imporSetor(admin.db, buatSetor(mubaligh.db).bytes, admin.kunci)).toThrow(/dicabut/)

    // mubaligh lama memalsukan tanggal terbit (jam mundur) → token tidak pernah dilaporkan → ditolak mubaligh baru
    const hpSiluman = await buatHp('HP Siluman')
    keTanggal('2026-11-10')
    const palsu = terbitkanTokenGenerus(mubaligh.db, daftarProfil(mubaligh.db, 'mubaligh')[0]!.id, {
      kodePerangkat: hpSiluman.kode,
      role: 'generus',
      generusIds: [g3.id],
      nama: 'Bilal palsu',
    })
    keTanggal('2026-11-21', '03:00')
    const prof = await aktifkanProfil(hpSiluman.db, palsu)
    terapkanMateri(hpSiluman.db, buatMateri(admin.db, admin.kunci).bytes)
    catatKemajuan(hpSiluman.db, prof.id, { materiId: materiC, status: 'selesai' })
    expect(() => imporBelajar(mubalighBaru.db, buatBelajar(hpSiluman.db).bytes)).toThrow(/tidak pernah dilaporkan/)
  })

  it('15. token palsu/diubah ditolak', async () => {
    hpLain = await buatHp('HP Lain')
    const asli = terbitkanToken(admin.db, admin.kunci, { kodePerangkat: hpLain.kode, role: 'pengurus', nama: 'Pak Budi', wilayahId: k3.id })
    const [awal, payload, sig] = asli.split('.') as [string, string, string]
    const obj = JSON.parse(dariUtf8(dariB64url(payload)))
    obj.role = 'mubaligh'
    obj.hak = ['catat', 'lihat', 'sahkan', 'terbit_generus']
    obj.tingkat = 'kelompok'
    const diubah = `${awal}.${keB64url(keUtf8(JSON.stringify(obj)))}.${sig}`
    await expect(aktifkanProfil(hpLain.db, diubah)).rejects.toMatchObject({ kode: 'TANDA_TANGAN_TIDAK_SAH' })
    // admin palsu
    const adminPalsu = await buatAdmin('Organisasi Palsu')
    tambahWilayah(adminPalsu.db, { tingkat: 'daerah', nama: 'X', kode: 'X' })
    const wX = daftarPerangkat(adminPalsu.db).length
    expect(wX).toBe(0)
    const kodeK = tambahWilayah(adminPalsu.db, { tingkat: 'desa', nama: 'Y', indukId: tambahWilayah(adminPalsu.db, { tingkat: 'daerah', nama: 'Z' }).id })
    const tokenPalsu = terbitkanToken(adminPalsu.db, adminPalsu.kunci, { kodePerangkat: hpGenerus.kode, role: 'pengurus', nama: 'Penyusup', wilayahId: kodeK.id })
    await expect(aktifkanProfil(hpGenerus.db, tokenPalsu)).rejects.toMatchObject({ kode: 'ORG_BERBEDA' })
    await expect(aktifkanProfil(hpLain.db, 'PPGT1.bukan.token')).rejects.toMatchObject({ kode: 'TOKEN_TIDAK_SAH' })
    // token asli tetap bisa dipakai
    expect((await aktifkanProfil(hpLain.db, asli)).role).toBe('pengurus')
  })

  it('16. token diteruskan ke HP lain tidak bisa dipakai', async () => {
    const hp = await buatHp('HP Teman')
    await expect(aktifkanProfil(hp.db, tokenG2)).rejects.toMatchObject({ kode: 'TOKEN_BUKAN_UNTUK_HP_INI' })
    const tP = daftarProfil(pengurus.db)[0]!.token
    await expect(aktifkanProfil(hp.db, tP)).rejects.toMatchObject({ kode: 'TOKEN_BUKAN_UNTUK_HP_INI' })
  })

  it('17. paket lama tidak menimpa paket baru', () => {
    expect(() => terapkanPaket(pengurus.db, paketV2)).toThrow(/tidak lebih baru/)
    const r = imporBanyak(pengurus.db, [{ nama: 'lama.ppg', bytes: paketV2 }])
    expect(r[0]).toMatchObject({ berhasil: false, galat: { kode: 'PAKET_LAMA' } })
  })

  it('18. berkas setor hilang → setoran berikutnya tetap membawa datanya (kumulatif)', async () => {
    maju(60)
    catatPresensi(pengurus.db, { kelompokId: k1.id, generusId: g3.id, tanggal: '2026-11-21', status: 'hadir' })
    const hilang = buatSetor(pengurus.db) // tidak pernah sampai ke admin
    expect(hilang.bytes.length).toBeGreaterThan(0)
    maju(60)
    catatPresensi(pengurus.db, { kelompokId: k1.id, generusId: g3.id, tanggal: '2026-11-22', status: 'izin' })
    const db2 = await bukaUlang(pengurus.db) // aplikasi ditutup & dibuka
    const kedua = buatSetor(db2)
    const r = imporSetor(admin.db, kedua.bytes, admin.kunci)
    expect(r.perTabel.presensi?.ditambah).toBe(2)
    const tgl = rekapPresensi(admin.db, { wilayahId: k1.id, mulai: '2026-11-21', selesai: '2026-11-22' }).perGenerus.find((x) => x.generus_id === g3.id)
    expect(tgl).toMatchObject({ hadir: 1, izin: 1 })
  })
})
