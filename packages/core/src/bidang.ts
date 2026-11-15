// §17 — Kepengurusan PPG per jabatan: catatan bidang (notulen, kas, inventaris, agenda, konseling, tahfidz, kontrol MT, …),
// enkripsi data rahasia per penerima (kunci bidang), dan kueri tiap jabatan (ketua, sekretaris, bendahara, kurikulum/reward,
// tenaga pendidik, tahfidz, PJ desa).
import { daftarKunciBidang, type KunciAdmin } from './admin'
import { dekompresJson, kompresJson } from './berkas'
import { bukaSegel, dariB64url, keB64url, segelKe } from './crypto'
import type { Db } from './db'
import { GalatPpg } from './galat'
import { DAFTAR_KODE_KEAKTIFAN, raporGenerus } from './juknis'
import {
  GROUP_PEMBINAAN,
  JENIS_CATATAN,
  type BidangRahasia,
  type Jabatan,
  type JenisCatatan,
} from './kepengurusan'
import { ambilGenerus, daftarGenerus, KATEGORI_GENERUS, type KategoriGenerus } from './repo/generus'
import { daftarProfil, statusProfil, type Profil } from './repo/profil'
import { periodeAktif } from './repo/target'
import { adalahAdmin, ambilRekaman, idPerangkatLokal, sisipkanRekaman, tandaTanya, ubahRekaman, uraiJson, type RekamanDasar } from './repo/umum'
import { ambilWilayah, daftarWilayah, kelompokDalamWilayah } from './repo/wilayah'
import { rekapKeaktifanBulan, rekapLaporanBulanan, UNSUR_NUNGGONI } from './rekap-juknis'
import { uraiToken, type KunciBidang } from './token'
import { tanggalHariIni, tanggalSah } from './waktu'

// =====================================================================================================================
// Jabatan pada profil/token
// =====================================================================================================================

/** Jabatan pada teks token (kosong bila tidak ada / token rusak). */
export function jabatanToken(teks: string): Jabatan[] {
  try {
    return uraiToken(teks).payload.jabatan ?? []
  } catch {
    return []
  }
}

export function jabatanProfil(p: Pick<Profil, 'token'>): Jabatan[] {
  return jabatanToken(p.token)
}

/** Profil pengurus aktif (boleh mencatat) di HP ini yang memegang salah satu jabatan. */
export function profilBerjabatan(db: Db, jabatan: readonly Jabatan[]): Profil | undefined {
  return daftarProfil(db, 'pengurus').find((p) => statusProfil(p).bolehMencatat && jabatanProfil(p).some((j) => jabatan.includes(j)))
}

// =====================================================================================================================
// Validasi isi catatan per jenis
// =====================================================================================================================

export const AKUN_KAS = ['tabungan_desa', 'dana_masuk', 'musyawarah', 'kegiatan', 'reward', 'pengadaan', 'ckm', 'lain'] as const
export const PERUNTUKAN_TABUNGAN = ['mumi_daerah', 'ppg_ckm', 'dikembalikan_desa'] as const
export const KONDISI_SARPRAS = ['baik', 'rusak_ringan', 'rusak_berat'] as const
export const PENDIDIKAN = ['sekolah', 'lulus_smp', 'lulus_sma', 'tidak_sekolah', 'dropout', 'kuliah', 'bekerja'] as const
export const JENIS_MUSYAWARAH = ['bersama', 'muda_mudi', 'desa', 'kelompok', 'lain'] as const

const MAKS_TEKS = 5000
const MAKS_RUPIAH = 1_000_000_000_000

type Isi = Record<string, unknown>
const teks = (v: unknown, wajib = false) => (v === undefined || v === null || v === '' ? !wajib : typeof v === 'string' && v.length <= MAKS_TEKS && (!wajib || !!v.trim()))
const bulat = (v: unknown, min = 0, max = MAKS_RUPIAH) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
const salahSatu = (v: unknown, daftar: readonly string[]) => typeof v === 'string' && daftar.includes(v)
const tanggalOpsional = (v: unknown) => v === undefined || v === null || v === '' || tanggalSah(v)

