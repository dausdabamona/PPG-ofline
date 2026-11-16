// §18 (Fase 12) — Register Kebijakan PPG: katalog kebijakan non-kurikulum yang diatur lewat musyawaroh, nilai sementara
// (bawaan katalog), dan nilai yang sudah Ditetapkan Musyawarah (master `pengaturan` id `kbj:<kunci>:<lingkup>`, J-M1).
// Modul ini hanya bergantung pada repo dasar (tanpa bidang/admin) agar bisa dipakai konsumen kebijakan mana pun.
import type { Db } from './db'
import { GalatPpg } from './galat'
import type { Jabatan } from './kepengurusan'
import { ambilRekaman, sisipkanRekaman, ubahRekaman, uraiJson } from './repo/umum'
import { ambilWilayah, daftarWilayah, type Wilayah } from './repo/wilayah'
import { sekarangIso } from './waktu'

export type LingkupKebijakan = 'daerah' | 'desa'
export type JenisRutin = 'bersama' | 'muda_mudi' | 'tidak_ada'
export const PERUNTUKAN_KEBIJAKAN = ['mumi_daerah', 'ppg_ckm', 'dikembalikan_desa'] as const

/** Jabatan yang boleh dipilih musyawarah sebagai pembaca keuangan (bendahara wajib, J-M7). */
export const OPSI_PEMBACA_KEUANGAN: readonly Jabatan[] = ['ketua', 'wakil_ketua', 'bendahara', 'penggalang_dana', 'sekretaris']

export interface NilaiTabunganDesa {
  /** Rupiah bulat per bulan; null = belum ditetapkan. */
  nominal: number | null
  peruntukan: (typeof PERUNTUKAN_KEBIJAKAN)[number]
}
export interface NilaiRewardSkor {
  bobot_keaktifan: number
  bobot_penguasaan: number
}
export interface NilaiRewardJuara {
  santri: number
  kelompok: number
  desa: number
}
export interface NilaiJadwalMusyawarah {
  ganjil: JenisRutin
  genap: JenisRutin
}
export interface NilaiPengingatLaporan {
  /** Sekretaris: tanggal 1 s.d. ini (kelompok yang belum lapor bulan lalu). */
  awal_sampai: number
  /** PJ desa: mulai tanggal ini (kejar absensi & laporan bulan berjalan). */
  akhir_mulai: number
}
export type NilaiDanaKegiatan = { nama: string; nominal: number }[]
/** §21.5 M08: masa simpan catatan konseling & rujukan Selesai (bulan). */
export interface NilaiSimpanKonseling {
  bulan: number
}
/** §21.5 M09: nomor WA khusus BK per wilayah (wilayah_id → nomor 62…). Kosong = belum ditetapkan. */
export type NilaiKontakBk = Record<string, string>

export interface PetaNilaiKebijakan {
  tabungan_desa: NilaiTabunganDesa
  reward_skor: NilaiRewardSkor
  reward_juara: NilaiRewardJuara
  hak_baca_keuangan: Jabatan[]
  jadwal_musyawarah: NilaiJadwalMusyawarah
  dana_kegiatan: NilaiDanaKegiatan
  pengingat_laporan: NilaiPengingatLaporan
  simpan_konseling: NilaiSimpanKonseling
  kontak_bk: NilaiKontakBk
}
export type KunciKebijakan = keyof PetaNilaiKebijakan

export interface DefKebijakan<K extends KunciKebijakan = KunciKebijakan> {
  kode: string
  kunci: K
  judul: string
  lingkup: LingkupKebijakan
  /** Sumber / alasan nilai sementara. */
  sumber: string
  /** Nilai sementara (bawaan). Lingkup desa: menurut desa. */
  bawaan: (desa?: Pick<Wilayah, 'nama' | 'kode'>) => PetaNilaiKebijakan[K]
  /** Pemeriksa nilai; kembalikan alasan atau null. */
  alasan: (v: unknown) => string | null
  /** Nilai dianggap kosong (belum ditetapkan). */
  kosong?: (v: PetaNilaiKebijakan[K]) => boolean
  ringkas: (v: PetaNilaiKebijakan[K]) => string
}

