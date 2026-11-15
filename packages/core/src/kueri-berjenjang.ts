// Kueri layar v3 (§14): materi perlu dituntaskan, saran materi pertemuan, lembar absen, progres kelas,
// status & pengingat setor berjenjang, ringkasan beranda tiap tingkat EXE.
import type { Db } from './db'
import { profilExe } from './instalasi'
import { materiSelesaiDisahkan } from './kurikulum'
import { jadwalPekan, lembarPresensi, ringkasanBerandaAdmin, type AcaraJadwal, type RingkasanBerandaAdmin } from './kueri'
import { ambilGenerus, daftarGenerus, kategoriCocok, type Generus, type KategoriGenerus } from './repo/generus'
import { type KemajuanBelajar } from './repo/kemajuan'
import { ambilMateri } from './repo/materi'
import { ambilRekaman, ambilMeta, peranInstalasi, type PeranInstalasi } from './repo/umum'
import { kategoriKelas, type Pengajian } from './repo/pengajian'
import { daftarPerangkat } from './repo/perangkat'
import { daftarProfil } from './repo/profil'
import { ambilPertemuan, type PertemuanRinci } from './repo/pertemuan'
import { daftarTarget, jadwalSetorUntuk, periodeAktif, type ItemTargetMateri, type JadwalSetor, type TingkatAsalSetor } from './repo/target'
import { ambilWilayah, daftarWilayah, kelompokDalamWilayah, turunanWilayah, type Tingkat } from './repo/wilayah'
import { jumlahBelumDisetor, jumlahBelumSampaiDaerah, rincianBelumDisetor, tujuanSetor } from './sinkron/setor'
import { jumlahSuntinganKurikulum } from './sinkron/kurikulum'
import { sekarang, tambahHari, tanggalDariIso, tanggalHariIni, selisihHari } from './waktu'

// ---------------- materi yang perlu dituntaskan ----------------

export type StatusMateriTarget = 'belum' | 'diajukan' | 'ditolak' | 'sedang' | 'tuntas'

export interface ItemMateriTarget {
  materi_id: string
  nama: string
  tipe: string
  kategori_nama: string
  bidang_nama: string
  urutan: number
  status: StatusMateriTarget
  ada_lampiran: boolean
}

export interface MateriPerluDituntaskan {
  generus: Pick<Generus, 'id' | 'nama' | 'kategori'>
  periode: string
  /** false bila kurikulum belum menetapkan target untuk kategori & periode ini. */
  adaTarget: boolean
  total: number
  tuntas: number
  persen: number
  perluDituntaskan: ItemMateriTarget[]
  sudahTuntas: ItemMateriTarget[]
  /** Pertemuan kelas berikutnya (hari ini atau sesudahnya, 14 hari ke depan). */
  pertemuanBerikutnya: AcaraJadwal | null
}

function statusKemajuanPerMateri(db: Db, generusId: string): Map<string, StatusMateriTarget> {
  const urut: Record<StatusMateriTarget, number> = { belum: 0, ditolak: 1, diajukan: 2, sedang: 3, tuntas: 4 }
  const hasil = new Map<string, StatusMateriTarget>()
  for (const k of db.kueri<KemajuanBelajar>('SELECT * FROM kemajuan_belajar WHERE generus_id = ? AND dihapus = 0 ORDER BY diubah_pada', [generusId])) {
    const s: StatusMateriTarget =
      k.status_sah === 'disahkan' ? (k.status === 'selesai' ? 'tuntas' : 'sedang') : k.status_sah === 'diajukan' ? 'diajukan' : 'ditolak'
    const ada = hasil.get(k.materi_id)
    if (!ada || urut[s] >= urut[ada]) hasil.set(k.materi_id, s)
  }
  return hasil
}

function itemTarget(m: ItemTargetMateri, status: StatusMateriTarget): ItemMateriTarget {
  return {
    materi_id: m.id,
    nama: m.nama,
    tipe: m.tipe,
    kategori_nama: m.kategori_nama,
    bidang_nama: m.bidang_nama,
    urutan: m.urutan_target,
    status,
    ada_lampiran: !!m.lampiran_nama,
  }
}

function pengajianBerlaku(db: Db, pengajianId: string | null, kategori: string): boolean {
  if (!pengajianId) return true
  const kelas = kategoriKelas(ambilRekaman<Pengajian>(db, 'pengajian', pengajianId))
  return !kelas || kelas.includes(kategori)
}

