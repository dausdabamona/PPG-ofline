// §21.3–21.5 (Fase 15) — Rujukan ke BK: formulir mubaligh & pengurus, tujuan otomatis (BK kelompok → desa → daerah, lewati
// kerabat), berkas jalur cepat PPG_RUJUKAN (amplop ke perangkat BK tujuan), status Terima/Tangani/Selesai, Jadikan catatan
// konseling, Naikkan, pengingat Segera, pemicu keaktifan < 50 % dua bulan, Hubungi BK (wa.me), dan masa simpan M08.
import { type KunciAdmin } from './admin'
import { dekompresJson, kemasBerkas, kompresJson, periksaBerkas, slug, type BerkasKeluar, type HeaderBerkas } from './berkas'
import { bisaBacaBidang, daftarCatatan, penugasanHp, penugasanProfil, simpanCatatan, type CatatanBidang, type CatatanTerbaca } from './bidang'
import { bukaSegel, dariB64url, dekripsiRahasia, enkripsiRahasia, keB64url, kunciAcak32, segelKe } from './crypto'
import type { Db } from './db'
import { gabungRekaman, rekamanKirim } from './gabung'
import { GalatPpg } from './galat'
import { ambilInfoBidang, ambilKontakBk } from './info-bidang'
import { keaktifanBulan } from './juknis'
import { nilaiKebijakan } from './kebijakan'
import { KATEGORI_RUJUKAN, LABEL_STATUS_RUJUKAN, type KategoriRujukan, type StatusRujukan } from './kepengurusan'
import { ambilIdentitas } from './perangkat'
import { opsiPeriksaDb, wilayahMencakupDb } from './rantai'
import { ambilGenerus, daftarGenerus } from './repo/generus'
import { daftarProfil, statusProfil, type Profil } from './repo/profil'
import { adalahAdmin, ambilMeta, ambilRekaman, aturMeta, idPerangkatLokal, ubahRekaman, uraiJson, type Rekaman } from './repo/umum'
import { ambilWilayah, leluhurWilayah } from './repo/wilayah'
import { periksaToken } from './token'
import { sekarangIso, selisihHari, tanggalHariIni } from './waktu'
import { bacaBerkasJenis, catatImpor, imporTerdahulu, kunciAdminTerpasang, sidikBerkas } from './sinkron/umum'

// =====================================================================================================================
// Tujuan otomatis
// =====================================================================================================================

export interface TujuanRujukan {
  wilayah_id: string
  tingkat: 'kelompok' | 'desa' | 'daerah'
  nama: string
  /** Tingkat yang dilewati beserta alasannya (tanpa nama orang). */
  dilewati: { tingkat: string; alasan: 'tidak_ada_bk' | 'kerabat' }[]
}

/**
 * §21.3: tujuan rujukan = BK kelompok generus → bila kosong BK desa → bila kosong BK daerah. Kelompok/desa yang BK-nya kerabat
 * generus (J-BJ5) dilewati. `langsungDaerah` (hanya bila Segera) → BK Daerah. Perujuk tidak memilih tujuan.
 */
export function tujuanRujukan(db: Db, generusId: string, o: { langsungDaerah?: boolean } = {}): TujuanRujukan {
  const g = ambilGenerus(db, generusId)
  if (!g) throw new GalatPpg('TIDAK_DITEMUKAN', 'Generus tidak ditemukan.')
  const info = ambilInfoBidang(db)
  if (!info) throw new GalatPpg('INFO_BK_BELUM_ADA', 'Data BK belum ada di HP ini. Buka paket terbaru dari desa/daerah dulu.')
  const rantai = [g.kelompok_id, ...leluhurWilayah(db, g.kelompok_id)]
  const dilewati: TujuanRujukan['dilewati'] = []
  const daerah = rantai[rantai.length - 1]!
  const urutan = o.langsungDaerah ? [daerah] : rantai
  for (const w of urutan) {
    const wil = ambilWilayah(db, w)
    if (!wil) continue
    const ada = (info.bk[w]?.length ?? 0) > 0 && !!info.kunci[w]?.konseling
    const akhir = w === daerah
    if (!ada) {
      if (!akhir) dilewati.push({ tingkat: wil.tingkat, alasan: 'tidak_ada_bk' })
      continue
    }
    if (!akhir && (info.kerabat[w] ?? []).includes(generusId)) {
      dilewati.push({ tingkat: wil.tingkat, alasan: 'kerabat' })
      continue
    }
    return { wilayah_id: w, tingkat: wil.tingkat, nama: wil.nama, dilewati }
  }
  throw new GalatPpg('BK_BELUM_ADA', 'Belum ada pengurus BK aktif di kelompok, desa, maupun daerah. Hubungi pengurus PPG.')
}

