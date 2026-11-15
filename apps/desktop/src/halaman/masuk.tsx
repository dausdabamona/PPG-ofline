// Layar 1: Pengaturan awal (buat organisasi baru / aktifkan dengan kode / pulihkan dari cadangan), Masuk, dan Aktivasi EXE.
import { useState } from 'react'
import {
  adalahAdmin,
  adalahExe,
  aktifkanExe,
  ambilMeta,
  bacaKodePerangkat,
  bukaDb,
  bukaKunciAdmin,
  bukaKunciExe,
  imporCadanganKunci,
  infoInstalasi,
  inisialisasiAdmin,
  inisialisasiExe,
  kodePerangkatSaya,
  slug,
  type Db,
  type KunciExe,
  type KunciPemegang,
} from '@ppg/core'
import type { BerkasDibuka, Platform } from '../platform'
import { AreaTeks, Isian, KotakGalat, Tombol } from '../komponen/ui'
import { QrBerseri } from '../komponen/qr'
import { LABEL_PERAN, pesanGalat } from '../utils/label'

type Selesai = (db: Db, kunci: KunciPemegang) => Promise<void>

function Merek(p: { sub: string }) {
  return (
    <div className="merek merek-besar">
      <img className="merek-logo" src="./logo.svg" alt="" aria-hidden="true" />
      <div>
        <h1>PPG Sorong</h1>
        <small>{p.sub}</small>
      </div>
    </div>
  )
}

export function LayarPengaturanAwal(p: { db: Db; platform: Platform; selesai: Selesai; simpanSekarang: () => Promise<void> }) {
  const [mode, setMode] = useState<'baru' | 'kode' | 'pulihkan'>('baru')
  const tab = (m: typeof mode, teks: string) => (
    <button type="button" role="tab" aria-selected={mode === m} className={mode === m ? 'aktif' : ''} onClick={() => setMode(m)}>
      {teks}
    </button>
  )
  return (
    <div className="layar-tengah">
      <div className="kartu kartu-sedang">
        <Merek sub="Pengaturan awal" />
        <div className="tab tab-bungkus" role="tablist">
          {tab('baru', 'Buat organisasi baru (Admin Daerah)')}
          {tab('kode', 'Aktifkan dengan kode (Desa / Kelompok / Kurikulum)')}
          {tab('pulihkan', 'Pulihkan dari cadangan')}
        </div>
        {mode === 'baru' ? <FormBaru {...p} /> : mode === 'kode' ? <FormAktifkanKode {...p} /> : <FormPulihkan {...p} />}
      </div>
    </div>
  )
}

function FormBaru(p: { db: Db; selesai: Selesai }) {
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
      <p>
        Pilih ini <b>hanya di laptop Admin Daerah</b> (pusat data). Kata sandi admin melindungi kunci tanda tangan organisasi di laptop ini — simpan baik-baik.
      </p>
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

/** Langkah 1 "Aktifkan dengan kode": nama EXE + kata sandi lokal → Kode Perangkat EXE (langkah 2 di LayarAktivasi). */
function FormAktifkanKode(p: { db: Db; selesai: Selesai }) {
  const [label, setLabel] = useState('')
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
          const { kunci } = await inisialisasiExe(p.db, { sandi, label })
          await p.selesai(p.db, kunci)
        } catch (err) {
          setGalat(pesanGalat(err))
        } finally {
          setSibuk(false)
        }
      }}
    >
      <p>
        Untuk laptop <b>Desa</b>, <b>Kelompok</b>, atau <b>Tim Kurikulum</b>. Langkahnya: (1) buat kata sandi di sini, (2) kirim <b>Kode Perangkat</b> yang
        muncul ke admin tingkat atas lewat WA, (3) tempel kode aktivasi (token) yang dikirim balik.
      </p>
      <Isian label="Nama laptop ini" nilai={label} ubah={setLabel} wajib placeholder="mis. EXE Desa Klasaman" />
      <Isian label="Kata sandi aplikasi" type="password" nilai={sandi} ubah={setSandi} wajib bantuan="Minimal 8 karakter. Dipakai setiap membuka aplikasi." />
      <Isian label="Ulangi kata sandi aplikasi" type="password" nilai={ulang} ubah={setUlang} wajib />
      {galat ? <KotakGalat pesan={galat} /> : null}
      <div className="aksi">
        <Tombol type="submit" sibuk={sibuk}>
          Buat Kode Perangkat
        </Tombol>
      </div>
    </form>
  )
}

