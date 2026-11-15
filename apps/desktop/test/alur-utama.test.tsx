// Uji alur utama EXE admin end-to-end lewat UI (jsdom) dengan platform palsu dan HP mubaligh tiruan (@ppg/core):
// pengaturan awal → masuk → wilayah → impor CSV → token dari Kode Perangkat → paket → impor setoran → usulan → paket → rekap.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import ExcelJS from 'exceljs'
import {
  ajukanUsulan,
  aktifkanProfil,
  bukaDb,
  buatSetor,
  catatPresensiMassal,
  daftarGenerus,
  daftarWilayah,
  inisialisasiPerangkat,
  tanggalHariIni,
  terapkanPaket,
} from '@ppg/core'
import { App } from '../src/App'
import { buatPlatformPalsu, type PlatformPalsu } from './platform-palsu'

const SANDI = 'sandi-admin-123'
const enc = new TextEncoder()

afterEach(() => cleanup())

async function pilihOpsi(u: UserEvent, labelSelect: string, pola: RegExp, wadah: HTMLElement = document.body) {
  const select = within(wadah).getByLabelText(labelSelect) as HTMLSelectElement
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

async function pengaturanAwal(u: UserEvent, pf: PlatformPalsu) {
  render(<App platform={pf} jedaSimpanMs={5} />)
  await screen.findByText('Pengaturan awal')
  const nama = screen.getByLabelText('Nama organisasi')
  await u.clear(nama)
  await u.type(nama, 'PPG Sorong Uji')
  await u.type(screen.getByLabelText('Kata sandi admin'), SANDI)
  await u.type(screen.getByLabelText('Ulangi kata sandi'), SANDI)
  await u.click(screen.getByRole('button', { name: 'Buat database admin' }))
  await screen.findByRole('heading', { level: 1, name: 'Beranda' }, { timeout: 30000 })
  await waitFor(() => expect(pf.db).not.toBeNull())
}

describe('alur utama EXE admin', () => {
  it('pengaturan awal → … → rekap & ekspor Excel', async () => {
    const pf = buatPlatformPalsu()
    const u = userEvent.setup()

    // 1. Pengaturan awal
    await pengaturanAwal(u, pf)

    // 2. Tutup & buka lagi → masuk (sandi salah lalu benar)
    await waitFor(() => expect(pf.jumlahSimpanDb).toBeGreaterThan(0))
    await pf.penutup?.()
    cleanup()
    render(<App platform={pf} jedaSimpanMs={5} />)
    await screen.findByRole('button', { name: 'Masuk' })
    expect(screen.getByText('PPG Sorong Uji')).toBeTruthy()
    await u.type(screen.getByLabelText('Kata sandi admin'), 'salah-sandi-999')
    await u.click(screen.getByRole('button', { name: 'Masuk' }))
    await screen.findByText('Kata sandi admin salah.', {}, { timeout: 20000 })
    await u.clear(screen.getByLabelText('Kata sandi admin'))
    await u.type(screen.getByLabelText('Kata sandi admin'), SANDI)
    await u.click(screen.getByRole('button', { name: 'Masuk' }))
    await screen.findByRole('heading', { level: 1, name: 'Beranda' }, { timeout: 20000 })

    // 3. Wilayah: daerah → desa → kelompok
    await buka(u, 'Wilayah')
    await screen.findByText('Belum ada wilayah. Tambahkan daerah terlebih dahulu.')
    await u.click(screen.getByRole('button', { name: '+ Tambah daerah' }))
    let dialog = await screen.findByRole('dialog')
    await u.type(within(dialog).getByLabelText('Nama daerah'), 'Sorong')
    await u.type(within(dialog).getByLabelText('Kode'), 'SRG')
    await u.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    await screen.findByText('Sorong')
    await u.click(screen.getByRole('button', { name: '+ Desa' }))
    dialog = await screen.findByRole('dialog')
    await u.type(within(dialog).getByLabelText('Nama desa'), 'Klasaman')
    await u.type(within(dialog).getByLabelText('Kode'), 'KLS')
    await u.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    await screen.findByText('Klasaman')
    await u.click(screen.getByRole('button', { name: '+ Kelompok' }))
    dialog = await screen.findByRole('dialog')
    await u.type(within(dialog).getByLabelText('Nama kelompok'), 'Klasaman 1')
    await u.type(within(dialog).getByLabelText('Kode'), 'K1')
    await u.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    await screen.findByText('Klasaman 1')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    // 4. Generus: templat CSV + impor CSV (1 baris gagal)
    await buka(u, 'Generus & Jamaah')
    await u.click(screen.getByRole('button', { name: 'Unduh templat CSV' }))
    await waitFor(() => expect(pf.tersimpan.some((b) => b.nama === 'templat-generus.csv')).toBe(true))
    const templat = new TextDecoder().decode(berkasTerakhir(pf, 'templat-generus').bytes)
    expect(templat).toContain('nama,jenis_kelamin,tanggal_lahir,kategori,kelompok_kode,wali_nama,wali_no_hp,mulai')
    const csv = [
      'nama;jenis_kelamin;tanggal_lahir;kategori;kelompok_kode;wali_nama;wali_no_hp',
      'Ahmad;L;2015-03-21;;K1;Pak Fauzi;081234567890',
      'Aisyah;P;21/07/2014;caberawit;K1;Bu Aminah;',
      'Salah;X;2015-01-01;;K1;;',
    ].join('\n')
    pf.antreanBuka.push([{ nama: 'generus.csv', bytes: enc.encode(csv) }])
    await u.click(screen.getByRole('button', { name: 'Impor CSV' }))
    dialog = await screen.findByRole('dialog', { name: /Hasil impor generus\.csv/ })
    expect(within(dialog).getByText('2')).toBeTruthy()
    expect(within(dialog).getByText('Jenis kelamin harus L atau P.')).toBeTruthy()
    await u.click(within(dialog).getByRole('button', { name: 'Tutup' }))
    await screen.findByText('2 generus')
    expect(screen.getByText('Ahmad')).toBeTruthy()
    expect(screen.getByText('Aisyah')).toBeTruthy()

    // 5. Token mubaligh dari Kode Perangkat (HP tiruan dibuat dengan core)
    const hp = await bukaDb()
    const { kodePerangkat } = await inisialisasiPerangkat(hp, 'HP Ust. Hasan')
    await buka(u, 'Perangkat & Token')
    await u.click(screen.getByLabelText('Kode Perangkat'))
    await u.paste(kodePerangkat)
    await screen.findByText(/HP: HP Ust\. Hasan/)
    await pilihOpsi(u, 'Wilayah tugas', /Klasaman 1/)
    await u.type(screen.getByLabelText('Nama pemegang'), 'Ust. Hasan')
    await u.click(screen.getByRole('button', { name: 'Terbitkan token' }))
    dialog = await screen.findByRole('dialog', { name: 'Token untuk Ust. Hasan' })
    const token = (within(dialog).getByTestId('teks-token') as HTMLTextAreaElement).value
    expect(token.startsWith('PPGT1.')).toBe(true)
    await within(dialog).findByRole('img', { name: /^QR token/ }, { timeout: 20000 })
    await u.click(within(dialog).getByRole('button', { name: 'Salin token' }))
    expect(pf.disalin).toContain(token)
    await u.click(within(dialog).getByRole('button', { name: 'Tutup jendela' }))
    await screen.findByText('HP Ust. Hasan')

    // HP mengaktifkan token
    const profil = await aktifkanProfil(hp, token)
    expect(profil.role).toBe('mubaligh')

    // 6. Kirim paket pertama → HP menerapkan
    await buka(u, 'Kirim Paket')
    await pilihOpsi(u, 'Wilayah', /Klasaman 1/)
    await u.click(screen.getByRole('button', { name: 'Buat & simpan paket' }))
    await screen.findByText(/Paket tersimpan/)
    const paket1 = berkasTerakhir(pf, 'PPG_PAKET_')
    terapkanPaket(hp, paket1.bytes)
    const kelompokHp = daftarWilayah(hp, { tingkat: 'kelompok' })[0]!
    const generusHp = daftarGenerus(hp, { kelompokId: kelompokHp.id })
    expect(generusHp.map((g) => g.nama).sort()).toEqual(['Ahmad', 'Aisyah'])

    // HP mencatat presensi + mengajukan generus baru, lalu setor
    const hariIni = tanggalHariIni()
    catatPresensiMassal(hp, {
      kelompokId: kelompokHp.id,
      tanggal: hariIni,
      daftar: generusHp.map((g, i) => ({ generusId: g.id, status: i === 0 ? 'hadir' : 'izin' })),
    })
    ajukanUsulan(hp, { jenis: 'tambah_generus', kelompokId: kelompokHp.id, data: { nama: 'Bilal', jenis_kelamin: 'L', tanggal_lahir: '2016-05-05' } })
    const setor = buatSetor(hp)

    // 7. Impor setoran (satu sah, satu rusak)
    await buka(u, 'Impor Setoran')
    pf.antreanBuka.push([
      { nama: setor.nama, bytes: setor.bytes },
      { nama: 'rusak.ppg', bytes: enc.encode('bukan berkas ppg') },
    ])
    await u.click(screen.getByRole('button', { name: 'Pilih berkas setoran' }))
    await screen.findByRole('heading', { name: 'Ringkasan impor' }, { timeout: 20000 })
    expect(screen.getByText(/1 usulan baru/)).toBeTruthy()
    expect(screen.getAllByText('Gagal').length).toBeGreaterThan(0)
    expect(screen.getAllByText('rusak.ppg').length).toBeGreaterThan(0)
    // riwayat impor
    await waitFor(() => expect(screen.getAllByText(setor.nama).length).toBeGreaterThanOrEqual(2))

    // 8. Usulan → setujui
    await buka(u, 'Usulan')
    await screen.findByText(/Bilal \(L\)/)
    await u.click(screen.getByRole('button', { name: 'Setujui' }))
    await screen.findByText('Tidak ada usulan yang menunggu.')

    // 9. Paket kedua: generus baru tersebar ke HP
    await buka(u, 'Kirim Paket')
    await pilihOpsi(u, 'Wilayah', /Klasaman 1/)
    await u.click(screen.getByRole('button', { name: 'Buat & simpan paket' }))
    await waitFor(() => expect(pf.tersimpan.filter((b) => b.nama.startsWith('PPG_PAKET_')).length).toBe(2))
    terapkanPaket(hp, berkasTerakhir(pf, 'PPG_PAKET_').bytes)
    expect(daftarGenerus(hp, { kelompokId: kelompokHp.id }).map((g) => g.nama)).toContain('Bilal')

    // 10. Rekap & ekspor Excel
    await buka(u, 'Rekap & Laporan')
    await screen.findByText('Pilih wilayah untuk melihat rekap.')
    await pilihOpsi(u, 'Wilayah', /Sorong \(Daerah/)
    await screen.findByRole('heading', { name: 'Presensi per kelompok' })
    const tabelGenerus = screen.getByRole('table', { name: 'Presensi per generus' })
    expect(within(tabelGenerus).getByText('Ahmad')).toBeTruthy()
    expect(within(tabelGenerus).getByText('100%')).toBeTruthy()
    await u.click(screen.getByRole('button', { name: 'Ekspor Excel' }))
    await waitFor(() => expect(pf.tersimpan.some((b) => b.nama.endsWith('.xlsx'))).toBe(true), { timeout: 20000 })
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(berkasTerakhir(pf, 'Rekap_').bytes.buffer as ArrayBuffer)
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Presensi per Kelompok', 'Presensi per Generus', 'Kemajuan', 'Capaian per Wilayah', 'Capaian per Kelas', 'Capaian per Generus'])
    const ws = wb.getWorksheet('Presensi per Kelompok')!
    expect(ws.getRow(4).getCell(1).value).toBe('Klasaman 1')
    expect(ws.getRow(4).getCell(2).value).toBe(1)

    // 11. Beranda: setoran terakhir tercatat, 3 generus aktif
    await buka(u, 'Beranda')
    const kartuAktif = screen.getByText('Generus aktif').parentElement!
    expect(within(kartuAktif).getByText('3')).toBeTruthy()
    expect(screen.queryByText('Belum pernah')).toBeNull()

    // database tersimpan memuat semua perubahan
    await pf.penutup?.()
    const dbTersimpan = await bukaDb(pf.db!)
    expect(daftarGenerus(dbTersimpan).length).toBe(3)
  })
})
