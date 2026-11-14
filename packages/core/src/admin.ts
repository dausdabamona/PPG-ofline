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
import { tambahGenerus, tambahJamaah, ubahGenerus, KATEGORI_GENERUS, type KategoriGenerus, type StatusGenerus } from './repo/generus'
import { ambilPerangkat, catatPencabutan, daftarkanToken, daftarPerangkat, type PerangkatTerdaftar } from './repo/perangkat'
import { adalahAdmin, ambilMeta, aturMeta, ID_ADMIN, sisipkanRekaman, ubahRekaman } from './repo/umum'
import { ambilUsulan } from './repo/usulan'
import { ambilWilayah, cariWilayahKode, kelompokDalamWilayah } from './repo/wilayah'
import { pindahKelompok, ubahStatus } from './siklus'
import {
  bacaKodePerangkat,
  HAK,
  HAK_BAWAAN,
  tandaTanganiToken,
  type Hak,
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
    aturMeta(db, 'org_id', kunci.orgId)
    aturMeta(db, 'nama_organisasi', kunci.namaOrganisasi)
    aturMeta(db, 'admin_sign_pub', keB64url(kunci.tandaTangan.publik))
    aturMeta(db, 'admin_box_pub', keB64url(kunci.kotak.publik))
    simpanKunciTerenkripsi(db, kunci)
    aturMeta(db, 'admin_garam', keB64url(garam))
    aturMeta(db, 'admin_iterasi', ITERASI_PBKDF2)
    aturMeta(db, 'admin_induk_enc', encB64(kunciSandi, kunci.induk))
    seedKurikulum(db)
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
  kunci_umum_kelompok: { kelompok_id: string; kunci_terenkripsi: string }[]
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
      db.jalankan('INSERT OR IGNORE INTO kunci_umum_kelompok (kelompok_id, kunci_terenkripsi) VALUES (?, ?)', [k.kelompok_id, k.kunci_terenkripsi])
    }
    seedKurikulum(db)
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
      const ks: KunciSetor = { versi: k.versi, publik: k.publik }
      if (denganRahasia) ks.rahasia = keB64url(decB64(kunci.induk, k.rahasia_terenkripsi))
      return ks
    })
}

/** Versi terbaru kunci kelompok setor (membuat v1 bila belum ada). */
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

/** Ganti kunci kelompok setor → versi baru (mubaligh lama tidak bisa membuka BELAJAR versi baru). */
export function gantiKunciKelompok(db: Db, kunci: KunciAdmin, kelompokId: string): number {
  const v = pastikanKunciKelompok(db, kunci, kelompokId)
  return buatKunciKelompok(db, kunci, kelompokId, v + 1)
}

/** Kunci umum kelompok (32 byte, b64url) untuk berkas JADWAL; dibuat bila belum ada. */
export function kunciUmumKelompok(db: Db, kunci: KunciAdmin, kelompokId: string): string {
  const ada = db.nilai<string>('SELECT kunci_terenkripsi FROM kunci_umum_kelompok WHERE kelompok_id = ?', [kelompokId])
  if (ada) return keB64url(decB64(kunci.induk, ada))
  const k = kunciAcak32()
  db.jalankan('INSERT INTO kunci_umum_kelompok (kelompok_id, kunci_terenkripsi) VALUES (?, ?)', [kelompokId, encB64(kunci.induk, k)])
  return keB64url(k)
}

// ---------------- token ----------------

export interface OpsiTerbitToken {
  /** Teks Kode Perangkat dari HP penerima. */
  kodePerangkat: string
  role: 'pengurus' | 'mubaligh'
  nama: string
  wilayahId: string
  /** Opsional; bila diberikan harus sama dengan tingkat wilayah. */
  tingkat?: PayloadToken['tingkat']
  hak?: Hak[]
  /** Masa berlaku (hari), bawaan 365. */
  berlakuHari?: number
}

/**
 * Terbitkan token pengurus/mubaligh (ditandatangani admin). Token dicatat di tabel perangkat.
 * Mubaligh: dibuat penugasan_mubaligh dan token membawa semua versi kunci kelompok setor (dengan rahasia)
 * serta kunci umum kelompok. Pengurus kelompok membawa kunci umum kelompok.
 */
