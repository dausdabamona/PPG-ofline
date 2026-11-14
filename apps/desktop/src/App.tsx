// Akar aplikasi: memuat database, pengaturan awal / masuk, simpan otomatis, kunci otomatis, tata letak + navigasi.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { adalahAdmin, ambilMeta, bukaDb, type Db, type KunciAdmin } from '@ppg/core'
import { DaftarToast, PenyediaApp, useApp, useToast, type NilaiApp } from './konteks'
import type { Platform } from './platform'
import { KotakGalat, Memuat } from './komponen/ui'
import { pesanGalat } from './utils/label'
import { LayarMasuk, LayarPengaturanAwal } from './halaman/masuk'
import { HalamanBeranda } from './halaman/beranda'
import { HalamanWilayah } from './halaman/wilayah'
import { HalamanGenerus } from './halaman/generus'
import { HalamanPengajian } from './halaman/pengajian'
import { HalamanMateri } from './halaman/materi'
import { HalamanPerangkat } from './halaman/perangkat'
import { HalamanImpor } from './halaman/impor'
import { HalamanUsulan } from './halaman/usulan'
import { HalamanKoreksi } from './halaman/koreksi'
import { HalamanPaket } from './halaman/paket'
import { HalamanRekap } from './halaman/rekap'
import { HalamanPengaturan } from './halaman/pengaturan'

export const MENU = [
  { kunci: 'beranda', teks: 'Beranda', ikon: '⌂' },
  { kunci: 'wilayah', teks: 'Wilayah', ikon: '▦' },
  { kunci: 'generus', teks: 'Generus & Jamaah', ikon: '☺' },
  { kunci: 'pengajian', teks: 'Pengajian', ikon: '◷' },
  { kunci: 'materi', teks: 'Materi', ikon: '❖' },
  { kunci: 'perangkat', teks: 'Perangkat & Token', ikon: '⚿' },
  { kunci: 'impor', teks: 'Impor Setoran', ikon: '⇩' },
  { kunci: 'usulan', teks: 'Usulan', ikon: '✉' },
  { kunci: 'koreksi', teks: 'Koreksi', ikon: '✎' },
  { kunci: 'paket', teks: 'Kirim Paket', ikon: '⇧' },
  { kunci: 'rekap', teks: 'Rekap & Laporan', ikon: '▤' },
  { kunci: 'pengaturan', teks: 'Pengaturan', ikon: '⚙' },
] as const
export type KunciMenu = (typeof MENU)[number]['kunci']

const BATAS_DIAM_MS = 30 * 60 * 1000
const JEDA_SIMPAN_MS = 800

type Tahap = { t: 'memuat' } | { t: 'galat'; pesan: string } | { t: 'awal' } | { t: 'masuk' } | { t: 'siap'; kunci: KunciAdmin }

