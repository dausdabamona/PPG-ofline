// Layar 8: Impor Setoran (SETOR dari bawah; di daerah juga KURIKULUM) dan Buka Paket (PAKET/MATERI dari atas) —
// pilih banyak berkas → ringkasan per berkas; riwayat impor. Core mengarahkan tiap berkas sesuai jenisnya.
import { useState } from 'react'
import {
  daftarRiwayatImpor,
  imporBanyak,
  type HasilImporBanyak,
  type RingkasanImporKurikulum,
  type RingkasanImporSetor,
  type RingkasanTerapkan,
} from '@ppg/core'
import { useApp, useData, type PeranExe } from '../konteks'
import { teksMenu } from '../menu'
import { KeadaanData, Kartu, KepalaHalaman, Lencana, Memuat, Tombol } from '../komponen/ui'
import { LABEL_TABEL, label, waktuLokal } from '../utils/label'

function keteranganMode(mode: 'setor' | 'paket', peran: PeranExe): string {
  if (mode === 'paket') {
    if (peran === 'kurikulum') return 'Pilih berkas PPG_MATERI_….ppg dari Admin Daerah agar materi dasar tersedia sebelum menyusun target.'
    if (peran === 'kelompok') return 'Pilih berkas PPG_PAKET_….ppg dari desa (berkas materi daerah sudah ikut di dalamnya; boleh banyak sekaligus).'
    return 'Pilih berkas PPG_PAKET_….ppg dan PPG_MATERI_….ppg dari daerah (boleh banyak sekaligus).'
  }
  if (peran === 'daerah') return 'Pilih berkas PPG_SETOR_….ppg dari desa/pengurus/mubaligh, atau PPG_KURIKULUM_….ppg dari tim kurikulum (boleh banyak sekaligus).'
  if (peran === 'desa') return 'Pilih berkas PPG_SETOR_….ppg dari HP pengurus/mubaligh dan EXE kelompok di desa ini (boleh banyak sekaligus).'
  return 'Pilih berkas PPG_SETOR_….ppg dari HP mubaligh/pengurus kelompok ini (boleh banyak sekaligus).'
}

export function HalamanImpor(p: { mode: 'setor' | 'paket' }) {
  const { db, kunci, peran, platform, toast, aksi } = useApp()
  const [hasil, setHasil] = useState<HasilImporBanyak[] | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const riwayat = useData(() => daftarRiwayatImpor(db, 50), [db])

  const pilih = async () => {
    const berkas = await aksi(() => platform.bukaBanyak([{ nama: 'Berkas PPG', ekstensi: ['ppg'] }, { nama: 'Semua berkas', ekstensi: ['*'] }], true))
    if (!berkas || berkas.length === 0) return
    setSibuk(true)
    // beri kesempatan UI menampilkan status memuat sebelum kerja sinkron
    await new Promise((r) => setTimeout(r, 0))
    try {
      const h = imporBanyak(db, berkas, kunci)
      setHasil(h)
      const ok = h.filter((x) => x.berhasil).length
      toast(ok === h.length ? 'sukses' : 'info', `${ok} dari ${h.length} berkas berhasil ${p.mode === 'paket' ? 'dibuka' : 'diimpor'}.`)
    } finally {
      setSibuk(false)
    }
  }

  return (
    <>
      <KepalaHalaman
        judul={teksMenu(p.mode === 'paket' ? 'bukaPaket' : 'impor', peran)}
        keterangan={keteranganMode(p.mode, peran)}
        aksi={
          <Tombol onClick={pilih} sibuk={sibuk}>
            {p.mode === 'paket' ? (peran === 'kurikulum' ? 'Pilih berkas materi' : 'Pilih berkas paket') : 'Pilih berkas setoran'}
          </Tombol>
        }
      />
      {sibuk ? (
        <Kartu>
          <Memuat teks={p.mode === 'paket' ? 'Membuka berkas…' : 'Mengimpor setoran…'} />
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
  const x = r as { pengirim?: string[] | string } | null
  if (typeof x?.pengirim === 'string') return x.pengirim
  return x?.pengirim?.length ? x.pengirim.join(', ') : null
}

const NAMA_JENIS: Record<string, string> = { PAKET: 'Paket', MATERI: 'Berkas materi', BALASAN: 'Balasan', JADWAL: 'Jadwal', KURIKULUM: 'Kurikulum' }

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
  if (h.jenis !== 'SETOR') return <RingkasanLain h={h} />
  const r = h.ringkasan as RingkasanImporSetor
  const tabel = Object.entries(r.perTabel ?? {}).filter(([, v]) => v && v.ditambah + v.diperbarui + v.diabaikan + v.bentrok > 0)
  return (
    <div className="ringkasan-berkas">
      <div className="kepala-ringkasan">
        <strong>{h.nama ?? 'Berkas'}</strong>
        {r.sudahPernah ? <Lencana warna="abu">Sudah pernah diimpor</Lencana> : <Lencana warna="hijau">Berhasil</Lencana>}
        {r.setorAkhir ? <Lencana warna="kuning">Setor Akhir</Lencana> : null}
        {r.gabungan ? <Lencana warna="teal">Setoran gabungan</Lencana> : null}
      </div>
      <p>
        Pengirim: <strong>{r.pengirim.join(', ') || r.pengirimPerangkatId}</strong> · urut {r.urut} · {r.total.ditambah} ditambah, {r.total.diperbarui}{' '}
        diperbarui, {r.total.diabaikan} diabaikan, {r.total.bentrok} bentrok · {r.usulanBaru} usulan baru · {r.tokenDilaporkan} token dilaporkan
        {r.gabungan ? ` · ${r.perangkatBawah} perangkat di bawahnya` : ''}
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

/** Ringkasan PAKET / MATERI / KURIKULUM (dan berkas lain yang diterapkan). */
function RingkasanLain(p: { h: HasilImporBanyak }) {
  const { h } = p
  const r = h.ringkasan as Partial<Omit<RingkasanTerapkan, 'jenis'> & Omit<RingkasanImporKurikulum, 'jenis'>>
  const t = r.total
  return (
    <div className="ringkasan-berkas">
      <div className="kepala-ringkasan">
        <strong>{h.nama ?? 'Berkas'}</strong>
        <Lencana warna="teal">{NAMA_JENIS[h.jenis ?? ''] ?? h.jenis}</Lencana>
        {r.sudahPernah ? <Lencana warna="abu">Sudah pernah diimpor</Lencana> : <Lencana warna="hijau">Berhasil</Lencana>}
      </div>
      <p>
        {h.jenis === 'KURIKULUM' ? (
          <>
            Dari <strong>{r.pengirim}</strong> ·{' '}
          </>
        ) : r.versi ? (
          <>Versi {r.versi} · </>
        ) : null}
        {t ? `${t.ditambah} ditambah, ${t.diperbarui} diperbarui, ${t.diabaikan} diabaikan` : null}
        {r.pencabutanBaru ? ` · ${r.pencabutanBaru} pencabutan baru` : ''}
      </p>
    </div>
  )
}
