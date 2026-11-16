// §16 — Juknis Pembinaan & Evaluasi Hasil Belajar Generus 2025: keaktifan (lembar kontrol), materi evaluasi,
// evaluasi penguasaan materi per semester, laporan hasil belajar (raport). Semua rumus persen ada di sini (satu sumber).
import type { Db } from './db'
import type { CaraEvaluasi, RincianMateriEvaluasi } from './data/juknis-2025'
import { GalatPpg } from './galat'
import { JABATAN_PENCATAT_AGENDA } from './kepengurusan'
import { uraiToken } from './token'
import { sha256Hex } from './crypto'
import { PetaRiwayat } from './laporan'
import { ambilGenerus, jenjangSebelumnya, KATEGORI_GENERUS, type Generus, type KategoriGenerus } from './repo/generus'
import { daftarPresensi } from './repo/presensi'
import { cariProfilPencatat, daftarProfil, statusProfil, type Profil } from './repo/profil'
import { periodeAktif, periodeDariTanggal, periodeSah } from './repo/target'
import {
  adalahAdmin,
  ambilRekaman,
  pastikanPengelolaKurikulum,
  sisipkanRekaman,
  tandaTanya,
  ubahRekaman,
  uraiJson,
  type RekamanDasar,
} from './repo/umum'
import { ambilWilayah } from './repo/wilayah'
import { idMateriEvaluasi } from './skema'
import { sekarangIso, tanggalHariIni, tanggalSah } from './waktu'
import {
  ambangPredikat,
  hitungTriSukses,
  karakterRapor,
  pemetaanAspek,
  ringkasCatatanSholat,
  rumusNilaiAkhir,
  type AmbangPredikat,
  type HasilTriSukses,
  type KarakterRapor,
  type RumusNilaiAkhir,
} from './tri-sukses'

export type { CaraEvaluasi, RincianMateriEvaluasi } from './data/juknis-2025'
export { idMateriEvaluasi } from './skema'

// =====================================================================================================================
// Jenjang
// =====================================================================================================================

/** Nama jenjang juknis. */
export const LABEL_JENJANG: Record<string, string> = {
  paud: 'PAUD',
  caberawit_a: 'Caberawit A',
  caberawit_b: 'Caberawit B',
  caberawit_c: 'Caberawit C',
  praremaja: 'Pra Remaja (Generus 1)',
  remaja: 'Remaja (Generus 2)',
  pranikah: 'Pra Nikah (Generus 3)',
  caberawit: 'Caberawit (jenjang perlu ditetapkan)',
}

/** PAUD & Caberawit A/B/C (kode keaktifan A/B). */
export function jenjangKecil(k: string): boolean {
  return k === 'paud' || k.startsWith('caberawit')
}

function pastikanJenjangDitetapkan(g: Pick<Generus, 'nama' | 'kategori'>): KategoriGenerus {
  if (!KATEGORI_GENERUS.includes(g.kategori)) {
    throw new GalatPpg('JENJANG_PERLU_DITETAPKAN', `Jenjang ${g.nama} masih "Caberawit" lama. Tetapkan Caberawit A, B, atau C dulu.`)
  }
  return g.kategori
}

// =====================================================================================================================
// Kode keaktifan (lembar kontrol)
// =====================================================================================================================

export type KodeKeaktifan = 'A' | 'B' | 'MK' | 'KL' | 'T' | 'MS' | 'DS' | 'MR' | 'DR' | 'AA' | 'AS' | 'TH' | 'QR' | 'HD' | 'IZ'

export const KODE_KEAKTIFAN: Record<KodeKeaktifan, { nama: string; kecil: boolean; besar: boolean; mandiri: boolean }> = {
  A: { nama: 'Mengikuti pengajian kelompok rutin terjadwal', kecil: true, besar: true, mandiri: false },
  B: { nama: "Mandiri: mengulang hafalan do'a/surat min. 20 kali + baca Iqro'/Al-Qur'an disimak min. 1 halaman", kecil: true, besar: false, mandiri: true },
  MK: { nama: 'Muda-mudi (mumi) kelompok', kecil: false, besar: true, mandiri: false },
  KL: { nama: 'Pengajian kelompok', kecil: false, besar: true, mandiri: false },
  T: { nama: 'Sambung teks', kecil: false, besar: true, mandiri: false },
  MS: { nama: 'Muda-mudi (mumi) desa', kecil: false, besar: true, mandiri: false },
  DS: { nama: 'Pengajian desa', kecil: false, besar: true, mandiri: false },
  MR: { nama: 'Muda-mudi (mumi) daerah', kecil: false, besar: true, mandiri: false },
  DR: { nama: 'Pengajian daerah', kecil: false, besar: true, mandiri: false },
  AA: { nama: 'Latihan kemandirian / LDK / pramuka', kecil: false, besar: true, mandiri: false },
  AS: { nama: "Sambung amrin jami'in ASAD", kecil: false, besar: true, mandiri: false },
  TH: { nama: 'Mandiri tahfidz: mengulang target hafalan 20 kali + tadarus 1 halaman', kecil: false, besar: true, mandiri: true },
  QR: { nama: "Mandiri makna Al-Qur'an min. 1 halaman", kecil: false, besar: true, mandiri: true },
  HD: { nama: 'Mandiri makna hadits / materi kelas pondok min. 10 halaman', kecil: false, besar: true, mandiri: true },
  IZ: { nama: 'Izin (dicatat, tidak dihitung keaktifan)', kecil: true, besar: true, mandiri: false },
}
export const DAFTAR_KODE_KEAKTIFAN = Object.keys(KODE_KEAKTIFAN) as KodeKeaktifan[]
/** Kode kegiatan desa/daerah yang boleh dicatat EXE/pengurus desa & daerah (J-T10). */
export const KODE_DESA_DAERAH: readonly KodeKeaktifan[] = ['MS', 'DS', 'MR', 'DR']

/** Kode keaktifan yang berlaku untuk jenjang (PAUD–Caberawit: A, B, IZ; Generus 1–3: selain B). */
export function kodeUntukJenjang(jenjang: string): KodeKeaktifan[] {
  const kecil = jenjangKecil(jenjang)
  return DAFTAR_KODE_KEAKTIFAN.filter((k) => (kecil ? KODE_KEAKTIFAN[k].kecil : KODE_KEAKTIFAN[k].besar))
}

/** Hari dalam bulan berjalan mulai kartu "Kejar target" ditampilkan (J-T8). */
export const HARI_KEJAR_TARGET = 20

export type SumberKeaktifan = 'generus' | 'mubaligh' | 'admin'

export interface Keaktifan extends RekamanDasar {
  generus_id: string
  kelompok_id: string
  tanggal: string
  kode: KodeKeaktifan
  sumber: SumberKeaktifan
  status_sah: 'diajukan' | 'disahkan' | 'ditolak'
  disahkan_oleh: string | null
  disahkan_pada: string | null
  keterangan: string | null
}

const PANJANG_KETERANGAN = 500

/**
 * Pemeriksaan isi rekaman keaktifan (dipakai saat mencatat, impor BELAJAR, dan impor SETOR). Kembalikan alasan atau null.
 * `jenjang` = jenjang generus di penerima (bila diketahui).
 */
