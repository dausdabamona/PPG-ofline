// v3 (V5): Target Capaian — materi wajib tuntas per periode (S1 = Juli–Desember, S2 = Januari–Juni) × kategori generus,
// berurutan; salin dari periode lain; atur periode aktif. EXE kurikulum: "Buat berkas Kurikulum" untuk dikirim ke daerah.
import { useEffect, useMemo, useState } from 'react'
import {
  KATEGORI_GENERUS,
  aturPeriodeAktif,
  buatKurikulum,
  daftarBidang,
  daftarKategoriMateri,
  daftarMateri,
  daftarTarget,
  periodeAktif,
  tetapkanTarget,
  type KategoriGenerus,
} from '@ppg/core'
import { useApp, useData } from '../konteks'
import { KeadaanData, Kartu, KepalaHalaman, Kosong, Lencana, Pilihan, Tombol } from '../komponen/ui'
import { LABEL_KATEGORI, daftarPeriodeSekitar, labelPeriode } from '../utils/label'

const OPSI_KATEGORI = KATEGORI_GENERUS.map((k) => ({ nilai: k, teks: LABEL_KATEGORI[k] ?? k }))

export function HalamanTarget() {
  const { db, peran, platform, aksi, toast } = useApp()
  const aktif = useData(() => periodeAktif(db), [db])
  const [periode, setPeriode] = useState(() => periodeAktif(db))
  const [kategori, setKategori] = useState<KategoriGenerus>('caberawit')
  const daftarPeriode = useMemo(() => daftarPeriodeSekitar(aktif.data ?? periode), [aktif.data, periode])

  const kirimKurikulum = async () => {
    const b = await aksi(() => buatKurikulum(db))
    if (!b) return
    const lok = await aksi(() => platform.simpanBerkas(b.nama, b.bytes))
    if (lok) toast('sukses', `Berkas ${b.nama} (${b.jumlah} data) disimpan. Kirim ke Admin Daerah lewat WA.`)
  }

  return (
    <>
      <KepalaHalaman
        judul="Target Capaian"
        keterangan="Materi wajib tuntas tiap kategori generus per periode. Murid & orang tua melihatnya sebagai “Materi yang perlu dituntaskan”."
        aksi={
          peran === 'kurikulum' ? (
            <Tombol onClick={kirimKurikulum}>Buat berkas Kurikulum</Tombol>
          ) : (
            <small className="keterangan">Target ikut turun lewat Berkas Materi (menu Materi) dan Kirim Paket.</small>
          )
        }
      />
      <Kartu judul="Periode">
        <div className="filter">
          <Pilihan label="Periode" nilai={periode} ubah={setPeriode} pilihan={daftarPeriode.map((x) => ({ nilai: x, teks: labelPeriode(x) }))} />
          <Pilihan label="Kategori generus" nilai={kategori} ubah={(v) => setKategori(v as KategoriGenerus)} pilihan={OPSI_KATEGORI} />
          <div className="aksi-filter">
            {aktif.data === periode ? (
              <Lencana warna="hijau">Periode aktif</Lencana>
            ) : (
              <Tombol varian="kedua" onClick={() => aksi(() => aturPeriodeAktif(db, periode), `Periode aktif: ${labelPeriode(periode)}.`)}>
                Jadikan periode aktif
              </Tombol>
            )}
          </div>
        </div>
        <p className="keterangan">Periode aktif sekarang: {aktif.data ? labelPeriode(aktif.data) : '—'}.</p>
      </Kartu>
      <PenyuntingTarget key={`${periode}-${kategori}`} periode={periode} kategori={kategori} daftarPeriode={daftarPeriode} />
    </>
  )
}

