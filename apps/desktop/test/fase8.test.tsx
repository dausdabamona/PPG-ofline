// Fase 8 — EXE desa membuat Balasan untuk HP murid/orang tua di wilayahnya (UI sungguhan, jsdom); materi ikut paket desa.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  aktifkanExe,
  aktifkanProfil,
  bukaDb,
  buatMateri,
  buatPaket,
  buatSetor,
  daftarMateri,
  imporSetor,
  inisialisasiAdmin,
  inisialisasiExe,
  inisialisasiPerangkat,
  materiPerluDituntaskan,
  simpanDb,
  tambahGenerus,
  tambahWilayah,
  terapkanBalasan,
  terapkanMateri,
  terapkanPaket,
  terbitkanToken,
  terbitkanTokenBawah,
  terbitkanTokenGenerus,
} from '@ppg/core'
import { App } from '../src/App'
import { buatPlatformPalsu } from './platform-palsu'

const SANDI_EXE = 'sandi-exe-123'
afterEach(() => cleanup())

describe('Fase 8 — EXE desa: Kirim Balasan & materi otomatis di paket', () => {
  it('desa membuat balasan untuk HP orang tua; HP menerima; paket desa membawa materi', async () => {
    const daerah = await bukaDb()
    const kAdmin = await inisialisasiAdmin(daerah, { sandi: 'sandi-admin-123', namaOrganisasi: 'PPG Sorong' })
    const D = tambahWilayah(daerah, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
    const desa = tambahWilayah(daerah, { tingkat: 'desa', nama: 'Klasaman', kode: 'KLS', indukId: D.id })
    const K1 = tambahWilayah(daerah, { tingkat: 'kelompok', nama: 'Klasaman 1', kode: 'K1', indukId: desa.id })
    const ali = tambahGenerus(daerah, { kelompokId: K1.id, nama: 'Ali', jenisKelamin: 'L', kategori: 'caberawit', mulai: '2026-10-01' })
    const dbDesa = await bukaDb()
    const { kodePerangkat, kunci } = await inisialisasiExe(dbDesa, { sandi: SANDI_EXE, label: 'Laptop Desa' })
    await aktifkanExe(dbDesa, kunci, terbitkanToken(daerah, kAdmin, { kodePerangkat, role: 'admin', nama: 'Admin Desa', wilayahId: desa.id }))
    terapkanPaket(dbDesa, buatPaket(daerah, desa.id, kAdmin).bytes)
    terapkanMateri(dbDesa, buatMateri(daerah, kAdmin).bytes)
    // HP mubaligh (dari desa) menerbitkan token orang tua, lalu menyetor → desa mengenal HP orang tua
    const hpM = await bukaDb()
    const m = await inisialisasiPerangkat(hpM, 'HP Mubaligh')
    const pm = await aktifkanProfil(hpM, terbitkanTokenBawah(dbDesa, kunci, { kodePerangkat: m.kodePerangkat, role: 'mubaligh', nama: 'Ust. A', wilayahId: K1.id }))
    const paket = buatPaket(dbDesa, K1.id, kunci)
    expect(terapkanPaket(hpM, paket.bytes).materiDiterapkan).toBeGreaterThan(0)
    expect(daftarMateri(hpM).length).toBeGreaterThan(0)
    const hpW = await bukaDb()
    const w = await inisialisasiPerangkat(hpW, 'HP Ayah Ali')
    await aktifkanProfil(hpW, terbitkanTokenGenerus(hpM, pm.id, { kodePerangkat: w.kodePerangkat, role: 'wali', generusIds: [ali.id], nama: 'Ayah Ali' }))
    imporSetor(dbDesa, buatSetor(hpM).bytes, kunci)

    const pf = buatPlatformPalsu(simpanDb(dbDesa))
    const u = userEvent.setup()
    render(<App platform={pf} jedaSimpanMs={5} />)
    await u.type(await screen.findByLabelText('Kata sandi aplikasi', {}, { timeout: 20000 }), SANDI_EXE)
    await u.click(screen.getByRole('button', { name: 'Masuk' }))
    const nav = await screen.findByRole('navigation', { name: 'Menu utama' }, { timeout: 20000 })
    await u.click(within(nav).getByRole('button', { name: /Kirim Balasan$/ }))
    await screen.findByRole('heading', { level: 1, name: 'Kirim Balasan' })
    expect(screen.getByText('Ayah Ali (Orang tua)')).toBeTruthy()
    await u.click(screen.getByRole('button', { name: 'Buat Balasan' }))
    await screen.findByText(/Berkas terakhir disimpan/)
    const b = pf.tersimpan.find((x) => x.nama.startsWith('PPG_BALASAN_'))!
    expect(b).toBeTruthy()
    terapkanMateri(hpW, buatMateri(daerah, kAdmin).bytes)
    const r = terapkanBalasan(hpW, b.bytes)
    expect(r.jenis).toBe('BALASAN')
    expect(materiPerluDituntaskan(hpW, ali.id)).toBeTruthy()
  })
})
