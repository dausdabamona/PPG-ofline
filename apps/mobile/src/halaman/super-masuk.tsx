// Mode Super Admin HP (Fase 9): database tersendiri (`ppg-super-db`) berjenis instalasi EXE di dalam APK.
// Alur: buat kata sandi (min. 8) → Kode Perangkat → token "Super Admin HP" dari EXE Daerah → Menu Super Admin.
// Kunci perangkat dienkripsi kata sandi; aplikasi terkunci otomatis bila di latar belakang lebih dari 10 menit.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  adalahExe,
  aktifkanExe,
  bukaDb,
  bukaKunciExe,
  imporBanyak,
  infoInstalasi,
  inisialisasiExe,
  kodePerangkatSaya,
  kunciExe,
  kunciExeTerbuka,
  profilExe,
  type Db,
  type HasilImporBanyak,
  type KunciExe,
} from '@ppg/core'
import type { JenisToast } from '../konteks'
import { PenyediaSuper, type NilaiSuper } from '../konteks-super'
import type { BerkasKirim, BerkasMasuk, Platform } from '../platform'
import { PemindaiQr, QrBerseri } from '../komponen/qr'
import { AreaTeks, Isian, Kartu, Memuat, Spanduk, Tombol } from '../komponen/ui'
import { pesanGalat, pesanHasilBerkas } from '../utils/label'
import { MenuSuper } from './super-admin'

/** Kunci otomatis bila aplikasi di latar belakang lebih lama dari ini. */
export const KUNCI_OTOMATIS_MS = 10 * 60_000
export const PANJANG_SANDI_SUPER_MIN = 8
const JEDA_SIMPAN_MS = 500

type FnToast = (j: JenisToast, p: string) => void
type Tahap = 'memuat' | 'buat' | 'terkunci' | 'aktivasi' | 'siap'

