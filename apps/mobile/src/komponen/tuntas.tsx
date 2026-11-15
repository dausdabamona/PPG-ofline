// v3 — "Materi yang perlu dituntaskan" (layar pertama murid & orang tua): bilah capaian periode aktif, daftar materi
// belum tuntas berurutan, materi yang sudah tuntas, dan jadwal pertemuan berikutnya.
import { materiPerluDituntaskan, namaHari } from '@ppg/core'
import { useApp, useData } from '../konteks'
import { BilahPersen, Kartu, KeadaanData, Lencana } from './ui'
import { label, labelPeriode, LABEL_STATUS_TARGET, persenTeks, tanggalTeks, WARNA_STATUS_TARGET } from '../utils/label'

export function MateriPerluDituntaskan(p: { generusId: string; teksKosong: string; anak?: boolean }) {
  const { db } = useApp()
  const data = useData(() => materiPerluDituntaskan(db, p.generusId), [p.generusId])
  return (
    <KeadaanData hasil={data} kosong={(d) => !d} teksKosong={p.teksKosong}>
      {(d) => {
        const x = d!
        const pb = x.pertemuanBerikutnya
        return (
          <>
            <Kartu judul={p.anak ? `Capaian ${x.generus.nama}` : 'Capaianmu'}>
              <p className="keterangan">{labelPeriode(x.periode)}</p>
              {x.adaTarget ? (
                <>
                  <div className="capaian-besar">
                    <strong>{persenTeks(x.persen)}</strong>
                    <span>
                      {x.tuntas} dari {x.total} materi tuntas
                    </span>
                  </div>
                  <BilahPersen persen={x.persen} label={`Capaian ${x.generus.nama}`} />
                </>
              ) : (
                <p>Target materi semester ini belum ditetapkan. Buka berkas materi atau balasan terbaru dari mubaligh.</p>
              )}
            </Kartu>
            {pb ? (
              <div className="pertemuan-berikut" role="note">
                <small>Pertemuan berikutnya</small>
                <p>
                  <b>
                    {namaHari(pb.tanggal)}, {tanggalTeks(pb.tanggal)}
                  </b>
                  {pb.jam ? ` · ${pb.jam}` : ''} · {pb.judul}
                  {pb.tempat ? ` · ${pb.tempat}` : ''}
                </p>
              </div>
            ) : null}
            {x.adaTarget ? (
              <Kartu judul={`Perlu dituntaskan (${x.perluDituntaskan.length})`}>
                {x.perluDituntaskan.length ? (
                  <ol className="daftar-target">
                    {x.perluDituntaskan.map((m, i) => (
                      <li key={m.materi_id}>
                        <span className="nomor" aria-hidden="true">
                          {i + 1}
                        </span>
                        <span>
                          <strong>{m.nama}</strong>
                          <small>
                            {m.bidang_nama} · {m.kategori_nama}
                          </small>
                        </span>
                        <Lencana warna={WARNA_STATUS_TARGET[m.status]}>{label(LABEL_STATUS_TARGET, m.status)}</Lencana>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>Alhamdulillah, semua materi semester ini sudah tuntas.</p>
                )}
              </Kartu>
            ) : null}
            {x.sudahTuntas.length ? (
              <Kartu judul={`✓ Sudah tuntas (${x.sudahTuntas.length})`}>
                <ul className="daftar-target">
                  {x.sudahTuntas.map((m) => (
                    <li key={m.materi_id}>
                      <span className="nomor tuntas" aria-hidden="true">
                        ✓
                      </span>
                      <span>
                        <strong>{m.nama}</strong>
                        <small>{m.bidang_nama}</small>
                      </span>
                      <Lencana warna="hijau">Tuntas</Lencana>
                    </li>
                  ))}
                </ul>
              </Kartu>
            ) : null}
          </>
        )
      }}
    </KeadaanData>
  )
}