export function terbitkanToken(db: Db, kunci: KunciAdmin, o: OpsiTerbitToken): string {
  if (!adalahAdmin(db)) throw new GalatPpg('BUKAN_DB_ADMIN', 'Hanya admin yang bisa menerbitkan token ini.')
  if (o.role !== 'pengurus' && o.role !== 'mubaligh') {
    throw new GalatPpg('ROLE_TIDAK_SAH', 'Admin menerbitkan token pengurus/mubaligh; token generus/wali diterbitkan mubaligh.')
  }
  const kode = bacaKodePerangkat(o.kodePerangkat)
  const w = ambilWilayah(db, o.wilayahId)
  if (!w || w.dihapus) throw new GalatPpg('WILAYAH_TIDAK_SAH', 'Wilayah tidak ditemukan.')
  if (o.tingkat && o.tingkat !== w.tingkat) throw new GalatPpg('TINGKAT_TIDAK_SAH', 'Tingkat tidak sesuai dengan wilayah yang dipilih.')
  if (o.role === 'mubaligh' && w.tingkat !== 'kelompok') throw new GalatPpg('TINGKAT_TIDAK_SAH', 'Mubaligh ditugaskan untuk satu kelompok.')
  if (!o.nama?.trim()) throw new GalatPpg('NAMA_KOSONG', 'Nama pemegang token wajib diisi.')
  const hak = [...new Set(o.hak ?? HAK_BAWAAN[o.role])]
  if (!hak.every((h) => HAK.includes(h))) throw new GalatPpg('HAK_TIDAK_SAH', 'Hak tidak dikenal.')
  if (o.role === 'pengurus' && (hak.includes('terbit_generus') || hak.includes('setor_belajar'))) {
    throw new GalatPpg('HAK_TIDAK_SAH', 'Hak terbit_generus/setor_belajar tidak untuk pengurus.')
  }
  if (o.role === 'mubaligh') {
    const lain = daftarPerangkat(db, { perangkatId: kode.perangkat_id, role: 'mubaligh', aktifSaja: true }).filter(
      (p) => p.wilayah_id !== o.wilayahId,
    )
    if (lain.length) throw new GalatPpg('SATU_MUBALIGH_SATU_KELOMPOK', 'HP ini sudah memegang token mubaligh kelompok lain (K12).')
  }
  const berlakuHari = o.berlakuHari ?? 365
  if (!(berlakuHari > 0 && berlakuHari <= 3650)) throw new GalatPpg('MASA_BERLAKU_TIDAK_SAH', 'Masa berlaku 1–3650 hari.')

  return db.transaksi(() => {
    const rahasia: RahasiaToken = {}
    if (w.tingkat === 'kelompok') rahasia.kunci_umum_kelompok = kunciUmumKelompok(db, kunci, w.id)
    if (o.role === 'mubaligh') rahasia.kunci_kelompok_setor = daftarKunciSetor(db, kunci, w.id, true)
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
    if (Object.keys(rahasia).length) {
      payload.rahasia = keB64url(segelKe(dariB64url(kode.box_pub), keUtf8(JSON.stringify(rahasia))))
    }
    const teks = tandaTanganiToken(payload, kunci.tandaTangan.rahasia)
    daftarkanToken(db, payload, teks, { label: kode.label, diterbitkanOleh: ID_ADMIN })
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
  const d = u.data as Record<string, string | null | undefined> & { perubahan?: Record<string, string | null> }
  return db.transaksi(() => {
    let hasilId: string | undefined
    switch (u.jenis) {
      case 'tambah_generus':
        hasilId = tambahGenerus(db, {
          kelompokId: u.kelompok_id,
          nama: String(d.nama),
          jenisKelamin: d.jenis_kelamin as 'L' | 'P',
          tanggalLahir: d.tanggal_lahir ?? null,
          kategori: (d.kategori as KategoriGenerus) ?? null,
          waliNama: d.wali_nama ?? null,
          waliNoHp: d.wali_no_hp ?? null,
        }).id
        break
      case 'ubah_generus':
        hasilId = ubahGenerus(db, String(d.generus_id), d.perubahan ?? {}).id
        break
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
export const KOLOM_CSV_GENERUS = ['nama', 'jenis_kelamin', 'tanggal_lahir', 'kategori', 'kelompok_kode', 'wali_nama', 'wali_no_hp'] as const

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
 * kategori (kosong = dari umur), kelompok_kode, wali_nama, wali_no_hp, [mulai]. Baris gagal dilaporkan, baris lain tetap masuk.
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
        const kat = (b.kategori ?? '').trim().toLowerCase()
        if (kat && !KATEGORI_GENERUS.includes(kat as KategoriGenerus)) throw new GalatPpg('KATEGORI_TIDAK_SAH', `Kategori "${kat}" tidak dikenal.`)
        const kel = cariWilayahKode(db, b.kelompok_kode ?? '')
        if (!kel || kel.tingkat !== 'kelompok') throw new GalatPpg('KELOMPOK_TIDAK_SAH', `Kode kelompok "${b.kelompok_kode}" tidak ditemukan.`)
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
  return kel.filter((k) => daftarPerangkat(db, { wilayahIds: [k], role: ['mubaligh', 'pengurus'], aktifSaja: true }).length > 0)
}
