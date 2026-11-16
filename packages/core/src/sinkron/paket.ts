// PAKET: tingkat atas → tingkat bawah. Isi dienkripsi kunci berkas acak yang disegel untuk tiap perangkat penerima (T10).
// v3: daerah → EXE desa (+ kunci kelompok titipan), EXE desa/kelompok → EXE kelompok/HP (ditandatangani EXE penerbit).
import { daftarKunciSetor, kunciBidangUntukPenugasan, kunciUmumKelompokVersi, type KunciAdmin } from '../admin'
import { penugasanToken } from '../bidang'
import { ambilBlob, buatInfoBidang, buatKontakBk, simpanBlob, type BlobBertanda } from '../info-bidang'
import { adalahIdRegister } from '../penetapan-kurikulum'
import { bidangRahasiaDitulis, bidangRahasiaUntuk, CALON_PEMBACA_RAHASIA, type Penugasan } from '../kepengurusan'
import { dekompresJson, kemasBerkas, kompresJson, periksaBerkas, slug, type BerkasKeluar, type HeaderBerkas } from '../berkas'
import { bukaSegel, dariB64url, dariUtf8, dekripsiRahasia, enkripsiRahasia, keB64url, keUtf8, kunciAcak32, segelKe } from '../crypto'
import type { Db } from '../db'
import { gabungSemua, rekamanKirim, type HasilGabung, type RekamanPerTabel } from '../gabung'
import { GalatPpg } from '../galat'
import {
  adalahKunciExe,
  ambilKunciTitipan,
  kunciExeTerbuka,
  profilExe,
  simpanKunciTitipan,
  type KunciExe,
  type KunciPemegang,
  type KunciTitipan,
} from '../instalasi'
import { ambilIdentitas, gabungKunciSetor } from '../perangkat'
import { opsiPeriksaDb } from '../rantai'
import {
  daftarkanToken,
  daftarPencabutan,
  daftarPerangkat,
  gabungPencabutan,
  seqDiterima,
  seqSampaiDaerah,
  type BarisPencabutan,
  type PerangkatTerdaftar,
} from '../repo/perangkat'
import { daftarProfil, pastikanProfilBolehMencatat, simpanRahasiaProfil, type Profil } from '../repo/profil'
import { adalahAdmin, adalahExe, ambilMeta, ambilMetaAngka, aturMeta, tandaTanya, type Rekaman } from '../repo/umum'
import { ambilWilayah, daftarWilayah, kelompokDalamWilayah, leluhurWilayah, turunanWilayah } from '../repo/wilayah'
import { TABEL_SINKRON, type NamaTabelSinkron } from '../skema'
import { buktiWilayahSah, periksaToken, tandaTanganiBuktiWilayah, uraiToken, type KunciBidang, type KunciSetor } from '../token'
import { sekarangIso } from '../waktu'
import { terapkanMateri } from './materi'
import { bacaBerkasJenis, catatImpor, kunciAdminTerpasang, sidikBerkas } from './umum'

export interface IsiPaket {
  wilayah_id: string
  rekaman: RekamanPerTabel
  pencabutan: BarisPencabutan[]
  perangkat: { token: string; diterbitkan_oleh: string | null; label: string | null }[]
  konfirmasi: Record<string, number>
  /** perangkat_id → b64url(segelKe(box_pub, JSON {kelompok_id: KunciSetor[]})) — hanya untuk mubaligh. */
  kunci_setor: Record<string, string>
  /**
   * perangkat_id → b64url(segelKe(box_pub, JSON {kelompok_id: {versi, kunci}})) — kunci umum kelompok (JADWAL)
   * untuk pengurus/mubaligh tingkat kelompok. Kunci baru tiba di sini setelah serah terima (Fase 1b).
   */
  kunci_umum?: Record<string, string>
  /** v3: token EXE pengirim (paket dari EXE desa/kelompok; diverifikasi lewat rantai sampai daerah). */
  token_pengirim?: string
  /** v3: perangkat_id → seq perangkat itu yang sudah dipastikan sampai di daerah (konfirmasi bertahap). */
  konfirmasi_daerah?: Record<string, number>
  /** v3: perangkat_id EXE → b64url(segelKe(box_pub, JSON {kelompok_id: KunciTitipan})) — kunci kelompok titipan daerah. */
  kunci_titipan?: Record<string, string>
  /**
   * Fase 8 (hanya paket daerah): kelompok_id → tanda tangan daerah "kelompok ini di bawah desa induknya" (`bukti_wilayah`).
   * EXE desa menanamkannya di token yang ia terbitkan untuk kelompok itu.
   */
  bukti_wilayah?: Record<string, string>
  /**
   * Fase 8 (paket EXE desa/kelompok): berkas MATERI daerah (b64url) yang diteruskan APA ADANYA — tanda tangan daerah
   * diperiksa penerima; diterapkan hanya bila lebih baru dari yang terpasang.
   */
  materi_daerah?: string
  /** §17 (paket daerah): perangkat_id → b64url(segelKe(box_pub, JSON KunciBidang[])) — kunci bidang untuk jabatan pembaca. */
  kunci_bidang?: Record<string, string>
  /**
   * §21.2: info bidang bertanda tangan daerah (kunci publik konseling & keuangan tiap wilayah, perangkat BK aktif, kerabat BK).
   * Paket EXE desa/kelompok meneruskannya apa adanya.
   */
  info_bidang?: BlobBertanda
  /** §21.4: kontak WA BK per wilayah, bertanda tangan daerah (diteruskan apa adanya, juga lewat BALASAN). */
  kontak_bk?: BlobBertanda
  /** §21.1 (paket daerah): pengurus berpenugasan di wilayah paket — untuk Struktur & Kursi Kosong di EXE desa. */
  pengurus_bidang?: PengurusBidang[]
}

