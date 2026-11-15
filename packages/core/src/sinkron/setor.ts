// SETOR: HP pengurus/mubaligh → tingkat atas langsung (EXE kelompok/desa, atau admin daerah untuk token lama);
// v3: EXE desa/kelompok juga menyusun SETOR GABUNGAN ke atas (rekaman asli apa adanya + token & konfirmasi di bawahnya).
import { setujuiUsulan, type KunciAdmin } from '../admin'
import { adalahGalatPpg } from '../galat'
import { ambilUsulan } from '../repo/usulan'
import { dekompresJson, kemasBerkas, kompresJson, periksaBerkas, slug, type BerkasKeluar, type HeaderBerkas } from '../berkas'
import { bukaSegel, dariB64url, segelKe } from '../crypto'
import type { Db } from '../db'
import { gabungSemua, rekamanKirim, type HasilGabung, type RekamanPerTabel } from '../gabung'
import { GalatPpg } from '../galat'
import { adalahKunciExe, profilExe, type KunciPemegang } from '../instalasi'
import { ambilIdentitas } from '../perangkat'
import { idRantaiPenerbit, opsiPeriksaDb } from '../rantai'
import {
  catatJejak,
  catatLaporBawah,
  catatSeqDiterima,
  daftarkanToken,
  daftarPencabutan,
  daftarPerangkat,
  gabungPencabutan,
  tokenDikenal,
  type BarisPencabutan,
  type PerangkatTerdaftar,
} from '../repo/perangkat'
import { daftarProfil, statusProfil } from '../repo/profil'
import { adalahAdmin, adalahExe, ambilMeta, ambilMetaAngka, aturMeta, peranInstalasi, seqBerikut, sisipkanRekaman, type Rekaman } from '../repo/umum'
import { ambilWilayah, kelompokDalamWilayah } from '../repo/wilayah'
import { daftarGenerus } from '../repo/generus'
import { PetaRiwayat } from '../laporan'
import { DAFTAR_TABEL_SINKRON, TABEL_SINKRON, type NamaTabelSinkron } from '../skema'
import { adalahTokenSuperHp, periksaToken, uraiToken, type PayloadToken } from '../token'
import { sekarangIso, tanggalHariIni, tanggalRingkas } from '../waktu'
import { bacaBerkasJenis, catatImpor, imporTerdahulu, kunciAdminTerpasang, sidikBerkas } from './umum'

type TokenLapor = { token: string; diterbitkan_oleh: string | null; label: string | null }

export interface IsiSetor {
  tokens: string[]
  rekaman: RekamanPerTabel
  perangkat_terbit: TokenLapor[]
  setor_akhir?: boolean
  /** v3 (SETOR gabungan EXE): semua token terdaftar di bawah EXE pengirim. */
  perangkat_bawah?: TokenLapor[]
  /** v3: perangkat_id → seq tertinggi yang sudah diterima pengirim dari perangkat itu + waktu terakhirnya. */
  konfirmasi_bawah?: Record<string, { seq: number; terakhir: string | null; setor_akhir?: number }>
  /** v3 (SETOR gabungan EXE): catatan pencabutan/pembekuan yang diketahui EXE pengirim. */
  pencabutan?: BarisPencabutan[]
}

/** Jumlah rekaman lokal yang belum dikonfirmasi tingkat atas ("Ada N data belum disetor"). */
export function jumlahBelumDisetor(db: Db): number {
  const konf = ambilMetaAngka(db, 'konfirmasi_seq')
  let n = 0
  for (const t of DAFTAR_TABEL_SINKRON) n += db.nilai<number>(`SELECT COUNT(*) FROM ${t} WHERE seq_lokal > ?`, [konf]) ?? 0
  return n
}

/** v3: jumlah rekaman lokal yang belum dipastikan sampai di daerah (konfirmasi bertahap). */
export function jumlahBelumSampaiDaerah(db: Db): number {
  const konf = ambilMetaAngka(db, 'konfirmasi_daerah_seq')
  let n = 0
  for (const t of DAFTAR_TABEL_SINKRON) n += db.nilai<number>(`SELECT COUNT(*) FROM ${t} WHERE seq_lokal > ?`, [konf]) ?? 0
  return n
}

