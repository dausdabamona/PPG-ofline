// Fase 6 — EXE v3 (satu EXE untuk semua tingkat) lewat UI sungguhan (jsdom) dengan platform palsu per laptop.
// Tiap laptop = satu instance App + database sendiri; berkas berpindah sebagai byte (meniru WA).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'fflate'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import ExcelJS from 'exceljs'
import {
  aktifkanExe,
  aktifkanProfil,
  bukaDb,
  bukaKunciExe,
  buatMateri,
  buatPaket,
  buatSetor,
  catatPresensiMassal,
  daftarGenerus,
  daftarKemajuan,
  daftarMateri,
  daftarPengajian,
  daftarPerangkat,
  daftarPresensi,
  daftarTarget,
  daftarUsulan,
  daftarWilayah,
  infoInstalasi,
  inisialisasiAdmin,
  inisialisasiExe,
  inisialisasiPerangkat,
  kategoriKelas,
  periodeAktif,
  simpanDb,
  tambahGenerus,
  tambahPengajian,
  tambahWilayah,
  tanggalHariIni,
  terapkanMateri,
  terapkanPaket,
  terbitkanToken,
  terbitkanTokenBawah,
  tetapkanTarget,
  type Db,
  type KunciAdmin,
} from '@ppg/core'
import { App } from '../src/App'
import { buatPlatformPalsu, type PlatformPalsu } from './platform-palsu'

const SANDI = 'sandi-admin-123'
const SANDI_EXE = 'sandi-exe-123'

afterEach(() => cleanup())

async function pilihOpsi(u: UserEvent, labelSelect: string, pola: RegExp, wadah: HTMLElement = document.body) {
  const select = within(wadah).getByLabelText(labelSelect) as HTMLSelectElement
  const opsi = [...select.options].find((o) => pola.test(o.textContent ?? ''))
  if (!opsi) throw new Error(`Opsi ${pola} tidak ada di ${labelSelect}: ${[...select.options].map((o) => o.textContent).join(' | ')}`)
  await u.selectOptions(select, opsi.value)
}

async function buka(u: UserEvent, menu: string) {
  await u.click(within(screen.getByRole('navigation', { name: 'Menu utama' })).getByRole('button', { name: new RegExp(`^.?${menu}$`) }))
  await screen.findByRole('heading', { level: 1, name: menu })
}

function berkasTerakhir(pf: PlatformPalsu, awalan: string) {
  const b = [...pf.tersimpan].reverse().find((x) => x.nama.startsWith(awalan))
  if (!b) throw new Error(`Belum ada berkas ${awalan}: ${pf.tersimpan.map((x) => x.nama).join(', ')}`)
  return b
}

/** Buka App pada laptop `pf` lalu masuk dengan kata sandi. */
async function masuk(u: UserEvent, pf: PlatformPalsu, label: 'Kata sandi admin' | 'Kata sandi aplikasi', sandi: string) {
  render(<App platform={pf} jedaSimpanMs={5} />)
  await u.type(await screen.findByLabelText(label, {}, { timeout: 20000 }), sandi)
  await u.click(screen.getByRole('button', { name: 'Masuk' }))
}

async function tutup(pf: PlatformPalsu) {
  await pf.penutup?.()
  cleanup()
}

/** Pengaturan awal "Aktifkan dengan kode" di laptop baru → kembalikan Kode Perangkat EXE yang tampil. */
async function buatKodeExe(u: UserEvent, pf: PlatformPalsu, label: string): Promise<string> {
  render(<App platform={pf} jedaSimpanMs={5} />)
  await screen.findByText('Pengaturan awal')
  await u.click(screen.getByRole('tab', { name: /Aktifkan dengan kode/ }))
  await u.type(screen.getByLabelText('Nama laptop ini'), label)
  await u.type(screen.getByLabelText('Kata sandi aplikasi'), SANDI_EXE)
  await u.type(screen.getByLabelText('Ulangi kata sandi aplikasi'), SANDI_EXE)
  await u.click(screen.getByRole('button', { name: 'Buat Kode Perangkat' }))
  const ta = (await screen.findByLabelText('Kode Perangkat EXE', {}, { timeout: 20000 })) as HTMLTextAreaElement
  expect(ta.value.startsWith('PPGD1.')).toBe(true)
  expect(screen.getByRole('img', { name: 'QR Kode Perangkat' })).toBeTruthy()
  await u.click(screen.getByRole('button', { name: 'Salin kode' }))
  expect(pf.disalin).toContain(ta.value)
  return ta.value
}

