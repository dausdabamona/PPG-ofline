// Kueri siap pakai untuk layar UI desktop (§11) & mobile (§12) — agar aplikasi tidak menulis SQL sendiri (Fase 1b).
import type { Db } from './db'
import { laporanPekanan, PetaRiwayat, tautanWa, teksWaLaporanPekanan, normalNoHp, type LaporanPekanan } from './laporan'
import { targetMateriBerikutnya } from './kurikulum'
import { ambilGenerus, daftarGenerus, type Generus, type KategoriGenerus, type StatusGenerus } from './repo/generus'
import { daftarJadwalTambahan } from './repo/jadwal-tambahan'
import { type KemajuanBelajar } from './repo/kemajuan'
import { daftarMateri, type MateriLengkap } from './repo/materi'
import { pengajianUntukKelompok } from './repo/pengajian'
import { daftarPresensi, type StatusPresensi } from './repo/presensi'
import { daftarPerangkat, type PerangkatTerdaftar } from './repo/perangkat'
import { ambilProfil, daftarProfil } from './repo/profil'
import { ambilMeta } from './repo/umum'
import { ambilWilayah, daftarWilayah, kelompokDalamWilayah, turunanWilayah, type Tingkat, type Wilayah } from './repo/wilayah'
import { jumlahBelumSampaiDaerah, rincianBelumDisetor } from './sinkron/setor'
import { jumlahBelumDisetorBelajar } from './sinkron/belajar'
import { awalPekan, akhirPekan, hariDalamPekan, sekarangIso, selisihHari, tambahHari, tanggalDariIso, tanggalHariIni } from './waktu'

const NAMA_HARI = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu']

/** Nama hari Indonesia untuk tanggal 'YYYY-MM-DD'. */
export function namaHari(tanggal: string): string {
  return NAMA_HARI[hariDalamPekan(tanggal)]!
}

function hariSejak(iso: string | null | undefined, hariIni: string): number | null {
  return iso ? selisihHari(tanggalDariIso(iso), hariIni) : null
}

// ---------------- perangkat & wilayah ----------------

export type StatusPerangkat = 'aktif' | 'dibekukan' | 'dicabut' | 'kedaluwarsa'

/** Status tampilan sebuah token terdaftar. */
export function statusPerangkat(p: Pick<PerangkatTerdaftar, 'dicabut_pada' | 'dibekukan' | 'berlaku_sampai'>, sekarang: string = sekarangIso()): StatusPerangkat {
  if (p.dicabut_pada) return 'dicabut'
  if (p.dibekukan) return 'dibekukan'
  if (p.berlaku_sampai && sekarang > p.berlaku_sampai) return 'kedaluwarsa'
  return 'aktif'
}

export interface PerangkatRinci extends PerangkatTerdaftar {
  status: StatusPerangkat
  wilayah_nama: string
}

/** Daftar token (layar "Perangkat & Token") + status & nama wilayah. `wilayahId` mencakup turunannya. */
export function daftarPerangkatRinci(
  db: Db,
  f: { wilayahId?: string; role?: PerangkatTerdaftar['role'] | PerangkatTerdaftar['role'][]; status?: StatusPerangkat } = {},
): PerangkatRinci[] {
  const wilayahIds = f.wilayahId ? turunanWilayah(db, f.wilayahId) : undefined
  const nama = new Map(daftarWilayah(db, { termasukDihapus: true }).map((w) => [w.id, w.nama]))
  const kini = sekarangIso()
  return daftarPerangkat(db, { wilayahIds, role: f.role })
    .map((p) => ({ ...p, status: statusPerangkat(p, kini), wilayah_nama: nama.get(p.wilayah_id) ?? p.wilayah_id }))
    .filter((p) => !f.status || p.status === f.status)
}

export interface SimpulWilayah {
  id: string
  tingkat: Tingkat
  nama: string
  kode: string | null
  anak: SimpulWilayah[]
}

