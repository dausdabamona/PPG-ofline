// §16 — Juknis Pembinaan 2025 di HP: kartu Kejar Target, Lembar Kontrol Keaktifan (murid/orang tua), Laporan Hasil
// Belajar (raport), isian Evaluasi Semester (mubaligh), dan Laporan Bulanan kelompok.
import { useState } from 'react'
import {
  aturCatatanSholat,
  catatanSholatBulan,
  catatKeaktifan,
  hapusAjuanKeaktifan,
  hariDalamBulan,
  KODE_KEAKTIFAN,
  kodeUntukJenjang,
  kejarTarget,
  keaktifanBulan,
  ambilGenerus,
  daftarKeaktifan,
  periodeAktif,
  raporGenerus,
  raporPdf,
  slug,
  simpanEvaluasi,
  tanggalHariIni,
  BATAS_SUBJEKTIF,
  HALAMAN_PER_JUZ,
  LABEL_JENJANG,
  WAKTU_SHOLAT,
  predikatAngka,
  type AmbangPredikat,
  type BarisKarakter,
  type Rapor,
  type HasilEvaluasiInput,
  type ItemRapor,
  type KodeKeaktifan,
  type WaktuSholat,
} from '@ppg/core'
import { useApp, useData } from '../konteks'
import { BilahPersen, Isian, KeadaanData, Kartu, Lencana, Modal, Pilihan, Spanduk, Tombol } from './ui'
import { tanggalTeks } from '../utils/label'

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
export const teksBulan = (b: string) => `${NAMA_BULAN[Number(b.slice(5, 7)) - 1]} ${b.slice(0, 4)}`
export function geserBulan(b: string, n: number): string {
  const d = new Date(Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
export function teksPeriode(p: string): string {
  const y = Number(p.slice(0, 4))
  return p.endsWith('S1') ? `Semester 1 (Jul–Des ${y})` : `Semester 2 (Jan–Jun ${y + 1})`
}
export function periodeSebelumnya(p: string): string {
  const y = Number(p.slice(0, 4))
  return p.endsWith('S2') ? `${y}-S1` : `${y - 1}-S2`
}
const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${String(n).replace('.', ',')}%`)

/** Kartu "Kejar target" — tampil mulai tanggal 20 bila keaktifan bulan ini belum mencapai target (J-T8). */
export function KartuKejarTarget(p: { generusId: string; nama?: string }) {
  const { db } = useApp()
  const k = useData(() => kejarTarget(db, p.generusId), [p.generusId]).data
  if (!k) return null
  return (
    <Spanduk jenis={k.terkejar ? 'peringatan' : 'bahaya'}>
      <b>Kejar target keaktifan{p.nama ? ` — ${p.nama}` : ''}!</b> Baru {k.jumlah} dari {k.target} kali bulan ini. Perlu {k.kurang} kali lagi, sisa{' '}
      {k.sisaHari} hari.{' '}
      {k.terkejar ? 'Isi lembar kontrol setiap hari (mengaji mandiri atau ikut pengajian).' : 'Target bulan ini sudah tidak terkejar — tetap isi sebanyak mungkin.'}
    </Spanduk>
  )
}

/** Ringkasan keaktifan bulan ini + tombol membuka Lembar Kontrol. */
export function KartuKeaktifan(p: { generusId: string; bolehIsi: boolean }) {
  const { db } = useApp()
  const bulan = tanggalHariIni().slice(0, 7)
  const k = useData(() => keaktifanBulan(db, p.generusId, bulan), [p.generusId, bulan])
  const [buka, setBuka] = useState(false)
  return (
    <Kartu judul={`Keaktifan ${teksBulan(bulan)}`}>
      <KeadaanData hasil={k}>
        {(x) => (
          <>
            <p>
              <b>{x.jumlah}</b> dari {x.target} kali · <b>{fmt(x.persen)}</b>
              {x.menunggu ? (
                <>
                  {' '}
                  · <Lencana warna="kuning">{x.menunggu} menunggu disahkan</Lencana>
                </>
              ) : null}
            </p>
            <BilahPersen persen={x.persen} label="Keaktifan bulan ini" />
          </>
        )}
      </KeadaanData>
      <Tombol penuh varian="kedua" onClick={() => setBuka(true)}>
        {p.bolehIsi ? 'Isi Lembar Kontrol' : 'Lihat Lembar Kontrol'}
      </Tombol>
      {buka ? <LembarKontrol generusId={p.generusId} bolehIsi={p.bolehIsi} tutup={() => setBuka(false)} /> : null}
    </Kartu>
  )
}

/**
 * Lembar Kontrol Keaktifan digital (gambar juknis): per hari kode keaktifan (A dari absen, mandiri diajukan murid) dan
 * centang sholat 5 waktu (catatan pribadi/orang tua — lokal, tidak masuk nilai).
 */
export function LembarKontrol(p: { generusId: string; bolehIsi: boolean; tutup: () => void }) {
  const { db, aksi } = useApp()
  const [bulan, setBulan] = useState(tanggalHariIni().slice(0, 7))
  const [isi, setIsi] = useState<string | null>(null)
  const g = useData(() => ambilGenerus(db, p.generusId), [p.generusId]).data
  const k = useData(() => keaktifanBulan(db, p.generusId, bulan), [p.generusId, bulan])
  const sholat = useData(() => catatanSholatBulan(db, p.generusId, bulan), [p.generusId, bulan]).data ?? {}
  const hariIni = tanggalHariIni()
  const n = hariDalamBulan(bulan)
  const tanggal = Array.from({ length: n }, (_, i) => `${bulan}-${String(i + 1).padStart(2, '0')}`).filter((t) => t <= hariIni)
  const perHari = new Map(k.data?.hari.map((h) => [h.tanggal, h]) ?? [])
  const ubahSholat = (t: string, w: WaktuSholat) => {
    const ada = sholat[t] ?? []
    void aksi(() => aturCatatanSholat(db, p.generusId, t, ada.includes(w) ? ada.filter((x) => x !== w) : [...ada, w]))
  }
  return (
    <Modal judul={`Lembar Kontrol ${g?.nama ?? ''}`} tutup={p.tutup}>
      <div className="nav-pekan">
        <Tombol kecil varian="kedua" onClick={() => setBulan(geserBulan(bulan, -1))} label="Bulan sebelumnya">
          ‹
        </Tombol>
        <span>{teksBulan(bulan)}</span>
        <Tombol kecil varian="kedua" disabled={bulan >= hariIni.slice(0, 7)} onClick={() => setBulan(geserBulan(bulan, 1))} label="Bulan berikutnya">
          ›
        </Tombol>
      </div>
      {k.data ? (
        <p className="keterangan">
          Keaktifan: <b>{k.data.jumlah}</b>/{k.data.target} kali ({fmt(k.data.persen)}). Satu hari dihitung satu kali. Sholat 5 waktu hanya catatan
          pribadi (tidak masuk nilai, tidak dikirim).
        </p>
      ) : null}
      <ul className="lembar-kontrol">
        {[...tanggal].reverse().map((t) => {
          const h = perHari.get(t)
          return (
            <li key={t} className={h?.dihitung ? 'terhitung' : ''}>
              <div className="lk-tgl">
                <b>{Number(t.slice(8))}</b>
                <small>{tanggalTeks(t).split(',')[0]}</small>
              </div>
              <div className="lk-kode">
                {h?.kode.map((x) => (
                  <Lencana key={x} warna="hijau">
                    {x}
                  </Lencana>
                ))}
                {h?.diajukan.map((x) => (
                  <Lencana key={`d${x}`} warna="kuning">
                    {x}?
                  </Lencana>
                ))}
                {h?.izin ? <Lencana warna="abu">Izin</Lencana> : null}
                {p.bolehIsi ? (
                  <Tombol kecil varian="kedua" onClick={() => setIsi(t)} label={`Isi ${t}`}>
                    +
                  </Tombol>
                ) : null}
              </div>
              <div className="lk-sholat" role="group" aria-label={`Sholat ${t}`}>
                {WAKTU_SHOLAT.map((w) => (
                  <button key={w} type="button" className={(sholat[t] ?? []).includes(w) ? 'terpilih' : ''} aria-pressed={(sholat[t] ?? []).includes(w)} onClick={() => ubahSholat(t, w)}>
                    {w}
                  </button>
                ))}
              </div>
            </li>
          )
        })}
      </ul>
      {isi && g ? <IsiKeaktifan generusId={p.generusId} jenjang={g.kategori} tanggal={isi} tutup={() => setIsi(null)} /> : null}
    </Modal>
  )
}

function IsiKeaktifan(p: { generusId: string; jenjang: string; tanggal: string; tutup: () => void }) {
  const { db, aksi } = useApp()
  const kode = kodeUntukJenjang(p.jenjang).filter((k) => k !== 'A')
  const [pilih, setPilih] = useState<KodeKeaktifan>(kode[0] ?? 'B')
  const [ket, setKet] = useState('')
  const ajuan = useData(
    () => daftarKeaktifan(db, { generusIds: [p.generusId], mulai: p.tanggal, selesai: p.tanggal, status: 'diajukan' }),
    [p.generusId, p.tanggal],
  ).data
  return (
    <Modal judul={`Isi ${tanggalTeks(p.tanggal)}`} tutup={p.tutup}>
      <Pilihan label="Kegiatan" nilai={pilih} ubah={(v) => setPilih(v as KodeKeaktifan)} pilihan={kode.map((k) => ({ nilai: k, teks: `${k} — ${KODE_KEAKTIFAN[k].nama}` }))} />
      <Isian label="Keterangan (boleh kosong)" nilai={ket} ubah={setKet} placeholder="mis. surat yang diulang, halaman yang dibaca" maxLength={200} />
      <Tombol
        penuh
        onClick={async () => {
          const r = await aksi(() => catatKeaktifan(db, { generusId: p.generusId, tanggal: p.tanggal, kode: pilih, keterangan: ket, sebagai: 'murid' }), 'Tercatat. Setor Belajar agar disahkan mubaligh.')
          if (r) p.tutup()
        }}
      >
        Simpan
      </Tombol>
      {ajuan?.length ? (
        <ul className="daftar-sederhana">
          {ajuan.map((a) => (
            <li key={a.id}>
              <span>
                {a.kode} {a.keterangan ? `· ${a.keterangan}` : ''}
              </span>
              <Tombol kecil varian="bahaya" onClick={() => void aksi(() => hapusAjuanKeaktifan(db, a.id), 'Ajuan dihapus.')}>
                Hapus
              </Tombol>
            </li>
          ))}
        </ul>
      ) : null}
    </Modal>
  )
}

/**
 * §19 (J-C15): raport resmi PDF dibuat di HP (offline) — "Simpan PDF / Cetak" membuka PDF di aplikasi pembaca PDF (menu
 * Cetak Android ada di sana), "Bagikan PDF" lewat lembar bagikan (WA).
 */
export function TombolPdfRaport(p: { generusIds: string[]; periode: string; namaBerkas: string; teksCetak?: string }) {
  const { db, platform, aksi } = useApp()
  const nama = `Raport_${slug(p.namaBerkas)}_${p.periode}.pdf`
  const buat = () => raporPdf(db, { generusIds: p.generusIds, periode: p.periode })
  return (
    <div className="aksi-dua">
      <Tombol
        varian="kedua"
        disabled={!p.generusIds.length || !p.periode}
        onClick={async () => {
          const b = await aksi(buat)
          if (b) await aksi(() => platform.bukaPdf(nama, b))
        }}
      >
        {p.teksCetak ?? 'Simpan PDF / Cetak'}
      </Tombol>
      <Tombol
        varian="kedua"
        disabled={!p.generusIds.length || !p.periode}
        onClick={async () => {
          const b = await aksi(buat)
          if (b) await aksi(() => platform.bagikanBerkas([{ nama, bytes: b }], 'Kirim raport'))
        }}
      >
        Bagikan PDF (WA)
      </Tombol>
    </div>
  )
}

const fmtNilai = (n: number | null | undefined) => (n === null || n === undefined ? 'belum dinilai' : `${String(n).replace('.', ',')}`)

/** Satu baris ringkas aspek: label · nilai · predikat (K17). */
function BarisAspek(p: { label: string; nilai: number | null; ambang: AmbangPredikat; sub?: boolean; akhir?: boolean }) {
  const pr = predikatAngka(p.nilai, p.ambang)
  return (
    <li className={`aspek${p.sub ? ' aspek-sub' : ''}${p.akhir ? ' aspek-akhir' : ''}`}>
      <span>{p.label}</span>
      <b>{fmtNilai(p.nilai)}</b>
      {pr ? <Lencana warna={pr === 'Perlu Bimbingan' ? 'kuning' : pr === 'Cukup' ? 'abu' : 'hijau'}>{pr}</Lencana> : <small>—</small>}
    </li>
  )
}

function DaftarKarakter(p: { judul: string; baris: BarisKarakter[] }) {
  return (
    <>
      <h3 className="judul-kecil">{p.judul}</h3>
      <ul className="daftar-karakter">
        {p.baris.map((b) => (
          <li key={b.kode}>
            <div>
              <span>{b.nama}</span>
              {b.label ? <Lencana warna={b.predikat === 'perlu_bimbingan' ? 'kuning' : b.predikat === 'cukup' ? 'abu' : 'hijau'}>{b.label}</Lencana> : <small>belum dinilai</small>}
            </div>
            {b.catatan ? <small>{b.catatan}</small> : null}
          </li>
        ))}
      </ul>
    </>
  )
}

/**
 * Laporan Hasil Belajar (raport) per semester — §20.4: ringkasan Tri Sukses Generus + Nilai Akhir, Karakter Luhur,
 * keaktifan, catatan mubaligh; Rincian Penguasaan Materi bisa dibuka (lipat). Tampil di HP murid/orang tua & mubaligh.
 */
export function RaporHp(p: { generusId: string }) {
  const { db } = useApp()
  const aktif = useData(() => periodeAktif(db), []).data ?? ''
  const [periode, setPeriode] = useState('')
  const per = periode || aktif
  const r = useData(() => (per ? raporGenerus(db, p.generusId, { periode: per }) : null), [p.generusId, per])
  return (
    <>
      {aktif ? (
        <Pilihan
          label="Semester"
          nilai={per}
          ubah={setPeriode}
          pilihan={[aktif, periodeSebelumnya(aktif), periodeSebelumnya(periodeSebelumnya(aktif))].map((x) => ({ nilai: x, teks: teksPeriode(x) }))}
        />
      ) : null}
      {per ? <TombolPdfRaport generusIds={[p.generusId]} periode={per} namaBerkas={ambilGenerus(db, p.generusId)?.nama ?? 'generus'} /> : null}
      <KeadaanData hasil={r} kosong={(d) => !d} teksKosong="Data belum ada.">
        {(x) =>
          !x!.jenjang ? (
            <Spanduk jenis="peringatan">Jenjang belum ditetapkan (Caberawit A/B/C). Minta mubaligh menetapkan jenjang.</Spanduk>
          ) : x!.items.length === 0 ? (
            <Spanduk jenis="info">Daftar materi evaluasi belum ada di HP ini. Buka berkas materi/balasan terbaru.</Spanduk>
          ) : (
            <IsiRaporHp r={x!} />
          )
        }
      </KeadaanData>
    </>
  )
}

function IsiRaporHp(p: { r: Rapor }) {
  const x = p.r
  const t = x.triSukses
  const k = x.karakter
  const pendukung: string[] = []
  if (x.pendukung.keaktifan !== null) pendukung.push(`Keaktifan pengajian semester ${fmt(x.pendukung.keaktifan)} — data pendukung "Mempersungguh hidayah".`)
  if (x.pendukung.mandiriHari > 0) pendukung.push(`Kegiatan mandiri tercatat & disahkan: ${x.pendukung.mandiriHari} hari.`)
  if (x.pendukung.sholat) pendukung.push(`Catatan sholat di HP ini: ${x.pendukung.sholat.hari} hari, rata-rata ${String(x.pendukung.sholat.rataWaktu).replace('.', ',')} waktu/hari (keterangan, tidak dinilai).`)
  return (
    <>
      <Kartu judul={`Tri Sukses Generus · ${LABEL_JENJANG[x.jenjang!] ?? x.jenjang}`}>
        <p className="nilai-akhir">
          Nilai Akhir <b>{fmtNilai(x.total)}</b> {predikatAngka(x.total, x.ambang) ? <Lencana warna="teal">{predikatAngka(x.total, x.ambang)}</Lencana> : null}
        </p>
        {x.total !== null ? <BilahPersen persen={x.total} label="Nilai Akhir" /> : null}
        <ul className="daftar-aspek">
          <BarisAspek label="1. Alim-Faqih" nilai={t.alimFaqih} ambang={x.ambang} />
          <BarisAspek label="Alim (mankul & hafalan)" nilai={t.alim} ambang={x.ambang} sub />
          <BarisAspek label="Faqih (kefahaman & praktik ibadah)" nilai={t.faqih} ambang={x.ambang} sub />
          <BarisAspek label="2. Akhlaqul Karimah" nilai={t.akhlak} ambang={x.ambang} />
          <BarisAspek label="3. Mandiri" nilai={t.mandiri} ambang={x.ambang} />
        </ul>
        <p className="keterangan">
          Evaluasi bulan {NAMA_BULAN[x.bulanEvaluasi - 1]}. {t.rumus === 'rata_materi' ? 'Nilai Akhir = rata-rata semua butir materi yang dinilai.' : 'Nilai Akhir = rata-rata 3 aspek Tri Sukses Generus.'} Butir yang
          belum dinilai tidak ikut dihitung.
        </p>
      </Kartu>
      {k ? (
        <Kartu judul={`Karakter Luhur${k.targetJenjang ? ` · Target jenjang: ${k.targetJenjang}` : ''}`}>
          <DaftarKarakter judul="4 Tali Keimanan" baris={k.tali} />
          {pendukung.length ? <p className="keterangan">Data pendukung: {pendukung.join(' ')}</p> : null}
          <DaftarKarakter judul="6 Thobiat Luhur (praktik sehari-hari)" baris={k.thobiat} />
          <p className="keterangan">Dinilai mubaligh: Baik · Cukup · Perlu Bimbingan. Tidak dihitung ke Nilai Akhir.</p>
        </Kartu>
      ) : null}
      <Kartu judul="Keaktifan & catatan mubaligh">
        <p>
          Keaktifan semester: <b>{x.keaktifan?.persen === null || x.keaktifan?.persen === undefined ? 'belum ada data' : fmt(x.keaktifan.persen)}</b>
        </p>
        <p className="catatan-mt">{k?.catatanMubaligh ?? 'Belum ada catatan mubaligh.'}</p>
      </Kartu>
      <details className="rincian-lipat">
        <summary>Rincian Penguasaan Materi</summary>
        {x.belumDitetapkan.length ? <Spanduk jenis="info">Materi {x.belumDitetapkan.join(', ')} belum ditetapkan Kurikulum — tidak ikut dihitung.</Spanduk> : null}
        {t.bagian
          .filter((b) => b.items.length)
          .map((b) => (
            <section key={b.kode} className="rincian-bagian">
              <h3 className="judul-kecil">
                {b.judul} <small>· {fmtNilai(b.nilai)}</small>
              </h3>
              <ul className="daftar-rapor">
                {b.items.map((i) => (
                  <BarisRapor key={i.materi.id} i={i} />
                ))}
              </ul>
            </section>
          ))}
        {x.sisaSebelumnya ? (
          <section className="rincian-bagian">
            <h3 className="judul-kecil">Belum tuntas dari {LABEL_JENJANG[x.sisaSebelumnya.jenjang]}</h3>
            <ul className="daftar-rapor">
              {x.sisaSebelumnya.items.map((i) => (
                <BarisRapor key={i.materi.id} i={i} />
              ))}
            </ul>
          </section>
        ) : null}
      </details>
    </>
  )
}

function BarisRapor(p: { i: ItemRapor }) {
  const { i } = p
  return (
    <li>
      <div>
        <span>{i.materi.nama}</span>
        {i.belumDitetapkan ? <small className="nilai-bd">belum ditetapkan</small> : i.persen === null ? <small className="nilai-bd">belum dinilai</small> : <b>{fmt(i.persen)}</b>}
      </div>
      {i.persen !== null ? <BilahPersen kecil persen={i.persen} label={i.materi.nama} /> : null}
      {i.dariPeriode ? <small>Nilai dari {teksPeriode(i.dariPeriode)}</small> : null}
    </li>
  )
}

/** Tombol + modal raport. */
export function TombolRapor(p: { generusId: string; nama: string }) {
  const [buka, setBuka] = useState(false)
  return (
    <>
      <Tombol penuh varian="kedua" onClick={() => setBuka(true)}>
        Laporan Hasil Belajar
      </Tombol>
      {buka ? (
        <Modal judul={`Laporan Hasil Belajar ${p.nama}`} tutup={() => setBuka(false)}>
          <RaporHp generusId={p.generusId} />
        </Modal>
      ) : null}
    </>
  )
}

/** Isian hasil evaluasi satu materi (mubaligh). */
export function EditorEvaluasi(p: { generusId: string; item: ItemRapor; periode: string; selesai: () => void }) {
  const { db, aksi } = useApp()
  const m = p.item.materi
  const awal = p.item.input ?? {}
  const [dikuasai, setDikuasai] = useState(awal.dikuasai !== null && awal.dikuasai !== undefined ? String(awal.dikuasai) : '')
  const [nilai, setNilai] = useState(awal.nilai ? String(awal.nilai) : '')
  const [butir, setButir] = useState<number[]>(((awal.rincian as { butir?: number[] } | null)?.butir ?? []) as number[])
  const [rincian, setRincian] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries((m.cara === 'juz' || m.cara === 'kitab' ? awal.rincian : null) ?? {}).map(([k, v]) => [k, String(v)])),
  )
  const adaButir = m.cara === 'hitungan' && (m.rincian.butir?.length ?? 0) > 0
  const simpan = async () => {
    const input: HasilEvaluasiInput = {}
    if (m.cara === 'subjektif') input.nilai = nilai ? Number(nilai) : null
    else if (m.cara === 'hitungan') {
      if (adaButir) input.rincian = { butir: [...butir].sort((a, b) => a - b) }
      else input.dikuasai = dikuasai === '' ? 0 : Number(dikuasai)
    } else input.rincian = Object.fromEntries(Object.entries(rincian).filter(([, v]) => v !== '' && Number(v) > 0).map(([k, v]) => [k, Number(v)]))
    const r = await aksi(() => simpanEvaluasi(db, { generusId: p.generusId, materiEvaluasiId: m.id, periode: p.periode, ...input }), 'Nilai tersimpan.')
    if (r) p.selesai()
  }
  return (
    <Modal judul={m.nama} tutup={p.selesai} aksi={<Tombol onClick={simpan}>Simpan</Tombol>}>
      {m.rincian.sub?.length ? <p className="keterangan">Sub-target: {m.rincian.sub.join(' · ')}</p> : null}
      {m.cara === 'subjektif' ? (
        <Isian label={`Nilai penguji (1–${BATAS_SUBJEKTIF}%)`} type="number" inputMode="numeric" min={1} max={BATAS_SUBJEKTIF} nilai={nilai} ubah={setNilai} bantuan="Nilai subjektif penguji, paling tinggi 75% (juknis)." />
      ) : null}
      {m.cara === 'hitungan' && !adaButir ? (
        <Isian label={`Jumlah ${m.satuan ?? 'materi'} dikuasai (target ${m.target ?? '—'})`} type="number" inputMode="numeric" min={0} max={m.target ?? undefined} nilai={dikuasai} ubah={setDikuasai} />
      ) : null}
      {adaButir ? (
        <>
          <p className="keterangan">
            Centang yang dikuasai: <b>{butir.length}</b> dari {m.target}
          </p>
          <ul className="daftar-centang">
            {m.rincian.butir!.map((b, i) => (
              <li key={i}>
                <label>
                  <input type="checkbox" checked={butir.includes(i)} onChange={(e) => setButir(e.target.checked ? [...butir, i] : butir.filter((x) => x !== i))} />
                  {i + 1}. {b}
                </label>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {m.cara === 'juz' ? (
        <>
          <p className="keterangan">Halaman makna PENUH per juz (0–{HALAMAN_PER_JUZ}). Halaman yang maknanya belum penuh tidak dihitung.</p>
          <div className="kisi-isian">
            {(m.rincian.juz ?? []).map((j) => (
              <Isian key={j} label={`Juz ${j}`} type="number" inputMode="numeric" min={0} max={HALAMAN_PER_JUZ} nilai={rincian[String(j)] ?? ''} ubah={(v) => setRincian({ ...rincian, [String(j)]: v })} />
            ))}
          </div>
        </>
      ) : null}
      {m.cara === 'kitab' ? (
        <>
          <p className="keterangan">Halaman makna penuh tiap kitab (selain sanad).</p>
          {(m.rincian.kitab ?? []).map((k, i) => (
            <Isian
              key={i}
              label={`${k.nama} (dari ${k.halaman ?? '?'} hal.)`}
              type="number"
              inputMode="numeric"
              min={0}
              max={k.halaman ?? 0}
              nilai={rincian[String(i)] ?? ''}
              ubah={(v) => setRincian({ ...rincian, [String(i)]: v })}
              bantuan={k.halaman === null ? 'Jumlah halaman kitab belum diisi Kurikulum.' : undefined}
            />
          ))}
        </>
      ) : null}
    </Modal>
  )
}
