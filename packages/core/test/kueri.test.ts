// Kueri untuk layar UI (Fase 1b) + jaminan src/ bisa dimuat di browser.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  aktifkanProfil,
  buatBelajar,
  buatMateri,
  buatSetor,
  cabutPerangkat,
  cariGenerus,
  catatKemajuan,
  catatPresensi,
  daftarDiajukanRinci,
  daftarPerangkatRinci,
  generusProfil,
  imporBelajar,
  imporSetor,
  infoSinkronHp,
  jadwalPekan,
  laporanWaKelompok,
  lembarPresensi,
  materiGenerus,
  namaHari,
  pohonWilayah,
  ringkasanBerandaAdmin,
  ringkasanKelompok,
  sahkan,
  simakLangsung,
  statusPerangkat,
  tambahJadwalTambahan,
  tambahPengajian,
  batalkanJadwalTambahan,
  terapkanMateri,
  terbitkanToken,
  terbitkanTokenGenerus,
  ubahStatus,
  type Profil,
} from '../src/index'
import { buatDunia, buatHp, keTanggal, lepasJam, maju, pasangJam, type Dunia } from './bantu'

let d: Dunia
let hpG: Awaited<ReturnType<typeof buatHp>> & { profil: Profil }
beforeAll(async () => {
  pasangJam('2026-11-02T01:00:00.000Z') // Senin
  d = await buatDunia()
  const hp = await buatHp('HP Ali')
  const profil = await aktifkanProfil(hp.db, terbitkanTokenGenerus(d.mubaligh.db, d.mubaligh.profil.id, { kodePerangkat: hp.kode, role: 'generus', generusIds: [d.g[0]!.id], nama: 'Ali' }))
  terapkanMateri(hp.db, buatMateri(d.admin.db, d.admin.kunci).bytes)
  hpG = { ...hp, profil }
})
afterAll(() => lepasJam())

