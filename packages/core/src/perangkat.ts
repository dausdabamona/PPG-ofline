// Fungsi HP: identitas perangkat, aktivasi profil (multi-profil + PIN), penerbitan token generus/wali oleh mubaligh.
import {
  buatPasanganKotak,
  buatPasanganTandaTangan,
  byteAcak,
  dariB64url,
  keB64url,
  keUtf8,
  segelKe,
  sha256Hex,
  siapkanKripto,
  type PasanganKunci,
} from './crypto'
import type { Db } from './db'
import { GalatPpg } from './galat'
import { ulid } from './ids'
import { ambilGenerus } from './repo/generus'
import { daftarkanToken, daftarPencabutan } from './repo/perangkat'
import { ambilProfil, barisProfil, daftarProfil, pastikanProfilBolehMencatat, profilAktif, type Profil } from './repo/profil'
import { adalahAdmin, adalahExe, ambilMeta, aturMeta } from './repo/umum'
import {
  bacaKodePerangkat,
  bukaRahasiaToken,
  buatKodePerangkat,
  HAK_BAWAAN,
  kunciSetorSah,
  periksaToken,
  ROLE_EXE,
  statusPencabutan,
  tandaTanganiToken,
  uraiToken,
  type KunciSetor,
  type PayloadToken,
  type RahasiaToken,
} from './token'
import { sekarangIso, tambahHariIso } from './waktu'
import { wajibBuktiWilayahDb, wilayahMencakupDb } from './rantai'
import { JABATAN_PIN_WAJIB, penugasanDari } from './kepengurusan'

/** Identitas kriptografis HP ini. */
export interface IdentitasPerangkat {
  id: string
  label: string
  tandaTangan: PasanganKunci
  kotak: PasanganKunci
  dibuatPada: string
}

interface BarisIdentitas {
  id: string
  sign_pub: string
  sign_rahasia: string
  box_pub: string
  box_rahasia: string
  label: string | null
  dibuat_pada: string | null
}

/** Inisialisasi HP (sekali): buat identitas & kunci. Bila sudah ada, kembalikan yang lama. */
export async function inisialisasiPerangkat(db: Db, label: string): Promise<{ identitas: IdentitasPerangkat; kodePerangkat: string }> {
  await siapkanKripto()
  if (adalahAdmin(db)) throw new GalatPpg('DB_ADMIN', 'Database admin tidak bisa dipakai sebagai HP.')
  if (!db.nilai<string>('SELECT id FROM identitas_perangkat LIMIT 1')) {
    const s = buatPasanganTandaTangan()
    const b = buatPasanganKotak()
    db.jalankan(
      'INSERT INTO identitas_perangkat (id, sign_pub, sign_rahasia, box_pub, box_rahasia, label, dibuat_pada) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [ulid(), keB64url(s.publik), keB64url(s.rahasia), keB64url(b.publik), keB64url(b.rahasia), label.trim() || 'HP', sekarangIso()],
    )
    aturMeta(db, 'peran_db', 'hp')
  }
  const identitas = ambilIdentitas(db)
  return { identitas, kodePerangkat: kodePerangkatDari(identitas) }
}

/** Penanda kunci rahasia identitas yang terenkripsi (EXE v3); kunci terbuka disimpan di memori per Db. */
export const AWALAN_TERENKRIPSI = 'enc:'
const identitasTerbuka = new WeakMap<Db, IdentitasPerangkat>()

/** (internal) Pasang identitas EXE yang sudah dibuka dengan kata sandi untuk Db ini (hanya di memori). */
export function pasangIdentitasTerbuka(db: Db, i: IdentitasPerangkat | null): void {
  if (i) identitasTerbuka.set(db, i)
  else identitasTerbuka.delete(db)
}

