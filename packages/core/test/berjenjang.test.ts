// Uji unit v3 (§14): rantai berjenjang, instalasi EXE, alur naik/turun gabungan, kurikulum, jadwal setor, pertemuan.
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  absenPertemuan,
  aktifkanExe,
  aktifkanProfil,
  ambilPertemuan,
  aturJadwalSetor,
  aturMateriPertemuan,
  aturPeriodeAktif,
  bekukanPerangkat,
  bukaDb,
  bukaKunciExe,
  bukaPertemuan,
  buatBalasan,
  buatKurikulum,
  buatMateri,
  buatPaket,
  buatSetor,
  buatKodePerangkat,
  bukaBerkasApaSaja,
  cabutPerangkat,
  daftarMateri,
  daftarPerangkat,
  daftarPresensi,
  daftarTarget,
  gantiSandiExe,
  hitungTenggat,
  idRantaiPenerbit,
  imporKurikulum,
  imporSetor,
  infoInstalasi,
  infoSinkronHp,
  serahTerimaMubaligh,
  setorAkhir,
  statusSetorAkhir,
  inisialisasiExe,
  keB64url,
  kunciExe,
  materiPerluDituntaskan,
  pengingatSetor,
  periksaToken,
  periodeAktif,
  periodeDariTanggal,
  progresKelas,
  ringkasanBerandaExe,
  simpanDb,
  statusSetor,
  tambahGenerus,
  tambahPengajian,
  tambahWilayah,
  tandaiTuntas,
  tandaTanganiToken,
  tandaTanganiBuktiWilayah,
  terapkanBalasan,
  terapkanMateri,
  terapkanPaket,
  terbitkanToken,
  terbitkanTokenBawah,
  terbitkanTokenGenerus,
  tetapkanTarget,
  tujuanSetor,
  uraiToken,
  buatPasanganKotak,
  buatPasanganTandaTangan,
  siapkanKripto,
  type Db,
  type Generus,
  type KunciAdmin,
  type KunciExe,
  type PayloadToken,
  type Wilayah,
} from '../src/index'
import { buatAdmin, buatHp, lepasJam, maju, pasangJam } from './bantu'

await siapkanKripto()

const SANDI = 'sandi-exe-123'

interface Dunia {
  daerah: { db: Db; kunci: KunciAdmin }
  D: Wilayah
  desaA: Wilayah
  desaB: Wilayah
  A1: Wilayah
  A2: Wilayah
  B1: Wilayah
  exeA: { db: Db; kunci: KunciExe; token: string }
  g: Generus[]
}

async function exeBaru(daerah: { db: Db; kunci: KunciAdmin }, wilayahId: string, role: 'admin' | 'kurikulum' = 'admin') {
  const db = await bukaDb()
  const { kodePerangkat, kunci } = await inisialisasiExe(db, { sandi: SANDI, label: 'EXE' })
  const token = terbitkanToken(daerah.db, daerah.kunci, { kodePerangkat, role, nama: 'Admin', wilayahId })
  await aktifkanExe(db, kunci, token)
  return { db, kunci, token }
}

