// JADWAL: HP mubaligh → grup WA kelompok (dienkripsi kunci umum kelompok, K16).
import { dekompresJson, kemasBerkas, kompresJson, slug, type BerkasKeluar, type HeaderBerkas } from '../berkas'
import { dariB64url, dekripsiRahasia, enkripsiRahasia } from '../crypto'
import type { Db } from '../db'
import { gabungSemua, rekamanKirim, type RekamanPerTabel } from '../gabung'
import { GalatPpg } from '../galat'
import { ambilIdentitas } from '../perangkat'
import { daftarProfil, pastikanProfilBolehMencatat } from '../repo/profil'
import { ambilMeta, aturMeta, tandaTanya, uraiJson, type Rekaman } from '../repo/umum'
import { ambilWilayah, leluhurWilayah } from '../repo/wilayah'
import { daftarPencabutan, daftarPerangkat, gabungPencabutan, type BarisPencabutan } from '../repo/perangkat'
import { rantaiWilayah } from './balasan'
import { sekarangIso } from '../waktu'
import { potretProfil, profilBerubah, type RingkasanTerapkan } from './paket'
import { periksaPengirimMubaligh } from './pengirim'
import { bacaBerkasJenis, catatImpor, kunciAdminTerpasang, sidikBerkas } from './umum'

interface IsiJadwal {
  kelompok_id: string
  token_pengirim: string
  rekaman: RekamanPerTabel
  /** Pencabutan token mubaligh kelompok (agar anggota menolak berkas mubaligh lama). */
  pencabutan?: BarisPencabutan[]
}

interface CatatanJadwal {
  pengirim: string
  versi: number
  dibuat_pada: string
}

/** Mubaligh membuat berkas JADWAL: pengajian rutin (kelompok + induk) + jadwal tambahan kelompok. */
export function buatJadwal(dbMubaligh: Db, opsi: { kelompokId?: string } = {}): BerkasKeluar & { versi: number } {
  const admin = kunciAdminTerpasang(dbMubaligh)
  const identitas = ambilIdentitas(dbMubaligh)
  const profil = daftarProfil(dbMubaligh, 'mubaligh').filter((p) => !opsi.kelompokId || p.wilayah_id === opsi.kelompokId)
  const m = profil[0]
  if (!m) throw new GalatPpg('TIDAK_ADA_PROFIL', 'Tidak ada profil mubaligh di HP ini.')
  pastikanProfilBolehMencatat(m)
  const kunci = m.rahasia.kunci_umum_kelompok
  if (!kunci) throw new GalatPpg('KUNCI_TIDAK_ADA', 'Kunci umum kelompok tidak ada di token mubaligh.')
  const kel = m.wilayah_id
  const wil = [kel, ...leluhurWilayah(dbMubaligh, kel)]
  const pengajian = dbMubaligh.kueri<Rekaman>(`SELECT * FROM pengajian WHERE wilayah_id IN (${tandaTanya(wil.length)})`, wil)
  const tambahan = dbMubaligh.kueri<Rekaman>('SELECT * FROM jadwal_tambahan WHERE kelompok_id = ?', [kel])
  const isi: IsiJadwal = {
    kelompok_id: kel,
    token_pengirim: m.token,
    rekaman: { pengajian: rekamanKirim(pengajian), jadwal_tambahan: rekamanKirim(tambahan) },
    pencabutan: daftarPencabutan(dbMubaligh, daftarPerangkat(dbMubaligh, { role: 'mubaligh', wilayahIds: [kel] }).map((t) => t.id)),
  }
  const kunciMeta = `versi_jadwal_terbit:${kel}`
  const versi = Number(ambilMeta(dbMubaligh, kunciMeta) ?? 0) + 1
  const header: HeaderBerkas = {
    jenis: 'JADWAL',
    versi_format: 1,
    org_id: admin.orgId,
    pengirim_perangkat_id: identitas.id,
    dibuat_pada: sekarangIso(),
    wilayah_id: kel,
    versi,
  }
  const bytes = kemasBerkas(header, enkripsiRahasia(dariB64url(kunci), kompresJson(isi)), identitas.tandaTangan.rahasia)
  aturMeta(dbMubaligh, kunciMeta, versi)
  return { nama: `PPG_JADWAL_${slug(ambilWilayah(dbMubaligh, kel)?.nama ?? kel)}_v${versi}.ppg`, bytes, header, versi }
}

