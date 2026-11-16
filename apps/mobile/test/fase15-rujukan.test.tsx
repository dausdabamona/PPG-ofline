// Fase 15 (§21) — APK: Rujuk ke BK dari HP mubaligh (berkas jalur cepat lewat WA), BK menerima & menandai status di menu
// Bidang (dikelompokkan per penugasan, PIN wajib), dan tombol Hubungi BK di HP orang tua (wa.me, tanpa rekaman).
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  aktifkanProfil,
  bacaKodePerangkat,
  buatBalasan,
  buatPaket,
  bukaDb,
  daftarRujukanMasuk,
  daftarRujukanSaya,
  imporRujukan,
  inisialisasiPerangkat,
  simpanRujukan,
  terapkanPaket,
  terbitkanToken,
  terbitkanTokenGenerus,
} from '@ppg/core'
import { buatPlatformPalsu } from './platform-palsu'
import { aktifkan, dibagikan, nav, sambut, siapkanAdmin, tungguTeks } from './bantu'

afterEach(() => cleanup())

/** HP (core) dengan token BK Kelompok K1 bernomor WA. */
async function hpBk(w: Awaited<ReturnType<typeof siapkanAdmin>>) {
  const db = await bukaDb()
  const { kodePerangkat } = await inisialisasiPerangkat(db, 'HP BK')
  await aktifkanProfil(db, terbitkanToken(w.db, w.kunci, { kodePerangkat, role: 'pengurus', nama: 'BK Contoh', penugasan: [{ jabatan: 'bk', wilayah_id: w.k1.id }], kontakBk: '081211112222' }))
  terapkanPaket(db, buatPaket(w.db, w.k1.id, w.kunci).bytes)
  return db
}

/** HP (core) mubaligh K1. */
async function hpMubaligh(w: Awaited<ReturnType<typeof siapkanAdmin>>) {
  const db = await bukaDb()
  const { kodePerangkat } = await inisialisasiPerangkat(db, 'HP Mubaligh')
  const profil = await aktifkanProfil(db, terbitkanToken(w.db, w.kunci, { kodePerangkat, role: 'mubaligh', nama: 'Ust. Contoh', wilayahId: w.k1.id }))
  terapkanPaket(db, buatPaket(w.db, w.k1.id, w.kunci).bytes)
  return { db, profil }
}

