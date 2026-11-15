// KURIKULUM (v3, V5): EXE kurikulum → daerah. Materi + target capaian + periode aktif yang disunting di EXE kurikulum,
// disegel ke kunci kotak daerah, ditandatangani perangkat kurikulum (token kurikulum berantai ke daerah).
// Daerah mengimpornya ke master, lalu turun ke semua lewat berkas MATERI (dan PAKET untuk target/periode).
import type { KunciAdmin } from '../admin'
import { dekompresJson, kemasBerkas, kompresJson, periksaBerkas, type BerkasKeluar, type HeaderBerkas } from '../berkas'
import { bukaSegel, dariB64url, segelKe } from '../crypto'
import type { Db } from '../db'
import { gabungSemua, rekamanKirim, type HasilGabung, type RekamanPerTabel } from '../gabung'
import { GalatPpg } from '../galat'
import { ambilIdentitas } from '../perangkat'
import { opsiPeriksaDb } from '../rantai'
import { daftarkanToken } from '../repo/perangkat'
import { daftarProfil, pastikanProfilBolehMencatat } from '../repo/profil'
import { adalahAdmin, ambilMetaAngka, aturMeta, peranInstalasi, type Rekaman } from '../repo/umum'
import type { NamaTabelSinkron } from '../skema'
import { periksaToken } from '../token'
import { sekarangIso, tanggalRingkas } from '../waktu'
import { bacaBerkasJenis, catatImpor, imporTerdahulu, kunciAdminTerpasang, sidikBerkas } from './umum'

/** Tabel yang dibawa berkas KURIKULUM. */
export const TABEL_KURIKULUM: readonly NamaTabelSinkron[] = ['bidang_materi', 'kategori_materi', 'materi', 'target_capaian', 'pengaturan']

export interface IsiKurikulum {
  tokens: string[]
  rekaman: RekamanPerTabel
}

/** Jumlah rekaman kurikulum yang disunting sejak berkas KURIKULUM terakhir dibuat (indikator "belum dikirim"). */
export function jumlahSuntinganKurikulum(db: Db): number {
  const sejak = ambilMetaAngka(db, 'kurikulum_terkirim_seq')
  let n = 0
  for (const t of TABEL_KURIKULUM) n += db.nilai<number>(`SELECT COUNT(*) FROM ${t} WHERE seq_lokal > ?`, [sejak]) ?? 0
  return n
}

/**
 * EXE kurikulum membuat berkas KURIKULUM untuk daerah: semua rekaman kurikulum yang disunting di sini (seq_lokal > 0),
 * kumulatif (berkas yang hilang tidak menghilangkan suntingan; impor ulang idempoten).
 */
export function buatKurikulum(db: Db): BerkasKeluar & { jumlah: number } {
  if (peranInstalasi(db) !== 'kurikulum') throw new GalatPpg('PERAN_SALAH', 'Berkas KURIKULUM dibuat di EXE kurikulum.')
  const admin = kunciAdminTerpasang(db)
  const identitas = ambilIdentitas(db)
  const p = daftarProfil(db, 'kurikulum')[0]
  if (!p) throw new GalatPpg('TIDAK_ADA_PROFIL', 'EXE kurikulum belum diaktifkan.')
  pastikanProfilBolehMencatat(p)
  const rekaman: RekamanPerTabel = {}
  let jumlah = 0
  for (const t of TABEL_KURIKULUM) {
    const rows = db.kueri<Rekaman>(`SELECT * FROM ${t} WHERE seq_lokal > 0 ORDER BY seq_lokal`)
    if (rows.length) {
      rekaman[t] = rekamanKirim(rows)
      jumlah += rows.length
    }
  }
  const isi: IsiKurikulum = { tokens: [p.token], rekaman }
  const header: HeaderBerkas = {
    jenis: 'KURIKULUM',
    versi_format: 1,
    org_id: admin.orgId,
    pengirim_perangkat_id: identitas.id,
    dibuat_pada: sekarangIso(),
    penerima_perangkat_id: 'ADMIN',
  }
  const bytes = kemasBerkas(header, segelKe(dariB64url(admin.boxPub), kompresJson(isi)), identitas.tandaTangan.rahasia)
  aturMeta(db, 'terakhir_kurikulum', sekarangIso())
  aturMeta(db, 'kurikulum_terkirim_seq', ambilMetaAngka(db, 'seq'))
  return { nama: `PPG_KURIKULUM_${tanggalRingkas()}.ppg`, bytes, header, jumlah }
}

