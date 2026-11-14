// SETOR: HP pengurus/mubaligh → admin (dienkripsi ke kunci kotak admin, ditandatangani perangkat).
import type { KunciAdmin } from '../admin'
import { dekompresJson, kemasBerkas, kompresJson, periksaBerkas, slug, type BerkasKeluar, type HeaderBerkas } from '../berkas'
import { bukaSegel, dariB64url, segelKe } from '../crypto'
import type { Db } from '../db'
import { gabungSemua, rekamanKirim, type HasilGabung, type RekamanPerTabel } from '../gabung'
import { GalatPpg } from '../galat'
import { ambilIdentitas } from '../perangkat'
import { catatSeqDiterima, daftarkanToken, daftarPencabutan, daftarPerangkat } from '../repo/perangkat'
import { daftarProfil, statusProfil } from '../repo/profil'
import { adalahAdmin, ambilMeta, ambilMetaAngka, aturMeta, type Rekaman } from '../repo/umum'
import { ambilWilayah, kelompokDalamWilayah } from '../repo/wilayah'
import { daftarGenerus } from '../repo/generus'
import { PetaRiwayat } from '../laporan'
import { DAFTAR_TABEL_SINKRON, TABEL_SINKRON, type NamaTabelSinkron } from '../skema'
import { periksaToken, uraiToken, type PayloadToken } from '../token'
import { sekarangIso, tanggalRingkas } from '../waktu'
import { bacaBerkasJenis, catatImpor, imporTerdahulu, kunciAdminTerpasang, sidikBerkas } from './umum'

export interface IsiSetor {
  tokens: string[]
  rekaman: RekamanPerTabel
  perangkat_terbit: { token: string; diterbitkan_oleh: string | null; label: string | null }[]
  setor_akhir?: boolean
}

/** Jumlah rekaman lokal yang belum dikonfirmasi admin ("Ada N data belum disetor"). */
export function jumlahBelumDisetor(db: Db): number {
  const konf = ambilMetaAngka(db, 'konfirmasi_seq')
  let n = 0
  for (const t of DAFTAR_TABEL_SINKRON) n += db.nilai<number>(`SELECT COUNT(*) FROM ${t} WHERE seq_lokal > ?`, [konf]) ?? 0
  return n
}

/**
 * Buat berkas SETOR berisi semua rekaman dengan seq_lokal > konfirmasi_seq (kumulatif: berkas yang hilang
 * tidak menghilangkan data), usulan, dan token generus/wali yang diterbitkan HP ini.
 */
export function buatSetor(db: Db, opsi: { setorAkhir?: boolean; semua?: boolean } = {}): BerkasKeluar {
  if (adalahAdmin(db)) throw new GalatPpg('DB_ADMIN', 'Admin tidak menyetor; admin membuat paket.')
  const admin = kunciAdminTerpasang(db)
  const identitas = ambilIdentitas(db)
  const profil = daftarProfil(db, ['pengurus', 'mubaligh'])
  if (!profil.length) throw new GalatPpg('TIDAK_ADA_PROFIL', 'Tidak ada profil pengurus/mubaligh di HP ini.')
  const sah = profil.filter((p) => statusProfil(p).bolehMencatat)
  if (!sah.length) {
    const st = statusProfil(profil[0]!)
    throw new GalatPpg(st.kode ?? 'TIDAK_BERWENANG', `Tidak bisa menyetor: ${st.alasan}`)
  }
  // `semua`: kirim ulang seluruh data lokal (mis. admin memulihkan database dari cadangan lama)
  const konf = opsi.semua ? 0 : ambilMetaAngka(db, 'konfirmasi_seq')
  const rekaman: RekamanPerTabel = {}
  let urut = ambilMetaAngka(db, 'seq')
  for (const t of DAFTAR_TABEL_SINKRON) {
    const rows = db.kueri<Rekaman>(`SELECT * FROM ${t} WHERE seq_lokal > ? ORDER BY seq_lokal`, [konf])
    if (rows.length) {
      rekaman[t] = rekamanKirim(rows)
      urut = Math.max(urut, Number(rows[rows.length - 1]!.seq_lokal))
    }
  }
  const tokenSaya = new Set(profil.map((p) => p.token_id))
  const terbit = daftarPerangkat(db, { role: ['generus', 'wali'] })
    .filter((p) => p.diterbitkan_oleh && tokenSaya.has(p.diterbitkan_oleh))
    .map((p) => ({ token: p.token, diterbitkan_oleh: p.diterbitkan_oleh, label: p.label }))
  const isi: IsiSetor = { tokens: sah.map((p) => p.token), rekaman, perangkat_terbit: terbit }
  if (opsi.setorAkhir) isi.setor_akhir = true
  const wilayah = sah[0]!.wilayah_id
  const header: HeaderBerkas = {
    jenis: 'SETOR',
    versi_format: 1,
    org_id: admin.orgId,
    pengirim_perangkat_id: identitas.id,
    dibuat_pada: sekarangIso(),
    wilayah_id: wilayah,
    urut,
  }
  const bytes = kemasBerkas(header, segelKe(dariB64url(admin.boxPub), kompresJson(isi)), identitas.tandaTangan.rahasia)
  aturMeta(db, 'terakhir_setor', sekarangIso())
  const namaW = slug(ambilWilayah(db, wilayah)?.nama ?? wilayah)
  return {
    nama: `PPG_SETOR${opsi.setorAkhir ? '_AKHIR' : ''}_${namaW}_${tanggalRingkas()}_${urut}.ppg`,
    bytes,
    header,
  }
}