describe('APK — Rujukan BK (§21.3)', () => {
  it('mubaligh: Lainnya → Rujuk ke BK (Segera) → pesan keselamatan → kirim berkas PPG_RUJUKAN lewat WA; BK membukanya', async () => {
    const w = await siapkanAdmin()
    const bk = await hpBk(w)
    const u = userEvent.setup()
    const pf = buatPlatformPalsu(null)
    const kode = await sambut(u, pf, 'HP Mubaligh UI')
    await aktifkan(u, terbitkanToken(w.db, w.kunci, { kodePerangkat: kode, role: 'mubaligh', nama: 'Ust. Contoh', wilayahId: w.k1.id }))
    pf.kirimIntent({ bytes: buatPaket(w.db, w.k1.id, w.kunci).bytes })
    await tungguTeks(/Data dari admin berhasil dibuka/)
    await nav(u, 'Lainnya')
    await u.click(await screen.findByRole('button', { name: /Rujuk ke BK/ }))
    await screen.findByRole('heading', { name: 'Rujuk ke BK' })
    const pilih = screen.getByLabelText('Generus') as HTMLSelectElement
    await u.selectOptions(pilih, [...pilih.options].find((o) => /^Ali/.test(o.textContent ?? ''))!.value)
    await u.click(screen.getByRole('radio', { name: 'Perilaku' }))
    await u.type(screen.getByLabelText('Uraian singkat'), 'Contoh uraian untuk uji')
    await u.click(screen.getByRole('checkbox', { name: /Segera/ }))
    expect(screen.getByRole('checkbox', { name: 'Kirim langsung ke BK Daerah' })).toBeTruthy()
    await tungguTeks(/Akan diterima:/)
    expect(screen.getByText(/BK Kelompok Klasaman 1/)).toBeTruthy()
    await u.click(screen.getByRole('button', { name: 'Kirim rujukan' }))
    await tungguTeks(/Hubungi BK atau pengurus sekarang lewat telepon/)
    await u.click(screen.getByRole('button', { name: 'Kirim berkas rujukan ke BK (WA)' }))
    const b = dibagikan(pf, 'PPG_RUJUKAN_')
    expect(b.nama).toMatch(/^PPG_RUJUKAN_klasaman-1_/)
    // perujuk hanya melihat status (tanpa isi)
    expect(screen.getByText(/Rujukan ke BK Klasaman 1/)).toBeTruthy()
    expect(screen.getByText('Terkirim — belum diterima BK')).toBeTruthy()
    expect(screen.queryByText('Contoh uraian untuk uji')).toBeNull()
    imporRujukan(bk, b.bytes)
    expect(daftarRujukanMasuk(bk)).toMatchObject([{ isi: { nama: 'Ali', kategori: 'perilaku', segera: true } }])
  })

  it('BK: PIN wajib → Bidang dikelompokkan per penugasan → Buka Berkas rujukan → Terima', async () => {
    const w = await siapkanAdmin()
    const m = await hpMubaligh(w)
    const u = userEvent.setup()
    const pf = buatPlatformPalsu(null)
    const kode = await sambut(u, pf, 'HP BK UI')
    await aktifkan(u, terbitkanToken(w.db, w.kunci, { kodePerangkat: kode, role: 'pengurus', nama: 'BK Contoh', penugasan: [{ jabatan: 'bk', wilayah_id: w.k1.id }, { jabatan: 'sarpras', wilayah_id: w.k1.id }] }))
    pf.kirimIntent({ bytes: buatPaket(w.db, w.k1.id, w.kunci).bytes })
    await tungguTeks(/Data dari admin berhasil dibuka/)
    // mubaligh (core) merujuk setelah BK aktif (info BK di paket terbaru)
    terapkanPaket(m.db, buatPaket(w.db, w.k1.id, w.kunci).bytes)
    const r = simpanRujukan(m.db, { generusId: w.g[1]!.id, kategori: 'belajar', uraian: 'Perlu pendampingan belajar' })
    pf.kirimIntent({ nama: r.berkas!.nama, bytes: r.berkas!.bytes })
    await tungguTeks(/Rujukan baru diterima/)
    await nav(u, 'Bidang')
    await screen.findByRole('heading', { name: 'Pasang PIN dulu' })
    await u.type(screen.getByLabelText('PIN baru (4 angka)'), '2468')
    await u.type(screen.getByLabelText('Ulangi PIN'), '2468')
    await u.click(screen.getByRole('button', { name: 'Pasang PIN' }))
    expect(await screen.findByText('Bidang Bimbingan Konseling · Kelompok Klasaman 1')).toBeTruthy()
    expect(screen.getByText('Bidang Sarana & Prasarana · Kelompok Klasaman 1')).toBeTruthy()
    await u.click(screen.getByRole('button', { name: /^.?Bimbingan Konseling/ }))
    await tungguTeks(/Perlu pendampingan belajar/)
    await u.click(screen.getByRole('button', { name: 'Terima' }))
    await tungguTeks(/^Diterima\.$/)
    const kartu = screen.getByText(/Perlu pendampingan belajar/).closest('li')!
    expect(within(kartu as HTMLElement).getByText('Diterima')).toBeTruthy()
    expect(daftarRujukanSaya(m.db)[0]!.status).toBe('terkirim')
  })

  it('orang tua: Hubungi BK → pilih BK Kelompok → membuka wa.me dengan kalimat pembuka', async () => {
    const w = await siapkanAdmin()
    await hpBk(w)
    const m = await hpMubaligh(w)
    terapkanPaket(m.db, buatPaket(w.db, w.k1.id, w.kunci).bytes)
    const u = userEvent.setup()
    const pf = buatPlatformPalsu(null)
    const kode = await sambut(u, pf, 'HP Wali')
    await aktifkan(u, terbitkanTokenGenerus(m.db, m.profil.id, { kodePerangkat: kode, role: 'wali', generusIds: [w.g[0]!.id], nama: 'Wali Contoh' }))
    const idWali = bacaKodePerangkat(kode).perangkat_id
    pf.kirimIntent({ bytes: buatBalasan(m.db, idWali).bytes })
    await tungguTeks(/Balasan dari mubaligh berhasil dibuka/)
    await u.click(await screen.findByRole('button', { name: 'Hubungi BK' }))
    await u.click(await screen.findByRole('button', { name: 'BK Kelompok · Klasaman 1' }))
    expect(pf.tautan.at(-1)).toMatch(/^https:\/\/wa\.me\/6281211112222\?text=Assalamu/)
  })
})