export interface RingkasanImporKurikulum {
  jenis: 'KURIKULUM'
  pengirimPerangkatId: string
  pengirim: string
  sudahPernah: boolean
  perTabel: Partial<Record<NamaTabelSinkron, HasilGabung>>
  total: HasilGabung
}

/** Daerah mengimpor berkas KURIKULUM ke master (materi, target capaian, periode aktif). Idempoten. */
export function imporKurikulum(dbDaerah: Db, bytes: Uint8Array, kunciAdmin: KunciAdmin, namaBerkas?: string): RingkasanImporKurikulum {
  if (!adalahAdmin(dbDaerah)) throw new GalatPpg('BUKAN_DB_ADMIN', 'Berkas KURIKULUM diimpor di EXE daerah.')
  const b = bacaBerkasJenis(dbDaerah, bytes, 'KURIKULUM')
  if (b.header.org_id !== kunciAdmin.orgId) throw new GalatPpg('ORG_BERBEDA', 'Berkas ini untuk organisasi lain.')
  const sidik = sidikBerkas(bytes)
  const lama = imporTerdahulu<RingkasanImporKurikulum>(dbDaerah, sidik)
  if (lama) return { ...lama, sudahPernah: true }
  let isi: IsiKurikulum
  try {
    isi = dekompresJson<IsiKurikulum>(bukaSegel(b.isi, kunciAdmin.kotak))
  } catch {
    throw new GalatPpg('TIDAK_BISA_DIBUKA', 'Berkas kurikulum tidak bisa dibuka dengan kunci daerah ini.')
  }
  const opsi = opsiPeriksaDb(dbDaerah)
  let pengirim: string | null = null
  for (const teks of Array.isArray(isi.tokens) ? isi.tokens : []) {
    const h = periksaToken(teks, opsi)
    if (!h.sah || h.payload.role !== 'kurikulum' || h.payload.perangkat_id !== b.header.pengirim_perangkat_id) continue
    if (!periksaBerkas(b, dariB64url(h.payload.device_sign_pub))) continue
    daftarkanToken(dbDaerah, h.payload, teks)
    pengirim = h.payload.nama
  }
  if (!pengirim) throw new GalatPpg('PENGIRIM_TIDAK_SAH', 'Berkas kurikulum ditolak: token/tanda tangan kurikulum tidak sah atau sudah dicabut.')
  return dbDaerah.transaksi(() => {
    const masuk: RekamanPerTabel = {}
    for (const t of TABEL_KURIKULUM) if (Array.isArray(isi.rekaman?.[t])) masuk[t] = isi.rekaman[t]
    const g = gabungSemua(dbDaerah, masuk, (tabel) => ({
      sumber: 'admin',
      seqLokalBaru: 0,
      periksa: (rek) => (tabel === 'pengaturan' && rek.id !== 'periode_aktif' ? 'Pengaturan ini bukan wewenang kurikulum.' : null),
    }))
    const ringkasan: RingkasanImporKurikulum = {
      jenis: 'KURIKULUM',
      pengirimPerangkatId: b.header.pengirim_perangkat_id,
      pengirim,
      sudahPernah: false,
      perTabel: g.perTabel,
      total: g.total,
    }
    catatImpor(dbDaerah, b.header, ringkasan, sidik, namaBerkas)
    return ringkasan
  })
}
