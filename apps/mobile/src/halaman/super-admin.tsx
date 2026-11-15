// Menu Super Admin HP (Fase 9), ringkas: Beranda · Daftarkan (token semua peran) · Data (wilayah/generus/pengajian
// sebagai usulan yang disetujui otomatis di Daerah) · Sinkron (setor ke Daerah, buka paket/setoran, kirim paket & balasan)
// · Lainnya (perangkat terbitan HP ini, ganti sandi, cadangan, kunci).
import { useMemo, useState } from 'react'
import {
  ajukanUsulan,
  ambilWilayah,
  bacaKodePerangkat,
  bekukanPerangkat,
  buatBalasan,
  buatCadanganHp,
  buatPaket,
  buatSetor,
  bukaCadanganHp,
  cabutPerangkat,
  cairkanPerangkat,
  daftarPengajian,
  daftarPenerimaBalasan,
  daftarPerangkatRinci,
  daftarUsulan,
  daftarWilayah,
  gantiSandiExe,
  generusPilihanToken,
  idRantaiPenerbit,
  jenisCadanganHp,
  kelompokBerpenerima,
  KATEGORI_GENERUS,
  PANJANG_SANDI_CADANGAN_MIN,
  ringkasanBerandaExe,
  teksDataSetor,
  statusProfil,
  STATUS_GENERUS,
  tanggalHariIni,
  terbitkanTokenBawah,
  type HasilImporBanyak,
  type OpsiTerbitTokenBawah,
  type Wilayah,
} from '@ppg/core'
import { useDataSuper, useSuper } from '../konteks-super'
import { PemindaiQr, QrBerseri } from '../komponen/qr'
import { Angka, AreaTeks, Isian, JudulHalaman, Kartu, KeadaanData, Konfirmasi, Kosong, Lencana, MenuDaftar, Modal, Pilihan, Segmen, Spanduk, Tombol } from '../komponen/ui'
import { label, LABEL_KATEGORI, LABEL_STATUS_GENERUS, LABEL_STATUS_TOKEN, pesanGalat, pesanHasilBerkas, waktuTeks } from '../utils/label'

type KunciTab = 'beranda' | 'daftarkan' | 'data' | 'sinkron' | 'lainnya'
const TAB: { kunci: KunciTab; teks: string; ikon: string }[] = [
  { kunci: 'beranda', teks: 'Beranda', ikon: '⌂' },
  { kunci: 'daftarkan', teks: 'Daftarkan', ikon: '✚' },
  { kunci: 'data', teks: 'Data', ikon: '☺' },
  { kunci: 'sinkron', teks: 'Sinkron', ikon: '⇅' },
  { kunci: 'lainnya', teks: 'Lainnya', ikon: '≡' },
]

