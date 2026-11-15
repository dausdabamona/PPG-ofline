// Instalasi EXE berjenjang (v3, §14): EXE desa / kelompok / kurikulum diaktifkan dengan token dari tingkat atas.
// EXE daerah = admin lama (admin.ts). Kunci perangkat EXE dilindungi kata sandi lokal (PBKDF2 + secretbox).
import type { KunciAdmin } from './admin'
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
import type { Db } from './db'
import { GalatPpg } from './galat'
import { ulid } from './ids'
import {
  aktifkanProfil,
  AWALAN_TERENKRIPSI,
  ambilIdentitas,
  gabungKunciSetor,
  kodePerangkatSaya,
  pasangIdentitasTerbuka,
  type IdentitasPerangkat,
} from './perangkat'
import { wilayahMencakupDb } from './rantai'
import { daftarkanToken, daftarPerangkat } from './repo/perangkat'
import { daftarProfil, pastikanProfilBolehMencatat, type Profil } from './repo/profil'
import { adalahExe, ambilMeta, aturMeta, peranInstalasi, type PeranInstalasi } from './repo/umum'
import { ambilWilayah, kelompokDalamWilayah } from './repo/wilayah'
import {
  adalahTokenSuperHp,
  bacaKodePerangkat,
  buktiWilayahSah,
  HAK_BAWAAN,
  HAK_DARI_DESA,
  HAK_DARI_SUPER,
  kunciSetorSah,
  ROLE_EXE,
  hakBawaan,
  tandaTanganiToken,
  uraiToken,
  type Hak,
  type KunciSetor,
  type PayloadToken,
  type RahasiaToken,
} from './token'
import { sekarangIso, tambahHariIso } from './waktu'

/** Kunci EXE bawah (desa/kelompok/kurikulum) yang sudah dibuka dengan kata sandi (hanya di memori). */
export interface KunciExe {
  exe: true
  perangkatId: string
  /** org_id organisasi (kosong sebelum aktivasi). */
  orgId: string
  tandaTangan: PasanganKunci
  kotak: PasanganKunci
  /** Kunci induk 32 byte EXE: mengenkripsi kunci perangkat & kunci titipan di database. */
  induk: Uint8Array
}

/** Kunci pemegang instalasi EXE: daerah (KunciAdmin) atau EXE bawah (KunciExe). */
export type KunciPemegang = KunciAdmin | KunciExe

export function adalahKunciExe(k: KunciPemegang | undefined | null): k is KunciExe {
  return !!k && (k as KunciExe).exe === true
}

const PANJANG_SANDI_MIN = 8
const kunciTerbuka = new WeakMap<Db, KunciExe>()

function encB64(kunci: Uint8Array, data: Uint8Array): string {
  return keB64url(enkripsiRahasia(kunci, data))
}
function decB64(kunci: Uint8Array, teks: string): Uint8Array {
  return dekripsiRahasia(kunci, dariB64url(teks))
}

function pasang(db: Db, k: KunciExe, label: string, dibuatPada: string): KunciExe {
  kunciTerbuka.set(db, k)
  const i: IdentitasPerangkat = { id: k.perangkatId, label, tandaTangan: k.tandaTangan, kotak: k.kotak, dibuatPada }
  pasangIdentitasTerbuka(db, i)
  return k
}

/**
 * Pengaturan awal EXE bawah ("Aktifkan dengan kode"): buat identitas perangkat EXE yang kuncinya dienkripsi
 * kata sandi lokal. Tampilkan `kodePerangkat` ke tingkat atas untuk diterbitkan token, lalu `aktifkanExe`.
 */
