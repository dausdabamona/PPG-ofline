// Fungsi khusus admin (EXE): inisialisasi, kunci, penerbitan token, pencabutan, usulan, impor CSV.
import {
  buatPasanganKotak,
  buatPasanganTandaTangan,
  byteAcak,
  dariB64url,
  dariUtf8,
  dekripsiRahasia,
  enkripsiRahasia,
  ITERASI_PBKDF2,
  keB64url,
  keUtf8,
  kunciAcak32,
  segelKe,
  siapkanKripto,
  turunkanKunciSandi,
  type PasanganKunci,
} from './crypto'
import { uraiCsvObjek } from './csv'
import type { Db } from './db'
import { adalahGalatPpg, GalatPpg } from './galat'
import { ulid } from './ids'
import { seedKurikulum } from './kurikulum'
import { seedMateriEvaluasi } from './skema'
import { alasanJabatanTidakSah, alasanPenugasanTidakSah, BIDANG_RAHASIA, bidangRahasiaDitulis, bidangRahasiaUntuk, type BidangRahasia, type Jabatan, type Penugasan } from './kepengurusan'
import { pembacaRahasiaDb } from './kebijakan'
import { setujuiPenetapanKurikulum } from './penetapan-kurikulum'
import { tambahGenerus, tambahJamaah, ubahGenerus, normalKategori, normalIqro, type KategoriGenerus, type StatusGenerus } from './repo/generus'
import { ambilPerangkat, catatPencabutan, daftarkanToken, daftarPerangkat, type PerangkatTerdaftar } from './repo/perangkat'
import { adalahAdmin, ambilMeta, ambilRekaman, aturMeta, ID_ADMIN, sisipkanRekaman, ubahRekaman } from './repo/umum'
import { tambahPengajian } from './repo/pengajian'
import { ambilUsulan } from './repo/usulan'
import { ambilWilayah, cariWilayahKode, kelompokDalamWilayah, tambahWilayah, turunanWilayah, type Tingkat } from './repo/wilayah'
import { pindahKelompok, ubahStatus } from './siklus'
import { idRantaiPenerbit } from './rantai'
import { daftarProfil } from './repo/profil'
import {
  bacaKodePerangkat,
  HAK,
  HAK_SUPER_HP,
  hakBawaan,
  tandaTanganiKunciSetor,
  tandaTanganiToken,
  type Hak,
  type KunciBidang,
  type KunciSetor,
  type PayloadToken,
  type RahasiaToken,
} from './token'
import { sekarangIso, tambahHariIso, tanggalHariIni, tanggalRingkas, tanggalSah } from './waktu'

/** Kunci admin yang sudah dibuka (hanya di memori). */
export interface KunciAdmin {
  orgId: string
  namaOrganisasi: string
  tandaTangan: PasanganKunci
  kotak: PasanganKunci
  /** Kunci induk 32 byte: mengenkripsi semua rahasia admin di database. */
  induk: Uint8Array
}

const PANJANG_SANDI_MIN = 8

function encB64(kunci: Uint8Array, data: Uint8Array): string {
  return keB64url(enkripsiRahasia(kunci, data))
}
function decB64(kunci: Uint8Array, teks: string): Uint8Array {
  return dekripsiRahasia(kunci, dariB64url(teks))
}

/**
 * Inisialisasi database admin baru: org_id, kunci tanda tangan & kotak admin, kunci induk
 * (dienkripsi kata sandi via PBKDF2), lalu seed kurikulum.
 */
export async function inisialisasiAdmin(db: Db, opsi: { sandi: string; namaOrganisasi: string }): Promise<KunciAdmin> {
  await siapkanKripto()
  if (ambilMeta(db, 'org_id')) throw new GalatPpg('SUDAH_DIINISIALISASI', 'Database ini sudah memiliki admin.')
  if (db.nilai<number>('SELECT COUNT(*) FROM identitas_perangkat')) {
    throw new GalatPpg('BUKAN_DB_ADMIN', 'Database ini milik HP, bukan database admin.')
  }
  if (!opsi.sandi || opsi.sandi.length < PANJANG_SANDI_MIN) {
    throw new GalatPpg('SANDI_LEMAH', `Kata sandi admin minimal ${PANJANG_SANDI_MIN} karakter.`)
  }
  if (!opsi.namaOrganisasi?.trim()) throw new GalatPpg('NAMA_KOSONG', 'Nama organisasi wajib diisi.')
  const kunci: KunciAdmin = {
    orgId: ulid(),
    namaOrganisasi: opsi.namaOrganisasi.trim(),
    tandaTangan: buatPasanganTandaTangan(),
    kotak: buatPasanganKotak(),
    induk: kunciAcak32(),
  }
  const garam = byteAcak(16)
  const kunciSandi = await turunkanKunciSandi(opsi.sandi, garam)
  db.transaksi(() => {
    aturMeta(db, 'peran_db', 'admin')
    aturMeta(db, 'peran_instalasi', 'daerah')
    aturMeta(db, 'org_id', kunci.orgId)
    aturMeta(db, 'nama_organisasi', kunci.namaOrganisasi)
    aturMeta(db, 'admin_sign_pub', keB64url(kunci.tandaTangan.publik))
    aturMeta(db, 'admin_box_pub', keB64url(kunci.kotak.publik))
    simpanKunciTerenkripsi(db, kunci)
    aturMeta(db, 'admin_garam', keB64url(garam))
    aturMeta(db, 'admin_iterasi', ITERASI_PBKDF2)
    aturMeta(db, 'admin_induk_enc', encB64(kunciSandi, kunci.induk))
    seedKurikulum(db)
    seedMateriEvaluasi(db)
  })
  return kunci
}

function simpanKunciTerenkripsi(db: Db, k: KunciAdmin): void {
  aturMeta(db, 'admin_sign_rahasia_enc', encB64(k.induk, k.tandaTangan.rahasia))
  aturMeta(db, 'admin_box_rahasia_enc', encB64(k.induk, k.kotak.rahasia))
}