async function dunia(): Promise<Dunia> {
  const daerah = await buatAdmin()
  const D = tambahWilayah(daerah.db, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
  const desaA = tambahWilayah(daerah.db, { tingkat: 'desa', nama: 'Desa A', kode: 'DA', indukId: D.id })
  const desaB = tambahWilayah(daerah.db, { tingkat: 'desa', nama: 'Desa B', kode: 'DB', indukId: D.id })
  const A1 = tambahWilayah(daerah.db, { tingkat: 'kelompok', nama: 'A1', kode: 'A1', indukId: desaA.id })
  const A2 = tambahWilayah(daerah.db, { tingkat: 'kelompok', nama: 'A2', kode: 'A2', indukId: desaA.id })
  const B1 = tambahWilayah(daerah.db, { tingkat: 'kelompok', nama: 'B1', kode: 'B1', indukId: desaB.id })
  const g = [
    tambahGenerus(daerah.db, { kelompokId: A1.id, nama: 'Ali', jenisKelamin: 'L', kategori: 'caberawit', mulai: '2026-10-01' }),
    tambahGenerus(daerah.db, { kelompokId: A1.id, nama: 'Budi', jenisKelamin: 'L', kategori: 'caberawit', mulai: '2026-10-01' }),
    tambahGenerus(daerah.db, { kelompokId: B1.id, nama: 'Eka', jenisKelamin: 'P', kategori: 'caberawit', mulai: '2026-10-01' }),
  ]
  const exeA = await exeBaru(daerah, desaA.id)
  terapkanPaket(exeA.db, buatPaket(daerah.db, desaA.id, daerah.kunci).bytes)
  terapkanMateri(exeA.db, buatMateri(daerah.db, daerah.kunci).bytes)
  return { daerah, D, desaA, desaB, A1, A2, B1, exeA, g }
}

/** HP mubaligh A1 diaktifkan EXE desa A, paket desa terpasang. */
async function mubalighA1(d: Dunia) {
  const hp = await buatHp('HP Mubaligh')
  const token = terbitkanTokenBawah(d.exeA.db, d.exeA.kunci, { kodePerangkat: hp.kode, role: 'mubaligh', nama: 'Ust. A', wilayahId: d.A1.id })
  const profil = await aktifkanProfil(hp.db, token)
  terapkanPaket(hp.db, buatPaket(d.exeA.db, d.A1.id, d.exeA.kunci).bytes)
  terapkanMateri(hp.db, buatMateri(d.daerah.db, d.daerah.kunci).bytes)
  return { ...hp, token, profil }
}

beforeEach(() => pasangJam('2026-11-16T01:00:00.000Z'))
afterAll(() => lepasJam())

describe('rantai kepercayaan berjenjang (periksaToken)', () => {
  const admin = buatPasanganTandaTangan()
  const desa = { s: buatPasanganTandaTangan(), b: buatPasanganKotak() }
  const hp = { s: buatPasanganTandaTangan(), b: buatPasanganKotak() }
  const pub = keB64url(admin.publik)
  const tree: Record<string, string | null> = { D: null, DA: 'D', DB: 'D', A1: 'DA', B1: 'DB' }
  const mencakup = (a: string, b: string) => {
    if (!(b in tree)) return undefined
    for (let k: string | null = b; k; k = tree[k] ?? null) if (k === a) return true
    return false
  }
  const dasar = (o: Partial<PayloadToken>, dev = hp): PayloadToken => ({
    v: 1,
    token_id: 'T-' + Math.random(),
    org_id: 'ORG',
    admin_sign_pub: pub,
    admin_box_pub: 'BOX',
    perangkat_id: 'P',
    device_sign_pub: keB64url(dev.s.publik),
    device_box_pub: keB64url(dev.b.publik),
    role: 'pengurus',
    nama: 'X',
    tingkat: 'kelompok',
    wilayah_id: 'A1',
    hak: ['catat', 'lihat'],
    terbit: '2026-01-02T00:00:00.000Z',
    berlaku_sampai: '2027-01-01T00:00:00.000Z',
    ...o,
  })
  const tokenDesa = (o: Partial<PayloadToken> = {}) =>
    tandaTanganiToken(dasar({ role: 'admin', tingkat: 'desa', wilayah_id: 'DA', hak: ['catat', 'lihat', 'terbit_bawah'], terbit: '2026-01-01T00:00:00.000Z', ...o }, desa), admin.rahasia)
  const olehDesa = (p: Partial<PayloadToken>, penerbit = tokenDesa()) => tandaTanganiToken(dasar({ penerbit, ...p }), desa.s.rahasia)
  const opsi = (o: Partial<Parameters<typeof periksaToken>[1]> = {}) => ({ adminSignPub: pub, sekarang: '2026-06-01T00:00:00.000Z', wilayahMencakup: mencakup, ...o })

  it('token dari EXE desa (hak terbit_bawah) sah untuk wilayah di dalam desa', () => {
    expect(periksaToken(tokenDesa(), opsi()).sah).toBe(true)
    expect(periksaToken(olehDesa({}), opsi()).sah).toBe(true)
    expect(periksaToken(olehDesa({ role: 'mubaligh', hak: ['catat', 'lihat', 'sahkan', 'terbit_generus'] }), opsi()).sah).toBe(true)
    expect(periksaToken(olehDesa({ role: 'admin', hak: ['catat', 'lihat', 'sahkan'] }), opsi()).sah).toBe(true)
    expect(periksaToken(olehDesa({ tingkat: 'desa', wilayah_id: 'DA' }), opsi()).sah).toBe(true)
  })

  it('rantai generus/wali melewati mubaligh yang diterbitkan desa', () => {
    const m = olehDesa({ role: 'mubaligh', hak: ['catat', 'lihat', 'sahkan', 'terbit_generus'] })
    const gen = { s: buatPasanganTandaTangan(), b: buatPasanganKotak() }
    const g = tandaTanganiToken(dasar({ role: 'generus', generus_ids: ['G1'], hak: ['catat', 'lihat', 'setor_belajar'], penerbit: m, terbit: '2026-02-01T00:00:00.000Z' }, gen), hp.s.rahasia)
    expect(periksaToken(g, opsi()).sah).toBe(true)
    expect(idRantaiPenerbit(g)).toHaveLength(2)
  })

  it('wilayah anak harus ⊆ desa penerbit; hak/peran/tingkat dibatasi', () => {
    expect(periksaToken(olehDesa({ wilayah_id: 'B1' }), opsi())).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
    // tanpa pohon wilayah (HP baru) pemeriksaan wilayah dilewati
    expect(periksaToken(olehDesa({ wilayah_id: 'B1' }), opsi({ wilayahMencakup: undefined })).sah).toBe(true)
    // Fase 8: HP/EXE kelompok (wajib bukti wilayah) menolak token tanpa bukti daerah, juga untuk kelompok yang benar
    expect(periksaToken(olehDesa({ wilayah_id: 'B1' }), opsi({ wilayahMencakup: undefined, wajibBuktiWilayah: true }))).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
    expect(periksaToken(olehDesa({}), opsi({ wajibBuktiWilayah: true }))).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
    const bukti = tandaTanganiBuktiWilayah('ORG', 'A1', 'DA', admin.rahasia)
    expect(periksaToken(olehDesa({ bukti_wilayah: bukti }), opsi({ wilayahMencakup: undefined, wajibBuktiWilayah: true })).sah).toBe(true)
    expect(periksaToken(olehDesa({ wilayah_id: 'B1', bukti_wilayah: bukti }), opsi({ wilayahMencakup: () => true }))).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
    expect(periksaToken(olehDesa({ hak: ['catat', 'terbit_bawah'] }), opsi())).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
    expect(periksaToken(olehDesa({ role: 'admin', tingkat: 'desa', wilayah_id: 'DA', hak: ['catat'] }), opsi())).toMatchObject({ kode: 'TOKEN_TIDAK_SAH' })
    expect(periksaToken(olehDesa({ role: 'kurikulum', tingkat: 'daerah', wilayah_id: 'D', hak: ['lihat'] }), opsi())).toMatchObject({ kode: 'TOKEN_TIDAK_SAH' })
    expect(periksaToken(olehDesa({ role: 'generus', generus_ids: ['G'], hak: ['catat'] }), opsi())).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
    expect(periksaToken(olehDesa({ tingkat: 'desa' }), opsi())).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
    // penerbit tanpa terbit_bawah (EXE kelompok) atau bukan EXE
    const kel = tandaTanganiToken(dasar({ role: 'admin', tingkat: 'kelompok', wilayah_id: 'A1', hak: ['catat', 'lihat', 'sahkan'] }, desa), admin.rahasia)
    expect(periksaToken(olehDesa({}, kel), opsi())).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
    // terbit_bawah hanya untuk EXE desa (token akar)
    expect(periksaToken(tokenDesa({ tingkat: 'kelompok', wilayah_id: 'A1' }), opsi())).toMatchObject({ kode: 'TOKEN_TIDAK_SAH' })
    expect(periksaToken(tandaTanganiToken(dasar({ role: 'kurikulum', tingkat: 'desa', hak: ['lihat'] }), admin.rahasia), opsi())).toMatchObject({ kode: 'TOKEN_TIDAK_SAH' })
  })

  it('tanda tangan, masa berlaku, dan pencabutan di setiap mata rantai', () => {
    // ditandatangani bukan oleh perangkat desa penerbit
    expect(periksaToken(tandaTanganiToken(dasar({ penerbit: tokenDesa() }), hp.s.rahasia), opsi())).toMatchObject({ kode: 'TANDA_TANGAN_TIDAK_SAH' })
    // token desa palsu (tidak ditandatangani daerah)
    const desaPalsu = tandaTanganiToken(dasar({ role: 'admin', tingkat: 'desa', wilayah_id: 'DA', hak: ['terbit_bawah'], terbit: '2026-01-01T00:00:00.000Z' }, desa), desa.s.rahasia)
    expect(periksaToken(olehDesa({}, desaPalsu), opsi())).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
    // terbit sebelum token desa terbit
    expect(periksaToken(olehDesa({ terbit: '2025-12-01T00:00:00.000Z' }), opsi())).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
    const td = tokenDesa()
    const idDesa = uraiToken(td).payload.token_id
    const cabut = [{ token_id: idDesa, jenis: 'cabut' as const, tanggal: '2026-03-01T00:00:00.000Z' }]
    const sebelum = olehDesa({ terbit: '2026-02-01T00:00:00.000Z' }, td)
    const sesudah = olehDesa({ terbit: '2026-04-01T00:00:00.000Z' }, td)
    expect(periksaToken(sesudah, opsi({ pencabutan: cabut }))).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
    expect(periksaToken(sebelum, opsi({ pencabutan: cabut })).sah).toBe(true)
    expect(periksaToken(sebelum, opsi({ pencabutan: cabut, tokenDikenal: new Set() }))).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
    expect(periksaToken(sebelum, opsi({ pencabutan: cabut, tokenDikenal: new Set([uraiToken(sebelum).payload.token_id]) })).sah).toBe(true)
    // generus di bawah mubaligh desa: desa dicabut sebelum mubaligh terbit → generus ikut ditolak
    const m = olehDesa({ role: 'mubaligh', hak: ['catat', 'lihat', 'sahkan', 'terbit_generus'], terbit: '2026-04-01T00:00:00.000Z' }, td)
    const g = tandaTanganiToken(dasar({ role: 'generus', generus_ids: ['G'], hak: ['catat'], penerbit: m, terbit: '2026-05-01T00:00:00.000Z' }, hp), hp.s.rahasia)
    expect(periksaToken(g, opsi())).toMatchObject({ sah: true })
    expect(periksaToken(g, opsi({ pencabutan: cabut }))).toMatchObject({ kode: 'RANTAI_TIDAK_SAH' })
  })

  it('rantai terlalu panjang ditolak', () => {
    let t = tokenDesa()
    for (let i = 0; i < 4; i++) t = olehDesa({ role: 'admin', tingkat: 'desa', wilayah_id: 'DA', hak: ['catat'] }, t)
    expect(periksaToken(t, opsi()).sah).toBe(false)
  })
})

describe('instalasi EXE', () => {
  it('inisialisasi, kunci terenkripsi, ganti sandi, aktivasi & perannya', async () => {
    const d = await dunia()
    const db = await bukaDb()
    const { kodePerangkat, kunci } = await inisialisasiExe(db, { sandi: SANDI, label: 'EXE Desa B' })
    await expect(inisialisasiExe(db, { sandi: SANDI, label: 'x' })).rejects.toMatchObject({ kode: 'SUDAH_DIINISIALISASI' })
    await expect(inisialisasiExe(await bukaDb(), { sandi: 'pendek', label: 'x' })).rejects.toMatchObject({ kode: 'SANDI_LEMAH' })
    expect(infoInstalasi(db)).toMatchObject({ peran: null, aktif: false, terkunci: false })
    // token HP tidak bisa untuk EXE; token pengurus ditolak
    const tokHp = terbitkanToken(d.daerah.db, d.daerah.kunci, { kodePerangkat, role: 'pengurus', nama: 'P', wilayahId: d.desaB.id })
    await expect(aktifkanExe(db, kunci, tokHp)).rejects.toMatchObject({ kode: 'TOKEN_UNTUK_HP' })
    const tok = terbitkanToken(d.daerah.db, d.daerah.kunci, { kodePerangkat, role: 'admin', nama: 'Admin B', wilayahId: d.desaB.id })
    await aktifkanExe(db, kunci, tok)
    expect(infoInstalasi(db)).toMatchObject({ peran: 'desa', wilayahId: d.desaB.id, aktif: true })
    // token untuk peran/wilayah lain ditolak
    const tokLain = terbitkanToken(d.daerah.db, d.daerah.kunci, { kodePerangkat, role: 'admin', nama: 'A2', wilayahId: d.A2.id })
    await expect(aktifkanExe(db, kunci, tokLain)).rejects.toMatchObject({ kode: 'PERAN_BERBEDA' })
    await gantiSandiExe(db, SANDI, 'sandi-baru-456')
    const ulang = await bukaDb(simpanDb(db))
    expect(infoInstalasi(ulang).terkunci).toBe(true)
    await expect(bukaKunciExe(ulang, SANDI)).rejects.toMatchObject({ kode: 'SANDI_SALAH' })
    await bukaKunciExe(ulang, 'sandi-baru-456')
    expect(infoInstalasi(ulang).terkunci).toBe(false)
    kunciExe(ulang)
    expect(() => buatSetor(ulang)).toThrow(/terkunci/)
    // validasi penerbitan token EXE oleh daerah
    expect(() => terbitkanToken(d.daerah.db, d.daerah.kunci, { kodePerangkat, role: 'kurikulum', nama: 'K', wilayahId: d.desaA.id })).toThrow(/daerah/)
    expect(() => terbitkanToken(d.daerah.db, d.daerah.kunci, { kodePerangkat, role: 'admin', nama: 'K', wilayahId: d.D.id })).toThrow(/desa atau kelompok/)
    expect(() => terbitkanToken(d.daerah.db, d.daerah.kunci, { kodePerangkat, role: 'admin', nama: 'K', wilayahId: d.A1.id, hak: ['terbit_bawah'] })).toThrow(/terbit_bawah/)
  })

  it('EXE desa: penerbitan token dibatasi wilayah, peran, dan kunci kelompok', async () => {
    const d = await dunia()
    const hp = await buatHp('HP')
    const kode = hp.kode
    expect(() => terbitkanTokenBawah(d.exeA.db, d.exeA.kunci, { kodePerangkat: kode, role: 'mubaligh', nama: 'M', wilayahId: d.desaA.id })).toThrow(/satu kelompok/)
    expect(() => terbitkanTokenBawah(d.exeA.db, d.exeA.kunci, { kodePerangkat: kode, role: 'generus' as never, nama: 'M', wilayahId: d.A1.id })).toThrow(/EXE desa menerbitkan/)
    expect(() => terbitkanTokenBawah(d.exeA.db, d.exeA.kunci, { kodePerangkat: kode, role: 'pengurus', nama: 'M', wilayahId: d.A1.id, hak: ['sahkan'] })).toThrow(/Hak/)
    expect(() => terbitkanTokenBawah(d.exeA.db, d.exeA.kunci, { kodePerangkat: kode, role: 'pengurus', nama: ' ', wilayahId: d.A1.id })).toThrow(/Nama/)
    // pengurus tingkat desa → SETOR langsung ke EXE desa
    const t = uraiToken(terbitkanTokenBawah(d.exeA.db, d.exeA.kunci, { kodePerangkat: kode, role: 'pengurus', nama: 'P', wilayahId: d.desaA.id })).payload
    expect(t).toMatchObject({ tingkat: 'desa', atas_perangkat_id: d.exeA.kunci.perangkatId })
    // EXE kelompok aktif → HP di kelompok itu menyetor ke EXE kelompok
    const ek = await bukaDb()
    const ik = await inisialisasiExe(ek, { sandi: SANDI, label: 'EXE A2' })
    const tk = terbitkanTokenBawah(d.exeA.db, d.exeA.kunci, { kodePerangkat: ik.kodePerangkat, role: 'admin', nama: 'A2', wilayahId: d.A2.id })
    await aktifkanExe(ek, ik.kunci, tk)
    const hp2 = await buatHp('HP A2')
    const tm = terbitkanTokenBawah(d.exeA.db, d.exeA.kunci, { kodePerangkat: hp2.kode, role: 'mubaligh', nama: 'M2', wilayahId: d.A2.id })
    expect(uraiToken(tm).payload.atas_perangkat_id).toBe(ik.kunci.perangkatId)
    await aktifkanProfil(hp2.db, tm)
    expect(tujuanSetor(hp2.db)).toMatchObject({ perangkatId: ik.kunci.perangkatId, tingkat: 'kelompok' })
    // EXE kelompok tidak berhak menerbitkan
    expect(() => terbitkanTokenBawah(ek, ik.kunci, { kodePerangkat: kode, role: 'pengurus', nama: 'P', wilayahId: d.A2.id })).toThrow(/tidak berhak/)
    // HP mubaligh di kelompok lain ditolak (K12)
    expect(() => terbitkanTokenBawah(d.exeA.db, d.exeA.kunci, { kodePerangkat: hp2.kode, role: 'mubaligh', nama: 'M2', wilayahId: d.A1.id })).toThrow(/K12/)
    // kunci kelompok belum dititipkan → mubaligh tidak bisa diterbitkan
    const db2 = await bukaDb()
    const i2 = await inisialisasiExe(db2, { sandi: SANDI, label: 'EXE B' })
    await aktifkanExe(db2, i2.kunci, terbitkanToken(d.daerah.db, d.daerah.kunci, { kodePerangkat: i2.kodePerangkat, role: 'admin', nama: 'B', wilayahId: d.desaB.id }))
    expect(() => terbitkanTokenBawah(db2, i2.kunci, { kodePerangkat: kode, role: 'pengurus', nama: 'P', wilayahId: d.B1.id })).toThrow(/Wilayah tidak ditemukan/)
    terapkanPaket(db2, buatPaket(d.daerah.db, d.desaB.id, d.daerah.kunci).bytes)
    db2.jalankan('DELETE FROM kunci_titipan')
    expect(() => terbitkanTokenBawah(db2, i2.kunci, { kodePerangkat: kode, role: 'mubaligh', nama: 'M', wilayahId: d.B1.id })).toThrow(/Kunci kelompok/)
  })

  it('EXE desa hanya mencabut token di bawahnya; pencabutannya naik ke daerah lewat SETOR gabungan', async () => {
    const d = await dunia()
    const m = await mubalighA1(d)
    const idM = uraiToken(m.token).payload.token_id
    imporSetor(d.exeA.db, buatSetor(m.db).bytes, d.exeA.kunci)
    // token terbitan daerah (EXE desa itu sendiri) tidak boleh dicabut EXE desa
    expect(() => cabutPerangkat(d.exeA.db, uraiToken(d.exeA.token).payload.token_id)).toThrow(/daerah/)
    maju(5)
    bekukanPerangkat(d.exeA.db, idM)
    const r = imporSetor(d.daerah.db, buatSetor(d.exeA.db).bytes, d.daerah.kunci)
    expect(r.pencabutanDiterima).toBe(1)
    expect(daftarPerangkat(d.daerah.db, { role: 'mubaligh' })[0]!.dibekukan).toBe(true)
  })
})

describe('SETOR gabungan: wewenang berantai di daerah', () => {
  it('rekaman dari perangkat di luar wilayah pengirim / sesudah dicabut ditolak; pengesahan butuh hak sahkan', async () => {
    const d = await dunia()
    const m = await mubalighA1(d)
    bukaPertemuan(m.db, { kelompokId: d.A1.id, tanggal: '2026-11-16' })
    imporSetor(d.exeA.db, buatSetor(m.db).bytes, d.exeA.kunci)
    const pm = uraiToken(m.token).payload
    // rekaman rakitan di EXE desa: milik perangkat asing, milik mubaligh sesudah dicabut, pengesahan oleh pengurus
    const sync = (pid: string, waktu: string) => `'${pid}', '${waktu}', '${waktu}', 0, 1, 900`
    d.exeA.db.jalankan(`INSERT INTO presensi VALUES ('PR-ASING', ?, NULL, NULL, '2026-11-16', ?, 'hadir', ${sync('HP-ASING', '2026-11-16T02:00:00.000Z')}, NULL)`, [d.A1.id, d.g[0]!.id])
    d.exeA.db.jalankan(`INSERT INTO presensi VALUES ('PR-B1', ?, NULL, NULL, '2026-11-16', ?, 'hadir', ${sync(pm.perangkat_id, '2026-11-16T02:00:00.000Z')}, NULL)`, [d.B1.id, d.g[2]!.id])
    d.exeA.db.jalankan(`INSERT INTO presensi VALUES ('PR-TELAT', ?, NULL, NULL, '2026-11-16', ?, 'hadir', ${sync(pm.perangkat_id, '2026-12-30T00:00:00.000Z')}, NULL)`, [d.A1.id, d.g[1]!.id])
    d.exeA.db.jalankan(`UPDATE meta SET nilai = '1000' WHERE kunci = 'seq'`)
    maju(5)
    cabutPerangkat(d.exeA.db, pm.token_id)
    const r = imporSetor(d.daerah.db, buatSetor(d.exeA.db).bytes, d.daerah.kunci)
    const alasan = Object.fromEntries(r.ditolak.map((x) => [x.id, x.alasan]))
    expect(alasan['PR-ASING']).toMatch(/di luar wilayah pengirim/)
    expect(alasan['PR-B1']).toMatch(/di luar wilayah/)
    expect(alasan['PR-TELAT']).toMatch(/dicabut/)
    expect(r.perTabel.pertemuan?.ditambah).toBe(1)
    // sumber pengesahan: EXE desa tanpa mubaligh berhak sahkan di A2 → kemajuan disahkan untuk A2 ditolak
    const dua = await dunia()
    dua.exeA.db.jalankan(
      `INSERT INTO kemajuan_belajar VALUES ('KB-X', ?, ?, 'MAT-ALM-HFS-001', 'selesai', NULL, NULL, '2026-11-16', 'mubaligh', 'disahkan', 'X', '2026-11-16T00:00:00Z', NULL, NULL, ${sync(dua.exeA.kunci.perangkatId, '2026-11-16T02:00:00.000Z')})`,
      ['G-?', dua.A2.id],
    )
    const r2 = imporSetor(dua.daerah.db, buatSetor(dua.exeA.db).bytes, dua.daerah.kunci)
    expect(r2.ditolak.find((x) => x.id === 'KB-X')?.alasan).toMatch(/mengesahkan/)
  })

  it('SETOR untuk tingkat lain ditolak; EXE kurikulum tidak menerima/menyetor; HP di luar desa ditolak desa', async () => {
    const d = await dunia()
    const kur = await exeBaru(d.daerah, d.D.id, 'kurikulum')
    expect(() => buatSetor(kur.db)).toThrow(/KURIKULUM/)
    const hp = await buatHp('HP B1')
    await aktifkanProfil(hp.db, terbitkanToken(d.daerah.db, d.daerah.kunci, { kodePerangkat: hp.kode, role: 'pengurus', nama: 'P', wilayahId: d.B1.id }))
    const s = buatSetor(hp.db)
    expect(s.header.penerima_perangkat_id).toBe('ADMIN')
    expect(() => imporSetor(kur.db, s.bytes, kur.kunci)).toThrow(/tidak menerima/)
    expect(() => imporSetor(d.exeA.db, s.bytes, d.exeA.kunci)).toThrow(/langsung ke daerah/)
    expect(() => imporSetor(d.exeA.db, s.bytes, d.daerah.kunci)).toThrow(/Kunci tidak cocok/)
    expect(() => bukaBerkasApaSaja(kur.db, s.bytes)).toThrow(/tidak menerima/)
  })
})

describe('tiga tingkat: HP → EXE kelompok → EXE desa → daerah', () => {
  it('data & token naik berantai; konfirmasi "sampai daerah" turun lagi ke HP', async () => {
    const d = await dunia()
    const ek = await bukaDb()
    const ik = await inisialisasiExe(ek, { sandi: SANDI, label: 'EXE A1' })
    await aktifkanExe(ek, ik.kunci, terbitkanTokenBawah(d.exeA.db, d.exeA.kunci, { kodePerangkat: ik.kodePerangkat, role: 'admin', nama: 'Admin A1', wilayahId: d.A1.id }))
    terapkanPaket(ek, buatPaket(d.exeA.db, d.A1.id, d.exeA.kunci).bytes)
    terapkanMateri(ek, buatMateri(d.daerah.db, d.daerah.kunci).bytes)
    const hp = await buatHp('HP Mubaligh A1')
    const tok = terbitkanTokenBawah(d.exeA.db, d.exeA.kunci, { kodePerangkat: hp.kode, role: 'mubaligh', nama: 'Ust. A1', wilayahId: d.A1.id })
    const profil = await aktifkanProfil(hp.db, tok)
    terapkanPaket(hp.db, buatPaket(d.exeA.db, d.A1.id, d.exeA.kunci).bytes)
    terapkanMateri(hp.db, buatMateri(d.daerah.db, d.daerah.kunci).bytes)
    const hpG = await buatHp('HP Ali')
    await aktifkanProfil(hpG.db, terbitkanTokenGenerus(hp.db, profil.id, { kodePerangkat: hpG.kode, role: 'generus', generusIds: [d.g[0]!.id], nama: 'Ali' }))
    const p = bukaPertemuan(hp.db, { kelompokId: d.A1.id, tanggal: '2026-11-16', materiIds: ['MAT-ALM-HFS-001'] })
    absenPertemuan(hp.db, p.id, [{ generusId: d.g[0]!.id, status: 'hadir', tuntas: ['MAT-ALM-HFS-001'] }])
    // HP → EXE kelompok (tujuan dari token), EXE kelompok → EXE desa → daerah
    const s1 = buatSetor(hp.db)
    expect(s1.header.penerima_perangkat_id).toBe(ik.kunci.perangkatId)
    expect(() => imporSetor(d.exeA.db, s1.bytes, d.exeA.kunci)).toThrow(/tingkat lain/)
    expect(imporSetor(ek, s1.bytes, ik.kunci)).toMatchObject({ gabungan: false, tokenDilaporkan: 1, ditolak: [] })
    maju(5)
    expect(imporSetor(d.exeA.db, buatSetor(ek).bytes, d.exeA.kunci)).toMatchObject({ gabungan: true, ditolak: [] })
    maju(5)
    const r = imporSetor(d.daerah.db, buatSetor(d.exeA.db).bytes, d.daerah.kunci)
    expect(r.ditolak).toEqual([])
    expect(daftarPresensi(d.daerah.db, { kelompokIds: [d.A1.id] })).toHaveLength(1)
    expect(daftarPerangkat(d.daerah.db, { wilayahIds: [d.A1.id] }).map((x) => x.role).sort()).toEqual(['admin', 'generus', 'mubaligh'])
    // daerah melihat waktu setor kelompok A1 (dilaporkan desa)
    expect(statusSetor(d.daerah.db, d.desaA.id).find((x) => x.wilayah_id === d.A1.id)!.terakhirSetor).not.toBeNull()
    // konfirmasi turun: daerah → desa → EXE kelompok → HP (paket EXE kelompok, versi per penerbit)
    terapkanPaket(d.exeA.db, buatPaket(d.daerah.db, d.desaA.id, d.daerah.kunci).bytes)
    terapkanPaket(ek, buatPaket(d.exeA.db, d.A1.id, d.exeA.kunci).bytes)
    expect(infoSinkronHp(hp.db).belumDisetor).toBeGreaterThan(0)
    const pk = buatPaket(ek, d.A1.id, ik.kunci)
    terapkanPaket(hp.db, pk.bytes)
    expect(infoSinkronHp(hp.db)).toMatchObject({ belumDisetor: 0, belumSampaiDaerah: 0 })
    // EXE kelompok juga bisa mengirim BALASAN ke HP generus (kunci kelompok titipan)
    terapkanMateri(hpG.db, buatMateri(d.daerah.db, d.daerah.kunci).bytes)
    terapkanBalasan(hpG.db, buatBalasan(ek, hpG.id).bytes)
    expect(daftarPresensi(hpG.db, {})).toHaveLength(1)
    expect(ringkasanBerandaExe(ek)).toMatchObject({ peran: 'kelompok', belumSampaiDaerah: 0 })
    expect(statusSetor(ek, d.A1.id).map((x) => x.perangkat_id)).toEqual([hp.id])
  })
})

describe('serah terima mubaligh terbitan desa', () => {
  it('Setor Akhir naik lewat desa → daerah serah terima tanpa paksa → kunci baru turun ke mubaligh baru', async () => {
    const d = await dunia()
    const m = await mubalighA1(d)
    imporSetor(d.exeA.db, setorAkhir(m.db).bytes, d.exeA.kunci)
    maju(5)
    imporSetor(d.daerah.db, buatSetor(d.exeA.db).bytes, d.daerah.kunci)
    expect(statusSetorAkhir(d.daerah.db, m.id).lengkap).toBe(true)
    const r = serahTerimaMubaligh(d.daerah.db, d.daerah.kunci, { kelompokId: d.A1.id, perangkatLamaId: m.id })
    expect(r.versiKunciBaru).toBe(2)
    maju(5)
    terapkanPaket(d.exeA.db, buatPaket(d.daerah.db, d.desaA.id, d.daerah.kunci).bytes)
    const baru = await buatHp('HP Mubaligh Baru')
    const pb = await aktifkanProfil(baru.db, terbitkanTokenBawah(d.exeA.db, d.exeA.kunci, { kodePerangkat: baru.kode, role: 'mubaligh', nama: 'Ust. B', wilayahId: d.A1.id }))
    expect(pb.rahasia.kunci_kelompok_setor?.map((k) => k.versi)).toEqual([1, 2])
    expect(pb.rahasia.kunci_umum_versi).toBe(2)
  })
})

describe('PAKET dari EXE', () => {
  it('EXE hanya membuat paket untuk wilayahnya; HP menolak paket EXE yang membawa materi/data di luar wilayahnya', async () => {
    const d = await dunia()
    const m = await mubalighA1(d)
    expect(() => buatPaket(d.exeA.db, d.B1.id, d.exeA.kunci)).toThrow(/di luar wilayah/)
    expect(() => buatPaket(d.exeA.db, d.A1.id, d.daerah.kunci)).toThrow(/Kunci tidak cocok/)
    // EXE desa A menyunting materi lokal (seolah) → HP menolak materi lewat paket EXE
    d.exeA.db.jalankan(`UPDATE materi SET nama = 'Palsu', versi = 99 WHERE id = 'MAT-ALM-HFS-001'`)
    maju(1)
    const r = terapkanPaket(m.db, buatPaket(d.exeA.db, d.A1.id, d.exeA.kunci).bytes)
    expect(r.total.ditolak.length).toBe(0) // materi memang tidak dikirim di paket
    expect(daftarMateri(m.db).find((x) => x.id === 'MAT-ALM-HFS-001')!.nama).not.toBe('Palsu')
    // versi paket dicatat per penerbit: paket daerah v1 untuk A1 tetap diterima walau paket desa v2
    terapkanPaket(d.exeA.db, buatPaket(d.daerah.db, d.desaA.id, d.daerah.kunci).bytes)
    expect(() => terapkanPaket(m.db, buatPaket(d.daerah.db, d.A1.id, d.daerah.kunci).bytes)).toThrow(/bukan untuk HP ini/) // HP diterbitkan desa: bukan penerima daerah
  })
})

describe('kurikulum & periode', () => {
  it('periode tahun ajaran, target menggantikan daftar lama, berkas KURIKULUM', async () => {
    expect(periodeDariTanggal('2026-11-15')).toBe('2026-S1')
    expect(periodeDariTanggal('2027-03-01')).toBe('2026-S2')
    expect(periodeDariTanggal('2026-07-01')).toBe('2026-S1')
    const d = await dunia()
    expect(periodeAktif(d.daerah.db)).toBe('2026-S1')
    const ids = daftarMateri(d.daerah.db).slice(0, 4).map((m) => m.id)
    tetapkanTarget(d.daerah.db, { periode: '2026-S1', kategoriGenerus: 'caberawit', materiIds: ids.slice(0, 3) })
    tetapkanTarget(d.daerah.db, { periode: '2026-S1', kategoriGenerus: 'caberawit', materiIds: [ids[3]!, ids[0]!] })
    expect(daftarTarget(d.daerah.db, { kategoriGenerus: 'caberawit' }).map((t) => [t.id, t.urutan_target])).toEqual([[ids[3], 1], [ids[0], 2]])
    expect(() => tetapkanTarget(d.daerah.db, { periode: '2026', kategoriGenerus: 'caberawit', materiIds: [] })).toThrow(/Periode/)
    expect(() => tetapkanTarget(d.daerah.db, { periode: '2026-S1', kategoriGenerus: 'caberawit', materiIds: ['X'] })).toThrow(/tidak ditemukan/)
    expect(() => aturPeriodeAktif(d.exeA.db, '2026-S2')).toThrow(/kurikulum/)
    aturPeriodeAktif(d.daerah.db, '2026-S2')
    expect(periodeAktif(d.daerah.db)).toBe('2026-S2')
    // berkas KURIKULUM: hanya dari EXE kurikulum, token kurikulum sah
    expect(() => buatKurikulum(d.exeA.db)).toThrow(/EXE kurikulum/)
    const kur = await exeBaru(d.daerah, d.D.id, 'kurikulum')
    terapkanMateri(kur.db, buatMateri(d.daerah.db, d.daerah.kunci).bytes)
    expect(periodeAktif(kur.db)).toBe('2026-S2')
    tetapkanTarget(kur.db, { periode: '2026-S2', kategoriGenerus: 'remaja', materiIds: [ids[1]!] })
    const k = buatKurikulum(kur.db)
    expect(() => imporKurikulum(d.exeA.db, k.bytes, d.daerah.kunci)).toThrow(/daerah/)
    maju(5)
    cabutPerangkat(d.daerah.db, uraiToken(kur.token).payload.token_id)
    maju(5)
    expect(() => imporKurikulum(d.daerah.db, k.bytes, d.daerah.kunci)).toThrow(/ditolak/)
  })
})

describe('jadwal setor & status', () => {
  const j = (o: object) => ({ tingkat_asal: 'desa', pola: 'bulanan', hari: null, tanggal_bulan: 5, jam: '12:00', ...o }) as never
  it('hitungTenggat pekanan & bulanan (jam lokal)', () => {
    const kini = new Date(2026, 10, 16, 10, 0) // Senin 16 Nov 10.00
    const p = hitungTenggat(j({ pola: 'pekanan', hari: 0, tanggal_bulan: null, jam: '21:00' }), kini)
    expect([p.berikut.getDate(), p.berikut.getHours(), p.terakhir.getDate(), p.awalPeriode.getDate()]).toEqual([22, 21, 15, 8])
    const b = hitungTenggat(j({}), kini)
    expect([b.berikut.getMonth(), b.berikut.getDate(), b.terakhir.getMonth(), b.awalPeriode.getMonth()]).toEqual([11, 5, 10, 9])
    const tepat = hitungTenggat(j({}), new Date(2026, 11, 5, 12, 0))
    expect(tepat.berikut.getMonth()).toBe(0) // tenggat yang sedang berlangsung dihitung lewat
    const pagi = hitungTenggat(j({ pola: 'pekanan', hari: 1, jam: null }), kini)
    expect([pagi.berikut.getDate(), pagi.berikut.getHours()]).toEqual([16, 23])
  })

  it('statusSetor per tingkat, pengingat HP, tanpa jadwal = tidak terlambat', async () => {
    const d = await dunia()
    expect(statusSetor(d.daerah.db, d.D.id).every((x) => !x.terlambat && x.tenggatBerikutnya === null)).toBe(true)
    expect(() => aturJadwalSetor(d.exeA.db, { tingkatAsal: 'desa', pola: 'bulanan', tanggal: 5 })).toThrow()
    expect(() => aturJadwalSetor(d.daerah.db, { tingkatAsal: 'desa', pola: 'bulanan', tanggal: 30 })).toThrow(/1–28/)
    expect(() => aturJadwalSetor(d.daerah.db, { tingkatAsal: 'desa', pola: 'pekanan', hari: 7 })).toThrow(/Hari/)
    aturJadwalSetor(d.daerah.db, { tingkatAsal: 'kelompok', pola: 'pekanan', hari: 0, jam: '21:00' })
    aturJadwalSetor(d.daerah.db, { tingkatAsal: 'kelompok', pola: 'pekanan', hari: 6, jam: '21:00' }) // perbarui
    terapkanPaket(d.exeA.db, buatPaket(d.daerah.db, d.desaA.id, d.daerah.kunci).bytes)
    const m = await mubalighA1(d)
    const ing = pengingatSetor(m.db)!
    expect(ing).toMatchObject({ terlambat: true, tujuan: { tingkat: 'desa' } }) // belum pernah setor
    expect(new Date(ing.tenggatBerikutnya!).getDay()).toBe(6)
    imporSetor(d.exeA.db, buatSetor(m.db).bytes, d.exeA.kunci)
    expect(pengingatSetor(m.db)).toMatchObject({ terlambat: false, belumDisetor: 0, tampilkanTombol: false })
    const sk = statusSetor(d.exeA.db, d.A1.id)
    expect(sk).toHaveLength(1)
    expect(sk[0]).toMatchObject({ perangkat_id: m.id, terlambat: false })
    expect(statusSetor(d.exeA.db, d.desaA.id).map((x) => [x.nama, x.terlambat])).toEqual([['A1', false], ['A2', true]])
    expect(pengingatSetor(d.daerah.db)).toBeNull()
    expect(statusSetor(d.daerah.db, 'TIDAK-ADA')).toEqual([])
    expect(ringkasanBerandaExe(m.db).peran).toBe('hp')
  })
})

describe('pertemuan, absen, kueri kelas', () => {
  it('pertemuan idempoten per kelas & tanggal; tandai tuntas tidak ganda; generus tidak bisa mengabsen', async () => {
    const d = await dunia()
    const ids = daftarMateri(d.daerah.db, { kategoriGenerus: 'caberawit' }).slice(0, 2).map((m) => m.id)
    tetapkanTarget(d.daerah.db, { periode: '2026-S1', kategoriGenerus: 'caberawit', materiIds: ids })
    const kelas = tambahPengajian(d.daerah.db, { wilayahId: d.A1.id, nama: 'Kelas', hari: 1, kategoriGenerus: ['caberawit', 'paud'] })
    expect(kelas.kategori_generus).toBe('caberawit,paud')
    expect(() => tambahPengajian(d.daerah.db, { wilayahId: d.A1.id, nama: 'X', kategoriGenerus: ['dewasa' as never] })).toThrow(/Kategori/)
    terapkanPaket(d.exeA.db, buatPaket(d.daerah.db, d.desaA.id, d.daerah.kunci).bytes)
    const m = await mubalighA1(d)
    const p1 = bukaPertemuan(m.db, { kelompokId: d.A1.id, tanggal: '2026-11-16', pengajianId: kelas.id, materiIds: [ids[0]!] })
    const p2 = bukaPertemuan(m.db, { kelompokId: d.A1.id, tanggal: '2026-11-16', pengajianId: kelas.id, materiIds: [ids[0]!, ids[1]!], catatan: 'Muroja’ah' })
    expect(p2.id).toBe(p1.id)
    expect(ambilPertemuan(m.db, p1.id)).toMatchObject({ materi_ids: ids, catatan: 'Muroja’ah' })
    aturMateriPertemuan(m.db, p1.id, [ids[1]!])
    expect(() => absenPertemuan(m.db, p1.id, [{ generusId: d.g[0]!.id, status: 'hadir', tuntas: [ids[0]!] }])).toThrow(/materi pertemuan/)
    expect(() => bukaPertemuan(m.db, { kelompokId: d.A1.id, tanggal: '16-11-2026' })).toThrow(/Tanggal/)
    expect(() => bukaPertemuan(m.db, { kelompokId: d.A1.id, tanggal: '2026-11-16', materiIds: ['X'] })).toThrow(/Materi/)
    expect(() => bukaPertemuan(m.db, { kelompokId: d.B1.id, tanggal: '2026-11-16' })).toThrow(/berwenang/)
    expect(absenPertemuan(m.db, p1.id, [{ generusId: d.g[0]!.id, status: 'hadir', tuntas: [ids[1]!] }]).tuntas).toBe(1)
    expect(absenPertemuan(m.db, p1.id, [{ generusId: d.g[0]!.id, status: 'hadir', tuntas: [ids[1]!] }]).tuntas).toBe(0)
    expect(tandaiTuntas(m.db, { generusId: d.g[0]!.id, materiId: ids[1]!, tanggal: '2026-11-16' })).toBeNull()
    expect(daftarPresensi(m.db, { generusIds: [d.g[0]!.id] })).toHaveLength(1)
    const pk = progresKelas(m.db, d.A1.id)
    expect(pk).toMatchObject({ periode: '2026-S1', rataRata: 25 })
    expect(pk.materi.map((x) => x.jumlahTuntas)).toEqual([0, 1])
    expect(materiPerluDituntaskan(m.db, 'TIDAK-ADA')).toBeNull()
    // HP generus: tidak bisa membuka pertemuan; tanpa target → adaTarget false
    const hpG = await buatHp('HP Ali')
    await aktifkanProfil(hpG.db, terbitkanTokenGenerus(m.db, m.profil.id, { kodePerangkat: hpG.kode, role: 'generus', generusIds: [d.g[0]!.id], nama: 'Ali' }))
    terapkanMateri(hpG.db, buatMateri(d.daerah.db, d.daerah.kunci).bytes)
    terapkanBalasan(hpG.db, buatBalasan(m.db, hpG.id).bytes)
    expect(() => bukaPertemuan(hpG.db, { kelompokId: d.A1.id, tanggal: '2026-11-16' })).toThrow(/berwenang/)
    expect(materiPerluDituntaskan(hpG.db, d.g[0]!.id)).toMatchObject({ adaTarget: true, total: 2, tuntas: 1 })
    expect(materiPerluDituntaskan(hpG.db, d.g[0]!.id, { periode: '2027-S1' })).toMatchObject({ adaTarget: false, total: 0, persen: 0 })
  })

  it('kode perangkat EXE bisa dibaca sebagai Kode Perangkat biasa', () => {
    const s = buatPasanganTandaTangan()
    const b = buatPasanganKotak()
    expect(buatKodePerangkat({ perangkat_id: 'X', sign_pub: keB64url(s.publik), box_pub: keB64url(b.publik), label: 'EXE', dibuat_pada: '' })).toMatch(/^PPGD1\./)
  })
})
