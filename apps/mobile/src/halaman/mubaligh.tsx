// Layar peran Mubaligh: Beranda · Setoran Generus · Simak Langsung · Generus · Lainnya
// (Presensi, Terbitkan Token, Jadwal Tambahan, Laporan Pekanan, Kirim Balasan, Setor Data/Setor Akhir, Buka Berkas).
import { useMemo, useState } from 'react'
import {
  batalkanJadwalTambahan,
  buatBalasan,
  buatJadwal,
  cariGenerus,
  daftarDiajukanRinci,
  daftarJadwalTambahan,
  daftarPenerimaBalasan,
  daftarPerangkatRinci,
  laporanWaKelompok,
  namaHari,
  ringkasanKelompok,
  sahkan,
  simakLangsung,
  tambahJadwalTambahan,
  tanggalHariIni,
  terbitkanTokenGenerus,
  type BerkasKeluar,
  type GenerusRinci,
  type KemajuanRinci,
} from '@ppg/core'
import { useApp, useData } from '../konteks'
import type { PropHalaman } from '../kerangka'
import { PemindaiQr, QrBerseri } from '../komponen/qr'
import { cariMateri, FormKemajuan, keDataKemajuan, KEMAJUAN_KOSONG, PemilihMateri, useMateriGenerus, type IsianKemajuan } from '../komponen/materi'
import { Angka, AreaTeks, Isian, JudulHalaman, KeadaanData, Kartu, Kosong, Lencana, MenuDaftar, Modal, Pilihan, Segmen, Tombol } from '../komponen/ui'
import { label, LABEL_KATEGORI, LABEL_STATUS_GENERUS, LABEL_STATUS_TOKEN, LABEL_ROLE, tanggalTeks } from '../utils/label'
import { DaftarUsulan, FormGenerusBaru, FormUsulanGenerus, HalamanPresensi, KartuBukaBerkas, KartuSetorData } from './bersama'
import { KartuGenerus } from './pengurus'

export function BerandaMubaligh(p: PropHalaman) {
  const { db, profil } = useApp()
  const r = useData(() => ringkasanKelompok(db, profil.wilayah_id), [profil.id])
  return (
    <>
      <JudulHalaman judul={`Assalamu'alaikum, ${profil.nama}`} keterangan="Mubaligh" />
      <KeadaanData hasil={r}>
        {(x) => (
          <Kartu judul={x.kelompok ? `Kelompok ${x.kelompok.nama}` : 'Kelompok Anda'}>
            {!x.kelompok ? <p>Data kelompok belum ada. Buka berkas data dari admin di menu Lainnya → Buka Berkas.</p> : null}
            <div className="baris-angka">
              <Angka nilai={x.generusAktif} teks="Generus aktif" />
              <Angka nilai={x.generusMondok} teks="Mondok" warna="kuning" />
              <Angka nilai={x.kemajuanDiajukan} teks="Menunggu disahkan" warna={x.kemajuanDiajukan ? 'merah' : 'hijau'} />
              <Angka nilai={x.usulanMenunggu} teks="Usulan ke admin" warna="abu" />
            </div>
          </Kartu>
        )}
      </KeadaanData>
      <div className="tumpuk">
        <Tombol penuh onClick={() => p.pergi('setoran')}>
          Setoran Generus
        </Tombol>
        <Tombol penuh varian="kedua" onClick={() => p.pergi('simak')}>
          Simak Langsung
        </Tombol>
        <Tombol penuh varian="kedua" onClick={() => p.pergi('lainnya')}>
          Presensi, Token, Jadwal, Laporan…
        </Tombol>
      </div>
    </>
  )
}

// ---------------- Setoran Generus ----------------