describe('kueri UI', () => {
  it('pohon wilayah, cari generus (wilayah/cari/status), generus profil', () => {
    const pohon = pohonWilayah(d.admin.db)
    expect(pohon.map((p) => p.nama)).toEqual(['Sorong'])
    expect(pohon[0]!.anak[0]!.anak.map((k) => k.nama)).toEqual(['Klasaman 1', 'Klasaman 2'])
    expect(cariGenerus(d.admin.db, { wilayahId: d.desa.id }).map((g) => g.nama)).toEqual(['Ali', 'Budi', 'Citra'])
    expect(cariGenerus(d.admin.db, { wilayahId: d.desa.id, cari: 'bud' }).map((g) => g.kelompok_nama)).toEqual(['Klasaman 1'])
    expect(cariGenerus(d.admin.db, { kelompokId: d.k2.id })).toEqual([])
    expect(generusProfil(hpG.db, hpG.profil.id)).toEqual([])
    expect(generusProfil(d.mubaligh.db, 'tidak-ada')).toEqual([])
  })

  it('daftar perangkat rinci + status; ringkasan beranda admin (setoran terlambat)', async () => {
    const lain = await buatHp('HP Pengurus K2')
    const t = terbitkanToken(d.admin.db, d.admin.kunci, { kodePerangkat: lain.kode, role: 'pengurus', nama: 'Pak Dedi', wilayahId: d.k2.id })
    await aktifkanProfil(lain.db, t)
    imporSetor(d.admin.db, buatSetor(d.mubaligh.db).bytes, d.admin.kunci)
    const semua = daftarPerangkatRinci(d.admin.db, { wilayahId: d.desa.id })
    expect(semua.map((p) => `${p.nama}:${p.status}:${p.wilayah_nama}`).sort()).toEqual(['Ali:aktif:Klasaman 1', 'Pak Dedi:aktif:Klasaman 2', 'Ust. Hasan:aktif:Klasaman 1'])
    cabutPerangkat(d.admin.db, semua.find((p) => p.nama === 'Pak Dedi')!.id)
    expect(daftarPerangkatRinci(d.admin.db, { status: 'dicabut' }).map((p) => p.nama)).toEqual(['Pak Dedi'])
    expect(statusPerangkat({ dicabut_pada: null, dibekukan: false, berlaku_sampai: '2000-01-01T00:00:00Z' })).toBe('kedaluwarsa')
    expect(statusPerangkat({ dicabut_pada: null, dibekukan: true, berlaku_sampai: null })).toBe('dibekukan')

    const r = ringkasanBerandaAdmin(d.admin.db)
    expect(r.generus).toEqual({ aktif: 3, mondok: 0, total: 3 })
    expect(r.perangkatAktif).toMatchObject({ mubaligh: 1, generus: 1, pengurus: 0, total: 2 })
    const k1 = r.setoranPerKelompok.find((k) => k.kelompok_id === d.k1.id)!
    expect(k1).toMatchObject({ hari_sejak: 0, terlambat: false })
    // Fase 9b: belum pernah setor → "Belum ada setoran" (kuning), belum terlambat sampai batas sejak perangkat diaktifkan
    expect(k1).toMatchObject({ belumAdaSetoran: false })
    expect(r.setoranPerKelompok.find((k) => k.kelompok_id === d.k2.id)).toMatchObject({ terakhir_setor: null, belumAdaSetoran: true, terlambat: false })
    keTanggal('2026-11-20')
    const r2 = ringkasanBerandaAdmin(d.admin.db).setoranPerKelompok
    expect(r2.find((k) => k.kelompok_id === d.k1.id)).toMatchObject({ hari_sejak: 18, terlambat: true })
    expect(r2.find((k) => k.kelompok_id === d.k2.id)).toMatchObject({ belumAdaSetoran: true, terlambat: true })
    keTanggal('2026-11-02')
  })

  it('info sinkron HP: jumlah belum disetor, setor terakhir, pengingat > 7 hari', () => {
    const awal = infoSinkronHp(hpG.db)
    expect(awal).toMatchObject({ belumDisetor: 0, belumDisetorBelajar: 0, terakhirBelajar: null, perluPengingat: false })
    catatKemajuan(hpG.db, hpG.profil.id, { materiId: 'MAT-ALM-HFS-001', status: 'selesai', nilai: 90 })
    expect(infoSinkronHp(hpG.db)).toMatchObject({ belumDisetorBelajar: 1, perluPengingat: true })
    const b = buatBelajar(hpG.db)
    expect(infoSinkronHp(hpG.db)).toMatchObject({ belumDisetorBelajar: 1, hariSejakSetor: 0, perluPengingat: false })
    keTanggal('2026-11-12')
    expect(infoSinkronHp(hpG.db).perluPengingat).toBe(true)
    keTanggal('2026-11-02')
    imporBelajar(d.mubaligh.db, b.bytes)
    const m = infoSinkronHp(d.mubaligh.db)
    expect(m.belumDisetor).toBeGreaterThan(0)
    expect(m.terakhirPaket).toBeTruthy()
  })

  it('diajukan rinci, materi generus per bidang dengan status & target, ringkasan kelompok', () => {
    const daftar = daftarDiajukanRinci(d.mubaligh.db, d.k1.id)
    expect(daftar).toHaveLength(1)
    expect(daftar[0]).toMatchObject({ generus_nama: 'Ali', materi_tipe: 'hafalan', bidang_nama: expect.any(String) })
    expect(daftar[0]!.materi_nama).not.toMatch(/tidak dikenal/)
    expect(ringkasanKelompok(d.mubaligh.db, d.k1.id)).toMatchObject({ generusAktif: 3, kemajuanDiajukan: 1, kelompok: { nama: 'Klasaman 1' } })

    let mg = materiGenerus(d.mubaligh.db, d.g[0]!.id)
    const semua = mg.bidang.flatMap((b) => b.kategori.flatMap((k) => k.materi))
    expect(semua.find((m) => m.id === 'MAT-ALM-HFS-001')!.status).toBe('diajukan')
    expect(semua.filter((m) => m.target)).toHaveLength(3)
    expect(mg.ringkasan.total).toBe(semua.length)
    sahkan(d.mubaligh.db, daftar[0]!.id, { keputusan: 'disahkan' })
    simakLangsung(d.mubaligh.db, { generusId: d.g[0]!.id, materiId: 'MAT-ALM-HFS-002', status: 'sedang' })
    mg = materiGenerus(d.mubaligh.db, d.g[0]!.id)
    const m2 = mg.bidang.flatMap((b) => b.kategori.flatMap((k) => k.materi))
    expect(m2.find((m) => m.id === 'MAT-ALM-HFS-001')!.status).toBe('selesai')
    expect(m2.find((m) => m.id === 'MAT-ALM-HFS-002')!.status).toBe('sedang')
    expect(m2.find((m) => m.id === 'MAT-ALM-HFS-001')!.target).toBe(false)
    expect(mg.ringkasan.selesai).toBe(1)
    expect(materiGenerus(d.mubaligh.db, 'tidak-ada').bidang).toEqual([])
  })

  it('jadwal pekan (rutin + tambahan, termasuk batal) dan lembar presensi per tanggal', () => {
    tambahPengajian(d.admin.db, { wilayahId: d.k1.id, nama: 'Caberawit', hari: 0, jam: '16:00' })
    tambahPengajian(d.admin.db, { wilayahId: d.desa.id, nama: 'Desa Remaja', hari: 5, jam: '19:30' })
    maju(1)
    d.segarkan()
    const a = tambahJadwalTambahan(d.mubaligh.db, { kelompokId: d.k1.id, tanggal: '2026-11-04', jam: '19:00', judul: 'Muroja’ah' })
    const b = tambahJadwalTambahan(d.mubaligh.db, { kelompokId: d.k1.id, tanggal: '2026-11-06', judul: 'Kerja bakti' })
    tambahJadwalTambahan(d.mubaligh.db, { kelompokId: d.k1.id, tanggal: '2026-11-09', judul: 'Pekan depan' })
    batalkanJadwalTambahan(d.mubaligh.db, b.id)
    const j = jadwalPekan(d.mubaligh.db, d.k1.id, '2026-11-05')
    expect(j).toMatchObject({ mulai: '2026-11-01', selesai: '2026-11-07' })
    expect(j.acara.map((x) => `${x.tanggal} ${x.hari} ${x.judul}${x.dibatalkan ? ' (batal)' : ''}`)).toEqual([
      '2026-11-01 Ahad Caberawit',
      '2026-11-04 Rabu Muroja’ah',
      '2026-11-06 Jum\'at Kerja bakti (batal)',
      '2026-11-06 Jum\'at Desa Remaja',
    ])
    expect(j.acara[1]!.jadwal_tambahan_id).toBe(a.id)
    expect(namaHari('2026-11-07')).toBe('Sabtu')

    catatPresensi(d.mubaligh.db, { kelompokId: d.k1.id, generusId: d.g[1]!.id, tanggal: '2026-11-04', status: 'izin', jadwalTambahanId: a.id })
    const l = lembarPresensi(d.mubaligh.db, { kelompokId: d.k1.id, tanggal: '2026-11-04', jadwalTambahanId: a.id })
    expect(l.map((x) => `${x.nama}:${x.status}`)).toEqual(['Ali:null', 'Budi:izin', 'Citra:null'])
    // generus mondok tidak muncul di lembar presensi tanggal sesudahnya
    ubahStatus(d.admin.db, d.g[2]!.id, 'mondok', '2026-11-05')
    expect(lembarPresensi(d.admin.db, { kelompokId: d.k1.id, tanggal: '2026-11-06' }).map((x) => x.nama)).toEqual(['Ali', 'Budi'])
    expect(lembarPresensi(d.admin.db, { kelompokId: d.k1.id, tanggal: '2026-11-04' }).map((x) => x.nama)).toEqual(['Ali', 'Budi', 'Citra'])
  })

  it('laporan WA per kelompok: teks hanya data anak itu, tautan 08→628', () => {
    const l = laporanWaKelompok(d.mubaligh.db, d.k1.id, '2026-11-05')
    expect(l.map((x) => x.nama)).toEqual(['Ali', 'Budi', 'Citra'])
    const ali = l[0]!
    expect(ali.tautan).toMatch(/^https:\/\/wa\.me\/62812000000\d\?text=/)
    expect(ali.teks).toContain('Ali')
    expect(ali.teks).not.toContain('Budi')
    expect(ali.teks).not.toContain('Citra')
  })
})