/** Acara kelas berikutnya untuk generus (rutin sesuai kelasnya atau jadwal tambahan), mulai hari ini, maks 14 hari. */
export function pertemuanBerikutnya(db: Db, kelompokId: string, kategori: string, tanggal: string = tanggalHariIni()): AcaraJadwal | null {
  for (const acuan of [tanggal, tambahHari(tanggal, 7), tambahHari(tanggal, 14)]) {
    const a = jadwalPekan(db, kelompokId, acuan).acara.find(
      (x) => x.tanggal >= tanggal && !x.dibatalkan && pengajianBerlaku(db, x.pengajian_id, kategori),
    )
    if (a && selisihHari(tanggal, a.tanggal) <= 14) return a
  }
  return null
}

/**
 * "Materi yang perlu dituntaskan" (V4, layar pertama murid & orang tua): target periode aktif untuk kategori generus
 * dikurangi materi yang sudah disahkan tuntas, beserta persentase capaian dan pertemuan berikutnya.
 */
export function materiPerluDituntaskan(db: Db, generusId: string, o: { periode?: string; tanggal?: string } = {}): MateriPerluDituntaskan | null {
  const g = ambilGenerus(db, generusId)
  if (!g || g.dihapus) return null
  const periode = o.periode ?? periodeAktif(db, o.tanggal)
  const target = daftarTarget(db, { periode, kategoriGenerus: g.kategori })
  const status = statusKemajuanPerMateri(db, g.id)
  const perlu: ItemMateriTarget[] = []
  const sudah: ItemMateriTarget[] = []
  for (const m of target) {
    const s = status.get(m.id) ?? 'belum'
    ;(s === 'tuntas' ? sudah : perlu).push(itemTarget(m, s))
  }
  const total = target.length
  return {
    generus: { id: g.id, nama: g.nama, kategori: g.kategori },
    periode,
    adaTarget: total > 0,
    total,
    tuntas: sudah.length,
    persen: total ? Math.round((sudah.length / total) * 1000) / 10 : 0,
    perluDituntaskan: perlu,
    sudahTuntas: sudah,
    pertemuanBerikutnya: pertemuanBerikutnya(db, g.kelompok_id, g.kategori, o.tanggal ?? tanggalHariIni()),
  }
}

// ---------------- kelas: saran materi, lembar absen, progres ----------------

function normalKategori(k: string | string[] | null | undefined): string[] | null {
  if (k === null || k === undefined) return null
  const l = Array.isArray(k) ? k : [k]
  return l.length ? l : null
}

/** Generus aktif & anggota kelompok pada tanggal, sesuai kategori kelas (null = semua). */
function generusKelas(db: Db, kelompokId: string, kategori: string[] | null, tanggal: string): Generus[] {
  const ids = new Set(lembarPresensi(db, { kelompokId, tanggal }).map((b) => b.generus_id))
  return daftarGenerus(db, { kelompokId }).filter((g) => ids.has(g.id) && (!kategori || kategori.some((k) => kategoriCocok(k, g.kategori))))
}

export interface SaranMateri {
  materi_id: string
  nama: string
  kategori_nama: string
  bidang_nama: string
  urutan: number
  /** Jumlah generus kelas yang materi ini termasuk targetnya tetapi belum tuntas. */
  belumTuntas: number
  /** Jumlah generus kelas yang materi ini termasuk targetnya. */
  jumlahGenerus: number
}

/**
 * Saran materi pertemuan (V4): materi target periode aktif yang paling banyak belum tuntas di kelas itu
 * (urut: belum tuntas terbanyak, lalu urutan target). `kategori` kosong = semua kategori; `pengajianId` → kategori kelas.
 */
export function saranMateriPertemuan(
  db: Db,
  kelompokId: string,
  kategori?: string | string[] | null,
  o: { periode?: string; tanggal?: string; batas?: number; pengajianId?: string | null } = {},
): SaranMateri[] {
  const tanggal = o.tanggal ?? tanggalHariIni()
  const periode = o.periode ?? periodeAktif(db, tanggal)
  let kat = normalKategori(kategori)
  if (!kat && o.pengajianId) kat = kategoriKelas(ambilRekaman<Pengajian>(db, 'pengajian', o.pengajianId))
  const murid = generusKelas(db, kelompokId, kat, tanggal)
  const target = daftarTarget(db, { periode, kategoriGenerus: kat ?? undefined })
  const peta = new Map<string, SaranMateri>()
  const selesai = new Map(murid.map((g) => [g.id, materiSelesaiDisahkan(db, g.id)]))
  for (const m of target) {
    for (const g of murid) {
      if (!kategoriCocok(g.kategori, m.kategori_target)) continue
      const s =
        peta.get(m.id) ??
        { materi_id: m.id, nama: m.nama, kategori_nama: m.kategori_nama, bidang_nama: m.bidang_nama, urutan: m.urutan_target, belumTuntas: 0, jumlahGenerus: 0 }
      s.urutan = Math.min(s.urutan, m.urutan_target)
      s.jumlahGenerus++
      if (!selesai.get(g.id)!.has(m.id)) s.belumTuntas++
      peta.set(m.id, s)
    }
  }
  return [...peta.values()]
    .filter((s) => s.belumTuntas > 0)
    .sort((a, b) => b.belumTuntas - a.belumTuntas || a.urutan - b.urutan)
    .slice(0, o.batas ?? 3)
}

