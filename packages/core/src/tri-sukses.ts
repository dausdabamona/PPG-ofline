// §20 (Fase 14) — Raport menurut Tri Sukses Generus (Alim-Faqih, Akhlaqul Karimah, Mandiri) + Karakter Luhur
// (4 Tali Keimanan, 6 Thobiat Luhur). Susunan aspek bersumber GBMTPG Pembina Generus Pusat 2022 (isi buku tidak disalin).
// Modul ini tidak mengimpor nilai dari `juknis.ts` (hindari impor melingkar): penetapan K09/K17/K18 dibaca langsung dari
// master `pengaturan` (`kur:<kode>`).
import type { Db } from './db'
import { GalatPpg } from './galat'
import { sha256Hex } from './crypto'
import { ambilGenerus } from './repo/generus'
import { cariProfilPencatat } from './repo/profil'
import { periodeAktif, periodeSah } from './repo/target'
import { adalahAdmin, ambilRekaman, sisipkanRekaman, tandaTanya, ubahRekaman, uraiJson, type RekamanDasar } from './repo/umum'
import { tanggalHariIni, tanggalSah } from './waktu'

// =====================================================================================================================
// Aspek & subbagian (K18)
// =====================================================================================================================

export type AspekPenilaian = 'alim' | 'faqih' | 'akhlak' | 'mandiri'
export type BagianAspek = 'alim_mankul' | 'alim_hafalan' | 'faqih_kefahaman' | 'faqih_praktik' | 'akhlak' | 'mandiri'

export const LABEL_ASPEK: Record<AspekPenilaian | 'alim_faqih', string> = {
  alim_faqih: 'Alim-Faqih',
  alim: 'Alim',
  faqih: 'Faqih',
  akhlak: 'Akhlaqul Karimah',
  mandiri: 'Mandiri',
}

/** Subbagian berurutan (urutan lampiran "Rincian Penguasaan Materi"). */
export const BAGIAN_ASPEK: readonly { kode: BagianAspek; aspek: AspekPenilaian; label: string; judul: string }[] = [
  { kode: 'alim_mankul', aspek: 'alim', label: 'Mankul', judul: 'Alim — Mankul' },
  { kode: 'alim_hafalan', aspek: 'alim', label: 'Hafalan', judul: 'Alim — Hafalan' },
  { kode: 'faqih_kefahaman', aspek: 'faqih', label: 'Kefahaman', judul: 'Faqih — Kefahaman' },
  { kode: 'faqih_praktik', aspek: 'faqih', label: 'Praktik Ibadah', judul: 'Faqih — Praktik Ibadah' },
  { kode: 'akhlak', aspek: 'akhlak', label: 'Akhlaqul Karimah', judul: 'Akhlaqul Karimah' },
  { kode: 'mandiri', aspek: 'mandiri', label: 'Mandiri', judul: 'Mandiri' },
]
export const KODE_BAGIAN: readonly BagianAspek[] = BAGIAN_ASPEK.map((b) => b.kode)

/** Nilai sementara K18 — pemetaan kode materi evaluasi → subbagian (GBMTPG Pembina Generus Pusat 2022, revisi pemilik). */
export const PEMETAAN_SEMENTARA: Readonly<Record<string, BagianAspek>> = {
  iqro: 'alim_mankul',
  tajwid: 'alim_mankul',
  makna_quran: 'alim_mankul',
  hadits: 'alim_mankul',
  keilmuan: 'alim_mankul',
  tadarus: 'alim_mankul',
  surat: 'alim_hafalan',
  doa_gbmtpg: 'alim_hafalan',
  doa_sorong: 'alim_hafalan',
  dalil_gbmtpg: 'alim_hafalan',
  dalil_sorong: 'alim_hafalan',
  kefahaman: 'faqih_kefahaman',
  praktik_ibadah: 'faqih_praktik',
  wudhu_sholat: 'faqih_praktik',
  thoharoh: 'faqih_praktik',
  jenazah: 'faqih_praktik',
  kualitas_bacaan: 'faqih_praktik',
  pegon: 'faqih_praktik',
  akhlak: 'akhlak',
  adab: 'akhlak',
  nasehat_bpi: 'akhlak',
  kemandirian: 'mandiri',
  asad: 'mandiri',
}
/** J-R2: kode materi baru yang belum dipetakan. */
export const BAGIAN_BAWAAN: BagianAspek = 'alim_mankul'

function nilaiPenetapan(db: Db, kode: string): unknown {
  const r = ambilRekaman<{ isi: string | null; dihapus: number }>(db, 'pengaturan', `kur:${kode}`)
  return r && !r.dihapus ? uraiJson<{ nilai?: unknown }>(r.isi, {}).nilai : undefined
}