/** §21.1: ringkasan satu token pengurus berpenugasan (tanpa kunci). */
export interface PengurusBidang {
  token_id: string
  nama: string
  wilayah_id: string
  penugasan: Penugasan[]
}

/** Pengurus aktif berpenugasan yang menyentuh wilayah-wilayah ini (Struktur & Kursi Kosong). */
export function pengurusBidangAktif(db: Db, wilayahIds?: readonly string[]): PengurusBidang[] {
  const ada = wilayahIds ? new Set(wilayahIds) : null
  const kini = sekarangIso()
  const out: PengurusBidang[] = []
  for (const t of daftarPerangkat(db, { role: 'pengurus', aktifSaja: true })) {
    if (t.dibekukan || (t.berlaku_sampai && t.berlaku_sampai < kini)) continue
    const pn = penugasanToken(t.token)
    if (!pn.length || (ada && !pn.some((x) => ada.has(x.wilayah_id)))) continue
    out.push({ token_id: t.id, nama: t.nama, wilayah_id: t.wilayah_id, penugasan: pn })
  }
  return out
}

function pilih(db: Db, tabel: NamaTabelSinkron, kolom: string, nilai: string[], tambahan = ''): Rekaman[] {
  if (!nilai.length) return []
  return db.kueri<Rekaman>(`SELECT * FROM ${tabel} WHERE ${kolom} IN (${tandaTanya(nilai.length)}) ${tambahan}`, nilai)
}

function unik(rows: Rekaman[]): Rekaman[] {
  const m = new Map<string, Rekaman>()
  for (const r of rows) m.set(r.id, r)
  return [...m.values()]
}

/** Kumpulkan data master & kegiatan untuk sebuah wilayah (dipakai PAKET). */
export function dataWilayah(db: Db, wilayahId: string): RekamanPerTabel {
  const turunan = turunanWilayah(db, wilayahId)
  const leluhur = leluhurWilayah(db, wilayahId)
  const kel = kelompokDalamWilayah(db, wilayahId)
  const generusIds = [
    ...new Set([
      ...pilih(db, 'generus', 'kelompok_id', kel).map((g) => g.id),
      ...pilih(db, 'riwayat_keanggotaan', 'kelompok_id', kel).map((r) => String(r.generus_id)),
    ]),
  ]
  const perangkatIds = [...new Set(daftarPerangkat(db, { wilayahIds: turunan }).map((p) => p.perangkat_id))]
  const r: Record<string, Rekaman[]> = {
    // Fase 3: seluruh pohon wilayah (nama & kode saja, tidak sensitif) agar HP bisa memilih kelompok tujuan
    // usulan pindah kelompok. Data kegiatan/generus tetap dibatasi wilayah paket.
    wilayah: db.kueri<Rekaman>('SELECT * FROM wilayah'),
    generus: pilih(db, 'generus', 'id', generusIds),
    riwayat_keanggotaan: pilih(db, 'riwayat_keanggotaan', 'generus_id', generusIds),
    riwayat_status: pilih(db, 'riwayat_status', 'generus_id', generusIds),
    jamaah: pilih(db, 'jamaah', 'kelompok_id', kel),
    pengajian: pilih(db, 'pengajian', 'wilayah_id', [...turunan, ...leluhur]),
    penugasan_mubaligh: pilih(db, 'penugasan_mubaligh', 'kelompok_id', kel),
    koreksi: pilih(db, 'koreksi', 'untuk_perangkat_id', perangkatIds),
    // v3: master global kecil — jadwal setor, target capaian, periode aktif
    jadwal_setor: db.kueri<Rekaman>('SELECT * FROM jadwal_setor'),
    target_capaian: db.kueri<Rekaman>('SELECT * FROM target_capaian'),
    pengaturan: db.kueri<Rekaman>('SELECT * FROM pengaturan'),
    pertemuan: pilih(db, 'pertemuan', 'kelompok_id', kel),
    presensi: pilih(db, 'presensi', 'kelompok_id', kel),
    kemajuan_belajar: unik([...pilih(db, 'kemajuan_belajar', 'kelompok_id', kel), ...pilih(db, 'kemajuan_belajar', 'generus_id', generusIds)]),
    penilaian_akhlaq: unik([...pilih(db, 'penilaian_akhlaq', 'kelompok_id', kel), ...pilih(db, 'penilaian_akhlaq', 'generus_id', generusIds)]),
    jadwal_tambahan: pilih(db, 'jadwal_tambahan', 'kelompok_id', kel),
    // Fase 9: usulan tambah wilayah/pengajian bisa ber-wilayah desa/daerah
    usulan: pilih(db, 'usulan', 'kelompok_id', turunan),
    // §16: materi evaluasi (master global kecil), lembar kontrol keaktifan, evaluasi semester, laporan bulanan
    materi_evaluasi: db.kueri<Rekaman>('SELECT * FROM materi_evaluasi'),
    keaktifan: unik([...pilih(db, 'keaktifan', 'kelompok_id', kel), ...pilih(db, 'keaktifan', 'generus_id', generusIds)]),
    evaluasi_semester: unik([...pilih(db, 'evaluasi_semester', 'kelompok_id', kel), ...pilih(db, 'evaluasi_semester', 'generus_id', generusIds)]),
    penilaian_karakter: unik([...pilih(db, 'penilaian_karakter', 'kelompok_id', kel), ...pilih(db, 'penilaian_karakter', 'generus_id', generusIds)]),
    laporan_bulanan: pilih(db, 'laporan_bulanan', 'kelompok_id', kel),
    // §17: catatan bidang kepengurusan di wilayah paket (isi rahasia tetap terenkripsi kunci bidang)
    catatan_bidang: pilih(db, 'catatan_bidang', 'wilayah_id', turunan),
  }
  const out: RekamanPerTabel = {}
  for (const [t, rows] of Object.entries(r)) if (rows.length) out[t as NamaTabelSinkron] = rekamanKirim(rows)
  return out
}

