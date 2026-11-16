// BALASAN: HP mubaligh → HP generus/wali (disegel ke kunci kotak perangkat penerima).
import { ambilBlob, simpanBlob, type BlobBertanda } from '../info-bidang'
import { dekompresJson, kemasBerkas, kompresJson, slug, type BerkasKeluar, type HeaderBerkas } from '../berkas'
import { bukaSegel, dariB64url, segelKe } from '../crypto'
import type { Db } from '../db'
import { gabungSemua, rekamanKirim, type RekamanPerTabel } from '../gabung'
import { GalatPpg } from '../galat'
import { ambilIdentitas, gabungKunciSetor } from '../perangkat'
import { daftarPencabutan, daftarPerangkat, gabungPencabutan, seqDiterima, type BarisPencabutan } from '../repo/perangkat'
import { daftarProfil, pastikanProfilBolehMencatat, simpanRahasiaProfil } from '../repo/profil'
import { adalahExe, ambilMetaAngka, aturMeta, tandaTanya, type Rekaman } from '../repo/umum'
import { kelompokDalamWilayah, leluhurWilayah } from '../repo/wilayah'
import { ambilKunciTitipan, kunciExeWajib } from '../instalasi'
import { wilayahMencakupDb } from '../rantai'
import type { NamaTabelSinkron } from '../skema'
import { kunciSetorSah, type KunciSetor } from '../token'
import { PENGATURAN_KURIKULUM } from '../juknis'
import { sekarangIso, tanggalRingkas } from '../waktu'
import { perbaruiKunciUmum, potretProfil, profilBerubah, type RingkasanTerapkan } from './paket'
import { periksaPengirimMubaligh } from './pengirim'
import { bacaBerkasJenis, catatImpor, kunciAdminTerpasang, sidikBerkas } from './umum'

export interface IsiBalasan {
  kelompok_id: string
  token_pengirim: string
  rekaman: RekamanPerTabel
  pencabutan: BarisPencabutan[]
  konfirmasi_belajar_seq: number
  kunci_setor?: KunciSetor
  /** Kunci umum kelompok terbaru (JADWAL); berganti setelah serah terima (Fase 1b). */
  kunci_umum?: { versi: number; kunci: string }
  /** §21.4: kontak WA BK per wilayah bertanda tangan daerah (tombol Hubungi BK di HP orang tua & generus SMA ke atas). */
  kontak_bk?: BlobBertanda
}

function pilih(db: Db, tabel: NamaTabelSinkron, kolom: string, nilai: string[]): Rekaman[] {
  if (!nilai.length) return []
  return db.kueri<Rekaman>(`SELECT * FROM ${tabel} WHERE ${kolom} IN (${tandaTanya(nilai.length)})`, nilai)
}

/**
 * Mubaligh membuat BALASAN untuk satu HP generus/wali: kemajuan, presensi, penilaian akhlaq, koreksi,
 * pengajian & jadwal kelompok, data & status generus, pencabutan token HP itu, konfirmasi_belajar_seq,
 * dan kunci kelompok setor publik terbaru.
 * v3: EXE desa/kelompok juga boleh membuat BALASAN (mis. menyebarkan pencabutan mubaligh sampai ke HP generus);
 * kunci kelompok diambil dari kunci titipan daerah.
 */
