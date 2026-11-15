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
export const LABEL_ROLE: Record<string, string> = {
  pengurus: 'Pengurus',
  mubaligh: 'Mubaligh',
  generus: 'Generus',
  wali: 'Wali',
  admin: 'EXE Admin',
  kurikulum: 'EXE Kurikulum',
}

/** Label peran token dengan tingkat (EXE desa / EXE kelompok). */
export function labelRole(role: string, tingkat?: string | null): string {
  if (role === 'admin') return tingkat === 'kelompok' ? 'EXE Kelompok' : tingkat === 'desa' ? 'EXE Desa' : tingkat === 'daerah' ? 'Super Admin HP' : 'EXE Admin'
  return LABEL_ROLE[role] ?? role
}

/** Nama peran instalasi EXE untuk kepala aplikasi. */
export const LABEL_PERAN: Record<string, string> = {
  daerah: 'Admin Daerah',
  desa: 'Admin Desa',
  kelompok: 'Admin Kelompok',
  kurikulum: 'Tim Kurikulum',
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/** '2026-S1' → '2026-S1 (Juli–Desember 2026)', '2026-S2' → '2026-S2 (Januari–Juni 2027)'. */
export function labelPeriode(p: string): string {
  const m = /^(\d{4})-S([12])$/.exec(p)
  if (!m) return p
  const y = Number(m[1])
  return m[2] === '1' ? `${p} (Juli–Desember ${y})` : `${p} (Januari–Juni ${y + 1})`
}

/** Daftar periode di sekitar periode acuan: 2 sebelumnya … 2 sesudahnya. */
export function daftarPeriodeSekitar(acuan: string): string[] {
  const m = /^(\d{4})-S([12])$/.exec(acuan)
  if (!m) return [acuan]
  const idx = Number(m[1]) * 2 + (m[2] === '1' ? 0 : 1)
  const hasil: string[] = []
  for (let i = idx - 2; i <= idx + 2; i++) hasil.push(`${Math.floor(i / 2)}-S${i % 2 === 0 ? 1 : 2}`)
  return hasil
}

/** Uraian jadwal setor: 'Tiap Ahad pukul 21:00' / 'Tiap tanggal 5 pukul 12:00'. */
export function uraianJadwalSetor(j: { pola: string; hari: number | null; tanggal_bulan: number | null; jam: string | null } | null | undefined): string {
  if (!j) return 'Belum diatur'
  const jam = j.jam ?? '23:59'
  return j.pola === 'pekanan' ? `Tiap ${NAMA_HARI[Number(j.hari ?? 0)]} pukul ${jam}` : `Tiap tanggal ${j.tanggal_bulan} pukul ${jam}`
}

/** Tanggal ISO → 'Ahad, 22 Nov 2026 21.00'. */
export function waktuHari(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${NAMA_HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
}
export const LABEL_HAK: Record<string, string> = {
  catat: 'Mencatat kegiatan',
  lihat: 'Melihat data',
  sahkan: 'Mengesahkan kemajuan',
  terbit_generus: 'Menerbitkan token generus/wali',
  setor_belajar: 'Setor belajar',
  terbit_bawah: 'Menerbitkan kode aktivasi di wilayahnya',
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
  tambah_wilayah: 'Tambah wilayah',
  tambah_pengajian: 'Tambah pengajian',
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
  pertemuan: 'Pertemuan',
  bidang_materi: 'Bidang materi',
  kategori_materi: 'Kategori materi',
  materi: 'Materi',
  target_capaian: 'Target capaian',
  pengaturan: 'Pengaturan',
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