/** Isi rekaman PAKET: EXE tidak mengirim tabel yang hanya boleh dari daerah (materi lewat berkas MATERI). */
function rekamanPaket(db: Db, wilayahId: string, daerah: boolean): RekamanPerTabel {
  const r = dataWilayah(db, wilayahId)
  if (!daerah) {
    for (const t of TABEL_HANYA_DAERAH) delete r[t]
    if (r.pengaturan) r.pengaturan = r.pengaturan.filter((x) => !adalahIdRegister((x as { id?: unknown }).id))
  }
  return r
}

/**
 * §21.2: kunci bidang yang boleh disimpan profil menurut penugasannya (pertahanan berlapis atas isi paket daerah):
 * konseling hanya wilayah BK-nya; keuangan semua wilayah untuk calon pembaca daerah, wilayahnya untuk penggalang dana desa/kelompok.
 */
function kunciBidangBoleh(pn: readonly Penugasan[], daerahId: string): (bidang: string, wilayahId: string) => boolean {
  const jabDaerah = pn.filter((x) => x.wilayah_id === daerahId).map((x) => x.jabatan)
  const keuanganSemua = bidangRahasiaUntuk(jabDaerah, CALON_PEMBACA_RAHASIA).includes('keuangan') || bidangRahasiaDitulis(jabDaerah).includes('keuangan')
  const bk = new Set(pn.filter((x) => x.jabatan === 'bk').map((x) => x.wilayah_id))
  const dana = new Set(pn.filter((x) => x.jabatan === 'penggalang_dana').map((x) => x.wilayah_id))
  return (bidang, w) => (bidang === 'konseling' ? bk.has(w) : bidang === 'keuangan' ? keuanganSemua || dana.has(w) : false)
}

const ROLE_PENERIMA_PAKET: PerangkatTerdaftar['role'][] = ['pengurus', 'mubaligh', 'admin']

function segel(p: Pick<PerangkatTerdaftar, 'box_pub'>, isi: unknown): string {
  return keB64url(segelKe(dariB64url(p.box_pub), keUtf8(JSON.stringify(isi))))
}

/** Sumber kunci kelompok pengirim paket: daerah (kunci admin) atau EXE (kunci titipan). */
function sumberKunci(db: Db, kunci: KunciPemegang) {
  return {
    setor: (kelompokId: string): KunciSetor[] =>
      adalahKunciExe(kunci) ? (ambilKunciTitipan(db, kunci, kelompokId)?.setor ?? []) : daftarKunciSetor(db, kunci, kelompokId, true),
    umum: (kelompokId: string): { versi: number; kunci: string } | undefined =>
      adalahKunciExe(kunci) ? ambilKunciTitipan(db, kunci, kelompokId)?.umum : kunciUmumKelompokVersi(db, kunci, kelompokId),
  }
}