/** Pemeriksaan isi catatan per jenis (dipakai saat menyimpan, membaca, dan impor). Kembalikan alasan atau null. */
export function alasanIsiCatatan(jenis: string, isi: unknown): string | null {
  if (!(jenis in JENIS_CATATAN)) return 'Jenis catatan tidak dikenal.'
  if (!isi || typeof isi !== 'object' || Array.isArray(isi)) return 'Isi catatan tidak sah.'
  const x = isi as Isi
  for (const [k, v] of Object.entries(x)) if (typeof v === 'string' && v.length > MAKS_TEKS) return `Isian ${k} terlalu panjang.`
  switch (jenis as JenisCatatan) {
    case 'notulen':
      if (!salahSatu(x.jenis_musyawarah, JENIS_MUSYAWARAH)) return 'Jenis musyawarah tidak dikenal.'
      return teks(x.hasil, true) ? null : 'Hasil musyawarah wajib diisi.'
    case 'kas':
      if (!salahSatu(x.arah, ['masuk', 'keluar'])) return 'Arah kas harus masuk atau keluar.'
      if (!bulat(x.jumlah, 1)) return 'Jumlah harus rupiah bulat lebih dari 0.'
      if (!salahSatu(x.akun, AKUN_KAS)) return 'Akun kas tidak dikenal.'
      return teks(x.keterangan) ? null : 'Keterangan tidak sah.'
    case 'target_tabungan':
      if (typeof x.desa_id !== 'string' || !x.desa_id) return 'Desa wajib dipilih.'
      if (!bulat(x.nominal)) return 'Nominal harus rupiah bulat.'
      return salahSatu(x.peruntukan, PERUNTUKAN_TABUNGAN) ? null : 'Peruntukan tabungan tidak dikenal.'
    case 'dana_masuk':
      if (!salahSatu(x.sumber, ['wali', 'aghniya', 'lain'])) return 'Sumber dana tidak dikenal.'
      if (!bulat(x.jumlah, 1)) return 'Jumlah harus rupiah bulat lebih dari 0.'
      return teks(x.dari) && teks(x.keterangan) ? null : 'Keterangan tidak sah.'
    case 'konseling':
      if (!salahSatu(x.sasaran, ['generus', 'pendidik', 'orang_tua'])) return 'Sasaran konseling tidak dikenal.'
      return teks(x.masalah, true) && teks(x.nama) && teks(x.tindak_lanjut) && teks(x.kategori) ? null : 'Masalah wajib diisi.'
    case 'mubaligh':
      if (!teks(x.nama, true)) return 'Nama mubaligh wajib diisi.'
      if (!salahSatu(x.jenis, ['tugasan', 'setempat'])) return 'Jenis mubaligh harus tugasan atau setempat.'
      if (!salahSatu(x.jenis_kelamin, ['L', 'P'])) return 'Jenis kelamin harus L atau P.'
      if (typeof x.kelompok_id !== 'string') return 'Kelompok penugasan wajib dipilih.'
      return tanggalOpsional(x.mulai) ? null : 'Tanggal mulai tidak sah.'
    case 'kebutuhan_pengajar':
      if (typeof x.kelompok_id !== 'string') return 'Kelompok wajib dipilih.'
      return bulat(x.kebutuhan, 0, 100) ? null : 'Kebutuhan pengajar 0–100 orang.'
    case 'program_sdm':
    case 'agenda_muda_mudi':
    case 'agenda_olahraga':
    case 'agenda_kemandirian':
    case 'agenda_keputrian':
      if (!teks(x.judul, true)) return 'Judul kegiatan wajib diisi.'
      if (!tanggalOpsional(x.tanggal)) return 'Tanggal kegiatan tidak sah.'
      if (x.kode_keaktifan !== undefined && x.kode_keaktifan !== null && !salahSatu(x.kode_keaktifan, DAFTAR_KODE_KEAKTIFAN)) return 'Kode keaktifan tidak dikenal.'
      if (x.peserta !== undefined && (!Array.isArray(x.peserta) || x.peserta.some((p) => typeof p !== 'string') || x.peserta.length > 2000)) return 'Daftar peserta tidak sah.'
      return null
    case 'kontrol_mt': {
      if (typeof x.bulan !== 'string' || !/^\d{4}-\d{2}$/.test(x.bulan)) return 'Bulan tidak sah.'
      if (!x.hari || typeof x.hari !== 'object') return 'Isi harian tidak sah.'
      for (const [h, v] of Object.entries(x.hari as Isi)) {
        if (!/^(0[1-9]|[12]\d|3[01])$/.test(h) || !v || typeof v !== 'object') return 'Tanggal kontrol tidak sah.'
        const d = v as Isi
        for (const k of ['subuh', 'tahajud', 'dhuha']) if (d[k] !== undefined && typeof d[k] !== 'boolean') return 'Centang sholat tidak sah.'
        if (d.hafalan !== undefined && !bulat(d.hafalan, 0, 20)) return 'Kolom hafalan 0–20 per hari.'
        if (!teks(d.tadarus)) return 'Catatan tadarus tidak sah.'
      }
      return null
    }
    case 'inventaris':
      if (typeof x.kelompok_id !== 'string') return 'Kelompok wajib dipilih.'
      if (!teks(x.barang, true)) return 'Nama barang wajib diisi.'
      if (!bulat(x.jumlah, 0, 100000)) return 'Jumlah barang tidak sah.'
      if (!salahSatu(x.kondisi, KONDISI_SARPRAS)) return 'Kondisi harus baik, rusak ringan, atau rusak berat.'
      return tanggalOpsional(x.dicek_pada) ? null : 'Tanggal pengecekan tidak sah.'
    case 'usulan_pengadaan':
      if (typeof x.kelompok_id !== 'string') return 'Kelompok wajib dipilih.'
      if (!teks(x.barang, true)) return 'Nama barang wajib diisi.'
      if (!bulat(x.jumlah, 1, 100000)) return 'Jumlah barang tidak sah.'
      return x.perkiraan_biaya === undefined || x.perkiraan_biaya === null || bulat(x.perkiraan_biaya) ? null : 'Perkiraan biaya harus rupiah bulat.'
    case 'group_pembinaan':
      if (!salahSatu(x.group, GROUP_PEMBINAAN)) return 'Nama group tidak dikenal.'
      for (const k of ['pembina1', 'pembina2', 'ketua', 'wakil', 'wakil_mt']) if (!teks(x[k])) return `Isian ${k} tidak sah.`
      return Array.isArray(x.anggota) && x.anggota.length <= 500 && x.anggota.every((a) => typeof a === 'string' && a.length <= 100) ? null : 'Daftar anggota tidak sah.'
    case 'data_kemandirian':
      if (typeof x.generus_id !== 'string') return 'Generus wajib dipilih.'
      return salahSatu(x.pendidikan, PENDIDIKAN) && teks(x.bakat) && teks(x.minat) ? null : 'Status pendidikan tidak dikenal.'
    case 'info_kerja':
      return teks(x.judul, true) && teks(x.isi, true) && teks(x.kontak) ? null : 'Judul & isi info kerja wajib diisi.'
    case 'peserta_tahfidz':
      return typeof x.generus_id === 'string' && teks(x.target) ? null : 'Generus wajib dipilih.'
    case 'ujian_tahfidz':
      if (typeof x.generus_id !== 'string') return 'Generus wajib dipilih.'
      if (!Array.isArray(x.lulus) || x.lulus.some((i) => !bulat(i, 0, SURAT_TAHFIDZ.length - 1)) || new Set(x.lulus).size !== x.lulus.length) return 'Daftar surat lulus tidak sah.'
      return teks(x.penguji1) && teks(x.penguji2) ? null : 'Nama penguji tidak sah.'
    case 'nunggoni':
      if (typeof x.kelompok_id !== 'string') return 'Kelompok wajib dipilih.'
      if (x.unsur !== undefined && x.unsur !== null && !salahSatu(x.unsur, UNSUR_NUNGGONI)) return 'Unsur tidak dikenal.'
      return teks(x.kelas) && teks(x.temuan) ? null : 'Isian tidak sah.'
  }
  return null
}