function PenyuntingTarget(p: { periode: string; kategori: KategoriGenerus; daftarPeriode: string[] }) {
  const { db, aksi, toast } = useApp()
  const tersimpan = useData(() => daftarTarget(db, { periode: p.periode, kategoriGenerus: p.kategori }).map((m) => m.id), [db, p.periode, p.kategori])
  const [ids, setIds] = useState<string[] | null>(null)
  const semuaMateri = useData(() => new Map(daftarMateri(db).map((m) => [m.id, m])), [db])
  const [sumber, setSumber] = useState('')
  useEffect(() => {
    if (ids === null && tersimpan.data) setIds(tersimpan.data)
  }, [tersimpan.data, ids])
  const daftar = ids ?? tersimpan.data ?? []
  const berubah = JSON.stringify(daftar) !== JSON.stringify(tersimpan.data ?? [])
  const geser = (i: number, arah: -1 | 1) => {
    const j = i + arah
    if (j < 0 || j >= daftar.length) return
    const x = [...daftar]
    ;[x[i], x[j]] = [x[j]!, x[i]!]
    setIds(x)
  }
  const tambah = (baru: string[]) => setIds([...daftar, ...baru.filter((m) => !daftar.includes(m))])

  return (
    <>
      <Kartu
        judul={`Target ${LABEL_KATEGORI[p.kategori]} — ${p.periode}`}
        aksi={
          <>
            {berubah ? <Lencana warna="kuning">Belum disimpan</Lencana> : null}
            <Tombol varian="kedua" disabled={!berubah} onClick={() => setIds(tersimpan.data ?? [])}>
              Batalkan perubahan
            </Tombol>
            <Tombol
              disabled={!berubah}
              onClick={async () => {
                const h = await aksi(() => tetapkanTarget(db, { periode: p.periode, kategoriGenerus: p.kategori, materiIds: daftar }))
                if (h) {
                  setIds(h.map((t) => t.materi_id))
                  toast('sukses', `Target ${LABEL_KATEGORI[p.kategori]} ${p.periode} disimpan (${h.length} materi).`)
                }
              }}
            >
              Simpan target
            </Tombol>
          </>
        }
      >
        <KeadaanData hasil={semuaMateri}>
          {(peta) =>
            daftar.length === 0 ? (
              <Kosong teks="Belum ada materi target. Tambahkan dari daftar materi di bawah, atau salin dari periode lain." />
            ) : (
              <table className="tabel" aria-label="Daftar target">
                <thead>
                  <tr>
                    <th>Urutan</th>
                    <th>Materi</th>
                    <th>Bidang · Kategori</th>
                    <th aria-label="Aksi" />
                  </tr>
                </thead>
                <tbody>
                  {daftar.map((id, i) => {
                    const m = peta.get(id)
                    return (
                      <tr key={id}>
                        <td>{i + 1}</td>
                        <td>{m?.nama ?? id}</td>
                        <td>{m ? `${m.bidang_nama} · ${m.kategori_nama}` : 'Materi tidak ditemukan'}</td>
                        <td className="sel-aksi">
                          <Tombol kecil varian="tipis" judul="Naikkan" disabled={i === 0} onClick={() => geser(i, -1)}>
                            ↑ Naik
                          </Tombol>
                          <Tombol kecil varian="tipis" judul="Turunkan" disabled={i === daftar.length - 1} onClick={() => geser(i, 1)}>
                            ↓ Turun
                          </Tombol>
                          <Tombol kecil varian="tipis" onClick={() => setIds(daftar.filter((x) => x !== id))}>
                            Buang
                          </Tombol>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          }
        </KeadaanData>
        <div className="filter">
          <Pilihan
            label="Salin dari periode"
            nilai={sumber}
            ubah={setSumber}
            kosong="— pilih periode —"
            pilihan={p.daftarPeriode.filter((x) => x !== p.periode).map((x) => ({ nilai: x, teks: labelPeriode(x) }))}
          />
          <div className="aksi-filter">
            <Tombol
              varian="kedua"
              disabled={!sumber}
              onClick={() => {
                const salin = daftarTarget(db, { periode: sumber, kategoriGenerus: p.kategori }).map((m) => m.id)
                if (!salin.length) return toast('info', `Periode ${sumber} belum punya target ${LABEL_KATEGORI[p.kategori]}.`)
                setIds(salin)
                toast('info', `${salin.length} materi disalin dari ${sumber}. Tekan “Simpan target”.`)
              }}
            >
              Salin
            </Tombol>
          </div>
        </div>
      </Kartu>
      <PilihMateri kategori={p.kategori} sudah={daftar} tambah={tambah} />
    </>
  )
}

function PilihMateri(p: { kategori: KategoriGenerus; sudah: string[]; tambah: (ids: string[]) => void }) {
  const { db } = useApp()
  const bidang = useData(() => daftarBidang(db), [db])
  const [bidangId, setBidangId] = useState('')
  const [kategoriId, setKategoriId] = useState('')
  const kategori = useData(() => (bidangId ? daftarKategoriMateri(db, bidangId) : []), [db, bidangId])
  const materi = useData(() => (kategoriId ? daftarMateri(db, { kategoriId, kategoriGenerus: p.kategori }) : []), [db, kategoriId, p.kategori])
  useEffect(() => {
    if (!bidangId && bidang.data?.[0]) setBidangId(bidang.data[0].id)
  }, [bidang.data, bidangId])
  useEffect(() => {
    const ks = kategori.data ?? []
    if (!ks.some((k) => k.id === kategoriId)) setKategoriId(ks[0]?.id ?? '')
  }, [kategori.data, kategoriId])
  return (
    <Kartu judul="Tambah materi ke target">
      <KeadaanData hasil={bidang} kosong={(d) => d.length === 0} teksKosong="Belum ada materi. Buka berkas materi dari daerah terlebih dahulu.">
        {(daftarB) => (
          <>
            <div className="filter">
              <Pilihan label="Bidang materi" nilai={bidangId} ubah={setBidangId} pilihan={daftarB.map((b) => ({ nilai: b.id, teks: b.nama }))} />
              <Pilihan
                label="Kategori materi"
                nilai={kategoriId}
                ubah={setKategoriId}
                pilihan={(kategori.data ?? []).map((k) => ({ nilai: k.id, teks: `${k.kode} — ${k.nama}` }))}
              />
              <div className="aksi-filter">
                <Tombol
                  varian="kedua"
                  disabled={!materi.data?.some((m) => !p.sudah.includes(m.id))}
                  onClick={() => p.tambah((materi.data ?? []).map((m) => m.id))}
                >
                  Tambah semua di kategori ini
                </Tombol>
              </div>
            </div>
            <KeadaanData hasil={materi} kosong={(d) => d.length === 0} teksKosong="Tidak ada materi untuk kategori generus ini di kategori materi tersebut.">
              {(daftarM) => (
                <div className="gulir gulir-pendek">
                  <table className="tabel tabel-ringkas" aria-label="Materi tersedia">
                    <thead>
                      <tr>
                        <th>No</th>
                        <th>Materi</th>
                        <th aria-label="Aksi" />
                      </tr>
                    </thead>
                    <tbody>
                      {daftarM.map((m) => (
                        <tr key={m.id}>
                          <td>{m.nomor}</td>
                          <td>{m.nama}</td>
                          <td className="sel-aksi">
                            {p.sudah.includes(m.id) ? (
                              <Lencana warna="hijau">Sudah di target</Lencana>
                            ) : (
                              <Tombol kecil varian="tipis" onClick={() => p.tambah([m.id])}>
                                + Tambah
                              </Tombol>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </KeadaanData>
          </>
        )}
      </KeadaanData>
    </Kartu>
  )
}
