// QR token di EXE: teks pendek → satu QR; teks panjang → QR berseri (PPGQ1|…) yang berganti otomatis tiap 1,5 detik,
// dengan tombol Sebelumnya/Berikutnya. Pemecahan bagian memakai fungsi murni @ppg/core (pecahQr).
import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { pecahQr } from '@ppg/core'
import { KotakGalat, Tombol } from './ui'

export const JEDA_QR_SERI_MS = 1500

function GambarQr(p: { teks: string; label: string }) {
  const hasil = useMemo(() => {
    try {
      const qr = QRCode.create(p.teks, { errorCorrectionLevel: 'L' })
      const n = qr.modules.size
      const d: string[] = []
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.modules.get(y, x)) d.push(`M${x + 2} ${y + 2}h1v1h-1z`)
      return { ukuran: n + 4, jalur: d.join('') }
    } catch {
      return null
    }
  }, [p.teks])
  if (!hasil) return <KotakGalat pesan="Teks terlalu panjang untuk QR. Kirim teks token lewat WA." />
  return (
    <svg className="qr-svg" role="img" aria-label={p.label} width={280} height={280} viewBox={`0 0 ${hasil.ukuran} ${hasil.ukuran}`} shapeRendering="crispEdges">
      <rect width="100%" height="100%" fill="#fff" />
      <path d={hasil.jalur} fill="#0b1f1d" />
    </svg>
  )
}

export function QrBerseri(p: { teks: string; label: string; jedaMs?: number }) {
  const bagian = useMemo(() => pecahQr(p.teks), [p.teks])
  const [ke, setKe] = useState(0)
  const [jalan, setJalan] = useState(true)
  const n = bagian.length
  useEffect(() => setKe(0), [p.teks])
  useEffect(() => {
    if (n < 2 || !jalan) return
    const t = setInterval(() => setKe((i) => (i + 1) % n), p.jedaMs ?? JEDA_QR_SERI_MS)
    return () => clearInterval(t)
  }, [n, jalan, p.jedaMs])
  if (n < 2) return <GambarQr teks={p.teks} label={p.label} />
  const i = Math.min(ke, n - 1)
  return (
    <div className="qr-berseri">
      <GambarQr teks={bagian[i]!} label={`${p.label} bagian ${i + 1} dari ${n}`} />
      <p>
        QR <b>{i + 1}</b> dari <b>{n}</b> — berganti otomatis. Arahkan kamera HP ke layar sampai semua bagian terbaca.
      </p>
      <div className="aksi-qr">
        <Tombol kecil varian="kedua" onClick={() => setKe((x) => (x - 1 + n) % n)}>
          ‹ Sebelumnya
        </Tombol>
        <Tombol kecil varian="tipis" onClick={() => setJalan((j) => !j)}>
          {jalan ? 'Jeda' : 'Putar'}
        </Tombol>
        <Tombol kecil varian="kedua" onClick={() => setKe((x) => (x + 1) % n)}>
          Berikutnya ›
        </Tombol>
      </div>
    </div>
  )
}