// =====================================================================================================================
// Tahfidz — lembar penilaian berpoin (51 surat, 2 penguji)
// =====================================================================================================================

const S = (nama: string, poin: number) => ({ nama, poin })
/** Surat & poin lembar "Evaluasi Penguasaan Target Tahfidzul Qur'an". */
export const SURAT_TAHFIDZ: readonly { nama: string; poin: number }[] = [
  ...['An Naas', 'Al Falaq', 'Al Ikhlas', 'Al Lahab', 'An Nasr', 'Al Kafirun', 'Al Kautsar', "Al Ma'un", 'Al Quraisy', 'Al Fiil', 'Al Humazah', 'Al Ashr', 'At Takasur', "Al Qori'ah", 'Al Adiyat', 'Az Zalzalah'].map((n) => S(n, 2)),
  ...['Al Bayyinah', 'Al Qodr', 'Al Alaq', 'At Tiin', 'As Syarh', 'Ad Dhuha', 'Al Lail', 'As Syams'].map((n) => S(n, 3)),
  ...['Al Balad', 'Al Fajr', 'Al Ghosyiah', "Al A'la", 'At Toriq', 'Al Buruj', 'Al Insyiqoq', 'Al Mutoffifin', 'Al Infitor', 'At Takwir', 'Abasa', 'An Naziat', 'An Naba'].map((n) => S(n, 4)),
  S('Al Mulk', 6), S('Yasin', 8), S('Ad Dukhon', 6), S('As Sajdah', 6), S('Ar Rohman', 6), S("Al Waqi'ah", 6),
  ...['Ayat Kursi 255', 'Akhir Al Baqoroh 284–286', 'Al Kahfi 1–10', 'Awal Al Mukminun 1–11', 'Akhir Al Mukminun 115–118', 'An Nuur ayat 35', 'Akhir Al Hasyr', 'Akhir As Soof'].map((n) => S(n, 3)),
]
export const POIN_TAHFIDZ_MAKS = SURAT_TAHFIDZ.reduce((s, x) => s + x.poin, 0)

/** Total poin surat yang lulus ujian. */
export function poinTahfidz(lulus: readonly number[]): number {
  return [...new Set(lulus)].reduce((s, i) => s + (SURAT_TAHFIDZ[i]?.poin ?? 0), 0)
}

// =====================================================================================================================
// Simpan & baca catatan
// =====================================================================================================================

export interface CatatanBidang extends RekamanDasar {
  wilayah_id: string
  bidang: string
  jenis: JenisCatatan
  tanggal: string
  judul: string | null
  isi_json: string | null
  isi_rahasia: string | null
  versi_kunci: number | null
  rujukan_id: string | null
}

/** Catatan yang sudah diurai: `isi` null bila rahasia dan HP/EXE ini tidak memegang kunci bacanya. */
export type CatatanTerbaca = Omit<CatatanBidang, 'isi_json' | 'isi_rahasia'> & { isi: Isi | null; terkunci: boolean }

/** Kunci bidang yang dipegang profil-profil HP ini (semua versi). */
function kunciBidangHp(db: Db, bidang: BidangRahasia): KunciBidang[] {
  const peta = new Map<number, KunciBidang>()
  for (const p of daftarProfil(db, 'pengurus')) for (const k of p.rahasia.kunci_bidang ?? []) if (k.bidang === bidang) peta.set(k.versi, k)
  return [...peta.values()].sort((a, b) => a.versi - b.versi)
}

/** Kunci publik terbaru bidang rahasia untuk menulis (HP: dari token; daerah: tabel kunci_bidang). */
function kunciTulis(db: Db, bidang: BidangRahasia): { versi: number; publik: string } {
  if (adalahAdmin(db)) {
    const r = db.satu<{ versi: number; publik: string }>('SELECT versi, publik FROM kunci_bidang WHERE bidang = ? ORDER BY versi DESC LIMIT 1', [bidang])
    if (r) return r
  } else {
    const k = kunciBidangHp(db, bidang).pop()
    if (k) return { versi: k.versi, publik: k.publik }
  }
  throw new GalatPpg('KUNCI_BIDANG_TIDAK_ADA', 'Kunci bidang belum ada. Minta token jabatan terbaru dari EXE Daerah.')
}

export interface DataCatatan {
  jenis: JenisCatatan
  isi: Isi
  /** Bawaan: kelompok dalam isi (`kelompok_id`), atau wilayah profil penulis. */
  wilayahId?: string
  tanggal?: string
  judul?: string | null
  rujukanId?: string | null
  /** Id tetap (memperbarui catatan yang sama). */
  id?: string
}