function ItemDiajukan(p: { k: KemajuanRinci }) {
  const { db, aksi } = useApp()
  const [catatan, setCatatan] = useState('')
  const k = p.k
  const putuskan = (keputusan: 'disahkan' | 'ditolak') =>
    aksi(() => sahkan(db, k.id, { keputusan, catatan: catatan.trim() || null }), keputusan === 'disahkan' ? `${k.materi_nama} disahkan.` : `${k.materi_nama} ditolak.`)
  return (
    <li className="item-diajukan">
      <div>
        <strong>{k.materi_nama}</strong>
        <small>
          {k.bidang_nama} · {k.kategori_nama} · {tanggalTeks(k.tanggal)}
        </small>
        <p>
          {k.status === 'selesai' ? 'Sudah selesai' : 'Sedang belajar'}
          {k.level !== null ? ` · tingkat ${k.level}` : ''}
          {k.nilai !== null ? ` · nilai ${k.nilai}` : ''}
        </p>
        {k.catatan_generus ? <p className="catatan-generus">“{k.catatan_generus}”</p> : null}
      </div>
      <Isian label={`Catatan untuk ${k.generus_nama}`} nilai={catatan} ubah={setCatatan} placeholder="mis. bacaan sudah lancar" />
      <div className="baris-tombol">
        <Tombol varian="bahaya" onClick={() => putuskan('ditolak')} label={`Tolak ${k.materi_nama} ${k.generus_nama}`}>
          Tolak
        </Tombol>
        <Tombol onClick={() => putuskan('disahkan')} label={`Sahkan ${k.materi_nama} ${k.generus_nama}`}>
          Sahkan
        </Tombol>
      </div>
    </li>
  )
}

export function SetoranGenerus() {
  const { db, profil, platform, bukaBerkas } = useApp()
  const daftar = useData(() => daftarDiajukanRinci(db, profil.wilayah_id), [profil.id])
  const perGenerus = useMemo(() => {
    const m = new Map<string, { nama: string; isi: KemajuanRinci[] }>()
    for (const k of daftar.data ?? []) {
      const e = m.get(k.generus_id) ?? { nama: k.generus_nama, isi: [] }
      e.isi.push(k)
      m.set(k.generus_id, e)
    }
    return [...m.entries()]
  }, [daftar.data])
  return (
    <>
      <JudulHalaman judul="Setoran Generus" keterangan="Buka berkas setoran dari HP generus, lalu sahkan atau tolak." />
      <Kartu>
        <Tombol
          penuh
          onClick={async () => {
            const d = await platform.pilihBerkas({ banyak: true })
            await bukaBerkas(d)
          }}
        >
          Buka berkas setoran (bisa banyak)
        </Tombol>
      </Kartu>
      <KeadaanData hasil={daftar} kosong={(d) => d.length === 0} teksKosong="Tidak ada setoran yang menunggu disahkan.">
        {() => (
          <>
            {perGenerus.map(([gid, g]) => (
              <Kartu key={gid} judul={`${g.nama} (${g.isi.length})`}>
                <ul className="daftar-diajukan">
                  {g.isi.map((k) => (
                    <ItemDiajukan key={k.id} k={k} />
                  ))}
                </ul>
              </Kartu>
            ))}
          </>
        )}
      </KeadaanData>
    </>
  )
}

// ---------------- Simak Langsung ----------------

