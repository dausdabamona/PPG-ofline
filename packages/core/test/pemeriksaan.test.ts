// Fase 1b — pemeriksaan independen: setiap test di sini mereproduksi cacat nyata yang ditemukan pemeriksa.
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  aktifkanProfil,
  ambilIdentitas,
  bekukanPerangkat,
  bukaDb,
  bukaKunciAdmin,
  buatBalasan,
  buatBelajar,
  buatJadwal,
  buatMateri,
  buatPaket,
  buatPasanganKotak,
  buatSetor,
  catatKemajuan,
  catatPresensi,
  daftarProfil,
  dariB64url,
  gantiKunciKelompok,
  imporBelajar,
  imporSetor,
  jumlahBelumDisetor,
  jumlahBelumDisetorBelajar,
  kemasBerkas,
  keB64url,
  kompresJson,
  segelKe,
  serahTerimaMubaligh,
  setorAkhir,
  simpanDb,
  tambahGenerus,
  tambahJadwalTambahan,
  terapkanBalasan,
  terapkanJadwal,
  terapkanMateri,
  terapkanPaket,
  terbitkanToken,
  terbitkanTokenGenerus,
  ubahGenerus,
  ubahStatus,
  ambilGenerus,
  ambilMateri,
  type Db,
  type Generus,
  type HeaderBerkas,
  type Profil,
} from '../src/index'
import { buatDunia, buatHp, lepasJam, maju, pasangJam, SANDI, type Dunia } from './bantu'

let d: Dunia
beforeEach(async () => {
  pasangJam('2026-11-02T01:00:00.000Z')
  d = await buatDunia()
})
afterAll(() => lepasJam())

/** HP generus satu profil untuk generus K1 ke-i (materi terpasang). */
async function hpGenerus(i: number): Promise<{ db: Db; id: string; kode: string; profil: Profil }> {
  const hp = await buatHp(`HP ${d.g[i]!.nama}`)
  const teks = terbitkanTokenGenerus(d.mubaligh.db, d.mubaligh.profil.id, { kodePerangkat: hp.kode, role: 'generus', generusIds: [d.g[i]!.id], nama: d.g[i]!.nama })
  const profil = await aktifkanProfil(hp.db, teks)
  terapkanMateri(hp.db, buatMateri(d.admin.db, d.admin.kunci).bytes)
  return { ...hp, profil }
}

/** Mubaligh menyetor ke admin (token generus terdaftar), lalu paket terbaru diterapkan. */
function siklusAdmin(): void {
  imporSetor(d.admin.db, buatSetor(d.mubaligh.db).bytes, d.admin.kunci)
  maju(1)
  d.segarkan()
}

/** Rakit BALASAN buatan sendiri (meniru aplikasi mubaligh yang diubah) — ditandatangani perangkat mubaligh asli. */
function balasanRakitan(dbMub: Db, penerima: { id: string; db: Db }, isi: Record<string, unknown>): Uint8Array {
  const idm = ambilIdentitas(dbMub)
  const boxPenerima = ambilIdentitas(penerima.db).kotak.publik
  const header: HeaderBerkas = {
    jenis: 'BALASAN',
    versi_format: 1,
    org_id: d.admin.kunci.orgId,
    pengirim_perangkat_id: idm.id,
    dibuat_pada: new Date().toISOString(),
    wilayah_id: d.k1.id,
    penerima_perangkat_id: penerima.id,
  }
  return kemasBerkas(header, segelKe(boxPenerima, kompresJson(isi)), idm.tandaTangan.rahasia)
}

