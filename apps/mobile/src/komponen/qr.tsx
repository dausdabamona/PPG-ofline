// QR: tampilkan teks sebagai QR (SVG, tanpa kanvas) — teks panjang sebagai QR berseri yang berganti otomatis —
// dan pindai QR. Di APK memakai pemindai native (ML Kit, tanpa internet); di peramban/uji jatuh ke kamera web
// (getUserMedia + jsQR). Keduanya mengumpulkan semua bagian QR berseri ("2 dari 5 bagian QR terbaca").
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import { AWALAN_QR_SERI, pecahQr, pengumpulQrBaru, tambahBagianQr, type PengumpulQr } from '@ppg/core'
import type { PemindaiNative } from '../platform'
import { AreaTeks, Tombol } from './ui'

/** Jeda pergantian QR berseri (ms). */
export const JEDA_QR_SERI_MS = 1500
/**
 * Panjang maksimum satu bagian QR berseri di HP (V-T26): ≤ 600 karakter → QR versi ≤ 20 (97×97 modul) dengan
 * koreksi galat M, sehingga tetap mudah dipindai kamera HP lain / webcam dari layar HP.
 */
export const MAKS_BAGIAN_QR_HP = 600
/** Tingkat koreksi galat QR (§14.2). */
const KOREKSI_QR = 'M' as const
/** Zona tenang (modul putih di tepi) — standar QR minimal 4. */
const ZONA_TENANG = 4

/** Apakah teks muat dalam satu QR (versi ≤ 40, koreksi M). */
export function bisaQr(teks: string): boolean {
  try {
    QRCode.create(teks, { errorCorrectionLevel: KOREKSI_QR })
    return true
  } catch {
    return false
  }
}

/** QR sebagai SVG: koreksi galat M, latar putih, zona tenang 4 modul. Teks terlalu panjang → pesan. */
export function GambarQr(p: { teks: string; label: string; besar?: boolean }) {
  const hasil = useMemo(() => {
    try {
      const qr = QRCode.create(p.teks, { errorCorrectionLevel: KOREKSI_QR })
      const n = qr.modules.size
      const d: string[] = []
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) if (qr.modules.get(y, x)) d.push(`M${x + ZONA_TENANG} ${y + ZONA_TENANG}h1v1h-1z`)
      }
      return { ukuran: n + ZONA_TENANG * 2, modul: n, jalur: d.join('') }
    } catch {
      return null
    }
  }, [p.teks])
  if (!hasil) {
    return <p className="qr-gagal">Teks ini terlalu panjang untuk dijadikan QR. Gunakan tombol kirim atau salin.</p>
  }
  return (
    <svg
      className={`qr${p.besar ? ' qr-besar' : ''}`}
      role="img"
      aria-label={p.label}
      data-modul={hasil.modul}
      viewBox={`0 0 ${hasil.ukuran} ${hasil.ukuran}`}
      shapeRendering="crispEdges"
    >
      <rect width="100%" height="100%" fill="#ffffff" />
      <path d={hasil.jalur} fill="#000000" />
    </svg>
  )
}

/** Layar penuh putih untuk QR: ukuran sebesar mungkin, tanpa gangguan, agar mudah dipindai HP lain/webcam. */
function LayarPenuhQr(p: { children: ReactNode; tutup: () => void }) {
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
    <div className="layar-penuh-qr" role="dialog" aria-modal="true" aria-label="QR layar penuh">
      <p className="petunjuk-qr">Naikkan kecerahan layar HP ini sampai penuh, lalu arahkan kamera HP lain ke QR.</p>
      {p.children}
      <Tombol penuh varian="kedua" onClick={p.tutup}>
        Tutup layar penuh
      </Tombol>
    </div>,
    document.body,
  )
}

/**
 * QR untuk teks apa saja: teks pendek → satu QR; teks panjang (token generus/wali) → QR berseri yang berganti
 * otomatis tiap 1,5 detik, dengan tombol Sebelumnya/Berikutnya dan Jeda. Ada tombol "Layar penuh".
 */
