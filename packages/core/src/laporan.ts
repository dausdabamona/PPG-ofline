// Laporan: pekanan untuk wali (K17), teks WA, rekap presensi & kemajuan.
import type { Db } from './db'
import { materiSelesaiDisahkan, targetMateriBerikutnya } from './kurikulum'
import { ambilGenerus, daftarGenerus, type Generus, type StatusGenerus } from './repo/generus'
import { daftarMateri, materiBerlakuUntuk, type MateriLengkap } from './repo/materi'
import { daftarPresensi, type Presensi, type StatusPresensi } from './repo/presensi'
import { tandaTanya } from './repo/umum'
import { ambilWilayah, kelompokDalamWilayah } from './repo/wilayah'
import { akhirPekan, awalPekan, formatTanggal, tanggalDariIso } from './waktu'

interface Rentang {
  mulai: string
  selesai: string | null
}

/** Peta riwayat (keanggotaan & status) per generus untuk pemeriksaan per tanggal. */
export class PetaRiwayat {
  private anggota = new Map<string, (Rentang & { kelompok_id: string })[]>()
  private status = new Map<string, (Rentang & { status: StatusGenerus })[]>()
  private cadangan = new Map<string, Generus>()

  constructor(db: Db, generusIds: string[]) {
    if (!generusIds.length) return
    const ph = tandaTanya(generusIds.length)
    for (const r of db.kueri<{ generus_id: string; kelompok_id: string; mulai: string; selesai: string | null }>(
      `SELECT generus_id, kelompok_id, mulai, selesai FROM riwayat_keanggotaan WHERE dihapus = 0 AND generus_id IN (${ph})`,
      generusIds,
    )) {
      const l = this.anggota.get(r.generus_id) ?? []
      l.push(r)
      this.anggota.set(r.generus_id, l)
    }
    for (const r of db.kueri<{ generus_id: string; status: StatusGenerus; mulai: string; selesai: string | null }>(
      `SELECT generus_id, status, mulai, selesai FROM riwayat_status WHERE dihapus = 0 AND generus_id IN (${ph})`,
      generusIds,
    )) {
      const l = this.status.get(r.generus_id) ?? []
      l.push(r)
      this.status.set(r.generus_id, l)
    }
    for (const g of daftarGenerus(db, { ids: generusIds })) this.cadangan.set(g.id, g)
  }

  private static mencakup(r: Rentang, t: string): boolean {
    return r.mulai <= t && (r.selesai === null || t < r.selesai)
  }

  /** Status generus pada tanggal (riwayat; cadangan: status saat ini). Rentang: mulai ≤ t < selesai. */
  statusPada(generusId: string, tanggal: string): StatusGenerus | null {
    const l = this.status.get(generusId)
    if (l?.length) return l.find((r) => PetaRiwayat.mencakup(r, tanggal))?.status ?? null
    return this.cadangan.get(generusId)?.status ?? null
  }

  /** Kelompok generus pada tanggal (riwayat; cadangan: kelompok saat ini). */
  kelompokPada(generusId: string, tanggal: string): string | null {
    const l = this.anggota.get(generusId)
    if (l?.length) return l.find((r) => PetaRiwayat.mencakup(r, tanggal))?.kelompok_id ?? null
    return this.cadangan.get(generusId)?.kelompok_id ?? null
  }

  /** Apakah generus pernah menjadi anggota `kelompokId` pada suatu hari dalam [mulai, selesai] (inklusif). */
  anggotaDalamRentang(generusId: string, kelompokId: string, mulai: string, selesai: string): boolean {
    const l = this.anggota.get(generusId)
    if (!l?.length) return this.cadangan.get(generusId)?.kelompok_id === kelompokId
    return l.some((r) => r.kelompok_id === kelompokId && r.mulai <= selesai && (r.selesai === null || r.selesai > mulai))
  }

  /** Apakah presensi dihitung: generus aktif dan anggota kelompok presensi pada tanggal itu. */
  dihitung(p: Pick<Presensi, 'generus_id' | 'kelompok_id' | 'tanggal'>): boolean {
    return this.statusPada(p.generus_id, p.tanggal) === 'aktif' && this.kelompokPada(p.generus_id, p.tanggal) === p.kelompok_id
  }
}