/** Wilayah pencatat & wewenang menulis jenis ini di HP/EXE ini. */
function pastikanPenulis(db: Db, jenis: JenisCatatan, wilayahIsi: string | undefined): string {
  const meta = JENIS_CATATAN[jenis]!
  if (adalahAdmin(db)) {
    if (meta.penulis === 'mubaligh') throw new GalatPpg('TIDAK_BERWENANG', 'Kontrol keaktifan MT diisi mubaligh sendiri.')
    const d = daftarWilayah(db, { tingkat: 'daerah' })[0]
    return wilayahIsi ?? d?.id ?? ''
  }
  if (meta.penulis === 'mubaligh') {
    const m = daftarProfil(db, 'mubaligh').find((p) => statusProfil(p).bolehMencatat)
    if (!m) throw new GalatPpg('TIDAK_BERWENANG', 'Hanya mubaligh yang mengisi kontrol keaktifan MT.')
    return m.wilayah_id
  }
  if (meta.penulis === 'semua') {
    const p = daftarProfil(db, ['pengurus', 'mubaligh']).find((x) => statusProfil(x).bolehMencatat)
    if (!p) throw new GalatPpg('TIDAK_BERWENANG', 'Profil pengurus/mubaligh tidak ada di HP ini.')
    return wilayahIsi ?? p.wilayah_id
  }
  const p = profilBerjabatan(db, meta.penulis)
  if (!p) throw new GalatPpg('TIDAK_BERWENANG', `Catatan "${meta.nama}" hanya untuk jabatan yang berwenang.`)
  return wilayahIsi ?? p.wilayah_id
}

/** Simpan catatan bidang; isi rahasia dienkripsi ke kunci bidang (penulis tanpa kunci baca tetap bisa menulis). */
export function simpanCatatan(db: Db, d: DataCatatan): CatatanBidang {
  const meta = JENIS_CATATAN[d.jenis]
  if (!meta) throw new GalatPpg('JENIS_TIDAK_SAH', 'Jenis catatan tidak dikenal.')
  const alasan = alasanIsiCatatan(d.jenis, d.isi)
  if (alasan) throw new GalatPpg('CATATAN_TIDAK_SAH', alasan)
  if (d.jenis === 'agenda_keputrian' && Array.isArray(d.isi.peserta)) {
    for (const id of d.isi.peserta as string[]) {
      const g = ambilGenerus(db, id)
      if (g && g.jenis_kelamin !== 'P') throw new GalatPpg('CATATAN_TIDAK_SAH', 'Peserta keputrian hanya generus putri.')
    }
  }
  const kel = typeof d.isi.kelompok_id === 'string' ? d.isi.kelompok_id : undefined
  if (kel && !ambilWilayah(db, kel)) throw new GalatPpg('WILAYAH_TIDAK_SAH', 'Kelompok tidak ditemukan.')
  const wilayah = pastikanPenulis(db, d.jenis, d.wilayahId ?? kel)
  const tanggal = d.tanggal ?? tanggalHariIni()
  if (!tanggalSah(tanggal)) throw new GalatPpg('TANGGAL_TIDAK_SAH', 'Tanggal tidak sah.')
  const rek: Record<string, unknown> = {
    wilayah_id: wilayah,
    bidang: meta.bidang,
    jenis: d.jenis,
    tanggal,
    judul: d.judul?.trim() || null,
    isi_json: null,
    isi_rahasia: null,
    versi_kunci: null,
    rujukan_id: d.rujukanId ?? null,
  }
  if (meta.rahasia) {
    const k = kunciTulis(db, meta.rahasia)
    rek.isi_rahasia = keB64url(segelKe(dariB64url(k.publik), kompresJson(d.isi)))
    rek.versi_kunci = k.versi
  } else rek.isi_json = JSON.stringify(d.isi)
  if (d.id && ambilRekaman(db, 'catatan_bidang', d.id)) return ubahRekaman<CatatanBidang>(db, 'catatan_bidang', d.id, { ...rek, dihapus: 0 })
  return sisipkanRekaman<CatatanBidang>(db, 'catatan_bidang', rek, d.id ? { id: d.id } : {})
}

/** Hapus (lunak) catatan bidang milik jabatan yang berwenang. */
export function hapusCatatan(db: Db, id: string): void {
  const c = ambilRekaman<CatatanBidang>(db, 'catatan_bidang', id)
  if (!c || c.dihapus) throw new GalatPpg('TIDAK_DITEMUKAN', 'Catatan tidak ditemukan.')
  pastikanPenulis(db, c.jenis, c.wilayah_id)
  ubahRekaman(db, 'catatan_bidang', id, { dihapus: 1 })
}

/**
 * Buka isi rahasia. HP: kunci bidang dari profil berjabatan pembaca. EXE daerah: hanya bidang KEUANGAN (dengan KunciAdmin);
 * catatan KONSELING tidak pernah dibuka di EXE (J-K5).
 */
function bukaIsi(db: Db, c: CatatanBidang, kunciAdmin?: KunciAdmin): Isi | null {
  if (c.isi_json !== null && c.isi_json !== undefined) return uraiJson<Isi | null>(c.isi_json, null)
  if (!c.isi_rahasia) return null
  const bidang = JENIS_CATATAN[c.jenis]?.rahasia
  if (!bidang) return null
  let kunci: { publik: string; rahasia: string } | undefined
  if (adalahAdmin(db)) {
    if (bidang !== 'keuangan' || !kunciAdmin) return null
    kunci = bacaKunciDaerah(db, kunciAdmin, bidang, Number(c.versi_kunci))
  } else kunci = kunciBidangHp(db, bidang).find((k) => k.versi === Number(c.versi_kunci))
  if (!kunci) return null
  try {
    const isi = dekompresJson<Isi>(bukaSegel(dariB64url(c.isi_rahasia), { publik: dariB64url(kunci.publik), rahasia: dariB64url(kunci.rahasia) }))
    return alasanIsiCatatan(c.jenis, isi) ? null : isi
  } catch {
    return null
  }
}