export async function inisialisasiExe(db: Db, o: { sandi: string; label: string }): Promise<{ kodePerangkat: string; kunci: KunciExe }> {
  await siapkanKripto()
  if (ambilMeta(db, 'peran_db')) throw new GalatPpg('SUDAH_DIINISIALISASI', 'Database ini sudah dipakai (admin/HP/EXE).')
  if (db.nilai<number>('SELECT COUNT(*) FROM identitas_perangkat')) throw new GalatPpg('SUDAH_DIINISIALISASI', 'Database ini milik HP.')
  if (!o.sandi || o.sandi.length < PANJANG_SANDI_MIN) throw new GalatPpg('SANDI_LEMAH', `Kata sandi minimal ${PANJANG_SANDI_MIN} karakter.`)
  const s = buatPasanganTandaTangan()
  const b = buatPasanganKotak()
  const induk = kunciAcak32()
  const garam = byteAcak(16)
  const ks = await turunkanKunciSandi(o.sandi, garam)
  const id = ulid()
  const label = o.label?.trim() || 'EXE'
  const dibuat = sekarangIso()
  db.transaksi(() => {
    db.jalankan(
      'INSERT INTO identitas_perangkat (id, sign_pub, sign_rahasia, box_pub, box_rahasia, label, dibuat_pada) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, keB64url(s.publik), AWALAN_TERENKRIPSI + encB64(induk, s.rahasia), keB64url(b.publik), AWALAN_TERENKRIPSI + encB64(induk, b.rahasia), label, dibuat],
    )
    aturMeta(db, 'peran_db', 'exe')
    aturMeta(db, 'exe_garam', keB64url(garam))
    aturMeta(db, 'exe_iterasi', ITERASI_PBKDF2)
    aturMeta(db, 'exe_induk_enc', encB64(ks, induk))
  })
  const kunci = pasang(db, { exe: true, perangkatId: id, orgId: '', tandaTangan: s, kotak: b, induk }, label, dibuat)
  return { kodePerangkat: kodePerangkatSaya(db), kunci }
}

/** Buka kunci EXE bawah dengan kata sandi lokal; melempar SANDI_SALAH. */
export async function bukaKunciExe(db: Db, sandi: string): Promise<KunciExe> {
  await siapkanKripto()
  if (!adalahExe(db)) throw new GalatPpg('BUKAN_DB_EXE', 'Database ini bukan instalasi EXE desa/kelompok/kurikulum.')
  const garam = dariB64url(ambilMeta(db, 'exe_garam')!)
  const ks = await turunkanKunciSandi(sandi, garam, Number(ambilMeta(db, 'exe_iterasi') ?? ITERASI_PBKDF2))
  let induk: Uint8Array
  try {
    induk = decB64(ks, ambilMeta(db, 'exe_induk_enc')!)
  } catch {
    throw new GalatPpg('SANDI_SALAH', 'Kata sandi salah.')
  }
  const b = db.satu<{ id: string; sign_pub: string; sign_rahasia: string; box_pub: string; box_rahasia: string; label: string | null; dibuat_pada: string | null }>(
    'SELECT * FROM identitas_perangkat LIMIT 1',
  )!
  const buka = (t: string) => decB64(induk, t.slice(AWALAN_TERENKRIPSI.length))
  return pasang(
    db,
    {
      exe: true,
      perangkatId: b.id,
      orgId: ambilMeta(db, 'org_id') ?? '',
      tandaTangan: { publik: dariB64url(b.sign_pub), rahasia: buka(b.sign_rahasia) },
      kotak: { publik: dariB64url(b.box_pub), rahasia: buka(b.box_rahasia) },
      induk,
    },
    b.label ?? '',
    b.dibuat_pada ?? '',
  )
}

/** Kunci EXE yang sedang terbuka untuk Db ini (setelah `bukaKunciExe`/`inisialisasiExe`), bila ada. */
export function kunciExeTerbuka(db: Db): KunciExe | undefined {
  return kunciTerbuka.get(db)
}

/** Kunci EXE yang terbuka; melempar EXE_TERKUNCI. */
export function kunciExeWajib(db: Db): KunciExe {
  const k = kunciTerbuka.get(db)
  if (!k) throw new GalatPpg('EXE_TERKUNCI', 'Aplikasi terkunci. Masukkan kata sandi terlebih dahulu.')
  return k
}

/** Kunci EXE dari memori (tutup aplikasi / kunci otomatis). */
export function kunciExe(db: Db): void {
  kunciTerbuka.delete(db)
  pasangIdentitasTerbuka(db, null)
}

