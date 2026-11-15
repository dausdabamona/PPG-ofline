// Alur utama APK lewat UI (jsdom) dengan platform palsu; admin disimulasikan dengan @ppg/core.
// Aktivasi mubaligh → paket & materi → terbitkan token 2 generus di satu HP (multi-profil, PIN) + wali →
// setor data → balasan → generus catat & setor belajar → mubaligh impor, sahkan/tolak → laporan WA → balasan →
// wali melihat laporan pekanan → generus dibekukan (mondok) → spanduk.
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { bacaKodePerangkat, buatPaket, pecahQr, imporSetor, tanggalHariIni, targetMateriBerikutnya, terbitkanToken, ubahStatus } from '@ppg/core'
import { buatPlatformPalsu } from './platform-palsu'
import { aktifkan, balasanUntuk, bukaAkun, dibagikan, jeda, mulai, nav, sambut, siapkanAdmin, tungguTeks, tutup, waitFor } from './bantu'

afterEach(() => cleanup())

describe('alur mubaligh – generus – wali', () => {
  it('dari aktivasi sampai spanduk mondok', async () => {
    const admin = await siapkanAdmin()
    const [ali, budi] = admin.g as [(typeof admin.g)[0], (typeof admin.g)[0]]
    const u = userEvent.setup()

    // --- HP generus (kakak-adik) & HP wali: buat Kode Perangkat
    const pfG = buatPlatformPalsu()
    const kodeG = await sambut(u, pfG, 'HP Keluarga Fauzi')
    await tutup(pfG)
    const pfW = buatPlatformPalsu()
    const kodeW = await sambut(u, pfW, 'HP Pak Fauzi')
    await tutup(pfW)

    // --- 1. Mubaligh: aktivasi dari token admin
    const pfM = buatPlatformPalsu()
    const kodeM = await sambut(u, pfM, 'HP Ust. Hasan')
    await u.click(screen.getByRole('button', { name: 'Kirim lewat WA' }))
    expect(pfM.teks).toContain(kodeM)
    const tokenM = terbitkanToken(admin.db, admin.kunci, { kodePerangkat: kodeM, role: 'mubaligh', nama: 'Ust. Hasan', wilayahId: admin.k1.id })
    await aktifkan(u, tokenM)
    await screen.findByText(/Assalamu'alaikum, Ust\. Hasan/)

    // paket + materi dari admin lewat Lainnya → Buka Berkas
    const paket = buatPaket(admin.db, admin.k1.id, admin.kunci)
    await nav(u, 'Lainnya')
    await u.click(screen.getByRole('button', { name: /^Buka Berkas/ }))
    pfM.antreanBuka.push([{ nama: paket.nama, bytes: paket.bytes }, admin.materi])
    await u.click(screen.getByRole('button', { name: 'Buka Berkas' }))
    await tungguTeks(/Data dari admin berhasil dibuka/)
    await tungguTeks(/Daftar materi berhasil dibuka/)

    // --- 2. Terbitkan token generus (Ali, Budi di satu HP) + wali
    await u.click(screen.getByRole('button', { name: 'Kembali' }))
    await u.click(screen.getByRole('button', { name: /^Terbitkan Token/ }))
    const terbitGenerus = async (id: string, nama: string) => {
      await u.selectOptions(await screen.findByLabelText('Generus'), id)
      expect((screen.getByLabelText('Nama pemegang token') as HTMLInputElement).value).toBe(nama)
      await u.click(screen.getByLabelText('Kode Perangkat HP tujuan'))
      await u.paste(kodeG)
      await u.click(screen.getByRole('button', { name: 'Terbitkan Token' }))
      const dialog = await screen.findByRole('dialog', { name: `Token untuk ${nama}` })
      const token = within(dialog).getByTestId('token-hasil').textContent ?? ''
      expect(token.startsWith('PPGT1.')).toBe(true)
      // token ±3,7 KB → QR berseri: bagian 1 dari n, tombol Berikutnya/Sebelumnya, berganti otomatis
      const qr1 = within(dialog).getByRole('img', { name: /^QR token bagian 1 dari \d+$/ })
      const n = Number(/dari (\d+)$/.exec(qr1.getAttribute('aria-label') ?? '')![1])
      expect(n).toBeGreaterThanOrEqual(2)
      await u.click(within(dialog).getByRole('button', { name: 'Berikutnya ›' }))
      expect(within(dialog).getByRole('img', { name: `QR token bagian 2 dari ${n}` })).toBeTruthy()
      await u.click(within(dialog).getByRole('button', { name: '‹ Sebelumnya' }))
      expect(within(dialog).getByRole('img', { name: `QR token bagian 1 dari ${n}` })).toBeTruthy()
      await waitFor(() => expect(within(dialog).getByRole('img', { name: `QR token bagian 2 dari ${n}` })).toBeTruthy(), { timeout: 4000 })
      await u.click(within(dialog).getByRole('button', { name: 'Kirim lewat WA' }))
      expect(pfM.teks.at(-1)).toBe(token)
      // tombol kembali Android menutup jendela token (aplikasi tidak keluar)
      let ditangani = false
      act(() => {
        ditangani = pfM.tekanKembali()
      })
      expect(ditangani).toBe(true)
      await waitFor(() => expect(screen.queryByRole('dialog', { name: `Token untuk ${nama}` })).toBeNull())
      return token
    }
    const tokenAli = await terbitGenerus(ali.id, 'Ali')
    const tokenBudi = await terbitGenerus(budi.id, 'Budi')
    await u.click(screen.getByRole('radio', { name: 'Orang tua (wali)' }))
    await u.click(screen.getByRole('checkbox', { name: 'Ali' }))
    await u.click(screen.getByRole('checkbox', { name: 'Budi' }))
    expect((screen.getByLabelText('Nama pemegang token') as HTMLInputElement).value).toBe('Pak Fauzi')
    await u.click(screen.getByLabelText('Kode Perangkat HP tujuan'))
    await u.paste(kodeW)
    await u.click(screen.getByRole('button', { name: 'Terbitkan Token' }))
    const dialogW = await screen.findByRole('dialog', { name: 'Token untuk Pak Fauzi' })
    const tokenWali = within(dialogW).getByTestId('token-hasil').textContent ?? ''
    await u.click(within(dialogW).getByRole('button', { name: 'Tutup' }))
    expect(screen.getAllByText(/HP Keluarga Fauzi/).length).toBeGreaterThanOrEqual(2)

    // --- 3. Setor Data ke admin (melaporkan token) + Kirim Balasan ke semua HP
    await u.click(screen.getByRole('button', { name: 'Kembali' }))
    await u.click(screen.getByRole('button', { name: /^Setor ke Daerah/ }))
    await u.click(screen.getByRole('button', { name: 'Setor ke Daerah' }))
    await tungguTeks(/Berkas setoran siap/)
    const setor1 = imporSetor(admin.db, dibagikan(pfM, 'PPG_SETOR_').bytes, admin.kunci)
    expect(setor1.tokenDilaporkan).toBe(3)
    await u.click(screen.getByRole('button', { name: 'Kembali' }))
    await u.click(screen.getByRole('button', { name: /^Kirim Balasan/ }))
    await u.click(await screen.findByRole('button', { name: 'Kirim Balasan ke semua (2 HP)' }))
    await tungguTeks(/2 berkas balasan siap dikirim/)
    const idG = bacaKodePerangkat(kodeG).perangkat_id
    const idW = bacaKodePerangkat(kodeW).perangkat_id
    const balasanG1 = balasanUntuk(pfM.dibagikan, idG)
    const balasanW0 = balasanUntuk(pfM.dibagikan, idW)
    await tutup(pfM)

    // --- 4. HP generus: dua profil (Ali ber-PIN), buka balasan + materi, catat, setor belajar
    mulai(pfG)
    await aktifkan(u, tokenAli, '1234')
    await bukaAkun(u)
    await u.click(screen.getByRole('button', { name: '+ Tambah Profil' }))
    await screen.findByRole('heading', { name: 'Tambah Profil' })
    // Budi: "Pindai QR Token" — kamera tidak ada di uji, jadi bagian QR berseri ditempel satu per satu
    await u.click(await screen.findByRole('button', { name: 'Pindai QR Token' }))
    await tungguTeks(/Kamera tidak bisa dipakai/)
    const bagianBudi = pecahQr(tokenBudi)
    expect(bagianBudi.length).toBeGreaterThanOrEqual(2)
    for (const [i, b] of bagianBudi.entries()) {
      await u.click(screen.getByLabelText('Atau tempel token di sini'))
      await u.paste(b)
      await u.click(screen.getByRole('button', { name: 'Pakai teks ini' }))
      if (i < bagianBudi.length - 1) await tungguTeks(new RegExp(`${i + 1} dari ${bagianBudi.length}`))
    }
    expect((await screen.findByLabelText('Token') as HTMLTextAreaElement).value).toBe(tokenBudi)
    await u.click(screen.getByRole('button', { name: 'Aktifkan' }))
    await screen.findByRole('navigation', { name: 'Menu utama' }, { timeout: 20000 })
    expect(screen.getByRole('button', { name: 'Profil: Budi' })).toBeTruthy()
    await nav(u, 'Setor')
    pfG.antreanBuka.push([balasanG1, admin.materi])
    await u.click(screen.getByRole('button', { name: 'Buka Berkas' }))
    await tungguTeks(/Balasan dari mubaligh berhasil dibuka/)
    await nav(u, 'Materiku')
    await tungguTeks(/dari \d+ materi selesai/)
    expect(screen.getByText('★ Target berikutnya')).toBeTruthy()
    // buka bacaan materi pertama target → catat dari rincian
    const targetBudi = targetMateriBerikutnya(admin.db, budi.id, 3)
    await nav(u, 'Catat')
    expect((screen.getByLabelText('Materi') as HTMLSelectElement).value).toBe(targetBudi[0]!.id)
    await u.click(screen.getByRole('button', { name: 'Simpan catatan' }))
    await tungguTeks(/Catatan tersimpan/)
    // ganti ke Ali (PIN)
    await bukaAkun(u)
    await u.click(screen.getByRole('button', { name: 'Ganti profil' }))
    await u.click(await screen.findByRole('button', { name: /Ali/ }))
    const dialogPin = await screen.findByRole('dialog', { name: 'PIN Ali' })
    await u.type(within(dialogPin).getByLabelText('PIN'), '9999')
    await u.click(within(dialogPin).getByRole('button', { name: 'Masuk' }))
    await tungguTeks(/PIN salah/)
    await u.clear(within(dialogPin).getByLabelText('PIN'))
    await u.type(within(dialogPin).getByLabelText('PIN'), '1234')
    await u.click(within(dialogPin).getByRole('button', { name: 'Masuk' }))
    await screen.findByRole('button', { name: 'Profil: Ali' })
    await nav(u, 'Catat')
    await u.type(screen.getByLabelText('Nilai 0–100 (boleh kosong)'), '90')
    await u.type(screen.getByLabelText('Pesan untuk mubaligh (boleh kosong)'), 'Sudah hafal')
    await u.click(screen.getByRole('button', { name: 'Simpan catatan' }))
    await tungguTeks(/Catatan tersimpan/)
    await waitFor(() => expect(document.querySelector('.indikator-setor')?.textContent).toMatch(/Ada 2 data belum disetor/))
    await nav(u, 'Setor')
    await u.click(screen.getByRole('button', { name: 'Setor Belajar' }))
    await tungguTeks(/Berkas setoran siap\. Kirim ke mubaligh/)
    const belajar = dibagikan(pfG, 'PPG_BELAJAR_')
    await tutup(pfG)

    // --- 5. Mubaligh: impor setoran, sahkan Ali (catatan), tolak Budi, laporan WA, balasan
    mulai(pfM)
    await screen.findByText(/Assalamu'alaikum, Ust\. Hasan/, {}, { timeout: 20000 })
    await nav(u, 'Lainnya')
    await u.click(screen.getByRole('button', { name: /^Setoran Generus/ }))
    pfM.antreanBuka.push([belajar])
    await u.click(screen.getByRole('button', { name: 'Buka berkas setoran (bisa banyak)' }))
    await tungguTeks(/Setoran belajar diterima: 2 catatan/)
    await screen.findByRole('heading', { name: 'Ali (1)' })
    await u.type(screen.getByLabelText('Catatan untuk Ali'), 'Lancar sekali')
    await u.click(screen.getByRole('button', { name: /^Sahkan .* Ali$/ }))
    await tungguTeks(/disahkan\./)
    await u.click(screen.getByRole('button', { name: /^Tolak .* Budi$/ }))
    await tungguTeks(/ditolak\./)
    await screen.findByText('Tidak ada setoran yang menunggu disahkan.')

    await nav(u, 'Lainnya') // ketuk ulang menu aktif → kembali ke daftar Lainnya
    await u.click(screen.getByRole('button', { name: /^Laporan Pekanan/ }))
    await u.click(await screen.findByRole('button', { name: 'Kirim WA ke wali Ali' }))
    expect(pfM.tautan.at(-1)).toMatch(/^https:\/\/wa\.me\/6281234567890\?text=Assalamu/)
    expect(decodeURIComponent(pfM.tautan.at(-1)!)).toContain('Lancar sekali')
    expect(screen.getByText('Nomor HP wali belum ada.')).toBeTruthy() // Citra tanpa nomor
    await u.click(screen.getByRole('button', { name: 'Kembali' }))
    await u.click(screen.getByRole('button', { name: /^Kirim Balasan/ }))
    const sebelum = pfM.dibagikan.length
    await u.click(await screen.findByRole('button', { name: 'Kirim balasan ke Pak Fauzi' }))
    await tungguTeks(/Balasan untuk Pak Fauzi siap dikirim/)
    expect(pfM.dibagikan.length).toBe(sebelum + 1)
    const balasanW1 = balasanUntuk(pfM.dibagikan.slice(sebelum), idW)
    await tutup(pfM)

    // --- 6. Wali: aktivasi, buka balasan, lihat laporan pekanan & kemajuan
    mulai(pfW)
    await aktifkan(u, tokenWali)
    await screen.findByRole('heading', { level: 1, name: 'Materi yang perlu dituntaskan' })
    await tungguTeks(/Data anak belum ada/)
    await nav(u, 'Berkas')
    pfW.antreanBuka.push([balasanW0, balasanW1, admin.materi])
    await u.click(screen.getByRole('button', { name: 'Buka Berkas' }))
    await tungguTeks(/Daftar materi berhasil dibuka/)
    await nav(u, 'Laporan')
    await u.click(await screen.findByRole('radio', { name: 'Ali' }))
    await screen.findByRole('heading', { name: 'Laporan Ali' })
    const targetAli = targetMateriBerikutnya(admin.db, ali.id, 3)
    // materi yang disahkan untuk Ali kini tampil; catatan mubaligh ikut
    await tungguTeks(/Lancar sekali/)
    expect(screen.getByRole('heading', { name: 'Materi disahkan pekan ini' })).toBeTruthy()
    expect(targetAli.length).toBeGreaterThan(0)
    await nav(u, 'Kemajuan')
    await u.click(await screen.findByRole('radio', { name: 'Ali' }))
    await waitFor(() => expect(document.querySelector('.kemajuan-ringkas p')?.textContent).toMatch(/^1 dari \d+ materi selesai/))
    await nav(u, 'Kehadiran')
    await tungguTeks(/Belum ada catatan kehadiran/)
    await tutup(pfW)

    // --- 7. Budi mondok: admin ubah status → paket → mubaligh → balasan → HP generus → spanduk
    ubahStatus(admin.db, budi.id, 'mondok', tanggalHariIni(), 'Pondok')
    const paket2 = buatPaket(admin.db, admin.k1.id, admin.kunci)
    mulai(pfM)
    await screen.findByText(/Assalamu'alaikum/, {}, { timeout: 20000 })
    await nav(u, 'Lainnya')
    await u.click(screen.getByRole('button', { name: /^Buka Berkas/ }))
    pfM.antreanBuka.push([paket2])
    await u.click(screen.getByRole('button', { name: 'Buka Berkas' }))
    await tungguTeks(/Data dari admin berhasil dibuka/)
    await u.click(screen.getByRole('button', { name: 'Kembali' }))
    await u.click(screen.getByRole('button', { name: /^Kirim Balasan/ }))
    const sebelum2 = pfM.dibagikan.length
    await u.click(await screen.findByRole('button', { name: 'Kirim balasan ke Ali, Budi' }))
    await tungguTeks(/Balasan untuk Ali, Budi siap dikirim/)
    const balasanG2 = balasanUntuk(pfM.dibagikan.slice(sebelum2), idG)
    await tutup(pfM)

    mulai(pfG)
    await screen.findByRole('heading', { name: 'Pilih Profil' }, { timeout: 20000 })
    await u.click(screen.getByRole('button', { name: /Budi/ }))
    await nav(u, 'Setor')
    pfG.antreanBuka.push([balasanG2])
    await u.click(screen.getByRole('button', { name: 'Buka Berkas' }))
    await tungguTeks(/Profil Budi sedang mondok/)
    await tungguTeks(/Sedang mondok — pencatatan dihentikan sementara/)
    await nav(u, 'Catat')
    expect((screen.getByRole('button', { name: 'Simpan catatan' }) as HTMLButtonElement).disabled).toBe(true)
    // Ali di HP yang sama tidak ikut dibekukan
    await bukaAkun(u)
    await u.click(screen.getByRole('button', { name: 'Ganti profil' }))
    await screen.findByRole('heading', { name: 'Pilih Profil' })
    expect(within(screen.getByRole('button', { name: /Budi/ })).getByText('Mondok')).toBeTruthy()
    expect(within(screen.getByRole('button', { name: /Ali/ })).queryByText('Mondok')).toBeNull()
    await jeda()
  })
})