/** Buka kunci admin dengan kata sandi; melempar SANDI_SALAH. */
export async function bukaKunciAdmin(db: Db, sandi: string): Promise<KunciAdmin> {
  await siapkanKripto()
  if (!adalahAdmin(db)) throw new GalatPpg('BUKAN_DB_ADMIN', 'Database ini belum diinisialisasi sebagai admin.')
  const garam = dariB64url(ambilMeta(db, 'admin_garam')!)
  const iterasi = Number(ambilMeta(db, 'admin_iterasi') ?? ITERASI_PBKDF2)
  const kunciSandi = await turunkanKunciSandi(sandi, garam, iterasi)
  let induk: Uint8Array
  try {
    induk = decB64(kunciSandi, ambilMeta(db, 'admin_induk_enc')!)
  } catch {
    throw new GalatPpg('SANDI_SALAH', 'Kata sandi admin salah.')
  }
  return {
    orgId: ambilMeta(db, 'org_id')!,
    namaOrganisasi: ambilMeta(db, 'nama_organisasi') ?? '',
    induk,
    tandaTangan: { publik: dariB64url(ambilMeta(db, 'admin_sign_pub')!), rahasia: decB64(induk, ambilMeta(db, 'admin_sign_rahasia_enc')!) },
    kotak: { publik: dariB64url(ambilMeta(db, 'admin_box_pub')!), rahasia: decB64(induk, ambilMeta(db, 'admin_box_rahasia_enc')!) },
  }
}

/** Ganti kata sandi admin (kunci induk tetap; hanya pembungkusnya yang diganti). */
export async function gantiSandiAdmin(db: Db, sandiLama: string, sandiBaru: string): Promise<void> {
  const k = await bukaKunciAdmin(db, sandiLama)
  if (!sandiBaru || sandiBaru.length < PANJANG_SANDI_MIN) throw new GalatPpg('SANDI_LEMAH', `Kata sandi minimal ${PANJANG_SANDI_MIN} karakter.`)
  const garam = byteAcak(16)
  const ks = await turunkanKunciSandi(sandiBaru, garam)
  db.transaksi(() => {
    aturMeta(db, 'admin_garam', keB64url(garam))
    aturMeta(db, 'admin_iterasi', ITERASI_PBKDF2)
    aturMeta(db, 'admin_induk_enc', encB64(ks, k.induk))
  })
}

// ---------------- cadangan kunci ----------------

const MAGIS_KUNCI = 'PPGK1\n'

interface IsiCadanganKunci {
  v: 1
  org_id: string
  nama_organisasi: string
  admin_sign_pub: string
  admin_box_pub: string
  garam: string
  iterasi: number
  induk_enc: string
  sign_rahasia_enc: string
  box_rahasia_enc: string
  kunci_kelompok: { kelompok_id: string; versi: number; publik: string; rahasia_terenkripsi: string; dibuat_pada: string }[]
  kunci_umum_kelompok: { kelompok_id: string; kunci_terenkripsi: string; versi?: number }[]
  dibuat_pada: string
}

/** Ekspor cadangan kunci admin (berkas .ppgkey) yang dilindungi kata sandi cadangan. */
export async function eksporCadanganKunci(db: Db, kunci: KunciAdmin, sandiCadangan: string): Promise<{ nama: string; bytes: Uint8Array }> {
  if (!sandiCadangan || sandiCadangan.length < PANJANG_SANDI_MIN) {
    throw new GalatPpg('SANDI_LEMAH', `Kata sandi cadangan minimal ${PANJANG_SANDI_MIN} karakter.`)
  }
  const garam = byteAcak(16)
  const ks = await turunkanKunciSandi(sandiCadangan, garam)
  const isi: IsiCadanganKunci = {
    v: 1,
    org_id: kunci.orgId,
    nama_organisasi: kunci.namaOrganisasi,
    admin_sign_pub: ambilMeta(db, 'admin_sign_pub')!,
    admin_box_pub: ambilMeta(db, 'admin_box_pub')!,
    garam: keB64url(garam),
    iterasi: ITERASI_PBKDF2,
    induk_enc: encB64(ks, kunci.induk),
    sign_rahasia_enc: ambilMeta(db, 'admin_sign_rahasia_enc')!,
    box_rahasia_enc: ambilMeta(db, 'admin_box_rahasia_enc')!,
    kunci_kelompok: db.kueri('SELECT * FROM kunci_kelompok'),
    kunci_umum_kelompok: db.kueri('SELECT * FROM kunci_umum_kelompok'),
    dibuat_pada: sekarangIso(),
  }
  return { nama: `PPG_KUNCI_ADMIN_${tanggalRingkas()}.ppgkey`, bytes: keUtf8(MAGIS_KUNCI + JSON.stringify(isi)) }
}

/**
 * Pulihkan kunci admin dari berkas .ppgkey ke database (kosong atau milik organisasi yang sama).
 * Kunci induk dibungkus ulang dengan `sandiBaru` (bawaan: sandi cadangan).
 */
export async function imporCadanganKunci(db: Db, bytes: Uint8Array, sandiCadangan: string, sandiBaru?: string): Promise<KunciAdmin> {
  await siapkanKripto()
  let isi: IsiCadanganKunci
  try {
    const teks = dariUtf8(bytes)
    if (!teks.startsWith(MAGIS_KUNCI)) throw new Error()
    isi = JSON.parse(teks.slice(MAGIS_KUNCI.length)) as IsiCadanganKunci
  } catch {
    throw new GalatPpg('BERKAS_TIDAK_SAH', 'Berkas cadangan kunci tidak sah.')
  }
  const orgAda = ambilMeta(db, 'org_id')
  if (orgAda && orgAda !== isi.org_id) throw new GalatPpg('ORG_BERBEDA', 'Cadangan kunci ini milik organisasi lain.')
  if (db.nilai<number>('SELECT COUNT(*) FROM identitas_perangkat')) throw new GalatPpg('BUKAN_DB_ADMIN', 'Database ini milik HP.')
  const ks = await turunkanKunciSandi(sandiCadangan, dariB64url(isi.garam), isi.iterasi)
  let induk: Uint8Array
  try {
    induk = decB64(ks, isi.induk_enc)
  } catch {
    throw new GalatPpg('SANDI_SALAH', 'Kata sandi cadangan salah.')
  }
  const sandi = sandiBaru ?? sandiCadangan
  const garam = byteAcak(16)
  const ksBaru = await turunkanKunciSandi(sandi, garam)
  db.transaksi(() => {
    aturMeta(db, 'peran_db', 'admin')
    aturMeta(db, 'peran_instalasi', 'daerah')
    aturMeta(db, 'org_id', isi.org_id)
    aturMeta(db, 'nama_organisasi', isi.nama_organisasi)
    aturMeta(db, 'admin_sign_pub', isi.admin_sign_pub)
    aturMeta(db, 'admin_box_pub', isi.admin_box_pub)
    aturMeta(db, 'admin_sign_rahasia_enc', isi.sign_rahasia_enc)
    aturMeta(db, 'admin_box_rahasia_enc', isi.box_rahasia_enc)
    aturMeta(db, 'admin_garam', keB64url(garam))
    aturMeta(db, 'admin_iterasi', ITERASI_PBKDF2)
    aturMeta(db, 'admin_induk_enc', encB64(ksBaru, induk))
    for (const k of isi.kunci_kelompok ?? []) {
      db.jalankan(
        'INSERT OR IGNORE INTO kunci_kelompok (kelompok_id, versi, publik, rahasia_terenkripsi, dibuat_pada) VALUES (?, ?, ?, ?, ?)',
        [k.kelompok_id, k.versi, k.publik, k.rahasia_terenkripsi, k.dibuat_pada],
      )
    }
    for (const k of isi.kunci_umum_kelompok ?? []) {
      db.jalankan('INSERT OR IGNORE INTO kunci_umum_kelompok (kelompok_id, kunci_terenkripsi, versi) VALUES (?, ?, ?)', [
        k.kelompok_id,
        k.kunci_terenkripsi,
        Number(k.versi ?? 1),
      ])
    }
    seedKurikulum(db)
    seedMateriEvaluasi(db)
  })
  return bukaKunciAdmin(db, sandi)
}