export interface BarisAbsen {
  generus_id: string
  nama: string
  kategori: KategoriGenerus
  jenis_kelamin: string
  status: string | null
  presensi_id: string | null
  /** materi pertemuan → sudah tuntas (disahkan) */
  tuntas: Record<string, boolean>
}

export interface LembarAbsenPertemuan {
  pertemuan: PertemuanRinci
  kelas: { nama: string; kategori: string[] | null }
  materi: { id: string; nama: string }[]
  baris: BarisAbsen[]
  saran: SaranMateri[]
}

/**
 * Lembar absen satu pertemuan (layar "Absen"): generus aktif & anggota pada tanggal itu sesuai kelas (kategori pengajian),
 * status presensi yang tercatat, dan status tuntas tiap materi pertemuan per generus; plus saran materi.
 */
export function lembarAbsenPertemuan(db: Db, pertemuanId: string): LembarAbsenPertemuan | null {
  const p = ambilPertemuan(db, pertemuanId)
  if (!p || p.dihapus) return null
  const pengajian = p.pengajian_id ? ambilRekaman<Pengajian>(db, 'pengajian', p.pengajian_id) : undefined
  const kat = kategoriKelas(pengajian)
  const baris = lembarPresensi(db, { kelompokId: p.kelompok_id, tanggal: p.tanggal, pengajianId: p.pengajian_id, jadwalTambahanId: p.jadwal_tambahan_id })
    .filter((b) => !kat || kat.some((k) => kategoriCocok(k, b.kategori)))
    .map((b) => {
      const selesai = materiSelesaiDisahkan(db, b.generus_id)
      return { ...b, kategori: b.kategori as KategoriGenerus, tuntas: Object.fromEntries(p.materi_ids.map((m) => [m, selesai.has(m)])) }
    })
  return {
    pertemuan: p,
    kelas: { nama: pengajian?.nama ?? 'Pertemuan tambahan', kategori: kat },
    materi: p.materi_ids.map((id) => ({ id, nama: ambilMateri(db, id)?.nama ?? id })),
    baris,
    saran: saranMateriPertemuan(db, p.kelompok_id, kat, { tanggal: p.tanggal }),
  }
}

export interface ProgresKelas {
  periode: string
  kategori: string[] | null
  materi: { materi_id: string; nama: string; kategori_generus: string; urutan: number; jumlahTuntas: number; jumlahGenerus: number }[]
  generus: { generus_id: string; nama: string; kategori: KategoriGenerus; tuntas: number; total: number; persen: number; belum: string[] }[]
  /** Rata-rata persen capaian generus kelas. */
  rataRata: number
}

/** Progres kelas (layar "Materi" mubaligh): target kurikulum per kelas + capaian tiap generus aktif. */
export function progresKelas(db: Db, kelompokId: string, kategori?: string | string[] | null, o: { periode?: string; tanggal?: string } = {}): ProgresKelas {
  const tanggal = o.tanggal ?? tanggalHariIni()
  const periode = o.periode ?? periodeAktif(db, tanggal)
  const kat = normalKategori(kategori)
  const murid = generusKelas(db, kelompokId, kat, tanggal)
  const target = daftarTarget(db, { periode, kategoriGenerus: kat ?? undefined })
  const materi = target.map((m) => ({ materi_id: m.id, nama: m.nama, kategori_generus: m.kategori_target, urutan: m.urutan_target, jumlahTuntas: 0, jumlahGenerus: 0 }))
  const generus = murid.map((g) => {
    const selesai = materiSelesaiDisahkan(db, g.id)
    const milik = target.filter((m) => kategoriCocok(m.kategori_target, g.kategori))
    const belum = milik.filter((m) => !selesai.has(m.id)).map((m) => m.id)
    for (const m of materi) {
      if (!kategoriCocok(m.kategori_generus, g.kategori)) continue
      m.jumlahGenerus++
      if (selesai.has(m.materi_id)) m.jumlahTuntas++
    }
    const total = milik.length
    const tuntas = total - belum.length
    return { generus_id: g.id, nama: g.nama, kategori: g.kategori, tuntas, total, persen: total ? Math.round((tuntas / total) * 1000) / 10 : 0, belum }
  })
  const rataRata = generus.length ? Math.round((generus.reduce((a, g) => a + g.persen, 0) / generus.length) * 10) / 10 : 0
  return { periode, kategori: kat, materi, generus, rataRata }
}

