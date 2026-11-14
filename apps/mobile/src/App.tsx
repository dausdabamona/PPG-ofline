// Akar aplikasi HP: memuat database (IndexedDB), simpan otomatis (jeda 500 ms + saat ke latar belakang),
// layar awal (nama HP → Kode Perangkat → token), pilih profil (PIN), lalu kerangka sesuai peran.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { adalahAdmin, ambilIdentitas, bukaDb, daftarProfil, imporBanyak, profilAktif, type Db, type HasilImporBanyak } from '@ppg/core'
import { DaftarToast, PenyediaApp, useToast, type NilaiApp, type Tujuan } from './konteks'
import type { BerkasKirim, BerkasMasuk, Platform } from './platform'
import { KotakGalat, Memuat } from './komponen/ui'
import { pesanGalat, pesanHasilBerkas } from './utils/label'
import { LayarAwal, LayarPilihProfil, LayarSambut } from './halaman/awal'
import { Kerangka } from './kerangka'

const JEDA_SIMPAN_MS = 500

type Tahap = { t: 'memuat' } | { t: 'galat'; pesan: string } | { t: 'sambut' } | { t: 'awal' } | { t: 'pilih' } | { t: 'siap' }

/** Tentukan layar pertama dari isi database. */
function tahapAwal(db: Db): Tahap {
  if (adalahAdmin(db)) return { t: 'galat', pesan: 'Data ini milik aplikasi admin (komputer), bukan HP.' }
  try {
    ambilIdentitas(db)
  } catch {
    return { t: 'sambut' }
  }
  const semua = daftarProfil(db)
  if (!semua.length) return { t: 'awal' }
  const aktif = profilAktif(db)
  if (semua.length > 1 || !aktif || aktif.ada_pin) return { t: 'pilih' }
  return { t: 'siap' }
}

