// Seed kurikulum dari aplikasi lama (T4) dan target materi berikutnya.
import sumber from './data/kurikulum-sumber.json'
import type { Db } from './db'
import { GalatPpg } from './galat'
import { ambilGenerus } from './repo/generus'
import { daftarMateri, materiBerlakuUntuk, type MateriLengkap, type TipeMateri } from './repo/materi'
import { ambilRekaman, pastikanAdmin, sisipkanRekaman } from './repo/umum'

interface ItemSumber {
  nomor: number
  nama: string
  tipe?: string
}

type DataSumber = {
  BIDANG_MATERI: { nama: string; urutan: number; deskripsi?: string }[]
  KATEGORI_MATERI: Record<string, { kode: string; nama: string; urutan: number; tipe: string }[]>
} & Record<string, unknown>

const DATA = sumber as unknown as DataSumber

/** Pemetaan kode kategori → daftar materi (sama dengan `materi_mapping` di desktop/database/seed_kurikulum.py). */
export const PEMETAAN_MATERI: Record<string, string> = {
  'ALM-HFS': 'MATERI_HAFALAN_SURAT',
  'ALM-HDG': 'MATERI_DOA_GBMTPG',
  'ALM-HDS': 'MATERI_DOA_GENERUS_SORONG',
  'ALM-HDL': 'MATERI_DALIL',
  'ALM-HDD': 'MATERI_DALIL', // sama dengan GBMTPG
  'ALM-TJW': 'MATERI_TAJWID',
  'FQH-KFH': 'MATERI_KEFAHAMAN_AGAMA',
  'FQH-PIB': 'MATERI_PRAKTEK_IBADAH',
  'FQH-4TK': 'MATERI_4_TALI_KEIMANAN',
  'FQH-NBP': 'MATERI_NASEHAT_BPI',
  'AKH-6TL': 'MATERI_6_THOBIAT',
  'AKH-ADB': 'MATERI_ADAB',
  'KMD-GBM': 'MATERI_KEMANDIRIAN',
  'KMD-ASD': 'MATERI_ASAD',
}

/** Id tetap kurikulum agar sama di semua instalasi. */
export const idBidang = (urutan: number) => `BDG-${urutan}`
export const idKategori = (kode: string) => `KAT-${kode}`
export const idMateri = (kode: string, nomor: number) => `MAT-${kode}-${String(nomor).padStart(3, '0')}`

function tipeSah(t: string | undefined, cadangan: TipeMateri): TipeMateri {
  return t === 'hafalan' || t === 'checklist' || t === 'level' ? t : cadangan
}

/** Isi kurikulum awal (admin). Idempoten: hanya menambah yang belum ada. Kembalikan jumlah yang ditambahkan. */
export function seedKurikulum(db: Db): { bidang: number; kategori: number; materi: number } {
  pastikanAdmin(db)
  const hitung = { bidang: 0, kategori: 0, materi: 0 }
  db.transaksi(() => {
    const bidangPerNama = new Map<string, string>()
    for (const b of DATA.BIDANG_MATERI) {
      const id = idBidang(b.urutan)
      bidangPerNama.set(b.nama, id)
      if (!ambilRekaman(db, 'bidang_materi', id)) {
        sisipkanRekaman(db, 'bidang_materi', { nama: b.nama, urutan: b.urutan }, { id })
        hitung.bidang++
      }
    }
    for (const [namaBidang, daftar] of Object.entries(DATA.KATEGORI_MATERI)) {
      const bidangId = bidangPerNama.get(namaBidang)
      if (!bidangId) continue
      for (const k of daftar) {
        const kid = idKategori(k.kode)
        const tipeKat = tipeSah(k.tipe, 'hafalan')
        if (!ambilRekaman(db, 'kategori_materi', kid)) {
          sisipkanRekaman(db, 'kategori_materi', { bidang_id: bidangId, kode: k.kode, nama: k.nama, urutan: k.urutan, tipe: tipeKat }, { id: kid })
          hitung.kategori++
        }
        const kunciDaftar = PEMETAAN_MATERI[k.kode]
        if (!kunciDaftar) continue
        const items = DATA[kunciDaftar] as ItemSumber[] | undefined
        if (!Array.isArray(items)) throw new GalatPpg('KURIKULUM_RUSAK', `Daftar ${kunciDaftar} tidak ada di data kurikulum.`)
        for (const m of items) {
          const mid = idMateri(k.kode, m.nomor)
          if (ambilRekaman(db, 'materi', mid)) continue
          sisipkanRekaman(
            db,
            'materi',
            {
              kategori_id: kid,
              nomor: m.nomor,
              nama: m.nama,
              tipe: tipeSah(m.tipe, 'hafalan'),
              kategori_generus: null,
              isi_teks: null,
              lampiran_pdf_b64: null,
              lampiran_nama: null,
            },
            { id: mid },
          )
          hitung.materi++
        }
      }
    }
  })
  return hitung
}

/** Id materi yang sudah disahkan selesai untuk generus. */
export function materiSelesaiDisahkan(db: Db, generusId: string): Set<string> {
  return new Set(
    db
      .kueri<{ materi_id: string }>(
        `SELECT DISTINCT materi_id FROM kemajuan_belajar WHERE generus_id = ? AND dihapus = 0 AND status_sah = 'disahkan' AND status = 'selesai'`,
        [generusId],
      )
      .map((x) => x.materi_id),
  )
}

/**
 * Target materi berikutnya: materi sesuai kategori generus yang belum disahkan selesai,
 * urut bidang → kategori → nomor (maks `batas`, bawaan 3).
 */
export function targetMateriBerikutnya(db: Db, generusId: string, batas = 3): MateriLengkap[] {
  const g = ambilGenerus(db, generusId)
  if (!g) return []
  const selesai = materiSelesaiDisahkan(db, generusId)
  const hasil: MateriLengkap[] = []
  for (const m of daftarMateri(db)) {
    if (hasil.length >= batas) break
    if (!materiBerlakuUntuk(m, g.kategori) || selesai.has(m.id)) continue
    hasil.push(m)
  }
  return hasil
}
