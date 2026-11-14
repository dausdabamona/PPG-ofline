// QR: tampilkan teks sebagai QR (SVG, tanpa kanvas) — teks panjang sebagai QR berseri yang berganti otomatis —
// dan pindai QR dengan kamera (getUserMedia + jsQR), termasuk mengumpulkan semua bagian QR berseri.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { AWALAN_QR_SERI, pecahQr, pengumpulQrBaru, tambahBagianQr, type PengumpulQr } from '@ppg/core'
import { AreaTeks, Tombol } from './ui'

/** Jeda pergantian QR berseri (ms). */
export const JEDA_QR_SERI_MS = 1500

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
 * QR untuk teks apa saja: teks pendek → satu QR; teks panjang (token generus/wali) → QR berseri yang berganti
 * otomatis tiap 1,5 detik, dengan tombol Sebelumnya/Berikutnya dan Jeda.
 */
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
      <p className="keterangan-qr" aria-live="off">
        QR <b>{i + 1}</b> dari <b>{n}</b> (berganti sendiri)
      </p>
      <div className="baris-tombol">
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

/**
 * Pengumpul hasil pindai/tempel: QR biasa langsung selesai; QR berseri dikumpulkan sampai lengkap.
 * `dapat` dipanggil sekali dengan teks utuh yang berawalan `awalan`.
 */
function useKumpulQr(awalan: string, dapat: (teks: string) => void) {
  const pengumpul = useRef<PengumpulQr>(pengumpulQrBaru())
  const [kemajuan, setKemajuan] = useState<{ terbaca: number; total: number } | null>(null)
  const [salah, setSalah] = useState('')
  const terima = useCallback(
    (teks: string): boolean => {
      const r = tambahBagianQr(pengumpul.current, teks)
      pengumpul.current = r.pengumpul
      if (r.status === 'bagian') {
        setKemajuan({ terbaca: r.terbaca, total: r.total })
        setSalah('')
        return false
      }
      if (r.status === 'bukan' || !r.hasil) {
        setSalah('QR ini rusak atau bukan milik PPG.')
        return false
      }
      if (!r.hasil.startsWith(awalan)) {
        setSalah(r.status === 'lengkap' ? 'QR ini bukan untuk langkah ini.' : `QR ini bukan ${awalan.startsWith('PPGT') ? 'token' : 'Kode Perangkat'}.`)
        pengumpul.current = pengumpulQrBaru()
        setKemajuan(null)
        return false
      }
      setKemajuan(r.status === 'lengkap' ? { terbaca: r.total, total: r.total } : null)
      dapat(r.hasil)
      return true
    },
    [awalan, dapat],
  )
  return { terima, kemajuan, salah }
}

/**
 * Pemindai QR lewat kamera belakang. Bila kamera tidak tersedia/ditolak, pengguna bisa menempel teks.
 * `awalan` (mis. 'PPGT1.') dipakai untuk mengabaikan QR yang bukan milik PPG. QR berseri (PPGQ1|…) dikumpulkan
 * dan ditampilkan "2 dari 3 terbaca".
 */
export function PemindaiQr(p: { awalan: string; dapat: (teks: string) => void; batal: () => void; labelTempel: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'memulai' | 'memindai' | 'gagal'>('memulai')
  const [pesan, setPesan] = useState('')
  const [tempel, setTempel] = useState('')
  const dapatRef = useRef(p.dapat)
  dapatRef.current = p.dapat
  const dapatStabil = useCallback((t: string) => dapatRef.current(t), [])
  const { terima, kemajuan, salah } = useKumpulQr(p.awalan, dapatStabil)
  const terimaRef = useRef(terima)
  terimaRef.current = terima

  useEffect(() => {
    let aliran: MediaStream | null = null
    let berhenti = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let terakhir = ''
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
            // perkecil agar ringan di HP 2 GB (QR berseri ±97 modul tetap terbaca pada lebar 640 px)
            const skala = Math.min(1, 640 / v.videoWidth)
            kanvas.width = Math.round(v.videoWidth * skala)
            kanvas.height = Math.round(v.videoHeight * skala)
            ctx.drawImage(v, 0, 0, kanvas.width, kanvas.height)
            const img = ctx.getImageData(0, 0, kanvas.width, kanvas.height)
            const kode = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
            const isi = kode?.data?.trim()
            if (isi && isi !== terakhir && (isi.startsWith(p.awalan) || isi.startsWith(AWALAN_QR_SERI))) {
              terakhir = isi
              if (terimaRef.current(isi)) {
                berhenti = true
                return
              }
            }
          }
          timer = setTimeout(pindai, 200)
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
      {kemajuan && kemajuan.terbaca < kemajuan.total ? (
        <p className="kemajuan-qr" role="status">
          <b>
            {kemajuan.terbaca} dari {kemajuan.total}
          </b>{' '}
          bagian QR terbaca. Tahan kamera sampai semua bagian terbaca.
        </p>
      ) : null}
      {salah ? (
        <p className="qr-gagal" role="alert">
          {salah}
        </p>
      ) : null}
      <AreaTeks label={p.labelTempel} nilai={tempel} ubah={setTempel} baris={3} placeholder={`${p.awalan}…`} />
      <div className="baris-tombol">
        <Tombol varian="kedua" onClick={p.batal}>
          Batal
        </Tombol>
        <Tombol
          disabled={!tempel.trim()}
          onClick={() => {
            // boleh berisi beberapa bagian QR berseri dipisah spasi/baris baru
            for (const x of tempel.trim().split(/\s+/)) if (terima(x)) return
            setTempel('')
          }}
        >
          Pakai teks ini
        </Tombol>
      </div>
    </div>
  )
}
