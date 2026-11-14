// Fase 4 — QR berseri (token panjang) dan cadangan HP terenkripsi kata sandi.
import { beforeAll, describe, expect, it } from 'vitest'
import {
  AWALAN_QR_SERI,
  MAKS_BAGIAN_QR,
  adalahGalatPpg,
  ambilIdentitas,
  buatCadanganHp,
  bukaCadanganHp,
  bukaDb,
  inisialisasiPerangkat,
  jenisCadanganHp,
  pecahQr,
  pengumpulQrBaru,
  susunQr,
  tambahBagianQr,
  uraiBagianQr,
} from '../src/index'

const TOKEN_PANJANG = 'PPGT1.' + 'aB3-_x'.repeat(620) + '.tandaTangan'

describe('QR berseri', () => {
  it('teks pendek tetap satu QR apa adanya (kompatibel dengan pemindai lama)', () => {
    expect(pecahQr('PPGD1.abc')).toEqual(['PPGD1.abc'])
  })

  it('token ±3,7 KB dipecah menjadi bagian ≤ batas, berformat PPGQ1|id|i/n|potongan', () => {
    const bagian = pecahQr(TOKEN_PANJANG)
    expect(bagian.length).toBeGreaterThan(1)
    const id = uraiBagianQr(bagian[0]!)!.id
    bagian.forEach((b, i) => {
      expect(b.startsWith(AWALAN_QR_SERI)).toBe(true)
      expect(b.length).toBeLessThanOrEqual(MAKS_BAGIAN_QR)
      const u = uraiBagianQr(b)!
      expect(u).toMatchObject({ id, ke: i + 1, dari: bagian.length })
      expect(b).toBe(`PPGQ1|${id}|${i + 1}/${bagian.length}|${u.isi}`)
    })
    // id acak berbeda tiap pemecahan
    expect(uraiBagianQr(pecahQr(TOKEN_PANJANG)[0]!)!.id).not.toBe(id)
  })

  it('susunQr menyusun dari urutan acak & ganda; menolak bila kurang atau campur seri', () => {
    const b = pecahQr(TOKEN_PANJANG)
    expect(susunQr([...b].reverse().concat(b[0]!))).toBe(TOKEN_PANJANG)
    expect(() => susunQr(b.slice(1))).toThrow(/belum lengkap/i)
    const lain = pecahQr(TOKEN_PANJANG)
    expect(() => susunQr([b[0]!, ...lain.slice(1)])).toThrow()
    expect(susunQr(['PPGT1.pendek'])).toBe('PPGT1.pendek')
  })

  it('pengumpul pemindai: hitung "i dari n terbaca", abaikan ganda, mulai ulang bila seri baru', () => {
    const b = pecahQr(TOKEN_PANJANG)
    let p = pengumpulQrBaru()
    let r = tambahBagianQr(p, b[1]!)
    expect(r).toMatchObject({ status: 'bagian', terbaca: 1, total: b.length })
    p = r.pengumpul
    r = tambahBagianQr(p, b[1]!) // QR yang sama terbaca lagi
    expect(r.terbaca).toBe(1)
    p = r.pengumpul
    // seri lain (mubaligh menerbitkan ulang) → mulai dari awal
    const lain = pecahQr(TOKEN_PANJANG)
    r = tambahBagianQr(p, lain[0]!)
    expect(r).toMatchObject({ status: 'bagian', terbaca: 1 })
    p = pengumpulQrBaru()
    for (const x of b) {
      r = tambahBagianQr(p, x)
      p = r.pengumpul
    }
    expect(r.status).toBe('lengkap')
    expect(r.hasil).toBe(TOKEN_PANJANG)
    // QR biasa (bukan seri) langsung selesai
    expect(tambahBagianQr(pengumpulQrBaru(), 'PPGD1.xyz')).toMatchObject({ status: 'tunggal', hasil: 'PPGD1.xyz' })
    // bagian rusak
    expect(tambahBagianQr(pengumpulQrBaru(), 'PPGQ1|zz|9/2|x').status).toBe('bukan')
    expect(uraiBagianQr('PPGQ1|zz|0/2|x')).toBeNull()
  })
})

