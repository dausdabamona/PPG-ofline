// Menu EXE v3 per peran instalasi (daerah / desa / kelompok / kurikulum).
import type { PeranExe } from './konteks'
import { LABEL_PERAN } from './utils/label'

export const MENU = {
  beranda: { teks: 'Beranda', ikon: '⌂' },
  absen: { teks: 'Absen Pertemuan', ikon: '✓' },
  wilayah: { teks: 'Wilayah', ikon: '▦' },
  generus: { teks: 'Generus & Jamaah', ikon: '☺' },
  pengajian: { teks: 'Pengajian', ikon: '◷' },
  materi: { teks: 'Materi', ikon: '❖' },
  target: { teks: 'Target Capaian', ikon: '◎' },
  perangkat: { teks: 'Perangkat & Token', ikon: '⚿' },
  jadwal: { teks: 'Jadwal Setor', ikon: '⏲' },
  impor: { teks: 'Impor Setoran', ikon: '⇩' },
  bukaPaket: { teks: 'Buka Paket', ikon: '⇲' },
  setor: { teks: 'Setor', ikon: '⇪' },
  usulan: { teks: 'Usulan', ikon: '✉' },
  koreksi: { teks: 'Koreksi', ikon: '✎' },
  paket: { teks: 'Kirim Paket', ikon: '⇧' },
  balasan: { teks: 'Kirim Balasan', ikon: '↩' },
  rekap: { teks: 'Rekap & Laporan', ikon: '▤' },
  evaluasi: { teks: 'Evaluasi & Keaktifan', ikon: '★' },
  materiEvaluasi: { teks: 'Materi Evaluasi', ikon: '☰' },
  kepengurusan: { teks: 'Kepengurusan', ikon: '♜' },
  pengaturan: { teks: 'Pengaturan', ikon: '⚙' },
} as const
export type KunciMenu = keyof typeof MENU

/** Menu tiap peran (urut tampil). */
export const MENU_PERAN: Record<PeranExe, KunciMenu[]> = {
  daerah: ['beranda', 'wilayah', 'generus', 'pengajian', 'materi', 'target', 'materiEvaluasi', 'perangkat', 'jadwal', 'impor', 'usulan', 'koreksi', 'paket', 'rekap', 'evaluasi', 'kepengurusan', 'pengaturan'],
  desa: ['beranda', 'setor', 'impor', 'bukaPaket', 'paket', 'balasan', 'perangkat', 'generus', 'rekap', 'evaluasi', 'kepengurusan', 'pengaturan'],
  kelompok: ['beranda', 'absen', 'impor', 'setor', 'bukaPaket', 'balasan', 'rekap', 'evaluasi', 'pengaturan'],
  kurikulum: ['beranda', 'materi', 'target', 'materiEvaluasi', 'bukaPaket', 'pengaturan'],
}

/** Teks menu sesuai peran (mis. "Setor ke Daerah", "Buka Berkas Materi"). */
export function teksMenu(k: KunciMenu, peran: PeranExe): string {
  if (k === 'setor') return peran === 'kelompok' ? 'Setor ke Desa' : 'Setor ke Daerah'
  if (k === 'bukaPaket' && peran === 'kurikulum') return 'Buka Berkas Materi'
  if (k === 'generus' && peran === 'desa') return 'Generus & Data'
  return MENU[k].teks
}


/** "Admin Desa · Klasaman" — nama peran & wilayah untuk kepala aplikasi. */
export function judulPeran(peran: PeranExe, wilayahNama: string | null): string {
  return `${LABEL_PERAN[peran]}${wilayahNama ? ` · ${wilayahNama}` : ''}`
}
