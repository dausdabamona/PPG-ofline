// Layar 13: Pengaturan — ganti sandi, ekspor/impor cadangan kunci, cadangan/pulihkan database.
import { useEffect, useState } from 'react'
import {
  adalahAdmin,
  ambilMeta,
  bukaDb,
  bukaKunciAdmin,
  eksporCadanganKunci,
  gantiSandiAdmin,
  imporCadanganKunci,
  simpanDb,
  tanggalRingkas,
  type Db,
  type KunciAdmin,
} from '@ppg/core'
import { useApp } from '../konteks'
import { Isian, Kartu, KepalaHalaman, Konfirmasi, Tombol } from '../komponen/ui'
import type { BerkasDibuka } from '../platform'

export function HalamanPengaturan() {
  const { kunci, platform } = useApp()
  const [folder, setFolder] = useState('')
  useEffect(() => {
    platform.folderData().then(setFolder, () => setFolder('—'))
  }, [platform])
  return (
    <>
      <KepalaHalaman judul="Pengaturan" />
      <Kartu judul="Organisasi">
        <dl className="daftar-info">
          <dt>Nama</dt>
          <dd>{kunci.namaOrganisasi}</dd>
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
      <CadanganKunci />
      <CadanganDatabase />
    </>
  )
}

function GantiSandi() {
  const { db, aksi } = useApp()
  const [lama, setLama] = useState('')
  const [baru, setBaru] = useState('')
  const [ulang, setUlang] = useState('')
  return (
    <Kartu judul="Ganti kata sandi admin">
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
              await gantiSandiAdmin(db, lama, baru)
              return true
            }, 'Kata sandi admin diganti.')
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
              return eksporCadanganKunci(db, kunci, sandi)
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
  const { db, kunci, aksi, platform, toast, gantiDb, simpanSekarang } = useApp()
  const [berkas, setBerkas] = useState<BerkasDibuka | null>(null)
  const [sandi, setSandi] = useState('')
  const [siap, setSiap] = useState<{ db: Db; kunci: KunciAdmin } | null>(null)
  return (
    <Kartu judul="Cadangan database">
      <p className="keterangan">
        Database disimpan otomatis setiap ada perubahan, dan disalin harian ke folder <code>cadangan/</code>. Buat cadangan manual sebelum pindah laptop.
      </p>
      <div className="aksi aksi-kiri">
        <Tombol
          onClick={async () => {
            await simpanSekarang()
            const p = await aksi(() => platform.simpanBerkas(`PPG_ADMIN_DB_${tanggalRingkas()}.db`, simpanDb(db)))
            if (p) toast('sukses', `Cadangan database disimpan: ${p}`)
          }}
        >
          Simpan cadangan database
        </Tombol>
      </div>
      <h3>Pulihkan database</h3>
      <p className="keterangan">
        Database sekarang akan diganti. Sesudahnya kirim paket ke semua wilayah dan minta setiap HP pengurus/mubaligh menekan “Setor ulang semua data”.
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
        <Isian label="Kata sandi admin pada cadangan itu" type="password" nilai={sandi} ubah={setSandi} />
      </div>
      <div className="aksi">
        <Tombol
          varian="bahaya"
          disabled={!berkas}
          onClick={async () => {
            const h = await aksi(async () => {
              const baru = await bukaDb(berkas!.bytes)
              if (!adalahAdmin(baru)) throw new Error('Berkas ini bukan database admin.')
              if (ambilMeta(baru, 'org_id') !== kunci.orgId) throw new Error('Cadangan ini milik organisasi lain.')
              return { db: baru, kunci: await bukaKunciAdmin(baru, sandi) }
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
