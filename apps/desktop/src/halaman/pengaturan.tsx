// Layar 13: Pengaturan — ganti sandi, ekspor/impor cadangan kunci (daerah), cadangan/pulihkan database.
// v3: EXE desa/kelompok/kurikulum memakai kata sandi aplikasi lokal (gantiSandiExe, bukaKunciExe).
import { useEffect, useState } from 'react'
import {
  adalahAdmin,
  adalahExe,
  adalahKunciExe,
  ambilMeta,
  bukaDb,
  bukaKunciAdmin,
  bukaKunciExe,
  eksporCadanganKunci,
  gantiSandiAdmin,
  gantiSandiExe,
  imporCadanganKunci,
  peranInstalasi,
  simpanDb,
  tanggalRingkas,
  type Db,
  type KunciPemegang,
} from '@ppg/core'
import { kunciDaerah, useApp } from '../konteks'
import { judulPeran } from '../menu'
import { Isian, Kartu, KepalaHalaman, Konfirmasi, Tombol } from '../komponen/ui'
import type { BerkasDibuka } from '../platform'

export function HalamanPengaturan() {
  const { kunci, peran, wilayahNama, platform } = useApp()
  const exe = adalahKunciExe(kunci)
  const [folder, setFolder] = useState('')
  useEffect(() => {
    platform.folderData().then(setFolder, () => setFolder('—'))
  }, [platform])
  return (
    <>
      <KepalaHalaman judul="Pengaturan" />
      <Kartu judul={exe ? 'Instalasi EXE' : 'Organisasi'}>
        <dl className="daftar-info">
          <dt>Peran</dt>
          <dd>{judulPeran(peran, wilayahNama)}</dd>
          {exe ? (
            <>
              <dt>ID perangkat EXE</dt>
              <dd>
                <code>{kunci.perangkatId}</code>
              </dd>
            </>
          ) : (
            <>
              <dt>Nama</dt>
              <dd>{kunci.namaOrganisasi}</dd>
            </>
          )}
          <dt>ID organisasi</dt>
          <dd>
            <code>{kunci.orgId}</code>
          </dd>
          <dt>Folder data</dt>
          <dd>
            <code>{folder}</code> (database <code>ppg-admin.db</code>, cadangan harian di <code>cadangan/</code>)
          </dd>
          <dt>Kunci otomatis</dt>
          <dd>Aplikasi terkunci setelah 30 menit tidak aktif.</dd>
        </dl>
      </Kartu>
      <GantiSandi />
      {exe ? null : <CadanganKunci />}
      <CadanganDatabase />
    </>
  )
}

function GantiSandi() {
  const { db, kunci, aksi } = useApp()
  const exe = adalahKunciExe(kunci)
  const [lama, setLama] = useState('')
  const [baru, setBaru] = useState('')
  const [ulang, setUlang] = useState('')
  return (
    <Kartu judul={exe ? 'Ganti kata sandi aplikasi' : 'Ganti kata sandi admin'}>
      <div className="formulir tiga-kolom">
        <Isian label="Kata sandi lama" type="password" nilai={lama} ubah={setLama} />
        <Isian label="Kata sandi baru" type="password" nilai={baru} ubah={setBaru} bantuan="Minimal 8 karakter." />
        <Isian label="Ulangi kata sandi baru" type="password" nilai={ulang} ubah={setUlang} />
      </div>
      <div className="aksi">
        <Tombol
          onClick={async () => {
            const ok = await aksi(async () => {
              if (baru !== ulang) throw new Error('Ulangi kata sandi baru tidak sama.')
              if (exe) await gantiSandiExe(db, lama, baru)
              else await gantiSandiAdmin(db, lama, baru)
              return true
            }, exe ? 'Kata sandi aplikasi diganti.' : 'Kata sandi admin diganti.')
            if (ok) {
              setLama('')
              setBaru('')
              setUlang('')
            }
          }}
        >
          Ganti kata sandi
        </Tombol>
      </div>
    </Kartu>
  )
}

function CadanganKunci() {
  const { db, kunci, aksi, platform, toast } = useApp()
  const [sandi, setSandi] = useState('')
  const [ulang, setUlang] = useState('')
  const [berkas, setBerkas] = useState<BerkasDibuka | null>(null)
  const [sandiImpor, setSandiImpor] = useState('')
  const [sandiAdmin, setSandiAdmin] = useState('')
  return (
    <Kartu judul="Cadangan kunci admin">
      <p className="keterangan">
        Tanpa kunci admin, token baru tidak bisa diterbitkan dan setoran tidak bisa dibuka. Simpan berkas <code>.ppgkey</code> di flashdisk/Drive pribadi, dengan
        kata sandi cadangan yang berbeda.
      </p>
      <h3>Ekspor</h3>
      <div className="formulir tiga-kolom">
        <Isian label="Kata sandi cadangan" type="password" nilai={sandi} ubah={setSandi} bantuan="Minimal 8 karakter." />
        <Isian label="Ulangi kata sandi cadangan" type="password" nilai={ulang} ubah={setUlang} />
      </div>
      <div className="aksi">
        <Tombol
          onClick={async () => {
            const c = await aksi(async () => {
              if (sandi !== ulang) throw new Error('Ulangi kata sandi cadangan tidak sama.')
              return eksporCadanganKunci(db, kunciDaerah(kunci), sandi)
            })
            if (!c) return
            const p = await aksi(() => platform.simpanBerkas(c.nama, c.bytes))
            if (p) {
              toast('sukses', `Cadangan kunci disimpan: ${c.nama}`)
              setSandi('')
              setUlang('')
            }
          }}
        >
          Ekspor cadangan kunci
        </Tombol>
      </div>
      <h3>Impor (organisasi yang sama)</h3>
      <p className="keterangan">Mengembalikan versi kunci kelompok yang hilang dari berkas cadangan. Kata sandi admin tetap.</p>
      <div className="formulir tiga-kolom">
        <div className="kolom">
          <span className="label">Berkas .ppgkey</span>
          <Tombol
            varian="kedua"
            onClick={async () => {
              const b = await platform.bukaBanyak([{ nama: 'Cadangan kunci PPG', ekstensi: ['ppgkey'] }], false)
              if (b[0]) setBerkas(b[0])
            }}
          >
            {berkas ? berkas.nama : 'Pilih berkas'}
          </Tombol>
        </div>
        <Isian label="Kata sandi cadangan" type="password" nilai={sandiImpor} ubah={setSandiImpor} />
        <Isian label="Kata sandi admin saat ini" type="password" nilai={sandiAdmin} ubah={setSandiAdmin} />
      </div>
      <div className="aksi">
        <Tombol
          varian="kedua"
          disabled={!berkas}
          onClick={async () => {
            const ok = await aksi(async () => {
              await bukaKunciAdmin(db, sandiAdmin)
              await imporCadanganKunci(db, berkas!.bytes, sandiImpor, sandiAdmin)
              return true
            }, 'Cadangan kunci diimpor.')
            if (ok) {
              setBerkas(null)
              setSandiImpor('')
              setSandiAdmin('')
            }
          }}
        >
          Impor cadangan kunci
        </Tombol>
      </div>
    </Kartu>
  )
}

