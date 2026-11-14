// Proses utama Electron — PPG Sorong Admin.
// Keamanan: contextIsolation, sandbox, tanpa nodeIntegration; renderer dimuat dari protokol app:// dengan CSP ketat.
import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, session, shell } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join, normalize, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { KANAL, type BerkasDisimpan, type FilterBerkas } from './api'
import { muatDb, simpanDbAtomik } from './penyimpanan'

const URL_DEV = process.env.VITE_DEV_SERVER_URL
const SKEMA = 'app'
const FOLDER_RENDERER = join(__dirname, '..', 'dist')

/** CSP: wasm sql.js butuh 'wasm-unsafe-eval'; gaya inline dipakai React (atribut style). */
const CSP_PRODUKSI = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ')
const CSP_DEV = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self' ws: http://localhost:5173",
  "object-src 'none'",
].join('; ')

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
}

protocol.registerSchemesAsPrivileged([{ scheme: SKEMA, privileges: { standard: true, secure: true, supportFetchAPI: true } }])

let jendela: BrowserWindow | null = null
let bolehTutup = false

function folderData(): string {
  return app.getPath('userData')
}

function daftarkanProtokol(): void {
  protocol.handle(SKEMA, async (req) => {
    const url = new URL(req.url)
    let rel = decodeURIComponent(url.pathname)
    if (rel === '/' || rel === '') rel = '/index.html'
    const berkas = normalize(join(FOLDER_RENDERER, rel))
    if (!berkas.startsWith(FOLDER_RENDERER + sep)) return new Response('Terlarang', { status: 403 })
    try {
      const r = await net.fetch(pathToFileURL(berkas).toString())
      if (!r.ok) return new Response('Tidak ditemukan', { status: 404 })
      return new Response(await r.arrayBuffer(), {
        status: 200,
        headers: {
          'Content-Type': MIME[extname(berkas).toLowerCase()] ?? 'application/octet-stream',
          'Content-Security-Policy': CSP_PRODUKSI,
          'X-Content-Type-Options': 'nosniff',
        },
      })
    } catch {
      return new Response('Tidak ditemukan', { status: 404 })
    }
  })
}

/** Hanya terima IPC dari halaman aplikasi sendiri. */
function pengirimSah(e: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent): boolean {
  const url = e.senderFrame?.url ?? ''
  return url.startsWith(`${SKEMA}://`) || (!!URL_DEV && url.startsWith(URL_DEV))
}

function keBytes(v: unknown): Uint8Array {
  if (v instanceof Uint8Array) return v
  if (v instanceof ArrayBuffer) return new Uint8Array(v)
  throw new Error('Data berkas tidak sah.')
}

function daftarkanIpc(): void {
  ipcMain.handle(KANAL.muatDb, (e) => {
    if (!pengirimSah(e)) throw new Error('Ditolak')
    return muatDb(folderData())
  })
  ipcMain.handle(KANAL.simpanDb, (e, bytes: unknown) => {
    if (!pengirimSah(e)) throw new Error('Ditolak')
    simpanDbAtomik(folderData(), keBytes(bytes))
  })
  ipcMain.handle(KANAL.folderData, (e) => {
    if (!pengirimSah(e)) throw new Error('Ditolak')
    return folderData()
  })
  ipcMain.handle(KANAL.bukaBanyak, async (e, filter: FilterBerkas[], banyak: boolean) => {
    if (!pengirimSah(e) || !jendela) throw new Error('Ditolak')
    const hasil = await dialog.showOpenDialog(jendela, {
      title: 'Pilih berkas',
      properties: banyak ? ['openFile', 'multiSelections'] : ['openFile'],
      filters: Array.isArray(filter) && filter.length ? filter.map((f) => ({ name: String(f.nama), extensions: f.ekstensi.map(String) })) : undefined,
    })
    if (hasil.canceled) return []
    return hasil.filePaths.map((p) => ({ nama: basename(p), bytes: new Uint8Array(readFileSync(p)) }))
  })
  ipcMain.handle(KANAL.simpanBerkas, async (e, namaSaran: string, bytes: unknown) => {
    if (!pengirimSah(e) || !jendela) throw new Error('Ditolak')
    const data = keBytes(bytes)
    const ext = extname(String(namaSaran)).replace('.', '')
    const hasil = await dialog.showSaveDialog(jendela, {
      title: 'Simpan berkas',
      defaultPath: join(app.getPath('documents'), basename(String(namaSaran))),
      filters: ext ? [{ name: ext.toUpperCase(), extensions: [ext] }] : undefined,
    })
    if (hasil.canceled || !hasil.filePath) return null
    writeFileSync(hasil.filePath, data)
    return hasil.filePath
  })
  ipcMain.handle(KANAL.simpanKeFolder, async (e, daftar: BerkasDisimpan[]) => {
    if (!pengirimSah(e) || !jendela) throw new Error('Ditolak')
    const hasil = await dialog.showOpenDialog(jendela, { title: 'Pilih folder tujuan', properties: ['openDirectory', 'createDirectory'] })
    if (hasil.canceled || !hasil.filePaths[0]) return null
    const folder = hasil.filePaths[0]
    mkdirSync(folder, { recursive: true })
    for (const b of daftar) writeFileSync(join(folder, basename(String(b.nama))), keBytes(b.bytes))
    return folder
  })
  ipcMain.on(KANAL.siapTutup, (e) => {
    if (!pengirimSah(e)) return
    bolehTutup = true
    jendela?.close()
  })
}

function buatJendela(): void {
  jendela = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 640,
    title: 'PPG Sorong Admin',
    backgroundColor: '#fbf8f1',
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  })
  jendela.once('ready-to-show', () => jendela?.show())
  // Tutup: minta renderer menyimpan dulu, lalu tutup (paksa setelah 5 detik).
  jendela.on('close', (e) => {
    if (bolehTutup || !jendela) return
    e.preventDefault()
    jendela.webContents.send(KANAL.akanTutup)
    setTimeout(() => {
      bolehTutup = true
      jendela?.close()
    }, 5000)
  })
  jendela.on('closed', () => {
    jendela = null
  })
  jendela.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\/wa\.me\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  jendela.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(`${SKEMA}://`) && !(URL_DEV && url.startsWith(URL_DEV))) e.preventDefault()
  })
  if (URL_DEV) void jendela.loadURL(URL_DEV)
  else void jendela.loadURL(`${SKEMA}://ppg/index.html`)
}

app.whenReady().then(() => {
  if (URL_DEV) {
    session.defaultSession.webRequest.onHeadersReceived((d, cb) => {
      cb({ responseHeaders: { ...d.responseHeaders, 'Content-Security-Policy': [CSP_DEV] } })
    })
  }
  session.defaultSession.setPermissionRequestHandler((_wc, _izin, cb) => cb(false))
  daftarkanProtokol()
  daftarkanIpc()
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: 'editMenu', label: 'Sunting' },
      { label: 'Tampilan', submenu: [{ role: 'reload', label: 'Muat ulang' }, { role: 'toggleDevTools', label: 'Alat pengembang' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }] },
    ]),
  )
  buatJendela()
})

// Satu instans saja (dua instans bisa saling menimpa database).
if (!app.requestSingleInstanceLock()) app.quit()
else
  app.on('second-instance', () => {
    if (jendela) {
      if (jendela.isMinimized()) jendela.restore()
      jendela.focus()
    }
  })

app.on('window-all-closed', () => app.quit())
