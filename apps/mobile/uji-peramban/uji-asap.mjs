// Opsional (tidak ikut npm test): butuh `playwright-core` dan Chrome/Chromium terpasang.
// Jalankan dari akar repo:
//   npm run build -w apps/mobile
//   npx rolldown apps/mobile/uji-peramban/admin-uji.ts --platform node --format cjs --external sql.js --external libsodium-wrappers \
//     --external fflate -o apps/mobile/node_modules/.uji/admin-uji.cjs
//   node apps/mobile/uji-peramban/uji-asap.mjs "$PWD/apps/mobile/dist" "$PWD/apps/mobile/node_modules/.uji/admin-uji.cjs"
// (atur CHROME=/path/chrome bila bukan /usr/bin/google-chrome; PLAYWRIGHT=/path/playwright-core bila tidak di node_modules)
// Uji asap HP 360×740 (v3): sambut → Kode Perangkat (QR ≥ 280 px) → kode EXE ditolak dengan pesan → aktivasi mubaligh → paket & materi →
// Absen (pengingat setor, kelas, saran materi, hadir + tuntas) → Materi kelas → QR berseri + layar penuh → Setor sekarang →
// cadangan terenkripsi → muat ulang (IndexedDB).
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import { pathToFileURL } from 'node:url'

const [DIST, ADMIN] = process.argv.slice(2)
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

// ukuran sentuh: semua tombol terlihat ≥ 44 px
const ukurTombol = () =>
  page.$$eval('button', (bs) =>
    bs.filter((b) => b.offsetParent !== null).map((b) => ({ t: b.textContent?.trim(), h: b.getBoundingClientRect().height })).filter((x) => x.h < 44),
  )
const kecil = []
// QR terlihat harus ≥ 280 px (§14 v3)
const ukurQr = async (nama) => {
  const k = await page.getByRole('img', { name: nama }).boundingBox()
  if (!k || k.width < 280) galat.push(`QR "${nama}" hanya ${k?.width ?? 0} px`)
}
const navKe = (t) => page.getByRole('navigation').getByRole('button', { name: new RegExp(t) }).click()

await page.goto('http://localhost:4318/')
await page.getByLabel('Nama HP ini').fill('HP Ust. Hasan')
await foto('1-sambut')
await page.getByRole('button', { name: 'Lanjut' }).click()
const kode = (await page.getByTestId('kode-perangkat').textContent()) ?? ''
await page.getByRole('img', { name: 'QR Kode Perangkat' }).waitFor()
await ukurQr('QR Kode Perangkat')
await foto('2-kode-perangkat')

// v3: kode aktivasi EXE ditempel di HP → pesan jelas
await page.getByRole('button', { name: 'Tempel Token' }).click()
await page.getByLabel('Token').fill(admin.tokenExeDesa(kode))
await page.getByRole('button', { name: 'Aktifkan' }).click()
await page.locator('.spanduk').getByText(/Kode ini untuk aplikasi laptop \(EXE\)/).waitFor({ timeout: 30000 })
await foto('9-kode-exe')

