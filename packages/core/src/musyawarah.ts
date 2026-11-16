// §18 (Fase 12) — Mekanisme musyawaroh: notulen Sekretaris (catatan bidang `notulen` yang diperluas) berisi butir keputusan
// yang bisa ditautkan ke kunci kebijakan, pengesahan Ketua (atau Wakil Ketua bermandat), penerapan oleh EXE Daerah saja,
// agenda musyawarah berikutnya, teks WA undangan/hasil, dan ringkasan beranda. Hak ditegakkan di core (J-M2–J-M6).
import { gantiKunciBidang, type KunciAdmin } from './admin'
import { daftarCatatan, jabatanToken, LABEL_MUSYAWARAH, musyawarahBulan, simpanCatatan, type CatatanBidang, type CatatanTerbaca } from './bidang'
import { sha256Hex } from './crypto'
import type { Db } from './db'
import { GalatPpg } from './galat'
import {
  alasanLingkupKebijakan,
  alasanNilaiKebijakan,
  bacaIsiKebijakan,
  daftarKebijakan,
  defKebijakan,
  jsonKanonik,
  samaNilai,
  tulisKebijakan,
  type BarisKebijakan,
  type KunciKebijakan,
} from './kebijakan'
import type { Jabatan } from './kepengurusan'
import { daftarPerangkat } from './repo/perangkat'
import { daftarProfil, statusProfil, type Profil } from './repo/profil'
import { adalahAdmin, ambilMeta, aturMeta } from './repo/umum'
import { ambilWilayah } from './repo/wilayah'
import { formatTanggal, tanggalHariIni, tanggalSah } from './waktu'

export type JenisMusyawarah = keyof typeof LABEL_MUSYAWARAH

export interface ButirKeputusan {
  teks: string
  /** Kunci kebijakan yang diubah keputusan ini (opsional). */
  kunci?: KunciKebijakan | null
  /** Lingkup kebijakan (id wilayah daerah / desa). */
  lingkup_id?: string | null
  /** Nilai baru kebijakan. */
  nilai?: unknown
}

export interface IsiNotulen {
  jenis_musyawarah: JenisMusyawarah
  nomor?: string | null
  tempat?: string | null
  peserta?: string | null
  agenda?: string[]
  uraian?: string | null
  hasil?: string | null
  tindak_lanjut?: string | null
  keputusan?: ButirKeputusan[]
}

export type StatusNotulen = 'menunggu' | 'disahkan' | 'perlu_ulang' | 'diterapkan'
export const LABEL_STATUS_NOTULEN: Record<StatusNotulen, string> = {
  menunggu: 'Menunggu pengesahan Ketua',
  disahkan: 'Disahkan — menunggu diterapkan Daerah',
  perlu_ulang: 'Notulen berubah — perlu disahkan ulang',
  diterapkan: 'Disahkan & diterapkan',
}

const PENULIS_NOTULEN: readonly Jabatan[] = ['sekretaris', 'pj_desa', 'pj_kelompok']

/** Id tetap pengesahan satu notulen. */
export const idPengesahan = (notulenId: string) => `PSH-${notulenId}`

/** Sidik SHA-256 isi yang disahkan: wilayah, tanggal, nomor, jenis, dan butir keputusan (J-M3). */
export function sidikNotulen(n: Pick<CatatanBidang, 'wilayah_id' | 'tanggal'> & { isi: unknown }): string {
  const x = (n.isi ?? {}) as IsiNotulen
  const keputusan = (x.keputusan ?? []).map((b) => ({ teks: b.teks, kunci: b.kunci ?? null, lingkup_id: b.lingkup_id ?? null, nilai: b.kunci ? (b.nilai ?? null) : null }))
  return sha256Hex(jsonKanonik({ wilayah_id: n.wilayah_id, tanggal: n.tanggal, nomor: x.nomor ?? null, jenis: x.jenis_musyawarah, keputusan }))
}

