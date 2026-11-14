// Layar 2: Beranda — ringkasan generus, perangkat aktif, usulan menunggu, setoran terakhir per kelompok.
import { ringkasanBerandaAdmin } from '@ppg/core'
import { useApp, useData } from '../konteks'
import { KeadaanData, Kartu, KepalaHalaman, Lencana, Tombol } from '../komponen/ui'
import type { KunciMenu } from '../App'
import { waktuLokal } from '../utils/label'

export function HalamanBeranda(p: { pilih: (k: KunciMenu) => void }) {
  const { db, kunci } = useApp()
  const hasil = useData(() => ringkasanBerandaAdmin(db), [db])
  return (
    <>
      <KepalaHalaman judul="Beranda" keterangan={`Ringkasan data ${kunci.namaOrganisasi}`} />
      <KeadaanData hasil={hasil}>
        {(r) => (
          <>
            <div className="grid-angka">
              <Angka judul="Generus aktif" nilai={r.generus.aktif} />
              <Angka judul="Generus mondok" nilai={r.generus.mondok} />
              <Angka judul="Perangkat aktif" nilai={r.perangkatAktif.total} catatan={`${r.perangkatAktif.pengurus} pengurus · ${r.perangkatAktif.mubaligh} mubaligh · ${r.perangkatAktif.generus + r.perangkatAktif.wali} generus/wali`} />
              <Angka
                judul="Usulan menunggu"
                nilai={r.usulanMenunggu}
                sorot={r.usulanMenunggu > 0}
                aksi={r.usulanMenunggu > 0 ? <Tombol kecil varian="tipis" onClick={() => p.pilih('usulan')}>Tinjau usulan</Tombol> : null}
              />
            </div>
            <Kartu
              judul="Setoran terakhir per kelompok"
              aksi={
                <Tombol varian="kedua" onClick={() => p.pilih('impor')}>
                  Impor setoran
                </Tombol>
              }
            >
              {r.setoranPerKelompok.length === 0 ? (
                <div className="keadaan keadaan-kosong">
                  <p>Belum ada kelompok. Mulai dengan menambah wilayah.</p>
                  <Tombol onClick={() => p.pilih('wilayah')}>Buka Wilayah</Tombol>
                </div>
              ) : (
                <table className="tabel">
                  <thead>
                    <tr>
                      <th>Kelompok</th>
                      <th>Setoran terakhir</th>
                      <th>Hari sejak</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.setoranPerKelompok.map((s) => (
                      <tr key={s.kelompok_id} className={s.terlambat ? 'baris-merah' : ''}>
                        <td>{s.nama}</td>
                        <td>{s.terakhir_setor ? waktuLokal(s.terakhir_setor) : 'Belum pernah'}</td>
                        <td>{s.hari_sejak ?? '—'}</td>
                        <td>{s.terlambat ? <Lencana warna="merah">Terlambat</Lencana> : <Lencana warna="hijau">Lancar</Lencana>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Kartu>
          </>
        )}
      </KeadaanData>
    </>
  )
}

function Angka(p: { judul: string; nilai: number; catatan?: string; sorot?: boolean; aksi?: React.ReactNode }) {
  return (
    <div className={`kartu-angka${p.sorot ? ' sorot' : ''}`}>
      <span className="judul-angka">{p.judul}</span>
      <strong className="nilai-angka">{p.nilai}</strong>
      {p.catatan ? <small>{p.catatan}</small> : null}
      {p.aksi}
    </div>
  )
}