/**
 * Buat berkas SETOR berisi semua rekaman dengan seq_lokal > konfirmasi_seq (kumulatif: berkas yang hilang
 * tidak menghilangkan data), usulan, dan token generus/wali yang diterbitkan HP ini.
 * Tujuan: `atas_box_pub` token (EXE kelompok/desa), atau admin daerah untuk token lama.
 * Di EXE desa/kelompok = SETOR gabungan (rekaman dari bawah ikut apa adanya + token, konfirmasi, pencabutan di bawahnya).
 */
export function buatSetor(db: Db, opsi: { setorAkhir?: boolean; semua?: boolean } = {}): BerkasKeluar {
  if (adalahAdmin(db)) throw new GalatPpg('DB_ADMIN', 'Admin daerah tidak menyetor; daerah membuat paket.')
  const exe = adalahExe(db)
  if (exe && peranInstalasi(db) === 'kurikulum') throw new GalatPpg('PERAN_SALAH', 'EXE kurikulum mengirim berkas KURIKULUM, bukan setoran.')
  const admin = kunciAdminTerpasang(db)
  const identitas = ambilIdentitas(db)
  const profil = daftarProfil(db, exe ? ['admin'] : ['pengurus', 'mubaligh'])
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
  const semuaToken = daftarPerangkat(db)
  const terbit = semuaToken
    .filter((p) => (p.role === 'generus' || p.role === 'wali') && p.diterbitkan_oleh && tokenSaya.has(p.diterbitkan_oleh))
    .map((p) => ({ token: p.token, diterbitkan_oleh: p.diterbitkan_oleh, label: p.label }))
  const isi: IsiSetor = { tokens: sah.map((p) => p.token), rekaman, perangkat_terbit: terbit }
  const konfBawah: NonNullable<IsiSetor['konfirmasi_bawah']> = {}
  for (const p of semuaToken) {
    if (p.perangkat_id === identitas.id || (p.seq_diterima <= 0 && p.setor_akhir_urut === null)) continue
    const terakhir = [p.terakhir_setor, p.terakhir_lapor].filter((x): x is string => !!x).sort().pop() ?? null
    const ada = konfBawah[p.perangkat_id]
    const e = !ada || p.seq_diterima > ada.seq ? { seq: p.seq_diterima, terakhir, ...(ada?.setor_akhir ? { setor_akhir: ada.setor_akhir } : {}) } : ada
    // Setor Akhir mubaligh ikut naik agar daerah bisa melakukan serah terima tanpa `paksa`
    if (p.setor_akhir_urut !== null) e.setor_akhir = Math.max(e.setor_akhir ?? 0, p.setor_akhir_urut)
    konfBawah[p.perangkat_id] = e
  }
  if (Object.keys(konfBawah).length) isi.konfirmasi_bawah = konfBawah
  if (exe) {
    isi.perangkat_bawah = semuaToken
      .filter((p) => !tokenSaya.has(p.id))
      .map((p) => ({ token: p.token, diterbitkan_oleh: p.diterbitkan_oleh, label: p.label }))
    isi.pencabutan = daftarPencabutan(db)
  }
  if (opsi.setorAkhir) isi.setor_akhir = true
  const wilayah = sah[0]!.wilayah_id
  const tp = uraiToken(sah[0]!.token).payload
  const header: HeaderBerkas = {
    jenis: 'SETOR',
    versi_format: 1,
    org_id: admin.orgId,
    pengirim_perangkat_id: identitas.id,
    dibuat_pada: sekarangIso(),
    wilayah_id: wilayah,
    urut,
    penerima_perangkat_id: tp.atas_perangkat_id ?? 'ADMIN',
  }
  const tujuan = tp.atas_box_pub ?? admin.boxPub
  const bytes = kemasBerkas(header, segelKe(dariB64url(tujuan), kompresJson(isi)), identitas.tandaTangan.rahasia)
  aturMeta(db, 'terakhir_setor', sekarangIso())
  const namaW = slug(ambilWilayah(db, wilayah)?.nama ?? wilayah)
  return {
    nama: `PPG_SETOR${opsi.setorAkhir ? '_AKHIR' : ''}_${namaW}_${tanggalRingkas()}_${urut}.ppg`,
    bytes,
    header,
  }
}

