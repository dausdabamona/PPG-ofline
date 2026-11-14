// MATERI: admin → semua (tanpa enkripsi, gzip + tanda tangan admin).
import type { KunciAdmin } from '../admin'
import { dekompresJson, kemasBerkas, kompresJson, periksaBerkas, type BerkasKeluar, type HeaderBerkas } from '../berkas'
import { dariB64url } from '../crypto'
import type { Db } from '../db'
import { gabungSemua, rekamanKirim, type RekamanPerTabel } from '../gabung'
import { GalatPpg } from '../galat'
import { adalahAdmin, ambilMeta, ambilMetaAngka, aturMeta, type Rekaman } from '../repo/umum'
import { sekarangIso } from '../waktu'
import { berkasLebihBaru, type RingkasanTerapkan } from './paket'
import { bacaBerkasJenis, catatImpor, kunciAdminTerpasang, sidikBerkas } from './umum'

/** Admin membuat berkas MATERI: semua bidang, kategori, materi (termasuk PDF base64). */
export function buatMateri(dbAdmin: Db, kunciAdmin: KunciAdmin): BerkasKeluar & { versi: number } {
  if (!adalahAdmin(dbAdmin)) throw new GalatPpg('BUKAN_DB_ADMIN', 'Berkas materi dibuat di aplikasi admin.')
  const rekaman: RekamanPerTabel = {
    bidang_materi: rekamanKirim(dbAdmin.kueri<Rekaman>('SELECT * FROM bidang_materi')),
    kategori_materi: rekamanKirim(dbAdmin.kueri<Rekaman>('SELECT * FROM kategori_materi')),
    materi: rekamanKirim(dbAdmin.kueri<Rekaman>('SELECT * FROM materi')),
  }
  const versi = ambilMetaAngka(dbAdmin, 'versi_materi_terbit') + 1
  const header: HeaderBerkas = {
    jenis: 'MATERI',
    versi_format: 1,
    org_id: kunciAdmin.orgId,
    pengirim_perangkat_id: 'ADMIN',
    dibuat_pada: sekarangIso(),
    versi,
  }
  const bytes = kemasBerkas(header, kompresJson({ rekaman }), kunciAdmin.tandaTangan.rahasia)
  aturMeta(dbAdmin, 'versi_materi_terbit', versi)
  return { nama: `PPG_MATERI_v${versi}.ppg`, bytes, header, versi }
}

/** HP menerapkan MATERI (versi harus lebih baru dari yang terpasang). */
export function terapkanMateri(db: Db, bytes: Uint8Array, namaBerkas?: string): RingkasanTerapkan {
  const admin = kunciAdminTerpasang(db)
  const b = bacaBerkasJenis(db, bytes, 'MATERI')
  if (!periksaBerkas(b, dariB64url(admin.signPub))) throw new GalatPpg('TANDA_TANGAN_TIDAK_SAH', 'Tanda tangan berkas materi tidak sah.')
  const versi = Number(b.header.versi ?? 0)
  const terpasang = ambilMetaAngka(db, 'versi_materi')
  const dibuatTerpasang = ambilMeta(db, 'materi_dibuat') ?? ''
  if (!berkasLebihBaru(versi, b.header.dibuat_pada, terpasang, dibuatTerpasang)) throw new GalatPpg('MATERI_LAMA', `Materi v${versi} tidak lebih baru dari yang terpasang (v${terpasang}).`)
  const isi = dekompresJson<{ rekaman: RekamanPerTabel }>(b.isi)
  return db.transaksi(() => {
    const r = isi.rekaman ?? {}
    const g = gabungSemua(
      db,
      { bidang_materi: r.bidang_materi ?? [], kategori_materi: r.kategori_materi ?? [], materi: r.materi ?? [] },
      { sumber: 'admin', seqLokalBaru: 0 },
    )
    aturMeta(db, 'versi_materi', Math.max(versi, terpasang))
    if (b.header.dibuat_pada > dibuatTerpasang) aturMeta(db, 'materi_dibuat', b.header.dibuat_pada)
    const ringkasan: RingkasanTerapkan = { jenis: 'MATERI', versi, perTabel: g.perTabel, total: g.total, pencabutanBaru: 0, profilTerdampak: [] }
    catatImpor(db, b.header, ringkasan, sidikBerkas(bytes), namaBerkas)
    return ringkasan
  })
}