const bulat = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
const objek = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const rp = (n: number) => `Rp${n.toLocaleString('id-ID')}`
const MAKS_RUPIAH = 1_000_000_000_000

export const LABEL_PERUNTUKAN: Record<string, string> = {
  mumi_daerah: 'Konsumsi Mumi Daerah',
  ppg_ckm: 'Kegiatan PPG & CKM',
  dikembalikan_desa: 'Dikembalikan ke desa',
}
export const LABEL_RUTIN: Record<JenisRutin, string> = {
  bersama: 'Musyawarah bersama semua pengurus PPG',
  muda_mudi: 'Musyawarah PPG unsur muda/i + yang diundang',
  tidak_ada: 'Tidak ada musyawarah rutin',
}
const LABEL_JABATAN_RINGKAS: Record<string, string> = {
  ketua: 'Ketua',
  wakil_ketua: 'Wakil Ketua',
  bendahara: 'Bendahara',
  penggalang_dana: 'Penggalang Dana',
  sekretaris: 'Sekretaris',
}

const tabunganDesa: DefKebijakan<'tabungan_desa'> = {
  kode: 'M01',
  kunci: 'tabungan_desa',
  judul: 'Tabungan bulanan desa',
  lingkup: 'desa',
  sumber: 'Proker Bendahara 2025: Sorong Rp700.000 & Aimas Rp600.000 untuk konsumsi Mumi Daerah; Fakfak & Kaimana tidak tertulis (dikembalikan ke desa).',
  bawaan: (desa) => {
    const n = (desa?.nama ?? '').toLowerCase()
    if (n.includes('aimas')) return { nominal: 600_000, peruntukan: 'mumi_daerah' }
    if (n.includes('sorong')) return { nominal: 700_000, peruntukan: 'mumi_daerah' }
    return { nominal: null, peruntukan: 'dikembalikan_desa' }
  },
  alasan: (v) => {
    if (!objek(v)) return 'Nilai tabungan tidak sah.'
    if (v.nominal !== null && !bulat(v.nominal, 0, MAKS_RUPIAH)) return 'Nominal tabungan harus rupiah bulat.'
    return PERUNTUKAN_KEBIJAKAN.includes(v.peruntukan as never) ? null : 'Peruntukan tabungan tidak dikenal.'
  },
  kosong: (v) => v.nominal === null,
  ringkas: (v) => (v.nominal === null ? 'Belum ada nominal' : `${rp(v.nominal)}/bulan — ${LABEL_PERUNTUKAN[v.peruntukan] ?? v.peruntukan}`),
}

const rewardSkor: DefKebijakan<'reward_skor'> = {
  kode: 'M02',
  kunci: 'reward_skor',
  judul: 'Rumus skor reward santri',
  lingkup: 'daerah',
  sumber: 'Proker Kurikulum: "keaktifan & penguasaan materi tertinggi" — bobot tidak tertulis, sementara 50 : 50 (J-K7).',
  bawaan: () => ({ bobot_keaktifan: 50, bobot_penguasaan: 50 }),
  alasan: (v) => {
    if (!objek(v) || !bulat(v.bobot_keaktifan, 0, 100) || !bulat(v.bobot_penguasaan, 0, 100)) return 'Bobot harus bilangan bulat 0–100.'
    return (v.bobot_keaktifan as number) + (v.bobot_penguasaan as number) > 0 ? null : 'Jumlah bobot harus lebih dari 0.'
  },
  ringkas: (v) => `Keaktifan ${v.bobot_keaktifan} : Penguasaan ${v.bobot_penguasaan}`,
}

const rewardJuara: DefKebijakan<'reward_juara'> = {
  kode: 'M03',
  kunci: 'reward_juara',
  judul: 'Jumlah juara reward',
  lingkup: 'daerah',
  sumber: 'Proker Kurikulum tidak menyebut jumlah juara; sementara 3 santri terbaik per jenjang di tiap tingkat, 1 kelompok & 1 desa terbaik.',
  bawaan: () => ({ santri: 3, kelompok: 1, desa: 1 }),
  alasan: (v) => (objek(v) && bulat(v.santri, 1, 20) && bulat(v.kelompok, 1, 20) && bulat(v.desa, 1, 20) ? null : 'Jumlah juara 1–20.'),
  ringkas: (v) => `${v.santri} santri per jenjang · ${v.kelompok} kelompok · ${v.desa} desa`,
}