/** Ganti kata sandi lokal EXE (kunci induk tetap). */
export async function gantiSandiExe(db: Db, sandiLama: string, sandiBaru: string): Promise<void> {
  const k = await bukaKunciExe(db, sandiLama)
  if (!sandiBaru || sandiBaru.length < PANJANG_SANDI_MIN) throw new GalatPpg('SANDI_LEMAH', `Kata sandi minimal ${PANJANG_SANDI_MIN} karakter.`)
  const garam = byteAcak(16)
  const ks = await turunkanKunciSandi(sandiBaru, garam)
  db.transaksi(() => {
    aturMeta(db, 'exe_garam', keB64url(garam))
    aturMeta(db, 'exe_iterasi', ITERASI_PBKDF2)
    aturMeta(db, 'exe_induk_enc', encB64(ks, k.induk))
  })
}

/**
 * Aktifkan EXE bawah dengan token dari tingkat atas (daerah → EXE desa/kurikulum/kelompok; desa → EXE kelompok).
 * Peran instalasi ditentukan token: role `admin` tingkat desa/kelompok, atau `kurikulum`.
 * Token baru untuk peran & wilayah yang sama = perpanjangan.
 */
export async function aktifkanExe(db: Db, kunci: KunciExe, teksToken: string, o: { superHp?: boolean } = {}): Promise<Profil> {
  if (!adalahExe(db)) throw new GalatPpg('BUKAN_DB_EXE', 'Database ini bukan instalasi EXE desa/kelompok/kurikulum.')
  pasang(db, kunci, ambilIdentitas(db).label, ambilIdentitas(db).dibuatPada)
  const p = uraiToken(teksToken).payload
  const tokenSuper = adalahTokenSuperHp(p)
  // Fase 9: token Super Admin HP hanya untuk instalasi Super Admin di APK, dan sebaliknya
  if (o.superHp && !tokenSuper) {
    throw new GalatPpg(
      ROLE_EXE.includes(p.role) ? 'TOKEN_UNTUK_EXE' : 'TOKEN_BUKAN_SUPER_HP',
      ROLE_EXE.includes(p.role)
        ? 'Kode aktivasi ini untuk aplikasi laptop (EXE), bukan untuk Super Admin HP.'
        : 'Kode ini bukan kode Super Admin HP. Tempel di layar aktivasi HP biasa (Kode Perangkat → Masukkan token).',
    )
  }
  if (!o.superHp && tokenSuper) throw new GalatPpg('TOKEN_UNTUK_SUPER_HP', 'Kode aktivasi ini untuk Super Admin HP (aplikasi PPG Sorong di HP), bukan untuk laptop.')
  if (p.role !== 'admin' && p.role !== 'kurikulum') throw new GalatPpg('TOKEN_UNTUK_HP', 'Kode aktivasi ini untuk HP, bukan untuk aplikasi EXE.')
  const peran: PeranInstalasi = tokenSuper ? 'super_hp' : p.role === 'kurikulum' ? 'kurikulum' : (p.tingkat as 'desa' | 'kelompok')
  const lama = peranInstalasi(db)
  const wilayahLama = ambilMeta(db, 'wilayah_instalasi')
  if (lama && (lama !== peran || wilayahLama !== p.wilayah_id)) {
    throw new GalatPpg('PERAN_BERBEDA', 'EXE ini sudah diaktifkan untuk peran/wilayah lain. Pakai instalasi baru.')
  }
  const profil = await aktifkanProfil(db, teksToken)
  db.transaksi(() => {
    aturMeta(db, 'peran_instalasi', peran)
    aturMeta(db, 'wilayah_instalasi', p.wilayah_id)
    db.jalankan('UPDATE profil SET aktif = CASE WHEN id = ? THEN 1 ELSE 0 END', [profil.id])
  })
  kunci.orgId = p.org_id
  return profil
}

/** Profil token EXE ini (role admin/kurikulum); melempar BELUM_AKTIVASI. */
export function profilExe(db: Db): Profil {
  const p = daftarProfil(db, ['admin', 'kurikulum'])
  const w = ambilMeta(db, 'wilayah_instalasi')
  const pilih = p.find((x) => x.wilayah_id === w) ?? p[0]
  if (!pilih) throw new GalatPpg('BELUM_AKTIVASI', 'EXE ini belum diaktifkan. Tempel kode aktivasi dari tingkat atas.')
  return pilih
}

