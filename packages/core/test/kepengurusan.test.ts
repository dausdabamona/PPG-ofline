// §17 — Struktur & Proker Kepengurusan PPG (Fase 11): jabatan di token, hak per bidang ditegakkan core, data rahasia
// (keuangan/konseling) terenkripsi per penerima, kontrol MT, reward, pengingat sekretaris/PJ desa.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  aktifkanProfil,
  buatPaket,
  buatSetor,
  catatKeaktifan,
  daftarCatatan,
  gantiKunciBidang,
  imporSetor,
  isiKontrolMt,
  jabatanProfil,
  keaktifanBulan,
  konfirmasiDanaMasuk,
  musyawarahBulan,
  pengingatLaporan,
  periksaToken,
  poinTahfidz,
  POIN_TAHFIDZ_MAKS,
  rekapKontrolMt,
  rekapTahfidz,
  rewardHasilBelajar,
  ringkasanKas,
  ringkasanKetua,
  simpanCatatan,
  simpanEvaluasi,
  simpanLaporanBulanan,
  tambahGenerus,
  tambahWilayah,
  tandaTanganiToken,
  terapkanPaket,
  terbitkanToken,
  idMateriEvaluasi,
  isiLaporanKosong,
  uraiToken,
  SURAT_TAHFIDZ,
  type Db,
  type Jabatan,
  type KunciAdmin,
  type Profil,
  type Wilayah,
} from '../src/index'
import { buatAdmin, buatHp, lepasJam, pasangJam } from './bantu'

beforeAll(() => pasangJam('2026-11-20T01:00:00.000Z'))
afterAll(() => lepasJam())

/** Struktur wilayah dokumen (4 desa, 11 kelompok) — data uji, tanpa nama orang. */
const STRUKTUR: [string, string, [string, string][]][] = [
  ['Sorong', 'SRG-SRG', [['Remu', 'SRG-RMU'], ['Klasaman', 'SRG-KLS'], ['Kp Baru Barokah', 'SRG-KBB']]],
  ['Aimas', 'SRG-AMS', [['Jalur A', 'AMS-JLA'], ['Jalur C', 'AMS-JLC'], ['Espetri', 'AMS-ESP'], ['Modan', 'AMS-MDN']]],
  ['Fakfak', 'SRG-FFK', [['Kota', 'FFK-KTA'], ['Bomberay', 'FFK-BMB']]],
  ['Kaimana', 'SRG-KMN', [['Kota', 'KMN-KTA'], ['Bantemi', 'KMN-BTM']]],
]

interface Dunia {
  admin: { db: Db; kunci: KunciAdmin }
  daerah: Wilayah
  desa: Record<string, Wilayah>
  kel: Record<string, Wilayah>
}