/** Kode Perangkat EXE: teks + QR + Salin + simpan berkas. */
export function TampilKodePerangkat(p: { kode: string; label: string; platform: Platform }) {
  const [pesan, setPesan] = useState('')
  return (
    <div className="tampil-token">
      <div className="qr">
        <QrBerseri teks={p.kode} label="QR Kode Perangkat" />
      </div>
      <div className="teks-token">
        <AreaTeks label="Kode Perangkat EXE" nilai={p.kode} ubah={() => undefined} hanyaBaca baris={5} />
        <div className="aksi aksi-kiri">
          <Tombol
            onClick={async () => {
              await p.platform.salinTeks(p.kode)
              setPesan('Kode disalin. Tempel di WA ke admin tingkat atas.')
            }}
          >
            Salin kode
          </Tombol>
          <Tombol
            varian="kedua"
            onClick={async () => {
              const r = await p.platform.simpanBerkas(`PPG_KODE_${slug(p.label || 'exe')}.txt`, new TextEncoder().encode(p.kode))
              if (r) setPesan('Kode disimpan sebagai berkas teks.')
            }}
          >
            Simpan ke berkas
          </Tombol>
        </div>
        {pesan ? <p className="keterangan">{pesan}</p> : null}
      </div>
    </div>
  )
}

/** Langkah 2: tampilkan Kode Perangkat EXE, tempel token dari tingkat atas → aktifkan. */
export function LayarAktivasi(p: { db: Db; kunci: KunciExe; platform: Platform; selesai: () => Promise<void> }) {
  const [token, setToken] = useState('')
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const kode = kodePerangkatSaya(p.db)
  const label = bacaKodePerangkat(kode).label
  return (
    <div className="layar-tengah">
      <div className="kartu kartu-sedang">
        <Merek sub="Aktifkan dengan kode" />
        <h2>1. Kirim Kode Perangkat ini ke tingkat atas</h2>
        <p className="keterangan">
          Desa & Kurikulum: kirim ke <b>Admin Daerah</b>. Kelompok: kirim ke <b>Admin Desa</b>. Mereka membuka menu <i>Perangkat &amp; Token</i>, menempel kode ini, lalu
          mengirim balik kode aktivasi.
        </p>
        <TampilKodePerangkat kode={kode} label={label} platform={p.platform} />
        <form
          className="formulir"
          onSubmit={async (e) => {
            e.preventDefault()
            setGalat('')
            setSibuk(true)
            try {
              await aktifkanExe(p.db, p.kunci, token.trim())
              await p.selesai()
            } catch (err) {
              setGalat(pesanGalat(err))
            } finally {
              setSibuk(false)
            }
          }}
        >
          <h2>2. Tempel kode aktivasi (token) dari tingkat atas</h2>
          <AreaTeks label="Kode aktivasi" nilai={token} ubah={setToken} baris={5} placeholder="PPGT1.…" />
          {galat ? <KotakGalat pesan={galat} /> : null}
          <div className="aksi">
            <Tombol type="submit" sibuk={sibuk} disabled={!token.trim()}>
              Aktifkan
            </Tombol>
          </div>
        </form>
      </div>
    </div>
  )
}

function FormPulihkan(p: { db: Db; platform: Platform; selesai: Selesai }) {
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
        setSibuk(true)
        try {
          let db = p.db
          if (berkasDb) {
            db = await bukaDb(berkasDb.bytes)
            if (adalahExe(db)) {
              // EXE desa/kelompok/kurikulum: cukup database + kata sandi aplikasinya
              const k = await bukaKunciExe(db, sandiCadangan)
              await p.selesai(db, k)
              return
            }
            if (!adalahAdmin(db)) throw new Error('Berkas database yang dipilih bukan database aplikasi EXE.')
          }
          if (!berkasKunci) throw new Error('Pilih berkas cadangan kunci (.ppgkey).')
          const kunci = await imporCadanganKunci(db, berkasKunci.bytes, sandiCadangan, sandiBaru || undefined)
          await p.selesai(db, kunci)
        } catch (err) {
          setGalat(pesanGalat(err))
        } finally {
          setSibuk(false)
        }
      }}
    >
      <p>
        <b>Admin Daerah:</b> pakai berkas cadangan kunci admin (.ppgkey) dan, bila ada, cadangan database (.db) dari laptop lama. <b>Desa / Kelompok / Kurikulum:</b>{' '}
        cukup pilih cadangan database (.db) lalu isi kata sandi aplikasinya.
      </p>
      <div className="kolom kolom-lebar">
        <span className="label">Cadangan kunci admin (khusus daerah)</span>
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
        <span className="label">Cadangan database (opsional untuk daerah)</span>
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
      <Isian
        label="Kata sandi cadangan kunci"
        type="password"
        nilai={sandiCadangan}
        ubah={setSandiCadangan}
        wajib
        bantuan="Desa/kelompok/kurikulum: isi kata sandi aplikasi pada cadangan database itu."
      />
      <Isian
        label="Kata sandi admin baru (opsional)"
        type="password"
        nilai={sandiBaru}
        ubah={setSandiBaru}
        bantuan="Khusus daerah. Kosongkan untuk memakai kata sandi cadangan sebagai kata sandi admin."
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