/** Kode materi evaluasi yang ada (selain keaktifan), urut kemunculan jenjang & urutan, digabung katalog sementara. */
export function kodeMateriTerpetakan(db: Db): string[] {
  const dariData = db.kueri<{ kode: string }>(
    `SELECT kode, MIN(urutan) AS u FROM materi_evaluasi WHERE dihapus = 0 AND cara != 'keaktifan' GROUP BY kode ORDER BY u, kode`,
  ).map((r) => r.kode)
  return [...new Set([...Object.keys(PEMETAAN_SEMENTARA), ...dariData])]
}

/** Pemeriksaan nilai K18: objek kode → subbagian sah. */
export function alasanPemetaanTidakSah(v: unknown): string | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return 'Pemetaan tidak sah.'
  for (const [k, b] of Object.entries(v as Record<string, unknown>)) {
    if (!/^[a-z0-9_]{1,40}$/.test(k)) return 'Kode materi tidak sah.'
    if (k === 'keaktifan') return 'Keaktifan bukan aspek nilai (data pendukung).'
    if (!KODE_BAGIAN.includes(b as BagianAspek)) return `Bagian untuk "${k}" tidak dikenal.`
  }
  return null
}

/** Pemetaan berlaku (K18): penetapan Kurikulum di atas nilai sementara; kode tak dikenal → Alim · Mankul. */
export function pemetaanAspek(db: Db): Record<string, BagianAspek> {
  const v = nilaiPenetapan(db, 'K18')
  const tetap = v !== undefined && alasanPemetaanTidakSah(v) === null ? (v as Record<string, BagianAspek>) : {}
  const out: Record<string, BagianAspek> = {}
  for (const k of kodeMateriTerpetakan(db)) out[k] = tetap[k] ?? PEMETAAN_SEMENTARA[k] ?? BAGIAN_BAWAAN
  for (const [k, b] of Object.entries(tetap)) out[k] = b
  return out
}

export function bagianUntuk(pemetaan: Record<string, BagianAspek>, kode: string): BagianAspek | null {
  if (kode === 'keaktifan') return null
  return pemetaan[kode] ?? PEMETAAN_SEMENTARA[kode] ?? BAGIAN_BAWAAN
}

// =====================================================================================================================
// Predikat angka (K17) & rumus nilai akhir (K09)
// =====================================================================================================================

export interface AmbangPredikat {
  sangat_baik: number
  baik: number
  cukup: number
}
export const AMBANG_SEMENTARA: AmbangPredikat = { sangat_baik: 85, baik: 70, cukup: 55 }

export function alasanAmbangTidakSah(v: unknown): string | null {
  if (!v || typeof v !== 'object') return 'Ambang predikat tidak sah.'
  const a = v as Record<string, unknown>
  const ok = (x: unknown) => typeof x === 'number' && Number.isInteger(x) && x >= 1 && x <= 100
  if (!ok(a.sangat_baik) || !ok(a.baik) || !ok(a.cukup)) return 'Ambang harus bilangan bulat 1–100.'
  if (!((a.sangat_baik as number) > (a.baik as number) && (a.baik as number) > (a.cukup as number))) return 'Ambang harus menurun: Sangat Baik > Baik > Cukup.'
  return null
}

export function ambangPredikat(db: Db): AmbangPredikat {
  const v = nilaiPenetapan(db, 'K17')
  if (v !== undefined && alasanAmbangTidakSah(v) === null) {
    const a = v as AmbangPredikat
    return { sangat_baik: a.sangat_baik, baik: a.baik, cukup: a.cukup }
  }
  return { ...AMBANG_SEMENTARA }
}

export type PredikatAngka = 'Sangat Baik' | 'Baik' | 'Cukup' | 'Perlu Bimbingan'

/** Predikat angka (K17): ≥ sangat_baik Sangat Baik, ≥ baik Baik, ≥ cukup Cukup, selain itu Perlu Bimbingan; null = belum dinilai. */
export function predikatAngka(n: number | null | undefined, a: AmbangPredikat = AMBANG_SEMENTARA): PredikatAngka | null {
  if (n === null || n === undefined || Number.isNaN(n)) return null
  const x = satuDesimal(n)
  return x >= a.sangat_baik ? 'Sangat Baik' : x >= a.baik ? 'Baik' : x >= a.cukup ? 'Cukup' : 'Perlu Bimbingan'
}