/** Pemeriksaan lingkup butir keputusan terhadap wilayah notulen (J-M5). Kembalikan alasan atau null. */
export function alasanLingkupKeputusan(db: Db, wilayahNotulen: string, b: ButirKeputusan): string | null {
  if (!b.kunci) return null
  const a = alasanLingkupKebijakan(db, b.kunci, b.lingkup_id) ?? alasanNilaiKebijakan(b.kunci, b.nilai)
  if (a) return a
  const w = ambilWilayah(db, wilayahNotulen)
  if (!w) return 'Wilayah musyawarah tidak dikenal.'
  if (w.tingkat === 'daerah') return null
  if (w.tingkat === 'desa') return b.lingkup_id === w.id ? null : 'Musyawarah desa hanya boleh mengubah kebijakan lingkup desanya.'
  return 'Musyawarah kelompok tidak mengubah kebijakan.'
}

function jabatan(p: Profil): Jabatan[] {
  return jabatanToken(p.token)
}

function profilJabatan(db: Db, daftar: readonly Jabatan[]): Profil | undefined {
  return daftarProfil(db, 'pengurus').find((p) => statusProfil(p).bolehMencatat && jabatan(p).some((j) => daftar.includes(j)))
}

/** Nomor notulen berikutnya: `<urut>/MUS/PPG/<tahun>`. */
export function nomorNotulenBerikut(db: Db, tanggal: string = tanggalHariIni()): string {
  const tahun = tanggal.slice(0, 4)
  const n = daftarCatatan(db, { jenis: 'notulen', mulai: `${tahun}-01-01`, selesai: `${tahun}-12-31` }).length
  return `${String(n + 1).padStart(2, '0')}/MUS/PPG/${tahun}`
}

export interface DataNotulen extends IsiNotulen {
  id?: string
  tanggal?: string
  /** Wilayah musyawarah (bawaan: wilayah token penulis). PJ desa/kelompok hanya wilayahnya sendiri. */
  wilayahId?: string
}

/**
 * Sekretaris (atau PJ desa/kelompok untuk wilayahnya) menyimpan notulen musyawarah (J-M2). Butir keputusan bertaut
 * kebijakan diperiksa nilai & lingkupnya. Notulen yang sudah disahkan tidak bisa diubah (buat notulen baru).
 */
export function simpanNotulen(db: Db, d: DataNotulen): CatatanBidang {
  if (adalahAdmin(db) || ambilMeta(db, 'peran_db') === 'exe') throw new GalatPpg('TIDAK_BERWENANG', 'Notulen ditulis Sekretaris di HP jabatannya.')
  const p = profilJabatan(db, ['sekretaris']) ?? profilJabatan(db, PENULIS_NOTULEN)
  if (!p) throw new GalatPpg('TIDAK_BERWENANG', 'Hanya Sekretaris (atau PJ desa/kelompok untuk wilayahnya) yang menulis notulen.')
  const sekretaris = jabatan(p).includes('sekretaris')
  const wilayah = d.wilayahId ?? p.wilayah_id
  if (!sekretaris && wilayah !== p.wilayah_id) throw new GalatPpg('TIDAK_BERWENANG', 'Notulen hanya untuk wilayah Anda sendiri.')
  if (!ambilWilayah(db, wilayah)) throw new GalatPpg('WILAYAH_TIDAK_SAH', 'Wilayah musyawarah tidak ditemukan.')
  const tanggal = d.tanggal ?? tanggalHariIni()
  if (!tanggalSah(tanggal)) throw new GalatPpg('TANGGAL_TIDAK_SAH', 'Tanggal musyawarah tidak sah.')
  const keputusan = (d.keputusan ?? []).map((b) => ({
    teks: b.teks.trim(),
    ...(b.kunci ? { kunci: b.kunci, lingkup_id: b.lingkup_id ?? null, nilai: b.nilai } : {}),
  }))
  for (const b of keputusan) {
    const a = alasanLingkupKeputusan(db, wilayah, b)
    if (a) throw new GalatPpg('KEPUTUSAN_TIDAK_SAH', `Keputusan "${b.teks.slice(0, 40)}": ${a}`)
  }
  if (d.id) {
    const lama = daftarNotulen(db).find((n) => n.catatan.id === d.id)
    if (lama && lama.status !== 'menunggu') throw new GalatPpg('SUDAH_DISAHKAN', 'Notulen sudah disahkan; buat notulen baru untuk perubahan.')
  }
  const isi: IsiNotulen = {
    jenis_musyawarah: d.jenis_musyawarah,
    nomor: d.nomor?.trim() || nomorNotulenBerikut(db, tanggal),
    tempat: d.tempat?.trim() || null,
    peserta: d.peserta?.trim() || null,
    agenda: (d.agenda ?? []).map((a) => a.trim()).filter(Boolean),
    uraian: d.uraian?.trim() || null,
    hasil: d.hasil?.trim() || null,
    tindak_lanjut: d.tindak_lanjut?.trim() || null,
    keputusan,
  }
  return simpanCatatan(db, { jenis: 'notulen', isi: isi as unknown as Record<string, unknown>, wilayahId: wilayah, tanggal, judul: isi.nomor, id: d.id })
}

