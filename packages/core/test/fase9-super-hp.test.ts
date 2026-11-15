// Fase 9 — Super Admin HP: tiga HP Super Admin (token admin tingkat daerah dari EXE Daerah) mendaftarkan
// mubaligh/orang tua/murid/EXE, menambah generus/wilayah sebagai usulan, setor gabungan ke daerah, daerah melihat semuanya,
// lalu daerah mencabut satu Super Admin HP dan tokennya ditolak sesudahnya.
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  aktifkanExe,
  aktifkanProfil,
  ajukanUsulan,
  ambilGenerus,
  ambilWilayah,
  buatBalasan,
  buatBelajar,
  buatMateri,
  buatPaket,
  buatSetor,
  bukaDb,
  bukaKunciExe,
  cabutPerangkat,
  catatKemajuan,
  catatPresensi,
  daftarPerangkat,
  daftarUsulan,
  generusPilihanToken,
  idMateri,
  imporBelajar,
  imporSetor,
  infoInstalasi,
  inisialisasiExe,
  kunciExe,
  periksaTokenDb,
  ringkasanBerandaExe,
  siapkanKripto,
  tambahGenerus,
  tambahWilayah,
  tandaTanganiToken,
  terapkanBalasan,
  terapkanMateri,
  terapkanPaket,
  terbitkanToken,
  terbitkanTokenBawah,
  tujuanSetor,
  uraiToken,
  type Db,
  type KunciAdmin,
  type KunciExe,
  type Wilayah,
} from '../src/index'
import { buatAdmin, buatHp, lepasJam, maju, pasangJam } from './bantu'

await siapkanKripto()

const SANDI = 'sandi-super-123'

interface SuperHp {
  db: Db
  kunci: KunciExe
  token: string
  tokenId: string
}

/** HP Super Admin: instalasi jenis EXE di HP, diaktifkan token admin tingkat daerah dari EXE Daerah. */
async function superBaru(daerah: { db: Db; kunci: KunciAdmin }, daerahId: string, nama: string): Promise<SuperHp> {
  const db = await bukaDb()
  const { kodePerangkat, kunci } = await inisialisasiExe(db, { sandi: SANDI, label: `HP ${nama}` })
  const token = terbitkanToken(daerah.db, daerah.kunci, { kodePerangkat, role: 'admin', nama, wilayahId: daerahId })
  await aktifkanExe(db, kunci, token, { superHp: true })
  return { db, kunci, token, tokenId: uraiToken(token).payload.token_id }
}

interface Dunia {
  daerah: { db: Db; kunci: KunciAdmin }
  D: Wilayah
  desaA: Wilayah
  desaB: Wilayah
  A1: Wilayah
  B1: Wilayah
  s: SuperHp[]
  /** Daerah → semua Super Admin HP: paket daerah + materi. */
  paketKeSuper: () => void
}