export function LayarMasuk(p: { db: Db; platform: Platform; masuk: (kunci: KunciPemegang) => void }) {
  const [sandi, setSandi] = useState('')
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [lupa, setLupa] = useState(false)
  const exe = adalahExe(p.db)
  const info = infoInstalasi(p.db)
  const sub = exe
    ? info.peran
      ? `${LABEL_PERAN[info.peran]}${info.wilayahNama ? ` · ${info.wilayahNama}` : ''}`
      : 'EXE belum diaktifkan'
    : (ambilMeta(p.db, 'nama_organisasi') ?? '')
  const labelSandi = exe ? 'Kata sandi aplikasi' : 'Kata sandi admin'
  if (lupa && !exe) {
    return (
      <div className="layar-tengah">
        <div className="kartu kartu-sempit">
          <Merek sub={sub} />
          <FormLupaSandi db={p.db} platform={p.platform} masuk={p.masuk} batal={() => setLupa(false)} />
        </div>
      </div>
    )
  }
  return (
    <div className="layar-tengah">
      <form
        className="kartu kartu-sempit formulir"
        onSubmit={async (e) => {
          e.preventDefault()
          setGalat('')
          setSibuk(true)
          try {
            const k = exe ? await bukaKunciExe(p.db, sandi) : await bukaKunciAdmin(p.db, sandi)
            setSandi('')
            p.masuk(k)
          } catch (err) {
            setGalat(pesanGalat(err))
          } finally {
            setSibuk(false)
          }
        }}
      >
        <Merek sub={sub} />
        <Isian label={labelSandi} type="password" nilai={sandi} ubah={setSandi} wajib />
        {galat ? <KotakGalat pesan={galat} /> : null}
        {lupa && exe ? (
          <p className="keterangan">
            Kata sandi aplikasi EXE tidak bisa dipulihkan. Bila ada cadangan database dan kata sandinya, pasang ulang lalu pilih “Pulihkan dari cadangan”. Bila
            tidak, pasang ulang dan minta kode aktivasi baru ke tingkat atas — data wilayah akan dikirim ulang lewat paket.
          </p>
        ) : null}
        <div className="aksi">
          <Tombol varian="tipis" onClick={() => setLupa(true)}>
            Lupa kata sandi?
          </Tombol>
          <Tombol type="submit" sibuk={sibuk}>
            Masuk
          </Tombol>
        </div>
      </form>
    </div>
  )
}

/** Lupa kata sandi admin: buka ulang kunci dengan berkas cadangan kunci (.ppgkey) + sandi cadangannya, lalu pasang sandi baru. */
function FormLupaSandi(p: { db: Db; platform: Platform; masuk: (kunci: KunciPemegang) => void; batal: () => void }) {
  const [berkas, setBerkas] = useState<BerkasDibuka | null>(null)
  const [sandiCadangan, setSandiCadangan] = useState('')
  const [baru, setBaru] = useState('')
  const [ulang, setUlang] = useState('')
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(false)
  return (
    <form
      className="formulir"
      onSubmit={async (e) => {
        e.preventDefault()
        setGalat('')
        if (!berkas) return setGalat('Pilih berkas cadangan kunci (.ppgkey) dulu.')
        if (baru !== ulang) return setGalat('Ulangi kata sandi baru tidak sama.')
        setSibuk(true)
        try {
          const k = await imporCadanganKunci(p.db, berkas.bytes, sandiCadangan, baru)
          p.masuk(k)
        } catch (err) {
          setGalat(pesanGalat(err))
        } finally {
          setSibuk(false)
        }
      }}
    >
      <p>
        Pakai berkas <b>cadangan kunci admin (.ppgkey)</b> dan kata sandi cadangannya. Data di komputer ini tetap utuh; kata sandi admin diganti
        dengan yang baru.
      </p>
      <div className="kolom kolom-lebar">
        <span className="label">Cadangan kunci admin</span>
        <div className="baris-pilih">
          <Tombol
            varian="kedua"
            onClick={async () => {
              const b = await p.platform.bukaBanyak([{ nama: 'Cadangan kunci PPG', ekstensi: ['ppgkey'] }], false)
              if (b[0]) setBerkas(b[0])
            }}
          >
            Pilih berkas .ppgkey
          </Tombol>
          <span>{berkas?.nama ?? 'Belum dipilih'}</span>
        </div>
      </div>
      <Isian label="Kata sandi cadangan kunci" type="password" nilai={sandiCadangan} ubah={setSandiCadangan} wajib />
      <Isian label="Kata sandi admin baru" type="password" nilai={baru} ubah={setBaru} wajib bantuan="Minimal 8 karakter." />
      <Isian label="Ulangi kata sandi admin baru" type="password" nilai={ulang} ubah={setUlang} wajib />
      {galat ? <KotakGalat pesan={galat} /> : null}
      <div className="aksi">
        <Tombol varian="kedua" onClick={p.batal}>
          Kembali
        </Tombol>
        <Tombol type="submit" sibuk={sibuk}>
          Pulihkan &amp; masuk
        </Tombol>
      </div>
    </form>
  )
}