// ---------------- kunci kelompok ----------------

/** Semua versi kunci kelompok setor (opsional dengan rahasia), urut versi naik. Membuat v1 bila belum ada. */
export function daftarKunciSetor(db: Db, kunci: KunciAdmin, kelompokId: string, denganRahasia: boolean): KunciSetor[] {
  pastikanKunciKelompok(db, kunci, kelompokId)
  return db
    .kueri<{ versi: number; publik: string; rahasia_terenkripsi: string }>(
      'SELECT versi, publik, rahasia_terenkripsi FROM kunci_kelompok WHERE kelompok_id = ? ORDER BY versi',
      [kelompokId],
    )
    .map((k) => {
      const ks: KunciSetor = { versi: k.versi, publik: k.publik, tt: tandaTanganiKunciSetor(kunci.orgId, kelompokId, k, kunci.tandaTangan.rahasia) }
      if (denganRahasia) ks.rahasia = keB64url(decB64(kunci.induk, k.rahasia_terenkripsi))
      return ks
    })
}

/** Versi terbaru kunci kelompok setor (membuat v1 bila belum ada). */
// ---------------- kunci bidang rahasia (§17, per wilayah §21.2) ----------------

/** Id wilayah daerah (akar) di database ini. */
function idWilayahDaerah(db: Db): string | null {
  return db.nilai<string>(`SELECT id FROM wilayah WHERE tingkat = 'daerah' AND dihapus = 0 ORDER BY dibuat_pada LIMIT 1`) ?? null
}

/** J-BJ3: kunci lama tanpa wilayah ('') = kunci wilayah daerah → dinormalkan ke id daerah begitu daerah ada. */
function normalkanKunciLama(db: Db): void {
  const d = idWilayahDaerah(db)
  if (!d) return
  if (!db.nilai<number>(`SELECT COUNT(*) FROM kunci_bidang_wilayah WHERE wilayah_id = ''`)) return
  db.jalankan(`UPDATE OR IGNORE kunci_bidang_wilayah SET wilayah_id = ? WHERE wilayah_id = ''`, [d])
}

/** Wilayah kunci: bawaan = daerah. */
function wilayahKunci(db: Db, wilayahId?: string): string {
  normalkanKunciLama(db)
  const w = wilayahId ?? idWilayahDaerah(db)
  if (!w) throw new GalatPpg('WILAYAH_TIDAK_SAH', 'Wilayah daerah belum dibuat.')
  return w
}

/** Pastikan pasangan kunci bidang rahasia wilayah ada (versi 1); kembalikan versi terbaru. Bawaan wilayah = daerah. */
export function pastikanKunciBidang(db: Db, kunci: KunciAdmin, bidang: BidangRahasia, wilayahId?: string): number {
  const w = wilayahKunci(db, wilayahId)
  const v = db.nilai<number | null>('SELECT MAX(versi) FROM kunci_bidang_wilayah WHERE bidang = ? AND wilayah_id = ?', [bidang, w])
  return v || buatKunciBidang(db, kunci, bidang, w, 1)
}

function buatKunciBidang(db: Db, kunci: KunciAdmin, bidang: BidangRahasia, wilayahId: string, versi: number): number {
  if (!BIDANG_RAHASIA.includes(bidang)) throw new GalatPpg('BIDANG_TIDAK_SAH', 'Bidang rahasia tidak dikenal.')
  const p = buatPasanganKotak()
  db.jalankan('INSERT INTO kunci_bidang_wilayah (bidang, wilayah_id, versi, publik, rahasia_terenkripsi, dibuat_pada) VALUES (?, ?, ?, ?, ?, ?)', [
    bidang,
    wilayahId,
    versi,
    keB64url(p.publik),
    encB64(kunci.induk, p.rahasia),
    sekarangIso(),
  ])
  return versi
}

/** Semua versi kunci bidang satu wilayah (dengan kunci baca). Bawaan wilayah = daerah. */
export function daftarKunciBidang(db: Db, kunci: KunciAdmin, bidang: BidangRahasia, wilayahId?: string): KunciBidang[] {
  const w = wilayahKunci(db, wilayahId)
  pastikanKunciBidang(db, kunci, bidang, w)
  return db
    .kueri<{ versi: number; publik: string; rahasia_terenkripsi: string }>(
      'SELECT versi, publik, rahasia_terenkripsi FROM kunci_bidang_wilayah WHERE bidang = ? AND wilayah_id = ? ORDER BY versi',
      [bidang, w],
    )
    .map((k) => ({ bidang, versi: k.versi, publik: k.publik, rahasia: keB64url(decB64(kunci.induk, k.rahasia_terenkripsi)), wilayah_id: w }))
}

/** Versi terbaru kunci publik bidang tiap wilayah (dibuat bila belum ada) — untuk paket (§21.2). */
export function kunciPublikBidangSemua(db: Db, kunci: KunciAdmin): Record<string, Partial<Record<BidangRahasia, { versi: number; publik: string }>>> {
  const out: Record<string, Partial<Record<BidangRahasia, { versi: number; publik: string }>>> = {}
  for (const w of db.kueri<{ id: string }>('SELECT id FROM wilayah WHERE dihapus = 0')) {
    for (const b of BIDANG_RAHASIA) {
      const v = pastikanKunciBidang(db, kunci, b, w.id)
      const r = db.satu<{ publik: string }>('SELECT publik FROM kunci_bidang_wilayah WHERE bidang = ? AND wilayah_id = ? AND versi = ?', [b, w.id, v])!
      ;(out[w.id] ??= {})[b] = { versi: v, publik: r.publik }
    }
  }
  return out
}

/**
 * §21.2: kunci bidang untuk satu daftar penugasan.
 * - Konseling: BK di wilayah W menerima kunci konseling W saja.
 * - Keuangan: jabatan pembaca daerah (kebijakan M04, J-M7) menerima kunci keuangan SEMUA wilayah; penggalang dana desa/kelompok
 *   menerima kunci wilayahnya saja; penulis daerah yang bukan pembaca hanya kunci publik daerah.
 */