// =====================================================================================================================
// Perujuk: simpan rujukan + berkas jalur cepat
// =====================================================================================================================

export interface DataRujukan {
  generusId: string
  kategori: KategoriRujukan
  uraian: string
  segera?: boolean
  /** Hanya bila Segera: kirim langsung ke BK Daerah. */
  langsungDaerah?: boolean
}

/** Profil perujuk (mubaligh/pengurus aktif) di HP ini yang wilayahnya mencakup kelompok generus. */
function profilPerujuk(db: Db, kelompokId: string): Profil {
  const mencakup = wilayahMencakupDb(db)
  const p = daftarProfil(db, ['mubaligh', 'pengurus']).find((x) => statusProfil(x).bolehMencatat && mencakup(x.wilayah_id, kelompokId) === true)
  if (!p) throw new GalatPpg('TIDAK_BERWENANG', 'Rujukan dibuat mubaligh/pengurus untuk generus di wilayahnya.')
  return p
}

/** Generus yang boleh dirujuk dari HP ini (generus aktif di wilayah profil mubaligh/pengurus). */
export function generusBolehDirujuk(db: Db): { id: string; nama: string; kelompok: string; kategori: string }[] {
  const mencakup = wilayahMencakupDb(db)
  const wil = daftarProfil(db, ['mubaligh', 'pengurus'])
    .filter((x) => statusProfil(x).bolehMencatat)
    .map((x) => x.wilayah_id)
  return daftarGenerus(db, { status: 'aktif' })
    .filter((g) => wil.some((w) => mencakup(w, g.kelompok_id) === true))
    .map((g) => ({ id: g.id, nama: g.nama, kelompok: ambilWilayah(db, g.kelompok_id)?.nama ?? '', kategori: g.kategori }))
    .sort((a, b) => a.kelompok.localeCompare(b.kelompok) || a.nama.localeCompare(b.nama))
}

export interface HasilRujukan {
  catatan: CatatanBidang
  tujuan: TujuanRujukan
  /** Berkas jalur cepat PPG_RUJUKAN (null bila perangkat BK tujuan tidak diketahui — tetap lewat Setor). */
  berkas: BerkasKeluar | null
  /** Teks peringatan untuk rujukan Segera. */
  pesanSegera: string | null
}

export const PESAN_SEGERA =
  'Hubungi BK atau pengurus sekarang lewat telepon. Bila menyangkut keselamatan anak, segera hubungi orang tua/pihak berwenang.'

/**
 * Simpan rujukan: `catatan_bidang` konseling/rujukan, isi disegel ke kunci konseling wilayah tujuan; kolom terbuka hanya
 * wilayah tujuan, tanggal, perujuk (perangkat). HP perujuk tidak menyimpan salinan terbaca.
 */
export function simpanRujukan(db: Db, d: DataRujukan): HasilRujukan {
  if (adalahAdmin(db)) throw new GalatPpg('TIDAK_BERWENANG', 'Rujukan dibuat dari HP mubaligh/pengurus.')
  const g = ambilGenerus(db, d.generusId)
  if (!g || g.dihapus) throw new GalatPpg('TIDAK_DITEMUKAN', 'Generus tidak ditemukan.')
  if (!KATEGORI_RUJUKAN.includes(d.kategori)) throw new GalatPpg('CATATAN_TIDAK_SAH', 'Kategori rujukan tidak dikenal.')
  if (d.langsungDaerah && !d.segera) throw new GalatPpg('CATATAN_TIDAK_SAH', 'Kirim langsung ke BK Daerah hanya untuk rujukan Segera.')
  const p = profilPerujuk(db, g.kelompok_id)
  const tujuan = tujuanRujukan(db, g.id, { langsungDaerah: d.langsungDaerah })
  const isi = {
    generus_id: g.id,
    nama: g.nama,
    kelompok_id: g.kelompok_id,
    kategori: d.kategori,
    uraian: d.uraian.trim(),
    segera: !!d.segera,
    perujuk: `${p.nama} (${p.role === 'mubaligh' ? 'Mubaligh' : 'Pengurus'})`,
  }
  const catatan = simpanCatatan(db, { jenis: 'rujukan', isi, wilayahId: tujuan.wilayah_id })
  let berkas: BerkasKeluar | null = null
  try {
    berkas = buatBerkasRujukan(db, catatan.id)
  } catch {
    berkas = null
  }
  return { catatan, tujuan, berkas, pesanSegera: d.segera ? PESAN_SEGERA : null }
}

