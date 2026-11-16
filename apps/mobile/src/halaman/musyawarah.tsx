// §18 — HP pengurus berjabatan: Musyawarah (Sekretaris menulis notulen + butir keputusan, Ketua/Wakil bermandat mengesahkan,
// Ketua memberi mandat, agenda berikutnya + undangan WA, hasil WA, register kebijakan) dan "Perlu Ditetapkan Kurikulum"
// (HP jabatan Bidang Kurikulum: tetapkan → usulan ke daerah).
import { useState } from 'react'
import {
  agendaMusyawarahBerikutnya,
  beriMandat,
  daftarButirKurikulum,
  daftarKebijakan,
  daftarNotulen,
  daftarWilayah,
  defKebijakan,
  formatTanggal,
  jabatanProfil,
  KATALOG_KEBIJAKAN,
  LABEL_MUSYAWARAH,
  LABEL_PERUNTUKAN,
  LABEL_STATUS_BUTIR,
  LABEL_STATUS_KEBIJAKAN,
  LABEL_STATUS_NOTULEN,
  mandatBerlaku,
  OPSI_PEMBACA_KEUANGAN,
  pengesahLokal,
  ringkasanMusyawarah,
  sahkanNotulen,
  simpanNotulen,
  tambahHari,
  tanggalHariIni,
  teksWaHasil,
  teksWaUndangan,
  tetapkanButirKurikulum,
  LABEL_JABATAN,
  type BarisButirKurikulum,
  type ButirKeputusan,
  type JenisMusyawarah,
  type KunciKebijakan,
  type NotulenTerbaca,
  type StatusButir,
  type StatusKebijakan,
  type StatusNotulen,
} from '@ppg/core'
import { useApp, useData } from '../konteks'
import { Angka, AreaTeks, Isian, KeadaanData, Kartu, Kosong, Lencana, Modal, Pilihan, Spanduk, Tombol } from '../komponen/ui'
import { tanggalTeks } from '../utils/label'

const WARNA_NOTULEN: Record<StatusNotulen, 'hijau' | 'kuning' | 'merah' | 'teal'> = { diterapkan: 'hijau', disahkan: 'teal', menunggu: 'kuning', perlu_ulang: 'merah' }
const WARNA_KEBIJAKAN: Record<StatusKebijakan, 'hijau' | 'kuning' | 'merah'> = { ditetapkan: 'hijau', sementara: 'kuning', belum: 'merah' }
const WARNA_BUTIR: Record<StatusButir, 'hijau' | 'kuning' | 'merah'> = { ditetapkan: 'hijau', sementara: 'kuning', belum: 'merah' }

function useJabatan() {
  const { profil } = useApp()
  const j = jabatanProfil(profil)
  return { j, penulis: j.some((x) => x === 'sekretaris' || x === 'pj_desa' || x === 'pj_kelompok'), ketua: j.includes('ketua') }
}

/** Kartu ringkas di Beranda Ketua/Sekretaris. */
export function KartuMusyawarahHp(p: { buka?: () => void }) {
  const { db, profil } = useApp()
  const r = useData(() => ringkasanMusyawarah(db, profil.wilayah_id), [profil.id])
  return (
    <KeadaanData hasil={r}>
      {(x) => (
        <Kartu judul="Musyawarah & kebijakan">
          <div className="baris-angka">
            <Angka nilai={x.kebijakanSementara} teks="Kebijakan sementara" warna={x.kebijakanSementara ? 'kuning' : 'hijau'} />
            <Angka nilai={x.menungguPengesahan} teks="Menunggu pengesahan" warna={x.menungguPengesahan ? 'kuning' : 'hijau'} />
          </div>
          <p>
            Terakhir: {x.terakhir ? `${tanggalTeks(x.terakhir.tanggal)} · ${LABEL_MUSYAWARAH[x.terakhir.jenis]} (${LABEL_STATUS_NOTULEN[x.terakhir.status]})` : 'belum ada notulen'}
          </p>
          {x.berikutnya ? <p>Berikutnya: {x.berikutnya.judul}</p> : null}
          {p.buka ? (
            <Tombol penuh varian="kedua" onClick={p.buka}>
              Buka Musyawarah
            </Tombol>
          ) : null}
        </Kartu>
      )}
    </KeadaanData>
  )
}

