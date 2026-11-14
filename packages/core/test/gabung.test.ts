import { beforeEach, describe, expect, it } from 'vitest'
import { bukaDb, gabungRekaman, gabungSemua, type Db } from '../src/index'

let db: Db
beforeEach(async () => {
  db = await bukaDb()
})

const sinkron = (o: Record<string, unknown> = {}) => ({
  perangkat_id: 'HP-A',
  dibuat_pada: '2026-11-01T00:00:00.000Z',
  diubah_pada: '2026-11-01T00:00:00.000Z',
  dihapus: 0,
  versi: 1,
  ...o,
})
const presensi = (o: Record<string, unknown> = {}) => ({
  id: 'P1',
  kelompok_id: 'K1',
  pengajian_id: null,
  jadwal_tambahan_id: null,
  tanggal: '2026-11-01',
  generus_id: 'G1',
  status: 'hadir',
  ...sinkron(o),
  ...o,
})
const kemajuan = (o: Record<string, unknown> = {}) => ({
  id: 'KB1',
  generus_id: 'G1',
  kelompok_id: 'K1',
  materi_id: 'M1',
  status: 'selesai',
  nilai: null,
  level: null,
  tanggal: '2026-11-01',
  sumber: 'generus',
  status_sah: 'diajukan',
  disahkan_oleh: null,
  disahkan_pada: null,
  catatan_generus: null,
  catatan_mubaligh: null,
  ...sinkron(o),
  ...o,
})
const seq = (tabel: string, id: string) => db.nilai<number>(`SELECT seq_lokal FROM ${tabel} WHERE id = ?`, [id])

