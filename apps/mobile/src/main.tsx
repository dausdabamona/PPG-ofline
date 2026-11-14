// Titik masuk APK/peramban: pilih platform (Capacitor native atau peramban), lalu jalankan aplikasi.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// sql.js memakai build peramban (exports "browser") → berkas wasm pasangannya:
import urlWasm from 'sql.js/dist/sql-wasm-browser.wasm?url'
import { App } from './App'
import { pilihPlatform } from './platform'
import './gaya.css'

const akar = createRoot(document.getElementById('root')!)
pilihPlatform(urlWasm).then(
  (platform) =>
    akar.render(
      <StrictMode>
        <App platform={platform} />
      </StrictMode>,
    ),
  (e) => akar.render(<p style={{ padding: 16 }}>Aplikasi gagal dimulai: {String(e)}</p>),
)
