// Konteks mode Super Admin HP (Fase 9): database Super Admin (terpisah dari profil biasa), kunci perangkat yang
// sudah dibuka dengan kata sandi, toast, dan pembantu aksi (kirim/buka berkas).
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { Db, HasilImporBanyak, KunciExe, Profil } from '@ppg/core'
import type { JenisToast } from './konteks'
import type { BerkasKirim, BerkasMasuk, Platform } from './platform'
import { pesanGalat } from './utils/label'

export interface NilaiSuper {
  db: Db
  kunci: KunciExe
  platform: Platform
  /** Profil token Super Admin HP (role admin tingkat daerah). */
  profil: Profil
  versi: number
  toast: (jenis: JenisToast, pesan: string) => void
  aksi: <T>(fn: () => T | Promise<T>, pesanSukses?: string | ((h: T) => string)) => Promise<T | undefined>
  kirimBerkas: (daftar: BerkasKirim | BerkasKirim[], pesanSukses?: string) => Promise<boolean>
  bukaBerkas: (daftar: BerkasMasuk[]) => Promise<HasilImporBanyak[]>
  simpanSekarang: () => Promise<void>
  /** Kunci sekarang (sandi wajib untuk masuk lagi). */
  kunciSekarang: () => void
  /** Kembali ke profil HP biasa (Super Admin dikunci). */
  keluar: () => void
  /** Ganti seluruh database Super Admin (pulihkan cadangan). */
  gantiDb: (bytes: Uint8Array) => Promise<void>
}

const Konteks = createContext<NilaiSuper | null>(null)

export function PenyediaSuper(p: { nilai: NilaiSuper; children: ReactNode }) {
  return <Konteks.Provider value={p.nilai}>{p.children}</Konteks.Provider>
}

export function useSuper(): NilaiSuper {
  const k = useContext(Konteks)
  if (!k) throw new Error('useSuper di luar PenyediaSuper')
  return k
}

/** Pemuat data dari database Super Admin; dihitung ulang bila database berubah. */
export function useDataSuper<T>(fn: () => T, deps: unknown[]): { data?: T; galat?: string } {
  const { versi } = useSuper()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => {
    try {
      return { data: fn() }
    } catch (e) {
      return { galat: pesanGalat(e) }
    }
  }, [versi, ...deps])
}
