// Fase 9 — Super Admin HP di APK: aktivasi (kata sandi → Kode Perangkat → token dari EXE Daerah), paket daerah,
// tambah generus (langsung bisa dipilih untuk token orang tua), terbitkan token orang tua/mubaligh/EXE desa, impor setoran
// mubaligh, Setor ke Daerah (daerah melihat semua & menyetujui generus baru otomatis), kirim paket, perangkat, cadangan,
// kunci otomatis di latar belakang, dan pilihan "Super Admin HP" di layar Pilih Profil.
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  aktifkanExe,
  aktifkanProfil,
  ambilGenerus,
  buatPaket,
  buatSetor,
  bukaDb,
  daftarPerangkat,
  daftarWilayah,
  imporSetor,
  inisialisasiExe,
  inisialisasiPerangkat,
  terapkanPaket,
  terbitkanToken,
} from '@ppg/core'
import { render } from '@testing-library/react'
import { App } from '../src/App'
import { buatPlatformPalsu } from './platform-palsu'
import { dibagikan, jeda, siapkanAdmin, tungguTeks, waitFor } from './bantu'

afterEach(() => cleanup())

const SANDI = 'rahasia-super-1'

async function hpBaru(label: string) {
  const db = await bukaDb()
  const { kodePerangkat, identitas } = await inisialisasiPerangkat(db, label)
  return { db, kode: kodePerangkat, id: identitas.id }
}