export interface HitungPresensi {
  hadir: number
  izin: number
  sakit: number
  alpa: number
  total: number
}

function hitungKosong(): HitungPresensi {
  return { hadir: 0, izin: 0, sakit: 0, alpa: 0, total: 0 }
}

function tambahHitung(h: HitungPresensi, s: StatusPresensi): void {
  h[s]++
  h.total++
}

export interface ItemKemajuanLaporan {
  kemajuan_id: string
  materi_id: string
  materi: string
  kategori: string
  bidang: string
  status: 'sedang' | 'selesai'
  nilai: number | null
  level: number | null
  tanggal: string
  disahkan_oleh: string | null
}

export interface ItemTarget {
  materi_id: string
  materi: string
  kategori: string
  bidang: string
}

interface DasarLaporan {
  generus: { id: string; nama: string; kategori: string; status: string }
  kelompok: { id: string; nama: string } | null
  pekan: { mulai: string; selesai: string }
}

export type LaporanPekanan =
  | (DasarLaporan & { mondok: true })
  | (DasarLaporan & {
      mondok: false
      presensi: HitungPresensi
      materiDisahkan: ItemKemajuanLaporan[]
      materiDiajukan: ItemKemajuanLaporan[]
      targetBerikutnya: ItemTarget[]
      catatanMubaligh: string[]
    })

function petaMateri(db: Db): Map<string, MateriLengkap> {
  return new Map(daftarMateri(db).map((m) => [m.id, m]))
}

/**
 * Laporan pekanan (Ahad–Sabtu yang memuat tanggal acuan) untuk satu generus. Bila generus berstatus mondok
 * pada tanggal acuan → `{ mondok: true }` tanpa rincian.
 */
export function laporanPekanan(db: Db, generusId: string, tanggalAcuan: string): LaporanPekanan | null {
  const g = ambilGenerus(db, generusId)
  if (!g) return null
  const mulai = awalPekan(tanggalAcuan)
  const selesai = akhirPekan(tanggalAcuan)
  const peta = new PetaRiwayat(db, [g.id])
  const kel = ambilWilayah(db, g.kelompok_id)
  const dasar: DasarLaporan = {
    generus: { id: g.id, nama: g.nama, kategori: g.kategori, status: g.status },
    kelompok: kel ? { id: kel.id, nama: kel.nama } : null,
    pekan: { mulai, selesai },
  }
  if (peta.statusPada(g.id, tanggalAcuan) === 'mondok') return { ...dasar, mondok: true }

  const presensi = hitungKosong()
  for (const p of daftarPresensi(db, { generusIds: [g.id], mulai, selesai })) if (peta.dihitung(p)) tambahHitung(presensi, p.status)

  const materi = petaMateri(db)
  const keItem = (k: {
    id: string
    materi_id: string
    status: 'sedang' | 'selesai'
    nilai: number | null
    level: number | null
    tanggal: string
    disahkan_oleh: string | null
  }): ItemKemajuanLaporan => {
    const m = materi.get(k.materi_id)
    return {
      kemajuan_id: k.id,
      materi_id: k.materi_id,
      materi: m?.nama ?? '(materi tidak dikenal)',
      kategori: m?.kategori_nama ?? '',
      bidang: m?.bidang_nama ?? '',
      status: k.status,
      nilai: k.nilai,
      level: k.level,
      tanggal: k.tanggal,
      disahkan_oleh: k.disahkan_oleh,
    }
  }
  type BarisK = Parameters<typeof keItem>[0] & { status_sah: string; disahkan_pada: string | null; catatan_mubaligh: string | null }
  const semua = db.kueri<BarisK>(
    `SELECT id, materi_id, status, nilai, level, tanggal, disahkan_oleh, status_sah, disahkan_pada, catatan_mubaligh
     FROM kemajuan_belajar WHERE generus_id = ? AND dihapus = 0 ORDER BY tanggal, diubah_pada`,
    [g.id],
  )
  const dalamPekan = (t: string | null) => !!t && t >= mulai && t <= selesai
  const disahkan = semua.filter((k) => k.status_sah === 'disahkan' && dalamPekan(k.disahkan_pada ? tanggalDariIso(k.disahkan_pada) : null))
  const diajukan = semua.filter((k) => k.status_sah === 'diajukan' && dalamPekan(k.tanggal))
  const catatan = semua
    .filter((k) => k.catatan_mubaligh && k.status_sah !== 'diajukan' && dalamPekan(k.disahkan_pada ? tanggalDariIso(k.disahkan_pada) : null))
    .map((k) => `${materi.get(k.materi_id)?.nama ?? 'Materi'}: ${k.catatan_mubaligh}`)
  return {
    ...dasar,
    mondok: false,
    presensi,
    materiDisahkan: disahkan.map(keItem),
    materiDiajukan: diajukan.map(keItem),
    targetBerikutnya: targetMateriBerikutnya(db, g.id, 3).map((m) => ({ materi_id: m.id, materi: m.nama, kategori: m.kategori_nama, bidang: m.bidang_nama })),
    catatanMubaligh: catatan,
  }
}

