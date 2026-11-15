// BELAJAR: HP generus → HP mubaligh (dienkripsi ke kunci kelompok setor, K9); pengesahan & simak langsung (K7, K14).
import { dekompresJson, kemasBerkas, kompresJson, periksaBerkas, slug, type BerkasKeluar, type HeaderBerkas } from '../berkas'
import { bukaSegel, dariB64url, segelKe } from '../crypto'
import type { Db } from '../db'
import { gabungRekaman, rekamanKirim, tambahkanHasil, type HasilGabung } from '../gabung'
import { alasanKeaktifanTidakSah } from '../juknis'
import { GalatPpg } from '../galat'
import { ambilIdentitas, gabungKunciSetor } from '../perangkat'
import { ambilGenerus } from '../repo/generus'
import { validasiKemajuan, type DataKemajuan, type KemajuanBelajar } from '../repo/kemajuan'
import { catatSeqDiterima, daftarkanToken, daftarPencabutan, tokenDikenal } from '../repo/perangkat'
import { cariProfilPencatat, daftarProfil, pastikanProfilBolehMencatat, statusProfil, type Profil } from '../repo/profil'
import { adalahAdmin, ambilMetaAngka, aturMeta, ambilRekaman, seqBerikut, sisipkanRekaman, tandaTanya, ubahRekaman, type Rekaman } from '../repo/umum'
import { wajibBuktiWilayahDb } from '../rantai'
import { kunciSetorSah, periksaToken, uraiToken, type PayloadToken } from '../token'
import { sekarangIso, tanggalHariIni, tanggalRingkas } from '../waktu'
import { bacaBerkasJenis, catatImpor, imporTerdahulu, kunciAdminTerpasang, sidikBerkas } from './umum'

export interface IsiBelajar {
  tokens: string[]
  rekaman: { kemajuan_belajar: Record<string, unknown>[]; keaktifan?: Record<string, unknown>[] }
}

/** Tabel yang dibawa BELAJAR: kemajuan murid + lembar kontrol keaktifan mandiri (§16, J-T18). */
const TABEL_BELAJAR = ['kemajuan_belajar', 'keaktifan'] as const

/** Seq tertinggi yang sudah dikonfirmasi mubaligh kelompok itu untuk HP ini (per kelompok, Fase 1b). */
export function konfirmasiBelajar(db: Db, kelompokId: string): number {
  return ambilMetaAngka(db, `konfirmasi_belajar_seq:${kelompokId}`)
}

/**
 * Jumlah catatan kemajuan di HP generus yang belum dikonfirmasi mubaligh (opsional untuk satu kelompok).
 * Konfirmasi dihitung per kelompok, sehingga HP dengan profil dari beberapa kelompok tidak kehilangan data.
 */
export function jumlahBelumDisetorBelajar(db: Db, kelompokId?: string): number {
  const kelompok = kelompokId
    ? [kelompokId]
    : [...new Set(daftarProfil(db, 'generus').filter((p) => !p.dicabut_pada).map((p) => p.wilayah_id))]
  let n = 0
  for (const k of kelompok) {
    for (const t of TABEL_BELAJAR) {
      n +=
        db.nilai<number>(`SELECT COUNT(*) FROM ${t} WHERE seq_lokal > ? AND sumber = 'generus' AND kelompok_id = ?`, [
          konfirmasiBelajar(db, k),
          k,
        ]) ?? 0
    }
  }
  return n
}

/**
 * HP generus membuat SATU berkas BELAJAR untuk semua profil generus di HP ini (K13) yang boleh mencatat.
 * Bila profil berasal dari beberapa kelompok, pilih `kelompokId`.
 */