/** Ringkasan instalasi untuk layar awal/pengaturan EXE. */
export function infoInstalasi(db: Db): { peran: PeranInstalasi | null; wilayahId: string | null; wilayahNama: string | null; terkunci: boolean; aktif: boolean } {
  const peran = peranInstalasi(db)
  const wilayahId = peran === 'daerah' ? (db.nilai<string>(`SELECT id FROM wilayah WHERE tingkat = 'daerah' AND dihapus = 0 ORDER BY dibuat_pada LIMIT 1`) ?? null) : (ambilMeta(db, 'wilayah_instalasi') ?? null)
  return {
    peran,
    wilayahId,
    wilayahNama: wilayahId ? (ambilWilayah(db, wilayahId)?.nama ?? null) : null,
    terkunci: adalahExe(db) ? !kunciTerbuka.has(db) : false,
    aktif: peran !== null,
  }
}

// ---------------- kunci titipan (kunci kelompok yang dititipkan daerah ke EXE) ----------------

/** Isi kunci titipan per kelompok: semua versi kunci setor (dengan rahasia & tanda tangan admin) + kunci umum. */
export interface KunciTitipan {
  setor: KunciSetor[]
  umum?: { versi: number; kunci: string }
}

/** Simpan/gabungkan kunci titipan (dienkripsi kunci induk EXE). */
export function simpanKunciTitipan(db: Db, kunci: KunciExe, peta: Record<string, KunciTitipan>): void {
  for (const [kelompokId, baru] of Object.entries(peta)) {
    if (!baru || !Array.isArray(baru.setor)) continue
    const lama = ambilKunciTitipan(db, kunci, kelompokId)
    const umum = !lama?.umum || (baru.umum && baru.umum.versi > lama.umum.versi) ? (baru.umum ?? lama?.umum) : lama.umum
    const isi: KunciTitipan = { setor: gabungKunciSetor(lama?.setor, baru.setor) }
    if (umum) isi.umum = umum
    db.jalankan('INSERT OR REPLACE INTO kunci_titipan (kelompok_id, isi_terenkripsi) VALUES (?, ?)', [
      kelompokId,
      encB64(kunci.induk, keUtf8(JSON.stringify(isi))),
    ])
  }
}

/** Kunci titipan satu kelompok (atau undefined). */
export function ambilKunciTitipan(db: Db, kunci: KunciExe, kelompokId: string): KunciTitipan | undefined {
  const t = db.nilai<string>('SELECT isi_terenkripsi FROM kunci_titipan WHERE kelompok_id = ?', [kelompokId])
  if (!t) return undefined
  return JSON.parse(dariUtf8(decB64(kunci.induk, t))) as KunciTitipan
}

// ---------------- penerbitan token oleh EXE desa ----------------

export interface OpsiTerbitTokenBawah {
  kodePerangkat: string
  /**
   * pengurus/mubaligh untuk HP; `admin` = EXE kelompok (EXE desa) atau EXE desa/kelompok (Super Admin HP).
   * Fase 9 — Super Admin HP juga: `kurikulum` (EXE kurikulum), `generus` (murid), `wali` (orang tua).
   */
  role: 'pengurus' | 'mubaligh' | 'admin' | 'kurikulum' | 'generus' | 'wali'
  nama: string
  wilayahId: string
  hak?: Hak[]
  berlakuHari?: number
  /** generus/wali: anak (generus) yang dipegang token — boleh generus yang baru diusulkan HP ini (Fase 9). */
  generusIds?: string[]
  /**
   * Fase 9 (Super Admin HP, token pengurus/mubaligh): tujuan SETOR HP itu. `saya` (bawaan) = Super Admin HP ini;
   * `daerah` = langsung ke EXE Daerah.
   */
  setorKe?: 'saya' | 'daerah'
}

/**
 * EXE desa (hak `terbit_bawah`) menerbitkan token pengurus/mubaligh (HP) atau EXE kelompok untuk wilayahnya (V3).
 * Wilayah token wajib di dalam wilayah desa ini. Token HP membawa `atas_box_pub`: EXE kelompok aktif di kelompok itu
 * (bila ada), selain itu EXE desa ini — tujuan SETOR HP tersebut.
 * Fase 9: Super Admin HP (admin tingkat daerah) menerbitkan semua peran di seluruh daerah — pengurus, mubaligh, murid,
 * orang tua, EXE desa/kelompok/kurikulum — kecuali Super Admin HP lain.
 */
