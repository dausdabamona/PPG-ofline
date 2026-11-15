// Layar 4: Generus & Jamaah — tabel + filter, tambah/ubah, impor CSV (+ templat), pindah kelompok, ubah status.
// v3: di EXE desa hanya lihat (wilayah desa) + usulan (generus baru, ubah status, pindah) yang ikut Setor ke Daerah.
import { useState } from 'react'
import {
  KATEGORI_GENERUS,
  KOLOM_CSV_GENERUS,
  STATUS_GENERUS,
  ajukanUsulan,
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
  const { peran } = useApp()
  const [tab, setTab] = useState<'generus' | 'jamaah'>('generus')
  return (
    <>
      <KepalaHalaman
        judul={peran === 'daerah' ? 'Generus & Jamaah' : 'Generus & Data'}
        keterangan={
          peran === 'daerah'
            ? 'Data master milik admin daerah. Perubahan dari HP dan EXE desa masuk lewat Usulan.'
            : 'Data master milik admin daerah (dari paket). Perubahan diajukan sebagai usulan dan ikut Setor ke Daerah.'
        }
      />
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
  const { db, peran, wilayahId, aksi, platform, toast } = useApp()
  const ubah = peran === 'daerah'
  const akar = ubah ? null : wilayahId
  const [wilayah, setWilayah] = useState('')
  const [kategori, setKategori] = useState('')
  const [status, setStatus] = useState('')
  const [cari, setCari] = useState('')
  const [form, setForm] = useState<{ g: GenerusRinci | null } | null>(null)
  const [pindah, setPindah] = useState<GenerusRinci | null>(null)
  const [ubahSt, setUbahSt] = useState<GenerusRinci | null>(null)
  const [hasilCsv, setHasilCsv] = useState<{ nama: string; hasil: HasilImporCsv } | null>(null)

  const hasil = useData(() => {
    const w = wilayah ? ambilWilayah(db, wilayah) : akar ? ambilWilayah(db, akar) : undefined
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
          ubah ? (
            <>
              <Tombol varian="kedua" onClick={unduhTemplat}>
                Unduh templat CSV
              </Tombol>
              <Tombol varian="kedua" onClick={imporCsv}>
                Impor CSV
              </Tombol>
              <Tombol onClick={() => setForm({ g: null })}>+ Tambah generus</Tombol>
            </>
          ) : (
            <Tombol onClick={() => setForm({ g: null })}>+ Usulkan generus baru</Tombol>
          )
        }
        judul="Daftar generus"
      >
        <div className="filter">
          <PilihWilayah db={db} label="Wilayah" nilai={wilayah} ubah={setWilayah} kosong="Semua wilayah" akar={akar} />
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
                          {ubah ? (
                            <Tombol kecil varian="tipis" onClick={() => setForm({ g })}>
                              Ubah
                            </Tombol>
                          ) : null}
                          <Tombol kecil varian="tipis" onClick={() => setPindah(g)}>
                            {ubah ? 'Pindah' : 'Usulkan pindah'}
                          </Tombol>
                          <Tombol kecil varian="tipis" onClick={() => setUbahSt(g)}>
                            {ubah ? 'Status' : 'Usulkan status'}
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
      {form ? <FormGenerus g={form.g} tutup={() => setForm(null)} usulan={!ubah} /> : null}
      {pindah ? <FormPindah g={pindah} tutup={() => setPindah(null)} usulan={!ubah} /> : null}
      {ubahSt ? <FormStatus g={ubahSt} tutup={() => setUbahSt(null)} usulan={!ubah} /> : null}
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

function FormGenerus(p: { g: GenerusRinci | null; tutup: () => void; usulan?: boolean }) {
  const { db, wilayahId, aksi } = useApp()
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
    if (p.usulan) {
      const u = await aksi(
        () =>
          ajukanUsulan(db, {
            jenis: 'tambah_generus',
            kelompokId: kelompok,
            data: {
              nama: nama.trim(),
              jenis_kelamin: jk,
              tanggal_lahir: lahir || null,
              kategori: kategori || null,
              wali_nama: waliNama.trim() || null,
              wali_no_hp: waliHp.trim() || null,
            },
          }),
        `Usulan generus "${nama.trim()}" tersimpan. Ikut terkirim saat Setor ke Daerah.`,
      )
      if (u) p.tutup()
      return
    }
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
      judul={p.usulan ? 'Usulkan generus baru' : g ? `Ubah generus: ${g.nama}` : 'Tambah generus'}
      tutup={p.tutup}
      lebar
      aksi={
        <>
          <Tombol varian="kedua" onClick={p.tutup}>
            Batal
          </Tombol>
          <Tombol onClick={simpan}>{p.usulan ? 'Ajukan usulan' : 'Simpan'}</Tombol>
        </>
      }
    >
      <div className="formulir dua-kolom">
        {g ? null : (
          <PilihWilayah db={db} label="Kelompok" nilai={kelompok} ubah={setKelompok} tingkat="kelompok" kosong="— pilih kelompok —" akar={p.usulan ? wilayahId : null} />
        )}
        <Isian label="Nama lengkap" nilai={nama} ubah={setNama} wajib />
        <Pilihan label="Jenis kelamin" nilai={jk} ubah={setJk} pilihan={OPSI_JK} />
        <Isian label="Tanggal lahir" type="date" nilai={lahir} ubah={setLahir} />
        <Pilihan label="Kategori" nilai={kategori} ubah={setKategori} pilihan={OPSI_KATEGORI} kosong={g ? '(tidak diubah)' : 'Otomatis dari umur'} />
        <Isian label="Nama wali" nilai={waliNama} ubah={setWaliNama} />
        <Isian label="No. HP wali" nilai={waliHp} ubah={setWaliHp} placeholder="08…" />
        {g || p.usulan ? null : <Isian label="Mulai menjadi anggota" type="date" nilai={mulai} ubah={setMulai} />}
      </div>
    </Modal>
  )
}

function FormPindah(p: { g: GenerusRinci; tutup: () => void; usulan?: boolean }) {
  const { db, aksi } = useApp()
  const [tujuan, setTujuan] = useState('')
  const [tanggal, setTanggal] = useState(tanggalHariIni())
  return (
    <Modal
      judul={`${p.usulan ? 'Usulkan pindah' : 'Pindah'} kelompok: ${p.g.nama}`}
      tutup={p.tutup}
      aksi={
        <>
          <Tombol varian="kedua" onClick={p.tutup}>
            Batal
          </Tombol>
          <Tombol
            onClick={async () => {
              const ok = await aksi(
                () => {
                  if (!tujuan) throw new Error('Pilih kelompok tujuan.')
                  if (p.usulan) {
                    ajukanUsulan(db, { jenis: 'pindah_kelompok', kelompokId: p.g.kelompok_id, data: { generus_id: p.g.id, kelompok_tujuan_id: tujuan, tanggal, keterangan: null } })
                    return true
                  }
                  pindahKelompok(db, p.g.id, tujuan, tanggal)
                  return true
                },
                p.usulan
                  ? `Usulan pindah ${p.g.nama} tersimpan. Ikut terkirim saat Setor ke Daerah.`
                  : `${p.g.nama} dipindahkan. Token lama dicabut; mubaligh kelompok baru menerbitkan token baru.`,
              )
              if (ok) p.tutup()
            }}
          >
            {p.usulan ? 'Ajukan usulan' : 'Pindahkan'}
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

function FormStatus(p: { g: GenerusRinci; tutup: () => void; usulan?: boolean }) {
  const { db, aksi } = useApp()
  const [status, setStatus] = useState<string>(p.g.status === 'aktif' ? 'mondok' : 'aktif')
  const [tanggal, setTanggal] = useState(tanggalHariIni())
  const [ket, setKet] = useState('')
  return (
    <Modal
      judul={`${p.usulan ? 'Usulkan status' : 'Ubah status'}: ${p.g.nama}`}
      tutup={p.tutup}
      aksi={
        <>
          <Tombol varian="kedua" onClick={p.tutup}>
            Batal
          </Tombol>
          <Tombol
            onClick={async () => {
              const ok = await aksi(
                () => {
                  if (p.usulan) {
                    ajukanUsulan(db, { jenis: 'ubah_status', kelompokId: p.g.kelompok_id, data: { generus_id: p.g.id, status, tanggal, keterangan: ket || null } })
                    return true
                  }
                  ubahStatus(db, p.g.id, status as StatusGenerus, tanggal, ket || null)
                  return true
                },
                p.usulan
                  ? `Usulan status ${p.g.nama} (${label(LABEL_STATUS_GENERUS, status)}) tersimpan. Ikut terkirim saat Setor ke Daerah.`
                  : `Status ${p.g.nama} menjadi ${label(LABEL_STATUS_GENERUS, status)}.`,
              )
              if (ok) p.tutup()
            }}
          >
            {p.usulan ? 'Ajukan usulan' : 'Simpan status'}
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
  const { db, peran, wilayahId } = useApp()
  const ubah = peran === 'daerah'
  const akar = ubah ? null : wilayahId
  const [wilayah, setWilayah] = useState('')
  const [form, setForm] = useState<{ j: Jamaah | null } | null>(null)
  const hasil = useData(() => {
    const nama = new Map(daftarWilayah(db).map((w) => [w.id, w.nama]))
    const w = wilayah || akar
    return daftarJamaah(db, w ? { kelompokIds: kelompokDalamWilayah(db, w) } : {}).map((j) => ({ ...j, kelompok_nama: nama.get(j.kelompok_id) ?? '?' }))
  }, [db, wilayah, akar])
  return (
    <Kartu judul="Daftar jamaah" aksi={ubah ? <Tombol onClick={() => setForm({ j: null })}>+ Tambah jamaah</Tombol> : undefined}>
      <div className="filter">
        <PilihWilayah db={db} label="Wilayah" nilai={wilayah} ubah={setWilayah} kosong="Semua wilayah" akar={akar} />
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
                    {ubah ? (
                      <Tombol kecil varian="tipis" onClick={() => setForm({ j })}>
                        Ubah
                      </Tombol>
                    ) : null}
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
