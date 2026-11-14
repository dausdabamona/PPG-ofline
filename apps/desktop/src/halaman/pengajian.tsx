// Layar 5: Pengajian — jadwal rutin per wilayah (tambah / ubah / hapus).
import { useState } from 'react'
import { daftarPengajian, daftarWilayah, hapusPengajian, tambahPengajian, turunanWilayah, ubahPengajian, type Pengajian } from '@ppg/core'
import { useApp, useData } from '../konteks'
import { Isian, KeadaanData, Kartu, KepalaHalaman, Konfirmasi, Modal, Pilihan, Tombol } from '../komponen/ui'
import { PilihWilayah } from '../komponen/wilayah'
import { NAMA_HARI } from '../utils/label'

const OPSI_HARI = NAMA_HARI.map((h, i) => ({ nilai: String(i), teks: h }))

export function HalamanPengajian() {
  const { db, aksi } = useApp()
  const [wilayah, setWilayah] = useState('')
  const [form, setForm] = useState<{ p: Pengajian | null } | null>(null)
  const [hapus, setHapus] = useState<Pengajian | null>(null)
  const hasil = useData(() => {
    const nama = new Map(daftarWilayah(db).map((w) => [w.id, w.nama]))
    return daftarPengajian(db, wilayah ? turunanWilayah(db, wilayah) : undefined).map((p) => ({ ...p, wilayah_nama: nama.get(p.wilayah_id) ?? '?' }))
  }, [db, wilayah])
  return (
    <>
      <KepalaHalaman
        judul="Pengajian"
        keterangan="Jadwal rutin milik admin; pengajian desa/daerah berlaku juga bagi kelompok di bawahnya."
        aksi={<Tombol onClick={() => setForm({ p: null })}>+ Tambah pengajian</Tombol>}
      />
      <Kartu>
        <div className="filter">
          <PilihWilayah db={db} label="Wilayah" nilai={wilayah} ubah={setWilayah} kosong="Semua wilayah" />
        </div>
        <KeadaanData hasil={hasil} kosong={(d) => d.length === 0} teksKosong="Belum ada jadwal pengajian rutin.">
          {(daftar) => (
            <table className="tabel">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Jenis</th>
                  <th>Hari</th>
                  <th>Jam</th>
                  <th>Tempat</th>
                  <th>Wilayah</th>
                  <th aria-label="Aksi" />
                </tr>
              </thead>
              <tbody>
                {daftar.map((x) => (
                  <tr key={x.id}>
                    <td>{x.nama}</td>
                    <td>{x.jenis ?? '—'}</td>
                    <td>{x.hari === null ? '—' : NAMA_HARI[x.hari]}</td>
                    <td>{x.jam ?? '—'}</td>
                    <td>{x.tempat ?? '—'}</td>
                    <td>{x.wilayah_nama}</td>
                    <td className="sel-aksi">
                      <Tombol kecil varian="tipis" onClick={() => setForm({ p: x })}>
                        Ubah
                      </Tombol>
                      <Tombol kecil varian="tipis" onClick={() => setHapus(x)}>
                        Hapus
                      </Tombol>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </KeadaanData>
      </Kartu>
      {form ? <FormPengajian p={form.p} wilayahAwal={wilayah} tutup={() => setForm(null)} /> : null}
      {hapus ? (
        <Konfirmasi
          judul="Hapus pengajian"
          pesan={`Hapus jadwal "${hapus.nama}"?`}
          ya="Hapus"
          bahaya
          batal={() => setHapus(null)}
          setuju={async () => {
            await aksi(() => hapusPengajian(db, hapus.id), 'Jadwal dihapus.')
            setHapus(null)
          }}
        />
      ) : null}
    </>
  )
}

function FormPengajian(p: { p: Pengajian | null; wilayahAwal: string; tutup: () => void }) {
  const { db, aksi } = useApp()
  const x = p.p
  const [wilayah, setWilayah] = useState(x?.wilayah_id ?? p.wilayahAwal)
  const [nama, setNama] = useState(x?.nama ?? '')
  const [jenis, setJenis] = useState(x?.jenis ?? '')
  const [hari, setHari] = useState(x?.hari === null || x?.hari === undefined ? '0' : String(x.hari))
  const [jam, setJam] = useState(x?.jam ?? '16:00')
  const [tempat, setTempat] = useState(x?.tempat ?? '')
  return (
    <Modal
      judul={x ? 'Ubah pengajian' : 'Tambah pengajian'}
      tutup={p.tutup}
      aksi={
        <>
          <Tombol varian="kedua" onClick={p.tutup}>
            Batal
          </Tombol>
          <Tombol
            onClick={async () => {
              const d = { nama, jenis: jenis || null, hari: Number(hari), jam: jam || null, tempat: tempat || null }
              const h = await aksi(() => (x ? ubahPengajian(db, x.id, d) : tambahPengajian(db, { wilayahId: wilayah, ...d })), 'Jadwal pengajian disimpan.')
              if (h) p.tutup()
            }}
          >
            Simpan
          </Tombol>
        </>
      }
    >
      <div className="formulir dua-kolom">
        {x ? null : <PilihWilayah db={db} label="Wilayah" nilai={wilayah} ubah={setWilayah} kosong="— pilih wilayah —" />}
        <Isian label="Nama pengajian" nilai={nama} ubah={setNama} wajib placeholder="mis. Pengajian Caberawit" />
        <Isian label="Jenis" nilai={jenis} ubah={setJenis} placeholder="mis. caberawit, remaja, umum" />
        <Pilihan label="Hari" nilai={hari} ubah={setHari} pilihan={OPSI_HARI} />
        <Isian label="Jam" type="time" nilai={jam} ubah={setJam} />
        <Isian label="Tempat" nilai={tempat} ubah={setTempat} />
      </div>
    </Modal>
  )
}
