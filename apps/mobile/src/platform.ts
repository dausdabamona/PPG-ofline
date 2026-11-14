// Lapisan platform HP: semua akses ke Capacitor (berkas, bagikan, latar belakang, intent) lewat antarmuka ini,
// sehingga aplikasi bisa dijalankan & diuji di peramban biasa (platformWeb) dan di uji jsdom (platform palsu).
import type { OpsiSqlJs } from '@ppg/core'

export interface BerkasMasuk {
  nama?: string
  bytes: Uint8Array
}

export interface BerkasKirim {
  nama: string
  bytes: Uint8Array
}

export interface Platform {
  /** 'native' = APK (Capacitor), 'web' = peramban. */
  jenis: 'native' | 'web'
  opsiSqlJs(): Promise<OpsiSqlJs>
  /** Database tersimpan (IndexedDB) atau null bila pertama kali. */
  muatDb(): Promise<Uint8Array | null>
  simpanDb(bytes: Uint8Array): Promise<void>
  /** Daftarkan fungsi yang dipanggil saat aplikasi ke latar belakang. Mengembalikan pelepas. */
  saatLatarBelakang(fn: () => void): () => void
  /** Pilih berkas dari HP (bisa banyak). Kosong bila dibatalkan. */
  pilihBerkas(opsi?: { banyak?: boolean; terima?: string }): Promise<BerkasMasuk[]>
  /** Berkas yang dibuka dari aplikasi lain (WA → "Buka dengan PPG Sorong"). Mengembalikan pelepas. */
  saatBerkasMasuk(fn: (b: BerkasMasuk) => void): () => void
  /** Kirim berkas lewat lembar bagikan (WA, dsb.). Peramban: diunduh. */
  bagikanBerkas(daftar: BerkasKirim[], judul?: string): Promise<void>
  /** Kirim teks lewat lembar bagikan (WA). Peramban: disalin bila tidak ada Web Share. */
  bagikanTeks(teks: string, judul?: string): Promise<void>
  /** Buka tautan di aplikasi luar (wa.me → WhatsApp). */
  bukaTautan(url: string): void
  /** Tampilkan PDF (native: dibagikan ke aplikasi pembaca PDF; peramban: tab baru). */
  bukaPdf(nama: string, bytes: Uint8Array): Promise<void>
  salinTeks(teks: string): Promise<void>
}

const KUNCI_DB = 'ppg-hp-db'

async function salinKePapan(teks: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(teks)
      return
    } catch {
      // jatuh ke cara lama
    }
  }
  const ta = document.createElement('textarea')
  ta.value = teks
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  ta.remove()
}

/** Pemilih berkas lewat <input type=file multiple> (dipakai web & native). */
function pilihLewatInput(opsi: { banyak?: boolean; terima?: string } = {}): Promise<BerkasMasuk[]> {
  return new Promise((selesai) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = opsi.banyak ?? true
    if (opsi.terima) input.accept = opsi.terima
    input.style.display = 'none'
    let sudah = false
    const akhiri = (d: BerkasMasuk[]) => {
      if (sudah) return
      sudah = true
      input.remove()
      selesai(d)
    }
    input.onchange = async () => {
      const daftar = await Promise.all(
        [...(input.files ?? [])].map(async (f) => ({ nama: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })),
      )
      akhiri(daftar)
    }
    input.addEventListener('cancel', () => akhiri([]))
    document.body.appendChild(input)
    input.click()
  })
}

function unduh(nama: string, bytes: Uint8Array): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart]))
  const a = document.createElement('a')
  a.href = url
  a.download = nama
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function keB64(b: Uint8Array): string {
  let s = ''
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return btoa(s)
}