export interface RingkasanImporSetor {
  jenis: 'SETOR'
  pengirimPerangkatId: string
  pengirim: string[]
  urut: number
  sudahPernah: boolean
  setorAkhir: boolean
  perTabel: Partial<Record<NamaTabelSinkron, HasilGabung>>
  total: HasilGabung
  usulanBaru: number
  tokenDilaporkan: number
  ditolak: { tabel?: string; id: string; alasan: string }[]
}

/**
 * Admin mengimpor SETOR: verifikasi tanda tangan & token, tolak perangkat dicabut, periksa wewenang wilayah,
 * gabungkan, catat seq_diterima. Idempoten (berkas yang sama → `sudahPernah`; data yang sama → diabaikan).
 */
export function imporSetor(dbAdmin: Db, bytes: Uint8Array, kunciAdmin: KunciAdmin, namaBerkas?: string): RingkasanImporSetor {
  if (!adalahAdmin(dbAdmin)) throw new GalatPpg('BUKAN_DB_ADMIN', 'Setoran hanya bisa diimpor di aplikasi admin.')
  const b = bacaBerkasJenis(dbAdmin, bytes, 'SETOR')
  if (b.header.org_id !== kunciAdmin.orgId) throw new GalatPpg('ORG_BERBEDA', 'Setoran ini untuk organisasi lain.')
  const sidik = sidikBerkas(bytes)
  const lama = imporTerdahulu<RingkasanImporSetor>(dbAdmin, sidik)
  if (lama) return { ...lama, sudahPernah: true }

  let isi: IsiSetor
  try {
    isi = dekompresJson<IsiSetor>(bukaSegel(b.isi, kunciAdmin.kotak))
  } catch {
    throw new GalatPpg('TIDAK_BISA_DIBUKA', 'Setoran tidak bisa dibuka dengan kunci admin ini.')
  }
  const adminSignPub = ambilMeta(dbAdmin, 'admin_sign_pub')!
  const pencabutan = daftarPencabutan(dbAdmin)
  const pengirim = b.header.pengirim_perangkat_id
  const tokenSah: PayloadToken[] = []
  const alasanTolak: string[] = []
  for (const teks of Array.isArray(isi.tokens) ? isi.tokens : []) {
    const h = periksaToken(teks, { adminSignPub, pencabutan })
    if (!h.sah) {
      alasanTolak.push(h.alasan)
      continue
    }
    const p = h.payload
    if (p.role !== 'pengurus' && p.role !== 'mubaligh') continue
    if (p.perangkat_id !== pengirim) continue
    if (!periksaBerkas(b, dariB64url(p.device_sign_pub))) continue
    tokenSah.push(p)
    daftarkanToken(dbAdmin, p, teks)
  }
  if (!tokenSah.length) {
    throw new GalatPpg(
      'PENGIRIM_TIDAK_SAH',
      `Setoran ditolak: ${alasanTolak[0] ?? 'tanda tangan atau token pengirim tidak sah.'}`,
    )
  }
  const kelompokBoleh = new Set<string>()
  const kelompokSahkan = new Set<string>()
  for (const p of tokenSah) {
    for (const k of kelompokDalamWilayah(dbAdmin, p.wilayah_id)) {
      kelompokBoleh.add(k)
      if (p.hak.includes('sahkan')) kelompokSahkan.add(k)
    }
  }
  // Keanggotaan generus menurut riwayat admin: kegiatan hanya sah untuk kelompok tempat generus
  // menjadi anggota pada tanggal kegiatan (Fase 1b; mencegah kelompok A mencatat/mengesahkan generus kelompok B).
  const idGenerusMasuk = new Set<string>()
  for (const t of ['presensi', 'kemajuan_belajar', 'penilaian_akhlaq'] as const) {
    for (const r of (isi.rekaman?.[t] ?? []) as Record<string, unknown>[]) if (typeof r?.generus_id === 'string') idGenerusMasuk.add(r.generus_id)
  }
  const petaRiwayat = new PetaRiwayat(dbAdmin, [...idGenerusMasuk])
  const generusAda = new Set(daftarGenerus(dbAdmin, { ids: [...idGenerusMasuk] }).map((g) => g.id))
  const periksaAnggota = (tabel: NamaTabelSinkron, rek: Rekaman, kel: string): string | null => {
    if (tabel !== 'presensi' && tabel !== 'kemajuan_belajar' && tabel !== 'penilaian_akhlaq') return null
    const gid = String(rek.generus_id ?? '')
    if (!generusAda.has(gid)) return 'Generus tidak dikenal admin.'
    const anggota =
      tabel === 'penilaian_akhlaq'
        ? petaRiwayat.anggotaDalamRentang(gid, kel, `${rek.periode}-01`, `${rek.periode}-31`)
        : petaRiwayat.kelompokPada(gid, String(rek.tanggal ?? '')) === kel
    return anggota ? null : 'Generus bukan anggota kelompok ini pada tanggal tersebut.'
  }
  const ditolak: RingkasanImporSetor['ditolak'] = []
  const usulanSebelum = dbAdmin.nilai<number>(`SELECT COUNT(*) FROM usulan WHERE status = 'menunggu'`) ?? 0

  const hasil = dbAdmin.transaksi(() => {
    const g = gabungSemua(dbAdmin, isi.rekaman ?? {}, (tabel) => ({
      sumber: 'perangkat',
      seqLokalBaru: 0,
      periksa: (rek, lamaRek) => {
        const info = TABEL_SINKRON[tabel]
        if (info.jenis !== 'kegiatan') return null
        const kol = 'kolomKelompok' in info ? info.kolomKelompok : undefined
        const kel = kol ? String(rek[kol] ?? '') : ''
        if (!kelompokBoleh.has(kel)) return 'Data di luar wilayah pengirim.'
        if (tabel === 'kemajuan_belajar') {
          if (rek.status_sah !== 'diajukan' && !kelompokSahkan.has(kel)) return 'Pengirim tidak berhak mengesahkan.'
          if (rek.perangkat_id !== pengirim && !kelompokSahkan.has(kel)) return 'Rekaman milik perangkat lain.'
        } else if (rek.perangkat_id !== pengirim) {
          return 'Rekaman milik perangkat lain.'
        }
        if (tabel === 'usulan' && rek.status !== 'menunggu' && lamaRek?.status !== rek.status) {
          return 'Status usulan hanya diputuskan admin.'
        }
        return periksaAnggota(tabel, rek, kel)
      },
    }))
    for (const [t, h] of Object.entries(g.perTabel)) for (const d of h!.ditolak) ditolak.push({ tabel: t, ...d })

    let tokenDilaporkan = 0
    const idTokenPengirim = new Set(tokenSah.map((p) => p.token_id))
    const dikenal = new Set(dbAdmin.kueri<{ id: string }>('SELECT id FROM perangkat').map((x) => x.id))
    for (const t of Array.isArray(isi.perangkat_terbit) ? isi.perangkat_terbit : []) {
      const h = periksaToken(t.token, { adminSignPub, pencabutan, abaikanKedaluwarsa: true })
      const p = h.payload
      if (!p) {
        ditolak.push({ tabel: 'perangkat', id: '?', alasan: h.sah ? '' : h.alasan })
        continue
      }
      const penerbit = uraiToken(p.penerbit ?? '').payload
      if (!idTokenPengirim.has(penerbit.token_id) && !dikenal.has(p.token_id)) {
        ditolak.push({ tabel: 'perangkat', id: p.token_id, alasan: 'Token dilaporkan oleh perangkat yang bukan penerbitnya.' })
        continue
      }
      daftarkanToken(dbAdmin, p, t.token, { label: t.label, diterbitkanOleh: penerbit.token_id })
      tokenDilaporkan++
    }
    const urut = Number(b.header.urut ?? 0)
    catatSeqDiterima(dbAdmin, pengirim, urut)
    if (isi.setor_akhir) {
      for (const p of tokenSah) {
        if (p.role === 'mubaligh') {
          dbAdmin.jalankan('UPDATE perangkat SET setor_akhir_urut = MAX(IFNULL(setor_akhir_urut, 0), ?) WHERE id = ?', [urut, p.token_id])
        }
      }
    }
    const usulanSesudah = dbAdmin.nilai<number>(`SELECT COUNT(*) FROM usulan WHERE status = 'menunggu'`) ?? 0
    const ringkasan: RingkasanImporSetor = {
      jenis: 'SETOR',
      pengirimPerangkatId: pengirim,
      pengirim: tokenSah.map((p) => `${p.nama} (${p.role})`),
      urut,
      sudahPernah: false,
      setorAkhir: !!isi.setor_akhir,
      perTabel: g.perTabel,
      total: g.total,
      usulanBaru: Math.max(0, usulanSesudah - usulanSebelum),
      tokenDilaporkan,
      ditolak,
    }
    catatImpor(dbAdmin, b.header, ringkasan, sidik, namaBerkas)
    return ringkasan
  })
  return hasil
}

