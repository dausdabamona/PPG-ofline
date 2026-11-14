// Siklus hidup generus & mubaligh: pindah kelompok (K10), ubah status/mondok (K11), serah terima mubaligh.
import { cabutPerangkat, bekukanPerangkat, cairkanPerangkat, gantiKunciKelompok, type KunciAdmin } from './admin'
import type { BerkasKeluar } from './berkas'
import type { Db } from './db'
import { GalatPpg } from './galat'
import { ambilGenerus, STATUS_GENERUS, type StatusGenerus } from './repo/generus'
import { daftarPerangkat, type PerangkatTerdaftar } from './repo/perangkat'
import { pastikanAdmin, sisipkanRekaman, ubahRekaman } from './repo/umum'
import { ambilWilayah } from './repo/wilayah'
import { buatSetor } from './sinkron/setor'
import { tanggalHariIni, tanggalSah } from './waktu'

/** Token generus/wali yang HANYA memegang generus ini (token wali dengan anak lain tidak tersentuh). */
export function tokenMilikGenerusSaja(db: Db, generusId: string): PerangkatTerdaftar[] {
  return daftarPerangkat(db, { role: ['generus', 'wali'] }).filter(
    (p) => p.generus_ids.length > 0 && p.generus_ids.every((g) => g === generusId),
  )
}

function tutupRiwayat(db: Db, tabel: 'riwayat_keanggotaan' | 'riwayat_status', generusId: string, tanggal: string): void {
  const terbuka = db.kueri<{ id: string; mulai: string }>(
    `SELECT id, mulai FROM ${tabel} WHERE generus_id = ? AND selesai IS NULL AND dihapus = 0`,
    [generusId],
  )
  for (const r of terbuka) {
    if (r.mulai > tanggal) throw new GalatPpg('TANGGAL_TIDAK_SAH', 'Tanggal perubahan lebih awal dari riwayat sebelumnya.')
    ubahRekaman(db, tabel, r.id, { selesai: tanggal })
  }
}

/**
 * Pindahkan generus ke kelompok lain mulai `tanggal` (admin). Riwayat keanggotaan ditutup & dibuka,
 * kemajuan belajar tetap ikut generus. Token generus lama (terikat kelompok lama) dicabut;
 * mubaligh kelompok baru menerbitkan token baru.
 */
export function pindahKelompok(db: Db, generusId: string, kelompokTujuanId: string, tanggal: string): void {
  pastikanAdmin(db)
  if (!tanggalSah(tanggal)) throw new GalatPpg('TANGGAL_TIDAK_SAH', 'Tanggal pindah tidak sah.')
  const g = ambilGenerus(db, generusId)
  if (!g || g.dihapus) throw new GalatPpg('TIDAK_DITEMUKAN', 'Generus tidak ditemukan.')
  const tujuan = ambilWilayah(db, kelompokTujuanId)
  if (!tujuan || tujuan.dihapus || tujuan.tingkat !== 'kelompok') throw new GalatPpg('KELOMPOK_TIDAK_SAH', 'Kelompok tujuan tidak ditemukan.')
  if (g.kelompok_id === kelompokTujuanId) throw new GalatPpg('KELOMPOK_SAMA', 'Generus sudah berada di kelompok itu.')
  db.transaksi(() => {
    tutupRiwayat(db, 'riwayat_keanggotaan', generusId, tanggal)
    sisipkanRekaman(db, 'riwayat_keanggotaan', { generus_id: generusId, kelompok_id: kelompokTujuanId, mulai: tanggal, selesai: null })
    ubahRekaman(db, 'generus', generusId, { kelompok_id: kelompokTujuanId })
    for (const t of tokenMilikGenerusSaja(db, generusId)) if (t.wilayah_id !== kelompokTujuanId) cabutPerangkat(db, t.id)
  })
}

/**
 * Ubah status generus mulai `tanggal` (admin): mondok → token dibekukan; aktif → dicairkan;
 * lulus_menikah/keluar/pindah → token dicabut.
 */