export function SimakLangsung() {
  const { db, profil, aksi } = useApp()
  const generus = useData(() => cariGenerus(db, { kelompokId: profil.wilayah_id, status: 'aktif' }), [profil.id])
  const [gid, setGid] = useState('')
  const [materiId, setMateriId] = useState('')
  const [isian, setIsian] = useState<IsianKemajuan>(KEMAJUAN_KOSONG)
  const materi = useMateriGenerus(gid || undefined)
  const m = cariMateri(materi.data, materiId)
  return (
    <>
      <JudulHalaman judul="Simak Langsung" keterangan="Untuk generus tanpa HP: catatan langsung disahkan." />
      <KeadaanData hasil={generus} kosong={(d) => d.length === 0} teksKosong="Belum ada generus aktif. Buka berkas data dari admin.">
        {(d) => (
          <Kartu>
            <Pilihan
              label="Generus"
              nilai={gid}
              ubah={(v) => {
                setGid(v)
                setMateriId('')
              }}
              kosong="Pilih generus…"
              pilihan={d.map((g) => ({ nilai: g.id, teks: `${g.nama} (${label(LABEL_KATEGORI, g.kategori)})` }))}
            />
            {gid ? (
              <KeadaanData hasil={materi}>
                {(md) => (md ? <PemilihMateri data={md} nilai={materiId} ubah={setMateriId} /> : <Kosong teks="Materi belum ada." />)}
              </KeadaanData>
            ) : null}
            {m ? (
              <>
                <FormKemajuan tipe={m.tipe} nilai={isian} ubah={setIsian} labelCatatan="Catatan mubaligh (boleh kosong)" />
                <Tombol
                  penuh
                  onClick={async () => {
                    const r = await aksi(() => simakLangsung(db, { generusId: gid, ...keDataKemajuan(materiId, isian) }), `${m.nama} tercatat dan disahkan.`)
                    if (r) {
                      setMateriId('')
                      setIsian(KEMAJUAN_KOSONG)
                    }
                  }}
                >
                  Simpan & sahkan
                </Tombol>
              </>
            ) : null}
          </Kartu>
        )}
      </KeadaanData>
    </>
  )
}

// ---------------- Generus ----------------

export function GenerusMubaligh() {
  const { db, profil } = useApp()
  const [cari, setCari] = useState('')
  const [detail, setDetail] = useState<GenerusRinci | null>(null)
  const [form, setForm] = useState<null | 'baru' | 'ubah_status' | 'pindah_kelompok'>(null)
  const daftar = useData(() => cariGenerus(db, { kelompokId: profil.wilayah_id, cari }), [profil.id, cari])
  const materi = useMateriGenerus(detail?.id)
  return (
    <>
      <JudulHalaman judul="Generus" keterangan="Perubahan data diajukan ke admin sebagai usulan." />
      <Kartu>
        <Isian label="Cari nama" nilai={cari} ubah={setCari} placeholder="Ketik nama…" />
        <Tombol penuh varian="kedua" onClick={() => setForm('baru')}>
          + Usulkan generus baru
        </Tombol>
      </Kartu>
      <KeadaanData hasil={daftar} kosong={(d) => d.length === 0} teksKosong={cari ? 'Tidak ada nama yang cocok.' : 'Belum ada data generus. Buka berkas data dari admin.'}>
        {(d) => (
          <div className="daftar-kartu">
            {d.map((g) => (
              <KartuGenerus key={g.id} g={g} buka={() => setDetail(g)} />
            ))}
          </div>
        )}
      </KeadaanData>
      <DaftarUsulan kelompokIds={[profil.wilayah_id]} />
      {detail && !form ? (
        <Modal judul={detail.nama} tutup={() => setDetail(null)}>
          <dl className="rincian">
            <dt>Kategori</dt>
            <dd>{label(LABEL_KATEGORI, detail.kategori)}</dd>
            <dt>Status</dt>
            <dd>{label(LABEL_STATUS_GENERUS, detail.status)}</dd>
            <dt>Tanggal lahir</dt>
            <dd>{tanggalTeks(detail.tanggal_lahir)}</dd>
            <dt>Orang tua/wali</dt>
            <dd>
              {detail.wali_nama ?? '—'} {detail.wali_no_hp ? `(${detail.wali_no_hp})` : ''}
            </dd>
            <dt>Materi selesai</dt>
            <dd>{materi.data ? `${materi.data.ringkasan.selesai} dari ${materi.data.ringkasan.total} (${materi.data.ringkasan.persen}%)` : '…'}</dd>
          </dl>
          <div className="tumpuk">
            <Tombol penuh varian="kedua" onClick={() => setForm('ubah_status')}>
              Ajukan ubah status (mondok/aktif/…)
            </Tombol>
            <Tombol penuh varian="kedua" onClick={() => setForm('pindah_kelompok')}>
              Ajukan pindah kelompok
            </Tombol>
          </div>
        </Modal>
      ) : null}
      {form === 'baru' ? <FormGenerusBaru kelompokId={profil.wilayah_id} tutup={() => setForm(null)} /> : null}
      {detail && (form === 'ubah_status' || form === 'pindah_kelompok') ? (
        <FormUsulanGenerus
          generus={detail}
          jenis={form}
          tutup={() => {
            setForm(null)
            setDetail(null)
          }}
        />
      ) : null}
    </>
  )
}