describe('Fase 1b — keamanan kunci & pengirim', () => {
  it('[kritis] kunci setor publik tanpa tanda tangan admin (disisipkan mubaligh) diabaikan HP generus', async () => {
    const g = await hpGenerus(0)
    // mubaligh (atau aplikasinya yang diubah) menyisipkan kunci versi 99 yang rahasianya ia pegang sendiri
    const palsu = buatPasanganKotak()
    const prof = daftarProfil(d.mubaligh.db, 'mubaligh')[0]!
    const rahasia = { ...prof.rahasia, kunci_kelompok_setor: [...(prof.rahasia.kunci_kelompok_setor ?? []), { versi: 99, publik: keB64url(palsu.publik), rahasia: keB64url(palsu.rahasia) }] }
    d.mubaligh.db.jalankan('UPDATE profil SET rahasia_json = ? WHERE id = ?', [JSON.stringify(rahasia), prof.id])
    terapkanBalasan(g.db, buatBalasan(d.mubaligh.db, g.id).bytes)
    catatKemajuan(g.db, g.profil.id, { materiId: 'MAT-ALM-HFS-001', status: 'selesai' })
    expect(buatBelajar(g.db).header.versi_kunci).toBe(1)
  })

  it('[kritis] setelah serah terima: BALASAN & JADWAL mubaligh lama ditolak HP generus; kunci umum diganti', async () => {
    const g = await hpGenerus(0)
    const pengurus = await buatHp('HP Pengurus K1')
    await aktifkanProfil(pengurus.db, terbitkanToken(d.admin.db, d.admin.kunci, { kodePerangkat: pengurus.kode, role: 'pengurus', nama: 'Pak Rudi', wilayahId: d.k1.id }))
    const baru = await buatHp('HP Ust. Yusuf')
    // token mubaligh baru diterbitkan SEBELUM serah terima → kunci umum baru harus tiba lewat PAKET
    await aktifkanProfil(baru.db, terbitkanToken(d.admin.db, d.admin.kunci, { kodePerangkat: baru.kode, role: 'mubaligh', nama: 'Ust. Yusuf', wilayahId: d.k1.id }))
    siklusAdmin()
    terapkanPaket(pengurus.db, buatPaket(d.admin.db, d.k1.id, d.admin.kunci).bytes)

    maju(5)
    imporSetor(d.admin.db, setorAkhir(d.mubaligh.db).bytes, d.admin.kunci)
    serahTerimaMubaligh(d.admin.db, d.admin.kunci, { kelompokId: d.k1.id, perangkatLamaId: d.mubaligh.id })
    maju(5)
    const paket = buatPaket(d.admin.db, d.k1.id, d.admin.kunci)
    terapkanPaket(baru.db, paket.bytes)
    terapkanPaket(pengurus.db, paket.bytes)
    terapkanMateri(baru.db, buatMateri(d.admin.db, d.admin.kunci).bytes)

    const kunciLama = daftarProfil(d.mubaligh.db, 'mubaligh')[0]!.rahasia.kunci_umum_kelompok
    expect(daftarProfil(baru.db, 'mubaligh')[0]!.rahasia.kunci_umum_kelompok).not.toBe(kunciLama)
    expect(daftarProfil(pengurus.db, 'pengurus')[0]!.rahasia.kunci_umum_kelompok).not.toBe(kunciLama)

    maju(5)
    terapkanBalasan(g.db, buatBalasan(baru.db, g.id).bytes)
    tambahJadwalTambahan(baru.db, { kelompokId: d.k1.id, tanggal: '2026-11-10', jam: '19:00', judul: 'Muroja’ah' })
    const jadwal = buatJadwal(baru.db)
    terapkanJadwal(g.db, jadwal.bytes)
    terapkanJadwal(pengurus.db, jadwal.bytes)
    // mubaligh lama tidak lagi bisa membaca jadwal baru
    expect(() => terapkanJadwal(d.mubaligh.db, jadwal.bytes)).toThrow(/tidak bisa dibuka/)

    // mubaligh lama (dicabut) tidak bisa lagi mengirim BALASAN / JADWAL ke HP generus
    maju(5)
    expect(() => terapkanBalasan(g.db, buatBalasan(d.mubaligh.db, g.id).bytes)).toThrow(/dicabut|tidak sah/)
    expect(() => terapkanJadwal(g.db, buatJadwal(d.mubaligh.db).bytes)).toThrow()
  })

  it('[sedang] gantiKunciKelompok juga mengganti kunci umum kelompok', () => {
    const lama = d.mubaligh.profil.rahasia.kunci_umum_kelompok
    gantiKunciKelompok(d.admin.db, d.admin.kunci, d.k1.id)
    maju(1)
    d.segarkan()
    expect(daftarProfil(d.mubaligh.db, 'mubaligh')[0]!.rahasia.kunci_umum_kelompok).not.toBe(lama)
  })

  it('[sedang] admin menolak kegiatan untuk generus yang bukan anggota kelompok itu pada tanggalnya', () => {
    const gK2 = tambahGenerus(d.admin.db, { kelompokId: d.k2.id, nama: 'Dewi', jenisKelamin: 'P', kategori: 'caberawit', mulai: '2026-10-01' })
    const mub = d.mubaligh
    const sync = `'${mub.id}', '2026-11-02T00:00:00Z', '2026-11-02T00:00:00Z', 0, 1, 50`
    // mubaligh K1 "mengesahkan" kemajuan generus K2 dengan menulis kelompok_id K1
    mub.db.jalankan(
      `INSERT INTO kemajuan_belajar VALUES ('KB-LINTAS', ?, ?, 'MAT-ALM-HFS-001', 'selesai', 100, NULL, '2026-11-01', 'mubaligh', 'disahkan', 'Ust. Hasan', '2026-11-02T00:00:00Z', NULL, NULL, ${sync})`,
      [gK2.id, d.k1.id],
    )
    mub.db.jalankan(`INSERT INTO presensi VALUES ('PR-LINTAS', ?, NULL, NULL, '2026-11-01', ?, 'hadir', ${sync})`, [d.k1.id, gK2.id])
    // presensi sebelum generus menjadi anggota (mulai 2026-10-01)
    mub.db.jalankan(`INSERT INTO presensi VALUES ('PR-AWAL', ?, NULL, NULL, '2026-09-01', ?, 'hadir', ${sync})`, [d.k1.id, d.g[0]!.id])
    mub.db.jalankan(`INSERT INTO presensi VALUES ('PR-SAH', ?, NULL, NULL, '2026-11-01', ?, 'hadir', ${sync})`, [d.k1.id, d.g[0]!.id])
    mub.db.jalankan(`INSERT INTO presensi VALUES ('PR-HANTU', ?, NULL, NULL, '2026-11-01', 'G-TIDAK-ADA', 'hadir', ${sync})`, [d.k1.id])
    mub.db.jalankan(`UPDATE meta SET nilai = '60' WHERE kunci = 'seq'`)
    const r = imporSetor(d.admin.db, buatSetor(mub.db).bytes, d.admin.kunci)
    const alasan = Object.fromEntries(r.ditolak.map((x) => [x.id, x.alasan]))
    expect(alasan['KB-LINTAS']).toMatch(/anggota/)
    expect(alasan['PR-LINTAS']).toMatch(/anggota/)
    expect(alasan['PR-AWAL']).toMatch(/anggota/)
    expect(alasan['PR-HANTU']).toMatch(/tidak dikenal/)
    expect(alasan['PR-SAH']).toBeUndefined()
    expect(d.admin.db.nilai('SELECT COUNT(*) FROM kemajuan_belajar WHERE id = ?', ['KB-LINTAS'])).toBe(0)
  })

  it('[ringan] BALASAN rakitan: data di luar generus penerima & data master materi diabaikan', async () => {
    const g = await hpGenerus(0)
    const m = ambilMateri(g.db, 'MAT-ALM-HFS-001')!
    const lain = ambilGenerus(d.mubaligh.db, d.g[1]!.id)!
    const bytes = balasanRakitan(d.mubaligh.db, g, {
      kelompok_id: d.k1.id,
      token_pengirim: d.mubaligh.profil.token,
      rekaman: {
        materi: [{ ...m, nama: 'PALSU', versi: 99, seq_lokal: undefined }],
        generus: [{ ...lain, seq_lokal: undefined }],
        presensi: [{ id: 'PR-X', kelompok_id: d.k1.id, pengajian_id: null, jadwal_tambahan_id: null, tanggal: '2026-11-01', generus_id: lain.id, status: 'hadir', perangkat_id: d.mubaligh.id, dibuat_pada: 'x', diubah_pada: 'x', dihapus: 0, versi: 1 }],
      },
      pencabutan: [],
      konfirmasi_belajar_seq: 0,
    })
    const r = terapkanBalasan(g.db, bytes)
    expect(r.total.ditolak.length).toBe(3)
    expect(ambilMateri(g.db, 'MAT-ALM-HFS-001')!.nama).toBe(m.nama)
    expect(ambilGenerus(g.db, lain.id)).toBeUndefined()
  })
})

