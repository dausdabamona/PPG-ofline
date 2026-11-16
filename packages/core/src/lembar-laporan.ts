// §19 (Fase 13) — data cetakan Laporan Bulanan format lembar: sampul, lembar keaktifan per jenjang (kolom tanggal 1–31 /
// urutan kegiatan), absensi pengurus & mubaligh peduli (NUNGGONI), laporan hasil musyawaroh, dan kotak penyaksian.
// Hanya merakit data (tanpa tampilan); tampilan cetak & Excel ada di aplikasi EXE.
import type { Db } from './db'
import { daftarCatatan } from './bidang'
import { GalatPpg } from './galat'
import { hariDalamBulan, hitungTotal, jenjangKecil, keaktifanBulan, raporGenerus, targetKeaktifan } from './juknis'
import { LABEL_JABATAN, type Jabatan } from './kepengurusan'
import { ambilLaporanBulanan } from './rekap-juknis'
import { daftarGenerus, KATEGORI_GENERUS, kategoriCocok, labelIqro, type Generus, type KategoriGenerus } from './repo/generus'
import { kategoriKelas } from './repo/pengajian'
import { daftarPerangkat } from './repo/perangkat'
import { periodeDariTanggal } from './repo/target'
import { ambilWilayah, kelompokDalamWilayah } from './repo/wilayah'
import { uraiToken } from './token'
import { tanggalHariIni, umurPada } from './waktu'

export type FormatLembar = 'tanggal' | 'urutan'

/** Judul lembar daerah per jenjang (J-C6). */
export const JUDUL_LEMBAR: Record<Exclude<KategoriGenerus, 'caberawit'>, { judul: string; sub: string }> = {
  paud: { judul: 'PRESENSI KEAKTIFAN PAUD', sub: '' },
  caberawit_a: { judul: 'PRESENSI KEAKTIFAN CB. RAWIT A', sub: '(Kelas 1 sampai Kelas 3)' },
  caberawit_b: { judul: 'PRESENSI KEAKTIFAN CB. RAWIT B', sub: '(Kelas 4-6, yg masih baca IQRO)' },
  caberawit_c: { judul: 'PRESENSI KEAKTIFAN CB. RAWIT C', sub: "(Usia SD yang sudah baca Al Qur'an)" },
  praremaja: { judul: 'PRESENSI KEAKTIFAN Pra REMAJA', sub: '(Usia SMP)' },
  remaja: { judul: 'PRESENSI KEAKTIFAN REMAJA', sub: '(Usia SMA)' },
  pranikah: { judul: 'PRESENSI KEAKTIFAN Pra NIKAH', sub: '(Usia Pasca SMA)' },
}

/** Jumlah kolom lembar cetakan daerah (24; Pra Nikah 16). */
export function slotLembarDaerah(jenjang: string): number {
  return jenjang === 'pranikah' ? 16 : 24
}

const NAMA_BULAN = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER']

export interface BarisLembar {
  no: number
  generus_id: string
  nama: string
  jk: 'L' | 'P'
  umur: number | null
  /** Label jilid ("Iqro' 3" / "Al-Qur'an"), kosong bila belum diisi. */
  iqro: string
  iqroKode: string | null
  sekolah: string | null
  kelasSekolah: string | null
  orangTua: string | null
  /** Kode per tanggal (indeks 0 = tanggal 1): kode dihitung digabung ("AB"), "IZ" = izin, "" = kosong. */
  perTanggal: string[]
  /** Kode hari-hari yang dihitung, urut tanggal (format urutan). */
  urutan: string[]
  jumlah: number
  persenKeaktifan: number
  /** TOTAL raport periode evaluasi terakhir yang sudah dinilai (J-C5); null bila belum ada. */
  persenMateri: number | null
  periodeMateri: string | null
  /** Jenjang masih "caberawit" lama (dicetak di blok Caberawit A). */
  jenjangPerluDitetapkan: boolean
}

export interface BlokLembar {
  jenjang: Exclude<KategoriGenerus, 'caberawit'>
  judul: string
  sub: string
  target: number
  /** Jumlah kolom format urutan (J-C4). */
  jumlahSlot: number
  /** PAUD–Caberawit (kode A/B, kolom Iqro'). */
  kecil: boolean
  /** Jumlah hari bulan itu. */
  hari: number
  /** Tanda libur per tanggal (indeks 0 = tanggal 1, J-C3). */
  libur: boolean[]
  baris: BarisLembar[]
  /** Jumlah anak per jilid Iqro' 1–6 (PAUD, Caberawit A & B); null untuk jenjang lain. */
  ringkasIqro: number[] | null
  total: { keaktifan: number | null; materi: number | null }
}