export function terbitkanTokenBawah(db: Db, kunci: KunciExe, o: OpsiTerbitTokenBawah): string {
  const saya = profilExe(db)
  pastikanProfilBolehMencatat(saya)
  if (saya.role !== 'admin' || !saya.hak.includes('terbit_bawah')) {
    throw new GalatPpg('TIDAK_BERWENANG', 'EXE ini tidak berhak menerbitkan kode aktivasi (hanya EXE desa).')
  }
  const tp = uraiToken(saya.token).payload
  const superHp = adalahTokenSuperHp(tp)
  const boleh = superHp ? (o.role === 'generus' || o.role === 'wali' ? HAK_BAWAAN[o.role] : HAK_DARI_SUPER[o.role]) : HAK_DARI_DESA[o.role]
  if (!boleh) {
    throw new GalatPpg(
      'ROLE_TIDAK_SAH',
      superHp ? 'Super Admin HP tidak menerbitkan peran ini.' : 'EXE desa menerbitkan token pengurus, mubaligh, atau EXE kelompok.',
    )
  }
  const w = ambilWilayah(db, o.wilayahId)
  if (!w || w.dihapus) throw new GalatPpg('WILAYAH_TIDAK_SAH', 'Wilayah tidak ditemukan. Terapkan paket terbaru dari daerah.')
  if (wilayahMencakupDb(db)(saya.wilayah_id, w.id) !== true) {
    throw new GalatPpg('DI_LUAR_WILAYAH', 'Wilayah ini di luar desa Anda. Kode aktivasinya diterbitkan oleh desa yang bersangkutan atau daerah.')
  }
  const delegasi = o.role === 'generus' || o.role === 'wali'
  if ((o.role === 'mubaligh' || delegasi) && w.tingkat !== 'kelompok') {
    throw new GalatPpg('TINGKAT_TIDAK_SAH', delegasi ? 'Murid dan orang tua terdaftar di satu kelompok.' : 'Mubaligh ditugaskan untuk satu kelompok.')
  }
  if (o.role === 'admin' && (superHp ? w.tingkat === 'daerah' : w.tingkat !== 'kelompok')) {
    throw new GalatPpg('TINGKAT_TIDAK_SAH', superHp ? 'EXE admin untuk satu desa atau satu kelompok (Super Admin HP hanya diterbitkan EXE Daerah).' : 'Mubaligh dan EXE kelompok ditugaskan untuk satu kelompok.')
  }
  if (o.role === 'kurikulum' && w.id !== saya.wilayah_id) throw new GalatPpg('TINGKAT_TIDAK_SAH', 'EXE kurikulum untuk wilayah daerah.')
  if (!o.nama?.trim()) throw new GalatPpg('NAMA_KOSONG', 'Nama pemegang token wajib diisi.')
  const tingkat = w.tingkat
  const hakAwal = o.hak ?? (delegasi ? HAK_BAWAAN[o.role] : o.role === 'admin' ? hakBawaan('admin', tingkat) : hakBawaan(o.role, tingkat))
  const hak = [...new Set(hakAwal)]
  if (!hak.every((h) => boleh.includes(h))) throw new GalatPpg('HAK_TIDAK_SAH', superHp ? 'Hak tersebut tidak boleh diberikan Super Admin HP.' : 'Hak tersebut tidak boleh diberikan EXE desa.')
  if (o.role === 'admin' && hak.includes('terbit_bawah') && tingkat !== 'desa') throw new GalatPpg('HAK_TIDAK_SAH', 'Hak menerbitkan kode aktivasi hanya untuk EXE desa.')
  if (o.role === 'admin' && hak.includes('sahkan') && tingkat !== 'kelompok') throw new GalatPpg('HAK_TIDAK_SAH', 'Hak mengesahkan hanya untuk EXE kelompok.')
  const kode = bacaKodePerangkat(o.kodePerangkat)
  if (o.role === 'mubaligh') {
    const lain = daftarPerangkat(db, { perangkatId: kode.perangkat_id, role: 'mubaligh', aktifSaja: true }).filter((p) => p.wilayah_id !== w.id)
    if (lain.length) throw new GalatPpg('SATU_MUBALIGH_SATU_KELOMPOK', 'HP ini sudah memegang token mubaligh kelompok lain (K12).')
  }
  const generusIds = delegasi ? periksaGenerusToken(db, o.role as 'generus' | 'wali', w.id, o.generusIds ?? []) : undefined
  const berlakuHari = o.berlakuHari ?? 365
  if (!(berlakuHari > 0 && berlakuHari <= 3650)) throw new GalatPpg('MASA_BERLAKU_TIDAK_SAH', 'Masa berlaku 1–3650 hari.')
  const rahasia: RahasiaToken = {}
  if (tingkat === 'kelompok' && o.role !== 'admin') {
    const t = ambilKunciTitipan(db, kunci, w.id)
    if (o.role === 'mubaligh') {
      if (!t?.setor.length) throw new GalatPpg('KUNCI_TIDAK_ADA', 'Kunci kelompok belum diterima dari daerah. Terapkan paket terbaru dari daerah.')
      rahasia.kunci_kelompok_setor = t.setor
    }
    if (delegasi) {
      // murid/orang tua hanya memegang kunci setor PUBLIK terbaru bertanda tangan daerah (T22)
      const sah = gabungKunciSetor(t?.setor).filter((k) => kunciSetorSah(k, { orgId: tp.org_id, kelompokId: w.id, adminSignPub: tp.admin_sign_pub }))
      const terbaru = sah[sah.length - 1]
      if (!terbaru) throw new GalatPpg('KUNCI_TIDAK_ADA', 'Kunci kelompok belum diterima dari daerah. Buka paket terbaru dari daerah dulu.')
      rahasia.kunci_kelompok_setor = [{ versi: terbaru.versi, publik: terbaru.publik, tt: terbaru.tt }]
    }
    if (t?.umum) {
      rahasia.kunci_umum_kelompok = t.umum.kunci
      rahasia.kunci_umum_versi = t.umum.versi
    }
  }
  // Fase 8: bukti daerah bahwa kelompok ini di bawah desa penerbit (diperiksa HP/EXE kelompok tanpa pohon wilayah).
  // Fase 9: Super Admin HP berwilayah daerah (akar) — semua wilayah ada di dalamnya, tidak perlu bukti.
  let bukti: string | undefined
  if (w.id !== saya.wilayah_id && !superHp) {
    bukti = ambilMeta(db, `bukti_wilayah:${w.id}`)
    if (!bukti || !buktiWilayahSah(bukti, { orgId: tp.org_id, anakId: w.id, indukId: saya.wilayah_id, adminSignPub: tp.admin_sign_pub })) {
      throw new GalatPpg('BUKTI_WILAYAH_TIDAK_ADA', 'Data kelompok ini belum lengkap dari daerah. Buka paket terbaru dari daerah dulu.')
    }
  }
  const terbit = sekarangIso()
  const payload: PayloadToken = {
    v: 1,
    token_id: ulid(),
    org_id: tp.org_id,
    admin_sign_pub: tp.admin_sign_pub,
    admin_box_pub: tp.admin_box_pub,
    perangkat_id: kode.perangkat_id,
    device_sign_pub: kode.sign_pub,
    device_box_pub: kode.box_pub,
    role: o.role,
    nama: o.nama.trim(),
    tingkat,
    wilayah_id: w.id,
    hak,
    terbit,
    berlaku_sampai: tambahHariIso(terbit, berlakuHari),
    penerbit: saya.token,
  }
  if (generusIds) payload.generus_ids = generusIds
  if (bukti) payload.bukti_wilayah = bukti
  // Tujuan SETOR. EXE desa: EXE kelompok aktif (untuk HP di kelompok itu), selain itu EXE desa ini.
  // Super Admin HP: HP pengurus/mubaligh → Super Admin HP ini (atau langsung daerah); EXE, murid, orang tua → tanpa atas.
  if (!superHp || ((o.role === 'pengurus' || o.role === 'mubaligh') && o.setorKe !== 'daerah')) {
    const exeKelompok =
      o.role !== 'admin' && tingkat === 'kelompok' && !superHp
        ? daftarPerangkat(db, { role: 'admin', wilayahIds: [w.id], aktifSaja: true }).find((p) => p.perangkat_id !== kode.perangkat_id)
        : undefined
    payload.atas_box_pub = exeKelompok?.box_pub ?? keB64url(kunci.kotak.publik)
    payload.atas_perangkat_id = exeKelompok?.perangkat_id ?? kunci.perangkatId
  }
  if (Object.keys(rahasia).length) payload.rahasia = keB64url(segelKe(dariB64url(kode.box_pub), keUtf8(JSON.stringify(rahasia))))
  const teks = tandaTanganiToken(payload, kunci.tandaTangan.rahasia)
  daftarkanToken(db, payload, teks, { label: kode.label, diterbitkanOleh: saya.token_id })
  return teks
}