/** K09 (Fase 14): rata-rata 3 aspek Tri Sukses (bawaan) atau rata-rata semua butir materi yang dinilai. */
export type RumusNilaiAkhir = 'rata_aspek' | 'rata_materi'
export function rumusNilaiAkhir(db: Db): RumusNilaiAkhir {
  return nilaiPenetapan(db, 'K09') === 'rata_materi' ? 'rata_materi' : 'rata_aspek'
}

// =====================================================================================================================
// Hitung Tri Sukses
// =====================================================================================================================

const satuDesimal = (n: number) => Math.round(n * 10) / 10
/** Rata-rata nilai yang ada (null diabaikan), satu desimal; null bila tidak ada. */
export function rataAda(l: readonly (number | null | undefined)[]): number | null {
  const ada = l.filter((x): x is number => typeof x === 'number' && !Number.isNaN(x))
  return ada.length ? satuDesimal(ada.reduce((s, x) => s + x, 0) / ada.length) : null
}

export interface ButirNilai {
  materi: { kode: string; cara: string }
  /** null = belum dinilai atau belum ditetapkan Kurikulum (tidak ikut rata-rata). */
  persen: number | null
}

export interface HasilTriSukses<T extends ButirNilai> {
  bagian: { kode: BagianAspek; aspek: AspekPenilaian; label: string; judul: string; items: T[]; nilai: number | null }[]
  alim: number | null
  faqih: number | null
  alimFaqih: number | null
  akhlak: number | null
  mandiri: number | null
  nilaiAkhir: number | null
  rumus: RumusNilaiAkhir
}

/**
 * §20.2: nilai subbagian = rata-rata butir dinilai; Alim/Faqih = rata-rata subbagiannya yang bernilai; Alim-Faqih =
 * rata-rata Alim & Faqih; Akhlaq & Mandiri = rata-rata butirnya; Nilai Akhir = rata-rata 3 aspek Tri Sukses (atau semua butir).
 */
export function hitungTriSukses<T extends ButirNilai>(items: readonly T[], pemetaan: Record<string, BagianAspek>, rumus: RumusNilaiAkhir = 'rata_aspek'): HasilTriSukses<T> {
  const bagian = BAGIAN_ASPEK.map((b) => {
    const isi = items.filter((i) => bagianUntuk(pemetaan, i.materi.kode) === b.kode)
    return { ...b, items: isi, nilai: rataAda(isi.map((i) => i.persen)) }
  })
  const nilai = (k: BagianAspek) => bagian.find((b) => b.kode === k)!.nilai
  const alim = rataAda([nilai('alim_mankul'), nilai('alim_hafalan')])
  const faqih = rataAda([nilai('faqih_kefahaman'), nilai('faqih_praktik')])
  const alimFaqih = rataAda([alim, faqih])
  const akhlak = nilai('akhlak')
  const mandiri = nilai('mandiri')
  const nilaiAkhir =
    rumus === 'rata_materi' ? rataAda(items.filter((i) => i.materi.cara !== 'keaktifan').map((i) => i.persen)) : rataAda([alimFaqih, akhlak, mandiri])
  return { bagian, alim, faqih, alimFaqih, akhlak, mandiri, nilaiAkhir, rumus }
}

// =====================================================================================================================
// Karakter Luhur (penilaian sikap)
// =====================================================================================================================

export const TALI_KEIMANAN = [
  { kode: 'syukur', nama: 'Bersyukur atas hidayah' },
  { kode: 'agungkan', nama: 'Mengagungkan hidayah' },
  { kode: 'sungguh', nama: 'Mempersungguh hidayah' },
  { kode: 'doa', nama: 'Senantiasa berdoa' },
] as const
export const THOBIAT_LUHUR = [
  { kode: 'jujur', nama: 'Jujur' },
  { kode: 'amanah', nama: 'Amanah' },
  { kode: 'mujhid_muzhid', nama: 'Mujhid-muzhid' },
  { kode: 'rukun', nama: 'Rukun' },
  { kode: 'kompak', nama: 'Kompak' },
  { kode: 'kerja_sama', nama: 'Kerja sama yang baik' },
] as const
/** Butir catatan mubaligh semester (tanpa predikat). */
export const BUTIR_CATATAN = 'catatan'
export const BUTIR_KARAKTER: readonly string[] = [...TALI_KEIMANAN.map((t) => t.kode), ...THOBIAT_LUHUR.map((t) => t.kode), BUTIR_CATATAN]

export type PredikatSikap = 'baik' | 'cukup' | 'perlu_bimbingan'
export const PREDIKAT_SIKAP: readonly PredikatSikap[] = ['baik', 'cukup', 'perlu_bimbingan']
export const LABEL_PREDIKAT_SIKAP: Record<PredikatSikap, string> = { baik: 'Baik', cukup: 'Cukup', perlu_bimbingan: 'Perlu Bimbingan' }