interface IsiBerkasRujukan {
  rekaman: Rekaman[]
  tokens: string[]
}

/**
 * Berkas RUJUKAN (J-BJ4): rekaman rujukan (isi tetap tersegel kunci konseling) + token perujuk, dienkripsi kunci berkas acak
 * yang disegel ke `box_pub` tiap perangkat BK tujuan; ditandatangani kunci perangkat perujuk.
 */
export function buatBerkasRujukan(db: Db, rujukanId: string): BerkasKeluar {
  const rek = ambilRekaman<Rekaman>(db, 'catatan_bidang', rujukanId)
  if (!rek || rek.jenis !== 'rujukan' || rek.dihapus) throw new GalatPpg('TIDAK_DITEMUKAN', 'Rujukan tidak ditemukan.')
  const identitas = ambilIdentitas(db)
  if (rek.perangkat_id !== identitas.id) throw new GalatPpg('TIDAK_BERWENANG', 'Hanya perujuk yang mengirim berkas rujukannya.')
  const admin = kunciAdminTerpasang(db)
  const bk = ambilInfoBidang(db)?.bk[String(rek.wilayah_id)] ?? []
  if (!bk.length) throw new GalatPpg('BK_BELUM_ADA', 'Perangkat BK tujuan belum diketahui; rujukan tetap terkirim lewat Setor.')
  const tokens = daftarProfil(db, ['mubaligh', 'pengurus']).filter((x) => statusProfil(x).bolehMencatat).map((x) => x.token)
  const isi: IsiBerkasRujukan = { rekaman: rekamanKirim([rek]) as Rekaman[], tokens }
  const kunciBerkas = kunciAcak32()
  const kunciPenerima: Record<string, string> = {}
  for (const b of bk) kunciPenerima[b.perangkat_id] = keB64url(segelKe(dariB64url(b.box_pub), kunciBerkas))
  const header: HeaderBerkas = {
    jenis: 'RUJUKAN',
    versi_format: 1,
    org_id: admin.orgId,
    pengirim_perangkat_id: identitas.id,
    dibuat_pada: sekarangIso(),
    wilayah_id: String(rek.wilayah_id),
    kunci_penerima: kunciPenerima,
  }
  const bytes = kemasBerkas(header, enkripsiRahasia(kunciBerkas, kompresJson(isi)), identitas.tandaTangan.rahasia)
  const w = ambilWilayah(db, String(rek.wilayah_id))
  return { nama: `PPG_RUJUKAN_${slug(w?.nama ?? 'bk')}_${String(rek.tanggal).replaceAll('-', '')}_${rujukanId.slice(-6)}.ppg`, bytes, header }
}

export interface RingkasanImporRujukan {
  jenis: 'RUJUKAN'
  rujukanId: string
  /** Rekaman sudah ada (mis. sudah tiba lewat paket). */
  sudahAda: boolean
  sudahPernah?: boolean
}