export function buatBelajar(db: Db, opsi: { kelompokId?: string } = {}): BerkasKeluar & { jumlah: number } {
  const admin = kunciAdminTerpasang(db)
  const identitas = ambilIdentitas(db)
  const semua = daftarProfil(db, 'generus')
  if (!semua.length) throw new GalatPpg('TIDAK_ADA_PROFIL', 'Tidak ada profil generus di HP ini.')
  let profil = semua.filter((p) => statusProfil(p).bolehMencatat && p.hak.includes('setor_belajar'))
  if (!profil.length) {
    const st = statusProfil(semua[0]!)
    throw new GalatPpg(st.kode ?? 'TIDAK_BERWENANG', st.alasan ?? 'Profil tidak berhak menyetor.')
  }
  const kelompok = [...new Set(profil.map((p) => p.wilayah_id))]
  if (opsi.kelompokId) profil = profil.filter((p) => p.wilayah_id === opsi.kelompokId)
  else if (kelompok.length > 1) {
    throw new GalatPpg('PERLU_PILIH_KELOMPOK', 'Profil di HP ini berasal dari beberapa kelompok; pilih kelompok tujuan.')
  }
  if (!profil.length) throw new GalatPpg('TIDAK_ADA_PROFIL', 'Tidak ada profil generus untuk kelompok itu.')
  const kelompokId = profil[0]!.wilayah_id
  const kunci = gabungKunciSetor(profil.flatMap((p) => p.rahasia.kunci_kelompok_setor ?? [])).filter((k) =>
    kunciSetorSah(k, { orgId: admin.orgId, kelompokId, adminSignPub: admin.signPub }),
  )
  const terbaru = kunci[kunci.length - 1]
  if (!terbaru) throw new GalatPpg('KUNCI_TIDAK_ADA', 'Kunci kelompok belum ada. Minta token baru dari mubaligh.')
  const generusIds = profil.flatMap((p) => p.generus_ids)
  const konf = konfirmasiBelajar(db, kelompokId)
  const ambil = (t: string) =>
    db.kueri<Rekaman>(
      `SELECT * FROM ${t} WHERE seq_lokal > ? AND perangkat_id = ? AND kelompok_id = ? AND generus_id IN (${tandaTanya(generusIds.length)}) ORDER BY seq_lokal`,
      [konf, identitas.id, kelompokId, ...generusIds],
    )
  const rowsKemajuan = ambil('kemajuan_belajar')
  const rowsKeaktifan = ambil('keaktifan')
  const rows = [...rowsKemajuan, ...rowsKeaktifan]
  const isi: IsiBelajar = { tokens: profil.map((p) => p.token), rekaman: { kemajuan_belajar: rekamanKirim(rowsKemajuan) } }
  if (rowsKeaktifan.length) isi.rekaman.keaktifan = rekamanKirim(rowsKeaktifan)
  let urut = Math.max(ambilMetaAngka(db, 'seq'), ...rows.map((r) => Number(r.seq_lokal)))
  // Catatan profil kelompok ini yang sedang tidak boleh menyetor (mis. dibekukan karena mondok) belum terkirim:
  // konfirmasi tidak boleh melewatinya, agar terkirim setelah profil aktif lagi (Fase 1b).
  const tertundaIds = semua.filter((p) => p.wilayah_id === kelompokId && !p.dicabut_pada && !profil.includes(p)).flatMap((p) => p.generus_ids)
  if (tertundaIds.length) {
    for (const t of TABEL_BELAJAR) {
      const minTertunda = db.nilai<number | null>(
        `SELECT MIN(seq_lokal) FROM ${t} WHERE seq_lokal > ? AND perangkat_id = ? AND kelompok_id = ? AND generus_id IN (${tandaTanya(tertundaIds.length)})`,
        [konf, identitas.id, kelompokId, ...tertundaIds],
      )
      if (minTertunda) urut = Math.min(urut, minTertunda - 1)
    }
  }
  const header: HeaderBerkas = {
    jenis: 'BELAJAR',
    versi_format: 1,
    org_id: admin.orgId,
    pengirim_perangkat_id: identitas.id,
    dibuat_pada: sekarangIso(),
    wilayah_id: kelompokId,
    urut,
    versi_kunci: terbaru.versi,
  }
  const bytes = kemasBerkas(header, segelKe(dariB64url(terbaru.publik), kompresJson(isi)), identitas.tandaTangan.rahasia)
  aturMeta(db, 'terakhir_belajar', sekarangIso())
  const nama = profil.length === 1 ? profil[0]!.nama : `${profil[0]!.nama}-dkk`
  return { nama: `PPG_BELAJAR_${slug(nama)}_${tanggalRingkas()}.ppg`, bytes, header, jumlah: rows.length }
}

export interface RingkasanImporBelajar {
  jenis: 'BELAJAR'
  pengirimPerangkatId: string
  generus: string[]
  sudahPernah: boolean
  hasil: HasilGabung
}

/** Profil mubaligh HP ini untuk kelompok (boleh mencatat). */
function profilMubaligh(db: Db, kelompokId: string): Profil {
  const p = daftarProfil(db, 'mubaligh').find((x) => x.wilayah_id === kelompokId)
  if (!p) throw new GalatPpg('BUKAN_MUBALIGH_KELOMPOK', 'Berkas ini untuk mubaligh kelompok lain.')
  pastikanProfilBolehMencatat(p)
  return p
}

/**
 * HP mubaligh mengimpor BELAJAR: verifikasi rantai token generus, versi kunci, keanggotaan kelompok,
 * profil tidak dibekukan; simpan sebagai `diajukan` dengan seq_lokal baru (diteruskan pada SETOR berikutnya).
 */