function rincianItem(i: ItemKemajuanLaporan): string {
  const bagian = [i.status === 'selesai' ? 'selesai' : 'sedang dipelajari']
  if (i.level !== null) bagian.push(`level ${i.level}`)
  if (i.nilai !== null) bagian.push(`nilai ${i.nilai}`)
  return `• ${i.materi} (${i.kategori}) — ${bagian.join(', ')}`
}

/** Teks WA ringkas laporan pekanan, diawali salam, hanya berisi data generus itu sendiri. */
export function teksWaLaporanPekanan(l: LaporanPekanan): string {
  const baris: string[] = ["Assalamu'alaikum warahmatullahi wabarakatuh."]
  const kel = l.kelompok ? ` (Kelompok ${l.kelompok.nama})` : ''
  baris.push(`Laporan pekanan ananda *${l.generus.nama}*${kel}`)
  baris.push(`Pekan ${formatTanggal(l.pekan.mulai)} – ${formatTanggal(l.pekan.selesai)}`)
  baris.push('')
  if (l.mondok) {
    baris.push('Ananda sedang mondok. Laporan pekanan dilanjutkan setelah ananda kembali aktif di kelompok.')
  } else {
    const p = l.presensi
    baris.push(
      p.total
        ? `Kehadiran: hadir ${p.hadir}, izin ${p.izin}, sakit ${p.sakit}, alpa ${p.alpa} (dari ${p.total} pertemuan)`
        : 'Kehadiran: belum ada catatan pekan ini.',
    )
    if (l.materiDisahkan.length) {
      baris.push('', 'Materi yang disahkan pekan ini:')
      baris.push(...l.materiDisahkan.map(rincianItem))
    }
    if (l.materiDiajukan.length) {
      baris.push('', 'Sedang menunggu disimak mubaligh:')
      baris.push(...l.materiDiajukan.map((i) => `• ${i.materi} (${i.kategori})`))
    }
    if (l.targetBerikutnya.length) {
      baris.push('', 'Target berikutnya:')
      baris.push(...l.targetBerikutnya.map((t) => `• ${t.materi} (${t.kategori})`))
    }
    if (l.catatanMubaligh.length) {
      baris.push('', 'Catatan mubaligh:')
      baris.push(...l.catatanMubaligh.map((c) => `• ${c}`))
    }
    baris.push('', 'Mohon dukungan Bapak/Ibu di rumah agar ananda semakin semangat.')
  }
  baris.push('Jazakumullahu khoiro.')
  return baris.join('\n')
}

/** Normalisasi nomor HP Indonesia ke format 62… (08… → 628…, +62… → 62…). Kosong bila tidak sah. */
export function normalNoHp(noHp: string): string {
  let d = (noHp ?? '').replace(/[^\d+]/g, '')
  if (d.startsWith('+')) d = d.slice(1)
  d = d.replace(/\D/g, '')
  if (d.startsWith('0')) d = '62' + d.slice(1)
  else if (d.startsWith('8')) d = '62' + d
  return /^62\d{8,13}$/.test(d) ? d : ''
}

/** Tautan wa.me dengan teks siap kirim. */
export function tautanWa(noHp: string, teks: string): string {
  const n = normalNoHp(noHp)
  return `https://wa.me/${n}?text=${encodeURIComponent(teks)}`
}

export interface BarisRekapPresensi extends HitungPresensi {
  generus_id: string
  nama: string
  kelompok_id: string
  persen_hadir: number
}