/**
 * Buat PAKET untuk satu wilayah: master + kegiatan wilayah, koreksi, pencabutan, daftar token, konfirmasi seq per
 * perangkat (+ konfirmasi sampai daerah), kunci kelompok setor untuk mubaligh, kunci titipan untuk EXE. Hanya perangkat
 * aktif (belum dicabut) yang wilayahnya sama/di atas wilayah paket yang bisa membukanya.
 * Daerah: `kunci` = KunciAdmin. EXE desa/kelompok (v3): `kunci` = KunciExe, wilayah paket harus di dalam wilayah EXE itu.
 */
export function buatPaket(db: Db, wilayahId: string, kunci: KunciPemegang): BerkasKeluar & { versi: number; penerima: number } {
  const daerah = adalahAdmin(db)
  if (!daerah && !adalahExe(db)) throw new GalatPpg('BUKAN_DB_ADMIN', 'Paket hanya dibuat di aplikasi EXE.')
  if (daerah === adalahKunciExe(kunci)) throw new GalatPpg('KUNCI_SALAH', 'Kunci tidak cocok dengan instalasi ini.')
  const w = ambilWilayah(db, wilayahId)
  if (!w || w.dihapus) throw new GalatPpg('WILAYAH_TIDAK_SAH', 'Wilayah tidak ditemukan.')
  let saya: Profil | null = null
  let cakupan = new Set([wilayahId, ...leluhurWilayah(db, wilayahId)])
  if (!daerah) {
    saya = profilExe(db)
    pastikanProfilBolehMencatat(saya)
    if (saya.role !== 'admin') throw new GalatPpg('TIDAK_BERWENANG', 'EXE ini tidak membuat paket.')
    const milik = new Set(turunanWilayah(db, saya.wilayah_id))
    if (!milik.has(wilayahId)) throw new GalatPpg('DI_LUAR_WILAYAH', 'Wilayah ini di luar wilayah EXE Anda.')
    cakupan = new Set([...cakupan].filter((x) => milik.has(x)))
  }
  const idSaya = daerah ? 'ADMIN' : (kunci as KunciExe).perangkatId
  const penerima = daftarPerangkat(db, { role: ROLE_PENERIMA_PAKET, aktifSaja: true }).filter(
    (p) => cakupan.has(p.wilayah_id) && p.perangkat_id !== idSaya,
  )
  if (!penerima.length) {
    throw new GalatPpg('TIDAK_ADA_PENERIMA', 'Belum ada pengurus/mubaligh/EXE aktif untuk wilayah ini. Terbitkan token dulu.')
  }
  const turunan = turunanWilayah(db, wilayahId)
  const tokenWilayah = daftarPerangkat(db, { wilayahIds: turunan }).filter((p) => p.perangkat_id !== idSaya)
  const konfirmasi: Record<string, number> = {}
  const konfirmasiDaerah: Record<string, number> = {}
  const konfDaerahSaya = ambilMetaAngka(db, 'konfirmasi_daerah_seq')
  for (const p of [...tokenWilayah, ...penerima]) {
    konfirmasi[p.perangkat_id] = seqDiterima(db, p.perangkat_id)
    konfirmasiDaerah[p.perangkat_id] = daerah ? konfirmasi[p.perangkat_id]! : seqSampaiDaerah(db, p.perangkat_id, konfDaerahSaya)
  }
  const sumber = sumberKunci(db, kunci)
  const kunciSetor: Record<string, string> = {}
  for (const p of penerima.filter((x) => x.role === 'mubaligh')) {
    const ks = sumber.setor(p.wilayah_id)
    if (ks.length) kunciSetor[p.perangkat_id] = segel(p, { [p.wilayah_id]: ks })
  }
  const kunciUmum: Record<string, string> = {}
  for (const p of penerima.filter((x) => x.tingkat === 'kelompok' && x.role !== 'admin')) {
    const ku = sumber.umum(p.wilayah_id)
    if (ku) kunciUmum[p.perangkat_id] = segel(p, { [p.wilayah_id]: ku })
  }
  const kunciTitipan: Record<string, string> = {}
  for (const p of penerima.filter((x) => x.role === 'admin')) {
    const peta: Record<string, KunciTitipan> = {}
    for (const k of kelompokDalamWilayah(db, p.wilayah_id)) {
      const setor = sumber.setor(k)
      if (!setor.length) continue
      const umum = sumber.umum(k)
      peta[k] = umum ? { setor, umum } : { setor }
    }
    if (Object.keys(peta).length) kunciTitipan[p.perangkat_id] = segel(p, peta)
  }
  const isi: IsiPaket = {
    kunci_umum: kunciUmum,
    wilayah_id: wilayahId,
    rekaman: rekamanPaket(db, wilayahId, daerah),
    // Fase 9: pencabutan token EXE/Super Admin HP (penerbit) ikut, agar HP menolak token yang terbit sesudahnya
    pencabutan: daftarPencabutan(db, [...new Set([...tokenWilayah.map((p) => p.id), ...daftarPerangkat(db, { role: 'admin' }).map((p) => p.id)])]),
    perangkat: tokenWilayah.map((p) => ({ token: p.token, diterbitkan_oleh: p.diterbitkan_oleh, label: p.label })),
    konfirmasi,
    kunci_setor: kunciSetor,
    konfirmasi_daerah: konfirmasiDaerah,
  }
  if (Object.keys(kunciTitipan).length) isi.kunci_titipan = kunciTitipan
  // §17: versi kunci bidang terbaru untuk pengurus berjabatan pembaca (mis. setelah ganti kunci bidang)
  if (daerah) {
    const kb: Record<string, string> = {}
    for (const p of penerima.filter((x) => x.role === 'pengurus')) {
      // §18 (J-M7): pembaca menurut kebijakan hak baca; penulis bukan pembaca hanya kunci publik
      // §21.2: per penugasan (BK wilayah W → konseling W; pembaca keuangan daerah → semua wilayah; penggalang desa → wilayahnya)
      const daftar = kunciBidangUntukPenugasan(db, kunci as KunciAdmin, penugasanToken(p.token))
      if (daftar.length) kb[p.perangkat_id] = segel(p, daftar)
    }
    if (Object.keys(kb).length) isi.kunci_bidang = kb
    isi.info_bidang = buatInfoBidang(db, kunci as KunciAdmin)
    isi.kontak_bk = buatKontakBk(db, kunci as KunciAdmin)
    const pb = pengurusBidangAktif(db, turunan)
    if (pb.length) isi.pengurus_bidang = pb
  } else {
    // §21.2: EXE meneruskan info bidang & kontak BK dari daerah apa adanya (tanda tangan daerah diperiksa penerima)
    const info = ambilBlob(db, 'info')
    if (info) isi.info_bidang = info.blob
    const kontak = ambilBlob(db, 'kontak')
    if (kontak) isi.kontak_bk = kontak.blob
  }
  if (saya) {
    isi.token_pengirim = saya.token
    const materi = ambilMeta(db, 'berkas_materi')
    if (materi) isi.materi_daerah = materi
  }
  if (daerah && penerima.some((p) => p.role === 'admin')) {
    const bukti: Record<string, string> = {}
    for (const id of turunan) {
      const k = ambilWilayah(db, id)
      if (k && !k.dihapus && k.tingkat === 'kelompok' && k.induk_id) {
        bukti[k.id] = tandaTanganiBuktiWilayah((kunci as KunciAdmin).orgId, k.id, k.induk_id, kunci.tandaTangan.rahasia)
      }
    }
    if (Object.keys(bukti).length) isi.bukti_wilayah = bukti
  }
  const kunciBerkas = kunciAcak32()
  const kunciPenerima: Record<string, string> = {}
  for (const p of penerima) kunciPenerima[p.perangkat_id] = keB64url(segelKe(dariB64url(p.box_pub), kunciBerkas))

  const versi = ambilMetaAngka(db, `versi_paket:${wilayahId}`) + 1
  const header: HeaderBerkas = {
    jenis: 'PAKET',
    versi_format: 1,
    org_id: daerah ? (kunci as KunciAdmin).orgId : kunciAdminTerpasang(db).orgId,
    pengirim_perangkat_id: idSaya,
    dibuat_pada: sekarangIso(),
    wilayah_id: wilayahId,
    versi,
    kunci_penerima: kunciPenerima,
  }
  const bytes = kemasBerkas(header, enkripsiRahasia(kunciBerkas, kompresJson(isi)), kunci.tandaTangan.rahasia)
  aturMeta(db, `versi_paket:${wilayahId}`, versi)
  return { nama: `PPG_PAKET_${slug(w.nama)}_v${versi}.ppg`, bytes, header, versi, penerima: Object.keys(kunciPenerima).length }
}