const hakBacaKeuangan: DefKebijakan<'hak_baca_keuangan'> = {
  kode: 'M04',
  kunci: 'hak_baca_keuangan',
  judul: 'Hak baca data keuangan',
  lingkup: 'daerah',
  sumber: 'J-K4 sementara: ketua, wakil ketua, bendahara, penggalang dana. Perubahan memutar kunci keuangan (J-M7).',
  bawaan: () => ['ketua', 'wakil_ketua', 'bendahara', 'penggalang_dana'],
  alasan: (v) => {
    if (!Array.isArray(v) || !v.length) return 'Pilih jabatan pembaca keuangan.'
    if (v.some((j) => !OPSI_PEMBACA_KEUANGAN.includes(j as Jabatan))) return 'Jabatan pembaca keuangan tidak dikenal.'
    if (new Set(v).size !== v.length) return 'Jabatan ganda.'
    return v.includes('bendahara') ? null : 'Bendahara wajib bisa membaca keuangan.'
  },
  ringkas: (v) => v.map((j) => LABEL_JABATAN_RINGKAS[j] ?? j).join(', '),
}

const JENIS_RUTIN: readonly JenisRutin[] = ['bersama', 'muda_mudi', 'tidak_ada']
const jadwalMusyawarah: DefKebijakan<'jadwal_musyawarah'> = {
  kode: 'M05',
  kunci: 'jadwal_musyawarah',
  judul: 'Jadwal musyawarah rutin',
  lingkup: 'daerah',
  sumber: 'Proker Ketua (ralat): sebulan sekali — bulan ganjil musyawarah bersama, bulan genap PPG unsur muda/i (J-K8).',
  bawaan: () => ({ ganjil: 'bersama', genap: 'muda_mudi' }),
  alasan: (v) => (objek(v) && JENIS_RUTIN.includes(v.ganjil as JenisRutin) && JENIS_RUTIN.includes(v.genap as JenisRutin) ? null : 'Jenis musyawarah rutin tidak dikenal.'),
  ringkas: (v) => `Ganjil: ${v.ganjil === 'muda_mudi' ? 'muda/i' : v.ganjil === 'bersama' ? 'bersama' : 'tidak ada'} · Genap: ${v.genap === 'muda_mudi' ? 'muda/i' : v.genap === 'bersama' ? 'bersama' : 'tidak ada'}`,
}

const danaKegiatan: DefKebijakan<'dana_kegiatan'> = {
  kode: 'M06',
  kunci: 'dana_kegiatan',
  judul: 'Kebutuhan dana kegiatan',
  lingkup: 'daerah',
  sumber: 'Proker Bendahara/Penggalang Dana: nominal kebutuhan dana tiap kegiatan belum tertulis.',
  bawaan: () => [],
  alasan: (v) => {
    if (!Array.isArray(v) || v.length > 50) return 'Daftar kegiatan tidak sah (maks. 50).'
    for (const x of v) {
      if (!objek(x) || typeof x.nama !== 'string' || !x.nama.trim() || x.nama.length > 100) return 'Nama kegiatan wajib diisi (maks. 100 huruf).'
      if (!bulat(x.nominal, 0, MAKS_RUPIAH)) return 'Nominal kegiatan harus rupiah bulat.'
    }
    return null
  },
  kosong: (v) => v.length === 0,
  ringkas: (v) => (v.length ? v.map((x) => `${x.nama} ${rp(x.nominal)}`).join(' · ') : 'Belum ada daftar'),
}

const pengingatLaporan: DefKebijakan<'pengingat_laporan'> = {
  kode: 'M07',
  kunci: 'pengingat_laporan',
  judul: 'Tanggal pengingat laporan bulanan',
  lingkup: 'daerah',
  sumber: 'Proker Sekretaris (sebelum pengajian mubaligh minggu pertama) & PJ Desa (akhir bulan) — sementara tanggal 1–7 dan mulai 25 (J-K9).',
  bawaan: () => ({ awal_sampai: 7, akhir_mulai: 25 }),
  alasan: (v) => (objek(v) && bulat(v.awal_sampai, 1, 14) && bulat(v.akhir_mulai, 15, 28) ? null : 'Pengingat awal 1–14, akhir mulai 15–28.'),
  ringkas: (v) => `Sekretaris tgl 1–${v.awal_sampai} · PJ desa mulai tgl ${v.akhir_mulai}`,
}