/** HP BK tujuan membuka berkas RUJUKAN (Buka Berkas). Aturan wewenang sama dengan impor Setor (J-BJ2). */
export function imporRujukan(db: Db, bytes: Uint8Array, namaBerkas?: string): RingkasanImporRujukan {
  const b = bacaBerkasJenis(db, bytes, 'RUJUKAN')
  const sidik = sidikBerkas(bytes)
  const lama = imporTerdahulu<RingkasanImporRujukan>(db, sidik)
  if (lama) return { ...lama, sudahPernah: true }
  const identitas = ambilIdentitas(db)
  const segel = b.header.kunci_penerima?.[identitas.id]
  if (!segel) throw new GalatPpg('BUKAN_PENERIMA', 'Berkas rujukan ini bukan untuk HP ini (ditujukan ke BK lain).')
  const wilayahTujuan = b.header.wilayah_id ?? ''
  if (!penugasanHp(db, ['bk']).some((x) => x.wilayah_id === wilayahTujuan)) {
    throw new GalatPpg('BUKAN_PENERIMA', 'Rujukan ini untuk BK wilayah lain.')
  }
  let isi: IsiBerkasRujukan
  try {
    isi = dekompresJson<IsiBerkasRujukan>(dekripsiRahasia(bukaSegel(dariB64url(segel), identitas.kotak), b.isi))
  } catch {
    throw new GalatPpg('TIDAK_BISA_DIBUKA', 'Berkas rujukan tidak bisa dibuka di HP ini.')
  }
  const opsi = opsiPeriksaDb(db, { abaikanKedaluwarsa: true })
  const pengirim = b.header.pengirim_perangkat_id
  const penulis = (Array.isArray(isi.tokens) ? isi.tokens : [])
    .map((t) => periksaToken(t, opsi))
    .filter((h) => h.sah && h.payload.perangkat_id === pengirim && (h.payload.role === 'mubaligh' || h.payload.role === 'pengurus'))
    .map((h) => h.payload!)
  const sah = penulis.find((p) => periksaBerkas(b, dariB64url(p.device_sign_pub)))
  if (!sah) throw new GalatPpg('PENGIRIM_TIDAK_SAH', 'Tanda tangan atau token perujuk tidak sah.')
  const rek = Array.isArray(isi.rekaman) && isi.rekaman.length === 1 ? isi.rekaman[0]! : null
  if (!rek || rek.jenis !== 'rujukan' || rek.bidang !== 'konseling' || rek.perangkat_id !== pengirim || rek.wilayah_id !== wilayahTujuan) {
    throw new GalatPpg('BERKAS_TIDAK_SAH', 'Isi berkas rujukan tidak sah.')
  }
  if (typeof rek.isi_rahasia !== 'string' || rek.isi_json !== null) throw new GalatPpg('BERKAS_TIDAK_SAH', 'Isi rujukan harus terenkripsi.')
  const mencakup = wilayahMencakupDb(db)
  if (!(mencakup(wilayahTujuan, sah.wilayah_id) === true || mencakup(sah.wilayah_id, wilayahTujuan) === true)) {
    throw new GalatPpg('PENGIRIM_TIDAK_SAH', 'Perujuk di luar wilayah BK ini.')
  }
  const sudahAda = !!ambilRekaman(db, 'catatan_bidang', String(rek.id))
  return db.transaksi(() => {
    const g = gabungRekaman(db, 'catatan_bidang', [rek], { sumber: 'admin', seqLokalBaru: 0 })
    if (g.ditolak.length) throw new GalatPpg('BERKAS_TIDAK_SAH', g.ditolak[0]!.alasan)
    const ringkasan: RingkasanImporRujukan = { jenis: 'RUJUKAN', rujukanId: String(rek.id), sudahAda }
    catatImpor(db, b.header, ringkasan, sidik, namaBerkas)
    return ringkasan
  })
}

// =====================================================================================================================
// Status rujukan
// =====================================================================================================================

/** Id tetap status satu rujukan per perangkat BK penulis (BK lain di wilayah yang sama menulis rekamannya sendiri). */
export const idStatusRujukan = (perangkatId: string, rujukanId: string) => `SRJ-${perangkatId.slice(-10)}-${rujukanId}`

interface IsiRujukan {
  generus_id: string
  nama?: string
  kelompok_id?: string
  kategori: KategoriRujukan
  uraian: string
  segera?: boolean
  perujuk?: string
}

/** Status terbaru tiap rujukan (dari catatan status terbuka), termasuk rantai Naikkan (`asal_id`). */
function petaStatus(db: Db): Map<string, { status: StatusRujukan; tanggal: string; diubah: string }> {
  const out = new Map<string, { status: StatusRujukan; tanggal: string; diubah: string }>()
  for (const c of daftarCatatan(db, { jenis: 'status_rujukan' })) {
    const x = c.isi as { rujukan_id?: string; status?: StatusRujukan } | null
    if (!x?.rujukan_id || !x.status) continue
    const lama = out.get(x.rujukan_id)
    if (!lama || c.diubah_pada > lama.diubah) out.set(x.rujukan_id, { status: x.status, tanggal: c.tanggal, diubah: c.diubah_pada })
  }
  return out
}

