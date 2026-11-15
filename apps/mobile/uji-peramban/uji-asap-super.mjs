// Opsional (tidak ikut npm test): uji asap Super Admin HP di Chrome 360×740. Jalankan dari akar repo:
//   npm run build -w apps/mobile
//   npx rolldown apps/mobile/uji-peramban/admin-uji-super.ts --platform node --format cjs --external sql.js --external libsodium-wrappers \
//     --external fflate -o apps/mobile/node_modules/.uji/admin-uji-super.cjs
//   node apps/mobile/uji-peramban/uji-asap-super.mjs "$PWD/apps/mobile/dist" "$PWD/apps/mobile/node_modules/.uji/admin-uji-super.cjs"
// Alur: sambut → Aktifkan sebagai Super Admin HP → kata sandi → Kode Perangkat (QR ≥ 280 px) → token → paket daerah →
// tambah generus → token orang tua (QR berseri) → Setor ke Daerah (diimpor admin tiruan) → muat ulang → Pilih Profil → sandi.
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import { pathToFileURL } from 'node:url'

const [DIST, ADMIN] = process.argv.slice(2)
const PORT = Number(process.env.PORT ?? 4319)
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright-core')
const modAdmin = await import(pathToFileURL(ADMIN).href)
const siapkan = modAdmin.siapkan ?? modAdmin.default.siapkan
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' }
const srv = createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname
  const p = join(DIST, decodeURIComponent(path === '/' ? '/index.html' : path))
  if (!p.startsWith(DIST) || !existsSync(p)) {
    res.writeHead(404)
    return res.end()
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] ?? 'application/octet-stream' })
  res.end(readFileSync(p))
}).listen(PORT)

const admin = await siapkan()
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true })
const page = await ctx.newPage()
const galat = []
page.on('console', (m) => {
  if (m.type() === 'error') galat.push(m.text())
})
page.on('pageerror', (e) => galat.push(String(e)))
page.on('response', (r) => {
  if (r.status() >= 400) galat.push(`${r.status()} ${r.url()}`)
})
const foto = (n) => page.screenshot({ path: `./uji-asap-super-${n}.png`, fullPage: false })
const ukurTombol = () =>
  page.$$eval('button', (bs) => bs.filter((b) => b.offsetParent !== null).map((b) => ({ t: b.textContent?.trim(), h: b.getBoundingClientRect().height })).filter((x) => x.h < 44))
const kecil = []
const ukurQr = async (nama) => {
  const k = await page.getByRole('img', { name: nama }).first().boundingBox()
  if (!k || k.width < 280) galat.push(`QR "${nama}" hanya ${k?.width ?? 0} px`)
}
const navKe = (t) => page.getByRole('navigation', { name: 'Menu Super Admin' }).getByRole('button', { name: new RegExp(t) }).click()
const SANDI = 'sandi-super-123'

await page.goto(`http://localhost:${PORT}/`)
await page.getByRole('button', { name: 'Aktifkan sebagai Super Admin HP' }).click()
await page.getByLabel('Nama HP ini').fill('HP Pak Fir')
await page.getByLabel('Kata sandi Super Admin').fill(SANDI)
await page.getByLabel('Ulangi kata sandi').fill(SANDI)
await foto('1-sandi')
kecil.push(...(await ukurTombol()))
await page.getByRole('button', { name: 'Buat kunci Super Admin' }).click()
const kode = (await page.getByTestId('kode-perangkat-super').textContent({ timeout: 30000 })) ?? ''
await ukurQr('QR Kode Perangkat Super Admin')
await foto('2-kode')
await page.getByRole('button', { name: 'Tempel Token' }).click()
await page.getByLabel('Token Super Admin').fill(admin.tokenSuper(kode))
await page.getByRole('button', { name: 'Aktifkan Super Admin' }).click()
await page.getByRole('navigation', { name: 'Menu Super Admin' }).waitFor({ timeout: 30000 })
await foto('3-beranda')
kecil.push(...(await ukurTombol()))

// paket daerah + materi
await navKe('Sinkron')
const p = admin.paket()
const m = admin.materi()
const [pemilih] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Buka Paket / Impor Setoran' }).click()])
await pemilih.setFiles([p, m].map((b) => ({ name: b.nama, mimeType: 'application/octet-stream', buffer: Buffer.from(b.bytes) })))
await page.getByRole('list', { name: 'Hasil membuka berkas' }).getByText(/Daftar materi/).waitFor({ timeout: 30000 })
await foto('4-sinkron')
kecil.push(...(await ukurTombol()))

// tambah generus
await navKe('Data')
await page.getByRole('button', { name: /Generus/ }).click()
await page.getByLabel('Kelompok', { exact: true }).selectOption(admin.k1)
await page.getByRole('button', { name: '+ Tambah generus' }).click()
await page.getByLabel('Nama generus').fill('Dewi')
await page.getByRole('radio', { name: 'Perempuan' }).click()
await page.getByLabel('Nama orang tua').fill('Bu Sari')
await page.getByLabel('No. HP orang tua').fill('081299')
await foto('5-generus')
kecil.push(...(await ukurTombol()))
await page.getByRole('button', { name: 'Simpan generus' }).click()
await page.getByText(/Dewi ditambahkan/).waitFor()

// token orang tua untuk anak baru
await navKe('Daftarkan')
await page.getByLabel('Peran', { exact: true }).selectOption('wali')
await page.getByLabel('Kelompok', { exact: true }).selectOption(admin.k1)
await page.getByRole('checkbox', { name: /Dewi/ }).check()
await page.getByLabel('Kode Perangkat', { exact: true }).fill(kode)
await foto('6-daftarkan')
kecil.push(...(await ukurTombol()))
await page.getByRole('button', { name: 'Terbitkan token' }).click()
await page.getByRole('img', { name: /QR token bagian 1 dari \d+/ }).waitFor({ timeout: 30000 })
await ukurQr(/QR token bagian 1 dari \d+/)
await foto('7-token')
kecil.push(...(await ukurTombol()))
await page.getByRole('button', { name: 'Tutup', exact: true }).click()

// Setor ke Daerah → admin tiruan mengimpor (generus disetujui otomatis)
await navKe('Beranda')
const [unduh] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Setor ke Daerah' }).click()])
const r = admin.impor(new Uint8Array(readFileSync(await unduh.path())))
if (r.usulanOtomatis !== 1) galat.push(`usulan otomatis ${r.usulanOtomatis}`)

// muat ulang → Pilih Profil → Super Admin HP → sandi
await page.waitForTimeout(800)
await page.reload()
await page.getByRole('heading', { name: 'Pilih Profil' }).waitFor({ timeout: 30000 })
await foto('8-pilih-profil')
kecil.push(...(await ukurTombol()))
await page.getByRole('button', { name: /Super Admin HP/ }).click()
await page.getByLabel('Kata sandi Super Admin').fill(SANDI)
await page.getByRole('button', { name: 'Buka Super Admin' }).click()
await page.getByRole('navigation', { name: 'Menu Super Admin' }).waitFor({ timeout: 30000 })
await navKe('Lainnya')
await page.getByRole('button', { name: /Perangkat/ }).click()
await page.getByText('Pak Fauzi').or(page.getByText('Bu Sari')).first().waitFor()
await foto('9-perangkat')
kecil.push(...(await ukurTombol()))

await browser.close()
srv.close()
const unik = [...new Map(kecil.map((x) => [x.t, x])).values()]
console.log(JSON.stringify({ galat, tombolKecil: unik }, null, 2))
process.exit(galat.length || unik.length ? 1 : 0)