/** Pohon wilayah daerah → desa → kelompok (layar "Wilayah"). Yang terhapus tidak ikut. */
export function pohonWilayah(db: Db): SimpulWilayah[] {
  const semua = daftarWilayah(db)
  const simpul = new Map<string, SimpulWilayah>(semua.map((w) => [w.id, { id: w.id, tingkat: w.tingkat, nama: w.nama, kode: w.kode, anak: [] }]))
  const akar: SimpulWilayah[] = []
  for (const w of semua) {
    const s = simpul.get(w.id)!
    const induk = w.induk_id ? simpul.get(w.induk_id) : undefined
    if (induk) induk.anak.push(s)
    else akar.push(s)
  }
  const urut = (l: SimpulWilayah[]) => {
    l.sort((a, b) => a.nama.localeCompare(b.nama))
    for (const s of l) urut(s.anak)
  }
  urut(akar)
  return akar
}

// ---------------- generus ----------------

export interface GenerusRinci extends Generus {
  kelompok_nama: string
}

/**
 * Daftar generus dengan filter (layar "Generus & Jamaah" desktop, "Generus" mubaligh):
 * `wilayahId` (desa/daerah → semua kelompok di bawahnya) atau `kelompokId`, kategori, status, dan `cari` (nama, tanpa beda huruf besar).
 */
export function cariGenerus(
  db: Db,
  f: { wilayahId?: string; kelompokId?: string; kategori?: KategoriGenerus; status?: StatusGenerus; cari?: string } = {},
): GenerusRinci[] {
  const kelompokIds = f.kelompokId ? [f.kelompokId] : f.wilayahId ? kelompokDalamWilayah(db, f.wilayahId) : undefined
  const q = f.cari?.trim().toLowerCase()
  const nama = new Map<string, string>()
  return daftarGenerus(db, { kelompokIds, kategori: f.kategori, status: f.status })
    .filter((g) => !q || g.nama.toLowerCase().includes(q))
    .map((g) => {
      if (!nama.has(g.kelompok_id)) nama.set(g.kelompok_id, ambilWilayah(db, g.kelompok_id)?.nama ?? '')
      return { ...g, kelompok_nama: nama.get(g.kelompok_id)! }
    })
}

/** Generus yang dipegang sebuah profil HP (generus: dirinya; wali: anak-anaknya). */
export function generusProfil(db: Db, profilId: string): Generus[] {
  const p = ambilProfil(db, profilId)
  if (!p) return []
  return p.generus_ids.map((id) => ambilGenerus(db, id)).filter((g): g is Generus => !!g && !g.dihapus)
}

// ---------------- beranda ----------------

export interface SetoranKelompok {
  kelompok_id: string
  nama: string
  /** Waktu impor setoran terakhir dari pengurus/mubaligh kelompok itu (ISO) atau null. */
  terakhir_setor: string | null
  hari_sejak: number | null
  /**
   * true bila setoran terakhir lebih dari `hariTerlambat` hari lalu. Belum pernah setor (Fase 9b): baru terlambat
   * bila sudah lebih dari `hariTerlambat` hari sejak perangkat pengurus/mubaligh pertama kelompok itu didaftarkan.
   */
  terlambat: boolean
  /** Fase 9b: belum pernah ada setoran (tampil "Belum ada setoran" kuning selama belum terlambat). */
  belumAdaSetoran: boolean
}

export interface RingkasanBerandaAdmin {
  generus: { aktif: number; mondok: number; total: number }
  perangkatAktif: Record<PerangkatTerdaftar['role'], number> & { total: number }
  usulanMenunggu: number
  setoranPerKelompok: SetoranKelompok[]
}

