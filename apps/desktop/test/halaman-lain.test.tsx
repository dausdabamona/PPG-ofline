// Uji halaman lain: perangkat (beku/cair/cabut, ganti kunci, serah terima), materi (PDF + berkas materi), pengajian,
// koreksi, siklus generus, pengaturan (sandi, cadangan kunci & database, pulihkan), kunci otomatis.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import {
  aktifkanProfil,
  ambilGenerus,
  ambilMateri,
  bacaHeader,
  bukaDb,
  bukaKunciAdmin,
  buatSetor,
  catatPresensi,
  daftarGenerus,
  daftarKoreksi,
  daftarMateri,
  daftarPengajian,
  daftarPerangkatRinci,
  inisialisasiAdmin,
  inisialisasiPerangkat,
  simpanDb,
  tambahGenerus,
  tambahWilayah,
  tanggalHariIni,
  terapkanPaket,
  buatPaket,
  terbitkanToken,
  imporSetor,
  uraiToken,
} from '@ppg/core'
import { App } from '../src/App'
import { buatPlatformPalsu } from './platform-palsu'

const SANDI = 'sandi-admin-123'
const enc = new TextEncoder()

afterEach(() => cleanup())

async function pilihOpsi(u: UserEvent, labelSelect: string, pola: RegExp, wadah: HTMLElement = document.body) {
  const select = within(wadah).getByLabelText(labelSelect) as HTMLSelectElement
  const opsi = [...select.options].find((o) => pola.test(o.textContent ?? ''))
  if (!opsi) throw new Error(`Opsi ${pola} tidak ada di ${labelSelect}`)
  await u.selectOptions(select, opsi.value)
}

async function buka(u: UserEvent, menu: string) {
  await u.click(within(screen.getByRole('navigation', { name: 'Menu utama' })).getByRole('button', { name: new RegExp(`^.?${menu}$`) }))
  await screen.findByRole('heading', { level: 1, name: menu })
}