export interface IsiMandat {
  mulai: string
  sampai: string
  keterangan?: string | null
}

/** Mandat pengesahan (catatan `mandat` Ketua) yang berlaku pada tanggal itu. */
export function mandatBerlaku(db: Db, tanggal: string = tanggalHariIni()): (CatatanTerbaca & { isi: IsiMandat }) | null {
  const m = daftarCatatan(db, { jenis: 'mandat' }).find((c) => {
    const x = c.isi as IsiMandat | null
    return !!x && x.mulai <= tanggal && tanggal <= x.sampai
  })
  return (m as (CatatanTerbaca & { isi: IsiMandat }) | undefined) ?? null
}

/** Ketua memberi mandat pengesahan kepada Wakil Ketua (J-M4). */
export function beriMandat(db: Db, d: IsiMandat): CatatanBidang {
  const p = profilJabatan(db, ['ketua'])
  if (!p) throw new GalatPpg('TIDAK_BERWENANG', 'Mandat hanya diberikan Ketua.')
  return simpanCatatan(db, { jenis: 'mandat', isi: { mulai: d.mulai, sampai: d.sampai, keterangan: d.keterangan?.trim() || null }, tanggal: d.mulai, judul: 'Mandat pengesahan untuk Wakil Ketua' })
}

/** Profil HP ini yang boleh mengesahkan hari ini: Ketua, atau Wakil Ketua dengan mandat berlaku. */
export function pengesahLokal(db: Db, tanggal: string = tanggalHariIni()): Profil | null {
  const k = profilJabatan(db, ['ketua'])
  if (k) return k
  const w = profilJabatan(db, ['wakil_ketua'])
  return w && mandatBerlaku(db, tanggal) ? w : null
}

/** Ketua (atau Wakil bermandat) mengesahkan notulen → keputusan menjadi sah, berlaku setelah diterapkan EXE Daerah. */
export function sahkanNotulen(db: Db, notulenId: string, o: { catatan?: string | null } = {}): CatatanBidang {
  const tanggal = tanggalHariIni()
  const p = pengesahLokal(db, tanggal)
  if (!p) throw new GalatPpg('TIDAK_BERWENANG', 'Hanya Ketua, atau Wakil Ketua yang diberi mandat, yang mengesahkan keputusan musyawarah.')
  const n = daftarCatatan(db, { jenis: 'notulen' }).find((c) => c.id === notulenId)
  if (!n?.isi) throw new GalatPpg('TIDAK_DITEMUKAN', 'Notulen tidak ditemukan.')
  return simpanCatatan(db, {
    jenis: 'pengesahan',
    id: idPengesahan(notulenId),
    isi: { notulen_id: notulenId, sidik: sidikNotulen(n), catatan: o.catatan?.trim() || null },
    rujukanId: notulenId,
    wilayahId: n.wilayah_id,
    tanggal,
    judul: p.nama,
  })
}