/** J-R18: istilah capaian GBMTPG Pembina Generus Pusat 2022 per jenjang (keterangan target, bukan predikat). */
export const TARGET_JENJANG_KARAKTER: Record<string, string> = {
  paud: 'Mengenal',
  caberawit: 'Tertanam',
  caberawit_a: 'Tertanam',
  caberawit_b: 'Tertanam',
  caberawit_c: 'Tertanam',
  praremaja: 'Terbiasa',
  remaja: 'Terampil',
  pranikah: 'Memiliki',
}

export const PANJANG_CATATAN_BUTIR = 300
export const PANJANG_CATATAN_MUBALIGH = 1000

export interface PenilaianKarakter extends RekamanDasar {
  generus_id: string
  kelompok_id: string
  periode: string
  butir: string
  predikat: PredikatSikap | null
  catatan: string | null
  tanggal: string
  penilai: string | null
}

/** Id tetap (generus × periode × butir), ≤ 64 karakter. */
export const idPenilaianKarakter = (generusId: string, periode: string, butir: string) =>
  `KRL-${sha256Hex(new TextEncoder().encode(`${generusId}|${periode}|${butir}`)).slice(0, 40)}`

/** Pemeriksaan isi rekaman penilaian karakter (simpan & impor SETOR/BALASAN/PAKET). Kembalikan alasan atau null. */
export function alasanPenilaianKarakterTidakSah(rek: Record<string, unknown>): string | null {
  if (!periodeSah(rek.periode)) return 'Periode penilaian karakter tidak sah.'
  const butir = String(rek.butir ?? '')
  if (!BUTIR_KARAKTER.includes(butir)) return 'Butir Karakter Luhur tidak dikenal.'
  if (rek.id !== idPenilaianKarakter(String(rek.generus_id), String(rek.periode), butir)) return 'Id penilaian karakter tidak sah.'
  if (!tanggalSah(rek.tanggal)) return 'Tanggal penilaian karakter tidak sah.'
  if (rek.dihapus) return null
  const catatan = rek.catatan
  if (catatan !== null && catatan !== undefined && typeof catatan !== 'string') return 'Catatan tidak sah.'
  if (butir === BUTIR_CATATAN) {
    if (rek.predikat !== null && rek.predikat !== undefined) return 'Catatan mubaligh tidak berpredikat.'
    if (typeof catatan === 'string' && catatan.length > PANJANG_CATATAN_MUBALIGH) return `Catatan mubaligh paling panjang ${PANJANG_CATATAN_MUBALIGH} huruf.`
    if (!catatan || !String(catatan).trim()) return 'Catatan mubaligh kosong.'
    return null
  }
  if (!PREDIKAT_SIKAP.includes(rek.predikat as PredikatSikap)) return 'Predikat harus Baik, Cukup, atau Perlu Bimbingan.'
  if (typeof catatan === 'string' && catatan.length > PANJANG_CATATAN_BUTIR) return `Catatan butir paling panjang ${PANJANG_CATATAN_BUTIR} huruf.`
  if (typeof rek.penilai === 'string' && rek.penilai.length > 200) return 'Nama penilai terlalu panjang.'
  return null
}

export interface DataPenilaianKarakter {
  generusId: string
  butir: string
  /** null + catatan kosong = hapus penilaian butir ini. Butir `catatan`: predikat selalu null. */
  predikat: PredikatSikap | null
  catatan?: string | null
  periode?: string
  tanggal?: string
}

/**
 * Simpan penilaian Karakter Luhur satu butir (J-R8/J-R9): pemegang hak `sahkan` di kelompok generus (mubaligh / EXE
 * kelompok/desa) atau daerah. Id tetap → menyimpan ulang memperbarui; predikat & catatan kosong → dihapus.
 */
