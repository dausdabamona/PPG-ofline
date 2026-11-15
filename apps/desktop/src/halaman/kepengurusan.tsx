// §17 — EXE: Kepengurusan PPG per jabatan — daftar pengurus berjabatan, ringkasan ketua, keuangan (daerah), reward,
// kontrol MT, tahfidz, catatan per bidang (konseling hanya jumlah), dan ganti kunci bidang rahasia.
import { useState } from 'react'
import {
  daftarCatatan,
  daftarPerangkat,
  gantiKunciBidang,
  jabatanToken,
  JENIS_CATATAN,
  KATEGORI_GENERUS,
  LABEL_JABATAN,
  LABEL_JENJANG,
  pengingatLaporan,
  rekapKontrolMt,
  rekapTahfidz,
  rewardHasilBelajar,
  ringkasanKas,
  ringkasanKetua,
  statusPerangkat,
  tanggalHariIni,
  type JenisCatatan,
  type KategoriGenerus,
  type KunciAdmin,
} from '@ppg/core'
import { useApp, useData } from '../konteks'
import { Isian, KeadaanData, Kartu, KepalaHalaman, Kosong, Lencana, Pilihan, Tombol } from '../komponen/ui'

const rp = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `Rp${n.toLocaleString('id-ID')}`)
const pr = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${String(n).replace('.', ',')}%`)

export function HalamanKepengurusan() {
  const { db, peran, wilayahId, kunci, aksi } = useApp()
  const daerah = peran === 'daerah'
  const kunciAdmin = daerah ? (kunci as KunciAdmin) : undefined
  const wilayah = wilayahId ?? ''
  const [bulan, setBulan] = useState(tanggalHariIni().slice(0, 7))
  const pengurus = useData(
    () =>
      daftarPerangkat(db, { role: 'pengurus' })
        .map((p) => ({ ...p, jabatan: jabatanToken(p.token), status: statusPerangkat(p) }))
        .filter((p) => p.jabatan.length),
    [db],
  )
  const ketua = useData(() => (wilayah ? ringkasanKetua(db, { wilayahId: wilayah, bulan, kunciAdmin }) : null), [db, wilayah, bulan])
  const kas = useData(() => (daerah ? ringkasanKas(db, { bulan, kunciAdmin }) : null), [db, bulan])
  const ingat = useData(() => (wilayah ? pengingatLaporan(db, wilayah) : null), [db, wilayah]).data
  return (
    <>
      <KepalaHalaman
        judul="Kepengurusan"
        keterangan="Struktur & Proker PPG Daerah: pengurus per jabatan/bidang. Terbitkan token berjabatan di Perangkat & Token (Untuk: Pengurus → centang jabatan)."
      />
      {ingat ? (
        <Kartu>
          <p>
            <Lencana warna="kuning">Pengingat</Lencana> {ingat.pesan} {ingat.kelompok.map((k) => k.nama).join(', ')}
          </p>
        </Kartu>
      ) : null}
      <Kartu judul="Pengurus berjabatan">
        <KeadaanData hasil={pengurus} kosong={(d) => d.length === 0} teksKosong="Belum ada token pengurus berjabatan.">
          {(d) => (
            <table className="tabel" aria-label="Pengurus berjabatan">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Jabatan</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {d.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nama}</td>
                    <td>{p.jabatan.map((j) => LABEL_JABATAN[j]).join(', ')}</td>
                    <td>
                      <Lencana warna={p.status === 'aktif' ? 'hijau' : 'merah'}>{p.status}</Lencana>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </KeadaanData>
      </Kartu>
      <Kartu judul="Ringkasan bidang">
        <div className="filter">
          <Isian label="Bulan" type="month" nilai={bulan} ubah={(v) => v && setBulan(v)} />
        </div>
        <KeadaanData hasil={ketua}>
          {(x) =>
            x ? (
              <dl className="rincian">
                <dt>Musyawarah rutin</dt>
                <dd>{x.musyawarah.teks}</dd>
                <dt>Rata-rata keaktifan</dt>
                <dd>{pr(x.keaktifanRata)}</dd>
                <dt>Kelompok belum lapor</dt>
                <dd>{x.kelompokBelumLapor}</dd>
                <dt>NUNGGONI</dt>
                <dd>
                  {x.nunggoni.laporan} (laporan kelompok) + {x.nunggoni.mandiri} (catatan pengurus/mubaligh)
                </dd>
                <dt>Kasus BK</dt>
                <dd>
                  {x.kasusBk.bulanIni} bulan ini · {x.kasusBk.total} total (isi hanya untuk bidang BK)
                </dd>
                <dt>Catatan bidang</dt>
                <dd>
                  {Object.entries(x.jumlahPerJenis)
                    .map(([j, n]) => `${JENIS_CATATAN[j]?.nama ?? j}: ${n}`)
                    .join(' · ') || '—'}
                </dd>
              </dl>
            ) : (
              <Kosong teks="Wilayah belum ada." />
            )
          }
        </KeadaanData>
      </Kartu>
      {daerah ? (
        <KeadaanData hasil={kas}>
          {(k) =>
            k ? (
              <Kartu judul="Keuangan PPG Daerah">
                <p>
                  Pemasukan {rp(k.masuk)} · Pengeluaran {rp(k.keluar)} · <b>Saldo {rp(k.saldo)}</b>
                  {k.danaMenunggu.length ? ` · ${k.danaMenunggu.length} dana masuk menunggu konfirmasi bendahara` : ''}
                </p>
                {k.tabungan.length ? (
                  <table className="tabel" aria-label="Tabungan desa">
                    <thead>
                      <tr>
                        <th>Desa</th>
                        <th>Peruntukan</th>
                        <th>Target/bulan</th>
                        <th>Disetor bulan ini</th>
                      </tr>
                    </thead>
                    <tbody>
                      {k.tabungan.map((t) => (
                        <tr key={`${t.desa_id}-${t.peruntukan}`}>
                          <td>{t.desa}</td>
                          <td>{t.peruntukan.replace(/_/g, ' ')}</td>
                          <td>{rp(t.target)}</td>
                          <td>{rp(t.disetor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="keterangan">Target tabungan desa diisi bendahara di HP.</p>
                )}
              </Kartu>
            ) : null
          }
        </KeadaanData>
      ) : null}
      {daerah && wilayah ? <KartuReward wilayahId={wilayah} /> : null}
      <KartuKontrolMt bulan={bulan} />
      <KartuTahfidz />
      <KartuCatatan />
      {daerah ? (
        <Kartu judul="Kunci bidang rahasia">
          <p className="keterangan">Ganti kunci bila bendahara/BK/penggalang dana/ketua lama dicabut. Kunci baru turun lewat Kirim Paket (paket seluruh daerah) ke pemegang jabatan pembaca yang masih aktif.</p>
          <div className="aksi-baris">
            <Tombol varian="kedua" onClick={() => aksi(() => gantiKunciBidang(db, kunci as KunciAdmin, 'keuangan'), (v) => `Kunci keuangan versi ${v}.`)}>
              Ganti kunci keuangan
            </Tombol>
            <Tombol varian="kedua" onClick={() => aksi(() => gantiKunciBidang(db, kunci as KunciAdmin, 'konseling'), (v) => `Kunci konseling versi ${v}.`)}>
              Ganti kunci konseling
            </Tombol>
          </div>
        </Kartu>
      ) : null}
    </>
  )
}

function KartuReward(p: { wilayahId: string }) {
  const { db } = useApp()
  const [jenjang, setJenjang] = useState<KategoriGenerus>('praremaja')
  const r = useData(() => rewardHasilBelajar(db, { wilayahId: p.wilayahId, jenjang }), [db, jenjang])
  return (
    <Kartu judul="Reward hasil belajar terbaik (Bidang Kurikulum)">
      <Pilihan label="Jenjang" nilai={jenjang} ubah={(v) => setJenjang(v as KategoriGenerus)} pilihan={KATEGORI_GENERUS.map((k) => ({ nilai: k, teks: LABEL_JENJANG[k]! }))} />
      <KeadaanData hasil={r} kosong={(d) => d.daerah.length === 0} teksKosong="Belum ada generus berjenjang ini.">
        {(x) => (
          <table className="tabel" aria-label="Santri terbaik">
            <thead>
              <tr>
                <th>Peringkat</th>
                <th>Santri</th>
                <th>Kelompok / Desa</th>
                <th>Keaktifan</th>
                <th>Penguasaan</th>
                <th>Skor</th>
              </tr>
            </thead>
            <tbody>
              {x.daerah.map((s, i) => (
                <tr key={s.generus_id}>
                  <td>{i + 1}</td>
                  <td>{s.nama}</td>
                  <td>
                    {s.kelompok} / {s.desa}
                  </td>
                  <td>{pr(s.keaktifan)}</td>
                  <td>{pr(s.penguasaan)}</td>
                  <td>
                    <b>{pr(s.skor)}</b>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={6}>
                  Kelompok terbaik: {x.kelompokTerbaik.slice(0, 3).map((k) => `${k.nama} (${pr(k.skor)})`).join(', ') || '—'} · Desa terbaik:{' '}
                  {x.desaTerbaik.slice(0, 3).map((d) => `${d.nama} (${pr(d.skor)})`).join(', ') || '—'}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </KeadaanData>
    </Kartu>
  )
}

function KartuKontrolMt(p: { bulan: string }) {
  const { db } = useApp()
  const r = useData(() => rekapKontrolMt(db, p.bulan), [db, p.bulan])
  return (
    <Kartu judul="Kontrol Keaktifan & Keteladanan MT">
      <KeadaanData hasil={r} kosong={(d) => d.length === 0} teksKosong="Belum ada lembar kontrol MT bulan ini.">
        {(d) => (
          <table className="tabel" aria-label="Kontrol MT">
            <thead>
              <tr>
                <th>MT</th>
                <th>Kelompok</th>
                <th>Hari</th>
                <th>Subuh</th>
                <th>Tahajud</th>
                <th>Dhuha</th>
                <th>Kolom hafalan</th>
                <th>Tadarus</th>
              </tr>
            </thead>
            <tbody>
              {d.map((m) => (
                <tr key={m.catatan_id}>
                  <td>{m.nama}</td>
                  <td>{m.kelompok}</td>
                  <td>{m.hariTerisi}</td>
                  <td>{m.subuh}</td>
                  <td>{m.tahajud}</td>
                  <td>{m.dhuha}</td>
                  <td>{m.hafalan}</td>
                  <td>{m.tadarus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </KeadaanData>
    </Kartu>
  )
}

function KartuTahfidz() {
  const { db } = useApp()
  const r = useData(() => rekapTahfidz(db), [db])
  return (
    <Kartu judul="Tahfidz Qur'an — peringkat poin">
      <KeadaanData hasil={r} kosong={(d) => d.length === 0} teksKosong="Belum ada ujian tahfidz.">
        {(d) => (
          <ol>
            {d.slice(0, 20).map((t) => (
              <li key={t.generus_id}>
                {t.nama} ({t.kelompok}) — {t.poin} poin, {t.surat} surat
              </li>
            ))}
          </ol>
        )}
      </KeadaanData>
    </Kartu>
  )
}

const JENIS_TAMPIL = (Object.keys(JENIS_CATATAN) as JenisCatatan[]).filter((j) => !JENIS_CATATAN[j]!.rahasia && j !== 'kontrol_mt')

function KartuCatatan() {
  const { db } = useApp()
  const [jenis, setJenis] = useState<JenisCatatan>('notulen')
  const r = useData(() => daftarCatatan(db, { jenis }), [db, jenis])
  return (
    <Kartu judul="Catatan bidang">
      <Pilihan label="Jenis" nilai={jenis} ubah={(v) => setJenis(v as JenisCatatan)} pilihan={JENIS_TAMPIL.map((j) => ({ nilai: j, teks: JENIS_CATATAN[j]!.nama }))} />
      <KeadaanData hasil={r} kosong={(d) => d.length === 0} teksKosong="Belum ada catatan (diisi HP pengurus bidangnya, ikut setoran).">
        {(d) => (
          <div className="gulir">
            <table className="tabel" aria-label="Catatan bidang">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Isi</th>
                </tr>
              </thead>
              <tbody>
                {d.map((c) => (
                  <tr key={c.id}>
                    <td>{c.tanggal}</td>
                    <td>
                      <small>
                        {Object.entries(c.isi ?? {})
                          .map(([k, v]) => `${k}: ${Array.isArray(v) ? `${v.length} item` : String(v)}`)
                          .join(' · ')}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </KeadaanData>
    </Kartu>
  )
}