// ---------------- jadwal & status setor (V2) ----------------

interface Tenggat {
  berikut: Date
  terakhir: Date
  awalPeriode: Date
}

function jamMenit(j: JadwalSetor): [number, number] {
  const m = /^(\d{2}):(\d{2})$/.exec(j.jam ?? '')
  return m ? [Number(m[1]), Number(m[2])] : [23, 59]
}

/** Tenggat berikutnya & terakhir (jam lokal perangkat) untuk jadwal pada waktu `kini`. */
export function hitungTenggat(j: JadwalSetor, kini: Date = sekarang()): Tenggat {
  const [hh, mm] = jamMenit(j)
  if (j.pola === 'pekanan') {
    const c = new Date(kini.getFullYear(), kini.getMonth(), kini.getDate(), hh, mm, 0, 0)
    c.setDate(c.getDate() + ((Number(j.hari ?? 0) - c.getDay() + 7) % 7))
    if (c <= kini) c.setDate(c.getDate() + 7)
    const terakhir = new Date(c)
    terakhir.setDate(terakhir.getDate() - 7)
    const awal = new Date(terakhir)
    awal.setDate(awal.getDate() - 7)
    return { berikut: c, terakhir, awalPeriode: awal }
  }
  const t = Number(j.tanggal_bulan ?? 1)
  const c = new Date(kini.getFullYear(), kini.getMonth(), t, hh, mm, 0, 0)
  if (c <= kini) c.setMonth(c.getMonth() + 1)
  const terakhir = new Date(c.getFullYear(), c.getMonth() - 1, t, hh, mm, 0, 0)
  const awal = new Date(c.getFullYear(), c.getMonth() - 2, t, hh, mm, 0, 0)
  return { berikut: c, terakhir, awalPeriode: awal }
}

export interface StatusSetorBawahan {
  wilayah_id: string
  nama: string
  tingkat: Tingkat
  /** Untuk bawahan berupa perangkat (status setor HP di kelompok). */
  perangkat_id: string | null
  jadwal: Pick<JadwalSetor, 'pola' | 'hari' | 'tanggal_bulan' | 'jam'> | null
  tenggatBerikutnya: string | null
  tenggatTerakhir: string | null
  terakhirSetor: string | null
  hariSejakSetor: number | null
  /**
   * Tidak ada setoran pada periode yang berakhir di tenggat terakhir (V2). Tanpa jadwal: false.
   * Fase 9b: yang belum pernah setor baru terlambat setelah tenggat pertama sesudah perangkat/wilayah diaktifkan.
   */
  terlambat: boolean
  /** Fase 9b: belum pernah ada setoran (tampil "Belum ada setoran" kuning selama belum terlambat). */
  belumAdaSetoran: boolean
}

function maks(...l: (string | null | undefined)[]): string | null {
  return l.filter((x): x is string => !!x).sort().pop() ?? null
}

/**
 * Aturan terlambat (V2 + Fase 9b) bersama untuk statusSetor & pengingatSetor: sudah pernah setor → terlambat bila
 * setoran terakhir sebelum awal periode yang berakhir di tenggat terakhir; belum pernah setor → terlambat hanya
 * setelah tenggat pertama sesudah `aktifSejak` (waktu perangkat/wilayah diaktifkan) lewat.
 */
function hitungTerlambat(j: JadwalSetor | undefined, t: Tenggat | null, terakhir: string | null, aktifSejak: string | null, kini: Date): boolean {
  if (!j || !t) return false
  if (terakhir) return new Date(terakhir) < t.awalPeriode
  if (!aktifSejak) return true
  return kini >= hitungTenggat(j, new Date(aktifSejak)).berikut
}

