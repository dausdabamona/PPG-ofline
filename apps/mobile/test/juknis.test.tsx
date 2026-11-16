// Fase 10 (§16) — APK: mubaligh Evaluasi Semester (batas 75 % & target), Keaktifan (catat kegiatan), Laporan Bulanan.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { buatPaket, terbitkanToken, ubahGenerus } from '@ppg/core'
import { buatPlatformPalsu } from './platform-palsu'
import { aktifkan, nav, sambut, siapkanAdmin, tungguTeks, waitFor } from './bantu'

afterEach(() => cleanup())

describe('APK — juknis pembinaan (mubaligh)', () => {
  it('evaluasi semester: nilai praktik > 75 ditolak, 75 diterima; catat keaktifan; laporan bulanan', async () => {
    const w = await siapkanAdmin()
    for (const g of w.g) ubahGenerus(w.db, g.id, { kategori: 'caberawit_c' })
    const u = userEvent.setup()
    const pf = buatPlatformPalsu(null)
    const kode = await sambut(u, pf, 'HP Ust. Hasan')
    await aktifkan(u, terbitkanToken(w.db, w.kunci, { kodePerangkat: kode, role: 'mubaligh', nama: 'Ust. Hasan', wilayahId: w.k1.id }))
    pf.kirimIntent({ bytes: buatPaket(w.db, w.k1.id, w.kunci).bytes })
    await tungguTeks(/Data dari admin berhasil dibuka/)
    pf.kirimIntent(w.materi)
    await tungguTeks(/Daftar materi berhasil dibuka/)

    // --- Evaluasi Semester
    await nav(u, 'Lainnya')
    await u.click(await screen.findByRole('button', { name: /Evaluasi Semester/ }))
    await screen.findByRole('heading', { level: 1, name: 'Evaluasi Semester' })
    const baris = (await screen.findByText('Ali')).closest('li')!
    await u.click(within(baris).getByRole('button'))
    await screen.findByRole('heading', { level: 1, name: 'Ali' })
    const thoharoh = (await screen.findByText(/Praktik Thoharoh/)).closest('li')!
    await u.click(within(thoharoh).getByRole('button', { name: 'Nilai' }))
    let dlg = await screen.findByRole('dialog')
    await u.type(within(dlg).getByLabelText(/Nilai penguji/), '80')
    await u.click(within(dlg).getByRole('button', { name: 'Simpan' }))
    await tungguTeks(/paling tinggi 75%/)
    await u.clear(within(dlg).getByLabelText(/Nilai penguji/))
    await u.type(within(dlg).getByLabelText(/Nilai penguji/), '75')
    await u.click(within(dlg).getByRole('button', { name: 'Simpan' }))
    await tungguTeks(/Nilai tersimpan/)
    // centang butir doa: 2 dari 39
    const doa = (await screen.findByText(/Hafalan Do'a Generus Sorong/)).closest('li')!
    await u.click(within(doa).getByRole('button', { name: 'Nilai' }))
    dlg = await screen.findByRole('dialog')
    await u.click(within(dlg).getByRole('checkbox', { name: /1\. D\. Kebaikan Dunia Akhirot/ }))
    await u.click(within(dlg).getByRole('checkbox', { name: /2\. D\. Untuk kedua Orang Tua/ }))
    await u.click(within(dlg).getByRole('button', { name: 'Simpan' }))
    await tungguTeks(/Nilai tersimpan/)
    expect(screen.getByRole('button', { name: '5,1%' })).toBeTruthy() // 2/39
    expect(screen.getByRole('button', { name: '75%' })).toBeTruthy()

    // --- Keaktifan: catat kegiatan B untuk semua
    await nav(u, 'Lainnya')
    await u.click(await screen.findByRole('button', { name: /^.?Keaktifan/ }))
    await u.click(await screen.findByRole('button', { name: /Catat kegiatan/ }))
    dlg = await screen.findByRole('dialog', { name: 'Catat kegiatan' })
    await u.click(within(dlg).getByRole('button', { name: 'Pilih semua' }))
    await u.click(within(dlg).getByRole('button', { name: 'Simpan (3)' }))
    await tungguTeks(/3 anak tercatat/)

    // --- Laporan Bulanan
    await nav(u, 'Lainnya')
    await u.click(await screen.findByRole('button', { name: /Laporan Bulanan/ }))
    await screen.findByRole('heading', { level: 1, name: 'Laporan Bulanan' })
    await u.click(within(screen.getByRole('radiogroup', { name: 'Musyawaroh 5 Unsur' })).getByRole('radio', { name: 'Terlaksana' }))
    await u.type(screen.getByLabelText('Nama'), 'Bpk. Contoh')
    await u.click(screen.getByRole('button', { name: '+ Tambah ke daftar' }))
    await u.click(screen.getByRole('button', { name: 'Simpan laporan' }))
    await tungguTeks(/Laporan bulan ini tersimpan/)
    expect(screen.getByText(/NUNGGONI \(1\)/)).toBeTruthy()
  })

  it("§19: raport PDF satu anak & semua raport kelas (buka/bagikan), ajukan jilid Iqro' dengan saran jenjang", async () => {
    const w = await siapkanAdmin()
    for (const g of w.g) ubahGenerus(w.db, g.id, { kategori: 'caberawit_b' })
    const u = userEvent.setup()
    const pf = buatPlatformPalsu(null)
    const kode = await sambut(u, pf, 'HP Ust. Hasan')
    await aktifkan(u, terbitkanToken(w.db, w.kunci, { kodePerangkat: kode, role: 'mubaligh', nama: 'Ust. Hasan', wilayahId: w.k1.id }))
    pf.kirimIntent({ bytes: buatPaket(w.db, w.k1.id, w.kunci).bytes })
    await tungguTeks(/Data dari admin berhasil dibuka/)
    pf.kirimIntent(w.materi)
    await tungguTeks(/Daftar materi berhasil dibuka/)
    await nav(u, 'Lainnya')
    await u.click(await screen.findByRole('button', { name: /Evaluasi Semester/ }))
    await screen.findByRole('heading', { level: 1, name: 'Evaluasi Semester' })
    await u.click(await screen.findByRole('button', { name: 'PDF semua raport / Cetak' }))
    await waitFor(() => expect(pf.pdf.some((n) => /^Raport_semua_\d{4}-S[12]\.pdf$/.test(n))).toBe(true))
    await u.click(screen.getAllByRole('button', { name: 'Bagikan PDF (WA)' })[0]!)
    await waitFor(() => expect(pf.dibagikan.some((b) => b.nama.endsWith('.pdf'))).toBe(true))
    const pdf = pf.dibagikan.find((b) => b.nama.endsWith('.pdf'))!
    expect(new TextDecoder().decode(pdf.bytes.slice(0, 8))).toBe('%PDF-1.4')
    // satu anak: Iqro' → Al-Qur'an memunculkan saran Caberawit C
    const baris = (await screen.findByText('Ali')).closest('li')!
    await u.click(within(baris).getByRole('button'))
    await screen.findByRole('heading', { level: 1, name: 'Ali' })
    await u.selectOptions(screen.getByLabelText('Jilid sekarang'), 'alquran')
    expect(screen.getByText(/Saran jenjang: Caberawit C/)).toBeTruthy()
    await u.click(screen.getByRole('button', { name: "Ajukan jilid Iqro'" }))
    await tungguTeks(/Jilid Iqro' diajukan/)
    await u.click(screen.getByRole('button', { name: 'Raport' }))
    const dlg = await screen.findByRole('dialog')
    await u.click(within(dlg).getByRole('button', { name: 'Simpan PDF / Cetak' }))
    await waitFor(() => expect(pf.pdf.some((n) => n.startsWith('Raport_ali_'))).toBe(true))
  })
})