function bacaKunciDaerah(db: Db, k: KunciAdmin, bidang: BidangRahasia, versi: number): { publik: string; rahasia: string } | undefined {
  return daftarKunciBidang(db, k, bidang).find((x) => x.versi === versi)
}

/** Daftar catatan bidang (urut tanggal terbaru), isi terurai bila bisa dibaca. */
export function daftarCatatan(
  db: Db,
  f: { jenis?: JenisCatatan | JenisCatatan[]; wilayahIds?: string[]; mulai?: string; selesai?: string; kunciAdmin?: KunciAdmin } = {},
): CatatanTerbaca[] {
  const s = ['dihapus = 0']
  const p: string[] = []
  const jenis = f.jenis === undefined ? undefined : Array.isArray(f.jenis) ? f.jenis : [f.jenis]
  if (jenis) {
    if (!jenis.length) return []
    s.push(`jenis IN (${tandaTanya(jenis.length)})`)
    p.push(...jenis)
  }
  if (f.wilayahIds) {
    if (!f.wilayahIds.length) return []
    s.push(`wilayah_id IN (${tandaTanya(f.wilayahIds.length)})`)
    p.push(...f.wilayahIds)
  }
  if (f.mulai) (s.push('tanggal >= ?'), p.push(f.mulai))
  if (f.selesai) (s.push('tanggal <= ?'), p.push(f.selesai))
  return db.kueri<CatatanBidang>(`SELECT * FROM catatan_bidang WHERE ${s.join(' AND ')} ORDER BY tanggal DESC, diubah_pada DESC`, p).map((c) => {
    const { isi_json, isi_rahasia, ...lain } = c
    void isi_json
    const isi = bukaIsi(db, c, f.kunciAdmin)
    return { ...lain, isi, terkunci: !!isi_rahasia && isi === null }
  })
}

// =====================================================================================================================
// Kueri per jabatan
// =====================================================================================================================

export interface RingkasanKas {
  dapatDibaca: boolean
  masuk: number
  keluar: number
  saldo: number
  perAkun: Record<string, { masuk: number; keluar: number }>
  /** Dana masuk penggalang dana yang belum dikonfirmasi bendahara (belum ada kas berujukan). */
  danaMenunggu: CatatanTerbaca[]
  /** Tabungan desa bulan ini: target vs setoran. */
  tabungan: { desa_id: string; desa: string; peruntukan: string; target: number; disetor: number }[]
  terkunci: number
}

/** Buku kas & tabungan desa (bendahara/ketua/penggalang dana di HP; EXE daerah dengan KunciAdmin). */
export function ringkasanKas(db: Db, o: { bulan?: string; kunciAdmin?: KunciAdmin } = {}): RingkasanKas {
  const bulan = o.bulan ?? tanggalHariIni().slice(0, 7)
  const semua = daftarCatatan(db, { jenis: ['kas', 'dana_masuk', 'target_tabungan'], kunciAdmin: o.kunciAdmin })
  const kas = semua.filter((c) => c.jenis === 'kas' && c.isi)
  const r: RingkasanKas = { dapatDibaca: !semua.some((c) => c.terkunci), masuk: 0, keluar: 0, saldo: 0, perAkun: {}, danaMenunggu: [], tabungan: [], terkunci: semua.filter((c) => c.terkunci).length }
  for (const c of kas) {
    const x = c.isi as { arah: 'masuk' | 'keluar'; jumlah: number; akun: string }
    const a = (r.perAkun[x.akun] ??= { masuk: 0, keluar: 0 })
    a[x.arah] += x.jumlah
    r[x.arah] += x.jumlah
  }
  r.saldo = r.masuk - r.keluar
  const dikonfirmasi = new Set(kas.map((c) => c.rujukan_id).filter(Boolean))
  r.danaMenunggu = semua.filter((c) => c.jenis === 'dana_masuk' && c.isi && !dikonfirmasi.has(c.id))
  // target terbaru per (desa, peruntukan)
  const target = new Map<string, { desa_id: string; peruntukan: string; nominal: number }>()
  for (const c of [...semua].reverse()) {
    if (c.jenis !== 'target_tabungan' || !c.isi) continue
    const x = c.isi as { desa_id: string; peruntukan: string; nominal: number }
    target.set(`${x.desa_id}|${x.peruntukan}`, x)
  }
  for (const t of target.values()) {
    const disetor = kas
      .filter((c) => c.tanggal.startsWith(bulan) && (c.isi as { akun: string; desa_id?: string; arah: string }).akun === 'tabungan_desa' && (c.isi as { desa_id?: string }).desa_id === t.desa_id && (c.isi as { arah: string }).arah === 'masuk' && ((c.isi as { peruntukan?: string }).peruntukan ?? t.peruntukan) === t.peruntukan)
      .reduce((s, c) => s + (c.isi as { jumlah: number }).jumlah, 0)
    r.tabungan.push({ desa_id: t.desa_id, desa: ambilWilayah(db, t.desa_id)?.nama ?? t.desa_id, peruntukan: t.peruntukan, target: t.nominal, disetor })
  }
  r.tabungan.sort((a, b) => a.desa.localeCompare(b.desa) || a.peruntukan.localeCompare(b.peruntukan))
  return r
}

