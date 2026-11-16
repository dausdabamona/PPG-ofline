// §19 (Fase 13) — pratinjau cetak layar penuh (portal ke <body>): saat dicetak hanya isi pratinjau yang keluar (CSS
// lembar-laporan.css), dengan ukuran halaman dari @page (A4 lanskap lembar, A4 tegak raport/pengurus).
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Tombol } from './ui'
import './lembar-laporan.css'

export function PratinjauCetak(p: { judul: string; tutup: () => void; aksi?: ReactNode; children: ReactNode }) {
  const tutupRef = useRef(p.tutup)
  tutupRef.current = p.tutup
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tutupRef.current()
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])
  return createPortal(
    <div className="pratinjau-cetak" role="dialog" aria-modal="true" aria-label={p.judul}>
      <div className="pratinjau-bilah">
        <h2>{p.judul}</h2>
        <Tombol onClick={() => window.print()}>Cetak / PDF</Tombol>
        {p.aksi}
        <Tombol varian="kedua" onClick={p.tutup}>
          Tutup
        </Tombol>
      </div>
      {p.children}
    </div>,
    document.body,
  )
}
