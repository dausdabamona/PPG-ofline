// §16 — EXE: Evaluasi & Keaktifan (Rekap Penguasaan Materi, keaktifan bulanan, laporan bulanan kelompok, Laporan Hasil
// Belajar/raport per generus — ekspor .xlsx & cetak/PDF) dan Materi Evaluasi (Kurikulum/daerah: target, halaman kitab,
// bulan evaluasi).
import { useState } from 'react'
import {
  ambilGenerus,
  ambilLaporanBulanan,
  ambilWilayah,
  aturBulanEvaluasi,
  bulanEvaluasi,
  cariGenerus,
  daftarMateriEvaluasi,
  KATEGORI_GENERUS,
  LABEL_JENJANG,
  periodeAktif,
  raporGenerus,
  rekapKeaktifanBulan,
  rekapLaporanBulanan,
  rekapPenguasaan,
  simpanLaporanBulanan,
  slug,
  tanggalHariIni,
  ubahMateriEvaluasi,
  UNSUR_NUNGGONI,
  dataRaportCetak,
  generusUntukRaport,
  kelompokDalamWilayah,
  lembarLaporanWilayah,
  raporPdf,
  ringkasTargetKeaktifan,
  daftarPengajian,
  kategoriKelas,
  predikatAngka,
  ambangPredikat,
  teksAmbang,
  simpanPenilaianKarakter,
  PREDIKAT_SIKAP,
  LABEL_PREDIKAT_SIKAP,
  PANJANG_CATATAN_BUTIR,
  TALI_KEIMANAN,
  THOBIAT_LUHUR,
  type PredikatSikap,
  type FormatLembar,
  type IsiLaporanBulanan,
  type KategoriGenerus,
  type MateriEvaluasi,
  type MusyawarahBulanan,
  type UnsurNunggoni,
} from '@ppg/core'
import { useApp, useData } from '../konteks'
import { AreaTeks, Isian, KeadaanData, Kartu, KepalaHalaman, Kosong, Lencana, Modal, Pilihan, Tombol } from '../komponen/ui'
import { PilihWilayah } from '../komponen/wilayah'
import { buatExcelKeaktifan, buatExcelLaporanBulanan, buatExcelPenguasaan, legendaRekap } from '../utils/excel-juknis'
import { buatExcelLembar } from '../utils/excel-lembar'
import { LembarLaporan, LembarRaport } from '../komponen/lembar-laporan'
import { PratinjauCetak } from '../komponen/pratinjau-cetak'
import { label, LABEL_KATEGORI } from '../utils/label'

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const teksBulan = (b: string) => `${NAMA_BULAN[Number(b.slice(5, 7)) - 1]} ${b.slice(0, 4)}`
const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${String(n).replace('.', ',')}`)
function teksPeriode(p: string): string {
  const y = Number(p.slice(0, 4))
  return p.endsWith('S1') ? `Semester 1 (Jul–Des ${y})` : `Semester 2 (Jan–Jun ${y + 1})`
}
function daftarPeriode(aktif: string): string[] {
  const out = [aktif]
  for (let i = 0; i < 3; i++) {
    const p = out[out.length - 1]!
    const y = Number(p.slice(0, 4))
    out.push(p.endsWith('S2') ? `${y}-S1` : `${y - 1}-S2`)
  }
  return out
}

type Tab = 'penguasaan' | 'keaktifan' | 'bulanan' | 'lembar' | 'raport'

export function HalamanEvaluasi() {
  const { db, peran, wilayahId } = useApp()
  const akar = peran === 'daerah' ? null : wilayahId
  const [tab, setTab] = useState<Tab>('penguasaan')
  const [wilayah, setWilayah] = useState(akar ?? '')
  const aktif = useData(() => periodeAktif(db), [db]).data ?? ''
  const [periode, setPeriode] = useState('')
  const per = periode || aktif
  const [bulan, setBulan] = useState(tanggalHariIni().slice(0, 7))
  return (
    <>
      <KepalaHalaman
        judul="Evaluasi & Keaktifan"
        keterangan={`Juknis Pembinaan 2025: penguasaan materi per semester, target keaktifan ${ringkasTargetKeaktifan(db)} (butir Kurikulum K16), laporan bulanan kelompok, dan Laporan Hasil Belajar.`}
      />
      <div className="tab tidak-cetak" role="tablist">
        {(
          [
            ['penguasaan', 'Rekap Penguasaan Materi'],
            ['keaktifan', 'Keaktifan Bulanan'],
            ['bulanan', 'Laporan Bulanan'],
            ['lembar', 'Cetak Laporan Bulanan (format lembar)'],
            ['raport', 'Laporan Hasil Belajar'],
          ] as [Tab, string][]
        ).map(([k, t]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'aktif' : ''} onClick={() => setTab(k)}>
            {t}
          </button>
        ))}
      </div>
      <Kartu>
        <div className="filter tidak-cetak">
          <PilihWilayah db={db} label="Wilayah" nilai={wilayah} ubah={setWilayah} kosong="— pilih wilayah —" akar={akar} />
          {tab === 'penguasaan' || tab === 'raport' ? (
            <Pilihan label="Semester" nilai={per} ubah={setPeriode} pilihan={aktif ? daftarPeriode(aktif).map((x) => ({ nilai: x, teks: teksPeriode(x) })) : []} />
          ) : (
            <Isian label="Bulan" type="month" nilai={bulan} ubah={(v) => v && setBulan(v)} />
          )}
        </div>
      </Kartu>
      {!wilayah ? (
        <Kartu>
          <Kosong teks="Pilih wilayah (kelompok, desa, atau daerah)." />
        </Kartu>
      ) : tab === 'penguasaan' ? (
        <RekapPenguasaanExe wilayahId={wilayah} periode={per} />
      ) : tab === 'keaktifan' ? (
        <RekapKeaktifanExe wilayahId={wilayah} bulan={bulan} />
      ) : tab === 'bulanan' ? (
        <LaporanBulananExe wilayahId={wilayah} bulan={bulan} />
      ) : tab === 'lembar' ? (
        <CetakLembarExe wilayahId={wilayah} bulan={bulan} />
      ) : (
        <RaporExe wilayahId={wilayah} periode={per} />
      )}
    </>
  )
}

function useSimpanExcel() {
  const { platform, aksi, toast } = useApp()
  return async (nama: string, buat: () => Promise<Uint8Array>) => {
    const bytes = await aksi(buat)
    if (!bytes) return
    const p = await aksi(() => platform.simpanBerkas(nama, bytes))
    if (p) toast('sukses', 'Berkas Excel disimpan.')
  }
}

function RekapPenguasaanExe(p: { wilayahId: string; periode: string }) {
  const { db } = useApp()
  const [jenjang, setJenjang] = useState<KategoriGenerus>('caberawit_a')
  const simpan = useSimpanExcel()
  const r = useData(() => (p.periode ? rekapPenguasaan(db, { wilayahId: p.wilayahId, jenjang, periode: p.periode }) : null), [db, p.wilayahId, jenjang, p.periode])
  const w = ambilWilayah(db, p.wilayahId)
  const judul = `Rekap Penguasaan Materi ${LABEL_JENJANG[jenjang]} — ${w?.nama ?? ''} — ${teksPeriode(p.periode)}`
  return (
    <Kartu
      judul={judul}
      aksi={
        <span className="tidak-cetak aksi-baris">
          <Tombol varian="kedua" onClick={() => window.print()}>
            Cetak / PDF
          </Tombol>
          <Tombol disabled={!r.data?.baris.length} onClick={() => r.data && simpan(`Rekap_Penguasaan_${slug(LABEL_JENJANG[jenjang]!)}_${slug(w?.nama ?? '')}_${p.periode}.xlsx`, () => buatExcelPenguasaan(r.data!, judul))}>
            Ekspor Excel
          </Tombol>
        </span>
      }
    >
      <div className="tab tab-jenjang tidak-cetak" role="tablist">
        {KATEGORI_GENERUS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={jenjang === k} className={jenjang === k ? 'aktif' : ''} onClick={() => setJenjang(k)}>
            {LABEL_JENJANG[k]}
          </button>
        ))}
      </div>
      <KeadaanData hasil={r}>
        {(x) =>
          !x ? null : (
            <>
              {x.jenjangBelumDitetapkan ? (
                <p className="keterangan">
                  <Lencana warna="kuning">{x.jenjangBelumDitetapkan} generus</Lencana> masih berjenjang "Caberawit" lama — tetapkan A/B/C di Generus & Jamaah.
                </p>
              ) : null}
              {x.materiBelumDitetapkan.length ? (
                <p className="keterangan" role="note">
                  <Lencana warna="kuning">Belum ditetapkan Kurikulum</Lencana> Materi {x.materiBelumDitetapkan.join(', ')} belum ditetapkan Kurikulum — kolomnya “—” dan tidak ikut dihitung.
                </p>
              ) : null}
              {x.kolom.length === 0 ? (
                <Kosong teks="Daftar materi evaluasi belum ada. Buka berkas MATERI terbaru dari daerah." />
              ) : x.baris.length === 0 ? (
                <Kosong teks="Belum ada generus aktif berjenjang ini di wilayah terpilih." />
              ) : (
                <>
                  <div className="gulir">
                    <table className="tabel tabel-rekap" aria-label="Rekap penguasaan materi">
                      <thead>
                        <tr>
                          <th>No</th>
                          <th>Nama</th>
                          {x.kolom.map((m, i) => (
                            <th key={m.id} className="vertikal" title={m.nama}>
                              <span>
                                {i + 1}. {m.nama}
                              </span>
                            </th>
                          ))}
                          <th className="kolom-aspek">Alim-Faqih</th>
                          <th className="kolom-aspek">Akhlaqul Karimah</th>
                          <th className="kolom-aspek">Mandiri</th>
                          <th className="kolom-aspek">Nilai Akhir</th>
                        </tr>
                      </thead>
                      <tbody>
                        {x.baris.map((b) => (
                          <tr key={b.generus_id}>
                            <td>{b.no}</td>
                            <td>
                              {b.nama}
                              <small className="blok">{b.kelompok}</small>
                            </td>
                            {b.nilai.map((v, i) => (
                              <td key={i} className={b.belumDinilai[i] ? 'angka sel-bd' : 'angka'} title={b.belumDinilai[i] ? 'belum dinilai' : undefined}>
                                {b.belumDinilai[i] ? 'bd' : fmt(v)}
                              </td>
                            ))}
                            <td className="angka">{fmt(b.alimFaqih)}</td>
                            <td className="angka">{fmt(b.akhlak)}</td>
                            <td className="angka">{fmt(b.mandiri)}</td>
                            <td className="angka">
                              <b>{fmt(b.total)}</b>
                            </td>
                          </tr>
                        ))}
                        <tr className="baris-total">
                          <td />
                          <td>
                            <b>Rata-rata</b>
                          </td>
                          {x.rata.map((v, i) => (
                            <td key={i} className="angka">
                              {fmt(v)}
                            </td>
                          ))}
                          <td className="angka">{fmt(x.rataAspek.alimFaqih)}</td>
                          <td className="angka">{fmt(x.rataAspek.akhlak)}</td>
                          <td className="angka">{fmt(x.rataAspek.mandiri)}</td>
                          <td className="angka">
                            <b>{fmt(x.rataTotal)}</b>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <h3>Ringkasan per desa / kelompok</h3>
                  <table className="tabel" aria-label="Ringkasan wilayah">
                    <thead>
                      <tr>
                        <th>Tingkat</th>
                        <th>Nama</th>
                        <th>Generus</th>
                        <th>Alim-Faqih</th>
                        <th>Akhlaqul Karimah</th>
                        <th>Mandiri</th>
                        <th>Nilai Akhir (%)</th>
                        <th>Predikat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...x.perDesa, ...x.perKelompok].map((d) => (
                        <tr key={`${d.tingkat}-${d.wilayah_id}`}>
                          <td>{d.tingkat === 'desa' ? 'Desa' : 'Kelompok'}</td>
                          <td>{d.nama}</td>
                          <td>{d.jumlah}</td>
                          <td>{fmt(d.rataAspek.alimFaqih)}</td>
                          <td>{fmt(d.rataAspek.akhlak)}</td>
                          <td>{fmt(d.rataAspek.mandiri)}</td>
                          <td>{fmt(d.rataTotal)}</td>
                          <td>{predikatAngka(d.rataTotal, x.ambang) ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="keterangan">{legendaRekap(x.rumus)} — = belum ditetapkan Kurikulum. {teksAmbang(x.ambang)}</p>
                </>
              )}
            </>
          )
        }
      </KeadaanData>
    </Kartu>
  )
}

function RekapKeaktifanExe(p: { wilayahId: string; bulan: string }) {
  const { db } = useApp()
  const simpan = useSimpanExcel()
  const r = useData(() => rekapKeaktifanBulan(db, { wilayahId: p.wilayahId, bulan: p.bulan }), [db, p.wilayahId, p.bulan])
  const w = ambilWilayah(db, p.wilayahId)
  const judul = `Keaktifan ${teksBulan(p.bulan)} — ${w?.nama ?? ''}`
  return (
    <KeadaanData hasil={r}>
      {(x) => (
        <>
          <Kartu
            judul={judul}
            aksi={
              <span className="tidak-cetak aksi-baris">
                <Tombol varian="kedua" onClick={() => window.print()}>
                  Cetak / PDF
                </Tombol>
                <Tombol disabled={!x.baris.length} onClick={() => simpan(`Keaktifan_${slug(w?.nama ?? '')}_${p.bulan}.xlsx`, () => buatExcelKeaktifan(x, judul, (k) => label(LABEL_KATEGORI, k)))}>
                  Ekspor Excel
                </Tombol>
              </span>
            }
          >
            <table className="tabel" aria-label="Keaktifan per kelompok">
              <thead>
                <tr>
                  <th>Kelompok</th>
                  <th>Generus</th>
                  <th>Rata-rata %</th>
                  <th>Mencapai target</th>
                </tr>
              </thead>
              <tbody>
                {x.perKelompok.map((k) => (
                  <tr key={k.kelompok_id}>
                    <td>{k.nama}</td>
                    <td>{k.jumlah}</td>
                    <td>{fmt(k.rataPersen)}</td>
                    <td>{k.tercapai}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Kartu>
          <Kartu judul={`Perlu perhatian (keaktifan < 50%): ${x.perluPerhatian.length} generus`}>
            <p className="keterangan">Bahan Musyawaroh 5 Unsur / musyawarah desa.</p>
            <div className="gulir">
              <table className="tabel" aria-label="Keaktifan per generus">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Kelompok</th>
                    <th>Jenjang</th>
                    <th>Jumlah</th>
                    <th>%</th>
                    <th>Menunggu</th>
                  </tr>
                </thead>
                <tbody>
                  {x.baris.map((b) => (
                    <tr key={b.generus_id} className={b.persen < 50 ? 'baris-merah' : ''}>
                      <td>{b.nama}</td>
                      <td>{b.kelompok}</td>
                      <td>{label(LABEL_KATEGORI, b.jenjang)}</td>
                      <td>
                        {b.jumlah}/{b.target}
                      </td>
                      <td>{fmt(b.persen)}</td>
                      <td>{b.menunggu || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Kartu>
        </>
      )}
    </KeadaanData>
  )
}

const ya = (b: boolean | null) => (b === true ? <Lencana warna="hijau">Ya</Lencana> : b === false ? <Lencana warna="merah">Tidak</Lencana> : <Lencana warna="abu">—</Lencana>)

function LaporanBulananExe(p: { wilayahId: string; bulan: string }) {
  const { db, peran } = useApp()
  const simpan = useSimpanExcel()
  const r = useData(() => rekapLaporanBulanan(db, { wilayahId: p.wilayahId, bulan: p.bulan }), [db, p.wilayahId, p.bulan])
  const [ubah, setUbah] = useState<string | null>(null)
  const w = ambilWilayah(db, p.wilayahId)
  const judul = `Laporan Bulanan Kelompok ${teksBulan(p.bulan)} — ${w?.nama ?? ''}`
  const bolehUbah = peran !== 'kurikulum'
  return (
    <KeadaanData hasil={r}>
      {(x) => (
        <Kartu
          judul={judul}
          aksi={
            <span className="tidak-cetak aksi-baris">
              <Tombol varian="kedua" onClick={() => window.print()}>
                Cetak / PDF
              </Tombol>
              <Tombol disabled={!x.length} onClick={() => simpan(`Laporan_Bulanan_${slug(w?.nama ?? '')}_${p.bulan}.xlsx`, () => buatExcelLaporanBulanan(x, judul))}>
                Ekspor Excel
              </Tombol>
            </span>
          }
        >
          <div className="gulir">
            <table className="tabel" aria-label="Laporan bulanan">
              <thead>
                <tr>
                  <th>Desa</th>
                  <th>Kelompok</th>
                  <th>Mus. 5 Unsur</th>
                  <th>Muda/i Kel.</th>
                  <th>Muda/i Desa</th>
                  <th>Muda/i Daerah</th>
                  <th>NUNGGONI</th>
                  <th>Hasil / temuan</th>
                  {bolehUbah ? <th className="tidak-cetak" /> : null}
                </tr>
              </thead>
              <tbody>
                {x.map((b) => (
                  <tr key={b.kelompok_id}>
                    <td>{b.desa}</td>
                    <td>
                      {b.kelompok}
                      {!b.ada ? <Lencana warna="kuning">belum lapor</Lencana> : null}
                    </td>
                    <td>{ya(b.mus5)}</td>
                    <td>{ya(b.musMuda.kelompok)}</td>
                    <td>{ya(b.musMuda.desa)}</td>
                    <td>{ya(b.musMuda.daerah)}</td>
                    <td>{b.jumlahNunggoni}</td>
                    <td>
                      {b.isi.mus5?.catatan ? <small className="blok">{b.isi.mus5.catatan}</small> : null}
                      {b.isi.nunggoni.map((n, i) => (
                        <small key={i} className="blok">
                          {n.nama} ({n.unsur}){n.temuan ? `: ${n.temuan}` : ''}
                        </small>
                      ))}
                    </td>
                    {bolehUbah ? (
                      <td className="tidak-cetak">
                        <Tombol kecil varian="kedua" onClick={() => setUbah(b.kelompok_id)}>
                          Isi/ubah
                        </Tombol>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ubah ? <FormLaporanExe kelompokId={ubah} bulan={p.bulan} tutup={() => setUbah(null)} /> : null}
        </Kartu>
      )}
    </KeadaanData>
  )
}

const PILIH_YA = [
  { nilai: 'ya', teks: 'Terlaksana' },
  { nilai: 'tidak', teks: 'Tidak terlaksana' },
  { nilai: '', teks: 'Belum diisi' },
]
const keNilai = (b: boolean | null) => (b === true ? 'ya' : b === false ? 'tidak' : '')
const dariNilai = (v: string) => (v === 'ya' ? true : v === 'tidak' ? false : null)

function FormLaporanExe(p: { kelompokId: string; bulan: string; tutup: () => void }) {
  const { db, aksi } = useApp()
  const awal = ambilLaporanBulanan(db, p.kelompokId, p.bulan)
  const [isi, setIsi] = useState<IsiLaporanBulanan>(awal.isi)
  const [n, setN] = useState({ nama: '', unsur: '4S Kelompok' as UnsurNunggoni, tanggal: '', kelas: '', temuan: '' })
  const mus = (judul: string, m: MusyawarahBulanan, ubah: (m: MusyawarahBulanan) => void, catatan?: boolean) => (
    <div className="baris-isian">
      <Pilihan label={judul} nilai={keNilai(m.terlaksana)} ubah={(v) => ubah({ ...m, terlaksana: dariNilai(v) })} pilihan={PILIH_YA} />
      {catatan ? <AreaTeks label="Hasil musyawarah" nilai={m.catatan ?? ''} ubah={(v) => ubah({ ...m, catatan: v })} baris={2} /> : null}
    </div>
  )
  return (
    <Modal
      judul={`Laporan ${ambilWilayah(db, p.kelompokId)?.nama ?? ''} — ${teksBulan(p.bulan)}`}
      tutup={p.tutup}
      lebar
      aksi={
        <Tombol
          onClick={async () => {
            const r = await aksi(() => simpanLaporanBulanan(db, { kelompokId: p.kelompokId, bulan: p.bulan, isi }), 'Laporan tersimpan.')
            if (r) p.tutup()
          }}
        >
          Simpan
        </Tombol>
      }
    >
      {mus('Musyawaroh 5 Unsur', isi.mus5, (m) => setIsi({ ...isi, mus5: m }), true)}
      {mus('Muda/i kelompok', isi.musMuda.kelompok, (m) => setIsi({ ...isi, musMuda: { ...isi.musMuda, kelompok: m } }))}
      {mus('Muda/i desa', isi.musMuda.desa, (m) => setIsi({ ...isi, musMuda: { ...isi.musMuda, desa: m } }))}
      {mus('Muda/i daerah', isi.musMuda.daerah, (m) => setIsi({ ...isi, musMuda: { ...isi.musMuda, daerah: m } }))}
      <h3>NUNGGONI</h3>
      <ul>
        {isi.nunggoni.map((x, i) => (
          <li key={i}>
            {x.nama} ({x.unsur}) {x.temuan ? `— ${x.temuan}` : ''}{' '}
            <Tombol kecil varian="bahaya" onClick={() => setIsi({ ...isi, nunggoni: isi.nunggoni.filter((_, j) => j !== i) })}>
              Hapus
            </Tombol>
          </li>
        ))}
      </ul>
      <div className="filter">
        <Isian label="Nama" nilai={n.nama} ubah={(v) => setN({ ...n, nama: v })} />
        <Pilihan label="Unsur" nilai={n.unsur} ubah={(v) => setN({ ...n, unsur: v as UnsurNunggoni })} pilihan={UNSUR_NUNGGONI.map((u) => ({ nilai: u, teks: u }))} />
        <Isian label="Tanggal" type="date" nilai={n.tanggal} ubah={(v) => setN({ ...n, tanggal: v })} />
        <Isian label="Kelas" nilai={n.kelas} ubah={(v) => setN({ ...n, kelas: v })} />
        <Isian label="Temuan/saran" nilai={n.temuan} ubah={(v) => setN({ ...n, temuan: v })} lebar />
      </div>
      <Tombol
        varian="kedua"
        disabled={!n.nama.trim()}
        onClick={() => {
          setIsi({ ...isi, nunggoni: [...isi.nunggoni, { nama: n.nama.trim(), unsur: n.unsur, tanggal: n.tanggal || null, kelas: n.kelas || null, temuan: n.temuan || null }] })
          setN({ ...n, nama: '', tanggal: '', kelas: '', temuan: '' })
        }}
      >
        + Tambah NUNGGONI
      </Tombol>
      <AreaTeks label="Catatan lain" nilai={isi.catatan ?? ''} ubah={(v) => setIsi({ ...isi, catatan: v })} />
    </Modal>
  )
}

// §19 — Cetak Laporan Bulanan format lembar (sampul, lembar keaktifan per jenjang, absensi pengurus, penyaksian)
function CetakLembarExe(p: { wilayahId: string; bulan: string }) {
  const { db } = useApp()
  const simpan = useSimpanExcel()
  const [format, setFormat] = useState<FormatLembar>('tanggal')
  const [buka, setBuka] = useState(false)
  const r = useData(() => lembarLaporanWilayah(db, { wilayahId: p.wilayahId, bulan: p.bulan }), [db, p.wilayahId, p.bulan])
  const w = ambilWilayah(db, p.wilayahId)
  const namaBerkas = `Laporan_Generus_${slug(w?.nama ?? '')}_${p.bulan}`
  const excel = () => r.data && simpan(`${namaBerkas}.xlsx`, () => buatExcelLembar(r.data!, format))
  return (
    <Kartu
      judul={`Cetak Laporan Bulanan (format lembar) — ${w?.nama ?? ''} — ${teksBulan(p.bulan)}`}
      aksi={
        <span className="tidak-cetak aksi-baris">
          <Tombol disabled={!r.data?.length} onClick={() => setBuka(true)}>
            Pratinjau &amp; Cetak / PDF
          </Tombol>
          <Tombol varian="kedua" disabled={!r.data?.length} onClick={excel}>
            Ekspor Excel
          </Tombol>
        </span>
      }
    >
      <div className="filter">
        <Pilihan
          label="Format lembar"
          nilai={format}
          ubah={(v) => setFormat(v as FormatLembar)}
          pilihan={[
            { nilai: 'tanggal', teks: 'Kolom tanggal 1–31 (bawaan)' },
            { nilai: 'urutan', teks: 'Urutan kegiatan 1–24 (Pra Nikah 1–16)' },
          ]}
        />
      </div>
      <p className="keterangan">
        Berisi, untuk tiap kelompok: sampul "Laporan Generus Kelompok", lembar Presensi Keaktifan per jenjang (judul &amp; warna kuning seperti lembar daerah, % Keaktifan
        memakai target Kurikulum K16, % Peng. Materi dari evaluasi semester terakhir), lembar Absensi Pengurus &amp; Mubaligh Peduli, Laporan Hasil Musyawaroh, dan kotak
        Penyaksian. Wilayah desa/daerah = gabungan semua kelompok dalam satu berkas.
      </p>
      <KeadaanData hasil={r} kosong={(d) => d.length === 0} teksKosong="Tidak ada kelompok di wilayah ini.">
        {(d) => (
          <ul className="daftar-ringkas" aria-label="Kelompok dalam cetakan">
            {d.map((l) => (
              <li key={l.kelompok.id}>
                <b>{l.kelompok.nama}</b>
                {l.desa ? ` (${l.desa.nama})` : ''} — {l.blok.reduce((s, b) => s + b.baris.length, 0)} generus aktif · MT: {l.mubaligh ?? 'belum ada token mubaligh'} ·{' '}
                {l.adaLaporanBulanan ? 'laporan bulanan ada' : <Lencana warna="kuning">laporan bulanan belum diisi</Lencana>}
              </li>
            ))}
          </ul>
        )}
      </KeadaanData>
      {buka && r.data ? (
        <PratinjauCetak
          judul={`Laporan Generus ${w?.nama ?? ''} — ${teksBulan(p.bulan)}`}
          tutup={() => setBuka(false)}
          aksi={
            <Tombol varian="kedua" onClick={excel}>
              Ekspor Excel
            </Tombol>
          }
        >
          <LembarLaporan data={r.data} format={format} />
        </PratinjauCetak>
      ) : null}
    </Kartu>
  )
}

// §19 — Cetak semua raport (satu anak per halaman A4) & simpan PDF
function CetakSemuaRaport(p: { wilayahId: string; periode: string }) {
  const { db, platform, aksi, toast } = useApp()
  const kelompok = useData(() => kelompokDalamWilayah(db, p.wilayahId).map((id) => ({ id, nama: ambilWilayah(db, id)?.nama ?? id })), [db, p.wilayahId])
  const [kel, setKel] = useState('')
  const [saring, setSaring] = useState('')
  const [buka, setBuka] = useState<string[] | null>(null)
  const wil = kel || p.wilayahId
  const kelas = useData(() => (kel ? daftarPengajian(db, [kel]).filter((x) => !x.dihapus && kategoriKelas(x)) : []), [db, kel])
  const anak = useData(
    () =>
      generusUntukRaport(db, {
        wilayahId: wil,
        jenjang: saring.startsWith('j:') ? saring.slice(2) : null,
        pengajianId: saring.startsWith('k:') ? saring.slice(2) : null,
      }),
    [db, wil, saring],
  )
  const ids = (anak.data ?? []).map((g) => g.id)
  const nama = ambilWilayah(db, wil)?.nama ?? ''
  const pdf = async (daftar: string[], berkas: string) => {
    const bytes = await aksi(() => raporPdf(db, { generusIds: daftar, periode: p.periode }))
    if (!bytes) return
    const r = await aksi(() => platform.simpanBerkas(berkas, bytes))
    if (r) toast('sukses', 'PDF raport disimpan.')
  }
  return (
    <Kartu
      judul="Cetak semua raport"
      aksi={
        <span className="tidak-cetak aksi-baris">
          <Tombol disabled={!ids.length} onClick={() => setBuka(ids)}>
            Pratinjau &amp; Cetak semua ({ids.length})
          </Tombol>
          <Tombol varian="kedua" disabled={!ids.length} onClick={() => pdf(ids, `Raport_${slug(nama)}_${p.periode}.pdf`)}>
            Simpan PDF
          </Tombol>
        </span>
      }
    >
      <div className="filter tidak-cetak">
        <Pilihan label="Kelompok" nilai={kel} ubah={(v) => (setKel(v), setSaring(''))} kosong="Semua kelompok di wilayah" pilihan={(kelompok.data ?? []).map((k) => ({ nilai: k.id, teks: k.nama }))} />
        <Pilihan
          label="Jenjang / kelas"
          nilai={saring}
          ubah={setSaring}
          kosong="Semua jenjang"
          pilihan={[
            ...KATEGORI_GENERUS.map((j) => ({ nilai: `j:${j}`, teks: LABEL_JENJANG[j]! })),
            ...(kelas.data ?? []).map((x) => ({ nilai: `k:${x.id}`, teks: `Kelas: ${x.nama}` })),
          ]}
        />
      </div>
      <p className="keterangan">Per anak dua halaman A4: (1) ringkas — kop PPG Daerah, identitas, Tri Sukses Generus + Nilai Akhir, Karakter Luhur, keaktifan, catatan mubaligh, tanda tangan MT, KI Kelompok, Orang Tua/Wali; (2) lampiran Rincian Penguasaan Materi per aspek.</p>
      {buka ? (
        <PratinjauCetak
          judul={`Raport ${nama} — ${teksPeriode(p.periode)} (${buka.length} anak)`}
          tutup={() => setBuka(null)}
          aksi={
            <Tombol varian="kedua" onClick={() => pdf(buka, `Raport_${slug(nama)}_${p.periode}.pdf`)}>
              Simpan PDF
            </Tombol>
          }
        >
          <LembarRaport data={buka.map((id) => dataRaportCetak(db, id, { periode: p.periode }))} ambang={teksAmbang(ambangPredikat(db))} />
        </PratinjauCetak>
      ) : null}
    </Kartu>
  )
}

function RaporExe(p: { wilayahId: string; periode: string }) {
  const { db, peran } = useApp()
  const [cari, setCari] = useState('')
  const [gid, setGid] = useState('')
  const daftar = useData(() => cariGenerus(db, { wilayahId: p.wilayahId, status: 'aktif', cari }), [db, p.wilayahId, cari])
  const r = useData(() => (gid ? dataRaportCetak(db, gid, { periode: p.periode }) : null), [db, gid, p.periode])
  const [cetak, setCetak] = useState(false)
  const [karakter, setKarakter] = useState(false)
  const { platform, aksi, toast } = useApp()
  // §20.3: penilaian Karakter Luhur oleh EXE kelompok/desa/daerah (hak sahkan ditegakkan core); Kurikulum hanya melihat
  const bolehNilai = peran !== 'kurikulum'
  const simpanPdf = async () => {
    const bytes = await aksi(() => raporPdf(db, { generusIds: [gid], periode: p.periode }))
    if (!bytes) return
    if (await aksi(() => platform.simpanBerkas(`Raport_${slug(r.data?.nama ?? 'generus')}_${p.periode}.pdf`, bytes))) toast('sukses', 'PDF raport disimpan.')
  }
  return (
    <>
      {cetak && gid ? (
        <PratinjauCetak judul="Laporan Hasil Belajar" tutup={() => setCetak(false)}>
          <LembarRaport data={[dataRaportCetak(db, gid, { periode: p.periode })]} ambang={teksAmbang(ambangPredikat(db))} />
        </PratinjauCetak>
      ) : null}
      <CetakSemuaRaport wilayahId={p.wilayahId} periode={p.periode} />
      <Kartu
        judul="Raport satu anak"
        aksi={
          gid ? (
            <span className="tidak-cetak aksi-baris">
              {bolehNilai ? (
                <Tombol varian="kedua" onClick={() => setKarakter(true)}>
                  Nilai Karakter Luhur
                </Tombol>
              ) : null}
              <Tombol onClick={() => setCetak(true)}>Cetak / PDF</Tombol>
              <Tombol varian="kedua" onClick={() => simpanPdf()}>
                Simpan PDF
              </Tombol>
            </span>
          ) : undefined
        }
      >
        <div className="filter tidak-cetak">
          <Isian label="Cari nama" nilai={cari} ubah={setCari} />
          <Pilihan
            label="Generus"
            nilai={gid}
            ubah={setGid}
            kosong="— pilih —"
            pilihan={(daftar.data ?? []).map((g) => ({ nilai: g.id, teks: `${g.nama} · ${g.kelompok_nama} · ${label(LABEL_KATEGORI, g.kategori)}` }))}
          />
        </div>
        <p className="keterangan">
          Raport disusun per aspek <b>Tri Sukses Generus</b> (Alim-Faqih, Akhlaqul Karimah, Mandiri) + <b>Karakter Luhur</b>; rincian materi ada di lampiran.
        </p>
      </Kartu>
      {gid ? (
        <KeadaanData hasil={r}>
          {(x) => (x ? <div className="raport-layar">{<LembarRaport data={[x]} ambang={teksAmbang(ambangPredikat(db))} />}</div> : null)}
        </KeadaanData>
      ) : null}
      {karakter && gid ? <FormKarakterExe generusId={gid} periode={p.periode} tutup={() => setKarakter(false)} /> : null}
    </>
  )
}

const PILIH_PREDIKAT = [
  { nilai: '', teks: '— belum dinilai —' },
  ...PREDIKAT_SIKAP.map((k) => ({ nilai: k, teks: LABEL_PREDIKAT_SIKAP[k] })),
]

/** §20.3 — isian Karakter Luhur (4 Tali Keimanan, 6 Thobiat Luhur, catatan mubaligh) satu anak. */
function FormKarakterExe(p: { generusId: string; periode: string; tutup: () => void }) {
  const { db, aksi } = useApp()
  const g = ambilGenerus(db, p.generusId)
  const awal = raporGenerus(db, p.generusId, { periode: p.periode })?.karakter
  const mula = Object.fromEntries([...(awal?.tali ?? []), ...(awal?.thobiat ?? [])].map((b) => [b.kode, { predikat: b.predikat ?? '', catatan: b.catatan ?? '' }]))
  const [isi, setIsi] = useState<Record<string, { predikat: string; catatan: string }>>(mula)
  const [catatan, setCatatan] = useState(awal?.catatanMubaligh ?? '')
  const ubah = (k: string, v: Partial<{ predikat: string; catatan: string }>) => setIsi({ ...isi, [k]: { ...(isi[k] ?? { predikat: '', catatan: '' }), ...v } })
  const simpan = async () => {
    const r = await aksi(() => {
      let n = 0
      for (const [k, v] of Object.entries(isi)) {
        const lama = mula[k] ?? { predikat: '', catatan: '' }
        if (lama.predikat === v.predikat && lama.catatan === v.catatan) continue
        if (!v.predikat && !v.catatan.trim() && !lama.predikat && !lama.catatan) continue
        simpanPenilaianKarakter(db, { generusId: p.generusId, periode: p.periode, butir: k, predikat: (v.predikat || null) as PredikatSikap | null, catatan: v.catatan })
        n++
      }
      if (catatan.trim() !== (awal?.catatanMubaligh ?? '') && (catatan.trim() || awal?.catatanMubaligh)) {
        simpanPenilaianKarakter(db, { generusId: p.generusId, periode: p.periode, butir: 'catatan', predikat: null, catatan })
        n++
      }
      return n
    }, (n) => `${n} isian Karakter Luhur tersimpan.`)
    if (r !== undefined) p.tutup()
  }
  const baris = (judul: string, l: readonly { kode: string; nama: string }[]) => (
    <>
      <h3>{judul}</h3>
      <table className="tabel" aria-label={judul}>
        <thead>
          <tr>
            <th>Butir</th>
            <th>Predikat</th>
            <th>Catatan singkat (opsional)</th>
          </tr>
        </thead>
        <tbody>
          {l.map((b) => (
            <tr key={b.kode}>
              <td>{b.nama}</td>
              <td>
                <select aria-label={`Predikat ${b.nama}`} value={isi[b.kode]?.predikat ?? ''} onChange={(e) => ubah(b.kode, { predikat: e.target.value })}>
                  {PILIH_PREDIKAT.map((o) => (
                    <option key={o.nilai} value={o.nilai}>
                      {o.teks}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input aria-label={`Catatan ${b.nama}`} maxLength={PANJANG_CATATAN_BUTIR} value={isi[b.kode]?.catatan ?? ''} onChange={(e) => ubah(b.kode, { catatan: e.target.value })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
  return (
    <Modal judul={`Karakter Luhur — ${g?.nama ?? ''} — ${teksPeriode(p.periode)}`} tutup={p.tutup} lebar aksi={<Tombol onClick={simpan}>Simpan</Tombol>}>
      <p className="keterangan">
        Dinilai dari praktik sehari-hari: Baik · Cukup · Perlu Bimbingan. Tidak dihitung ke Nilai Akhir.
        {awal?.targetJenjang ? ` Target jenjang (GBMTPG): ${awal.targetJenjang}.` : ''}
      </p>
      {baris('4 Tali Keimanan', TALI_KEIMANAN)}
      {baris('6 Thobiat Luhur', THOBIAT_LUHUR)}
      <AreaTeks label="Catatan mubaligh semester ini (opsional)" nilai={catatan} ubah={setCatatan} baris={3} />
    </Modal>
  )
}

// ---------------------------------------------------------------- Materi Evaluasi (Kurikulum / daerah)

export function HalamanMateriEvaluasi() {
  const { db, aksi } = useApp()
  const [jenjang, setJenjang] = useState<KategoriGenerus>('paud')
  const daftar = useData(() => daftarMateriEvaluasi(db, jenjang), [db, jenjang])
  const be = useData(() => bulanEvaluasi(db), [db]).data
  const [s1, setS1] = useState('')
  const [s2, setS2] = useState('')
  const [ubah, setUbah] = useState<MateriEvaluasi | null>(null)
  return (
    <>
      <KepalaHalaman
        judul="Materi Evaluasi"
        keterangan="Daftar materi & pembagi per jenjang (seed Juknis 2025). Perubahan ikut berkas MATERI/KURIKULUM ke semua perangkat."
      />
      <Kartu judul="Bulan evaluasi semester">
        <div className="filter">
          <Pilihan label="Semester 1 (Jul–Des)" nilai={s1 || String(be?.S1 ?? 11)} ubah={setS1} pilihan={[7, 8, 9, 10, 11, 12].map((b) => ({ nilai: String(b), teks: NAMA_BULAN[b - 1]! }))} />
          <Pilihan label="Semester 2 (Jan–Jun)" nilai={s2 || String(be?.S2 ?? 5)} ubah={setS2} pilihan={[1, 2, 3, 4, 5, 6].map((b) => ({ nilai: String(b), teks: NAMA_BULAN[b - 1]! }))} />
          <Tombol onClick={() => aksi(() => aturBulanEvaluasi(db, { S1: Number(s1 || be?.S1 || 11), S2: Number(s2 || be?.S2 || 5) }), 'Bulan evaluasi disimpan.')}>Simpan</Tombol>
        </div>
      </Kartu>
      <div className="tab tab-jenjang" role="tablist">
        {KATEGORI_GENERUS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={jenjang === k} className={jenjang === k ? 'aktif' : ''} onClick={() => setJenjang(k)}>
            {LABEL_JENJANG[k]}
          </button>
        ))}
      </div>
      <Kartu>
        <KeadaanData hasil={daftar} kosong={(d) => d.length === 0} teksKosong="Belum ada materi evaluasi (EXE kurikulum: buka berkas MATERI dari daerah dulu).">
          {(d) => (
            <table className="tabel" aria-label="Materi evaluasi">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Materi</th>
                  <th>Cara hitung</th>
                  <th>Target / pembagi</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {d.map((m, i) => (
                  <tr key={m.id}>
                    <td>{i + 1}</td>
                    <td>
                      {m.nama}
                      {m.rincian.sub ? <small className="blok">Sub: {m.rincian.sub.join(', ')}</small> : null}
                    </td>
                    <td>{TEKS_CARA[m.cara]}</td>
                    <td>
                      {m.target === null ? <Lencana warna="kuning">Belum ditetapkan</Lencana> : `${m.target} ${m.satuan ?? ''}`}
                      {m.cara === 'kitab' && m.rincian.kitab?.some((k) => k.halaman === null) ? (
                        <Lencana warna="kuning">{m.rincian.kitab.filter((k) => k.halaman === null).length} kitab belum ada halaman</Lencana>
                      ) : null}
                    </td>
                    <td>
                      <Tombol kecil varian="kedua" onClick={() => setUbah(m)}>
                        Ubah
                      </Tombol>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </KeadaanData>
      </Kartu>
      {ubah ? <FormMateriEvaluasi m={ubah} tutup={() => setUbah(null)} /> : null}
    </>
  )
}

const TEKS_CARA: Record<string, string> = {
  keaktifan: 'Keaktifan (kali/bulan)',
  hitungan: 'Dikuasai ÷ target',
  juz: 'Halaman makna ÷ 20 per juz',
  kitab: 'Halaman ÷ halaman terakhir per kitab',
  subjektif: 'Nilai penguji 1–75%',
}

function FormMateriEvaluasi(p: { m: MateriEvaluasi; tutup: () => void }) {
  const { db, aksi } = useApp()
  const [nama, setNama] = useState(p.m.nama)
  const [target, setTarget] = useState(p.m.target === null ? '' : String(p.m.target))
  const [butir, setButir] = useState((p.m.rincian.butir ?? []).join('\n'))
  const [kitab, setKitab] = useState(p.m.rincian.kitab ?? [])
  const bisaTarget = p.m.cara === 'hitungan' || p.m.cara === 'keaktifan'
  return (
    <Modal
      judul={`Ubah: ${p.m.nama}`}
      tutup={p.tutup}
      lebar
      aksi={
        <Tombol
          onClick={async () => {
            const daftarButir = butir.split('\n').map((x) => x.trim()).filter(Boolean)
            const r = await aksi(
              () =>
                ubahMateriEvaluasi(db, p.m.id, {
                  nama,
                  ...(bisaTarget && !p.m.rincian.butir ? { target: target === '' ? null : Number(target) } : {}),
                  ...(p.m.rincian.butir ? { rincian: { ...p.m.rincian, butir: daftarButir } } : {}),
                  ...(p.m.cara === 'kitab' ? { rincian: { ...p.m.rincian, kitab } } : {}),
                }),
              'Materi evaluasi disimpan.',
            )
            if (r) p.tutup()
          }}
        >
          Simpan
        </Tombol>
      }
    >
      <Isian label="Nama materi" nilai={nama} ubah={setNama} lebar />
      {bisaTarget && !p.m.rincian.butir ? <Isian label={`Target (${p.m.satuan ?? ''})`} type="number" min={1} nilai={target} ubah={setTarget} bantuan="Kosongkan bila belum ditetapkan (tidak ikut dihitung)." /> : null}
      {p.m.rincian.butir ? <AreaTeks label="Butir (satu per baris; target = jumlah butir)" nilai={butir} ubah={setButir} baris={10} /> : null}
      {p.m.cara === 'kitab' ? (
        <table className="tabel">
          <thead>
            <tr>
              <th>Kitab</th>
              <th>Halaman terakhir</th>
            </tr>
          </thead>
          <tbody>
            {kitab.map((k, i) => (
              <tr key={i}>
                <td>{k.nama}</td>
                <td>
                  <input
                    type="number"
                    min={1}
                    aria-label={`Halaman ${k.nama}`}
                    value={k.halaman ?? ''}
                    onChange={(e) => setKitab(kitab.map((x, j) => (j === i ? { ...x, halaman: e.target.value ? Number(e.target.value) : null } : x)))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {p.m.cara === 'subjektif' ? <p className="keterangan">Nilai subjektif penguji selalu dibatasi 75% (juknis).</p> : null}
      {p.m.cara === 'juz' ? <p className="keterangan">Juz target: {p.m.rincian.juz?.join(', ')} (20 halaman per juz).</p> : null}
    </Modal>
  )
}
