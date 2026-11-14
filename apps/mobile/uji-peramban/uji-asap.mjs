// Opsional (tidak ikut npm test): butuh `playwright-core` dan Chrome/Chromium terpasang.
// Jalankan dari akar repo:
//   npm run build -w apps/mobile
//   npx rolldown apps/mobile/uji-peramban/admin-uji.ts --platform node --format cjs --external sql.js --external libsodium-wrappers \
//     --external fflate -o apps/mobile/node_modules/.uji/admin-uji.cjs
//   node apps/mobile/uji-peramban/uji-asap.mjs "$PWD/apps/mobile/dist" "$PWD/apps/mobile/node_modules/.uji/admin-uji.cjs"
// (atur CHROME=/path/chrome bila bukan /usr/bin/google-chrome; PLAYWRIGHT=/path/playwright-core bila tidak di node_modules)
// Uji asap HP 360×740: sambut → Kode Perangkat → aktivasi mubaligh → buka paket & materi → layar utama → muat ulang (IndexedDB).
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import { pathToFileURL } from 'node:url'

const [DIST, ADMIN] = process.argv.slice(2)
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright-core')
const modAdmin = await import(pathToFileURL(ADMIN).href)
const siapkan = modAdmin.siapkan ?? modAdmin.default.siapkan
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm' }
const srv = createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname
  const p = join(DIST, decodeURIComponent(path === '/' ? '/index.html' : path))
  if (!p.startsWith(DIST) || !existsSync(p)) {
    res.writeHead(404)
    return res.end()
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(p)] ?? 'application/octet-stream' })
  res.end(readFileSync(p))
}).listen(4318)

const admin = await siapkan()
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const galat = []
page.on('console', (m) => {
  if (m.type() === 'error') galat.push(m.text())
})
page.on('pageerror', (e) => galat.push(String(e)))
page.on('response', (r) => {
  if (r.status() >= 400) galat.push(`${r.status()} ${r.url()}`)
})
const foto = (n) => page.screenshot({ path: `./uji-asap-hp-${n}.png`, fullPage: false })
const bukaBerkas = async (tombol, berkas) => {
  const [pemilih] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: tombol, exact: true }).click()])
  await pemilih.setFiles(berkas.map((b) => ({ name: b.nama, mimeType: 'application/octet-stream', buffer: Buffer.from(b.bytes) })))
}

await page.goto('http://localhost:4318/')
await page.getByLabel('Nama HP ini').fill('HP Ust. Hasan')
await foto('1-sambut')
await page.getByRole('button', { name: 'Lanjut' }).click()
const kode = (await page.getByTestId('kode-perangkat').textContent()) ?? ''
await page.getByRole('img', { name: 'QR Kode Perangkat' }).waitFor()
await foto('2-kode-perangkat')

await page.getByRole('button', { name: 'Tempel Token' }).click()
await page.getByLabel('Token').fill(admin.tokenMubaligh(kode))
await page.getByRole('button', { name: 'Aktifkan' }).click()
await page.getByRole('heading', { name: /Assalamu'alaikum, Ust\. Hasan/ }).waitFor({ timeout: 30000 })

await page.getByRole('navigation').getByRole('button', { name: /Lainnya/ }).click()
await page.getByRole('button', { name: /^Buka Berkas/ }).click()
const p = admin.paket()
const m = admin.materi()
await bukaBerkas('Buka Berkas', [p, m])
await page.getByText(/Daftar materi berhasil dibuka/).waitFor({ timeout: 30000 })
await page.getByRole('button', { name: 'Kembali' }).click()
await page.getByRole('navigation').getByRole('button', { name: /Beranda/ }).click()
await page.getByText('Generus aktif').waitFor()
await foto('3-beranda-mubaligh')

await page.getByRole('navigation').getByRole('button', { name: /Lainnya/ }).click()
await page.getByRole('button', { name: /^Presensi/ }).click()
await page.getByRole('button', { name: 'Semua hadir' }).click()
await foto('4-presensi')
await page.getByRole('button', { name: /Simpan presensi/ }).click()
await page.getByText(/Presensi 4 generus tersimpan/).waitFor()

await page.getByRole('navigation').getByRole('button', { name: /Simak/ }).click()
await page.getByLabel('Generus').selectOption({ label: 'Ahmad (Caberawit)' })
await page.getByLabel('Materi').waitFor()
await foto('5-simak')

// ukuran sentuh: semua tombol terlihat ≥ 44 px
const kecil = await page.$$eval('button', (bs) =>
  bs.filter((b) => b.offsetParent !== null).map((b) => ({ t: b.textContent?.trim(), h: b.getBoundingClientRect().height })).filter((x) => x.h < 44),
)

// muat ulang → data tersimpan di IndexedDB, langsung ke layar utama
await page.waitForTimeout(800)
await page.reload()
await page.getByRole('heading', { name: /Assalamu'alaikum, Ust\. Hasan/ }).waitFor({ timeout: 30000 })
await page.getByText(/Ada \d+ data belum disetor/).waitFor()
await foto('6-setelah-muat-ulang')

await browser.close()
srv.close()
console.log(JSON.stringify({ galatKonsol: galat, tombolKurangDari44: kecil }, null, 2))
if (galat.length || kecil.length) process.exit(1)
console.log('UJI ASAP HP LULUS')