export function App(p: { platform: Platform; batasDiamMs?: number; jedaSimpanMs?: number }) {
  const { platform } = p
  const batasDiam = p.batasDiamMs ?? BATAS_DIAM_MS
  const jedaSimpan = p.jedaSimpanMs ?? JEDA_SIMPAN_MS
  const [db, setDb] = useState<Db | null>(null)
  const [tahap, setTahap] = useState<Tahap>({ t: 'memuat' })
  const [versi, setVersi] = useState(0)
  const [halaman, setHalaman] = useState<KunciMenu>('beranda')
  const toast = useToast()
  const dbRef = useRef<Db | null>(null)
  const timerSimpan = useRef<ReturnType<typeof setTimeout> | null>(null)
  const antreSimpan = useRef<Promise<void>>(Promise.resolve())
  const kotor = useRef(false)

  const simpanSekarang = useCallback(async () => {
    if (timerSimpan.current) clearTimeout(timerSimpan.current)
    timerSimpan.current = null
    const d = dbRef.current
    if (!d || !kotor.current) return antreSimpan.current
    kotor.current = false
    const tugas = antreSimpan.current.then(async () => {
      try {
        await platform.simpanDb(d.ekspor())
      } catch (e) {
        kotor.current = true
        toast.tambah('galat', `Gagal menyimpan database: ${pesanGalat(e)}`)
      }
    })
    antreSimpan.current = tugas
    return tugas
  }, [platform, toast.tambah])

  // Pasang database: pendengar perubahan → render ulang + simpan (debounce).
  const pasangDb = useCallback(
    (baru: Db) => {
      dbRef.current = baru
      setDb(baru)
      return baru.saatBerubah(() => {
        kotor.current = true
        setVersi((v) => v + 1)
        if (timerSimpan.current) clearTimeout(timerSimpan.current)
        timerSimpan.current = setTimeout(() => void simpanSekarang(), jedaSimpan)
      })
    },
    [simpanSekarang, jedaSimpan],
  )
  const lepasRef = useRef<(() => void) | null>(null)

  // Muat database saat mulai.
  useEffect(() => {
    let batal = false
    ;(async () => {
      try {
        const opsi = await platform.opsiSqlJs()
        const bytes = await platform.muatDb()
        const d = await bukaDb(bytes ?? undefined, opsi)
        if (batal) return
        lepasRef.current?.()
        lepasRef.current = pasangDb(d)
        if (adalahAdmin(d)) setTahap({ t: 'masuk' })
        else if (!bytes || !ambilMeta(d, 'org_id')) setTahap({ t: 'awal' })
        else setTahap({ t: 'galat', pesan: 'Berkas database bukan database admin.' })
      } catch (e) {
        if (!batal) setTahap({ t: 'galat', pesan: pesanGalat(e) })
      }
    })()
    return () => {
      batal = true
    }
  }, [platform, pasangDb])

  // Simpan saat jendela akan ditutup.
  useEffect(() => {
    platform.saatAkanTutup(async () => {
      await simpanSekarang()
    })
  }, [platform, simpanSekarang])

  const kunciAplikasi = useCallback(() => {
    setTahap((t) => (t.t === 'siap' ? { t: 'masuk' } : t))
  }, [])

  // Kunci otomatis setelah tidak aktif.
  const siap = tahap.t === 'siap'
  useEffect(() => {
    if (!siap) return
    let terakhir = Date.now()
    const aktif = () => {
      terakhir = Date.now()
    }
    const peristiwa = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'] as const
    for (const n of peristiwa) window.addEventListener(n, aktif, { passive: true })
    const selang = setInterval(
      () => {
        if (Date.now() - terakhir >= batasDiam) {
          void simpanSekarang()
          kunciAplikasi()
          toast.tambah('info', 'Aplikasi dikunci otomatis karena tidak aktif. Masukkan kata sandi untuk melanjutkan.')
        }
      },
      Math.max(20, Math.min(30_000, Math.floor(batasDiam / 4))),
    )
    return () => {
      for (const n of peristiwa) window.removeEventListener(n, aktif)
      clearInterval(selang)
    }
  }, [siap, batasDiam, kunciAplikasi, simpanSekarang, toast.tambah])

  const gantiDb = useCallback(
    async (baru: Db, kunci: KunciAdmin) => {
      const lama = dbRef.current
      lepasRef.current?.()
      lepasRef.current = pasangDb(baru)
      kotor.current = true
      await simpanSekarang()
      if (lama && lama !== baru) lama.tutup()
      setVersi((v) => v + 1)
      setTahap({ t: 'siap', kunci })
    },
    [pasangDb, simpanSekarang],
  )

  const nilai = useMemo<NilaiApp | null>(() => {
    if (!db || tahap.t !== 'siap') return null
    return {
      db,
      kunci: tahap.kunci,
      platform,
      versi,
      toast: toast.tambah,
      simpanSekarang,
      gantiDb,
      kunciAplikasi,
      aksi: async (fn, pesanSukses) => {
        try {
          const h = await fn()
          if (pesanSukses) toast.tambah('sukses', typeof pesanSukses === 'function' ? pesanSukses(h) : pesanSukses)
          return h
        } catch (e) {
          toast.tambah('galat', pesanGalat(e))
          return undefined
        }
      },
    }
  }, [db, tahap, platform, versi, toast.tambah, simpanSekarang, gantiDb, kunciAplikasi])

  let isi: React.ReactNode
  if (tahap.t === 'memuat' || !db) {
    isi = tahap.t === 'galat' ? <LayarGalat pesan={tahap.pesan} /> : <div className="layar-tengah"><Memuat teks="Memuat database…" /></div>
  } else if (tahap.t === 'galat') {
    isi = <LayarGalat pesan={tahap.pesan} />
  } else if (tahap.t === 'awal') {
    isi = (
      <LayarPengaturanAwal
        db={db}
        platform={platform}
        selesai={async (d, kunci) => {
          await gantiDb(d, kunci)
          toast.tambah('sukses', 'Database admin siap. Selamat datang!')
        }}
      />
    )
  } else if (tahap.t === 'masuk') {
    isi = <LayarMasuk db={db} platform={platform} masuk={(kunci) => setTahap({ t: 'siap', kunci })} />
  } else if (nilai) {
    isi = (
      <PenyediaApp nilai={nilai}>
        <TataLetak halaman={halaman} pilih={setHalaman} />
      </PenyediaApp>
    )
  }

  return (
    <>
      {isi}
      <DaftarToast daftar={toast.daftar} hapus={toast.hapus} />
    </>
  )
}

