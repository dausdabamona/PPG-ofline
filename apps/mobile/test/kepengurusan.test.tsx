// Fase 11 (§17) — APK pengurus berjabatan: menu hanya bidangnya; bendahara mencatat kas; sarpras tidak melihat menu keuangan.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { buatPaket, terbitkanToken, ambilWilayah } from '@ppg/core'
import { buatPlatformPalsu } from './platform-palsu'
import { aktifkan, nav, sambut, siapkanAdmin, tungguTeks } from './bantu'

afterEach(() => cleanup())

describe('APK — pengurus per jabatan (§17)', () => {
  it('bendahara: navigasi Beranda · Bidang · Data · Sinkron, menu Keuangan, catat kas', async () => {
    const w = await siapkanAdmin()
    const daerah = ambilWilayah(w.db, ambilWilayah(w.db, w.k1.induk_id!)!.induk_id!)!
    const u = userEvent.setup()
    const pf = buatPlatformPalsu(null)
    const kode = await sambut(u, pf, 'HP Bendahara')
    await aktifkan(u, terbitkanToken(w.db, w.kunci, { kodePerangkat: kode, role: 'pengurus', nama: 'Bendahara PPG', wilayahId: daerah.id, jabatan: ['bendahara', 'tenaga_pendidik'] }))
    const navBawah = screen.getByRole('navigation', { name: 'Menu utama' })
    expect(within(navBawah).getAllByRole('button').map((b) => b.textContent?.replace(/^\W+/, ''))).toEqual(['Beranda', 'Bidang', 'Data', 'Sinkron'])
    pf.kirimIntent({ bytes: buatPaket(w.db, daerah.id, w.kunci).bytes })
    await tungguTeks(/Data dari admin berhasil dibuka/)
    await nav(u, 'Bidang')
    // §21.1: profil bendahara wajib PIN — menu Bidang terkunci sampai PIN dipasang
    await screen.findByRole('heading', { name: 'Pasang PIN dulu' })
    await u.type(screen.getByLabelText('PIN baru (4 angka)'), '1234')
    await u.type(screen.getByLabelText('Ulangi PIN'), '1234')
    await u.click(screen.getByRole('button', { name: 'Pasang PIN' }))
    await screen.findByRole('heading', { name: 'Bidang' })
    expect(screen.getByText('Bendahara · Daerah Sorong')).toBeTruthy()
    const menu = screen.getAllByRole('button').map((b) => b.textContent ?? '')
    expect(menu.some((t) => /Keuangan/.test(t))).toBe(true)
    expect(menu.some((t) => /Tenaga Pendidik/.test(t))).toBe(true)
    expect(menu.some((t) => /Bimbingan Konseling|Sarana/.test(t))).toBe(false)
    await u.click(screen.getByRole('button', { name: /^.?Keuangan/ }))
    await u.click(await screen.findByRole('button', { name: '+ Buku kas' }))
    const dlg = await screen.findByRole('dialog', { name: 'Buku kas' })
    await u.type(within(dlg).getByLabelText('Jumlah (Rp)'), '700000')
    await u.selectOptions(within(dlg).getByLabelText('Akun'), 'tabungan_desa')
    await u.click(within(dlg).getByRole('button', { name: 'Simpan' }))
    await tungguTeks(/Tersimpan/)
    await tungguTeks(/Saldo:/)
    expect(screen.getByText(/Saldo:/).textContent).toMatch(/700\.000/)
  })

  it('pengurus tanpa jabatan tetap menu lama', async () => {
    const w = await siapkanAdmin()
    const u = userEvent.setup()
    const pf = buatPlatformPalsu(null)
    const kode = await sambut(u, pf, 'HP Pengurus')
    await aktifkan(u, terbitkanToken(w.db, w.kunci, { kodePerangkat: kode, role: 'pengurus', nama: 'Pengurus', wilayahId: w.k1.id }))
    const navBawah = screen.getByRole('navigation', { name: 'Menu utama' })
    expect(within(navBawah).getAllByRole('button').map((b) => b.textContent?.replace(/^\W+/, ''))).toEqual(['Beranda', 'Absen', 'Data', 'Rekap', 'Sinkron'])
  })
})
