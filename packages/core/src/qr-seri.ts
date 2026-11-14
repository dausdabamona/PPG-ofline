// QR berseri: teks panjang (token generus/wali ±3,7 KB) dipecah ke beberapa QR yang ditampilkan bergantian,
// lalu dikumpulkan kembali oleh pemindai. Format tiap bagian: `PPGQ1|<id>|<ke>/<dari>|<potongan>`.
// Teks pendek (≤ batas) tetap satu QR apa adanya agar pemindai lama tetap bisa membacanya.
import { byteAcak } from './crypto'
import { GalatPpg } from './galat'

export const AWALAN_QR_SERI = 'PPGQ1|'
/** Panjang maksimum satu bagian (termasuk kepala). ±800 karakter → QR versi 20 (97×97), masih mudah dipindai kamera HP. */
export const MAKS_BAGIAN_QR = 800

const HURUF_ID = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function idAcak(): string {
  return [...byteAcak(8)].map((b) => HURUF_ID[b % HURUF_ID.length]).join('')
}

export interface BagianQr {
  id: string
  /** Nomor bagian, mulai 1. */
  ke: number
  dari: number
  isi: string
}

/** Pecah teks menjadi daftar isi QR. Teks yang muat satu QR dikembalikan apa adanya (satu elemen). */
export function pecahQr(teks: string, o: { maks?: number; id?: string } = {}): string[] {
  const maks = o.maks ?? MAKS_BAGIAN_QR
  if (teks.length <= maks && !teks.startsWith(AWALAN_QR_SERI)) return [teks]
  const id = o.id ?? idAcak()
  // kepala terpanjang: PPGQ1|id|999/999|
  const kepala = AWALAN_QR_SERI.length + id.length + 1 + 7 + 1
  const ukuran = Math.max(1, maks - kepala)
  const dari = Math.ceil(teks.length / ukuran)
  if (dari > 999) throw new GalatPpg('QR_TERLALU_PANJANG', 'Teks terlalu panjang untuk QR berseri.')
  const hasil: string[] = []
  for (let i = 0; i < dari; i++) hasil.push(`${AWALAN_QR_SERI}${id}|${i + 1}/${dari}|${teks.slice(i * ukuran, (i + 1) * ukuran)}`)
  return hasil
}

/** Urai satu isi QR berseri; null bila bukan bagian QR berseri yang sah. */
export function uraiBagianQr(teks: string): BagianQr | null {
  if (!teks.startsWith(AWALAN_QR_SERI)) return null
  const sisa = teks.slice(AWALAN_QR_SERI.length)
  const a = sisa.indexOf('|')
  const b = a < 0 ? -1 : sisa.indexOf('|', a + 1)
  if (a <= 0 || b < 0) return null
  const id = sisa.slice(0, a)
  const m = /^(\d{1,3})\/(\d{1,3})$/.exec(sisa.slice(a + 1, b))
  if (!m) return null
  const ke = Number(m[1])
  const dari = Number(m[2])
  if (ke < 1 || dari < 1 || ke > dari) return null
  return { id, ke, dari, isi: sisa.slice(b + 1) }
}

/** Susun teks utuh dari bagian-bagian (urutan bebas, boleh ganda). Teks biasa (bukan seri) dikembalikan apa adanya. */
export function susunQr(daftar: string[]): string {
  const bersih = daftar.map((x) => x.trim()).filter(Boolean)
  if (bersih.length === 1 && !bersih[0]!.startsWith(AWALAN_QR_SERI)) return bersih[0]!
  let p = pengumpulQrBaru()
  let r: HasilTambahQr | null = null
  for (const x of bersih) {
    const u = uraiBagianQr(x)
    if (!u) throw new GalatPpg('QR_TIDAK_SAH', 'Ada bagian QR yang rusak atau bukan milik PPG.')
    if (p.id && u.id !== p.id) throw new GalatPpg('QR_CAMPUR', 'Bagian QR berasal dari token yang berbeda.')
    r = tambahBagianQr(p, x)
    p = r.pengumpul
  }
  if (!r || r.status !== 'lengkap' || r.hasil === undefined) {
    throw new GalatPpg('QR_BELUM_LENGKAP', `QR belum lengkap: ${r?.terbaca ?? 0} dari ${r?.total ?? '?'} bagian terbaca.`)
  }
  return r.hasil
}

/** Keadaan pemindai yang sedang mengumpulkan bagian (aman disimpan di state React — tidak diubah di tempat). */
export interface PengumpulQr {
  id: string | null
  dari: number
  bagian: Record<number, string>
}

export function pengumpulQrBaru(): PengumpulQr {
  return { id: null, dari: 0, bagian: {} }
}

export interface HasilTambahQr {
  pengumpul: PengumpulQr
  /** tunggal = QR biasa (langsung selesai); bagian = belum lengkap; lengkap = semua bagian terkumpul; bukan = isi rusak. */
  status: 'tunggal' | 'bagian' | 'lengkap' | 'bukan'
  terbaca: number
  total: number
  hasil?: string
}

/** Tambahkan satu hasil pindai ke pengumpul. Bagian dari seri lain (id berbeda) memulai pengumpulan baru. */
export function tambahBagianQr(p: PengumpulQr, teks: string): HasilTambahQr {
  const t = teks.trim()
  if (!t.startsWith(AWALAN_QR_SERI)) return { pengumpul: p, status: 'tunggal', terbaca: 1, total: 1, hasil: t }
  const u = uraiBagianQr(t)
  const jumlah = (x: PengumpulQr) => Object.keys(x.bagian).length
  if (!u) return { pengumpul: p, status: 'bukan', terbaca: jumlah(p), total: p.dari }
  const dasar = p.id === u.id && p.dari === u.dari ? p : { id: u.id, dari: u.dari, bagian: {} }
  const baru: PengumpulQr = { ...dasar, bagian: { ...dasar.bagian, [u.ke]: u.isi } }
  const terbaca = jumlah(baru)
  if (terbaca < baru.dari) return { pengumpul: baru, status: 'bagian', terbaca, total: baru.dari }
  let hasil = ''
  for (let i = 1; i <= baru.dari; i++) hasil += baru.bagian[i]
  return { pengumpul: baru, status: 'lengkap', terbaca, total: baru.dari, hasil }
}
