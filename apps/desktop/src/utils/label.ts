// Label tampilan Bahasa Indonesia untuk nilai kode dari @ppg/core.
import { adalahGalatPpg } from '@ppg/core'

export const LABEL_TINGKAT: Record<string, string> = { daerah: 'Daerah', desa: 'Desa', kelompok: 'Kelompok' }
export const LABEL_KATEGORI: Record<string, string> = {
  paud: 'PAUD',
  caberawit: 'Caberawit',
  praremaja: 'Praremaja',
  remaja: 'Remaja',
  pranikah: 'Pranikah',
}
export const LABEL_STATUS_GENERUS: Record<string, string> = {
  aktif: 'Aktif',
  mondok: 'Mondok',
  pindah: 'Pindah',
  lulus_menikah: 'Lulus/Menikah',
  keluar: 'Keluar',
}
export const LABEL_ROLE: Record<string, string> = { pengurus: 'Pengurus', mubaligh: 'Mubaligh', generus: 'Generus', wali: 'Wali' }
export const LABEL_HAK: Record<string, string> = {
  catat: 'Mencatat kegiatan',
  lihat: 'Melihat data',
  sahkan: 'Mengesahkan kemajuan',
  terbit_generus: 'Menerbitkan token generus/wali',
  setor_belajar: 'Setor belajar',
}
export const LABEL_STATUS_PERANGKAT: Record<string, string> = {
  aktif: 'Aktif',
  dibekukan: 'Dibekukan',
  dicabut: 'Dicabut',
  kedaluwarsa: 'Kedaluwarsa',
}
export const LABEL_JENIS_USULAN: Record<string, string> = {
  tambah_generus: 'Tambah generus',
  ubah_generus: 'Ubah data generus',
  tambah_jamaah: 'Tambah jamaah',
  pindah_kelompok: 'Pindah kelompok',
  ubah_status: 'Ubah status generus',
}
export const LABEL_STATUS_USULAN: Record<string, string> = { menunggu: 'Menunggu', disetujui: 'Disetujui', ditolak: 'Ditolak' }
export const LABEL_PRESENSI: Record<string, string> = { hadir: 'Hadir', izin: 'Izin', sakit: 'Sakit', alpa: 'Alpa' }
export const LABEL_TIPE_MATERI: Record<string, string> = { hafalan: 'Hafalan', checklist: 'Checklist', level: 'Level' }
export const LABEL_TABEL: Record<string, string> = {
  presensi: 'Presensi',
  kemajuan_belajar: 'Kemajuan belajar',
  penilaian_akhlaq: 'Penilaian akhlaq',
  jadwal_tambahan: 'Jadwal tambahan',
  usulan: 'Usulan',
}
export const NAMA_HARI = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu']

export function label(peta: Record<string, string>, nilai: string | null | undefined): string {
  if (!nilai) return '—'
  return peta[nilai] ?? nilai
}

/** Pesan galat yang ramah untuk ditampilkan. */
export function pesanGalat(e: unknown): string {
  if (adalahGalatPpg(e)) return e.pesan
  if (e instanceof Error) return e.message
  return String(e)
}

/** Tanggal & jam ISO → teks lokal ringkas. */
export function waktuLokal(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** 'YYYY-MM-DD' → '14 Nov 2026'. */
export function tanggalLokal(t: string | null | undefined): string {
  if (!t) return '—'
  const [y, m, d] = t.split('-').map(Number)
  if (!y || !m || !d) return t
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
