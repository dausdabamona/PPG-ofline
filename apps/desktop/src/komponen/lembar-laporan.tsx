// §19 (Fase 13) — tampilan cetak Laporan Bulanan format lembar (semirip mungkin dengan lembar cetakan daerah) dan
// Raport resmi. Komponen murni (tanpa konteks aplikasi) agar bisa diuji & dirender ke HTML statis.
import { Fragment, type ReactNode } from 'react'
import {
  KODE_KEAKTIFAN,
  kodeUntukJenjang,
  type BlokLembar,
  type FormatLembar,
  type LembarLaporanKelompok,
  type RaportCetak,
  namaMubalighSampul,
} from '@ppg/core'
import './lembar-laporan.css'

const BARIS_MIN = 10
/** Batas baris (anak + kepala) agar dua blok muat satu halaman A4 lanskap. */
const BATAS_HALAMAN = 36

const pr = (n: number | null | undefined) => (n === null || n === undefined ? '' : `${String(Math.round(n)).replace('.', ',')}%`)

function barisBlok(b: BlokLembar): number {
  return Math.max(b.baris.length, BARIS_MIN) + 4
}

/** Kelompokkan blok ke halaman: dua blok berurutan satu halaman bila muat (J-C6). */
export function susunHalaman(blok: BlokLembar[]): BlokLembar[][] {
  const hal: BlokLembar[][] = []
  let kini: BlokLembar[] = []
  let isi = 0
  for (const b of blok) {
    const n = barisBlok(b)
    if (kini.length && (kini.length >= 2 || isi + n > BATAS_HALAMAN)) {
      hal.push(kini)
      kini = []
      isi = 0
    }
    kini.push(b)
    isi += n
  }
  if (kini.length) hal.push(kini)
  return hal
}

function Legenda(p: { blok: BlokLembar[] }) {
  const kode = [...new Set(p.blok.flatMap((b) => kodeUntukJenjang(b.jenjang)))].filter((k) => k !== 'IZ')
  return (
    <p className="lb-legenda">
      <b>Kode kegiatan:</b> {kode.map((k) => `${k} = ${KODE_KEAKTIFAN[k].nama}`).join(' · ')} · IZ = izin (tidak dihitung). Satu hari dihitung satu kali.
    </p>
  )
}

function KepalaBlok(p: { l: LembarLaporanKelompok; b: BlokLembar; kolom: number }) {
  return (
    <tr className="lb-pita">
      <th colSpan={p.kolom}>
        <span className="lb-judul">
          {p.b.judul} {p.b.sub ? <span className="lb-sub">{p.b.sub}</span> : null}
        </span>
        <span className="lb-klp">
          # KLP : {p.l.kelompok.nama.toUpperCase()} &nbsp; BULAN : {p.l.teksBulan}
        </span>
      </th>
    </tr>
  )
}

function KakiBlok(p: { b: BlokLembar; kolomKiri: number; kolomSlot: number }) {
  const r = p.b.ringkasIqro
  return (
    <tr className="lb-kaki">
      <td colSpan={p.kolomKiri + p.kolomSlot}>
        <div className="lb-kaki-isi">
          {r ? (
            r.map((n, i) => (
              <span key={i} className="lb-iqro">
                IQRO' {i + 1} : <b>{n || ''}</b> ORG
              </span>
            ))
          ) : (
            <span />
          )}
          <span className="lb-total">Total</span>
        </div>
      </td>
      <td className="lb-angka lb-tebal">{pr(p.b.total.keaktifan)}</td>
      <td className="lb-angka lb-tebal">{pr(p.b.total.materi)}</td>
    </tr>
  )
}

