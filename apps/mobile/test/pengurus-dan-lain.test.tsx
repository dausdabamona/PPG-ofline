// Pengurus: presensi + usulan + setor + rekap; mubaligh: simak langsung, jadwal tambahan, usulan mondok/pindah,
// setor akhir; HP: berkas dari intent WA, berkas rusak, simpan saat latar belakang, cadangkan & pulihkan.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { bacaHeader, buatPaket, bukaDb, daftarProfil, daftarUsulan, imporSetor, jenisCadanganHp, terbitkanToken, type Db } from '@ppg/core'
import { buatPlatformPalsu } from './platform-palsu'
import { aktifkan, bukaAkun, dibagikan, jeda, mulai, nav, sambut, siapkanAdmin, tungguTeks, tutup, waitFor } from './bantu'

afterEach(() => cleanup())

describe('pengurus', () => {
  it('presensi, usulan generus baru, setor data, rekap, berkas lewat intent, cadangan', async () => {
    const admin = await siapkanAdmin()
    const u = userEvent.setup()
    const pf = buatPlatformPalsu()
    const kode = await sambut(u, pf, 'HP Pak RT')
    const token = terbitkanToken(admin.db, admin.kunci, { kodePerangkat: kode, role: 'pengurus', nama: 'Pak Rahmat', wilayahId: admin.k1.id })
    await aktifkan(u, token)
    await screen.findByRole('heading', { name: /Assalamu'alaikum, Pak Rahmat/ })
    await tungguTeks(/Data generus belum ada/)

    // berkas rusak & berkas paket lewat intent ("Buka dengan PPG Sorong" dari WA)
    pf.kirimIntent({ nama: 'acak.ppg', bytes: new Uint8Array([1, 2, 3, 4, 5]) })
    await tungguTeks(/bukan berkas PPG atau rusak/)
    const paket = buatPaket(admin.db, admin.k1.id, admin.kunci)
    pf.kirimIntent({ bytes: paket.bytes })
    await tungguTeks(/Data dari admin berhasil dibuka/)
    await waitFor(() => expect(document.querySelector('.angka strong')?.textContent).toBe('3'))

    // presensi: semua hadir lalu Citra alpa
    await nav(u, 'Presensi')
    await screen.findByRole('heading', { name: '3 generus' })
    await u.selectOptions(screen.getByLabelText('Pertemuan'), within(screen.getByLabelText('Pertemuan')).getByRole('option', { name: /Pengajian Caberawit/ }))
    await u.click(screen.getByRole('button', { name: 'Semua hadir' }))
    await u.click(within(screen.getByRole('radiogroup', { name: 'Kehadiran Citra' })).getByRole('radio', { name: 'Alpa' }))
    await u.click(screen.getByRole('button', { name: 'Simpan presensi (3)' }))
    await tungguTeks(/Presensi 3 generus tersimpan/)
    await waitFor(() => expect(document.querySelector('.indikator-setor')?.textContent).toMatch(/Ada 3 data belum disetor/))

    // usulan generus baru
    await nav(u, 'Data')
    await u.click(screen.getByRole('button', { name: '+ Usulkan generus baru' }))
    const d = await screen.findByRole('dialog', { name: 'Usulkan generus baru' })
    await u.type(within(d).getByLabelText('Nama lengkap'), 'Zahra')
    await u.click(within(d).getByRole('radio', { name: 'Perempuan' }))
    await u.type(within(d).getByLabelText('No. HP orang tua/wali'), '081299998888')
    await u.click(within(d).getByRole('button', { name: 'Simpan usulan' }))
    await tungguTeks(/Usulan tersimpan/)
    await screen.findByText('Menunggu admin')

    // rekap
    await nav(u, 'Rekap')
    await screen.findByRole('heading', { name: 'Per generus' })
    expect(screen.getByText('66.7%')).toBeTruthy() // 2 hadir dari 3 (per kelompok)

    // setor → admin impor
    await nav(u, 'Sinkron')
    await u.click(screen.getByRole('button', { name: 'Setor Data' }))
    await tungguTeks(/Berkas setoran siap/)
    const r = imporSetor(admin.db, dibagikan(pf, 'PPG_SETOR_').bytes, admin.kunci)
    expect(r.perTabel.presensi?.ditambah).toBe(3)
    expect(r.usulanBaru).toBe(1)
    expect(daftarUsulan(admin.db, { status: 'menunggu' })[0]?.data.nama).toBe('Zahra')

    // simpan saat ke latar belakang
    const n = pf.jumlahSimpan
    await u.click(screen.getByRole('button', { name: 'Kirim ulang semua data' }))
    pf.keLatar()
    await waitFor(() => expect(pf.jumlahSimpan).toBeGreaterThan(n))

    // cadangkan data HP (wajib kata sandi, berkas terenkripsi) lalu pulihkan
    await bukaAkun(u)
    await u.click(screen.getByRole('button', { name: 'Cadangkan data HP' }))
    const dlgCad = await screen.findByRole('dialog', { name: 'Buat cadangan data HP' })
    const tBuat = within(dlgCad).getByRole('button', { name: 'Buat cadangan' }) as HTMLButtonElement
    expect(tBuat.disabled).toBe(true)
    await u.type(within(dlgCad).getByLabelText('Kata sandi cadangan'), 'kel-rahmat')
    await u.type(within(dlgCad).getByLabelText('Ulangi kata sandi'), 'kel-rahmaX')
    expect(tBuat.disabled).toBe(true)
    await u.clear(within(dlgCad).getByLabelText('Ulangi kata sandi'))
    await u.type(within(dlgCad).getByLabelText('Ulangi kata sandi'), 'kel-rahmat')
    await u.click(tBuat)
    await tungguTeks(/Berkas cadangan siap disimpan/)
    const cad = dibagikan(pf, 'PPG_CADANGAN_HP_')
    expect(cad.nama).toMatch(/\.ppgdb$/)
    expect(jenisCadanganHp(cad.bytes)).toBe('terenkripsi')
    expect(new TextDecoder('latin1').decode(cad.bytes).includes('SQLite format 3')).toBe(false)
    await tutup(pf)

    mulai(pf)
    await screen.findByRole('heading', { name: /Assalamu'alaikum, Pak Rahmat/ }, { timeout: 20000 })
    await bukaAkun(u)
    pf.antreanBuka.push([{ nama: 'bukan.ppgdb', bytes: new Uint8Array([9, 9, 9]) }])
    await u.click(screen.getByRole('button', { name: 'Pulihkan dari cadangan' }))
    await tungguTeks(/bukan cadangan data HP/)
    pf.antreanBuka.push([cad])
    await u.click(screen.getByRole('button', { name: 'Pulihkan dari cadangan' }))
    let dlg = await screen.findByRole('dialog', { name: 'Pulihkan data HP' })
    await u.type(within(dlg).getByLabelText('Kata sandi cadangan'), 'sandi-salah')
    await u.click(within(dlg).getByRole('button', { name: 'Pulihkan' }))
    await tungguTeks(/Kata sandi cadangan salah/)
    dlg = screen.getByRole('dialog', { name: 'Pulihkan data HP' })
    await u.clear(within(dlg).getByLabelText('Kata sandi cadangan'))
    await u.type(within(dlg).getByLabelText('Kata sandi cadangan'), 'kel-rahmat')
    await u.click(within(dlg).getByRole('button', { name: 'Pulihkan' }))
    await tungguTeks(/Data HP berhasil dipulihkan/, 30000)
    await screen.findByRole('heading', { name: /Assalamu'alaikum, Pak Rahmat/ })
    const dbPulih: Db = await bukaDb(pf.db!)
    expect(daftarProfil(dbPulih).map((p) => p.nama)).toEqual(['Pak Rahmat'])
    await jeda()
  })
})

describe('mubaligh — fitur lain', () => {
  it('simak langsung, jadwal tambahan + bagikan, usulan mondok & pindah, setor akhir', async () => {
    const admin = await siapkanAdmin()
    const u = userEvent.setup()
    const pf = buatPlatformPalsu()
    const kode = await sambut(u, pf, 'HP Ust. Umar')
    await aktifkan(u, terbitkanToken(admin.db, admin.kunci, { kodePerangkat: kode, role: 'mubaligh', nama: 'Ust. Umar', wilayahId: admin.k1.id }))
    await nav(u, 'Lainnya')
    await u.click(screen.getByRole('button', { name: /^Buka Berkas/ }))
    pf.antreanBuka.push([{ nama: 'p.ppg', bytes: buatPaket(admin.db, admin.k1.id, admin.kunci).bytes }, admin.materi])
    await u.click(screen.getByRole('button', { name: 'Buka Berkas' }))
    await tungguTeks(/Daftar materi berhasil dibuka/)

    // Simak Langsung untuk Citra
    await nav(u, 'Simak')
    await u.selectOptions(await screen.findByLabelText('Generus'), admin.g[2]!.id)
    const pilihMateri = (await screen.findByLabelText('Materi')) as HTMLSelectElement
    await u.selectOptions(pilihMateri, pilihMateri.options[1]!.value)
    await u.click(screen.getByRole('radio', { name: 'Sudah selesai' }))
    await u.type(screen.getByLabelText('Catatan mubaligh (boleh kosong)'), 'Bagus')
    await u.click(screen.getByRole('button', { name: 'Simpan & sahkan' }))
    await tungguTeks(/tercatat dan disahkan/)

    // Jadwal tambahan + bagikan ke grup WA
    await nav(u, 'Lainnya')
    await u.click(screen.getByRole('button', { name: /^Jadwal Tambahan/ }))
    await u.type(screen.getByLabelText('Judul kegiatan'), "Muroja'ah bersama")
    await u.type(screen.getByLabelText('Jam'), '19:30')
    await u.click(screen.getByRole('button', { name: 'Simpan jadwal' }))
    await tungguTeks(/Jadwal tersimpan/)
    await screen.findByText("Muroja'ah bersama")
    await u.click(screen.getByRole('button', { name: 'Bagikan ke grup WA' }))
    await tungguTeks(/Berkas jadwal siap/)
    const jadwal = dibagikan(pf, 'PPG_JADWAL_')
    expect(bacaHeader(jadwal.bytes).jenis).toBe('JADWAL')

    // Usulan ubah status (mondok) & pindah kelompok (kelompok lain dikenal dari paket)
    await u.click(screen.getByRole('button', { name: 'Kembali' }))
    await nav(u, 'Generus')
    await u.click(await screen.findByRole('button', { name: /Ali/ }))
    await u.click(await screen.findByRole('button', { name: 'Ajukan ubah status (mondok/aktif/…)' }))
    let d = await screen.findByRole('dialog', { name: 'Ubah status: Ali' })
    expect((within(d).getByLabelText('Status baru') as HTMLSelectElement).value).toBe('mondok')
    await u.click(within(d).getByRole('button', { name: 'Simpan usulan' }))
    await tungguTeks(/Usulan tersimpan/)
    await u.click(await screen.findByRole('button', { name: /Budi/ }))
    await u.click(await screen.findByRole('button', { name: 'Ajukan pindah kelompok' }))
    d = await screen.findByRole('dialog', { name: 'Pindah kelompok: Budi' })
    await u.selectOptions(within(d).getByLabelText('Kelompok tujuan'), admin.k2.id)
    await u.click(within(d).getByRole('button', { name: 'Simpan usulan' }))
    await waitFor(() => expect(screen.getAllByText('Menunggu admin')).toHaveLength(2))

    // Setor Akhir
    await nav(u, 'Lainnya')
    await u.click(screen.getByRole('button', { name: /^Setor Data/ }))
    await u.click(screen.getByText('Pilihan lain'))
    await u.click(screen.getByRole('button', { name: 'Setor Akhir' }))
    await u.click(within(await screen.findByRole('dialog', { name: 'Setor Akhir' })).getByRole('button', { name: 'Buat Setor Akhir' }))
    await tungguTeks(/Setor Akhir siap/)
    const r = imporSetor(admin.db, dibagikan(pf, 'PPG_SETOR_').bytes, admin.kunci)
    expect(r.usulanBaru).toBe(2)
    expect(r.perTabel.kemajuan_belajar?.ditambah).toBe(1)
    expect(r.perTabel.jadwal_tambahan?.ditambah).toBe(1)
    await jeda()
  })
})
