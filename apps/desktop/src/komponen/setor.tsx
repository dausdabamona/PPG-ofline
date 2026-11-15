// Komponen bersama v3: kartu "Setor ke Desa/Daerah" (tombol besar + tenggat) dan tabel status setor wilayah bawahan.
import { buatSetor, pengingatSetor, type StatusSetorBawahan } from '@ppg/core'
import { useApp, useData } from '../konteks'
import { KeadaanData, Kartu, Kosong, Lencana, Tombol } from './ui'
import { uraianJadwalSetor, waktuHari, waktuLokal } from '../utils/label'

/** Kartu setor ke tingkat atas: tujuan, tenggat, data belum disetor, tombol besar. */
export function KartuSetorKeAtas(p: { ringkas?: boolean }) {
  const { db, peran, platform, aksi, toast } = useApp()
  const hasil = useData(() => pengingatSetor(db), [db])
  const tujuanBawaan = peran === 'kelompok' ? 'Desa' : 'Daerah'
  const setor = async (semua = false) => {
    const b = await aksi(() => buatSetor(db, { semua }))
    if (!b) return
    const lok = await aksi(() => platform.simpanBerkas(b.nama, b.bytes))
    if (lok) toast('sukses', `Berkas ${b.nama} disimpan. Kirim ke ${hasil.data?.tujuan?.nama ?? tujuanBawaan} lewat WA.`)
  }
  return (
    <Kartu judul={`Setor ke ${tujuanBawaan}`}>
      <KeadaanData hasil={hasil}>
        {(r) =>
          r ? (
            <div className={`kotak-setor${r.terlambat ? ' terlambat' : r.mendekat ? ' mendekat' : ''}`}>
              <div>
                <p>
                  Tujuan: <b>{r.tujuan?.nama ?? tujuanBawaan}</b>
                </p>
                <p>
                  Tenggat berikutnya: <b>{r.tenggatBerikutnya ? waktuHari(r.tenggatBerikutnya) : 'Belum diatur daerah'}</b>{' '}
                  {r.terlambat ? <Lencana warna="merah">Terlambat</Lencana> : r.mendekat ? <Lencana warna="kuning">Mendekati tenggat</Lencana> : null}
                </p>
                <p>
                  Setor terakhir: <b>{r.terakhirSetor ? waktuLokal(r.terakhirSetor) : 'Belum pernah'}</b> · Data belum diterima {tujuanBawaan.toLowerCase()}:{' '}
                  <b data-testid="belum-disetor">{r.belumDisetor}</b>
                </p>
              </div>
              <button type="button" className="tombol tombol-utama tombol-besar" onClick={() => void setor(false)}>
                Setor ke {tujuanBawaan}
              </button>
              {!p.ringkas ? (
                <details>
                  <summary>Pilihan lain</summary>
                  <p className="keterangan">Bila tingkat atas memulihkan databasenya, kirim ulang semua data yang pernah dicatat/diterima di sini.</p>
                  <Tombol varian="kedua" onClick={() => setor(true)}>
                    Kirim ulang semua data
                  </Tombol>
                </details>
              ) : null}
            </div>
          ) : (
            <Kosong teks="EXE ini tidak menyetor ke atas." />
          )
        }
      </KeadaanData>
    </Kartu>
  )
}

/** Tabel status setor wilayah bawahan (daerah → desa, desa → kelompok, kelompok → HP). */
export function TabelStatusSetor(p: { daftar: StatusSetorBawahan[]; kolomNama: string; teksKosong: string }) {
  if (!p.daftar.length) return <Kosong teks={p.teksKosong} />
  return (
    <table className="tabel" aria-label={`Status setor tiap ${p.kolomNama.toLowerCase()}`}>
      <thead>
        <tr>
          <th>{p.kolomNama}</th>
          <th>Jadwal</th>
          <th>Tenggat berikutnya</th>
          <th>Setor terakhir</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {p.daftar.map((s) => (
          <tr key={`${s.wilayah_id}-${s.perangkat_id ?? ''}`} className={s.terlambat ? 'baris-merah' : ''}>
            <td>{s.nama}</td>
            <td>{uraianJadwalSetor(s.jadwal)}</td>
            <td>{s.tenggatBerikutnya ? waktuHari(s.tenggatBerikutnya) : '—'}</td>
            <td>{s.terakhirSetor ? `${waktuLokal(s.terakhirSetor)} (${s.hariSejakSetor ?? 0} hari lalu)` : 'Belum pernah'}</td>
            <td>
              {!s.jadwal ? (
                <Lencana warna="abu">Tanpa jadwal</Lencana>
              ) : s.terlambat ? (
                <Lencana warna="merah">Terlambat</Lencana>
              ) : (
                <Lencana warna="hijau">Tepat waktu</Lencana>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
