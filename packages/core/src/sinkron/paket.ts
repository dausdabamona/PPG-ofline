// PAKET: admin → HP pengurus/mubaligh. Isi dienkripsi kunci berkas acak yang disegel untuk tiap perangkat penerima (T10).
import { daftarKunciSetor, kunciUmumKelompokVersi, type KunciAdmin } from '../admin'
import { dekompresJson, kemasBerkas, kompresJson, periksaBerkas, slug, type BerkasKeluar, type HeaderBerkas } from '../berkas'
import { bukaSegel, dariB64url, dariUtf8, dekripsiRahasia, enkripsiRahasia, keB64url, keUtf8, kunciAcak32, segelKe } from '../crypto'
import type { Db } from '../db'
import { gabungSemua, rekamanKirim, type HasilGabung, type RekamanPerTabel } from '../gabung'
import { GalatPpg } from '../galat'
import { ambilIdentitas, gabungKunciSetor } from '../perangkat'
import {
  daftarkanToken,
  daftarPencabutan,
  daftarPerangkat,
  gabungPencabutan,
  seqDiterima,
  type BarisPencabutan,
} from '../repo/perangkat'
import { daftarProfil, simpanRahasiaProfil, type Profil } from '../repo/profil'
import { adalahAdmin, ambilMeta, ambilMetaAngka, aturMeta, tandaTanya, type Rekaman } from '../repo/umum'
import { ambilWilayah, kelompokDalamWilayah, leluhurWilayah, turunanWilayah } from '../repo/wilayah'
import type { NamaTabelSinkron } from '../skema'
import { uraiToken, type KunciSetor } from '../token'
import { sekarangIso } from '../waktu'
import { bacaBerkasJenis, catatImpor, kunciAdminTerpasang, sidikBerkas } from './umum'

export interface IsiPaket {
  wilayah_id: string
  rekaman: RekamanPerTabel
  pencabutan: BarisPencabutan[]
  perangkat: { token: string; diterbitkan_oleh: string | null; label: string | null }[]
  konfirmasi: Record<string, number>
  /** perangkat_id → b64url(segelKe(box_pub, JSON {kelompok_id: KunciSetor[]})) — hanya untuk mubaligh. */
  kunci_setor: Record<string, string>
  /**
   * perangkat_id → b64url(segelKe(box_pub, JSON {kelompok_id: {versi, kunci}})) — kunci umum kelompok (JADWAL)
   * untuk pengurus/mubaligh tingkat kelompok. Kunci baru tiba di sini setelah serah terima (Fase 1b).
   */
  kunci_umum?: Record<string, string>
}

function pilih(db: Db, tabel: NamaTabelSinkron, kolom: string, nilai: string[], tambahan = ''): Rekaman[] {
  if (!nilai.length) return []
  return db.kueri<Rekaman>(`SELECT * FROM ${tabel} WHERE ${kolom} IN (${tandaTanya(nilai.length)}) ${tambahan}`, nilai)
}

function unik(rows: Rekaman[]): Rekaman[] {
  const m = new Map<string, Rekaman>()
  for (const r of rows) m.set(r.id, r)
  return [...m.values()]
}