/** Database admin siap pakai (dibuat dengan core) + HP mubaligh aktif. */
async function dunia() {
  const db = await bukaDb()
  const kunci = await inisialisasiAdmin(db, { sandi: SANDI, namaOrganisasi: 'PPG Uji' })
  const d = tambahWilayah(db, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
  const ds = tambahWilayah(db, { tingkat: 'desa', nama: 'Klasaman', kode: 'KLS', indukId: d.id })
  const k1 = tambahWilayah(db, { tingkat: 'kelompok', nama: 'Klasaman 1', kode: 'K1', indukId: ds.id })
  const k2 = tambahWilayah(db, { tingkat: 'kelompok', nama: 'Klasaman 2', kode: 'K2', indukId: ds.id })
  const g = tambahGenerus(db, { kelompokId: k1.id, nama: 'Ahmad', jenisKelamin: 'L', tanggalLahir: '2015-01-01', mulai: '2026-01-01' })
  const hp = await bukaDb()
  const { kodePerangkat } = await inisialisasiPerangkat(hp, 'HP Hasan')
  const token = terbitkanToken(db, kunci, { kodePerangkat, role: 'mubaligh', nama: 'Ust. Hasan', wilayahId: k1.id })
  await aktifkanProfil(hp, token)
  terapkanPaket(hp, buatPaket(db, k1.id, kunci).bytes)
  catatPresensi(hp, { kelompokId: k1.id, tanggal: tanggalHariIni(), generusId: g.id, status: 'alpa' })
  imporSetor(db, buatSetor(hp).bytes, kunci)
  return { db, kunci, k1, k2, g, hp }
}

async function masuk(u: UserEvent, bytes: Uint8Array, opsi: { batasDiamMs?: number } = {}) {
  const pf = buatPlatformPalsu(bytes)
  render(<App platform={pf} jedaSimpanMs={5} batasDiamMs={opsi.batasDiamMs} />)
  await u.type(await screen.findByLabelText('Kata sandi admin'), SANDI)
  await u.click(screen.getByRole('button', { name: 'Masuk' }))
  await screen.findByRole('heading', { level: 1, name: 'Beranda' }, { timeout: 20000 })
  return pf
}

describe('halaman lain', () => {
  it('perangkat: bekukan, cairkan, cabut, ganti kunci, serah terima (paksa)', async () => {
    const w = await dunia()
    const u = userEvent.setup()
    const pf = await masuk(u, simpanDb(w.db))
    await buka(u, 'Perangkat & Token')
    const baris = () => screen.getByText('Ust. Hasan').closest('tr')!
    await u.click(within(baris()).getByRole('button', { name: 'Bekukan' }))
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Bekukan' }))
    await within(baris()).findByText('Dibekukan')
    await u.click(within(baris()).getByRole('button', { name: 'Cairkan' }))
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cairkan' }))
    await within(baris()).findByText('Aktif')
    // ganti kunci kelompok
    await pilihOpsi(u, 'Kelompok', /Klasaman 1/)
    await u.click(screen.getByRole('button', { name: 'Ganti kunci kelompok' }))
    await u.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Ganti kunci' }))
    await screen.findByText(/Kunci kelompok diganti ke versi 2/)
    // serah terima tanpa setor akhir → tombol nonaktif sampai "paksa"
    await u.click(screen.getByRole('button', { name: 'Serah terima mubaligh' }))
    const dlg = await screen.findByRole('dialog')
    await pilihOpsi(u, 'Mubaligh lama', /Ust\. Hasan/, dlg)
    await within(dlg).findByText('Belum ada')
    const jalan = within(dlg).getByRole('button', { name: 'Jalankan serah terima' }) as HTMLButtonElement
    expect(jalan.disabled).toBe(true)
    await u.click(within(dlg).getByLabelText(/Paksa tanpa Setor Akhir/))
    await u.click(jalan)
    await screen.findByText(/Serah terima selesai: 1 token dicabut, kunci kelompok versi 3/)
    await within(baris()).findByText('Dicabut')
    await pf.penutup?.()
    const db2 = await bukaDb(pf.db!)
    expect(daftarPerangkatRinci(db2, { role: 'mubaligh' })[0]!.status).toBe('dicabut')
  })

  it('materi: unggah PDF lalu buat berkas materi; pengajian & koreksi', async () => {
    const w = await dunia()
    const u = userEvent.setup()
    const pf = await masuk(u, simpanDb(w.db))
    await buka(u, 'Materi')
    await pilihOpsi(u, 'Kategori materi', /ALM-HFS/)
    const pertama = (await screen.findAllByRole('button', { name: 'Unggah PDF' }))[0]!
    const pdf = enc.encode('%PDF-1.4 contoh')
    pf.antreanBuka.push([{ nama: 'tajwid.pdf', bytes: pdf }])
    await u.click(pertama)
    await screen.findByText('PDF: tajwid.pdf')
    await u.click(screen.getByRole('button', { name: 'Buat Berkas Materi' }))
    await waitFor(() => expect(pf.tersimpan.some((b) => b.nama.startsWith('PPG_MATERI_v'))).toBe(true))
    expect(bacaHeader(pf.tersimpan.find((b) => b.nama.startsWith('PPG_MATERI_v'))!.bytes).jenis).toBe('MATERI')

    // pengajian
    await buka(u, 'Pengajian')
    await screen.findByText('Belum ada jadwal pengajian rutin.')
    await u.click(screen.getByRole('button', { name: '+ Tambah pengajian' }))
    let dlg = await screen.findByRole('dialog')
    await pilihOpsi(u, 'Wilayah', /Klasaman 1/, dlg)
    await u.type(within(dlg).getByLabelText('Nama pengajian'), 'Caberawit Ahad')
    await pilihOpsi(u, 'Hari', /Ahad/, dlg)
    await u.click(within(dlg).getByRole('button', { name: 'Simpan' }))
    await screen.findByText('Caberawit Ahad')

    // koreksi presensi
    await buka(u, 'Koreksi')
    await pilihOpsi(u, 'Kelompok', /Klasaman 1/)
    const sel = await screen.findByText('Alpa')
    await u.click(within(sel.closest('tr')!).getByRole('button', { name: 'Koreksi' }))
    dlg = await screen.findByRole('dialog')
    await u.type(within(dlg).getByLabelText('Catatan koreksi'), 'Ahmad hadir, mohon diperbaiki.')
    await u.click(within(dlg).getByRole('button', { name: 'Simpan koreksi' }))
    await screen.findByText('Ahmad hadir, mohon diperbaiki.')

    await pf.penutup?.()
    const db2 = await bukaDb(pf.db!)
    expect(daftarPengajian(db2).map((p) => p.nama)).toContain('Caberawit Ahad')
    expect(daftarKoreksi(db2)).toHaveLength(1)
    const m = daftarMateri(db2).find((x) => x.lampiran_nama === 'tajwid.pdf')!
    expect(ambilMateri(db2, m.id)!.lampiran_pdf_b64).toBeTruthy()
  })

  it('generus: ubah status mondok lalu pindah kelompok', async () => {
    const w = await dunia()
    const u = userEvent.setup()
    const pf = await masuk(u, simpanDb(w.db))
    await buka(u, 'Generus & Jamaah')
    const baris = () => screen.getByText('Ahmad').closest('tr')!
    await u.click(within(baris()).getByRole('button', { name: 'Status' }))
    let dlg = await screen.findByRole('dialog')
    await pilihOpsi(u, 'Status baru', /Mondok/, dlg)
    await u.click(within(dlg).getByRole('button', { name: 'Simpan status' }))
    await within(baris()).findByText('Mondok')
    await u.click(within(baris()).getByRole('button', { name: 'Pindah' }))
    dlg = await screen.findByRole('dialog')
    await pilihOpsi(u, 'Kelompok tujuan', /Klasaman 2/, dlg)
    await u.click(within(dlg).getByRole('button', { name: 'Pindahkan' }))
    await within(baris()).findByText('Klasaman 2')
    // jamaah
    await u.click(screen.getByRole('tab', { name: 'Jamaah' }))
    await screen.findByText('Belum ada jamaah.')
    await u.click(screen.getByRole('button', { name: '+ Tambah jamaah' }))
    dlg = await screen.findByRole('dialog')
    await pilihOpsi(u, 'Kelompok', /Klasaman 1/, dlg)
    await u.type(within(dlg).getByLabelText('Nama'), 'Pak Umar')
    await u.click(within(dlg).getByRole('button', { name: 'Simpan' }))
    await screen.findByText('Pak Umar')
    await pf.penutup?.()
    const db2 = await bukaDb(pf.db!)
    const g = ambilGenerus(db2, w.g.id)!
    expect(g.status).toBe('mondok')
    expect(g.kelompok_id).toBe(w.k2.id)
  })

  it('pengaturan: ganti sandi, ekspor cadangan kunci & database, lalu pulihkan di instalasi baru', async () => {
    const w = await dunia()
    const u = userEvent.setup()
    const pf = await masuk(u, simpanDb(w.db))
    await buka(u, 'Pengaturan')
    await screen.findByText('/uji/userData')
    // ganti sandi
    await u.type(screen.getByLabelText('Kata sandi lama'), SANDI)
    await u.type(screen.getByLabelText('Kata sandi baru'), 'sandi-baru-456')
    await u.type(screen.getByLabelText('Ulangi kata sandi baru'), 'sandi-baru-456')
    await u.click(screen.getByRole('button', { name: 'Ganti kata sandi' }))
    await screen.findByText('Kata sandi admin diganti.', {}, { timeout: 20000 })
    // ekspor cadangan kunci
    await u.type(screen.getAllByLabelText('Kata sandi cadangan')[0]!, 'cadangan-789')
    await u.type(screen.getByLabelText('Ulangi kata sandi cadangan'), 'cadangan-789')
    await u.click(screen.getByRole('button', { name: 'Ekspor cadangan kunci' }))
    await waitFor(() => expect(pf.tersimpan.some((b) => b.nama.endsWith('.ppgkey'))).toBe(true), { timeout: 20000 })
    // cadangan database
    await u.click(screen.getByRole('button', { name: 'Simpan cadangan database' }))
    await waitFor(() => expect(pf.tersimpan.some((b) => b.nama.endsWith('.db'))).toBe(true))
    const kunciBerkas = pf.tersimpan.find((b) => b.nama.endsWith('.ppgkey'))!
    const dbBerkas = pf.tersimpan.find((b) => b.nama.endsWith('.db'))!
    await pf.penutup?.()
    expect((await bukaKunciAdmin(await bukaDb(pf.db!), 'sandi-baru-456')).orgId).toBe(w.kunci.orgId)
    cleanup()

    // instalasi baru: pulihkan dari cadangan kunci + database
    const pf2 = buatPlatformPalsu()
    render(<App platform={pf2} jedaSimpanMs={5} />)
    await screen.findByText('Pengaturan awal')
    await u.click(screen.getByRole('tab', { name: 'Pulihkan dari cadangan' }))
    pf2.antreanBuka.push([kunciBerkas], [dbBerkas])
    await u.click(screen.getByRole('button', { name: 'Pilih berkas .ppgkey' }))
    await screen.findByText(kunciBerkas.nama)
    await u.click(screen.getByRole('button', { name: 'Pilih berkas .db' }))
    await screen.findByText(dbBerkas.nama)
    await u.type(screen.getByLabelText('Kata sandi cadangan kunci'), 'cadangan-789')
    await u.type(screen.getByLabelText('Kata sandi admin baru (opsional)'), 'sandi-pulih-000')
    await u.click(screen.getByRole('button', { name: 'Pulihkan' }))
    await screen.findByRole('heading', { level: 1, name: 'Beranda' }, { timeout: 30000 })
    await waitFor(() => expect(pf2.db).not.toBeNull())
    const dbPulih = await bukaDb(pf2.db!)
    expect((await bukaKunciAdmin(dbPulih, 'sandi-pulih-000')).orgId).toBe(w.kunci.orgId)
    expect(daftarGenerus(dbPulih).map((g) => g.nama)).toEqual(['Ahmad'])
  })

  it('kunci otomatis setelah tidak aktif', async () => {
    const w = await dunia()
    const u = userEvent.setup()
    await masuk(u, simpanDb(w.db), { batasDiamMs: 150 })
    await screen.findByRole('button', { name: 'Masuk' }, { timeout: 5000 })
    await screen.findByText(/dikunci otomatis/)
  })
})

describe('§16 juknis (Fase 10)', () => {
  it('Evaluasi & Keaktifan: rekap penguasaan per jenjang + ekspor Excel; Materi Evaluasi: target diubah', async () => {
    const w = await dunia()
    const u = userEvent.setup()
    const pf = await masuk(u, simpanDb(w.db))
    // Ahmad lahir 2015 → saran umur Caberawit B (J-T3), ditandai perlu dicek
    await buka(u, 'Generus & Jamaah')
    await screen.findByText('saran umur — cek')
    await buka(u, 'Evaluasi & Keaktifan')
    await pilihOpsi(u, 'Wilayah', /Klasaman 1/)
    await u.click(screen.getByRole('tab', { name: 'Caberawit B' }))
    const tabel = await screen.findByRole('table', { name: 'Rekap penguasaan materi' })
    expect(within(tabel).getByText('Ahmad')).toBeTruthy()
    expect(within(tabel).getAllByRole('columnheader').length).toBe(14 + 3) // No, Nama, 14 materi, TOTAL
    await u.click(screen.getByRole('button', { name: 'Ekspor Excel' }))
    await waitFor(() => expect(pf.tersimpan.some((b) => b.nama.startsWith('Rekap_Penguasaan_') && b.nama.endsWith('.xlsx'))).toBe(true))
    await u.click(screen.getByRole('tab', { name: 'Laporan Bulanan' }))
    await screen.findByRole('table', { name: 'Laporan bulanan' })
    await buka(u, 'Materi Evaluasi')
    await u.click(screen.getByRole('tab', { name: 'Remaja (Generus 2)' }))
    const baris = (await screen.findByText('Keilmuan sesuai GBMTPG')).closest('tr')!
    expect(within(baris).getByText('Belum ditetapkan')).toBeTruthy()
    await u.click(within(baris).getByRole('button', { name: 'Ubah' }))
    const dlg = await screen.findByRole('dialog')
    await u.type(within(dlg).getByLabelText(/Target/), '18')
    await u.click(within(dlg).getByRole('button', { name: 'Simpan' }))
    await waitFor(() => expect(within((screen.getByText('Keilmuan sesuai GBMTPG')).closest('tr')!).getByText(/18 materi/)).toBeTruthy())
  })
})

describe('§17 kepengurusan (Fase 11)', () => {
  it('terbitkan token pengurus daerah berjabatan → Kepengurusan menampilkan jabatan', async () => {
    const w = await dunia()
    const u = userEvent.setup()
    await masuk(u, simpanDb(w.db))
    const hp = await bukaDb()
    const { kodePerangkat } = await inisialisasiPerangkat(hp, 'HP Bendahara')
    await buka(u, 'Perangkat & Token')
    await pilihOpsi(u, 'Untuk', /^Pengurus/)
    await u.click(screen.getByLabelText('Kode Perangkat'))
    await u.paste(kodePerangkat)
    await screen.findByText(/HP: HP Bendahara/)
    await pilihOpsi(u, 'Wilayah tugas', /Sorong/)
    await u.type(screen.getByLabelText('Nama pemegang'), 'Bendahara PPG')
    await u.click(await screen.findByRole('checkbox', { name: 'Bendahara' }))
    await u.click(screen.getByRole('checkbox', { name: 'Bidang Tenaga Pendidik' }))
    await u.click(screen.getByRole('button', { name: 'Terbitkan token' }))
    const dialog = await screen.findByRole('dialog', { name: 'Token untuk Bendahara PPG' })
    const token = (within(dialog).getByTestId('teks-token') as HTMLTextAreaElement).value
    expect(uraiToken(token).payload.jabatan).toEqual(['bendahara', 'tenaga_pendidik'])
    await u.keyboard('{Escape}')
    await buka(u, 'Kepengurusan')
    const tabel = await screen.findByRole('table', { name: 'Pengurus berjabatan' })
    expect(within(tabel).getByText('Bendahara, Bidang Tenaga Pendidik')).toBeTruthy()
  })
})
