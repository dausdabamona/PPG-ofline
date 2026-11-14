import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  aktifkanProfil,
  ajukanUsulan,
  buatBelajar,
  buatPaket,
  buatSetor,
  catatKemajuan,
  catatPresensi,
  daftarProfil,
  daftarRiwayatImpor,
  imporBelajar,
  imporSetor,
  jumlahBelumDisetor,
  terapkanPaket,
  terbitkanToken,
  terbitkanTokenGenerus,
  terapkanMateri,
  buatMateri,
  versiPaketTerpasang,
} from '../src/index'
import { buatDunia, buatHp, lepasJam, maju, pasangJam, type Dunia } from './bantu'

let d: Dunia
let pengurus: Awaited<ReturnType<typeof buatHp>>
beforeAll(async () => {
  pasangJam('2026-11-02T01:00:00.000Z')
  d = await buatDunia()
  pengurus = await buatHp('HP Pengurus')
  await aktifkanProfil(pengurus.db, terbitkanToken(d.admin.db, d.admin.kunci, { kodePerangkat: pengurus.kode, role: 'pengurus', nama: 'Pak Rudi', wilayahId: d.k1.id }))
  terapkanPaket(pengurus.db, buatPaket(d.admin.db, d.k1.id, d.admin.kunci).bytes)
})
afterAll(() => lepasJam())