export function buatBalasan(dbPengirim: Db, perangkatPenerimaId: string): BerkasKeluar {
  const admin = kunciAdminTerpasang(dbPengirim)
  const identitas = ambilIdentitas(dbPengirim)
  const profilM = daftarProfil(dbPengirim, 'mubaligh')
  const profilExe = adalahExe(dbPengirim) ? daftarProfil(dbPengirim, 'admin') : []
  const mencakup = wilayahMencakupDb(dbPengirim)
  const token = daftarPerangkat(dbPengirim, { perangkatId: perangkatPenerimaId, role: ['generus', 'wali'] }).filter(
    (t) => profilM.some((m) => m.wilayah_id === t.wilayah_id) || profilExe.some((m) => mencakup(m.wilayah_id, t.wilayah_id) === true),
  )
  if (!token.length) throw new GalatPpg('PENERIMA_TIDAK_DIKENAL', 'HP penerima tidak terdaftar sebagai generus/wali kelompok Anda.')
  const kelompokId = token[0]!.wilayah_id
  const m = profilM.find((x) => x.wilayah_id === kelompokId) ?? profilExe.find((x) => mencakup(x.wilayah_id, kelompokId) === true)!
  pastikanProfilBolehMencatat(m)
  const generusIds = [...new Set(token.filter((t) => t.wilayah_id === kelompokId).flatMap((t) => t.generus_ids))]
  const r: Record<string, Rekaman[]> = {
    wilayah: pilih(dbPengirim, 'wilayah', 'id', [kelompokId, ...leluhurWilayah(dbPengirim, kelompokId)]),
    generus: pilih(dbPengirim, 'generus', 'id', generusIds),
    riwayat_keanggotaan: pilih(dbPengirim, 'riwayat_keanggotaan', 'generus_id', generusIds),
    riwayat_status: pilih(dbPengirim, 'riwayat_status', 'generus_id', generusIds),
    pengajian: pilih(dbPengirim, 'pengajian', 'wilayah_id', [kelompokId, ...leluhurWilayah(dbPengirim, kelompokId)]),
    koreksi: pilih(dbPengirim, 'koreksi', 'untuk_perangkat_id', [perangkatPenerimaId]),
    kemajuan_belajar: pilih(dbPengirim, 'kemajuan_belajar', 'generus_id', generusIds),
    presensi: pilih(dbPengirim, 'presensi', 'generus_id', generusIds),
    penilaian_akhlaq: pilih(dbPengirim, 'penilaian_akhlaq', 'generus_id', generusIds),
    jadwal_tambahan: pilih(dbPengirim, 'jadwal_tambahan', 'kelompok_id', [kelompokId]),
    // v3: target capaian & periode aktif (layar "Materi yang perlu dituntaskan")
    target_capaian: dbPengirim.kueri<Rekaman>('SELECT * FROM target_capaian'),
    pengaturan: dbPengirim.kueri<Rekaman>(`SELECT * FROM pengaturan WHERE id IN (${tandaTanya(PENGATURAN_KURIKULUM.length)})`, [...PENGATURAN_KURIKULUM]),
    // §16 (J-T18): lembar kontrol keaktifan, hasil evaluasi semester, daftar materi evaluasi (raport di HP)
    keaktifan: pilih(dbPengirim, 'keaktifan', 'generus_id', generusIds),
    evaluasi_semester: pilih(dbPengirim, 'evaluasi_semester', 'generus_id', generusIds),
    // §20: Karakter Luhur (raport anak di HP murid/orang tua)
    penilaian_karakter: pilih(dbPengirim, 'penilaian_karakter', 'generus_id', generusIds),
    materi_evaluasi: dbPengirim.kueri<Rekaman>('SELECT * FROM materi_evaluasi'),
  }
  const rekaman: RekamanPerTabel = {}
  for (const [t, rows] of Object.entries(r)) if (rows.length) rekaman[t as NamaTabelSinkron] = rekamanKirim(rows)
  let kunciSetor: KunciSetor[] = m.rahasia.kunci_kelompok_setor ?? []
  let kunciUmum: { versi: number; kunci: string } | undefined = m.rahasia.kunci_umum_kelompok
    ? { versi: m.rahasia.kunci_umum_versi ?? 1, kunci: m.rahasia.kunci_umum_kelompok }
    : undefined
  if (m.role === 'admin') {
    const titipan = ambilKunciTitipan(dbPengirim, kunciExeWajib(dbPengirim), kelompokId)
    kunciSetor = titipan?.setor ?? []
    kunciUmum = titipan?.umum
  }
  const kunci = gabungKunciSetor(kunciSetor)
  const terbaru = kunci[kunci.length - 1]
  const isi: IsiBalasan = {
    kelompok_id: kelompokId,
    token_pengirim: m.token,
    rekaman,
    // pencabutan token penerima + semua token mubaligh kelompok (agar HP generus menolak berkas mubaligh lama)
    pencabutan: daftarPencabutan(dbPengirim, [
      ...token.map((t) => t.id),
      ...daftarPerangkat(dbPengirim, { role: 'mubaligh', wilayahIds: [kelompokId] }).map((t) => t.id),
    ]),
    konfirmasi_belajar_seq: seqDiterima(dbPengirim, perangkatPenerimaId),
  }
  if (terbaru) isi.kunci_setor = { versi: terbaru.versi, publik: terbaru.publik, tt: terbaru.tt }
  if (kunciUmum) isi.kunci_umum = kunciUmum
  const kontak = ambilBlob(dbPengirim, 'kontak')
  if (kontak) isi.kontak_bk = kontak.blob
  const header: HeaderBerkas = {
    jenis: 'BALASAN',
    versi_format: 1,
    org_id: admin.orgId,
    pengirim_perangkat_id: identitas.id,
    dibuat_pada: sekarangIso(),
    wilayah_id: kelompokId,
    penerima_perangkat_id: perangkatPenerimaId,
  }
  const bytes = kemasBerkas(header, segelKe(dariB64url(token[0]!.box_pub), kompresJson(isi)), identitas.tandaTangan.rahasia)
  return { nama: `PPG_BALASAN_${slug(token[0]!.nama)}_${tanggalRingkas()}.ppg`, bytes, header }
}