export function alasanKeaktifanTidakSah(rek: Record<string, unknown>, jenjang?: string | null, hariIni: string = tanggalHariIni()): string | null {
  const kode = String(rek.kode ?? '') as KodeKeaktifan
  if (!(kode in KODE_KEAKTIFAN)) return 'Kode keaktifan tidak dikenal.'
  if (jenjang && !kodeUntukJenjang(jenjang).includes(kode)) return `Kode ${kode} tidak berlaku untuk jenjang ini.`
  if (!tanggalSah(rek.tanggal)) return 'Tanggal keaktifan tidak sah.'
  if (String(rek.tanggal) > hariIni) return 'Tanggal keaktifan tidak boleh di masa depan.'
  if (!['generus', 'mubaligh', 'admin'].includes(String(rek.sumber))) return 'Sumber keaktifan tidak sah.'
  if (!['diajukan', 'disahkan', 'ditolak'].includes(String(rek.status_sah))) return 'Status keaktifan tidak sah.'
  if (rek.sumber === 'generus' && kode === 'A') return 'Kode A dicatat dari absen pengajian, bukan dari HP murid.'
  if (typeof rek.keterangan === 'string' && rek.keterangan.length > PANJANG_KETERANGAN) return 'Keterangan terlalu panjang.'
  return null
}

/** Profil pencatat keaktifan resmi (mubaligh/EXE ber-hak sahkan), atau null di admin daerah. */
function pencatatResmi(db: Db, kelompokId: string, kode: KodeKeaktifan): { profil: Profil | null; nama: string; sumber: SumberKeaktifan } {
  if (adalahAdmin(db)) return { profil: null, nama: 'Admin Daerah', sumber: 'admin' }
  try {
    const p = cariProfilPencatat(db, kelompokId, ['mubaligh', 'admin'], 'sahkan')
    return { profil: p, nama: p.nama, sumber: p.role === 'admin' ? 'admin' : 'mubaligh' }
  } catch (e) {
    // §17: pengurus daerah berjabatan agenda (muda/i, olahraga, tahfidz, …) boleh AA/AS dari agenda kegiatan
    if (kode === 'AA' || kode === 'AS') {
      const pj = daftarProfil(db, 'pengurus').find(
        (x) => statusProfil(x).bolehMencatat && (uraiToken(x.token).payload.jabatan ?? []).some((j) => JABATAN_PENCATAT_AGENDA.includes(j)),
      )
      if (!pj) throw e
      return { profil: pj, nama: pj.nama, sumber: 'admin' }
    }
    // J-T10: EXE desa / pengurus desa-daerah boleh mencatat kegiatan desa/daerah
    if (!KODE_DESA_DAERAH.includes(kode)) throw e
    const p = cariProfilPencatat(db, kelompokId, ['admin', 'pengurus'], 'catat')
    if (p.tingkat === 'kelompok') throw e
    return { profil: p, nama: p.nama, sumber: 'admin' }
  }
}

/** Profil generus di HP ini yang memegang `generusId` dan boleh menyetor belajar. */
function profilGenerusUntuk(db: Db, generusId: string): Profil {
  const p = daftarProfil(db, 'generus').find((x) => x.generus_ids.includes(generusId) && x.hak.includes('setor_belajar'))
  if (!p) throw new GalatPpg('TIDAK_BERWENANG', 'Profil murid untuk anak ini tidak ada di HP ini.')
  const st = statusProfil(p)
  if (!st.bolehMencatat) throw new GalatPpg(st.kode ?? 'TIDAK_BERWENANG', st.alasan ?? 'Profil tidak boleh mencatat.')
  return p
}

export interface DataKeaktifan {
  generusId: string
  tanggal: string
  kode: KodeKeaktifan
  keterangan?: string | null
  /** 'murid' = diajukan dari lembar kontrol HP murid/orang tua; 'pencatat' = mubaligh/EXE/admin (langsung disahkan). */
  sebagai: 'murid' | 'pencatat'
}

/**
 * Catat satu keaktifan di lembar kontrol. Murid → `diajukan` (menunggu mubaligh, J-T6); mubaligh/EXE kelompok/daerah →
 * langsung `disahkan`; EXE/pengurus desa-daerah hanya kode MS/DS/MR/DR. Satu kode yang sama pada hari yang sama tidak
 * dicatat dua kali (rekaman lama dikembalikan / diperbarui keterangannya).
 */
export function catatKeaktifan(db: Db, d: DataKeaktifan): Keaktifan {
  const g = ambilGenerus(db, d.generusId)
  if (!g || g.dihapus) throw new GalatPpg('GENERUS_TIDAK_ADA', 'Generus tidak ditemukan.')
  const murid = d.sebagai === 'murid'
  if (murid) profilGenerusUntuk(db, g.id)
  const resmi = murid ? null : pencatatResmi(db, g.kelompok_id, d.kode)
  const rek = {
    generus_id: g.id,
    kelompok_id: g.kelompok_id,
    tanggal: d.tanggal,
    kode: d.kode,
    sumber: murid ? 'generus' : resmi!.sumber,
    status_sah: murid ? 'diajukan' : 'disahkan',
    disahkan_oleh: murid ? null : resmi!.nama,
    disahkan_pada: murid ? null : sekarangIso(),
    keterangan: d.keterangan?.trim() || null,
  }
  const alasan = alasanKeaktifanTidakSah(rek, g.kategori)
  if (alasan) throw new GalatPpg('KEAKTIFAN_TIDAK_SAH', alasan)
  if (!murid && g.status !== 'aktif') throw new GalatPpg('GENERUS_TIDAK_AKTIF', `${g.nama} tidak berstatus aktif.`)
  const ada = db.satu<Keaktifan>(
    `SELECT * FROM keaktifan WHERE generus_id = ? AND tanggal = ? AND kode = ? AND dihapus = 0 AND status_sah != 'ditolak' ORDER BY diubah_pada DESC LIMIT 1`,
    [g.id, d.tanggal, d.kode],
  )
  if (ada) {
    // sudah ada: murid hanya bisa mengubah ajuannya sendiri; pencatat resmi mengesahkan yang masih diajukan
    if (!murid && ada.status_sah === 'diajukan') return sahkanKeaktifan(db, ada.id, 'disahkan')
    if (murid && ada.status_sah === 'diajukan' && rek.keterangan !== ada.keterangan) return ubahRekaman<Keaktifan>(db, 'keaktifan', ada.id, { keterangan: rek.keterangan })
    return ada
  }
  return sisipkanRekaman<Keaktifan>(db, 'keaktifan', rek)
}

/** Murid menghapus ajuan keaktifannya yang belum disahkan. */
export function hapusAjuanKeaktifan(db: Db, id: string): Keaktifan {
  const k = ambilRekaman<Keaktifan>(db, 'keaktifan', id)
  if (!k || k.dihapus) throw new GalatPpg('TIDAK_DITEMUKAN', 'Catatan keaktifan tidak ditemukan.')
  if (k.status_sah !== 'diajukan') throw new GalatPpg('SUDAH_DIPUTUSKAN', 'Catatan yang sudah disahkan/ditolak tidak bisa dihapus.')
  return ubahRekaman<Keaktifan>(db, 'keaktifan', id, { dihapus: 1 })
}

/** Mubaligh/EXE kelompok mengesahkan atau menolak keaktifan yang diajukan murid. */
export function sahkanKeaktifan(db: Db, id: string, keputusan: 'disahkan' | 'ditolak'): Keaktifan {
  const k = ambilRekaman<Keaktifan>(db, 'keaktifan', id)
  if (!k || k.dihapus) throw new GalatPpg('TIDAK_DITEMUKAN', 'Catatan keaktifan tidak ditemukan.')
  if (keputusan !== 'disahkan' && keputusan !== 'ditolak') throw new GalatPpg('KEPUTUSAN_TIDAK_SAH', 'Keputusan harus disahkan atau ditolak.')
  if (k.status_sah !== 'diajukan') throw new GalatPpg('SUDAH_DIPUTUSKAN', 'Catatan ini sudah diputuskan.')
  const nama = adalahAdmin(db) ? 'Admin Daerah' : cariProfilPencatat(db, k.kelompok_id, ['mubaligh', 'admin'], 'sahkan').nama
  return ubahRekaman<Keaktifan>(db, 'keaktifan', id, { status_sah: keputusan, disahkan_oleh: nama, disahkan_pada: sekarangIso() })
}