/** Tempel kode aktivasi di layar aktivasi (setelah masuk) → Beranda. */
async function aktifkan(u: UserEvent, token: string) {
  await u.click(await screen.findByLabelText('Kode aktivasi', {}, { timeout: 20000 }))
  await u.paste(token)
  await u.click(screen.getByRole('button', { name: 'Aktifkan' }))
  await screen.findByRole('heading', { level: 1, name: 'Beranda' }, { timeout: 20000 })
}

async function dbDari(pf: PlatformPalsu): Promise<Db> {
  await pf.penutup?.()
  return bukaDb(pf.db!)
}

interface Dunia {
  db: Db
  kunci: KunciAdmin
  ids: Record<'D' | 'desaA' | 'desaB' | 'A1' | 'A2' | 'B1' | 'ali' | 'budi' | 'citra', string>
}

async function dunia(): Promise<Dunia> {
  const db = await bukaDb()
  const kunci = await inisialisasiAdmin(db, { sandi: SANDI, namaOrganisasi: 'PPG Sorong Uji' })
  const D = tambahWilayah(db, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
  const desaA = tambahWilayah(db, { tingkat: 'desa', nama: 'Klasaman', kode: 'KLS', indukId: D.id })
  const desaB = tambahWilayah(db, { tingkat: 'desa', nama: 'Malanu', kode: 'MLN', indukId: D.id })
  const A1 = tambahWilayah(db, { tingkat: 'kelompok', nama: 'Klasaman 1', kode: 'A1', indukId: desaA.id })
  const A2 = tambahWilayah(db, { tingkat: 'kelompok', nama: 'Klasaman 2', kode: 'A2', indukId: desaA.id })
  const B1 = tambahWilayah(db, { tingkat: 'kelompok', nama: 'Malanu 1', kode: 'B1', indukId: desaB.id })
  const g = (k: string, nama: string, kategori: 'caberawit' | 'praremaja') => tambahGenerus(db, { kelompokId: k, nama, jenisKelamin: 'L', kategori, mulai: '2025-01-01' })
  const ali = g(A2.id, 'Ali', 'caberawit')
  const budi = g(A2.id, 'Budi', 'caberawit')
  const citra = g(A2.id, 'Citra', 'praremaja')
  g(A1.id, 'Hasan', 'caberawit')
  g(B1.id, 'Eka', 'caberawit')
  return { db, kunci, ids: { D: D.id, desaA: desaA.id, desaB: desaB.id, A1: A1.id, A2: A2.id, B1: B1.id, ali: ali.id, budi: budi.id, citra: citra.id } }
}

describe('EXE v3 — satu EXE untuk semua tingkat', () => {
  it('daerah → aktivasi EXE desa → desa terbitkan token mubaligh → impor setoran → setor ke daerah → beranda daerah: desa tepat waktu/terlambat', async () => {
    const u = userEvent.setup()
    const w = await dunia()
    const pfD = buatPlatformPalsu(simpanDb(w.db))
    const pfA = buatPlatformPalsu()

    // 1. Laptop desa: pengaturan awal "Aktifkan dengan kode" → Kode Perangkat EXE
    const kodeA = await buatKodeExe(u, pfA, 'EXE Desa Klasaman')
    await tutup(pfA)

    // 2. Daerah: jadwal setor, pengajian kelas, token EXE desa, paket desa, berkas materi
    await masuk(u, pfD, 'Kata sandi admin', SANDI)
    await screen.findByRole('heading', { level: 1, name: 'Beranda' }, { timeout: 20000 })
    expect(screen.getByTestId('peran-wilayah').textContent).toBe('Admin Daerah · Sorong')
    await buka(u, 'Jadwal Setor')
    await u.click(screen.getByRole('button', { name: 'Simpan jadwal Kelompok → Desa' }))
    await screen.findByText(/Jadwal Kelompok → Desa disimpan: Tiap Ahad pukul 21:00/)
    await u.click(screen.getByRole('button', { name: 'Simpan jadwal Desa → Daerah' }))
    await screen.findByText(/Jadwal Desa → Daerah disimpan: Tiap tanggal 5 pukul 12:00/)

    await buka(u, 'Pengajian')
    await u.click(screen.getByRole('button', { name: '+ Tambah pengajian' }))
    let dlg = await screen.findByRole('dialog')
    await pilihOpsi(u, 'Wilayah', /Klasaman 2/, dlg)
    await u.type(within(dlg).getByLabelText('Nama pengajian'), 'Kelas Caberawit')
    await u.click(within(dlg).getByRole('checkbox', { name: 'Caberawit A' }))
    await u.click(within(dlg).getByRole('button', { name: 'Simpan' }))
    const barisKelas = (await screen.findByText('Kelas Caberawit')).closest('tr')!
    expect(within(barisKelas).getByText('Caberawit A')).toBeTruthy()

    await buka(u, 'Perangkat & Token')
    await u.click(screen.getByLabelText('Kode Perangkat'))
    await u.paste(kodeA)
    await screen.findByText(/HP: EXE Desa Klasaman/)
    await pilihOpsi(u, 'Untuk', /EXE Desa/)
    await pilihOpsi(u, 'Wilayah tugas', /^Klasaman \(Desa/)
    await u.type(screen.getByLabelText('Nama pemegang'), 'Admin Desa Klasaman')
    await u.click(screen.getByRole('button', { name: 'Terbitkan token' }))
    dlg = await screen.findByRole('dialog', { name: 'Token untuk Admin Desa Klasaman' })
    const tokenA = (within(dlg).getByTestId('teks-token') as HTMLTextAreaElement).value
    await u.click(within(dlg).getByRole('button', { name: 'Tutup jendela' }))
    expect(within(screen.getByText('Admin Desa Klasaman').closest('tr')!).getByText('EXE Desa')).toBeTruthy()

    await buka(u, 'Kirim Paket')
    await pilihOpsi(u, 'Wilayah', /^\s*Klasaman \(Desa/)
    await u.click(screen.getByRole('button', { name: 'Buat & simpan paket' }))
    await screen.findByText(/Paket tersimpan/)
    const paketDesa = berkasTerakhir(pfD, 'PPG_PAKET_')
    await buka(u, 'Materi')
    await u.click(screen.getByRole('button', { name: 'Buat Berkas Materi' }))
    await waitFor(() => expect(pfD.tersimpan.some((b) => b.nama.startsWith('PPG_MATERI_'))).toBe(true))
    const materi = berkasTerakhir(pfD, 'PPG_MATERI_')
    await tutup(pfD)

    // 3. Desa: masuk → tempel kode aktivasi → menu desa
    await masuk(u, pfA, 'Kata sandi aplikasi', SANDI_EXE)
    await aktifkan(u, tokenA)
    expect(screen.getByTestId('peran-wilayah').textContent).toMatch(/^Admin Desa/)
    const nav = within(screen.getByRole('navigation', { name: 'Menu utama' }))
    for (const m of ['Setor ke Daerah', 'Impor Setoran', 'Buka Paket', 'Kirim Paket', 'Perangkat & Token', 'Generus & Data', 'Rekap & Laporan']) {
      expect(nav.getByRole('button', { name: new RegExp(m) })).toBeTruthy()
    }
    expect(nav.queryByRole('button', { name: /Wilayah/ })).toBeNull()
    expect(nav.queryByRole('button', { name: /Jadwal Setor/ })).toBeNull()

    await buka(u, 'Buka Paket')
    pfA.antreanBuka.push([paketDesa, materi])
    await u.click(screen.getByRole('button', { name: 'Pilih berkas paket' }))
    await screen.findByRole('heading', { name: 'Ringkasan impor' })
    expect(screen.getAllByText('Berhasil')).toHaveLength(2)
    expect(screen.getByTestId('peran-wilayah').textContent).toBe('Admin Desa · Klasaman')

    // desa menerbitkan token mubaligh untuk HP di kelompoknya
    const hp = await bukaDb()
    const { kodePerangkat } = await inisialisasiPerangkat(hp, 'HP Ust. Ahmad')
    await buka(u, 'Perangkat & Token')
    const peranOpsi = [...(screen.getByLabelText('Untuk') as HTMLSelectElement).options].map((o) => o.textContent)
    expect(peranOpsi.some((t) => /EXE Desa/.test(t ?? ''))).toBe(false)
    const opsiWilayah = [...(screen.getByLabelText('Wilayah tugas') as HTMLSelectElement).options].map((o) => o.textContent ?? '')
    expect(opsiWilayah.some((t) => /Malanu/.test(t))).toBe(false)
    await u.click(screen.getByLabelText('Kode Perangkat'))
    await u.paste(kodePerangkat)
    await pilihOpsi(u, 'Wilayah tugas', /Klasaman 2/)
    await u.type(screen.getByLabelText('Nama pemegang'), 'Ust. Ahmad')
    await u.click(screen.getByRole('button', { name: 'Terbitkan token' }))
    dlg = await screen.findByRole('dialog', { name: 'Token untuk Ust. Ahmad' })
    const tokenM = (within(dlg).getByTestId('teks-token') as HTMLTextAreaElement).value
    await u.click(within(dlg).getByRole('button', { name: 'Tutup jendela' }))
    await aktifkanProfil(hp, tokenM)

    // paket desa → HP; HP mencatat presensi lalu setor ke desa
    await buka(u, 'Kirim Paket')
    await pilihOpsi(u, 'Wilayah', /Klasaman 2/)
    await u.click(screen.getByRole('button', { name: 'Buat & simpan paket' }))
    await screen.findByText(/Paket tersimpan/)
    terapkanPaket(hp, berkasTerakhir(pfA, 'PPG_PAKET_').bytes)
    const generusHp = daftarGenerus(hp, { kelompokId: w.ids.A2 })
    expect(generusHp.map((g) => g.nama).sort()).toEqual(['Ali', 'Budi', 'Citra'])
    catatPresensiMassal(hp, { kelompokId: w.ids.A2, tanggal: tanggalHariIni(), daftar: generusHp.map((g) => ({ generusId: g.id, status: 'hadir' })) })
    const setorHp = buatSetor(hp)

    await buka(u, 'Impor Setoran')
    pfA.antreanBuka.push([{ nama: setorHp.nama, bytes: setorHp.bytes }])
    await u.click(screen.getByRole('button', { name: 'Pilih berkas setoran' }))
    await screen.findByRole('heading', { name: 'Ringkasan impor' })
    expect(screen.getAllByText(/Ust\. Ahmad/).length).toBeGreaterThan(0)

    // desa: usulan generus baru (lihat + usulan)
    await buka(u, 'Generus & Data')
    expect(screen.queryByRole('button', { name: 'Impor CSV' })).toBeNull()
    await u.click(screen.getByRole('button', { name: '+ Usulkan generus baru' }))
    dlg = await screen.findByRole('dialog', { name: 'Usulkan generus baru' })
    await pilihOpsi(u, 'Kelompok', /Klasaman 1/, dlg)
    await u.type(within(dlg).getByLabelText('Nama lengkap'), 'Zaid')
    await u.click(within(dlg).getByRole('button', { name: 'Ajukan usulan' }))
    await screen.findByText(/Usulan generus "Zaid" tersimpan/)

    // beranda desa: status setor tiap kelompok + tombol besar Setor ke Daerah
    await buka(u, 'Beranda')
    const tabelKel = screen.getByRole('table', { name: 'Status setor tiap kelompok' })
    expect(within(within(tabelKel).getByText('Klasaman 2').closest('tr')!).getByText('Tepat waktu')).toBeTruthy()
    // Fase 9b: belum pernah setor & tenggat pertama sejak aktivasi belum lewat → kuning "Belum ada setoran", bukan merah
    expect(within(within(tabelKel).getByText('Klasaman 1').closest('tr')!).getByText('Belum ada setoran')).toBeTruthy()
    expect(within(tabelKel).getByText('Klasaman 1').closest('tr')!.className).not.toMatch(/baris-merah/)
    expect(Number(screen.getByTestId('belum-disetor').textContent)).toBeGreaterThan(0)
    await u.click(within(screen.getByRole('main')).getByRole('button', { name: 'Setor ke Daerah' }))
    await screen.findByText(/disimpan\. Kirim ke /)
    const setorDesa = berkasTerakhir(pfA, 'PPG_SETOR_')
    await tutup(pfA)

    // 4. Daerah: impor setoran gabungan → beranda: Klasaman tepat waktu, Malanu belum ada setoran (Fase 9b)
    await masuk(u, pfD, 'Kata sandi admin', SANDI)
    await screen.findByRole('heading', { level: 1, name: 'Beranda' }, { timeout: 20000 })
    const tabelSebelum = screen.getByRole('table', { name: 'Status setor tiap desa' })
    expect(within(within(tabelSebelum).getByText('Klasaman').closest('tr')!).getByText('Belum ada setoran')).toBeTruthy()
    await buka(u, 'Impor Setoran')
    pfD.antreanBuka.push([setorDesa])
    await u.click(screen.getByRole('button', { name: 'Pilih berkas setoran' }))
    await screen.findByRole('heading', { name: 'Ringkasan impor' })
    expect(screen.getByText('Setoran gabungan')).toBeTruthy()
    await buka(u, 'Beranda')
    const tabelDesa = screen.getByRole('table', { name: 'Status setor tiap desa' })
    expect(within(within(tabelDesa).getByText('Klasaman').closest('tr')!).getByText('Tepat waktu')).toBeTruthy()
    expect(within(within(tabelDesa).getByText('Malanu').closest('tr')!).getByText('Belum ada setoran')).toBeTruthy()
    const dbD = await dbDari(pfD)
    expect(daftarPresensi(dbD, { kelompokIds: [w.ids.A2] })).toHaveLength(3)
    expect(daftarPerangkat(dbD).some((p) => p.nama === 'Ust. Ahmad')).toBe(true)
    expect(daftarUsulan(dbD).map((x) => (JSON.parse(x.data_json) as { nama?: string }).nama)).toContain('Zaid')
    expect(kategoriKelas(daftarPengajian(dbD).find((p) => p.nama === 'Kelas Caberawit'))).toEqual(['caberawit_a'])
  })

  it('kurikulum membuat target & berkas Kurikulum; daerah mengimpornya', async () => {
    const u = userEvent.setup()
    const w = await dunia()
    const pfK = buatPlatformPalsu()
    const kode = await buatKodeExe(u, pfK, 'EXE Kurikulum')
    await tutup(pfK)
    const tokenK = terbitkanToken(w.db, w.kunci, { kodePerangkat: kode, role: 'kurikulum', nama: 'Tim Kurikulum', wilayahId: w.ids.D })
    const materi = buatMateri(w.db, w.kunci)
    const pfD = buatPlatformPalsu(simpanDb(w.db))

    await masuk(u, pfK, 'Kata sandi aplikasi', SANDI_EXE)
    await aktifkan(u, tokenK)
    expect(screen.getByTestId('peran-wilayah').textContent).toMatch(/^Tim Kurikulum/)
    await buka(u, 'Buka Berkas Materi')
    pfK.antreanBuka.push([{ nama: materi.nama, bytes: materi.bytes }])
    await u.click(screen.getByRole('button', { name: 'Pilih berkas materi' }))
    await screen.findByRole('heading', { name: 'Ringkasan impor' })

    await buka(u, 'Target Capaian')
    const periode = periodeAktif(await bukaDb(pfK.db!))
    await screen.findByText(`Target Caberawit A — ${periode}`)
    await screen.findByText('Belum ada materi target. Tambahkan dari daftar materi di bawah, atau salin dari periode lain.')
    await pilihOpsi(u, 'Kategori materi', /Hafalan Surat/)
    const tersedia = screen.getByRole('table', { name: 'Materi tersedia' })
    const tambah = within(tersedia).getAllByRole('button', { name: '+ Tambah' })
    await u.click(tambah[0]!)
    await u.click(within(screen.getByRole('table', { name: 'Materi tersedia' })).getAllByRole('button', { name: '+ Tambah' })[0]!)
    const daftar = screen.getByRole('table', { name: 'Daftar target' })
    expect(within(daftar).getAllByRole('row')).toHaveLength(3)
    // tukar urutan: materi ke-2 naik ke atas
    const nama2 = within(daftar).getAllByRole('row')[2]!.querySelectorAll('td')[1]!.textContent
    await u.click(within(within(daftar).getAllByRole('row')[2]!).getByRole('button', { name: '↑ Naik' }))
    expect(within(screen.getByRole('table', { name: 'Daftar target' })).getAllByRole('row')[1]!.querySelectorAll('td')[1]!.textContent).toBe(nama2)
    expect(screen.getByText('Belum disimpan')).toBeTruthy()
    await u.click(screen.getByRole('button', { name: 'Simpan target' }))
    await screen.findByText(new RegExp(`Target Caberawit A ${periode} disimpan \\(2 materi\\)`))
    // salin ke periode berikutnya
    const select = screen.getByLabelText('Periode') as HTMLSelectElement
    const idx = [...select.options].findIndex((o) => o.value === periode)
    const berikut = select.options[idx + 1]!.value
    await u.selectOptions(select, berikut)
    await screen.findByText(`Target Caberawit A — ${berikut}`)
    await pilihOpsi(u, 'Salin dari periode', new RegExp(periode))
    await u.click(screen.getByRole('button', { name: 'Salin' }))
    await u.click(screen.getByRole('button', { name: 'Simpan target' }))
    await screen.findByText(new RegExp(`Target Caberawit A ${berikut} disimpan \\(2 materi\\)`))
    await u.click(screen.getByRole('button', { name: 'Jadikan periode aktif' }))
    await screen.findAllByText('Periode aktif')

    await u.click(screen.getByRole('button', { name: 'Buat berkas Kurikulum' }))
    await screen.findByText(/PPG_KURIKULUM_.*disimpan\. Kirim ke Admin Daerah/)
    const berkasKur = berkasTerakhir(pfK, 'PPG_KURIKULUM_')
    await tutup(pfK)

    // daerah mengimpor berkas KURIKULUM di Impor Setoran
    await masuk(u, pfD, 'Kata sandi admin', SANDI)
    await screen.findByRole('heading', { level: 1, name: 'Beranda' }, { timeout: 20000 })
    await buka(u, 'Impor Setoran')
    pfD.antreanBuka.push([berkasKur])
    await u.click(screen.getByRole('button', { name: 'Pilih berkas setoran' }))
    await screen.findByRole('heading', { name: 'Ringkasan impor' })
    expect(screen.getByText('Kurikulum')).toBeTruthy()
    expect(screen.getByText(/Dari/).textContent).toMatch(/Tim Kurikulum/)
    await buka(u, 'Target Capaian')
    await screen.findByText(`Target Caberawit A — ${berikut}`)
    expect(within(screen.getByRole('table', { name: 'Daftar target' })).getAllByRole('row')).toHaveLength(3)
    const dbD = await dbDari(pfD)
    expect(periodeAktif(dbD)).toBe(berikut)
    expect(daftarTarget(dbD, { periode, kategoriGenerus: 'caberawit' }).map((m) => m.nama)[0]).toBe(nama2)
  })

  it('EXE kelompok: aktivasi dari desa, buka paket, absen pertemuan dengan saran materi & tuntas, rekap capaian, setor ke desa', async () => {
    const u = userEvent.setup()
    const w = await dunia()
    // daerah: kelas + target (core)
    const kelas = tambahPengajian(w.db, { wilayahId: w.ids.A2, nama: 'Kelas Caberawit', hari: 1, jam: '19:00', kategoriGenerus: ['caberawit'] })
    const materiIds = daftarMateri(w.db, { kategoriGenerus: 'caberawit' }).slice(0, 2).map((m) => m.id)
    tetapkanTarget(w.db, { periode: periodeAktif(w.db), kategoriGenerus: 'caberawit', materiIds })
    // EXE desa (core)
    const dbDesa = await bukaDb()
    const { kodePerangkat: kodeDesa, kunci: kDesa } = await inisialisasiExe(dbDesa, { sandi: SANDI_EXE, label: 'EXE Desa' })
    await aktifkanExe(dbDesa, kDesa, terbitkanToken(w.db, w.kunci, { kodePerangkat: kodeDesa, role: 'admin', nama: 'Admin Desa', wilayahId: w.ids.desaA }))
    terapkanPaket(dbDesa, buatPaket(w.db, w.ids.desaA, w.kunci).bytes)
    const materi = buatMateri(w.db, w.kunci)
    terapkanMateri(dbDesa, materi.bytes)

    // laptop kelompok: kode → desa menerbitkan EXE kelompok → aktivasi
    const pfK = buatPlatformPalsu()
    const kode = await buatKodeExe(u, pfK, 'EXE Kelompok Klasaman 2')
    await tutup(pfK)
    const tokenK = terbitkanTokenBawah(dbDesa, kDesa, { kodePerangkat: kode, role: 'admin', nama: 'Admin Kelompok', wilayahId: w.ids.A2 })
    const paketK = buatPaket(dbDesa, w.ids.A2, kDesa)

    await masuk(u, pfK, 'Kata sandi aplikasi', SANDI_EXE)
    await aktifkan(u, tokenK)
    await buka(u, 'Buka Paket')
    pfK.antreanBuka.push([{ nama: paketK.nama, bytes: paketK.bytes }, { nama: materi.nama, bytes: materi.bytes }])
    await u.click(screen.getByRole('button', { name: 'Pilih berkas paket' }))
    await screen.findByRole('heading', { name: 'Ringkasan impor' })
    // Fase 8: materi sudah ikut di paket desa → berkas materi yang dipilih bersamaan tercatat sudah terpasang
    expect(screen.getAllByText('Berhasil')).toHaveLength(1)
    expect(screen.getByText('Sudah pernah diimpor')).toBeTruthy()
    expect(screen.getByTestId('peran-wilayah').textContent).toBe('Admin Kelompok · Klasaman 2')

    // Absen pertemuan: kelas caberawit → saran materi → tandai hadir & tuntas
    await buka(u, 'Absen Pertemuan')
    await pilihOpsi(u, 'Kelas / pengajian', /Kelas Caberawit/)
    await u.click(screen.getByRole('button', { name: 'Buka pertemuan' }))
    await screen.findByText('Saran materi (paling banyak belum tuntas)')
    await u.click(screen.getAllByRole('button', { name: '+ Pakai' })[0]!)
    const lembar = await screen.findByRole('table', { name: 'Lembar absen' })
    // kelas caberawit: Citra (praremaja) tidak tampil
    expect(within(lembar).queryByText('Citra')).toBeNull()
    expect(within(lembar).getByText('Ali')).toBeTruthy()
    await u.selectOptions(within(lembar).getByLabelText('Kehadiran Budi'), 'alpa')
    expect((within(lembar).getAllByRole('checkbox').find((c) => c.getAttribute('aria-label')?.startsWith('Budi')) as HTMLInputElement).disabled).toBe(true)
    await u.click(within(lembar).getAllByRole('checkbox').find((c) => c.getAttribute('aria-label')?.startsWith('Ali'))!)
    await u.click(screen.getByRole('button', { name: 'Simpan absen' }))
    await screen.findByText(/Absen tersimpan: 2 generus, 1 materi tuntas/)
    await within(screen.getByRole('table', { name: 'Lembar absen' })).findByText('Sudah tuntas')

    // Rekap kelompok: capaian target + Excel
    await buka(u, 'Rekap & Laporan')
    await screen.findByRole('heading', { name: /^Capaian target/ })
    const capKel = screen.getByRole('table', { name: 'Capaian per kelompok' })
    expect(within(capKel).getByText('1/4')).toBeTruthy()
    expect(within(capKel).getByText('25%')).toBeTruthy()
    await u.click(screen.getByRole('button', { name: 'Ekspor Excel' }))
    await waitFor(() => expect(pfK.tersimpan.some((b) => b.nama.endsWith('.xlsx'))).toBe(true), { timeout: 20000 })
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(berkasTerakhir(pfK, 'Rekap_').bytes.buffer as ArrayBuffer)
    const ws = wb.getWorksheet('Capaian per Generus')!
    const ali = [1, 2, 3, 4, 5, 6].map((i) => ws.getRow(i).getCell(1).value).indexOf('Ali') + 1
    expect(ws.getRow(ali).getCell(6).value).toBe(50)

    // Setor ke Desa → desa mengimpor
    await buka(u, 'Setor ke Desa')
    await u.click(within(screen.getByRole('main')).getByRole('button', { name: 'Setor ke Desa' }))
    await screen.findByText(/disimpan\. Kirim ke /)
    const setorK = berkasTerakhir(pfK, 'PPG_SETOR_')
    const dbK = await dbDari(pfK)
    expect(infoInstalasi(dbK).peran).toBe('kelompok')
    expect(daftarPresensi(dbK, { kelompokIds: [w.ids.A2] })).toHaveLength(2)
    await bukaKunciExe(dbDesa, SANDI_EXE)
    const { imporSetor } = await import('@ppg/core')
    imporSetor(dbDesa, setorK.bytes, kDesa)
    expect(daftarKemajuan(dbDesa, { generusIds: [w.ids.ali] }).filter((k) => k.status_sah === 'disahkan')).toHaveLength(1)
    expect(daftarWilayah(dbK, { tingkat: 'kelompok' }).length).toBeGreaterThan(0)
    expect(kelas.id).toBeTruthy()
  })

  it('database lama (v2) terbuka sebagai EXE daerah tanpa langkah tambahan', async () => {
    const u = userEvent.setup()
    const baca = (n: string) => gunzipSync(new Uint8Array(readFileSync(join(__dirname, '../../../packages/core/test/fixtur', n))))
    const info = JSON.parse(new TextDecoder().decode(baca('v2-info.json.gz'))) as Record<string, string>
    const pf = buatPlatformPalsu(baca('v2-admin.db.gz'))
    await masuk(u, pf, 'Kata sandi admin', info.sandi!)
    await screen.findByRole('heading', { level: 1, name: 'Beranda' }, { timeout: 20000 })
    expect(screen.getByTestId('peran-wilayah').textContent).toMatch(/^Admin Daerah/)
    expect(within(screen.getByRole('navigation', { name: 'Menu utama' })).getByRole('button', { name: /Jadwal Setor/ })).toBeTruthy()
    screen.getByRole('table', { name: 'Status setor tiap desa' })
  })
})
