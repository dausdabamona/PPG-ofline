// §21 (Fase 15) — bidang berjenjang (perwakilan daerah di desa & kelompok), kunci rahasia per wilayah, Rujukan BK,
// Hubungi BK, kebijakan M08/M09, PIN wajib, Struktur & Kursi Kosong. Data uji tanpa nama orang sungguhan.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  aktifkanProfil,
  ambilKontakBk,
  bersihkanKonseling,
  bolehHubungiBk,
  buatBalasan,
  buatPaket,
  buatSetor,
  bukaBerkasApaSaja,
  catatKeaktifan,
  daftarCatatan,
  daftarKebijakan,
  daftarRujukanMasuk,
  daftarRujukanSaya,
  defKebijakan,
  gantiKunciBidang,
  generusBolehDirujuk,
  imporSetor,
  jabatanProfil,
  jadikanCatatanKonseling,
  kontakBkUntuk,
  konfirmasiDanaMasuk,
  naikkanRujukan,
  nilaiKebijakan,
  penugasanProfil,
  pengingatRujukanSegera,
  perluPinWajib,
  periksaToken,
  ringkasanKas,
  ringkasanKetua,
  saranRujukKeaktifan,
  simpanCatatan,
  simpanRujukan,
  strukturKepengurusan,
  tambahGenerus,
  tambahWilayah,
  tandaTanganiToken,
  tautanHubungiBk,
  terapkanBalasan,
  terapkanPaket,
  terbitkanToken,
  terbitkanTokenGenerus,
  tujuanRujukan,
  tutupSaranRujuk,
  ubahStatusRujukan,
  uraiToken,
  type Db,
  type Generus,
  type KunciAdmin,
  type Penugasan,
  type Profil,
  type Wilayah,
} from '../src/index'
import { buatAdmin, buatHp, keTanggal, lepasJam, pasangJam } from './bantu'

beforeAll(() => pasangJam('2026-11-20T01:00:00.000Z'))
afterAll(() => lepasJam())

interface Hp {
  db: Db
  kode: string
  id: string
  profil: Profil
}

interface Dunia {
  admin: { db: Db; kunci: KunciAdmin }
  daerah: Wilayah
  sorong: Wilayah
  aimas: Wilayah
  remu: Wilayah
  klasaman: Wilayah
  jalurA: Wilayah
  g: Generus[]
  gAimas: Generus
}