function dariB64(t: string): Uint8Array {
  const s = atob(t)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

async function penyimpananIdb() {
  const { get, set } = await import('idb-keyval')
  return {
    muat: async () => {
      const v = await get<Uint8Array | ArrayBuffer>(KUNCI_DB)
      if (!v) return null
      return v instanceof Uint8Array ? v : new Uint8Array(v)
    },
    simpan: (b: Uint8Array) => set(KUNCI_DB, new Uint8Array(b)),
  }
}

/** Platform peramban biasa: IndexedDB, <input type=file>, unduhan, Web Share bila ada. */
export function platformWeb(urlWasm: string): Platform {
  return {
    jenis: 'web',
    opsiSqlJs: async () => ({ locateFile: () => urlWasm }),
    muatDb: async () => (await penyimpananIdb()).muat(),
    simpanDb: async (b) => (await penyimpananIdb()).simpan(b),
    saatLatarBelakang(fn) {
      const f = () => {
        if (document.visibilityState === 'hidden') fn()
      }
      document.addEventListener('visibilitychange', f)
      window.addEventListener('pagehide', fn)
      return () => {
        document.removeEventListener('visibilitychange', f)
        window.removeEventListener('pagehide', fn)
      }
    },
    pilihBerkas: pilihLewatInput,
    saatBerkasMasuk: () => () => undefined,
    async bagikanBerkas(daftar) {
      for (const b of daftar) unduh(b.nama, b.bytes)
    },
    async bagikanTeks(teks, judul) {
      if (navigator.share) {
        try {
          await navigator.share({ title: judul, text: teks })
          return
        } catch {
          // dibatalkan / tidak didukung → salin
        }
      }
      await salinKePapan(teks)
    },
    bukaTautan(url) {
      window.open(url, '_blank', 'noopener')
    },
    async bukaPdf(_nama, bytes) {
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    },
    salinTeks: salinKePapan,
  }
}

/**
 * Platform APK (Capacitor): berkas keluar ditulis ke folder Cache lalu dibagikan (Share → WA);
 * berkas masuk dari intent VIEW/SEND (`appUrlOpen` / `getLaunchUrl`) dibaca dengan Filesystem.
 */
export async function platformNative(urlWasm: string): Promise<Platform> {
  const [{ Filesystem, Directory }, { Share }, { App }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
    import('@capacitor/app'),
  ])
  const web = platformWeb(urlWasm)

  const tulisCache = async (nama: string, bytes: Uint8Array) => {
    const r = await Filesystem.writeFile({ path: nama, data: keB64(bytes), directory: Directory.Cache, recursive: true })
    return r.uri
  }
  const bacaUri = async (uri: string): Promise<BerkasMasuk> => {
    const r = await Filesystem.readFile({ path: uri })
    const data = typeof r.data === 'string' ? dariB64(r.data) : new Uint8Array(await r.data.arrayBuffer())
    const potong = decodeURIComponent(uri.split('?')[0] ?? '').split('/').pop() ?? ''
    return { nama: /\.ppg$/i.test(potong) ? potong : undefined, bytes: data }
  }

  return {
    ...web,
    jenis: 'native',
    saatLatarBelakang(fn) {
      const h = App.addListener('appStateChange', (s) => {
        if (!s.isActive) fn()
      })
      const lepasWeb = web.saatLatarBelakang(fn)
      return () => {
        void h.then((x) => x.remove())
        lepasWeb()
      }
    },
    saatBerkasMasuk(fn) {
      let aktif = true
      const terima = async (url: string | undefined) => {
        if (!aktif || !url || !/^(content|file):/i.test(url)) return
        try {
          fn(await bacaUri(url))
        } catch {
          // berkas tidak bisa dibaca — diabaikan (pengguna bisa memakai tombol Buka Berkas)
        }
      }
      void App.getLaunchUrl().then((r) => terima(r?.url))
      const h = App.addListener('appUrlOpen', (e) => void terima(e.url))
      return () => {
        aktif = false
        void h.then((x) => x.remove())
      }
    },
    async bagikanBerkas(daftar, judul) {
      const files: string[] = []
      for (const b of daftar) files.push(await tulisCache(b.nama, b.bytes))
      try {
        await Share.share({ title: judul ?? daftar[0]?.nama, files, dialogTitle: judul ?? 'Kirim lewat WA' })
      } catch (e) {
        // pengguna menutup lembar bagikan → bukan galat
        if (!/cancel/i.test(String((e as Error)?.message ?? e))) throw e
      }
    },
    async bagikanTeks(teks, judul) {
      try {
        await Share.share({ title: judul, text: teks, dialogTitle: judul ?? 'Kirim lewat WA' })
      } catch (e) {
        if (!/cancel/i.test(String((e as Error)?.message ?? e))) throw e
      }
    },
    bukaTautan(url) {
      // Capacitor membuka URL di luar host aplikasi dengan aplikasi luar (wa.me → WhatsApp).
      window.location.href = url
    },
    async bukaPdf(nama, bytes) {
      const uri = await tulisCache(nama.toLowerCase().endsWith('.pdf') ? nama : `${nama}.pdf`, bytes)
      await Share.share({ title: nama, files: [uri], dialogTitle: 'Buka PDF dengan…' })
    },
  }
}

/** Pilih platform: native bila berjalan di dalam APK Capacitor. */
export async function pilihPlatform(urlWasm: string): Promise<Platform> {
  const { Capacitor } = await import('@capacitor/core')
  return Capacitor.isNativePlatform() ? platformNative(urlWasm) : platformWeb(urlWasm)
}