// ---------------- Lainnya ----------------

type Sub = 'menu' | 'presensi' | 'token' | 'jadwal' | 'laporan' | 'balasan' | 'setor' | 'berkas'

export function LainnyaMubaligh() {
  const [sub, setSub] = useState<Sub>('menu')
  const kembali = () => setSub('menu')
  if (sub === 'presensi') return <HalamanPresensi kembali={kembali} />
  if (sub === 'token') return <TerbitkanToken kembali={kembali} />
  if (sub === 'jadwal') return <JadwalTambahan kembali={kembali} />
  if (sub === 'laporan') return <LaporanPekananMubaligh kembali={kembali} />
  if (sub === 'balasan') return <KirimBalasan kembali={kembali} />
  if (sub === 'setor')
    return (
      <>
        <JudulHalaman judul="Setor Data" kembali={kembali} />
        <KartuSetorData setorAkhir />
      </>
    )
  if (sub === 'berkas')
    return (
      <>
        <JudulHalaman judul="Buka Berkas" kembali={kembali} />
        <KartuBukaBerkas keterangan="Buka berkas data dari admin, materi, atau setoran belajar generus." />
      </>
    )
  return (
    <>
      <JudulHalaman judul="Lainnya" />
      <MenuDaftar
        item={[
          { teks: 'Presensi', ket: 'Kehadiran pengajian', ikon: '✓', buka: () => setSub('presensi') },
          { teks: 'Terbitkan Token', ket: 'Untuk HP generus / orang tua', ikon: '⚿', buka: () => setSub('token') },
          { teks: 'Jadwal Tambahan', ket: 'Buat & bagikan ke grup WA', ikon: '◷', buka: () => setSub('jadwal') },
          { teks: 'Laporan Pekanan', ket: 'Kirim WA ke orang tua', ikon: '▤', buka: () => setSub('laporan') },
          { teks: 'Kirim Balasan', ket: 'Hasil pengesahan ke HP generus/wali', ikon: '↩', buka: () => setSub('balasan') },
          { teks: 'Setor Data', ket: 'Kirim catatan ke admin; Setor Akhir', ikon: '⇧', buka: () => setSub('setor') },
          { teks: 'Buka Berkas', ket: 'Berkas dari admin atau generus', ikon: '⇩', buka: () => setSub('berkas') },
        ]}
      />
    </>
  )
}