/** Nama tampilan tujuan setoran HP/EXE ini (mis. "EXE Desa Klasaman" / "admin daerah"). */
export function tujuanSetor(db: Db): { perangkatId: string; nama: string; tingkat: 'daerah' | 'desa' | 'kelompok' } | null {
  const exe = adalahExe(db)
  const p = daftarProfil(db, exe ? ['admin'] : ['pengurus', 'mubaligh']).find((x) => statusProfil(x).bolehMencatat)
  if (!p) return null
  const tp = uraiToken(p.token).payload
  if (!tp.atas_perangkat_id) return { perangkatId: 'ADMIN', nama: 'Daerah', tingkat: 'daerah' }
  const atas = daftarPerangkat(db, { perangkatId: tp.atas_perangkat_id, role: 'admin' })[0]
  const penerbit = tp.penerbit ? uraiToken(tp.penerbit).payload : undefined
  // Fase 9: HP yang didaftarkan Super Admin HP menyetor ke HP Super Admin itu
  const atasSuper = atas?.tingkat === 'daerah' ? atas.nama : penerbit?.perangkat_id === tp.atas_perangkat_id && penerbit.tingkat === 'daerah' ? penerbit.nama : null
  if (atasSuper !== null) return { perangkatId: tp.atas_perangkat_id, nama: `Super Admin ${atasSuper}`.trim(), tingkat: 'daerah' }
  let wilayahId: string | undefined
  let tingkat: 'desa' | 'kelompok' = 'desa'
  if (atas) {
    wilayahId = atas.wilayah_id
    tingkat = atas.tingkat === 'kelompok' ? 'kelompok' : 'desa'
  } else if (penerbit?.perangkat_id === tp.atas_perangkat_id) {
    wilayahId = penerbit.wilayah_id
    tingkat = penerbit.tingkat === 'kelompok' ? 'kelompok' : 'desa'
  } else {
    // tujuan bukan penerbit (EXE desa) → EXE kelompok di kelompok token ini
    wilayahId = tp.wilayah_id
    tingkat = 'kelompok'
  }
  const w = wilayahId ? ambilWilayah(db, wilayahId) : undefined
  return { perangkatId: tp.atas_perangkat_id, nama: w ? `${tingkat === 'kelompok' ? 'Kelompok' : 'Desa'} ${w.nama}` : tingkat === 'kelompok' ? 'EXE kelompok' : 'EXE desa', tingkat }
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
  /** v3: SETOR gabungan dari EXE desa/kelompok. */
  gabungan: boolean
  /** v3: token di bawah pengirim yang dicatat (SETOR gabungan). */
  perangkatBawah: number
  /** v3: catatan pencabutan dari EXE pengirim yang diterima. */
  pencabutanDiterima: number
  /** Fase 9: usulan Super Admin HP yang langsung disetujui daerah. */
  usulanOtomatis?: number
}

const ROLE_PENYETOR: readonly PayloadToken['role'][] = ['pengurus', 'mubaligh', 'admin']

/**
 * Impor SETOR di EXE daerah (admin) atau EXE desa/kelompok (v3): verifikasi tanda tangan & rantai token, tolak
 * pengirim dicabut / di luar wilayah, periksa wewenang (T13 diperluas ke rantai), gabungkan, catat seq_diterima &
 * jejak konfirmasi. Idempoten (berkas yang sama → `sudahPernah`; data yang sama → diabaikan).
 * `kunci`: KunciAdmin di daerah, KunciExe di EXE desa/kelompok.
 */