/** Asal rujukan hasil Naikkan → id rujukan baru di atasnya. */
function petaNaik(db: Db): Map<string, string> {
  const out = new Map<string, string>()
  for (const c of daftarCatatan(db, { jenis: 'status_rujukan' })) {
    const x = c.isi as { rujukan_id?: string; asal_id?: string } | null
    if (x?.asal_id && x.rujukan_id) out.set(x.asal_id, x.rujukan_id)
  }
  return out
}

export interface RujukanSaya {
  id: string
  tanggal: string
  tujuan: string
  tingkat: string | null
  status: StatusRujukan | 'terkirim'
  label: string
}

/** HP perujuk: "Rujukan ke BK — tanggal — status" (tanpa isi). */
export function daftarRujukanSaya(db: Db): RujukanSaya[] {
  const saya = idPerangkatLokal(db)
  const st = petaStatus(db)
  const naik = petaNaik(db)
  return daftarCatatan(db, { jenis: 'rujukan' })
    .filter((c) => c.perangkat_id === saya && !c.rujukan_id)
    .map((c) => {
      // status rujukan asal, atau rujukan lanjutan bila sudah dinaikkan BK
      let s: StatusRujukan | 'terkirim' = st.get(c.id)?.status ?? 'terkirim'
      const lanjut = naik.get(c.id)
      if (s === 'dinaikkan' && lanjut && st.get(lanjut)) s = st.get(lanjut)!.status
      const w = ambilWilayah(db, c.wilayah_id)
      return { id: c.id, tanggal: c.tanggal, tujuan: w ? `BK ${w.nama}` : 'BK', tingkat: w?.tingkat ?? null, status: s, label: LABEL_STATUS_RUJUKAN[s] }
    })
}

export interface RujukanMasuk {
  id: string
  tanggal: string
  wilayah_id: string
  isi: IsiRujukan
  status: StatusRujukan | 'baru'
  /** Rujukan Segera yang belum Diterima ≥ 3 hari. */
  perluPengingat: boolean
  /** Hasil Naikkan dari BK di bawahnya. */
  dariBawah: boolean
  /** Sudah dijadikan catatan konseling. */
  catatanKonselingId: string | null
}

/** HP BK: rujukan masuk untuk wilayah BK-nya yang bisa dibuka (urut terbaru). Selesai disembunyikan kecuali `semua`. */
export function daftarRujukanMasuk(db: Db, o: { semua?: boolean; tanggal?: string } = {}): RujukanMasuk[] {
  const wil = new Set(penugasanHp(db, ['bk']).map((x) => x.wilayah_id))
  if (!wil.size) return []
  const hari = o.tanggal ?? tanggalHariIni()
  const st = petaStatus(db)
  const konseling = new Map<string, string>()
  for (const c of daftarCatatan(db, { jenis: 'konseling', wilayahIds: [...wil] })) if (c.rujukan_id) konseling.set(c.rujukan_id, c.id)
  return daftarCatatan(db, { jenis: 'rujukan', wilayahIds: [...wil] })
    .filter((c): c is CatatanTerbaca & { isi: Record<string, unknown> } => !!c.isi)
    .map((c) => {
      const isi = c.isi as unknown as IsiRujukan
      const status: StatusRujukan | 'baru' = st.get(c.id)?.status ?? 'baru'
      return {
        id: c.id,
        tanggal: c.tanggal,
        wilayah_id: c.wilayah_id,
        isi,
        status,
        perluPengingat: !!isi.segera && status === 'baru' && selisihHari(c.tanggal, hari) >= 3,
        dariBawah: !!c.rujukan_id,
        catatanKonselingId: konseling.get(c.id) ?? null,
      }
    })
    .filter((r) => o.semua || (r.status !== 'selesai' && r.status !== 'dinaikkan'))
}

/** Rujukan Segera yang menunggu diterima ≥ 3 hari (pengingat beranda HP BK). */
export function pengingatRujukanSegera(db: Db, tanggal?: string): RujukanMasuk[] {
  return daftarRujukanMasuk(db, { tanggal }).filter((r) => r.perluPengingat)
}

function rujukanTerbaca(db: Db, rujukanId: string): RujukanMasuk {
  const r = daftarRujukanMasuk(db, { semua: true }).find((x) => x.id === rujukanId)
  if (!r) throw new GalatPpg('TIDAK_DITEMUKAN', 'Rujukan tidak ditemukan atau bukan untuk BK di HP ini.')
  return r
}