export interface RingkasanTerapkan {
  jenis: 'PAKET' | 'BALASAN' | 'JADWAL' | 'MATERI'
  versi?: number
  perTabel: Partial<Record<NamaTabelSinkron, HasilGabung>>
  total: HasilGabung
  pencabutanBaru: number
  /** Profil HP ini yang berubah status karena pencabutan/pembekuan. */
  profilTerdampak: { id: string; nama: string; dibekukan: boolean; dicabut: boolean }[]
  /** Fase 8: berkas MATERI daerah yang ikut di PAKET EXE dan diterapkan (versinya), bila ada yang baru. */
  materiDiterapkan?: number
  /** Fase 8 (MATERI): berkas yang sama persis sudah terpasang — tidak ada perubahan. */
  sudahPernah?: boolean
}

/** Potret status profil (untuk mendeteksi perubahan setelah menerapkan berkas). */
export function potretProfil(db: Db): Map<string, string> {
  return new Map(daftarProfil(db).map((p) => [p.id, `${p.dibekukan}|${p.dicabut_pada}`]))
}

/** Profil yang statusnya berubah dibanding potret sebelumnya. */
export function profilBerubah(db: Db, sebelum: Map<string, string>): RingkasanTerapkan['profilTerdampak'] {
  return daftarProfil(db)
    .filter((p) => sebelum.get(p.id) !== `${p.dibekukan}|${p.dicabut_pada}`)
    .map((p) => ({ id: p.id, nama: p.nama, dibekukan: p.dibekukan, dicabut: !!p.dicabut_pada }))
}