/**
 * Fase 9: generus yang boleh dipegang token murid/orang tua terbitan Super Admin HP — generus master di kelompok itu
 * (aktif/mondok), atau generus yang baru diusulkan HP ini (`tambah_generus` menunggu) untuk kelompok itu.
 */
function periksaGenerusToken(db: Db, role: 'generus' | 'wali', kelompokId: string, ids: string[]): string[] {
  const unik = [...new Set(ids)]
  if (role === 'generus' && unik.length !== 1) throw new GalatPpg('GENERUS_TIDAK_SAH', 'Token murid untuk tepat satu anak.')
  if (role === 'wali' && unik.length < 1) throw new GalatPpg('GENERUS_TIDAK_SAH', 'Pilih minimal satu anak untuk orang tua.')
  const pilihan = new Map(generusPilihanToken(db, kelompokId).map((g) => [g.id, g]))
  for (const id of unik) {
    const g = pilihan.get(id)
    if (!g) throw new GalatPpg('GENERUS_TIDAK_SAH', 'Anak tidak ditemukan di kelompok ini. Tambahkan dulu di menu Generus.')
    if (role === 'generus' && g.status === 'mondok') throw new GalatPpg('GENERUS_MONDOK', `${g.nama} sedang mondok.`)
  }
  return unik
}