async function dunia(): Promise<Dunia> {
  const admin = await buatAdmin()
  const daerah = tambahWilayah(admin.db, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
  const desa: Record<string, Wilayah> = {}
  const kel: Record<string, Wilayah> = {}
  for (const [nd, kd, ks] of STRUKTUR) {
    desa[nd] = tambahWilayah(admin.db, { tingkat: 'desa', nama: nd, kode: kd, indukId: daerah.id })
    for (const [nk, kk] of ks) kel[kk] = tambahWilayah(admin.db, { tingkat: 'kelompok', nama: nk, kode: kk, indukId: desa[nd]!.id })
  }
  return { admin, daerah, desa, kel }
}

async function pengurus(w: Dunia, nama: string, jabatan: Jabatan[], wilayah?: Wilayah): Promise<{ db: Db; profil: Profil; id: string }> {
  const hp = await buatHp(`HP ${nama}`)
  const profil = await aktifkanProfil(hp.db, terbitkanToken(w.admin.db, w.admin.kunci, { kodePerangkat: hp.kode, role: 'pengurus', nama, wilayahId: (wilayah ?? w.daerah).id, jabatan }))
  terapkanPaket(hp.db, buatPaket(w.admin.db, (wilayah ?? w.daerah).id, w.admin.kunci).bytes)
  return { db: hp.db, profil, id: hp.id }
}

const segarkan = (w: Dunia, db: Db, wilayah?: Wilayah) => terapkanPaket(db, buatPaket(w.admin.db, (wilayah ?? w.daerah).id, w.admin.kunci).bytes)

describe('Jabatan di token', () => {
  it('multi-jabatan, kunci baca hanya untuk jabatan pembaca, tingkat & role divalidasi', async () => {
    const w = await dunia()
    const wakil = await pengurus(w, 'Wakil', ['wakil_ketua', 'tenaga_pendidik'])
    expect(jabatanProfil(wakil.profil)).toEqual(['wakil_ketua', 'tenaga_pendidik'])
    expect(wakil.profil.rahasia.kunci_bidang?.map((k) => k.bidang)).toEqual(['keuangan'])
    const bk = await pengurus(w, 'BK', ['bk'])
    expect(bk.profil.rahasia.kunci_bidang?.map((k) => k.bidang)).toEqual(['konseling'])
    const sarpras = await pengurus(w, 'Sarpras', ['sarpras'])
    expect(sarpras.profil.rahasia.kunci_bidang).toBeUndefined()
    const hp = await buatHp('X')
    const t = (o: { jabatan: Jabatan[]; wilayahId: string; role?: 'pengurus' | 'mubaligh' }) =>
      terbitkanToken(w.admin.db, w.admin.kunci, { kodePerangkat: hp.kode, role: o.role ?? 'pengurus', nama: 'X', wilayahId: o.wilayahId, jabatan: o.jabatan })
    expect(() => t({ jabatan: ['bendahara'], wilayahId: w.desa.Sorong!.id })).toThrow(/tidak berlaku untuk tingkat desa/)
    expect(() => t({ jabatan: ['pj_desa'], wilayahId: w.kel['SRG-RMU']!.id, role: 'mubaligh' })).toThrow(/hanya untuk token pengurus|tingkat/)
    expect(uraiToken(t({ jabatan: ['pj_desa'], wilayahId: w.desa.Aimas!.id })).payload.jabatan).toEqual(['pj_desa'])
    // token mubaligh rakitan dengan jabatan (tanda tangan admin sah) tetap ditolak core
    const p = { ...uraiToken(t({ jabatan: ['pj_kelompok'], wilayahId: w.kel['KMN-BTM']!.id })).payload, role: 'mubaligh' as const }
    const palsu = tandaTanganiToken(p, w.admin.kunci.tandaTangan.rahasia)
    expect(periksaToken(palsu, { adminSignPub: uraiToken(palsu).payload.admin_sign_pub })).toMatchObject({ sah: false, alasan: expect.stringMatching(/pengurus/) })
  })
})

describe('Keuangan (bendahara, penggalang dana, ketua) — terenkripsi per penerima', () => {
  it('kas & tabungan desa, dana masuk dikonfirmasi bendahara, jabatan lain tidak bisa membaca/menulis', async () => {
    const w = await dunia()
    const bendahara = await pengurus(w, 'Bendahara', ['bendahara'])
    const penggalang = await pengurus(w, 'Penggalang', ['penggalang_dana'])
    const sarpras = await pengurus(w, 'Sarpras', ['sarpras'])
    const ketua = await pengurus(w, 'Ketua', ['ketua'])
    simpanCatatan(bendahara.db, { jenis: 'target_tabungan', isi: { desa_id: w.desa.Sorong!.id, nominal: 700_000, peruntukan: 'mumi_daerah' } })
    simpanCatatan(bendahara.db, { jenis: 'target_tabungan', isi: { desa_id: w.desa.Aimas!.id, nominal: 600_000, peruntukan: 'mumi_daerah' } })
    simpanCatatan(bendahara.db, { jenis: 'kas', isi: { arah: 'masuk', jumlah: 700_000, akun: 'tabungan_desa', desa_id: w.desa.Sorong!.id, peruntukan: 'mumi_daerah' } })
    simpanCatatan(bendahara.db, { jenis: 'kas', isi: { arah: 'keluar', jumlah: 900_000, akun: 'musyawarah', keterangan: 'Konsumsi musyawarah' } })
    expect(() => simpanCatatan(bendahara.db, { jenis: 'kas', isi: { arah: 'masuk', jumlah: 10.5, akun: 'lain' } })).toThrow(/rupiah bulat/)
    expect(() => simpanCatatan(sarpras.db, { jenis: 'kas', isi: { arah: 'masuk', jumlah: 1, akun: 'lain' } })).toThrow(/jabatan/)
    const dana = simpanCatatan(penggalang.db, { jenis: 'dana_masuk', isi: { sumber: 'aghniya', jumlah: 2_000_000, dari: 'Hamba Alloh' } })
    expect(dana.isi_json).toBeNull()
    expect(dana.isi_rahasia).not.toContain('Hamba')
    for (const hp of [bendahara, penggalang]) expect(imporSetor(w.admin.db, buatSetor(hp.db).bytes, w.admin.kunci).ditolak).toEqual([])
    for (const hp of [bendahara, sarpras, ketua]) segarkan(w, hp.db)
    let kas = ringkasanKas(bendahara.db)
    expect(kas).toMatchObject({ masuk: 700_000, keluar: 900_000, saldo: -200_000 })
    expect(kas.danaMenunggu).toHaveLength(1)
    expect(kas.tabungan.find((t) => t.desa === 'Sorong')).toMatchObject({ target: 700_000, disetor: 700_000 })
    expect(kas.tabungan.find((t) => t.desa === 'Aimas')).toMatchObject({ target: 600_000, disetor: 0 })
    konfirmasiDanaMasuk(bendahara.db, dana.id)
    expect(() => konfirmasiDanaMasuk(bendahara.db, dana.id)).toThrow(/sudah masuk kas/)
    kas = ringkasanKas(bendahara.db)
    expect(kas).toMatchObject({ saldo: 1_800_000, danaMenunggu: [] })
    // sarpras menerima paket berisi ciphertext tetapi tidak bisa membukanya; ketua bisa
    expect(daftarCatatan(sarpras.db, { jenis: 'kas' }).every((c) => c.terkunci && c.isi === null)).toBe(true)
    imporSetor(w.admin.db, buatSetor(bendahara.db).bytes, w.admin.kunci)
    segarkan(w, ketua.db)
    expect(ringkasanKas(ketua.db).saldo).toBe(1_800_000)
    // EXE daerah membaca keuangan dengan kunci admin
    expect(ringkasanKas(w.admin.db, { kunciAdmin: w.admin.kunci }).saldo).toBe(1_800_000)

    // pemalsuan: HP sarpras menyisipkan catatan kas → ditolak daerah (bukan jabatannya)
    const rek = daftarCatatan(bendahara.db, { jenis: 'kas' })[0]!
    const baris = bendahara.db.satu<Record<string, unknown>>('SELECT * FROM catatan_bidang WHERE id = ?', [rek.id])!
    const seq = Number(sarpras.db.nilai<string>(`SELECT nilai FROM meta WHERE kunci = 'seq'`) ?? 0) + 1
    sarpras.db.jalankan(`INSERT OR REPLACE INTO meta (kunci, nilai) VALUES ('seq', ?)`, [String(seq)])
    sarpras.db.jalankan(
      `INSERT INTO catatan_bidang (id, wilayah_id, bidang, jenis, tanggal, judul, isi_json, isi_rahasia, versi_kunci, rujukan_id, perangkat_id, dibuat_pada, diubah_pada, dihapus, versi, seq_lokal)
       VALUES ('KAS-PALSU', ?, 'keuangan', 'kas', '2026-11-20', NULL, NULL, ?, 1, NULL, ?, ?, ?, 0, 1, ?)`,
      [w.daerah.id, baris.isi_rahasia as string, sarpras.id, baris.dibuat_pada as string, baris.diubah_pada as string, seq],
    )
    const r = imporSetor(w.admin.db, buatSetor(sarpras.db).bytes, w.admin.kunci)
    expect(r.ditolak.map((x) => x.alasan)).toContain('Penulis catatan tidak memegang jabatan yang berwenang.')
  })

  it('ganti kunci bidang: versi baru turun lewat paket daerah ke jabatan pembaca saja', async () => {
    const w = await dunia()
    const bendahara = await pengurus(w, 'Bendahara', ['bendahara'])
    expect(gantiKunciBidang(w.admin.db, w.admin.kunci, 'keuangan')).toBe(2)
    segarkan(w, bendahara.db)
    const c = simpanCatatan(bendahara.db, { jenis: 'kas', isi: { arah: 'masuk', jumlah: 5000, akun: 'lain' } })
    expect(c.versi_kunci).toBe(2)
    expect(ringkasanKas(bendahara.db).saldo).toBe(5000)
  })
})

describe('Bimbingan Konseling — hanya BK yang membaca', () => {
  it('ketua & EXE daerah hanya melihat jumlah kasus', async () => {
    const w = await dunia()
    const bk = await pengurus(w, 'BK', ['bk'])
    const ketua = await pengurus(w, 'Ketua', ['ketua'])
    simpanCatatan(bk.db, { jenis: 'konseling', isi: { sasaran: 'generus', nama: 'Inisial A', kategori: 'ketertiban', masalah: 'Sering terlambat mengaji', tindak_lanjut: 'Dibimbing MT' }, wilayahId: w.kel['SRG-RMU']!.id })
    expect(daftarCatatan(bk.db, { jenis: 'konseling' })[0]!.isi).toMatchObject({ masalah: 'Sering terlambat mengaji' })
    imporSetor(w.admin.db, buatSetor(bk.db).bytes, w.admin.kunci)
    segarkan(w, ketua.db)
    expect(daftarCatatan(ketua.db, { jenis: 'konseling' })[0]).toMatchObject({ isi: null, terkunci: true })
    expect(ringkasanKetua(ketua.db, { wilayahId: w.daerah.id }).kasusBk).toEqual({ bulanIni: 1, total: 1 })
    expect(daftarCatatan(w.admin.db, { jenis: 'konseling', kunciAdmin: w.admin.kunci })[0]!.isi).toBeNull()
    expect(JSON.stringify(w.admin.db.kueri('SELECT * FROM catatan_bidang'))).not.toContain('terlambat')
  })
})

describe('Tenaga pendidik, sarpras, muda/i, tahfidz, sekretaris, PJ desa, kurikulum', () => {
  it('kontrol keaktifan MT diisi mubaligh, direkap tenaga pendidik; sarpras inventaris; agenda muda/i → keaktifan AA', async () => {
    const w = await dunia()
    const remu = w.kel['SRG-RMU']!
    const g = tambahGenerus(w.admin.db, { kelompokId: remu.id, nama: 'Santri A', jenisKelamin: 'L', kategori: 'praremaja', mulai: '2026-01-01' })
    const hpM = await buatHp('HP MT')
    await aktifkanProfil(hpM.db, terbitkanToken(w.admin.db, w.admin.kunci, { kodePerangkat: hpM.kode, role: 'mubaligh', nama: 'MT Remu', wilayahId: remu.id }))
    terapkanPaket(hpM.db, buatPaket(w.admin.db, remu.id, w.admin.kunci).bytes)
    isiKontrolMt(hpM.db, '2026-11-02', { subuh: true, tahajud: true, dhuha: false, hafalan: 5, tadarus: 'Al Baqoroh 1–20' })
    isiKontrolMt(hpM.db, '2026-11-03', { subuh: true, hafalan: 3 })
    expect(() => isiKontrolMt(hpM.db, '2026-11-04', { hafalan: 25 })).toThrow(/0–20/)
    const tp = await pengurus(w, 'TP', ['tenaga_pendidik'])
    expect(() => isiKontrolMt(tp.db, '2026-11-02', { subuh: true })).toThrow(/mubaligh/)
    simpanCatatan(tp.db, { jenis: 'mubaligh', isi: { nama: 'MT Remu', jenis: 'tugasan', jenis_kelamin: 'L', kelompok_id: remu.id } })
    simpanCatatan(tp.db, { jenis: 'kebutuhan_pengajar', isi: { kelompok_id: w.kel['KMN-BTM']!.id, kebutuhan: 1 } })
    const sar = await pengurus(w, 'Sarpras', ['sarpras'])
    simpanCatatan(sar.db, { jenis: 'inventaris', isi: { kelompok_id: remu.id, barang: "Iqro' & Al-Qur'an", jumlah: 10, kondisi: 'baik', dicek_pada: '2026-11-19' } })
    expect(() => simpanCatatan(sar.db, { jenis: 'inventaris', isi: { kelompok_id: remu.id, barang: 'Papan tulis', jumlah: 1, kondisi: 'hancur' } })).toThrow(/Kondisi/)
    const mm = await pengurus(w, 'Muda-mudi', ['muda_mudi'])
    const ag = simpanCatatan(mm.db, { jenis: 'agenda_muda_mudi', isi: { judul: 'LDK Muda/i Daerah', tanggal: '2026-11-15', kode_keaktifan: 'AA', peserta: [g.id] } })
    catatKeaktifan(mm.db, { generusId: g.id, tanggal: '2026-11-15', kode: 'AA', keterangan: `Agenda ${ag.id}`, sebagai: 'pencatat' })
    simpanCatatan(mm.db, { jenis: 'group_pembinaan', isi: { group: 'Khadijah', pembina1: 'Pembina', ketua: 'Ketua group', anggota: [g.id] }, id: 'GRP-Khadijah' })
    expect(() => simpanCatatan(mm.db, { jenis: 'group_pembinaan', isi: { group: 'Group X', anggota: [] } })).toThrow(/group/)

    const rM = imporSetor(w.admin.db, buatSetor(hpM.db).bytes, w.admin.kunci)
    expect(rM.ditolak).toEqual([])
    for (const hp of [tp, sar, mm]) expect(imporSetor(w.admin.db, buatSetor(hp.db).bytes, w.admin.kunci).ditolak).toEqual([])
    expect(keaktifanBulan(w.admin.db, g.id, '2026-11').jumlah).toBe(1)
    segarkan(w, tp.db)
    expect(rekapKontrolMt(tp.db, '2026-11')).toEqual([
      expect.objectContaining({ nama: 'MT Remu', kelompok: 'Remu', hariTerisi: 2, subuh: 2, tahajud: 1, dhuha: 0, hafalan: 8, tadarus: 1 }),
    ])
    expect(daftarCatatan(w.admin.db, { jenis: 'inventaris', wilayahIds: [remu.id] })).toHaveLength(1)
    // inventaris kelompok turun ke paket desa Sorong (EXE desa / PJ desa melihatnya)
    const pj = await pengurus(w, 'PJ Desa Sorong', ['pj_desa'], w.desa.Sorong)
    expect(daftarCatatan(pj.db, { jenis: 'inventaris' })).toHaveLength(1)
    expect(() => simpanCatatan(pj.db, { jenis: 'inventaris', isi: { kelompok_id: remu.id, barang: 'Spidol', jumlah: 1, kondisi: 'baik' } })).toThrow(/jabatan/)
    // NUNGGONI mandiri oleh siapa pun (Semua Pengurus & Mubaligh Peduli)
    simpanCatatan(pj.db, { jenis: 'nunggoni', isi: { kelompok_id: remu.id, unsur: '4S Desa', kelas: 'Generus 1', temuan: 'Tertib' } })
    expect(imporSetor(w.admin.db, buatSetor(pj.db).bytes, w.admin.kunci).ditolak).toEqual([])
    expect(ringkasanKetua(w.admin.db, { wilayahId: w.daerah.id }).nunggoni.mandiri).toBe(1)
  })

  it('tahfidz berpoin, musyawarah ganjil/genap, pengingat sekretaris & PJ desa, reward berjenjang', async () => {
    expect(SURAT_TAHFIDZ).toHaveLength(51)
    expect(POIN_TAHFIDZ_MAKS).toBe(170)
    expect(poinTahfidz([0, 1, 37, 38])).toBe(2 + 2 + 6 + 8) // An Naas, Al Falaq, Al Mulk, Yasin
    expect(musyawarahBulan('2026-11').jenis).toBe('bersama')
    expect(musyawarahBulan('2026-12').jenis).toBe('muda_mudi')
    const w = await dunia()
    const remu = w.kel['SRG-RMU']!
    const kls = w.kel['SRG-KLS']!
    const a = tambahGenerus(w.admin.db, { kelompokId: remu.id, nama: 'Santri A', jenisKelamin: 'L', kategori: 'praremaja', mulai: '2026-01-01' })
    const b = tambahGenerus(w.admin.db, { kelompokId: kls.id, nama: 'Santri B', jenisKelamin: 'P', kategori: 'praremaja', mulai: '2026-01-01' })
    simpanEvaluasi(w.admin.db, { generusId: a.id, materiEvaluasiId: idMateriEvaluasi('praremaja', 'surat'), dikuasai: 45, periode: '2026-S1' })
    simpanEvaluasi(w.admin.db, { generusId: b.id, materiEvaluasiId: idMateriEvaluasi('praremaja', 'surat'), dikuasai: 10, periode: '2026-S1' })
    const rw = rewardHasilBelajar(w.admin.db, { wilayahId: w.daerah.id, jenjang: 'praremaja', periode: '2026-S1' })
    expect(rw.daerah.map((s) => s.nama)).toEqual(['Santri A', 'Santri B'])
    expect(rw.kelompokTerbaik[0]!.nama).toBe('Remu')
    expect(rw.desaTerbaik).toHaveLength(1)
    const th = await pengurus(w, 'Tahfidz', ['tahfidz'])
    simpanCatatan(th.db, { jenis: 'ujian_tahfidz', isi: { generus_id: a.id, lulus: [0, 1, 38], penguji1: 'Penguji 1', penguji2: 'Penguji 2' } })
    expect(rekapTahfidz(th.db)[0]).toMatchObject({ nama: 'Santri A', poin: 12, surat: 3 })
    // pengingat: awal bulan (sekretaris) — semua kelompok belum lapor Oktober; akhir bulan (PJ desa)
    expect(pengingatLaporan(w.admin.db, w.desa.Sorong!.id, '2026-11-03')).toMatchObject({ jenis: 'awal_bulan', bulan: '2026-10' })
    expect(pengingatLaporan(w.admin.db, w.desa.Sorong!.id, '2026-11-15')).toBeNull()
    simpanLaporanBulanan(w.admin.db, { kelompokId: remu.id, bulan: '2026-11', isi: isiLaporanKosong() })
    expect(pengingatLaporan(w.admin.db, w.desa.Sorong!.id, '2026-11-26')!.kelompok.map((k) => k.nama)).toEqual(['Klasaman', 'Kp Baru Barokah'])
  })
})