export interface RekapPresensi {
  mulai: string
  selesai: string
  perGenerus: BarisRekapPresensi[]
  perKelompok: (HitungPresensi & { kelompok_id: string; nama: string; persen_hadir: number })[]
}

const persen = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0)

/**
 * Rekap presensi wilayah dalam rentang tanggal. Hanya menghitung hari ketika generus aktif dan anggota
 * kelompok itu (riwayat) — generus pindah tercatat per periode keanggotaan (satu baris per generus+kelompok).
 */
export function rekapPresensi(db: Db, o: { wilayahId: string; mulai: string; selesai: string }): RekapPresensi {
  const kel = kelompokDalamWilayah(db, o.wilayahId)
  const rows = daftarPresensi(db, { kelompokIds: kel, mulai: o.mulai, selesai: o.selesai })
  const peta = new PetaRiwayat(db, [...new Set(rows.map((r) => r.generus_id))])
  const perG = new Map<string, BarisRekapPresensi>()
  const perK = new Map<string, HitungPresensi>()
  const namaG = new Map(daftarGenerus(db, { ids: [...new Set(rows.map((r) => r.generus_id))] }).map((g) => [g.id, g.nama]))
  for (const r of rows) {
    if (!peta.dihitung(r)) continue
    const k = `${r.generus_id}|${r.kelompok_id}`
    const e = perG.get(k) ?? { generus_id: r.generus_id, nama: namaG.get(r.generus_id) ?? '?', kelompok_id: r.kelompok_id, persen_hadir: 0, ...hitungKosong() }
    tambahHitung(e, r.status)
    perG.set(k, e)
    const hk = perK.get(r.kelompok_id) ?? hitungKosong()
    tambahHitung(hk, r.status)
    perK.set(r.kelompok_id, hk)
  }
  const perGenerus = [...perG.values()].map((e) => ({ ...e, persen_hadir: persen(e.hadir, e.total) })).sort((a, b) => a.nama.localeCompare(b.nama))
  const perKelompok = kel
    .filter((k) => perK.has(k))
    .map((k) => {
      const h = perK.get(k)!
      return { kelompok_id: k, nama: ambilWilayah(db, k)?.nama ?? k, ...h, persen_hadir: persen(h.hadir, h.total) }
    })
  return { mulai: o.mulai, selesai: o.selesai, perGenerus, perKelompok }
}

export interface BarisRekapKemajuan {
  generus_id: string
  nama: string
  kelompok_id: string
  kategori: string
  perBidang: { bidang_id: string; bidang: string; disahkan: number; total: number; persen: number }[]
  disahkan: number
  total: number
  persen: number
}

/** Rekap kemajuan per generus di wilayah: jumlah materi disahkan-selesai per bidang dan persentase thd materi sesuai kategori. */
export function rekapKemajuan(db: Db, o: { wilayahId: string }): BarisRekapKemajuan[] {
  const kel = kelompokDalamWilayah(db, o.wilayahId)
  const materi = daftarMateri(db)
  return daftarGenerus(db, { kelompokIds: kel })
    .filter((g) => g.status === 'aktif' || g.status === 'mondok')
    .map((g) => {
      const selesai = materiSelesaiDisahkan(db, g.id)
      const perB = new Map<string, { bidang_id: string; bidang: string; disahkan: number; total: number; persen: number }>()
      for (const m of materi) {
        if (!materiBerlakuUntuk(m, g.kategori)) continue
        const e = perB.get(m.bidang_id) ?? { bidang_id: m.bidang_id, bidang: m.bidang_nama, disahkan: 0, total: 0, persen: 0 }
        e.total++
        if (selesai.has(m.id)) e.disahkan++
        perB.set(m.bidang_id, e)
      }
      const perBidang = [...perB.values()].map((e) => ({ ...e, persen: persen(e.disahkan, e.total) }))
      const disahkan = perBidang.reduce((a, b) => a + b.disahkan, 0)
      const total = perBidang.reduce((a, b) => a + b.total, 0)
      return { generus_id: g.id, nama: g.nama, kelompok_id: g.kelompok_id, kategori: g.kategori, perBidang, disahkan, total, persen: persen(disahkan, total) }
    })
}