/** HP generus/wali menerapkan BALASAN: gabung data, konfirmasi, kunci setor publik, bekukan/cairkan profil. */
export function terapkanBalasan(db: Db, bytes: Uint8Array, namaBerkas?: string): RingkasanTerapkan {
  const b = bacaBerkasJenis(db, bytes, 'BALASAN')
  const identitas = ambilIdentitas(db)
  if (b.header.penerima_perangkat_id !== identitas.id) {
    throw new GalatPpg('BUKAN_UNTUK_HP_INI', 'Berkas balasan ini untuk HP lain.')
  }
  const isi = dekompresJson<IsiBalasan>(bukaSegel(b.isi, identitas.kotak))
  const kelompokId = b.header.wilayah_id ?? ''
  if (isi.kelompok_id !== kelompokId) throw new GalatPpg('BERKAS_TIDAK_SAH', 'Isi balasan tidak cocok dengan kepalanya.')
  periksaPengirimMubaligh(db, b, isi.token_pengirim, kelompokId, { bolehExe: true })
  const admin = kunciAdminTerpasang(db)
  const profilKel = daftarProfil(db, ['generus', 'wali']).filter((x) => x.wilayah_id === kelompokId)
  const generusIds = new Set(profilKel.flatMap((p) => p.generus_ids))
  const tokenSaya = new Set(daftarProfil(db).map((p) => p.token_id))
  const wilayahBoleh = rantaiWilayah(db, kelompokId, (isi.rekaman?.wilayah ?? []) as Rekaman[])
  const periksa = periksaBalasan(identitas.id, kelompokId, generusIds, wilayahBoleh)
  const sebelum = potretProfil(db)
  return db.transaksi(() => {
    const g = gabungSemua(db, isi.rekaman ?? {}, (tabel) => ({ sumber: 'admin', seqLokalBaru: 0, periksa: periksa(tabel) }))
    // pembekuan/pencairan hanya untuk token HP ini; pencabutan token lain (mis. mubaligh lama) selalu boleh
    const pencabutanBaru = gabungPencabutan(
      db,
      (isi.pencabutan ?? []).filter((c) => c && (tokenSaya.has(c.token_id) || c.jenis === 'cabut')),
    )
    const kunciKonf = `konfirmasi_belajar_seq:${kelompokId}`
    const konf = Number(isi.konfirmasi_belajar_seq ?? 0)
    if (konf > ambilMetaAngka(db, kunciKonf)) aturMeta(db, kunciKonf, konf)
    const ks = isi.kunci_setor
    if (ks && kunciSetorSah(ks, { orgId: admin.orgId, kelompokId, adminSignPub: admin.signPub })) {
      for (const p of profilKel) {
        simpanRahasiaProfil(db, p.id, {
          ...p.rahasia,
          kunci_kelompok_setor: gabungKunciSetor(p.rahasia.kunci_kelompok_setor, [{ versi: ks.versi, publik: ks.publik, tt: ks.tt }]),
        })
      }
    }
    for (const p of daftarProfil(db, ['generus', 'wali']).filter((x) => x.wilayah_id === kelompokId)) perbaruiKunciUmum(db, p, isi.kunci_umum)
    if (isi.kontak_bk) simpanBlob(db, 'kontak', isi.kontak_bk)
    aturMeta(db, 'terakhir_balasan', sekarangIso())
    const ringkasan: RingkasanTerapkan = { jenis: 'BALASAN', perTabel: g.perTabel, total: g.total, pencabutanBaru, profilTerdampak: profilBerubah(db, sebelum) }
    catatImpor(db, b.header, ringkasan, sidikBerkas(bytes), namaBerkas)
    return ringkasan
  })
}

