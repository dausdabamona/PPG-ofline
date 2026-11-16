// §16 — layar juknis untuk mubaligh/pengurus di HP: Keaktifan (sahkan ajuan murid, catat kegiatan, kejar target),
// Evaluasi Semester (nilai per materi + raport), dan Laporan Bulanan kelompok (Musyawaroh 5 Unsur, Muda/i, NUNGGONI).
import { useState } from 'react'
import {
  ajukanUsulan,
  ambilLaporanBulanan,
  cariGenerus,
  catatKeaktifan,
  KATEGORI_GENERUS,
  KODE_KEAKTIFAN,
  keaktifanMenunggu,
  kejarTargetKelompok,
  kodeUntukJenjang,
  periodeAktif,
  raporGenerus,
  sahkanKeaktifan,
  simpanLaporanBulanan,
  tanggalHariIni,
  UNSUR_NUNGGONI,
  LABEL_JENJANG,
  type GenerusRinci,
  type IsiLaporanBulanan,
  type ItemRapor,
  type KodeKeaktifan,
  type MusyawarahBulanan,
  type UnsurNunggoni,
} from '@ppg/core'
import { useApp, useData } from '../konteks'
import { AreaTeks, BilahPersen, Isian, JudulHalaman, KeadaanData, Kartu, Kosong, Lencana, Modal, Pilihan, Segmen, Spanduk, Tombol } from '../komponen/ui'
import { EditorEvaluasi, geserBulan, LembarKontrol, periodeSebelumnya, RaporHp, teksBulan, teksPeriode } from '../komponen/juknis'
import { label, LABEL_KATEGORI, tanggalTeks } from '../utils/label'

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${String(n).replace('.', ',')}%`)

// ---------------------------------------------------------------- Keaktifan

export function KeaktifanMubaligh(p: { kembali: () => void }) {
  const { db, profil, aksi } = useApp()
  const kel = profil.wilayah_id
  const menunggu = useData(() => keaktifanMenunggu(db, kel), [kel])
  const kejar = useData(() => kejarTargetKelompok(db, kel), [kel])
  const generus = useData(() => cariGenerus(db, { kelompokId: kel, status: 'aktif' }), [kel]).data ?? []
  const [catat, setCatat] = useState(false)
  const [lembar, setLembar] = useState<string | null>(null)
  return (
    <>
      <JudulHalaman judul="Keaktifan" keterangan="Target 20 kali/bulan (Pra Nikah 16). Satu hari dihitung satu kali." kembali={p.kembali} />
      <Tombol penuh onClick={() => setCatat(true)}>
        + Catat kegiatan (mumi, pengajian desa/daerah, mandiri…)
      </Tombol>
      <Kartu judul="Ajuan murid menunggu disahkan">
        <KeadaanData hasil={menunggu} kosong={(d) => d.length === 0} teksKosong="Tidak ada ajuan. Buka setoran belajar murid di Buka Berkas.">
          {(d) => (
            <ul className="daftar-sederhana">
              {d.map((k) => (
                <li key={k.id}>
                  <span>
                    <b>{k.nama}</b> · {tanggalTeks(k.tanggal)} · {k.kode}
                    {k.keterangan ? <small> — {k.keterangan}</small> : null}
                  </span>
                  <span className="aksi-baris">
                    <Tombol kecil onClick={() => void aksi(() => sahkanKeaktifan(db, k.id, 'disahkan'), 'Disahkan.')}>Sahkan</Tombol>
                    <Tombol kecil varian="bahaya" onClick={() => void aksi(() => sahkanKeaktifan(db, k.id, 'ditolak'), 'Ditolak.')}>
                      Tolak
                    </Tombol>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </KeadaanData>
      </Kartu>
      <Kartu judul="Kejar target bulan ini">
        <KeadaanData hasil={kejar} kosong={(d) => d.length === 0} teksKosong="Belum waktunya (mulai tanggal 20) atau semua sudah mencapai target.">
          {(d) => (
            <ul className="daftar-sederhana">
              {d.map((x) => (
                <li key={x.generus_id}>
                  <span>
                    {x.nama} — {x.jumlah}/{x.target}, kurang {x.kurang}
                  </span>
                  <Lencana warna={x.terkejar ? 'kuning' : 'merah'}>{x.terkejar ? `sisa ${x.sisaHari} hari` : 'tidak terkejar'}</Lencana>
                </li>
              ))}
            </ul>
          )}
        </KeadaanData>
      </Kartu>
      <Kartu judul="Lembar kontrol per anak">
        {generus.length ? (
          <ul className="daftar-sederhana">
            {generus.map((g) => (
              <li key={g.id}>
                <span>{g.nama}</span>
                <Tombol kecil varian="kedua" onClick={() => setLembar(g.id)}>
                  Lihat
                </Tombol>
              </li>
            ))}
          </ul>
        ) : (
          <Kosong teks="Belum ada generus aktif." />
        )}
      </Kartu>
      {catat ? <CatatKegiatan generus={generus} tutup={() => setCatat(false)} /> : null}
      {lembar ? <LembarKontrol generusId={lembar} bolehIsi={false} tutup={() => setLembar(null)} /> : null}
    </>
  )
}

/** Catat satu kode kegiatan untuk banyak generus sekaligus (langsung disahkan). */
function CatatKegiatan(p: { generus: GenerusRinci[]; tutup: () => void }) {
  const { db, aksi } = useApp()
  const [tanggal, setTanggal] = useState(tanggalHariIni())
  const [kode, setKode] = useState<KodeKeaktifan>('B')
  const [pilih, setPilih] = useState<string[]>([])
  const semuaKode = [...new Set(p.generus.flatMap((g) => kodeUntukJenjang(g.kategori)))].filter((k) => k !== 'A')
  const cocok = p.generus.filter((g) => kodeUntukJenjang(g.kategori).includes(kode))
  return (
    <Modal
      judul="Catat kegiatan"
      tutup={p.tutup}
      aksi={
        <Tombol
          disabled={!pilih.length}
          onClick={async () => {
            const r = await aksi(() => {
              for (const id of pilih) catatKeaktifan(db, { generusId: id, tanggal, kode, sebagai: 'pencatat' })
              return pilih.length
            }, (n) => `${n} anak tercatat.`)
            if (r) p.tutup()
          }}
        >
          Simpan ({pilih.length})
        </Tombol>
      }
    >
      <Isian label="Tanggal" type="date" nilai={tanggal} ubah={setTanggal} />
      <Pilihan label="Kode" nilai={kode} ubah={(v) => (setKode(v as KodeKeaktifan), setPilih([]))} pilihan={semuaKode.map((k) => ({ nilai: k, teks: `${k} — ${KODE_KEAKTIFAN[k].nama}` }))} />
      <p className="keterangan">Kode A tercatat otomatis dari Absen. Izin (IZ) dicatat tetapi tidak dihitung.</p>
      <Tombol kecil varian="kedua" onClick={() => setPilih(pilih.length === cocok.length ? [] : cocok.map((g) => g.id))}>
        {pilih.length === cocok.length && cocok.length ? 'Batal pilih semua' : 'Pilih semua'}
      </Tombol>
      <ul className="daftar-centang">
        {cocok.map((g) => (
          <li key={g.id}>
            <label>
              <input type="checkbox" checked={pilih.includes(g.id)} onChange={(e) => setPilih(e.target.checked ? [...pilih, g.id] : pilih.filter((x) => x !== g.id))} />
              {g.nama} <small>({label(LABEL_KATEGORI, g.kategori)})</small>
            </label>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

// ---------------------------------------------------------------- Evaluasi semester

export function EvaluasiMubaligh(p: { kembali: () => void }) {
  const { db, profil } = useApp()
  const kel = profil.wilayah_id
  const aktif = useData(() => periodeAktif(db), []).data ?? ''
  const [periode, setPeriode] = useState('')
  const per = periode || aktif
  const [jenjang, setJenjang] = useState('')
  const generus = useData(() => cariGenerus(db, { kelompokId: kel, status: 'aktif' }), [kel])
  const [pilih, setPilih] = useState<GenerusRinci | null>(null)
  const daftar = (generus.data ?? []).filter((g) => !jenjang || g.kategori === jenjang)
  if (pilih) return <EvaluasiGenerus g={pilih} periode={per} kembali={() => setPilih(null)} />
  return (
    <>
      <JudulHalaman judul="Evaluasi Semester" keterangan="Penguasaan materi per anak (juknis). Nilai praktik maksimal 75%." kembali={p.kembali} />
      <Kartu>
        {aktif ? (
          <Pilihan label="Semester" nilai={per} ubah={setPeriode} pilihan={[aktif, periodeSebelumnya(aktif)].map((x) => ({ nilai: x, teks: teksPeriode(x) }))} />
        ) : null}
        <Pilihan label="Jenjang" nilai={jenjang} ubah={setJenjang} kosong="Semua jenjang" pilihan={[...KATEGORI_GENERUS, 'caberawit'].map((k) => ({ nilai: k, teks: label(LABEL_KATEGORI, k) }))} />
      </Kartu>
      <KeadaanData hasil={generus} kosong={() => daftar.length === 0} teksKosong="Tidak ada generus aktif.">
        {() => (
          <ul className="daftar-sederhana">
            {daftar.map((g) => (
              <BarisGenerusEvaluasi key={g.id} g={g} periode={per} buka={() => setPilih(g)} />
            ))}
          </ul>
        )}
      </KeadaanData>
    </>
  )
}

function BarisGenerusEvaluasi(p: { g: GenerusRinci; periode: string; buka: () => void }) {
  const { db } = useApp()
  const r = useData(() => (p.periode ? raporGenerus(db, p.g.id, { periode: p.periode }) : null), [p.g.id, p.periode]).data
  return (
    <li>
      <span>
        {p.g.nama} <small>({label(LABEL_KATEGORI, p.g.kategori)})</small>
        {p.g.kategori_saran ? <Lencana warna="kuning">jenjang perlu dicek</Lencana> : null}
      </span>
      <Tombol kecil varian="kedua" onClick={p.buka}>
        {r?.total !== null && r?.total !== undefined ? fmt(r.total) : 'Nilai'}
      </Tombol>
    </li>
  )
}

function EvaluasiGenerus(p: { g: GenerusRinci; periode: string; kembali: () => void }) {
  const { db, profil, aksi } = useApp()
  const r = useData(() => raporGenerus(db, p.g.id, { periode: p.periode }), [p.g.id, p.periode])
  const [edit, setEdit] = useState<ItemRapor | null>(null)
  const [rapor, setRapor] = useState(false)
  const [jenjangBaru, setJenjangBaru] = useState('')
  return (
    <>
      <JudulHalaman judul={p.g.nama} keterangan={teksPeriode(p.periode)} kembali={p.kembali} />
      {p.g.kategori === 'caberawit' || p.g.kategori_saran ? (
        <Spanduk jenis="peringatan">
          Jenjang {label(LABEL_KATEGORI, p.g.kategori)} {p.g.kategori === 'caberawit' ? 'belum dipilah' : 'hasil saran umur'}. Tetapkan sesuai kemampuan
          baca: B = masih Iqro', C = sudah Al-Qur'an.
        </Spanduk>
      ) : null}
      <Kartu judul="Tetapkan jenjang">
        <Pilihan label="Jenjang" nilai={jenjangBaru || p.g.kategori} ubah={setJenjangBaru} pilihan={KATEGORI_GENERUS.map((k) => ({ nilai: k, teks: LABEL_JENJANG[k]! }))} />
        <Tombol
          penuh
          varian="kedua"
          disabled={!jenjangBaru || jenjangBaru === p.g.kategori}
          onClick={() =>
            void aksi(
              () => ajukanUsulan(db, { jenis: 'ubah_generus', kelompokId: profil.wilayah_id, data: { generus_id: p.g.id, perubahan: { kategori: jenjangBaru } } }),
              'Jenjang diajukan; berlaku setelah Setor sampai daerah (disetujui otomatis).',
            )
          }
        >
          Ajukan jenjang
        </Tombol>
      </Kartu>
      <KeadaanData hasil={r} kosong={(d) => !d || !d.jenjang || d.items.length === 0} teksKosong="Jenjang belum ditetapkan atau daftar materi evaluasi belum ada (buka berkas materi terbaru).">
        {(x) => (
          <Kartu judul={`TOTAL ${fmt(x!.total)}`} aksi={<Tombol kecil varian="kedua" onClick={() => setRapor(true)}>Raport</Tombol>}>
            <BilahPersen persen={x!.total ?? 0} label="Total" />
            <ul className="daftar-rapor">
              {x!.items.map((i) => (
                <li key={i.materi.id}>
                  <div>
                    <span>{i.materi.nama}</span>
                    {i.materi.cara === 'keaktifan' ? (
                      <b>{fmt(i.persen)}</b>
                    ) : i.persen === null && i.materi.cara !== 'kitab' ? (
                      <small>Belum ditetapkan Kurikulum</small>
                    ) : (
                      <Tombol kecil varian={i.dinilai && !i.dariPeriode ? 'kedua' : 'utama'} onClick={() => setEdit(i)}>
                        {i.persen === null ? (i.dinilai ? 'Ubah (belum ditetapkan)' : 'Nilai (belum ditetapkan)') : i.dinilai ? fmt(i.persen) : 'Nilai'}
                      </Tombol>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {x!.sisaSebelumnya ? (
              <>
                <h3>Belum tuntas dari {LABEL_JENJANG[x!.sisaSebelumnya.jenjang]}</h3>
                <ul className="daftar-rapor">
                  {x!.sisaSebelumnya.items.map((i) => (
                    <li key={i.materi.id}>
                      <div>
                        <span>{i.materi.nama}</span>
                        <Tombol kecil varian="kedua" onClick={() => setEdit(i)}>
                          {fmt(i.persen)}
                        </Tombol>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </Kartu>
        )}
      </KeadaanData>
      {edit ? <EditorEvaluasi generusId={p.g.id} item={edit} periode={p.periode} selesai={() => setEdit(null)} /> : null}
      {rapor ? (
        <Modal judul={`Laporan Hasil Belajar ${p.g.nama}`} tutup={() => setRapor(false)}>
          <RaporHp generusId={p.g.id} />
        </Modal>
      ) : null}
    </>
  )
}

// ---------------------------------------------------------------- Laporan bulanan

const PILIH_TERLAKSANA: { nilai: 'ya' | 'tidak' | 'belum'; teks: string }[] = [
  { nilai: 'ya', teks: 'Terlaksana' },
  { nilai: 'tidak', teks: 'Tidak' },
  { nilai: 'belum', teks: 'Belum diisi' },
]
const keSegmen = (b: boolean | null) => (b === true ? 'ya' : b === false ? 'tidak' : 'belum')
const dariSegmen = (v: string) => (v === 'ya' ? true : v === 'tidak' ? false : null)

function IsianMusyawarah(p: { judul: string; nilai: MusyawarahBulanan; ubah: (m: MusyawarahBulanan) => void; denganCatatan?: boolean }) {
  return (
    <div className="isian-musyawarah">
      <strong>{p.judul}</strong>
      <Segmen label={p.judul} kecil nilai={keSegmen(p.nilai.terlaksana)} ubah={(v) => p.ubah({ ...p.nilai, terlaksana: dariSegmen(v) })} pilihan={PILIH_TERLAKSANA} />
      {p.denganCatatan && p.nilai.terlaksana ? (
        <>
          <Isian label="Tanggal" type="date" nilai={p.nilai.tanggal ?? ''} ubah={(v) => p.ubah({ ...p.nilai, tanggal: v || null })} />
          <AreaTeks label="Hasil musyawarah" nilai={p.nilai.catatan ?? ''} ubah={(v) => p.ubah({ ...p.nilai, catatan: v })} />
        </>
      ) : null}
    </div>
  )
}

/** Laporan bulanan kelompok — ikut Setor ke desa → daerah. */
export function LaporanBulananHp(p: { kembali: () => void }) {
  const { db, profil, aksi } = useApp()
  const kel = profil.wilayah_id
  const [bulan, setBulan] = useState(tanggalHariIni().slice(0, 7))
  const awal = useData(() => ambilLaporanBulanan(db, kel, bulan), [kel, bulan])
  return (
    <>
      <JudulHalaman judul="Laporan Bulanan" keterangan="Musyawaroh 5 Unsur, Muda/i, dan NUNGGONI. Ikut terkirim saat Setor." kembali={p.kembali} />
      <div className="nav-pekan">
        <Tombol kecil varian="kedua" onClick={() => setBulan(geserBulan(bulan, -1))} label="Bulan sebelumnya">
          ‹
        </Tombol>
        <span>{teksBulan(bulan)}</span>
        <Tombol kecil varian="kedua" disabled={bulan >= tanggalHariIni().slice(0, 7)} onClick={() => setBulan(geserBulan(bulan, 1))} label="Bulan berikutnya">
          ›
        </Tombol>
      </div>
      <KeadaanData hasil={awal}>
        {(a) => (
          <FormLaporan
            key={`${bulan}-${a.diubah_pada ?? ''}`}
            awal={a.isi}
            ada={a.ada}
            simpan={(isi) => aksi(() => simpanLaporanBulanan(db, { kelompokId: kel, bulan, isi }), 'Laporan bulan ini tersimpan. Jangan lupa Setor.')}
          />
        )}
      </KeadaanData>
    </>
  )
}

export function FormLaporan(p: { awal: IsiLaporanBulanan; ada: boolean; simpan: (isi: IsiLaporanBulanan) => Promise<unknown> }) {
  const [isi, setIsi] = useState<IsiLaporanBulanan>(p.awal)
  const [nama, setNama] = useState('')
  const [unsur, setUnsur] = useState<UnsurNunggoni>('4S Kelompok')
  const [tgl, setTgl] = useState('')
  const [kelas, setKelas] = useState('')
  const [temuan, setTemuan] = useState('')
  return (
    <>
      {!p.ada ? <Spanduk jenis="info">Laporan bulan ini belum diisi.</Spanduk> : null}
      <Kartu judul="Musyawaroh">
        <IsianMusyawarah judul="Musyawaroh 5 Unsur" nilai={isi.mus5} ubah={(m) => setIsi({ ...isi, mus5: m })} denganCatatan />
        <IsianMusyawarah judul="Muda/i kelompok" nilai={isi.musMuda.kelompok} ubah={(m) => setIsi({ ...isi, musMuda: { ...isi.musMuda, kelompok: m } })} />
        <IsianMusyawarah judul="Muda/i desa" nilai={isi.musMuda.desa} ubah={(m) => setIsi({ ...isi, musMuda: { ...isi.musMuda, desa: m } })} />
        <IsianMusyawarah judul="Muda/i daerah" nilai={isi.musMuda.daerah} ubah={(m) => setIsi({ ...isi, musMuda: { ...isi.musMuda, daerah: m } })} />
      </Kartu>
      <Kartu judul={`NUNGGONI (${isi.nunggoni.length})`}>
        <p className="keterangan">MS & pengurus yang sudah menunggui 1 KBM bulan ini.</p>
        {isi.nunggoni.length ? (
          <ul className="daftar-sederhana">
            {isi.nunggoni.map((n, i) => (
              <li key={i}>
                <span>
                  <b>{n.nama}</b> · {n.unsur}
                  {n.tanggal ? ` · ${tanggalTeks(n.tanggal)}` : ''}
                  {n.kelas ? ` · ${n.kelas}` : ''}
                  {n.temuan ? <small> — {n.temuan}</small> : null}
                </span>
                <Tombol kecil varian="bahaya" onClick={() => setIsi({ ...isi, nunggoni: isi.nunggoni.filter((_, j) => j !== i) })}>
                  Hapus
                </Tombol>
              </li>
            ))}
          </ul>
        ) : null}
        <Isian label="Nama" nilai={nama} ubah={setNama} maxLength={100} />
        <Pilihan label="Unsur" nilai={unsur} ubah={(v) => setUnsur(v as UnsurNunggoni)} pilihan={UNSUR_NUNGGONI.map((u) => ({ nilai: u, teks: u }))} />
        <Isian label="Tanggal" type="date" nilai={tgl} ubah={setTgl} />
        <Isian label="Kelas yang ditunggui" nilai={kelas} ubah={setKelas} placeholder="mis. Caberawit B" />
        <AreaTeks label="Temuan / saran" nilai={temuan} ubah={setTemuan} baris={2} />
        <Tombol
          penuh
          varian="kedua"
          disabled={!nama.trim()}
          onClick={() => {
            setIsi({ ...isi, nunggoni: [...isi.nunggoni, { nama: nama.trim(), unsur, tanggal: tgl || null, kelas: kelas || null, temuan: temuan || null }] })
            setNama('')
            setTgl('')
            setKelas('')
            setTemuan('')
          }}
        >
          + Tambah ke daftar
        </Tombol>
      </Kartu>
      <Kartu>
        <AreaTeks label="Catatan lain" nilai={isi.catatan ?? ''} ubah={(v) => setIsi({ ...isi, catatan: v })} />
        <Tombol penuh onClick={() => p.simpan(isi)}>
          Simpan laporan
        </Tombol>
      </Kartu>
    </>
  )
}
