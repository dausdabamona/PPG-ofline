// Pembantu uji UI HP: dunia admin (core), menjalankan/menutup aplikasi, aktivasi token, navigasi.
import { expect } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import {
  bacaHeader,
  bukaDb,
  buatMateri,
  inisialisasiAdmin,
  tambahGenerus,
  tambahPengajian,
  tambahWilayah,
  type Db,
  type Generus,
  type KunciAdmin,
  type Wilayah,
} from '@ppg/core'
import { App } from '../src/App'
import type { BerkasKirim } from '../src/platform'
import type { PlatformPalsu } from './platform-palsu'

export interface DuniaAdmin {
  db: Db
  kunci: KunciAdmin
  k1: Wilayah
  k2: Wilayah
  g: Generus[]
  materi: BerkasKirim
}

/** Admin + daerah/desa/2 kelompok + 3 generus caberawit di K1 + pengajian rutin tiap hari + berkas MATERI. */
export async function siapkanAdmin(): Promise<DuniaAdmin> {
  const db = await bukaDb()
  const kunci = await inisialisasiAdmin(db, { sandi: 'sandi-admin-123', namaOrganisasi: 'PPG Sorong Uji' })
  const daerah = tambahWilayah(db, { tingkat: 'daerah', nama: 'Sorong', kode: 'SRG' })
  const desa = tambahWilayah(db, { tingkat: 'desa', nama: 'Klasaman', kode: 'KLS', indukId: daerah.id })
  const k1 = tambahWilayah(db, { tingkat: 'kelompok', nama: 'Klasaman 1', kode: 'K1', indukId: desa.id })
  const k2 = tambahWilayah(db, { tingkat: 'kelompok', nama: 'Klasaman 2', kode: 'K2', indukId: desa.id })
  const g = ['Ali', 'Budi', 'Citra'].map((nama, i) =>
    tambahGenerus(db, {
      kelompokId: k1.id,
      nama,
      jenisKelamin: i === 2 ? 'P' : 'L',
      kategori: 'caberawit',
      mulai: '2026-01-01',
      waliNama: i < 2 ? 'Pak Fauzi' : 'Bu Aminah',
      waliNoHp: i < 2 ? '081234567890' : null,
    }),
  )
  for (let hari = 0; hari < 7; hari++) tambahPengajian(db, { wilayahId: k1.id, nama: 'Pengajian Caberawit', hari, jam: '16:00' })
  const m = buatMateri(db, kunci)
  return { db, kunci, k1, k2, g, materi: { nama: m.nama, bytes: m.bytes } }
}

export async function jeda(ms = 30): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })
}

export function mulai(pf: PlatformPalsu): void {
  render(<App platform={pf} jedaSimpanMs={5} />)
}

/** Tutup aplikasi seperti HP ke latar belakang (simpan), lalu lepas. */
export async function tutup(pf: PlatformPalsu): Promise<void> {
  await jeda(30)
  act(() => pf.keLatar())
  await jeda(30)
  cleanup()
}

/** Layar sambut → nama HP → kembalikan teks Kode Perangkat. */
export async function sambut(u: UserEvent, pf: PlatformPalsu, nama: string): Promise<string> {
  mulai(pf)
  await u.type(await screen.findByLabelText('Nama HP ini', {}, { timeout: 30000 }), nama)
  await u.click(screen.getByRole('button', { name: 'Lanjut' }))
  const kode = await screen.findByTestId('kode-perangkat', {}, { timeout: 20000 })
  expect(screen.getByRole('img', { name: 'QR Kode Perangkat' })).toBeTruthy()
  return kode.textContent ?? ''
}

/** Di layar awal: tempel token (+ PIN opsional) lalu aktifkan. */
export async function aktifkan(u: UserEvent, token: string, pin?: string): Promise<void> {
  await u.click(await screen.findByRole('button', { name: 'Tempel Token' }))
  await u.click(screen.getByLabelText('Token'))
  await u.paste(token)
  if (pin) await u.type(screen.getByLabelText('PIN 4 angka (boleh kosong)'), pin)
  await u.click(screen.getByRole('button', { name: 'Aktifkan' }))
  await screen.findByRole('navigation', { name: 'Menu utama' }, { timeout: 20000 })
}

export async function nav(u: UserEvent, teks: string): Promise<void> {
  await u.click(within(screen.getByRole('navigation', { name: 'Menu utama' })).getByRole('button', { name: new RegExp(teks) }))
}

export async function bukaAkun(u: UserEvent): Promise<void> {
  await u.click(screen.getByRole('button', { name: /^Profil:/ }))
  await screen.findByRole('heading', { level: 1, name: 'Profil & HP' })
}

/** Berkas terakhir yang dibagikan dengan awalan nama tertentu. */
export function dibagikan(pf: PlatformPalsu, awalan: string): BerkasKirim {
  const b = [...pf.dibagikan].reverse().find((x) => x.nama.startsWith(awalan))
  if (!b) throw new Error(`Belum ada berkas ${awalan}: ${pf.dibagikan.map((x) => x.nama).join(', ')}`)
  return b
}

/** Berkas BALASAN untuk perangkat tertentu. */
export function balasanUntuk(daftar: BerkasKirim[], perangkatId: string): BerkasKirim {
  const b = daftar.find((x) => x.nama.startsWith('PPG_BALASAN_') && bacaHeader(x.bytes).penerima_perangkat_id === perangkatId)
  if (!b) throw new Error(`Tidak ada balasan untuk ${perangkatId}`)
  return b
}

export async function tungguTeks(pola: RegExp, timeout = 20000): Promise<HTMLElement> {
  return screen.findByText(pola, {}, { timeout })
}

export { waitFor }