function nilaiStatus(
  dasar: Pick<StatusSetorBawahan, 'wilayah_id' | 'nama' | 'tingkat' | 'perangkat_id'>,
  j: JadwalSetor | undefined,
  terakhir: string | null,
  aktifSejak: string | null,
  kini: Date,
): StatusSetorBawahan {
  const t = j ? hitungTenggat(j, kini) : null
  return {
    ...dasar,
    jadwal: j ? { pola: j.pola, hari: j.hari, tanggal_bulan: j.tanggal_bulan, jam: j.jam } : null,
    tenggatBerikutnya: t ? t.berikut.toISOString() : null,
    tenggatTerakhir: t ? t.terakhir.toISOString() : null,
    terakhirSetor: terakhir,
    hariSejakSetor: terakhir ? selisihHari(tanggalDariIso(terakhir), tanggalDariIso(kini.toISOString())) : null,
    terlambat: hitungTerlambat(j, t, terakhir, aktifSejak, kini),
    belumAdaSetoran: !terakhir,
  }
}

function minIso(...l: (string | null | undefined)[]): string | null {
  return l.filter((x): x is string => !!x).sort()[0] ?? null
}

const ROLE_PENYETOR = new Set(['pengurus', 'mubaligh', 'admin'])

/**
 * Status setor per wilayah bawahan langsung (V2): daerah → tiap desa, desa → tiap kelompok, kelompok → tiap HP
 * pengurus/mubaligh. Tenggat dari `jadwal_setor` tingkat bawahan; setor terakhir = setoran langsung ke instalasi ini
 * (atau dilaporkan lewat SETOR gabungan untuk perangkat tingkat itu).
 */
export function statusSetor(db: Db, wilayahId: string, o: { sekarang?: string } = {}): StatusSetorBawahan[] {
  const kini = o.sekarang ? new Date(o.sekarang) : sekarang()
  const w = ambilWilayah(db, wilayahId)
  if (!w) return []
  const saya = db.nilai<string>('SELECT id FROM identitas_perangkat LIMIT 1')
  const token = daftarPerangkat(db).filter((t) => ROLE_PENYETOR.has(t.role) && t.perangkat_id !== saya)
  if (w.tingkat === 'kelompok') {
    const j = jadwalSetorUntuk(db, 'kelompok')
    const perHp = new Map<string, { nama: string; terakhir: string | null; aktif: string | null }>()
    for (const t of token.filter((x) => x.wilayah_id === w.id && !x.dicabut_pada)) {
      const e = perHp.get(t.perangkat_id) ?? { nama: t.label ?? t.nama, terakhir: null, aktif: null }
      e.terakhir = maks(e.terakhir, t.terakhir_setor, t.terakhir_lapor)
      e.aktif = minIso(e.aktif, t.dibuat_pada)
      perHp.set(t.perangkat_id, e)
    }
    return [...perHp.entries()].map(([pid, e]) =>
      nilaiStatus({ wilayah_id: w.id, nama: e.nama, tingkat: 'kelompok', perangkat_id: pid }, j, e.terakhir, e.aktif, kini),
    )
  }
  return daftarWilayah(db, { indukId: w.id }).map((c) => {
    const j = jadwalSetorUntuk(db, c.tingkat as TingkatAsalSetor)
    const di = new Set(turunanWilayah(db, c.id))
    let terakhir: string | null = null
    // aktif sejak: perangkat penyetor pertama di wilayah itu terdaftar; belum ada perangkat → wilayah dibuat
    let aktif: string | null = null
    for (const t of token) {
      if (t.wilayah_id === c.id) terakhir = maks(terakhir, t.terakhir_setor, t.terakhir_lapor)
      else if (di.has(t.wilayah_id)) terakhir = maks(terakhir, t.terakhir_setor)
      if (di.has(t.wilayah_id)) aktif = minIso(aktif, t.dibuat_pada)
    }
    return nilaiStatus({ wilayah_id: c.id, nama: c.nama, tingkat: c.tingkat, perangkat_id: null }, j, terakhir, aktif ?? c.dibuat_pada, kini)
  })
}