function TerbitkanToken(p: { kembali: () => void }) {
  const { db, profil, platform, aksi, toast } = useApp()
  const generus = useData(() => cariGenerus(db, { kelompokId: profil.wilayah_id }).filter((g) => g.status === 'aktif' || g.status === 'mondok'), [profil.id])
  const terbit = useData(() => daftarPerangkatRinci(db, { role: ['generus', 'wali'], wilayahId: profil.wilayah_id }), [profil.id])
  const [role, setRole] = useState<'generus' | 'wali'>('generus')
  const [pilih, setPilih] = useState<string[]>([])
  const [nama, setNama] = useState('')
  const [kode, setKode] = useState('')
  const [pindai, setPindai] = useState(false)
  const [hasil, setHasil] = useState<{ token: string; nama: string } | null>(null)

  const daftarG = generus.data ?? []
  const namaUsulan = (ids: string[], r: 'generus' | 'wali') => {
    const g = daftarG.find((x) => x.id === ids[0])
    if (!g) return ''
    return r === 'generus' ? g.nama : g.wali_nama ?? `Orang tua ${g.nama}`
  }
  const ubahPilih = (ids: string[]) => {
    setPilih(ids)
    setNama(namaUsulan(ids, role))
  }

  return (
    <>
      <JudulHalaman judul="Terbitkan Token" keterangan="Token untuk HP generus atau orang tua di kelompok Anda." kembali={p.kembali} />
      <KeadaanData hasil={generus} kosong={(d) => d.length === 0} teksKosong="Belum ada generus. Buka berkas data dari admin.">
        {(d) => (
          <Kartu>
            <Segmen
              label="Untuk siapa"
              nilai={role}
              ubah={(v) => {
                setRole(v)
                setPilih([])
                setNama('')
              }}
              pilihan={[
                { nilai: 'generus', teks: 'Generus' },
                { nilai: 'wali', teks: 'Orang tua (wali)' },
              ]}
            />
            {role === 'generus' ? (
              <Pilihan
                label="Generus"
                nilai={pilih[0] ?? ''}
                ubah={(v) => ubahPilih(v ? [v] : [])}
                kosong="Pilih generus…"
                pilihan={d.filter((g) => g.status === 'aktif').map((g) => ({ nilai: g.id, teks: g.nama }))}
              />
            ) : (
              <fieldset className="pilih-anak">
                <legend>Anak-anaknya</legend>
                {d.map((g) => (
                  <label key={g.id} className="centang">
                    <input
                      type="checkbox"
                      checked={pilih.includes(g.id)}
                      onChange={(e) => ubahPilih(e.target.checked ? [...pilih, g.id] : pilih.filter((x) => x !== g.id))}
                    />
                    {g.nama}
                  </label>
                ))}
              </fieldset>
            )}
            <Isian label="Nama pemegang token" nilai={nama} ubah={setNama} />
            {pindai ? (
              <PemindaiQr
                awalan="PPGD1."
                labelTempel="Atau tempel Kode Perangkat"
                batal={() => setPindai(false)}
                dapat={(t) => {
                  setKode(t)
                  setPindai(false)
                  toast('sukses', 'Kode Perangkat terbaca.')
                }}
              />
            ) : (
              <>
                <AreaTeks label="Kode Perangkat HP tujuan" nilai={kode} ubah={setKode} baris={3} placeholder="PPGD1.…" />
                <Tombol penuh varian="kedua" onClick={() => setPindai(true)}>
                  Pindai QR Kode Perangkat
                </Tombol>
              </>
            )}
            <Tombol
              penuh
              disabled={!pilih.length || !kode.trim() || !nama.trim()}
              onClick={async () => {
                const t = await aksi(() => terbitkanTokenGenerus(db, profil.id, { kodePerangkat: kode.trim(), role, generusIds: pilih, nama: nama.trim() }))
                if (t) {
                  setHasil({ token: t, nama: nama.trim() })
                  setKode('')
                  setPilih([])
                  setNama('')
                }
              }}
            >
              Terbitkan Token
            </Tombol>
          </Kartu>
        )}
      </KeadaanData>
      <Kartu judul="Token yang sudah diterbitkan">
        <KeadaanData hasil={terbit} kosong={(d) => d.length === 0} teksKosong="Belum ada.">
          {(d) => (
            <ul className="daftar-sederhana">
              {d.map((t) => (
                <li key={t.token_id}>
                  <span>
                    {t.nama} <small>· {label(LABEL_ROLE, t.role)} · {t.label ?? 'HP'}</small>
                  </span>
                  <Lencana warna={t.status === 'aktif' ? 'hijau' : t.status === 'dibekukan' ? 'kuning' : 'merah'}>{label(LABEL_STATUS_TOKEN, t.status)}</Lencana>
                </li>
              ))}
            </ul>
          )}
        </KeadaanData>
      </Kartu>
      {hasil ? (
        <Modal
          judul={`Token untuk ${hasil.nama}`}
          tutup={() => setHasil(null)}
          aksi={
            <>
              <Tombol
                varian="kedua"
                onClick={async () => {
                  await platform.salinTeks(hasil.token)
                  toast('sukses', 'Token disalin.')
                }}
              >
                Salin
              </Tombol>
              <Tombol varian="wa" onClick={() => platform.bagikanTeks(hasil.token, `Token PPG ${hasil.nama}`)}>
                Kirim lewat WA
              </Tombol>
            </>
          }
        >
          <div className="kotak-qr">
            <QrBerseri teks={hasil.token} label="QR token" />
          </div>
          <p>
            Pemilik HP membuka <b>Pindai QR Token</b> lalu mengarahkan kamera ke layar ini sampai semua bagian terbaca. Bisa juga tekan{' '}
            <b>Kirim lewat WA</b>, lalu pemilik HP memilih “Tempel Token”.
          </p>
          <details className="teks-kode">
            <summary>Lihat teks token</summary>
            <code data-testid="token-hasil">{hasil.token}</code>
          </details>
        </Modal>
      ) : null}
    </>
  )
}

