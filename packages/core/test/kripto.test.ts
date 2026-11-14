import { beforeAll, describe, expect, it } from 'vitest'
import {
  buatPasanganKotak,
  buatPasanganTandaTangan,
  bukaSegel,
  dariB64url,
  dariUtf8,
  dekripsiRahasia,
  enkripsiRahasia,
  keB64url,
  keHex,
  keUtf8,
  kunciAcak32,
  periksaTandaTangan,
  samaByte,
  segelKe,
  sha256Hex,
  siapkanKripto,
  tandaTangani,
  turunkanKunciSandi,
} from '../src/index'
import { createHash, pbkdf2Sync } from 'node:crypto'

beforeAll(async () => {
  await siapkanKripto()
  await siapkanKripto() // idempoten
})

describe('kripto', () => {
  it('tanda tangan Ed25519 sah & menolak pesan diubah', () => {
    const k = buatPasanganTandaTangan()
    expect(k.publik.length).toBe(32)
    const pesan = keUtf8('halo PPG')
    const sig = tandaTangani(pesan, k.rahasia)
    expect(sig.length).toBe(64)
    expect(periksaTandaTangan(pesan, sig, k.publik)).toBe(true)
    expect(periksaTandaTangan(keUtf8('halo PPG!'), sig, k.publik)).toBe(false)
    expect(periksaTandaTangan(pesan, sig.subarray(0, 10), k.publik)).toBe(false)
    expect(periksaTandaTangan(pesan, sig, buatPasanganTandaTangan().publik)).toBe(false)
  })

  it('sealed box hanya terbuka oleh pemilik kunci', () => {
    const a = buatPasanganKotak()
    const b = buatPasanganKotak()
    const c = segelKe(a.publik, keUtf8('rahasia'))
    expect(dariUtf8(bukaSegel(c, a))).toBe('rahasia')
    expect(() => bukaSegel(c, b)).toThrow(expect.objectContaining({ kode: 'TIDAK_BISA_DIBUKA' }))
  })

  it('secretbox dengan nonce acak di depan', () => {
    const k = kunciAcak32()
    const c1 = enkripsiRahasia(k, keUtf8('x'))
    const c2 = enkripsiRahasia(k, keUtf8('x'))
    expect(keHex(c1)).not.toBe(keHex(c2))
    expect(dariUtf8(dekripsiRahasia(k, c1))).toBe('x')
    expect(() => dekripsiRahasia(kunciAcak32(), c1)).toThrow(/tidak bisa dibuka/)
    expect(() => dekripsiRahasia(k, new Uint8Array(5))).toThrow(/rusak/)
    expect(() => enkripsiRahasia(new Uint8Array(3), keUtf8('x'))).toThrow(/32 byte/)
    const rusak = c1.slice()
    rusak[rusak.length - 1]! ^= 1
    expect(() => dekripsiRahasia(k, rusak)).toThrow()
  })

  it('PBKDF2-SHA256 sesuai Node crypto', async () => {
    const garam = keUtf8('garam-uji-123456')
    const k = await turunkanKunciSandi('sandi', garam, 1000)
    expect(keHex(k)).toBe(pbkdf2Sync('sandi', Buffer.from(garam), 1000, 32, 'sha256').toString('hex'))
  })

  it('SHA-256 sesuai vektor uji', () => {
    for (const t of ['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'x'.repeat(1000)]) {
      expect(sha256Hex(t)).toBe(createHash('sha256').update(t).digest('hex'))
    }
  })

  it('base64url bolak-balik untuk semua panjang & menerima base64 standar', () => {
    for (let n = 0; n < 40; n++) {
      const b = new Uint8Array(n).map((_, i) => (i * 37 + n) & 255)
      const s = keB64url(b)
      expect(s).toBe(Buffer.from(b).toString('base64url'))
      expect(samaByte(dariB64url(s), b)).toBe(true)
    }
    expect(samaByte(dariB64url('+/8='), new Uint8Array([0xfb, 0xff]))).toBe(true)
    expect(() => dariB64url('a')).toThrow(/base64/)
    expect(() => dariB64url('ab$c')).toThrow(/base64/)
    expect(samaByte(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false)
  })
})
