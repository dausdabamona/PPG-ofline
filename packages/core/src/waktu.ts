// Utilitas waktu. Semua cap waktu disimpan ISO-8601 UTC; tanggal kalender 'YYYY-MM-DD' (waktu lokal perangkat).

let sumberJam: (() => Date) | null = null

/** Ganti sumber jam (untuk pengujian). `null` = kembali ke jam sistem. */
export function aturJam(fn: (() => Date) | null): void {
  sumberJam = fn
}

/** Waktu sekarang sebagai Date (menghormati aturJam). */
export function sekarang(): Date {
  return sumberJam ? sumberJam() : new Date()
}

/** Cap waktu sekarang ISO-8601 UTC, mis. 2026-11-14T03:00:00.000Z. */
export function sekarangIso(): string {
  return sekarang().toISOString()
}

function dua(n: number): string {
  return String(n).padStart(2, '0')
}

/** Tanggal kalender lokal dari Date. */
export function tanggalLokal(d: Date): string {
  return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`
}

/** Tanggal hari ini (lokal) 'YYYY-MM-DD'. */
export function tanggalHariIni(): string {
  return tanggalLokal(sekarang())
}

/** Tanggal lokal dari cap waktu ISO. */
export function tanggalDariIso(iso: string): string {
  return tanggalLokal(new Date(iso))
}

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/

/** Apakah teks berbentuk tanggal valid 'YYYY-MM-DD'. */
export function tanggalSah(t: unknown): t is string {
  if (typeof t !== 'string' || !POLA_TANGGAL.test(t)) return false
  const d = new Date(t + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t
}

function keUtc(tanggal: string): Date {
  if (!tanggalSah(tanggal)) throw new Error(`Tanggal tidak sah: ${tanggal}`)
  return new Date(tanggal + 'T00:00:00Z')
}

/** Tambah n hari ke tanggal 'YYYY-MM-DD'. */
export function tambahHari(tanggal: string, n: number): string {
  const d = keUtc(tanggal)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Hari dalam pekan: 0 = Ahad … 6 = Sabtu. */
export function hariDalamPekan(tanggal: string): number {
  return keUtc(tanggal).getUTCDay()
}

/** Tanggal Ahad awal pekan yang memuat `tanggal`. */
export function awalPekan(tanggal: string): string {
  return tambahHari(tanggal, -hariDalamPekan(tanggal))
}

/** Tanggal Sabtu akhir pekan yang memuat `tanggal`. */
export function akhirPekan(tanggal: string): string {
  return tambahHari(awalPekan(tanggal), 6)
}

/** Tambah n hari ke cap waktu ISO. */
export function tambahHariIso(iso: string, n: number): string {
  return new Date(new Date(iso).getTime() + n * 86_400_000).toISOString()
}

/** Selisih hari (b − a) antara dua tanggal kalender. */
export function selisihHari(a: string, b: string): number {
  return Math.round((keUtc(b).getTime() - keUtc(a).getTime()) / 86_400_000)
}

/** 'YYYYMMDD' untuk nama berkas. */
export function tanggalRingkas(tanggal: string = tanggalHariIni()): string {
  return tanggal.replace(/-/g, '')
}

/** Umur (tahun penuh) pada tanggal acuan. */
export function umurPada(tanggalLahir: string, acuan: string = tanggalHariIni()): number {
  const [ly, lm, ld] = tanggalLahir.split('-').map(Number) as [number, number, number]
  const [ay, am, ad] = acuan.split('-').map(Number) as [number, number, number]
  let u = ay - ly
  if (am < lm || (am === lm && ad < ld)) u--
  return u
}

const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/** Format tanggal singkat Indonesia: '8 Nov 2026'. */
export function formatTanggal(tanggal: string): string {
  const [y, m, d] = tanggal.split('-').map(Number) as [number, number, number]
  return `${d} ${NAMA_BULAN[m - 1]} ${y}`
}
