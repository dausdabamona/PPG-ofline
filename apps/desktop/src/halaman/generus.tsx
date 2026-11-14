// Layar 4: Generus & Jamaah — tabel + filter, tambah/ubah, impor CSV (+ templat), pindah kelompok, ubah status.
import { useState } from 'react'
import {
  KATEGORI_GENERUS,
  KOLOM_CSV_GENERUS,
  STATUS_GENERUS,
  ambilWilayah,
  buatCsv,
  cariGenerus,
  daftarJamaah,
  daftarWilayah,
  imporGenerusCsv,
  kelompokDalamWilayah,
  pindahKelompok,
  tambahGenerus,
  tambahJamaah,
  tanggalHariIni,
  ubahGenerus,
  ubahJamaah,
  ubahStatus,
  type GenerusRinci,
  type HasilImporCsv,
  type Jamaah,
  type KategoriGenerus,
  type StatusGenerus,
} from '@ppg/core'
import { useApp, useData } from '../konteks'
import { Isian, KeadaanData, Kartu, KepalaHalaman, Lencana, Modal, Pilihan, Tombol } from '../komponen/ui'
import { PilihWilayah } from '../komponen/wilayah'
import { LABEL_KATEGORI, LABEL_STATUS_GENERUS, label, tanggalLokal } from '../utils/label'

const OPSI_KATEGORI = KATEGORI_GENERUS.map((k) => ({ nilai: k, teks: LABEL_KATEGORI[k] ?? k }))
const OPSI_STATUS = STATUS_GENERUS.map((s) => ({ nilai: s, teks: LABEL_STATUS_GENERUS[s] ?? s }))
const OPSI_JK = [
  { nilai: 'L', teks: 'Laki-laki' },
  { nilai: 'P', teks: 'Perempuan' },
]

export function HalamanGenerus() {
  const [tab, setTab] = useState<'generus' | 'jamaah'>('generus')
  return (
    <>
      <KepalaHalaman judul="Generus & Jamaah" keterangan="Data master milik admin. Perubahan dari HP masuk lewat Usulan." />
      <div className="tab" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'generus'} className={tab === 'generus' ? 'aktif' : ''} onClick={() => setTab('generus')}>
          Generus
        </button>
        <button type="button" role="tab" aria-selected={tab === 'jamaah'} className={tab === 'jamaah' ? 'aktif' : ''} onClick={() => setTab('jamaah')}>
          Jamaah
        </button>
      </div>
      {tab === 'generus' ? <TabGenerus /> : <TabJamaah />}
    </>
  )
}

function warnaStatus(s: string): 'hijau' | 'kuning' | 'abu' {
  return s === 'aktif' ? 'hijau' : s === 'mondok' ? 'kuning' : 'abu'
}

