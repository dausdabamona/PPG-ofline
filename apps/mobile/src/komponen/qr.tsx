// QR: tampilkan teks sebagai QR (SVG, tanpa kanvas) dan pindai QR dengan kamera (getUserMedia + jsQR).
import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { AreaTeks, Tombol } from './ui'

/** Apakah teks muat dalam satu QR (versi ≤ 40, koreksi L). */
export function bisaQr(teks: string): boolean {
  try {
    QRCode.create(teks, { errorCorrectionLevel: 'L' })
    return true
  } catch {
    return false
  }
}

/** QR sebagai SVG. Bila teks terlalu panjang untuk QR, tampilkan pesan (teks tetap bisa dikirim). */
export function GambarQr(p: { teks: string; label: string }) {
  const hasil = useMemo(() => {
    try {
      const qr = QRCode.create(p.teks, { errorCorrectionLevel: 'L' })
      const n = qr.modules.size
      const d: string[] = []
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) if (qr.modules.get(y, x)) d.push(`M${x + 4} ${y + 4}h1v1h-1z`)
      }
      return { ukuran: n + 8, jalur: d.join('') }
    } catch {
      return null
    }
  }, [p.teks])
  if (!hasil) {
    return <p className="qr-gagal">Teks ini terlalu panjang untuk dijadikan QR. Gunakan tombol kirim atau salin.</p>
  }
  return (
    <svg className="qr" role="img" aria-label={p.label} viewBox={`0 0 ${hasil.ukuran} ${hasil.ukuran}`} shapeRendering="crispEdges">
      <rect width="100%" height="100%" fill="#fff" />
      <path d={hasil.jalur} fill="#0b1f1d" />
    </svg>
  )
}

/**
 * Pemindai QR lewat kamera belakang. Bila kamera tidak tersedia/ditolak, pengguna bisa menempel teks.
 * `awalan` (mis. 'PPGT1.') dipakai untuk mengabaikan QR yang bukan milik PPG.
 */
export function PemindaiQr(p: { awalan: string; dapat: (teks: string) => void; batal: () => void; labelTempel: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'memulai' | 'memindai' | 'gagal'>('memulai')
  const [pesan, setPesan] = useState('')
  const [tempel, setTempel] = useState('')
  const dapatRef = useRef(p.dapat)
  dapatRef.current = p.dapat

  useEffect(() => {
    let aliran: MediaStream | null = null
    let berhenti = false
    let timer: ReturnType<typeof setTimeout> | null = null
    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kamera tidak tersedia di HP ini.')
        aliran = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        if (berhenti) return
        const v = video.current!
        v.srcObject = aliran
        v.setAttribute('playsinline', 'true')
        await v.play()
        const { default: jsQR } = await import('jsqr')
        setStatus('memindai')
        const kanvas = document.createElement('canvas')
        const ctx = kanvas.getContext('2d', { willReadFrequently: true })
        const pindai = () => {
          if (berhenti || !ctx) return
          if (v.videoWidth) {
            // perkecil agar ringan di HP 2 GB
            const skala = Math.min(1, 640 / v.videoWidth)
            kanvas.width = Math.round(v.videoWidth * skala)
            kanvas.height = Math.round(v.videoHeight * skala)
            ctx.drawImage(v, 0, 0, kanvas.width, kanvas.height)
            const img = ctx.getImageData(0, 0, kanvas.width, kanvas.height)
            const kode = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
            if (kode?.data && kode.data.trim().startsWith(p.awalan)) {
              berhenti = true
              dapatRef.current(kode.data.trim())
              return
            }
          }
          timer = setTimeout(pindai, 250)
        }
        pindai()
      } catch (e) {
        setStatus('gagal')
        setPesan(e instanceof Error && e.name === 'NotAllowedError' ? 'Izin kamera ditolak.' : 'Kamera tidak bisa dipakai.')
      }
    })()
    return () => {
      berhenti = true
      if (timer) clearTimeout(timer)
      aliran?.getTracks().forEach((t) => t.stop())
    }
  }, [p.awalan])

  return (
    <div className="pemindai">
      {status !== 'gagal' ? (
        <div className="bingkai-kamera">
          <video ref={video} muted aria-label="Gambar kamera" />
          <p>{status === 'memulai' ? 'Menyalakan kamera…' : 'Arahkan kamera ke QR.'}</p>
        </div>
      ) : (
        <p className="pesan-kamera">{pesan} Silakan tempel teksnya di bawah.</p>
      )}
      <AreaTeks label={p.labelTempel} nilai={tempel} ubah={setTempel} baris={3} placeholder={`${p.awalan}…`} />
      <div className="baris-tombol">
        <Tombol varian="kedua" onClick={p.batal}>
          Batal
        </Tombol>
        <Tombol disabled={!tempel.trim()} onClick={() => p.dapat(tempel.trim())}>
          Pakai teks ini
        </Tombol>
      </div>
    </div>
  )
}