describe('gabungRekaman', () => {
  it('master: ditolak dari perangkat; dari admin menang bila versi ≥ lokal', () => {
    const w = { id: 'W1', tingkat: 'daerah', nama: 'Sorong', kode: 'S', induk_id: null, ...sinkron({ perangkat_id: 'ADMIN' }) }
    expect(gabungRekaman(db, 'wilayah', [w], { sumber: 'perangkat' }).ditolak).toHaveLength(1)
    expect(gabungRekaman(db, 'wilayah', [w], { sumber: 'admin' }).ditambah).toBe(1)
    expect(gabungRekaman(db, 'wilayah', [w], { sumber: 'admin' }).diabaikan).toBe(1)
    expect(gabungRekaman(db, 'wilayah', [{ ...w, nama: 'Baru', versi: 2 }], { sumber: 'admin' }).diperbarui).toBe(1)
    expect(gabungRekaman(db, 'wilayah', [{ ...w, nama: 'Lama', versi: 1 }], { sumber: 'admin' }).diabaikan).toBe(1)
    expect(db.nilai('SELECT nama FROM wilayah')).toBe('Baru')
  })

  it('kegiatan: last-writer-wins, seri → perangkat_id; seq_lokal dari opsi', () => {
    gabungRekaman(db, 'presensi', [presensi()], { sumber: 'perangkat', seqLokalBaru: 7 })
    expect(seq('presensi', 'P1')).toBe(7)
    const h = gabungRekaman(db, 'presensi', [presensi({ status: 'izin', diubah_pada: '2026-11-02T00:00:00.000Z', versi: 2 })], { sumber: 'admin' })
    expect(h.diperbarui).toBe(1)
    expect(seq('presensi', 'P1')).toBe(0)
    expect(gabungRekaman(db, 'presensi', [presensi({ status: 'alpa' })], { sumber: 'admin' }).diabaikan).toBe(1)
    // seri waktu → perangkat_id leksikografis lebih besar menang
    gabungRekaman(db, 'presensi', [presensi({ id: 'P2', perangkat_id: 'HP-A' })], { sumber: 'admin' })
    expect(gabungRekaman(db, 'presensi', [presensi({ id: 'P2', perangkat_id: 'HP-B', status: 'sakit' })], { sumber: 'admin' }).diperbarui).toBe(1)
    expect(gabungRekaman(db, 'presensi', [presensi({ id: 'P2', perangkat_id: 'HP-0', status: 'alpa' })], { sumber: 'admin' }).diabaikan).toBe(1)
  })

  it('bentrok dicatat untuk suntingan bersamaan, bukan untuk gema data lama', () => {
    gabungRekaman(db, 'presensi', [presensi({ versi: 2, diubah_pada: '2026-11-02T00:00:00.000Z' })], { sumber: 'perangkat', seqLokalBaru: 3 })
    // gema versi lama → tanpa bentrok
    expect(gabungRekaman(db, 'presensi', [presensi({ status: 'izin', versi: 1 })], { sumber: 'admin' }).bentrok).toBe(0)
    // suntingan bersamaan (versi sama, isi beda) → bentrok tercatat, pemenang LWW
    const h = gabungRekaman(db, 'presensi', [presensi({ status: 'sakit', versi: 2, diubah_pada: '2026-11-03T00:00:00.000Z' })], { sumber: 'admin' })
    expect(h).toMatchObject({ bentrok: 1, diperbarui: 1 })
    expect(db.nilai('SELECT COUNT(*) FROM log_bentrok')).toBe(1)
  })

  it('kemajuan: pengesahan tidak tertimpa versi diajukan; generus hanya ubah miliknya', () => {
    gabungRekaman(db, 'kemajuan_belajar', [kemajuan()], { sumber: 'perangkat', dariGenerus: true })
    const sah = kemajuan({ status_sah: 'disahkan', disahkan_oleh: 'Ust', versi: 2, diubah_pada: '2026-11-02T00:00:00.000Z' })
    expect(gabungRekaman(db, 'kemajuan_belajar', [sah], { sumber: 'admin' }).diperbarui).toBe(1)
    // generus mengirim versi diajukan yang lebih baru → diabaikan
    const telat = kemajuan({ nilai: 50, versi: 2, diubah_pada: '2026-11-05T00:00:00.000Z' })
    expect(gabungRekaman(db, 'kemajuan_belajar', [telat], { sumber: 'perangkat', dariGenerus: true }).diabaikan).toBe(1)
    expect(db.nilai('SELECT status_sah FROM kemajuan_belajar')).toBe('disahkan')
    // disahkan (lebih lama) tetap menang atas diajukan lokal
    gabungRekaman(db, 'kemajuan_belajar', [kemajuan({ id: 'KB2', diubah_pada: '2026-11-09T00:00:00.000Z' })], { sumber: 'perangkat' })
    const sah2 = kemajuan({ id: 'KB2', status_sah: 'ditolak', versi: 2, diubah_pada: '2026-11-03T00:00:00.000Z' })
    expect(gabungRekaman(db, 'kemajuan_belajar', [sah2], { sumber: 'admin' }).diperbarui).toBe(1)
    // generus lain mencoba mengubah rekaman bukan miliknya
    gabungRekaman(db, 'kemajuan_belajar', [kemajuan({ id: 'KB3' })], { sumber: 'perangkat' })
    expect(gabungRekaman(db, 'kemajuan_belajar', [kemajuan({ id: 'KB3', perangkat_id: 'HP-X', nilai: 1, versi: 2 })], { sumber: 'perangkat', dariGenerus: true }).ditolak).toHaveLength(1)
  })

  it('validasi bentuk, periksa wewenang, hapus lunak, gabungSemua', () => {
    const h = gabungRekaman(db, 'presensi', [null, { id: 'X' }, presensi({ id: 5 }), presensi({ versi: 0 }), presensi({ status: { a: 1 } })], { sumber: 'perangkat' })
    expect(h.ditolak).toHaveLength(5)
    const p = gabungRekaman(db, 'presensi', [presensi()], { sumber: 'perangkat', periksa: () => 'dilarang' })
    expect(p.ditolak).toEqual([{ id: 'P1', alasan: 'dilarang' }])
    gabungRekaman(db, 'presensi', [presensi()], { sumber: 'perangkat' })
    gabungRekaman(db, 'presensi', [presensi({ dihapus: true, versi: 2, diubah_pada: '2026-11-04T00:00:00.000Z' })], { sumber: 'perangkat' })
    expect(db.nilai('SELECT dihapus FROM presensi')).toBe(1)
    const s = gabungSemua(db, { presensi: [presensi({ id: 'P9' })], wilayah: [], tidak_ada: [1] } as never, { sumber: 'perangkat' })
    expect(s.total.ditambah).toBe(1)
    expect(Object.keys(s.perTabel)).toEqual(['presensi'])
  })
})
