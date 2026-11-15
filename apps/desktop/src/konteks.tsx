// Konteks aplikasi: database aktif, kunci admin (hanya di memori), platform, toast, dan pembantu aksi.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { adalahKunciExe, type Db, type KunciAdmin, type KunciPemegang } from '@ppg/core'
import type { Platform } from './platform'
import { pesanGalat } from './utils/label'

export type JenisToast = 'sukses' | 'galat' | 'info'
export interface Toast {
  id: number
  jenis: JenisToast
  pesan: string
}

/** Peran instalasi EXE yang sudah aktif. */
export type PeranExe = 'daerah' | 'desa' | 'kelompok' | 'kurikulum'

export interface NilaiApp {
  db: Db
  /** Daerah: KunciAdmin; EXE desa/kelompok/kurikulum: KunciExe. */
  kunci: KunciPemegang
  peran: PeranExe
  /** Wilayah instalasi (daerah: wilayah daerah pertama; desa/kelompok: wilayah token). */
  wilayahId: string | null
  wilayahNama: string | null
  platform: Platform
  /** Naik setiap database berubah — dipakai sebagai dependensi pemuatan data. */
  versi: number
  toast: (jenis: JenisToast, pesan: string) => void
  /**
   * Jalankan aksi; galat ditampilkan sebagai toast (dikembalikan undefined), sukses opsional ditoast.
   */
  aksi: <T>(fn: () => T | Promise<T>, pesanSukses?: string | ((h: T) => string)) => Promise<T | undefined>
  /** Simpan database sekarang (tanpa menunggu debounce). */
  simpanSekarang: () => Promise<void>
  /** Ganti seluruh database (pulihkan cadangan). */
  gantiDb: (db: Db, kunci: KunciPemegang) => Promise<void>
  /** Kunci aplikasi (kembali ke layar masuk). */
  kunciAplikasi: () => void
}

const Konteks = createContext<NilaiApp | null>(null)

export function PenyediaApp(p: { nilai: NilaiApp; children: ReactNode }) {
  return <Konteks.Provider value={p.nilai}>{p.children}</Konteks.Provider>
}

/** Kunci admin daerah (hanya di EXE daerah). */
export function kunciDaerah(k: KunciPemegang): KunciAdmin {
  if (adalahKunciExe(k)) throw new Error('Fitur ini hanya di EXE daerah.')
  return k
}

export function useApp(): NilaiApp {
  const k = useContext(Konteks)
  if (!k) throw new Error('useApp di luar PenyediaApp')
  return k
}

/** Pemuat data sinkron dari database: hasil + galat, dihitung ulang bila `versi` atau deps berubah. */
export function useData<T>(fn: () => T, deps: unknown[]): { data?: T; galat?: string } {
  const { versi } = useApp()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => {
    try {
      return { data: fn() }
    } catch (e) {
      return { galat: pesanGalat(e) }
    }
  }, [versi, ...deps])
}

/** Antrean toast. */
export function useToast(): { daftar: Toast[]; tambah: (jenis: JenisToast, pesan: string) => void; hapus: (id: number) => void } {
  const [daftar, setDaftar] = useState<Toast[]>([])
  const idRef = useRef(1)
  const hapus = useCallback((id: number) => setDaftar((d) => d.filter((t) => t.id !== id)), [])
  const tambah = useCallback(
    (jenis: JenisToast, pesan: string) => {
      const id = idRef.current++
      setDaftar((d) => [...d.slice(-4), { id, jenis, pesan }])
      setTimeout(() => hapus(id), jenis === 'galat' ? 9000 : 5000)
    },
    [hapus],
  )
  return { daftar, tambah, hapus }
}

export function DaftarToast(p: { daftar: Toast[]; hapus: (id: number) => void }) {
  return (
    <div className="wadah-toast" aria-live="polite">
      {p.daftar.map((t) => (
        <div key={t.id} className={`toast toast-${t.jenis}`} role={t.jenis === 'galat' ? 'alert' : 'status'}>
          <span>{t.pesan}</span>
          <button type="button" aria-label="Tutup pesan" onClick={() => p.hapus(t.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