function TabGenerus() {
  const { db, aksi, platform, toast } = useApp()
  const [wilayah, setWilayah] = useState('')
  const [kategori, setKategori] = useState('')
  const [status, setStatus] = useState('')
  const [cari, setCari] = useState('')
  const [form, setForm] = useState<{ g: GenerusRinci | null } | null>(null)
  const [pindah, setPindah] = useState<GenerusRinci | null>(null)
  const [ubahSt, setUbahSt] = useState<GenerusRinci | null>(null)
  const [hasilCsv, setHasilCsv] = useState<{ nama: string; hasil: HasilImporCsv } | null>(null)

  const hasil = useData(() => {
    const w = wilayah ? ambilWilayah(db, wilayah) : undefined
    return cariGenerus(db, {
      kelompokId: w?.tingkat === 'kelompok' ? w.id : undefined,
      wilayahId: w && w.tingkat !== 'kelompok' ? w.id : undefined,
      kategori: (kategori || undefined) as KategoriGenerus | undefined,
      status: (status || undefined) as StatusGenerus | undefined,
      cari: cari || undefined,
    })
  }, [db, wilayah, kategori, status, cari])

  const imporCsv = async () => {
    const berkas = await platform.bukaBanyak([{ nama: 'CSV', ekstensi: ['csv', 'txt'] }], false)
    const b = berkas[0]
    if (!b) return
    const teks = new TextDecoder('utf-8').decode(b.bytes)
    const h = await aksi(() => imporGenerusCsv(db, teks))
    if (h) {
      setHasilCsv({ nama: b.nama, hasil: h })
      toast(h.gagal.length ? 'info' : 'sukses', `Impor CSV: ${h.berhasil} generus masuk${h.gagal.length ? `, ${h.gagal.length} baris gagal` : ''}.`)
    }
  }

  const unduhTemplat = async () => {
    const kode = daftarWilayah(db, { tingkat: 'kelompok' }).find((k) => k.kode)?.kode ?? 'K1'
    const contoh = [
      { nama: 'Ahmad Fauzi', jenis_kelamin: 'L', tanggal_lahir: '2015-03-21', kategori: '', kelompok_kode: kode, wali_nama: 'Bapak Fauzi', wali_no_hp: '081234567890', mulai: '' },
      { nama: 'Siti Aminah', jenis_kelamin: 'P', tanggal_lahir: '21/07/2010', kategori: 'praremaja', kelompok_kode: kode, wali_nama: 'Ibu Aminah', wali_no_hp: '', mulai: '' },
    ]
    const csv = '﻿' + buatCsv([...KOLOM_CSV_GENERUS, 'mulai'], contoh)
    const p = await aksi(() => platform.simpanBerkas('templat-generus.csv', new TextEncoder().encode(csv)))
    if (p) toast('sukses', 'Templat CSV disimpan.')
  }

  return (
    <>
      <Kartu
        aksi={
          <>
            <Tombol varian="kedua" onClick={unduhTemplat}>
              Unduh templat CSV
            </Tombol>
            <Tombol varian="kedua" onClick={imporCsv}>
              Impor CSV
            </Tombol>
            <Tombol onClick={() => setForm({ g: null })}>+ Tambah generus</Tombol>
          </>
        }
        judul="Daftar generus"
      >
        <div className="filter">
          <PilihWilayah db={db} label="Wilayah" nilai={wilayah} ubah={setWilayah} kosong="Semua wilayah" />
          <Pilihan label="Kategori" nilai={kategori} ubah={setKategori} pilihan={OPSI_KATEGORI} kosong="Semua kategori" />
          <Pilihan label="Status" nilai={status} ubah={setStatus} pilihan={OPSI_STATUS} kosong="Semua status" />
          <Isian label="Cari nama" nilai={cari} ubah={setCari} placeholder="Ketik nama…" />
        </div>
        <KeadaanData hasil={hasil} kosong={(d) => d.length === 0} teksKosong="Tidak ada generus yang cocok. Tambah satu per satu atau impor CSV.">
          {(daftar) => (
            <>
              <p className="ringkas">{daftar.length} generus</p>
              <div className="gulir">
                <table className="tabel">
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>JK</th>
                      <th>Tgl lahir</th>
                      <th>Kategori</th>
                      <th>Kelompok</th>
                      <th>Status</th>
                      <th>Wali</th>
                      <th aria-label="Aksi" />
                    </tr>
                  </thead>
                  <tbody>
                    {daftar.map((g) => (
                      <tr key={g.id}>
                        <td>{g.nama}</td>
                        <td>{g.jenis_kelamin}</td>
                        <td>{tanggalLokal(g.tanggal_lahir)}</td>
                        <td>{label(LABEL_KATEGORI, g.kategori)}</td>
                        <td>{g.kelompok_nama}</td>
                        <td>
                          <Lencana warna={warnaStatus(g.status)}>{label(LABEL_STATUS_GENERUS, g.status)}</Lencana>
                        </td>
                        <td>
                          {g.wali_nama ?? '—'}
                          {g.wali_no_hp ? <small className="blok">{g.wali_no_hp}</small> : null}
                        </td>
                        <td className="sel-aksi">
                          <Tombol kecil varian="tipis" onClick={() => setForm({ g })}>
                            Ubah
                          </Tombol>
                          <Tombol kecil varian="tipis" onClick={() => setPindah(g)}>
                            Pindah
                          </Tombol>
                          <Tombol kecil varian="tipis" onClick={() => setUbahSt(g)}>
                            Status
                          </Tombol>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </KeadaanData>
      </Kartu>
      {form ? <FormGenerus g={form.g} tutup={() => setForm(null)} /> : null}
      {pindah ? <FormPindah g={pindah} tutup={() => setPindah(null)} /> : null}
      {ubahSt ? <FormStatus g={ubahSt} tutup={() => setUbahSt(null)} /> : null}
      {hasilCsv ? (
        <Modal judul={`Hasil impor ${hasilCsv.nama}`} tutup={() => setHasilCsv(null)} aksi={<Tombol onClick={() => setHasilCsv(null)}>Tutup</Tombol>}>
          <p>
            <strong>{hasilCsv.hasil.berhasil}</strong> generus berhasil diimpor; <strong>{hasilCsv.hasil.gagal.length}</strong> baris gagal.
          </p>
          {hasilCsv.hasil.gagal.length ? (
            <table className="tabel">
              <thead>
                <tr>
                  <th>Baris</th>
                  <th>Alasan</th>
                </tr>
              </thead>
              <tbody>
                {hasilCsv.hasil.gagal.map((g) => (
                  <tr key={g.baris}>
                    <td>{g.baris}</td>
                    <td>{g.alasan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </Modal>
      ) : null}
    </>
  )
}

function FormGenerus(p: { g: GenerusRinci | null; tutup: () => void }) {
  const { db, aksi } = useApp()
  const g = p.g
  const [kelompok, setKelompok] = useState(g?.kelompok_id ?? '')
  const [nama, setNama] = useState(g?.nama ?? '')
  const [jk, setJk] = useState<string>(g?.jenis_kelamin ?? 'L')
  const [lahir, setLahir] = useState(g?.tanggal_lahir ?? '')
  const [kategori, setKategori] = useState<string>(g?.kategori ?? '')
  const [waliNama, setWaliNama] = useState(g?.wali_nama ?? '')
  const [waliHp, setWaliHp] = useState(g?.wali_no_hp ?? '')
  const [mulai, setMulai] = useState(tanggalHariIni())
  const simpan = async () => {
    const h = await aksi(
      () =>
        g
          ? ubahGenerus(db, g.id, {
              nama,
              jenis_kelamin: jk,
              tanggal_lahir: lahir || null,
              ...(kategori ? { kategori } : {}),
              wali_nama: waliNama || null,
              wali_no_hp: waliHp || null,
            })
          : tambahGenerus(db, {
              kelompokId: kelompok,
              nama,
              jenisKelamin: jk as 'L' | 'P',
              tanggalLahir: lahir || null,
              kategori: (kategori || null) as KategoriGenerus | null,
              waliNama: waliNama || null,
              waliNoHp: waliHp || null,
              mulai: mulai || undefined,
            }),
      (x) => `Generus "${x.nama}" disimpan.`,
    )
    if (h) p.tutup()
  }
  return (
    <Modal
      judul={g ? `Ubah generus: ${g.nama}` : 'Tambah generus'}
      tutup={p.tutup}
      lebar
      aksi={
        <>
          <Tombol varian="kedua" onClick={p.tutup}>
            Batal
          </Tombol>
          <Tombol onClick={simpan}>Simpan</Tombol>
        </>
      }
    >
      <div className="formulir dua-kolom">
        {g ? null : <PilihWilayah db={db} label="Kelompok" nilai={kelompok} ubah={setKelompok} tingkat="kelompok" kosong="— pilih kelompok —" />}
        <Isian label="Nama lengkap" nilai={nama} ubah={setNama} wajib />
        <Pilihan label="Jenis kelamin" nilai={jk} ubah={setJk} pilihan={OPSI_JK} />
        <Isian label="Tanggal lahir" type="date" nilai={lahir} ubah={setLahir} />
        <Pilihan label="Kategori" nilai={kategori} ubah={setKategori} pilihan={OPSI_KATEGORI} kosong={g ? '(tidak diubah)' : 'Otomatis dari umur'} />
        <Isian label="Nama wali" nilai={waliNama} ubah={setWaliNama} />
        <Isian label="No. HP wali" nilai={waliHp} ubah={setWaliHp} placeholder="08…" />
        {g ? null : <Isian label="Mulai menjadi anggota" type="date" nilai={mulai} ubah={setMulai} />}
      </div>
    </Modal>
  )
}

function FormPindah(p: { g: GenerusRinci; tutup: () => void }) {
  const { db, aksi } = useApp()
  const [tujuan, setTujuan] = useState('')
  const [tanggal, setTanggal] = useState(tanggalHariIni())
  return (
    <Modal
      judul={`Pindah kelompok: ${p.g.nama}`}
      tutup={p.tutup}
      aksi={
        <>
          <Tombol varian="kedua" onClick={p.tutup}>
            Batal
          </Tombol>
          <Tombol
            onClick={async () => {
              const ok = await aksi(() => {
                if (!tujuan) throw new Error('Pilih kelompok tujuan.')
                pindahKelompok(db, p.g.id, tujuan, tanggal)
                return true
              }, `${p.g.nama} dipindahkan. Token lama dicabut; mubaligh kelompok baru menerbitkan token baru.`)
              if (ok) p.tutup()
            }}
          >
            Pindahkan
          </Tombol>
        </>
      }
    >
      <div className="formulir">
        <p>
          Kelompok sekarang: <strong>{p.g.kelompok_nama}</strong>. Kemajuan belajar ikut generus; rekap dihitung per periode keanggotaan.
        </p>
        <PilihWilayah db={db} label="Kelompok tujuan" nilai={tujuan} ubah={setTujuan} tingkat="kelompok" kosong="— pilih kelompok —" />
        <Isian label="Tanggal pindah" type="date" nilai={tanggal} ubah={setTanggal} wajib />
      </div>
    </Modal>
  )
}

function FormStatus(p: { g: GenerusRinci; tutup: () => void }) {
  const { db, aksi } = useApp()
  const [status, setStatus] = useState<string>(p.g.status === 'aktif' ? 'mondok' : 'aktif')
  const [tanggal, setTanggal] = useState(tanggalHariIni())
  const [ket, setKet] = useState('')
  return (
    <Modal
      judul={`Ubah status: ${p.g.nama}`}
      tutup={p.tutup}
      aksi={
        <>
          <Tombol varian="kedua" onClick={p.tutup}>
            Batal
          </Tombol>
          <Tombol
            onClick={async () => {
              const ok = await aksi(() => {
                ubahStatus(db, p.g.id, status as StatusGenerus, tanggal, ket || null)
                return true
              }, `Status ${p.g.nama} menjadi ${label(LABEL_STATUS_GENERUS, status)}.`)
              if (ok) p.tutup()
            }}
          >
            Simpan status
          </Tombol>
        </>
      }
    >
      <div className="formulir">
        <p>
          Status sekarang: <strong>{label(LABEL_STATUS_GENERUS, p.g.status)}</strong>. Mondok membekukan token; aktif mencairkannya; lulus/menikah, keluar,
          atau pindah mencabut token.
        </p>
        <Pilihan label="Status baru" nilai={status} ubah={setStatus} pilihan={OPSI_STATUS.filter((o) => o.nilai !== p.g.status)} />
        <Isian label="Berlaku mulai" type="date" nilai={tanggal} ubah={setTanggal} wajib />
        <Isian label="Keterangan" nilai={ket} ubah={setKet} placeholder="mis. Pondok Gading" />
      </div>
    </Modal>
  )
}

function TabJamaah() {
  const { db } = useApp()
  const [wilayah, setWilayah] = useState('')
  const [form, setForm] = useState<{ j: Jamaah | null } | null>(null)
  const hasil = useData(() => {
    const nama = new Map(daftarWilayah(db).map((w) => [w.id, w.nama]))
    return daftarJamaah(db, wilayah ? { kelompokIds: kelompokDalamWilayah(db, wilayah) } : {}).map((j) => ({ ...j, kelompok_nama: nama.get(j.kelompok_id) ?? '?' }))
  }, [db, wilayah])
  return (
    <Kartu judul="Daftar jamaah" aksi={<Tombol onClick={() => setForm({ j: null })}>+ Tambah jamaah</Tombol>}>
      <div className="filter">
        <PilihWilayah db={db} label="Wilayah" nilai={wilayah} ubah={setWilayah} kosong="Semua wilayah" />
      </div>
      <KeadaanData hasil={hasil} kosong={(d) => d.length === 0} teksKosong="Belum ada jamaah.">
        {(daftar) => (
          <table className="tabel">
            <thead>
              <tr>
                <th>Nama</th>
                <th>JK</th>
                <th>Tgl lahir</th>
                <th>No. HP</th>
                <th>Kelompok</th>
                <th>Status</th>
                <th aria-label="Aksi" />
              </tr>
            </thead>
            <tbody>
              {daftar.map((j) => (
                <tr key={j.id}>
                  <td>{j.nama}</td>
                  <td>{j.jenis_kelamin}</td>
                  <td>{tanggalLokal(j.tanggal_lahir)}</td>
                  <td>{j.no_hp ?? '—'}</td>
                  <td>{j.kelompok_nama}</td>
                  <td>{j.status ?? '—'}</td>
                  <td className="sel-aksi">
                    <Tombol kecil varian="tipis" onClick={() => setForm({ j })}>
                      Ubah
                    </Tombol>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </KeadaanData>
      {form ? <FormJamaah j={form.j} tutup={() => setForm(null)} /> : null}
    </Kartu>
  )
}

function FormJamaah(p: { j: Jamaah | null; tutup: () => void }) {
  const { db, aksi } = useApp()
  const j = p.j
  const [kelompok, setKelompok] = useState(j?.kelompok_id ?? '')
  const [nama, setNama] = useState(j?.nama ?? '')
  const [jk, setJk] = useState<string>(j?.jenis_kelamin ?? 'L')
  const [lahir, setLahir] = useState(j?.tanggal_lahir ?? '')
  const [hp, setHp] = useState(j?.no_hp ?? '')
  const [status, setStatus] = useState(j?.status ?? 'aktif')
  return (
    <Modal
      judul={j ? `Ubah jamaah: ${j.nama}` : 'Tambah jamaah'}
      tutup={p.tutup}
      aksi={
        <>
          <Tombol varian="kedua" onClick={p.tutup}>
            Batal
          </Tombol>
          <Tombol
            onClick={async () => {
              const h = await aksi(
                () =>
                  j
                    ? ubahJamaah(db, j.id, { nama, jenis_kelamin: jk as 'L' | 'P', tanggal_lahir: lahir || null, no_hp: hp || null, status, kelompok_id: kelompok })
                    : tambahJamaah(db, { kelompokId: kelompok, nama, jenisKelamin: jk as 'L' | 'P', tanggalLahir: lahir || null, noHp: hp || null, status }),
                (x) => `Jamaah "${x.nama}" disimpan.`,
              )
              if (h) p.tutup()
            }}
          >
            Simpan
          </Tombol>
        </>
      }
    >
      <div className="formulir dua-kolom">
        <PilihWilayah db={db} label="Kelompok" nilai={kelompok} ubah={setKelompok} tingkat="kelompok" kosong="— pilih kelompok —" />
        <Isian label="Nama" nilai={nama} ubah={setNama} wajib />
        <Pilihan label="Jenis kelamin" nilai={jk} ubah={setJk} pilihan={OPSI_JK} />
        <Isian label="Tanggal lahir" type="date" nilai={lahir} ubah={setLahir} />
        <Isian label="No. HP" nilai={hp} ubah={setHp} />
        <Pilihan
          label="Status"
          nilai={status}
          ubah={setStatus}
          pilihan={[
            { nilai: 'aktif', teks: 'Aktif' },
            { nilai: 'pindah', teks: 'Pindah' },
            { nilai: 'meninggal', teks: 'Meninggal' },
            { nilai: 'nonaktif', teks: 'Nonaktif' },
          ]}
        />
      </div>
    </Modal>
  )
}