export interface NotulenTerbaca {
  catatan: CatatanTerbaca
  isi: IsiNotulen
  sidik: string
  status: StatusNotulen
  pengesahan: { id: string; oleh: string | null; tanggal: string; catatan: string | null } | null
  /** Butir yang bertaut kebijakan. */
  kebijakan: ButirKeputusan[]
}

function statusDari(db: Db, n: CatatanTerbaca, sidik: string, p: CatatanTerbaca | undefined): StatusNotulen {
  if (!p?.isi) return 'menunggu'
  if ((p.isi as { sidik?: string }).sidik !== sidik) return 'perlu_ulang'
  const kb = ((n.isi as unknown as IsiNotulen).keputusan ?? []).filter((b) => b.kunci && b.lingkup_id)
  if (!kb.length) return 'diterapkan'
  const semua = kb.every((b) => {
    const isi = bacaIsiKebijakan(db, String(b.kunci), String(b.lingkup_id))
    return !!isi && isi.riwayat.some((r) => r.dasar.pengesahan_id === p.id && r.dasar.notulen_id === n.id)
  })
  return semua || ambilMeta(db, `kbj_terapkan:${p.id}`) === sidik ? 'diterapkan' : 'disahkan'
}

/** Daftar notulen (terbaru dulu) + status pengesahan & penerapan. */
export function daftarNotulen(db: Db, o: { wilayahIds?: string[] } = {}): NotulenTerbaca[] {
  const pengesahan = new Map<string, CatatanTerbaca>()
  for (const p of daftarCatatan(db, { jenis: 'pengesahan' })) {
    const nid = (p.isi as { notulen_id?: string } | null)?.notulen_id
    if (nid && !pengesahan.has(nid)) pengesahan.set(nid, p)
  }
  return daftarCatatan(db, { jenis: 'notulen', wilayahIds: o.wilayahIds })
    .filter((c) => c.isi)
    .map((c) => {
      const sidik = sidikNotulen(c)
      const p = pengesahan.get(c.id)
      const isi = c.isi as unknown as IsiNotulen
      return {
        catatan: c,
        isi,
        sidik,
        status: statusDari(db, c, sidik, p),
        pengesahan: p ? { id: p.id, oleh: p.judul, tanggal: p.tanggal, catatan: (p.isi as { catatan?: string | null } | null)?.catatan ?? null } : null,
        kebijakan: (isi.keputusan ?? []).filter((b) => b.kunci),
      }
    })
}

// =====================================================================================================================
// Penerapan di EXE Daerah (J-M5)
// =====================================================================================================================

export interface HasilPenerapan {
  /** Butir kebijakan yang diterapkan. */
  diterapkan: number
  /** Butir yang ditolak (tidak akan dicoba lagi untuk pengesahan ini). */
  ditolak: { notulen_id: string; teks: string; alasan: string }[]
  /** Pengesahan yang belum bisa diterapkan (menunggu notulen, mandat, atau perlu disahkan ulang). */
  tertunda: { pengesahan_id: string; alasan: string }[]
  kunciKeuanganDiganti: boolean
}

/** Nama pengesah yang sah untuk catatan pengesahan (ketua, atau wakil dengan mandat pada tanggalnya), atau alasan. */
function pengesahSah(db: Db, p: CatatanTerbaca): { nama: string } | { alasan: string } {
  const tok = daftarPerangkat(db, { perangkatId: p.perangkat_id }).filter((t) => t.role === 'pengurus' && (!t.dicabut_pada || p.diubah_pada < t.dicabut_pada))
  const ketua = tok.find((t) => jabatanToken(t.token).includes('ketua'))
  if (ketua) return { nama: ketua.nama }
  const wakil = tok.find((t) => jabatanToken(t.token).includes('wakil_ketua'))
  if (!wakil) return { alasan: 'Pengesah tidak memegang jabatan Ketua/Wakil Ketua yang berlaku.' }
  return mandatBerlaku(db, p.tanggal) ? { nama: wakil.nama } : { alasan: 'Wakil Ketua belum diberi mandat pada tanggal pengesahan.' }
}