export function kunciBidangUntukPenugasan(db: Db, kunci: KunciAdmin, penugasan: readonly Penugasan[]): KunciBidang[] {
  const d = wilayahKunci(db)
  const hasil = new Map<string, KunciBidang>()
  const tambah = (l: KunciBidang[]) => {
    for (const k of l) {
      const id = `${k.bidang}|${k.wilayah_id}|${k.versi}`
      if (!hasil.get(id)?.rahasia) hasil.set(id, k)
    }
  }
  const pembaca = pembacaRahasiaDb(db)
  const jabDaerah = penugasan.filter((p) => p.wilayah_id === d).map((p) => p.jabatan)
  if (bidangRahasiaUntuk(jabDaerah, pembaca).includes('keuangan')) {
    for (const w of db.kueri<{ id: string }>('SELECT id FROM wilayah WHERE dihapus = 0')) tambah(daftarKunciBidang(db, kunci, 'keuangan', w.id))
  } else if (bidangRahasiaDitulis(jabDaerah).includes('keuangan')) {
    tambah(daftarKunciBidang(db, kunci, 'keuangan', d).map((k) => ({ ...k, rahasia: '' })))
  }
  for (const p of penugasan) {
    if (p.wilayah_id === d) {
      if (p.jabatan === 'bk') tambah(daftarKunciBidang(db, kunci, 'konseling', d))
      continue
    }
    if (p.jabatan === 'bk') tambah(daftarKunciBidang(db, kunci, 'konseling', p.wilayah_id))
    if (p.jabatan === 'penggalang_dana') tambah(daftarKunciBidang(db, kunci, 'keuangan', p.wilayah_id))
  }
  return [...hasil.values()]
}

/** Kompatibel Fase 11–14: kunci bidang untuk daftar jabatan pada wilayah daerah. */
export function kunciBidangUntukJabatan(db: Db, kunci: KunciAdmin, jabatan: readonly string[]): KunciBidang[] {
  const d = wilayahKunci(db)
  return kunciBidangUntukPenugasan(db, kunci, jabatan.map((j) => ({ jabatan: j as Jabatan, wilayah_id: d })))
}

/**
 * Ganti kunci bidang rahasia satu wilayah (mis. setelah BK Kelompok Remu diganti → hanya kunci konseling Remu berganti):
 * catatan baru dienkripsi versi baru, yang turun lewat PAKET daerah hanya ke pemegang penugasan pembaca yang masih aktif.
 * Bawaan wilayah = daerah.
 */
export function gantiKunciBidang(db: Db, kunci: KunciAdmin, bidang: BidangRahasia, wilayahId?: string): number {
  if (!adalahAdmin(db)) throw new GalatPpg('HANYA_ADMIN', 'Kunci bidang diganti di EXE Daerah.')
  return db.transaksi(() => {
    const w = wilayahKunci(db, wilayahId)
    if (!ambilWilayah(db, w)) throw new GalatPpg('WILAYAH_TIDAK_SAH', 'Wilayah tidak ditemukan.')
    return buatKunciBidang(db, kunci, bidang, w, pastikanKunciBidang(db, kunci, bidang, w) + 1)
  })
}

/** J-M7 (§21): hak baca keuangan daerah berubah → kunci keuangan SEMUA wilayah diganti (pembaca lama memegang semuanya). */
export function gantiKunciBidangSemua(db: Db, kunci: KunciAdmin, bidang: BidangRahasia): number {
  if (!adalahAdmin(db)) throw new GalatPpg('HANYA_ADMIN', 'Kunci bidang diganti di EXE Daerah.')
  return db.transaksi(() => {
    let n = 0
    for (const w of db.kueri<{ id: string }>('SELECT id FROM wilayah WHERE dihapus = 0')) {
      gantiKunciBidang(db, kunci, bidang, w.id)
      n++
    }
    return n
  })
}

/** Versi terbaru kunci bidang per wilayah (untuk tampilan EXE). */
export function versiKunciBidang(db: Db): { bidang: BidangRahasia; wilayah_id: string; versi: number }[] {
  normalkanKunciLama(db)
  return db.kueri<{ bidang: BidangRahasia; wilayah_id: string; versi: number }>('SELECT bidang, wilayah_id, MAX(versi) AS versi FROM kunci_bidang_wilayah GROUP BY bidang, wilayah_id')
}

export function pastikanKunciKelompok(db: Db, kunci: KunciAdmin, kelompokId: string): number {
  const v = db.nilai<number | null>('SELECT MAX(versi) FROM kunci_kelompok WHERE kelompok_id = ?', [kelompokId])
  if (v) return v
  return buatKunciKelompok(db, kunci, kelompokId, 1)
}

function buatKunciKelompok(db: Db, kunci: KunciAdmin, kelompokId: string, versi: number): number {
  const w = ambilWilayah(db, kelompokId)
  if (!w || w.tingkat !== 'kelompok') throw new GalatPpg('KELOMPOK_TIDAK_SAH', 'Kunci setor hanya untuk kelompok.')
  const p = buatPasanganKotak()
  db.jalankan('INSERT INTO kunci_kelompok (kelompok_id, versi, publik, rahasia_terenkripsi, dibuat_pada) VALUES (?, ?, ?, ?, ?)', [
    kelompokId,
    versi,
    keB64url(p.publik),
    encB64(kunci.induk, p.rahasia),
    sekarangIso(),
  ])
  return versi
}

/**
 * Ganti kunci kelompok setor → versi baru (mubaligh lama tidak bisa membuka BELAJAR versi baru).
 * Kunci umum kelompok (JADWAL) ikut diganti agar mubaligh lama tidak bisa membaca jadwal baru (Fase 1b).
 */
export function gantiKunciKelompok(db: Db, kunci: KunciAdmin, kelompokId: string): number {
  return db.transaksi(() => {
    const v = pastikanKunciKelompok(db, kunci, kelompokId)
    const baru = buatKunciKelompok(db, kunci, kelompokId, v + 1)
    gantiKunciUmumKelompok(db, kunci, kelompokId)
    return baru
  })
}

/** Kunci umum kelompok beserta versinya; dibuat (v1) bila belum ada. */
export function kunciUmumKelompokVersi(db: Db, kunci: KunciAdmin, kelompokId: string): { versi: number; kunci: string } {
  const ada = db.satu<{ kunci_terenkripsi: string; versi: number }>('SELECT kunci_terenkripsi, versi FROM kunci_umum_kelompok WHERE kelompok_id = ?', [kelompokId])
  if (ada) return { versi: Number(ada.versi), kunci: keB64url(decB64(kunci.induk, ada.kunci_terenkripsi)) }
  const k = kunciAcak32()
  db.jalankan('INSERT INTO kunci_umum_kelompok (kelompok_id, kunci_terenkripsi, versi) VALUES (?, ?, 1)', [kelompokId, encB64(kunci.induk, k)])
  return { versi: 1, kunci: keB64url(k) }
}

