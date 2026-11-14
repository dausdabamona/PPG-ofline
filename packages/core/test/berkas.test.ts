import { beforeAll, describe, expect, it } from 'vitest'
import {
  bacaBerkas,
  bacaHeader,
  buatPasanganTandaTangan,
  dekompresJson,
  kemasBerkas,
  kompresJson,
  periksaBerkas,
  siapkanKripto,
  slug,
  type HeaderBerkas,
} from '../src/index'

beforeAll(() => siapkanKripto())

const header: HeaderBerkas = {
  jenis: 'MATERI',
  versi_format: 1,
  org_id: 'ORG',
  pengirim_perangkat_id: 'ADMIN',
  dibuat_pada: '2026-11-01T00:00:00.000Z',
  versi: 3,
}

describe('berkas .ppg', () => {
  it('kemas → baca → periksa tanda tangan', () => {
    const k = buatPasanganTandaTangan()
    const isi = kompresJson({ a: 1, teks: 'é' })
    const bytes = kemasBerkas(header, isi, k.rahasia)
    expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe('PPG1')
    const b = bacaBerkas(bytes)
    expect(b.header).toEqual(header)
    expect(dekompresJson(b.isi)).toEqual({ a: 1, teks: 'é' })
    expect(periksaBerkas(b, k.publik)).toBe(true)
    expect(periksaBerkas(b, buatPasanganTandaTangan().publik)).toBe(false)
    expect(bacaHeader(bytes).versi).toBe(3)
  })

  it('perubahan satu byte membatalkan tanda tangan', () => {
    const k = buatPasanganTandaTangan()
    const bytes = kemasBerkas(header, kompresJson({ x: 1 }), k.rahasia)
    const ubah = bytes.slice()
    ubah[ubah.length - 70]! ^= 1
    expect(periksaBerkas(bacaBerkas(ubah), k.publik)).toBe(false)
  })

  it('menolak berkas bukan PPG / rusak', () => {
    expect(() => bacaBerkas(new Uint8Array(10))).toThrow(/bukan berkas PPG/)
    expect(() => bacaBerkas(new TextEncoder().encode('XXXX' + ' '.repeat(100)))).toThrow(/bukan berkas PPG/)
    const k = buatPasanganTandaTangan()
    const bytes = kemasBerkas(header, new Uint8Array(0), k.rahasia)
    const panjangSalah = bytes.slice()
    new DataView(panjangSalah.buffer).setUint32(4, 99999, false)
    expect(() => bacaBerkas(panjangSalah)).toThrow(/bukan berkas PPG/)
    const jenisSalah = kemasBerkas({ ...header, jenis: 'APA' as never }, new Uint8Array(0), k.rahasia)
    expect(() => bacaBerkas(jenisSalah)).toThrow(/bukan berkas PPG/)
    expect(() => dekompresJson(new Uint8Array([1, 2, 3]))).toThrow(/rusak/)
  })

  it('slug nama berkas', () => {
    expect(slug('Klasaman 1')).toBe('klasaman-1')
    expect(slug('Ëlif & Bä')).toBe('elif-ba')
    expect(slug('!!!')).toBe('tanpa-nama')
  })
})