function JadwalTambahan(p: { kembali: () => void }) {
  const { db, profil, aksi, kirimBerkas } = useApp()
  const hariIni = tanggalHariIni()
  const daftar = useData(() => daftarJadwalTambahan(db, profil.wilayah_id, { mulai: hariIni, termasukBatal: true }), [profil.id])
  const [tanggal, setTanggal] = useState(hariIni)
  const [jam, setJam] = useState('')
  const [judul, setJudul] = useState('')
  const [ket, setKet] = useState('')
  return (
    <>
      <JudulHalaman judul="Jadwal Tambahan" keterangan="Kegiatan di luar jadwal rutin, dibagikan ke grup WA kelompok." kembali={p.kembali} />
      <Kartu judul="Tambah jadwal">
        <Isian label="Judul kegiatan" nilai={judul} ubah={setJudul} placeholder="mis. Muroja'ah bersama" />
        <div className="baris-dua">
          <Isian label="Tanggal" type="date" nilai={tanggal} ubah={(v) => v && setTanggal(v)} />
          <Isian label="Jam" type="time" nilai={jam} ubah={setJam} />
        </div>
        <AreaTeks label="Keterangan (boleh kosong)" nilai={ket} ubah={setKet} baris={2} />
        <Tombol
          penuh
          disabled={!judul.trim()}
          onClick={async () => {
            const r = await aksi(
              () => tambahJadwalTambahan(db, { kelompokId: profil.wilayah_id, tanggal, jam: jam || null, judul, keterangan: ket.trim() || null }),
              'Jadwal tersimpan. Jangan lupa bagikan ke grup WA.',
            )
            if (r) {
              setJudul('')
              setKet('')
            }
          }}
        >
          Simpan jadwal
        </Tombol>
      </Kartu>
      <Kartu
        judul="Jadwal mendatang"
        aksi={
          <Tombol
            kecil
            varian="wa"
            onClick={async () => {
              const b = await aksi(() => buatJadwal(db, { kelompokId: profil.wilayah_id }))
              if (b) await kirimBerkas(b, 'Berkas jadwal siap. Kirim ke grup WA kelompok.')
            }}
          >
            Bagikan ke grup WA
          </Tombol>
        }
      >
        <KeadaanData hasil={daftar} kosong={(d) => d.length === 0} teksKosong="Belum ada jadwal tambahan.">
          {(d) => (
            <ul className="daftar-sederhana">
              {d.map((j) => (
                <li key={j.id} className={j.dibatalkan ? 'batal' : ''}>
                  <span>
                    <b>{j.judul}</b>
                    <small>
                      {' '}
                      · {namaHari(j.tanggal)}, {tanggalTeks(j.tanggal)}
                      {j.jam ? ` · ${j.jam}` : ''}
                    </small>
                  </span>
                  {j.dibatalkan ? (
                    <Lencana warna="merah">Batal</Lencana>
                  ) : (
                    <Tombol kecil varian="tipis" onClick={() => aksi(() => batalkanJadwalTambahan(db, j.id), 'Jadwal dibatalkan. Bagikan ulang ke grup WA.')}>
                      Batalkan
                    </Tombol>
                  )}
                </li>
              ))}
            </ul>
          )}
        </KeadaanData>
      </Kartu>
    </>
  )
}

