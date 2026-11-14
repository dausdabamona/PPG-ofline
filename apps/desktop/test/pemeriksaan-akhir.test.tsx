// Fase 4 — reproduksi cacat temuan pemeriksaan akhir EXE: admin lupa kata sandi di laptop yang sama
// (layar Masuk tidak punya jalan pemulihan), dan token panjang tampil sebagai QR berseri.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { bukaDb, bukaKunciAdmin, daftarGenerus, eksporCadanganKunci, inisialisasiAdmin, simpanDb, tambahGenerus, tambahWilayah } from '@ppg/core'
import { App } from '../src/App'
import { QrBerseri } from '../src/komponen/qr'
import { buatPlatformPalsu } from './platform-palsu'

afterEach(() => cleanup())

describe('pemeriksaan akhir EXE', () => {
  it('lupa kata sandi admin: pulihkan dari cadangan kunci (.ppgkey) langsung di layar Masuk, data tetap utuh', async () => {
    const db = await bukaDb()
    const kunci = await inisialisasiAdmin(db, { sandi: 'sandi-lama-123', namaOrganisasi: 'PPG Uji' })
    const d = tambahWilayah(db, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
    const ds = tambahWilayah(db, { tingkat: 'desa', nama: 'Klasaman', kode: 'KLS', indukId: d.id })
    const k = tambahWilayah(db, { tingkat: 'kelompok', nama: 'Klasaman 1', kode: 'K1', indukId: ds.id })
    tambahGenerus(db, { kelompokId: k.id, nama: 'Ahmad', jenisKelamin: 'L', kategori: 'caberawit', mulai: '2026-01-01' })
    const cad = await eksporCadanganKunci(db, kunci, 'cadangan-789')
    const pf = buatPlatformPalsu(simpanDb(db))
    const u = userEvent.setup()
    render(<App platform={pf} jedaSimpanMs={5} />)
    await u.click(await screen.findByRole('button', { name: 'Lupa kata sandi?' }, { timeout: 20000 }))
    pf.antreanBuka.push([cad])
    await u.click(screen.getByRole('button', { name: 'Pilih berkas .ppgkey' }))
    await screen.findByText(cad.nama)
    await u.type(screen.getByLabelText('Kata sandi cadangan kunci'), 'cadangan-789')
    await u.type(screen.getByLabelText('Kata sandi admin baru'), 'sandi-baru-456')
    await u.type(screen.getByLabelText('Ulangi kata sandi admin baru'), 'sandi-baru-456')
    await u.click(screen.getByRole('button', { name: 'Pulihkan & masuk' }))
    await screen.findByRole('heading', { level: 1, name: 'Beranda' }, { timeout: 30000 })
    await waitFor(async () => {
      const d = await bukaDb(pf.db!)
      expect((await bukaKunciAdmin(d, 'sandi-baru-456')).orgId).toBe(kunci.orgId)
    })
    expect(daftarGenerus(await bukaDb(pf.db!)).map((g) => g.nama)).toEqual(['Ahmad'])
  })

  it('QR berseri: teks panjang tampil bagian demi bagian dan berganti otomatis', async () => {
    const u = userEvent.setup()
    const teks = 'PPGT1.' + 'x'.repeat(3700)
    render(<QrBerseri teks={teks} label="QR token" jedaMs={60} />)
    const qr = screen.getByRole('img', { name: /^QR token bagian 1 dari \d+$/ })
    const n = Number(/dari (\d+)$/.exec(qr.getAttribute('aria-label')!)![1])
    expect(n).toBeGreaterThanOrEqual(5)
    await screen.findByRole('img', { name: `QR token bagian 2 dari ${n}` })
    await u.click(screen.getByRole('button', { name: 'Jeda' }))
    const sekarang = screen.getByRole('img', { name: /bagian/ }).getAttribute('aria-label')
    await new Promise((r) => setTimeout(r, 150))
    expect(screen.getByRole('img', { name: /bagian/ }).getAttribute('aria-label')).toBe(sekarang)
    await u.click(screen.getByRole('button', { name: 'Berikutnya ›' }))
    expect(screen.getByRole('img', { name: /bagian/ }).getAttribute('aria-label')).not.toBe(sekarang)
    cleanup()
    render(<QrBerseri teks="PPGD1.pendek" label="QR kode" />)
    expect(within(document.body).getByRole('img', { name: 'QR kode' })).toBeTruthy()
  })
})