function BlokUrutan(p: { l: LembarLaporanKelompok; b: BlokLembar }) {
  const { b } = p
  const n = b.jumlahSlot
  const kosong = Math.max(0, BARIS_MIN - b.baris.length)
  return (
    <table className="lb-tabel lb-urutan">
      <colgroup>
        <col className="c-no" />
        <col className="c-nama" />
        <col className="c-umur" />
        {b.kecil ? <col className="c-iqro" /> : null}
        {Array.from({ length: n }, (_, i) => (
          <col key={i} className="c-slot" />
        ))}
        <col className="c-persen" />
        <col className="c-persen" />
      </colgroup>
      <thead>
        <KepalaBlok l={p.l} b={b} kolom={(b.kecil ? 4 : 3) + n + 2} />
        <tr className="lb-kepala">
          <th rowSpan={2}>
            N<br />O
          </th>
          <th rowSpan={2} colSpan={b.kecil ? 3 : 2}>
            {b.kecil ? "NAMA + UMUR + IQRO'" : 'NAMA + UMUR'}
          </th>
          <th colSpan={n} className="lb-target">
            TARGET KEAKTIFAN <span>( isi sesuai kode kegiatan yg dilaksanakan &gt; lihat penjelasan ) · target {b.target} kali/bulan</span>
          </th>
          <th rowSpan={2}>
            %<br />
            Keaktifan
          </th>
          <th rowSpan={2}>
            %<br />
            Peng. Materi
          </th>
        </tr>
        <tr className="lb-kepala lb-nomor">
          {Array.from({ length: n }, (_, i) => (
            <th key={i}>{i + 1}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {b.baris.map((x) => (
          <tr key={x.generus_id}>
            <td className="lb-no">{x.no}</td>
            <td className="lb-nama">
              {x.nama}
              {x.jenjangPerluDitetapkan ? <small> (perlu ditetapkan)</small> : null}
            </td>
            <td className="lb-tengah">{x.umur ?? ''}</td>
            {b.kecil ? <td className="lb-tengah lb-kecil">{x.iqroKode === 'alquran' ? 'AQ' : (x.iqroKode ?? '')}</td> : null}
            {Array.from({ length: n }, (_, i) => (
              <td key={i} className={`lb-kode ${(x.urutan[i]?.length ?? 0) > 3 ? 'lb-panjang' : ''}`}>
                {x.urutan[i] ?? ''}
              </td>
            ))}
            <td className="lb-angka">{pr(x.persenKeaktifan)}</td>
            <td className="lb-angka">{pr(x.persenMateri)}</td>
          </tr>
        ))}
        {Array.from({ length: kosong }, (_, k) => (
          <tr key={`k${k}`} className="lb-kosong">
            <td className="lb-no">{b.baris.length + k + 1}</td>
            <td />
            <td />
            {b.kecil ? <td /> : null}
            {Array.from({ length: n }, (_, i) => (
              <td key={i} />
            ))}
            <td />
            <td />
          </tr>
        ))}
        <KakiBlok b={b} kolomKiri={b.kecil ? 4 : 3} kolomSlot={n} />
      </tbody>
    </table>
  )
}

function BlokTanggal(p: { l: LembarLaporanKelompok; b: BlokLembar }) {
  const { b } = p
  const kosong = Math.max(0, BARIS_MIN - b.baris.length)
  const hari = Array.from({ length: b.hari }, (_, i) => i)
  const kiri = 7
  const kelasLibur = (i: number) => (b.libur[i] ? 'lb-libur' : '')
  return (
    <table className="lb-tabel lb-tanggal">
      <colgroup>
        <col className="c-no" />
        <col className="c-nama-t" />
        <col className="c-jk" />
        <col className="c-umur" />
        <col className="c-sekolah" />
        <col className="c-ortu" />
        <col className="c-iqro-t" />
        {hari.map((i) => (
          <col key={i} className="c-tgl" />
        ))}
        <col className="c-persen" />
        <col className="c-persen" />
      </colgroup>
      <thead>
        <KepalaBlok l={p.l} b={b} kolom={kiri + b.hari + 2} />
        <tr className="lb-kepala">
          <th rowSpan={2}>NO</th>
          <th rowSpan={2}>NAMA</th>
          <th rowSpan={2}>JK</th>
          <th rowSpan={2}>UMUR</th>
          <th rowSpan={2}>SEKOLAH / KELAS</th>
          <th rowSpan={2}>ORANG TUA</th>
          <th rowSpan={2}>IQRO' / QUR'AN</th>
          <th colSpan={b.hari} className="lb-target">
            TARGET KEAKTIFAN <span>( kode kegiatan ditulis pada tanggal pelaksanaan; kolom arsir = libur ) · target {b.target} kali/bulan</span>
          </th>
          <th rowSpan={2}>
            %<br />
            Keaktifan
          </th>
          <th rowSpan={2}>
            %<br />
            Peng. Materi
          </th>
        </tr>
        <tr className="lb-kepala lb-nomor">
          {hari.map((i) => (
            <th key={i} className={kelasLibur(i)}>
              {i + 1}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {b.baris.map((x) => (
          <tr key={x.generus_id}>
            <td className="lb-no">{x.no}</td>
            <td className="lb-nama">
              {x.nama}
              {x.jenjangPerluDitetapkan ? <small> (perlu ditetapkan)</small> : null}
            </td>
            <td className="lb-tengah">{x.jk}</td>
            <td className="lb-tengah">{x.umur ?? ''}</td>
            <td className="lb-kecil">{[x.sekolah, x.kelasSekolah ? `Kelas ${x.kelasSekolah}` : ''].filter(Boolean).join(' ')}</td>
            <td className="lb-kecil">{x.orangTua ?? ''}</td>
            <td className="lb-tengah lb-kecil">{x.iqro}</td>
            {hari.map((i) => (
              <td key={i} className={`lb-kode ${kelasLibur(i)} ${x.perTanggal[i] === 'IZ' ? 'lb-izin' : ''} ${(x.perTanggal[i]?.length ?? 0) > 2 ? 'lb-panjang' : ''}`}>
                {x.perTanggal[i]}
              </td>
            ))}
            <td className="lb-angka">{pr(x.persenKeaktifan)}</td>
            <td className="lb-angka">{pr(x.persenMateri)}</td>
          </tr>
        ))}
        {Array.from({ length: kosong }, (_, k) => (
          <tr key={`k${k}`} className="lb-kosong">
            <td className="lb-no">{b.baris.length + k + 1}</td>
            {Array.from({ length: kiri - 1 }, (_, i) => (
              <td key={i} />
            ))}
            {hari.map((i) => (
              <td key={i} className={kelasLibur(i)} />
            ))}
            <td />
            <td />
          </tr>
        ))}
        <KakiBlok b={b} kolomKiri={kiri} kolomSlot={b.hari} />
      </tbody>
    </table>
  )
}

export function SampulLembar(p: { l: LembarLaporanKelompok }) {
  return (
    <section className="lb-halaman lb-sampul">
      <div>
        <p>LAPORAN GENERUS KELOMPOK</p>
        <p>{p.l.kelompok.nama.toUpperCase()}</p>
        <p>BULAN {p.l.teksBulan}</p>
        <p>{namaMubalighSampul(p.l.mubaligh)}</p>
      </div>
    </section>
  )
}

function KolomNunggoni(p: { l: LembarLaporanKelompok; dari: number; sampai: number }) {
  const baris: ReactNode[] = []
  for (let t = p.dari; t <= p.sampai; t++) {
    const n = p.l.nunggoni.filter((x) => x.hari === t)
    baris.push(
      <tr key={t}>
        <td className="lb-tengah">{t}</td>
        <td>
          {n.map((x, i) => (
            <div key={i}>{x.nama}</div>
          ))}
        </td>
        <td className="lb-kecil">
          {n.map((x, i) => (
            <div key={i}>{x.dapukan}</div>
          ))}
        </td>
        <td />
      </tr>,
    )
  }
  return <>{baris}</>
}

export function LembarPengurus(p: { l: LembarLaporanKelompok }) {
  const { l } = p
  const akhir = l.blok[0]?.hari ?? 31
  const tanpaTanggal = l.nunggoni.filter((x) => x.hari === null)
  const kelompokTgl = [
    [1, 10],
    [11, 20],
    [21, akhir],
  ] as const
  const ya = (v: boolean | null) => (v === true ? 'Ya' : v === false ? 'Belum' : '……')
  return (
    <section className="lb-halaman lb-tegak lb-pengurus">
      <h2>ABSENSI PENGURUS &amp; MUBALIGH - MUBALIGHOT PEDULI</h2>
      <p className="lb-subjudul">(semua Pengurus &amp; Mubaligh - Mubalighot yang mendampingi Kegiatan Belajar Mengajar Generus)</p>
      <div className="lb-pita-kuning">
        KELOMPOK : {l.kelompok.nama.toUpperCase()} &nbsp;#&nbsp; BULAN : {l.teksBulan}
      </div>
      <div className="lb-nunggoni">
        {kelompokTgl.map(([a, z]) => (
          <table key={a} className="lb-tabel lb-tabel-nunggoni">
            <colgroup>
              <col className="c-tglp" />
              <col className="c-namap" />
              <col className="c-dapukan" />
              <col className="c-paraf" />
            </colgroup>
            <thead>
              <tr className="lb-kepala lb-biru">
                <th>TGL</th>
                <th>NAMA</th>
                <th>DAPUKAN</th>
                <th>PARAF</th>
              </tr>
            </thead>
            <tbody>
              <KolomNunggoni l={l} dari={a} sampai={z} />
            </tbody>
          </table>
        ))}
      </div>
      {tanpaTanggal.length ? (
        <p className="lb-kecil">Tanpa tanggal: {tanpaTanggal.map((x) => `${x.nama} (${x.dapukan})`).join(', ')}</p>
      ) : null}
      <div className="lb-kotak">
        <div className="lb-pita-kuning lb-merah">LAPORAN HASIL MUSYAWAROH</div>
        <div className="lb-mus">
          <div>
            <b>Musyawaroh Muda - Mudi Terlaksana :</b> {ya(l.musyawarah.mudaMudi.terlaksana)}
            <div className="lb-hasil">
              <b>Hasil Musyawaroh :</b> {l.musyawarah.mudaMudi.hasil || '-'}
            </div>
          </div>
          <div>
            <b>Musyawaroh 5 Unsur Terlaksana :</b> {ya(l.musyawarah.limaUnsur.terlaksana)}
            <div className="lb-hasil">
              <b>Hasil Musyawaroh :</b> {l.musyawarah.limaUnsur.hasil || '-'}
            </div>
          </div>
        </div>
      </div>
      <div className="lb-kotak lb-penyaksian">
        <div className="lb-pita-judul">PENYAKSIAN</div>
        <div className="lb-catatan">{l.catatanPenyaksian}</div>
        {[l.penyaksian.kelompok, l.penyaksian.desa].map((baris, i) => (
          <div key={i} className="lb-ttd">
            {baris.map((x) => (
              <div key={x.jabatan}>
                <span>{x.jabatan}</span>
                <b>{x.nama.toUpperCase()}</b>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

/** Semua halaman laporan bulanan untuk satu atau beberapa kelompok (gabungan desa). */
export function LembarLaporan(p: { data: LembarLaporanKelompok[]; format: FormatLembar }) {
  return (
    <div className="lb-dokumen">
      {p.data.map((l) => (
        <Fragment key={l.kelompok.id}>
          <SampulLembar l={l} />
          {susunHalaman(l.blok).map((hal, i) => (
            <section key={i} className="lb-halaman">
              {hal.map((b) => (p.format === 'tanggal' ? <BlokTanggal key={b.jenjang} l={l} b={b} /> : <BlokUrutan key={b.jenjang} l={l} b={b} />))}
              <Legenda blok={hal} />
            </section>
          ))}
          <LembarPengurus l={l} />
        </Fragment>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- Raport resmi (§20.4: halaman ringkas + lampiran, A4 tegak)

function KopRaport(p: { d: RaportCetak; logo?: string }) {
  return (
    <header className="rp-kop">
      <img src={p.logo ?? './logo.svg'} alt="" />
      <div>
        <p className="rp-org">{p.d.kop.organisasi}</p>
        <p className="rp-daerah">{p.d.kop.daerah}</p>
        <p className="rp-ket">Pembinaan &amp; Evaluasi Hasil Belajar Generus</p>
      </div>
    </header>
  )
}

function IdentitasRaport(p: { d: RaportCetak; judul: string }) {
  const { d } = p
  return (
    <>
      <h2 className="rp-judul">{p.judul}</h2>
      <p className="rp-semester">{d.semester}</p>
      <dl className="rp-identitas">
        <dt>Nama</dt>
        <dd>
          <b>{d.nama}</b>
        </dd>
        <dt>Jenis kelamin</dt>
        <dd>{d.jenisKelamin}</dd>
        <dt>Jenjang</dt>
        <dd>{d.jenjang}</dd>
        <dt>Kelompok</dt>
        <dd>{d.kelompok}</dd>
        <dt>Desa</dt>
        <dd>{d.desa}</dd>
        <dt>Semester</dt>
        <dd>{d.periode.endsWith('S1') ? 'Semester 1' : 'Semester 2'}</dd>
      </dl>
    </>
  )
}

function TabelKarakter(p: { judul: string; baris: RaportCetak['karakter']['tali'] }) {
  return (
    <table className="rp-tabel rp-karakter" aria-label={p.judul}>
      <thead>
        <tr>
          <th>{p.judul}</th>
          <th>Predikat</th>
          <th>Catatan</th>
        </tr>
      </thead>
      <tbody>
        {p.baris.map((b) => (
          <tr key={b.nama} className={b.predikat === 'belum dinilai' ? 'rp-belum' : ''}>
            <td>{b.nama}</td>
            <td className="lb-tengah lb-tebal">{b.predikat}</td>
            <td>{b.catatan}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function LembarRaport(p: { data: RaportCetak[]; logo?: string; ambang?: string }) {
  return (
    <div className="lb-dokumen">
      {p.data.map((d) => (
        <Fragment key={d.generus_id}>
          <section className="lb-halaman lb-tegak rp-halaman">
            <KopRaport d={d} logo={p.logo} />
            <IdentitasRaport d={d} judul="LAPORAN HASIL BELAJAR GENERUS" />
            <h3 className="rp-bagian">
              A. TRI SUKSES GENERUS <small>Alim-Faqih · Akhlaqul Karimah · Mandiri</small>
            </h3>
            <table className="rp-tabel rp-tri" aria-label={`Tri Sukses Generus ${d.nama}`}>
              <thead>
                <tr>
                  <th>Aspek</th>
                  <th>Nilai</th>
                  <th>Predikat</th>
                </tr>
              </thead>
              <tbody>
                {d.triSukses.map((b) => (
                  <tr key={b.label} className={`rp-${b.jenis}${b.nilai === 'belum dinilai' ? ' rp-belum' : ''}`}>
                    <td>{b.label}</td>
                    <td className="lb-tengah">{b.nilai}</td>
                    <td className="lb-tengah">{b.predikat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {p.ambang ? <p className="rp-catatan">{p.ambang} Rincian tiap materi pada Lampiran.</p> : null}
            <h3 className="rp-bagian">
              B. KARAKTER LUHUR {d.karakter.targetJenjang ? <small>Target jenjang: {d.karakter.targetJenjang}</small> : null}
            </h3>
            <TabelKarakter judul="4 Tali Keimanan" baris={d.karakter.tali} />
            {d.karakter.pendukung.length ? <p className="rp-catatan">Data pendukung: {d.karakter.pendukung.join(' ')}</p> : null}
            <TabelKarakter judul="6 Thobiat Luhur (praktik sehari-hari)" baris={d.karakter.thobiat} />
            <p className="rp-catatan">Predikat sikap dinilai mubaligh: Baik · Cukup · Perlu Bimbingan. Tidak dihitung ke Nilai Akhir.</p>
            <p className="rp-baris">
              <b>C. Keaktifan semester:</b> {d.keaktifan}
            </p>
            <div className="rp-baris">
              <b>D. Catatan mubaligh:</b>
              <p className="rp-catatan-mt">{d.catatanMubaligh ?? '—'}</p>
            </div>
            <p className="rp-tempat">{d.tempatTanggal}</p>
            <div className="rp-ttd">
              {(
                [
                  ['MT / Mubaligh Kelompok', d.tandaTangan.mubaligh],
                  ['KI Kelompok', d.tandaTangan.ki],
                  ['Orang Tua / Wali', d.tandaTangan.wali],
                ] as const
              ).map(([j, n]) => (
                <div key={j}>
                  <span>{j}</span>
                  <b>{n || ' '}</b>
                </div>
              ))}
            </div>
          </section>
          <section className="lb-halaman lb-tegak rp-halaman rp-lampiran">
            <KopRaport d={d} logo={p.logo} />
            <IdentitasRaport d={d} judul="LAMPIRAN — RINCIAN PENGUASAAN MATERI" />
            {d.lampiran.length === 0 ? <p className="rp-catatan">Jenjang belum ditetapkan atau daftar materi evaluasi belum ada.</p> : null}
            {d.lampiran.map((l) => (
              <Fragment key={l.judul}>
                <h3 className="rp-bagian">
                  {l.judul}{' '}
                  <small>
                    nilai {l.nilai}
                    {l.predikat !== '—' ? ` · ${l.predikat}` : ''}
                  </small>
                </h3>
                <table className="rp-tabel" aria-label={`${l.judul} ${d.nama}`}>
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Materi</th>
                      <th>Target</th>
                      <th>Dikuasai</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {l.baris.map((b) => (
                      <tr key={b.no} className={b.belumDitetapkan || b.belumDinilai ? 'rp-belum' : ''}>
                        <td className="lb-tengah">{b.no}</td>
                        <td>
                          {b.materi}
                          {b.catatan ? <small> ({b.catatan})</small> : null}
                        </td>
                        <td className="lb-tengah">{b.target}</td>
                        <td className="lb-tengah">{b.dikuasai}</td>
                        <td className="lb-tengah lb-tebal">{b.persen}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Fragment>
            ))}
            {d.catatanBelumDitetapkan ? <p className="rp-catatan">Catatan: {d.catatanBelumDitetapkan}</p> : null}
            {d.sisaSebelumnya ? (
              <p className="rp-catatan">
                Catatan: Belum tuntas dari {d.sisaSebelumnya.jenjang}: {d.sisaSebelumnya.materi.join(', ')}.
              </p>
            ) : null}
            <p className="rp-catatan">Catatan: {d.keteranganRumus}</p>
            <p className="rp-catatan">Nilai praktik penguji dibatasi 75% (juknis). “belum dinilai” = belum diuji; “—” = belum ditetapkan Kurikulum.</p>
          </section>
        </Fragment>
      ))}
    </div>
  )
}