export function ubahStatus(db: Db, generusId: string, status: StatusGenerus, tanggal: string, keterangan: string | null = null): void {
  pastikanAdmin(db)
  if (!STATUS_GENERUS.includes(status)) throw new GalatPpg('STATUS_TIDAK_SAH', 'Status generus tidak dikenal.')
  if (!tanggalSah(tanggal)) throw new GalatPpg('TANGGAL_TIDAK_SAH', 'Tanggal tidak sah.')
  const g = ambilGenerus(db, generusId)
  if (!g || g.dihapus) throw new GalatPpg('TIDAK_DITEMUKAN', 'Generus tidak ditemukan.')
  if (g.status === status) throw new GalatPpg('STATUS_SAMA', `Generus sudah berstatus ${status}.`)
  db.transaksi(() => {
    tutupRiwayat(db, 'riwayat_status', generusId, tanggal)
    sisipkanRekaman(db, 'riwayat_status', { generus_id: generusId, status, mulai: tanggal, selesai: null, keterangan })
    ubahRekaman(db, 'generus', generusId, { status })
    for (const t of tokenMilikGenerusSaja(db, generusId)) {
      if (t.dicabut_pada) continue
      if (status === 'mondok') bekukanPerangkat(db, t.id)
      else if (status === 'aktif') cairkanPerangkat(db, t.id)
      else cabutPerangkat(db, t.id)
    }
  })
}

/** Cari token mubaligh menurut token_id atau perangkat_id. */
function tokenMubaligh(db: Db, idAtauPerangkat: string, kelompokId?: string): PerangkatTerdaftar[] {
  return daftarPerangkat(db, { role: 'mubaligh' }).filter(
    (p) => (p.id === idAtauPerangkat || p.perangkat_id === idAtauPerangkat) && (!kelompokId || p.wilayah_id === kelompokId),
  )
}

export interface StatusSetorAkhir {
  adaSetorAkhir: boolean
  urutSetorAkhir: number | null
  seqDiterima: number
  /** true bila Setor Akhir sudah diterima utuh (seq_diterima ≥ urut Setor Akhir). */
  lengkap: boolean
}

/** Status Setor Akhir mubaligh lama (admin). `perangkatLamaId` = token_id atau perangkat_id. */
export function statusSetorAkhir(db: Db, perangkatLamaId: string): StatusSetorAkhir {
  const t = tokenMubaligh(db, perangkatLamaId)
  if (!t.length) throw new GalatPpg('TIDAK_DITEMUKAN', 'Token mubaligh tidak ditemukan.')
  const urut = t.map((x) => x.setor_akhir_urut).filter((x): x is number => x !== null)
  const urutSetorAkhir = urut.length ? Math.max(...urut) : null
  const seqDiterima = Math.max(...t.map((x) => x.seq_diterima))
  return { adaSetorAkhir: urutSetorAkhir !== null, urutSetorAkhir, seqDiterima, lengkap: urutSetorAkhir !== null && seqDiterima >= urutSetorAkhir }
}

/**
 * Serah terima mubaligh (admin): prasyarat Setor Akhir lengkap (kecuali `paksa`, mis. HP hilang),
 * cabut token mubaligh lama, tutup penugasannya, lalu ganti kunci kelompok setor.
 */
export function serahTerimaMubaligh(
  db: Db,
  kunci: KunciAdmin,
  o: { kelompokId: string; perangkatLamaId: string; paksa?: boolean; tanggal?: string },
): { versiKunciBaru: number; tokenDicabut: string[] } {
  pastikanAdmin(db)
  const t = tokenMubaligh(db, o.perangkatLamaId, o.kelompokId)
  if (!t.length) throw new GalatPpg('TIDAK_DITEMUKAN', 'Mubaligh lama tidak ditemukan di kelompok ini.')
  if (!o.paksa) {
    const st = statusSetorAkhir(db, o.perangkatLamaId)
    if (!st.lengkap) {
      throw new GalatPpg('SETOR_AKHIR_BELUM', 'Setor Akhir mubaligh lama belum diterima. Minta mubaligh lama mengirim Setor Akhir dulu.')
    }
  }
  return db.transaksi(() => {
    const dicabut: string[] = []
    for (const x of t) {
      if (!x.dicabut_pada) {
        cabutPerangkat(db, x.id)
        dicabut.push(x.id)
      }
    }
    const tgl = o.tanggal ?? tanggalHariIni()
    const pen = db.kueri<{ id: string }>(
      'SELECT id FROM penugasan_mubaligh WHERE kelompok_id = ? AND perangkat_mubaligh_id IN (' + t.map(() => '?').join(',') + ') AND selesai IS NULL AND dihapus = 0',
      [o.kelompokId, ...t.map((x) => x.perangkat_id)],
    )
    for (const p of pen) ubahRekaman(db, 'penugasan_mubaligh', p.id, { selesai: tgl })
    const versiKunciBaru = gantiKunciKelompok(db, kunci, o.kelompokId)
    return { versiKunciBaru, tokenDicabut: dicabut }
  })
}

/** HP mubaligh: Setor Akhir = setoran biasa dengan penanda `setor_akhir` (sebelum serah terima). */
export function setorAkhir(db: Db): BerkasKeluar {
  return buatSetor(db, { setorAkhir: true })
}