export function App(p: { platform: Platform; jedaSimpanMs?: number }) {
  const { platform } = p
  const jedaSimpan = p.jedaSimpanMs ?? JEDA_SIMPAN_MS
  const [db, setDb] = useState<Db | null>(null)
  const [tahap, setTahap] = useState<Tahap>({ t: 'memuat' })
  const [layarAkun, setLayarAkun] = useState(false)
  const [versi, setVersi] = useState(0)
  const toast = useToast()
  const dbRef = useRef<Db | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const antre = useRef<Promise<void>>(Promise.resolve())
  const kotor = useRef(false)
  const lepas = useRef<(() => void) | null>(null)

  const simpanSekarang = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const d = dbRef.current
    if (!d || !kotor.current) return antre.current
    kotor.current = false
    const tugas = antre.current.then(async () => {
      try {
        await platform.simpanDb(d.ekspor())
      } catch (e) {
        kotor.current = true
        toast.tambah('galat', `Data HP gagal disimpan: ${pesanGalat(e)}`)
      }
    })
    antre.current = tugas
    return tugas
  }, [platform, toast.tambah])

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

  // Muat database saat mulai.
  useEffect(() => {
    let batal = false
    ;(async () => {
      try {
        const opsi = await platform.opsiSqlJs()
        const bytes = await platform.muatDb()
        const d = await bukaDb(bytes ?? undefined, opsi)
        if (batal) return
        pasangDb(d)
        setTahap(tahapAwal(d))
      } catch (e) {
        if (!batal) setTahap({ t: 'galat', pesan: pesanGalat(e) })
      }
    })()
    return () => {
      batal = true
    }
  }, [platform, pasangDb])

  // Simpan saat aplikasi ke latar belakang.
  useEffect(() => platform.saatLatarBelakang(() => void simpanSekarang()), [platform, simpanSekarang])

  const bukaBerkas = useCallback(
    async (daftar: BerkasMasuk[]): Promise<HasilImporBanyak[]> => {
      const d = dbRef.current
      if (!d || !daftar.length) return []
      const hasil = imporBanyak(d, daftar)
      for (const h of hasil) {
        const m = pesanHasilBerkas(h)
        toast.tambah(m.sukses ? 'sukses' : 'galat', m.teks)
      }
      await simpanSekarang()
      // profil bisa berubah status (dibekukan/dicabut) — segarkan tampilan
      setVersi((v) => v + 1)
      return hasil
    },
    [simpanSekarang, toast.tambah],
  )

  // Berkas .ppg dibuka dari WA ("Buka dengan PPG Sorong").
  const siapDb = !!db
  useEffect(() => {
    if (!siapDb) return
    return platform.saatBerkasMasuk((b) => void bukaBerkas([b]))
  }, [platform, siapDb, bukaBerkas])

  const kirimBerkas = useCallback(
    async (daftar: BerkasKirim | BerkasKirim[], pesanSukses?: string) => {
      const l = Array.isArray(daftar) ? daftar : [daftar]
      try {
        await simpanSekarang()
        await platform.bagikanBerkas(l, l.length === 1 ? l[0]!.nama : `${l.length} berkas`)
        toast.tambah('sukses', pesanSukses ?? (platform.jenis === 'web' ? 'Berkas diunduh. Kirim lewat WA.' : 'Berkas siap dikirim.'))
        return true
      } catch (e) {
        toast.tambah('galat', `Berkas gagal dikirim: ${pesanGalat(e)}`)
        return false
      }
    },
    [platform, simpanSekarang, toast.tambah],
  )

  const gantiDb = useCallback(
    async (bytes: Uint8Array) => {
      const baru = await bukaDb(bytes, await platform.opsiSqlJs())
      if (adalahAdmin(baru)) throw new Error('Berkas ini cadangan aplikasi admin, bukan cadangan HP.')
      try {
        ambilIdentitas(baru)
      } catch {
        throw new Error('Berkas ini bukan cadangan data HP PPG Sorong.')
      }
      pasangDb(baru)
      kotor.current = true
      await simpanSekarang()
      setLayarAkun(false)
      setTahap(tahapAwal(baru))
    },
    [platform, pasangDb, simpanSekarang],
  )

  const ke = useCallback((t: Tujuan) => {
    if (t === 'akun') return setLayarAkun(true)
    setLayarAkun(false)
    if (t === 'pilih') setTahap({ t: 'pilih' })
    else if (t === 'tambah') setTahap({ t: 'awal' })
    else setTahap({ t: 'siap' })
  }, [])

  const aksi = useCallback(
    async <T,>(fn: () => T | Promise<T>, pesanSukses?: string | ((h: T) => string)): Promise<T | undefined> => {
      try {
        const h = await fn()
        if (pesanSukses) toast.tambah('sukses', typeof pesanSukses === 'function' ? pesanSukses(h) : pesanSukses)
        return h
      } catch (e) {
        toast.tambah('galat', pesanGalat(e))
        return undefined
      }
    },
    [toast.tambah],
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const profil = useMemo(() => (db ? profilAktif(db) : undefined), [db, versi])

  const nilai: NilaiApp | null = useMemo(
    () =>
      db && profil
        ? { db, platform, versi, profil, toast: toast.tambah, aksi, bukaBerkas, kirimBerkas, simpanSekarang, gantiDb, ke }
        : null,
    [db, platform, versi, profil, toast.tambah, aksi, bukaBerkas, kirimBerkas, simpanSekarang, gantiDb, ke],
  )

  let isi
  if (tahap.t === 'memuat' || (tahap.t !== 'galat' && !db)) isi = <Memuat teks="Membuka aplikasi…" />
  else if (tahap.t === 'galat') isi = <div className="layar-tengah"><KotakGalat pesan={tahap.pesan} /></div>
  else if (tahap.t === 'sambut') isi = <LayarSambut db={db!} selesai={() => setTahap({ t: 'awal' })} toast={toast.tambah} />
  else if (tahap.t === 'awal')
    isi = (
      <LayarAwal
        db={db!}
        platform={platform}
        toast={toast.tambah}
        bukaBerkas={bukaBerkas}
        batal={daftarProfil(db!).length ? () => setTahap(tahapAwal(db!).t === 'siap' ? { t: 'siap' } : { t: 'pilih' }) : undefined}
        selesai={() => {
          void simpanSekarang()
          setTahap({ t: 'siap' })
        }}
      />
    )
  else if (tahap.t === 'pilih')
    isi = <LayarPilihProfil db={db!} toast={toast.tambah} pilih={() => setTahap({ t: 'siap' })} tambah={() => setTahap({ t: 'awal' })} />
  else if (!nilai) isi = <LayarPilihProfil db={db!} toast={toast.tambah} pilih={() => setTahap({ t: 'siap' })} tambah={() => setTahap({ t: 'awal' })} />
  else
    isi = (
      <PenyediaApp nilai={nilai}>
        <Kerangka akun={layarAkun} />
      </PenyediaApp>
    )

  return (
    <div className="aplikasi">
      {isi}
      <DaftarToast daftar={toast.daftar} hapus={toast.hapus} />
    </div>
  )
}