export interface BarisNunggoni {
  tanggal: string | null
  /** Tanggal dalam bulan (1–31) atau null. */
  hari: number | null
  nama: string
  dapukan: string
}

export interface PenyaksiLembar {
  jabatan: string
  nama: string
}

export interface LembarLaporanKelompok {
  kelompok: { id: string; nama: string; kode: string | null }
  desa: { id: string; nama: string } | null
  bulan: string
  /** "OKTOBER 2026" */
  teksBulan: string
  /** Nama mubaligh (MT) kelompok dari token aktif, null bila tidak ada. */
  mubaligh: string | null
  blok: BlokLembar[]
  nunggoni: BarisNunggoni[]
  musyawarah: { mudaMudi: { terlaksana: boolean | null; hasil: string }; limaUnsur: { terlaksana: boolean | null; hasil: string } }
  adaLaporanBulanan: boolean
  penyaksian: { kelompok: PenyaksiLembar[]; desa: PenyaksiLembar[] }
  catatanPenyaksian: string
}

export const CATATAN_PENYAKSIAN =
  '(Semua yang bertandatangan AMSHOL supaya memastikan telah membaca seluruh laporan dan memberi masukan berupa saran, solusi, pertanyaan jika belum jelas, dsb)'

export function teksBulanLembar(bulan: string): string {
  return `${NAMA_BULAN[Number(bulan.slice(5, 7)) - 1]} ${bulan.slice(0, 4)}`
}

function jabatanToken(token: string): Jabatan[] {
  try {
    return uraiToken(token).payload.jabatan ?? []
  } catch {
    return []
  }
}

/** Nama token aktif (tidak dicabut) role & wilayah tertentu, dengan jabatan opsional. */
function namaPemegang(db: Db, wilayahId: string, role: 'mubaligh' | 'pengurus', jabatan?: Jabatan): string | null {
  const t = daftarPerangkat(db, { wilayahIds: [wilayahId], role: [role], aktifSaja: true })
    .filter((x) => !x.dicabut_pada && (!jabatan || jabatanToken(x.token).includes(jabatan)))
    .sort((a, b) => String(b.dibuat_pada).localeCompare(String(a.dibuat_pada)))
  return t[0]?.nama ?? null
}

/** Nama mubaligh (MT) kelompok dari token mubaligh aktif terbaru; null bila tidak ada. */
export function namaMubalighKelompok(db: Db, kelompokId: string): string | null {
  return namaPemegang(db, kelompokId, 'mubaligh')
}

/** % Peng. Materi: TOTAL raport periode evaluasi terakhir (≤ periode bulan) yang punya nilai. */
function materiTerakhir(db: Db, generusId: string, bulan: string): { persen: number | null; periode: string | null } {
  const akhir = `${bulan}-${String(hariDalamBulan(bulan)).padStart(2, '0')}`
  const batas = periodeDariTanggal(akhir)
  const per = db.nilai<string>(
    `SELECT periode FROM evaluasi_semester WHERE generus_id = ? AND dihapus = 0 AND periode <= ? ORDER BY periode DESC LIMIT 1`,
    [generusId, batas],
  )
  if (!per) return { persen: null, periode: null }
  const r = raporGenerus(db, generusId, { periode: per, tanggal: akhir < tanggalHariIni() ? akhir : tanggalHariIni() })
  return { persen: r?.total ?? null, periode: per }
}

function bulat1(n: number): number {
  return Math.round(n * 10) / 10
}