/** Ringkasan layar Beranda admin (§11.2). Tanda merah: `terlambat` (bawaan > 14 hari). */
export function ringkasanBerandaAdmin(db: Db, o: { hariTerlambat?: number } = {}): RingkasanBerandaAdmin {
  const batas = o.hariTerlambat ?? 14
  const hitung = (st: string) => db.nilai<number>('SELECT COUNT(*) FROM generus WHERE dihapus = 0 AND status = ?', [st]) ?? 0
  const kini = sekarangIso()
  const perangkatAktif = { pengurus: 0, mubaligh: 0, generus: 0, wali: 0, admin: 0, kurikulum: 0, total: 0 }
  for (const p of daftarPerangkat(db)) {
    if (statusPerangkat(p, kini) !== 'aktif') continue
    perangkatAktif[p.role]++
    perangkatAktif.total++
  }
  const hariIni = tanggalHariIni()
  const setoranPerKelompok = daftarWilayah(db, { tingkat: 'kelompok' }).map((k) => {
    const terakhir =
      db.nilai<string | null>(`SELECT MAX(terakhir_setor) FROM perangkat WHERE wilayah_id = ? AND role IN ('pengurus', 'mubaligh')`, [k.id]) ?? null
    const h = hariSejak(terakhir, hariIni)
    let terlambat = h !== null && h > batas
    if (h === null) {
      const aktif =
        db.nilai<string | null>(`SELECT MIN(dibuat_pada) FROM perangkat WHERE wilayah_id = ? AND role IN ('pengurus', 'mubaligh')`, [k.id]) ?? k.dibuat_pada
      terlambat = (hariSejak(aktif, hariIni) ?? 0) > batas
    }
    return { kelompok_id: k.id, nama: k.nama, terakhir_setor: terakhir, hari_sejak: h, terlambat, belumAdaSetoran: terakhir === null }
  })
  return {
    generus: { aktif: hitung('aktif'), mondok: hitung('mondok'), total: db.nilai<number>('SELECT COUNT(*) FROM generus WHERE dihapus = 0') ?? 0 },
    perangkatAktif,
    usulanMenunggu: db.nilai<number>(`SELECT COUNT(*) FROM usulan WHERE dihapus = 0 AND status = 'menunggu'`) ?? 0,
    setoranPerKelompok,
  }
}

export interface RingkasanKelompok {
  kelompok: Pick<Wilayah, 'id' | 'nama'> | null
  generusAktif: number
  generusMondok: number
  kemajuanDiajukan: number
  usulanMenunggu: number
}

/** Ringkasan Beranda mubaligh/pengurus untuk satu kelompok. */
export function ringkasanKelompok(db: Db, kelompokId: string): RingkasanKelompok {
  const w = ambilWilayah(db, kelompokId)
  const n = (sql: string) => db.nilai<number>(sql, [kelompokId]) ?? 0
  return {
    kelompok: w ? { id: w.id, nama: w.nama } : null,
    generusAktif: n(`SELECT COUNT(*) FROM generus WHERE dihapus = 0 AND status = 'aktif' AND kelompok_id = ?`),
    generusMondok: n(`SELECT COUNT(*) FROM generus WHERE dihapus = 0 AND status = 'mondok' AND kelompok_id = ?`),
    kemajuanDiajukan: n(`SELECT COUNT(*) FROM kemajuan_belajar WHERE dihapus = 0 AND status_sah = 'diajukan' AND kelompok_id = ?`),
    usulanMenunggu: n(`SELECT COUNT(*) FROM usulan WHERE dihapus = 0 AND status = 'menunggu' AND kelompok_id = ?`),
  }
}

export interface InfoSinkronHp {
  /** Data pengurus/mubaligh yang belum dikonfirmasi admin (SETOR). */
  belumDisetor: number
  /** Catatan kemajuan generus yang belum dikonfirmasi mubaligh (BELAJAR). */
  belumDisetorBelajar: number
  terakhirSetor: string | null
  terakhirBelajar: string | null
  terakhirPaket: string | null
  terakhirBalasan: string | null
  /** Hari sejak setoran terakhir yang relevan untuk HP ini (SETOR bila ada profil pengurus/mubaligh, selain itu BELAJAR). */
  hariSejakSetor: number | null
  /** true bila ada data belum disetor dan sudah > `hariPengingat` hari (bawaan 7) atau belum pernah setor. */
  perluPengingat: boolean
  /** Hari sejak Setor Belajar terakhir (null bila belum pernah). Dipakai profil generus di HP bersama. */
  hariSejakBelajar: number | null
  /** true bila ada catatan belajar belum disetor dan Setor Belajar terakhir > `hariPengingat` hari (atau belum pernah). */
  perluPengingatBelajar: boolean
  /** v3: data yang sudah diterima tingkat atas tetapi belum dipastikan sampai di daerah (konfirmasi bertahap). */
  belumSampaiDaerah: number
  /** Fase 9b: bagian `belumDisetor` yang belum ikut berkas SETOR mana pun. */
  belumDikirim: number
  /** Fase 9b: bagian `belumDisetor` yang sudah dikirim tetapi belum dikonfirmasi tingkat atas. */
  menungguKonfirmasi: number
}