/** Identitas HP/EXE ini; melempar PERANGKAT_BELUM_SIAP, atau EXE_TERKUNCI bila kunci EXE belum dibuka dengan kata sandi. */
export function ambilIdentitas(db: Db): IdentitasPerangkat {
  const b = db.satu<BarisIdentitas>('SELECT * FROM identitas_perangkat LIMIT 1')
  if (!b) throw new GalatPpg('PERANGKAT_BELUM_SIAP', 'Perangkat belum diinisialisasi.')
  if (b.sign_rahasia.startsWith(AWALAN_TERENKRIPSI)) {
    const i = identitasTerbuka.get(db)
    if (!i || i.id !== b.id) throw new GalatPpg('EXE_TERKUNCI', 'Aplikasi terkunci. Masukkan kata sandi terlebih dahulu.')
    return i
  }
  return {
    id: b.id,
    label: b.label ?? '',
    tandaTangan: { publik: dariB64url(b.sign_pub), rahasia: dariB64url(b.sign_rahasia) },
    kotak: { publik: dariB64url(b.box_pub), rahasia: dariB64url(b.box_rahasia) },
    dibuatPada: b.dibuat_pada ?? '',
  }
}

function kodePerangkatDari(i: IdentitasPerangkat): string {
  return buatKodePerangkat({
    perangkat_id: i.id,
    sign_pub: keB64url(i.tandaTangan.publik),
    box_pub: keB64url(i.kotak.publik),
    label: i.label,
    dibuat_pada: i.dibuatPada,
  })
}

/** Teks Kode Perangkat HP ini (untuk QR / dikirim ke admin atau mubaligh). */
export function kodePerangkatSaya(db: Db): string {
  return kodePerangkatDari(ambilIdentitas(db))
}

/** Gabungkan daftar kunci setor (per versi; versi dengan rahasia diutamakan). */
export function gabungKunciSetor(lama: KunciSetor[] = [], baru: KunciSetor[] = []): KunciSetor[] {
  const peta = new Map<number, KunciSetor>()
  for (const k of [...lama, ...baru]) {
    if (!k || typeof k.versi !== 'number' || typeof k.publik !== 'string') continue
    const ada = peta.get(k.versi)
    if (!ada || (!ada.rahasia && k.rahasia)) peta.set(k.versi, { ...k, tt: k.tt ?? (ada?.publik === k.publik ? ada.tt : undefined) })
    else if (!ada.tt && k.tt && ada.publik === k.publik) ada.tt = k.tt
  }
  return [...peta.values()].sort((a, b) => a.versi - b.versi)
}

function hashPin(garam: string, pin: string): string {
  return sha256Hex(`${garam}:${pin}`)
}

function pastikanPin(pin: string): void {
  if (!/^\d{4}$/.test(pin)) throw new GalatPpg('PIN_TIDAK_SAH', 'PIN harus 4 angka.')
}

/**
 * Aktifkan token di HP ini sebagai profil. Pertama kali: kunci admin dari token dipasang (T2).
 * Ditolak bila token palsu/diubah, untuk HP lain, organisasi lain, dicabut, atau kedaluwarsa.
 * Token baru untuk orang & peran yang sama menggantikan token lama (perpanjangan) dengan PIN tetap.
 */