export function MenuSuper() {
  const { profil, kunciSekarang } = useSuper()
  const [tab, setTab] = useState<KunciTab>('beranda')
  const [ulang, setUlang] = useState(0)
  const st = statusProfil(profil)
  return (
    <div className="kerangka">
      <header className="kepala-app">
        <span className="merek">
          <img className="merek-ikon" src="./logo.svg" alt="" aria-hidden="true" />
          Super Admin
        </span>
        <button type="button" className="chip-profil" onClick={kunciSekarang} aria-label="Kunci Super Admin">
          <span className="avatar kecil" aria-hidden="true">
            {profil.nama.slice(0, 1).toUpperCase()}
          </span>
          <span>
            {profil.nama}
            <small>Kunci 🔒</small>
          </span>
        </button>
      </header>
      <main className="isi">
        {st.kode === 'DICABUT' ? <Spanduk jenis="bahaya">Super Admin HP ini sudah dicabut Admin Daerah. Data lama tetap bisa dilihat.</Spanduk> : null}
        {st.kode === 'KEDALUWARSA' ? <Spanduk jenis="bahaya">Masa berlaku Super Admin HP habis. Minta token baru dari Admin Daerah.</Spanduk> : null}
        <div className="isi-tab" key={`${tab}-${ulang}`}>
          {tab === 'beranda' ? <BerandaSuper pergi={setTab} /> : null}
          {tab === 'daftarkan' ? <DaftarkanSuper /> : null}
          {tab === 'data' ? <DataSuper /> : null}
          {tab === 'sinkron' ? <SinkronSuper /> : null}
          {tab === 'lainnya' ? <LainnyaSuper /> : null}
        </div>
      </main>
      <nav className="nav-bawah" aria-label="Menu Super Admin">
        {TAB.map((t) => (
          <button
            key={t.kunci}
            type="button"
            aria-current={t.kunci === tab ? 'page' : undefined}
            onClick={() => {
              if (t.kunci === tab) setUlang((x) => x + 1)
              setTab(t.kunci)
            }}
          >
            <span className="ikon" aria-hidden="true">
              {t.ikon}
            </span>
            <span>{t.teks}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

// ---------------- pembantu ----------------

/** Nama wilayah lengkap untuk pilihan ("Klasaman 1 · Desa Klasaman"). */
function namaWilayah(db: ReturnType<typeof useSuper>['db'], w: Wilayah): string {
  if (w.tingkat === 'kelompok') {
    const induk = w.induk_id ? ambilWilayah(db, w.induk_id) : undefined
    return induk ? `${w.nama} · Desa ${induk.nama}` : w.nama
  }
  if (w.tingkat === 'desa') return `Desa ${w.nama}`
  return `Daerah ${w.nama}`
}

function pilihanWilayah(db: ReturnType<typeof useSuper>['db'], tingkat: ('daerah' | 'desa' | 'kelompok')[]) {
  return daftarWilayah(db)
    .filter((w) => tingkat.includes(w.tingkat))
    .sort((a, b) => tingkat.indexOf(a.tingkat) - tingkat.indexOf(b.tingkat) || namaWilayah(db, a).localeCompare(namaWilayah(db, b)))
    .map((w) => ({ nilai: w.id, teks: namaWilayah(db, w) }))
}

function useSetor() {
  const { db, aksi, kirimBerkas } = useSuper()
  return async (semua = false) => {
    const b = await aksi(() => buatSetor(db, { semua }))
    if (b) await kirimBerkas(b, 'Berkas setoran siap. Kirim ke Admin Daerah lewat WA.')
  }
}

const NAMA_HARI = ['Ahad', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

// ---------------- Beranda ----------------

function BerandaSuper(p: { pergi: (t: KunciTab) => void }) {
  const { db, profil } = useSuper()
  const setor = useSetor()
  const r = useDataSuper(() => ringkasanBerandaExe(db), [db])
  return (
    <>
      <JudulHalaman judul="Beranda" keterangan={`Assalamu'alaikum, ${profil.nama}. Pendaftaran seluruh daerah.`} />
      <KeadaanData hasil={r}>
        {(x) => (
          <>
            {!x.terakhirPaket ? (
              <Spanduk jenis="peringatan">
                Buka <b>paket dari Daerah</b> dulu agar daftar wilayah, generus, dan kunci kelompok tersedia (menu Sinkron → Buka Berkas).
              </Spanduk>
            ) : null}
            <Kartu judul={x.wilayah ? `Daerah ${x.wilayah.nama}` : 'Daerah'}>
              <div className="baris-angka">
                <Angka nilai={x.generus.aktif} teks="Generus aktif" />
                <Angka nilai={x.perangkatAktif} teks="Perangkat aktif" />
                <Angka nilai={x.usulanMenunggu} teks="Usulan menunggu" warna={x.usulanMenunggu ? 'kuning' : 'teal'} />
              </div>
              <p className="keterangan">Paket terakhir dari Daerah: {waktuTeks(x.terakhirPaket)}</p>
            </Kartu>
            <Kartu judul="Setor ke Daerah">
              <p>{x.pengingat ? teksDataSetor(x.pengingat, 'Daerah') : x.belumDisetor ? `Ada ${x.belumDisetor} data belum disetor ke Daerah.` : 'Belum ada data untuk disetor.'}</p>
              {x.pengingat?.terlambat ? <Spanduk jenis="bahaya">Setoran ke Daerah terlambat.</Spanduk> : null}
              <Tombol penuh onClick={() => setor()}>
                Setor ke Daerah
              </Tombol>
            </Kartu>
            {x.statusSetorBawahan.length ? (
              <Kartu judul="Status setor tiap desa">
                <ul className="daftar-sederhana">
                  {x.statusSetorBawahan.map((s) => (
                    <li key={s.wilayah_id}>
                      <span>{s.nama}</span>
                      {s.terlambat ? (
                        <Lencana warna="merah">Terlambat</Lencana>
                      ) : s.terakhirSetor ? (
                        <Lencana warna="hijau">Sudah setor</Lencana>
                      ) : s.jadwal ? (
                        <Lencana warna="kuning">Belum ada setoran</Lencana>
                      ) : (
                        <Lencana warna="abu">Belum ada jadwal</Lencana>
                      )}
                    </li>
                  ))}
                </ul>
              </Kartu>
            ) : null}
            <MenuDaftar
              item={[
                { teks: 'Daftarkan perangkat', ket: 'Terbitkan token untuk semua peran', ikon: '✚', buka: () => p.pergi('daftarkan') },
                { teks: 'Tambah generus', ket: 'Nama & no. HP orang tua', ikon: '☺', buka: () => p.pergi('data') },
              ]}
            />
          </>
        )}
      </KeadaanData>
    </>
  )
}

// ---------------- Daftarkan (terbitkan token) ----------------

type JenisDaftar = 'pengurus' | 'mubaligh' | 'wali' | 'generus' | 'exe_desa' | 'exe_kelompok' | 'kurikulum'

const JENIS_DAFTAR: Record<JenisDaftar, { teks: string; role: OpsiTerbitTokenBawah['role']; tingkat: ('daerah' | 'desa' | 'kelompok')[] }> = {
  pengurus: { teks: 'Pengurus (HP)', role: 'pengurus', tingkat: ['kelompok', 'desa', 'daerah'] },
  mubaligh: { teks: 'Mubaligh (HP, satu kelompok)', role: 'mubaligh', tingkat: ['kelompok'] },
  wali: { teks: 'Orang tua (wali)', role: 'wali', tingkat: ['kelompok'] },
  generus: { teks: 'Murid (generus)', role: 'generus', tingkat: ['kelompok'] },
  exe_desa: { teks: 'EXE Desa (laptop desa)', role: 'admin', tingkat: ['desa'] },
  exe_kelompok: { teks: 'EXE Kelompok (laptop kelompok)', role: 'admin', tingkat: ['kelompok'] },
  kurikulum: { teks: 'EXE Kurikulum (laptop tim kurikulum)', role: 'kurikulum', tingkat: ['daerah'] },
}

function DaftarkanSuper() {
  const { db, kunci, profil, platform, aksi } = useSuper()
  const [jenis, setJenis] = useState<JenisDaftar>('mubaligh')
  const [kode, setKode] = useState('')
  const [pindai, setPindai] = useState(false)
  const [wilayah, setWilayah] = useState('')
  const [nama, setNama] = useState('')
  const [anak, setAnak] = useState<string[]>([])
  const [setorKe, setSetorKe] = useState<'saya' | 'daerah'>('saya')
  const [hari, setHari] = useState('365')
  const [hasil, setHasil] = useState<{ token: string; nama: string; jenis: JenisDaftar } | null>(null)
  const j = JENIS_DAFTAR[jenis]
  const opsiWilayah = useDataSuper(() => pilihanWilayah(db, j.tingkat), [db, jenis])
  const wilayahFinal = jenis === 'kurikulum' ? profil.wilayah_id : wilayah
  const delegasi = jenis === 'wali' || jenis === 'generus'
  const daftarAnak = useDataSuper(() => (delegasi && wilayah ? generusPilihanToken(db, wilayah) : []), [db, wilayah, delegasi])
  const infoKode = useMemo(() => {
    if (!kode.trim()) return null
    try {
      return { ok: true as const, d: bacaKodePerangkat(kode) }
    } catch (e) {
      return { ok: false as const, pesan: pesanGalat(e) }
    }
  }, [kode])

  const gantiJenis = (v: JenisDaftar) => {
    setJenis(v)
    setAnak([])
    if (wilayah && !pilihanWilayah(db, JENIS_DAFTAR[v].tingkat).some((o) => o.nilai === wilayah)) setWilayah('')
  }
  const pilihAnak = (id: string, centang: boolean) => {
    const g = daftarAnak.data?.find((x) => x.id === id)
    if (jenis === 'generus') {
      setAnak(centang ? [id] : [])
      if (centang && g) setNama(g.nama)
      return
    }
    setAnak((a) => (centang ? [...a, id] : a.filter((x) => x !== id)))
    if (centang && g?.wali_nama && !nama.trim()) setNama(g.wali_nama)
  }
  const siap = infoKode?.ok && wilayahFinal && nama.trim() && (!delegasi || anak.length > 0)

  const terbit = async () => {
    const t = await aksi(
      () =>
        terbitkanTokenBawah(db, kunci, {
          kodePerangkat: kode,
          role: j.role,
          nama,
          wilayahId: wilayahFinal,
          berlakuHari: Number(hari) || 365,
          generusIds: delegasi ? anak : undefined,
          setorKe: jenis === 'pengurus' || jenis === 'mubaligh' ? setorKe : undefined,
        }),
      `Token ${j.teks} untuk ${nama.trim()} diterbitkan.`,
    )
    if (t) {
      setHasil({ token: t, nama: nama.trim(), jenis })
      setKode('')
      setNama('')
      setAnak([])
    }
  }

  return (
    <>
      <JudulHalaman judul="Daftarkan" keterangan="Terbitkan token untuk HP atau laptop di seluruh daerah." />
      <Kartu judul="1. Untuk siapa?">
        <Pilihan label="Peran" nilai={jenis} ubah={(v) => gantiJenis(v as JenisDaftar)} pilihan={(Object.keys(JENIS_DAFTAR) as JenisDaftar[]).map((x) => ({ nilai: x, teks: JENIS_DAFTAR[x].teks }))} />
        {jenis === 'kurikulum' ? (
          <p className="keterangan">EXE Kurikulum berlaku untuk seluruh daerah.</p>
        ) : (
          <KeadaanData hasil={opsiWilayah} kosong={(d) => !d.length} teksKosong="Belum ada wilayah. Buka paket dari Daerah dulu (menu Sinkron).">
            {(d) => <Pilihan label={j.tingkat.length === 1 && j.tingkat[0] === 'desa' ? 'Desa' : j.tingkat.length === 1 ? 'Kelompok' : 'Wilayah tugas'} nilai={wilayah} ubah={setWilayah} pilihan={d} kosong="— pilih —" />}
          </KeadaanData>
        )}
        {delegasi && wilayah ? (
          <KeadaanData hasil={daftarAnak} kosong={(d) => !d.length} teksKosong="Belum ada anak di kelompok ini. Tambahkan dulu di menu Data → Generus.">
            {(d) => (
              <fieldset className="kolom">
                <legend>{jenis === 'generus' ? 'Murid' : 'Anak (centang semua anak orang tua ini)'}</legend>
                <ul className="daftar-centang">
                  {d.map((g) => (
                    <li key={g.id}>
                      <label className="centang">
                        <input
                          type={jenis === 'generus' ? 'radio' : 'checkbox'}
                          name="anak"
                          checked={anak.includes(g.id)}
                          disabled={jenis === 'generus' && g.status === 'mondok'}
                          onChange={(e) => pilihAnak(g.id, e.target.checked)}
                        />
                        <span>
                          {g.nama} {g.kategori ? <small>({label(LABEL_KATEGORI, g.kategori)})</small> : null}
                        </span>
                        {g.usulan ? <Lencana warna="kuning">Baru</Lencana> : null}
                        {g.status === 'mondok' ? <Lencana warna="kuning">Mondok</Lencana> : null}
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}
          </KeadaanData>
        ) : null}
        <Isian label={delegasi && jenis === 'wali' ? 'Nama orang tua' : 'Nama pemegang'} nilai={nama} ubah={setNama} placeholder="mis. Ust. Hasan" />
        {jenis === 'pengurus' || jenis === 'mubaligh' ? (
          <Pilihan
            label="Setoran HP itu dikirim ke"
            nilai={setorKe}
            ubah={(v) => setSetorKe(v as 'saya' | 'daerah')}
            pilihan={[
              { nilai: 'saya', teks: 'HP Super Admin ini' },
              { nilai: 'daerah', teks: 'Langsung ke Admin Daerah (laptop)' },
            ]}
          />
        ) : null}
        <Isian label="Masa berlaku (hari)" type="number" inputMode="numeric" nilai={hari} ubah={setHari} min={1} max={3650} />
      </Kartu>
      <Kartu judul="2. Kode Perangkat penerima">
        {pindai ? (
          <PemindaiQr
            awalan="PPGD1."
            pemindai={platform.pemindai}
            labelTempel="Atau tempel Kode Perangkat di sini"
            batal={() => setPindai(false)}
            dapat={(t) => {
              setKode(t)
              setPindai(false)
            }}
          />
        ) : (
          <>
            <Tombol penuh varian="kedua" onClick={() => setPindai(true)}>
              Pindai QR Kode Perangkat
            </Tombol>
            <AreaTeks label="Kode Perangkat" nilai={kode} ubah={setKode} baris={3} placeholder="PPGD1.…" bantuan={infoKode?.ok ? `Perangkat: ${infoKode.d.label || 'tanpa nama'}` : undefined} />
            {infoKode && !infoKode.ok ? <Spanduk jenis="peringatan">{infoKode.pesan}</Spanduk> : null}
          </>
        )}
      </Kartu>
      <Tombol penuh disabled={!siap} onClick={terbit}>
        Terbitkan token
      </Tombol>
      {hasil ? <ModalTokenSuper {...hasil} tutup={() => setHasil(null)} /> : null}
    </>
  )
}

function ModalTokenSuper(p: { token: string; nama: string; jenis: JenisDaftar; tutup: () => void }) {
  const { platform, toast } = useSuper()
  const exe = p.jenis === 'exe_desa' || p.jenis === 'exe_kelompok' || p.jenis === 'kurikulum'
  return (
    <Modal
      judul={`Token untuk ${p.nama}`}
      tutup={p.tutup}
      aksi={
        <>
          <Tombol
            varian="kedua"
            onClick={async () => {
              await platform.salinTeks(p.token)
              toast('sukses', 'Token disalin.')
            }}
          >
            Salin token
          </Tombol>
          <Tombol varian="wa" onClick={() => platform.bagikanTeks(p.token, `Token PPG untuk ${p.nama}`)}>
            Kirim lewat WA
          </Tombol>
        </>
      }
    >
      <p>
        {exe
          ? 'Kirim token ini lewat WA, lalu tempel di aplikasi laptop (menu “Aktifkan dengan kode”).'
          : 'Minta penerima menekan “Pindai QR Token” lalu arahkan kamera ke QR ini (beberapa QR bergantian), atau kirim lewat WA lalu “Tempel Token”.'}
      </p>
      <div className="kotak-qr">
        <QrBerseri teks={p.token} label="QR token" />
      </div>
      <details className="teks-kode">
        <summary>Lihat teks token</summary>
        <code data-testid="teks-token-super">{p.token}</code>
      </details>
    </Modal>
  )
}

// ---------------- Data: wilayah, generus, pengajian ----------------

function DataSuper() {
  const [bagian, setBagian] = useState<'menu' | 'wilayah' | 'generus' | 'pengajian'>('menu')
  if (bagian === 'wilayah') return <WilayahSuper kembali={() => setBagian('menu')} />
  if (bagian === 'generus') return <GenerusSuper kembali={() => setBagian('menu')} />
  if (bagian === 'pengajian') return <PengajianSuper kembali={() => setBagian('menu')} />
  return (
    <>
      <JudulHalaman judul="Data" keterangan="Tambahan data diajukan ke Daerah dan disetujui otomatis saat setoran HP ini sampai di Daerah." />
      <MenuDaftar
        item={[
          { teks: 'Wilayah', ket: 'Daerah, desa, kelompok', ikon: '⌂', buka: () => setBagian('wilayah') },
          { teks: 'Generus', ket: 'Tambah cepat, ubah status, pindah', ikon: '☺', buka: () => setBagian('generus') },
          { teks: 'Pengajian / kelas', ket: 'Jadwal rutin per kategori', ikon: '◷', buka: () => setBagian('pengajian') },
        ]}
      />
    </>
  )
}

const PESAN_USULAN = 'Disetujui otomatis saat setoran HP ini sampai di Daerah.'

function WilayahSuper(p: { kembali: () => void }) {
  const { db, aksi } = useSuper()
  const [tingkat, setTingkat] = useState<'desa' | 'kelompok'>('kelompok')
  const [induk, setInduk] = useState('')
  const [nama, setNama] = useState('')
  const [kode, setKode] = useState('')
  const data = useDataSuper(
    () => ({
      desa: daftarWilayah(db, { tingkat: 'desa' }),
      kelompok: daftarWilayah(db, { tingkat: 'kelompok' }),
      usulan: daftarUsulan(db, { status: 'menunggu' }).filter((u) => u.jenis === 'tambah_wilayah'),
    }),
    [db],
  )
  const indukPilihan = pilihanWilayah(db, [tingkat === 'desa' ? 'daerah' : 'desa'])
  return (
    <>
      <JudulHalaman judul="Wilayah" kembali={p.kembali} />
      <KeadaanData hasil={data}>
        {(d) => (
          <Kartu judul="Desa & kelompok">
            {!d.desa.length && !d.usulan.length ? <Kosong teks="Belum ada desa. Buka paket dari Daerah atau tambahkan di bawah." /> : null}
            <ul className="daftar-sederhana">
              {d.desa.map((x) => (
                <li key={x.id}>
                  <strong>Desa {x.nama}</strong>
                  <small>{d.kelompok.filter((k) => k.induk_id === x.id).map((k) => k.nama).join(', ') || 'belum ada kelompok'}</small>
                </li>
              ))}
              {d.usulan.map((u) => (
                <li key={u.id}>
                  <span>
                    {u.data.tingkat === 'desa' ? 'Desa ' : 'Kelompok '}
                    {String(u.data.nama)}
                  </span>
                  <Lencana warna="kuning">Menunggu Daerah</Lencana>
                </li>
              ))}
            </ul>
          </Kartu>
        )}
      </KeadaanData>
      <Kartu judul="Tambah wilayah">
        <Segmen
          label="Tingkat"
          nilai={tingkat}
          ubah={(v) => {
            setTingkat(v)
            setInduk('')
          }}
          pilihan={[
            { nilai: 'desa', teks: 'Desa' },
            { nilai: 'kelompok', teks: 'Kelompok' },
          ]}
        />
        <Pilihan label={tingkat === 'desa' ? 'Di daerah' : 'Di desa'} nilai={induk} ubah={setInduk} pilihan={indukPilihan} kosong="— pilih —" />
        <Isian label="Nama wilayah" nilai={nama} ubah={setNama} />
        <Isian label="Kode (boleh kosong)" nilai={kode} ubah={setKode} />
        <Tombol
          penuh
          disabled={!induk || !nama.trim()}
          onClick={async () => {
            const r = await aksi(
              () => ajukanUsulan(db, { jenis: 'tambah_wilayah', kelompokId: induk, data: { tingkat, nama: nama.trim(), kode: kode.trim() || null } }),
              `${tingkat === 'desa' ? 'Desa' : 'Kelompok'} ${nama.trim()} diajukan. ${PESAN_USULAN}`,
            )
            if (r) {
              setNama('')
              setKode('')
            }
          }}
        >
          Ajukan wilayah
        </Tombol>
      </Kartu>
    </>
  )
}

function GenerusSuper(p: { kembali: () => void }) {
  const { db, aksi } = useSuper()
  const [kelompok, setKelompok] = useState('')
  const [form, setForm] = useState(false)
  const [ubah, setUbah] = useState<{ id: string; nama: string } | null>(null)
  const opsi = useDataSuper(() => pilihanWilayah(db, ['kelompok']), [db])
  const daftar = useDataSuper(() => (kelompok ? generusPilihanToken(db, kelompok) : []), [db, kelompok])
  return (
    <>
      <JudulHalaman judul="Generus" kembali={p.kembali} />
      <KeadaanData hasil={opsi} kosong={(d) => !d.length} teksKosong="Belum ada kelompok. Buka paket dari Daerah dulu.">
        {(d) => <Pilihan label="Kelompok" nilai={kelompok} ubah={setKelompok} pilihan={d} kosong="— pilih kelompok —" />}
      </KeadaanData>
      {kelompok ? (
        <>
          <Tombol penuh onClick={() => setForm(true)}>
            + Tambah generus
          </Tombol>
          <KeadaanData hasil={daftar} kosong={(d) => !d.length} teksKosong="Belum ada generus di kelompok ini.">
            {(d) => (
              <ul className="daftar-sederhana">
                {d.map((g) => (
                  <li key={g.id}>
                    <span>
                      <strong>{g.nama}</strong> <small>{label(LABEL_KATEGORI, g.kategori)}</small>
                      {g.wali_nama ? <small> · Ortu: {g.wali_nama}{g.wali_no_hp ? ` (${g.wali_no_hp})` : ''}</small> : null}
                    </span>
                    {g.usulan ? <Lencana warna="kuning">Menunggu Daerah</Lencana> : <Tombol kecil varian="kedua" onClick={() => setUbah({ id: g.id, nama: g.nama })}>Ubah</Tombol>}
                  </li>
                ))}
              </ul>
            )}
          </KeadaanData>
        </>
      ) : null}
      {form ? (
        <FormGenerusBaru
          tutup={() => setForm(false)}
          simpan={async (data) => {
            const r = await aksi(() => ajukanUsulan(db, { jenis: 'tambah_generus', kelompokId: kelompok, data }), `${String(data.nama)} ditambahkan. Bisa langsung dipilih saat menerbitkan token orang tua/murid.`)
            if (r) setForm(false)
          }}
        />
      ) : null}
      {ubah ? <UbahGenerus generus={ubah} kelompok={kelompok} tutup={() => setUbah(null)} /> : null}
    </>
  )
}

function FormGenerusBaru(p: { tutup: () => void; simpan: (d: Record<string, unknown>) => Promise<void> }) {
  const [nama, setNama] = useState('')
  const [jk, setJk] = useState<'L' | 'P' | null>(null)
  const [kategori, setKategori] = useState('caberawit_a')
  const [wali, setWali] = useState('')
  const [hp, setHp] = useState('')
  return (
    <Modal
      judul="Tambah generus"
      tutup={p.tutup}
      aksi={
        <Tombol
          disabled={!nama.trim() || !jk}
          onClick={() => p.simpan({ nama: nama.trim(), jenis_kelamin: jk, kategori, wali_nama: wali.trim() || null, wali_no_hp: hp.trim() || null, mulai: tanggalHariIni() })}
        >
          Simpan generus
        </Tombol>
      }
    >
      <Isian label="Nama generus" nilai={nama} ubah={setNama} />
      <Segmen
        label="Jenis kelamin"
        nilai={jk}
        ubah={setJk}
        pilihan={[
          { nilai: 'L', teks: 'Laki-laki' },
          { nilai: 'P', teks: 'Perempuan' },
        ]}
      />
      <Pilihan label="Kategori" nilai={kategori} ubah={setKategori} pilihan={KATEGORI_GENERUS.map((k) => ({ nilai: k, teks: label(LABEL_KATEGORI, k) }))} />
      <Isian label="Nama orang tua" nilai={wali} ubah={setWali} />
      <Isian label="No. HP orang tua" type="tel" inputMode="tel" nilai={hp} ubah={setHp} placeholder="08…" />
    </Modal>
  )
}

function UbahGenerus(p: { generus: { id: string; nama: string }; kelompok: string; tutup: () => void }) {
  const { db, aksi } = useSuper()
  const [status, setStatus] = useState('')
  const [tujuan, setTujuan] = useState('')
  const kel = pilihanWilayah(db, ['kelompok']).filter((o) => o.nilai !== p.kelompok)
  return (
    <Modal judul={`Ubah ${p.generus.nama}`} tutup={p.tutup}>
      <Pilihan label="Status baru" nilai={status} ubah={setStatus} pilihan={STATUS_GENERUS.map((s) => ({ nilai: s, teks: label(LABEL_STATUS_GENERUS, s) }))} kosong="— pilih status —" />
      <Tombol
        penuh
        disabled={!status}
        onClick={async () => {
          const r = await aksi(
            () => ajukanUsulan(db, { jenis: 'ubah_status', kelompokId: p.kelompok, data: { generus_id: p.generus.id, status, tanggal: tanggalHariIni() } }),
            `Perubahan status ${p.generus.nama} diajukan. ${PESAN_USULAN}`,
          )
          if (r) p.tutup()
        }}
      >
        Ajukan status
      </Tombol>
      <Pilihan label="Pindah ke kelompok" nilai={tujuan} ubah={setTujuan} pilihan={kel} kosong="— pilih kelompok —" />
      <Tombol
        penuh
        varian="kedua"
        disabled={!tujuan}
        onClick={async () => {
          const r = await aksi(
            () => ajukanUsulan(db, { jenis: 'pindah_kelompok', kelompokId: p.kelompok, data: { generus_id: p.generus.id, kelompok_tujuan_id: tujuan, tanggal: tanggalHariIni() } }),
            `Pindah kelompok ${p.generus.nama} diajukan. ${PESAN_USULAN}`,
          )
          if (r) p.tutup()
        }}
      >
        Ajukan pindah
      </Tombol>
    </Modal>
  )
}

function PengajianSuper(p: { kembali: () => void }) {
  const { db, aksi } = useSuper()
  const [wilayah, setWilayah] = useState('')
  const [nama, setNama] = useState('')
  const [hari, setHari] = useState('')
  const [jam, setJam] = useState('')
  const [kategori, setKategori] = useState('')
  const opsi = useDataSuper(() => pilihanWilayah(db, ['kelompok', 'desa', 'daerah']), [db])
  const daftar = useDataSuper(
    () =>
      wilayah
        ? {
            ada: daftarPengajian(db, [wilayah]),
            usulan: daftarUsulan(db, { status: 'menunggu', kelompokIds: [wilayah] }).filter((u) => u.jenis === 'tambah_pengajian'),
          }
        : { ada: [], usulan: [] },
    [db, wilayah],
  )
  const jamSah = !jam || /^([01]\d|2[0-3]):[0-5]\d$/.test(jam)
  return (
    <>
      <JudulHalaman judul="Pengajian / kelas" kembali={p.kembali} />
      <KeadaanData hasil={opsi} kosong={(d) => !d.length} teksKosong="Belum ada wilayah. Buka paket dari Daerah dulu.">
        {(d) => <Pilihan label="Wilayah" nilai={wilayah} ubah={setWilayah} pilihan={d} kosong="— pilih wilayah —" />}
      </KeadaanData>
      {wilayah ? (
        <>
          <KeadaanData hasil={daftar} kosong={(d) => !d.ada.length && !d.usulan.length} teksKosong="Belum ada pengajian rutin di wilayah ini.">
            {(d) => (
              <ul className="daftar-sederhana">
                {d.ada.map((x) => (
                  <li key={x.id}>
                    <span>
                      <strong>{x.nama}</strong> <small>{x.hari !== null ? NAMA_HARI[x.hari] : ''} {x.jam ?? ''}</small>
                    </span>
                    {x.kategori_generus ? <Lencana warna="teal">{x.kategori_generus.split(',').map((k) => label(LABEL_KATEGORI, k)).join(', ')}</Lencana> : null}
                  </li>
                ))}
                {d.usulan.map((u) => (
                  <li key={u.id}>
                    <span>{String(u.data.nama)}</span>
                    <Lencana warna="kuning">Menunggu Daerah</Lencana>
                  </li>
                ))}
              </ul>
            )}
          </KeadaanData>
          <Kartu judul="Tambah pengajian / kelas">
            <Isian label="Nama pengajian" nilai={nama} ubah={setNama} placeholder="mis. Kelas Caberawit" />
            <Pilihan label="Hari" nilai={hari} ubah={setHari} pilihan={NAMA_HARI.map((h, i) => ({ nilai: String(i), teks: h }))} kosong="— tidak tetap —" />
            <Isian label="Jam (JJ:MM)" nilai={jam} ubah={setJam} placeholder="16:00" />
            <Pilihan label="Kelas (kategori)" nilai={kategori} ubah={setKategori} pilihan={KATEGORI_GENERUS.map((k) => ({ nilai: k, teks: label(LABEL_KATEGORI, k) }))} kosong="Semua kategori" />
            {!jamSah ? <Spanduk jenis="peringatan">Jam ditulis seperti 16:00.</Spanduk> : null}
            <Tombol
              penuh
              disabled={!nama.trim() || !jamSah}
              onClick={async () => {
                const r = await aksi(
                  () =>
                    ajukanUsulan(db, {
                      jenis: 'tambah_pengajian',
                      kelompokId: wilayah,
                      data: { nama: nama.trim(), hari: hari === '' ? null : Number(hari), jam: jam || null, kategori_generus: kategori ? [kategori] : null },
                    }),
                  `Pengajian ${nama.trim()} diajukan. ${PESAN_USULAN}`,
                )
                if (r) {
                  setNama('')
                  setJam('')
                }
              }}
            >
              Ajukan pengajian
            </Tombol>
          </Kartu>
        </>
      ) : null}
    </>
  )
}

// ---------------- Sinkron ----------------

function SinkronSuper() {
  const { db, kunci, platform, aksi, kirimBerkas, bukaBerkas, profil } = useSuper()
  const setor = useSetor()
  const [hasil, setHasil] = useState<HasilImporBanyak[] | null>(null)
  const [wilayah, setWilayah] = useState('')
  const opsi = useDataSuper(() => pilihanWilayah(db, ['kelompok', 'desa']), [db])
  const penerima = useDataSuper(() => daftarPenerimaBalasan(db), [db])
  const info = useDataSuper(() => ringkasanBerandaExe(db), [db])
  return (
    <>
      <JudulHalaman judul="Sinkron" keterangan="Setor ke Daerah, buka paket & setoran, kirim paket & balasan." />
      <Kartu judul="Setor ke Daerah">
        <p>{info.data?.pengingat ? teksDataSetor(info.data.pengingat, 'Daerah') : info.data?.belumDisetor ? `Ada ${info.data.belumDisetor} data belum disetor.` : 'Belum ada data untuk disetor.'} Setoran membawa perangkat yang didaftarkan HP ini, usulan data, dan setoran HP di bawahnya.</p>
        <Tombol penuh onClick={() => setor()}>
          Setor ke Daerah
        </Tombol>
        <Tombol penuh varian="tipis" onClick={() => setor(true)}>
          Kirim ulang semua data
        </Tombol>
      </Kartu>
      <Kartu judul="Buka Berkas">
        <p>Paket dari Daerah, atau setoran dari HP pengurus/mubaligh yang didaftarkan HP ini. Boleh pilih banyak berkas.</p>
        <Tombol
          penuh
          onClick={async () => {
            const d = await platform.pilihBerkas({ banyak: true })
            if (d.length) setHasil(await bukaBerkas(d))
          }}
        >
          Buka Paket / Impor Setoran
        </Tombol>
        {hasil ? (
          <ul className="daftar-sederhana" aria-label="Hasil membuka berkas">
            {hasil.map((h, i) => {
              const m = pesanHasilBerkas(h)
              return (
                <li key={i}>
                  <span>{m.teks}</span>
                  <Lencana warna={m.sukses ? 'hijau' : 'merah'}>{m.sukses ? 'Berhasil' : 'Gagal'}</Lencana>
                </li>
              )
            })}
          </ul>
        ) : null}
      </Kartu>
      <Kartu judul="Kirim Paket">
        <p>Paket membawa data wilayah, token & pencabutan, kunci kelompok, dan materi ke HP/laptop yang didaftarkan.</p>
        <KeadaanData hasil={opsi} kosong={(d) => !d.length} teksKosong="Belum ada wilayah.">
          {(d) => <Pilihan label="Wilayah paket" nilai={wilayah} ubah={setWilayah} pilihan={d} kosong="— pilih wilayah —" />}
        </KeadaanData>
        <div className="baris-tombol">
          <Tombol
            disabled={!wilayah}
            onClick={async () => {
              const b = await aksi(() => buatPaket(db, wilayah, kunci))
              if (b) await kirimBerkas(b, `Paket untuk ${b.penerima} perangkat siap dikirim.`)
            }}
          >
            Kirim Paket
          </Tombol>
          <Tombol
            varian="kedua"
            onClick={async () => {
              const l = await aksi(() => {
                const kel = kelompokBerpenerima(db, profil.wilayah_id)
                if (!kel.length) throw new Error('Belum ada kelompok yang punya perangkat aktif.')
                return kel.map((k) => buatPaket(db, k, kunci))
              })
              if (l) await kirimBerkas(l, `${l.length} paket kelompok siap dikirim.`)
            }}
          >
            Paket semua kelompok
          </Tombol>
        </div>
      </Kartu>
      <Kartu judul="Kirim Balasan">
        <p>Balasan untuk HP murid & orang tua: data anak, kunci kelompok terbaru, dan pencabutan.</p>
        <KeadaanData hasil={penerima} kosong={(d) => !d.length} teksKosong="Belum ada HP murid/orang tua yang terdaftar.">
          {(d) => (
            <ul className="daftar-sederhana">
              {d.map((x) => (
                <li key={x.perangkatId}>
                  <span>
                    <strong>{x.nama.join(', ')}</strong> <small>{x.label ?? ''}</small>
                  </span>
                  <Tombol
                    kecil
                    onClick={async () => {
                      const b = await aksi(() => buatBalasan(db, x.perangkatId))
                      if (b) await kirimBerkas(b, `Balasan untuk ${x.nama.join(', ')} siap dikirim.`)
                    }}
                  >
                    Kirim Balasan
                  </Tombol>
                </li>
              ))}
            </ul>
          )}
        </KeadaanData>
      </Kartu>
    </>
  )
}

// ---------------- Lainnya: perangkat & pengaturan ----------------

function LainnyaSuper() {
  const [bagian, setBagian] = useState<'menu' | 'perangkat' | 'pengaturan'>('menu')
  const { kunciSekarang, keluar } = useSuper()
  if (bagian === 'perangkat') return <PerangkatSuper kembali={() => setBagian('menu')} />
  if (bagian === 'pengaturan') return <PengaturanSuper kembali={() => setBagian('menu')} />
  return (
    <>
      <JudulHalaman judul="Lainnya" />
      <MenuDaftar
        item={[
          { teks: 'Perangkat', ket: 'Daftar, cabut, bekukan, cairkan', ikon: '☎', buka: () => setBagian('perangkat') },
          { teks: 'Pengaturan', ket: 'Ganti sandi, cadangan', ikon: '⚙', buka: () => setBagian('pengaturan') },
          { teks: 'Kunci sekarang', ket: 'Sandi diminta saat membuka lagi', ikon: '🔒', buka: kunciSekarang },
          { teks: 'Kembali ke profil biasa', ket: 'Profil pengurus/mubaligh/orang tua di HP ini', ikon: '↩', buka: keluar },
        ]}
      />
    </>
  )
}

function PerangkatSuper(p: { kembali: () => void }) {
  const { db, profil, aksi } = useSuper()
  const [cabut, setCabut] = useState<{ id: string; nama: string } | null>(null)
  const daftar = useDataSuper(() => daftarPerangkatRinci(db).filter((x) => idRantaiPenerbit(x.token).includes(profil.token_id)), [db, profil.token_id])
  return (
    <>
      <JudulHalaman judul="Perangkat" keterangan="Perangkat yang didaftarkan HP Super Admin ini." kembali={p.kembali} />
      <KeadaanData hasil={daftar} kosong={(d) => !d.length} teksKosong="Belum ada perangkat yang didaftarkan.">
        {(d) => (
          <ul className="daftar-sederhana">
            {d.map((x) => (
              <li key={x.id}>
                <span>
                  <strong>{x.nama}</strong>
                  <small>
                    {' '}
                    {labelPeran(x.role, x.tingkat)} · {x.wilayah_nama}
                  </small>
                </span>
                <Lencana warna={x.status === 'aktif' ? 'hijau' : x.status === 'dibekukan' ? 'kuning' : 'merah'}>{label(LABEL_STATUS_TOKEN, x.status)}</Lencana>
                {x.status !== 'dicabut' ? (
                  <span className="baris-tombol">
                    {x.status === 'dibekukan' ? (
                      <Tombol kecil varian="kedua" onClick={() => aksi(() => cairkanPerangkat(db, x.id), `${x.nama} dicairkan.`)}>
                        Cairkan
                      </Tombol>
                    ) : (
                      <Tombol kecil varian="kedua" onClick={() => aksi(() => bekukanPerangkat(db, x.id), `${x.nama} dibekukan.`)}>
                        Bekukan
                      </Tombol>
                    )}
                    <Tombol kecil varian="bahaya" onClick={() => setCabut({ id: x.id, nama: x.nama })}>
                      Cabut
                    </Tombol>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </KeadaanData>
      {cabut ? (
        <Konfirmasi
          judul={`Cabut ${cabut.nama}?`}
          pesan="Token dicabut permanen. Pencabutan sampai ke Daerah lewat Setor ke Daerah, dan ke HP lain lewat paket/balasan."
          ya="Cabut"
          bahaya
          batal={() => setCabut(null)}
          setuju={async () => {
            await aksi(() => cabutPerangkat(db, cabut.id), `${cabut.nama} dicabut.`)
            setCabut(null)
          }}
        />
      ) : null}
    </>
  )
}

export function labelPeran(role: string, tingkat?: string | null): string {
  if (role === 'admin') return tingkat === 'daerah' ? 'Super Admin HP' : tingkat === 'desa' ? 'EXE Desa' : 'EXE Kelompok'
  if (role === 'kurikulum') return 'EXE Kurikulum'
  if (role === 'wali') return 'Orang tua'
  if (role === 'generus') return 'Murid'
  return role === 'mubaligh' ? 'Mubaligh' : 'Pengurus'
}

function PengaturanSuper(p: { kembali: () => void }) {
  const { db, aksi, kirimBerkas, platform, toast, gantiDb } = useSuper()
  const [lama, setLama] = useState('')
  const [baru, setBaru] = useState('')
  const [ulang, setUlang] = useState('')
  const [cadangan, setCadangan] = useState<'buat' | { bytes: Uint8Array } | null>(null)
  const [sandiC, setSandiC] = useState('')
  const tutupC = () => {
    setCadangan(null)
    setSandiC('')
  }
  return (
    <>
      <JudulHalaman judul="Pengaturan" kembali={p.kembali} />
      <Kartu judul="Ganti kata sandi Super Admin">
        <Isian label="Kata sandi lama" type="password" nilai={lama} ubah={setLama} />
        <Isian label="Kata sandi baru" type="password" nilai={baru} ubah={setBaru} bantuan="Minimal 8 karakter." />
        <Isian label="Ulangi kata sandi baru" type="password" nilai={ulang} ubah={setUlang} />
        <Tombol
          penuh
          disabled={!lama || baru.length < 8 || baru !== ulang}
          onClick={async () => {
            const r = await aksi(async () => {
              await gantiSandiExe(db, lama, baru)
              return true
            }, 'Kata sandi Super Admin diganti.')
            if (r) {
              setLama('')
              setBaru('')
              setUlang('')
            }
          }}
        >
          Ganti sandi
        </Tombol>
      </Kartu>
      <Kartu judul="Cadangan data Super Admin">
        <p>
          Simpan cadangan di <b>dua tempat</b> (mis. Google Drive dan HP lain). Kunci perangkat di dalamnya tetap terkunci kata sandi Super Admin;
          cadangan juga dikunci kata sandi cadangan.
        </p>
        <Tombol penuh onClick={() => setCadangan('buat')}>
          Cadangkan data Super Admin
        </Tombol>
        <Tombol
          penuh
          varian="kedua"
          onClick={async () => {
            const [b] = await platform.pilihBerkas({ banyak: false })
            if (!b) return
            if (jenisCadanganHp(b.bytes) === 'bukan') return toast('galat', `“${b.nama ?? 'Berkas'}” bukan cadangan PPG Sorong.`)
            setCadangan({ bytes: b.bytes })
          }}
        >
          Pulihkan cadangan Super Admin
        </Tombol>
      </Kartu>
      {cadangan ? (
        <Modal
          judul={cadangan === 'buat' ? 'Buat cadangan Super Admin' : 'Pulihkan cadangan Super Admin'}
          tutup={tutupC}
          aksi={
            <Tombol
              disabled={sandiC.length < PANJANG_SANDI_CADANGAN_MIN}
              onClick={async () => {
                if (cadangan === 'buat') {
                  const c = await aksi(() => buatCadanganHp(db, sandiC))
                  if (!c) return
                  tutupC()
                  await kirimBerkas({ nama: c.nama.replace('PPG_CADANGAN_HP_', 'PPG_CADANGAN_SUPER_'), bytes: c.bytes }, 'Cadangan siap. Simpan di dua tempat dan ingat kata sandinya.')
                } else {
                  const ok = await aksi(async () => {
                    await gantiDb(await bukaCadanganHp(cadangan.bytes, sandiC))
                    return true
                  }, 'Cadangan dipulihkan. Masukkan kata sandi Super Admin.')
                  if (ok) tutupC()
                }
              }}
            >
              {cadangan === 'buat' ? 'Buat cadangan' : 'Pulihkan'}
            </Tombol>
          }
        >
          <Isian label="Kata sandi cadangan" type="password" nilai={sandiC} ubah={setSandiC} bantuan={`Minimal ${PANJANG_SANDI_CADANGAN_MIN} karakter.`} />
        </Modal>
      ) : null}
    </>
  )
}