/** Indikator "Ada N data belum disetor" + pengingat setor (§12). */
export function infoSinkronHp(db: Db, o: { hariPengingat?: number } = {}): InfoSinkronHp {
  const pengurus = daftarProfil(db, ['pengurus', 'mubaligh']).length > 0
  const generus = daftarProfil(db, 'generus').length > 0
  const rinci = pengurus ? rincianBelumDisetor(db) : { belumDikirim: 0, menungguKonfirmasi: 0 }
  const belumDisetor = rinci.belumDikirim + rinci.menungguKonfirmasi
  const belumDisetorBelajar = generus ? jumlahBelumDisetorBelajar(db) : 0
  const terakhirSetor = ambilMeta(db, 'terakhir_setor') ?? null
  const terakhirBelajar = ambilMeta(db, 'terakhir_belajar') ?? null
  const relevan = pengurus ? terakhirSetor : terakhirBelajar
  // Fase 9b: yang sudah dikirim (menunggu konfirmasi) tidak lagi memicu pengingat
  const tertunda = pengurus ? rinci.belumDikirim : belumDisetorBelajar
  const h = hariSejak(relevan, tanggalHariIni())
  const batas = o.hariPengingat ?? 7
  const hb = hariSejak(terakhirBelajar, tanggalHariIni())
  return {
    belumDisetor,
    belumDisetorBelajar,
    terakhirSetor,
    terakhirBelajar,
    terakhirPaket: ambilMeta(db, 'terakhir_paket') ?? null,
    terakhirBalasan: ambilMeta(db, 'terakhir_balasan') ?? null,
    hariSejakSetor: h,
    perluPengingat: tertunda > 0 && (h === null || h > batas),
    hariSejakBelajar: hb,
    perluPengingatBelajar: belumDisetorBelajar > 0 && (hb === null || hb > batas),
    belumSampaiDaerah: pengurus ? jumlahBelumSampaiDaerah(db) : 0,
    belumDikirim: rinci.belumDikirim,
    menungguKonfirmasi: rinci.menungguKonfirmasi,
  }
}

// ---------------- kemajuan & materi ----------------

export interface KemajuanRinci extends KemajuanBelajar {
  generus_nama: string
  materi_nama: string
  materi_tipe: string
  kategori_nama: string
  bidang_nama: string
}

/** Kemajuan berstatus diajukan di kelompok beserta nama generus & materi (layar "Setoran Generus"). */
export function daftarDiajukanRinci(db: Db, kelompokId: string): KemajuanRinci[] {
  return db.kueri<KemajuanRinci>(
    `SELECT kb.*, IFNULL(g.nama, '?') AS generus_nama, IFNULL(m.nama, '(materi tidak dikenal)') AS materi_nama, IFNULL(m.tipe, '') AS materi_tipe,
            IFNULL(k.nama, '') AS kategori_nama, IFNULL(b.nama, '') AS bidang_nama
     FROM kemajuan_belajar kb
     LEFT JOIN generus g ON g.id = kb.generus_id
     LEFT JOIN materi m ON m.id = kb.materi_id
     LEFT JOIN kategori_materi k ON k.id = m.kategori_id
     LEFT JOIN bidang_materi b ON b.id = k.bidang_id
     WHERE kb.kelompok_id = ? AND kb.status_sah = 'diajukan' AND kb.dihapus = 0
     ORDER BY g.nama, kb.tanggal, kb.diubah_pada`,
    [kelompokId],
  )
}

export type StatusMateriGenerus = 'belum' | 'diajukan' | 'ditolak' | 'sedang' | 'selesai'

export interface MateriGenerus extends MateriLengkap {
  status: StatusMateriGenerus
  /** Catatan kemajuan yang menentukan status (terbaru), atau null. */
  kemajuan: KemajuanBelajar | null
  /** Termasuk target berikutnya (maks 3). */
  target: boolean
  ada_lampiran: boolean
}

export interface MateriGenerusPerBidang {
  generus: Pick<Generus, 'id' | 'nama' | 'kategori'> | null
  bidang: {
    id: string
    nama: string
    kategori: { id: string; kode: string; nama: string; materi: MateriGenerus[] }[]
  }[]
  ringkasan: { total: number; selesai: number; persen: number }
}