export function MusyawarahHp() {
  const { db, profil } = useApp()
  const { penulis, ketua } = useJabatan()
  const [tulis, setTulis] = useState(false)
  const [mandat, setMandat] = useState(false)
  const notulen = useData(() => daftarNotulen(db), [profil.id])
  const bolehSahkan = useData(() => !!pengesahLokal(db), [profil.id]).data ?? false
  const m = useData(() => mandatBerlaku(db), [profil.id]).data
  return (
    <>
      <KartuMusyawarahHp />
      {m ? <Spanduk jenis="info">Mandat pengesahan untuk Wakil Ketua berlaku {tanggalTeks(m.isi.mulai)} s.d. {tanggalTeks(m.isi.sampai)}.</Spanduk> : null}
      {penulis ? <KartuUndanganHp /> : null}
      <Kartu judul="Notulen musyawarah">
        {penulis ? (
          <Tombol penuh onClick={() => setTulis(true)}>
            + Tulis notulen
          </Tombol>
        ) : null}
        {ketua ? (
          <Tombol penuh varian="kedua" onClick={() => setMandat(true)}>
            Beri mandat pengesahan ke Wakil Ketua
          </Tombol>
        ) : null}
        <KeadaanData hasil={notulen} kosong={(d) => d.length === 0} teksKosong="Belum ada notulen.">
          {(d) => (
            <ul className="daftar-sederhana">
              {d.map((n) => (
                <BarisNotulen key={n.catatan.id} n={n} bolehSahkan={bolehSahkan} />
              ))}
            </ul>
          )}
        </KeadaanData>
        <p className="keterangan">Keputusan berlaku setelah disahkan Ketua lalu ikut Setor ke Daerah; EXE Daerah menerapkannya dan mengirim lewat paket.</p>
      </Kartu>
      <RegisterKebijakanHp />
      {tulis ? <FormNotulen tutup={() => setTulis(false)} /> : null}
      {mandat ? <FormMandat tutup={() => setMandat(false)} /> : null}
    </>
  )
}

function BarisNotulen(p: { n: NotulenTerbaca; bolehSahkan: boolean }) {
  const { db, aksi, platform } = useApp()
  const { n } = p
  return (
    <li className="baris-tumpuk">
      <span>
        <small>{tanggalTeks(n.catatan.tanggal)}</small> {LABEL_MUSYAWARAH[n.isi.jenis_musyawarah] ?? n.isi.jenis_musyawarah} · No. {n.isi.nomor ?? '—'} · {(n.isi.keputusan ?? []).length} keputusan
        <br />
        <Lencana warna={WARNA_NOTULEN[n.status]}>{LABEL_STATUS_NOTULEN[n.status]}</Lencana>
      </span>
      <span className="aksi-baris">
        {p.bolehSahkan && (n.status === 'menunggu' || n.status === 'perlu_ulang') ? (
          <Tombol kecil onClick={() => void aksi(() => sahkanNotulen(db, n.catatan.id), 'Disahkan. Setor ke Daerah agar diterapkan.')}>
            Sahkan
          </Tombol>
        ) : null}
        <Tombol kecil varian="wa" onClick={() => platform.bukaTautan(`https://wa.me/?text=${encodeURIComponent(teksWaHasil(db, n.catatan.id))}`)}>
          Hasil WA
        </Tombol>
      </span>
    </li>
  )
}

