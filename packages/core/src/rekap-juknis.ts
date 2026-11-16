// §16 — Rekap Penguasaan Materi (kelompok → desa → daerah), rekap keaktifan bulanan, dan laporan bulanan kelompok
// (Musyawaroh 5 Unsur, Musyawaroh Muda/i, NUNGGONI).
import type { Db } from './db'
import { GalatPpg } from './galat'
import {
  daftarMateriEvaluasi,
  hitungTotal,
  keaktifanBulan,
  materiBelumDitetapkan,
  raporGenerus,
  type MateriEvaluasi,
} from './juknis'
import { daftarGenerus, KATEGORI_GENERUS, type KategoriGenerus } from './repo/generus'
import { ambangPredikat, rataAda, rumusNilaiAkhir, type AmbangPredikat, type RumusNilaiAkhir } from './tri-sukses'
import { cariProfilPencatat } from './repo/profil'
import { periodeAktif } from './repo/target'
import { adalahAdmin, ambilRekaman, sisipkanRekaman, ubahRekaman, uraiJson, type RekamanDasar } from './repo/umum'
import { ambilWilayah, kelompokDalamWilayah } from './repo/wilayah'
import { tanggalHariIni, tanggalSah } from './waktu'

// =====================================================================================================================
// Rekap Penguasaan Materi
// =====================================================================================================================

export interface BarisRekapPenguasaan {
  no: number
  generus_id: string
  nama: string
  kelompok_id: string
  kelompok: string
  desa: string | null
  /** Persen per kolom materi (urut `kolom`); null = belum dinilai atau belum ditetapkan. */
  nilai: (number | null)[]
  /** §20 (J-R13): kolom yang belum dinilai (sel "bd"). */
  belumDinilai: boolean[]
  /** §20.5: ringkas per aspek Tri Sukses Generus. */
  alimFaqih: number | null
  akhlak: number | null
  mandiri: number | null
  /** Nilai Akhir (§20.2). */
  total: number | null
}

export interface RingkasanRekapWilayah {
  wilayah_id: string
  nama: string
  tingkat: 'kelompok' | 'desa'
  jumlah: number
  /** Rata-rata tiap kolom. */
  rata: (number | null)[]
  /** §20.5: rata-rata aspek. */
  rataAspek: { alimFaqih: number | null; akhlak: number | null; mandiri: number | null }
  rataTotal: number | null
}

export interface RekapPenguasaan {
  periode: string
  jenjang: KategoriGenerus
  kolom: MateriEvaluasi[]
  baris: BarisRekapPenguasaan[]
  perKelompok: RingkasanRekapWilayah[]
  perDesa: RingkasanRekapWilayah[]
  rata: (number | null)[]
  rataAspek: { alimFaqih: number | null; akhlak: number | null; mandiri: number | null }
  rataTotal: number | null
  /** §20.2 (K09): rumus nilai akhir yang dipakai. */
  rumus: RumusNilaiAkhir
  /** §20 (K17): ambang predikat. */
  ambang: AmbangPredikat
  /** Generus wilayah ini yang jenjangnya masih "caberawit" lama (perlu ditetapkan A/B/C). */
  jenjangBelumDitetapkan: number
  /** §18 (J-KR4): nama materi yang belum ditetapkan Kurikulum (kolom "—", tidak ikut TOTAL). */
  materiBelumDitetapkan: string[]
}

function rataKolom(
  baris: Pick<BarisRekapPenguasaan, 'nilai' | 'total' | 'alimFaqih' | 'akhlak' | 'mandiri'>[],
  n: number,
): { rata: (number | null)[]; rataAspek: RingkasanRekapWilayah['rataAspek']; rataTotal: number | null } {
  const rata: (number | null)[] = []
  for (let i = 0; i < n; i++) {
    const v = baris.map((b) => b.nilai[i]).filter((x): x is number => x !== null && x !== undefined)
    rata.push(v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null)
  }
  return {
    rata,
    rataAspek: { alimFaqih: rataAda(baris.map((b) => b.alimFaqih)), akhlak: rataAda(baris.map((b) => b.akhlak)), mandiri: rataAda(baris.map((b) => b.mandiri)) },
    rataTotal: hitungTotal(baris.map((b) => b.total)),
  }
}

