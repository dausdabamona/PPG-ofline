// Opsional (tidak ikut npm test): uji visual cetakan §19 — render HTML contoh (dibuat oleh test/lembar-laporan.test.tsx
// dengan PPG_CONTOH_CETAK=<folder>) menjadi PDF lewat Chrome headless (ukuran halaman dari CSS @page).
// Jalankan: PPG_CONTOH_CETAK=/tmp/cetak npx vitest run test/lembar-laporan.test.tsx (di apps/desktop)
//           node apps/desktop/uji-peramban/uji-cetak.mjs /tmp/cetak   → /tmp/cetak/*.pdf (lalu pdftoppm untuk PNG)
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'

const DIR = process.argv[2]
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] })
const page = await browser.newPage()
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.html'))) {
  await page.goto(pathToFileURL(join(DIR, f)).href)
  await page.emulateMedia({ media: 'print' })
  await page.pdf({ path: join(DIR, f.replace(/\.html$/, '.pdf')), preferCSSPageSize: true, printBackground: true })
  console.log('PDF:', f)
}
await browser.close()