function KartuUndanganHp() {
  const { db, profil, platform } = useApp()
  const [tanggal, setTanggal] = useState(tambahHari(tanggalHariIni(), 7))
  const [jam, setJam] = useState('20.00')
  const [tempat, setTempat] = useState('')
  const ag = useData(() => agendaMusyawarahBerikutnya(db, profil.wilayah_id), [profil.id])
  return (
    <KeadaanData hasil={ag}>
      {(a) => (
        <Kartu judul="Agenda berikutnya & undangan">
          <p>
            <b>{a.judul}</b>
          </p>
          <ol>
            {a.usulanAgenda.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ol>
          <Isian label="Tanggal musyawarah" type="date" nilai={tanggal} ubah={setTanggal} />
          <Isian label="Jam" nilai={jam} ubah={setJam} />
          <Isian label="Tempat" nilai={tempat} ubah={setTempat} />
          <Tombol penuh varian="wa" onClick={() => platform.bukaTautan(`https://wa.me/?text=${encodeURIComponent(teksWaUndangan(db, { wilayahId: profil.wilayah_id, tanggal, jam, tempat }))}`)}>
            Kirim undangan + agenda ke WA
          </Tombol>
        </Kartu>
      )}
    </KeadaanData>
  )
}

/** Isian nilai baru untuk satu kunci kebijakan. */
function IsianKebijakan(p: { kunci: KunciKebijakan; nilai: unknown; ubah: (v: unknown) => void }) {
  const v = (p.nilai ?? {}) as Record<string, unknown>
  const angka = (k: string, label: string) => <Isian label={label} type="number" inputMode="numeric" nilai={v[k] === null || v[k] === undefined ? '' : String(v[k])} ubah={(x) => p.ubah({ ...v, [k]: x === '' ? null : Number(x) })} />
  const rutin = (k: string, label: string) => (
    <Pilihan label={label} nilai={String(v[k] ?? 'bersama')} ubah={(x) => p.ubah({ ...v, [k]: x })} pilihan={[{ nilai: 'bersama', teks: 'Musyawarah bersama' }, { nilai: 'muda_mudi', teks: 'PPG unsur muda/i' }, { nilai: 'tidak_ada', teks: 'Tidak ada' }]} />
  )
  switch (p.kunci) {
    case 'tabungan_desa':
      return (
        <>
          {angka('nominal', 'Nominal per bulan (Rp)')}
          <Pilihan label="Peruntukan" nilai={String(v.peruntukan ?? 'mumi_daerah')} ubah={(x) => p.ubah({ ...v, peruntukan: x })} pilihan={Object.entries(LABEL_PERUNTUKAN).map(([n, t]) => ({ nilai: n, teks: t }))} />
        </>
      )
    case 'reward_skor':
      return (
        <>
          {angka('bobot_keaktifan', 'Bobot keaktifan (0–100)')}
          {angka('bobot_penguasaan', 'Bobot penguasaan (0–100)')}
        </>
      )
    case 'reward_juara':
      return (
        <>
          {angka('santri', 'Santri terbaik per jenjang')}
          {angka('kelompok', 'Kelompok terbaik')}
          {angka('desa', 'Desa terbaik')}
        </>
      )
    case 'jadwal_musyawarah':
      return (
        <>
          {rutin('ganjil', 'Bulan ganjil')}
          {rutin('genap', 'Bulan genap')}
        </>
      )
    case 'pengingat_laporan':
      return (
        <>
          {angka('awal_sampai', 'Sekretaris: tanggal 1 s.d.')}
          {angka('akhir_mulai', 'PJ desa: mulai tanggal')}
        </>
      )
    case 'hak_baca_keuangan': {
      const l = Array.isArray(p.nilai) ? (p.nilai as string[]) : []
      return (
        <fieldset className="kolom kotak-centang">
          <legend>Jabatan yang boleh membaca keuangan</legend>
          {OPSI_PEMBACA_KEUANGAN.map((j) => (
            <label key={j} className="centang">
              <input type="checkbox" checked={l.includes(j)} onChange={(e) => p.ubah(e.target.checked ? [...l, j] : l.filter((x) => x !== j))} /> {LABEL_JABATAN[j]}
            </label>
          ))}
        </fieldset>
      )
    }
    case 'dana_kegiatan': {
      const teks = Array.isArray(p.nilai) ? (p.nilai as { nama: string; nominal: number }[]).map((x) => `${x.nama} = ${x.nominal}`).join('\n') : ''
      return (
        <AreaTeks
          label="Kegiatan = nominal (satu per baris)"
          nilai={teks}
          baris={4}
          ubah={(x) =>
            p.ubah(
              x
                .split('\n')
                .map((b) => b.split('='))
                .filter((b) => b[0]?.trim())
                .map(([n, r]) => ({ nama: n!.trim(), nominal: Number(String(r ?? '').replace(/\D/g, '')) || 0 })),
            )
          }
        />
      )
    }
  }
}

function FormNotulen(p: { tutup: () => void }) {
  const { db, profil, aksi } = useApp()
  const { j } = useJabatan()
  const sekretaris = j.includes('sekretaris')
  const wilayahSaya = profil.wilayah_id
  const desaList = daftarWilayah(db, { tingkat: 'desa' })
  const daerah = daftarWilayah(db, { tingkat: 'daerah' })[0]
  const ag = useData(() => agendaMusyawarahBerikutnya(db, wilayahSaya), [profil.id]).data
  const [jenis, setJenis] = useState<JenisMusyawarah>(ag?.jenis ?? (sekretaris ? 'bersama' : j.includes('pj_desa') ? 'desa' : 'lima_unsur'))
  const [wilayah, setWilayah] = useState(wilayahSaya)
  const [tanggal, setTanggal] = useState(tanggalHariIni())
  const [peserta, setPeserta] = useState('')
  const [agenda, setAgenda] = useState((ag?.usulanAgenda ?? []).join('\n'))
  const [uraian, setUraian] = useState('')
  const [keputusan, setKeputusan] = useState<ButirKeputusan[]>([])
  const wilayahObj = [...(daerah ? [daerah] : []), ...desaList].find((w) => w.id === wilayah)
  const kunciBoleh = KATALOG_KEBIJAKAN.filter((d) => (wilayahObj?.tingkat === 'desa' ? d.lingkup === 'desa' : wilayahObj?.tingkat === 'daerah'))
  const ubahButir = (i: number, b: Partial<ButirKeputusan>) => setKeputusan(keputusan.map((x, k) => (k === i ? { ...x, ...b } : x)))
  const simpan = () =>
    aksi(
      () =>
        simpanNotulen(db, {
          jenis_musyawarah: jenis,
          wilayahId: wilayah,
          tanggal,
          peserta,
          agenda: agenda.split('\n'),
          uraian,
          keputusan: keputusan.filter((b) => b.teks.trim()),
        }),
      'Notulen tersimpan. Minta Ketua mengesahkan, lalu Setor ke Daerah.',
    ).then((r) => r && p.tutup())
  return (
    <Modal judul="Tulis notulen" tutup={p.tutup} aksi={<Tombol onClick={simpan}>Simpan notulen</Tombol>}>
      <Pilihan label="Jenis musyawarah" nilai={jenis} ubah={(v) => setJenis(v as JenisMusyawarah)} pilihan={Object.entries(LABEL_MUSYAWARAH).map(([n, t]) => ({ nilai: n, teks: t }))} />
      {sekretaris ? (
        <Pilihan
          label="Wilayah musyawarah"
          nilai={wilayah}
          ubah={setWilayah}
          pilihan={[...(daerah ? [{ nilai: daerah.id, teks: `Daerah ${daerah.nama}` }] : []), ...desaList.map((d) => ({ nilai: d.id, teks: `Desa ${d.nama}` }))]}
        />
      ) : null}
      <Isian label="Tanggal" type="date" nilai={tanggal} ubah={setTanggal} />
      <Isian label="Peserta" nilai={peserta} ubah={setPeserta} />
      <AreaTeks label="Agenda (satu per baris)" nilai={agenda} ubah={setAgenda} baris={4} />
      <AreaTeks label="Uraian / jalannya musyawarah" nilai={uraian} ubah={setUraian} baris={3} />
      <h3>Butir keputusan</h3>
      {keputusan.map((b, i) => {
        const d = b.kunci ? defKebijakan(b.kunci) : undefined
        return (
          <div key={i} className="kartu-dalam">
            <AreaTeks label={`Keputusan ${i + 1}`} nilai={b.teks} ubah={(v) => ubahButir(i, { teks: v })} baris={2} />
            <Pilihan
              label="Mengubah kebijakan"
              nilai={b.kunci ?? ''}
              kosong="— Tidak mengubah kebijakan —"
              ubah={(v) => {
                const def = defKebijakan(v)
                const lingkup = def?.lingkup === 'desa' ? (wilayahObj?.tingkat === 'desa' ? wilayah : (desaList[0]?.id ?? null)) : (daerah?.id ?? null)
                const w = desaList.find((x) => x.id === lingkup)
                ubahButir(i, { kunci: (v || null) as KunciKebijakan | null, lingkup_id: v ? lingkup : null, nilai: def ? def.bawaan(w) : undefined })
              }}
              pilihan={kunciBoleh.map((k) => ({ nilai: k.kunci, teks: `${k.kode} ${k.judul}` }))}
            />
            {d?.lingkup === 'desa' && wilayahObj?.tingkat === 'daerah' ? (
              <Pilihan label="Desa" nilai={b.lingkup_id ?? ''} ubah={(v) => ubahButir(i, { lingkup_id: v })} pilihan={desaList.map((x) => ({ nilai: x.id, teks: x.nama }))} />
            ) : null}
            {b.kunci ? <IsianKebijakan kunci={b.kunci} nilai={b.nilai} ubah={(v) => ubahButir(i, { nilai: v })} /> : null}
            <Tombol kecil varian="bahaya" onClick={() => setKeputusan(keputusan.filter((_, k) => k !== i))}>
              Hapus butir
            </Tombol>
          </div>
        )
      })}
      <Tombol penuh varian="kedua" onClick={() => setKeputusan([...keputusan, { teks: '' }])}>
        + Butir keputusan
      </Tombol>
    </Modal>
  )
}

function FormMandat(p: { tutup: () => void }) {
  const { db, aksi } = useApp()
  const [mulai, setMulai] = useState(tanggalHariIni())
  const [sampai, setSampai] = useState(tambahHari(tanggalHariIni(), 30))
  const [ket, setKet] = useState('')
  return (
    <Modal
      judul="Mandat pengesahan"
      tutup={p.tutup}
      aksi={<Tombol onClick={() => aksi(() => beriMandat(db, { mulai, sampai, keterangan: ket }), 'Mandat tersimpan. Setor ke Daerah agar sampai ke Wakil Ketua.').then((r) => r && p.tutup())}>Simpan mandat</Tombol>}
    >
      <p>Wakil Ketua boleh mengesahkan keputusan musyawarah selama masa mandat (paling lama 1 tahun).</p>
      <Isian label="Mulai" type="date" nilai={mulai} ubah={setMulai} />
      <Isian label="Sampai" type="date" nilai={sampai} ubah={setSampai} />
      <Isian label="Keterangan" nilai={ket} ubah={setKet} />
    </Modal>
  )
}

export function RegisterKebijakanHp() {
  const { db, profil } = useApp()
  const w = daftarWilayah(db, {}).find((x) => x.id === profil.wilayah_id)
  const r = useData(() => daftarKebijakan(db, w && w.tingkat !== 'daerah' ? { wilayahId: w.id } : {}), [profil.id])
  return (
    <Kartu judul="Register Kebijakan">
      <KeadaanData hasil={r} kosong={(d) => d.length === 0} teksKosong="Register belum ada (buka paket terbaru dari daerah).">
        {(d) => (
          <ul className="daftar-sederhana">
            {d.map((k) => (
              <li key={`${k.kunci}-${k.lingkup_id}`}>
                <span>
                  <b>
                    {k.kode} {k.judul}
                  </b>
                  {k.lingkup === 'desa' ? ` — ${k.lingkup_nama}` : ''}
                  <br />
                  {k.ringkas}
                  {k.dasar ? (
                    <>
                      <br />
                      <small>
                        Musyawarah No. {k.dasar.nomor ?? '—'} · {tanggalTeks(k.dasar.tanggal)} · disahkan {k.disahkan_oleh}
                      </small>
                    </>
                  ) : null}
                </span>
                <Lencana warna={WARNA_KEBIJAKAN[k.status]}>{LABEL_STATUS_KEBIJAKAN[k.status]}</Lencana>
              </li>
            ))}
          </ul>
        )}
      </KeadaanData>
    </Kartu>
  )
}

// =====================================================================================================================
// Perlu Ditetapkan Kurikulum (HP jabatan Bidang Kurikulum)
// =====================================================================================================================

export function PerluDitetapkanHp() {
  const { db, profil } = useApp()
  const r = useData(() => daftarButirKurikulum(db), [profil.id])
  const [buka, setBuka] = useState<BarisButirKurikulum | null>(null)
  return (
    <>
      <Spanduk jenis="info">Penetapan dari HP dikirim ke Daerah lewat Setor ke Daerah; statusnya berubah setelah paket berikutnya dibuka.</Spanduk>
      <KeadaanData hasil={r} kosong={(d) => d.length === 0} teksKosong="Daftar materi evaluasi belum ada — buka paket terbaru dari daerah.">
        {(d) => (
          <ul className="daftar-sederhana">
            {d.map((b) => (
              <li key={b.kode}>
                <span>
                  <b>
                    {b.kode} {b.judul}
                  </b>
                  <br />
                  <small>{b.ringkas}</small>
                  <br />
                  <Lencana warna={WARNA_BUTIR[b.status]}>{LABEL_STATUS_BUTIR[b.status]}</Lencana>
                  {b.diajukan ? <Lencana warna="teal">Diajukan ke Daerah</Lencana> : null}
                  {b.berubah ? <Lencana warna="kuning">Berubah</Lencana> : null}
                </span>
                <Tombol kecil onClick={() => setBuka(b)}>
                  Tetapkan
                </Tombol>
              </li>
            ))}
          </ul>
        )}
      </KeadaanData>
      {buka ? <FormButirHp b={buka} tutup={() => setBuka(null)} /> : null}
    </>
  )
}

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

function FormButirHp(p: { b: BarisButirKurikulum; tutup: () => void }) {
  const { db, aksi } = useApp()
  const { b } = p
  const awal = b.nilai as Record<string, unknown> | string
  const [pilih, setPilih] = useState(typeof awal === 'string' ? awal : '')
  const [bulan, setBulan] = useState({ S1: String((awal as { S1?: number }).S1 ?? 11), S2: String((awal as { S2?: number }).S2 ?? 5) })
  const [isian, setIsian] = useState<Record<string, string>>(Object.fromEntries(b.isian.map((i) => [i.kunci, i.nilai === null ? '' : String(i.nilai)])))
  const [catatan, setCatatan] = useState('')
  const nilai = (): unknown =>
    b.bentuk === 'bulan'
      ? { S1: Number(bulan.S1), S2: Number(bulan.S2) }
      : b.bentuk === 'pilihan'
        ? pilih
        : b.bentuk === 'angka'
          ? Object.fromEntries(Object.entries(isian).map(([k, v]) => [k, v.trim() === '' ? null : Number(v)]))
          : b.bentuk === 'teks' || b.bentuk === 'pemetaan'
            ? isian
            : undefined
  const simpan = () =>
    aksi(() => tetapkanButirKurikulum(db, b.kode, { nilai: nilai(), catatan }), 'Penetapan diajukan. Setor ke Daerah agar diterapkan.').then((r) => r && p.tutup())
  return (
    <Modal judul={`${b.kode} ${b.judul}`} tutup={p.tutup} aksi={<Tombol onClick={simpan}>{b.bentuk === 'konfirmasi' ? 'Tetapkan nilai ini' : 'Simpan & tetapkan'}</Tombol>}>
      <p className="keterangan">{b.sumber}</p>
      <p>
        Nilai sementara: <b>{b.ringkas}</b>
      </p>
      {b.penetapan ? <p className="keterangan">Ditetapkan {formatTanggal(b.penetapan.pada.slice(0, 10))} oleh {b.penetapan.oleh}.</p> : null}
      {b.bentuk === 'bulan' ? (
        <>
          <Pilihan label="Semester 1" nilai={bulan.S1} ubah={(v) => setBulan({ ...bulan, S1: v })} pilihan={[7, 8, 9, 10, 11, 12].map((m) => ({ nilai: String(m), teks: NAMA_BULAN[m - 1]! }))} />
          <Pilihan label="Semester 2" nilai={bulan.S2} ubah={(v) => setBulan({ ...bulan, S2: v })} pilihan={[1, 2, 3, 4, 5, 6].map((m) => ({ nilai: String(m), teks: NAMA_BULAN[m - 1]! }))} />
        </>
      ) : null}
      {b.bentuk === 'pilihan' ? <Pilihan label="Pilihan" nilai={pilih} ubah={setPilih} pilihan={b.opsi.map(([n, t]) => ({ nilai: n, teks: t }))} /> : null}
      {b.bentuk === 'angka' || b.bentuk === 'teks'
        ? b.isian.map((i) => (
            <Isian
              key={i.kunci}
              label={i.label}
              type={b.bentuk === 'angka' ? 'number' : 'text'}
              inputMode={b.bentuk === 'angka' ? 'numeric' : undefined}
              nilai={isian[i.kunci] ?? ''}
              ubah={(v) => setIsian({ ...isian, [i.kunci]: v })}
            />
          ))
        : null}
      {b.bentuk === 'pemetaan'
        ? b.isian.map((i) => (
            <Pilihan key={i.kunci} label={i.label} nilai={isian[i.kunci] ?? ''} ubah={(v) => setIsian({ ...isian, [i.kunci]: v })} pilihan={b.opsi.map(([n, t]) => ({ nilai: n, teks: t }))} />
          ))
        : null}
      {b.bentuk === 'konfirmasi' ? (
        b.isian.length ? (
          <ul>
            {b.isian.map((i) => (
              <li key={i.kunci}>
                <b>{i.label}</b>: {String(i.nilai)}
              </li>
            ))}
          </ul>
        ) : (
          <Kosong teks="Materi belum ada di HP ini." />
        )
      ) : null}
      {b.ubahDiMateri ? <p className="keterangan">Daftar butir diubah di EXE Kurikulum (menu Materi Evaluasi).</p> : null}
      <AreaTeks label="Catatan (opsional)" nilai={catatan} ubah={setCatatan} baris={2} />
    </Modal>
  )
}