/** Kumpulkan data master & kegiatan untuk sebuah wilayah (dipakai PAKET). */
export function dataWilayah(db: Db, wilayahId: string): RekamanPerTabel {
  const turunan = turunanWilayah(db, wilayahId)
  const leluhur = leluhurWilayah(db, wilayahId)
  const kel = kelompokDalamWilayah(db, wilayahId)
  const generusIds = [
    ...new Set([
      ...pilih(db, 'generus', 'kelompok_id', kel).map((g) => g.id),
      ...pilih(db, 'riwayat_keanggotaan', 'kelompok_id', kel).map((r) => String(r.generus_id)),
    ]),
  ]
  const perangkatIds = [...new Set(daftarPerangkat(db, { wilayahIds: turunan }).map((p) => p.perangkat_id))]
  const r: Record<string, Rekaman[]> = {
    wilayah: pilih(db, 'wilayah', 'id', [...turunan, ...leluhur]),
    generus: pilih(db, 'generus', 'id', generusIds),
    riwayat_keanggotaan: pilih(db, 'riwayat_keanggotaan', 'generus_id', generusIds),
    riwayat_status: pilih(db, 'riwayat_status', 'generus_id', generusIds),
    jamaah: pilih(db, 'jamaah', 'kelompok_id', kel),
    pengajian: pilih(db, 'pengajian', 'wilayah_id', [...turunan, ...leluhur]),
    penugasan_mubaligh: pilih(db, 'penugasan_mubaligh', 'kelompok_id', kel),
    koreksi: pilih(db, 'koreksi', 'untuk_perangkat_id', perangkatIds),
    presensi: pilih(db, 'presensi', 'kelompok_id', kel),
    kemajuan_belajar: unik([...pilih(db, 'kemajuan_belajar', 'kelompok_id', kel), ...pilih(db, 'kemajuan_belajar', 'generus_id', generusIds)]),
    penilaian_akhlaq: unik([...pilih(db, 'penilaian_akhlaq', 'kelompok_id', kel), ...pilih(db, 'penilaian_akhlaq', 'generus_id', generusIds)]),
    jadwal_tambahan: pilih(db, 'jadwal_tambahan', 'kelompok_id', kel),
    usulan: pilih(db, 'usulan', 'kelompok_id', kel),
  }
  const out: RekamanPerTabel = {}
  for (const [t, rows] of Object.entries(r)) if (rows.length) out[t as NamaTabelSinkron] = rekamanKirim(rows)
  return out
}

/**
 * Admin membuat PAKET untuk satu wilayah: master + kegiatan wilayah, koreksi, pencabutan, daftar token,
 * konfirmasi seq per perangkat, kunci kelompok setor untuk mubaligh. Hanya perangkat aktif (belum dicabut)
 * yang wilayahnya sama/di atas wilayah paket yang bisa membukanya.
 */
export function buatPaket(dbAdmin: Db, wilayahId: string, kunciAdmin: KunciAdmin): BerkasKeluar & { versi: number; penerima: number } {
  if (!adalahAdmin(dbAdmin)) throw new GalatPpg('BUKAN_DB_ADMIN', 'Paket hanya dibuat di aplikasi admin.')
  const w = ambilWilayah(dbAdmin, wilayahId)
  if (!w || w.dihapus) throw new GalatPpg('WILAYAH_TIDAK_SAH', 'Wilayah tidak ditemukan.')
  const cakupan = new Set([wilayahId, ...leluhurWilayah(dbAdmin, wilayahId)])
  const penerima = daftarPerangkat(dbAdmin, { role: ['pengurus', 'mubaligh'], aktifSaja: true }).filter((p) => cakupan.has(p.wilayah_id))
  if (!penerima.length) {
    throw new GalatPpg('TIDAK_ADA_PENERIMA', 'Belum ada pengurus/mubaligh aktif untuk wilayah ini. Terbitkan token dulu.')
  }
  const turunan = turunanWilayah(dbAdmin, wilayahId)
  const tokenWilayah = daftarPerangkat(dbAdmin, { wilayahIds: turunan })
  const konfirmasi: Record<string, number> = {}
  for (const p of [...tokenWilayah, ...penerima]) konfirmasi[p.perangkat_id] = seqDiterima(dbAdmin, p.perangkat_id)

  const kunciSetor: Record<string, string> = {}
  for (const p of penerima.filter((x) => x.role === 'mubaligh')) {
    const isiKunci = { [p.wilayah_id]: daftarKunciSetor(dbAdmin, kunciAdmin, p.wilayah_id, true) }
    kunciSetor[p.perangkat_id] = keB64url(segelKe(dariB64url(p.box_pub), keUtf8(JSON.stringify(isiKunci))))
  }
  const kunciUmum: Record<string, string> = {}
  for (const p of penerima.filter((x) => x.tingkat === 'kelompok')) {
    const ku = kunciUmumKelompokVersi(dbAdmin, kunciAdmin, p.wilayah_id)
    const segel = keB64url(segelKe(dariB64url(p.box_pub), keUtf8(JSON.stringify({ [p.wilayah_id]: ku }))))
    kunciUmum[p.perangkat_id] = segel
  }
  const isi: IsiPaket = {
    kunci_umum: kunciUmum,
    wilayah_id: wilayahId,
    rekaman: dataWilayah(dbAdmin, wilayahId),
    pencabutan: daftarPencabutan(dbAdmin, tokenWilayah.map((p) => p.id)),
    perangkat: tokenWilayah.map((p) => ({ token: p.token, diterbitkan_oleh: p.diterbitkan_oleh, label: p.label })),
    konfirmasi,
    kunci_setor: kunciSetor,
  }
  const kunciBerkas = kunciAcak32()
  const kunciPenerima: Record<string, string> = {}
  for (const p of penerima) kunciPenerima[p.perangkat_id] = keB64url(segelKe(dariB64url(p.box_pub), kunciBerkas))

  const versi = ambilMetaAngka(dbAdmin, `versi_paket:${wilayahId}`) + 1
  const header: HeaderBerkas = {
    jenis: 'PAKET',
    versi_format: 1,
    org_id: kunciAdmin.orgId,
    pengirim_perangkat_id: 'ADMIN',
    dibuat_pada: sekarangIso(),
    wilayah_id: wilayahId,
    versi,
    kunci_penerima: kunciPenerima,
  }
  const bytes = kemasBerkas(header, enkripsiRahasia(kunciBerkas, kompresJson(isi)), kunciAdmin.tandaTangan.rahasia)
  aturMeta(dbAdmin, `versi_paket:${wilayahId}`, versi)
  return { nama: `PPG_PAKET_${slug(w.nama)}_v${versi}.ppg`, bytes, header, versi, penerima: Object.keys(kunciPenerima).length }
}