/**
 * Anggota kelompok menerapkan JADWAL. Berkas lama ditolak: dari pengirim yang sama bila versi ≤ terpasang;
 * dari pengirim lain (mis. mubaligh baru) bila dibuat_pada ≤ yang terpasang.
 */
export function terapkanJadwal(db: Db, bytes: Uint8Array, namaBerkas?: string): RingkasanTerapkan {
  const b = bacaBerkasJenis(db, bytes, 'JADWAL')
  const kel = b.header.wilayah_id ?? ''
  const kunciKandidat = [
    ...new Set(daftarProfil(db).filter((p) => p.wilayah_id === kel && p.rahasia.kunci_umum_kelompok).map((p) => p.rahasia.kunci_umum_kelompok!)),
  ]
  if (!kunciKandidat.length) throw new GalatPpg('BUKAN_ANGGOTA_KELOMPOK', 'Berkas jadwal ini untuk kelompok lain.')
  let isi: IsiJadwal | undefined
  for (const k of kunciKandidat) {
    try {
      isi = dekompresJson<IsiJadwal>(dekripsiRahasia(dariB64url(k), b.isi))
      break
    } catch {
      // coba kunci berikutnya
    }
  }
  if (!isi) {
    throw new GalatPpg('TIDAK_BISA_DIBUKA', 'Berkas jadwal tidak bisa dibuka (kunci kelompok sudah diganti). Terapkan balasan/paket terbaru.')
  }
  if (isi.kelompok_id !== kel) throw new GalatPpg('BERKAS_TIDAK_SAH', 'Isi jadwal tidak cocok dengan kepalanya.')
  periksaPengirimMubaligh(db, b, isi.token_pengirim, kel)
  const versi = Number(b.header.versi ?? 0)
  const lama = uraiJson<CatatanJadwal | null>(ambilMeta(db, `jadwal:${kel}`), null)
  if (lama) {
    const lebihLama =
      lama.pengirim === b.header.pengirim_perangkat_id ? versi <= lama.versi : b.header.dibuat_pada <= lama.dibuat_pada
    if (lebihLama) throw new GalatPpg('JADWAL_LAMA', 'Berkas jadwal ini lebih lama dari yang sudah terpasang.')
  }
  const sebelum = potretProfil(db)
  return db.transaksi(() => {
    const rek = isi!.rekaman ?? {}
    // pengajian hanya untuk kelompok ini & induknya; jadwal tambahan hanya kelompok ini
    const wilayah = ambilWilayah(db, kel) ? rantaiWilayah(db, kel) : null
    const g = gabungSemua(db, { pengajian: rek.pengajian ?? [], jadwal_tambahan: rek.jadwal_tambahan ?? [] }, (tabel) => ({
      sumber: 'admin',
      seqLokalBaru: 0,
      periksa: (r) =>
        tabel === 'pengajian'
          ? !wilayah || wilayah.has(String(r.wilayah_id)) ? null : 'Pengajian di luar kelompok ini.'
          : r.kelompok_id === kel ? null : 'Jadwal kelompok lain.',
    }))
    gabungPencabutan(db, (isi!.pencabutan ?? []).filter((c) => c?.jenis === 'cabut'))
    aturMeta(db, `jadwal:${kel}`, JSON.stringify({ pengirim: b.header.pengirim_perangkat_id, versi, dibuat_pada: b.header.dibuat_pada }))
    const ringkasan: RingkasanTerapkan = { jenis: 'JADWAL', versi, perTabel: g.perTabel, total: g.total, pencabutanBaru: 0, profilTerdampak: profilBerubah(db, sebelum) }
    catatImpor(db, b.header, ringkasan, sidikBerkas(bytes), namaBerkas)
    return ringkasan
  })
}