/** Bendahara mengonfirmasi dana masuk penggalang dana → catatan kas masuk berujukan. */
export function konfirmasiDanaMasuk(db: Db, danaId: string): CatatanBidang {
  const d = daftarCatatan(db, { jenis: 'dana_masuk' }).find((c) => c.id === danaId)
  if (!d) throw new GalatPpg('TIDAK_DITEMUKAN', 'Catatan dana masuk tidak ditemukan.')
  if (!d.isi) throw new GalatPpg('TERKUNCI', 'Isi dana masuk tidak bisa dibuka di HP ini.')
  if (daftarCatatan(db, { jenis: 'kas' }).some((c) => c.rujukan_id === danaId)) throw new GalatPpg('SUDAH_DIKONFIRMASI', 'Dana ini sudah masuk kas.')
  const x = d.isi as { jumlah: number; sumber: string; dari?: string }
  return simpanCatatan(db, {
    jenis: 'kas',
    isi: { arah: 'masuk', jumlah: x.jumlah, akun: 'dana_masuk', keterangan: `Dana ${x.sumber}${x.dari ? ` dari ${x.dari}` : ''} (penggalangan)` },
    rujukanId: danaId,
    tanggal: tanggalHariIni(),
  })
}

/** Musyawarah rutin PPG: bulan ganjil = musyawarah bersama, bulan genap = musyawarah PPG unsur muda/i (proker Ketua). */
export function musyawarahBulan(bulan: string): { jenis: 'bersama' | 'muda_mudi'; teks: string } {
  const m = Number(bulan.slice(5, 7))
  return m % 2 === 1
    ? { jenis: 'bersama', teks: 'Musyawarah bersama semua pengurus PPG' }
    : { jenis: 'muda_mudi', teks: 'Musyawarah PPG unsur muda/i + yang diundang' }
}

/** Generus kelompok-kelompok yang belum mengirim laporan bulanan untuk `bulan`. */
export function kelompokBelumLapor(db: Db, wilayahId: string, bulan: string): { kelompok_id: string; nama: string; desa: string | null }[] {
  return rekapLaporanBulanan(db, { wilayahId, bulan })
    .filter((r) => !r.ada)
    .map((r) => ({ kelompok_id: r.kelompok_id, nama: r.kelompok, desa: r.desa }))
}

export interface PengingatLaporan {
  jenis: 'awal_bulan' | 'akhir_bulan'
  bulan: string
  pesan: string
  kelompok: { kelompok_id: string; nama: string; desa: string | null }[]
}

/**
 * Sekretaris (awal bulan, tanggal 1–7, sebelum pengajian mubaligh minggu pertama): kelompok yang belum lapor bulan lalu.
 * PJ desa (akhir bulan, mulai tanggal 25): "kejar absensi & laporan" bulan berjalan.
 */
export function pengingatLaporan(db: Db, wilayahId: string, tanggal: string = tanggalHariIni()): PengingatLaporan | null {
  const hari = Number(tanggal.slice(8, 10))
  const bulanIni = tanggal.slice(0, 7)
  if (hari <= 7) {
    const d = new Date(Date.UTC(Number(bulanIni.slice(0, 4)), Number(bulanIni.slice(5, 7)) - 2, 1))
    const lalu = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const k = kelompokBelumLapor(db, wilayahId, lalu)
    return k.length ? { jenis: 'awal_bulan', bulan: lalu, pesan: `${k.length} kelompok belum mengirim laporan bulan lalu — ingatkan sebelum pengajian mubaligh minggu pertama.`, kelompok: k } : null
  }
  if (hari >= 25) {
    const k = kelompokBelumLapor(db, wilayahId, bulanIni)
    return k.length ? { jenis: 'akhir_bulan', bulan: bulanIni, pesan: `Akhir bulan: ${k.length} kelompok belum melengkapi absensi & laporan — kejar MT se-desa.`, kelompok: k } : null
  }
  return null
}

/** Teks WA rekap keaktifan bulanan (Sekretaris → grup PPG). Tanpa data pribadi selain nama anak & persen. */
export function teksWaRekapKeaktifan(db: Db, o: { wilayahId: string; bulan: string }): string {
  const r = rekapKeaktifanBulan(db, o)
  const w = ambilWilayah(db, o.wilayahId)
  const baris = [`Assalamu'alaikum. *Rekap Keaktifan Generus ${o.bulan}* — ${w?.nama ?? ''}`, '']
  for (const k of r.perKelompok) baris.push(`• ${k.nama}: rata-rata ${String(k.rataPersen ?? 0).replace('.', ',')}% · mencapai target ${k.tercapai}/${k.jumlah}`)
  if (r.perluPerhatian.length) {
    baris.push('', `Perlu perhatian (< 50%): ${r.perluPerhatian.length} anak — mohon dibahas di Musyawaroh 5 Unsur.`)
  }
  baris.push('', 'Alhamdulillah jazakumullohu khoiro.')
  return baris.join('\n')
}

// ---------------- reward kurikulum ----------------

export interface PeringkatSantri {
  generus_id: string
  nama: string
  kelompok_id: string
  kelompok: string
  desa: string | null
  keaktifan: number
  penguasaan: number
  /** Skor = rata-rata keaktifan semester & TOTAL penguasaan (J-K7). */
  skor: number
}