function CadanganDatabase() {
  const { db, kunci, peran, aksi, platform, toast, gantiDb, simpanSekarang } = useApp()
  const exe = adalahKunciExe(kunci)
  const [berkas, setBerkas] = useState<BerkasDibuka | null>(null)
  const [sandi, setSandi] = useState('')
  const [siap, setSiap] = useState<{ db: Db; kunci: KunciPemegang } | null>(null)
  return (
    <Kartu judul="Cadangan database">
      <p className="keterangan">
        Database disimpan otomatis setiap ada perubahan, dan disalin harian ke folder <code>cadangan/</code>. Buat cadangan manual sebelum pindah laptop.
      </p>
      <div className="aksi aksi-kiri">
        <Tombol
          onClick={async () => {
            await simpanSekarang()
            const nama = exe ? `PPG_EXE_${peran.toUpperCase()}_DB_${tanggalRingkas()}.db` : `PPG_ADMIN_DB_${tanggalRingkas()}.db`
            const p = await aksi(() => platform.simpanBerkas(nama, simpanDb(db)))
            if (p) toast('sukses', `Cadangan database disimpan: ${p}`)
          }}
        >
          Simpan cadangan database
        </Tombol>
      </div>
      <h3>Pulihkan database</h3>
      <p className="keterangan">
        {exe
          ? 'Database sekarang akan diganti dengan cadangan EXE ini (peran yang sama). Sesudahnya buka paket terbaru dari tingkat atas dan minta HP di bawahnya menekan “Kirim ulang semua data”.'
          : 'Database sekarang akan diganti. Sesudahnya kirim paket ke semua wilayah dan minta setiap HP pengurus/mubaligh menekan “Setor ulang semua data”.'}
      </p>
      <div className="formulir tiga-kolom">
        <div className="kolom">
          <span className="label">Berkas database (.db)</span>
          <Tombol
            varian="kedua"
            onClick={async () => {
              const b = await platform.bukaBanyak([{ nama: 'Database PPG', ekstensi: ['db'] }], false)
              if (b[0]) setBerkas(b[0])
            }}
          >
            {berkas ? berkas.nama : 'Pilih berkas'}
          </Tombol>
        </div>
        <Isian label={exe ? 'Kata sandi aplikasi pada cadangan itu' : 'Kata sandi admin pada cadangan itu'} type="password" nilai={sandi} ubah={setSandi} />
      </div>
      <div className="aksi">
        <Tombol
          varian="bahaya"
          disabled={!berkas}
          onClick={async () => {
            const h = await aksi(async () => {
              const baru = await bukaDb(berkas!.bytes)
              if (exe) {
                if (!adalahExe(baru) || peranInstalasi(baru) !== peran) throw new Error('Berkas ini bukan cadangan database EXE dengan peran yang sama.')
                if (ambilMeta(baru, 'org_id') !== kunci.orgId) throw new Error('Cadangan ini milik organisasi lain.')
                return { db: baru, kunci: await bukaKunciExe(baru, sandi) as KunciPemegang }
              }
              if (!adalahAdmin(baru)) throw new Error('Berkas ini bukan database admin.')
              if (ambilMeta(baru, 'org_id') !== kunci.orgId) throw new Error('Cadangan ini milik organisasi lain.')
              return { db: baru, kunci: (await bukaKunciAdmin(baru, sandi)) as KunciPemegang }
            })
            if (h) setSiap(h)
          }}
        >
          Pulihkan database
        </Tombol>
      </div>
      {siap ? (
        <Konfirmasi
          judul="Ganti database"
          pesan={`Ganti database sekarang dengan ${berkas?.nama}? Perubahan setelah cadangan itu dibuat akan hilang dari laptop ini (data HP bisa disetor ulang).`}
          ya="Ganti database"
          bahaya
          batal={() => setSiap(null)}
          setuju={async () => {
            await gantiDb(siap.db, siap.kunci)
            setSiap(null)
            setBerkas(null)
            setSandi('')
            toast('sukses', 'Database dipulihkan. Kirim paket ke semua wilayah dan minta HP setor ulang semua data.')
          }}
        />
      ) : null}
    </Kartu>
  )
}