/** Generus yang bisa dipilih untuk token murid/orang tua di satu kelompok (Fase 9): master aktif/mondok + usulan baru. */
export interface GenerusPilihan {
  id: string
  nama: string
  kategori: string | null
  status: string
  wali_nama: string | null
  wali_no_hp: string | null
  /** true = masih usulan (menunggu disetujui daerah lewat setoran). */
  usulan: boolean
}

export function generusPilihanToken(db: Db, kelompokId: string): GenerusPilihan[] {
  const hasil: GenerusPilihan[] = db
    .kueri<{ id: string; nama: string; kategori: string | null; status: string; wali_nama: string | null; wali_no_hp: string | null }>(
      `SELECT id, nama, kategori, status, wali_nama, wali_no_hp FROM generus WHERE kelompok_id = ? AND dihapus = 0 AND status IN ('aktif', 'mondok') ORDER BY nama`,
      [kelompokId],
    )
    .map((g) => ({ ...g, usulan: false }))
  const ada = new Set(hasil.map((g) => g.id))
  for (const u of db.kueri<{ data_json: string }>(
    `SELECT data_json FROM usulan WHERE jenis = 'tambah_generus' AND status = 'menunggu' AND dihapus = 0 AND kelompok_id = ? ORDER BY dibuat_pada`,
    [kelompokId],
  )) {
    let d: Record<string, unknown> = {}
    try {
      d = JSON.parse(u.data_json) as Record<string, unknown>
    } catch {
      continue
    }
    if (typeof d.id !== 'string' || ada.has(d.id)) continue
    ada.add(d.id)
    hasil.push({
      id: d.id,
      nama: String(d.nama ?? ''),
      kategori: typeof d.kategori === 'string' ? d.kategori : null,
      status: 'aktif',
      wali_nama: typeof d.wali_nama === 'string' ? d.wali_nama : null,
      wali_no_hp: typeof d.wali_no_hp === 'string' ? d.wali_no_hp : null,
      usulan: true,
    })
  }
  return hasil
}

/** Kelompok di dalam wilayah EXE ini (untuk formulir penerbitan & kirim paket). */
export function kelompokSaya(db: Db): string[] {
  const p = profilExe(db)
  return kelompokDalamWilayah(db, p.wilayah_id)
}

