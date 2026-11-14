// Layar 12: Rekap & Laporan — presensi & kemajuan per wilayah/periode, ekspor Excel.
import { useState } from 'react'
import { ambilWilayah, daftarWilayah, rekapKemajuan, rekapPresensi, slug, tambahHari, tanggalHariIni } from '@ppg/core'
import { useApp, useData } from '../konteks'
import { Isian, KeadaanData, Kartu, KepalaHalaman, Kosong, Tombol } from '../komponen/ui'
import { PilihWilayah } from '../komponen/wilayah'
import { buatExcelRekap } from '../utils/excel'
import { LABEL_KATEGORI, label } from '../utils/label'

export function HalamanRekap() {
  const { db, platform, aksi, toast } = useApp()
  const [wilayah, setWilayah] = useState('')
  const [mulai, setMulai] = useState(tambahHari(tanggalHariIni(), -30))
  const [selesai, setSelesai] = useState(tanggalHariIni())
  const hasil = useData(() => {
    if (!wilayah) return null
    return {
      presensi: rekapPresensi(db, { wilayahId: wilayah, mulai, selesai }),
      kemajuan: rekapKemajuan(db, { wilayahId: wilayah }),
      namaKelompok: new Map(daftarWilayah(db, { tingkat: 'kelompok' }).map((k) => [k.id, k.nama])),
    }
  }, [db, wilayah, mulai, selesai])

  const ekspor = async () => {
    const d = hasil.data
    const w = ambilWilayah(db, wilayah)
    if (!d || !w) return
    const bytes = await aksi(() => buatExcelRekap({ judul: 'Rekap PPG', wilayah: w.nama, presensi: d.presensi, kemajuan: d.kemajuan, namaKelompok: d.namaKelompok }))
    if (!bytes) return
    const p = await aksi(() => platform.simpanBerkas(`Rekap_${slug(w.nama)}_${mulai}_${selesai}.xlsx`, bytes))
    if (p) toast('sukses', 'Rekap Excel disimpan.')
  }

  return (
    <>
      <KepalaHalaman
        judul="Rekap & Laporan"
        keterangan="Hanya kemajuan yang disahkan mubaligh masuk rekap resmi; presensi dihitung per periode keanggotaan dan hanya saat generus aktif."
        aksi={
          <Tombol onClick={ekspor} disabled={!hasil.data}>
            Ekspor Excel
          </Tombol>
        }
      />
      <Kartu>
        <div className="filter">
          <PilihWilayah db={db} label="Wilayah" nilai={wilayah} ubah={setWilayah} kosong="— pilih wilayah —" />
          <Isian label="Dari" type="date" nilai={mulai} ubah={setMulai} />
          <Isian label="Sampai" type="date" nilai={selesai} ubah={setSelesai} />
        </div>
      </Kartu>
      {!wilayah ? (
        <Kartu>
          <Kosong teks="Pilih wilayah untuk melihat rekap." />
        </Kartu>
      ) : (
        <KeadaanData hasil={hasil}>
          {(d) =>
            d ? (
              <>
                <Kartu judul="Presensi per kelompok">
                  {d.presensi.perKelompok.length === 0 ? (
                    <Kosong teks="Belum ada presensi pada periode ini." />
                  ) : (
                    <table className="tabel">
                      <thead>
                        <tr>
                          <th>Kelompok</th>
                          <th>Hadir</th>
                          <th>Izin</th>
                          <th>Sakit</th>
                          <th>Alpa</th>
                          <th>Total</th>
                          <th>% Hadir</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.presensi.perKelompok.map((k) => (
                          <tr key={k.kelompok_id}>
                            <td>{k.nama}</td>
                            <td>{k.hadir}</td>
                            <td>{k.izin}</td>
                            <td>{k.sakit}</td>
                            <td>{k.alpa}</td>
                            <td>{k.total}</td>
                            <td>{k.persen_hadir}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Kartu>
                <Kartu judul="Presensi per generus">
                  {d.presensi.perGenerus.length === 0 ? (
                    <Kosong teks="Belum ada presensi pada periode ini." />
                  ) : (
                    <div className="gulir">
                      <table className="tabel" aria-label="Presensi per generus">
                        <thead>
                          <tr>
                            <th>Nama</th>
                            <th>Kelompok</th>
                            <th>Hadir</th>
                            <th>Izin</th>
                            <th>Sakit</th>
                            <th>Alpa</th>
                            <th>% Hadir</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.presensi.perGenerus.map((g) => (
                            <tr key={`${g.generus_id}-${g.kelompok_id}`}>
                              <td>{g.nama}</td>
                              <td>{d.namaKelompok.get(g.kelompok_id) ?? '?'}</td>
                              <td>{g.hadir}</td>
                              <td>{g.izin}</td>
                              <td>{g.sakit}</td>
                              <td>{g.alpa}</td>
                              <td>{g.persen_hadir}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Kartu>
                <Kartu judul="Kemajuan belajar (disahkan)">
                  {d.kemajuan.length === 0 ? (
                    <Kosong teks="Belum ada generus aktif di wilayah ini." />
                  ) : (
                    <div className="gulir">
                      <table className="tabel">
                        <thead>
                          <tr>
                            <th>Nama</th>
                            <th>Kelompok</th>
                            <th>Kategori</th>
                            <th>Per bidang</th>
                            <th>Disahkan</th>
                            <th>% Selesai</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.kemajuan.map((r) => (
                            <tr key={r.generus_id}>
                              <td>{r.nama}</td>
                              <td>{d.namaKelompok.get(r.kelompok_id) ?? '?'}</td>
                              <td>{label(LABEL_KATEGORI, r.kategori)}</td>
                              <td>
                                {r.perBidang.map((b) => (
                                  <small key={b.bidang_id} className="blok">
                                    {b.bidang}: {b.disahkan}/{b.total}
                                  </small>
                                ))}
                              </td>
                              <td>
                                {r.disahkan}/{r.total}
                              </td>
                              <td>
                                <div className="batang" aria-label={`${r.persen}%`}>
                                  <span style={{ width: `${Math.min(100, r.persen)}%` }} />
                                </div>
                                {r.persen}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Kartu>
              </>
            ) : null
          }
        </KeadaanData>
      )}
    </>
  )
}
