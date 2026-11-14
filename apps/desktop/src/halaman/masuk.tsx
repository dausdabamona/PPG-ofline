// Layar 1: Pengaturan awal (buat admin baru / pulihkan dari cadangan) dan Masuk dengan kata sandi.
import { useState } from 'react'
import { adalahAdmin, ambilMeta, bukaDb, bukaKunciAdmin, imporCadanganKunci, inisialisasiAdmin, type Db, type KunciAdmin } from '@ppg/core'
import type { BerkasDibuka, Platform } from '../platform'
import { Isian, KotakGalat, Tombol } from '../komponen/ui'
import { pesanGalat } from '../utils/label'

export function LayarPengaturanAwal(p: { db: Db; platform: Platform; selesai: (db: Db, kunci: KunciAdmin) => Promise<void> }) {
  const [mode, setMode] = useState<'baru' | 'pulihkan'>('baru')
  return (
    <div className="layar-tengah">
      <div className="kartu kartu-sempit">
        <div className="merek merek-besar">
          <div className="merek-logo" aria-hidden="true">
            PPG
          </div>
          <div>
            <h1>PPG Sorong Admin</h1>
            <small>Pengaturan awal</small>
          </div>
        </div>
        <div className="tab" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'baru'} className={mode === 'baru' ? 'aktif' : ''} onClick={() => setMode('baru')}>
            Buat admin baru
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'pulihkan'}
            className={mode === 'pulihkan' ? 'aktif' : ''}
            onClick={() => setMode('pulihkan')}
          >
            Pulihkan dari cadangan
          </button>
        </div>
        {mode === 'baru' ? <FormBaru {...p} /> : <FormPulihkan {...p} />}
      </div>
    </div>
  )
}

function FormBaru(p: { db: Db; selesai: (db: Db, kunci: KunciAdmin) => Promise<void> }) {
  const [nama, setNama] = useState('PPG Sorong')
  const [sandi, setSandi] = useState('')
  const [ulang, setUlang] = useState('')
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(false)
  return (
    <form
      className="formulir"
      onSubmit={async (e) => {
        e.preventDefault()
        setGalat('')
        if (sandi !== ulang) return setGalat('Ulangi kata sandi tidak sama.')
        setSibuk(true)
        try {
          const kunci = await inisialisasiAdmin(p.db, { sandi, namaOrganisasi: nama })
          await p.selesai(p.db, kunci)
        } catch (err) {
          setGalat(pesanGalat(err))
        } finally {
          setSibuk(false)
        }
      }}
    >
      <p>Buat kata sandi admin. Kata sandi ini melindungi kunci tanda tangan organisasi di laptop ini — simpan baik-baik.</p>
      <Isian label="Nama organisasi" nilai={nama} ubah={setNama} wajib />
      <Isian label="Kata sandi admin" type="password" nilai={sandi} ubah={setSandi} wajib bantuan="Minimal 8 karakter." />
      <Isian label="Ulangi kata sandi" type="password" nilai={ulang} ubah={setUlang} wajib />
      {galat ? <KotakGalat pesan={galat} /> : null}
      <div className="aksi">
        <Tombol type="submit" sibuk={sibuk}>
          Buat database admin
        </Tombol>
      </div>
    </form>
  )
}

function FormPulihkan(p: { db: Db; platform: Platform; selesai: (db: Db, kunci: KunciAdmin) => Promise<void> }) {
  const [berkasKunci, setBerkasKunci] = useState<BerkasDibuka | null>(null)
  const [berkasDb, setBerkasDb] = useState<BerkasDibuka | null>(null)
  const [sandiCadangan, setSandiCadangan] = useState('')
  const [sandiBaru, setSandiBaru] = useState('')
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(false)
  return (
    <form
      className="formulir"
      onSubmit={async (e) => {
        e.preventDefault()
        setGalat('')
        if (!berkasKunci) return setGalat('Pilih berkas cadangan kunci (.ppgkey).')
        setSibuk(true)
        try {
          let db = p.db
          if (berkasDb) {
            db = await bukaDb(berkasDb.bytes)
            if (!adalahAdmin(db)) throw new Error('Berkas database yang dipilih bukan database admin.')
          }
          const kunci = await imporCadanganKunci(db, berkasKunci.bytes, sandiCadangan, sandiBaru || undefined)
          await p.selesai(db, kunci)
        } catch (err) {
          setGalat(pesanGalat(err))
        } finally {
          setSibuk(false)
        }
      }}
    >
      <p>Pakai berkas cadangan kunci admin (.ppgkey) dan, bila ada, cadangan database (.db) dari laptop lama.</p>
      <div className="kolom kolom-lebar">
        <span className="label">Cadangan kunci admin</span>
        <div className="baris-pilih">
          <Tombol
            varian="kedua"
            onClick={async () => {
              const b = await p.platform.bukaBanyak([{ nama: 'Cadangan kunci PPG', ekstensi: ['ppgkey'] }], false)
              if (b[0]) setBerkasKunci(b[0])
            }}
          >
            Pilih berkas .ppgkey
          </Tombol>
          <span>{berkasKunci?.nama ?? 'Belum dipilih'}</span>
        </div>
      </div>
      <div className="kolom kolom-lebar">
        <span className="label">Cadangan database (opsional)</span>
        <div className="baris-pilih">
          <Tombol
            varian="kedua"
            onClick={async () => {
              const b = await p.platform.bukaBanyak([{ nama: 'Database PPG', ekstensi: ['db'] }], false)
              if (b[0]) setBerkasDb(b[0])
            }}
          >
            Pilih berkas .db
          </Tombol>
          <span>{berkasDb?.nama ?? 'Tanpa database (mulai kosong)'}</span>
        </div>
      </div>
      <Isian label="Kata sandi cadangan kunci" type="password" nilai={sandiCadangan} ubah={setSandiCadangan} wajib />
      <Isian
        label="Kata sandi admin baru (opsional)"
        type="password"
        nilai={sandiBaru}
        ubah={setSandiBaru}
        bantuan="Kosongkan untuk memakai kata sandi cadangan sebagai kata sandi admin."
      />
      {galat ? <KotakGalat pesan={galat} /> : null}
      <div className="aksi">
        <Tombol type="submit" sibuk={sibuk}>
          Pulihkan
        </Tombol>
      </div>
    </form>
  )
}

export function LayarMasuk(p: { db: Db; masuk: (kunci: KunciAdmin) => void }) {
  const [sandi, setSandi] = useState('')
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const nama = ambilMeta(p.db, 'nama_organisasi') ?? ''
  return (
    <div className="layar-tengah">
      <form
        className="kartu kartu-sempit formulir"
        onSubmit={async (e) => {
          e.preventDefault()
          setGalat('')
          setSibuk(true)
          try {
            const k = await bukaKunciAdmin(p.db, sandi)
            setSandi('')
            p.masuk(k)
          } catch (err) {
            setGalat(pesanGalat(err))
          } finally {
            setSibuk(false)
          }
        }}
      >
        <div className="merek merek-besar">
          <div className="merek-logo" aria-hidden="true">
            PPG
          </div>
          <div>
            <h1>PPG Sorong Admin</h1>
            <small>{nama}</small>
          </div>
        </div>
        <Isian label="Kata sandi admin" type="password" nilai={sandi} ubah={setSandi} wajib />
        {galat ? <KotakGalat pesan={galat} /> : null}
        <div className="aksi">
          <Tombol type="submit" sibuk={sibuk}>
            Masuk
          </Tombol>
        </div>
      </form>
    </div>
  )
}
