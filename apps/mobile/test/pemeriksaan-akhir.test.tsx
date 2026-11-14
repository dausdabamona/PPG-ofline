// Fase 4 — reproduksi cacat temuan pemeriksaan akhir APK: spanduk pembekuan pengurus, tombol kembali Android,
// pengingat Setor Belajar di HP bersama, label status token.
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { bekukanPerangkat, buatPaket, terbitkanToken, uraiToken } from '@ppg/core'
import { buatPlatformPalsu } from './platform-palsu'
import { aktifkan, bukaAkun, nav, sambut, siapkanAdmin, tungguTeks, waitFor } from './bantu'

afterEach(() => cleanup())

describe('pemeriksaan akhir APK', () => {
  it('pengurus dibekukan admin: spanduk tidak menyebut "mondok"; tombol kembali menutup halaman lalu memperkecil aplikasi', async () => {
    const admin = await siapkanAdmin()
    const u = userEvent.setup()
    const pf = buatPlatformPalsu()
    const kode = await sambut(u, pf, 'HP Pak RT')
    const token = terbitkanToken(admin.db, admin.kunci, { kodePerangkat: kode, role: 'pengurus', nama: 'Pak Rahmat', wilayahId: admin.k1.id })
    await aktifkan(u, token)
    pf.kirimIntent({ bytes: buatPaket(admin.db, admin.k1.id, admin.kunci).bytes })
    await tungguTeks(/Data dari admin berhasil dibuka/)

    // tombol kembali: di Profil & HP → kembali ke beranda; di beranda → tidak ditangani (aplikasi diperkecil)
    await bukaAkun(u)
    let ditangani = false
    act(() => {
      ditangani = pf.tekanKembali()
    })
    expect(ditangani).toBe(true)
    await screen.findByRole('heading', { name: /Assalamu'alaikum, Pak Rahmat/ })
    act(() => {
      ditangani = pf.tekanKembali()
    })
    expect(ditangani).toBe(false)

    bekukanPerangkat(admin.db, uraiToken(token).payload.token_id)
    pf.kirimIntent({ bytes: buatPaket(admin.db, admin.k1.id, admin.kunci).bytes })
    await waitFor(() => expect(document.querySelector('.spanduk')?.textContent).toMatch(/dibekukan admin/), { timeout: 20000 })
    expect(document.querySelector('.spanduk')?.textContent).not.toMatch(/mondok/i)
  })

  it('daftar token mubaligh memakai label Bahasa Indonesia (bukan kode "aktif"/"dibekukan")', async () => {
    const admin = await siapkanAdmin()
    const u = userEvent.setup()
    const pf = buatPlatformPalsu()
    const kodeM = await sambut(u, pf, 'HP Ust. Hasan')
    const tokenM = terbitkanToken(admin.db, admin.kunci, { kodePerangkat: kodeM, role: 'mubaligh', nama: 'Ust. Hasan', wilayahId: admin.k1.id })
    await aktifkan(u, tokenM)
    pf.kirimIntent({ bytes: buatPaket(admin.db, admin.k1.id, admin.kunci).bytes })
    await tungguTeks(/Data dari admin berhasil dibuka/)
    // terbitkan token generus untuk HP mubaligh sendiri (HP bersama)
    await nav(u, 'Lainnya')
    await u.click(screen.getByRole('button', { name: /^Terbitkan Token/ }))
    await u.selectOptions(await screen.findByLabelText('Generus'), admin.g[0]!.id)
    await u.click(screen.getByLabelText('Kode Perangkat HP tujuan'))
    await u.paste(kodeM)
    await u.click(screen.getByRole('button', { name: 'Terbitkan Token' }))
    await u.click(within(await screen.findByRole('dialog', { name: 'Token untuk Ali' })).getByRole('button', { name: 'Tutup' }))
    const daftar = screen.getByRole('heading', { name: 'Token yang sudah diterbitkan' }).closest('section')!
    await waitFor(() => expect(daftar.textContent).toMatch(/Aktif/))
    expect(daftar.textContent).not.toMatch(/\baktif\b/)
  })
})
