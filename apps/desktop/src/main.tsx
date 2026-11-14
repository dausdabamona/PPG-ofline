// Titik masuk renderer: pilih platform (Electron bila preload tersedia, selain itu peramban untuk uji).
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// sql.js memakai build peramban (exports "browser") → berkas wasm pasangannya:
import urlWasm from 'sql.js/dist/sql-wasm-browser.wasm?url'
import { App } from './App'
import { platformElectron, platformPeramban } from './platform'
import './gaya.css'

const platform = window.ppgAdmin ? platformElectron(window.ppgAdmin, urlWasm) : platformPeramban(urlWasm)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App platform={platform} />
  </StrictMode>,
)