/**
 * Rekap Penguasaan Materi satu jenjang untuk wilayah (kelompok / desa / daerah) — tabel juknis: No, Nama, kolom tiap
 * materi, TOTAL; ditambah rata-rata per kelompok & per desa. Generus aktif berjenjang itu saja.
 */
export function rekapPenguasaan(db: Db, o: { wilayahId: string; jenjang: KategoriGenerus; periode?: string; tanggal?: string }): RekapPenguasaan {
  if (!KATEGORI_GENERUS.includes(o.jenjang)) throw new GalatPpg('KATEGORI_TIDAK_SAH', 'Jenjang tidak dikenal.')
  const periode = o.periode ?? periodeAktif(db, o.tanggal)
  const kolom = daftarMateriEvaluasi(db, o.jenjang)
  const kelompok = kelompokDalamWilayah(db, o.wilayahId)
  const semua = daftarGenerus(db, { kelompokIds: kelompok, status: 'aktif' })
  const gs = semua.filter((g) => g.kategori === o.jenjang)
  const baris: BarisRekapPenguasaan[] = []
  for (const g of gs) {
    const r = raporGenerus(db, g.id, { periode, tanggal: o.tanggal })
    if (!r) continue
    const peta = new Map(r.items.map((i) => [i.materi.id, i]))
    baris.push({
      no: 0,
      generus_id: g.id,
      nama: g.nama,
      kelompok_id: g.kelompok_id,
      kelompok: r.generus.kelompok ?? '',
      desa: r.generus.desa,
      nilai: kolom.map((m) => peta.get(m.id)?.persen ?? null),
      belumDinilai: kolom.map((m) => {
        const i = peta.get(m.id)
        return !!i && !i.belumDitetapkan && !i.dinilai
      }),
      alimFaqih: r.triSukses.alimFaqih,
      akhlak: r.triSukses.akhlak,
      mandiri: r.triSukses.mandiri,
      total: r.total,
    })
  }
  baris.sort((a, b) => (a.desa ?? '').localeCompare(b.desa ?? '') || a.kelompok.localeCompare(b.kelompok) || a.nama.localeCompare(b.nama))
  baris.forEach((b, i) => (b.no = i + 1))
  const kelompokan = (kunci: (b: BarisRekapPenguasaan) => string, tingkat: 'kelompok' | 'desa'): RingkasanRekapWilayah[] => {
    const peta = new Map<string, BarisRekapPenguasaan[]>()
    for (const b of baris) {
      const k = kunci(b)
      peta.set(k, [...(peta.get(k) ?? []), b])
    }
    return [...peta.entries()].map(([id, l]) => ({
      wilayah_id: id,
      nama: tingkat === 'kelompok' ? l[0]!.kelompok : (l[0]!.desa ?? '—'),
      tingkat,
      jumlah: l.length,
      ...rataKolom(l, kolom.length),
    }))
  }
  const desaId = (b: BarisRekapPenguasaan) => ambilWilayah(db, b.kelompok_id)?.induk_id ?? '—'
  return {
    periode,
    jenjang: o.jenjang,
    kolom,
    baris,
    perKelompok: kelompokan((b) => b.kelompok_id, 'kelompok'),
    perDesa: kelompokan(desaId, 'desa'),
    ...rataKolom(baris, kolom.length),
    rumus: rumusNilaiAkhir(db),
    ambang: ambangPredikat(db),
    jenjangBelumDitetapkan: semua.filter((g) => g.kategori === 'caberawit').length,
    materiBelumDitetapkan: kolom.filter((m) => materiBelumDitetapkan(m)).map((m) => m.nama),
  }
}