export function QrBerseri(p: { teks: string; label: string; jedaMs?: number }) {
  const bagian = useMemo(() => pecahQr(p.teks, { maks: MAKS_BAGIAN_QR_HP }), [p.teks])
  const [ke, setKe] = useState(0)
  const [jalan, setJalan] = useState(true)
  const [penuh, setPenuh] = useState(false)
  const n = bagian.length
  useEffect(() => setKe(0), [p.teks])
  useEffect(() => {
    if (n < 2 || !jalan) return
    const t = setInterval(() => setKe((i) => (i + 1) % n), p.jedaMs ?? JEDA_QR_SERI_MS)
    return () => clearInterval(t)
  }, [n, jalan, p.jedaMs])
  const i = Math.min(ke, n - 1)
  const gambar = (besar: boolean) =>
    n < 2 ? <GambarQr teks={p.teks} label={p.label} besar={besar} /> : <GambarQr teks={bagian[i]!} label={`${p.label} bagian ${i + 1} dari ${n}`} besar={besar} />
  const kendali =
    n < 2 ? null : (
      <>
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
      </>
    )
  return (
    <div className="qr-berseri">
      {penuh ? null : gambar(false)}
      {penuh ? null : kendali}
      <Tombol kecil varian="tipis" onClick={() => setPenuh(true)}>
        ⛶ Layar penuh
      </Tombol>
      {penuh ? (
        <LayarPenuhQr tutup={() => setPenuh(false)}>
          {gambar(true)}
          {kendali}
        </LayarPenuhQr>
      ) : null}
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
      const sebelum = pengumpul.current
      const r = tambahBagianQr(sebelum, teks)
      pengumpul.current = r.pengumpul
      if (r.status === 'tunggal' && r.hasil && !r.hasil.startsWith(awalan)) {
        // QR lain yang ikut tertangkap kamera: bagian QR berseri yang sudah terbaca tetap disimpan
        pengumpul.current = sebelum
        setSalah(`QR ini bukan ${awalan.startsWith('PPGT') ? 'token' : 'Kode Perangkat'}.`)
        return false
      }
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
        setSalah('QR ini bukan untuk langkah ini.')
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

function KemajuanQr(p: { kemajuan: { terbaca: number; total: number } | null; salah: string }) {
  return (
    <>
      {p.kemajuan && p.kemajuan.terbaca < p.kemajuan.total ? (
        <p className="kemajuan-qr" role="status">
          <b>
            {p.kemajuan.terbaca} dari {p.kemajuan.total}
          </b>{' '}
          bagian QR terbaca. Tahan kamera sampai semua bagian terbaca.
        </p>
      ) : null}
      {p.salah ? (
        <p className="qr-gagal" role="alert">
          {p.salah}
        </p>
      ) : null}
    </>
  )
}

type StatusNative = 'izin' | 'memindai' | 'ditolak' | 'gagal'

/**
 * Pemindai native (APK): minta izin kamera saat itu juga, lalu kamera tampil di belakang lapisan pemindai
 * (latar aplikasi tembus pandang). Setiap QR yang terbaca masuk ke pengumpul; QR berseri terus dipindai sampai
 * semua bagian terkumpul. Tombol kembali Android / Batal menghentikan kamera.
 */
function PemindaiNativeQr(p: {
  pemindai: PemindaiNative
  terima: (teks: string) => boolean
  kemajuan: { terbaca: number; total: number } | null
  salah: string
  batal: () => void
}) {
  const [status, setStatus] = useState<StatusNative>('izin')
  const [pesan, setPesan] = useState('')
  const [ulang, setUlang] = useState(0)
  const terimaRef = useRef(p.terima)
  terimaRef.current = p.terima
  const batalRef = useRef(p.batal)
  batalRef.current = p.batal

  useEffect(() => {
    let batal = false
    let terakhir = ''
    let selesai = false
    const pm = p.pemindai
    setStatus('izin')
    ;(async () => {
      try {
        const izin = await pm.mintaIzin()
        if (batal) return
        if (izin !== 'diizinkan') {
          setStatus('ditolak')
          return
        }
        await pm.mulai(
          (teks) => {
            const isi = teks.trim()
            if (batal || selesai || !isi || isi === terakhir) return
            terakhir = isi
            if (terimaRef.current(isi)) {
              selesai = true
              void pm.berhenti()
            }
          },
          (m) => {
            if (batal) return
            setPesan(m)
            setStatus('gagal')
            void pm.berhenti()
          },
        )
        if (batal) {
          await pm.berhenti()
          return
        }
        setStatus('memindai')
      } catch (e) {
        if (batal) return
        setPesan(e instanceof Error ? e.message : String(e))
        setStatus('gagal')
      }
    })()
    return () => {
      batal = true
      void pm.berhenti()
    }
  }, [p.pemindai, ulang])

  // Tombol kembali Android (Escape) saat kamera menyala → hentikan memindai
  useEffect(() => {
    if (status !== 'memindai') return
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape') batalRef.current()
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [status])

  const kemajuan = <KemajuanQr kemajuan={p.kemajuan} salah={p.salah} />
  if (status === 'ditolak') {
    return (
      <>
      <div className="pesan-kamera" role="alert">
        <p>
          <b>Izin kamera belum diberikan.</b> Untuk memindai QR, aplikasi perlu memakai kamera. Tekan <b>Coba lagi</b> lalu pilih{' '}
          <b>Izinkan</b>. Bila tidak muncul pertanyaan, buka pengaturan aplikasi → Izin → Kamera.
        </p>
        <div className="baris-tombol">
          <Tombol kecil onClick={() => setUlang((x) => x + 1)}>
            Coba lagi
          </Tombol>
          <Tombol kecil varian="kedua" onClick={() => p.pemindai.bukaPengaturan()}>
            Buka Pengaturan
          </Tombol>
        </div>
        <p>Bisa juga tempel teksnya di bawah.</p>
      </div>
      {kemajuan}
      </>
    )
  }
  if (status === 'gagal') {
    return (
      <div className="pesan-kamera" role="alert">
        <p>Kamera tidak bisa dipakai{pesan ? ` (${pesan})` : ''}. Silakan tempel teksnya di bawah.</p>
        <Tombol kecil varian="kedua" onClick={() => setUlang((x) => x + 1)}>
          Coba lagi
        </Tombol>
        {kemajuan}
      </div>
    )
  }
  if (status === 'izin') return <p className="keterangan">Menyiapkan kamera…</p>
  return createPortal(
    <div className="lapisan-pemindai" role="dialog" aria-modal="true" aria-label="Pemindai QR">
      <p className="petunjuk-pindai">Arahkan kamera ke QR. Untuk QR yang berganti, tahan sampai semua bagian terbaca.</p>
      <div className="jendela-pindai" aria-hidden="true" />
      <div className="kaki-pindai">
        {kemajuan}
        <Tombol penuh varian="kedua" onClick={p.batal}>
          Batal
        </Tombol>
      </div>
    </div>,
    document.body,
  )
}

/** Pemindai kamera web (peramban): getUserMedia + jsQR. Dipakai bila tidak ada pemindai native. */
function PemindaiKameraWeb(p: { awalan: string; terima: (teks: string) => boolean }) {
  const video = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'memulai' | 'memindai' | 'gagal'>('memulai')
  const [pesan, setPesan] = useState('')
  const terimaRef = useRef(p.terima)
  terimaRef.current = p.terima

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
            // perkecil agar ringan di HP 2 GB (QR berseri ≤ 97 modul tetap terbaca pada lebar 640 px)
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
        setPesan(e instanceof Error && e.name === 'NotAllowedError' ? 'Izin kamera ditolak. Izinkan kamera di pengaturan peramban/HP.' : 'Kamera tidak bisa dipakai.')
      }
    })()
    return () => {
      berhenti = true
      if (timer) clearTimeout(timer)
      aliran?.getTracks().forEach((t) => t.stop())
    }
  }, [p.awalan])

  return status !== 'gagal' ? (
    <div className="bingkai-kamera">
      <video ref={video} muted aria-label="Gambar kamera" />
      <p>{status === 'memulai' ? 'Menyalakan kamera…' : 'Arahkan kamera ke QR.'}</p>
    </div>
  ) : (
    <p className="pesan-kamera">{pesan} Silakan tempel teksnya di bawah.</p>
  )
}

/**
 * Pemindai QR. `pemindai` (APK) → pemindai native; tanpa itu → kamera web. Selalu ada cadangan tempel teks
 * (boleh berisi beberapa bagian QR berseri). `awalan` (mis. 'PPGT1.') menentukan jenis teks yang diterima.
 */
export function PemindaiQr(p: { awalan: string; dapat: (teks: string) => void; batal: () => void; labelTempel: string; pemindai?: PemindaiNative }) {
  const [tempel, setTempel] = useState('')
  const dapatRef = useRef(p.dapat)
  dapatRef.current = p.dapat
  const dapatStabil = useCallback((t: string) => dapatRef.current(t), [])
  const { terima, kemajuan, salah } = useKumpulQr(p.awalan, dapatStabil)

  return (
    <div className="pemindai">
      {p.pemindai ? (
        <PemindaiNativeQr pemindai={p.pemindai} terima={terima} kemajuan={kemajuan} salah={salah} batal={p.batal} />
      ) : (
        <>
          <PemindaiKameraWeb awalan={p.awalan} terima={terima} />
          <KemajuanQr kemajuan={kemajuan} salah={salah} />
        </>
      )}
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