const PERINGKAT: Record<StatusMateriGenerus, number> = { belum: 0, ditolak: 1, diajukan: 2, sedang: 3, selesai: 4 }

function statusDari(k: KemajuanBelajar): StatusMateriGenerus {
  if (k.status_sah === 'disahkan') return k.status === 'selesai' ? 'selesai' : 'sedang'
  return k.status_sah === 'diajukan' ? 'diajukan' : 'ditolak'
}

/**
 * Materi sesuai kategori generus, dikelompokkan bidang → kategori, beserta status per materi
 * (layar "Materiku" generus & "Kemajuan" wali). Lampiran PDF tidak dimuat (pakai `ambilMateri` saat dibuka).
 */
export function materiGenerus(db: Db, generusId: string): MateriGenerusPerBidang {
  const g = ambilGenerus(db, generusId)
  const kosong: MateriGenerusPerBidang = { generus: null, bidang: [], ringkasan: { total: 0, selesai: 0, persen: 0 } }
  if (!g) return kosong
  const status = new Map<string, { status: StatusMateriGenerus; k: KemajuanBelajar }>()
  for (const k of db.kueri<KemajuanBelajar>('SELECT * FROM kemajuan_belajar WHERE generus_id = ? AND dihapus = 0 ORDER BY diubah_pada', [g.id])) {
    const s = statusDari(k)
    const ada = status.get(k.materi_id)
    // status tertinggi menang; untuk status sama, catatan terbaru
    if (!ada || PERINGKAT[s] >= PERINGKAT[ada.status]) status.set(k.materi_id, { status: s, k })
  }
  const target = new Set(targetMateriBerikutnya(db, g.id, 3).map((m) => m.id))
  const hasil: MateriGenerusPerBidang = { generus: { id: g.id, nama: g.nama, kategori: g.kategori }, bidang: [], ringkasan: { total: 0, selesai: 0, persen: 0 } }
  for (const m of daftarMateri(db, { kategoriGenerus: g.kategori })) {
    let b = hasil.bidang[hasil.bidang.length - 1]
    if (!b || b.id !== m.bidang_id) hasil.bidang.push((b = { id: m.bidang_id, nama: m.bidang_nama, kategori: [] }))
    let k = b.kategori[b.kategori.length - 1]
    if (!k || k.id !== m.kategori_id) b.kategori.push((k = { id: m.kategori_id, kode: m.kategori_kode, nama: m.kategori_nama, materi: [] }))
    const st = status.get(m.id)
    k.materi.push({ ...m, status: st?.status ?? 'belum', kemajuan: st?.k ?? null, target: target.has(m.id), ada_lampiran: !!m.lampiran_nama })
    hasil.ringkasan.total++
    if (st?.status === 'selesai') hasil.ringkasan.selesai++
  }
  const r = hasil.ringkasan
  r.persen = r.total ? Math.round((r.selesai / r.total) * 1000) / 10 : 0
  return hasil
}

// ---------------- jadwal & presensi ----------------

export interface AcaraJadwal {
  tanggal: string
  hari: string
  jam: string | null
  judul: string
  tempat: string | null
  keterangan: string | null
  jenis: 'rutin' | 'tambahan'
  pengajian_id: string | null
  jadwal_tambahan_id: string | null
  dibatalkan: boolean
}

