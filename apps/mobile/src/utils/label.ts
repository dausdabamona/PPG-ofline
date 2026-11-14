// Label tampilan Bahasa Indonesia sederhana untuk nilai kode dari @ppg/core, dan pesan hasil membuka berkas.
import { adalahGalatPpg, formatTanggal, type HasilImporBanyak } from '@ppg/core'

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
export const LABEL_ROLE: Record<string, string> = { pengurus: 'Pengurus', mubaligh: 'Mubaligh', generus: 'Generus', wali: 'Wali (orang tua)' }
export const LABEL_STATUS_TOKEN: Record<string, string> = { aktif: 'Aktif', dibekukan: 'Dibekukan', dicabut: 'Dicabut', kedaluwarsa: 'Habis masa' }
export const LABEL_PRESENSI: Record<string, string> = { hadir: 'Hadir', izin: 'Izin', sakit: 'Sakit', alpa: 'Alpa' }
export const LABEL_STATUS_MATERI: Record<string, string> = {
  belum: 'Belum',
  diajukan: 'Menunggu disimak',
  ditolak: 'Perlu diulang',
  sedang: 'Sedang belajar',
  selesai: 'Selesai',
}
export const WARNA_STATUS_MATERI: Record<string, 'abu' | 'kuning' | 'merah' | 'teal' | 'hijau'> = {
  belum: 'abu',
  diajukan: 'kuning',
  ditolak: 'merah',
  sedang: 'teal',
  selesai: 'hijau',
}
export const LABEL_STATUS_USULAN: Record<string, string> = { menunggu: 'Menunggu admin', disetujui: 'Disetujui', ditolak: 'Ditolak' }
export const LABEL_JENIS_USULAN: Record<string, string> = {
  tambah_generus: 'Generus baru',
  ubah_generus: 'Ubah data generus',
  tambah_jamaah: 'Jamaah baru',
  pindah_kelompok: 'Pindah kelompok',
  ubah_status: 'Ubah status',
}
export const LABEL_TIPE_MATERI: Record<string, string> = { hafalan: 'Hafalan', checklist: 'Centang', level: 'Tingkat 1–5' }

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

/** 'YYYY-MM-DD' → '14 November 2026'. */
export function tanggalTeks(t: string | null | undefined): string {
  if (!t) return '—'
  try {
    return formatTanggal(t.slice(0, 10))
  } catch {
    return t
  }
}

/** ISO → '14 November 2026 pukul 10.15'. */
export function waktuTeks(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const tgl = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return `${tanggalTeks(tgl)} pukul ${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
}

const NAMA_JENIS: Record<string, string> = {
  PAKET: 'Data dari admin',
  BALASAN: 'Balasan dari mubaligh',
  JADWAL: 'Jadwal kelompok',
  MATERI: 'Daftar materi',
  BELAJAR: 'Setoran belajar',
  SETOR: 'Setoran data',
}

/** Kalimat hasil membuka satu berkas, untuk orang awam. */
export function pesanHasilBerkas(h: HasilImporBanyak): { sukses: boolean; teks: string } {
  const nama = h.nama ? `“${h.nama}”` : 'Berkas'
  if (!h.berhasil || !h.ringkasan) {
    const kode = h.galat?.kode ?? ''
    if (kode === 'BERKAS_TIDAK_SAH') {
      return { sukses: false, teks: `${nama} bukan berkas PPG atau rusak.` }
    }
    return { sukses: false, teks: `${nama} tidak bisa dibuka: ${h.galat?.pesan ?? 'galat tidak dikenal.'}` }
  }
  const r = h.ringkasan as unknown as Record<string, unknown>
  const jenis = NAMA_JENIS[h.jenis ?? ''] ?? 'Berkas'
  if (r.sudahPernah) return { sukses: true, teks: `${jenis} ini sudah pernah dibuka sebelumnya.` }
  const bagian: string[] = []
  if (h.jenis === 'BELAJAR') {
    const hasil = r.hasil as { ditambah: number; diperbarui: number; ditolak: unknown[] } | undefined
    const n = (hasil?.ditambah ?? 0) + (hasil?.diperbarui ?? 0)
    bagian.push(`${jenis} diterima: ${n} catatan baru menunggu disahkan.`)
    if (hasil?.ditolak?.length) bagian.push(`${hasil.ditolak.length} catatan tidak diterima.`)
  } else {
    const total = r.total as { ditambah: number; diperbarui: number } | undefined
    const n = (total?.ditambah ?? 0) + (total?.diperbarui ?? 0)
    bagian.push(n ? `${jenis} berhasil dibuka: ${n} data diperbarui.` : `${jenis} berhasil dibuka. Data sudah terbaru.`)
    const terdampak = (r.profilTerdampak as { nama: string; dibekukan: boolean; dicabut: boolean }[] | undefined) ?? []
    for (const p of terdampak) {
      if (p.dicabut) bagian.push(`Profil ${p.nama} sudah tidak berlaku lagi.`)
      else if (p.dibekukan) bagian.push(`Profil ${p.nama} sedang mondok (pencatatan dihentikan sementara).`)
      else bagian.push(`Profil ${p.nama} aktif kembali.`)
    }
  }
  return { sukses: true, teks: bagian.join(' ') }
}
