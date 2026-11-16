// Fase 9 — EXE Daerah menerbitkan token "Super Admin HP (pendaftaran seluruh daerah)", membuat paket untuk Super Admin HP,
// mengimpor setoran gabungan Super Admin HP (usulan disetujui otomatis), lalu mencabutnya. Laptop EXE menolak token itu.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import {
  aktifkanExe,
  aktifkanProfil,
  ajukanUsulan,
  ambilGenerus,
  bukaDb,
  buatSetor,
  daftarPerangkat,
  imporSetor,
  inisialisasiAdmin,
  inisialisasiExe,
  inisialisasiPerangkat,
  periksaTokenDb,
  simpanDb,
  tambahWilayah,
  terapkanPaket,
  terbitkanTokenBawah,
} from '@ppg/core'
import { App } from '../src/App'
import { buatPlatformPalsu, type PlatformPalsu } from './platform-palsu'

const SANDI = 'sandi-admin-123'
afterEach(() => cleanup())

async function pilihOpsi(u: UserEvent, labelSelect: string, pola: RegExp) {
  const select = screen.getByLabelText(labelSelect) as HTMLSelectElement
  const opsi = [...select.options].find((o) => pola.test(o.textContent ?? ''))
  if (!opsi) throw new Error(`Opsi ${pola} tidak ada di ${labelSelect}: ${[...select.options].map((o) => o.textContent).join(' | ')}`)
  await u.selectOptions(select, opsi.value)
}

async function buka(u: UserEvent, menu: string) {
  await u.click(within(screen.getByRole('navigation', { name: 'Menu utama' })).getByRole('button', { name: new RegExp(menu) }))
  await screen.findByRole('heading', { level: 1, name: menu })
}

function berkasTerakhir(pf: PlatformPalsu, awalan: string) {
  const b = [...pf.tersimpan].reverse().find((x) => x.nama.startsWith(awalan))
  if (!b) throw new Error(`Belum ada berkas ${awalan}: ${pf.tersimpan.map((x) => x.nama).join(', ')}`)
  return b
}

describe('Fase 9 — Super Admin HP dari EXE Daerah', () => {
  it('terbitkan token Super Admin HP → paket seluruh daerah → impor setoran (usulan otomatis) → cabut', async () => {
    const daerah = await bukaDb()
    const kAdmin = await inisialisasiAdmin(daerah, { sandi: SANDI, namaOrganisasi: 'PPG Sorong' })
    const D = tambahWilayah(daerah, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
    const desa = tambahWilayah(daerah, { tingkat: 'desa', nama: 'Klasaman', kode: 'KLS', indukId: D.id })
    const K1 = tambahWilayah(daerah, { tingkat: 'kelompok', nama: 'Klasaman 1', kode: 'K1', indukId: desa.id })
    const pf = buatPlatformPalsu(simpanDb(daerah))
    const u = userEvent.setup()
    render(<App platform={pf} jedaSimpanMs={5} />)
    await u.type(await screen.findByLabelText('Kata sandi admin', {}, { timeout: 20000 }), SANDI)
    await u.click(screen.getByRole('button', { name: 'Masuk' }))
    await screen.findByRole('navigation', { name: 'Menu utama' }, { timeout: 20000 })

    // HP Super Admin: instalasi terpisah di APK (di uji: core)
    const dbS = await bukaDb()
    const s = await inisialisasiExe(dbS, { sandi: 'sandi-super-1', label: 'HP Pak Fir' })
    await buka(u, 'Perangkat & Token')
    await u.click(screen.getByLabelText('Kode Perangkat'))
    await u.paste(s.kodePerangkat)
    await pilihOpsi(u, 'Untuk', /Super Admin HP \(pendaftaran seluruh daerah\)/)
    await pilihOpsi(u, 'Wilayah tugas', /Sorong/)
    await u.type(screen.getByLabelText('Nama pemegang'), 'Pak Fir')
    await u.click(screen.getByRole('button', { name: 'Terbitkan token' }))
    const modal = await screen.findByRole('dialog', { name: 'Token untuk Pak Fir' })
    const token = (within(modal).getByTestId('teks-token') as HTMLTextAreaElement).value
    await u.click(within(modal).getByRole('button', { name: 'Tutup jendela' }))
    await aktifkanExe(dbS, s.kunci, token, { superHp: true })
    expect(await screen.findAllByText('Super Admin HP')).toBeTruthy()

    // laptop EXE menolak token Super Admin HP
    const dbL = await bukaDb()
    const l = await inisialisasiExe(dbL, { sandi: 'sandi-laptop-1', label: 'Laptop' })
    await expect(aktifkanExe(dbL, l.kunci, token)).rejects.toMatchObject({ kode: 'TOKEN_UNTUK_SUPER_HP' })

    // Kirim Paket → Paket Super Admin HP (seluruh daerah)
    await buka(u, 'Kirim Paket')
    await u.click(screen.getByRole('button', { name: 'Paket Super Admin HP (seluruh daerah)' }))
    await screen.findByText(/disimpan/)
    terapkanPaket(dbS, berkasTerakhir(pf, 'PPG_PAKET_sorong').bytes)

    // Super Admin HP mendaftarkan mubaligh + generus baru lalu setor ke Daerah
    const u1 = ajukanUsulan(dbS, { jenis: 'tambah_generus', kelompokId: K1.id, data: { nama: 'Dewi', jenis_kelamin: 'P', kategori: 'caberawit' } })
    const hpM = await bukaDb()
    const m = await inisialisasiPerangkat(hpM, 'HP Ust. Ali')
    await aktifkanProfil(hpM, terbitkanTokenBawah(dbS, s.kunci, { kodePerangkat: m.kodePerangkat, role: 'mubaligh', nama: 'Ust. Ali', wilayahId: K1.id }))
    const setor = buatSetor(dbS)
    await buka(u, 'Impor Setoran')
    pf.antreanBuka.push([{ nama: setor.nama, bytes: setor.bytes }])
    await u.click(screen.getByRole('button', { name: 'Pilih berkas setoran' }))
    expect(await screen.findByText(/1 usulan disetujui otomatis/, {}, { timeout: 20000 })).toBeTruthy()
    // (daerah memegang db di memori aplikasi; periksa lewat berkas tersimpan)
    await new Promise((r) => setTimeout(r, 50))
    const dbBaru = await bukaDb(pf.db!)
    expect(ambilGenerus(dbBaru, String(JSON.parse(u1.data_json).id))?.nama).toBe('Dewi')
    expect(daftarPerangkat(dbBaru).map((p) => p.nama)).toEqual(expect.arrayContaining(['Pak Fir', 'Ust. Ali']))

    // cabut Super Admin HP di daftar perangkat
    await buka(u, 'Perangkat & Token')
    const baris = (await screen.findAllByText('Pak Fir')).map((x) => x.closest('tr')).find(Boolean)!
    await u.click(within(baris).getByRole('button', { name: 'Cabut' }))
    await u.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cabut' }))
    await screen.findByText(/cabut berhasil/)
    await new Promise((r) => setTimeout(r, 50))
    const dbCabut = await bukaDb(pf.db!)
    expect(periksaTokenDb(dbCabut, token)).toMatchObject({ sah: false, kode: 'DICABUT' })
    // setoran Super Admin HP sesudahnya ditolak daerah
    expect(() => imporSetor(dbCabut, buatSetor(dbS, { semua: true }).bytes, kAdmin)).toThrow(/dicabut/)
  })
})