/** Kunci umum kelompok (32 byte, b64url) untuk berkas JADWAL; dibuat bila belum ada. */
export function kunciUmumKelompok(db: Db, kunci: KunciAdmin, kelompokId: string): string {
  return kunciUmumKelompokVersi(db, kunci, kelompokId).kunci
}

/** Ganti kunci umum kelompok dengan kunci acak baru (versi naik). Tersebar lewat PAKET (pengurus/mubaligh) dan BALASAN (generus/wali). */
export function gantiKunciUmumKelompok(db: Db, kunci: KunciAdmin, kelompokId: string): number {
  const lama = kunciUmumKelompokVersi(db, kunci, kelompokId)
  const versi = lama.versi + 1
  db.jalankan('UPDATE kunci_umum_kelompok SET kunci_terenkripsi = ?, versi = ? WHERE kelompok_id = ?', [encB64(kunci.induk, kunciAcak32()), versi, kelompokId])
  return versi
}

// ---------------- token ----------------

export interface OpsiTerbitToken {
  /** Teks Kode Perangkat dari HP penerima. */
  kodePerangkat: string
  /** v3: `admin` = EXE desa/kelompok, `kurikulum` = EXE kurikulum (wilayah = daerah). */
  role: 'pengurus' | 'mubaligh' | 'admin' | 'kurikulum'
  nama: string
  /** Wilayah token; boleh kosong bila `penugasan` diberikan (wilayah = leluhur bersama penugasan). */
  wilayahId?: string
  /** Opsional; bila diberikan harus sama dengan tingkat wilayah. */
  tingkat?: PayloadToken['tingkat']
  hak?: Hak[]
  /** Masa berlaku (hari), bawaan 365. */
  berlakuHari?: number
  /** §17: jabatan/bidang PPG pada wilayah token (kompatibel; token baru ditulis sebagai `penugasan`). */
  jabatan?: Jabatan[]
  /**
   * §21.1: penugasan jabatan lintas wilayah (rangkap boleh). Wilayah token = leluhur bersama semua penugasan (wilayahId
   * diabaikan bila penugasan diberikan).
   */
  penugasan?: Penugasan[]
  /** §21.4: nomor WA BK (opsional, hanya untuk token yang memegang penugasan BK). */
  kontakBk?: string
}

/** §21.1: wilayah terendah yang mencakup semua wilayah (leluhur bersama). */
export function leluhurBersama(db: Db, wilayahIds: readonly string[]): string {
  if (!wilayahIds.length) throw new GalatPpg('WILAYAH_TIDAK_SAH', 'Daftar wilayah kosong.')
  const rantai = (id: string): string[] => {
    const out: string[] = []
    let kini: string | null | undefined = id
    const dilihat = new Set<string>()
    while (kini && !dilihat.has(kini)) {
      const w = ambilWilayah(db, kini)
      if (!w || w.dihapus) throw new GalatPpg('WILAYAH_TIDAK_SAH', 'Wilayah penugasan tidak ditemukan.')
      out.push(kini)
      dilihat.add(kini)
      kini = w.induk_id
    }
    return out.reverse()
  }
  const semua = wilayahIds.map(rantai)
  let hasil = semua[0]![0]!
  for (let i = 0; i < semua[0]!.length; i++) {
    const x = semua[0]![i]!
    if (semua.every((r) => r[i] === x)) hasil = x
    else break
  }
  return hasil
}

/** §21.4: normalkan nomor WA (08… / 62… / +62…) → 62…; null bila tidak sah. */
export function normalNomorWa(nomor: string): string | null {
  const t = nomor.replace(/[\s\-().]/g, '')
  const d = t.startsWith('+') ? t.slice(1) : t
  if (!/^\d{9,15}$/.test(d)) return null
  if (d.startsWith('0')) return `62${d.slice(1)}`
  return d.startsWith('62') ? d : null
}

/** Kunci meta nomor WA BK per token (daerah). */
export const metaKontakBk = (tokenId: string) => `kontak_bk:${tokenId}`

/**
 * Terbitkan token pengurus/mubaligh (ditandatangani admin). Token dicatat di tabel perangkat.
 * Mubaligh: dibuat penugasan_mubaligh dan token membawa semua versi kunci kelompok setor (dengan rahasia)
 * serta kunci umum kelompok. Pengurus kelompok membawa kunci umum kelompok.
 */
export function terbitkanToken(db: Db, kunci: KunciAdmin, o: OpsiTerbitToken): string {
  if (!adalahAdmin(db)) throw new GalatPpg('BUKAN_DB_ADMIN', 'Hanya admin yang bisa menerbitkan token ini.')
  if (o.role !== 'pengurus' && o.role !== 'mubaligh' && o.role !== 'admin' && o.role !== 'kurikulum') {
    throw new GalatPpg('ROLE_TIDAK_SAH', 'Admin menerbitkan token pengurus/mubaligh/EXE; token generus/wali diterbitkan mubaligh.')
  }
  // §21.1: penugasan lintas wilayah → wilayah token = leluhur bersama
  if (o.penugasan?.length) {
    if (o.role !== 'pengurus') throw new GalatPpg('JABATAN_TIDAK_SAH', 'Penugasan jabatan hanya untuk token pengurus.')
    if (o.jabatan?.length) throw new GalatPpg('JABATAN_TIDAK_SAH', 'Pakai penugasan atau jabatan, tidak keduanya.')
    const lihat = new Set<string>()
    const penugasan: Penugasan[] = []
    for (const x of o.penugasan) {
      const k = `${x.jabatan}|${x.wilayah_id}`
      if (lihat.has(k)) continue
      lihat.add(k)
      penugasan.push({ jabatan: x.jabatan, wilayah_id: x.wilayah_id })
    }
    const lb = ambilWilayah(db, leluhurBersama(db, penugasan.map((x) => x.wilayah_id)))!
    return terbitkanTokenDenganWilayah(db, kunci, o, lb, penugasan)
  }
  const w = ambilWilayah(db, o.wilayahId ?? '')
  if (!w || w.dihapus) throw new GalatPpg('WILAYAH_TIDAK_SAH', 'Wilayah tidak ditemukan.')
  return terbitkanTokenDenganWilayah(db, kunci, o, w, undefined)
}