/** Ringkasan semua jenjang untuk satu wilayah: jumlah generus & rata-rata TOTAL per jenjang. */
export function ringkasanPenguasaanJenjang(db: Db, o: { wilayahId: string; periode?: string; tanggal?: string }): { jenjang: KategoriGenerus; jumlah: number; rataTotal: number | null }[] {
  return KATEGORI_GENERUS.map((j) => {
    const r = rekapPenguasaan(db, { ...o, jenjang: j })
    return { jenjang: j, jumlah: r.baris.length, rataTotal: r.rataTotal }
  })
}

// =====================================================================================================================
// Rekap keaktifan bulanan
// =====================================================================================================================

export interface BarisRekapKeaktifan {
  generus_id: string
  nama: string
  kelompok_id: string
  kelompok: string
  jenjang: string
  jumlah: number
  target: number
  persen: number
  menunggu: number
}

export interface RekapKeaktifanBulan {
  bulan: string
  baris: BarisRekapKeaktifan[]
  perKelompok: { kelompok_id: string; nama: string; jumlah: number; rataPersen: number | null; tercapai: number }[]
  /** Temuan untuk musyawarah: generus dengan keaktifan < 50 %. */
  perluPerhatian: BarisRekapKeaktifan[]
}

/** Rekap keaktifan satu bulan 'YYYY-MM' untuk wilayah (generus aktif). */
export function rekapKeaktifanBulan(db: Db, o: { wilayahId: string; bulan: string }): RekapKeaktifanBulan {
  if (!/^\d{4}-\d{2}$/.test(o.bulan)) throw new GalatPpg('BULAN_TIDAK_SAH', 'Bulan harus berbentuk YYYY-MM.')
  const kelompok = kelompokDalamWilayah(db, o.wilayahId)
  const baris: BarisRekapKeaktifan[] = []
  const namaKel = new Map<string, string>()
  for (const g of daftarGenerus(db, { kelompokIds: kelompok, status: 'aktif' })) {
    const k = keaktifanBulan(db, g.id, o.bulan)
    if (!namaKel.has(g.kelompok_id)) namaKel.set(g.kelompok_id, ambilWilayah(db, g.kelompok_id)?.nama ?? '')
    baris.push({
      generus_id: g.id,
      nama: g.nama,
      kelompok_id: g.kelompok_id,
      kelompok: namaKel.get(g.kelompok_id)!,
      jenjang: g.kategori,
      jumlah: k.jumlah,
      target: k.target,
      persen: k.persen,
      menunggu: k.menunggu,
    })
  }
  baris.sort((a, b) => a.kelompok.localeCompare(b.kelompok) || a.nama.localeCompare(b.nama))
  const perKelompok = [...namaKel.entries()].map(([id, nama]) => {
    const l = baris.filter((b) => b.kelompok_id === id)
    return {
      kelompok_id: id,
      nama,
      jumlah: l.length,
      rataPersen: l.length ? Math.round((l.reduce((s, b) => s + b.persen, 0) / l.length) * 10) / 10 : null,
      tercapai: l.filter((b) => b.jumlah >= b.target).length,
    }
  })
  return { bulan: o.bulan, baris, perKelompok: perKelompok.sort((a, b) => a.nama.localeCompare(b.nama)), perluPerhatian: baris.filter((b) => b.persen < 50) }
}

// =====================================================================================================================
// Laporan bulanan kelompok (J-T16)
// =====================================================================================================================

export const UNSUR_NUNGGONI = ['MS', '4S Daerah', '4S Desa', '4S Kelompok', 'LDII', 'SENKOM', 'PERSINAS'] as const
export type UnsurNunggoni = (typeof UNSUR_NUNGGONI)[number]

export interface MusyawarahBulanan {
  terlaksana: boolean | null
  tanggal?: string | null
  catatan?: string | null
}