async function dunia(): Promise<Dunia> {
  const daerah = await buatAdmin()
  const D = tambahWilayah(daerah.db, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
  const desaA = tambahWilayah(daerah.db, { tingkat: 'desa', nama: 'Klasaman', kode: 'KLS', indukId: D.id })
  const desaB = tambahWilayah(daerah.db, { tingkat: 'desa', nama: 'Malanu', kode: 'MLN', indukId: D.id })
  const A1 = tambahWilayah(daerah.db, { tingkat: 'kelompok', nama: 'Klasaman 1', kode: 'K1', indukId: desaA.id })
  const B1 = tambahWilayah(daerah.db, { tingkat: 'kelompok', nama: 'Malanu 1', kode: 'M1', indukId: desaB.id })
  tambahGenerus(daerah.db, { kelompokId: B1.id, nama: 'Citra', jenisKelamin: 'P', kategori: 'caberawit', mulai: '2026-10-01' })
  const s = [await superBaru(daerah, D.id, 'Pak Fir'), await superBaru(daerah, D.id, 'Ust. Hasan'), await superBaru(daerah, D.id, 'Bu Aminah')]
  const materi = buatMateri(daerah.db, daerah.kunci).bytes
  const paketKeSuper = () => {
    const paket = buatPaket(daerah.db, D.id, daerah.kunci).bytes
    for (const x of s) terapkanPaket(x.db, paket)
  }
  for (const x of s) terapkanMateri(x.db, materi)
  paketKeSuper()
  return { daerah, D, desaA, desaB, A1, B1, s, paketKeSuper }
}

beforeEach(() => pasangJam('2026-11-16T01:00:00.000Z'))
afterAll(() => lepasJam())

describe('Fase 9 — Super Admin HP', () => {
  it('aktivasi: peran super_hp, kunci perangkat terlindung sandi, token salah tempat ditolak', async () => {
    const d = await dunia()
    const [s1] = d.s
    expect(infoInstalasi(s1!.db)).toMatchObject({ peran: 'super_hp', wilayahId: d.D.id, terkunci: false })
    expect(uraiToken(s1!.token).payload).toMatchObject({ role: 'admin', tingkat: 'daerah', hak: ['catat', 'lihat', 'terbit_bawah'] })
    // kunci otomatis → semua tindakan menolak sampai sandi dimasukkan
    kunciExe(s1!.db)
    expect(infoInstalasi(s1!.db).terkunci).toBe(true)
    await expect(bukaKunciExe(s1!.db, 'salah-sandi-1')).rejects.toMatchObject({ kode: 'SANDI_SALAH' })
    s1!.kunci = await bukaKunciExe(s1!.db, SANDI)
    // token Super Admin HP ditempel di laptop EXE (tanpa superHp) → ditolak; di profil HP biasa → ditolak
    const dbExe = await bukaDb()
    const ex = await inisialisasiExe(dbExe, { sandi: SANDI, label: 'Laptop' })
    const tokLaptop = terbitkanToken(d.daerah.db, d.daerah.kunci, { kodePerangkat: ex.kodePerangkat, role: 'admin', nama: 'X', wilayahId: d.D.id })
    await expect(aktifkanExe(dbExe, ex.kunci, tokLaptop)).rejects.toMatchObject({ kode: 'TOKEN_UNTUK_SUPER_HP' })
    const hp = await buatHp('HP biasa')
    const tokHp = terbitkanToken(d.daerah.db, d.daerah.kunci, { kodePerangkat: hp.kode, role: 'admin', nama: 'Y', wilayahId: d.D.id })
    await expect(aktifkanProfil(hp.db, tokHp)).rejects.toMatchObject({ kode: 'TOKEN_UNTUK_EXE' })
    // kode EXE desa ditempel di Super Admin HP → ditolak
    const dbS = await bukaDb()
    const sx = await inisialisasiExe(dbS, { sandi: SANDI, label: 'HP S' })
    const tokDesa = terbitkanToken(d.daerah.db, d.daerah.kunci, { kodePerangkat: sx.kodePerangkat, role: 'admin', nama: 'Z', wilayahId: d.desaA.id })
    await expect(aktifkanExe(dbS, sx.kunci, tokDesa, { superHp: true })).rejects.toMatchObject({ kode: 'TOKEN_UNTUK_EXE' })
  })

  it('tiga Super Admin HP mendaftarkan semua peran, setor gabungan ke daerah, daerah melihat semua; pencabutan berlaku', async () => {
    const d = await dunia()
    const [s1, s2, s3] = d.s as [SuperHp, SuperHp, SuperHp]

    // --- Super Admin #1: anak baru (usulan) → langsung bisa dipilih untuk token orang tua; mubaligh A1; kelompok baru ---
    const u = ajukanUsulan(s1.db, { jenis: 'tambah_generus', kelompokId: d.A1.id, data: { nama: 'Budi', jenis_kelamin: 'L', kategori: 'caberawit', wali_nama: 'Pak Budi', wali_no_hp: '081234' } })
    const idBudi = String(JSON.parse(u.data_json).id)
    expect(generusPilihanToken(s1.db, d.A1.id)).toEqual([expect.objectContaining({ id: idBudi, nama: 'Budi', usulan: true })])
    const wali1 = await buatHp('HP Pak Budi')
    const tokWali = terbitkanTokenBawah(s1.db, s1.kunci, { kodePerangkat: wali1.kode, role: 'wali', nama: 'Pak Budi', wilayahId: d.A1.id, generusIds: [idBudi] })
    const pWali = await aktifkanProfil(wali1.db, tokWali)
    expect(pWali).toMatchObject({ role: 'wali', generus_ids: [idBudi] })
    const mub1 = await buatHp('HP Ust. Ali')
    const tokMub1 = terbitkanTokenBawah(s1.db, s1.kunci, { kodePerangkat: mub1.kode, role: 'mubaligh', nama: 'Ust. Ali', wilayahId: d.A1.id })
    expect(uraiToken(tokMub1).payload.atas_perangkat_id).toBe(s1.kunci.perangkatId)
    const pMub1 = await aktifkanProfil(mub1.db, tokMub1)
    expect(tujuanSetor(mub1.db)).toMatchObject({ tingkat: 'daerah', nama: 'Super Admin Pak Fir' })
    ajukanUsulan(s1.db, { jenis: 'tambah_wilayah', kelompokId: d.desaA.id, data: { tingkat: 'kelompok', nama: 'Klasaman 2', kode: 'K2' } })
    // Super Admin tidak bisa menerbitkan Super Admin lain
    const calon = await buatHp('Calon super')
    expect(() => terbitkanTokenBawah(s1.db, s1.kunci, { kodePerangkat: calon.kode, role: 'admin', nama: 'S4', wilayahId: d.D.id })).toThrow(/Super Admin HP hanya diterbitkan EXE Daerah/)
    const rakitan = tandaTanganiToken({ ...uraiToken(tokMub1).payload, token_id: 'RAKITAN', role: 'admin', tingkat: 'daerah', wilayah_id: d.D.id, hak: ['catat', 'lihat', 'terbit_bawah'] }, s1.kunci.tandaTangan.rahasia)
    expect(periksaTokenDb(d.daerah.db, rakitan)).toMatchObject({ sah: false, kode: 'RANTAI_TIDAK_SAH' })

    // mubaligh #1 mencatat kehadiran Citra? bukan kelompoknya → hanya data A1. Catat presensi generus master A1 setelah paket.
    // --- Super Admin #2: mubaligh B1 + token murid Citra (generus master) ---
    const mub2 = await buatHp('HP Ust. Hasan')
    await aktifkanProfil(mub2.db, terbitkanTokenBawah(s2.db, s2.kunci, { kodePerangkat: mub2.kode, role: 'mubaligh', nama: 'Ust. Hasan', wilayahId: d.B1.id, setorKe: 'daerah' }))
    expect(tujuanSetor(mub2.db)).toMatchObject({ perangkatId: 'ADMIN' })
    const idCitra = generusPilihanToken(s2.db, d.B1.id)[0]!.id
    const murid = await buatHp('HP Citra')
    const pMurid = await aktifkanProfil(murid.db, terbitkanTokenBawah(s2.db, s2.kunci, { kodePerangkat: murid.kode, role: 'generus', nama: 'Citra', wilayahId: d.B1.id, generusIds: [idCitra] }))
    // murid menyetor belajar ke mubaligh (rantai: murid ← Super Admin HP ← daerah); mubaligh B1 butuh data generus dari paket
    terapkanMateri(murid.db, buatMateri(d.daerah.db, d.daerah.kunci).bytes)
    terapkanMateri(mub2.db, buatMateri(d.daerah.db, d.daerah.kunci).bytes)
    terapkanPaket(mub2.db, buatPaket(s2.db, d.B1.id, s2.kunci).bytes)
    catatKemajuan(murid.db, pMurid.id, { materiId: murid.db.nilai<string>('SELECT id FROM materi ORDER BY id LIMIT 1')!, status: 'selesai' })
    const belajar = buatBelajar(murid.db)
    expect(imporBelajar(mub2.db, belajar.bytes).hasil.ditambah).toBe(1)

    // --- Super Admin #3: EXE desa Malanu, EXE kurikulum, pengurus daerah ---
    const dbDesa = await bukaDb()
    const exDesa = await inisialisasiExe(dbDesa, { sandi: SANDI, label: 'Laptop Malanu' })
    const tokDesa = terbitkanTokenBawah(s3.db, s3.kunci, { kodePerangkat: exDesa.kodePerangkat, role: 'admin', nama: 'Admin Malanu', wilayahId: d.desaB.id })
    expect(uraiToken(tokDesa).payload).toMatchObject({ tingkat: 'desa', hak: ['catat', 'lihat', 'terbit_bawah'] })
    expect(uraiToken(tokDesa).payload.atas_perangkat_id).toBeUndefined()
    await aktifkanExe(dbDesa, exDesa.kunci, tokDesa)
    const dbKur = await bukaDb()
    const exKur = await inisialisasiExe(dbKur, { sandi: SANDI, label: 'Laptop Kurikulum' })
    await aktifkanExe(dbKur, exKur.kunci, terbitkanTokenBawah(s3.db, s3.kunci, { kodePerangkat: exKur.kodePerangkat, role: 'kurikulum', nama: 'Tim Kurikulum', wilayahId: d.D.id }))
    expect(infoInstalasi(dbKur).peran).toBe('kurikulum')
    const pengurus = await buatHp('HP Pengurus Daerah')
    await aktifkanProfil(pengurus.db, terbitkanTokenBawah(s3.db, s3.kunci, { kodePerangkat: pengurus.kode, role: 'pengurus', nama: 'Pengurus Daerah', wilayahId: d.D.id }))

    // --- Setor: mubaligh #1 → Super Admin #1 → daerah; mubaligh #2 langsung ke daerah; Super #2 dan #3 setor gabungan ---
    maju(5)
    const r1 = imporSetor(s1.db, buatSetor(mub1.db).bytes, s1.kunci)
    expect(r1.pengirim[0]).toContain('Ust. Ali')
    maju(1)
    const rs1 = imporSetor(d.daerah.db, buatSetor(s1.db).bytes, d.daerah.kunci)
    expect(rs1.gabungan).toBe(true)
    expect(rs1.usulanOtomatis).toBe(2)
    expect(rs1.ditolak).toEqual([])
    const budi = ambilGenerus(d.daerah.db, idBudi)
    expect(budi).toMatchObject({ nama: 'Budi', kelompok_id: d.A1.id, wali_no_hp: '081234' })
    expect(ambilWilayah(d.daerah.db, daftarUsulan(d.daerah.db, { status: 'disetujui' }).map((x) => String(x.data.id)).find((id) => ambilWilayah(d.daerah.db, id)?.tingkat === 'kelompok')!)).toMatchObject({ nama: 'Klasaman 2', induk_id: d.desaA.id })
    expect(imporSetor(d.daerah.db, buatSetor(mub2.db).bytes, d.daerah.kunci).total.ditambah).toBeGreaterThan(0)
    imporSetor(d.daerah.db, buatSetor(s2.db).bytes, d.daerah.kunci)
    imporSetor(d.daerah.db, buatSetor(s3.db).bytes, d.daerah.kunci)
    // EXE desa terbitan Super Admin HP bisa menerbitkan HP di desanya setelah paket daerah (bukti wilayah)
    terapkanPaket(dbDesa, buatPaket(d.daerah.db, d.desaB.id, d.daerah.kunci).bytes)
    const hpDesa = await buatHp('HP Pengurus M1')
    await aktifkanProfil(hpDesa.db, terbitkanTokenBawah(dbDesa, exDesa.kunci, { kodePerangkat: hpDesa.kode, role: 'pengurus', nama: 'Pengurus M1', wilayahId: d.B1.id }))

    // daerah melihat semua perangkat yang didaftarkan ketiga Super Admin HP
    const nama = daftarPerangkat(d.daerah.db).map((p) => p.nama)
    for (const n of ['Pak Fir', 'Ust. Hasan', 'Bu Aminah', 'Pak Budi', 'Ust. Ali', 'Citra', 'Admin Malanu', 'Tim Kurikulum', 'Pengurus Daerah']) expect(nama).toContain(n)
    // kemajuan murid yang disahkan? masih diajukan di HP mubaligh — setoran mubaligh #2 memuatnya
    expect(d.daerah.db.nilai<number>(`SELECT COUNT(*) FROM kemajuan_belajar WHERE generus_id = ?`, [idCitra])).toBe(1)
    // penugasan mubaligh terbitan Super Admin HP tercatat di daerah
    expect(d.daerah.db.nilai<number>(`SELECT COUNT(*) FROM penugasan_mubaligh WHERE kelompok_id = ? AND selesai IS NULL`, [d.A1.id])).toBe(1)

    // --- Paket balik: daerah → Super #1 (usulan disetujui) → mubaligh #1 (melihat Budi) ; balasan ke orang tua ---
    maju(1)
    d.paketKeSuper()
    expect(daftarUsulan(s1.db, { status: 'menunggu' })).toEqual([])
    expect(generusPilihanToken(s1.db, d.A1.id)).toEqual([expect.objectContaining({ id: idBudi, usulan: false })])
    const rp = terapkanPaket(mub1.db, buatPaket(s1.db, d.A1.id, s1.kunci).bytes)
    expect(rp.total.ditambah).toBeGreaterThan(0)
    expect(ambilGenerus(mub1.db, idBudi)?.nama).toBe('Budi')
    catatPresensi(mub1.db, { kelompokId: d.A1.id, generusId: idBudi, tanggal: '2026-11-16', status: 'hadir' })
    expect(pMub1.role).toBe('mubaligh')
    const bal = terapkanBalasan(wali1.db, buatBalasan(s1.db, wali1.id).bytes)
    expect(bal.total.ditambah).toBeGreaterThan(0)
    expect(ambilGenerus(wali1.db, idBudi)?.nama).toBe('Budi')
    // setoran berikutnya sampai daerah lewat Super #1
    maju(1)
    imporSetor(s1.db, buatSetor(mub1.db).bytes, s1.kunci)
    imporSetor(d.daerah.db, buatSetor(s1.db).bytes, d.daerah.kunci)
    expect(d.daerah.db.nilai<number>(`SELECT COUNT(*) FROM presensi WHERE generus_id = ?`, [idBudi])).toBe(1)
    expect(ringkasanBerandaExe(s1.db).peran).toBe('super_hp')

    // --- Daerah mencabut Super Admin #3 ---
    maju(10)
    cabutPerangkat(d.daerah.db, s3.tokenId)
    // paket daerah berikutnya tidak bisa dibuka Super #3 (amplop hanya untuk perangkat aktif)
    const paketBaru = buatPaket(d.daerah.db, d.D.id, d.daerah.kunci).bytes
    terapkanPaket(s1.db, paketBaru)
    expect(() => terapkanPaket(s3.db, paketBaru)).toThrow(/bukan untuk/)
    // token yang diterbitkan Super #3 setelah dicabut ditolak daerah; setorannya juga ditolak
    maju(1)
    const telat = await buatHp('HP telat')
    const tokTelat = terbitkanTokenBawah(s3.db, s3.kunci, { kodePerangkat: telat.kode, role: 'pengurus', nama: 'Telat', wilayahId: d.D.id })
    expect(periksaTokenDb(d.daerah.db, tokTelat)).toMatchObject({ sah: false, kode: 'RANTAI_TIDAK_SAH' })
    expect(periksaTokenDb(d.daerah.db, s3.token)).toMatchObject({ sah: false, kode: 'DICABUT' })
    expect(() => imporSetor(d.daerah.db, buatSetor(s3.db).bytes, d.daerah.kunci)).toThrow(/dicabut/)
    // HP mubaligh yang menerima paket Super #1 sesudahnya juga tahu Super #3 dicabut → menolak token itu
    maju(1)
    terapkanPaket(mub1.db, buatPaket(s1.db, d.A1.id, s1.kunci).bytes)
    expect(periksaTokenDb(mub1.db, tokTelat)).toMatchObject({ sah: false, kode: 'RANTAI_TIDAK_SAH' })
    // token yang terbit sebelum pencabutan (sudah dilaporkan) tetap berlaku
    expect(periksaTokenDb(d.daerah.db, daftarPerangkat(d.daerah.db).find((p) => p.nama === 'Admin Malanu')!.token, { denganDikenal: true }).sah).toBe(true)
  })

  it('aturan rantai: hak & peran yang boleh diterbitkan, rantai 4 tingkat, EXE desa tidak menerbitkan murid/kurikulum', async () => {
    const d = await dunia()
    const s1 = d.s[0]!
    const hp = await buatHp('HP X')
    const sah = uraiToken(terbitkanTokenBawah(s1.db, s1.kunci, { kodePerangkat: hp.kode, role: 'pengurus', nama: 'P', wilayahId: d.A1.id })).payload
    const r = s1.kunci.tandaTangan.rahasia
    const rakit = (x: Partial<typeof sah>) => tandaTanganiToken({ ...sah, token_id: `R-${Math.random()}`, ...x }, r)
    // pengurus tidak boleh berhak sahkan; EXE kelompok tidak boleh terbit_bawah; kurikulum harus tingkat daerah
    expect(periksaTokenDb(d.daerah.db, rakit({ hak: ['catat', 'lihat', 'sahkan'] }))).toMatchObject({ sah: false, kode: 'RANTAI_TIDAK_SAH' })
    expect(periksaTokenDb(d.daerah.db, rakit({ role: 'admin', hak: ['catat', 'lihat', 'terbit_bawah'] }))).toMatchObject({ sah: false })
    expect(periksaTokenDb(d.daerah.db, rakit({ role: 'kurikulum', hak: ['lihat'] }))).toMatchObject({ sah: false })
    // pengurus daerah (tingkat daerah) sah
    expect(periksaTokenDb(d.daerah.db, rakit({ wilayah_id: d.D.id, tingkat: 'daerah' })).sah).toBe(true)
    // murid harus satu anak; anak tak dikenal ditolak saat menerbitkan
    expect(() => terbitkanTokenBawah(s1.db, s1.kunci, { kodePerangkat: hp.kode, role: 'generus', nama: 'G', wilayahId: d.A1.id, generusIds: [] })).toThrow(/tepat satu/)
    expect(() => terbitkanTokenBawah(s1.db, s1.kunci, { kodePerangkat: hp.kode, role: 'wali', nama: 'W', wilayahId: d.A1.id, generusIds: ['TIDAK-ADA'] })).toThrow(/tidak ditemukan/)
    // rantai 4 tingkat: daerah → Super Admin HP → EXE desa → mubaligh → murid
    const dbDesa = await bukaDb()
    const ex = await inisialisasiExe(dbDesa, { sandi: SANDI, label: 'Laptop Malanu' })
    const tokDesa = terbitkanTokenBawah(s1.db, s1.kunci, { kodePerangkat: ex.kodePerangkat, role: 'admin', nama: 'Desa B', wilayahId: d.desaB.id })
    await aktifkanExe(dbDesa, ex.kunci, tokDesa)
    imporSetor(d.daerah.db, buatSetor(s1.db).bytes, d.daerah.kunci)
    terapkanPaket(dbDesa, buatPaket(d.daerah.db, d.desaB.id, d.daerah.kunci).bytes)
    const mub = await buatHp('HP Mub B1')
    const pm = await aktifkanProfil(mub.db, terbitkanTokenBawah(dbDesa, ex.kunci, { kodePerangkat: mub.kode, role: 'mubaligh', nama: 'Ust. B', wilayahId: d.B1.id }))
    terapkanPaket(mub.db, buatPaket(dbDesa, d.B1.id, ex.kunci).bytes)
    const idCitra = generusPilihanToken(dbDesa, d.B1.id)[0]!.id
    const murid = await buatHp('HP Citra')
    const { terbitkanTokenGenerus } = await import('../src/index')
    const tokMurid = terbitkanTokenGenerus(mub.db, pm.id, { kodePerangkat: murid.kode, role: 'generus', generusIds: [idCitra], nama: 'Citra' })
    await aktifkanProfil(murid.db, tokMurid)
    expect(periksaTokenDb(d.daerah.db, tokMurid).sah).toBe(true)
    // EXE desa (meski diterbitkan Super Admin HP) tidak menerbitkan murid/kurikulum/EXE desa lain
    expect(() => terbitkanTokenBawah(dbDesa, ex.kunci, { kodePerangkat: murid.kode, role: 'generus', nama: 'C', wilayahId: d.B1.id, generusIds: [idCitra] })).toThrow(/EXE desa menerbitkan/)
    expect(() => terbitkanTokenBawah(dbDesa, ex.kunci, { kodePerangkat: murid.kode, role: 'kurikulum', nama: 'K', wilayahId: d.D.id })).toThrow()
  })
})