/** Tabel yang tidak boleh dikirim EXE dalam PAKET (materi hanya lewat berkas MATERI bertanda tangan daerah). */
const TABEL_HANYA_DAERAH: readonly NamaTabelSinkron[] = ['bidang_materi', 'kategori_materi', 'materi', 'materi_evaluasi']

/** Kegiatan yang ikut generus pindah kelompok (boleh ber-kelompok lama di luar wilayah pengirim). */
const TABEL_IKUT_GENERUS: readonly NamaTabelSinkron[] = ['kemajuan_belajar', 'penilaian_akhlaq', 'keaktifan', 'evaluasi_semester', 'penilaian_karakter']

/**
 * HP/EXE menerapkan PAKET: tolak berkas lama (versi & cap waktu ≤ terpasang, per penerbit), buka dengan kunci
 * perangkat, verifikasi penerbit (admin daerah, atau EXE desa/kelompok lewat rantai token — v3), gabung sebagai sumber
 * berwenang, perbarui konfirmasi_seq (+ konfirmasi sampai daerah), daftar token, pencabutan, kunci.
 */
export function terapkanPaket(db: Db, bytes: Uint8Array, namaBerkas?: string): RingkasanTerapkan {
  const admin = kunciAdminTerpasang(db)
  const b = bacaBerkasJenis(db, bytes, 'PAKET')
  const dariDaerah = b.header.pengirim_perangkat_id === 'ADMIN'
  if (dariDaerah && !periksaBerkas(b, dariB64url(admin.signPub))) {
    throw new GalatPpg('TANDA_TANGAN_TIDAK_SAH', 'Tanda tangan paket tidak sah (bukan dari admin Anda atau berkas diubah).')
  }
  const wilayahId = b.header.wilayah_id ?? ''
  const versi = Number(b.header.versi ?? 0)
  const kunciVersi = dariDaerah ? `versi_paket:${wilayahId}` : `versi_paket:${b.header.pengirim_perangkat_id}:${wilayahId}`
  const kunciDibuat = dariDaerah ? `paket_dibuat:${wilayahId}` : `paket_dibuat:${b.header.pengirim_perangkat_id}:${wilayahId}`
  const terpasang = ambilMetaAngka(db, kunciVersi)
  const dibuatTerpasang = ambilMeta(db, kunciDibuat) ?? ''
  if (!berkasLebihBaru(versi, b.header.dibuat_pada, terpasang, dibuatTerpasang)) {
    throw new GalatPpg('PAKET_LAMA', `Paket ini (v${versi}) tidak lebih baru dari yang sudah terpasang (v${terpasang}).`)
  }
  const identitas = ambilIdentitas(db)
  const segelBerkas = b.header.kunci_penerima?.[identitas.id]
  if (!segelBerkas) {
    const apa = adalahExe(db) ? 'EXE' : 'HP'
    throw new GalatPpg('BUKAN_PENERIMA', `Paket ini bukan untuk ${apa} ini (atau token ${apa} ini sudah dicabut).`)
  }
  const kunciBerkas = bukaSegel(dariB64url(segelBerkas), identitas.kotak)
  const isi = dekompresJson<IsiPaket>(dekripsiRahasia(kunciBerkas, b.isi))
  if (isi.wilayah_id !== wilayahId) throw new GalatPpg('BERKAS_TIDAK_SAH', 'Isi paket tidak cocok dengan kepalanya.')
  const opsi = opsiPeriksaDb(db)
  let wilayahPengirim: string | null = null
  if (!dariDaerah) {
    // v3: paket dari EXE desa/kelompok — penerbit diverifikasi lewat rantai token sampai kunci daerah
    if (typeof isi.token_pengirim !== 'string') throw new GalatPpg('PENGIRIM_TIDAK_SAH', 'Paket tidak memuat token pengirim.')
    const h = periksaToken(isi.token_pengirim, { ...opsi, abaikanKedaluwarsa: true })
    if (!h.sah) throw new GalatPpg('PENGIRIM_TIDAK_SAH', `Pengirim paket tidak sah: ${h.alasan}`)
    const p = h.payload
    if (p.role !== 'admin' || p.perangkat_id !== b.header.pengirim_perangkat_id || !periksaBerkas(b, dariB64url(p.device_sign_pub))) {
      throw new GalatPpg('TANDA_TANGAN_TIDAK_SAH', 'Tanda tangan paket tidak sah.')
    }
    if (opsi.wilayahMencakup!(p.wilayah_id, wilayahId) === false) throw new GalatPpg('PENGIRIM_TIDAK_SAH', 'Paket untuk wilayah di luar EXE pengirim.')
    wilayahPengirim = p.wilayah_id
  }
  const diLuar = (id: unknown) => wilayahPengirim !== null && opsi.wilayahMencakup!(wilayahPengirim, String(id ?? '')) === false
  const periksaRek =
    wilayahPengirim === null
      ? undefined
      : (tabel: NamaTabelSinkron) => (rek: Rekaman) => {
          if (TABEL_HANYA_DAERAH.includes(tabel)) return 'Materi hanya diterima dari berkas MATERI daerah.'
          // §18 (J-KR6): register kebijakan & penetapan kurikulum hanya dari daerah
          if (tabel === 'pengaturan' && adalahIdRegister(rek.id)) return 'Kebijakan & penetapan kurikulum hanya diterima dari daerah.'
          if ((tabel === 'generus' || tabel === 'jamaah' || tabel === 'penugasan_mubaligh') && diLuar(rek.kelompok_id)) return 'Data di luar wilayah pengirim.'
          const info = TABEL_SINKRON[tabel]
          const kol = 'kolomKelompok' in info ? info.kolomKelompok : undefined
          if (kol && !TABEL_IKUT_GENERUS.includes(tabel) && diLuar(rek[kol])) return 'Data di luar wilayah pengirim.'
          return null
        }

  // Fase 8: berkas MATERI daerah yang diteruskan EXE — diverifikasi tanda tangan daerah oleh terapkanMateri
  let materiDiterapkan: number | undefined
  if (!dariDaerah && typeof isi.materi_daerah === 'string') {
    try {
      const m = terapkanMateri(db, dariB64url(isi.materi_daerah))
      if (!m.sudahPernah) materiDiterapkan = m.versi
    } catch {
      // materi tidak lebih baru / rusak → diabaikan; paket tetap diterapkan
    }
  }
  const sebelum = potretProfil(db)
  const kunciExe = adalahExe(db) ? kunciExeTerbuka(db) : undefined
  return db.transaksi(() => {
    const g = gabungSemua(db, isi.rekaman ?? {}, (tabel) => ({ sumber: 'admin', seqLokalBaru: 0, periksa: periksaRek?.(tabel) }))
    for (const t of isi.perangkat ?? []) {
      try {
        const p = uraiToken(t.token).payload
        if (p.org_id !== admin.orgId) continue
        if (diLuar(p.wilayah_id)) continue
        daftarkanToken(db, p, t.token, { label: t.label, diterbitkanOleh: t.diterbitkan_oleh })
      } catch {
        // token rusak diabaikan
      }
    }
    const pencabutanBaru = gabungPencabutan(db, isi.pencabutan ?? [])
    const konf = Number(isi.konfirmasi?.[identitas.id] ?? 0)
    if (konf > ambilMetaAngka(db, 'konfirmasi_seq')) aturMeta(db, 'konfirmasi_seq', konf)
    const konfDaerah = Number(isi.konfirmasi_daerah?.[identitas.id] ?? (dariDaerah ? konf : 0))
    if (konfDaerah > ambilMetaAngka(db, 'konfirmasi_daerah_seq')) aturMeta(db, 'konfirmasi_daerah_seq', konfDaerah)
    const segelKunci = isi.kunci_setor?.[identitas.id]
    if (segelKunci) {
      const peta = JSON.parse(dariUtf8(bukaSegel(dariB64url(segelKunci), identitas.kotak))) as Record<string, KunciSetor[]>
      for (const p of daftarProfil(db, 'mubaligh')) {
        const baru = peta[p.wilayah_id]
        if (baru) simpanRahasiaProfil(db, p.id, { ...p.rahasia, kunci_kelompok_setor: gabungKunciSetor(p.rahasia.kunci_kelompok_setor, baru) })
      }
    }
    const segelUmum = isi.kunci_umum?.[identitas.id]
    if (segelUmum) {
      const peta = JSON.parse(dariUtf8(bukaSegel(dariB64url(segelUmum), identitas.kotak))) as Record<string, { versi: number; kunci: string }>
      for (const p of daftarProfil(db, ['pengurus', 'mubaligh'])) perbaruiKunciUmum(db, p, peta[p.wilayah_id])
    }
    const segelBidang = dariDaerah ? isi.kunci_bidang?.[identitas.id] : undefined
    if (segelBidang) {
      const daftar = JSON.parse(dariUtf8(bukaSegel(dariB64url(segelBidang), identitas.kotak))) as KunciBidang[]
      const daerahId = daftarWilayah(db, { tingkat: 'daerah' })[0]?.id ?? ''
      for (const p of daftarProfil(db, 'pengurus')) {
        const boleh = kunciBidangBoleh(penugasanToken(p.token), daerahId)
        const baru = daftar.filter((k) => boleh(k.bidang, k.wilayah_id ?? daerahId))
        if (!baru.length) continue
        const id = (k: KunciBidang) => `${k.bidang}:${k.wilayah_id ?? daerahId}:${k.versi}`
        const peta = new Map((p.rahasia.kunci_bidang ?? []).map((k) => [id(k), k]))
        // kunci lengkap yang sudah dipegang tidak ditimpa kunci publik saja (mekanisme Fase 11: catatan lama tetap terbaca)
        for (const k of baru) if (k.rahasia || !peta.get(id(k))?.rahasia) peta.set(id(k), k)
        simpanRahasiaProfil(db, p.id, { ...p.rahasia, kunci_bidang: [...peta.values()] })
      }
    }
    // §21.2/§21.4: info bidang & kontak BK (bertanda tangan daerah; yang lebih lama/tidak sah diabaikan)
    if (isi.info_bidang) simpanBlob(db, 'info', isi.info_bidang)
    if (isi.kontak_bk) simpanBlob(db, 'kontak', isi.kontak_bk)
    if (dariDaerah && kunciExe && Array.isArray(isi.pengurus_bidang)) aturMeta(db, `pengurus_bidang:${wilayahId}`, JSON.stringify(isi.pengurus_bidang))
    const segelTitipan = isi.kunci_titipan?.[identitas.id]
    if (segelTitipan && kunciExe) {
      const peta = JSON.parse(dariUtf8(bukaSegel(dariB64url(segelTitipan), identitas.kotak))) as Record<string, KunciTitipan>
      const milik = new Set(daftarProfil(db, 'admin').flatMap((p) => kelompokDalamWilayah(db, p.wilayah_id)))
      simpanKunciTitipan(db, kunciExe, Object.fromEntries(Object.entries(peta).filter(([k]) => milik.has(k) && !diLuar(k))))
    }
    if (dariDaerah && kunciExe && isi.bukti_wilayah && typeof isi.bukti_wilayah === 'object') {
      for (const [k, bukti] of Object.entries(isi.bukti_wilayah)) {
        const w = ambilWilayah(db, k)
        if (w?.induk_id && buktiWilayahSah(bukti, { orgId: admin.orgId, anakId: k, indukId: w.induk_id, adminSignPub: admin.signPub })) {
          aturMeta(db, `bukti_wilayah:${k}`, bukti)
        }
      }
    }
    aturMeta(db, kunciVersi, Math.max(versi, terpasang))
    if (b.header.dibuat_pada > dibuatTerpasang) aturMeta(db, kunciDibuat, b.header.dibuat_pada)
    aturMeta(db, 'terakhir_paket', sekarangIso())
    const ringkasan: RingkasanTerapkan = {
      jenis: 'PAKET',
      versi,
      perTabel: g.perTabel,
      total: g.total,
      pencabutanBaru,
      profilTerdampak: profilBerubah(db, sebelum),
    }
    if (materiDiterapkan !== undefined) ringkasan.materiDiterapkan = materiDiterapkan
    catatImpor(db, b.header, ringkasan, sidikBerkas(bytes), namaBerkas)
    return ringkasan
  })
}