export interface IsiLaporanBulanan {
  /** Musyawaroh 5 Unsur (materi utama: evaluasi absensi keaktifan bulan sebelumnya). */
  mus5: MusyawarahBulanan
  /** Musyawaroh Muda/i di kelompok/desa/daerah. */
  musMuda: { kelompok: MusyawarahBulanan; desa: MusyawarahBulanan; daerah: MusyawarahBulanan }
  /** MS & pengurus yang sudah NUNGGONI 1 KBM bulan ini. */
  nunggoni: { nama: string; unsur: UnsurNunggoni; tanggal?: string | null; kelas?: string | null; temuan?: string | null }[]
  catatan?: string | null
}

export function isiLaporanKosong(): IsiLaporanBulanan {
  const kosong = (): MusyawarahBulanan => ({ terlaksana: null, tanggal: null, catatan: null })
  return { mus5: kosong(), musMuda: { kelompok: kosong(), desa: kosong(), daerah: kosong() }, nunggoni: [], catatan: null }
}

const MAKS_TEKS = 2000
const MAKS_NUNGGONI = 100

function alasanMusyawarah(m: unknown, nama: string): string | null {
  if (!m || typeof m !== 'object') return `${nama} tidak sah.`
  const x = m as MusyawarahBulanan
  if (x.terlaksana !== null && typeof x.terlaksana !== 'boolean') return `${nama}: status terlaksana tidak sah.`
  if (x.tanggal && !tanggalSah(x.tanggal)) return `${nama}: tanggal tidak sah.`
  if (x.catatan && (typeof x.catatan !== 'string' || x.catatan.length > MAKS_TEKS)) return `${nama}: catatan terlalu panjang.`
  return null
}

/** Pemeriksaan isi laporan bulanan (dipakai saat menyimpan dan saat impor SETOR). */
export function alasanLaporanBulananTidakSah(isi: unknown): string | null {
  if (!isi || typeof isi !== 'object') return 'Isi laporan tidak sah.'
  const l = isi as IsiLaporanBulanan
  const a =
    alasanMusyawarah(l.mus5, 'Musyawaroh 5 Unsur') ??
    alasanMusyawarah(l.musMuda?.kelompok, 'Musyawaroh Muda/i kelompok') ??
    alasanMusyawarah(l.musMuda?.desa, 'Musyawaroh Muda/i desa') ??
    alasanMusyawarah(l.musMuda?.daerah, 'Musyawaroh Muda/i daerah')
  if (a) return a
  if (!Array.isArray(l.nunggoni) || l.nunggoni.length > MAKS_NUNGGONI) return 'Daftar NUNGGONI tidak sah.'
  for (const n of l.nunggoni) {
    if (!n || typeof n.nama !== 'string' || !n.nama.trim() || n.nama.length > 100) return 'Nama NUNGGONI wajib diisi.'
    if (!(UNSUR_NUNGGONI as readonly string[]).includes(n.unsur)) return `Unsur NUNGGONI "${String(n.unsur)}" tidak dikenal.`
    if (n.tanggal && !tanggalSah(n.tanggal)) return 'Tanggal NUNGGONI tidak sah.'
    for (const t of [n.kelas, n.temuan]) if (t && (typeof t !== 'string' || t.length > MAKS_TEKS)) return 'Teks NUNGGONI terlalu panjang.'
  }
  if (l.catatan && (typeof l.catatan !== 'string' || l.catatan.length > MAKS_TEKS)) return 'Catatan terlalu panjang.'
  return null
}

export interface LaporanBulanan extends RekamanDasar {
  kelompok_id: string
  bulan: string
  isi_json: string
}

export const idLaporanBulanan = (kelompokId: string, bulan: string) => `LB-${kelompokId}-${bulan}`