/** Daftar keaktifan (tanpa yang dihapus), urut tanggal. */
export function daftarKeaktifan(
  db: Db,
  f: { generusIds?: string[]; kelompokIds?: string[]; mulai?: string; selesai?: string; status?: Keaktifan['status_sah'] } = {},
): Keaktifan[] {
  const s = ['dihapus = 0']
  const p: string[] = []
  if (f.generusIds) {
    if (!f.generusIds.length) return []
    s.push(`generus_id IN (${tandaTanya(f.generusIds.length)})`)
    p.push(...f.generusIds)
  }
  if (f.kelompokIds) {
    if (!f.kelompokIds.length) return []
    s.push(`kelompok_id IN (${tandaTanya(f.kelompokIds.length)})`)
    p.push(...f.kelompokIds)
  }
  if (f.mulai) (s.push('tanggal >= ?'), p.push(f.mulai))
  if (f.selesai) (s.push('tanggal <= ?'), p.push(f.selesai))
  if (f.status) (s.push('status_sah = ?'), p.push(f.status))
  return db.kueri<Keaktifan>(`SELECT * FROM keaktifan WHERE ${s.join(' AND ')} ORDER BY tanggal, diubah_pada`, p)
}

/** Keaktifan yang diajukan murid dan menunggu pengesahan di kelompok (urut tanggal), beserta nama generus. */
export function keaktifanMenunggu(db: Db, kelompokId: string): (Keaktifan & { nama: string })[] {
  return db.kueri<Keaktifan & { nama: string }>(
    `SELECT k.*, g.nama AS nama FROM keaktifan k JOIN generus g ON g.id = k.generus_id
     WHERE k.kelompok_id = ? AND k.status_sah = 'diajukan' AND k.dihapus = 0 ORDER BY k.tanggal, g.nama`,
    [kelompokId],
  )
}

// ---------------- catatan sholat (lokal, J-T17) ----------------

export const WAKTU_SHOLAT = ['SB', 'ZH', 'AS', 'MG', 'IS'] as const
export type WaktuSholat = (typeof WAKTU_SHOLAT)[number]

/** Simpan centang sholat 5 waktu satu hari (lokal HP, tidak disetor, tidak masuk nilai). */
export function aturCatatanSholat(db: Db, generusId: string, tanggal: string, sholat: WaktuSholat[]): void {
  if (!tanggalSah(tanggal)) throw new GalatPpg('TANGGAL_TIDAK_SAH', 'Tanggal tidak sah.')
  const isi = WAKTU_SHOLAT.filter((w) => sholat.includes(w)).join(',')
  db.jalankan('INSERT OR REPLACE INTO catatan_sholat (generus_id, tanggal, sholat) VALUES (?, ?, ?)', [generusId, tanggal, isi])
}

/** Catatan sholat satu bulan: tanggal → waktu sholat yang dicentang. */
export function catatanSholatBulan(db: Db, generusId: string, bulan: string): Record<string, WaktuSholat[]> {
  const hasil: Record<string, WaktuSholat[]> = {}
  for (const r of db.kueri<{ tanggal: string; sholat: string }>(
    `SELECT tanggal, sholat FROM catatan_sholat WHERE generus_id = ? AND tanggal LIKE ?`,
    [generusId, `${bulan}-%`],
  )) {
    hasil[r.tanggal] = r.sholat ? (r.sholat.split(',') as WaktuSholat[]) : []
  }
  return hasil
}

// ---------------- hitung keaktifan ----------------

