// v3 (V4): Absen Pertemuan (EXE kelompok) — pilih tanggal & kelas (pengajian rutin per kategori), pilih materi hari ini
// dengan saran dari target kurikulum, tandai hadir/izin/sakit/alpa dan centang materi yang dituntaskan tiap generus.
import { useEffect, useMemo, useState } from 'react'
import {
  absenPertemuan,
  aturMateriPertemuan,
  bukaPertemuan,
  daftarPertemuan,
  daftarTarget,
  kategoriKelas,
  lembarAbsenPertemuan,
  pengajianUntukKelompok,
  tanggalHariIni,
  type StatusPresensi,
} from '@ppg/core'
import { useApp, useData } from '../konteks'
import { Isian, KeadaanData, Kartu, KepalaHalaman, Kosong, Lencana, Pilihan, Tombol } from '../komponen/ui'
import { LABEL_KATEGORI, LABEL_PRESENSI, NAMA_HARI, label } from '../utils/label'

const STATUS: StatusPresensi[] = ['hadir', 'izin', 'sakit', 'alpa']

export function HalamanAbsen() {
  const { db, wilayahId, aksi } = useApp()
  const kelompokId = wilayahId ?? ''
  const [tanggal, setTanggal] = useState(tanggalHariIni())
  const [kelas, setKelas] = useState('')
  const [pertemuanId, setPertemuanId] = useState<string | null>(null)
  const daftarKelas = useData(() => pengajianUntukKelompok(db, kelompokId), [db, kelompokId])
  const sudahAda = useData(() => daftarPertemuan(db, kelompokId, { mulai: tanggal, selesai: tanggal }), [db, kelompokId, tanggal])
  const namaKelas = useMemo(() => new Map((daftarKelas.data ?? []).map((k) => [k.id, k.nama])), [daftarKelas.data])
  useEffect(() => setPertemuanId(null), [tanggal])

  return (
    <>
      <KepalaHalaman judul="Absen Pertemuan" keterangan="Pilih kelas, pilih materi hari ini, tandai kehadiran, lalu centang generus yang sudah menuntaskan materi." />
      <Kartu judul="1. Pertemuan">
        <div className="filter">
          <Isian label="Tanggal pertemuan" type="date" nilai={tanggal} ubah={setTanggal} />
          <KeadaanData hasil={daftarKelas}>
            {(d) => (
              <Pilihan
                label="Kelas / pengajian"
                nilai={kelas}
                ubah={setKelas}
                kosong="Tanpa kelas (semua generus)"
                pilihan={d.map((k) => ({
                  nilai: k.id,
                  teks: `${k.nama}${k.hari !== null ? ` — ${NAMA_HARI[k.hari]}${k.jam ? ` ${k.jam}` : ''}` : ''}${kategoriKelas(k) ? ` (${kategoriKelas(k)!.map((x) => label(LABEL_KATEGORI, x)).join(', ')})` : ''}`,
                }))}
              />
            )}
          </KeadaanData>
          <div className="aksi-filter">
            <Tombol
              onClick={async () => {
                const p = await aksi(() => bukaPertemuan(db, { kelompokId, tanggal, pengajianId: kelas || null }))
                if (p) setPertemuanId(p.id)
              }}
            >
              Buka pertemuan
            </Tombol>
          </div>
        </div>
        <KeadaanData hasil={sudahAda}>
          {(d) =>
            d.length ? (
              <p className="keterangan">
                Pertemuan tanggal ini:{' '}
                {d.map((x) => (
                  <Tombol key={x.id} kecil varian={x.id === pertemuanId ? 'utama' : 'tipis'} onClick={() => setPertemuanId(x.id)}>
                    {x.pengajian_id ? (namaKelas.get(x.pengajian_id) ?? 'Kelas') : 'Tanpa kelas'}
                  </Tombol>
                ))}
              </p>
            ) : null
          }
        </KeadaanData>
      </Kartu>
      {pertemuanId ? <LembarAbsen key={pertemuanId} pertemuanId={pertemuanId} /> : null}
    </>
  )
}