export interface HasilReward {
  periode: string
  jenjang: KategoriGenerus
  /** Peringkat santri per kelompok (tingkat kelompok), per desa, dan se-daerah. */
  perKelompok: Record<string, PeringkatSantri[]>
  perDesa: Record<string, PeringkatSantri[]>
  daerah: PeringkatSantri[]
  kelompokTerbaik: { kelompok_id: string; nama: string; desa: string | null; skor: number; jumlah: number }[]
  desaTerbaik: { desa_id: string; nama: string; skor: number; jumlah: number }[]
}

const satuDesimal = (n: number) => Math.round(n * 10) / 10

/** Reward hasil belajar terbaik (Bidang Kurikulum): santri terbaik berjenjang, kelompok & desa terbaik. */
export function rewardHasilBelajar(db: Db, o: { wilayahId: string; jenjang: KategoriGenerus; periode?: string; batas?: number; tanggal?: string }): HasilReward {
  if (!KATEGORI_GENERUS.includes(o.jenjang)) throw new GalatPpg('KATEGORI_TIDAK_SAH', 'Jenjang tidak dikenal.')
  const periode = o.periode ?? periodeAktif(db, o.tanggal)
  const batas = o.batas ?? 3
  const semua: PeringkatSantri[] = []
  for (const g of daftarGenerus(db, { kelompokIds: kelompokDalamWilayah(db, o.wilayahId), status: 'aktif' }).filter((x) => x.kategori === o.jenjang)) {
    const r = raporGenerus(db, g.id, { periode, tanggal: o.tanggal })
    if (!r) continue
    const keaktifan = r.keaktifan?.persen ?? 0
    const penguasaan = r.total ?? 0
    semua.push({ generus_id: g.id, nama: g.nama, kelompok_id: g.kelompok_id, kelompok: r.generus.kelompok ?? '', desa: r.generus.desa, keaktifan, penguasaan, skor: satuDesimal((keaktifan + penguasaan) / 2) })
  }
  const urut = (l: PeringkatSantri[]) => [...l].sort((a, b) => b.skor - a.skor || b.penguasaan - a.penguasaan || a.nama.localeCompare(b.nama))
  const kelompokkan = (kunci: (s: PeringkatSantri) => string) => {
    const m: Record<string, PeringkatSantri[]> = {}
    for (const s of semua) (m[kunci(s)] ??= []).push(s)
    return m
  }
  const perKelompokSemua = kelompokkan((s) => s.kelompok_id)
  const desaId = (s: PeringkatSantri) => ambilWilayah(db, s.kelompok_id)?.induk_id ?? '—'
  const perDesaSemua = kelompokkan(desaId)
  const rata = (l: PeringkatSantri[]) => (l.length ? satuDesimal(l.reduce((s, x) => s + x.skor, 0) / l.length) : 0)
  return {
    periode,
    jenjang: o.jenjang,
    perKelompok: Object.fromEntries(Object.entries(perKelompokSemua).map(([k, l]) => [k, urut(l).slice(0, batas)])),
    perDesa: Object.fromEntries(Object.entries(perDesaSemua).map(([k, l]) => [k, urut(l).slice(0, batas)])),
    daerah: urut(semua).slice(0, batas),
    kelompokTerbaik: Object.entries(perKelompokSemua)
      .map(([id, l]) => ({ kelompok_id: id, nama: l[0]!.kelompok, desa: l[0]!.desa, skor: rata(l), jumlah: l.length }))
      .sort((a, b) => b.skor - a.skor),
    desaTerbaik: Object.entries(perDesaSemua)
      .map(([id, l]) => ({ desa_id: id, nama: ambilWilayah(db, id)?.nama ?? id, skor: rata(l), jumlah: l.length }))
      .sort((a, b) => b.skor - a.skor),
  }
}

// ---------------- tenaga pendidik: kontrol keaktifan & keteladanan MT ----------------

export interface HariKontrolMt {
  subuh?: boolean
  tahajud?: boolean
  dhuha?: boolean
  /** Kolom hafalan (mengulang membaca kode B / mendengarkan kode D) yang terisi hari itu. */
  hafalan?: number
  /** Tadarus: "dari surat … ayat … s.d. …". */
  tadarus?: string
}

export const idKontrolMt = (perangkatId: string, bulan: string) => `KMT-${perangkatId}-${bulan}`

/** Mubaligh mengisi satu hari lembar Kontrol Keaktifan & Keteladanan MT (lembar per bulan, id tetap). */
export function isiKontrolMt(db: Db, tanggal: string, hari: HariKontrolMt): CatatanBidang {
  if (!tanggalSah(tanggal) || tanggal > tanggalHariIni()) throw new GalatPpg('TANGGAL_TIDAK_SAH', 'Tanggal tidak sah.')
  const m = daftarProfil(db, 'mubaligh').find((p) => statusProfil(p).bolehMencatat)
  if (!m) throw new GalatPpg('TIDAK_BERWENANG', 'Hanya mubaligh yang mengisi kontrol keaktifan MT.')
  const bulan = tanggal.slice(0, 7)
  const id = idKontrolMt(idPerangkatLokal(db), bulan)
  const ada = daftarCatatan(db, { jenis: 'kontrol_mt' }).find((c) => c.id === id)
  const isi = (ada?.isi as { bulan: string; hari: Record<string, HariKontrolMt> } | null) ?? { bulan, hari: {} }
  isi.hari = { ...isi.hari, [tanggal.slice(8, 10)]: hari }
  return simpanCatatan(db, { jenis: 'kontrol_mt', isi: isi as unknown as Isi, id, tanggal: `${bulan}-01`, judul: m.nama })
}

export interface RekapKontrolMt {
  catatan_id: string
  nama: string
  kelompok: string
  hariTerisi: number
  subuh: number
  tahajud: number
  dhuha: number
  hafalan: number
  tadarus: number
}