function terbitkanTokenDenganWilayah(db: Db, kunci: KunciAdmin, o: OpsiTerbitToken, w: NonNullable<ReturnType<typeof ambilWilayah>>, penugasanMasuk: Penugasan[] | undefined): string {
  const kode = bacaKodePerangkat(o.kodePerangkat)
  if (o.tingkat && o.tingkat !== w.tingkat) throw new GalatPpg('TINGKAT_TIDAK_SAH', 'Tingkat tidak sesuai dengan wilayah yang dipilih.')
  if (o.role === 'mubaligh' && w.tingkat !== 'kelompok') throw new GalatPpg('TINGKAT_TIDAK_SAH', 'Mubaligh ditugaskan untuk satu kelompok.')
  // Fase 9: role admin tingkat daerah = Super Admin HP (pendaftaran seluruh daerah dari HP)
  if (o.role === 'kurikulum' && w.tingkat !== 'daerah') throw new GalatPpg('TINGKAT_TIDAK_SAH', 'Token kurikulum untuk wilayah daerah.')
  if (!o.nama?.trim()) throw new GalatPpg('NAMA_KOSONG', 'Nama pemegang token wajib diisi.')
  const superHp = o.role === 'admin' && w.tingkat === 'daerah'
  const hak = [...new Set(o.hak ?? (superHp ? HAK_SUPER_HP : hakBawaan(o.role, w.tingkat)))]
  if (superHp && !(hak.includes('terbit_bawah') && hak.every((h) => HAK_SUPER_HP.includes(h)))) {
    throw new GalatPpg('HAK_TIDAK_SAH', 'Super Admin HP berhak catat, lihat, dan menerbitkan kode aktivasi.')
  }
  if (!hak.every((h) => HAK.includes(h))) throw new GalatPpg('HAK_TIDAK_SAH', 'Hak tidak dikenal.')
  if (o.role === 'pengurus' && (hak.includes('terbit_generus') || hak.includes('setor_belajar'))) {
    throw new GalatPpg('HAK_TIDAK_SAH', 'Hak terbit_generus/setor_belajar tidak untuk pengurus.')
  }
  if (hak.includes('terbit_bawah') && !(o.role === 'admin' && (w.tingkat === 'desa' || w.tingkat === 'daerah'))) {
    throw new GalatPpg('HAK_TIDAK_SAH', 'Hak terbit_bawah hanya untuk EXE desa dan Super Admin HP.')
  }
  if (o.role === 'kurikulum' && hak.some((h) => h !== 'lihat')) throw new GalatPpg('HAK_TIDAK_SAH', 'Token kurikulum hanya berhak lihat.')
  if (o.role === 'admin' && hak.some((h) => h === 'terbit_generus' || h === 'setor_belajar')) {
    throw new GalatPpg('HAK_TIDAK_SAH', 'Hak terbit_generus/setor_belajar tidak untuk EXE.')
  }
  if (o.role === 'mubaligh') {
    const lain = daftarPerangkat(db, { perangkatId: kode.perangkat_id, role: 'mubaligh', aktifSaja: true }).filter(
      (p) => p.wilayah_id !== w.id,
    )
    if (lain.length) throw new GalatPpg('SATU_MUBALIGH_SATU_KELOMPOK', 'HP ini sudah memegang token mubaligh kelompok lain (K12).')
  }
  // J-BJ1: token baru menulis `penugasan`; opsi lama `jabatan` = penugasan pada wilayah token
  const jabatanLama = o.jabatan?.length ? [...new Set(o.jabatan)] : undefined
  const aj = alasanJabatanTidakSah(jabatanLama, o.role, w.tingkat)
  if (aj) throw new GalatPpg('JABATAN_TIDAK_SAH', aj)
  const penugasan = penugasanMasuk ?? jabatanLama?.map((j) => ({ jabatan: j, wilayah_id: w.id }))
  const tingkatWilayah = (id: string) => {
    const x = ambilWilayah(db, id)
    return x && !x.dihapus ? x.tingkat : undefined
  }
  const ap = alasanPenugasanTidakSah(penugasan, { role: o.role, tingkat: w.tingkat, wilayah_id: w.id }, { tingkatWilayah, mencakup: (a, b) => a === b || turunanWilayah(db, a).includes(b) })
  if (ap) throw new GalatPpg('JABATAN_TIDAK_SAH', ap)
  for (const x of penugasan ?? []) if (!tingkatWilayah(x.wilayah_id)) throw new GalatPpg('WILAYAH_TIDAK_SAH', 'Wilayah penugasan tidak ditemukan.')
  let kontakBk: string | null = null
  if (o.kontakBk?.trim()) {
    if (!penugasan?.some((x) => x.jabatan === 'bk')) throw new GalatPpg('KONTAK_TIDAK_SAH', 'Nomor WA BK hanya untuk pemegang penugasan BK.')
    kontakBk = normalNomorWa(o.kontakBk)
    if (!kontakBk) throw new GalatPpg('KONTAK_TIDAK_SAH', 'Nomor WA BK tidak sah (contoh 0812xxxxxxx).')
  }
  const berlakuHari = o.berlakuHari ?? 365
  if (!(berlakuHari > 0 && berlakuHari <= 3650)) throw new GalatPpg('MASA_BERLAKU_TIDAK_SAH', 'Masa berlaku 1–3650 hari.')

  return db.transaksi(() => {
    const rahasia: RahasiaToken = {}
    if (w.tingkat === 'kelompok' && o.role !== 'admin') {
      const ku = kunciUmumKelompokVersi(db, kunci, w.id)
      rahasia.kunci_umum_kelompok = ku.kunci
      rahasia.kunci_umum_versi = ku.versi
    }
    if (o.role === 'mubaligh') rahasia.kunci_kelompok_setor = daftarKunciSetor(db, kunci, w.id, true)
    // §17: kunci baca bidang rahasia hanya untuk jabatan pembacanya
    const kb = penugasan ? kunciBidangUntukPenugasan(db, kunci, penugasan) : []
    if (kb.length) rahasia.kunci_bidang = kb
    const terbit = sekarangIso()
    const payload: PayloadToken = {
      v: 1,
      token_id: ulid(),
      org_id: kunci.orgId,
      admin_sign_pub: keB64url(kunci.tandaTangan.publik),
      admin_box_pub: keB64url(kunci.kotak.publik),
      perangkat_id: kode.perangkat_id,
      device_sign_pub: kode.sign_pub,
      device_box_pub: kode.box_pub,
      role: o.role,
      nama: o.nama.trim(),
      tingkat: w.tingkat,
      wilayah_id: w.id,
      hak,
      terbit,
      berlaku_sampai: tambahHariIso(terbit, berlakuHari),
    }
    if (penugasan) payload.penugasan = penugasan
    if (Object.keys(rahasia).length) {
      payload.rahasia = keB64url(segelKe(dariB64url(kode.box_pub), keUtf8(JSON.stringify(rahasia))))
    }
    const teks = tandaTanganiToken(payload, kunci.tandaTangan.rahasia)
    daftarkanToken(db, payload, teks, { label: kode.label, diterbitkanOleh: ID_ADMIN })
    if (kontakBk) aturMeta(db, metaKontakBk(payload.token_id), kontakBk)
    if (o.role === 'mubaligh') {
      const sudah = db.nilai<string>(
        `SELECT id FROM penugasan_mubaligh WHERE perangkat_mubaligh_id = ? AND kelompok_id = ? AND selesai IS NULL AND dihapus = 0`,
        [kode.perangkat_id, w.id],
      )
      if (!sudah) {
        sisipkanRekaman(db, 'penugasan_mubaligh', { perangkat_mubaligh_id: kode.perangkat_id, kelompok_id: w.id, mulai: tanggalHariIni(), selesai: null })
      }
    }
    return teks
  })
}

