// QR berseri benar-benar terbaca jsQR: setiap bagian token generus ±3,7 KB dirender oleh komponen GambarQr
// (SVG, koreksi galat M, zona tenang 4 modul), SVG-nya diubah menjadi gambar ±3 px per modul, didekode, lalu disusun.
import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { cleanup, render } from '@testing-library/react'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { pecahQr, pengumpulQrBaru, tambahBagianQr } from '@ppg/core'
import { GambarQr, MAKS_BAGIAN_QR_HP } from '../src/komponen/qr'

afterEach(() => cleanup())

/** SVG GambarQr → bitmap RGBA (px piksel per modul), termasuk zona tenang dari viewBox. */
function svgKeGambar(svg: SVGSVGElement, px: number): { data: Uint8ClampedArray; w: number } {
  const ukuran = Number(svg.getAttribute('viewBox')!.split(' ')[2])
  const w = ukuran * px
  const data = new Uint8ClampedArray(w * w * 4).fill(255)
  const d = svg.querySelector('path')!.getAttribute('d')!
  for (const m of d.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
    const x = Number(m[1])
    const y = Number(m[2])
    for (let dy = 0; dy < px; dy++)
      for (let dx = 0; dx < px; dx++) {
        const i = ((y * px + dy) * w + x * px + dx) * 4
        data[i] = data[i + 1] = data[i + 2] = 0
      }
  }
  return { data, w }
}

describe('QR berseri terbaca jsQR', () => {
  it('semua bagian token ±3,7 KB (koreksi M, ≤ 97 modul, zona tenang 4) terbaca dan tersusun utuh', () => {
    const token = 'PPGT1.' + 'eyJ2IjoxLCJ0b2tlbl9pZCI6IjAxSkFCQyJ9'.repeat(100) + '.Zm9v'
    expect(token.length).toBeGreaterThan(3600)
    const bagian = pecahQr(token, { maks: MAKS_BAGIAN_QR_HP })
    expect(bagian.length).toBeGreaterThanOrEqual(6)
    let p = pengumpulQrBaru()
    let hasil: string | undefined
    for (const b of bagian) {
      expect(QRCode.create(b, { errorCorrectionLevel: 'M' }).version).toBeLessThanOrEqual(20)
      const { container } = render(createElement(GambarQr, { teks: b, label: 'uji' }))
      const svg = container.querySelector('svg')!
      const modul = Number(svg.getAttribute('data-modul'))
      expect(modul).toBeLessThanOrEqual(97)
      expect(svg.getAttribute('viewBox')).toBe(`0 0 ${modul + 8} ${modul + 8}`) // zona tenang 4 modul tiap sisi
      expect(svg.querySelector('rect')!.getAttribute('fill')).toBe('#ffffff')
      const img = svgKeGambar(svg, 3)
      const kode = jsQR(img.data, img.w, img.w, { inversionAttempts: 'dontInvert' })
      expect(kode?.data).toBe(b)
      const r = tambahBagianQr(p, kode!.data)
      p = r.pengumpul
      hasil = r.hasil
      cleanup()
    }
    expect(hasil).toBe(token)
  })

  it('Kode Perangkat pendek tetap satu QR polos', () => {
    const kode = 'PPGD1.' + 'a'.repeat(300)
    expect(pecahQr(kode, { maks: MAKS_BAGIAN_QR_HP })).toEqual([kode])
  })
})