const simpanKonseling: DefKebijakan<'simpan_konseling'> = {
  kode: 'M08',
  kunci: 'simpan_konseling',
  judul: 'Masa simpan catatan konseling & rujukan',
  lingkup: 'daerah',
  sumber: 'Kajian Rujukan BK (§21.5): catatan konseling & rujukan Selesai disimpan 24 bulan, lalu dihapus otomatis di HP BK.',
  bawaan: () => ({ bulan: 24 }),
  alasan: (v) => (objek(v) && bulat(v.bulan, 1, 120) ? null : 'Masa simpan 1–120 bulan.'),
  ringkas: (v) => `${v.bulan} bulan, lalu dihapus otomatis`,
}

const kontakBk: DefKebijakan<'kontak_bk'> = {
  kode: 'M09',
  kunci: 'kontak_bk',
  judul: 'Nomor WA khusus BK',
  lingkup: 'daerah',
  sumber: 'Kajian Rujukan BK (§21.4): disarankan nomor WA khusus BK per tingkat; sementara memakai nomor yang diisi saat token BK diterbitkan.',
  bawaan: () => ({}),
  alasan: (v) => {
    if (!objek(v) || Object.keys(v).length > 500) return 'Daftar nomor BK tidak sah.'
    for (const [w, n] of Object.entries(v)) {
      if (!w || w.length > 64) return 'Wilayah nomor BK tidak sah.'
      if (typeof n !== 'string' || !/^62\d{7,13}$/.test(n)) return 'Nomor WA BK harus berawalan 62 (contoh 62812xxxxxxx).'
    }
    return null
  },
  kosong: (v) => Object.keys(v).length === 0,
  ringkas: (v) => (Object.keys(v).length ? `${Object.keys(v).length} nomor BK` : 'Belum ditetapkan'),
}

/** Katalog kebijakan (§18.3). Urutan = urutan tampil. */
export const KATALOG_KEBIJAKAN: readonly DefKebijakan[] = [
  tabunganDesa,
  rewardSkor,
  rewardJuara,
  hakBacaKeuangan,
  jadwalMusyawarah,
  danaKegiatan,
  pengingatLaporan,
  simpanKonseling,
  kontakBk,
] as unknown as readonly DefKebijakan[]

export function defKebijakan(kunci: string): DefKebijakan | undefined {
  return KATALOG_KEBIJAKAN.find((d) => d.kunci === kunci)
}

// =====================================================================================================================
// Penyimpanan (master pengaturan)
// =====================================================================================================================

export const AWALAN_KEBIJAKAN = 'kbj:'
export const idKebijakan = (kunci: string, lingkupId: string) => `${AWALAN_KEBIJAKAN}${kunci}:${lingkupId}`

export interface DasarKebijakan {
  notulen_id: string
  nomor: string | null
  tanggal: string
  jenis_musyawarah: string
  pengesahan_id: string
}

export interface EntriRiwayatKebijakan {
  nilai: unknown
  sebelumnya: unknown
  dasar: DasarKebijakan
  disahkan_oleh: string
  diterapkan_pada: string
}

export interface IsiKebijakan {
  kunci: KunciKebijakan
  lingkup_id: string
  nilai: unknown
  status: 'ditetapkan'
  dasar: DasarKebijakan
  disahkan_oleh: string
  disahkan_pada: string
  diterapkan_pada: string
  riwayat: EntriRiwayatKebijakan[]
}

export type StatusKebijakan = 'sementara' | 'belum' | 'ditetapkan'
export const LABEL_STATUS_KEBIJAKAN: Record<StatusKebijakan, string> = {
  sementara: 'Sementara',
  belum: 'Belum ditetapkan',
  ditetapkan: 'Ditetapkan Musyawarah',
}