function ambilTokenWajib(db: Db, tokenId: string): PerangkatTerdaftar {
  const p = ambilPerangkat(db, tokenId)
  if (!p) throw new GalatPpg('TIDAK_DITEMUKAN', 'Token/perangkat tidak ditemukan.')
  if (!adalahAdmin(db)) {
    // v3: EXE desa hanya boleh mencabut/membekukan token yang rantai penerbitnya melewati token EXE ini
    const saya = new Set(daftarProfil(db, ['admin']).map((x) => x.token_id))
    if (!saya.size || !idRantaiPenerbit(p.token).some((id) => saya.has(id))) {
      throw new GalatPpg('TIDAK_BERWENANG', 'Token ini tidak diterbitkan dari EXE ini; pencabutan dilakukan daerah.')
    }
  }
  return p
}

/** Cabut token secara permanen (HP hilang, pindah tugas, lulus/keluar). */
export function cabutPerangkat(db: Db, tokenId: string, tanggal?: string): void {
  const p = ambilTokenWajib(db, tokenId)
  if (p.dicabut_pada) return
  catatPencabutan(db, { tokenId, perangkatId: p.perangkat_id, jenis: 'cabut', tanggal })
}

/** Bekukan token sementara (mis. generus mondok). */
export function bekukanPerangkat(db: Db, tokenId: string, tanggal?: string): void {
  const p = ambilTokenWajib(db, tokenId)
  if (p.dibekukan) return
  catatPencabutan(db, { tokenId, perangkatId: p.perangkat_id, jenis: 'beku', tanggal })
}

/** Cairkan token yang dibekukan. */
export function cairkanPerangkat(db: Db, tokenId: string, tanggal?: string): void {
  const p = ambilTokenWajib(db, tokenId)
  if (!p.dibekukan) return
  catatPencabutan(db, { tokenId, perangkatId: p.perangkat_id, jenis: 'cair', tanggal })
}

// ---------------- usulan ----------------

/** Setujui usulan: terapkan isinya ke master lalu tandai disetujui (admin). */
export function setujuiUsulan(db: Db, usulanId: string): { usulanId: string; hasilId?: string } {
  if (!adalahAdmin(db)) throw new GalatPpg('HANYA_ADMIN', 'Hanya admin yang bisa menyetujui usulan.')
  const u = ambilUsulan(db, usulanId)
  if (!u) throw new GalatPpg('TIDAK_DITEMUKAN', 'Usulan tidak ditemukan.')
  if (u.status !== 'menunggu') throw new GalatPpg('SUDAH_DIPUTUSKAN', 'Usulan ini sudah diputuskan.')
  // §18 (J-KR3): penetapan kurikulum hanya dari pemegang jabatan Bidang Kurikulum
  if (u.jenis === 'tetapkan_kurikulum') {
    setujuiPenetapanKurikulum(db, usulanId)
    return { usulanId }
  }
  const d = u.data as Record<string, string | null | undefined> & { perubahan?: Record<string, string | null> }
  return db.transaksi(() => {
    let hasilId: string | undefined
    switch (u.jenis) {
      case 'tambah_generus':
        // Fase 9: id yang sudah dipakai pengusul (Super Admin HP menerbitkan token wali untuk anak baru) dipertahankan
        if (typeof d.id === 'string' && ambilRekaman(db, 'generus', d.id)) {
          hasilId = d.id
          break
        }
        hasilId = tambahGenerus(db, {
          id: typeof d.id === 'string' ? d.id : undefined,
          mulai: typeof d.mulai === 'string' && tanggalSah(d.mulai) ? d.mulai : undefined,
          kelompokId: u.kelompok_id,
          nama: String(d.nama),
          jenisKelamin: d.jenis_kelamin as 'L' | 'P',
          tanggalLahir: d.tanggal_lahir ?? null,
          kategori: (d.kategori as KategoriGenerus) ?? null,
          waliNama: d.wali_nama ?? null,
          waliNoHp: d.wali_no_hp ?? null,
          sekolah: typeof d.sekolah === 'string' ? d.sekolah : null,
          kelasSekolah: typeof d.kelas_sekolah === 'string' ? d.kelas_sekolah : null,
          iqro: typeof d.iqro === 'string' ? d.iqro : null,
        }).id
        break
      case 'ubah_generus':
        hasilId = ubahGenerus(db, String(d.generus_id), d.perubahan ?? {}).id
        break
      case 'tambah_wilayah':
        if (typeof d.id === 'string' && ambilRekaman(db, 'wilayah', d.id)) {
          hasilId = d.id
          break
        }
        hasilId = tambahWilayah(db, {
          id: typeof d.id === 'string' ? d.id : undefined,
          tingkat: d.tingkat as Tingkat,
          nama: String(d.nama ?? ''),
          kode: d.kode ?? null,
          indukId: u.kelompok_id,
        }).id
        break
      case 'tambah_pengajian': {
        if (typeof d.id === 'string' && ambilRekaman(db, 'pengajian', d.id)) {
          hasilId = d.id
          break
        }
        const x = u.data as Record<string, unknown>
        hasilId = tambahPengajian(db, {
          id: typeof d.id === 'string' ? d.id : undefined,
          wilayahId: u.kelompok_id,
          nama: String(x.nama ?? ''),
          jenis: (x.jenis as string | null | undefined) ?? null,
          hari: typeof x.hari === 'number' ? x.hari : null,
          jam: (x.jam as string | null | undefined) ?? null,
          tempat: (x.tempat as string | null | undefined) ?? null,
          kategoriGenerus: Array.isArray(x.kategori_generus) ? (x.kategori_generus as KategoriGenerus[]) : null,
        }).id
        break
      }
      case 'tambah_jamaah':
        hasilId = tambahJamaah(db, {
          kelompokId: u.kelompok_id,
          nama: String(d.nama),
          jenisKelamin: d.jenis_kelamin as 'L' | 'P',
          tanggalLahir: d.tanggal_lahir ?? null,
          noHp: d.no_hp ?? null,
        }).id
        break
      case 'pindah_kelompok':
        pindahKelompok(db, String(d.generus_id), String(d.kelompok_tujuan_id), String(d.tanggal))
        hasilId = String(d.generus_id)
        break
      case 'ubah_status':
        ubahStatus(db, String(d.generus_id), d.status as StatusGenerus, String(d.tanggal), d.keterangan ?? null)
        hasilId = String(d.generus_id)
        break
    }
    ubahRekaman(db, 'usulan', usulanId, { status: 'disetujui', alasan: null })
    return { usulanId, hasilId }
  })
}