/** Simpan laporan bulanan kelompok (pengurus/mubaligh kelompok, EXE kelompok/desa, atau daerah). */
export function simpanLaporanBulanan(db: Db, d: { kelompokId: string; bulan: string; isi: IsiLaporanBulanan }): LaporanBulanan {
  if (!/^\d{4}-\d{2}$/.test(d.bulan)) throw new GalatPpg('BULAN_TIDAK_SAH', 'Bulan harus berbentuk YYYY-MM.')
  if (d.bulan > tanggalHariIni().slice(0, 7)) throw new GalatPpg('BULAN_TIDAK_SAH', 'Laporan untuk bulan yang belum berjalan.')
  const w = ambilWilayah(db, d.kelompokId)
  if (!w || w.dihapus || w.tingkat !== 'kelompok') throw new GalatPpg('KELOMPOK_TIDAK_SAH', 'Kelompok tidak ditemukan.')
  if (!adalahAdmin(db)) cariProfilPencatat(db, d.kelompokId, ['pengurus', 'mubaligh', 'admin'], 'catat')
  const isi: IsiLaporanBulanan = {
    ...d.isi,
    nunggoni: (d.isi.nunggoni ?? []).map((n) => ({ ...n, nama: n.nama.trim() })),
  }
  const alasan = alasanLaporanBulananTidakSah(isi)
  if (alasan) throw new GalatPpg('LAPORAN_TIDAK_SAH', alasan)
  const id = idLaporanBulanan(d.kelompokId, d.bulan)
  const rek = { kelompok_id: d.kelompokId, bulan: d.bulan, isi_json: JSON.stringify(isi) }
  if (ambilRekaman(db, 'laporan_bulanan', id)) return ubahRekaman<LaporanBulanan>(db, 'laporan_bulanan', id, { ...rek, dihapus: 0 })
  return sisipkanRekaman<LaporanBulanan>(db, 'laporan_bulanan', rek, { id })
}

/** Laporan bulanan kelompok (isi kosong bila belum ada). */
export function ambilLaporanBulanan(db: Db, kelompokId: string, bulan: string): { ada: boolean; isi: IsiLaporanBulanan; diubah_pada: string | null } {
  const r = ambilRekaman<LaporanBulanan>(db, 'laporan_bulanan', idLaporanBulanan(kelompokId, bulan))
  if (!r || r.dihapus) return { ada: false, isi: isiLaporanKosong(), diubah_pada: null }
  return { ada: true, isi: { ...isiLaporanKosong(), ...uraiJson<Partial<IsiLaporanBulanan>>(r.isi_json, {}) }, diubah_pada: r.diubah_pada }
}

export interface BarisRekapLaporanBulanan {
  kelompok_id: string
  kelompok: string
  desa: string | null
  ada: boolean
  mus5: boolean | null
  musMuda: { kelompok: boolean | null; desa: boolean | null; daerah: boolean | null }
  jumlahNunggoni: number
  isi: IsiLaporanBulanan
}

/** Rekap laporan bulanan semua kelompok dalam wilayah (desa/daerah). */
export function rekapLaporanBulanan(db: Db, o: { wilayahId: string; bulan: string }): BarisRekapLaporanBulanan[] {
  return kelompokDalamWilayah(db, o.wilayahId)
    .map((id) => {
      const w = ambilWilayah(db, id)
      const desa = w?.induk_id ? ambilWilayah(db, w.induk_id) : undefined
      const l = ambilLaporanBulanan(db, id, o.bulan)
      return {
        kelompok_id: id,
        kelompok: w?.nama ?? id,
        desa: desa?.nama ?? null,
        ada: l.ada,
        mus5: l.isi.mus5?.terlaksana ?? null,
        musMuda: { kelompok: l.isi.musMuda?.kelompok?.terlaksana ?? null, desa: l.isi.musMuda?.desa?.terlaksana ?? null, daerah: l.isi.musMuda?.daerah?.terlaksana ?? null },
        jumlahNunggoni: l.isi.nunggoni.length,
        isi: l.isi,
      }
    })
    .sort((a, b) => (a.desa ?? '').localeCompare(b.desa ?? '') || a.kelompok.localeCompare(b.kelompok))
}
