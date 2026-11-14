// Konteks aplikasi HP: database, platform, profil aktif, toast, dan pembantu aksi (buka/kirim berkas).
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Db, HasilImporBanyak, Profil } from '@ppg/core'
import type { BerkasKirim, BerkasMasuk, Platform } from './platform'
import { pesanGalat } from './utils/label'

export type JenisToast = 'sukses' | 'galat' | 'info'
export interface Toast {
  id: number
  jenis: JenisToast
  pesan: string
}

export type Tujuan = 'pilih' | 'tambah' | 'akun' | 'utama'

export interface NilaiApp {
  db: Db
  platform: Platform
  /** Naik setiap database berubah — dipakai sebagai dependensi pemuatan data. */
  versi: number
  profil: Profil
  toast: (jenis: JenisToast, pesan: string) => void
  /** Jalankan aksi; galat ditampilkan sebagai toast (hasil undefined), pesan sukses opsional. */
  aksi: <T>(fn: () => T | Promise<T>, pesanSukses?: string | ((h: T) => string)) => Promise<T | undefined>
  /** Buka berkas .ppg (satu atau banyak) dan tampilkan hasilnya dengan kalimat sederhana. */
  bukaBerkas: (daftar: BerkasMasuk[]) => Promise<HasilImporBanyak[]>
  /** Kirim berkas lewat lembar bagikan (WA). */
  kirimBerkas: (daftar: BerkasKirim | BerkasKirim[], pesanSukses?: string) => Promise<boolean>
  simpanSekarang: () => Promise<void>
  /** Ganti seluruh database (pulihkan cadangan HP). */
  gantiDb: (bytes: Uint8Array) => Promise<void>
  ke: (t: Tujuan) => void
}

const Konteks = createContext<NilaiApp | null>(null)

export function PenyediaApp(p: { nilai: NilaiApp; children: ReactNode }) {
  return <Konteks.Provider value={p.nilai}>{p.children}</Konteks.Provider>
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
      setDaftar((d) => [...d.slice(-3), { id, jenis, pesan }])
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
