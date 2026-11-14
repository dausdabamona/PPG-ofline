// Layar 8: Impor Setoran — pilih banyak berkas SETOR → ringkasan per berkas; riwayat impor.
import { useState } from 'react'
import { daftarRiwayatImpor, imporBanyak, type HasilImporBanyak, type RingkasanImporSetor } from '@ppg/core'
import { useApp, useData } from '../konteks'
import { KeadaanData, Kartu, KepalaHalaman, Lencana, Memuat, Tombol } from '../komponen/ui'
import { LABEL_TABEL, label, waktuLokal } from '../utils/label'

export function HalamanImpor() {
  const { db, kunci, platform, toast, aksi } = useApp()
  const [hasil, setHasil] = useState<HasilImporBanyak[] | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const riwayat = useData(() => daftarRiwayatImpor(db, 50), [db])

  const pilih = async () => {
    const berkas = await aksi(() => platform.bukaBanyak([{ nama: 'Berkas setoran PPG', ekstensi: ['ppg'] }], true))
    if (!berkas || berkas.length === 0) return
    setSibuk(true)
    // beri kesempatan UI menampilkan status memuat sebelum kerja sinkron
    await new Promise((r) => setTimeout(r, 0))
    try {
      const h = imporBanyak(db, berkas, kunci)
      setHasil(h)
      const ok = h.filter((x) => x.berhasil).length
      toast(ok === h.length ? 'sukses' : 'info', `${ok} dari ${h.length} berkas setoran berhasil diimpor.`)
    } finally {
      setSibuk(false)
    }
  }

  return (
    <>
      <KepalaHalaman
        judul="Impor Setoran"
        keterangan="Pilih berkas PPG_SETOR_….ppg yang dikirim pengurus/mubaligh lewat WA (boleh banyak sekaligus)."
        aksi={
          <Tombol onClick={pilih} sibuk={sibuk}>
            Pilih berkas setoran
          </Tombol>
        }
      />
      {sibuk ? (
        <Kartu>
          <Memuat teks="Mengimpor setoran…" />
        </Kartu>
      ) : null}
      {hasil ? (
        <Kartu judul="Ringkasan impor">
          {hasil.map((h, i) => (
            <RingkasanBerkas key={`${h.nama}-${i}`} h={h} />
          ))}
        </Kartu>
      ) : null}
      <Kartu judul="Riwayat impor">
        <KeadaanData hasil={riwayat} kosong={(d) => d.length === 0} teksKosong="Belum ada berkas yang diimpor.">
          {(daftar) => (
            <table className="tabel">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Jenis</th>
                  <th>Berkas</th>
                  <th>Pengirim</th>
                </tr>
              </thead>
              <tbody>
                {daftar.map((r) => (
                  <tr key={r.id}>
                    <td>{waktuLokal(r.tanggal)}</td>
                    <td>{r.jenis}</td>
                    <td>{r.nama_berkas ?? '—'}</td>
                    <td>{namaPengirim(r.ringkasan) ?? r.pengirim}</td>
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

function namaPengirim(r: unknown): string | null {
  const x = r as Partial<RingkasanImporSetor> | null
  return x?.pengirim?.length ? x.pengirim.join(', ') : null
}

function RingkasanBerkas(p: { h: HasilImporBanyak }) {
  const { h } = p
  if (!h.berhasil) {
    return (
      <div className="ringkasan-berkas gagal">
        <div className="kepala-ringkasan">
          <strong>{h.nama ?? 'Berkas'}</strong>
          <Lencana warna="merah">Gagal</Lencana>
        </div>
        <p>{h.galat?.pesan}</p>
      </div>
    )
  }
  const r = h.ringkasan as RingkasanImporSetor
  const tabel = Object.entries(r.perTabel ?? {}).filter(([, v]) => v && v.ditambah + v.diperbarui + v.diabaikan + v.bentrok > 0)
  return (
    <div className="ringkasan-berkas">
      <div className="kepala-ringkasan">
        <strong>{h.nama ?? 'Berkas'}</strong>
        {r.sudahPernah ? <Lencana warna="abu">Sudah pernah diimpor</Lencana> : <Lencana warna="hijau">Berhasil</Lencana>}
        {r.setorAkhir ? <Lencana warna="kuning">Setor Akhir</Lencana> : null}
      </div>
      <p>
        Pengirim: <strong>{r.pengirim.join(', ') || r.pengirimPerangkatId}</strong> · urut {r.urut} · {r.total.ditambah} ditambah, {r.total.diperbarui}{' '}
        diperbarui, {r.total.diabaikan} diabaikan, {r.total.bentrok} bentrok · {r.usulanBaru} usulan baru · {r.tokenDilaporkan} token dilaporkan
      </p>
      {tabel.length ? (
        <table className="tabel tabel-ringkas">
          <thead>
            <tr>
              <th>Data</th>
              <th>Ditambah</th>
              <th>Diperbarui</th>
              <th>Diabaikan</th>
              <th>Bentrok</th>
            </tr>
          </thead>
          <tbody>
            {tabel.map(([t, v]) => (
              <tr key={t}>
                <td>{label(LABEL_TABEL, t)}</td>
                <td>{v!.ditambah}</td>
                <td>{v!.diperbarui}</td>
                <td>{v!.diabaikan}</td>
                <td>{v!.bentrok}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {r.ditolak.length ? (
        <details>
          <summary>{r.ditolak.length} rekaman ditolak</summary>
          <ul>
            {r.ditolak.map((d, i) => (
              <li key={`${d.id}-${i}`}>
                {d.tabel ? `${label(LABEL_TABEL, d.tabel)}: ` : ''}
                {d.alasan}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