export function imporBelajar(dbMubaligh: Db, bytes: Uint8Array, namaBerkas?: string): RingkasanImporBelajar {
  if (adalahAdmin(dbMubaligh)) throw new GalatPpg('DB_ADMIN', 'Berkas BELAJAR dibuka di HP mubaligh.')
  const admin = kunciAdminTerpasang(dbMubaligh)
  const b = bacaBerkasJenis(dbMubaligh, bytes, 'BELAJAR')
  const kelompokId = b.header.wilayah_id ?? ''
  const m = profilMubaligh(dbMubaligh, kelompokId)
  const sidik = sidikBerkas(bytes)
  const lama = imporTerdahulu<RingkasanImporBelajar>(dbMubaligh, sidik)
  if (lama) return { ...lama, sudahPernah: true }
  const versiKunci = Number(b.header.versi_kunci ?? 0)
  const kunci = (m.rahasia.kunci_kelompok_setor ?? []).find((k) => k.versi === versiKunci && k.rahasia)
  if (!kunci) {
    throw new GalatPpg('KUNCI_TIDAK_ADA', `Kunci kelompok versi ${versiKunci} tidak dimiliki HP ini. Terapkan paket terbaru dari admin.`)
  }
  let isi: IsiBelajar
  try {
    isi = dekompresJson<IsiBelajar>(bukaSegel(b.isi, { publik: dariB64url(kunci.publik), rahasia: dariB64url(kunci.rahasia!) }))
  } catch {
    throw new GalatPpg('TIDAK_BISA_DIBUKA', 'Berkas belajar tidak bisa dibuka.')
  }
  const pengirim = b.header.pengirim_perangkat_id
  const pencabutan = daftarPencabutan(dbMubaligh)
  const dikenal = tokenDikenal(dbMubaligh)
  const sah: PayloadToken[] = []
  const teksToken = new Map<string, string>()
  let alasanPertama = ''
  for (const teks of Array.isArray(isi.tokens) ? isi.tokens : []) {
    const h = periksaToken(teks, { adminSignPub: admin.signPub, pencabutan, tokenDikenal: dikenal, wajibBuktiWilayah: wajibBuktiWilayahDb(dbMubaligh) })
    if (!h.sah) {
      alasanPertama ||= h.alasan
      continue
    }
    const p = h.payload
    if (p.role !== 'generus' || !p.hak.includes('setor_belajar') || p.perangkat_id !== pengirim || p.wilayah_id !== kelompokId) continue
    if (!periksaBerkas(b, dariB64url(p.device_sign_pub))) continue
    sah.push(p)
    teksToken.set(p.token_id, teks)
  }
  if (!sah.length) throw new GalatPpg('PENGIRIM_TIDAK_SAH', `Berkas belajar ditolak: ${alasanPertama || 'token/tanda tangan pengirim tidak sah.'}`)
  const generusBoleh = new Set<string>()
  for (const p of sah) {
    const gid = p.generus_ids![0]!
    const g = ambilGenerus(dbMubaligh, gid)
    if (g && g.kelompok_id === kelompokId && g.status === 'aktif') generusBoleh.add(gid)
  }
  return dbMubaligh.transaksi(() => {
    for (const p of sah) {
      if (!dikenal.has(p.token_id)) daftarkanToken(dbMubaligh, p, teksToken.get(p.token_id)!, { diterbitkanOleh: uraiToken(p.penerbit!).payload.token_id })
    }
    const hasil = gabungRekaman(dbMubaligh, 'kemajuan_belajar', isi.rekaman?.kemajuan_belajar ?? [], {
      sumber: 'perangkat',
      dariGenerus: true,
      seqLokalBaru: seqBerikut(dbMubaligh),
      periksa: (rek) => {
        if (!generusBoleh.has(String(rek.generus_id))) return 'Generus bukan anggota aktif kelompok ini (atau sedang mondok).'
        if (rek.kelompok_id !== kelompokId) return 'Kelompok rekaman tidak sesuai.'
        if (rek.perangkat_id !== pengirim) return 'Rekaman bukan milik HP pengirim.'
        if (rek.sumber !== 'generus' || rek.status_sah !== 'diajukan' || rek.disahkan_oleh || rek.disahkan_pada) {
          return 'Generus hanya boleh mengajukan, bukan mengesahkan.'
        }
        if (!ambilRekaman(dbMubaligh, 'materi', String(rek.materi_id))) return 'Materi tidak dikenal.'
        return null
      },
    })
    // §16: lembar kontrol keaktifan mandiri murid (diajukan; disahkan mubaligh)
    const hasilAktif = gabungRekaman(dbMubaligh, 'keaktifan', Array.isArray(isi.rekaman?.keaktifan) ? isi.rekaman.keaktifan : [], {
      sumber: 'perangkat',
      dariGenerus: true,
      seqLokalBaru: seqBerikut(dbMubaligh),
      periksa: (rek) => {
        if (!generusBoleh.has(String(rek.generus_id))) return 'Generus bukan anggota aktif kelompok ini (atau sedang mondok).'
        if (rek.kelompok_id !== kelompokId) return 'Kelompok rekaman tidak sesuai.'
        if (rek.perangkat_id !== pengirim) return 'Rekaman bukan milik HP pengirim.'
        if (rek.sumber !== 'generus' || rek.status_sah !== 'diajukan' || rek.disahkan_oleh || rek.disahkan_pada) {
          return 'Murid hanya boleh mengajukan, bukan mengesahkan.'
        }
        return alasanKeaktifanTidakSah(rek, ambilGenerus(dbMubaligh, String(rek.generus_id))?.kategori)
      },
    })
    tambahkanHasil(hasil, hasilAktif)
    catatSeqDiterima(dbMubaligh, pengirim, Number(b.header.urut ?? 0))
    const ringkasan: RingkasanImporBelajar = {
      jenis: 'BELAJAR',
      pengirimPerangkatId: pengirim,
      generus: sah.map((p) => p.nama),
      sudahPernah: false,
      hasil,
    }
    catatImpor(dbMubaligh, b.header, ringkasan, sidik, namaBerkas)
    return ringkasan
  })
}