export interface RingkasanTerapkan {
  jenis: 'PAKET' | 'BALASAN' | 'JADWAL' | 'MATERI'
  versi?: number
  perTabel: Partial<Record<NamaTabelSinkron, HasilGabung>>
  total: HasilGabung
  pencabutanBaru: number
  /** Profil HP ini yang berubah status karena pencabutan/pembekuan. */
  profilTerdampak: { id: string; nama: string; dibekukan: boolean; dicabut: boolean }[]
}

/** Potret status profil (untuk mendeteksi perubahan setelah menerapkan berkas). */
export function potretProfil(db: Db): Map<string, string> {
  return new Map(daftarProfil(db).map((p) => [p.id, `${p.dibekukan}|${p.dicabut_pada}`]))
}

/** Profil yang statusnya berubah dibanding potret sebelumnya. */
export function profilBerubah(db: Db, sebelum: Map<string, string>): RingkasanTerapkan['profilTerdampak'] {
  return daftarProfil(db)
    .filter((p) => sebelum.get(p.id) !== `${p.dibekukan}|${p.dicabut_pada}`)
    .map((p) => ({ id: p.id, nama: p.nama, dibekukan: p.dibekukan, dicabut: !!p.dicabut_pada }))
}

/**
 * HP menerapkan PAKET: tolak versi ≤ terpasang, buka dengan kunci perangkat, gabung sebagai sumber admin,
 * perbarui konfirmasi_seq, daftar token, pencabutan, kunci kelompok setor.
 */