/**
 * EXE Daerah: terapkan keputusan yang sudah disahkan (dipanggil otomatis setelah impor SETOR). Idempoten per pengesahan +
 * sidik. Bila hak baca keuangan berubah, kunci keuangan diganti (J-M7).
 */
export function terapkanKeputusanTertunda(db: Db, kunci: KunciAdmin): HasilPenerapan {
  if (!adalahAdmin(db)) throw new GalatPpg('HANYA_ADMIN', 'Keputusan musyawarah diterapkan di EXE Daerah.')
  const hasil: HasilPenerapan = { diterapkan: 0, ditolak: [], tertunda: [], kunciKeuanganDiganti: false }
  const notulen = new Map(daftarCatatan(db, { jenis: 'notulen' }).map((c) => [c.id, c]))
  const daftar = daftarCatatan(db, { jenis: 'pengesahan' }).sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.diubah_pada.localeCompare(b.diubah_pada))
  let rotasi = false
  for (const p of daftar) {
    const x = p.isi as { notulen_id: string; sidik: string } | null
    if (!x) continue
    if (ambilMeta(db, `kbj_terapkan:${p.id}`) === x.sidik) continue
    const n = notulen.get(x.notulen_id)
    if (!n?.isi) {
      hasil.tertunda.push({ pengesahan_id: p.id, alasan: 'Notulen belum diterima daerah.' })
      continue
    }
    if (sidikNotulen(n) !== x.sidik) {
      hasil.tertunda.push({ pengesahan_id: p.id, alasan: 'Notulen berubah sesudah disahkan — perlu disahkan ulang.' })
      continue
    }
    const sah = pengesahSah(db, p)
    if ('alasan' in sah) {
      hasil.tertunda.push({ pengesahan_id: p.id, alasan: sah.alasan })
      continue
    }
    const isi = n.isi as unknown as IsiNotulen
    db.transaksi(() => {
      for (const b of isi.keputusan ?? []) {
        if (!b.kunci) continue
        const a = alasanLingkupKeputusan(db, n.wilayah_id, b)
        if (a) {
          hasil.ditolak.push({ notulen_id: n.id, teks: b.teks, alasan: a })
          continue
        }
        const ada = bacaIsiKebijakan(db, b.kunci, String(b.lingkup_id))
        if (ada && ada.dasar.tanggal > n.tanggal) {
          hasil.ditolak.push({ notulen_id: n.id, teks: b.teks, alasan: 'Sudah ada keputusan musyawarah yang lebih baru untuk kebijakan ini.' })
          continue
        }
        const sebelum = tulisKebijakan(db, {
          kunci: b.kunci,
          lingkupId: String(b.lingkup_id),
          nilai: b.nilai,
          dasar: { notulen_id: n.id, nomor: isi.nomor ?? null, tanggal: n.tanggal, jenis_musyawarah: isi.jenis_musyawarah, pengesahan_id: p.id },
          disahkanOleh: sah.nama,
          disahkanPada: p.tanggal,
        })
        if (b.kunci === 'hak_baca_keuangan' && !samaNilai([...(sebelum as string[])].sort(), [...(b.nilai as string[])].sort())) rotasi = true
        hasil.diterapkan++
      }
      aturMeta(db, `kbj_terapkan:${p.id}`, x.sidik)
    })
  }
  if (rotasi) {
    gantiKunciBidang(db, kunci, 'keuangan')
    hasil.kunciKeuanganDiganti = true
  }
  return hasil
}

// =====================================================================================================================
// Agenda, teks WA, ringkasan beranda (J-M8)
// =====================================================================================================================

export interface AgendaMusyawarah {
  bulan: string
  wilayah_id: string
  wilayah: string
  jenis: JenisMusyawarah
  judul: string
  /** Kebijakan Sementara / Belum ditetapkan dalam lingkup wilayah ini. */
  kebijakanSementara: BarisKebijakan[]
  /** Usulan butir agenda (kebijakan sementara + laporan bidang + lain-lain). */
  usulanAgenda: string[]
}