await page.getByLabel('Token').fill(admin.tokenMubaligh(kode))
await page.getByRole('button', { name: 'Aktifkan' }).click()
await page.getByRole('heading', { name: 'Absen', exact: true }).waitFor({ timeout: 30000 })
await page.getByText(/Assalamu'alaikum, Ust\. Hasan/).waitFor()

await navKe('Lainnya')
await page.getByRole('button', { name: /^Buka Berkas/ }).click()
const p = admin.paket()
const m = admin.materi()
await bukaBerkas('Buka Berkas', [p, m])
await page.getByText(/Daftar materi berhasil dibuka/).waitFor({ timeout: 30000 })
kecil.push(...(await ukurTombol()))

// Absen: pengingat netral (belum ada data, Fase 9b) → kelas → saran materi → hadir + tuntas → simpan
await navKe('Absen')
await page.getByText(/Belum ada data untuk disetor/).waitFor()
await page.getByRole('radio', { name: /Kelas Caberawit/ }).click()
await page.getByRole('button', { name: 'Pakai saran pertama' }).click()
await foto('3-absen-materi')
kecil.push(...(await ukurTombol()))
await page.getByRole('button', { name: 'Lanjut: isi kehadiran' }).click()
await page.getByRole('heading', { name: '4 generus' }).waitFor()
await page.getByRole('button', { name: 'Semua hadir' }).click()
await page.getByRole('checkbox', { name: /^Tuntas .* Ahmad$/ }).check()
await foto('4-absen-lembar')
kecil.push(...(await ukurTombol()))
await page.getByRole('button', { name: /Simpan absen/ }).click()
await page.getByText(/Absen tersimpan: 4 generus, 1 materi tuntas/).waitFor()

// Materi: progres kelas
await navKe('Materi')
await page.getByRole('button', { name: 'Rincian capaian Ahmad' }).waitFor()
await foto('5-materi-kelas')
kecil.push(...(await ukurTombol()))

// token generus ±3,7 KB tampil sebagai QR berseri yang berganti otomatis (≥ 280 px), + layar penuh
await navKe('Lainnya')
await page.getByRole('button', { name: /^Terbitkan Token/ }).click()
await page.getByLabel('Generus', { exact: true }).selectOption({ label: 'Ahmad' })
await page.getByLabel('Kode Perangkat HP tujuan').fill(kode)
await page.getByRole('button', { name: 'Terbitkan Token', exact: true }).click()
await page.getByRole('img', { name: /QR token bagian 1 dari \d+/ }).waitFor({ timeout: 30000 })
const tokenAhmad = (await page.getByTestId('token-hasil').textContent()) ?? ''
await ukurQr(/QR token bagian 1 dari \d+/)
await foto('7-qr-berseri')
await page.getByRole('img', { name: /QR token bagian 2 dari \d+/ }).waitFor({ timeout: 4000 })
kecil.push(...(await ukurTombol()))
await page.getByRole('button', { name: /Layar penuh/ }).click()
await page.getByRole('dialog', { name: 'QR layar penuh' }).waitFor()
await ukurQr(/QR token bagian \d+ dari \d+/)
await foto('7b-qr-layar-penuh')
kecil.push(...(await ukurTombol()))
await page.getByRole('button', { name: 'Tutup layar penuh' }).click()
await page.getByRole('button', { name: 'Tutup', exact: true }).click()

// Setor sekarang (pengingat) → berkas setoran diunduh
await navKe('Absen')
const [setor] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Setor sekarang' }).click()])
if (!/^PPG_SETOR_/.test(setor.suggestedFilename())) galat.push(`berkas setor: ${setor.suggestedFilename()}`)
await page.getByText(/data sudah dikirim, menunggu konfirmasi/).waitFor()

// cadangan HP wajib kata sandi → berkas terenkripsi (PBKDF2 + secretbox di bawah CSP)
await page.getByRole('button', { name: /^Profil:/ }).click()
await page.getByRole('button', { name: 'Cadangkan data HP' }).click()
await page.getByLabel('Kata sandi cadangan').fill('sandi-hp-1')
await page.getByLabel('Ulangi kata sandi').fill('sandi-hp-1')
const [unduhan] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Buat cadangan' }).click()])
const isiCadangan = readFileSync(await unduhan.path())
if (isiCadangan.subarray(0, 6).toString() !== 'PPGCB1') galat.push('cadangan HP tidak terenkripsi')
await foto('8-cadangan')

// HP bersama: profil generus Ahmad → layar pertama "Materi yang perlu dituntaskan"
await page.getByRole('button', { name: '+ Tambah Profil' }).click()
await page.getByRole('button', { name: 'Tempel Token' }).click()
await page.getByLabel('Token').fill(tokenAhmad)
await page.getByRole('button', { name: 'Aktifkan' }).click()
await page.getByRole('heading', { name: 'Materi yang perlu dituntaskan' }).waitFor({ timeout: 30000 })
await page.getByText(/1 dari 3 materi tuntas/).waitFor()
await foto('10-target-generus')
kecil.push(...(await ukurTombol()))

// muat ulang → data tersimpan di IndexedDB, langsung ke layar utama
await page.waitForTimeout(800)
await page.reload()
await page.getByRole('heading', { name: 'Pilih Profil' }).waitFor({ timeout: 30000 })
await page.getByRole('button', { name: /Ust\. Hasan/ }).click()
await page.getByRole('heading', { name: 'Absen', exact: true }).waitFor({ timeout: 30000 })
await page.getByText(/Assalamu'alaikum, Ust\. Hasan/).waitFor()
await foto('6-setelah-muat-ulang')

await browser.close()
srv.close()
console.log(JSON.stringify({ galatKonsol: galat, tombolKurangDari44: kecil }, null, 2))
if (galat.length || kecil.length) process.exit(1)
console.log('UJI ASAP HP LULUS')