/** Rekap kontrol keaktifan MT satu bulan (Bidang Tenaga Pendidik). */
export function rekapKontrolMt(db: Db, bulan: string): RekapKontrolMt[] {
  return daftarCatatan(db, { jenis: 'kontrol_mt', mulai: `${bulan}-01`, selesai: `${bulan}-31` })
    .filter((c) => c.isi)
    .map((c) => {
      const hari = Object.values((c.isi as { hari: Record<string, HariKontrolMt> }).hari)
      return {
        catatan_id: c.id,
        nama: c.judul ?? '—',
        kelompok: ambilWilayah(db, c.wilayah_id)?.nama ?? '',
        hariTerisi: hari.length,
        subuh: hari.filter((h) => h.subuh).length,
        tahajud: hari.filter((h) => h.tahajud).length,
        dhuha: hari.filter((h) => h.dhuha).length,
        hafalan: hari.reduce((s, h) => s + (h.hafalan ?? 0), 0),
        tadarus: hari.filter((h) => h.tadarus?.trim()).length,
      }
    })
    .sort((a, b) => a.kelompok.localeCompare(b.kelompok) || a.nama.localeCompare(b.nama))
}

// ---------------- tahfidz ----------------

export interface RekapTahfidz {
  generus_id: string
  nama: string
  jenjang: string
  kelompok: string
  poin: number
  surat: number
  tanggal: string
}

/** Rekap & peringkat tahfidz: ujian terbaru tiap peserta (poin lembar penilaian). */
export function rekapTahfidz(db: Db, o: { jenjang?: string } = {}): RekapTahfidz[] {
  const terbaru = new Map<string, CatatanTerbaca>()
  for (const c of daftarCatatan(db, { jenis: 'ujian_tahfidz' })) {
    const gid = (c.isi as { generus_id?: string } | null)?.generus_id
    if (gid && !terbaru.has(gid)) terbaru.set(gid, c)
  }
  const hasil: RekapTahfidz[] = []
  for (const [gid, c] of terbaru) {
    const g = ambilGenerus(db, gid)
    if (!g || (o.jenjang && g.kategori !== o.jenjang)) continue
    const lulus = (c.isi as { lulus: number[] }).lulus
    hasil.push({ generus_id: gid, nama: g.nama, jenjang: g.kategori, kelompok: ambilWilayah(db, g.kelompok_id)?.nama ?? '', poin: poinTahfidz(lulus), surat: lulus.length, tanggal: c.tanggal })
  }
  return hasil.sort((a, b) => b.poin - a.poin || a.nama.localeCompare(b.nama))
}

// ---------------- ketua ----------------

export interface RingkasanKetua {
  bulan: string
  musyawarah: ReturnType<typeof musyawarahBulan>
  notulenTerakhir: CatatanTerbaca[]
  /** Jumlah catatan per jenis (tanpa membuka isi). */
  jumlahPerJenis: Record<string, number>
  /** Kasus BK bulan ini & total (hanya jumlah — isi terenkripsi untuk bidang BK). */
  kasusBk: { bulanIni: number; total: number }
  nunggoni: { laporan: number; mandiri: number }
  kelompokBelumLapor: number
  keaktifanRata: number | null
  kas: { dapatDibaca: boolean; saldo: number | null }
}

/** Ringkasan seluruh bidang untuk Ketua/Wakil (dan beranda EXE daerah). */
export function ringkasanKetua(db: Db, o: { wilayahId: string; bulan?: string; kunciAdmin?: KunciAdmin }): RingkasanKetua {
  const bulan = o.bulan ?? tanggalHariIni().slice(0, 7)
  const jumlahPerJenis: Record<string, number> = {}
  for (const r of db.kueri<{ jenis: string; n: number }>('SELECT jenis, COUNT(*) AS n FROM catatan_bidang WHERE dihapus = 0 GROUP BY jenis')) jumlahPerJenis[r.jenis] = r.n
  const bk = (bulanSaja: boolean) =>
    db.nilai<number>(`SELECT COUNT(*) FROM catatan_bidang WHERE dihapus = 0 AND jenis = 'konseling' ${bulanSaja ? 'AND tanggal LIKE ?' : ''}`, bulanSaja ? [`${bulan}-%`] : []) ?? 0
  const lap = rekapLaporanBulanan(db, { wilayahId: o.wilayahId, bulan })
  const kas = ringkasanKas(db, { bulan, kunciAdmin: o.kunciAdmin })
  const rk = rekapKeaktifanBulan(db, { wilayahId: o.wilayahId, bulan })
  const rata = rk.baris.length ? satuDesimal(rk.baris.reduce((s, b) => s + b.persen, 0) / rk.baris.length) : null
  return {
    bulan,
    musyawarah: musyawarahBulan(bulan),
    notulenTerakhir: daftarCatatan(db, { jenis: 'notulen' }).slice(0, 5),
    jumlahPerJenis,
    kasusBk: { bulanIni: bk(true), total: bk(false) },
    nunggoni: {
      laporan: lap.reduce((s, r) => s + r.jumlahNunggoni, 0),
      mandiri: db.nilai<number>(`SELECT COUNT(*) FROM catatan_bidang WHERE dihapus = 0 AND jenis = 'nunggoni' AND tanggal LIKE ?`, [`${bulan}-%`]) ?? 0,
    },
    kelompokBelumLapor: lap.filter((r) => !r.ada).length,
    keaktifanRata: rata,
    kas: { dapatDibaca: kas.dapatDibaca && kas.terkunci === 0, saldo: kas.terkunci ? null : kas.saldo },
  }
}
