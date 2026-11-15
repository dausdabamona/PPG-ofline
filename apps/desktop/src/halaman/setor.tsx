// v3: Setor ke Desa (EXE kelompok) / Setor ke Daerah (EXE desa) — SETOR gabungan berisi data dari bawah + catatan sendiri.
import { jumlahBelumSampaiDaerah, tujuanSetor } from '@ppg/core'
import { useApp, useData } from '../konteks'
import { KeadaanData, Kartu, KepalaHalaman } from '../komponen/ui'
import { KartuSetorKeAtas } from '../komponen/setor'

export function HalamanSetor() {
  const { db, peran } = useApp()
  const atas = peran === 'kelompok' ? 'Desa' : 'Daerah'
  const info = useData(() => ({ tujuan: tujuanSetor(db), belumSampaiDaerah: jumlahBelumSampaiDaerah(db) }), [db])
  return (
    <>
      <KepalaHalaman
        judul={`Setor ke ${atas}`}
        keterangan={`Satu berkas setoran berisi semua data yang belum diterima ${atas.toLowerCase()} — termasuk setoran HP${peran === 'desa' ? ' dan EXE kelompok' : ''} yang sudah diimpor di sini.`}
      />
      <KartuSetorKeAtas />
      <Kartu judul="Cara mengirim">
        <ol className="langkah">
          <li>Tekan tombol <b>Setor ke {atas}</b>; simpan berkas <code>PPG_SETOR_….ppg</code>.</li>
          <li>Kirim berkas itu lewat WA ke admin {atas.toLowerCase()}{info.data?.tujuan ? ` (${info.data.tujuan.nama})` : ''}.</li>
          <li>Setoran bersifat kumulatif: bila satu berkas hilang, setoran berikutnya tetap membawa datanya.</li>
        </ol>
        <KeadaanData hasil={info}>
          {(d) =>
            peran === 'kelompok' ? (
              <p className="keterangan">Data yang belum dipastikan sampai daerah: {d.belumSampaiDaerah}.</p>
            ) : (
              <p className="keterangan">Data yang belum dipastikan sampai daerah: {d.belumSampaiDaerah} (berkurang setelah membuka paket terbaru dari daerah).</p>
            )
          }
        </KeadaanData>
      </Kartu>
    </>
  )
}
