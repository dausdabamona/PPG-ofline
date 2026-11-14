// QR berseri benar-benar terbaca jsQR (pemindai yang dipakai APK): setiap bagian token generus asli dirender
// menjadi gambar (±3 px per modul, seperti QR 97 modul pada bingkai kamera 640 px yang diperkecil), didekode, lalu disusun.
import { describe, expect, it } from 'vitest'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { pecahQr, pengumpulQrBaru, tambahBagianQr } from '@ppg/core'

function render(teks: string, px: number): { data: Uint8ClampedArray; w: number } {
  const qr = QRCode.create(teks, { errorCorrectionLevel: 'L' })
  const n = qr.modules.size
  const w = (n + 8) * px
  const data = new Uint8ClampedArray(w * w * 4).fill(255)
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (qr.modules.get(y, x))
        for (let dy = 0; dy < px; dy++)
          for (let dx = 0; dx < px; dx++) {
            const i = (((y + 4) * px + dy) * w + (x + 4) * px + dx) * 4
            data[i] = data[i + 1] = data[i + 2] = 0
          }
  return { data, w }
}

describe('QR berseri terbaca jsQR', () => {
  it('semua bagian token ±3,7 KB terbaca dan tersusun utuh', () => {
    const token = 'PPGT1.' + 'eyJ2IjoxLCJ0b2tlbl9pZCI6IjAxSkFCQyJ9'.repeat(100) + '.Zm9v'
    expect(token.length).toBeGreaterThan(3600)
    const bagian = pecahQr(token)
    expect(bagian.length).toBeGreaterThanOrEqual(4)
    let p = pengumpulQrBaru()
    let hasil: string | undefined
    for (const b of bagian) {
      expect(QRCode.create(b, { errorCorrectionLevel: 'L' }).version).toBeLessThanOrEqual(20)
      const img = render(b, 3)
      const kode = jsQR(img.data, img.w, img.w, { inversionAttempts: 'dontInvert' })
      expect(kode?.data).toBe(b)
      const r = tambahBagianQr(p, kode!.data)
      p = r.pengumpul
      hasil = r.hasil
    }
    expect(hasil).toBe(token)
  })
})