describe('keamanan sinkron', () => {
  it('admin menolak rekaman di luar wewenang pengirim (wilayah, pemilik, pengesahan, status usulan)', () => {
    const db = pengurus.db
    const g = d.g[0]!.id
    const a = catatPresensi(db, { kelompokId: d.k1.id, generusId: g, tanggal: '2026-11-01', status: 'hadir' })
    const b = catatPresensi(db, { kelompokId: d.k1.id, generusId: g, tanggal: '2026-11-02', status: 'hadir' })
    const c = catatPresensi(db, { kelompokId: d.k1.id, generusId: g, tanggal: '2026-11-03', status: 'hadir' })
    const u = ajukanUsulan(db, { jenis: 'tambah_jamaah', kelompokId: d.k1.id, data: { nama: 'X', jenis_kelamin: 'L' } })
    // manipulasi langsung database HP (meniru aplikasi yang diubah)
    db.jalankan('UPDATE presensi SET kelompok_id = ? WHERE id = ?', [d.k2.id, a.id])
    db.jalankan('UPDATE presensi SET perangkat_id = ? WHERE id = ?', ['HP-LAIN', b.id])
    db.jalankan(`UPDATE usulan SET status = 'disetujui' WHERE id = ?`, [u.id])
    db.jalankan(
      `INSERT INTO kemajuan_belajar SELECT 'KB-PALSU', ?, ?, 'MAT-ALM-HFS-001', 'selesai', 100, NULL, '2026-11-01', 'mubaligh', 'disahkan',
         'Pak Rudi', '2026-11-01T00:00:00Z', NULL, NULL, ?, '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z', 0, 1, 99`,
      [g, d.k1.id, pengurus.id],
    )
    db.jalankan(`INSERT INTO wilayah SELECT 'W-PALSU', 'daerah', 'Palsu', NULL, NULL, ?, 'x', 'x', 0, 1, 99`, [pengurus.id])
    const r = imporSetor(d.admin.db, buatSetor(db).bytes, d.admin.kunci)
    const alasan = Object.fromEntries(r.ditolak.map((x) => [x.id, x.alasan]))
    expect(alasan[a.id]).toMatch(/luar wilayah/)
    expect(alasan[b.id]).toMatch(/perangkat lain/)
    expect(alasan[u.id]).toMatch(/diputuskan admin/)
    expect(alasan['KB-PALSU']).toMatch(/mengesahkan/)
    expect(alasan['W-PALSU']).toMatch(/master/)
    expect(r.perTabel.presensi?.ditambah).toBe(1)
    expect(d.admin.db.nilai('SELECT COUNT(*) FROM presensi WHERE id = ?', [c.id])).toBe(1)
    expect(daftarRiwayatImpor(d.admin.db)[0]!.jenis).toBe('SETOR')
  })

  it('berkas setor diubah / ditandatangani perangkat lain ditolak', async () => {
    maju(5)
    catatPresensi(pengurus.db, { kelompokId: d.k1.id, generusId: d.g[1]!.id, tanggal: '2026-11-04', status: 'hadir' })
    const s = buatSetor(pengurus.db)
    const ubah = s.bytes.slice()
    ubah[ubah.length - 1]! ^= 1
    expect(() => imporSetor(d.admin.db, ubah, d.admin.kunci)).toThrow(/ditolak/)
    // HP lain menyalin token pengurus ke setorannya → tanda tangan tidak cocok dengan token
    const lain = await buatHp('HP Penyusup')
    for (const k of ['org_id', 'admin_sign_pub', 'admin_box_pub']) {
      lain.db.jalankan('INSERT OR REPLACE INTO meta (kunci, nilai) VALUES (?, ?)', [k, pengurus.db.nilai<string>('SELECT nilai FROM meta WHERE kunci = ?', [k])!])
    }
    const p = daftarProfil(pengurus.db)[0]!
    lain.db.jalankan(
      `INSERT INTO profil (id, token_id, token, role, nama, wilayah_id, tingkat, berlaku_sampai, dibuat_pada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.id, p.token_id, p.token, p.role, p.nama, p.wilayah_id, p.tingkat, p.berlaku_sampai, p.dibuat_pada],
    )
    expect(() => imporSetor(d.admin.db, buatSetor(lain.db).bytes, d.admin.kunci)).toThrow(/PENGIRIM_TIDAK_SAH|ditolak/)
    expect(imporSetor(d.admin.db, s.bytes, d.admin.kunci).perTabel.presensi?.ditambah).toBe(1)
  })

  it('paket untuk organisasi lain / berkas paket diubah ditolak; konfirmasi menurunkan jumlah belum disetor', async () => {
    const p = buatPaket(d.admin.db, d.k1.id, d.admin.kunci)
    const ubah = p.bytes.slice()
    ubah[ubah.length - 2]! ^= 1
    expect(() => terapkanPaket(pengurus.db, ubah)).toThrow(/Tanda tangan paket/)
    expect(jumlahBelumDisetor(pengurus.db)).toBeGreaterThan(0)
    terapkanPaket(pengurus.db, p.bytes)
    expect(versiPaketTerpasang(pengurus.db, d.k1.id)).toBe(p.versi)
    // rekaman yang ditolak admin tetap "belum disetor" sampai diperbaiki (konfirmasi berdasar seq tertinggi yang diterima)
    expect(jumlahBelumDisetor(pengurus.db)).toBe(0)
    const lain = await buatDunia()
    expect(() => terapkanPaket(pengurus.db, buatPaket(lain.admin.db, lain.k1.id, lain.admin.kunci).bytes)).toThrow(/organisasi lain/)
  })

  it('BELAJAR: rekaman yang mengaku disahkan atau milik generus lain ditolak mubaligh', async () => {
    const hp = await buatHp('HP Ali')
    const prof = await aktifkanProfil(hp.db, terbitkanTokenGenerus(d.mubaligh.db, d.mubaligh.profil.id, { kodePerangkat: hp.kode, role: 'generus', generusIds: [d.g[0]!.id], nama: 'Ali' }))
    terapkanMateri(hp.db, buatMateri(d.admin.db, d.admin.kunci).bytes)
    const k = catatKemajuan(hp.db, prof.id, { materiId: 'MAT-ALM-HFS-001', status: 'selesai' })
    const k2 = catatKemajuan(hp.db, prof.id, { materiId: 'MAT-ALM-HFS-002', status: 'selesai' })
    const k3 = catatKemajuan(hp.db, prof.id, { materiId: 'MAT-ALM-HFS-003', status: 'selesai' })
    hp.db.jalankan(`UPDATE kemajuan_belajar SET status_sah = 'disahkan', disahkan_oleh = 'Saya' WHERE id = ?`, [k.id])
    hp.db.jalankan('UPDATE kemajuan_belajar SET generus_id = ? WHERE id = ?', [d.g[1]!.id, k2.id])
    const b = buatBelajar(hp.db)
    // generus_id = Budi tidak lagi ikut terpilih (bukan milik profil); pakai manipulasi kedua: materi tak dikenal
    hp.db.jalankan(`UPDATE kemajuan_belajar SET materi_id = 'MAT-TIDAK-ADA' WHERE id = ?`, [k3.id])
    const b2 = buatBelajar(hp.db)
    const r = imporBelajar(d.mubaligh.db, b.bytes)
    expect(r.hasil.ditolak.map((x) => x.alasan)).toEqual([expect.stringMatching(/hanya boleh mengajukan/)])
    const r2 = imporBelajar(d.mubaligh.db, b2.bytes)
    expect(r2.hasil.ditolak.map((x) => x.alasan)).toContain('Materi tidak dikenal.')
  })
})