function LaporanPekananMubaligh(p: { kembali: () => void }) {
  const { db, profil, platform } = useApp()
  const [tanggal, setTanggal] = useState(tanggalHariIni())
  const daftar = useData(() => laporanWaKelompok(db, profil.wilayah_id, tanggal), [profil.id, tanggal])
  return (
    <>
      <JudulHalaman judul="Laporan Pekanan" keterangan="Kirim ringkasan pekan ini ke orang tua satu per satu lewat WA." kembali={p.kembali} />
      <Kartu>
        <Isian label="Pekan yang memuat tanggal" type="date" nilai={tanggal} ubah={(v) => v && setTanggal(v)} />
      </Kartu>
      <KeadaanData hasil={daftar} kosong={(d) => d.length === 0} teksKosong="Belum ada generus aktif di kelompok ini.">
        {(d) => (
          <>
            {d.map((l) => (
              <Kartu key={l.generus_id} judul={l.nama}>
                {l.laporan.mondok ? (
                  <p>
                    <Lencana warna="kuning">Mondok</Lencana> Laporan dilanjutkan setelah kembali aktif.
                  </p>
                ) : (
                  <p>
                    Hadir {l.laporan.presensi.hadir} dari {l.laporan.presensi.total} · {l.laporan.materiDisahkan.length} materi disahkan
                  </p>
                )}
                <details className="teks-kode">
                  <summary>Lihat teks</summary>
                  <pre>{l.teks}</pre>
                </details>
                <div className="baris-tombol">
                  <Tombol varian="kedua" onClick={() => platform.bagikanTeks(l.teks, `Laporan ${l.nama}`)}>
                    Bagikan teks
                  </Tombol>
                  {l.tautan ? (
                    <Tombol varian="wa" onClick={() => platform.bukaTautan(l.tautan!)} label={`Kirim WA ke wali ${l.nama}`}>
                      Kirim WA ke {l.wali_nama ?? 'wali'}
                    </Tombol>
                  ) : (
                    <small className="keterangan">Nomor HP wali belum ada.</small>
                  )}
                </div>
              </Kartu>
            ))}
          </>
        )}
      </KeadaanData>
    </>
  )
}

function KirimBalasan(p: { kembali: () => void }) {
  const { db, aksi, kirimBerkas } = useApp()
  const daftar = useData(() => daftarPenerimaBalasan(db), [])
  return (
    <>
      <JudulHalaman judul="Kirim Balasan" keterangan="Kirim hasil pengesahan, kehadiran, dan jadwal ke HP generus/orang tua." kembali={p.kembali} />
      <p className="keterangan">Mubaligh baru setelah serah terima: kirim Balasan ke semua HP pada hari itu juga, agar HP generus tidak lagi menerima berkas dari mubaligh lama.</p>
      <KeadaanData hasil={daftar} kosong={(d) => d.length === 0} teksKosong="Belum ada HP generus/orang tua. Terbitkan token dulu.">
        {(d) => (
          <>
            <Tombol
              penuh
              onClick={async () => {
                const semua = await aksi(() => d.map((x) => buatBalasan(db, x.perangkatId)))
                if (semua?.length) await kirimBerkas(semua as BerkasKeluar[], `${semua.length} berkas balasan siap dikirim.`)
              }}
            >
              Kirim Balasan ke semua ({d.length} HP)
            </Tombol>
            <Kartu judul="Per HP">
              <ul className="daftar-sederhana">
                {d.map((x) => (
                  <li key={x.perangkatId}>
                    <span>
                      <b>{x.nama.join(', ')}</b>
                      <small> · {x.label ?? 'HP'}</small>
                    </span>
                    <Tombol
                      kecil
                      varian="kedua"
                      label={`Kirim balasan ke ${x.nama.join(', ')}`}
                      onClick={async () => {
                        const b = await aksi(() => buatBalasan(db, x.perangkatId))
                        if (b) await kirimBerkas(b, `Balasan untuk ${x.nama.join(', ')} siap dikirim.`)
                      }}
                    >
                      Kirim
                    </Tombol>
                  </li>
                ))}
              </ul>
            </Kartu>
          </>
        )}
      </KeadaanData>
    </>
  )
}