export function AplikasiSuper(p: {
  platform: Platform
  toast: FnToast
  /** Kembali ke profil HP biasa. */
  keluar: () => void
  /** Nama HP dari identitas profil biasa (saran nama). */
  namaHp?: string
  kunciOtomatisMs?: number
  jedaSimpanMs?: number
  /** Daftarkan penangan berkas masuk (WA → "Buka dengan") selama mode Super Admin aktif. */
  pasangPenanganBerkas: (fn: ((b: BerkasMasuk) => void) | null) => void
}) {
  const { platform, toast } = p
  const batasKunci = p.kunciOtomatisMs ?? KUNCI_OTOMATIS_MS
  const jedaSimpan = p.jedaSimpanMs ?? JEDA_SIMPAN_MS
  const [db, setDb] = useState<Db | null>(null)
  const [kunci, setKunci] = useState<KunciExe | null>(null)
  const [tahap, setTahap] = useState<Tahap>('memuat')
  const [versi, setVersi] = useState(0)
  const dbRef = useRef<Db | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const kotor = useRef(false)
  const antre = useRef<Promise<void>>(Promise.resolve())
  const lepas = useRef<(() => void) | null>(null)
  const latarSejak = useRef<number | null>(null)

  const simpanSekarang = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const d = dbRef.current
    if (!d || !kotor.current) return antre.current
    kotor.current = false
    const tugas = antre.current.then(async () => {
      try {
        await platform.simpanDbSuper(d.ekspor())
      } catch (e) {
        kotor.current = true
        toast('galat', `Data Super Admin gagal disimpan: ${pesanGalat(e)}`)
      }
    })
    antre.current = tugas
    return tugas
  }, [platform, toast])

  const pasangDb = useCallback(
    (baru: Db) => {
      lepas.current?.()
      dbRef.current = baru
      setDb(baru)
      lepas.current = baru.saatBerubah(() => {
        kotor.current = true
        setVersi((v) => v + 1)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => void simpanSekarang(), jedaSimpan)
      })
    },
    [simpanSekarang, jedaSimpan],
  )

  // muat database Super Admin (bila ada)
  useEffect(() => {
    let batal = false
    ;(async () => {
      try {
        const bytes = await platform.muatDbSuper()
        if (batal) return
        if (!bytes) return setTahap('buat')
        const d = await bukaDb(bytes, await platform.opsiSqlJs())
        if (batal) return
        if (!adalahExe(d)) throw new Error('Data Super Admin di HP ini rusak.')
        pasangDb(d)
        setTahap('terkunci')
      } catch (e) {
        if (!batal) {
          toast('galat', pesanGalat(e))
          p.keluar()
        }
      }
    })()
    return () => {
      batal = true
      lepas.current?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform])

  const kunciSekarang = useCallback(() => {
    const d = dbRef.current
    if (d) kunciExe(d)
    setKunci(null)
    setTahap((t) => (t === 'buat' || t === 'memuat' ? t : 'terkunci'))
  }, [])

  // simpan & catat waktu saat ke latar belakang; kunci otomatis bila kembali setelah > 10 menit
  useEffect(() => {
    const a = platform.saatLatarBelakang(() => {
      latarSejak.current = Date.now()
      void simpanSekarang()
    })
    const b = platform.saatAktifKembali(() => {
      const sejak = latarSejak.current
      latarSejak.current = null
      if (sejak !== null && Date.now() - sejak >= batasKunci && dbRef.current && kunciExeTerbuka(dbRef.current)) {
        kunciSekarang()
        toast('info', 'Super Admin terkunci otomatis. Masukkan kata sandi.')
      }
    })
    return () => {
      a()
      b()
    }
  }, [platform, simpanSekarang, batasKunci, kunciSekarang, toast])

  const keluar = useCallback(async () => {
    await simpanSekarang()
    kunciSekarang()
    p.pasangPenanganBerkas(null)
    p.keluar()
  }, [simpanSekarang, kunciSekarang, p])

  const aksi = useCallback(
    async <T,>(fn: () => T | Promise<T>, pesanSukses?: string | ((h: T) => string)): Promise<T | undefined> => {
      try {
        const h = await fn()
        if (pesanSukses) toast('sukses', typeof pesanSukses === 'function' ? pesanSukses(h) : pesanSukses)
        return h
      } catch (e) {
        toast('galat', pesanGalat(e))
        return undefined
      }
    },
    [toast],
  )

  const kirimBerkas = useCallback(
    async (daftar: BerkasKirim | BerkasKirim[], pesanSukses?: string) => {
      const l = Array.isArray(daftar) ? daftar : [daftar]
      try {
        await simpanSekarang()
        await platform.bagikanBerkas(l, l.length === 1 ? l[0]!.nama : `${l.length} berkas`)
        toast('sukses', pesanSukses ?? (platform.jenis === 'web' ? 'Berkas diunduh. Kirim lewat WA.' : 'Berkas siap dikirim.'))
        return true
      } catch (e) {
        toast('galat', `Berkas gagal dikirim: ${pesanGalat(e)}`)
        return false
      }
    },
    [platform, simpanSekarang, toast],
  )

  const bukaBerkas = useCallback(
    async (daftar: BerkasMasuk[]): Promise<HasilImporBanyak[]> => {
      const d = dbRef.current
      if (!d || !daftar.length) return []
      if (!kunciExeTerbuka(d)) {
        toast('galat', 'Super Admin terkunci. Masukkan kata sandi dulu, lalu buka berkasnya lagi.')
        return []
      }
      const hasil = imporBanyak(d, daftar)
      for (const h of hasil) {
        const m = pesanHasilBerkas(h)
        toast(m.sukses ? 'sukses' : 'galat', m.teks)
      }
      kotor.current = true
      await simpanSekarang()
      setVersi((v) => v + 1)
      return hasil
    },
    [simpanSekarang, toast],
  )

  // berkas dari WA saat mode Super Admin aktif → dibuka di database Super Admin
  useEffect(() => {
    p.pasangPenanganBerkas((b) => void bukaBerkas([b]))
    return () => p.pasangPenanganBerkas(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bukaBerkas])

  const gantiDb = useCallback(
    async (bytes: Uint8Array) => {
      const baru = await bukaDb(bytes, await platform.opsiSqlJs())
      if (infoInstalasi(baru).peran !== 'super_hp') throw new Error('Berkas ini bukan cadangan Super Admin HP.')
      pasangDb(baru)
      kotor.current = true
      await simpanSekarang()
      setKunci(null)
      setTahap('terkunci')
    },
    [platform, pasangDb, simpanSekarang],
  )

  const terbuka = (k: KunciExe) => {
    setKunci(k)
    const d = dbRef.current!
    setTahap(infoInstalasi(d).aktif ? 'siap' : 'aktivasi')
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const profil = useMemo(() => (db && tahap === 'siap' ? coba(() => profilExe(db)) : undefined), [db, tahap, versi])

  if (tahap === 'memuat') return <Memuat teks="Membuka Super Admin…" />
  if (tahap === 'buat')
    return (
      <LayarBuatSuper
        namaAwal={p.namaHp ?? ''}
        batal={p.keluar}
        buat={async (nama, sandi) => {
          const d = await bukaDb(undefined, await platform.opsiSqlJs())
          const { kunci: k } = await inisialisasiExe(d, { sandi, label: nama })
          pasangDb(d)
          kotor.current = true
          await simpanSekarang()
          setKunci(k)
          setTahap('aktivasi')
        }}
        toast={toast}
      />
    )
  if (tahap === 'terkunci' || !db || !kunci)
    return (
      <LayarKunciSuper
        buka={async (sandi) => terbuka(await bukaKunciExe(dbRef.current!, sandi))}
        keluar={() => void keluar()}
        toast={toast}
      />
    )
  if (tahap === 'aktivasi' || !profil)
    return (
      <LayarAktivasiSuper
        db={db}
        platform={platform}
        toast={toast}
        keluar={() => void keluar()}
        aktifkan={async (token) => {
          await aktifkanExe(db, kunci, token, { superHp: true })
          kotor.current = true
          await simpanSekarang()
          setVersi((v) => v + 1)
          setTahap('siap')
          toast('sukses', 'Super Admin HP aktif. Buka paket dari Daerah agar daftar wilayah & kunci kelompok tersedia.')
        }}
      />
    )
  const nilai: NilaiSuper = {
    db,
    kunci,
    platform,
    profil,
    versi,
    toast,
    aksi,
    kirimBerkas,
    bukaBerkas,
    simpanSekarang,
    kunciSekarang,
    keluar: () => void keluar(),
    gantiDb,
  }
  return (
    <PenyediaSuper nilai={nilai}>
      <MenuSuper />
    </PenyediaSuper>
  )
}

function coba<T>(fn: () => T): T | undefined {
  try {
    return fn()
  } catch {
    return undefined
  }
}


function LayarBuatSuper(p: { namaAwal: string; batal: () => void; buat: (nama: string, sandi: string) => Promise<void>; toast: FnToast }) {
  const [nama, setNama] = useState(p.namaAwal)
  const [sandi, setSandi] = useState('')
  const [ulang, setUlang] = useState('')
  const kurang = sandi.length > 0 && sandi.length < PANJANG_SANDI_SUPER_MIN
  const beda = ulang.length > 0 && ulang !== sandi
  return (
    <main className="layar-awal">
      <header className="judul-halaman">
        <button type="button" className="tombol-kembali" aria-label="Kembali" onClick={p.batal}>
          ‹
        </button>
        <div>
          <h1>Aktifkan Super Admin HP</h1>
          <p className="keterangan">Untuk pendaftaran awal di seluruh daerah, atas izin Admin Daerah.</p>
        </div>
      </header>
      <img className="logo" src="./logo.svg" alt="" aria-hidden="true" />
      <Kartu judul="1. Buat kata sandi Super Admin">
        <p>
          Super Admin HP mendaftarkan pengurus, mubaligh, orang tua, murid, dan laptop desa/kelompok/kurikulum. Datanya <b>terpisah</b> dari
          profil biasa di HP ini dan dikunci dengan kata sandi.
        </p>
        <Isian label="Nama HP ini" nilai={nama} ubah={setNama} placeholder="mis. HP Pak Fir" />
        <Isian label="Kata sandi Super Admin" type="password" nilai={sandi} ubah={setSandi} bantuan="Minimal 8 huruf/angka. Catat di tempat aman — sandi tidak bisa dipulihkan." />
        <Isian label="Ulangi kata sandi" type="password" nilai={ulang} ubah={setUlang} />
        {kurang ? <Spanduk jenis="peringatan">Kata sandi minimal 8 karakter.</Spanduk> : null}
        {beda ? <Spanduk jenis="peringatan">Kedua kata sandi belum sama.</Spanduk> : null}
        <Tombol
          penuh
          disabled={!nama.trim() || sandi.length < PANJANG_SANDI_SUPER_MIN || sandi !== ulang}
          onClick={async () => {
            try {
              await p.buat(nama.trim(), sandi)
            } catch (e) {
              p.toast('galat', pesanGalat(e))
            }
          }}
        >
          Buat kunci Super Admin
        </Tombol>
      </Kartu>
    </main>
  )
}

function LayarKunciSuper(p: { buka: (sandi: string) => Promise<void>; keluar: () => void; toast: FnToast }) {
  const [sandi, setSandi] = useState('')
  return (
    <main className="layar-awal">
      <header className="judul-halaman">
        <button type="button" className="tombol-kembali" aria-label="Kembali" onClick={p.keluar}>
          ‹
        </button>
        <div>
          <h1>Super Admin HP</h1>
          <p className="keterangan">Terkunci. Masukkan kata sandi Super Admin.</p>
        </div>
      </header>
      <img className="logo" src="./logo.svg" alt="" aria-hidden="true" />
      <Kartu>
        <Isian label="Kata sandi Super Admin" type="password" nilai={sandi} ubah={setSandi} />
        <Tombol
          penuh
          disabled={!sandi}
          onClick={async () => {
            try {
              await p.buka(sandi)
            } catch (e) {
              setSandi('')
              p.toast('galat', pesanGalat(e))
            }
          }}
        >
          Buka Super Admin
        </Tombol>
        <Tombol penuh varian="tipis" onClick={p.keluar}>
          Kembali ke profil biasa
        </Tombol>
      </Kartu>
    </main>
  )
}

function LayarAktivasiSuper(p: { db: Db; platform: Platform; toast: FnToast; keluar: () => void; aktifkan: (token: string) => Promise<void> }) {
  const kode = useMemo(() => kodePerangkatSaya(p.db), [p.db])
  const [mode, setMode] = useState<'pilih' | 'pindai' | 'tempel'>('pilih')
  const [token, setToken] = useState('')
  const jalankan = async (t: string) => {
    try {
      await p.aktifkan(t.trim())
    } catch (e) {
      p.toast('galat', pesanGalat(e))
    }
  }
  return (
    <main className="layar-awal">
      <header className="judul-halaman">
        <button type="button" className="tombol-kembali" aria-label="Kembali" onClick={p.keluar}>
          ‹
        </button>
        <div>
          <h1>Kode Super Admin HP</h1>
          <p className="keterangan">Langkah 2: kirim kode ini ke Admin Daerah. Langkah 3: masukkan token Super Admin HP.</p>
        </div>
      </header>
      <Kartu judul="2. Kode Perangkat Super Admin">
        <p>
          Admin Daerah menempelnya di laptop: <b>Perangkat &amp; Token</b> → Untuk: <b>Super Admin HP (pendaftaran seluruh daerah)</b>.
        </p>
        <div className="kotak-qr">
          <QrBerseri teks={kode} label="QR Kode Perangkat Super Admin" />
        </div>
        <details className="teks-kode">
          <summary>Lihat teks kode</summary>
          <code data-testid="kode-perangkat-super">{kode}</code>
        </details>
        <div className="baris-tombol">
          <Tombol varian="wa" onClick={() => p.platform.bagikanTeks(kode, 'Kode Perangkat Super Admin PPG')}>
            Kirim lewat WA
          </Tombol>
          <Tombol
            varian="kedua"
            onClick={async () => {
              await p.platform.salinTeks(kode)
              p.toast('sukses', 'Kode disalin.')
            }}
          >
            Salin
          </Tombol>
        </div>
      </Kartu>
      <Kartu judul="3. Masukkan token Super Admin HP">
        {mode === 'pindai' ? (
          <PemindaiQr awalan="PPGT1." pemindai={p.platform.pemindai} labelTempel="Atau tempel token di sini" batal={() => setMode('pilih')} dapat={(t) => void jalankan(t)} />
        ) : mode === 'tempel' ? (
          <>
            <AreaTeks label="Token Super Admin" nilai={token} ubah={setToken} baris={4} placeholder="PPGT1.…" />
            <div className="baris-tombol">
              <Tombol varian="kedua" onClick={() => setMode('pilih')}>
                Batal
              </Tombol>
              <Tombol disabled={!token.trim()} onClick={() => jalankan(token)}>
                Aktifkan Super Admin
              </Tombol>
            </div>
          </>
        ) : (
          <div className="tumpuk">
            <Tombol penuh onClick={() => setMode('pindai')}>
              Pindai QR Token
            </Tombol>
            <Tombol penuh varian="kedua" onClick={() => setMode('tempel')}>
              Tempel Token
            </Tombol>
          </div>
        )}
      </Kartu>
    </main>
  )
}
