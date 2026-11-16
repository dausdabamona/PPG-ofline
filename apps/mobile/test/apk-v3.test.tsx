// Fase 7 — APK v3 (§14): absen mubaligh dengan materi hari ini & tuntas, pengingat tenggat setor, layar
// "Materi yang perlu dituntaskan" untuk murid & orang tua, QR berseri lewat pemindai native (palsu), izin kamera,
// dan pesan untuk kode aktivasi EXE yang ditempel di HP.
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  absenPertemuan,
  aktifkanProfil,
  ambilWilayah,
  aturJadwalSetor,
  bacaKodePerangkat,
  bukaDb,
  bukaPertemuan,
  buatBalasan,
  buatMateri,
  buatPaket,
  daftarMateri,
  imporSetor,
  inisialisasiPerangkat,
  pecahQr,
  periodeAktif,
  pilihProfil,
  tambahGenerus,
  tambahPengajian,
  tanggalHariIni,
  terapkanMateri,
  terapkanPaket,
  terbitkanToken,
  terbitkanTokenGenerus,
  tetapkanTarget,
} from '@ppg/core'
import { buatPemindaiPalsu, buatPlatformPalsu } from './platform-palsu'
import { aktifkan, dibagikan, jeda, nav, sambut, siapkanAdmin, tungguTeks, waitFor } from './bantu'
import { MAKS_BAGIAN_QR_HP } from '../src/komponen/qr'
import { PESAN_TOKEN_EXE } from '../src/halaman/awal'

afterEach(() => cleanup())

const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Dunia v3: admin daerah + target caberawit 3 materi + kelas caberawit hari ini + jadwal setor + generus praremaja. */
async function siapkanV3() {
  const admin = await siapkanAdmin()
  const hariIni = tanggalHariIni()
  const dow = new Date(`${hariIni}T00:00:00`).getDay()
  const dina = tambahGenerus(admin.db, { kelompokId: admin.k1.id, nama: 'Dina', jenisKelamin: 'P', kategori: 'praremaja', mulai: '2026-01-01' })
  const kelas = tambahPengajian(admin.db, { wilayahId: admin.k1.id, nama: 'Kelas Caberawit', hari: dow, jam: '19:00', kategoriGenerus: ['caberawit'] })
  const m = daftarMateri(admin.db, { kategoriGenerus: 'caberawit' }).slice(0, 3)
  expect(m).toHaveLength(3)
  const periode = periodeAktif(admin.db)
  tetapkanTarget(admin.db, { periode, kategoriGenerus: 'caberawit', materiIds: m.map((x) => x.id) })
  // kelompok → desa tiap pekan, 3 hari lagi (tidak "mendekat"); HP baru yang belum pernah setor = "Belum ada setoran" (Fase 9b)
  aturJadwalSetor(admin.db, { tingkatAsal: 'kelompok', pola: 'pekanan', hari: (dow + 3) % 7, jam: '21:00' })
  const materi = buatMateri(admin.db, admin.kunci)
  return { ...admin, dina, kelas, m, periode, materi: { nama: materi.nama, bytes: materi.bytes } }
}