describe('Super Admin HP (APK)', () => {
  it('aktivasi → paket → generus baru → token orang tua/mubaligh/EXE desa → impor setoran → Setor ke Daerah → kunci otomatis', async () => {
    const w = await siapkanAdmin()
    const daerahId = daftarWilayah(w.db, { tingkat: 'daerah' })[0]!.id
    const desaId = daftarWilayah(w.db, { tingkat: 'desa' })[0]!.id
    const u = userEvent.setup()
    const pf = buatPlatformPalsu()
    render(<App platform={pf} jedaSimpanMs={5} kunciSuperMs={0} />)

    // layar pertama → Aktifkan sebagai Super Admin HP → kata sandi
    await u.click(await screen.findByRole('button', { name: 'Aktifkan sebagai Super Admin HP' }, { timeout: 30000 }))
    await u.type(await screen.findByLabelText('Nama HP ini'), 'HP Pak Fir')
    await u.type(screen.getByLabelText('Kata sandi Super Admin'), 'pendek')
    expect(screen.getByText('Kata sandi minimal 8 karakter.')).toBeTruthy()
    await u.clear(screen.getByLabelText('Kata sandi Super Admin'))
    await u.type(screen.getByLabelText('Kata sandi Super Admin'), SANDI)
    await u.type(screen.getByLabelText('Ulangi kata sandi'), SANDI)
    await u.click(screen.getByRole('button', { name: 'Buat kunci Super Admin' }))
    const kode = (await screen.findByTestId('kode-perangkat-super', {}, { timeout: 30000 })).textContent ?? ''
    expect(pf.dbSuper).not.toBeNull()
    expect(pf.db).toBeNull() // profil biasa tidak tersentuh

    // EXE Daerah menerbitkan token Super Admin HP; token mubaligh biasa ditolak di sini
    const hpLain = await hpBaru('HP lain')
    const tokSalah = terbitkanToken(w.db, w.kunci, { kodePerangkat: hpLain.kode, role: 'mubaligh', nama: 'X', wilayahId: w.k1.id })
    await u.click(screen.getByRole('button', { name: 'Tempel Token' }))
    await u.click(screen.getByLabelText('Token Super Admin'))
    await u.paste(tokSalah)
    await u.click(screen.getByRole('button', { name: 'Aktifkan Super Admin' }))
    await tungguTeks(/bukan kode Super Admin HP/)
    const tokSuper = terbitkanToken(w.db, w.kunci, { kodePerangkat: kode, role: 'admin', nama: 'Pak Fir', wilayahId: daerahId })
    await u.clear(screen.getByLabelText('Token Super Admin'))
    await u.click(screen.getByLabelText('Token Super Admin'))
    await u.paste(tokSuper)
    await u.click(screen.getByRole('button', { name: 'Aktifkan Super Admin' }))
    const menu = await screen.findByRole('navigation', { name: 'Menu Super Admin' }, { timeout: 20000 })
    expect(within(menu).getAllByRole('button').map((b) => b.textContent?.replace(/^\W+/, ''))).toEqual(['Beranda', 'Daftarkan', 'Data', 'Sinkron', 'Lainnya'])
    await tungguTeks(/Buka/)

    // paket daerah + materi lewat "Buka dengan PPG Sorong"
    pf.kirimIntent({ bytes: buatPaket(w.db, daerahId, w.kunci).bytes })
    await tungguTeks(/Data dari admin berhasil dibuka/)
    pf.kirimIntent(w.materi)
    await tungguTeks(/Daftar materi berhasil dibuka/)

    // Data → Generus → tambah cepat "Dewi" (orang tua Bu Sari)
    await u.click(within(menu).getByRole('button', { name: /Data/ }))
    await u.click(await screen.findByRole('button', { name: /Generus/ }))
    await u.selectOptions(screen.getByLabelText('Kelompok'), w.k1.id)
    await u.click(screen.getByRole('button', { name: '+ Tambah generus' }))
    const dlg = await screen.findByRole('dialog', { name: 'Tambah generus' })
    await u.type(within(dlg).getByLabelText('Nama generus'), 'Dewi')
    await u.click(within(dlg).getByRole('radio', { name: 'Perempuan' }))
    await u.type(within(dlg).getByLabelText('Nama orang tua'), 'Bu Sari')
    await u.type(within(dlg).getByLabelText('No. HP orang tua'), '081299')
    await u.click(within(dlg).getByRole('button', { name: 'Simpan generus' }))
    await tungguTeks(/Dewi ditambahkan/)
    expect(screen.getByText('Dewi')).toBeTruthy()

    // Daftarkan → Orang tua: anak baru langsung bisa dipilih
    const wali = await hpBaru('HP Bu Sari')
    await u.click(within(menu).getByRole('button', { name: /Daftarkan/ }))
    await u.selectOptions(await screen.findByLabelText('Peran'), 'wali')
    await u.selectOptions(screen.getByLabelText('Kelompok'), w.k1.id)
    await u.click(await screen.findByRole('checkbox', { name: /Dewi/ }))
    expect((screen.getByLabelText('Nama orang tua') as HTMLInputElement).value).toBe('Bu Sari')
    await u.click(screen.getByLabelText('Kode Perangkat'))
    await u.paste(wali.kode)
    await u.click(screen.getByRole('button', { name: 'Terbitkan token' }))
    const modal = await screen.findByRole('dialog', { name: 'Token untuk Bu Sari' })
    const tokWali = within(modal).getByTestId('teks-token-super').textContent ?? ''
    await u.click(within(modal).getByRole('button', { name: 'Kirim lewat WA' }))
    expect(pf.teks).toContain(tokWali)
    const pWali = await aktifkanProfil(wali.db, tokWali)
    expect(pWali.role).toBe('wali')
    const idDewi = pWali.generus_ids[0]!
    await u.click(within(modal).getByRole('button', { name: 'Tutup' }))

    // mubaligh K1 (setor ke HP Super Admin ini)
    const mub = await hpBaru('HP Ust. Ali')
    await u.selectOptions(screen.getByLabelText('Peran'), 'mubaligh')
    await u.selectOptions(screen.getByLabelText('Kelompok'), w.k1.id)
    await u.type(screen.getByLabelText('Nama pemegang'), 'Ust. Ali')
    await u.click(screen.getByLabelText('Kode Perangkat'))
    await u.paste(mub.kode)
    await u.click(screen.getByRole('button', { name: 'Terbitkan token' }))
    const m2 = await screen.findByRole('dialog', { name: 'Token untuk Ust. Ali' })
    const tokMub = within(m2).getByTestId('teks-token-super').textContent ?? ''
    await aktifkanProfil(mub.db, tokMub)
    await u.click(within(m2).getByRole('button', { name: 'Tutup' }))

    // EXE desa
    const dbDesa = await bukaDb()
    const ex = await inisialisasiExe(dbDesa, { sandi: SANDI, label: 'Laptop Klasaman' })
    await u.selectOptions(screen.getByLabelText('Peran'), 'exe_desa')
    await u.selectOptions(screen.getByLabelText('Desa'), desaId)
    await u.type(screen.getByLabelText('Nama pemegang'), 'Admin Klasaman')
    await u.click(screen.getByLabelText('Kode Perangkat'))
    await u.paste(ex.kodePerangkat)
    await u.click(screen.getByRole('button', { name: 'Terbitkan token' }))
    const m3 = await screen.findByRole('dialog', { name: 'Token untuk Admin Klasaman' })
    await aktifkanExe(dbDesa, ex.kunci, within(m3).getByTestId('teks-token-super').textContent ?? '')
    await u.click(within(m3).getByRole('button', { name: 'Tutup' }))

    // Sinkron: impor setoran mubaligh, Setor ke Daerah
    await u.click(within(menu).getByRole('button', { name: /Sinkron/ }))
    const s = buatSetor(mub.db)
    pf.antreanBuka.push([{ nama: s.nama, bytes: s.bytes }])
    await u.click(await screen.findByRole('button', { name: 'Buka Paket / Impor Setoran' }))
    await within(await screen.findByRole('list', { name: 'Hasil membuka berkas' })).findByText(/Setoran data/)
    await u.click(screen.getAllByRole('button', { name: 'Setor ke Daerah' })[0]!)
    await jeda(50)
    const setor = dibagikan(pf, 'PPG_SETOR_')
    const r = imporSetor(w.db, setor.bytes, w.kunci)
    expect(r.usulanOtomatis).toBe(1)
    expect(ambilGenerus(w.db, idDewi)).toMatchObject({ nama: 'Dewi', wali_nama: 'Bu Sari', kelompok_id: w.k1.id })
    const nama = daftarPerangkat(w.db).map((p) => p.nama)
    for (const n of ['Pak Fir', 'Bu Sari', 'Ust. Ali', 'Admin Klasaman']) expect(nama).toContain(n)

    // Kirim Paket K1 → HP mubaligh
    await u.selectOptions(screen.getByLabelText('Wilayah paket'), w.k1.id)
    await u.click(screen.getByRole('button', { name: 'Kirim Paket' }))
    await jeda(50)
    expect(terapkanPaket(mub.db, dibagikan(pf, 'PPG_PAKET_').bytes).jenis).toBe('PAKET')

    // Lainnya → Perangkat (terbitan HP ini) → Pengaturan → Cadangkan
    await u.click(within(menu).getByRole('button', { name: /Lainnya/ }))
    await u.click(await screen.findByRole('button', { name: /Perangkat/ }))
    for (const n of ['Bu Sari', 'Ust. Ali', 'Admin Klasaman']) expect(await screen.findByText(n)).toBeTruthy()
    await u.click(screen.getByRole('button', { name: 'Kembali' }))
    await u.click(await screen.findByRole('button', { name: /Pengaturan/ }))
    await u.click(screen.getByRole('button', { name: 'Cadangkan data Super Admin' }))
    await u.type(await screen.findByLabelText('Kata sandi cadangan'), 'cadangan-1')
    await u.click(screen.getByRole('button', { name: 'Buat cadangan' }))
    await waitFor(() => expect(dibagikan(pf, 'PPG_CADANGAN_SUPER_').bytes.length).toBeGreaterThan(100), { timeout: 20000 })

    // kunci otomatis: ke latar belakang lalu kembali (batas uji 0 ms)
    act(() => pf.keLatar())
    act(() => pf.keDepan())
    await tungguTeks(/terkunci otomatis/)
    await u.type(await screen.findByLabelText('Kata sandi Super Admin'), 'salah-sandi')
    await u.click(screen.getByRole('button', { name: 'Buka Super Admin' }))
    await tungguTeks(/Kata sandi salah/)
    await u.type(screen.getByLabelText('Kata sandi Super Admin'), SANDI)
    await u.click(screen.getByRole('button', { name: 'Buka Super Admin' }))
    await screen.findByRole('navigation', { name: 'Menu Super Admin' }, { timeout: 30000 })

    // kembali ke profil biasa → Pilih Profil menampilkan "Super Admin HP"
    await u.click(within(screen.getByRole('navigation', { name: 'Menu Super Admin' })).getByRole('button', { name: /Lainnya/ }))
    await u.click(await screen.findByRole('button', { name: /Kembali ke profil biasa/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Pilih Profil' })).toBeTruthy()
    await u.click(screen.getByRole('button', { name: /Super Admin HP/ }))
    expect(await screen.findByRole('button', { name: 'Buka Super Admin' }, { timeout: 20000 })).toBeTruthy()

  })

  it('token Super Admin HP ditempel di aktivasi profil biasa → diarahkan ke Super Admin HP', async () => {
    const w = await siapkanAdmin()
    const daerahId = daftarWilayah(w.db, { tingkat: 'daerah' })[0]!.id
    const u = userEvent.setup()
    const pf = buatPlatformPalsu()
    render(<App platform={pf} jedaSimpanMs={5} />)
    await u.type(await screen.findByLabelText('Nama HP ini', {}, { timeout: 30000 }), 'HP Uji')
    await u.click(screen.getByRole('button', { name: 'Lanjut' }))
    const kode = (await screen.findByTestId('kode-perangkat', {}, { timeout: 20000 })).textContent ?? ''
    await u.click(screen.getByRole('button', { name: 'Tempel Token' }))
    await u.click(screen.getByLabelText('Token'))
    await u.paste(terbitkanToken(w.db, w.kunci, { kodePerangkat: kode, role: 'admin', nama: 'S', wilayahId: daerahId }))
    await u.click(screen.getByRole('button', { name: 'Aktifkan' }))
    expect(await screen.findByText(/Tekan “Aktifkan sebagai Super Admin HP” di bawah/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Aktifkan sebagai Super Admin HP' })).toBeTruthy()
  })
})