describe('cadangan HP terenkripsi', () => {
  beforeAll(async () => {
    await bukaDb()
  })

  it('berkas cadangan tidak memuat kunci rahasia polos dan hanya terbuka dengan sandi yang benar', async () => {
    const hp = await bukaDb()
    await inisialisasiPerangkat(hp, 'HP Uji')
    const id = hp.satu<{ sign_rahasia: string; box_rahasia: string }>('SELECT sign_rahasia, box_rahasia FROM identitas_perangkat')!
    expect(id.sign_rahasia.length).toBeGreaterThan(20)
    // pembanding: database polos memang memuat kunci rahasia apa adanya
    expect(new TextDecoder('latin1').decode(hp.ekspor()).includes(id.sign_rahasia)).toBe(true)
    const asli = hp.ekspor()
    const cad = await buatCadanganHp(hp, 'rahasia-kel')
    expect(cad.nama).toMatch(/^PPG_CADANGAN_HP_\d{8}\.ppgdb$/)
    expect(jenisCadanganHp(cad.bytes)).toBe('terenkripsi')
    // bukan berkas SQLite polos & kunci rahasia tidak terbaca
    const teks = new TextDecoder('latin1').decode(cad.bytes)
    expect(teks.includes('SQLite format 3')).toBe(false)
    expect(teks.includes(id.sign_rahasia)).toBe(false)
    expect(teks.includes(id.box_rahasia)).toBe(false)

    await expect(bukaCadanganHp(cad.bytes, 'salah-sandi')).rejects.toSatisfy((e) => adalahGalatPpg(e, 'SANDI_SALAH'))
    const pulih = await bukaCadanganHp(cad.bytes, 'rahasia-kel')
    expect(pulih).toEqual(asli)
    const db2 = await bukaDb(pulih)
    expect(db2.satu<{ sign_rahasia: string }>('SELECT sign_rahasia FROM identitas_perangkat')!.sign_rahasia).toBe(id.sign_rahasia)
    expect(ambilIdentitas(db2).label).toBe('HP Uji')
  })

  it('wajib kata sandi minimal 6 karakter; berkas lain dikenali', async () => {
    const hp = await bukaDb()
    await expect(buatCadanganHp(hp, '')).rejects.toSatisfy((e) => adalahGalatPpg(e, 'SANDI_LEMAH'))
    await expect(buatCadanganHp(hp, '12345')).rejects.toSatisfy((e) => adalahGalatPpg(e, 'SANDI_LEMAH'))
    expect(jenisCadanganHp(hp.ekspor())).toBe('lama')
    expect(jenisCadanganHp(new Uint8Array([1, 2, 3]))).toBe('bukan')
    await expect(bukaCadanganHp(new Uint8Array([1, 2, 3]), 'apa-saja')).rejects.toSatisfy((e) => adalahGalatPpg(e, 'BUKAN_CADANGAN'))
    // cadangan lama (sebelum Fase 4, tidak terenkripsi) tetap bisa dipulihkan
    expect(await bukaCadanganHp(hp.ekspor(), '')).toEqual(hp.ekspor())
    // berkas dipotong → sandi benar pun gagal dengan pesan jelas
    const cad = await buatCadanganHp(hp, 'rahasia-kel')
    await expect(bukaCadanganHp(cad.bytes.slice(0, 40), 'rahasia-kel')).rejects.toThrow()
  })
})

describe('pengingat setor di HP bersama (mubaligh + generus)', () => {
  it('pengingat Setor Belajar dihitung dari setor belajar terakhir, bukan dari Setor Data mubaligh', async () => {
    const { buatDunia, pasangJam, lepasJam } = await import('./bantu')
    const core = await import('../src/index')
    pasangJam('2026-11-02T01:00:00.000Z')
    try {
      const d = await buatDunia()
      const hp = d.mubaligh.db
      // mubaligh menerbitkan token generus untuk anaknya di HP yang sama
      const tg = core.terbitkanTokenGenerus(hp, d.mubaligh.profil.id, {
        kodePerangkat: d.mubaligh.kode,
        role: 'generus',
        generusIds: [d.g[0]!.id],
        nama: 'Ali',
      })
      const pAli = await core.aktifkanProfil(hp, tg)
      core.buatSetor(hp) // Setor Data mubaligh hari ini
      const materi = core.targetMateriBerikutnya(hp, d.g[0]!.id)[0]!
      core.catatKemajuan(hp, pAli.id, { materiId: materi.id, status: 'selesai' })
      const info = core.infoSinkronHp(hp)
      expect(info.belumDisetorBelajar).toBe(1)
      expect(info.hariSejakBelajar).toBeNull()
      expect(info.perluPengingatBelajar).toBe(true)
    } finally {
      lepasJam()
    }
  })
})