describe('kompatibilitas browser', () => {
  it('src/ tidak mengimpor modul bawaan Node (fs, path, crypto, …)', () => {
    const BAWAAN = new Set([
      'assert', 'buffer', 'child_process', 'cluster', 'crypto', 'dgram', 'dns', 'events', 'fs', 'fs/promises', 'http', 'https',
      'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'querystring', 'readline', 'stream', 'string_decoder', 'timers',
      'tls', 'tty', 'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib',
    ])
    const berkas: string[] = []
    const jelajah = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n)
        if (statSync(p).isDirectory()) jelajah(p)
        else if (p.endsWith('.ts')) berkas.push(p)
      }
    }
    jelajah(join(__dirname, '..', 'src'))
    expect(berkas.length).toBeGreaterThan(20)
    const pelanggaran: string[] = []
    for (const f of berkas) {
      const teks = readFileSync(f, 'utf8')
      for (const m of teks.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g)) {
        const mod = m[1]!
        if (mod.startsWith('node:') || BAWAAN.has(mod)) pelanggaran.push(`${f}: ${mod}`)
      }
      if (/\b(?:process\.|Buffer\.|__dirname|require\()/.test(teks)) pelanggaran.push(`${f}: memakai global Node`)
    }
    expect(pelanggaran).toEqual([])
  })
})
