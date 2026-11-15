// Layar 12: Rekap & Laporan — presensi & kemajuan per wilayah/periode, ekspor Excel.
import { useState } from 'react'
import { ambilWilayah, daftarWilayah, rekapCapaian, rekapKemajuan, rekapPresensi, slug, tambahHari, tanggalHariIni, type BarisCapaian } from '@ppg/core'
import { useApp, useData } from '../konteks'
import { Isian, KeadaanData, Kartu, KepalaHalaman, Kosong, Tombol } from '../komponen/ui'
import { PilihWilayah } from '../komponen/wilayah'
import { buatExcelRekap } from '../utils/excel'
import { LABEL_KATEGORI, label, labelPeriode } from '../utils/label'

export function HalamanRekap() {
  const { db, peran, wilayahId, platform, aksi, toast } = useApp()
  const akar = peran === 'daerah' ? null : wilayahId
  const [wilayah, setWilayah] = useState(akar ?? '')
  const [mulai, setMulai] = useState(tambahHari(tanggalHariIni(), -30))
  const [selesai, setSelesai] = useState(tanggalHariIni())
  const hasil = useData(() => {
    if (!wilayah) return null
    return {
      presensi: rekapPresensi(db, { wilayahId: wilayah, mulai, selesai }),
      kemajuan: rekapKemajuan(db, { wilayahId: wilayah }),
      capaian: rekapCapaian(db, { wilayahId: wilayah }),
      namaKelompok: new Map(daftarWilayah(db, { tingkat: 'kelompok' }).map((k) => [k.id, k.nama])),
    }
  }, [db, wilayah, mulai, selesai])

  const ekspor = async () => {
    const d = hasil.data
    const w = ambilWilayah(db, wilayah)
    if (!d || !w) return
    const bytes = await aksi(() => buatExcelRekap({ judul: 'Rekap PPG', wilayah: w.nama, presensi: d.presensi, kemajuan: d.kemajuan, namaKelompok: d.namaKelompok, capaian: d.capaian }))
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
          <PilihWilayah db={db} label="Wilayah" nilai={wilayah} ubah={setWilayah} kosong="— pilih wilayah —" akar={akar} />
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
                <Kartu judul={`Capaian target — ${labelPeriode(d.capaian.periode)}`}>
                  {d.capaian.wilayah.total === 0 ? (
                    <Kosong teks="Belum ada target kurikulum untuk generus di wilayah ini pada periode aktif." />
                  ) : (
                    <>
                      <p>
                        Capaian {d.capaian.wilayah.nama}: <b>{d.capaian.wilayah.persen}%</b> ({d.capaian.wilayah.tuntas} dari {d.capaian.wilayah.total} materi target
                        tuntas, {d.capaian.wilayah.jumlahGenerus} generus)
                      </p>
                      {d.capaian.perDesa.length > 1 ? <TabelCapaian judul="Desa" daftar={d.capaian.perDesa} /> : null}
                      <TabelCapaian judul="Kelompok" daftar={d.capaian.perKelompok} />
                      <TabelCapaian
                        judul="Kelas"
                        daftar={d.capaian.perKelas.map((k) => ({ ...k, nama: `${k.kelompok_nama} — ${label(LABEL_KATEGORI, k.kategori)}` }))}
                      />
                    </>
                  )}
                </Kartu>
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

function TabelCapaian(p: { judul: string; daftar: BarisCapaian[] }) {
  return (
    <table className="tabel" aria-label={`Capaian per ${p.judul.toLowerCase()}`}>
      <thead>
        <tr>
          <th>{p.judul}</th>
          <th>Generus</th>
          <th>Materi tuntas</th>
          <th>% Tuntas</th>
        </tr>
      </thead>
      <tbody>
        {p.daftar.map((r, i) => (
          <tr key={`${r.wilayah_id}-${i}`}>
            <td>{r.nama}</td>
            <td>{r.jumlahGenerus}</td>
            <td>{r.total ? `${r.tuntas}/${r.total}` : 'Belum ada target'}</td>
            <td>
              {r.total ? (
                <>
                  <div className="batang" aria-label={`${r.persen}%`}>
                    <span style={{ width: `${Math.min(100, r.persen)}%` }} />
                  </div>
                  {r.persen}%
                </>
              ) : (
                '—'
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