function LayarGalat(p: { pesan: string }) {
  return (
    <div className="layar-tengah">
      <div className="kartu kartu-sempit">
        <h1>PPG Sorong Admin</h1>
        <KotakGalat pesan={p.pesan} />
        <p>Tutup aplikasi lalu coba lagi. Bila berlanjut, pulihkan database dari folder cadangan.</p>
      </div>
    </div>
  )
}

function TataLetak(p: { halaman: KunciMenu; pilih: (k: KunciMenu) => void }) {
  return (
    <div className="tata-letak">
      <BilahSamping halaman={p.halaman} pilih={p.pilih} />
      <main className="isi-utama">
        <Halaman kunci={p.halaman} pilih={p.pilih} />
      </main>
    </div>
  )
}

function BilahSamping(p: { halaman: KunciMenu; pilih: (k: KunciMenu) => void }) {
  const { kunci, kunciAplikasi, simpanSekarang } = useApp()
  return (
    <nav className="bilah-samping" aria-label="Menu utama">
      <div className="merek">
        <img className="merek-logo" src="./logo.svg" alt="" aria-hidden="true" />
        <div>
          <strong>PPG Sorong Admin</strong>
          <small>{kunci.namaOrganisasi}</small>
        </div>
      </div>
      <ul>
        {MENU.map((m) => (
          <li key={m.kunci}>
            <button
              type="button"
              className={p.halaman === m.kunci ? 'menu aktif' : 'menu'}
              aria-current={p.halaman === m.kunci ? 'page' : undefined}
              onClick={() => p.pilih(m.kunci)}
            >
              <span className="ikon" aria-hidden="true">
                {m.ikon}
              </span>
              {m.teks}
            </button>
          </li>
        ))}
      </ul>
      <div className="bilah-bawah">
        <button
          type="button"
          className="menu"
          onClick={async () => {
            await simpanSekarang()
            kunciAplikasi()
          }}
        >
          <span className="ikon" aria-hidden="true">
            ⏻
          </span>
          Kunci aplikasi
        </button>
      </div>
    </nav>
  )
}

function Halaman(p: { kunci: KunciMenu; pilih: (k: KunciMenu) => void }) {
  switch (p.kunci) {
    case 'beranda':
      return <HalamanBeranda pilih={p.pilih} />
    case 'wilayah':
      return <HalamanWilayah />
    case 'generus':
      return <HalamanGenerus />
    case 'pengajian':
      return <HalamanPengajian />
    case 'materi':
      return <HalamanMateri />
    case 'perangkat':
      return <HalamanPerangkat />
    case 'impor':
      return <HalamanImpor />
    case 'usulan':
      return <HalamanUsulan />
    case 'koreksi':
      return <HalamanKoreksi />
    case 'paket':
      return <HalamanPaket />
    case 'rekap':
      return <HalamanRekap />
    case 'pengaturan':
      return <HalamanPengaturan />
  }
}