export interface PengingatSetor {
  /** Tujuan setor HP/EXE ini. */
  tujuan: ReturnType<typeof tujuanSetor>
  tenggatBerikutnya: string | null
  terakhirSetor: string | null
  /** Data belum dikonfirmasi tingkat atas (= belumDikirim + menungguKonfirmasi). */
  belumDisetor: number
  /** Fase 9b: data yang dicatat/diterima sesudah setoran terakhir (belum ikut berkas SETOR mana pun). */
  belumDikirim: number
  /** Fase 9b: data yang sudah ikut berkas SETOR tetapi belum dikonfirmasi tingkat atas (lewat paket/balasan). */
  menungguKonfirmasi: number
  /**
   * Fase 9b: kosong = belum ada data untuk disetor; semua_disetor = semua sudah dikonfirmasi;
   * menunggu_konfirmasi = semua sudah dikirim, menunggu konfirmasi; belum_dikirim = ada data yang belum dikirim.
   */
  keadaan: 'kosong' | 'semua_disetor' | 'menunggu_konfirmasi' | 'belum_dikirim'
  /** Terlambat setor — hanya bila ada data belum disetor (Fase 9b); belum pernah setor: setelah tenggat pertama sejak aktivasi. */
  terlambat: boolean
  /** Fase 9b: belum pernah menyetor dari perangkat ini. */
  belumAdaSetoran: boolean
  /** ≤ 24 jam menuju tenggat. */
  mendekat: boolean
  /** Tampilkan tombol besar "Setor ke Desa/Kelompok" (terlambat, mendekati tenggat dengan data belum dikirim, atau belum pernah setor padahal ada data). */
  tampilkanTombol: boolean
}

/** Pengingat setor untuk HP pengurus/mubaligh dan EXE desa/kelompok (V2). Daerah/kurikulum/HP generus: null. */
export function pengingatSetor(db: Db, o: { sekarang?: string } = {}): PengingatSetor | null {
  const peran = peranInstalasi(db)
  let tingkat: TingkatAsalSetor
  if (peran === 'desa' || peran === 'kelompok') tingkat = peran
  // Fase 9: Super Admin HP menyetor ke daerah seperti EXE desa (jadwal setor desa → daerah)
  else if (peran === 'super_hp') tingkat = 'desa'
  else if (peran === 'hp' && daftarProfil(db, ['pengurus', 'mubaligh']).length) tingkat = 'kelompok'
  else return null
  const kini = o.sekarang ? new Date(o.sekarang) : sekarang()
  const j = jadwalSetorUntuk(db, tingkat)
  const terakhir = ambilMeta(db, 'terakhir_setor') ?? null
  const t = j ? hitungTenggat(j, kini) : null
  const { belumDikirim, menungguKonfirmasi } = rincianBelumDisetor(db)
  const belumDisetor = belumDikirim + menungguKonfirmasi
  const aktifSejak = minIso(...daftarProfil(db, ['pengurus', 'mubaligh', 'admin']).map((p) => p.dibuat_pada))
  // Fase 9b: tanpa data yang perlu disetor tidak ada status terlambat
  const terlambat = belumDisetor > 0 && hitungTerlambat(j, t, terakhir, aktifSejak, kini)
  const mendekat = !!t && t.berikut.getTime() - kini.getTime() <= 24 * 3600_000
  const keadaan: PengingatSetor['keadaan'] =
    belumDikirim > 0 ? 'belum_dikirim' : menungguKonfirmasi > 0 ? 'menunggu_konfirmasi' : terakhir ? 'semua_disetor' : 'kosong'
  return {
    tujuan: tujuanSetor(db),
    tenggatBerikutnya: t ? t.berikut.toISOString() : null,
    terakhirSetor: terakhir,
    belumDisetor,
    belumDikirim,
    menungguKonfirmasi,
    keadaan,
    terlambat,
    belumAdaSetoran: !terakhir,
    mendekat,
    tampilkanTombol: terlambat || (mendekat && belumDikirim > 0) || (!terakhir && belumDikirim > 0),
  }
}

/**
 * Fase 9b: kalimat jujur jumlah data setor untuk kartu setor APK/EXE — membedakan yang belum dikirim dari yang
 * sudah dikirim tetapi menunggu konfirmasi tingkat atas, dan "belum ada data" dari "semua sudah disetor".
 */
export function teksDataSetor(
  r: Pick<PengingatSetor, 'belumDikirim' | 'menungguKonfirmasi' | 'terakhirSetor'>,
  tujuan: string,
): string {
  const tunggu = `sudah dikirim, menunggu konfirmasi ${tujuan}`
  if (r.belumDikirim > 0)
    return `Ada ${r.belumDikirim} data belum disetor.${r.menungguKonfirmasi > 0 ? ` ${r.menungguKonfirmasi} data lain ${tunggu}.` : ''}`
  if (r.menungguKonfirmasi > 0) return `${r.menungguKonfirmasi} data ${tunggu}.`
  return r.terakhirSetor ? 'Semua data sudah disetor.' : 'Belum ada data untuk disetor.'
}