/** Jadwal pekan (Ahad–Sabtu) yang memuat `tanggalAcuan`: pengajian rutin kelompok & induknya + jadwal tambahan. */
export function jadwalPekan(db: Db, kelompokId: string, tanggalAcuan: string = tanggalHariIni()): { mulai: string; selesai: string; acara: AcaraJadwal[] } {
  const mulai = awalPekan(tanggalAcuan)
  const selesai = akhirPekan(tanggalAcuan)
  const acara: AcaraJadwal[] = []
  const rutin = pengajianUntukKelompok(db, kelompokId)
  for (let i = 0; i < 7; i++) {
    const t = tambahHari(mulai, i)
    for (const p of rutin.filter((x) => x.hari === i)) {
      acara.push({ tanggal: t, hari: NAMA_HARI[i]!, jam: p.jam, judul: p.nama, tempat: p.tempat, keterangan: p.jenis, jenis: 'rutin', pengajian_id: p.id, jadwal_tambahan_id: null, dibatalkan: false })
    }
  }
  for (const j of daftarJadwalTambahan(db, kelompokId, { mulai, termasukBatal: true })) {
    if (j.tanggal > selesai) continue
    acara.push({
      tanggal: j.tanggal,
      hari: namaHari(j.tanggal),
      jam: j.jam,
      judul: j.judul,
      tempat: null,
      keterangan: j.keterangan,
      jenis: 'tambahan',
      pengajian_id: null,
      jadwal_tambahan_id: j.id,
      dibatalkan: !!j.dibatalkan,
    })
  }
  acara.sort((a, b) => (a.tanggal + (a.jam ?? '')).localeCompare(b.tanggal + (b.jam ?? '')))
  return { mulai, selesai, acara }
}

export interface BarisLembarPresensi {
  generus_id: string
  nama: string
  kategori: string
  jenis_kelamin: string
  status: StatusPresensi | null
  presensi_id: string | null
}

/**
 * Lembar presensi satu pertemuan: generus yang pada `tanggal` aktif & anggota kelompok itu (riwayat),
 * beserta status yang sudah tercatat (layar "Presensi"). Generus mondok/pindah tidak muncul.
 */
export function lembarPresensi(
  db: Db,
  o: { kelompokId: string; tanggal: string; pengajianId?: string | null; jadwalTambahanId?: string | null },
): BarisLembarPresensi[] {
  const ids = new Set(daftarGenerus(db, { kelompokId: o.kelompokId }).map((g) => g.id))
  for (const r of db.kueri<{ generus_id: string }>('SELECT DISTINCT generus_id FROM riwayat_keanggotaan WHERE kelompok_id = ? AND dihapus = 0', [o.kelompokId])) {
    ids.add(r.generus_id)
  }
  const peta = new PetaRiwayat(db, [...ids])
  const tercatat = new Map(
    daftarPresensi(db, { generusIds: [...ids], mulai: o.tanggal, selesai: o.tanggal })
      .filter((p) => (p.pengajian_id ?? null) === (o.pengajianId ?? null) && (p.jadwal_tambahan_id ?? null) === (o.jadwalTambahanId ?? null))
      .map((p) => [p.generus_id, p]),
  )
  return daftarGenerus(db, { ids: [...ids] })
    .filter((g) => peta.dihitung({ generus_id: g.id, kelompok_id: o.kelompokId, tanggal: o.tanggal }))
    .map((g) => {
      const p = tercatat.get(g.id)
      return { generus_id: g.id, nama: g.nama, kategori: g.kategori, jenis_kelamin: g.jenis_kelamin, status: p?.status ?? null, presensi_id: p?.id ?? null }
    })
}

// ---------------- laporan WA per kelompok ----------------

export interface LaporanWaGenerus {
  generus_id: string
  nama: string
  wali_nama: string | null
  wali_no_hp: string | null
  laporan: LaporanPekanan
  teks: string
  /** Tautan wa.me, atau null bila nomor wali kosong/tidak sah. */
  tautan: string | null
}

/** Laporan pekanan + teks WA + tautan wa.me untuk setiap generus aktif/mondok di kelompok (mubaligh, "kirim WA per wali"). */
export function laporanWaKelompok(db: Db, kelompokId: string, tanggalAcuan: string = tanggalHariIni()): LaporanWaGenerus[] {
  const hasil: LaporanWaGenerus[] = []
  for (const g of daftarGenerus(db, { kelompokId })) {
    if (g.status !== 'aktif' && g.status !== 'mondok') continue
    const laporan = laporanPekanan(db, g.id, tanggalAcuan)
    if (!laporan) continue
    const teks = teksWaLaporanPekanan(laporan)
    const sah = g.wali_no_hp ? normalNoHp(g.wali_no_hp) : ''
    hasil.push({ generus_id: g.id, nama: g.nama, wali_nama: g.wali_nama, wali_no_hp: g.wali_no_hp, laporan, teks, tautan: sah ? tautanWa(sah, teks) : null })
  }
  return hasil
}
