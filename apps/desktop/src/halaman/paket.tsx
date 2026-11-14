// Layar 11: Kirim Paket — buat berkas PAKET untuk satu wilayah atau semua kelompok berpenerima, lalu simpan.
import { useState } from 'react'
import { ambilWilayah, buatPaket, daftarPerangkatRinci, daftarWilayah, kelompokBerpenerima } from '@ppg/core'
import { useApp, useData } from '../konteks'
import { KeadaanData, Kartu, KepalaHalaman, Lencana, Tombol } from '../komponen/ui'
import { PilihWilayah } from '../komponen/wilayah'
import { LABEL_TINGKAT } from '../utils/label'

interface PaketDibuat {
  wilayah: string
  nama: string
  versi: number
  penerima: number
  ukuran: number
}

export function HalamanPaket() {
  const { db, kunci, platform, aksi, toast } = useApp()
  const [wilayah, setWilayah] = useState('')
  const [dibuat, setDibuat] = useState<{ daftar: PaketDibuat[]; lokasi: string } | null>(null)

  const kelompok = useData(() => {
    const ber = new Set(daftarWilayah(db, { tingkat: 'daerah' }).flatMap((d) => kelompokBerpenerima(db, d.id)))
    return daftarWilayah(db, { tingkat: 'kelompok' }).map((k) => ({
      ...k,
      berpenerima: ber.has(k.id),
      penerima: daftarPerangkatRinci(db, { wilayahId: k.id, role: ['mubaligh', 'pengurus'], status: 'aktif' }).length,
    }))
  }, [db])

  const satu = async () => {
    const w = ambilWilayah(db, wilayah)
    const p = await aksi(() => buatPaket(db, wilayah, kunci))
    if (!p || !w) return
    if (p.penerima === 0) toast('info', `Paket ${w.nama} tidak punya penerima aktif — belum ada token pengurus/mubaligh di wilayah ini.`)
    const lokasi = await aksi(() => platform.simpanBerkas(p.nama, p.bytes))
    if (lokasi) {
      setDibuat({ daftar: [{ wilayah: w.nama, nama: p.nama, versi: p.versi, penerima: p.penerima, ukuran: p.bytes.length }], lokasi })
      toast('sukses', `Paket ${w.nama} v${p.versi} disimpan. Kirim berkas ke grup WA wilayah itu.`)
    }
  }

  const semua = async () => {
    const ids = [...new Set(daftarWilayah(db, { tingkat: 'daerah' }).flatMap((d) => kelompokBerpenerima(db, d.id)))]
    if (!ids.length) {
      toast('info', 'Belum ada kelompok yang punya token pengurus/mubaligh aktif.')
      return
    }
    const paket = await aksi(() => ids.map((id) => ({ id, p: buatPaket(db, id, kunci) })))
    if (!paket) return
    const lokasi = await aksi(() => platform.simpanKeFolder(paket.map((x) => ({ nama: x.p.nama, bytes: x.p.bytes }))))
    if (lokasi) {
      setDibuat({
        lokasi,
        daftar: paket.map((x) => ({ wilayah: ambilWilayah(db, x.id)?.nama ?? x.id, nama: x.p.nama, versi: x.p.versi, penerima: x.p.penerima, ukuran: x.p.bytes.length })),
      })
      toast('sukses', `${paket.length} berkas paket disimpan di ${lokasi}.`)
    }
  }

  return (
    <>
      <KepalaHalaman judul="Kirim Paket" keterangan="Paket membawa data master, kegiatan, koreksi, token & pencabutan terbaru ke HP pengurus/mubaligh." />
      <Kartu judul="Paket satu wilayah">
        <div className="filter">
          <PilihWilayah db={db} label="Wilayah" nilai={wilayah} ubah={setWilayah} kosong="— pilih wilayah —" />
          <div className="aksi-filter">
            <Tombol onClick={satu} disabled={!wilayah}>
              Buat & simpan paket
            </Tombol>
            <Tombol varian="kedua" onClick={semua}>
              Paket semua kelompok
            </Tombol>
          </div>
        </div>
      </Kartu>
      {dibuat ? (
        <Kartu judul={`Paket tersimpan (${dibuat.lokasi})`}>
          <table className="tabel">
            <thead>
              <tr>
                <th>Wilayah</th>
                <th>Berkas</th>
                <th>Versi</th>
                <th>Penerima</th>
                <th>Ukuran</th>
              </tr>
            </thead>
            <tbody>
              {dibuat.daftar.map((d) => (
                <tr key={d.nama}>
                  <td>{d.wilayah}</td>
                  <td>
                    <code>{d.nama}</code>
                  </td>
                  <td>{d.versi}</td>
                  <td>{d.penerima}</td>
                  <td>{(d.ukuran / 1024).toFixed(1)} KB</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Kartu>
      ) : null}
      <Kartu judul="Kelompok & penerima">
        <KeadaanData hasil={kelompok} kosong={(d) => d.length === 0} teksKosong="Belum ada kelompok.">
          {(daftar) => (
            <table className="tabel">
              <thead>
                <tr>
                  <th>Kelompok</th>
                  <th>Penerima aktif di kelompok</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {daftar.map((k) => (
                  <tr key={k.id}>
                    <td>
                      {k.nama} <small>({LABEL_TINGKAT[k.tingkat]})</small>
                    </td>
                    <td>{k.penerima}</td>
                    <td>{k.berpenerima ? <Lencana warna="hijau">Siap dikirimi</Lencana> : <Lencana warna="abu">Belum ada token</Lencana>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </KeadaanData>
      </Kartu>
    </>
  )
}