/** Id wilayah kelompok beserta leluhurnya (dari data lokal + rekaman wilayah yang dibawa berkas). */
export function rantaiWilayah(db: Db, kelompokId: string, masuk: Rekaman[] = []): Set<string> {
  const induk = new Map<string, string | null>()
  for (const w of db.kueri<{ id: string; induk_id: string | null }>('SELECT id, induk_id FROM wilayah')) induk.set(w.id, w.induk_id)
  for (const w of masuk) if (w && typeof w.id === 'string' && !induk.has(w.id)) induk.set(w.id, (w.induk_id as string | null) ?? null)
  const hasil = new Set<string>()
  let kini: string | null | undefined = kelompokId
  while (kini && !hasil.has(kini)) {
    hasil.add(kini)
    kini = induk.get(kini)
  }
  return hasil
}

/** Pemeriksaan rekaman BALASAN: hanya data generus penerima, kelompoknya, dan rantai wilayahnya (Fase 1b). */
function periksaBalasan(saya: string, kelompokId: string, generusIds: Set<string>, wilayah: Set<string>) {
  const diluar = 'Data di luar generus penerima balasan.'
  return (tabel: NamaTabelSinkron) =>
    (rek: Rekaman): string | null => {
      switch (tabel) {
        case 'wilayah':
          return wilayah.has(rek.id) ? null : 'Wilayah di luar kelompok ini.'
        case 'pengajian':
          return wilayah.has(String(rek.wilayah_id)) ? null : 'Pengajian di luar kelompok ini.'
        case 'generus':
          return generusIds.has(rek.id) ? null : diluar
        case 'riwayat_keanggotaan':
        case 'riwayat_status':
        case 'kemajuan_belajar':
        case 'keaktifan':
        case 'evaluasi_semester':
        case 'penilaian_karakter':
        case 'presensi':
        case 'penilaian_akhlaq':
          return generusIds.has(String(rek.generus_id)) ? null : diluar
        case 'koreksi':
          return rek.untuk_perangkat_id === saya ? null : 'Koreksi untuk HP lain.'
        case 'jadwal_tambahan':
          return rek.kelompok_id === kelompokId ? null : 'Jadwal kelompok lain.'
        case 'target_capaian':
        case 'materi_evaluasi':
          return null
        case 'pengaturan':
          return PENGATURAN_KURIKULUM.includes(rek.id) ? null : 'Pengaturan ini tidak dikirim lewat balasan.'
        default:
          return 'Data ini tidak dikirim lewat balasan mubaligh.'
      }
    }
}

/** Daftar HP generus/wali kelompok mubaligh (untuk memilih penerima balasan). */
export function daftarPenerimaBalasan(db: Db): { perangkatId: string; label: string | null; nama: string[]; role: string[] }[] {
  const kel = new Set(daftarProfil(db, 'mubaligh').map((m) => m.wilayah_id))
  // v3: EXE desa/kelompok — semua kelompok di wilayahnya
  if (adalahExe(db)) for (const p of daftarProfil(db, 'admin')) for (const k of kelompokDalamWilayah(db, p.wilayah_id)) kel.add(k)
  const peta = new Map<string, { perangkatId: string; label: string | null; nama: string[]; role: string[] }>()
  for (const t of daftarPerangkat(db, { role: ['generus', 'wali'] })) {
    if (!kel.has(t.wilayah_id) || t.dicabut_pada) continue
    const e = peta.get(t.perangkat_id) ?? { perangkatId: t.perangkat_id, label: t.label, nama: [], role: [] }
    e.nama.push(t.nama)
    e.role.push(t.role)
    peta.set(t.perangkat_id, e)
  }
  return [...peta.values()]
}
