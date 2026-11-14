// Opsional (tidak ikut npm test): butuh `playwright-core` dan Chrome terpasang.
// Jalankan: npm run build -w apps/desktop && node apps/desktop/uji-peramban/uji-asap.mjs "$PWD/apps/desktop/dist"
// (atur CHROME=/path/chrome bila bukan /usr/bin/google-chrome).
// Uji asap: layani dist/ dengan CSP produksi yang sama seperti Electron, jalankan alur awal di Chrome headless.
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import { chromium } from 'playwright-core'

const DIST = process.argv[2]
const CSP = ["default-src 'self'", "script-src 'self' 'wasm-unsafe-eval'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self' data:", "connect-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'"].join('; ')
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm' }
const srv = createServer((req, res) => {
  const p = join(DIST, decodeURIComponent(new URL(req.url, 'http://x').pathname === '/' ? '/index.html' : new URL(req.url, 'http://x').pathname))
  if (!p.startsWith(DIST) || !existsSync(p)) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] ?? 'application/octet-stream', 'Content-Security-Policy': CSP })
  res.end(readFileSync(p))
}).listen(4317)

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1366, height: 860 } })
const galat = []
page.on('console', (m) => { if (m.type() === 'error') galat.push(m.text()) })
page.on('pageerror', (e) => galat.push(String(e)))
await page.goto('http://localhost:4317/')
await page.getByText('Pengaturan awal').waitFor({ timeout: 20000 })
await page.getByLabel('Kata sandi admin').fill('sandi-admin-123')
await page.getByLabel('Ulangi kata sandi').fill('sandi-admin-123')
await page.getByRole('button', { name: 'Buat database admin' }).click()
await page.getByRole('heading', { level: 1, name: 'Beranda' }).waitFor({ timeout: 30000 })
await page.screenshot({ path: './uji-asap-beranda.png' })
await page.getByRole('navigation').getByRole('button', { name: /Wilayah/ }).click()
await page.getByRole('button', { name: '+ Tambah daerah' }).click()
await page.getByLabel('Nama daerah').fill('Sorong')
await page.getByRole('dialog').getByRole('button', { name: 'Simpan' }).click()
await page.getByText('Sorong', { exact: true }).waitFor()
await page.getByRole('navigation').getByRole('button', { name: /Materi/ }).click()
await page.getByText('Belum ada materi di kategori ini.').or(page.locator('table.tabel')).first().waitFor()
await page.getByLabel('Kategori materi').selectOption({ label: 'ALM-HFS — Hafalan Surat' })
await page.locator('table.tabel tbody tr').first().waitFor()
await page.screenshot({ path: './uji-asap-materi.png' })
// muat ulang: database tersimpan (localStorage) → layar masuk
await page.waitForTimeout(1500)
await page.reload()
await page.getByRole('button', { name: 'Masuk' }).waitFor({ timeout: 20000 })
await page.getByLabel('Kata sandi admin').fill('sandi-admin-123')
await page.getByRole('button', { name: 'Masuk' }).click()
await page.getByRole('heading', { level: 1, name: 'Beranda' }).waitFor({ timeout: 30000 })
await page.getByRole('navigation').getByRole('button', { name: /Wilayah/ }).click()
await page.getByText('Sorong', { exact: true }).waitFor()
await page.getByRole('navigation').getByRole('button', { name: /Perangkat/ }).click()
await page.screenshot({ path: './uji-asap-perangkat.png', fullPage: true })
await page.getByRole('navigation').getByRole('button', { name: /Rekap/ }).click()
await page.getByLabel('Wilayah').selectOption({ index: 1 })
await page.getByRole('heading', { name: 'Presensi per kelompok' }).waitFor()
const [unduh] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByRole('button', { name: 'Ekspor Excel' }).click()])
console.log('UNDUH', unduh.suggestedFilename())
await page.getByRole('navigation').getByRole('button', { name: /Generus/ }).click()
const [templat] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Unduh templat CSV' }).click()])
console.log('UNDUH', templat.suggestedFilename())
console.log('GALAT KONSOL:', JSON.stringify(galat))
console.log('OK')
await browser.close()
srv.close()