function LembarAbsen(p: { pertemuanId: string }) {
  const { db, aksi, toast } = useApp()
  const lembar = useData(() => lembarAbsenPertemuan(db, p.pertemuanId), [db, p.pertemuanId])
  const l = lembar.data
  const [status, setStatus] = useState<Record<string, StatusPresensi>>({})
  const [tuntas, setTuntas] = useState<Record<string, string[]>>({})
  const [tambahMateri, setTambahMateri] = useState('')
  const target = useData(() => (l ? daftarTarget(db, { kategoriGenerus: l.kelas.kategori ?? undefined }) : []), [db, l?.kelas.kategori?.join(',')])
  // isi awal status dari presensi yang sudah tercatat (bawaan: hadir)
  useEffect(() => {
    if (!l) return
    setStatus((s) => {
      const baru = { ...s }
      for (const b of l.baris) if (!baru[b.generus_id]) baru[b.generus_id] = (b.status as StatusPresensi | null) ?? 'hadir'
      return baru
    })
  }, [l])

  if (!l) return <KeadaanData hasil={lembar}>{() => <Kosong teks="Pertemuan tidak ditemukan." />}</KeadaanData>
  const materiIds = l.materi.map((m) => m.id)
  const aturMateri = (ids: string[]) => aksi(() => aturMateriPertemuan(db, p.pertemuanId, ids))

  return (
    <>
      <Kartu judul={`2. Materi hari ini — ${l.kelas.nama}`}>
        {l.materi.length ? (
          <ul className="daftar-materi">
            {l.materi.map((m) => (
              <li key={m.id}>
                <span>{m.nama}</span>
                <Tombol kecil varian="tipis" onClick={() => aturMateri(materiIds.filter((x) => x !== m.id))}>
                  Lepas
                </Tombol>
              </li>
            ))}
          </ul>
        ) : (
          <Kosong teks="Belum ada materi untuk pertemuan ini. Pilih dari saran atau daftar target." />
        )}
        {l.saran.filter((s) => !materiIds.includes(s.materi_id)).length ? (
          <>
            <h3>Saran materi (paling banyak belum tuntas)</h3>
            <ul className="daftar-materi">
              {l.saran
                .filter((s) => !materiIds.includes(s.materi_id))
                .map((s) => (
                  <li key={s.materi_id}>
                    <span>
                      {s.nama} <small>({s.belumTuntas} dari {s.jumlahGenerus} generus belum tuntas)</small>
                    </span>
                    <Tombol kecil varian="kedua" onClick={() => aturMateri([...materiIds, s.materi_id])}>
                      + Pakai
                    </Tombol>
                  </li>
                ))}
            </ul>
          </>
        ) : null}
        <div className="filter">
          <KeadaanData hasil={target}>
            {(d) => (
              <Pilihan
                label="Materi lain dari target"
                nilai={tambahMateri}
                ubah={setTambahMateri}
                kosong={d.length ? '— pilih materi —' : '(kurikulum belum menetapkan target)'}
                pilihan={[...new Map(d.filter((m) => !materiIds.includes(m.id)).map((m) => [m.id, m])).values()].map((m) => ({
                  nilai: m.id,
                  teks: `${m.nama} (${m.kategori_nama})`,
                }))}
              />
            )}
          </KeadaanData>
          <div className="aksi-filter">
            <Tombol
              varian="kedua"
              disabled={!tambahMateri}
              onClick={async () => {
                await aturMateri([...materiIds, tambahMateri])
                setTambahMateri('')
              }}
            >
              Tambahkan materi
            </Tombol>
          </div>
        </div>
      </Kartu>
      <Kartu
        judul="3. Kehadiran & materi tuntas"
        aksi={
          <Tombol varian="kedua" onClick={() => setStatus(Object.fromEntries(l.baris.map((b) => [b.generus_id, 'hadir' as StatusPresensi])))}>
            Semua hadir
          </Tombol>
        }
      >
        {l.baris.length === 0 ? (
          <Kosong teks="Tidak ada generus aktif untuk kelas ini pada tanggal tersebut." />
        ) : (
          <div className="gulir">
            <table className="tabel" aria-label="Lembar absen">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Kategori</th>
                  <th>Kehadiran</th>
                  {l.materi.map((m) => (
                    <th key={m.id}>Tuntas: {m.nama}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {l.baris.map((b) => {
                  const st = status[b.generus_id] ?? 'hadir'
                  return (
                    <tr key={b.generus_id}>
                      <td>{b.nama}</td>
                      <td>{label(LABEL_KATEGORI, b.kategori)}</td>
                      <td>
                        <select
                          aria-label={`Kehadiran ${b.nama}`}
                          value={st}
                          onChange={(e) => setStatus((s) => ({ ...s, [b.generus_id]: e.target.value as StatusPresensi }))}
                        >
                          {STATUS.map((x) => (
                            <option key={x} value={x}>
                              {LABEL_PRESENSI[x]}
                            </option>
                          ))}
                        </select>
                      </td>
                      {l.materi.map((m) =>
                        b.tuntas[m.id] ? (
                          <td key={m.id}>
                            <Lencana warna="hijau">Sudah tuntas</Lencana>
                          </td>
                        ) : (
                          <td key={m.id}>
                            <label className="centang">
                              <input
                                type="checkbox"
                                aria-label={`${b.nama} tuntas ${m.nama}`}
                                disabled={st !== 'hadir'}
                                checked={(tuntas[b.generus_id] ?? []).includes(m.id)}
                                onChange={(e) =>
                                  setTuntas((t) => {
                                    const l0 = t[b.generus_id] ?? []
                                    return { ...t, [b.generus_id]: e.target.checked ? [...l0, m.id] : l0.filter((x) => x !== m.id) }
                                  })
                                }
                              />
                              Tuntas
                            </label>
                          </td>
                        ),
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="aksi">
          <Tombol
            disabled={l.baris.length === 0}
            onClick={async () => {
              const h = await aksi(() =>
                absenPertemuan(
                  db,
                  p.pertemuanId,
                  l.baris.map((b) => {
                    const st = status[b.generus_id] ?? 'hadir'
                    return { generusId: b.generus_id, status: st, tuntas: st === 'hadir' ? (tuntas[b.generus_id] ?? []).filter((m) => materiIds.includes(m)) : [] }
                  }),
                ),
              )
              if (h) {
                setTuntas({})
                toast('sukses', `Absen tersimpan: ${h.presensi} generus, ${h.tuntas} materi tuntas. Jangan lupa Setor ke Desa sesuai jadwal.`)
              }
            }}
          >
            Simpan absen
          </Tombol>
        </div>
      </Kartu>
    </>
  )
}