export function imporSetor(db: Db, bytes: Uint8Array, kunci: KunciPemegang, namaBerkas?: string): RingkasanImporSetor {
  const daerah = adalahAdmin(db)
  const exe = adalahExe(db)
  if (!daerah && !exe) throw new GalatPpg('BUKAN_DB_ADMIN', 'Setoran hanya bisa diimpor di aplikasi admin (EXE daerah/desa/kelompok).')
  if (daerah === adalahKunciExe(kunci)) throw new GalatPpg('KUNCI_SALAH', 'Kunci tidak cocok dengan instalasi ini.')
  const peran = peranInstalasi(db)
  if (exe && peran !== 'desa' && peran !== 'kelompok' && peran !== 'super_hp') {
    throw new GalatPpg('BUKAN_PENERIMA_SETOR', 'EXE ini tidak menerima setoran (hanya EXE daerah, desa, kelompok, atau Super Admin HP).')
  }
  const b = bacaBerkasJenis(db, bytes, 'SETOR')
  const orgId = daerah ? (kunci as KunciAdmin).orgId : ambilMeta(db, 'org_id')
  if (b.header.org_id !== orgId) throw new GalatPpg('ORG_BERBEDA', 'Setoran ini untuk organisasi lain.')
  const idSaya = daerah ? 'ADMIN' : (kunci as { perangkatId: string }).perangkatId
  const tujuan = b.header.penerima_perangkat_id
  if (tujuan && tujuan !== idSaya) {
    throw new GalatPpg(
      'BUKAN_PENERIMA_SETOR',
      tujuan === 'ADMIN'
        ? 'Setoran ini ditujukan langsung ke daerah. Kirim ke admin daerah.'
        : 'Setoran ini ditujukan ke tingkat lain (EXE kelompok/desa atau Super Admin HP yang mendaftarkan HP itu). Kirim ke tujuan yang benar.',
    )
  }
  const sidik = sidikBerkas(bytes)
  const lama = imporTerdahulu<RingkasanImporSetor>(db, sidik)
  if (lama) return { ...lama, sudahPernah: true }

  let isi: IsiSetor
  try {
    isi = dekompresJson<IsiSetor>(bukaSegel(b.isi, kunci.kotak))
  } catch {
    throw new GalatPpg('TIDAK_BISA_DIBUKA', 'Setoran tidak bisa dibuka dengan kunci instalasi ini.')
  }
  const opsi = opsiPeriksaDb(db)
  const mencakup = opsi.wilayahMencakup!
  const saya = exe ? profilExe(db) : null
  const pengirim = b.header.pengirim_perangkat_id
  const tokenSah: PayloadToken[] = []
  const alasanTolak: string[] = []
  for (const teks of Array.isArray(isi.tokens) ? isi.tokens : []) {
    const h = periksaToken(teks, opsi)
    if (!h.sah) {
      alasanTolak.push(h.alasan)
      continue
    }
    const p = h.payload
    if (!ROLE_PENYETOR.includes(p.role)) continue
    if (p.perangkat_id !== pengirim) continue
    if (!periksaBerkas(b, dariB64url(p.device_sign_pub))) continue
    // EXE hanya menerima dari wilayahnya sendiri/bawahnya, dan bukan dari EXE sejawat di wilayah yang sama
    if (saya && ((p.role === 'admin' && p.wilayah_id === saya.wilayah_id) || mencakup(saya.wilayah_id, p.wilayah_id) !== true)) {
      alasanTolak.push('Pengirim berada di luar wilayah EXE ini.')
      continue
    }
    tokenSah.push(p)
    daftarkanToken(db, p, teks)
  }
  if (!tokenSah.length) {
    throw new GalatPpg('PENGIRIM_TIDAK_SAH', `Setoran ditolak: ${alasanTolak[0] ?? 'tanda tangan atau token pengirim tidak sah.'}`)
  }
  const gabungan = tokenSah.some((p) => p.role === 'admin')
  // Fase 9: pengirim Super Admin HP (admin tingkat daerah) — usulannya disetujui otomatis di daerah
  const superPengirim = tokenSah.some((p) => adalahTokenSuperHp(p))
  const idTokenPengirim = new Set(tokenSah.map((p) => p.token_id))
  const dalamCakupan = (wilayahId: string) => tokenSah.some((p) => mencakup(p.wilayah_id, wilayahId) === true)
  const kelompokBoleh = new Set<string>()
  const kelompokSahkan = new Set<string>()
  for (const p of tokenSah) {
    for (const k of kelompokDalamWilayah(db, p.wilayah_id)) {
      kelompokBoleh.add(k)
      if (p.hak.includes('sahkan')) kelompokSahkan.add(k)
    }
  }
  // Keanggotaan generus menurut riwayat penerima: kegiatan hanya sah untuk kelompok tempat generus
  // menjadi anggota pada tanggal kegiatan (Fase 1b; mencegah kelompok A mencatat/mengesahkan generus kelompok B).
  const idGenerusMasuk = new Set<string>()
  for (const t of ['presensi', 'kemajuan_belajar', 'penilaian_akhlaq'] as const) {
    for (const r of (isi.rekaman?.[t] ?? []) as Record<string, unknown>[]) if (typeof r?.generus_id === 'string') idGenerusMasuk.add(r.generus_id)
  }
  const petaRiwayat = new PetaRiwayat(db, [...idGenerusMasuk])
  const generusAda = new Set(daftarGenerus(db, { ids: [...idGenerusMasuk] }).map((g) => g.id))
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
  const usulanSebelum = db.nilai<number>(`SELECT COUNT(*) FROM usulan WHERE status = 'menunggu'`) ?? 0

  return db.transaksi(() => {
    // --- v3: token di bawah EXE pengirim (dicatat dulu agar rantai & pencabutan bisa diperiksa) ---
    let perangkatBawah = 0
    const dikenal = tokenDikenal(db)
    if (gabungan) {
      const daftar = (Array.isArray(isi.perangkat_bawah) ? isi.perangkat_bawah : []).filter((t) => t && typeof t.token === 'string')
      const kedalaman = (t: TokenLapor) => idRantaiPenerbit(t.token).length
      for (const t of [...daftar].sort((a, b2) => kedalaman(a) - kedalaman(b2))) {
        const h = periksaToken(t.token, { ...opsi, abaikanKedaluwarsa: true, tokenDikenal: dikenal })
        const p = h.payload
        if (!p) {
          ditolak.push({ tabel: 'perangkat', id: '?', alasan: h.sah ? '' : h.alasan })
          continue
        }
        if (idTokenPengirim.has(p.token_id)) continue
        // kurikulum hanya dicatat bila diterbitkan pengirim (Fase 9: Super Admin HP menerbitkan EXE kurikulum)
        if (p.role === 'kurikulum' && !idRantaiPenerbit(t.token).some((id) => idTokenPengirim.has(id))) continue
        if (!dalamCakupan(p.wilayah_id)) {
          ditolak.push({ tabel: 'perangkat', id: p.token_id, alasan: 'Token di luar wilayah pengirim.' })
          continue
        }
        const baru = !dikenal.has(p.token_id)
        daftarkanToken(db, p, t.token, { label: t.label, diterbitkanOleh: t.diterbitkan_oleh ?? (p.penerbit ? uraiToken(p.penerbit).payload.token_id : null) })
        dikenal.add(p.token_id)
        perangkatBawah++
        if (baru && daerah && p.role === 'mubaligh') pastikanPenugasan(db, p.perangkat_id, p.wilayah_id)
      }
    }
    // --- v3: pencabutan dari EXE pengirim: hanya untuk token yang rantai penerbitnya melewati pengirim ---
    let pencabutanDiterima = 0
    if (gabungan && Array.isArray(isi.pencabutan)) {
      const terima = isi.pencabutan.filter((c) => {
        const t = c && typeof c.token_id === 'string' ? daftarPerangkat(db).find((x) => x.id === c.token_id) : undefined
        return !!t && idRantaiPenerbit(t.token).some((id) => idTokenPengirim.has(id))
      })
      pencabutanDiterima = gabungPencabutan(db, terima)
    }
    // token terdaftar di bawah pengirim (perangkat_id → token) untuk aturan pemilik rekaman (T13 diperluas ke rantai)
    const tokenBawah = new Map<string, PerangkatTerdaftar[]>()
    if (gabungan) {
      for (const t of daftarPerangkat(db)) {
        if (t.perangkat_id === pengirim || idTokenPengirim.has(t.id) || t.role === 'kurikulum' || !dalamCakupan(t.wilayah_id)) continue
        const l = tokenBawah.get(t.perangkat_id) ?? []
        l.push(t)
        tokenBawah.set(t.perangkat_id, l)
        if (hakToken(t.token).includes('sahkan')) for (const k of kelompokDalamWilayah(db, t.wilayah_id)) kelompokSahkan.add(k)
      }
    }
    const seqBaru = exe ? seqBerikut(db) : 0
    const g = gabungSemua(db, isi.rekaman ?? {}, (tabel) => ({
      sumber: 'perangkat',
      seqLokalBaru: seqBaru,
      periksa: (rek, lamaRek) => {
        const info = TABEL_SINKRON[tabel]
        if (info.jenis !== 'kegiatan') return null
        const kol = 'kolomKelompok' in info ? info.kolomKelompok : undefined
        const kel = kol ? String(rek[kol] ?? '') : ''
        // Fase 9: usulan boleh untuk wilayah desa/daerah (tambah wilayah/pengajian) — cukup di dalam cakupan pengirim
        if (tabel === 'usulan' ? !kelompokBoleh.has(kel) && !(gabungan && (dalamCakupan(kel) || superPengirim)) : !kelompokBoleh.has(kel)) {
          return 'Data di luar wilayah pengirim.'
        }
        if (gabungan) {
          if (rek.perangkat_id !== pengirim) {
            const tok = tokenBawah.get(String(rek.perangkat_id))
            if (!tok) return 'Rekaman milik perangkat di luar wilayah pengirim.'
            if (!tok.some((t) => !t.dicabut_pada || String(rek.diubah_pada) < t.dicabut_pada)) return 'Rekaman dibuat setelah token perangkatnya dicabut.'
          }
          if (tabel === 'kemajuan_belajar' && rek.status_sah !== 'diajukan' && !kelompokSahkan.has(kel)) return 'Pengirim tidak berhak mengesahkan.'
        } else if (tabel === 'kemajuan_belajar') {
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
    let usulanOtomatis = 0
    if (daerah && superPengirim) usulanOtomatis = setujuiUsulanSuper(db, isi.rekaman?.usulan ?? [], pengirim, ditolak)

    let tokenDilaporkan = 0
    const pencabutan = daftarPencabutan(db)
    for (const t of Array.isArray(isi.perangkat_terbit) ? isi.perangkat_terbit : []) {
      const h = periksaToken(t.token, { ...opsi, pencabutan, abaikanKedaluwarsa: true })
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
      daftarkanToken(db, p, t.token, { label: t.label, diterbitkanOleh: penerbit.token_id })
      dikenal.add(p.token_id)
      tokenDilaporkan++
    }
    const urut = Number(b.header.urut ?? 0)
    const seqSesudah = ambilMetaAngka(db, 'seq')
    // v3: konfirmasi bertahap — seq perangkat di bawah pengirim yang sudah ikut setoran ini
    const boleh = new Set<string>()
    for (const t of daftarPerangkat(db)) {
      if (t.perangkat_id === pengirim) continue
      if (gabungan ? tokenBawah.has(t.perangkat_id) || (dalamCakupan(t.wilayah_id) && t.role !== 'kurikulum') : idRantaiPenerbit(t.token).some((id) => idTokenPengirim.has(id))) {
        boleh.add(t.perangkat_id)
      }
    }
    for (const [pid, k] of Object.entries(isi.konfirmasi_bawah ?? {})) {
      if (!boleh.has(pid) || !k || typeof k.seq !== 'number') continue
      catatLaporBawah(db, pid, k.seq, typeof k.terakhir === 'string' ? k.terakhir : null)
      if (typeof k.setor_akhir === 'number' && k.setor_akhir >= 0) {
        db.jalankan(`UPDATE perangkat SET setor_akhir_urut = MAX(IFNULL(setor_akhir_urut, 0), ?) WHERE perangkat_id = ? AND role = 'mubaligh'`, [k.setor_akhir, pid])
      }
      if (exe) catatJejak(db, pid, k.seq, seqSesudah)
    }
    catatSeqDiterima(db, pengirim, urut)
    if (exe) catatJejak(db, pengirim, urut, seqSesudah)
    if (isi.setor_akhir) {
      for (const p of tokenSah) {
        if (p.role === 'mubaligh') {
          db.jalankan('UPDATE perangkat SET setor_akhir_urut = MAX(IFNULL(setor_akhir_urut, 0), ?) WHERE id = ?', [urut, p.token_id])
        }
      }
    }
    const usulanSesudah = db.nilai<number>(`SELECT COUNT(*) FROM usulan WHERE status = 'menunggu'`) ?? 0
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
      usulanOtomatis,
      tokenDilaporkan,
      ditolak,
      gabungan,
      perangkatBawah,
      pencabutanDiterima,
    }
    catatImpor(db, b.header, ringkasan, sidik, namaBerkas)
    return ringkasan
  })
}

/**
 * Fase 9: usulan dari Super Admin HP (token akar tertanda daerah, bisa dicabut daerah) langsung disetujui di daerah —
 * master tetap hanya ditulis daerah (K5), id rekaman baru = id yang sudah dipakai HP (mis. generus untuk token wali).
 * Usulan yang gagal diterapkan tetap menunggu (dicatat di `ditolak` sebagai keterangan).
 */
function setujuiUsulanSuper(db: Db, rekaman: unknown[], pengirim: string, ditolak: RingkasanImporSetor['ditolak']): number {
  let n = 0
  const urutan: Record<string, number> = { tambah_wilayah: 0, tambah_pengajian: 1, tambah_generus: 2 }
  const daftar = rekaman
    .filter((r): r is Rekaman => !!r && typeof (r as Rekaman).id === 'string' && (r as Rekaman).perangkat_id === pengirim)
    .map((r) => ambilUsulan(db, r.id))
    .filter((u): u is NonNullable<typeof u> => !!u && u.status === 'menunggu' && u.perangkat_id === pengirim)
    // wilayah baru dulu (desa sebelum kelompok), lalu pengajian, generus, dan perubahan lain
    .sort((a, b) => (urutan[a.jenis] ?? 3) - (urutan[b.jenis] ?? 3) || tingkatUsulan(a.data) - tingkatUsulan(b.data) || a.dibuat_pada.localeCompare(b.dibuat_pada))
  for (const u of daftar) {
    try {
      db.transaksi(() => setujuiUsulan(db, u.id))
      n++
    } catch (e) {
      ditolak.push({ tabel: 'usulan', id: u.id, alasan: `Usulan belum bisa disetujui otomatis: ${adalahGalatPpg(e) ? e.pesan : String(e)}` })
    }
  }
  return n
}

function tingkatUsulan(d: Record<string, unknown>): number {
  return d.tingkat === 'desa' ? 0 : d.tingkat === 'kelompok' ? 1 : 2
}

/** Daerah: penugasan mubaligh untuk token mubaligh yang diterbitkan EXE desa (dilaporkan lewat SETOR gabungan). */
function pastikanPenugasan(db: Db, perangkatId: string, kelompokId: string): void {
  const sudah = db.nilai<string>(
    `SELECT id FROM penugasan_mubaligh WHERE perangkat_mubaligh_id = ? AND kelompok_id = ? AND selesai IS NULL AND dihapus = 0`,
    [perangkatId, kelompokId],
  )
  if (!sudah) sisipkanRekaman(db, 'penugasan_mubaligh', { perangkat_mubaligh_id: perangkatId, kelompok_id: kelompokId, mulai: tanggalHariIni(), selesai: null })
}

function hakToken(teks: string): string[] {
  try {
    return uraiToken(teks).payload.hak
  } catch {
    return []
  }
}