/** Daftar kemajuan berstatus diajukan di kelompok (untuk layar "Setoran Generus"). */
export function daftarDiajukan(db: Db, kelompokId: string): KemajuanBelajar[] {
  return db.kueri<KemajuanBelajar>(
    `SELECT * FROM kemajuan_belajar WHERE kelompok_id = ? AND status_sah = 'diajukan' AND dihapus = 0 ORDER BY tanggal, diubah_pada`,
    [kelompokId],
  )
}

/** Mubaligh mengesahkan atau menolak kemajuan yang diajukan. */
export function sahkan(
  db: Db,
  kemajuanId: string,
  o: { keputusan: 'disahkan' | 'ditolak'; catatan?: string | null; nilai?: number | null; level?: number | null },
): KemajuanBelajar {
  const k = ambilRekaman<KemajuanBelajar>(db, 'kemajuan_belajar', kemajuanId)
  if (!k || k.dihapus) throw new GalatPpg('TIDAK_DITEMUKAN', 'Catatan kemajuan tidak ditemukan.')
  if (o.keputusan !== 'disahkan' && o.keputusan !== 'ditolak') throw new GalatPpg('KEPUTUSAN_TIDAK_SAH', 'Keputusan harus disahkan atau ditolak.')
  if (k.status_sah !== 'diajukan') throw new GalatPpg('SUDAH_DIPUTUSKAN', 'Catatan ini sudah diputuskan.')
  const m = cariProfilPencatat(db, k.kelompok_id, ['mubaligh'], 'sahkan')
  const p: Record<string, unknown> = {
    status_sah: o.keputusan,
    disahkan_oleh: m.nama,
    disahkan_pada: sekarangIso(),
    catatan_mubaligh: o.catatan ?? null,
  }
  if (o.nilai !== undefined) p.nilai = o.nilai
  if (o.level !== undefined) p.level = o.level
  if (o.nilai !== undefined || o.level !== undefined) {
    validasiKemajuan(db, { materiId: k.materi_id, status: k.status, nilai: o.nilai ?? k.nilai, level: o.level ?? k.level })
  }
  return ubahRekaman<KemajuanBelajar>(db, 'kemajuan_belajar', kemajuanId, p)
}

/** Simak Langsung (K14): mubaligh mencatat kemajuan generus tanpa HP — langsung disahkan. */
export function simakLangsung(db: Db, d: DataKemajuan & { generusId: string }): KemajuanBelajar {
  const g = ambilGenerus(db, d.generusId)
  if (!g || g.dihapus) throw new GalatPpg('GENERUS_TIDAK_ADA', 'Generus tidak ditemukan.')
  if (g.status !== 'aktif') throw new GalatPpg('GENERUS_TIDAK_AKTIF', `${g.nama} tidak berstatus aktif.`)
  const m = cariProfilPencatat(db, g.kelompok_id, ['mubaligh'], 'sahkan')
  validasiKemajuan(db, d)
  return sisipkanRekaman<KemajuanBelajar>(db, 'kemajuan_belajar', {
    generus_id: g.id,
    kelompok_id: g.kelompok_id,
    materi_id: d.materiId,
    status: d.status,
    nilai: d.nilai ?? null,
    level: d.level ?? null,
    tanggal: d.tanggal ?? tanggalHariIni(),
    sumber: 'mubaligh',
    status_sah: 'disahkan',
    disahkan_oleh: m.nama,
    disahkan_pada: sekarangIso(),
    catatan_generus: null,
    catatan_mubaligh: d.catatan ?? null,
  })
}