const tambahBulan = (bulan: string, n: number) => {
  const d = new Date(Date.UTC(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)) - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
export const namaBulan = (bulan: string) => `${NAMA_BULAN[Number(bulan.slice(5, 7)) - 1] ?? bulan} ${bulan.slice(0, 4)}`

/** Kebijakan yang masih sementara dalam lingkup wilayah (daerah: semua; desa: lingkup desanya; kelompok: tidak ada). */
export function kebijakanSementaraWilayah(db: Db, wilayahId: string): BarisKebijakan[] {
  const w = ambilWilayah(db, wilayahId)
  if (!w || w.tingkat === 'kelompok') return []
  return daftarKebijakan(db, { wilayahId: w.tingkat === 'desa' ? w.id : undefined }).filter(
    (k) => k.status !== 'ditetapkan' && (w.tingkat === 'daerah' || k.lingkup_id === w.id),
  )
}

/** Agenda musyawarah berikutnya untuk wilayah (bulan berjalan bila belum dilaksanakan, selain itu bulan depan). */
export function agendaMusyawarahBerikutnya(db: Db, wilayahId: string, tanggal: string = tanggalHariIni()): AgendaMusyawarah {
  const w = ambilWilayah(db, wilayahId)
  if (!w) throw new GalatPpg('WILAYAH_TIDAK_SAH', 'Wilayah tidak ditemukan.')
  const sudah = (bulan: string, jenis: JenisMusyawarah) =>
    daftarCatatan(db, { jenis: 'notulen', wilayahIds: [w.id], mulai: `${bulan}-01`, selesai: `${bulan}-31` }).some((c) => (c.isi as unknown as IsiNotulen | null)?.jenis_musyawarah === jenis)
  let bulan = tanggal.slice(0, 7)
  let jenis: JenisMusyawarah = w.tingkat === 'desa' ? 'desa' : w.tingkat === 'kelompok' ? 'lima_unsur' : 'bersama'
  for (let i = 0; i < 4; i++) {
    const b = tambahBulan(tanggal.slice(0, 7), i)
    let j: JenisMusyawarah = jenis
    if (w.tingkat === 'daerah') {
      const r = musyawarahBulan(b, db).jenis
      if (r === 'tidak_ada') continue
      j = r
    }
    if (i === 0 && sudah(b, j)) continue
    bulan = b
    jenis = j
    break
  }
  const kebijakanSementara = kebijakanSementaraWilayah(db, w.id)
  const usulanAgenda = [
    'Pembukaan & tilawah',
    ...kebijakanSementara.map((k) => `Penetapan ${k.judul}${k.lingkup === 'desa' && w.tingkat === 'daerah' ? ` — ${k.lingkup_nama}` : ''} (sementara: ${k.ringkas})`),
    'Laporan bidang & evaluasi program',
    'Lain-lain',
  ]
  return { bulan, wilayah_id: w.id, wilayah: w.nama, jenis, judul: `${LABEL_MUSYAWARAH[jenis]} ${namaBulan(bulan)}`, kebijakanSementara, usulanAgenda }
}

/** Teks WA undangan musyawarah (+ agenda). */
export function teksWaUndangan(db: Db, o: { wilayahId: string; tanggal: string; jam?: string | null; tempat?: string | null; agenda?: string[]; jenis?: JenisMusyawarah }): string {
  const w = ambilWilayah(db, o.wilayahId)
  const ag = agendaMusyawarahBerikutnya(db, o.wilayahId, o.tanggal)
  const jenis = o.jenis ?? ag.jenis
  const agenda = o.agenda?.length ? o.agenda : ag.usulanAgenda
  const baris = [
    "Assalamu'alaikum warohmatullohi wabarokatuh.",
    '',
    `*Undangan ${LABEL_MUSYAWARAH[jenis]}* — PPG ${w?.nama ?? ''}`,
    `Hari/tanggal: ${formatTanggal(o.tanggal)}`,
    ...(o.jam ? [`Jam: ${o.jam}`] : []),
    ...(o.tempat ? [`Tempat: ${o.tempat}`] : []),
    '',
    'Agenda:',
    ...agenda.map((a, i) => `${i + 1}. ${a}`),
    '',
    'Mohon hadir tepat waktu. Alhamdulillah jazakumullohu khoiro.',
  ]
  return baris.join('\n')
}

/** Teks WA hasil musyawarah: keputusan + status pengesahan. */
export function teksWaHasil(db: Db, notulenId: string): string {
  const n = daftarNotulen(db).find((x) => x.catatan.id === notulenId)
  if (!n) throw new GalatPpg('TIDAK_DITEMUKAN', 'Notulen tidak ditemukan.')
  const w = ambilWilayah(db, n.catatan.wilayah_id)
  const baris = [
    "Assalamu'alaikum warohmatullohi wabarokatuh.",
    '',
    `*Hasil ${LABEL_MUSYAWARAH[n.isi.jenis_musyawarah] ?? 'Musyawarah'}* — PPG ${w?.nama ?? ''}`,
    `No. ${n.isi.nomor ?? '—'} · ${formatTanggal(n.catatan.tanggal)}`,
    ...(n.isi.peserta ? [`Peserta: ${n.isi.peserta}`] : []),
  ]
  if (n.isi.agenda?.length) baris.push('', 'Agenda:', ...n.isi.agenda.map((a, i) => `${i + 1}. ${a}`))
  if (n.isi.hasil) baris.push('', n.isi.hasil)
  const kp = n.isi.keputusan ?? []
  if (kp.length) {
    baris.push('', 'Keputusan:')
    kp.forEach((b, i) => {
      const d = b.kunci ? defKebijakan(b.kunci) : undefined
      const lingkup = b.lingkup_id && d?.lingkup === 'desa' ? ` (${ambilWilayah(db, b.lingkup_id)?.nama ?? ''})` : ''
      baris.push(`${i + 1}. ${b.teks}${d ? ` → ${d.judul}${lingkup}: ${d.ringkas(b.nilai as never)}` : ''}`)
    })
  }
  if (n.isi.tindak_lanjut) baris.push('', `Tindak lanjut: ${n.isi.tindak_lanjut}`)
  baris.push(
    '',
    n.pengesahan && n.status !== 'perlu_ulang'
      ? `Disahkan ${n.pengesahan.oleh ?? 'Ketua'} (${formatTanggal(n.pengesahan.tanggal)}).`
      : 'Status: menunggu pengesahan Ketua — keputusan masih berupa usulan.',
    'Alhamdulillah jazakumullohu khoiro.',
  )
  return baris.join('\n')
}

export interface RingkasanMusyawarah {
  kebijakanSementara: number
  menungguPengesahan: number
  perluDisahkanUlang: number
  terakhir: { id: string; tanggal: string; jenis: JenisMusyawarah; nomor: string | null; status: StatusNotulen } | null
  berikutnya: AgendaMusyawarah | null
}

/** Ringkasan beranda Ketua/Sekretaris (HP) & EXE Daerah/Desa. */
export function ringkasanMusyawarah(db: Db, wilayahId: string, tanggal: string = tanggalHariIni()): RingkasanMusyawarah {
  const w = ambilWilayah(db, wilayahId)
  const notulen = daftarNotulen(db, w && w.tingkat !== 'daerah' ? { wilayahIds: [w.id] } : {})
  const t = notulen[0]
  return {
    kebijakanSementara: w ? kebijakanSementaraWilayah(db, w.id).length : 0,
    menungguPengesahan: notulen.filter((n) => n.status === 'menunggu').length,
    perluDisahkanUlang: notulen.filter((n) => n.status === 'perlu_ulang').length,
    terakhir: t ? { id: t.catatan.id, tanggal: t.catatan.tanggal, jenis: t.isi.jenis_musyawarah, nomor: t.isi.nomor ?? null, status: t.status } : null,
    berikutnya: w ? agendaMusyawarahBerikutnya(db, w.id, tanggal) : null,
  }
}