/** Jumlah hari dalam bulan 'YYYY-MM'. */
export function hariDalamBulan(bulan: string): number {
  const [y, m] = bulan.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Persen keaktifan bulan (J-T5/J-T6): min(jumlah, target) ÷ target × 100, dua desimal. */
export function persenKeaktifan(jumlah: number, target: number): number {
  if (!(target > 0)) return 0
  return Math.round((Math.min(Math.max(0, jumlah), target) / target) * 10000) / 100
}

/** Nilai sementara target keaktifan (juknis) bila materi evaluasi belum ada di perangkat ini (J-C1). */
export function targetKeaktifanSementara(jenjang: string): number {
  return jenjang === 'pranikah' ? 16 : 20
}

/**
 * Target keaktifan per bulan untuk jenjang — butir Kurikulum K16 (§19), disimpan sebagai target materi evaluasi
 * `keaktifan`. Satu-satunya pembaca target: semua hitungan (bulanan, semester, raport, rekap, kejar target, reward,
 * cetakan lembar) memakai fungsi ini.
 */
export function targetKeaktifan(db: Db, jenjang: string): number {
  const j = jenjang === 'caberawit' ? 'caberawit_a' : jenjang
  const t = db.nilai<number | null>(`SELECT target FROM materi_evaluasi WHERE id = ? AND dihapus = 0`, [idMateriEvaluasi(j, 'keaktifan')])
  return t && t > 0 ? t : targetKeaktifanSementara(j)
}

/** Teks target keaktifan untuk layar, mis. "20 kali/bulan (Pra Nikah 16)" atau per kelompok jenjang bila berbeda. */
export function ringkasTargetKeaktifan(db: Db): string {
  const t = KATEGORI_GENERUS.map((j) => targetKeaktifan(db, j))
  const pn = t[t.length - 1]!
  const lain = t.slice(0, -1)
  if (lain.every((x) => x === lain[0])) return lain[0] === pn ? `${pn} kali/bulan` : `${lain[0]} kali/bulan (Pra Nikah ${pn})`
  // kelompokkan jenjang berurutan bernilai sama
  const nama = ['PAUD', 'Caberawit A', 'Caberawit B', 'Caberawit C', 'Pra Remaja', 'Remaja', 'Pra Nikah']
  const bagian: string[] = []
  let i = 0
  while (i < t.length) {
    let k = i
    while (k + 1 < t.length && t[k + 1] === t[i]) k++
    bagian.push(`${k > i ? `${nama[i]}–${nama[k]}` : nama[i]} ${t[i]}`)
    i = k + 1
  }
  return `${bagian.join(' · ')} kali/bulan`
}

export interface HariKeaktifan {
  tanggal: string
  /** Kode yang dihitung (disahkan / dari absen). */
  kode: string[]
  /** Kode yang masih diajukan (menunggu mubaligh). */
  diajukan: string[]
  /** Kode izin (tidak dihitung). */
  izin: boolean
  dihitung: boolean
}

export interface KeaktifanBulan {
  bulan: string
  target: number
  jumlah: number
  persen: number
  /** Hari yang hanya berisi ajuan (belum disahkan). */
  menunggu: number
  hari: HariKeaktifan[]
}

function kodePresensi(db: Db, pengajianId: string | null, cache: Map<string, string>): string {
  if (!pengajianId) return 'A'
  let k = cache.get(pengajianId)
  if (k) return k
  const w = db.satu<{ tingkat: string }>(
    `SELECT w.tingkat AS tingkat FROM pengajian p JOIN wilayah w ON w.id = p.wilayah_id WHERE p.id = ?`,
    [pengajianId],
  )
  k = w?.tingkat === 'desa' ? 'DS' : w?.tingkat === 'daerah' ? 'DR' : 'A'
  cache.set(pengajianId, k)
  return k
}

/** Keaktifan satu generus dalam satu bulan 'YYYY-MM' (maks. 1 per hari, J-T6). */
export function keaktifanBulan(db: Db, generusId: string, bulan: string, jenjang?: string): KeaktifanBulan {
  const g = ambilGenerus(db, generusId)
  const target = targetKeaktifan(db, jenjang ?? g?.kategori ?? 'paud')
  const mulai = `${bulan}-01`
  const selesai = `${bulan}-${String(hariDalamBulan(bulan)).padStart(2, '0')}`
  const peta = new Map<string, HariKeaktifan>()
  const hari = (t: string) => {
    let h = peta.get(t)
    if (!h) peta.set(t, (h = { tanggal: t, kode: [], diajukan: [], izin: false, dihitung: false }))
    return h
  }
  const cache = new Map<string, string>()
  for (const p of daftarPresensi(db, { generusIds: [generusId], mulai, selesai })) {
    if (p.status === 'hadir') {
      const h = hari(p.tanggal)
      const k = kodePresensi(db, p.pengajian_id, cache)
      if (!h.kode.includes(k)) h.kode.push(k)
    } else if (p.status === 'izin') hari(p.tanggal).izin = true
  }
  for (const k of daftarKeaktifan(db, { generusIds: [generusId], mulai, selesai })) {
    if (k.status_sah === 'ditolak') continue
    const h = hari(k.tanggal)
    if (k.kode === 'IZ') h.izin = true
    else if (k.status_sah === 'disahkan') {
      if (!h.kode.includes(k.kode)) h.kode.push(k.kode)
    } else if (!h.diajukan.includes(k.kode)) h.diajukan.push(k.kode)
  }
  const daftar = [...peta.values()].sort((a, b) => a.tanggal.localeCompare(b.tanggal))
  for (const h of daftar) h.dihitung = h.kode.length > 0
  const jumlah = daftar.filter((h) => h.dihitung).length
  return {
    bulan,
    target,
    jumlah,
    persen: persenKeaktifan(jumlah, target),
    menunggu: daftar.filter((h) => !h.dihitung && h.diajukan.length > 0).length,
    hari: daftar,
  }
}

/** Bulan-bulan semester (V-T10): S1 = Juli–Desember tahun itu, S2 = Januari–Juni tahun berikutnya. */
export function bulanPeriode(periode: string): string[] {
  if (!periodeSah(periode)) throw new GalatPpg('PERIODE_TIDAK_SAH', 'Periode harus berbentuk YYYY-S1 atau YYYY-S2.')
  const y = Number(periode.slice(0, 4))
  const s1 = periode.endsWith('S1')
  return Array.from({ length: 6 }, (_, i) => (s1 ? `${y}-${String(7 + i).padStart(2, '0')}` : `${y + 1}-${String(1 + i).padStart(2, '0')}`))
}

export interface KeaktifanPeriode {
  periode: string
  bulan: (KeaktifanBulan & { dihitungDalamRata: boolean })[]
  /** Rata-rata persen bulan yang dihitung (null bila belum ada bulan yang dihitung). */
  persen: number | null
}

/**
 * Keaktifan semester (J-T7): rata-rata persen bulanan untuk bulan semester sampai bulan berjalan; bulan dihitung bila
 * generus berstatus aktif dan anggota suatu kelompok pada akhir bulan (bulan berjalan: hari ini).
 */
export function keaktifanPeriode(db: Db, generusId: string, periode: string, o: { tanggal?: string; jenjang?: string } = {}): KeaktifanPeriode {
  const hariIni = o.tanggal ?? tanggalHariIni()
  const bulanKini = hariIni.slice(0, 7)
  const peta = new PetaRiwayat(db, [generusId])
  const hasil: KeaktifanPeriode['bulan'] = []
  for (const b of bulanPeriode(periode)) {
    if (b > bulanKini) break
    const acuan = b === bulanKini ? hariIni : `${b}-${String(hariDalamBulan(b)).padStart(2, '0')}`
    const ikut = peta.statusPada(generusId, acuan) === 'aktif' && peta.kelompokPada(generusId, acuan) !== null
    hasil.push({ ...keaktifanBulan(db, generusId, b, o.jenjang), dihitungDalamRata: ikut })
  }
  const dihitung = hasil.filter((b) => b.dihitungDalamRata)
  const persen = dihitung.length ? Math.round((dihitung.reduce((s, b) => s + b.persen, 0) / dihitung.length) * 100) / 100 : null
  return { periode, bulan: hasil, persen }
}

export interface KejarTarget {
  bulan: string
  jumlah: number
  target: number
  kurang: number
  sisaHari: number
  /** Masih mungkin tercapai bila tiap sisa hari terisi. */
  terkejar: boolean
}

/** Kartu "Kejar target" (J-T8): mulai tanggal 20, bila keaktifan bulan berjalan masih kurang dari target. */
export function kejarTarget(db: Db, generusId: string, tanggal: string = tanggalHariIni()): KejarTarget | null {
  const hari = Number(tanggal.slice(8, 10))
  if (hari < HARI_KEJAR_TARGET) return null
  const bulan = tanggal.slice(0, 7)
  const k = keaktifanBulan(db, generusId, bulan)
  if (k.jumlah >= k.target) return null
  const sudahHariIni = k.hari.some((h) => h.tanggal === tanggal && h.dihitung)
  const sisaHari = hariDalamBulan(bulan) - hari + (sudahHariIni ? 0 : 1)
  const kurang = k.target - k.jumlah
  return { bulan, jumlah: k.jumlah, target: k.target, kurang, sisaHari, terkejar: sisaHari >= kurang }
}

/** Generus aktif kelompok yang perlu kejar target bulan ini (untuk mubaligh), urut paling kurang. */
export function kejarTargetKelompok(db: Db, kelompokId: string, tanggal: string = tanggalHariIni()): (KejarTarget & { generus_id: string; nama: string })[] {
  if (Number(tanggal.slice(8, 10)) < HARI_KEJAR_TARGET) return []
  const gs = db.kueri<{ id: string; nama: string }>(`SELECT id, nama FROM generus WHERE kelompok_id = ? AND status = 'aktif' AND dihapus = 0 ORDER BY nama`, [kelompokId])
  const hasil: (KejarTarget & { generus_id: string; nama: string })[] = []
  for (const g of gs) {
    const k = kejarTarget(db, g.id, tanggal)
    if (k) hasil.push({ ...k, generus_id: g.id, nama: g.nama })
  }
  return hasil.sort((a, b) => b.kurang - a.kurang || a.nama.localeCompare(b.nama))
}

// =====================================================================================================================
// Materi evaluasi (master) & bulan evaluasi
// =====================================================================================================================

export interface MateriEvaluasi extends RekamanDasar {
  jenjang: KategoriGenerus
  urutan: number
  kode: string
  nama: string
  cara: CaraEvaluasi
  target: number | null
  satuan: string | null
  rincian: RincianMateriEvaluasi
}

type BarisMateriEvaluasi = Omit<MateriEvaluasi, 'rincian'> & { rincian_json: string | null }

function bentukMateri(r: BarisMateriEvaluasi): MateriEvaluasi {
  const { rincian_json, ...lain } = r
  return { ...lain, target: r.target === null ? null : Number(r.target), rincian: uraiJson<RincianMateriEvaluasi>(rincian_json, {}) }
}

/** Materi evaluasi satu jenjang (urut kolom rekap). */
export function daftarMateriEvaluasi(db: Db, jenjang: string): MateriEvaluasi[] {
  return db
    .kueri<BarisMateriEvaluasi>(`SELECT * FROM materi_evaluasi WHERE jenjang = ? AND dihapus = 0 ORDER BY urutan, kode`, [jenjang])
    .map(bentukMateri)
}

export function ambilMateriEvaluasi(db: Db, id: string): MateriEvaluasi | undefined {
  const r = ambilRekaman<BarisMateriEvaluasi>(db, 'materi_evaluasi', id)
  return r && !r.dihapus ? bentukMateri(r) : undefined
}

const CARA_SAH: readonly CaraEvaluasi[] = ['keaktifan', 'hitungan', 'juz', 'kitab', 'subjektif']

function validasiMateriEvaluasi(m: { nama: string; cara: CaraEvaluasi; target: number | null; rincian: RincianMateriEvaluasi }): void {
  if (!m.nama.trim()) throw new GalatPpg('NAMA_KOSONG', 'Nama materi wajib diisi.')
  if (!CARA_SAH.includes(m.cara)) throw new GalatPpg('CARA_TIDAK_SAH', 'Cara penilaian tidak dikenal.')
  if (m.target !== null && (!Number.isInteger(m.target) || m.target < 1 || m.target > 10000)) throw new GalatPpg('TARGET_TIDAK_SAH', 'Target harus bilangan bulat 1–10000.')
  // §19 (K16): satu hari dihitung satu kali → target keaktifan 1–31 kali/bulan (ditegakkan juga untuk berkas KURIKULUM)
  if (m.cara === 'keaktifan' && m.target !== null && m.target > 31) throw new GalatPpg('TARGET_TIDAK_SAH', 'Target keaktifan 1–31 kali/bulan.')
  if (m.cara === 'subjektif' && m.target !== null && m.target !== 75) throw new GalatPpg('TARGET_TIDAK_SAH', 'Nilai subjektif selalu dibatasi 75%.')
  if (m.cara === 'juz') {
    const juz = m.rincian.juz ?? []
    if (!juz.length || juz.some((j) => !Number.isInteger(j) || j < 1 || j > 30)) throw new GalatPpg('RINCIAN_TIDAK_SAH', 'Daftar juz harus 1–30.')
    if (m.target !== juz.length) throw new GalatPpg('TARGET_TIDAK_SAH', 'Target = jumlah juz.')
  }
  if (m.cara === 'kitab') {
    const kitab = m.rincian.kitab ?? []
    if (!kitab.length || kitab.some((k) => !k.nama?.trim() || (k.halaman !== null && (!Number.isInteger(k.halaman) || k.halaman < 1))))
      throw new GalatPpg('RINCIAN_TIDAK_SAH', 'Setiap kitab perlu nama dan halaman terakhir (bilangan bulat ≥ 1, atau kosong).')
    if (m.target !== kitab.length) throw new GalatPpg('TARGET_TIDAK_SAH', 'Target = jumlah kitab.')
  }
  if (m.rincian.butir && m.target !== null && m.rincian.butir.length !== m.target) throw new GalatPpg('TARGET_TIDAK_SAH', 'Target = jumlah butir.')
}

/** Pemeriksaan rekaman materi evaluasi dari berkas KURIKULUM (bentuk & batas). Kembalikan alasan atau null. */
export function alasanMateriEvaluasiTidakSah(rek: Record<string, unknown>): string | null {
  if (!KATEGORI_GENERUS.includes(rek.jenjang as KategoriGenerus)) return 'Jenjang materi evaluasi tidak dikenal.'
  if (rek.id !== idMateriEvaluasi(String(rek.jenjang), String(rek.kode))) return 'Id materi evaluasi tidak sah.'
  if (rek.dihapus) return null
  try {
    validasiMateriEvaluasi({
      nama: String(rek.nama ?? ''),
      cara: rek.cara as CaraEvaluasi,
      target: rek.target === null || rek.target === undefined ? null : Number(rek.target),
      rincian: uraiJson<RincianMateriEvaluasi>(rek.rincian_json, {}),
    })
  } catch (e) {
    return e instanceof GalatPpg ? e.pesan : 'Materi evaluasi tidak sah.'
  }
  return null
}

/** Ubah materi evaluasi (Kurikulum / daerah): nama, target, satuan, rincian (butir, juz, kitab + halaman). */
export function ubahMateriEvaluasi(
  db: Db,
  id: string,
  p: { nama?: string; target?: number | null; satuan?: string | null; rincian?: RincianMateriEvaluasi; urutan?: number },
): MateriEvaluasi {
  pastikanPengelolaKurikulum(db)
  const lama = ambilMateriEvaluasi(db, id)
  if (!lama) throw new GalatPpg('TIDAK_DITEMUKAN', 'Materi evaluasi tidak ditemukan.')
  const rincian = p.rincian ?? lama.rincian
  let target = p.target !== undefined ? p.target : lama.target
  if (p.rincian?.juz && lama.cara === 'juz') target = p.rincian.juz.length
  if (p.rincian?.kitab && lama.cara === 'kitab') target = p.rincian.kitab.length
  if (p.rincian?.butir && p.target === undefined) target = p.rincian.butir.length
  const baru = { nama: p.nama ?? lama.nama, cara: lama.cara, target, rincian }
  validasiMateriEvaluasi(baru)
  ubahRekaman(db, 'materi_evaluasi', id, {
    nama: baru.nama.trim(),
    target,
    satuan: p.satuan !== undefined ? p.satuan : lama.satuan,
    rincian_json: JSON.stringify(rincian),
    ...(p.urutan !== undefined ? { urutan: p.urutan } : {}),
  })
  return ambilMateriEvaluasi(db, id)!
}

/** Tambah materi evaluasi baru untuk jenjang (Kurikulum / daerah). */
export function tambahMateriEvaluasi(
  db: Db,
  d: { jenjang: KategoriGenerus; kode: string; nama: string; cara: CaraEvaluasi; target: number | null; satuan?: string | null; rincian?: RincianMateriEvaluasi },
): MateriEvaluasi {
  pastikanPengelolaKurikulum(db)
  if (!KATEGORI_GENERUS.includes(d.jenjang)) throw new GalatPpg('KATEGORI_TIDAK_SAH', 'Jenjang tidak dikenal.')
  const kode = d.kode.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
  if (!kode) throw new GalatPpg('KODE_KOSONG', 'Kode materi wajib diisi.')
  const id = idMateriEvaluasi(d.jenjang, kode)
  const ada = ambilRekaman<{ dihapus: number }>(db, 'materi_evaluasi', id)
  if (ada && !ada.dihapus) throw new GalatPpg('SUDAH_ADA', 'Kode materi sudah dipakai di jenjang ini.')
  const rincian = d.rincian ?? {}
  validasiMateriEvaluasi({ nama: d.nama, cara: d.cara, target: d.target, rincian })
  const urutan = (db.nilai<number>('SELECT MAX(urutan) FROM materi_evaluasi WHERE jenjang = ?', [d.jenjang]) ?? 0) + 1
  const isi = { jenjang: d.jenjang, urutan, kode, nama: d.nama.trim(), cara: d.cara, target: d.target, satuan: d.satuan ?? null, rincian_json: JSON.stringify(rincian) }
  if (ada) ubahRekaman(db, 'materi_evaluasi', id, { ...isi, dihapus: 0 })
  else sisipkanRekaman(db, 'materi_evaluasi', isi, { id })
  return ambilMateriEvaluasi(db, id)!
}

/** Hapus (lunak) materi evaluasi. */
export function hapusMateriEvaluasi(db: Db, id: string): void {
  pastikanPengelolaKurikulum(db)
  if (!ambilMateriEvaluasi(db, id)) throw new GalatPpg('TIDAK_DITEMUKAN', 'Materi evaluasi tidak ditemukan.')
  ubahRekaman(db, 'materi_evaluasi', id, { dihapus: 1 })
}

export interface BulanEvaluasi {
  S1: number
  S2: number
}
export const BULAN_EVALUASI_BAWAAN: BulanEvaluasi = { S1: 11, S2: 5 }

/** Bulan evaluasi semester (J-T14): bawaan November (S1) & Mei (S2). */
export function bulanEvaluasi(db: Db): BulanEvaluasi {
  const r = ambilRekaman<{ isi: string | null; dihapus: number }>(db, 'pengaturan', 'bulan_evaluasi')
  const b = r && !r.dihapus ? uraiJson<Partial<BulanEvaluasi>>(r.isi, {}) : {}
  const s1 = Number(b.S1)
  const s2 = Number(b.S2)
  return {
    S1: Number.isInteger(s1) && s1 >= 7 && s1 <= 12 ? s1 : BULAN_EVALUASI_BAWAAN.S1,
    S2: Number.isInteger(s2) && s2 >= 1 && s2 <= 6 ? s2 : BULAN_EVALUASI_BAWAAN.S2,
  }
}

/** Atur bulan evaluasi (Kurikulum / daerah). S1 harus Juli–Desember, S2 Januari–Juni. */
export function aturBulanEvaluasi(db: Db, b: BulanEvaluasi): void {
  pastikanPengelolaKurikulum(db)
  if (!Number.isInteger(b.S1) || b.S1 < 7 || b.S1 > 12) throw new GalatPpg('BULAN_TIDAK_SAH', 'Bulan evaluasi semester 1 harus Juli–Desember.')
  if (!Number.isInteger(b.S2) || b.S2 < 1 || b.S2 > 6) throw new GalatPpg('BULAN_TIDAK_SAH', 'Bulan evaluasi semester 2 harus Januari–Juni.')
  const isi = JSON.stringify({ S1: b.S1, S2: b.S2 })
  if (ambilRekaman(db, 'pengaturan', 'bulan_evaluasi')) ubahRekaman(db, 'pengaturan', 'bulan_evaluasi', { isi, dihapus: 0 })
  else sisipkanRekaman(db, 'pengaturan', { isi }, { id: 'bulan_evaluasi' })
}

/** Id pengaturan yang ikut berkas MATERI/KURIKULUM/BALASAN (bukan rahasia). */
export const PENGATURAN_KURIKULUM: readonly string[] = ['periode_aktif', 'bulan_evaluasi']

/** §18 (J-KR6): pengaturan wewenang kurikulum = periode/bulan evaluasi + penetapan butir `kur:*` (berkas MATERI & KURIKULUM). */
export function pengaturanKurikulumSah(id: unknown): boolean {
  return typeof id === 'string' && (PENGATURAN_KURIKULUM.includes(id) || /^kur:K\d{2}$/.test(id))
}

// =====================================================================================================================
// Evaluasi penguasaan materi
// =====================================================================================================================

export interface HasilEvaluasiInput {
  dikuasai?: number | null
  nilai?: number | null
  rincian?: Record<string, unknown> | null
}

/** Halaman per juz untuk makna Al-Qur'an. */
export const HALAMAN_PER_JUZ = 20
/** Batas maksimal nilai subjektif penguji. */
export const BATAS_SUBJEKTIF = 75

const bulat = (n: number) => Number.isInteger(n)

/** J-T9: pemeriksaan input evaluasi terhadap materi. Kembalikan alasan penolakan atau null. */
export function alasanEvaluasiTidakSah(m: Pick<MateriEvaluasi, 'nama' | 'cara' | 'target' | 'rincian'>, h: HasilEvaluasiInput): string | null {
  const rincian = h.rincian ?? {}
  switch (m.cara) {
    case 'keaktifan':
      return 'Keaktifan dihitung dari lembar kontrol, tidak diinput.'
    case 'subjektif': {
      if (h.nilai === null || h.nilai === undefined) return null
      if (!bulat(h.nilai) || h.nilai < 1) return 'Nilai subjektif harus bilangan bulat 1–75.'
      if (h.nilai > BATAS_SUBJEKTIF) return `Nilai subjektif paling tinggi ${BATAS_SUBJEKTIF}% (juknis).`
      return null
    }
    case 'hitungan': {
      if (m.target === null) return `Target "${m.nama}" belum ditetapkan Kurikulum.`
      const butir = (rincian as { butir?: unknown }).butir
      if (butir !== undefined) {
        const n = m.rincian.butir?.length ?? 0
        if (!Array.isArray(butir) || butir.some((x) => !bulat(x as number) || (x as number) < 0 || (x as number) >= n) || new Set(butir).size !== butir.length)
          return 'Centang butir tidak sah.'
        if (h.dikuasai !== undefined && h.dikuasai !== null && h.dikuasai !== butir.length) return 'Jumlah dikuasai tidak sama dengan butir yang dicentang.'
      }
      const d = h.dikuasai ?? (Array.isArray(butir) ? butir.length : null)
      if (d === null) return null
      if (!bulat(d) || d < 0) return 'Jumlah dikuasai harus bilangan bulat ≥ 0.'
      if (d > m.target) return `Jumlah dikuasai (${d}) melebihi target ${m.target}.`
      return null
    }
    case 'juz': {
      const juz = new Set((m.rincian.juz ?? []).map(String))
      for (const [k, v] of Object.entries(rincian)) {
        if (!juz.has(k)) return `Juz ${k} bukan target jenjang ini.`
        if (!bulat(v as number) || (v as number) < 0) return 'Halaman makna harus bilangan bulat ≥ 0.'
        if ((v as number) > HALAMAN_PER_JUZ) return `Halaman makna juz ${k} paling banyak ${HALAMAN_PER_JUZ}.`
      }
      return null
    }
    case 'kitab': {
      const kitab = m.rincian.kitab ?? []
      for (const [k, v] of Object.entries(rincian)) {
        const i = Number(k)
        const kt = bulat(i) && i >= 0 ? kitab[i] : undefined
        if (!kt) return 'Kitab bukan target jenjang ini.'
        if (!bulat(v as number) || (v as number) < 0) return 'Halaman makna harus bilangan bulat ≥ 0.'
        if ((v as number) > 0 && kt.halaman === null) return `Jumlah halaman ${kt.nama} belum diisi Kurikulum.`
        if (kt.halaman !== null && (v as number) > kt.halaman) return `Halaman ${kt.nama} paling banyak ${kt.halaman}.`
      }
      return null
    }
    default:
      return 'Cara penilaian tidak dikenal.'
  }
}

const satuDesimal = (n: number) => Math.round(n * 10) / 10

/**
 * Persen penguasaan satu materi (0–100, satu desimal) — rumus juknis §16.1 butir 3. Input lebih besar dari target
 * dibatasi ke target (target diturunkan setelah dinilai). `null` bila materi belum ditetapkan targetnya.
 */
export function hitungPersenMateri(m: Pick<MateriEvaluasi, 'cara' | 'target' | 'rincian'>, h: HasilEvaluasiInput | undefined): number | null {
  switch (m.cara) {
    case 'subjektif':
      return h?.nilai ? Math.min(Math.max(0, h.nilai), BATAS_SUBJEKTIF) : 0
    case 'hitungan': {
      if (!m.target) return null
      const butir = (h?.rincian as { butir?: unknown[] } | undefined)?.butir
      const d = h?.dikuasai ?? (Array.isArray(butir) ? butir.length : 0)
      return satuDesimal((Math.min(Math.max(0, d), m.target) / m.target) * 100)
    }
    case 'juz': {
      const juz = m.rincian.juz ?? []
      if (!juz.length) return null
      const r = (h?.rincian ?? {}) as Record<string, number>
      const jumlah = juz.reduce((s, j) => s + (Math.min(Math.max(0, Number(r[String(j)] ?? 0)), HALAMAN_PER_JUZ) / HALAMAN_PER_JUZ) * 100, 0)
      return satuDesimal(jumlah / juz.length)
    }
    case 'kitab': {
      const kitab = m.rincian.kitab ?? []
      // §18 (J-KR4): ada kitab tanpa halaman → materi belum ditetapkan Kurikulum, tidak ikut TOTAL
      if (!kitab.length || kitab.some((k) => !k.halaman)) return null
      const r = (h?.rincian ?? {}) as Record<string, number>
      const jumlah = kitab.reduce((s, k, i) => s + (k.halaman ? (Math.min(Math.max(0, Number(r[String(i)] ?? 0)), k.halaman) / k.halaman) * 100 : 0), 0)
      return satuDesimal(jumlah / kitab.length)
    }
    default:
      return null
  }
}

/** §18 (K09) → §20 (J-R5): rumus Nilai Akhir — rata-rata 3 aspek Tri Sukses (bawaan) atau rata-rata semua butir materi. */
export type RumusTotal = RumusNilaiAkhir
/** Id pengaturan penetapan rumus Nilai Akhir (butir Kurikulum K09). */
export const ID_RUMUS_TOTAL = 'kur:K09'

export function rumusTotal(db: Db): RumusTotal {
  return rumusNilaiAkhir(db)
}

/** Materi yang isiannya belum ditetapkan Kurikulum (target kosong / kitab tanpa halaman / tanpa juz). */
export function materiBelumDitetapkan(m: Pick<MateriEvaluasi, 'cara' | 'target' | 'rincian'>): boolean {
  return m.cara !== 'keaktifan' && m.cara !== 'subjektif' && hitungPersenMateri(m, undefined) === null
}

/** Rata-rata persen yang ada (null = belum dinilai / belum ditetapkan, tidak dihitung), satu desimal. */
export function hitungTotal(persen: (number | null)[]): number | null {
  const ada = persen.filter((p): p is number => p !== null)
  return ada.length ? satuDesimal(ada.reduce((s, p) => s + p, 0) / ada.length) : null
}

export interface EvaluasiSemester extends RekamanDasar {
  generus_id: string
  kelompok_id: string
  periode: string
  jenjang: KategoriGenerus
  materi_evaluasi_id: string
  dikuasai: number | null
  nilai: number | null
  rincian_json: string | null
  tanggal: string
  penguji: string | null
}

/** Id tetap hasil evaluasi (generus × periode × materi) — ringkas agar ≤ 64 karakter (batas id rekaman). */
export const idEvaluasi = (generusId: string, periode: string, materiEvaluasiId: string) =>
  `EVS-${sha256Hex(new TextEncoder().encode(`${generusId}|${periode}|${materiEvaluasiId}`)).slice(0, 40)}`

/** Bentuk input dari rekaman evaluasi. */
export function inputDariRekaman(r: Pick<EvaluasiSemester, 'dikuasai' | 'nilai' | 'rincian_json'>): HasilEvaluasiInput {
  return {
    dikuasai: r.dikuasai === null || r.dikuasai === undefined ? null : Number(r.dikuasai),
    nilai: r.nilai === null || r.nilai === undefined ? null : Number(r.nilai),
    rincian: uraiJson<Record<string, unknown> | null>(r.rincian_json, null),
  }
}

/**
 * Pemeriksaan rekaman evaluasi yang diterima (impor SETOR, J-T9/J-T10): materi dikenal, jenjang & periode cocok, isi
 * di dalam batas target. Kembalikan alasan atau null.
 */
export function alasanRekamanEvaluasiTidakSah(db: Db, rek: Record<string, unknown>): string | null {
  if (!periodeSah(rek.periode)) return 'Periode evaluasi tidak sah.'
  const m = ambilMateriEvaluasi(db, String(rek.materi_evaluasi_id ?? ''))
  if (!m) return 'Materi evaluasi tidak dikenal.'
  if (rek.jenjang !== m.jenjang) return 'Jenjang evaluasi tidak cocok dengan materinya.'
  if (rek.id !== idEvaluasi(String(rek.generus_id), String(rek.periode), m.id)) return 'Id evaluasi tidak sah.'
  if (!tanggalSah(rek.tanggal)) return 'Tanggal evaluasi tidak sah.'
  if (rek.dihapus) return null
  return alasanEvaluasiTidakSah(m, inputDariRekaman(rek as unknown as EvaluasiSemester))
}

export interface DataEvaluasi extends HasilEvaluasiInput {
  generusId: string
  materiEvaluasiId: string
  /** Bawaan: periode aktif. */
  periode?: string
  tanggal?: string
  penguji?: string | null
}

/**
 * Mubaligh / EXE kelompok / daerah menyimpan hasil evaluasi satu materi untuk satu generus (id tetap per generus ×
 * periode × materi, jadi menyimpan ulang = memperbarui). Materi boleh dari jenjang generus atau jenjang sebelumnya
 * (menuntaskan sisa target, J-T15). Batas target & 75 % ditegakkan di sini.
 */
export function simpanEvaluasi(db: Db, d: DataEvaluasi): EvaluasiSemester {
  const g = ambilGenerus(db, d.generusId)
  if (!g || g.dihapus) throw new GalatPpg('GENERUS_TIDAK_ADA', 'Generus tidak ditemukan.')
  const jenjang = pastikanJenjangDitetapkan(g)
  const m = ambilMateriEvaluasi(db, d.materiEvaluasiId)
  if (!m) throw new GalatPpg('TIDAK_DITEMUKAN', 'Materi evaluasi tidak ditemukan.')
  if (KATEGORI_GENERUS.indexOf(m.jenjang) > KATEGORI_GENERUS.indexOf(jenjang)) {
    throw new GalatPpg('JENJANG_TIDAK_COCOK', 'Materi ini untuk jenjang di atas jenjang generus.')
  }
  const periode = d.periode ?? periodeAktif(db)
  if (!periodeSah(periode)) throw new GalatPpg('PERIODE_TIDAK_SAH', 'Periode harus berbentuk YYYY-S1 atau YYYY-S2.')
  const tanggal = d.tanggal ?? tanggalHariIni()
  if (!tanggalSah(tanggal)) throw new GalatPpg('TANGGAL_TIDAK_SAH', 'Tanggal evaluasi tidak sah.')
  const input: HasilEvaluasiInput = { dikuasai: d.dikuasai ?? null, nilai: d.nilai ?? null, rincian: d.rincian ?? null }
  const butir = (input.rincian as { butir?: unknown[] } | null)?.butir
  if (m.cara === 'hitungan' && Array.isArray(butir) && input.dikuasai === null) input.dikuasai = butir.length
  const alasan = alasanEvaluasiTidakSah(m, input)
  if (alasan) throw new GalatPpg('EVALUASI_TIDAK_SAH', alasan)
  let penguji = d.penguji?.trim() || null
  if (!adalahAdmin(db)) {
    const p = cariProfilPencatat(db, g.kelompok_id, ['mubaligh', 'admin'], 'sahkan')
    penguji ||= p.nama
  }
  const isi = {
    generus_id: g.id,
    kelompok_id: g.kelompok_id,
    periode,
    jenjang: m.jenjang,
    materi_evaluasi_id: m.id,
    dikuasai: m.cara === 'hitungan' ? input.dikuasai : null,
    nilai: m.cara === 'subjektif' ? input.nilai : null,
    rincian_json: input.rincian && Object.keys(input.rincian).length ? JSON.stringify(input.rincian) : null,
    tanggal,
    penguji,
  }
  const id = idEvaluasi(g.id, periode, m.id)
  if (ambilRekaman(db, 'evaluasi_semester', id)) return ubahRekaman<EvaluasiSemester>(db, 'evaluasi_semester', id, { ...isi, dihapus: 0 })
  return sisipkanRekaman<EvaluasiSemester>(db, 'evaluasi_semester', isi, { id })
}

/** Evaluasi terbaru per materi untuk generus sampai periode tertentu (periode lebih awal sebagai cadangan). */
function evaluasiTerbaru(db: Db, generusId: string, sampaiPeriode: string): Map<string, EvaluasiSemester> {
  const peta = new Map<string, EvaluasiSemester>()
  for (const r of db.kueri<EvaluasiSemester>(
    `SELECT * FROM evaluasi_semester WHERE generus_id = ? AND dihapus = 0 AND periode <= ? ORDER BY periode, diubah_pada`,
    [generusId, sampaiPeriode],
  ))
    peta.set(r.materi_evaluasi_id, r)
  return peta
}

export interface ItemRapor {
  materi: MateriEvaluasi
  /** null = belum dinilai (§20, J-R4) atau materi belum ditetapkan Kurikulum — tidak ikut rata-rata. */
  persen: number | null
  /** §18 (J-KR4): isian materi belum ditetapkan Kurikulum. */
  belumDitetapkan: boolean
  /** Sudah pernah dinilai (periode ini atau sebelumnya). */
  dinilai: boolean
  /** Periode asal nilai bila diambil dari periode sebelumnya. */
  dariPeriode: string | null
  input: HasilEvaluasiInput | null
  penguji: string | null
}

export interface Rapor {
  generus: { id: string; nama: string; kategori: string; jenis_kelamin: string; kelompok_id: string; kelompok: string | null; desa: string | null }
  periode: string
  jenjang: KategoriGenerus | null
  bulanEvaluasi: number
  items: ItemRapor[]
  /** §20 (J-R16): Nilai Akhir = rata-rata 3 aspek Tri Sukses Generus (K09). */
  total: number | null
  /** §20: nilai per subbagian/aspek Tri Sukses (pemetaan K18). */
  triSukses: HasilTriSukses<ItemRapor>
  /** §20: ambang predikat angka (K17). */
  ambang: AmbangPredikat
  /** §20.3: Karakter Luhur (predikat sikap, tidak masuk persen). */
  karakter: KarakterRapor | null
  /** §20.3: data pendukung Tali Keimanan (fakta dari data, tanpa kesimpulan). */
  pendukung: { keaktifan: number | null; sholat: { hari: number; rataWaktu: number } | null; mandiriHari: number }
  keaktifan: KeaktifanPeriode | null
  /** J-T15: sisa target jenjang sebelumnya yang belum 100 %. */
  sisaSebelumnya: { jenjang: KategoriGenerus; items: ItemRapor[] } | null
  /** §18: nama materi yang belum ditetapkan Kurikulum (tidak ikut TOTAL). */
  belumDitetapkan: string[]
  /** §18 (K09): rumus TOTAL yang dipakai. */
  rumusTotal: RumusTotal
}

function itemRapor(db: Db, m: MateriEvaluasi, terbaru: Map<string, EvaluasiSemester>, periode: string, kp: KeaktifanPeriode | null): ItemRapor {
  if (m.cara === 'keaktifan') {
    return { materi: m, persen: kp?.persen ?? null, belumDitetapkan: false, dinilai: kp?.persen !== null && kp?.persen !== undefined, dariPeriode: null, input: null, penguji: null }
  }
  const rek = terbaru.get(m.id)
  const input = rek ? inputDariRekaman(rek) : null
  // J-R4: subjektif yang tersimpan tanpa nilai = belum dinilai
  const r = rek && (m.cara !== 'subjektif' || (input?.nilai !== null && input?.nilai !== undefined)) ? rek : undefined
  return {
    materi: m,
    persen: r ? hitungPersenMateri(m, input ?? undefined) : null,
    belumDitetapkan: materiBelumDitetapkan(m),
    dinilai: !!r,
    dariPeriode: r && r.periode !== periode ? r.periode : null,
    input,
    penguji: r?.penguji ?? null,
  }
}

/** Laporan Hasil Belajar (raport) satu generus untuk satu periode (bawaan periode aktif). */
export function raporGenerus(db: Db, generusId: string, o: { periode?: string; tanggal?: string } = {}): Rapor | null {
  const g = ambilGenerus(db, generusId)
  if (!g || g.dihapus) return null
  const periode = o.periode ?? periodeAktif(db, o.tanggal)
  const kel = ambilWilayah(db, g.kelompok_id)
  const desa = kel?.induk_id ? ambilWilayah(db, kel.induk_id) : undefined
  const jenjang = KATEGORI_GENERUS.includes(g.kategori) ? g.kategori : null
  const be = bulanEvaluasi(db)
  const base: Rapor = {
    generus: { id: g.id, nama: g.nama, kategori: g.kategori, jenis_kelamin: g.jenis_kelamin, kelompok_id: g.kelompok_id, kelompok: kel?.nama ?? null, desa: desa?.nama ?? null },
    periode,
    jenjang,
    bulanEvaluasi: periode.endsWith('S1') ? be.S1 : be.S2,
    items: [],
    total: null,
    triSukses: hitungTriSukses<ItemRapor>([], {}, rumusTotal(db)),
    ambang: ambangPredikat(db),
    karakter: null,
    pendukung: { keaktifan: null, sholat: null, mandiriHari: 0 },
    keaktifan: null,
    sisaSebelumnya: null,
    belumDitetapkan: [],
    rumusTotal: rumusTotal(db),
  }
  if (!jenjang) return base
  const tanggal = o.tanggal ?? tanggalHariIni()
  const kp = keaktifanPeriode(db, g.id, periode, { tanggal, jenjang })
  const terbaru = evaluasiTerbaru(db, g.id, periode)
  base.keaktifan = kp
  base.items = daftarMateriEvaluasi(db, jenjang).map((m) => itemRapor(db, m, terbaru, periode, kp))
  base.triSukses = hitungTriSukses(base.items, pemetaanAspek(db), base.rumusTotal)
  base.total = base.triSukses.nilaiAkhir
  base.karakter = karakterRapor(db, g.id, periode, jenjang)
  const bulanSem = kp.bulan.map((b) => b.bulan)
  const mulai = `${bulanPeriode(periode)[0]}-01`
  base.pendukung = {
    keaktifan: kp.persen,
    sholat: bulanSem.length ? ringkasCatatanSholat(db, g.id, mulai, tanggal) : null,
    mandiriHari: kp.bulan.reduce((s, b) => s + b.hari.filter((h) => h.kode.some((k) => KODE_KEAKTIFAN[k as KodeKeaktifan]?.mandiri)).length, 0),
  }
  base.belumDitetapkan = base.items.filter((i) => i.belumDitetapkan).map((i) => i.materi.nama)
  const sebelum = jenjangSebelumnya(jenjang)
  if (sebelum) {
    const sisa = daftarMateriEvaluasi(db, sebelum)
      .filter((m) => m.cara === 'hitungan' || m.cara === 'juz' || m.cara === 'kitab')
      .map((m) => itemRapor(db, m, terbaru, periode, null))
      .filter((i) => i.dinilai && i.persen !== null && i.persen < 100)
    if (sisa.length) base.sisaSebelumnya = { jenjang: sebelum, items: sisa }
  }
  return base
}

/** Periode evaluasi yang sedang berjalan menurut tanggal (sama dengan periode target, V-T10). */
export function periodeEvaluasi(tanggal: string = tanggalHariIni()): string {
  return periodeDariTanggal(tanggal)
}