export function simpanPenilaianKarakter(db: Db, d: DataPenilaianKarakter): PenilaianKarakter {
  const g = ambilGenerus(db, d.generusId)
  if (!g || g.dihapus) throw new GalatPpg('GENERUS_TIDAK_ADA', 'Generus tidak ditemukan.')
  const periode = d.periode ?? periodeAktif(db)
  const tanggal = d.tanggal ?? tanggalHariIni()
  const catatan = d.catatan?.trim() ? d.catatan.trim() : null
  const penilai = adalahAdmin(db) ? 'Admin Daerah' : cariProfilPencatat(db, g.kelompok_id, ['mubaligh', 'admin'], 'sahkan').nama
  const id = idPenilaianKarakter(g.id, periode, d.butir)
  const hapus = d.butir === BUTIR_CATATAN ? !catatan : !d.predikat && !catatan
  const isi = {
    generus_id: g.id,
    kelompok_id: g.kelompok_id,
    periode,
    butir: d.butir,
    predikat: d.butir === BUTIR_CATATAN ? null : d.predikat,
    catatan,
    tanggal,
    penilai,
  }
  const lama = ambilRekaman<PenilaianKarakter>(db, 'penilaian_karakter', id)
  if (hapus) {
    if (!BUTIR_KARAKTER.includes(d.butir)) throw new GalatPpg('KARAKTER_TIDAK_SAH', 'Butir Karakter Luhur tidak dikenal.')
    if (!lama) throw new GalatPpg('TIDAK_DITEMUKAN', 'Belum ada penilaian untuk dihapus.')
    return ubahRekaman<PenilaianKarakter>(db, 'penilaian_karakter', id, { predikat: null, catatan: null, tanggal, penilai, dihapus: 1 })
  }
  const alasan = alasanPenilaianKarakterTidakSah({ ...isi, id })
  if (alasan) throw new GalatPpg('KARAKTER_TIDAK_SAH', alasan)
  if (lama) return ubahRekaman<PenilaianKarakter>(db, 'penilaian_karakter', id, { ...isi, dihapus: 0 })
  return sisipkanRekaman<PenilaianKarakter>(db, 'penilaian_karakter', isi, { id })
}

/** Penilaian karakter generus satu periode: butir → rekaman (tanpa yang dihapus). */
export function penilaianKarakterGenerus(db: Db, generusId: string, periode: string): Map<string, PenilaianKarakter> {
  const ids = BUTIR_KARAKTER.map((b) => idPenilaianKarakter(generusId, periode, b))
  const rows = db.kueri<PenilaianKarakter>(`SELECT * FROM penilaian_karakter WHERE id IN (${tandaTanya(ids.length)}) AND dihapus = 0`, ids)
  return new Map(rows.map((r) => [r.butir, r]))
}

export interface BarisKarakter {
  kode: string
  nama: string
  predikat: PredikatSikap | null
  /** "Baik" / "Cukup" / "Perlu Bimbingan" / null (belum dinilai). */
  label: string | null
  catatan: string | null
}

export interface KarakterRapor {
  /** Keterangan target jenjang GBMTPG (mis. "Terbiasa"). */
  targetJenjang: string | null
  tali: BarisKarakter[]
  thobiat: BarisKarakter[]
  catatanMubaligh: string | null
  penilai: string | null
  /** Jumlah butir (dari 10) yang sudah diberi predikat. */
  dinilai: number
}

export function karakterRapor(db: Db, generusId: string, periode: string, jenjang: string): KarakterRapor {
  const peta = penilaianKarakterGenerus(db, generusId, periode)
  const baris = (l: readonly { kode: string; nama: string }[]): BarisKarakter[] =>
    l.map((t) => {
      const r = peta.get(t.kode)
      const p = r && PREDIKAT_SIKAP.includes(r.predikat as PredikatSikap) ? (r.predikat as PredikatSikap) : null
      return { kode: t.kode, nama: t.nama, predikat: p, label: p ? LABEL_PREDIKAT_SIKAP[p] : null, catatan: r?.catatan ?? null }
    })
  const tali = baris(TALI_KEIMANAN)
  const thobiat = baris(THOBIAT_LUHUR)
  const penilai = [...peta.values()].sort((a, b) => b.diubah_pada.localeCompare(a.diubah_pada))[0]?.penilai ?? null
  return {
    targetJenjang: TARGET_JENJANG_KARAKTER[jenjang] ?? null,
    tali,
    thobiat,
    catatanMubaligh: peta.get(BUTIR_CATATAN)?.catatan ?? null,
    penilai,
    dinilai: [...tali, ...thobiat].filter((b) => b.predikat).length,
  }
}

/** Ringkasan catatan sholat lokal (J-R11) dalam rentang tanggal; null bila tidak ada hari tercatat. */
export function ringkasCatatanSholat(db: Db, generusId: string, mulai: string, selesai: string): { hari: number; rataWaktu: number } | null {
  const rows = db.kueri<{ sholat: string }>(`SELECT sholat FROM catatan_sholat WHERE generus_id = ? AND tanggal >= ? AND tanggal <= ?`, [generusId, mulai, selesai])
  const isi = rows.filter((r) => r.sholat)
  if (!isi.length) return null
  const total = isi.reduce((s, r) => s + r.sholat.split(',').filter(Boolean).length, 0)
  return { hari: isi.length, rataWaktu: satuDesimal(total / isi.length) }
}