describe('APK v3 — mubaligh', () => {
  it('Absen: pilih kelas → materi hari ini (saran + target) → hadir & tuntas → simpan; Materi; pengingat & Setor sekarang', async () => {
    const w = await siapkanV3()
    const [ali, budi, citra] = w.g as [(typeof w.g)[0], (typeof w.g)[0], (typeof w.g)[0]]
    const [m1, m2] = w.m as [(typeof w.m)[0], (typeof w.m)[0]]
    const u = userEvent.setup()
    const pemindai = buatPemindaiPalsu()
    const pf = buatPlatformPalsu(null, { pemindai })
    const kode = await sambut(u, pf, 'HP Ust. Hasan')
    await aktifkan(u, terbitkanToken(w.db, w.kunci, { kodePerangkat: kode, role: 'mubaligh', nama: 'Ust. Hasan', wilayahId: w.k1.id }))

    // navigasi bawah mubaligh hanya 4 menu
    const navBawah = screen.getByRole('navigation', { name: 'Menu utama' })
    expect(within(navBawah).getAllByRole('button').map((b) => b.textContent?.replace(/^\W+/, ''))).toEqual(['Absen', 'Jadwal', 'Materi', 'Lainnya'])
    await screen.findByRole('heading', { level: 1, name: 'Absen' })
    expect(screen.getByText(/Assalamu'alaikum, Ust\. Hasan/)).toBeTruthy()

    pf.kirimIntent({ bytes: buatPaket(w.db, w.k1.id, w.kunci).bytes })
    await tungguTeks(/Data dari admin berhasil dibuka/)
    pf.kirimIntent(w.materi)
    await tungguTeks(/Daftar materi berhasil dibuka/)

    // pengingat tenggat di atas Absen — Fase 9b: belum ada data → netral, tanpa "terlambat" yang bertentangan
    await tungguTeks(/Belum ada data untuk disetor/)
    expect(screen.queryByText(/Setoran terlambat/)).toBeNull()
    expect(screen.queryByText(/Semua data sudah disetor/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Setor sekarang' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Setor ke Daerah' })).toBeTruthy()
    expect(screen.getByText(/Tenggat berikutnya:/)).toBeTruthy()
    expect(document.querySelector('.indikator-setor')).toBeNull() // tidak dobel dengan kartu pengingat

    // 1. pilih kelas (pengajian per kategori)
    await u.click(screen.getByRole('radio', { name: /Kelas Caberawit/ }))
    // 2. materi hari ini: saran = target paling banyak belum tuntas (3 dari 3)
    const kartuMateri = screen.getByRole('heading', { name: '2. Materi hari ini' }).closest('section')!
    expect(within(kartuMateri).getAllByText(/3 dari 3 generus belum tuntas/)).toHaveLength(3)
    await u.click(within(kartuMateri).getByRole('button', { name: 'Pakai saran pertama' }))
    expect((within(kartuMateri).getAllByRole('checkbox', { name: new RegExp(esc(m1.nama)) })[0] as HTMLInputElement).checked).toBe(true)
    // tambah materi kedua dari daftar target kurikulum
    await u.click(within(kartuMateri).getByText(/Pilih dari target kurikulum \(3\)/))
    await u.click(within(kartuMateri).getByRole('checkbox', { name: new RegExp(`^2\\. ${esc(m2.nama)}`) }))
    await u.click(within(kartuMateri).getByRole('button', { name: 'Lanjut: isi kehadiran' }))

    // 3. daftar generus kelas caberawit (Dina praremaja tidak tampil)
    await screen.findByRole('heading', { name: '3 generus' })
    expect(screen.queryByText('Dina')).toBeNull()
    await u.click(screen.getByRole('button', { name: 'Semua hadir' }))
    await u.click(within(screen.getByRole('radiogroup', { name: 'Kehadiran Budi' })).getByRole('radio', { name: 'Alpa' }))
    expect((screen.getByRole('checkbox', { name: `Tuntas ${m1.nama} Budi` }) as HTMLInputElement).disabled).toBe(true)
    await u.click(screen.getByRole('checkbox', { name: `Tuntas ${m1.nama} Ali` }))
    await u.click(screen.getByRole('checkbox', { name: `Tuntas ${m2.nama} Ali` }))
    await u.click(screen.getByRole('checkbox', { name: `Tuntas ${m1.nama} Citra` }))
    await u.click(screen.getByRole('button', { name: 'Simpan absen (3)' }))
    await tungguTeks(/Absen tersimpan: 3 generus, 3 materi tuntas/)
    // yang sudah tuntas tampil sebagai tanda, tidak bisa dicentang ulang
    await waitFor(() => expect(screen.queryByRole('checkbox', { name: `Tuntas ${m1.nama} Ali` })).toBeNull())
    expect(screen.getAllByText(`✓ ${m1.nama}`).length).toBe(2)

    // Materi: target periode aktif per kelas + progres tiap generus
    await nav(u, 'Materi')
    await screen.findByRole('heading', { name: 'Kelas Caberawit (perlu ditetapkan)' })
    expect(within(screen.getByRole('radiogroup', { name: 'Kelas' })).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Caberawit (perlu ditetapkan)', 'Pra Remaja (G1)'])
    expect(screen.getByRole('button', { name: 'Rincian capaian Ali' }).textContent).toMatch(/2\/3.*66,7%/)
    expect(screen.getByRole('button', { name: 'Rincian capaian Citra' }).textContent).toMatch(/1\/3/)
    await u.click(screen.getByRole('button', { name: 'Rincian capaian Budi' }))
    const dlg = await screen.findByRole('dialog', { name: 'Capaian Budi' })
    expect(within(dlg).getAllByRole('listitem').map((li) => li.textContent)).toEqual(w.m.map((x) => x.nama))
    await u.click(within(dlg).getByRole('button', { name: 'Tutup' }))

    // Absen: ada data, belum pernah setor, tenggat pertama belum lewat → kuning "Belum ada setoran" + tombol besar
    await nav(u, 'Absen')
    await tungguTeks(/Belum ada setoran\. Setor ke Daerah sebelum tenggat/)
    expect(screen.queryByText(/Setoran terlambat/)).toBeNull()
    expect(screen.getByText(/^Ada \d+ data belum disetor\.$/)).toBeTruthy()
    // "Setor sekarang" → berkas setoran → kartu langsung segar: data "sudah dikirim, menunggu konfirmasi"
    await u.click(await screen.findByRole('button', { name: 'Setor sekarang' }))
    await tungguTeks(/Berkas setoran siap\. Kirim ke Daerah/)
    await tungguTeks(/^\d+ data sudah dikirim, menunggu konfirmasi Daerah\.$/)
    expect(screen.queryByText(/data belum disetor/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Setor sekarang' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Kirim ulang ke Daerah' })).toBeTruthy()
    const r = imporSetor(w.db, dibagikan(pf, 'PPG_SETOR_').bytes, w.kunci)
    expect(r.perTabel.presensi?.ditambah).toBe(3)
    expect(r.perTabel.pertemuan?.ditambah).toBe(1)
    expect(r.perTabel.kemajuan_belajar?.ditambah).toBe(3)
    await waitFor(() => expect(screen.queryByText(/Setoran terlambat/)).toBeNull())
    expect(screen.queryByRole('button', { name: 'Setor sekarang' })).toBeNull()

    // Lainnya berisi menu sesuai §14; Terbitkan Token memindai Kode Perangkat dengan pemindai native
    await nav(u, 'Lainnya')
    for (const t of ['Setoran Generus', 'Simak Langsung', 'Generus', 'Terbitkan Token', 'Kirim Balasan', 'Laporan Mingguan', 'Setor ke Daerah', 'Buka Berkas'])
      expect(screen.getByRole('button', { name: new RegExp(`^${t}`) })).toBeTruthy()
    await u.click(screen.getByRole('button', { name: /^Terbitkan Token/ }))
    await u.click(await screen.findByRole('button', { name: 'Pindai QR Kode Perangkat' }))
    await screen.findByRole('dialog', { name: 'Pemindai QR' })
    const kodeLain = 'PPGD1.' + 'x'.repeat(40)
    act(() => pemindai.pindai(kodeLain))
    await tungguTeks(/Kode Perangkat terbaca/)
    expect((screen.getByLabelText('Kode Perangkat HP tujuan') as HTMLTextAreaElement).value).toBe(kodeLain)
    expect(pemindai.aktif).toBe(false)
    // Jadwal: rutin + tambahan
    await nav(u, 'Jadwal')
    expect(screen.getAllByText('Kelas Caberawit').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('heading', { name: 'Tambah jadwal tambahan' })).toBeTruthy()
    void ali
    void budi
    void citra
    await jeda()
  })
})

/** HP mubaligh lewat core (tanpa UI): aktif, menerima paket & materi. */
async function hpMubaligh(w: Awaited<ReturnType<typeof siapkanV3>>) {
  const hp = await bukaDb()
  const { kodePerangkat } = await inisialisasiPerangkat(hp, 'HP Ust. Hasan')
  const prof = await aktifkanProfil(hp, terbitkanToken(w.db, w.kunci, { kodePerangkat, role: 'mubaligh', nama: 'Ust. Hasan', wilayahId: w.k1.id }))
  pilihProfil(hp, prof.id)
  terapkanPaket(hp, buatPaket(w.db, w.k1.id, w.kunci).bytes)
  terapkanMateri(hp, w.materi.bytes)
  return { hp, prof }
}

describe('APK v3 — murid & orang tua', () => {
  it('layar pertama "Materi yang perlu dituntaskan": persen, daftar berurut, yang tuntas, pertemuan berikutnya; wali pilih anak', async () => {
    const w = await siapkanV3()
    const [ali, budi] = w.g as [(typeof w.g)[0], (typeof w.g)[0]]
    const [m1, m2, m3] = w.m as [(typeof w.m)[0], (typeof w.m)[0], (typeof w.m)[0]]
    const { hp, prof } = await hpMubaligh(w)
    const pt = bukaPertemuan(hp, { kelompokId: w.k1.id, tanggal: tanggalHariIni(), pengajianId: w.kelas.id, materiIds: [m1.id] })
    absenPertemuan(hp, pt.id, [
      { generusId: ali.id, status: 'hadir', tuntas: [m1.id] },
      { generusId: budi.id, status: 'hadir' },
    ])
    const u = userEvent.setup()

    // --- murid
    const pfG = buatPlatformPalsu()
    const kodeG = await sambut(u, pfG, 'HP Ali')
    await aktifkan(u, terbitkanTokenGenerus(hp, prof.id, { kodePerangkat: kodeG, role: 'generus', generusIds: [ali.id], nama: 'Ali' }))
    await screen.findByRole('heading', { level: 1, name: 'Materi yang perlu dituntaskan' })
    pfG.kirimIntent(w.materi)
    await tungguTeks(/Daftar materi berhasil dibuka/)
    pfG.kirimIntent(buatBalasan(hp, bacaKodePerangkat(kodeG).perangkat_id))
    await tungguTeks(/Balasan dari mubaligh berhasil dibuka/)
    await tungguTeks(/1 dari 3 materi tuntas/)
    expect(screen.getByText('33,3%')).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Capaian Ali' }).getAttribute('aria-valuenow')).toBe('33')
    const perlu = screen.getByRole('heading', { name: 'Perlu dituntaskan (2)' }).closest('section')!
    expect(within(perlu).getAllByRole('listitem').map((li) => li.querySelector('strong')?.textContent)).toEqual([m2.nama, m3.nama])
    const sudah = screen.getByRole('heading', { name: '✓ Sudah tuntas (1)' }).closest('section')!
    expect(within(sudah).getByText(m1.nama)).toBeTruthy()
    expect(screen.getByRole('note').textContent).toMatch(/Pertemuan berikutnya.*Caberawit/)
    // catat & setor belajar tetap di menu berikutnya
    const navG = within(screen.getByRole('navigation', { name: 'Menu utama' })).getAllByRole('button').map((b) => b.textContent?.replace(/^\W+/, ''))
    expect(navG).toEqual(['Target', 'Materiku', 'Catat', 'Jadwal', 'Setor'])
    await nav(u, 'Catat')
    await screen.findByRole('heading', { name: 'Catat Kemajuan' })
    cleanup()

    // --- orang tua (2 anak)
    const pfW = buatPlatformPalsu()
    const kodeW = await sambut(u, pfW, 'HP Pak Fauzi')
    await aktifkan(u, terbitkanTokenGenerus(hp, prof.id, { kodePerangkat: kodeW, role: 'wali', generusIds: [ali.id, budi.id], nama: 'Pak Fauzi' }))
    await screen.findByRole('heading', { level: 1, name: 'Materi yang perlu dituntaskan' })
    pfW.kirimIntent(w.materi)
    await tungguTeks(/Daftar materi berhasil dibuka/)
    pfW.kirimIntent(buatBalasan(hp, bacaKodePerangkat(kodeW).perangkat_id))
    await tungguTeks(/Balasan dari mubaligh berhasil dibuka/)
    await u.click(await screen.findByRole('radio', { name: 'Budi' }))
    await screen.findByRole('heading', { name: 'Capaian Budi' })
    await tungguTeks(/0 dari 3 materi tuntas/)
    await u.click(screen.getByRole('radio', { name: 'Ali' }))
    await screen.findByRole('heading', { name: 'Capaian Ali' })
    await tungguTeks(/1 dari 3 materi tuntas/)
    const navW = within(screen.getByRole('navigation', { name: 'Menu utama' })).getAllByRole('button').map((b) => b.textContent?.replace(/^\W+/, ''))
    expect(navW.slice(0, 2)).toEqual(['Target', 'Laporan'])
    await nav(u, 'Laporan')
    await screen.findByRole('heading', { level: 1, name: 'Laporan Mingguan' })
    await jeda()
  })
})

describe('APK v3 — QR native & kode EXE', () => {
  it('QR berseri lewat pemindai native: izin ditolak → pengaturan → coba lagi; bagian acak + QR asing; tombol kembali', async () => {
    const w = await siapkanV3()
    const { hp, prof } = await hpMubaligh(w)
    const u = userEvent.setup()
    const pemindai = buatPemindaiPalsu()
    const pf = buatPlatformPalsu(null, { pemindai })
    const kode = await sambut(u, pf, 'HP Citra')
    const token = terbitkanTokenGenerus(hp, prof.id, { kodePerangkat: kode, role: 'generus', generusIds: [w.g[2]!.id], nama: 'Citra' })

    // izin kamera ditolak → pesan ramah + Buka Pengaturan + Coba lagi
    pemindai.izin = 'ditolak'
    await u.click(screen.getByRole('button', { name: 'Pindai QR Token' }))
    await tungguTeks(/Izin kamera belum diberikan/)
    await u.click(screen.getByRole('button', { name: 'Buka Pengaturan' }))
    expect(pemindai.bukaPengaturanKe).toBe(1)
    pemindai.izin = 'diizinkan'
    await u.click(screen.getByRole('button', { name: 'Coba lagi' }))
    await screen.findByRole('dialog', { name: 'Pemindai QR' })
    expect(document.documentElement.classList.contains('pemindai-native')).toBe(true)

    // tombol kembali Android saat kamera menyala → berhenti memindai
    let ditangani = false
    act(() => {
      ditangani = pf.tekanKembali()
    })
    expect(ditangani).toBe(true)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Pemindai QR' })).toBeNull())
    expect(pemindai.aktif).toBe(false)
    expect(document.documentElement.classList.contains('pemindai-native')).toBe(false)

    // pindai lagi: bagian QR berseri dalam urutan acak, ganda, dan satu QR asing di tengah
    await u.click(screen.getByRole('button', { name: 'Pindai QR Token' }))
    const dialog = await screen.findByRole('dialog', { name: 'Pemindai QR' })
    const bagian = pecahQr(token, { maks: MAKS_BAGIAN_QR_HP })
    expect(bagian.length).toBeGreaterThanOrEqual(3)
    const n = bagian.length
    act(() => pemindai.pindai(bagian[n - 1]!))
    act(() => pemindai.pindai(bagian[n - 1]!))
    await waitFor(() => expect(within(dialog).getByRole('status').textContent).toMatch(new RegExp(`1 dari ${n}`)))
    act(() => pemindai.pindai('https://contoh.id/menu'))
    await waitFor(() => expect(within(dialog).getByRole('alert').textContent).toMatch(/QR ini bukan token/))
    act(() => pemindai.pindai(bagian[0]!))
    await waitFor(() => expect(within(dialog).getByRole('status').textContent).toMatch(new RegExp(`2 dari ${n}`)))
    for (const b of bagian.slice(1, n - 1).reverse()) act(() => pemindai.pindai(b))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Pemindai QR' })).toBeNull())
    expect(pemindai.aktif).toBe(false)
    expect((await screen.findByLabelText('Token') as HTMLTextAreaElement).value).toBe(token)
    await u.click(screen.getByRole('button', { name: 'Aktifkan' }))
    await screen.findByRole('navigation', { name: 'Menu utama' }, { timeout: 20000 })
    expect(screen.getByRole('button', { name: 'Profil: Citra' })).toBeTruthy()
    expect(pemindai.jumlahMulai).toBe(2)
    await jeda()
  })

  it('kode aktivasi EXE (admin desa / kurikulum) di HP → "Kode ini untuk aplikasi laptop (EXE)"', async () => {
    const w = await siapkanV3()
    const desaId = ambilWilayah(w.db, w.k1.id)!.induk_id!
    const daerahId = ambilWilayah(w.db, desaId)!.induk_id!
    const u = userEvent.setup()
    const pf = buatPlatformPalsu()
    const kode = await sambut(u, pf, 'HP Admin Desa')
    for (const t of [
      terbitkanToken(w.db, w.kunci, { kodePerangkat: kode, role: 'admin', nama: 'Admin Desa', wilayahId: desaId }),
      terbitkanToken(w.db, w.kunci, { kodePerangkat: kode, role: 'kurikulum', nama: 'Tim Kurikulum', wilayahId: daerahId }),
    ]) {
      await u.click(await screen.findByRole('button', { name: 'Tempel Token' }))
      await u.clear(screen.getByLabelText('Token'))
      await u.paste(t)
      await u.click(screen.getByRole('button', { name: 'Aktifkan' }))
      await tungguTeks(/Kode aktivasi Admin Desa, Admin Kelompok, dan Kurikulum ditempel di aplikasi PPG Sorong di laptop/)
      expect(document.querySelector('.spanduk')?.textContent).toContain(PESAN_TOKEN_EXE)
      expect(PESAN_TOKEN_EXE).toMatch(/^Kode ini untuk aplikasi laptop \(EXE\)/)
      expect(screen.queryByRole('navigation', { name: 'Menu utama' })).toBeNull()
      await u.click(screen.getByRole('button', { name: 'Batal' }))
    }
    await jeda()
  })
})