async function dunia(): Promise<Dunia> {
  const admin = await buatAdmin()
  const daerah = tambahWilayah(admin.db, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
  const sorong = tambahWilayah(admin.db, { tingkat: 'desa', nama: 'Sorong', kode: 'SRG-SRG', indukId: daerah.id })
  const aimas = tambahWilayah(admin.db, { tingkat: 'desa', nama: 'Aimas', kode: 'SRG-AMS', indukId: daerah.id })
  const remu = tambahWilayah(admin.db, { tingkat: 'kelompok', nama: 'Remu', kode: 'SRG-RMU', indukId: sorong.id })
  const klasaman = tambahWilayah(admin.db, { tingkat: 'kelompok', nama: 'Klasaman', kode: 'SRG-KLS', indukId: sorong.id })
  const jalurA = tambahWilayah(admin.db, { tingkat: 'kelompok', nama: 'Jalur A', kode: 'AMS-JLA', indukId: aimas.id })
  const g = ['Anak Satu', 'Anak Dua', 'Anak Tiga'].map((nama, i) =>
    tambahGenerus(admin.db, { kelompokId: remu.id, nama, jenisKelamin: i === 1 ? 'P' : 'L', kategori: i === 2 ? 'caberawit_a' : 'remaja', mulai: '2026-01-01', waliNoHp: `081200000${i}` }),
  )
  const gAimas = tambahGenerus(admin.db, { kelompokId: jalurA.id, nama: 'Anak Aimas', jenisKelamin: 'L', kategori: 'remaja', mulai: '2026-01-01' })
  return { admin, daerah, sorong, aimas, remu, klasaman, jalurA, g, gAimas }
}

const paket = (w: Dunia, db: Db, wilayah: Wilayah) => terapkanPaket(db, buatPaket(w.admin.db, wilayah.id, w.admin.kunci).bytes)
const setor = (w: Dunia, db: Db) => imporSetor(w.admin.db, buatSetor(db).bytes, w.admin.kunci)

async function pengurus(w: Dunia, nama: string, penugasan: Penugasan[], o: { kontakBk?: string; berlakuHari?: number } = {}): Promise<Hp> {
  const hp = await buatHp(`HP ${nama}`)
  const token = terbitkanToken(w.admin.db, w.admin.kunci, { kodePerangkat: hp.kode, role: 'pengurus', nama, penugasan, kontakBk: o.kontakBk, berlakuHari: o.berlakuHari })
  const profil = await aktifkanProfil(hp.db, token)
  terapkanPaket(hp.db, buatPaket(w.admin.db, profil.wilayah_id, w.admin.kunci).bytes)
  return { ...hp, profil }
}

async function mubaligh(w: Dunia, kel: Wilayah, nama = 'Ust. Contoh'): Promise<Hp> {
  const hp = await buatHp(`HP ${nama}`)
  const profil = await aktifkanProfil(hp.db, terbitkanToken(w.admin.db, w.admin.kunci, { kodePerangkat: hp.kode, role: 'mubaligh', nama, wilayahId: kel.id }))
  paket(w, hp.db, kel)
  return { ...hp, profil }
}

describe('Penugasan berjenjang di token (§21.1, J-BJ1)', () => {
  it('rangkap lintas wilayah: satu token, wilayah = leluhur bersama, jabatan per tingkat divalidasi', async () => {
    const w = await dunia()
    // pengurus daerah biasa yang juga duduk di desa & kelompok
    const a = await pengurus(w, 'Pengurus A', [
      { jabatan: 'sarpras', wilayah_id: w.daerah.id },
      { jabatan: 'sarpras', wilayah_id: w.sorong.id },
      { jabatan: 'bk', wilayah_id: w.remu.id },
    ])
    expect(a.profil.wilayah_id).toBe(w.daerah.id)
    expect(a.profil.tingkat).toBe('daerah')
    expect(penugasanProfil(a.profil)).toHaveLength(3)
    expect(jabatanProfil(a.profil)).toEqual(['sarpras', 'bk'])
    expect(uraiToken(a.profil.token).payload.jabatan).toBeUndefined()
    // di kelompok: BK + Sarpras sekaligus → wilayah kelompok
    const b = await pengurus(w, 'Pengurus B', [
      { jabatan: 'bk', wilayah_id: w.klasaman.id },
      { jabatan: 'sarpras', wilayah_id: w.klasaman.id },
    ])
    expect(b.profil).toMatchObject({ wilayah_id: w.klasaman.id, tingkat: 'kelompok' })
    // desa + kelompok di desa itu → wilayah desa
    const c = await pengurus(w, 'Pengurus C', [
      { jabatan: 'pj_desa', wilayah_id: w.sorong.id },
      { jabatan: 'tahfidz', wilayah_id: w.remu.id },
    ])
    expect(c.profil).toMatchObject({ wilayah_id: w.sorong.id, tingkat: 'desa' })

    const hp = await buatHp('X')
    const t = (penugasan: Penugasan[], kontakBk?: string) =>
      terbitkanToken(w.admin.db, w.admin.kunci, { kodePerangkat: hp.kode, role: 'pengurus', nama: 'X', penugasan, kontakBk })
    expect(() => t([{ jabatan: 'bendahara', wilayah_id: w.sorong.id }])).toThrow(/hanya di daerah/)
    expect(() => t([{ jabatan: 'ketua', wilayah_id: w.remu.id }])).toThrow(/hanya di daerah/)
    expect(() => t([{ jabatan: 'pj_desa', wilayah_id: w.remu.id }])).toThrow(/tidak berlaku untuk tingkat kelompok/)
    expect(() => t([{ jabatan: 'pj_kelompok', wilayah_id: w.sorong.id }])).toThrow(/tidak berlaku untuk tingkat desa/)
    expect(() => t([{ jabatan: 'sarpras', wilayah_id: w.remu.id }], '0812345678')).toThrow(/hanya untuk pemegang penugasan BK/)
    expect(() => t([{ jabatan: 'bk', wilayah_id: w.remu.id }], '12ab')).toThrow(/tidak sah/)
    expect(() => terbitkanToken(w.admin.db, w.admin.kunci, { kodePerangkat: hp.kode, role: 'mubaligh', nama: 'X', penugasan: [{ jabatan: 'bk', wilayah_id: w.remu.id }] })).toThrow(/hanya untuk token pengurus/)
    // token rakitan bertanda tangan admin: bendahara di desa ditolak core (tanpa pohon wilayah pun)
    const p = { ...uraiToken(t([{ jabatan: 'sarpras', wilayah_id: w.sorong.id }])).payload, penugasan: [{ jabatan: 'bendahara' as const, wilayah_id: w.sorong.id }] }
    const palsu = tandaTanganiToken(p, w.admin.kunci.tandaTangan.rahasia)
    expect(periksaToken(palsu, { adminSignPub: p.admin_sign_pub })).toMatchObject({ sah: false, alasan: expect.stringMatching(/hanya di daerah/) })
    // jabatan + penugasan sekaligus ditolak
    const ganda = tandaTanganiToken({ ...p, penugasan: [{ jabatan: 'sarpras', wilayah_id: w.sorong.id }], jabatan: ['pj_desa'] }, w.admin.kunci.tandaTangan.rahasia)
    expect(periksaToken(ganda, { adminSignPub: p.admin_sign_pub })).toMatchObject({ sah: false })
  })

  it('PIN wajib untuk profil ber-BK/bendahara/penggalang dana', async () => {
    const w = await dunia()
    const bk = await pengurus(w, 'BK', [{ jabatan: 'bk', wilayah_id: w.remu.id }])
    const sar = await pengurus(w, 'Sarpras', [{ jabatan: 'sarpras', wilayah_id: w.remu.id }])
    const ben = await pengurus(w, 'Bendahara', [{ jabatan: 'bendahara', wilayah_id: w.daerah.id }])
    expect(perluPinWajib(bk.profil)).toBe(true)
    expect(perluPinWajib(ben.profil)).toBe(true)
    expect(perluPinWajib(sar.profil)).toBe(false)
  })
})

describe('Kunci rahasia per wilayah (§21.2, J-BJ3)', () => {
  it('BK wilayah W hanya membaca konseling W; ganti kunci per wilayah', async () => {
    const w = await dunia()
    const bkRemu = await pengurus(w, 'BK Remu', [{ jabatan: 'bk', wilayah_id: w.remu.id }])
    const bkDesa = await pengurus(w, 'BK Desa', [{ jabatan: 'bk', wilayah_id: w.sorong.id }])
    const bkDaerah = await pengurus(w, 'BK Daerah', [{ jabatan: 'bk', wilayah_id: w.daerah.id }])
    expect(bkRemu.profil.rahasia.kunci_bidang?.map((k) => [k.bidang, k.wilayah_id])).toEqual([['konseling', w.remu.id]])
    expect(bkDesa.profil.rahasia.kunci_bidang?.map((k) => k.wilayah_id)).toEqual([w.sorong.id])
    const c = simpanCatatan(bkRemu.db, { jenis: 'konseling', isi: { sasaran: 'generus', masalah: 'Contoh masalah belajar' } })
    expect(c.wilayah_id).toBe(w.remu.id)
    // BK kelompok tidak menulis konseling untuk kelompok lain
    expect(() => simpanCatatan(bkRemu.db, { jenis: 'konseling', wilayahId: w.klasaman.id, isi: { sasaran: 'generus', masalah: 'x' } })).toThrow(/di luar wilayah/)
    expect(setor(w, bkRemu.db).ditolak).toEqual([])
    paket(w, bkDesa.db, w.sorong)
    paket(w, bkDaerah.db, w.daerah)
    // BK di atas TIDAK otomatis membaca kasus di bawah
    expect(daftarCatatan(bkDesa.db, { jenis: 'konseling' }).find((x) => x.id === c.id)).toMatchObject({ terkunci: true, isi: null })
    expect(daftarCatatan(bkDaerah.db, { jenis: 'konseling' }).find((x) => x.id === c.id)).toMatchObject({ terkunci: true })
    expect(daftarCatatan(bkRemu.db, { jenis: 'konseling' })[0]!.isi).toMatchObject({ masalah: 'Contoh masalah belajar' })
    // EXE daerah tidak membuka konseling
    expect(daftarCatatan(w.admin.db, { jenis: 'konseling', kunciAdmin: w.admin.kunci })[0]!.terkunci).toBe(true)

    // ganti kunci konseling Remu saja
    expect(gantiKunciBidang(w.admin.db, w.admin.kunci, 'konseling', w.remu.id)).toBe(2)
    paket(w, bkRemu.db, w.remu)
    paket(w, bkDesa.db, w.sorong)
    expect(bkRemu.profil.rahasia.kunci_bidang).toHaveLength(1)
    const kunciRemu = (await import('../src/index')).daftarProfil(bkRemu.db, 'pengurus')[0]!.rahasia.kunci_bidang!
    expect(kunciRemu.map((k) => k.versi).sort()).toEqual([1, 2])
    const kunciDesa = (await import('../src/index')).daftarProfil(bkDesa.db, 'pengurus')[0]!.rahasia.kunci_bidang!
    expect(kunciDesa.map((k) => k.versi)).toEqual([1])
    const c2 = simpanCatatan(bkRemu.db, { jenis: 'konseling', isi: { sasaran: 'orang_tua', masalah: 'Contoh baru' } })
    expect(c2.versi_kunci).toBe(2)
    expect(daftarCatatan(bkRemu.db, { jenis: 'konseling' }).every((x) => x.isi)).toBe(true)
  })

  it('keuangan: penggalang dana desa hanya wilayahnya; pembaca daerah (M04) semua wilayah; konfirmasi bendahara terlihat di desa', async () => {
    const w = await dunia()
    const danaSorong = await pengurus(w, 'Penggalang Sorong', [{ jabatan: 'penggalang_dana', wilayah_id: w.sorong.id }])
    const danaAimas = await pengurus(w, 'Penggalang Aimas', [{ jabatan: 'penggalang_dana', wilayah_id: w.aimas.id }])
    const bendahara = await pengurus(w, 'Bendahara', [{ jabatan: 'bendahara', wilayah_id: w.daerah.id }])
    const ketua = await pengurus(w, 'Ketua', [{ jabatan: 'ketua', wilayah_id: w.daerah.id }])
    expect(danaSorong.profil.rahasia.kunci_bidang?.map((k) => [k.bidang, k.wilayah_id, !!k.rahasia])).toEqual([['keuangan', w.sorong.id, true]])
    const wilBendahara = new Set(bendahara.profil.rahasia.kunci_bidang!.map((k) => k.wilayah_id))
    expect(wilBendahara.size).toBe(6) // daerah + 2 desa + 3 kelompok
    const dana = simpanCatatan(danaSorong.db, { jenis: 'dana_masuk', isi: { sumber: 'wali', jumlah: 250_000, dari: 'Wali contoh' } })
    expect(dana.wilayah_id).toBe(w.sorong.id)
    expect(() => simpanCatatan(danaSorong.db, { jenis: 'dana_masuk', wilayahId: w.aimas.id, isi: { sumber: 'wali', jumlah: 1 } })).toThrow(/di luar wilayah/)
    expect(() => simpanCatatan(danaSorong.db, { jenis: 'kas', isi: { arah: 'masuk', jumlah: 1, akun: 'lain' } })).toThrow(/jabatan/)
    expect(setor(w, danaSorong.db).ditolak).toEqual([])
    paket(w, bendahara.db, w.daerah)
    paket(w, danaAimas.db, w.aimas)
    paket(w, ketua.db, w.daerah)
    // penggalang Aimas tidak menerima/tidak bisa membaca dana Sorong; bendahara & ketua (pembaca daerah) bisa
    expect(daftarCatatan(danaAimas.db, { jenis: 'dana_masuk' })).toEqual([])
    expect(ringkasanKas(bendahara.db).danaMenunggu.map((d) => d.id)).toEqual([dana.id])
    const kas = konfirmasiDanaMasuk(bendahara.db, dana.id)
    expect(kas.wilayah_id).toBe(w.sorong.id)
    expect(setor(w, bendahara.db).ditolak).toEqual([])
    paket(w, danaSorong.db, w.sorong)
    paket(w, ketua.db, w.daerah)
    expect(ringkasanKas(danaSorong.db)).toMatchObject({ danaMenunggu: [], masuk: 250_000 })
    expect(ringkasanKas(ketua.db)).toMatchObject({ saldo: 250_000, terkunci: 0 })
    expect(ringkasanKas(w.admin.db, { kunciAdmin: w.admin.kunci }).saldo).toBe(250_000)
  })
})

describe('Bidang terbuka berjenjang & wewenang impor (J-BJ2)', () => {
  it('sarpras desa menulis untuk kelompok desanya; pemalsuan untuk desa lain ditolak daerah', async () => {
    const w = await dunia()
    const sar = await pengurus(w, 'Sarpras Sorong', [{ jabatan: 'sarpras', wilayah_id: w.sorong.id }])
    const inv = simpanCatatan(sar.db, { jenis: 'inventaris', isi: { kelompok_id: w.remu.id, barang: 'Papan tulis', jumlah: 2, kondisi: 'baik' } })
    expect(inv.wilayah_id).toBe(w.remu.id)
    expect(() => simpanCatatan(sar.db, { jenis: 'inventaris', isi: { kelompok_id: w.jalurA.id, barang: 'Meja', jumlah: 1, kondisi: 'baik' } })).toThrow(/di luar wilayah/)
    expect(setor(w, sar.db).ditolak).toEqual([])
    // pemalsuan langsung ke tabel: catatan untuk Jalur A (Aimas)
    const seq = Number(sar.db.nilai<string>(`SELECT nilai FROM meta WHERE kunci = 'seq'`)) + 1
    sar.db.jalankan(`INSERT OR REPLACE INTO meta (kunci, nilai) VALUES ('seq', ?)`, [String(seq)])
    sar.db.jalankan(
      `INSERT INTO catatan_bidang (id, wilayah_id, bidang, jenis, tanggal, judul, isi_json, isi_rahasia, versi_kunci, rujukan_id, perangkat_id, dibuat_pada, diubah_pada, dihapus, versi, seq_lokal)
       VALUES ('INV-PALSU', ?, 'sarpras', 'inventaris', '2026-11-20', NULL, ?, NULL, NULL, NULL, ?, ?, ?, 0, 1, ?)`,
      [w.jalurA.id, JSON.stringify({ kelompok_id: w.jalurA.id, barang: 'Meja', jumlah: 1, kondisi: 'baik' }), sar.id, '2026-11-20T01:00:00.000Z', '2026-11-20T01:00:00.000Z', seq],
    )
    const r = setor(w, sar.db)
    expect(r.ditolak.map((d) => d.id)).toContain('INV-PALSU')
  })
})

describe('Rujukan BK (§21.3)', () => {
  async function siap() {
    const w = await dunia()
    const m = await mubaligh(w, w.remu)
    const bkRemu = await pengurus(w, 'BK Remu', [{ jabatan: 'bk', wilayah_id: w.remu.id }], { kontakBk: '0812 1111 2222', berlakuHari: 1500 })
    const bkDesa = await pengurus(w, 'BK Desa', [{ jabatan: 'bk', wilayah_id: w.sorong.id }], { kontakBk: '081233334444' })
    const bkDaerah = await pengurus(w, 'BK Daerah', [{ jabatan: 'bk', wilayah_id: w.daerah.id }])
    paket(w, m.db, w.remu)
    paket(w, bkRemu.db, w.remu)
    return { w, m, bkRemu, bkDesa, bkDaerah }
  }

  it('tujuan otomatis kelompok → desa → daerah; langsung daerah hanya bila Segera', async () => {
    const { w, m } = await siap()
    expect(tujuanRujukan(m.db, w.g[0]!.id)).toMatchObject({ wilayah_id: w.remu.id, tingkat: 'kelompok', dilewati: [] })
    expect(tujuanRujukan(m.db, w.g[0]!.id, { langsungDaerah: true })).toMatchObject({ wilayah_id: w.daerah.id })
    expect(() => simpanRujukan(m.db, { generusId: w.g[0]!.id, kategori: 'belajar', uraian: 'x', langsungDaerah: true })).toThrow(/hanya untuk rujukan Segera/)
    // generus di luar wilayah mubaligh tidak bisa dirujuk
    expect(generusBolehDirujuk(m.db).map((g) => g.id)).not.toContain(w.gAimas.id)
    // Klasaman tanpa BK kelompok → BK desa
    const m2 = await mubaligh(w, w.klasaman, 'Ust. Klasaman')
    const gk = tambahGenerus(w.admin.db, { kelompokId: w.klasaman.id, nama: 'Anak Klasaman', jenisKelamin: 'L', kategori: 'remaja', mulai: '2026-01-01' })
    paket(w, m2.db, w.klasaman)
    expect(tujuanRujukan(m2.db, gk.id)).toMatchObject({ wilayah_id: w.sorong.id, dilewati: [{ tingkat: 'kelompok', alasan: 'tidak_ada_bk' }] })
  })

  it('kerabat BK kelompok dilewati ke tingkat atas (J-BJ5)', async () => {
    const { w, m, bkRemu } = await siap()
    // HP BK Remu juga memegang token wali untuk anak pertama (orang tua sekaligus BK)
    const tw = terbitkanTokenGenerus(m.db, m.profil.id, { kodePerangkat: bkRemu.kode, role: 'wali', generusIds: [w.g[0]!.id], nama: 'Wali contoh' })
    await aktifkanProfil(bkRemu.db, tw)
    expect(setor(w, m.db).ditolak).toEqual([])
    paket(w, m.db, w.remu)
    expect(tujuanRujukan(m.db, w.g[0]!.id)).toMatchObject({ wilayah_id: w.sorong.id, dilewati: [{ tingkat: 'kelompok', alasan: 'kerabat' }] })
    expect(tujuanRujukan(m.db, w.g[1]!.id)).toMatchObject({ wilayah_id: w.remu.id })
  })

  it('jalur cepat berkas RUJUKAN + jalur Setor, status Terima/Tangani/Selesai sampai ke perujuk, ringkasan ketua agregat', async () => {
    const { w, m, bkRemu, bkDesa } = await siap()
    const h = simpanRujukan(m.db, { generusId: w.g[0]!.id, kategori: 'perilaku', uraian: 'Contoh uraian singkat', segera: true })
    expect(h.pesanSegera).toMatch(/Hubungi BK atau pengurus sekarang/)
    expect(h.tujuan.wilayah_id).toBe(w.remu.id)
    expect(h.berkas?.nama).toMatch(/^PPG_RUJUKAN_remu_/)
    // perujuk tidak memegang salinan terbaca
    expect(daftarCatatan(m.db, { jenis: 'rujukan' })[0]).toMatchObject({ terkunci: true, isi: null })
    expect(daftarRujukanSaya(m.db)).toMatchObject([{ id: h.catatan.id, status: 'terkirim' }])
    // BK desa tidak bisa membuka berkas untuk BK Remu
    expect(() => bukaBerkasApaSaja(bkDesa.db, h.berkas!.bytes)).toThrow(/bukan untuk HP ini|BK wilayah lain/)
    const r = bukaBerkasApaSaja(bkRemu.db, h.berkas!.bytes, h.berkas!.nama)
    expect(r.jenis).toBe('RUJUKAN')
    let masuk = daftarRujukanMasuk(bkRemu.db)
    expect(masuk).toHaveLength(1)
    expect(masuk[0]).toMatchObject({ status: 'baru', isi: { nama: 'Anak Satu', kategori: 'perilaku', segera: true } })
    // pengingat Segera ≥ 3 hari
    expect(pengingatRujukanSegera(bkRemu.db)).toHaveLength(0)
    expect(pengingatRujukanSegera(bkRemu.db, '2026-11-23')).toHaveLength(1)
    // ketua: agregat daerah saja
    const ketua = await pengurus(w, 'Ketua', [{ jabatan: 'ketua', wilayah_id: w.daerah.id }])
    // jalur cadangan: Setor perujuk → daerah → paket BK (duplikat diabaikan)
    expect(setor(w, m.db).ditolak).toEqual([])
    paket(w, bkRemu.db, w.remu)
    expect(daftarRujukanMasuk(bkRemu.db)).toHaveLength(1)
    paket(w, ketua.db, w.daerah)
    expect(ringkasanKetua(ketua.db, { wilayahId: w.daerah.id }).kasusBk).toMatchObject({ rujukanTotal: 1, rujukanBelumDitanggapi: 1, rujukanBulanIni: 1 })

    ubahStatusRujukan(bkRemu.db, h.catatan.id, 'diterima')
    const kons = jadikanCatatanKonseling(bkRemu.db, h.catatan.id, { tindakLanjut: 'Kunjungan rumah' })
    expect(daftarCatatan(bkRemu.db, { jenis: 'konseling' })[0]!.isi).toMatchObject({ masalah: 'Contoh uraian singkat', generus_id: w.g[0]!.id })
    expect(kons.rujukan_id).toBe(h.catatan.id)
    expect(() => jadikanCatatanKonseling(bkRemu.db, h.catatan.id)).toThrow(/sudah dijadikan/)
    expect(daftarRujukanMasuk(bkRemu.db)[0]).toMatchObject({ status: 'ditangani', catatanKonselingId: kons.id })
    expect(setor(w, bkRemu.db).ditolak).toEqual([])
    paket(w, m.db, w.remu)
    expect(daftarRujukanSaya(m.db)[0]).toMatchObject({ status: 'ditangani', label: 'Sedang ditangani BK' })
    ubahStatusRujukan(bkRemu.db, h.catatan.id, 'selesai')
    expect(daftarRujukanMasuk(bkRemu.db)).toHaveLength(0)
    expect(daftarRujukanMasuk(bkRemu.db, { semua: true })).toHaveLength(1)
    setor(w, bkRemu.db)
    paket(w, m.db, w.remu)
    paket(w, ketua.db, w.daerah)
    expect(daftarRujukanSaya(m.db)[0]!.status).toBe('selesai')
    expect(ringkasanKetua(ketua.db, { wilayahId: w.daerah.id }).kasusBk).toMatchObject({ rujukanTotal: 1, rujukanBelumDitanggapi: 0, total: 1 })
  })

  it('Naikkan ke BK Desa: rujukan baru disegel ke kunci desa, isi asal tidak terbuka untuk atas; status akhir sampai ke perujuk', async () => {
    const { w, m, bkRemu, bkDesa } = await siap()
    const h = simpanRujukan(m.db, { generusId: w.g[1]!.id, kategori: 'keluarga', uraian: 'Uraian asli perujuk' })
    bukaBerkasApaSaja(bkRemu.db, h.berkas!.bytes)
    const n = naikkanRujukan(bkRemu.db, h.catatan.id, { ke: 'desa', uraian: 'Ringkasan BK kelompok untuk desa' })
    expect(n.catatan.wilayah_id).toBe(w.sorong.id)
    expect(n.berkas).not.toBeNull()
    bukaBerkasApaSaja(bkDesa.db, n.berkas!.bytes)
    const atas = daftarRujukanMasuk(bkDesa.db)
    expect(atas).toHaveLength(1)
    expect(atas[0]).toMatchObject({ dariBawah: true, isi: { uraian: 'Ringkasan BK kelompok untuk desa' } })
    // BK desa (lewat paket) menerima rujukan asal Remu tetapi tidak bisa membukanya
    expect(setor(w, m.db).ditolak).toEqual([])
    expect(setor(w, bkRemu.db).ditolak).toEqual([])
    paket(w, bkDesa.db, w.sorong)
    expect(daftarCatatan(bkDesa.db, { jenis: 'rujukan' }).find((c) => c.id === h.catatan.id)).toMatchObject({ terkunci: true })
    expect(daftarRujukanMasuk(bkDesa.db).map((r) => r.id)).toEqual([n.catatan.id])
    ubahStatusRujukan(bkDesa.db, n.catatan.id, 'ditangani')
    expect(setor(w, bkDesa.db).ditolak).toEqual([])
    paket(w, m.db, w.remu)
    expect(daftarRujukanSaya(m.db)[0]).toMatchObject({ id: h.catatan.id, status: 'ditangani' })
    expect(daftarRujukanMasuk(bkRemu.db)).toHaveLength(0) // sudah diteruskan
  })

  it('rujukan dari pengurus non-BK; mubaligh menyetor rujukan ke daerah (wilayah di atasnya) diterima; langsung ke BK Daerah', async () => {
    const { w, m, bkDaerah } = await siap()
    const sar = await pengurus(w, 'Sarpras Remu', [{ jabatan: 'sarpras', wilayah_id: w.remu.id }])
    paket(w, sar.db, w.remu)
    const a = simpanRujukan(sar.db, { generusId: w.g[2]!.id, kategori: 'belajar', uraian: 'Dari pengurus' })
    expect(a.tujuan.wilayah_id).toBe(w.remu.id)
    const b = simpanRujukan(m.db, { generusId: w.g[0]!.id, kategori: 'pergaulan', uraian: 'Segera ke daerah', segera: true, langsungDaerah: true })
    expect(b.catatan.wilayah_id).toBe(w.daerah.id)
    expect(setor(w, m.db).ditolak).toEqual([])
    expect(setor(w, sar.db).ditolak).toEqual([])
    paket(w, bkDaerah.db, w.daerah)
    expect(daftarRujukanMasuk(bkDaerah.db).map((r) => r.id)).toEqual([b.catatan.id])
  })

  it('pemicu keaktifan < 50 % dua bulan berturut (kartu di HP mubaligh, bisa ditutup)', async () => {
    const { w, m } = await siap()
    // anak kedua aktif cukup di Oktober (≥ 50 %), anak lain tidak
    for (let d = 1; d <= 12; d++) catatKeaktifan(m.db, { generusId: w.g[1]!.id, tanggal: `2026-10-${String(d).padStart(2, '0')}`, kode: 'MK', sebagai: 'pencatat' })
    const s = saranRujukKeaktifan(m.db, w.remu.id)
    expect(s.map((x) => x.nama).sort()).toEqual(['Anak Satu', 'Anak Tiga'])
    expect(s[0]!.bulan).toEqual(['2026-09', '2026-10'])
    tutupSaranRujuk(m.db, w.g[0]!.id)
    expect(saranRujukKeaktifan(m.db, w.remu.id).map((x) => x.nama)).toEqual(['Anak Tiga'])
    // bulan berikutnya kartu muncul lagi (sekali per anak per bulan)
    expect(saranRujukKeaktifan(m.db, w.remu.id, '2026-12-05').map((x) => x.nama)).toContain('Anak Satu')
  })

  it('Hubungi BK: kontak bertanda tangan sampai ke HP wali lewat BALASAN; hanya wali & generus Remaja/Pra Nikah', async () => {
    const { w, m } = await siap()
    const hpWali = await buatHp('HP Wali')
    const wali = await aktifkanProfil(hpWali.db, terbitkanTokenGenerus(m.db, m.profil.id, { kodePerangkat: hpWali.kode, role: 'wali', generusIds: [w.g[0]!.id, w.g[2]!.id], nama: 'Wali contoh' }))
    const hpAnak = await buatHp('HP Anak')
    const anakRemaja = await aktifkanProfil(hpAnak.db, terbitkanTokenGenerus(m.db, m.profil.id, { kodePerangkat: hpAnak.kode, role: 'generus', generusIds: [w.g[0]!.id], nama: 'Anak Satu' }))
    const hpKecil = await buatHp('HP Kecil')
    const anakKecil = await aktifkanProfil(hpKecil.db, terbitkanTokenGenerus(m.db, m.profil.id, { kodePerangkat: hpKecil.kode, role: 'generus', generusIds: [w.g[2]!.id], nama: 'Anak Tiga' }))
    for (const hp of [hpWali, hpAnak, hpKecil]) terapkanBalasan(hp.db, buatBalasan(m.db, hp.id).bytes)
    expect(ambilKontakBk(hpWali.db)).not.toBeNull()
    expect(kontakBkUntuk(hpWali.db, w.remu.id)).toEqual([
      { tingkat: 'kelompok', wilayah_id: w.remu.id, nama: 'Remu', nomor: '6281211112222' },
      { tingkat: 'desa', wilayah_id: w.sorong.id, nama: 'Sorong', nomor: '6281233334444' },
    ])
    expect(bolehHubungiBk(hpWali.db, wali)).toBe(true)
    expect(bolehHubungiBk(hpAnak.db, anakRemaja)).toBe(true)
    expect(bolehHubungiBk(hpKecil.db, anakKecil)).toBe(false)
    expect(tautanHubungiBk('6281211112222', 'wali')).toMatch(/^https:\/\/wa\.me\/6281211112222\?text=Assalamu/)
  })

  it('M08: konseling & rujukan Selesai lebih dari 24 bulan dihapus di HP BK dan di daerah; M09 tervalidasi', async () => {
    const { w, m, bkRemu } = await siap()
    const h = simpanRujukan(m.db, { generusId: w.g[0]!.id, kategori: 'belajar', uraian: 'Lama' })
    bukaBerkasApaSaja(bkRemu.db, h.berkas!.bytes)
    jadikanCatatanKonseling(bkRemu.db, h.catatan.id)
    ubahStatusRujukan(bkRemu.db, h.catatan.id, 'selesai')
    setor(w, m.db)
    setor(w, bkRemu.db)
    expect(bersihkanKonseling(bkRemu.db)).toEqual({ dihapus: 0, dibersihkanLokal: 0 })
    keTanggal('2028-12-01')
    const r = bersihkanKonseling(bkRemu.db)
    expect(r.dihapus).toBe(1) // catatan konseling milik BK
    expect(r.dibersihkanLokal).toBe(1) // rujukan milik perujuk
    expect(daftarCatatan(bkRemu.db, { jenis: ['konseling', 'rujukan'] })).toEqual([])
    expect(setor(w, bkRemu.db).ditolak).toEqual([])
    const rd = bersihkanKonseling(w.admin.db)
    expect(rd.dihapus).toBeGreaterThanOrEqual(1)
    expect(w.admin.db.nilai<number>(`SELECT COUNT(*) FROM catatan_bidang WHERE dihapus = 0 AND jenis IN ('konseling','rujukan')`)).toBe(0)
    pasangJam('2026-11-20T01:00:00.000Z')
    expect(nilaiKebijakan(w.admin.db, 'simpan_konseling')).toEqual({ bulan: 24 })
    expect(defKebijakan('kontak_bk')!.alasan({ [w.remu.id]: '081234' })).toMatch(/berawalan 62/)
    expect(defKebijakan('kontak_bk')!.alasan({ [w.remu.id]: '6281234567890' })).toBeNull()
    expect(daftarKebijakan(w.admin.db).find((k) => k.kunci === 'kontak_bk')!.status).toBe('belum')
  })
})

describe('Struktur & Kursi Kosong (§21.1)', () => {
  it('kursi per wilayah × jabatan, tanda perwakilan, kursi kosong', async () => {
    const w = await dunia()
    await pengurus(w, 'Pengurus Rangkap', [
      { jabatan: 'sarpras', wilayah_id: w.daerah.id },
      { jabatan: 'sarpras', wilayah_id: w.sorong.id },
    ])
    await pengurus(w, 'BK Remu', [{ jabatan: 'bk', wilayah_id: w.remu.id }])
    const s = strukturKepengurusan(w.admin.db)
    const kursi = (wil: Wilayah, j: string) => s.kursi.find((k) => k.wilayah_id === wil.id && k.jabatan === j)!
    expect(kursi(w.daerah, 'sarpras').pemegang).toEqual([expect.objectContaining({ nama: 'Pengurus Rangkap', perwakilan: null })])
    expect(kursi(w.sorong, 'sarpras').pemegang).toEqual([expect.objectContaining({ perwakilan: 'daerah' })])
    expect(kursi(w.remu, 'bk')).toMatchObject({ kosong: false })
    expect(kursi(w.klasaman, 'bk')).toMatchObject({ kosong: true })
    expect(kursi(w.daerah, 'ketua').kosong).toBe(true)
    expect(s.kursi.some((k) => k.tingkat === 'desa' && k.jabatan === 'bendahara')).toBe(false)
    // daerah 14 + 2 desa × 10 + 3 kelompok × 10
    expect(s.kursi).toHaveLength(14 + 20 + 30)
    expect(s.kosong).toBe(s.kursi.length - 3)
  })
})

describe('Kompatibilitas & alur EXE desa (J-BJ1, J-BJ3, §21.2)', () => {
  it('migrasi v7 → v8: kunci bidang lama (tanpa wilayah) = kunci wilayah daerah, catatan lama tetap terbaca', async () => {
    const w = await dunia()
    const ben = await pengurus(w, 'Bendahara', [{ jabatan: 'bendahara', wilayah_id: w.daerah.id }])
    simpanCatatan(ben.db, { jenis: 'kas', isi: { arah: 'masuk', jumlah: 10_000, akun: 'lain' } })
    setor(w, ben.db)
    // tiru database Fase 11–14: kunci hanya di tabel lama, versi skema 7
    const db = w.admin.db
    db.jalankanSkrip(`DELETE FROM kunci_bidang;
      INSERT INTO kunci_bidang (bidang, versi, publik, rahasia_terenkripsi, dibuat_pada)
        SELECT bidang, versi, publik, rahasia_terenkripsi, dibuat_pada FROM kunci_bidang_wilayah WHERE wilayah_id = '${w.daerah.id}';
      DELETE FROM kunci_bidang_wilayah;
      UPDATE meta SET nilai = '7' WHERE kunci = 'versi_skema';`)
    const { migrasi } = await import('../src/index')
    migrasi(db)
    expect(db.nilai<number>(`SELECT COUNT(*) FROM kunci_bidang_wilayah WHERE wilayah_id = ''`)).toBeGreaterThan(0)
    expect(ringkasanKas(db, { kunciAdmin: w.admin.kunci }).saldo).toBe(10_000)
    expect(db.nilai<number>(`SELECT COUNT(*) FROM kunci_bidang_wilayah WHERE wilayah_id = ''`)).toBe(0)
  })

  it('token lama ber-`jabatan[]` dibaca sebagai penugasan pada wilayah token', async () => {
    const w = await dunia()
    const hp = await buatHp('HP Lama')
    const baru = uraiToken(terbitkanToken(w.admin.db, w.admin.kunci, { kodePerangkat: hp.kode, role: 'pengurus', nama: 'Lama', wilayahId: w.daerah.id, jabatan: ['sarpras'] })).payload
    const { penugasan: _p, ...tanpa } = baru
    const lama = tandaTanganiToken({ ...tanpa, jabatan: ['sarpras'] }, w.admin.kunci.tandaTangan.rahasia)
    const profil = await aktifkanProfil(hp.db, lama)
    expect(penugasanProfil(profil)).toEqual([{ jabatan: 'sarpras', wilayah_id: w.daerah.id }])
    paket(w, hp.db, w.daerah)
    const c = simpanCatatan(hp.db, { jenis: 'inventaris', isi: { kelompok_id: w.jalurA.id, barang: 'Karpet', jumlah: 3, kondisi: 'baik' } })
    expect(c.wilayah_id).toBe(w.jalurA.id)
  })

  it('EXE desa meneruskan info BK bertanda tangan daerah ke HP mubaligh; struktur desa dari paket daerah', async () => {
    const w = await dunia()
    const { bukaDb, inisialisasiExe, aktifkanExe, terbitkanTokenBawah } = await import('../src/index')
    const exe = await bukaDb()
    const { kodePerangkat, kunci } = await inisialisasiExe(exe, { sandi: 'sandi-admin-123', label: 'EXE Desa' })
    await aktifkanExe(exe, kunci, terbitkanToken(w.admin.db, w.admin.kunci, { kodePerangkat, role: 'admin', nama: 'Admin Desa', wilayahId: w.sorong.id }))
    await pengurus(w, 'BK Remu', [{ jabatan: 'bk', wilayah_id: w.remu.id }])
    await pengurus(w, 'Rangkap', [{ jabatan: 'tahfidz', wilayah_id: w.daerah.id }, { jabatan: 'tahfidz', wilayah_id: w.remu.id }])
    terapkanPaket(exe, buatPaket(w.admin.db, w.sorong.id, w.admin.kunci).bytes)
    const hp = await buatHp('HP MT')
    await aktifkanProfil(hp.db, terbitkanTokenBawah(exe, kunci, { kodePerangkat: hp.kode, role: 'mubaligh', nama: 'Ust. Desa', wilayahId: w.remu.id }))
    terapkanPaket(hp.db, buatPaket(exe, w.remu.id, kunci).bytes)
    expect(tujuanRujukan(hp.db, w.g[0]!.id).wilayah_id).toBe(w.remu.id)
    const r = simpanRujukan(hp.db, { generusId: w.g[0]!.id, kategori: 'belajar', uraian: 'Lewat desa' })
    expect(r.berkas).not.toBeNull()
    // struktur di EXE desa: kursi Remu tahfidz dipegang perwakilan daerah
    const s = strukturKepengurusan(exe, w.sorong.id)
    expect(s.kursi.find((k) => k.wilayah_id === w.remu.id && k.jabatan === 'tahfidz')!.pemegang).toEqual([expect.objectContaining({ nama: 'Rangkap', perwakilan: 'daerah' })])
    expect(s.kursi.find((k) => k.wilayah_id === w.sorong.id && k.jabatan === 'pj_desa')!.kosong).toBe(true)
    // info palsu (tanda tangan bukan daerah) diabaikan
    const { simpanBlob, tandaTanganiBlob, buatPasanganTandaTangan } = await import('../src/index')
    const palsu = tandaTanganiBlob('info', { v: 1, dibuat_pada: '2099-01-01T00:00:00.000Z', kunci: {}, bk: {}, kerabat: {} }, buatPasanganTandaTangan().rahasia)
    expect(simpanBlob(hp.db, 'info', palsu)).toBe(false)
  })
})