export async function aktifkanProfil(db: Db, teksToken: string, opsi: { pin?: string } = {}): Promise<Profil> {
  await siapkanKripto()
  const identitas = ambilIdentitas(db)
  const t = uraiToken(teksToken)
  const p = t.payload
  const exe = adalahExe(db)
  if (!exe && ROLE_EXE.includes(p.role)) {
    throw new GalatPpg('TOKEN_UNTUK_EXE', 'Kode aktivasi ini untuk aplikasi EXE (desa/kelompok/kurikulum), bukan untuk HP.')
  }
  if (exe && !ROLE_EXE.includes(p.role)) {
    throw new GalatPpg('TOKEN_UNTUK_HP', 'Kode aktivasi ini untuk HP, bukan untuk aplikasi EXE.')
  }
  const orgAda = ambilMeta(db, 'org_id')
  if (orgAda && orgAda !== p.org_id) {
    throw new GalatPpg('ORG_BERBEDA', 'Token ini dari organisasi/admin lain dari profil yang sudah ada di HP ini.')
  }
  const adminSignPub = ambilMeta(db, 'admin_sign_pub') ?? p.admin_sign_pub
  const hasil = periksaToken(t.teks, {
    adminSignPub,
    pencabutan: daftarPencabutan(db),
    wilayahMencakup: wilayahMencakupDb(db),
    wajibBuktiWilayah: wajibBuktiWilayahDb(db),
  })
  if (!hasil.sah && hasil.kode !== 'DIBEKUKAN') throw new GalatPpg(hasil.kode, hasil.alasan)
  if (
    p.perangkat_id !== identitas.id ||
    p.device_sign_pub !== keB64url(identitas.tandaTangan.publik) ||
    p.device_box_pub !== keB64url(identitas.kotak.publik)
  ) {
    throw new GalatPpg('TOKEN_BUKAN_UNTUK_HP_INI', 'Token ini dibuat untuk HP lain. Kirim Kode Perangkat HP ini untuk mendapat token sendiri.')
  }
  const rahasia = bukaRahasiaToken(p, identitas.kotak)
  if (p.role === 'generus' || p.role === 'wali') {
    // kunci setor dari mubaligh hanya dipakai bila bertanda tangan admin (Fase 1b)
    rahasia.kunci_kelompok_setor = (rahasia.kunci_kelompok_setor ?? [])
      .filter((k) => kunciSetorSah(k, { orgId: p.org_id, kelompokId: p.wilayah_id, adminSignPub }))
      .map((k) => ({ versi: k.versi, publik: k.publik, tt: k.tt }))
  }
  if (opsi.pin !== undefined) pastikanPin(opsi.pin)

  return db.transaksi(() => {
    if (!orgAda) {
      aturMeta(db, 'org_id', p.org_id)
      aturMeta(db, 'admin_sign_pub', p.admin_sign_pub)
      aturMeta(db, 'admin_box_pub', p.admin_box_pub)
    }
    const generusIds = [...(p.generus_ids ?? [])].sort()
    const sama = daftarProfil(db).find(
      (x) =>
        x.token_id === p.token_id ||
        (x.role === p.role && x.wilayah_id === p.wilayah_id && JSON.stringify([...x.generus_ids].sort()) === JSON.stringify(generusIds) && (p.role === 'generus' || p.role === 'wali' || x.nama === p.nama)),
    )
    const id = sama?.id ?? ulid()
    const lama = sama ? barisProfil(db, sama.id) : undefined
    const rahasiaFinal: RahasiaToken = {
      ...rahasia,
      kunci_kelompok_setor: gabungKunciSetor(sama?.rahasia.kunci_kelompok_setor, rahasia.kunci_kelompok_setor),
    }
    if (!rahasiaFinal.kunci_kelompok_setor?.length) delete rahasiaFinal.kunci_kelompok_setor
    const versiUmumLama = sama?.rahasia.kunci_umum_kelompok ? (sama.rahasia.kunci_umum_versi ?? 1) : 0
    const versiUmumBaru = rahasiaFinal.kunci_umum_kelompok ? (rahasiaFinal.kunci_umum_versi ?? 1) : 0
    if (versiUmumLama > versiUmumBaru) {
      rahasiaFinal.kunci_umum_kelompok = sama!.rahasia.kunci_umum_kelompok
      rahasiaFinal.kunci_umum_versi = versiUmumLama
    }
    let pinHash = lama?.pin_hash ?? null
    let pinGaram = lama?.pin_garam ?? null
    if (opsi.pin !== undefined) {
      pinGaram = keB64url(byteAcak(16))
      pinHash = hashPin(pinGaram, opsi.pin)
    }
    const st = statusPencabutan(daftarPencabutan(db, [p.token_id]), p.token_id)
    const adaAktif = !!profilAktif(db)
    db.jalankan(
      `INSERT OR REPLACE INTO profil (id, token_id, token, role, nama, wilayah_id, tingkat, generus_ids_json, pin_hash, pin_garam,
         rahasia_json, dibekukan, dicabut_pada, aktif, berlaku_sampai, dibuat_pada)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        p.token_id,
        t.teks,
        p.role,
        p.nama,
        p.wilayah_id,
        p.tingkat,
        JSON.stringify(p.generus_ids ?? []),
        pinHash,
        pinGaram,
        JSON.stringify(rahasiaFinal),
        st.dibekukan ? 1 : 0,
        st.dicabutPada,
        lama ? lama.aktif : adaAktif ? 0 : 1,
        p.berlaku_sampai,
        lama?.dibuat_pada ?? sekarangIso(),
      ],
    )
    return ambilProfil(db, id)!
  })
}

/** Pilih profil aktif (PIN wajib bila profil ber-PIN). */
export function pilihProfil(db: Db, id: string, pin?: string): Profil {
  const b = barisProfil(db, id)
  if (!b) throw new GalatPpg('TIDAK_DITEMUKAN', 'Profil tidak ditemukan.')
  if (b.pin_hash) {
    if (pin === undefined) throw new GalatPpg('PIN_DIBUTUHKAN', 'Masukkan PIN profil.')
    if (hashPin(b.pin_garam ?? '', pin) !== b.pin_hash) throw new GalatPpg('PIN_SALAH', 'PIN salah.')
  }
  db.transaksi(() => {
    db.jalankan('UPDATE profil SET aktif = 0')
    db.jalankan('UPDATE profil SET aktif = 1 WHERE id = ?', [id])
  })
  return ambilProfil(db, id)!
}

function pinWajibToken(teks: string): boolean {
  try {
    return penugasanDari(uraiToken(teks).payload).some((x) => JABATAN_PIN_WAJIB.includes(x.jabatan))
  } catch {
    return false
  }
}

/** Atur atau hapus (null) PIN profil; bila profil sudah ber-PIN, PIN lama wajib benar. */
export function aturPin(db: Db, id: string, pinBaru: string | null, pinLama?: string): void {
  const b = barisProfil(db, id)
  if (!b) throw new GalatPpg('TIDAK_DITEMUKAN', 'Profil tidak ditemukan.')
  if (b.pin_hash && (pinLama === undefined || hashPin(b.pin_garam ?? '', pinLama) !== b.pin_hash)) {
    throw new GalatPpg('PIN_SALAH', 'PIN lama salah.')
  }
  if (pinBaru === null) {
    // §21.1: profil pengurus ber-BK/bendahara/penggalang dana wajib ber-PIN (HP bersama orang tua–anak)
    if (b.role === 'pengurus' && pinWajibToken(b.token)) throw new GalatPpg('PIN_WAJIB', 'Profil BK/Bendahara/Penggalang Dana wajib memakai PIN.')
    db.jalankan('UPDATE profil SET pin_hash = NULL, pin_garam = NULL WHERE id = ?', [id])
    return
  }
  pastikanPin(pinBaru)
  const garam = keB64url(byteAcak(16))
  db.jalankan('UPDATE profil SET pin_hash = ?, pin_garam = ? WHERE id = ?', [hashPin(garam, pinBaru), garam, id])
}

/** Hapus profil dari HP (data kegiatan yang sudah dicatat tetap ada). */
export function hapusProfil(db: Db, id: string): void {
  db.jalankan('DELETE FROM profil WHERE id = ?', [id])
}

export { daftarProfil, ambilProfil, profilAktif }

export interface OpsiTerbitTokenGenerus {
  kodePerangkat: string
  role: 'generus' | 'wali'
  generusIds: string[]
  nama: string
  berlakuHari?: number
}

/**
 * Mubaligh menerbitkan token generus/wali (K8) untuk HP di kelompoknya. Ditandatangani kunci perangkat
 * mubaligh, `penerbit` = token mubaligh, rahasia = kunci setor publik terbaru + kunci umum kelompok.
 * Token dicatat di tabel perangkat HP mubaligh dan ikut dilaporkan dalam SETOR.
 */
export function terbitkanTokenGenerus(db: Db, profilMubalighId: string, o: OpsiTerbitTokenGenerus): string {
  const m = ambilProfil(db, profilMubalighId)
  if (!m || m.role !== 'mubaligh') throw new GalatPpg('PROFIL_TIDAK_SAH', 'Hanya profil mubaligh yang bisa menerbitkan token generus/wali.')
  pastikanProfilBolehMencatat(m)
  if (!m.hak.includes('terbit_generus')) throw new GalatPpg('TIDAK_BERWENANG', 'Token mubaligh ini tidak berhak menerbitkan token generus.')
  if (o.role !== 'generus' && o.role !== 'wali') throw new GalatPpg('ROLE_TIDAK_SAH', 'Role harus generus atau wali.')
  const ids = [...new Set(o.generusIds)]
  if (o.role === 'generus' && ids.length !== 1) throw new GalatPpg('GENERUS_TIDAK_SAH', 'Token generus untuk tepat satu generus.')
  if (o.role === 'wali' && ids.length < 1) throw new GalatPpg('GENERUS_TIDAK_SAH', 'Pilih minimal satu anak untuk wali.')
  for (const gid of ids) {
    const g = ambilGenerus(db, gid)
    if (!g || g.dihapus || g.kelompok_id !== m.wilayah_id) {
      throw new GalatPpg('GENERUS_TIDAK_SAH', 'Generus tidak ditemukan di kelompok Anda. Terapkan paket terbaru dari admin.')
    }
    if (g.status !== 'aktif' && g.status !== 'mondok') throw new GalatPpg('GENERUS_TIDAK_AKTIF', `${g.nama} tidak berstatus aktif.`)
    if (o.role === 'generus' && g.status === 'mondok') throw new GalatPpg('GENERUS_MONDOK', `${g.nama} sedang mondok.`)
  }
  if (!o.nama?.trim()) throw new GalatPpg('NAMA_KOSONG', 'Nama pemegang token wajib diisi.')
  const identitas = ambilIdentitas(db)
  const tm = uraiToken(m.token).payload
  if (tm.device_sign_pub !== keB64url(identitas.tandaTangan.publik)) {
    throw new GalatPpg('TOKEN_BUKAN_UNTUK_HP_INI', 'Token mubaligh tidak cocok dengan HP ini.')
  }
  const kode = bacaKodePerangkat(o.kodePerangkat)
  const setor = gabungKunciSetor(m.rahasia.kunci_kelompok_setor)
  const terbaru = setor[setor.length - 1]
  if (!terbaru) throw new GalatPpg('KUNCI_TIDAK_ADA', 'Kunci kelompok setor belum ada di profil mubaligh.')
  const rahasia: RahasiaToken = { kunci_kelompok_setor: [{ versi: terbaru.versi, publik: terbaru.publik, tt: terbaru.tt }] }
  if (m.rahasia.kunci_umum_kelompok) {
    rahasia.kunci_umum_kelompok = m.rahasia.kunci_umum_kelompok
    rahasia.kunci_umum_versi = m.rahasia.kunci_umum_versi ?? 1
  }
  const berlakuHari = o.berlakuHari ?? 365
  const terbit = sekarangIso()
  const payload: PayloadToken = {
    v: 1,
    token_id: ulid(),
    org_id: tm.org_id,
    admin_sign_pub: tm.admin_sign_pub,
    admin_box_pub: tm.admin_box_pub,
    perangkat_id: kode.perangkat_id,
    device_sign_pub: kode.sign_pub,
    device_box_pub: kode.box_pub,
    role: o.role,
    nama: o.nama.trim(),
    tingkat: 'kelompok',
    wilayah_id: m.wilayah_id,
    generus_ids: ids,
    hak: HAK_BAWAAN[o.role],
    terbit,
    berlaku_sampai: tambahHariIso(terbit, berlakuHari),
    rahasia: keB64url(segelKe(dariB64url(kode.box_pub), keUtf8(JSON.stringify(rahasia)))),
    penerbit: m.token,
  }
  const teks = tandaTanganiToken(payload, identitas.tandaTangan.rahasia)
  daftarkanToken(db, payload, teks, { label: kode.label, diterbitkanOleh: m.token_id })
  return teks
}
