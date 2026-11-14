import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  ambilMateri,
  aturLampiranMateri,
  batalkanJadwalTambahan,
  buatKoreksi,
  catatPresensi,
  catatPresensiMassal,
  daftarBidang,
  daftarJadwalTambahan,
  daftarKategoriMateri,
  daftarMateri,
  daftarPengajian,
  daftarPresensi,
  daftarWilayah,
  dariB64url,
  hapusPengajian,
  hapusWilayah,
  pengajianUntukKelompok,
  seedKurikulum,
  tambahBidang,
  tambahGenerus,
  tambahJadwalTambahan,
  tambahJamaah,
  tambahKategori,
  tambahMateri,
  tambahPengajian,
  tambahWilayah,
  targetMateriBerikutnya,
  ubahGenerus,
  ubahJadwalTambahan,
  ubahJamaah,
  ubahMateri,
  ubahPengajian,
  ubahWilayah,
  wilayahMencakup,
  turunanWilayah,
  leluhurWilayah,
} from '../src/index'
import { buatDunia, lepasJam, pasangJam, type Dunia } from './bantu'

let d: Dunia
beforeAll(async () => {
  pasangJam('2026-11-02T01:00:00.000Z')
  d = await buatDunia()
})
afterAll(() => lepasJam())

describe('repositori', () => {
  it('wilayah: aturan induk, kode unik, ubah, hapus lunak', () => {
    const db = d.admin.db
    expect(() => tambahWilayah(db, { tingkat: 'desa', nama: 'X' })).toThrow(/induk daerah/)
    expect(() => tambahWilayah(db, { tingkat: 'kelompok', nama: 'X', indukId: d.daerah.id })).toThrow(/harus berupa desa/)
    expect(() => tambahWilayah(db, { tingkat: 'daerah', nama: 'X', indukId: d.daerah.id })).toThrow(/tidak memiliki induk/)
    expect(() => tambahWilayah(db, { tingkat: 'kota' as never, nama: 'X' })).toThrow(/Tingkat/)
    expect(() => tambahWilayah(db, { tingkat: 'daerah', nama: ' ' })).toThrow(/Nama/)
    expect(() => tambahWilayah(db, { tingkat: 'kelompok', nama: 'X', kode: 'K1', indukId: d.desa.id })).toThrow(/sudah dipakai/)
    const k = tambahWilayah(db, { tingkat: 'kelompok', nama: 'Baru', indukId: d.desa.id })
    expect(ubahWilayah(db, k.id, { nama: 'Baru 2', kode: 'KB' }).versi).toBe(2)
    expect(() => ubahWilayah(db, 'X', { nama: 'a' })).toThrow(/tidak ditemukan/)
    expect(() => hapusWilayah(db, d.desa.id)).toThrow(/di bawahnya/)
    hapusWilayah(db, k.id)
    expect(daftarWilayah(db, { tingkat: 'kelompok' }).map((w) => w.nama)).toEqual(['Klasaman 1', 'Klasaman 2'])
    expect(daftarWilayah(db, { indukId: d.desa.id, termasukDihapus: true })).toHaveLength(3)
    expect(turunanWilayah(db, d.daerah.id)).toHaveLength(5)
    expect(leluhurWilayah(db, d.k1.id)).toEqual([d.desa.id, d.daerah.id])
    expect(wilayahMencakup(db, d.daerah.id, d.k1.id)).toBe(true)
    expect(wilayahMencakup(db, d.k2.id, d.k1.id)).toBe(false)
  })

  it('generus & jamaah: validasi', () => {
    const db = d.admin.db
    expect(() => tambahGenerus(db, { kelompokId: d.k1.id, nama: '', jenisKelamin: 'L' })).toThrow(/Nama/)
    expect(() => tambahGenerus(db, { kelompokId: d.k1.id, nama: 'A', jenisKelamin: 'X' as never })).toThrow(/Jenis kelamin/)
    expect(() => tambahGenerus(db, { kelompokId: d.desa.id, nama: 'A', jenisKelamin: 'L', kategori: 'paud' })).toThrow(/Kelompok/)
    expect(() => tambahGenerus(db, { kelompokId: d.k1.id, nama: 'A', jenisKelamin: 'L', tanggalLahir: '1/1/2020' })).toThrow(/YYYY-MM-DD/)
    expect(() => tambahGenerus(db, { kelompokId: d.k1.id, nama: 'A', jenisKelamin: 'L', kategori: 'bayi' as never })).toThrow(/tidak dikenal/)
    const g = d.g[0]!
    expect(ubahGenerus(db, g.id, { nama: 'Ali bin Abu', kategori: 'praremaja' }).nama).toBe('Ali bin Abu')
    expect(() => ubahGenerus(db, g.id, { kelompok_id: d.k2.id } as never)).toThrow(/pindah kelompok/)
    expect(() => ubahGenerus(db, g.id, { kategori: 'x' })).toThrow(/Kategori/)
    expect(() => ubahGenerus(db, g.id, { jenis_kelamin: 'x' })).toThrow(/Jenis kelamin/)
    expect(() => ubahGenerus(db, g.id, { tanggal_lahir: 'x' })).toThrow(/Tanggal/)
    expect(() => ubahGenerus(db, 'X', { nama: 'x' })).toThrow(/tidak ditemukan/)
    expect(() => ubahGenerus(d.mubaligh.db, g.id, { nama: 'x' })).toThrow(/usulan/)
    expect(() => tambahJamaah(db, { kelompokId: d.k1.id, nama: '', jenisKelamin: 'L' })).toThrow(/Nama/)
    expect(() => tambahJamaah(db, { kelompokId: d.k1.id, nama: 'A', jenisKelamin: 'Q' as never })).toThrow(/Jenis/)
    const j = tambahJamaah(db, { kelompokId: d.k1.id, nama: 'Pak Umar', jenisKelamin: 'L', noHp: '08123' })
    expect(ubahJamaah(db, j.id, { kelompok_id: d.k2.id }).kelompok_id).toBe(d.k2.id)
  })

  it('pengajian: hari & jam, untuk kelompok mencakup induk', () => {
    const db = d.admin.db
    expect(() => tambahPengajian(db, { wilayahId: d.k1.id, nama: 'A', hari: 7 })).toThrow(/Hari/)
    expect(() => tambahPengajian(db, { wilayahId: d.k1.id, nama: 'A', jam: '25:00' })).toThrow(/Jam/)
    expect(() => tambahPengajian(db, { wilayahId: 'X', nama: 'A' })).toThrow(/Wilayah/)
    expect(() => tambahPengajian(db, { wilayahId: d.k1.id, nama: '' })).toThrow(/Nama/)
    const a = tambahPengajian(db, { wilayahId: d.k1.id, nama: 'Rutin K1', hari: 0, jam: '16:00' })
    tambahPengajian(db, { wilayahId: d.daerah.id, nama: 'Daerah', hari: 6, jam: '08:00' })
    tambahPengajian(db, { wilayahId: d.k2.id, nama: 'Rutin K2' })
    expect(pengajianUntukKelompok(db, d.k1.id).map((p) => p.nama)).toEqual(['Rutin K1', 'Daerah'])
    ubahPengajian(db, a.id, { jam: '17:00' })
    hapusPengajian(db, a.id)
    expect(daftarPengajian(db).map((p) => p.nama)).not.toContain('Rutin K1')
    expect(daftarPengajian(db, [])).toEqual([])
  })

  it('materi: bidang/kategori/materi, lampiran PDF, kategori generus, seed idempoten', () => {
    const db = d.admin.db
    expect(seedKurikulum(db)).toEqual({ bidang: 0, kategori: 0, materi: 0 })
    expect(daftarBidang(db)).toHaveLength(5)
    expect(daftarKategoriMateri(db)).toHaveLength(24)
    const b = tambahBidang(db, { nama: 'Ekstra', urutan: 9 })
    const k = tambahKategori(db, { bidangId: b.id, kode: 'EKS-1', nama: 'Ekstra 1', urutan: 1, tipe: 'checklist' })
    expect(daftarKategoriMateri(db, b.id)).toHaveLength(1)
    expect(() => tambahKategori(db, { bidangId: 'X', kode: 'x', nama: 'x', urutan: 1, tipe: 'level' })).toThrow(/Bidang/)
    expect(() => tambahKategori(db, { bidangId: b.id, kode: 'x', nama: 'x', urutan: 1, tipe: 'lain' as never })).toThrow(/Tipe/)
    expect(() => tambahMateri(db, { kategoriId: 'X', nomor: 1, nama: 'x', tipe: 'level' })).toThrow(/Kategori/)
    const m = tambahMateri(db, { kategoriId: k.id, nomor: 1, nama: 'Khusus remaja', tipe: 'checklist', kategoriGenerus: ['remaja', 'pranikah'], isiTeks: 'Isi' })
    expect(daftarMateri(db, { kategoriId: k.id, kategoriGenerus: 'caberawit' })).toHaveLength(0)
    expect(daftarMateri(db, { kategoriId: k.id, kategoriGenerus: 'remaja' })).toHaveLength(1)
    const pdf = new Uint8Array([37, 80, 68, 70])
    aturLampiranMateri(db, m.id, { nama: 'a.pdf', bytes: pdf })
    expect(dariB64url(ambilMateri(db, m.id)!.lampiran_pdf_b64!)).toEqual(pdf)
    expect(daftarMateri(db, { kategoriId: k.id })[0]!.lampiran_pdf_b64).toBeNull()
    expect(daftarMateri(db, { kategoriId: k.id, denganLampiran: true })[0]!.lampiran_pdf_b64).toBeTruthy()
    expect(() => aturLampiranMateri(db, m.id, { nama: 'b.pdf', bytes: new Uint8Array(6 * 1024 * 1024) })).toThrow(/5 MB/)
    aturLampiranMateri(db, m.id, null)
    ubahMateri(db, m.id, { nama: 'Ganti', nomor: 2, tipe: 'level', isiTeks: null, kategoriGenerus: null })
    expect(() => ubahMateri(db, m.id, { tipe: 'x' as never })).toThrow(/Tipe/)
    ubahMateri(db, m.id, { dihapus: true })
    expect(daftarMateri(db, { kategoriId: k.id })).toHaveLength(0)
    expect(targetMateriBerikutnya(db, 'X')).toEqual([])
    expect(targetMateriBerikutnya(db, d.g[1]!.id, 5)).toHaveLength(5)
  })

  it('presensi: upsert per kunci, deduplikasi lintas perangkat, validasi', () => {
    const db = d.mubaligh.db
    const g = d.g[0]!.id
    const a = catatPresensi(db, { kelompokId: d.k1.id, generusId: g, tanggal: '2026-11-01', status: 'hadir' })
    const b = catatPresensi(db, { kelompokId: d.k1.id, generusId: g, tanggal: '2026-11-01', status: 'izin' })
    expect(b.id).toBe(a.id)
    expect(() => catatPresensi(db, { kelompokId: d.k1.id, generusId: g, tanggal: '2026-11-01', status: 'x' as never })).toThrow(/Status/)
    expect(() => catatPresensi(db, { kelompokId: d.k1.id, generusId: g, tanggal: 'x', status: 'hadir' })).toThrow(/Tanggal/)
    expect(() => catatPresensi(db, { kelompokId: d.k1.id, generusId: 'X', tanggal: '2026-11-01', status: 'hadir' })).toThrow(/Generus/)
    expect(() => catatPresensi(db, { kelompokId: d.k2.id, generusId: g, tanggal: '2026-11-01', status: 'hadir' })).toThrow(/berwenang/)
    catatPresensiMassal(db, { kelompokId: d.k1.id, tanggal: '2026-11-02', daftar: d.g.map((x) => ({ generusId: x.id, status: 'hadir' as const })) })
    expect(daftarPresensi(db, { kelompokIds: [d.k1.id], mulai: '2026-11-02', selesai: '2026-11-02' })).toHaveLength(3)
    expect(daftarPresensi(db, { generusIds: [g] })).toHaveLength(2)
    expect(daftarPresensi(db, { kelompokIds: [] })).toEqual([])
  })

  it('jadwal tambahan & koreksi', () => {
    const db = d.mubaligh.db
    expect(() => tambahJadwalTambahan(db, { kelompokId: d.k1.id, tanggal: 'x', judul: 'A' })).toThrow(/Tanggal/)
    expect(() => tambahJadwalTambahan(db, { kelompokId: d.k1.id, tanggal: '2026-11-03', jam: '9', judul: 'A' })).toThrow(/Jam/)
    expect(() => tambahJadwalTambahan(db, { kelompokId: d.k1.id, tanggal: '2026-11-03', judul: '' })).toThrow(/Judul/)
    const j = tambahJadwalTambahan(db, { kelompokId: d.k1.id, tanggal: '2026-11-03', judul: 'Kajian' })
    ubahJadwalTambahan(db, j.id, { judul: 'Kajian Malam', jam: '19:00' })
    expect(() => ubahJadwalTambahan(db, j.id, { tanggal: 'x' })).toThrow(/Tanggal/)
    expect(() => ubahJadwalTambahan(db, 'X', {})).toThrow(/tidak ditemukan/)
    expect(daftarJadwalTambahan(db, d.k1.id, { mulai: '2026-11-01' })[0]!.judul).toBe('Kajian Malam')
    batalkanJadwalTambahan(db, j.id)
    expect(() => batalkanJadwalTambahan(db, 'X')).toThrow(/tidak ditemukan/)
    expect(daftarJadwalTambahan(db, d.k1.id)).toHaveLength(0)
    expect(daftarJadwalTambahan(db, d.k1.id, { termasukBatal: true })).toHaveLength(1)
    const adm = d.admin.db
    const p = catatPresensi(adm, { kelompokId: d.k1.id, generusId: d.g[0]!.id, tanggal: '2026-11-01', status: 'hadir' })
    expect(() => buatKoreksi(adm, { tabel: 'wilayah', rekamanId: d.k1.id, catatan: 'x' })).toThrow(/kegiatan/)
    expect(() => buatKoreksi(adm, { tabel: 'presensi', rekamanId: 'X', catatan: 'x' })).toThrow(/tidak ditemukan/)
    expect(() => buatKoreksi(adm, { tabel: 'presensi', rekamanId: p.id, catatan: ' ' })).toThrow(/catatan/)
    expect(buatKoreksi(adm, { tabel: 'presensi', rekamanId: p.id, catatan: 'cek' }).untuk_perangkat_id).toBe('ADMIN')
  })
})
