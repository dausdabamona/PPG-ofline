// Lapisan platform: semua akses ke Electron (IPC) lewat antarmuka ini, sehingga renderer bisa diuji tanpa Electron.
import type { OpsiSqlJs } from '@ppg/core'
import type { ApiDesktop, BerkasDibuka, BerkasDisimpan, FilterBerkas } from '../electron/api'

export type { BerkasDibuka, BerkasDisimpan, FilterBerkas }

export interface Platform {
  muatDb(): Promise<Uint8Array | null>
  simpanDb(bytes: Uint8Array): Promise<void>
  bukaBanyak(filter: FilterBerkas[], banyak?: boolean): Promise<BerkasDibuka[]>
  /** Kembalikan path tersimpan, atau null bila pengguna membatalkan. */
  simpanBerkas(namaSaran: string, bytes: Uint8Array): Promise<string | null>
  simpanKeFolder(daftar: BerkasDisimpan[]): Promise<string | null>
  saatAkanTutup(fn: () => Promise<void>): void
  folderData(): Promise<string>
  salinTeks(teks: string): Promise<void>
  /** Opsi sql.js (lokasi wasm). */
  opsiSqlJs(): Promise<OpsiSqlJs>
}

declare global {
  interface Window {
    ppgAdmin?: ApiDesktop
  }
}

async function salinKePapan(teks: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(teks)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = teks
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  ta.remove()
}

/** Platform Electron (window.ppgAdmin dari preload). */
export function platformElectron(api: ApiDesktop, urlWasm: string): Platform {
  return {
    muatDb: () => api.muatDb(),
    simpanDb: (b) => api.simpanDb(b),
    bukaBanyak: (f, banyak) => api.bukaBanyak(f, banyak),
    simpanBerkas: (n, b) => api.simpanBerkas(n, b),
    simpanKeFolder: (d) => api.simpanKeFolder(d),
    saatAkanTutup: (fn) => api.saatAkanTutup(fn),
    folderData: () => api.folderData(),
    salinTeks: salinKePapan,
    opsiSqlJs: async () => ({ locateFile: () => urlWasm }),
  }
}

/**
 * Platform peramban biasa (tanpa Electron) — untuk uji di browser: database di localStorage (base64),
 * buka berkas lewat <input type=file>, simpan lewat unduhan.
 */
export function platformPeramban(urlWasm: string): Platform {
  const KUNCI = 'ppg-admin-db'
  const keB64 = (b: Uint8Array) => {
    let s = ''
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
    return btoa(s)
  }
  const dariB64 = (t: string) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0))
  const unduh = (nama: string, bytes: Uint8Array) => {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart]))
    const a = document.createElement('a')
    a.href = url
    a.download = nama
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }
  return {
    muatDb: async () => {
      const t = localStorage.getItem(KUNCI)
      return t ? dariB64(t) : null
    },
    simpanDb: async (b) => {
      try {
        localStorage.setItem(KUNCI, keB64(b))
      } catch {
        // kuota localStorage penuh — abaikan di mode uji peramban
      }
    },
    bukaBanyak: (filter, banyak = true) =>
      new Promise((selesai) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.multiple = banyak
        input.accept = filter.flatMap((f) => f.ekstensi.map((e) => `.${e}`)).join(',')
        input.onchange = async () => {
          const daftar = await Promise.all([...(input.files ?? [])].map(async (f) => ({ nama: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })))
          selesai(daftar)
        }
        input.click()
      }),
    simpanBerkas: async (nama, bytes) => {
      unduh(nama, bytes)
      return nama
    },
    simpanKeFolder: async (daftar) => {
      for (const b of daftar) unduh(b.nama, b.bytes)
      return 'Unduhan'
    },
    saatAkanTutup: (fn) => {
      window.addEventListener('beforeunload', () => void fn())
    },
    folderData: async () => 'localStorage (mode peramban)',
    salinTeks: salinKePapan,
    opsiSqlJs: async () => ({ locateFile: () => urlWasm }),
  }
}