/** Tolak usulan dengan alasan (admin). */
export function tolakUsulan(db: Db, usulanId: string, alasan: string): void {
  if (!adalahAdmin(db)) throw new GalatPpg('HANYA_ADMIN', 'Hanya admin yang bisa menolak usulan.')
  const u = ambilUsulan(db, usulanId)
  if (!u) throw new GalatPpg('TIDAK_DITEMUKAN', 'Usulan tidak ditemukan.')
  if (u.status !== 'menunggu') throw new GalatPpg('SUDAH_DIPUTUSKAN', 'Usulan ini sudah diputuskan.')
  if (!alasan?.trim()) throw new GalatPpg('ALASAN_KOSONG', 'Tuliskan alasan penolakan.')
  ubahRekaman(db, 'usulan', usulanId, { status: 'ditolak', alasan: alasan.trim() })
}

// ---------------- impor CSV ----------------

export interface HasilImporCsv {
  berhasil: number
  generusIds: string[]
  gagal: { baris: number; alasan: string }[]
}

/** Kolom CSV generus (baris pertama = kepala). Kolom `mulai` opsional. */
export const KOLOM_CSV_GENERUS = ['nama', 'jenis_kelamin', 'tanggal_lahir', 'kategori', 'kelompok_kode', 'wali_nama', 'wali_no_hp', 'sekolah', 'kelas_sekolah', 'iqro'] as const

function normalJk(v: string): 'L' | 'P' | null {
  const s = v.trim().toLowerCase()
  if (['l', 'lk', 'laki-laki', 'laki laki', 'laki'].includes(s)) return 'L'
  if (['p', 'pr', 'perempuan', 'wanita'].includes(s)) return 'P'
  return null
}

/** Normalisasi tanggal CSV: null = kosong, undefined = tidak dikenali. */
function normalTanggal(v: string): string | null | undefined {
  const s = v.trim()
  if (!s) return null
  if (tanggalSah(s)) return s
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s)
  if (m) {
    const t = `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`
    if (tanggalSah(t)) return t
  }
  return undefined
}

/**
 * Impor generus massal dari CSV (T9). Kolom: nama, jenis_kelamin (L/P), tanggal_lahir (YYYY-MM-DD atau DD/MM/YYYY),
 * kategori (kosong = dari umur), kelompok_kode, wali_nama, wali_no_hp, [mulai], [sekolah], [kelas_sekolah], [iqro] (§19). Baris gagal dilaporkan, baris lain tetap masuk.
 */
export function imporGenerusCsv(db: Db, teksCsv: string): HasilImporCsv {
  if (!adalahAdmin(db)) throw new GalatPpg('HANYA_ADMIN', 'Impor CSV hanya di aplikasi admin.')
  const { kolom, baris } = uraiCsvObjek(teksCsv)
  for (const k of ['nama', 'jenis_kelamin', 'kelompok_kode']) {
    if (!kolom.includes(k)) throw new GalatPpg('CSV_TIDAK_SAH', `Kolom "${k}" tidak ada di baris pertama CSV.`)
  }
  const hasil: HasilImporCsv = { berhasil: 0, generusIds: [], gagal: [] }
  db.transaksi(() => {
    baris.forEach((b, i) => {
      const nomor = i + 2
      try {
        const jk = normalJk(b.jenis_kelamin ?? '')
        if (!jk) throw new GalatPpg('JK_TIDAK_SAH', 'Jenis kelamin harus L atau P.')
        const tl = normalTanggal(b.tanggal_lahir ?? '')
        if (tl === undefined) throw new GalatPpg('TANGGAL_TIDAK_SAH', 'Tanggal lahir tidak dikenali.')
        const katTeks = (b.kategori ?? '').trim()
        const kat = katTeks ? normalKategori(katTeks) : ''
        if (kat === null) throw new GalatPpg('KATEGORI_TIDAK_SAH', `Kategori "${katTeks}" tidak dikenal.`)
        const kel = cariWilayahKode(db, b.kelompok_kode ?? '')
        if (!kel || kel.tingkat !== 'kelompok') throw new GalatPpg('KELOMPOK_TIDAK_SAH', `Kode kelompok "${b.kelompok_kode}" tidak ditemukan.`)
        const iqro = normalIqro(b.iqro ?? '')
        if (iqro === undefined) throw new GalatPpg('IQRO_TIDAK_SAH', `Jilid Iqro' "${b.iqro}" tidak dikenal (1–6 atau Al-Qur'an).`)
        const mulai = normalTanggal(b.mulai ?? '')
        if (mulai === undefined) throw new GalatPpg('TANGGAL_TIDAK_SAH', 'Tanggal mulai tidak dikenali.')
        const g = db.transaksi(() =>
          tambahGenerus(db, {
            kelompokId: kel.id,
            nama: b.nama ?? '',
            jenisKelamin: jk,
            tanggalLahir: tl,
            kategori: (kat as KategoriGenerus) || null,
            waliNama: b.wali_nama || null,
            waliNoHp: b.wali_no_hp || null,
            mulai: mulai || undefined,
            sekolah: b.sekolah || null,
            kelasSekolah: b.kelas_sekolah || null,
            iqro,
          }),
        )
        hasil.berhasil++
        hasil.generusIds.push(g.id)
      } catch (e) {
        hasil.gagal.push({ baris: nomor, alasan: adalahGalatPpg(e) ? e.pesan : String(e) })
      }
    })
  })
  return hasil
}

/** Daftar kelompok di wilayah yang punya token mubaligh aktif (untuk UI "Kirim Paket semua kelompok"). */
export function kelompokBerpenerima(db: Db, wilayahId: string): string[] {
  const kel = kelompokDalamWilayah(db, wilayahId)
  return kel.filter((k) => daftarPerangkat(db, { wilayahIds: [k], role: ['mubaligh', 'pengurus', 'admin'], aktifSaja: true }).length > 0)
}