describe('Fase 1b — kebenaran sinkron', () => {
  it('[sedang] HP dengan profil generus dari dua kelompok: konfirmasi kelompok A tidak menelan data kelompok B', async () => {
    // mubaligh K2 + generus K2
    const gK2: Generus = tambahGenerus(d.admin.db, { kelompokId: d.k2.id, nama: 'Dewi', jenisKelamin: 'P', kategori: 'caberawit', mulai: '2026-10-01' })
    const m2 = await buatHp('HP Mubaligh K2')
    const pm2 = await aktifkanProfil(m2.db, terbitkanToken(d.admin.db, d.admin.kunci, { kodePerangkat: m2.kode, role: 'mubaligh', nama: 'Ust. Ali', wilayahId: d.k2.id }))
    terapkanPaket(m2.db, buatPaket(d.admin.db, d.k2.id, d.admin.kunci).bytes)
    terapkanMateri(m2.db, buatMateri(d.admin.db, d.admin.kunci).bytes)
    // HP bersama: sepupu Ali (K1) dan Dewi (K2)
    const hp = await buatHp('HP Bersama')
    const pA = await aktifkanProfil(hp.db, terbitkanTokenGenerus(d.mubaligh.db, d.mubaligh.profil.id, { kodePerangkat: hp.kode, role: 'generus', generusIds: [d.g[0]!.id], nama: 'Ali' }))
    const pB = await aktifkanProfil(hp.db, terbitkanTokenGenerus(m2.db, pm2.id, { kodePerangkat: hp.kode, role: 'generus', generusIds: [gK2.id], nama: 'Dewi' }))
    terapkanMateri(hp.db, buatMateri(d.admin.db, d.admin.kunci).bytes)
    catatKemajuan(hp.db, pA.id, { materiId: 'MAT-ALM-HFS-001', status: 'selesai' })
    catatKemajuan(hp.db, pB.id, { materiId: 'MAT-ALM-HFS-001', status: 'selesai' })
    expect(jumlahBelumDisetorBelajar(hp.db)).toBe(2)

    imporBelajar(d.mubaligh.db, buatBelajar(hp.db, { kelompokId: d.k1.id }).bytes)
    terapkanBalasan(hp.db, buatBalasan(d.mubaligh.db, hp.id).bytes)
    expect(jumlahBelumDisetorBelajar(hp.db)).toBe(1)
    expect(jumlahBelumDisetorBelajar(hp.db, d.k2.id)).toBe(1)
    const bK2 = buatBelajar(hp.db, { kelompokId: d.k2.id })
    expect(bK2.jumlah).toBe(1)
    expect(imporBelajar(m2.db, bK2.bytes).hasil.ditambah).toBe(1)
  })

  it('[sedang] catatan profil yang dibekukan (mondok) tidak ikut terkonfirmasi oleh setoran saudaranya', async () => {
    const hp = await buatHp('HP Kakak-Adik')
    const pA = await aktifkanProfil(hp.db, terbitkanTokenGenerus(d.mubaligh.db, d.mubaligh.profil.id, { kodePerangkat: hp.kode, role: 'generus', generusIds: [d.g[0]!.id], nama: 'Ali' }))
    const pB = await aktifkanProfil(hp.db, terbitkanTokenGenerus(d.mubaligh.db, d.mubaligh.profil.id, { kodePerangkat: hp.kode, role: 'generus', generusIds: [d.g[1]!.id], nama: 'Budi' }))
    terapkanMateri(hp.db, buatMateri(d.admin.db, d.admin.kunci).bytes)
    catatKemajuan(hp.db, pB.id, { materiId: 'MAT-ALM-HFS-002', status: 'selesai' })
    siklusAdmin()
    // Budi mondok sebelum sempat menyetor
    ubahStatus(d.admin.db, d.g[1]!.id, 'mondok', '2026-11-02')
    maju(1)
    d.segarkan()
    terapkanBalasan(hp.db, buatBalasan(d.mubaligh.db, hp.id).bytes)
    expect(daftarProfil(hp.db).find((p) => p.id === pB.id)!.dibekukan).toBe(true)
    maju(1)
    catatKemajuan(hp.db, pA.id, { materiId: 'MAT-ALM-HFS-001', status: 'selesai' })
    imporBelajar(d.mubaligh.db, buatBelajar(hp.db).bytes)
    terapkanBalasan(hp.db, buatBalasan(d.mubaligh.db, hp.id).bytes)
    // Budi kembali aktif → catatannya yang lama harus tetap terkirim
    ubahStatus(d.admin.db, d.g[1]!.id, 'aktif', '2026-11-03')
    maju(1)
    d.segarkan()
    terapkanBalasan(hp.db, buatBalasan(d.mubaligh.db, hp.id).bytes)
    const b = buatBelajar(hp.db)
    const r = imporBelajar(d.mubaligh.db, b.bytes)
    expect(r.hasil.ditambah).toBe(1)
  })

  it('[sedang] admin memulihkan database dari cadangan: paket baru (versi lebih kecil) tetap diterima, paket lama tetap ditolak', async () => {
    const cadangan = simpanDb(d.admin.db)
    const pr = catatPresensi(d.mubaligh.db, { kelompokId: d.k1.id, generusId: d.g[0]!.id, tanggal: '2026-11-01', status: 'hadir' })
    imporSetor(d.admin.db, buatSetor(d.mubaligh.db).bytes, d.admin.kunci)
    ubahGenerus(d.admin.db, d.g[0]!.id, { nama: 'Ali A1' })
    ubahGenerus(d.admin.db, d.g[0]!.id, { nama: 'Ali A2' })
    maju(1)
    const p2 = buatPaket(d.admin.db, d.k1.id, d.admin.kunci)
    terapkanPaket(d.mubaligh.db, p2.bytes)
    maju(1)
    terapkanPaket(d.mubaligh.db, buatPaket(d.admin.db, d.k1.id, d.admin.kunci).bytes)
    // laptop admin rusak; pulihkan cadangan lama
    const dbPulih = await bukaDb(cadangan)
    const kunci = await bukaKunciAdmin(dbPulih, SANDI)
    maju(10)
    ubahGenerus(dbPulih, d.g[0]!.id, { nama: 'Ali Benar' })
    const baru = buatPaket(dbPulih, d.k1.id, kunci)
    expect(baru.versi).toBe(2)
    terapkanPaket(d.mubaligh.db, baru.bytes)
    expect(ambilGenerus(d.mubaligh.db, d.g[0]!.id)!.nama).toBe('Ali Benar')
    expect(() => terapkanPaket(d.mubaligh.db, p2.bytes)).toThrow(/tidak lebih baru/)
    // HP bisa menyetor ulang semua data agar admin yang dipulihkan lengkap kembali
    expect(jumlahBelumDisetor(d.mubaligh.db)).toBe(0)
    const ulang = buatSetor(d.mubaligh.db, { semua: true })
    expect(dbPulih.nilai('SELECT COUNT(*) FROM presensi WHERE id = ?', [pr.id])).toBe(0)
    imporSetor(dbPulih, ulang.bytes, kunci)
    expect(dbPulih.nilai('SELECT COUNT(*) FROM presensi WHERE id = ?', [pr.id])).toBe(1)
  })

  it('[ringan] pembekuan oleh admin tetap tersampaikan lewat BALASAN, bukan hanya status generus', async () => {
    const g = await hpGenerus(2)
    siklusAdmin()
    const tok = daftarProfil(g.db)[0]!.token_id
    bekukanPerangkat(d.admin.db, tok)
    maju(1)
    d.segarkan()
    terapkanBalasan(g.db, buatBalasan(d.mubaligh.db, g.id).bytes)
    expect(daftarProfil(g.db)[0]!.dibekukan).toBe(true)
  })
})
