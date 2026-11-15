// Opsional (tidak ikut npm test): uji asap EXE v3 untuk tiap peran di Chrome headless (butuh `playwright-core` + Chrome).
// Jalankan: npm run build -w apps/desktop && node apps/desktop/uji-peramban/uji-asap-v3.mjs "$PWD/apps/desktop/dist" [folder-tangkapan]
// Tiap laptop (daerah, desa, kelompok, kurikulum) = satu konteks peramban sendiri (localStorage terpisah);
// berkas berpindah lewat unduhan → pemilih berkas, kode/token lewat teks — meniru WA.
import { createServer } from 'node:http'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, extname } from 'node:path'
import { chromium } from 'playwright-core'

const DIST = process.argv[2]
const KELUAR = process.argv[3] ?? '.'
mkdirSync(KELUAR, { recursive: true })
const CSP = ["default-src 'self'", "script-src 'self' 'wasm-unsafe-eval'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self' data:", "connect-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'"].join('; ')
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' }
const srv = createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname
  const p = join(DIST, decodeURIComponent(path === '/' ? '/index.html' : path))
  if (!p.startsWith(DIST) || !existsSync(p)) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] ?? 'application/octet-stream', 'Content-Security-Policy': CSP })
  res.end(readFileSync(p))
}).listen(4318)

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const galat = []
const kecil = new Set()
async function laptop(nama) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, acceptDownloads: true })
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error') galat.push(`${nama}: ${m.text()}`) })
  page.on('pageerror', (e) => galat.push(`${nama}: ${e}`))
  await page.goto('http://localhost:4318/')
  await page.getByText('Pengaturan awal').waitFor({ timeout: 30000 })
  return page
}
const menu = (page, teks) => page.getByRole('navigation').getByRole('button', { name: new RegExp(`^.?${teks}$`) }).click()
const judul = (page, teks) => page.getByRole('heading', { level: 1, name: teks }).waitFor({ timeout: 30000 })
async function unduh(page, aksi) {
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), aksi()])
  const path = join(KELUAR, d.suggestedFilename())
  await d.saveAs(path)
  return path
}
async function pilihBerkas(page, tombol, paths) {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: tombol }).click()])
  await fc.setFiles(paths)
}
async function periksaTombol(page, nama) {
  const n = await page.evaluate(() =>
    [...document.querySelectorAll('button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5 && !b.classList.contains('tutup-modal') && !b.closest('.toast') }).map((b) => b.textContent.trim()),
  )
  for (const t of n) kecil.add(`${nama}: ${t}`)
}
async function kodeExe(page, label) {
  await page.getByRole('tab', { name: /Aktifkan dengan kode/ }).click()
  await page.getByLabel('Nama laptop ini').fill(label)
  await page.getByLabel('Kata sandi aplikasi', { exact: true }).fill('sandi-exe-123')
  await page.getByLabel('Ulangi kata sandi aplikasi').fill('sandi-exe-123')
  await page.getByRole('button', { name: 'Buat Kode Perangkat' }).click()
  const ta = page.getByLabel('Kode Perangkat EXE')
  await ta.waitFor({ timeout: 30000 })
  await page.getByRole('img', { name: 'QR Kode Perangkat' }).waitFor()
  return ta.inputValue()
}
async function aktifkan(page, token, nama) {
  await page.getByLabel('Kode aktivasi').fill(token)
  await page.getByRole('button', { name: 'Aktifkan' }).click()
  await judul(page, 'Beranda')
  await page.screenshot({ path: join(KELUAR, `v3-${nama}-beranda.png`), fullPage: true })
}
async function terbit(page, kode, untuk, wilayah, nama) {
  await menu(page, 'Perangkat & Token')
  await page.getByLabel('Kode Perangkat').fill(kode)
  await page.getByLabel('Untuk').selectOption({ label: untuk })
  const sel = page.getByLabel('Wilayah tugas')
  const opsi = await sel.locator('option').allTextContents()
  await sel.selectOption({ label: opsi.find((o) => o.trim().startsWith(wilayah)) })
  await page.getByLabel('Nama pemegang').fill(nama)
  await page.getByRole('button', { name: 'Terbitkan token' }).click()
  const t = await page.getByTestId('teks-token').inputValue()
  await page.getByRole('button', { name: 'Tutup jendela' }).click()
  return t
}
async function paket(page, wilayah) {
  await menu(page, 'Kirim Paket')
  const sel = page.getByLabel('Wilayah', { exact: true })
  const opsi = await sel.locator('option').allTextContents()
  await sel.selectOption({ label: opsi.find((o) => o.trim().startsWith(wilayah)) })
  return unduh(page, () => page.getByRole('button', { name: 'Buat & simpan paket' }).click())
}

// ---------- daerah ----------
const D = await laptop('daerah')
await D.getByLabel('Kata sandi admin').fill('sandi-admin-123')
await D.getByLabel('Ulangi kata sandi').fill('sandi-admin-123')
await D.getByRole('button', { name: 'Buat database admin' }).click()
await judul(D, 'Beranda')
await menu(D, 'Wilayah')
await D.getByRole('button', { name: '+ Tambah daerah' }).click()
await D.getByLabel('Nama daerah').fill('Sorong')
await D.getByRole('dialog').getByRole('button', { name: 'Simpan' }).click()
await D.getByRole('button', { name: '+ Desa' }).click()
await D.getByLabel('Nama desa').fill('Klasaman')
await D.getByRole('dialog').getByRole('button', { name: 'Simpan' }).click()
await D.getByRole('button', { name: '+ Desa' }).click()
await D.getByLabel('Nama desa').fill('Malanu')
await D.getByRole('dialog').getByRole('button', { name: 'Simpan' }).click()
await D.getByText('Malanu', { exact: true }).waitFor()
await D.getByRole('button', { name: '+ Kelompok' }).first().click()
await D.getByLabel('Nama kelompok').fill('Klasaman 1')
await D.getByRole('dialog').getByRole('button', { name: 'Simpan' }).click()
await D.getByText('Klasaman 1', { exact: true }).waitFor()
await menu(D, 'Pengajian')
await D.getByRole('button', { name: '+ Tambah pengajian' }).click()
const dlgP = D.getByRole('dialog')
const opsiP = await dlgP.getByLabel('Wilayah').locator('option').allTextContents()
await dlgP.getByLabel('Wilayah').selectOption({ label: opsiP.find((o) => o.includes('Klasaman 1')) })
await dlgP.getByLabel('Nama pengajian').fill('Kelas Caberawit')
await dlgP.getByRole('checkbox', { name: 'Caberawit' }).check()
await dlgP.getByRole('button', { name: 'Simpan' }).click()
await D.getByText('Kelas Caberawit').waitFor()
await menu(D, 'Jadwal Setor')
await D.getByRole('button', { name: 'Simpan jadwal Kelompok → Desa' }).click()
await D.getByRole('button', { name: 'Simpan jadwal Desa → Daerah' }).click()
await D.getByText(/Jadwal Desa → Daerah disimpan/).waitFor()
await D.screenshot({ path: join(KELUAR, 'v3-daerah-jadwal.png'), fullPage: true })
await periksaTombol(D, 'daerah-jadwal')

// ---------- kode EXE desa, kelompok, kurikulum ----------
const A = await laptop('desa')
const kodeA = await kodeExe(A, 'EXE Desa Klasaman')
await A.screenshot({ path: join(KELUAR, 'v3-desa-aktivasi.png'), fullPage: true })
const K = await laptop('kelompok')
const kodeK = await kodeExe(K, 'EXE Kelompok Klasaman 1')
const R = await laptop('kurikulum')
const kodeR = await kodeExe(R, 'EXE Kurikulum')

// ---------- daerah menerbitkan EXE desa & kurikulum, paket desa, materi ----------
const tokA = await terbit(D, kodeA, 'EXE Desa (aplikasi laptop desa)', 'Klasaman (Desa', 'Admin Desa Klasaman')
const tokR = await terbit(D, kodeR, 'EXE Kurikulum (tim kurikulum)', 'Sorong (Daerah', 'Tim Kurikulum')
await D.screenshot({ path: join(KELUAR, 'v3-daerah-perangkat.png'), fullPage: true })
const paketA = await paket(D, 'Klasaman (Desa')
await menu(D, 'Materi')
const materi = await unduh(D, () => D.getByRole('button', { name: 'Buat Berkas Materi' }).click())

// ---------- desa ----------
await aktifkan(A, tokA, 'desa')
await menu(A, 'Buka Paket')
await pilihBerkas(A, 'Pilih berkas paket', [paketA, materi])
await A.getByRole('heading', { name: 'Ringkasan impor' }).waitFor()
await A.getByText('Admin Desa · Klasaman').waitFor()
const tokK = await terbit(A, kodeK, 'EXE Kelompok (aplikasi laptop kelompok)', 'Klasaman 1', 'Admin Kelompok 1')
const paketK = await paket(A, 'Klasaman 1')
await menu(A, 'Beranda')
await A.getByRole('table', { name: 'Status setor tiap kelompok' }).waitFor()
await A.screenshot({ path: join(KELUAR, 'v3-desa-beranda-paket.png'), fullPage: true })
await periksaTombol(A, 'desa-beranda')

// ---------- kelompok ----------
await aktifkan(K, tokK, 'kelompok')
await menu(K, 'Buka Paket')
await pilihBerkas(K, 'Pilih berkas paket', [paketK, materi])
await K.getByRole('heading', { name: 'Ringkasan impor' }).waitFor()
await menu(K, 'Absen Pertemuan')
const opsiK = await K.getByLabel('Kelas / pengajian').locator('option').allTextContents()
await K.getByLabel('Kelas / pengajian').selectOption({ label: opsiK.find((o) => o.includes('Kelas Caberawit')) })
await K.getByRole('button', { name: 'Buka pertemuan' }).click()
await K.getByRole('heading', { name: /2\. Materi hari ini/ }).waitFor()
await K.screenshot({ path: join(KELUAR, 'v3-kelompok-absen.png'), fullPage: true })
await periksaTombol(K, 'kelompok-absen')
await menu(K, 'Setor ke Desa')
const setorK = await unduh(K, () => K.getByRole('main').getByRole('button', { name: 'Setor ke Desa' }).click())

// ---------- desa impor setoran kelompok → setor ke daerah ----------
await menu(A, 'Impor Setoran')
await pilihBerkas(A, 'Pilih berkas setoran', [setorK])
await A.getByRole('heading', { name: 'Ringkasan impor' }).waitFor()
await menu(A, 'Setor ke Daerah')
const setorA = await unduh(A, () => A.getByRole('main').getByRole('button', { name: 'Setor ke Daerah' }).click())
await A.screenshot({ path: join(KELUAR, 'v3-desa-setor.png'), fullPage: true })

// ---------- kurikulum ----------
await aktifkan(R, tokR, 'kurikulum')
await menu(R, 'Buka Berkas Materi')
await pilihBerkas(R, 'Pilih berkas materi', [materi])
await R.getByRole('heading', { name: 'Ringkasan impor' }).waitFor()
await menu(R, 'Target Capaian')
await R.getByLabel('Kategori materi').selectOption({ label: 'ALM-HFS — Hafalan Surat' })
await R.getByRole('table', { name: 'Materi tersedia' }).getByRole('button', { name: '+ Tambah' }).first().click()
await R.getByRole('table', { name: 'Materi tersedia' }).getByRole('button', { name: '+ Tambah' }).first().click()
await R.getByRole('button', { name: 'Simpan target' }).click()
await R.getByText(/disimpan \(2 materi\)/).waitFor()
await R.screenshot({ path: join(KELUAR, 'v3-kurikulum-target.png'), fullPage: true })
await periksaTombol(R, 'kurikulum-target')
const kur = await unduh(R, () => R.getByRole('main').getByRole('button', { name: 'Buat berkas Kurikulum' }).click())

// ---------- daerah: impor setoran desa + kurikulum → beranda ----------
await menu(D, 'Impor Setoran')
await pilihBerkas(D, 'Pilih berkas setoran', [setorA, kur])
await D.getByRole('heading', { name: 'Ringkasan impor' }).waitFor()
await D.getByText('Setoran gabungan').waitFor()
await menu(D, 'Beranda')
const tabel = D.getByRole('table', { name: 'Status setor tiap desa' })
await tabel.waitFor()
const klas = await tabel.locator('tr', { hasText: 'Klasaman' }).textContent()
const mal = await tabel.locator('tr', { hasText: 'Malanu' }).textContent()
console.log('STATUS KLASAMAN:', klas)
console.log('STATUS MALANU:', mal)
if (!klas.includes('Tepat waktu') || !mal.includes('Terlambat')) throw new Error('Status setor desa tidak sesuai')
await D.screenshot({ path: join(KELUAR, 'v3-daerah-beranda.png'), fullPage: true })
await periksaTombol(D, 'daerah-beranda')
await menu(D, 'Rekap & Laporan')
const selR = D.getByLabel('Wilayah', { exact: true })
await selR.selectOption({ index: 1 })
await D.getByRole('heading', { name: /^Capaian target/ }).waitFor()
const xlsx = await unduh(D, () => D.getByRole('button', { name: 'Ekspor Excel' }).click())
console.log('UNDUH', xlsx)
await D.screenshot({ path: join(KELUAR, 'v3-daerah-rekap.png'), fullPage: true })

// muat ulang EXE desa: tetap desa (localStorage) → layar masuk dengan kata sandi aplikasi
await A.reload()
await A.getByLabel('Kata sandi aplikasi').fill('sandi-exe-123')
await A.getByRole('button', { name: 'Masuk' }).click()
await judul(A, 'Beranda')
await A.getByText('Admin Desa · Klasaman').waitFor()

console.log('GALAT KONSOL:', JSON.stringify(galat))
console.log('TOMBOL < 44 px:', JSON.stringify([...kecil]))
console.log('OK')
await browser.close()
srv.close()
