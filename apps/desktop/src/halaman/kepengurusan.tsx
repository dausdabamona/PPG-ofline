// §17 — EXE: Kepengurusan PPG per jabatan — daftar pengurus berjabatan, ringkasan ketua, keuangan (daerah), reward,
// kontrol MT, tahfidz, catatan per bidang (konseling hanya jumlah), dan ganti kunci bidang rahasia.
import { useState } from 'react'
import {
  ambilWilayah,
  daftarCatatan,
  daftarPerangkat,
  gantiKunciBidang,
  gantiKunciBidangSemua,
  penugasanToken,
  strukturKepengurusan,
  versiKunciBidang,
  type BidangRahasia,
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
import { PilihWilayah } from '../komponen/wilayah'

const rp = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `Rp${n.toLocaleString('id-ID')}`)
const pr = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${String(n).replace('.', ',')}%`)

export function HalamanKepengurusan() {
  const [tab, setTab] = useState<'ringkasan' | 'struktur'>('ringkasan')
  return (
    <>
      <KepalaHalaman
        judul="Kepengurusan"
        keterangan="Struktur & Proker PPG: pengurus per jabatan/bidang di daerah, desa, dan kelompok (perwakilan daerah). Terbitkan token berpenugasan di Perangkat & Token (Untuk: Pengurus → Penugasan jabatan)."
      />
      <div className="aksi-baris tab-halaman" role="tablist">
        <Tombol varian={tab === 'ringkasan' ? 'utama' : 'kedua'} onClick={() => setTab('ringkasan')}>
          Ringkasan & Bidang
        </Tombol>
        <Tombol varian={tab === 'struktur' ? 'utama' : 'kedua'} onClick={() => setTab('struktur')}>
          Struktur & Kursi Kosong
        </Tombol>
      </div>
      {tab === 'struktur' ? <StrukturKursi /> : <RingkasanKepengurusan />}
    </>
  )
}

/** §21.1: tabel wilayah × jabatan; kursi kosong merah "Perlu ditunjuk"; pemegang rangkapan diberi tanda perwakilan. */
function StrukturKursi() {
  const { db, wilayahId } = useApp()
  const [kosongSaja, setKosongSaja] = useState(false)
  const s = useData(() => strukturKepengurusan(db, wilayahId ?? undefined), [db, wilayahId])
  return (
    <Kartu judul="Struktur & Kursi Kosong">
      <p className="keterangan">
        Ketua, Wakil, Sekretaris, Bendahara, dan Kurikulum hanya di daerah; di desa & kelompok sekretariat dipegang PJ Desa/PJ Kelompok. Bidang lain ada di semua tingkat sebagai
        perwakilan daerah. Rangkap jabatan boleh — kursi yang tidak dirangkap perlu ditunjuk orangnya.
      </p>
      <label className="centang">
        <input type="checkbox" checked={kosongSaja} onChange={(e) => setKosongSaja(e.target.checked)} /> Tampilkan kursi kosong saja
      </label>
      <KeadaanData hasil={s} kosong={(x) => !x.wilayah.length} teksKosong="Wilayah belum ada.">
        {(x) => (
          <>
            <p>
              <Lencana warna={x.kosong ? 'merah' : 'hijau'}>{x.kosong} kursi perlu ditunjuk</Lencana> dari {x.kursi.length} kursi.
            </p>
            {x.wilayah.map((w) => {
              const kursi = x.kursi.filter((k) => k.wilayah_id === w.id && (!kosongSaja || k.kosong))
              if (!kursi.length) return null
              const induk = w.induk_id ? ambilWilayah(db, w.induk_id)?.nama : null
              return (
                <div key={w.id} className="blok-struktur">
                  <h3>
                    {w.tingkat === 'daerah' ? 'Daerah' : w.tingkat === 'desa' ? 'Desa' : 'Kelompok'} {w.nama}
                    {induk && w.tingkat === 'kelompok' ? <small> · Desa {induk}</small> : null}
                  </h3>
                  <table className="tabel" aria-label={`Struktur ${w.nama}`}>
                    <thead>
                      <tr>
                        <th>Jabatan</th>
                        <th>Pemegang</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kursi.map((k) => (
                        <tr key={k.jabatan} className={k.kosong ? 'kursi-kosong' : undefined}>
                          <td>{k.label}</td>
                          <td>
                            {k.kosong ? (
                              <Lencana warna="merah">Perlu ditunjuk</Lencana>
                            ) : (
                              k.pemegang.map((h) => (
                                <span key={h.token_id} className="pemegang">
                                  {h.nama} {h.perwakilan ? <Lencana warna="teal">perwakilan {h.perwakilan}</Lencana> : null}
                                </span>
                              ))
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </>
        )}
      </KeadaanData>
    </Kartu>
  )
}

/** §21.2: ganti kunci bidang rahasia per wilayah (mis. BK Kelompok Remu diganti → hanya kunci konseling Remu). */
function KunciBidangWilayah() {
  const { db, kunci, aksi } = useApp()
  const [bidang, setBidang] = useState<BidangRahasia>('konseling')
  const [wilayah, setWilayah] = useState('')
  const versi = useData(() => versiKunciBidang(db), [db])
  return (
    <Kartu judul="Kunci bidang rahasia (per wilayah)">
      <p className="keterangan">
        Ganti kunci bila pemegang BK/penggalang dana/bendahara/ketua di wilayah itu dicabut atau diganti. Kunci baru turun lewat Kirim Paket ke pemegang penugasan pembaca yang masih
        aktif; catatan lama tetap terbaca oleh pemegang lama yang sah. BK wilayah W hanya memegang kunci konseling W; pembaca keuangan daerah memegang kunci keuangan semua wilayah.
      </p>
      <div className="formulir dua-kolom">
        <Pilihan label="Bidang" nilai={bidang} ubah={(v) => setBidang(v as BidangRahasia)} pilihan={[{ nilai: 'konseling', teks: 'Konseling (BK)' }, { nilai: 'keuangan', teks: 'Keuangan' }]} />
        <PilihWilayah db={db} label="Wilayah" nilai={wilayah} ubah={setWilayah} kosong="— pilih wilayah —" />
      </div>
      <div className="aksi-baris">
        <Tombol varian="kedua" disabled={!wilayah} onClick={() => aksi(() => gantiKunciBidang(db, kunci as KunciAdmin, bidang, wilayah), (v) => `Kunci ${bidang} ${ambilWilayah(db, wilayah)?.nama ?? ''} versi ${v}.`)}>
          Ganti kunci wilayah ini
        </Tombol>
        <Tombol varian="kedua" onClick={() => aksi(() => gantiKunciBidangSemua(db, kunci as KunciAdmin, bidang), (n) => `Kunci ${bidang} ${n} wilayah diganti.`)}>
          Ganti kunci semua wilayah
        </Tombol>
      </div>
      <KeadaanData hasil={versi} kosong={(d) => !d.length} teksKosong="Kunci bidang dibuat otomatis saat token jabatan/paket pertama.">
        {(d) => (
          <details>
            <summary>Versi kunci per wilayah ({d.length})</summary>
            <table className="tabel" aria-label="Versi kunci bidang">
              <thead>
                <tr>
                  <th>Wilayah</th>
                  <th>Bidang</th>
                  <th>Versi</th>
                </tr>
              </thead>
              <tbody>
                {d.map((k) => (
                  <tr key={`${k.bidang}-${k.wilayah_id}`}>
                    <td>{ambilWilayah(db, k.wilayah_id)?.nama ?? 'Daerah (kunci lama)'}</td>
                    <td>{k.bidang}</td>
                    <td>{k.versi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </KeadaanData>
    </Kartu>
  )
}

function RingkasanKepengurusan() {
  const { db, peran, wilayahId, kunci } = useApp()
  const daerah = peran === 'daerah'
  const kunciAdmin = daerah ? (kunci as KunciAdmin) : undefined
  const wilayah = wilayahId ?? ''
  const [bulan, setBulan] = useState(tanggalHariIni().slice(0, 7))
  const pengurus = useData(
    () =>
      daftarPerangkat(db, { role: 'pengurus' })
        .map((p) => ({ ...p, penugasan: penugasanToken(p.token), status: statusPerangkat(p) }))
        .filter((p) => p.penugasan.length),
    [db],
  )
  const ketua = useData(() => (wilayah ? ringkasanKetua(db, { wilayahId: wilayah, bulan, kunciAdmin }) : null), [db, wilayah, bulan])
  const kas = useData(() => (daerah ? ringkasanKas(db, { bulan, kunciAdmin }) : null), [db, bulan])
  const ingat = useData(() => (wilayah ? pengingatLaporan(db, wilayah) : null), [db, wilayah]).data
  return (
    <>
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
                    <td>{p.penugasan.map((x) => `${LABEL_JABATAN[x.jabatan]} · ${ambilWilayah(db, x.wilayah_id)?.nama ?? '—'}`).join('; ')}</td>
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
                <dt>Kasus & rujukan BK (se-daerah)</dt>
                <dd>
                  Catatan konseling {x.kasusBk.bulanIni} bulan ini · {x.kasusBk.total} total · Rujukan {x.kasusBk.rujukanBulanIni} bulan ini · {x.kasusBk.rujukanBelumDitanggapi} belum
                  ditanggapi · {x.kasusBk.rujukanTotal} total (isi hanya untuk BK; tidak dirinci per wilayah)
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
      {daerah ? <KunciBidangWilayah /> : null}
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