export interface BarisKebijakan {
  kode: string
  kunci: KunciKebijakan
  judul: string
  lingkup: LingkupKebijakan
  lingkup_id: string
  lingkup_nama: string
  sumber: string
  nilai: unknown
  nilaiSementara: unknown
  ringkas: string
  status: StatusKebijakan
  dasar: DasarKebijakan | null
  disahkan_oleh: string | null
  disahkan_pada: string | null
  riwayat: EntriRiwayatKebijakan[]
}

/** Isi baris kebijakan tersimpan (null bila belum ditetapkan atau rusak). */
export function bacaIsiKebijakan(db: Db, kunci: string, lingkupId: string): IsiKebijakan | null {
  const r = ambilRekaman<{ isi: string | null; dihapus: number }>(db, 'pengaturan', idKebijakan(kunci, lingkupId))
  if (!r || r.dihapus) return null
  const isi = uraiJson<IsiKebijakan | null>(r.isi, null)
  const d = defKebijakan(kunci)
  if (!isi || !d || isi.kunci !== kunci || isi.lingkup_id !== lingkupId || d.alasan(isi.nilai)) return null
  return isi
}

/** Wilayah daerah (akar) — id lingkup kebijakan daerah. */
export function idDaerah(db: Db): string | null {
  return daftarWilayah(db, { tingkat: 'daerah' })[0]?.id ?? null
}

/** Nilai kebijakan yang berlaku: Ditetapkan Musyawarah, selain itu nilai sementara katalog. */
export function nilaiKebijakan<K extends KunciKebijakan>(db: Db, kunci: K, lingkupId?: string): PetaNilaiKebijakan[K] {
  const d = defKebijakan(kunci) as DefKebijakan<K> | undefined
  if (!d) throw new GalatPpg('KEBIJAKAN_TIDAK_DIKENAL', 'Kebijakan tidak dikenal.')
  const lingkup = lingkupId ?? idDaerah(db)
  if (lingkup) {
    const isi = bacaIsiKebijakan(db, kunci, lingkup)
    if (isi) return isi.nilai as PetaNilaiKebijakan[K]
  }
  const w = lingkup ? ambilWilayah(db, lingkup) : undefined
  return d.bawaan(w ?? undefined)
}

/** Jabatan pembaca bidang rahasia menurut kebijakan (keuangan: M04; konseling: BK saja). */
export function pembacaRahasiaDb(db: Db): { keuangan: Jabatan[]; konseling: Jabatan[] } {
  return { keuangan: nilaiKebijakan(db, 'hak_baca_keuangan'), konseling: ['bk'] }
}

function barisDari(db: Db, d: DefKebijakan, w: Wilayah): BarisKebijakan {
  const isi = bacaIsiKebijakan(db, d.kunci, w.id)
  const sementara = d.bawaan(w)
  const nilai = isi ? isi.nilai : sementara
  const kosong = d.kosong ? d.kosong(nilai as never) : false
  return {
    kode: d.kode,
    kunci: d.kunci,
    judul: d.judul,
    lingkup: d.lingkup,
    lingkup_id: w.id,
    lingkup_nama: w.nama,
    sumber: d.sumber,
    nilai,
    nilaiSementara: sementara,
    ringkas: d.ringkas(nilai as never),
    status: isi ? 'ditetapkan' : kosong ? 'belum' : 'sementara',
    dasar: isi?.dasar ?? null,
    disahkan_oleh: isi?.disahkan_oleh ?? null,
    disahkan_pada: isi?.disahkan_pada ?? null,
    riwayat: isi?.riwayat ?? [],
  }
}

/**
 * Register kebijakan: setiap kebijakan katalog × lingkupnya (daerah: wilayah daerah; desa: tiap desa). Bila `wilayahId`
 * desa diberikan → kebijakan daerah + kebijakan lingkup desa itu saja.
 */