// ---------------- beranda tiap tingkat EXE ----------------

export interface RingkasanBerandaExe {
  peran: PeranInstalasi | null
  wilayah: { id: string; nama: string; tingkat: Tingkat } | null
  /** Status setor wilayah bawahan (daerah: desa; desa: kelompok; kelompok: HP). */
  statusSetorBawahan: StatusSetorBawahan[]
  /** Pengingat setor ke atas (desa/kelompok). */
  pengingat: PengingatSetor | null
  /** Data belum dikonfirmasi tingkat atas / belum dipastikan sampai daerah (desa/kelompok). */
  belumDisetor: number
  belumSampaiDaerah: number
  generus: { aktif: number; mondok: number }
  perangkatAktif: number
  usulanMenunggu: number
  kemajuanDiajukan: number
  terakhirPaket: string | null
  /** Daerah: ringkasan beranda admin lama (§11.2). */
  admin?: RingkasanBerandaAdmin
  /** Kurikulum: periode aktif, jumlah target, suntingan belum dikirim. */
  kurikulum?: { periode: string; jumlahTarget: number; suntinganBelumDikirim: number; terakhirKirim: string | null }
}

/** Ringkasan Beranda EXE sesuai peran instalasi (daerah/desa/kelompok/kurikulum). */
export function ringkasanBerandaExe(db: Db, o: { sekarang?: string } = {}): RingkasanBerandaExe {
  const peran = peranInstalasi(db)
  let wilayahId: string | null = null
  if (peran === 'daerah' || peran === 'kurikulum') {
    wilayahId = db.nilai<string>(`SELECT id FROM wilayah WHERE tingkat = 'daerah' AND dihapus = 0 ORDER BY dibuat_pada LIMIT 1`) ?? null
    if (peran === 'kurikulum') wilayahId = ambilMeta(db, 'wilayah_instalasi') ?? wilayahId
  } else if (peran === 'desa' || peran === 'kelompok' || peran === 'super_hp') {
    wilayahId = profilExe(db).wilayah_id
  }
  const bawahAtas = peran === 'desa' || peran === 'kelompok' || peran === 'super_hp'
  const w = wilayahId ? ambilWilayah(db, wilayahId) : undefined
  const kel = w ? kelompokDalamWilayah(db, w.id) : []
  const diKel = (sql: string) => (kel.length ? (db.nilai<number>(sql.replace('(?)', `(${kel.map(() => '?').join(',')})`), kel) ?? 0) : 0)
  const turunan = new Set(w ? turunanWilayah(db, w.id) : [])
  const hasil: RingkasanBerandaExe = {
    peran,
    wilayah: w ? { id: w.id, nama: w.nama, tingkat: w.tingkat } : null,
    statusSetorBawahan: w && peran !== 'kurikulum' ? statusSetor(db, w.id, o) : [],
    pengingat: pengingatSetor(db, o),
    belumDisetor: bawahAtas ? jumlahBelumDisetor(db) : 0,
    belumSampaiDaerah: bawahAtas ? jumlahBelumSampaiDaerah(db) : 0,
    generus: {
      aktif: diKel(`SELECT COUNT(*) FROM generus WHERE dihapus = 0 AND status = 'aktif' AND kelompok_id IN (?)`),
      mondok: diKel(`SELECT COUNT(*) FROM generus WHERE dihapus = 0 AND status = 'mondok' AND kelompok_id IN (?)`),
    },
    perangkatAktif: daftarPerangkat(db, { aktifSaja: true }).filter((p) => turunan.has(p.wilayah_id)).length,
    usulanMenunggu: diKel(`SELECT COUNT(*) FROM usulan WHERE dihapus = 0 AND status = 'menunggu' AND kelompok_id IN (?)`),
    kemajuanDiajukan: diKel(`SELECT COUNT(*) FROM kemajuan_belajar WHERE dihapus = 0 AND status_sah = 'diajukan' AND kelompok_id IN (?)`),
    terakhirPaket: ambilMeta(db, 'terakhir_paket') ?? null,
  }
  if (peran === 'daerah') hasil.admin = ringkasanBerandaAdmin(db)
  if (peran === 'kurikulum') {
    const periode = periodeAktif(db)
    hasil.kurikulum = {
      periode,
      jumlahTarget: daftarTarget(db, { periode }).length,
      suntinganBelumDikirim: jumlahSuntinganKurikulum(db),
      terakhirKirim: ambilMeta(db, 'terakhir_kurikulum') ?? null,
    }
  }
  return hasil
}

