// Fase 12 (§18) — APK: Sekretaris menulis notulen berbutir keputusan (bertaut kebijakan); Ketua mengesahkan; HP jabatan
// Bidang Kurikulum menetapkan butir "Perlu Ditetapkan Kurikulum" (diajukan ke daerah).
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ambilWilayah, buatPaket, terbitkanToken } from '@ppg/core'
import { buatPlatformPalsu } from './platform-palsu'
import { aktifkan, nav, sambut, siapkanAdmin, tungguTeks } from './bantu'

afterEach(() => cleanup())

describe('APK — musyawarah & penetapan kurikulum (§18)', () => {
  it('sekretaris: menu Musyawarah & Kebijakan → tulis notulen dengan butir kebijakan', async () => {
    const w = await siapkanAdmin()
    const daerah = ambilWilayah(w.db, ambilWilayah(w.db, w.k1.induk_id!)!.induk_id!)!
    const u = userEvent.setup()
    const pf = buatPlatformPalsu(null)
    const kode = await sambut(u, pf, 'HP Sekretaris')
    await aktifkan(u, terbitkanToken(w.db, w.kunci, { kodePerangkat: kode, role: 'pengurus', nama: 'Sekretaris PPG', wilayahId: daerah.id, jabatan: ['sekretaris'] }))
    pf.kirimIntent({ bytes: buatPaket(w.db, daerah.id, w.kunci).bytes })
    await tungguTeks(/Data dari admin berhasil dibuka/)
    expect(await screen.findByText('Musyawarah & kebijakan')).toBeTruthy()
    await nav(u, 'Bidang')
    await u.click(screen.getByRole('button', { name: /Musyawarah & Kebijakan/ }))
    expect(await screen.findByText('Agenda berikutnya & undangan')).toBeTruthy()
    expect(screen.getByText(/Penetapan Hak baca data keuangan/)).toBeTruthy()
    await u.click(screen.getByRole('button', { name: '+ Tulis notulen' }))
    const dlg = await screen.findByRole('dialog', { name: 'Tulis notulen' })
    await u.type(within(dlg).getByLabelText('Peserta'), 'Pengurus PPG Daerah')
    await u.click(within(dlg).getByRole('button', { name: '+ Butir keputusan' }))
    await u.type(within(dlg).getByLabelText('Keputusan 1'), 'Juara reward 5 santri')
    await u.selectOptions(within(dlg).getByLabelText('Mengubah kebijakan'), 'reward_juara')
    const santri = within(dlg).getByLabelText('Santri terbaik per jenjang')
    await u.clear(santri)
    await u.type(santri, '5')
    await u.click(within(dlg).getByRole('button', { name: 'Simpan notulen' }))
    await tungguTeks(/Notulen tersimpan/)
    expect(screen.getAllByText(/Menunggu pengesahan Ketua/).length).toBeGreaterThan(0)
  })

  it('HP Bidang Kurikulum: Perlu Ditetapkan Kurikulum → tetapkan rumus TOTAL (diajukan ke daerah)', async () => {
    const w = await siapkanAdmin()
    const daerah = ambilWilayah(w.db, ambilWilayah(w.db, w.k1.induk_id!)!.induk_id!)!
    const u = userEvent.setup()
    const pf = buatPlatformPalsu(null)
    const kode = await sambut(u, pf, 'HP Kurikulum')
    await aktifkan(u, terbitkanToken(w.db, w.kunci, { kodePerangkat: kode, role: 'pengurus', nama: 'Kurikulum PPG', wilayahId: daerah.id, jabatan: ['kurikulum'] }))
    pf.kirimIntent({ bytes: buatPaket(w.db, daerah.id, w.kunci).bytes })
    await tungguTeks(/Data dari admin berhasil dibuka/)
    await nav(u, 'Bidang')
    await u.click(screen.getByRole('button', { name: /Perlu Ditetapkan Kurikulum/ }))
    expect(await screen.findByText(/K12 Halaman terakhir kitab hadits/)).toBeTruthy()
    const baris = screen.getByText(/K09 Rumus TOTAL/).closest('li')!
    await u.click(within(baris).getByRole('button', { name: 'Tetapkan' }))
    const dlg = await screen.findByRole('dialog', { name: /K09/ })
    await u.selectOptions(within(dlg).getByLabelText('Pilihan'), 'tanpa_keaktifan')
    await u.click(within(dlg).getByRole('button', { name: 'Simpan & tetapkan' }))
    await tungguTeks(/Penetapan diajukan/)
    expect(await screen.findByText('Diajukan ke Daerah')).toBeTruthy()
  })
})