/** Data lembar laporan bulanan satu kelompok (§19.2). */
export function lembarLaporanBulanan(db: Db, o: { kelompokId: string; bulan: string }): LembarLaporanKelompok {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(o.bulan)) throw new GalatPpg('BULAN_TIDAK_SAH', 'Bulan harus berbentuk YYYY-MM.')
  const kel = ambilWilayah(db, o.kelompokId)
  if (!kel || kel.dihapus || kel.tingkat !== 'kelompok') throw new GalatPpg('KELOMPOK_TIDAK_SAH', 'Kelompok tidak ditemukan.')
  const desa = kel.induk_id ? ambilWilayah(db, kel.induk_id) : undefined
  const nHari = hariDalamBulan(o.bulan)
  const akhirBulan = `${o.bulan}-${String(nHari).padStart(2, '0')}`
  const umurAcuan = akhirBulan < tanggalHariIni() ? akhirBulan : tanggalHariIni()
  const anak = daftarGenerus(db, { kelompokId: kel.id, status: 'aktif' })
  const pengajian = db.kueri<{ hari: number | null; kategori_generus: string | null }>(
    `SELECT hari, kategori_generus FROM pengajian WHERE wilayah_id = ? AND dihapus = 0`,
    [kel.id],
  )
  // hari pekan tanggal d (0 = Ahad)
  const hariPekan = (d: number) => new Date(Date.UTC(Number(o.bulan.slice(0, 4)), Number(o.bulan.slice(5, 7)) - 1, d)).getUTCDay()

  const blok: BlokLembar[] = (KATEGORI_GENERUS as Exclude<KategoriGenerus, 'caberawit'>[]).map((jenjang) => {
    const daftar: Generus[] = anak.filter((g) => g.kategori === jenjang || (jenjang === 'caberawit_a' && g.kategori === 'caberawit'))
    const target = targetKeaktifan(db, jenjang)
    const baris: BarisLembar[] = daftar.map((g, i) => {
      const k = keaktifanBulan(db, g.id, o.bulan, jenjang)
      const perTanggal = Array.from({ length: nHari }, () => '')
      const urutan: string[] = []
      for (const h of k.hari) {
        const d = Number(h.tanggal.slice(8, 10))
        if (h.dihitung) {
          perTanggal[d - 1] = h.kode.join('')
          urutan.push(h.kode.join(''))
        } else if (h.izin) perTanggal[d - 1] = 'IZ'
      }
      const m = materiTerakhir(db, g.id, o.bulan)
      return {
        no: i + 1,
        generus_id: g.id,
        nama: g.nama,
        jk: g.jenis_kelamin,
        umur: g.tanggal_lahir ? umurPada(g.tanggal_lahir, umurAcuan) : null,
        iqro: labelIqro(g.iqro),
        iqroKode: g.iqro ?? null,
        sekolah: g.sekolah ?? null,
        kelasSekolah: g.kelas_sekolah ?? null,
        orangTua: g.wali_nama,
        perTanggal,
        urutan,
        jumlah: k.jumlah,
        persenKeaktifan: k.persen,
        persenMateri: m.persen,
        periodeMateri: m.periode,
        jenjangPerluDitetapkan: g.kategori === 'caberawit',
      }
    })
    // J-C3: hari pekan berjadwal rutin untuk jenjang ini
    const rutin = new Set(
      pengajian
        .filter((p) => p.hari !== null && p.hari !== undefined)
        .filter((p) => {
          const kk = kategoriKelas(p)
          return !kk || kk.some((x) => kategoriCocok(x, jenjang))
        })
        .map((p) => Number(p.hari)),
    )
    const libur = Array.from({ length: nHari }, (_, i) => rutin.size > 0 && !rutin.has(hariPekan(i + 1)) && baris.every((b) => !b.perTanggal[i]))
    const kecil = jenjangKecil(jenjang)
    const ringkasIqro = kecil && jenjang !== 'caberawit_c' ? [1, 2, 3, 4, 5, 6].map((n) => baris.filter((b) => b.iqroKode === String(n)).length) : null
    const pk = baris.map((b) => b.persenKeaktifan)
    const pm = baris.map((b) => b.persenMateri).filter((x): x is number => x !== null)
    return {
      jenjang,
      judul: JUDUL_LEMBAR[jenjang].judul,
      sub: JUDUL_LEMBAR[jenjang].sub,
      target,
      jumlahSlot: Math.max(target, slotLembarDaerah(jenjang), ...baris.map((b) => b.jumlah)),
      kecil,
      hari: nHari,
      libur,
      baris,
      ringkasIqro,
      total: { keaktifan: pk.length ? bulat1(pk.reduce((s, x) => s + x, 0) / pk.length) : null, materi: pm.length ? hitungTotal(pm) : null },
    }
  })

  // J-C7: NUNGGONI = laporan bulanan + catatan NUNGGONI pengurus/mubaligh untuk kelompok ini
  const lap = ambilLaporanBulanan(db, kel.id, o.bulan)
  const nunggoni: BarisNunggoni[] = []
  const sudah = new Set<string>()
  const tambah = (n: BarisNunggoni) => {
    const kunci = `${n.nama.toLowerCase()}|${n.tanggal ?? ''}`
    if (sudah.has(kunci)) return
    sudah.add(kunci)
    nunggoni.push(n)
  }
  for (const n of lap.isi.nunggoni) {
    const t = n.tanggal && n.tanggal.startsWith(o.bulan) ? n.tanggal : null
    tambah({ tanggal: t, hari: t ? Number(t.slice(8, 10)) : null, nama: n.nama, dapukan: n.unsur })
  }
  for (const c of daftarCatatan(db, { jenis: 'nunggoni', mulai: `${o.bulan}-01`, selesai: akhirBulan })) {
    const isi = (c.isi ?? {}) as { kelompok_id?: string; unsur?: string | null }
    if (isi.kelompok_id !== kel.id) continue
    const t = daftarPerangkat(db, { perangkatId: c.perangkat_id }).find((x) => !x.dicabut_pada && (x.role === 'pengurus' || x.role === 'mubaligh'))
    if (!t) continue
    const jab = jabatanToken(t.token)
    const dapukan = isi.unsur ? String(isi.unsur) : jab.length ? jab.map((j) => LABEL_JABATAN[j]).join(', ') : t.role === 'mubaligh' ? 'Mubaligh' : 'Pengurus'
    tambah({ tanggal: c.tanggal, hari: Number(c.tanggal.slice(8, 10)), nama: t.nama, dapukan })
  }
  nunggoni.sort((a, b) => (a.tanggal ?? '9999').localeCompare(b.tanggal ?? '9999') || a.nama.localeCompare(b.nama))

  // J-C9: hasil musyawaroh
  const mm = [lap.isi.musMuda?.kelompok, lap.isi.musMuda?.desa, lap.isi.musMuda?.daerah].filter(Boolean)
  const mmTerlaksana = mm.some((m) => m!.terlaksana === true) ? true : mm.some((m) => m!.terlaksana === false) ? false : null
  const mudaMudi = { terlaksana: mmTerlaksana, hasil: mm.map((m) => m!.catatan?.trim()).filter(Boolean).join('; ') }
  const limaUnsur = { terlaksana: lap.isi.mus5?.terlaksana ?? null, hasil: lap.isi.mus5?.catatan?.trim() ?? '' }

  // J-C8: penyaksian
  const mubaligh = namaPemegang(db, kel.id, 'mubaligh')
  const kord = desa ? namaPemegang(db, desa.id, 'pengurus', 'pj_desa') : null
  return {
    kelompok: { id: kel.id, nama: kel.nama, kode: kel.kode },
    desa: desa ? { id: desa.id, nama: desa.nama } : null,
    bulan: o.bulan,
    teksBulan: teksBulanLembar(o.bulan),
    mubaligh,
    blok,
    nunggoni,
    musyawarah: { mudaMudi, limaUnsur },
    adaLaporanBulanan: lap.ada,
    penyaksian: {
      kelompok: [
        { jabatan: 'KI KELOMPOK', nama: '' },
        { jabatan: 'Wkl KI KELOMPOK', nama: '' },
        { jabatan: 'PENEROBOS KELOMPOK', nama: '' },
        { jabatan: 'MT KELOMPOK', nama: mubaligh ?? '' },
      ],
      desa: [
        { jabatan: 'KI DESA', nama: '' },
        { jabatan: 'Wkl KI DESA', nama: '' },
        { jabatan: 'PENEROBOS DESA', nama: '' },
        { jabatan: 'MUBALEGH DESA', nama: '' },
        { jabatan: 'KORD PPG DESA', nama: kord ?? '' },
      ],
    },
    catatanPenyaksian: CATATAN_PENYAKSIAN,
  }
}

/** Gabungan desa/daerah (J-C11): lembar semua kelompok dalam wilayah, urut desa lalu nama kelompok. */
export function lembarLaporanWilayah(db: Db, o: { wilayahId: string; bulan: string }): LembarLaporanKelompok[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(o.bulan)) throw new GalatPpg('BULAN_TIDAK_SAH', 'Bulan harus berbentuk YYYY-MM.')
  const w = ambilWilayah(db, o.wilayahId)
  if (!w || w.dihapus) throw new GalatPpg('WILAYAH_TIDAK_SAH', 'Wilayah tidak ditemukan.')
  return kelompokDalamWilayah(db, o.wilayahId)
    .map((id) => lembarLaporanBulanan(db, { kelompokId: id, bulan: o.bulan }))
    .sort((a, b) => (a.desa?.nama ?? '').localeCompare(b.desa?.nama ?? '') || a.kelompok.nama.localeCompare(b.kelompok.nama))
}