// ---------------- rekap capaian target (Fase 6, layar Rekap EXE) ----------------

export interface BarisCapaian {
  wilayah_id: string
  nama: string
  /** Generus aktif & anggota pada tanggal rekap. */
  jumlahGenerus: number
  /** Pasangan (generus × materi target) yang sudah tuntas disahkan. */
  tuntas: number
  /** Pasangan (generus × materi target) keseluruhan; 0 = belum ada target untuk generusnya. */
  total: number
  persen: number
}

export interface BarisCapaianKelas extends BarisCapaian {
  kelompok_id: string
  kelompok_nama: string
  kategori: KategoriGenerus
}

export interface BarisCapaianGenerus {
  generus_id: string
  nama: string
  kelompok_id: string
  kelompok_nama: string
  kategori: KategoriGenerus
  tuntas: number
  total: number
  persen: number
}

export interface RekapCapaian {
  periode: string
  wilayah: BarisCapaian
  perDesa: BarisCapaian[]
  perKelompok: BarisCapaian[]
  /** Kelas = kategori generus di satu kelompok. */
  perKelas: BarisCapaianKelas[]
  perGenerus: BarisCapaianGenerus[]
}

const persenDari = (tuntas: number, total: number) => (total ? Math.round((tuntas / total) * 1000) / 10 : 0)

/**
 * Rekap capaian target kurikulum (persentase tuntas) per kelas (kategori di kelompok), kelompok, desa, dan seluruh
 * wilayah — dibangun dari `progresKelas`. Persen = materi target yang tuntas disahkan ÷ seluruh materi target generus.
 */
export function rekapCapaian(db: Db, o: { wilayahId: string; periode?: string; tanggal?: string }): RekapCapaian {
  const tanggal = o.tanggal ?? tanggalHariIni()
  const periode = o.periode ?? periodeAktif(db, tanggal)
  const w = ambilWilayah(db, o.wilayahId)
  const baris = (id: string, nama: string): BarisCapaian => ({ wilayah_id: id, nama, jumlahGenerus: 0, tuntas: 0, total: 0, persen: 0 })
  const semua = baris(o.wilayahId, w?.nama ?? '')
  const perDesa = new Map<string, BarisCapaian>()
  const perKelompok: BarisCapaian[] = []
  const perKelas: BarisCapaianKelas[] = []
  const perGenerus: BarisCapaianGenerus[] = []
  const tambah = (b: BarisCapaian, tuntas: number, total: number) => {
    b.jumlahGenerus++
    b.tuntas += tuntas
    b.total += total
  }
  for (const kid of w ? kelompokDalamWilayah(db, w.id) : []) {
    const k = ambilWilayah(db, kid)
    if (!k || k.dihapus) continue
    const desaId = k.induk_id && ambilWilayah(db, k.induk_id)?.tingkat === 'desa' ? k.induk_id : null
    const desa = desaId ? (perDesa.get(desaId) ?? baris(desaId, ambilWilayah(db, desaId)!.nama)) : null
    if (desa && desaId) perDesa.set(desaId, desa)
    const bk = baris(k.id, k.nama)
    const kelas = new Map<string, BarisCapaianKelas>()
    for (const g of progresKelas(db, k.id, null, { periode, tanggal }).generus) {
      const c = kelas.get(g.kategori) ?? { ...baris(k.id, k.nama), kelompok_id: k.id, kelompok_nama: k.nama, kategori: g.kategori }
      kelas.set(g.kategori, c)
      for (const b of [c, bk, semua, ...(desa ? [desa] : [])]) tambah(b, g.tuntas, g.total)
      perGenerus.push({ generus_id: g.generus_id, nama: g.nama, kelompok_id: k.id, kelompok_nama: k.nama, kategori: g.kategori, tuntas: g.tuntas, total: g.total, persen: g.persen })
    }
    perKelompok.push(bk)
    perKelas.push(...[...kelas.values()].sort((a, b) => a.kategori.localeCompare(b.kategori)))
  }
  const akhiri = <T extends BarisCapaian>(b: T): T => ({ ...b, persen: persenDari(b.tuntas, b.total) })
  return {
    periode,
    wilayah: akhiri(semua),
    perDesa: [...perDesa.values()].map(akhiri),
    perKelompok: perKelompok.map(akhiri),
    perKelas: perKelas.map(akhiri),
    perGenerus,
  }
}