export function daftarKebijakan(db: Db, o: { wilayahId?: string } = {}): BarisKebijakan[] {
  const daerah = daftarWilayah(db, { tingkat: 'daerah' })[0]
  let desa = daftarWilayah(db, { tingkat: 'desa' })
  const w = o.wilayahId ? ambilWilayah(db, o.wilayahId) : undefined
  if (w?.tingkat === 'desa') desa = desa.filter((x) => x.id === w.id)
  if (w?.tingkat === 'kelompok') desa = desa.filter((x) => x.id === w.induk_id)
  const hasil: BarisKebijakan[] = []
  for (const d of KATALOG_KEBIJAKAN) {
    if (d.lingkup === 'daerah') {
      if (daerah) hasil.push(barisDari(db, d, daerah))
    } else for (const x of [...desa].sort((a, b) => a.nama.localeCompare(b.nama))) hasil.push(barisDari(db, d, x))
  }
  return hasil
}

/** Jumlah kebijakan yang belum Ditetapkan Musyawarah (Sementara + Belum ditetapkan). */
export function jumlahKebijakanSementara(db: Db, o: { wilayahId?: string } = {}): number {
  return daftarKebijakan(db, o).filter((b) => b.status !== 'ditetapkan').length
}

/** Pemeriksaan lingkup kebijakan: lingkup_id harus wilayah daerah (kebijakan daerah) atau desa (kebijakan desa). */
export function alasanLingkupKebijakan(db: Db, kunci: string, lingkupId: unknown): string | null {
  const d = defKebijakan(kunci)
  if (!d) return 'Kebijakan tidak dikenal.'
  if (typeof lingkupId !== 'string') return 'Lingkup kebijakan wajib diisi.'
  const w = ambilWilayah(db, lingkupId)
  if (!w || w.dihapus) return 'Wilayah lingkup kebijakan tidak dikenal.'
  return w.tingkat === d.lingkup ? null : d.lingkup === 'desa' ? 'Kebijakan ini berlaku per desa — pilih desanya.' : 'Kebijakan ini berlaku untuk seluruh daerah.'
}

/** Pemeriksaan isi kebijakan (dipakai notulen & penerapan). */
export function alasanNilaiKebijakan(kunci: string, nilai: unknown): string | null {
  const d = defKebijakan(kunci)
  return d ? d.alasan(nilai) : 'Kebijakan tidak dikenal.'
}

/** Sama nilai (bentuk JSON kanonik). */
export function samaNilai(a: unknown, b: unknown): boolean {
  return jsonKanonik(a) === jsonKanonik(b)
}

/** JSON dengan kunci objek terurut (untuk sidik & perbandingan). */
export function jsonKanonik(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(jsonKanonik).join(',')}]`
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object)
      .sort()
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${jsonKanonik((v as Record<string, unknown>)[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(v ?? null)
}

/**
 * Tulis kebijakan Ditetapkan Musyawarah (dipanggil penerapan di EXE Daerah, J-M5). Riwayat menyimpan ≤ 50 entri terakhir.
 * Kembalikan nilai sebelumnya.
 */
export function tulisKebijakan(
  db: Db,
  d: { kunci: KunciKebijakan; lingkupId: string; nilai: unknown; dasar: DasarKebijakan; disahkanOleh: string; disahkanPada: string },
): unknown {
  const sebelumnya = nilaiKebijakan(db, d.kunci, d.lingkupId)
  const lama = bacaIsiKebijakan(db, d.kunci, d.lingkupId)
  const kini = sekarangIso()
  const entri: EntriRiwayatKebijakan = { nilai: d.nilai, sebelumnya, dasar: d.dasar, disahkan_oleh: d.disahkanOleh, diterapkan_pada: kini }
  const isi: IsiKebijakan = {
    kunci: d.kunci,
    lingkup_id: d.lingkupId,
    nilai: d.nilai,
    status: 'ditetapkan',
    dasar: d.dasar,
    disahkan_oleh: d.disahkanOleh,
    disahkan_pada: d.disahkanPada,
    diterapkan_pada: kini,
    riwayat: [...(lama?.riwayat ?? []), entri].slice(-50),
  }
  const id = idKebijakan(d.kunci, d.lingkupId)
  if (ambilRekaman(db, 'pengaturan', id)) ubahRekaman(db, 'pengaturan', id, { isi: JSON.stringify(isi), dihapus: 0 })
  else sisipkanRekaman(db, 'pengaturan', { isi: JSON.stringify(isi) }, { id })
  return sebelumnya
}