/** BK menandai status rujukan (Terima → Tangani → Selesai). Rekaman terbuka `status_rujukan` tanpa isi, turun ke perujuk. */
export function ubahStatusRujukan(db: Db, rujukanId: string, status: Exclude<StatusRujukan, 'dinaikkan'>): CatatanBidang {
  return tulisStatus(db, rujukanTerbaca(db, rujukanId), status)
}

function tulisStatus(db: Db, r: RujukanMasuk, status: StatusRujukan): CatatanBidang {
  // wilayah status = kelompok generus → turun ke HP perujuk (mubaligh/pengurus kelompok itu) lewat paket
  const wilayah = r.isi.kelompok_id && ambilWilayah(db, r.isi.kelompok_id) ? r.isi.kelompok_id : r.wilayah_id
  const isi: Record<string, unknown> = { rujukan_id: r.id, status }
  // rujukan hasil Naikkan: status menaut rujukan asal agar perujuk melihat status akhirnya
  const asal = ambilRekaman<Rekaman>(db, 'catatan_bidang', r.id)?.rujukan_id
  if (asal) isi.asal_id = String(asal)
  return simpanCatatan(db, { jenis: 'status_rujukan', isi, wilayahId: wilayah, id: idStatusRujukan(idPerangkatLokal(db), r.id) })
}

/** "Jadikan catatan konseling": catatan konseling BK terisi dari rujukan (berujukan ke rujukan), status → Ditangani. */
export function jadikanCatatanKonseling(db: Db, rujukanId: string, o: { tindakLanjut?: string; masalah?: string } = {}): CatatanBidang {
  const r = rujukanTerbaca(db, rujukanId)
  if (r.catatanKonselingId) throw new GalatPpg('SUDAH_ADA', 'Rujukan ini sudah dijadikan catatan konseling.')
  const c = simpanCatatan(db, {
    jenis: 'konseling',
    wilayahId: r.wilayah_id,
    rujukanId: r.id,
    isi: {
      sasaran: 'generus',
      generus_id: r.isi.generus_id,
      nama: r.isi.nama ?? '',
      kategori: r.isi.kategori,
      masalah: (o.masalah ?? r.isi.uraian).trim(),
      tindak_lanjut: o.tindakLanjut ?? '',
    },
  })
  if (r.status === 'baru' || r.status === 'diterima') tulisStatus(db, r, 'ditangani')
  return c
}

/**
 * "Naikkan ke BK Desa/Daerah": rujukan baru disegel ke kunci konseling wilayah atas, merujuk ke rujukan asal (isi asal tidak
 * ikut terbuka — hanya yang ditulis ulang BK). Status asal → `dinaikkan`.
 */
export function naikkanRujukan(db: Db, rujukanId: string, o: { ke: 'desa' | 'daerah'; uraian: string }): { catatan: CatatanBidang; berkas: BerkasKeluar | null } {
  const r = rujukanTerbaca(db, rujukanId)
  if (r.status === 'selesai' || r.status === 'dinaikkan') throw new GalatPpg('STATUS_TIDAK_SAH', 'Rujukan ini sudah selesai/diteruskan.')
  const info = ambilInfoBidang(db)
  const atas = [r.wilayah_id, ...leluhurWilayah(db, r.wilayah_id)].slice(1).map((id) => ambilWilayah(db, id)).find((w) => w?.tingkat === o.ke)
  if (!atas) throw new GalatPpg('TUJUAN_TIDAK_ADA', `Tidak ada ${o.ke === 'desa' ? 'desa' : 'daerah'} di atas BK ini.`)
  if (!info?.bk[atas.id]?.length) throw new GalatPpg('BK_BELUM_ADA', `Belum ada BK aktif di ${atas.nama}.`)
  if (!o.uraian.trim()) throw new GalatPpg('CATATAN_TIDAK_SAH', 'Tulis ulang uraian singkat untuk BK tingkat atas.')
  const catatan = simpanCatatan(db, {
    jenis: 'rujukan',
    wilayahId: atas.id,
    rujukanId: r.id,
    isi: { generus_id: r.isi.generus_id, nama: r.isi.nama ?? '', kelompok_id: r.isi.kelompok_id ?? '', kategori: r.isi.kategori, uraian: o.uraian.trim(), segera: !!r.isi.segera, perujuk: 'BK (diteruskan)' },
  })
  tulisStatus(db, r, 'dinaikkan')
  let berkas: BerkasKeluar | null = null
  try {
    berkas = buatBerkasRujukan(db, catatan.id)
  } catch {
    berkas = null
  }
  return { catatan, berkas }
}