export function terapkanPaket(db: Db, bytes: Uint8Array, namaBerkas?: string): RingkasanTerapkan {
  const admin = kunciAdminTerpasang(db)
  const b = bacaBerkasJenis(db, bytes, 'PAKET')
  if (!periksaBerkas(b, dariB64url(admin.signPub))) {
    throw new GalatPpg('TANDA_TANGAN_TIDAK_SAH', 'Tanda tangan paket tidak sah (bukan dari admin Anda atau berkas diubah).')
  }
  const wilayahId = b.header.wilayah_id ?? ''
  const versi = Number(b.header.versi ?? 0)
  const terpasang = ambilMetaAngka(db, `versi_paket:${wilayahId}`)
  const dibuatTerpasang = ambilMeta(db, `paket_dibuat:${wilayahId}`) ?? ''
  if (!berkasLebihBaru(versi, b.header.dibuat_pada, terpasang, dibuatTerpasang)) {
    throw new GalatPpg('PAKET_LAMA', `Paket ini (v${versi}) tidak lebih baru dari yang sudah terpasang (v${terpasang}).`)
  }
  const identitas = ambilIdentitas(db)
  const segel = b.header.kunci_penerima?.[identitas.id]
  if (!segel) throw new GalatPpg('BUKAN_PENERIMA', 'Paket ini bukan untuk HP ini (atau token HP ini sudah dicabut).')
  const kunciBerkas = bukaSegel(dariB64url(segel), identitas.kotak)
  const isi = dekompresJson<IsiPaket>(dekripsiRahasia(kunciBerkas, b.isi))
  if (isi.wilayah_id !== wilayahId) throw new GalatPpg('BERKAS_TIDAK_SAH', 'Isi paket tidak cocok dengan kepalanya.')

  const sebelum = potretProfil(db)
  return db.transaksi(() => {
    const g = gabungSemua(db, isi.rekaman ?? {}, { sumber: 'admin', seqLokalBaru: 0 })
    for (const t of isi.perangkat ?? []) {
      try {
        const p = uraiToken(t.token).payload
        if (p.org_id !== admin.orgId) continue
        daftarkanToken(db, p, t.token, { label: t.label, diterbitkanOleh: t.diterbitkan_oleh })
      } catch {
        // token rusak diabaikan
      }
    }
    const pencabutanBaru = gabungPencabutan(db, isi.pencabutan ?? [])
    const konf = Number(isi.konfirmasi?.[identitas.id] ?? 0)
    if (konf > ambilMetaAngka(db, 'konfirmasi_seq')) aturMeta(db, 'konfirmasi_seq', konf)
    const segelKunci = isi.kunci_setor?.[identitas.id]
    if (segelKunci) {
      const peta = JSON.parse(dariUtf8(bukaSegel(dariB64url(segelKunci), identitas.kotak))) as Record<string, KunciSetor[]>
      for (const p of daftarProfil(db, 'mubaligh')) {
        const baru = peta[p.wilayah_id]
        if (baru) simpanRahasiaProfil(db, p.id, { ...p.rahasia, kunci_kelompok_setor: gabungKunciSetor(p.rahasia.kunci_kelompok_setor, baru) })
      }
    }
    const segelUmum = isi.kunci_umum?.[identitas.id]
    if (segelUmum) {
      const peta = JSON.parse(dariUtf8(bukaSegel(dariB64url(segelUmum), identitas.kotak))) as Record<string, { versi: number; kunci: string }>
      for (const p of daftarProfil(db, ['pengurus', 'mubaligh'])) perbaruiKunciUmum(db, p, peta[p.wilayah_id])
    }
    aturMeta(db, `versi_paket:${wilayahId}`, Math.max(versi, terpasang))
    if (b.header.dibuat_pada > dibuatTerpasang) aturMeta(db, `paket_dibuat:${wilayahId}`, b.header.dibuat_pada)
    aturMeta(db, 'terakhir_paket', sekarangIso())
    const ringkasan: RingkasanTerapkan = {
      jenis: 'PAKET',
      versi,
      perTabel: g.perTabel,
      total: g.total,
      pencabutanBaru,
      profilTerdampak: profilBerubah(db, sebelum),
    }
    catatImpor(db, b.header, ringkasan, sidikBerkas(bytes), namaBerkas)
    return ringkasan
  })
}

/**
 * Berkas admin (PAKET/MATERI) diterima bila versinya ATAU cap waktunya lebih baru dari yang terpasang.
 * Berkas lama yang diputar ulang punya keduanya ≤ terpasang → ditolak; admin yang memulihkan database dari
 * cadangan (nomor versi mundur, cap waktu maju) tetap diterima (Fase 1b).
 */
export function berkasLebihBaru(versi: number, dibuat: string, versiTerpasang: number, dibuatTerpasang: string): boolean {
  return versi > versiTerpasang || (!!dibuatTerpasang && dibuat > dibuatTerpasang)
}

/** Ganti kunci umum kelompok profil bila versi yang diterima lebih baru (atau profil belum punya). */
export function perbaruiKunciUmum(db: Db, p: Profil, baru: { versi: number; kunci: string } | undefined): boolean {
  if (!baru || typeof baru.kunci !== 'string' || typeof baru.versi !== 'number') return false
  const versiLama = p.rahasia.kunci_umum_kelompok ? (p.rahasia.kunci_umum_versi ?? 1) : 0
  if (baru.versi <= versiLama) return false
  simpanRahasiaProfil(db, p.id, { ...p.rahasia, kunci_umum_kelompok: baru.kunci, kunci_umum_versi: baru.versi })
  return true
}

/** Versi paket yang terpasang di HP untuk wilayah tertentu (0 = belum ada). */
export function versiPaketTerpasang(db: Db, wilayahId: string): number {
  return ambilMetaAngka(db, `versi_paket:${wilayahId}`)
}