/**
 * Berkas admin (PAKET/MATERI) diterima bila versinya ATAU cap waktunya lebih baru dari yang terpasang.
 * Berkas lama yang diputar ulang punya keduanya ≤ terpasang → ditolak; admin yang memulihkan database dari
 * cadangan (nomor versi mundur, cap waktu maju) tetap diterima (Fase 1b).
 */
export function berkasLebihBaru(versi: number, dibuat: string, versiTerpasang: number, dibuatTerpasang: string): boolean {
  return versi > versiTerpasang || (!!dibuatTerpasang && dibuat > dibuatTerpasang)
}

/** Ganti kunci umum kelompok profil bila versi yang diterima lebih baru (atau profil belum punya). */
export function perbaruiKunciUmum(db: Db, p: Profil, baru: { versi: number; kunci: string } | undefined): boolean {
  if (!baru || typeof baru.kunci !== 'string' || typeof baru.versi !== 'number') return false
  const versiLama = p.rahasia.kunci_umum_kelompok ? (p.rahasia.kunci_umum_versi ?? 1) : 0
  if (baru.versi <= versiLama) return false
  simpanRahasiaProfil(db, p.id, { ...p.rahasia, kunci_umum_kelompok: baru.kunci, kunci_umum_versi: baru.versi })
  return true
}

/** Versi paket yang terpasang di HP untuk wilayah tertentu (0 = belum ada). `pengirimId` = perangkat EXE penerbit (v3). */
export function versiPaketTerpasang(db: Db, wilayahId: string, pengirimId?: string): number {
  return ambilMetaAngka(db, pengirimId && pengirimId !== 'ADMIN' ? `versi_paket:${pengirimId}:${wilayahId}` : `versi_paket:${wilayahId}`)
}