// =====================================================================================================================
// Pemicu otomatis keaktifan < 50 % dua bulan berturut-turut
// =====================================================================================================================

const bulanSebelum = (bulan: string, n: number) => {
  const d = new Date(Date.UTC(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)) - 1 - n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
export const AMBANG_SARAN_RUJUK = 50
const metaTutupSaran = (generusId: string, bulan: string) => `tutup_saran_rujuk:${generusId}:${bulan}`

export interface SaranRujuk {
  generus_id: string
  nama: string
  bulan: [string, string]
  persen: [number, number]
}

/**
 * §21.3: kartu "Rujuk ke BK?" di HP mubaligh: generus aktif kelompoknya yang keaktifannya < 50 % (target K16) pada DUA bulan
 * penuh terakhir berturut-turut. Sekali per anak per bulan; bisa ditutup.
 */
export function saranRujukKeaktifan(db: Db, kelompokId: string, tanggal: string = tanggalHariIni()): SaranRujuk[] {
  const bulanIni = tanggal.slice(0, 7)
  const b1 = bulanSebelum(bulanIni, 1)
  const b2 = bulanSebelum(bulanIni, 2)
  const out: SaranRujuk[] = []
  for (const g of daftarGenerus(db, { kelompokIds: [kelompokId], status: 'aktif' })) {
    if (ambilMeta(db, metaTutupSaran(g.id, bulanIni))) continue
    // hanya anggota kelompok ini sejak awal dua bulan itu (anak baru tidak dihukum)
    const mulai = db.nilai<string>(
      `SELECT MIN(mulai) FROM riwayat_keanggotaan WHERE dihapus = 0 AND generus_id = ? AND kelompok_id = ? AND (selesai IS NULL OR selesai > ?)`,
      [g.id, kelompokId, `${b2}-01`],
    )
    if (!mulai || mulai > `${b2}-01`) continue
    const p2 = keaktifanBulan(db, g.id, b2).persen
    const p1 = keaktifanBulan(db, g.id, b1).persen
    if (p1 < AMBANG_SARAN_RUJUK && p2 < AMBANG_SARAN_RUJUK) out.push({ generus_id: g.id, nama: g.nama, bulan: [b2, b1], persen: [p2, p1] })
  }
  return out
}

/** Tutup kartu saran untuk anak itu bulan ini (lokal HP). */
export function tutupSaranRujuk(db: Db, generusId: string, tanggal: string = tanggalHariIni()): void {
  aturMeta(db, metaTutupSaran(generusId, tanggal.slice(0, 7)), '1')
}

// =====================================================================================================================
// Hubungi BK (orang tua & generus Remaja/Pra Nikah) — tanpa rekaman
// =====================================================================================================================

export interface KontakBkTingkat {
  tingkat: 'kelompok' | 'desa' | 'daerah'
  wilayah_id: string
  nama: string
  nomor: string
}

/** Profil yang melihat tombol Hubungi BK: wali, dan generus jenjang Remaja & Pra Nikah. */
export function bolehHubungiBk(db: Db, p: Pick<Profil, 'role' | 'generus_ids'>): boolean {
  if (p.role === 'wali') return true
  if (p.role !== 'generus') return false
  return p.generus_ids.some((id) => {
    const k = ambilGenerus(db, id)?.kategori
    return k === 'remaja' || k === 'pranikah'
  })
}

/** BK Kelompok / Desa / Daerah yang punya nomor WA untuk kelompok ini (dari kontak bertanda tangan daerah). */
export function kontakBkUntuk(db: Db, kelompokId: string): KontakBkTingkat[] {
  const k = ambilKontakBk(db)
  if (!k) return []
  const out: KontakBkTingkat[] = []
  for (const id of [kelompokId, ...leluhurWilayah(db, kelompokId)]) {
    const w = ambilWilayah(db, id)
    const nomor = k.kontak[id]?.[0]
    if (w && nomor) out.push({ tingkat: w.tingkat, wilayah_id: id, nama: w.nama, nomor })
  }
  return out
}

/** Kalimat pembuka WA ke BK (tanpa data anak; orang tua/generus menulis sendiri). */
export function kalimatPembukaBk(peran: 'wali' | 'generus'): string {
  return peran === 'wali'
    ? "Assalamu'alaikum, saya orang tua generus. Saya ingin berkonsultasi dengan BK PPG. Apakah ada waktu?"
    : "Assalamu'alaikum, saya generus PPG. Saya ingin bercerita/berkonsultasi dengan BK. Apakah ada waktu?"
}

/** Tautan wa.me ke BK dengan kalimat pembuka. */
export function tautanHubungiBk(nomor: string, peran: 'wali' | 'generus'): string {
  return `https://wa.me/${nomor.replace(/\D/g, '')}?text=${encodeURIComponent(kalimatPembukaBk(peran))}`
}

// =====================================================================================================================
// M08 — masa simpan konseling & rujukan Selesai
// =====================================================================================================================

const tambahBulan = (tanggal: string, n: number) => {
  const d = new Date(Date.UTC(Number(tanggal.slice(0, 4)), Number(tanggal.slice(5, 7)) - 1 + n, Number(tanggal.slice(8, 10))))
  return d.toISOString().slice(0, 10)
}

export interface HasilBersihkan {
  dihapus: number
  dibersihkanLokal: number
}

/**
 * §21.5 M08 (J-BJ11): catatan konseling dan rujukan Selesai yang lebih tua dari masa simpan dihapus.
 * HP BK: catatan milik BK sendiri (konseling, status) → hapus lunak + isi dikosongkan, tanda hapus ikut Setor; rujukan milik
 * perujuk → isi dikosongkan lokal. EXE Daerah: semua salinan (kolom tanggal & status terbuka) → turun lewat PAKET.
 */
export function bersihkanKonseling(db: Db, o: { tanggal?: string; kunciAdmin?: KunciAdmin } = {}): HasilBersihkan {
  const hari = o.tanggal ?? tanggalHariIni()
  const batas = tambahBulan(hari, -nilaiKebijakan(db, 'simpan_konseling').bulan)
  const daerah = adalahAdmin(db)
  const saya = daerah ? 'ADMIN' : idPerangkatLokal(db)
  // semua profil pengurus (juga yang kedaluwarsa/dicabut): menghapus data lama tetap kewajiban HP BK
  const wilBk = new Set(
    daftarProfil(db, 'pengurus')
      .flatMap((p) => penugasanProfil(p))
      .filter((x) => x.jabatan === 'bk')
      .map((x) => x.wilayah_id),
  )
  if (!daerah && !wilBk.size) return { dihapus: 0, dibersihkanLokal: 0 }
  const st = petaStatus(db)
  const hasil: HasilBersihkan = { dihapus: 0, dibersihkanLokal: 0 }
  const calon = db.kueri<Rekaman>(`SELECT * FROM catatan_bidang WHERE dihapus = 0 AND bidang = 'konseling'`)
  return db.transaksi(() => {
    for (const c of calon) {
      const id = String(c.id)
      let kedaluwarsa = false
      if (c.jenis === 'konseling') kedaluwarsa = String(c.tanggal) < batas
      else if (c.jenis === 'rujukan') {
        const s = st.get(id)
        kedaluwarsa = s?.status === 'selesai' && s.tanggal < batas
      }
      // status rujukan (terbuka, tanpa isi) tidak dihapus: penanda Selesai untuk salinan lain
      if (!kedaluwarsa) continue
      if (!daerah && !wilBk.has(String(c.wilayah_id))) continue
      if (daerah || c.perangkat_id === saya) {
        ubahRekaman(db, 'catatan_bidang', id, { dihapus: 1, isi_rahasia: null, isi_json: null })
        hasil.dihapus++
      } else {
        // rujukan perujuk: dikosongkan di HP ini saja (tidak dikirim; perujuk/daerah menghapus salinannya sendiri)
        db.jalankan(`UPDATE catatan_bidang SET isi_rahasia = NULL, dihapus = 1, versi = versi + 1, diubah_pada = ? WHERE id = ?`, [sekarangIso(), id])
        hasil.dibersihkanLokal++
      }
    }
    return hasil
  })
}

/** Apakah HP ini memegang kunci baca konseling wilayah itu (BK). */
export function adalahBkWilayah(db: Db, wilayahId: string): boolean {
  return bisaBacaBidang(db, 'konseling', wilayahId)
}
